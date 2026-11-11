import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PagosService,
  enmascararRut,
  idPedidoPago,
  ordenDeCompra,
} from './pagos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EnlacePagoService } from '../common/enlaces/enlace-pago.service.js';
import { SaldoClienteService } from '../common/saldo/saldo-cliente.service.js';
import {
  ErrorIntegracionG8,
  G8IntegracionService,
} from '../common/g8/g8-integracion.service.js';
import { ConfirmacionPagoService } from '../notificaciones/confirmacion-pago.service.js';
import { WebpayService, type TransaccionWebpay } from './webpay.service.js';
import {
  IdentificadorPagoDto,
  IniciarPagoDto,
  RetornoWebpayDto,
} from './dto/pagos.dto.js';

const ANA = {
  id_cliente: 10,
  id_empresa: 1,
  nombre_completo: 'Ana Pérez',
  rut: '123456785',
};

/** Las facturas de Ana según G8: solo la 101 se puede pagar. */
const FACTURAS = [
  {
    idFactura: 101,
    saldoExigible: 14990,
    fechaVencimientoEfectiva: '2026-10-15',
    aceptaPagos: true,
  },
  {
    idFactura: 102,
    saldoExigible: 5000,
    fechaVencimientoEfectiva: '2026-11-15',
    aceptaPagos: false,
  },
  {
    idFactura: 103,
    saldoExigible: 0,
    fechaVencimientoEfectiva: '2026-09-15',
    aceptaPagos: true,
  },
];

const SESION = { idEmpresa: 1, idCliente: 10, idFactura: 101 };
const TOKEN =
  'tokendepruebatokendepruebatokendepruebatokendepruebatokendeprueb';
const RESULTADO = 'https://portal.test/pagar/resultado';

/** Lo que responde Webpay al commit de un pago aprobado (su ejemplo, adaptado). */
const APROBADA: TransaccionWebpay = {
  estado: 'AUTHORIZED',
  codigoRespuesta: 0,
  monto: 14990,
  ordenCompra: 'F101-mh2k9x1a2b3c',
  sesion: 's.firmada',
  codigoAutorizacion: '1213',
  fecha: '2026-10-29T16:41:21.063Z',
};

/** Con los dos interruptores prendidos: la pasarela y el registro de G8. */
const ENCENDIDOS = { pasarela: true, registro: true };

/**
 * CU-42 (Webpay, por factura). Cada test nombra la condición del caso de uso,
 * del contrato de G8 o de la decisión que comprueba.
 */
describe('PagosService', () => {
  let service: PagosService;
  let prisma: {
    cliente: { findUnique: jest.Mock; findFirst: jest.Mock };
    log_auditoria: { create: jest.Mock };
  };
  let saldos: { facturasDe: jest.Mock };
  let enlaces: {
    verificarEnlacePago: jest.Mock;
    firmarSesionPago: jest.Mock;
    verificarSesionPago: jest.Mock;
  };
  let g8: { registrarPago: jest.Mock };
  let webpay: {
    crear: jest.Mock;
    confirmar: jest.Mock;
    estado: jest.Mock;
    anular: jest.Mock;
  };
  let confirmacion: { confirmar: jest.Mock };

  beforeEach(async () => {
    prisma = {
      cliente: {
        findUnique: jest.fn().mockResolvedValue(ANA),
        findFirst: jest.fn().mockResolvedValue(ANA),
      },
      log_auditoria: { create: jest.fn().mockResolvedValue({}) },
    };
    saldos = { facturasDe: jest.fn().mockResolvedValue(FACTURAS) };
    enlaces = {
      verificarEnlacePago: jest.fn().mockReturnValue(10),
      firmarSesionPago: jest.fn().mockReturnValue('s.firmada'),
      verificarSesionPago: jest.fn().mockReturnValue(SESION),
    };
    g8 = {
      registrarPago: jest
        .fn()
        .mockResolvedValue({ idPago: 9001, duplicado: false }),
    };
    webpay = {
      crear: jest.fn().mockResolvedValue({
        url: 'https://webpay3gint.transbank.cl/webpayserver/initTransaction',
        token: TOKEN,
      }),
      confirmar: jest.fn().mockResolvedValue(APROBADA),
      estado: jest.fn().mockResolvedValue(APROBADA),
      anular: jest.fn().mockResolvedValue(true),
    };
    confirmacion = { confirmar: jest.fn().mockResolvedValue('enviado') };
    const config = {
      getOrThrow: (clave: string) => {
        if (clave !== 'FRONTEND_URL') throw new Error(clave);
        return 'https://portal.test';
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagosService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: SaldoClienteService, useValue: saldos },
        { provide: EnlacePagoService, useValue: enlaces },
        { provide: G8IntegracionService, useValue: g8 },
        { provide: WebpayService, useValue: webpay },
        { provide: ConfirmacionPagoService, useValue: confirmacion },
      ],
    }).compile();
    service = module.get(PagosService);
  });

  /** La fila de log_auditoria que se escribió con esa acción. */
  function auditoria(accion: string) {
    const llamada = prisma.log_auditoria.create.mock.calls.find(
      ([a]) => (a as { data: { accion: string } }).data.accion === accion,
    );
    return llamada?.[0] as
      | { data: { id_entidad_afectada: number; valor_nuevo: object } }
      | undefined;
  }

  // ─── Resumen ─────────────────────────────────────────────────────────────

  describe('resumen', () => {
    it('por RUT: la cuenta, el saldo de G8 y solo las facturas que G8 deja pagar', async () => {
      const r = await service.resumen({ rut: '12345678-5' }, ENCENDIDOS);

      expect(prisma.cliente.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { rut: { in: ['123456785', '12345678-5'] } },
        }),
      );
      expect(saldos.facturasDe).toHaveBeenCalledWith(
        expect.objectContaining({ idCliente: 10 }),
      );
      expect(r).toEqual({
        encontrado: true,
        cliente: { nombre: 'Ana Pérez', rut: 'XX.XXX.678-5' },
        saldo: 19990,
        facturas: [{ id_factura: 101, saldo: 14990, vence: '2026-10-15' }],
        medios: [expect.objectContaining({ id: 'webpay', disponible: true })],
      });
    });

    it('sin el registro de pagos de G8, Webpay se muestra como no disponible', async () => {
      const r = await service.resumen(
        { rut: '123456785' },
        { pasarela: true, registro: false },
      );

      expect(r.medios).toContainEqual(
        expect.objectContaining({ id: 'webpay', disponible: false }),
      );
    });

    it('por enlace firmado (aviso de corte o portal)', async () => {
      await service.resumen({ t: 'p.a.b.c.d' });

      expect(enlaces.verificarEnlacePago).toHaveBeenCalledWith('p.a.b.c.d');
      expect(prisma.cliente.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id_cliente: 10 } }),
      );
    });

    it('un enlace alterado o vencido es como una cuenta que no existe', async () => {
      enlaces.verificarEnlacePago.mockReturnValue(null);

      const r = await service.resumen({ t: 'falso' });

      expect(r).toEqual({
        encontrado: false,
        cliente: null,
        saldo: null,
        facturas: null,
        medios: [],
      });
      expect(prisma.cliente.findUnique).not.toHaveBeenCalled();
      expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
    });

    it('cuenta que no existe: no se le pregunta a G8', async () => {
      prisma.cliente.findFirst.mockResolvedValue(null);

      const r = await service.resumen({ rut: '123456785' });

      expect(r.encontrado).toBe(false);
      expect(saldos.facturasDe).not.toHaveBeenCalled();
    });

    it('sin el saldo de G8, ni saldo ni facturas: nunca un total inventado', async () => {
      saldos.facturasDe.mockResolvedValue(null);

      const r = await service.resumen({ rut: '123456785' });

      expect(r.saldo).toBeNull();
      expect(r.facturas).toBeNull();
    });

    it('la deuda la calcula G8: mientras no confirme su deploy, no se le pregunta', async () => {
      const facturas = { facturas: jest.fn() };
      const real = new SaldoClienteService(
        prisma as unknown as PrismaService,
        facturas as unknown as G8IntegracionService,
      );

      await expect(real.saldoDe({ idCliente: 10 }, false)).resolves.toBeNull();
      expect(facturas.facturas).not.toHaveBeenCalled();
    });
  });

  // ─── Iniciar: precondición, Excepción 1 y la transacción ─────────────────

  describe('iniciar', () => {
    it('cuenta que no existe: 404', async () => {
      prisma.cliente.findFirst.mockResolvedValue(null);

      await expect(
        service.iniciar({ rut: '123456785' }, 101, 'webpay', ENCENDIDOS),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sin el saldo de G8 no hay "deuda pendiente identificada": no se cobra nada', async () => {
      saldos.facturasDe.mockResolvedValue(null);

      await expect(
        service.iniciar({ rut: '123456785' }, 101, 'webpay', ENCENDIDOS),
      ).rejects.toThrow('No pudimos obtener tu deuda en este momento');
      expect(webpay.crear).not.toHaveBeenCalled();
    });

    it.each([
      ['que no es del cliente', 999],
      ['que G8 no deja pagar', 102],
      ['sin saldo', 103],
    ])('una factura %s: 409', async (_caso, idFactura) => {
      await expect(
        service.iniciar({ rut: '123456785' }, idFactura, 'webpay', ENCENDIDOS),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(webpay.crear).not.toHaveBeenCalled();
    });

    it.each([
      ['sin pasarela', { pasarela: false, registro: true }],
      ['sin el registro de pagos de G8', { pasarela: true, registro: false }],
    ])(
      'Excepción 1 %s: Webpay no puede utilizarse temporalmente',
      async (_caso, interruptores) => {
        const intento = service.iniciar(
          { rut: '123456785' },
          101,
          'webpay',
          interruptores,
        );

        await expect(intento).rejects.toBeInstanceOf(
          ServiceUnavailableException,
        );
        await expect(intento).rejects.toThrow(
          'Webpay no puede utilizarse temporalmente',
        );
        expect(webpay.crear).not.toHaveBeenCalled();
      },
    );

    it('crea la transacción por el saldo de G8 de esa factura, con la sesión firmada', async () => {
      const r = await service.iniciar(
        { rut: '123456785' },
        101,
        'webpay',
        ENCENDIDOS,
      );

      expect(enlaces.firmarSesionPago).toHaveBeenCalledWith(SESION);
      const [orden, sesion, monto] = webpay.crear.mock.calls[0];
      expect(orden).toMatch(/^F101-[0-9a-z]+$/);
      expect(sesion).toBe('s.firmada');
      expect(monto).toBe(14990);
      expect(r).toEqual({
        url: 'https://webpay3gint.transbank.cl/webpayserver/initTransaction',
        token: TOKEN,
      });
    });

    it('si Webpay no responde: Excepción 1', async () => {
      webpay.crear.mockRejectedValue(new Error('Webpay no respondió'));

      await expect(
        service.iniciar({ rut: '123456785' }, 101, 'webpay', ENCENDIDOS),
      ).rejects.toThrow('Webpay no puede utilizarse temporalmente');
    });

    it('un cliente sin empresa no se puede registrar en G8: Excepción 1', async () => {
      prisma.cliente.findFirst.mockResolvedValue({ ...ANA, id_empresa: null });

      await expect(
        service.iniciar({ rut: '123456785' }, 101, 'webpay', ENCENDIDOS),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(webpay.crear).not.toHaveBeenCalled();
    });
  });

  // ─── Retorno de Webpay ───────────────────────────────────────────────────

  describe('retorno', () => {
    it('aprobado: se le manda a G8 el pago exacto y sale la confirmación del CU-69', async () => {
      const url = await service.retorno({ token_ws: TOKEN }, ENCENDIDOS);

      expect(webpay.confirmar).toHaveBeenCalledWith(TOKEN);
      expect(g8.registrarPago).toHaveBeenCalledWith({
        requestId: idPedidoPago('F101-mh2k9x1a2b3c'),
        idEmpresa: 1,
        idFactura: 101,
        monto: 14990,
        fechaPago: '2026-10-29T16:41:21.063Z',
        codigoAutorizacion: '1213',
        codigoTransaccion: 'F101-mh2k9x1a2b3c',
        pasarela: 'webpay',
      });
      expect(confirmacion.confirmar).toHaveBeenCalledTimes(1);
      expect(confirmacion.confirmar).toHaveBeenCalledWith({
        idCliente: 10,
        monto: 14990,
        fecha: new Date('2026-10-29T16:41:21.063Z'),
        codigoAutorizacion: '1213',
      });
      expect(url).toBe(`${RESULTADO}?resultado=aprobado&token_ws=${TOKEN}`);
    });

    it('un cliente de Cable Mágico vuelve a la pantalla de resultado de su sitio', async () => {
      enlaces.verificarSesionPago.mockReturnValue({ ...SESION, idEmpresa: 2 });

      const url = await service.retorno({ token_ws: TOKEN }, ENCENDIDOS);

      expect(url).toBe(
        `https://portal.test/cable-magico/pagar/resultado?resultado=aprobado&token_ws=${TOKEN}`,
      );
    });

    it('un cliente de Cable Mágico que anula en Webpay también vuelve a su sitio', async () => {
      enlaces.verificarSesionPago.mockReturnValue({ ...SESION, idEmpresa: 2 });

      const url = await service.retorno(
        {
          TBK_TOKEN: TOKEN,
          TBK_ORDEN_COMPRA: 'F101-x',
          TBK_ID_SESION: 's.firmada',
        },
        ENCENDIDOS,
      );

      expect(url).toBe(
        'https://portal.test/cable-magico/pagar/resultado?resultado=cancelado',
      );
    });

    it('si G8 ya lo tenía (duplicado), no se confirma de nuevo', async () => {
      g8.registrarPago.mockResolvedValue({ idPago: 9001, duplicado: true });

      const url = await service.retorno({ token_ws: TOKEN }, ENCENDIDOS);

      expect(confirmacion.confirmar).not.toHaveBeenCalled();
      expect(url).toContain('resultado=aprobado');
    });

    it('al recargar, el commit falla pero el estado dice cómo terminó', async () => {
      webpay.confirmar.mockRejectedValue(new Error('ya confirmada'));

      const url = await service.retorno({ token_ws: TOKEN }, ENCENDIDOS);

      expect(webpay.estado).toHaveBeenCalledWith(TOKEN);
      expect(g8.registrarPago).toHaveBeenCalled();
      expect(url).toContain('resultado=aprobado');
    });

    it.each([
      ['FAILED', { estado: 'FAILED', codigoRespuesta: -1 }],
      ['autorización con código distinto de 0', { codigoRespuesta: -1 }],
    ])(
      'Excepción 3, %s: rechazado, y no se le manda nada a G8',
      async (_caso, cambio) => {
        webpay.confirmar.mockResolvedValue({ ...APROBADA, ...cambio });

        const url = await service.retorno({ token_ws: TOKEN }, ENCENDIDOS);

        expect(g8.registrarPago).not.toHaveBeenCalled();
        expect(url).toBe(`${RESULTADO}?resultado=rechazado&token_ws=${TOKEN}`);
      },
    );

    it('si Webpay no responde ni al commit ni al estado: error', async () => {
      webpay.confirmar.mockRejectedValue(new Error('caído'));
      webpay.estado.mockRejectedValue(new Error('caído'));

      const url = await service.retorno({ token_ws: TOKEN }, ENCENDIDOS);

      expect(g8.registrarPago).not.toHaveBeenCalled();
      expect(url).toBe(`${RESULTADO}?resultado=error`);
    });

    it('una transacción que no creó el portal no se registra', async () => {
      enlaces.verificarSesionPago.mockReturnValue(null);

      const url = await service.retorno({ token_ws: TOKEN }, ENCENDIDOS);

      expect(g8.registrarPago).not.toHaveBeenCalled();
      expect(url).toBe(`${RESULTADO}?resultado=error`);
    });

    it.each([
      [
        'anuló en el formulario',
        {
          TBK_TOKEN: TOKEN,
          TBK_ORDEN_COMPRA: 'F101-x',
          TBK_ID_SESION: 's.firmada',
        },
        'anulado',
      ],
      [
        'se le acabó el tiempo',
        { TBK_ORDEN_COMPRA: 'F101-x', TBK_ID_SESION: 's.firmada' },
        'tiempo_agotado',
      ],
      [
        'falló el formulario',
        {
          token_ws: TOKEN,
          TBK_TOKEN: TOKEN,
          TBK_ORDEN_COMPRA: 'F101-x',
          TBK_ID_SESION: 's.firmada',
        },
        'error_formulario',
      ],
    ])(
      'Excepción 2, el cliente %s: no se confirma y queda el intento no completado',
      async (_caso, datos, motivo) => {
        const url = await service.retorno(datos, ENCENDIDOS);

        expect(webpay.confirmar).not.toHaveBeenCalled();
        expect(g8.registrarPago).not.toHaveBeenCalled();
        expect(auditoria('PAGO_NO_COMPLETADO')?.data).toMatchObject({
          id_entidad_afectada: 10,
          valor_nuevo: { orden: 'F101-x', id_factura: 101, motivo },
        });
        expect(url).toBe(`${RESULTADO}?resultado=cancelado`);
      },
    );

    it('un intento no completado con una sesión ajena no se registra', async () => {
      enlaces.verificarSesionPago.mockReturnValue(null);

      await service.retorno(
        { TBK_ORDEN_COMPRA: 'F101-x', TBK_ID_SESION: 'falsa' },
        ENCENDIDOS,
      );

      expect(prisma.log_auditoria.create).not.toHaveBeenCalled();
    });

    it.each([
      ['sin nada', {}],
      ['con un token que no es de Webpay', { token_ws: '<script>' }],
      ['con un parámetro repetido', { token_ws: [TOKEN, TOKEN] }],
    ])('un retorno %s: error', async (_caso, datos) => {
      const url = await service.retorno(datos, ENCENDIDOS);

      expect(webpay.confirmar).not.toHaveBeenCalled();
      expect(url).toBe(`${RESULTADO}?resultado=error`);
    });

    it('G8 lo rechaza (422): se anula en Webpay y no se confirma', async () => {
      g8.registrarPago.mockRejectedValue(
        new ErrorIntegracionG8(422, 'G8 respondió 422'),
      );

      const url = await service.retorno({ token_ws: TOKEN }, ENCENDIDOS);

      expect(webpay.anular).toHaveBeenCalledWith(TOKEN, 14990);
      expect(confirmacion.confirmar).not.toHaveBeenCalled();
      expect(auditoria('PAGO_ANULADO')?.data.valor_nuevo).toMatchObject({
        idFactura: 101,
        codigoAutorizacion: '1213',
        status_g8: 422,
        anulado: true,
      });
      expect(url).toBe(`${RESULTADO}?resultado=anulado&token_ws=${TOKEN}`);
    });

    it('G8 lo rechaza y Webpay no deja anular: queda para revisar', async () => {
      g8.registrarPago.mockRejectedValue(
        new ErrorIntegracionG8(422, 'G8 respondió 422'),
      );
      webpay.anular.mockResolvedValue(false);

      const url = await service.retorno({ token_ws: TOKEN }, ENCENDIDOS);

      expect(auditoria('PAGO_SIN_REGISTRAR')).toBeDefined();
      expect(url).toContain('resultado=pendiente');
    });

    it.each([
      ['no responde', null],
      ['falla (5xx)', 502],
      ['responde conflicto (409)', 409],
    ])(
      'G8 %s: pudo quedar registrado, así que no se anula',
      async (_caso, status) => {
        g8.registrarPago.mockRejectedValue(
          new ErrorIntegracionG8(status, 'G8 no respondió'),
        );

        const url = await service.retorno({ token_ws: TOKEN }, ENCENDIDOS);

        expect(webpay.anular).not.toHaveBeenCalled();
        expect(auditoria('PAGO_SIN_REGISTRAR')?.data.valor_nuevo).toMatchObject(
          {
            requestId: idPedidoPago('F101-mh2k9x1a2b3c'),
            codigoTransaccion: 'F101-mh2k9x1a2b3c',
            status_g8: status,
          },
        );
        expect(url).toContain('resultado=pendiente');
      },
    );

    it('sin el registro de G8 no se le manda nada: queda pendiente', async () => {
      const url = await service.retorno(
        { token_ws: TOKEN },
        { pasarela: true, registro: false },
      );

      expect(g8.registrarPago).not.toHaveBeenCalled();
      expect(auditoria('PAGO_SIN_REGISTRAR')).toBeDefined();
      expect(url).toContain('resultado=pendiente');
    });
  });

  // ─── Resultado para la pantalla ──────────────────────────────────────────

  describe('resultado', () => {
    it('lo que dice Transbank de un pago aprobado', async () => {
      await expect(service.resultado(TOKEN)).resolves.toEqual({
        estado: 'aprobado',
        monto: 14990,
        fecha: '2026-10-29T16:41:21.063Z',
        codigo_autorizacion: '1213',
        orden: 'F101-mh2k9x1a2b3c',
        id_factura: 101,
      });
      expect(webpay.estado).toHaveBeenCalledWith(TOKEN);
    });

    it('rechazado o anulado: sin código de autorización', async () => {
      webpay.estado.mockResolvedValue({ ...APROBADA, estado: 'REVERSED' });

      await expect(service.resultado(TOKEN)).resolves.toMatchObject({
        estado: 'anulado',
        codigo_autorizacion: null,
      });
    });

    it('una transacción que no creó el portal: 404', async () => {
      enlaces.verificarSesionPago.mockReturnValue(null);

      await expect(service.resultado(TOKEN)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('si Webpay no responde: 503', async () => {
      webpay.estado.mockRejectedValue(new Error('caído'));

      await expect(service.resultado(TOKEN)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  // ─── Identificadores del pago ────────────────────────────────────────────

  describe('identificadores', () => {
    it('la orden de compra cabe en Webpay (26) y usa solo caracteres que acepta', () => {
      const orden = ordenDeCompra(2_147_483_647);

      expect(orden.length).toBeLessThanOrEqual(26);
      expect(orden).toMatch(/^[A-Za-z0-9|_=&%.,~:/?[+!@()>-]+$/);
    });

    it('la orden de compra es única para la misma factura', () => {
      expect(ordenDeCompra(101)).not.toBe(ordenDeCompra(101));
    });

    it('el request_id para G8 es un UUID que sale siempre igual de la misma orden', () => {
      const id = idPedidoPago('F101-mh2k9x1a2b3c');

      expect(id).toBe(idPedidoPago('F101-mh2k9x1a2b3c'));
      expect(id).not.toBe(idPedidoPago('F101-otra'));
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });
  });

  // ─── Lo que se acepta desde afuera ───────────────────────────────────────

  describe('validación', () => {
    it('exige exactamente un identificador', () => {
      expect(IdentificadorPagoDto.safeParse({}).success).toBe(false);
      expect(
        IdentificadorPagoDto.safeParse({ rut: '123456785', t: 'p.a.b.c.d' })
          .success,
      ).toBe(false);
      expect(IdentificadorPagoDto.safeParse({ t: 'p.a.b.c.d' }).success).toBe(
        true,
      );
    });

    it('rechaza un RUT con dígito verificador incorrecto', () => {
      expect(IdentificadorPagoDto.safeParse({ rut: '123456780' }).success).toBe(
        false,
      );
    });

    it('se paga una factura entera: no hay campo de monto', () => {
      const r = IniciarPagoDto.parse({
        rut: '123456785',
        id_factura: 101,
        medio: 'webpay',
        monto: 1000,
      });

      expect(r).not.toHaveProperty('monto');
    });

    it('exige la factura (G8, 02-10, §4: id_factura obligatorio)', () => {
      expect(
        IniciarPagoDto.safeParse({ rut: '123456785', medio: 'webpay' }).success,
      ).toBe(false);
      expect(
        IniciarPagoDto.safeParse({
          rut: '123456785',
          id_factura: -1,
          medio: 'webpay',
        }).success,
      ).toBe(false);
    });

    it.each(['paypal', 'mercadopago'])(
      'solo acepta Webpay: "%s" no (Mercado Pago no se construye)',
      (medio) => {
        expect(
          IniciarPagoDto.safeParse({
            rut: '123456785',
            id_factura: 101,
            medio,
          }).success,
        ).toBe(false);
      },
    );

    it('del retorno de Webpay solo acepta tokens alfanuméricos de hasta 64', () => {
      expect(RetornoWebpayDto.safeParse({ token_ws: TOKEN }).success).toBe(
        true,
      );
      expect(
        RetornoWebpayDto.safeParse({ token_ws: `${TOKEN}0` }).success,
      ).toBe(false);
      expect(RetornoWebpayDto.safeParse({ token_ws: 'a b' }).success).toBe(
        false,
      );
    });
  });

  it('enmascara el RUT: lo justo para que el cliente reconozca su cuenta', () => {
    expect(enmascararRut('123456785')).toBe('XX.XXX.678-5');
    expect(enmascararRut('93456787')).toBe('X.XXX.678-7');
  });
});
