import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { RecordatorioPagoService } from './recordatorio-pago.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { SaldoClienteService } from '../common/saldo/saldo-cliente.service.js';
import {
  CANAL_CORREO,
  ESTADO_ENVIO,
  TANDA_MAXIMA,
} from './recordatorio-pago.constantes.js';

/** El CU-71 ya escribía en esta tabla: una sola convención por columna. */
describe('CU-67: convención de valores de log_notificacion', () => {
  it('usa los mismos literales que el flujo de tickets', () => {
    expect(CANAL_CORREO).toBe('email');
    expect(ESTADO_ENVIO.ENVIADO).toBe('enviado');
    expect(ESTADO_ENVIO.FALLIDO).toBe('fallido');
    expect(ESTADO_ENVIO.NO_NOTIFICADO).toBe('omitido');
  });
});

/** Un jueves cualquiera: el vencimiento objetivo es el 2026-10-04. */
const HOY = new Date('2026-10-01T09:00:00.000Z');
const EN_TRES_DIAS = new Date('2026-10-04T00:00:00.000Z');

/** Con los datos de G8 desplegados (`SALDO_CLIENTE_DEFINIDO`). */
const PRENDIDO = { saldoDefinido: true };

/** Una factura impaga de la base: solo dice a quién preguntarle a G8. */
function fila(over: Record<string, unknown> = {}) {
  return {
    contrato: {
      cliente: {
        id_cliente: 10,
        nombre_completo: 'Juan Pérez',
        email: 'juan@example.com',
      },
    },
    ...over,
  };
}

/** Una factura como la entrega G8 (su §2 del 02-10). */
function deG8(over: Record<string, unknown> = {}) {
  return {
    idFactura: 1,
    saldoExigible: 24990,
    fechaVencimientoEfectiva: '2026-10-04',
    aceptaPagos: true,
    ...over,
  };
}

/**
 * CU-67 / RF-49. Cada test nombra la condición o excepción del caso de uso que
 * comprueba, para poder rastrearlas una por una al marcarlo listo.
 */
describe('RecordatorioPagoService', () => {
  let service: RecordatorioPagoService;
  let prisma: jest.Mocked<PrismaService>;
  let mail: jest.Mocked<MailService>;
  let saldos: { facturasDe: jest.Mock };
  let candado: jest.Mock;

  beforeEach(async () => {
    candado = jest.fn().mockResolvedValue([{ tomado: true }]);
    const mockPrisma = {
      $transaction: jest.fn(
        (fn: (tx: { $queryRaw: jest.Mock }) => Promise<unknown>) =>
          fn({ $queryRaw: candado }),
      ),
      factura: { findMany: jest.fn().mockResolvedValue([]) },
      plantilla_notificacion: {
        findFirst: jest.fn().mockResolvedValue({ id_plantilla: 5 }),
        create: jest.fn().mockResolvedValue({ id_plantilla: 5 }),
      },
      log_notificacion: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id_notificacion: 1n }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const mockMail = { sendRecordatorioPago: jest.fn().mockResolvedValue({}) };
    saldos = { facturasDe: jest.fn().mockResolvedValue([deG8()]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordatorioPagoService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMail },
        { provide: SaldoClienteService, useValue: saldos },
      ],
    }).compile();
    service = module.get(RecordatorioPagoService);
    prisma = module.get(PrismaService);
    mail = module.get(MailService);
  });

  it('corre a las 9 de Chile, no a la hora del servidor (§11: America/Santiago)', () => {
    const opciones = Reflect.getMetadata(
      'SCHEDULE_CRON_OPTIONS',
      RecordatorioPagoService.prototype.tandaDiaria,
    ) as { cronTime: string; timeZone: string };

    expect(opciones).toMatchObject({
      cronTime: '0 9 * * *',
      timeZone: 'America/Santiago',
    });
  });

  // ─── Los datos de G8 (su ratificación del 02-10, §2 y §4) ────────────────

  it('sin los datos de G8 no despacha nada y dice qué falta', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([fila()]);

    const r = await service.ejecutar(HOY);

    expect(r).toMatchObject({
      ejecutada: false,
      faltan: ['los vencimientos y saldos de G8'],
    });
    expect(prisma.factura.findMany).not.toHaveBeenCalled();
    expect(mail.sendRecordatorioPago).not.toHaveBeenCalled();
  });

  it('a G8 solo se le pregunta por los clientes con facturas impagas', async () => {
    await service.ejecutar(HOY, PRENDIDO);

    const { where } = (prisma.factura.findMany as jest.Mock).mock
      .calls[0]![0] as { where: { estado: { in: string[] } } };
    expect(where.estado.in).toEqual(['pendiente', 'vencida']);
  });

  // ─── RF-49: tres días corridos antes del vencimiento ─────────────────────

  it('recuerda la factura que según G8 vence en 3 días, con su saldo exigible', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([fila()]);

    const r = await service.ejecutar(HOY, PRENDIDO);

    expect(saldos.facturasDe).toHaveBeenCalledWith(
      { idCliente: 10, idContrato: null },
      true,
    );
    expect(mail.sendRecordatorioPago).toHaveBeenCalledWith(
      'juan@example.com',
      'Juan Pérez',
      24990,
      EN_TRES_DIAS,
    );
    expect(r).toMatchObject({ detectadas: 1, enviados: 1 });
  });

  it.each([
    ['fin de mes', '2026-10-30T09:00:00.000Z', '2026-11-02'],
    ['fin de año', '2026-12-30T09:00:00.000Z', '2027-01-02'],
    ['año bisiesto', '2028-02-26T09:00:00.000Z', '2028-02-29'],
  ])('cruza bien el %s', async (_caso, hoy, dia) => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([fila()]);
    saldos.facturasDe.mockResolvedValue([
      deG8({ fechaVencimientoEfectiva: dia }),
    ]);

    await service.ejecutar(new Date(hoy), PRENDIDO);

    expect(mail.sendRecordatorioPago).toHaveBeenCalledWith(
      'juan@example.com',
      'Juan Pérez',
      24990,
      new Date(`${dia}T00:00:00.000Z`),
    );
  });

  it('decide con el vencimiento efectivo de G8, no con una fecha de la base', async () => {
    // G8 aprobó una prórroga: ya no vence en 3 días.
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([fila()]);
    saldos.facturasDe.mockResolvedValue([
      deG8({ fechaVencimientoEfectiva: '2026-10-09' }),
    ]);

    const r = await service.ejecutar(HOY, PRENDIDO);

    expect(mail.sendRecordatorioPago).not.toHaveBeenCalled();
    expect(r.detectadas).toBe(0);
  });

  // ─── Precondición: el pago del ciclo actual no se ha realizado ───────────

  it.each([
    ['sin saldo exigible', { saldoExigible: 0 }],
    ['si G8 no acepta pagos de esa factura', { aceptaPagos: false }],
    [
      'sin vencimiento efectivo (no se adivina)',
      { fechaVencimientoEfectiva: null },
    ],
    ['sin aceptaPagos (no se adivina)', { aceptaPagos: null }],
  ])('no recuerda %s', async (_caso, over) => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([fila()]);
    saldos.facturasDe.mockResolvedValue([deG8(over)]);

    const r = await service.ejecutar(HOY, PRENDIDO);

    expect(mail.sendRecordatorioPago).not.toHaveBeenCalled();
    expect(r.detectadas).toBe(0);
  });

  it('uno por cliente, con la suma de lo que vence ese día', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([fila(), fila()]);
    saldos.facturasDe.mockResolvedValue([
      deG8({ idFactura: 1, saldoExigible: 24990 }),
      deG8({ idFactura: 2, saldoExigible: 5000 }),
      deG8({ idFactura: 3, fechaVencimientoEfectiva: '2026-11-04' }),
    ]);

    const r = await service.ejecutar(HOY, PRENDIDO);

    expect(saldos.facturasDe).toHaveBeenCalledTimes(1);
    expect(mail.sendRecordatorioPago).toHaveBeenCalledTimes(1);
    expect(mail.sendRecordatorioPago).toHaveBeenCalledWith(
      'juan@example.com',
      'Juan Pérez',
      29990,
      EN_TRES_DIAS,
    );
    expect(r.detectadas).toBe(1);
  });

  it('si G8 no responde por un cliente, no se le manda nada y se cuenta', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([fila()]);
    saldos.facturasDe.mockResolvedValue(null);

    const r = await service.ejecutar(HOY, PRENDIDO);

    expect(mail.sendRecordatorioPago).not.toHaveBeenCalled();
    expect(r).toMatchObject({ detectadas: 0, sinDatos: 1 });
  });

  // ─── Poscondición: se despacha y se registra con marca de tiempo ─────────

  it('despacha el correo y deja el registro en ENVIADO', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([fila()]);

    const r = await service.ejecutar(HOY, PRENDIDO);

    expect(prisma.log_notificacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id_cliente: 10,
        id_plantilla: 5,
        canal: CANAL_CORREO,
        estado_envio: ESTADO_ENVIO.EN_CURSO,
      }),
      select: { id_notificacion: true },
    });
    expect(prisma.log_notificacion.update).toHaveBeenCalledWith({
      where: { id_notificacion: 1n },
      data: expect.objectContaining({ estado_envio: ESTADO_ENVIO.ENVIADO }),
    });
    expect(r.enviados).toBe(1);
  });

  it('registra el envío antes de despachar, no después', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([fila()]);
    const orden: string[] = [];
    (prisma.log_notificacion.create as jest.Mock).mockImplementation(() => {
      orden.push('registro');
      return Promise.resolve({ id_notificacion: 1n });
    });
    (mail.sendRecordatorioPago as jest.Mock).mockImplementation(() => {
      orden.push('correo');
      return Promise.resolve({});
    });

    await service.ejecutar(HOY, PRENDIDO);

    expect(orden).toEqual(['registro', 'correo']);
  });

  // ─── Excepción 1: el cliente no tiene canales de contacto ────────────────

  it.each([
    ['sin correo', null],
    ['correo vacío', '   '],
  ])(
    'Excepción 1: %s → no despacha y lo registra como NO_NOTIFICADO',
    async (_caso, email) => {
      (prisma.factura.findMany as jest.Mock).mockResolvedValue([
        fila({
          contrato: {
            cliente: { id_cliente: 10, nombre_completo: 'Juan', email },
          },
        }),
      ]);

      const r = await service.ejecutar(HOY, PRENDIDO);

      expect(mail.sendRecordatorioPago).not.toHaveBeenCalled();
      expect(prisma.log_notificacion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          estado_envio: ESTADO_ENVIO.NO_NOTIFICADO,
        }),
        select: { id_notificacion: true },
      });
      expect(r.sinCanal).toBe(1);
    },
  );

  // ─── Excepción 2: falla el despacho → reintenta una vez ──────────────────

  it('Excepción 2: si el primer envío falla, reintenta y puede salir bien', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([fila()]);
    (mail.sendRecordatorioPago as jest.Mock)
      .mockRejectedValueOnce(new Error('SMTP caído'))
      .mockResolvedValueOnce({});

    const r = await service.ejecutar(HOY, PRENDIDO);

    expect(mail.sendRecordatorioPago).toHaveBeenCalledTimes(2);
    expect(prisma.log_notificacion.update).toHaveBeenCalledWith({
      where: { id_notificacion: 1n },
      data: expect.objectContaining({ estado_envio: ESTADO_ENVIO.ENVIADO }),
    });
    expect(r.enviados).toBe(1);
  });

  it('Excepción 2: si el reintento también falla, queda FALLIDO para revisión manual', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([fila()]);
    (mail.sendRecordatorioPago as jest.Mock).mockRejectedValue(
      new Error('SMTP caído'),
    );

    const r = await service.ejecutar(HOY, PRENDIDO);

    expect(mail.sendRecordatorioPago).toHaveBeenCalledTimes(2);
    expect(prisma.log_notificacion.update).toHaveBeenCalledWith({
      where: { id_notificacion: 1n },
      data: expect.objectContaining({ estado_envio: ESTADO_ENVIO.FALLIDO }),
    });
    expect(r.fallidos).toBe(1);
  });

  it('un envío que falla no tumba el resto de la tanda', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([
      fila(),
      fila({
        contrato: {
          cliente: { id_cliente: 11, nombre_completo: 'Ana', email: 'a@b.cl' },
        },
      }),
    ]);
    (mail.sendRecordatorioPago as jest.Mock)
      .mockRejectedValueOnce(new Error('falla'))
      .mockRejectedValueOnce(new Error('falla'))
      .mockResolvedValue({});

    const r = await service.ejecutar(HOY, PRENDIDO);

    expect(r).toMatchObject({ detectadas: 2, enviados: 1, fallidos: 1 });
  });

  // ─── Frecuencia: una vez por ciclo. Los dos candados ─────────────────────

  it('no manda nada si otra instancia tiene el candado', async () => {
    candado.mockResolvedValue([{ tomado: false }]);
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([fila()]);

    const r = await service.ejecutar(HOY, PRENDIDO);

    expect(r.ejecutada).toBe(false);
    expect(prisma.factura.findMany).not.toHaveBeenCalled();
    expect(mail.sendRecordatorioPago).not.toHaveBeenCalled();
  });

  it('salta al cliente que ya tiene un registro de hoy', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([fila()]);
    (prisma.log_notificacion.findFirst as jest.Mock).mockResolvedValue({
      id_notificacion: 99n,
    });

    const r = await service.ejecutar(HOY, PRENDIDO);

    expect(mail.sendRecordatorioPago).not.toHaveBeenCalled();
    expect(prisma.log_notificacion.create).not.toHaveBeenCalled();
    expect(r.yaAvisados).toBe(1);
  });

  it('busca el registro previo desde el inicio del día, no desde ahora', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([fila()]);

    await service.ejecutar(HOY, PRENDIDO);

    expect(prisma.log_notificacion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id_cliente: 10,
          fecha_envio: { gte: new Date('2026-10-01T00:00:00.000Z') },
        }),
      }),
    );
  });

  // ─── El CU-71 también escribe en log_notificacion con canal 'email' ──────

  it('el anti-duplicados filtra por plantilla, no por canal: un ticket de hoy no bloquea el recordatorio', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([fila()]);

    await service.ejecutar(HOY, PRENDIDO);

    const { where } = (prisma.log_notificacion.findFirst as jest.Mock).mock
      .calls[0]![0] as { where: Record<string, unknown> };
    expect(where).toMatchObject({ id_plantilla: 5 });
    expect(where).not.toHaveProperty('canal');
  });

  it('usa la plantilla que ya existe en vez de crear otra', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([fila()]);

    await service.ejecutar(HOY, PRENDIDO);

    expect(prisma.plantilla_notificacion.create).not.toHaveBeenCalled();
  });

  it('crea la plantilla la primera vez, con el tipo de evento y el canal', async () => {
    (prisma.plantilla_notificacion.findFirst as jest.Mock).mockResolvedValue(
      null,
    );
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([fila()]);

    await service.ejecutar(HOY, PRENDIDO);

    expect(prisma.plantilla_notificacion.create).toHaveBeenCalledWith({
      data: {
        tipo_evento: 'RECORDATORIO_PAGO',
        canal: CANAL_CORREO,
        activa: true,
      },
      select: { id_plantilla: true },
    });
  });

  it('si la plantilla no se puede resolver, igual despacha y registra', async () => {
    (prisma.plantilla_notificacion.findFirst as jest.Mock).mockRejectedValue(
      new Error('sin conexión'),
    );
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([fila()]);

    const r = await service.ejecutar(HOY, PRENDIDO);

    expect(r.enviados).toBe(1);
    expect(prisma.log_notificacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ id_plantilla: null }),
      select: { id_notificacion: true },
    });
  });

  // ─── RNF-49.1: tope de 50 mensajes por segundo ───────────────────────────

  it(`despacha en tandas de ${TANDA_MAXIMA} con pausa entre ellas`, async () => {
    const muchas = Array.from({ length: TANDA_MAXIMA + 5 }, (_, i) =>
      fila({
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

    const r = await service.ejecutar(HOY, PRENDIDO);

    expect(r.enviados).toBe(TANDA_MAXIMA + 5);
    // Una sola pausa: 55 clientes son dos tandas.
    expect(pausas).toEqual([1000]);
    sleep.mockRestore();
  });

  it('no pausa cuando entra todo en una tanda', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([fila()]);
    const sleep = jest.spyOn(global, 'setTimeout');

    await service.ejecutar(HOY, PRENDIDO);

    expect(sleep).not.toHaveBeenCalled();
    sleep.mockRestore();
  });

  // ─── Robustez ────────────────────────────────────────────────────────────

  it('no despacha si no hay clientes con facturas impagas', async () => {
    const r = await service.ejecutar(HOY, PRENDIDO);

    expect(saldos.facturasDe).not.toHaveBeenCalled();
    expect(mail.sendRecordatorioPago).not.toHaveBeenCalled();
    expect(r).toMatchObject({ detectadas: 0, ejecutada: true });
  });

  it('usa un candado de transacción, que se suelta solo, y no uno de sesión', async () => {
    await service.ejecutar(HOY, PRENDIDO);

    const sql = (candado.mock.calls[0]![0] as TemplateStringsArray).join('?');
    expect(sql).toContain('pg_try_advisory_xact_lock');
    // pg_try_advisory_lock a secas queda tomado por la conexión del pool
    // después de la tanda, y el cron del día siguiente se la salta.
    expect(sql).not.toMatch(/pg_try_advisory_lock\(/);
  });

  it('el trabajo corre dentro de la transacción que sostiene el candado', async () => {
    const orden: string[] = [];
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: { $queryRaw: jest.Mock }) => Promise<unknown>) => {
        orden.push('abre');
        const r = await fn({ $queryRaw: candado });
        orden.push('cierra');
        return r;
      },
    );
    (prisma.factura.findMany as jest.Mock).mockImplementation(() => {
      orden.push('trabaja');
      return Promise.resolve([]);
    });

    await service.ejecutar(HOY, PRENDIDO);

    expect(orden).toEqual(['abre', 'trabaja', 'cierra']);
  });

  it('si no se puede tomar el candado por un error de base, no manda nada', async () => {
    (prisma.$transaction as jest.Mock).mockRejectedValue(
      new Error('sin conexión'),
    );

    const r = await service.ejecutar(HOY, PRENDIDO);

    expect(r.ejecutada).toBe(false);
    expect(mail.sendRecordatorioPago).not.toHaveBeenCalled();
  });

  it('una factura sin cliente asociado no revienta la tanda: no hay a quién preguntarle', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([
      fila({ contrato: null }),
    ]);

    const r = await service.ejecutar(HOY, PRENDIDO);

    expect(saldos.facturasDe).not.toHaveBeenCalled();
    expect(r).toMatchObject({ detectadas: 0, ejecutada: true });
  });
});
