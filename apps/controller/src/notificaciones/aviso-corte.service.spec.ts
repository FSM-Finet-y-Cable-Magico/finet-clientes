import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AvisoCorteService } from './aviso-corte.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { EnlacePagoService } from '../common/enlaces/enlace-pago.service.js';
import { SaldoClienteService } from '../common/saldo/saldo-cliente.service.js';
import {
  CANAL_CORREO,
  ESTADO_ENVIO,
  PAUSA_ENTRE_TANDAS_MS,
  TANDA_MAXIMA,
} from './recordatorio-pago.constantes.js';

/** Hoy es 2026-10-05: el aviso es por las facturas que vencieron ayer. */
const HOY = new Date('2026-10-05T09:30:00.000Z');
const AYER = new Date('2026-10-04T00:00:00.000Z');
const SITIO = 'https://portal.finet.cl';
const CON_DATOS = { pasarelaActiva: true, saldoDefinido: true };

function factura(over: Record<string, unknown> = {}) {
  return {
    id_factura: 7,
    contrato: {
      cliente: { id_cliente: 10, nombre_completo: 'Ana', email: 'ana@b.cl' },
    },
    ...over,
  };
}

/**
 * CU-68 / RF-50. Cada test nombra la condición del caso de uso que comprueba.
 */
describe('AvisoCorteService', () => {
  let service: AvisoCorteService;
  let prisma: jest.Mocked<PrismaService>;
  let mail: jest.Mocked<MailService>;
  let enlaces: EnlacePagoService;
  let candado: jest.Mock;
  let saldos: { saldoDe: jest.Mock };
  let entorno: Record<string, string | undefined>;

  beforeEach(async () => {
    candado = jest.fn().mockResolvedValue([{ tomado: true }]);
    saldos = { saldoDe: jest.fn().mockResolvedValue(57980) };
    entorno = { FRONTEND_URL: SITIO, ENLACE_PAGO_SECRET: 'clave' };
    const mockPrisma = {
      $transaction: jest.fn(
        (fn: (tx: { $queryRaw: jest.Mock }) => Promise<unknown>) =>
          fn({ $queryRaw: candado }),
      ),
      factura: { findMany: jest.fn().mockResolvedValue([]) },
      plantilla_notificacion: {
        findFirst: jest.fn().mockResolvedValue({ id_plantilla: 8 }),
        create: jest.fn().mockResolvedValue({ id_plantilla: 8 }),
      },
      log_notificacion: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id_notificacion: 1n }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const config = {
      get: (k: string) => entorno[k],
      getOrThrow: (k: string) => {
        const valor = entorno[k];
        if (!valor) throw new Error(`falta ${k}`);
        return valor;
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvisoCorteService,
        EnlacePagoService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: { sendAvisoCorte: jest.fn() } },
        { provide: SaldoClienteService, useValue: saldos },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(AvisoCorteService);
    prisma = module.get(PrismaService);
    mail = module.get(MailService);
    enlaces = module.get(EnlacePagoService);
  });

  it('corre a las 9:30 de Chile, no a la hora del servidor (§11: America/Santiago)', () => {
    const opciones = Reflect.getMetadata(
      'SCHEDULE_CRON_OPTIONS',
      AvisoCorteService.prototype.tandaDiaria,
    ) as { cronTime: string; timeZone: string };

    expect(opciones).toMatchObject({
      cronTime: '30 9 * * *',
      timeZone: 'America/Santiago',
    });
  });

  // ─── Precondición: sin pasarela activa no se despacha ────────────────────

  describe('mientras no haya pasarela', () => {
    it('no despacha, y dice qué falta: es precondición del CU-68', async () => {
      const r = await service.ejecutar(HOY, {
        ...CON_DATOS,
        pasarelaActiva: false,
      });

      expect(r.ejecutada).toBe(false);
      expect(r.faltan).toEqual([
        'una pasarela de pagos activa (precondición del CU-68)',
      ]);
      expect(prisma.factura.findMany).not.toHaveBeenCalled();
      expect(mail.sendAvisoCorte).not.toHaveBeenCalled();
    });

    it('sin el saldo de G8 tampoco: el aviso informa cuánto debe', async () => {
      const r = await service.ejecutar(HOY, {
        ...CON_DATOS,
        saldoDefinido: false,
      });

      expect(r.faltan).toEqual(['el saldo del cliente (Grupo 8)']);
      expect(mail.sendAvisoCorte).not.toHaveBeenCalled();
    });

    it('ni siquiera toma el candado', async () => {
      await service.ejecutar(HOY, { ...CON_DATOS, pasarelaActiva: false });

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('con los valores por defecto de pendientes.ts, hoy no despacha', async () => {
      const r = await service.ejecutar(HOY);

      expect(r.ejecutada).toBe(false);
      expect(r.faltan.length).toBeGreaterThan(0);
    });
  });

  // ─── Con los datos: el flujo del CU-68 ───────────────────────────────────

  it('busca las facturas impagas que vencieron ayer', async () => {
    await service.ejecutar(HOY, CON_DATOS);

    expect(prisma.factura.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          fecha_limite_pago: AYER,
          estado: { in: ['pendiente', 'vencida'] },
        },
      }),
    );
  });

  it('avisa la deuda que da G8, la fecha de corte (vencimiento + 4 días, §6.7.3) y el enlace', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);

    const r = await service.ejecutar(HOY, CON_DATOS);

    expect(saldos.saldoDe).toHaveBeenCalledWith({
      idCliente: 10,
      idContrato: null,
    });
    expect(mail.sendAvisoCorte).toHaveBeenCalledWith(
      'ana@b.cl',
      'Ana',
      57980,
      new Date('2026-10-08T00:00:00.000Z'),
      expect.stringContaining('/pagar?t='),
    );
    expect(r).toMatchObject({ detectadas: 1, enviados: 1, ejecutada: true });
  });

  it('con dos contratos vencidos ayer, un solo aviso', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([
      factura({ id_factura: 7 }),
      factura({ id_factura: 8 }),
    ]);

    const r = await service.ejecutar(HOY, CON_DATOS);

    expect(mail.sendAvisoCorte).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ detectadas: 1, enviados: 1, yaAvisados: 0 });
  });

  it('cada cliente recibe su propio aviso', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([
      factura(),
      factura({
        id_factura: 9,
        contrato: {
          cliente: { id_cliente: 11, nombre_completo: 'Beto', email: 'b@b.cl' },
        },
      }),
    ]);

    const r = await service.ejecutar(HOY, CON_DATOS);

    expect(mail.sendAvisoCorte).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ detectadas: 2, enviados: 2 });
  });

  it('RF-50: adjunta un enlace directo para pagar, firmado para ese cliente', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);

    await service.ejecutar(HOY, CON_DATOS);

    const enlace = (mail.sendAvisoCorte as jest.Mock).mock
      .calls[0]![4] as string;
    expect(enlace.startsWith(`${SITIO}/pagar?t=`)).toBe(true);
    const token = new URL(enlace).searchParams.get('t')!;
    expect(enlaces.verificarEnlacePago(token)).toBe(10);
  });

  it('registra el aviso en log_notificacion con su propia plantilla', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);

    await service.ejecutar(HOY, CON_DATOS);

    expect(prisma.plantilla_notificacion.findFirst).toHaveBeenCalledWith({
      where: { tipo_evento: 'AVISO_CORTE', canal: CANAL_CORREO },
      select: { id_plantilla: true },
    });
    expect(prisma.log_notificacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id_cliente: 10,
        id_plantilla: 8,
        canal: CANAL_CORREO,
        estado_envio: ESTADO_ENVIO.EN_CURSO,
      }),
      select: { id_notificacion: true },
    });
    expect(prisma.log_notificacion.update).toHaveBeenCalledWith({
      where: { id_notificacion: 1n },
      data: expect.objectContaining({ estado_envio: ESTADO_ENVIO.ENVIADO }),
    });
  });

  it('registra el aviso antes de despachar, no después', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);
    const orden: string[] = [];
    (prisma.log_notificacion.create as jest.Mock).mockImplementation(() => {
      orden.push('registro');
      return Promise.resolve({ id_notificacion: 1n });
    });
    (mail.sendAvisoCorte as jest.Mock).mockImplementation(() => {
      orden.push('correo');
      return Promise.resolve();
    });

    await service.ejecutar(HOY, CON_DATOS);

    expect(orden).toEqual(['registro', 'correo']);
  });

  it('si G8 ya no le registra deuda, no hay corte que avisar', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);
    saldos.saldoDe.mockResolvedValue(0);

    const r = await service.ejecutar(HOY, CON_DATOS);

    expect(mail.sendAvisoCorte).not.toHaveBeenCalled();
    expect(prisma.log_notificacion.create).not.toHaveBeenCalled();
    expect(r.sinDeuda).toBe(1);
  });

  it('si G8 no puede dar el saldo de ese cliente, no se inventa: queda fallido', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);
    saldos.saldoDe.mockResolvedValue(null);

    const r = await service.ejecutar(HOY, CON_DATOS);

    expect(mail.sendAvisoCorte).not.toHaveBeenCalled();
    expect(r.fallidos).toBe(1);
  });

  // ─── Excepciones del CU-68 ───────────────────────────────────────────────

  it('Excepción 1: sin correo, no despacha y queda omitido', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([
      factura({
        contrato: {
          cliente: { id_cliente: 10, nombre_completo: 'Ana', email: null },
        },
      }),
    ]);

    const r = await service.ejecutar(HOY, CON_DATOS);

    expect(mail.sendAvisoCorte).not.toHaveBeenCalled();
    expect(prisma.log_notificacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        estado_envio: ESTADO_ENVIO.NO_NOTIFICADO,
      }),
      select: { id_notificacion: true },
    });
    expect(r.sinCanal).toBe(1);
  });

  it('Excepción 2: si falla, reintenta una vez', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);
    (mail.sendAvisoCorte as jest.Mock)
      .mockRejectedValueOnce(new Error('SMTP caído'))
      .mockResolvedValueOnce(undefined);

    const r = await service.ejecutar(HOY, CON_DATOS);

    expect(mail.sendAvisoCorte).toHaveBeenCalledTimes(2);
    expect(r.enviados).toBe(1);
  });

  it('Excepción 2: si el reintento también falla, queda fallido', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);
    (mail.sendAvisoCorte as jest.Mock).mockRejectedValue(
      new Error('SMTP caído'),
    );

    const r = await service.ejecutar(HOY, CON_DATOS);

    expect(prisma.log_notificacion.update).toHaveBeenCalledWith({
      where: { id_notificacion: 1n },
      data: expect.objectContaining({ estado_envio: ESTADO_ENVIO.FALLIDO }),
    });
    expect(r.fallidos).toBe(1);
  });

  // ─── RNF-49.1 (dependencia RF-49): tope de 50 mensajes por segundo ───────

  it(`despacha en tandas de ${TANDA_MAXIMA} con pausa entre ellas`, async () => {
    const muchas = Array.from({ length: TANDA_MAXIMA + 5 }, (_, i) =>
      factura({
        id_factura: i + 1,
        contrato: {
          cliente: {
            id_cliente: i + 1,
            nombre_completo: `Cliente ${i}`,
            email: `c${i}@example.com`,
          },
        },
      }),
    );
    (prisma.factura.findMany as jest.Mock).mockResolvedValue(muchas);
    const pausas: number[] = [];
    const sleep = jest.spyOn(global, 'setTimeout').mockImplementation(((
      cb: () => void,
      ms: number,
    ) => {
      pausas.push(ms);
      cb();
      return 0 as unknown as NodeJS.Timeout;
    }) as unknown as typeof setTimeout);

    const r = await service.ejecutar(HOY, CON_DATOS);

    expect(r.enviados).toBe(TANDA_MAXIMA + 5);
    // Una sola pausa: 55 mensajes son dos tandas.
    expect(pausas).toEqual([PAUSA_ENTRE_TANDAS_MS]);
    sleep.mockRestore();
  });

  // ─── Frecuencia: una vez por evento de morosidad ─────────────────────────

  it('no avisa dos veces al mismo cliente el mismo día', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);
    (prisma.log_notificacion.findFirst as jest.Mock).mockResolvedValue({
      id_notificacion: 99n,
    });

    const r = await service.ejecutar(HOY, CON_DATOS);

    expect(mail.sendAvisoCorte).not.toHaveBeenCalled();
    expect(r.yaAvisados).toBe(1);
  });

  it('otra instancia con el candado: no hace nada', async () => {
    candado.mockResolvedValue([{ tomado: false }]);
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);

    const r = await service.ejecutar(HOY, CON_DATOS);

    expect(r.ejecutada).toBe(false);
    expect(mail.sendAvisoCorte).not.toHaveBeenCalled();
  });

  it('usa un candado de transacción distinto al del CU-67', async () => {
    await service.ejecutar(HOY, CON_DATOS);

    const valores = candado.mock.calls[0]!.slice(1);
    const sql = (candado.mock.calls[0]![0] as TemplateStringsArray).join('?');
    expect(sql).toContain('pg_try_advisory_xact_lock');
    expect(valores).toEqual([6820260930]);
  });

  it('sin la URL del sitio no despacha nada, para no mandar enlaces rotos', async () => {
    entorno.FRONTEND_URL = undefined;
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);

    const r = await service.ejecutar(HOY, CON_DATOS);

    expect(r.ejecutada).toBe(false);
    expect(mail.sendAvisoCorte).not.toHaveBeenCalled();
    expect(prisma.log_notificacion.create).not.toHaveBeenCalled();
  });

  it('sin la clave de los enlaces tampoco: nadie queda como fallido por un error de configuración', async () => {
    entorno.ENLACE_PAGO_SECRET = undefined;
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);

    const r = await service.ejecutar(HOY, CON_DATOS);

    expect(r.ejecutada).toBe(false);
    expect(mail.sendAvisoCorte).not.toHaveBeenCalled();
    expect(prisma.log_notificacion.create).not.toHaveBeenCalled();
  });
});
