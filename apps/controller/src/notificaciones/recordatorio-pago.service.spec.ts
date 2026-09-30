import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { RecordatorioPagoService } from './recordatorio-pago.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
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

/** Un martes cualquiera: el vencimiento objetivo es el 2026-10-04. */
const HOY = new Date('2026-10-01T09:00:00.000Z');
const EN_TRES_DIAS = new Date('2026-10-04T00:00:00.000Z');

function factura(over: Record<string, unknown> = {}) {
  return {
    id_factura: 1,
    monto: 24990,
    fecha_limite_pago: EN_TRES_DIAS,
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

/**
 * CU-67 / RF-49. Cada test nombra la condición o excepción del caso de uso que
 * comprueba, para poder rastrearlas una por una al marcarlo listo.
 */
describe('RecordatorioPagoService', () => {
  let service: RecordatorioPagoService;
  let prisma: jest.Mocked<PrismaService>;
  let mail: jest.Mocked<MailService>;

  beforeEach(async () => {
    const mockPrisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ pg_try_advisory_lock: true }]),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordatorioPagoService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMail },
      ],
    }).compile();
    service = module.get(RecordatorioPagoService);
    prisma = module.get(PrismaService);
    mail = module.get(MailService);
  });

  // ─── RF-49: tres días corridos antes del vencimiento ─────────────────────

  it('busca exactamente las facturas que vencen en 3 días', async () => {
    await service.ejecutar(HOY);

    expect(prisma.factura.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ fecha_limite_pago: EN_TRES_DIAS }),
      }),
    );
  });

  it.each([
    ['fin de mes', '2026-10-30T09:00:00.000Z', '2026-11-02T00:00:00.000Z'],
    ['fin de año', '2026-12-30T09:00:00.000Z', '2027-01-02T00:00:00.000Z'],
    ['año bisiesto', '2028-02-26T09:00:00.000Z', '2028-02-29T00:00:00.000Z'],
  ])('cruza bien el %s', async (_caso, hoy, esperado) => {
    await service.ejecutar(new Date(hoy));

    expect(prisma.factura.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fecha_limite_pago: new Date(esperado),
        }),
      }),
    );
  });

  // ─── Precondición: el pago del ciclo actual no se ha realizado ───────────

  it('solo mira facturas impagas, no las pagadas', async () => {
    await service.ejecutar(HOY);

    const { where } = (prisma.factura.findMany as jest.Mock).mock
      .calls[0]![0] as { where: { estado: { in: string[] } } };
    expect(where.estado.in).toEqual(['pendiente', 'vencida']);
  });

  // ─── Poscondición: se despacha y se registra con marca de tiempo ─────────

  it('despacha el correo y deja el registro en ENVIADO', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);

    const r = await service.ejecutar(HOY);

    expect(mail.sendRecordatorioPago).toHaveBeenCalledWith(
      'juan@example.com',
      'Juan Pérez',
      24990,
      EN_TRES_DIAS,
    );
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
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);
    const orden: string[] = [];
    (prisma.log_notificacion.create as jest.Mock).mockImplementation(() => {
      orden.push('registro');
      return Promise.resolve({ id_notificacion: 1n });
    });
    (mail.sendRecordatorioPago as jest.Mock).mockImplementation(() => {
      orden.push('correo');
      return Promise.resolve({});
    });

    await service.ejecutar(HOY);

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
        factura({
          contrato: {
            cliente: { id_cliente: 10, nombre_completo: 'Juan', email },
          },
        }),
      ]);

      const r = await service.ejecutar(HOY);

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
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);
    (mail.sendRecordatorioPago as jest.Mock)
      .mockRejectedValueOnce(new Error('SMTP caído'))
      .mockResolvedValueOnce({});

    const r = await service.ejecutar(HOY);

    expect(mail.sendRecordatorioPago).toHaveBeenCalledTimes(2);
    expect(prisma.log_notificacion.update).toHaveBeenCalledWith({
      where: { id_notificacion: 1n },
      data: expect.objectContaining({ estado_envio: ESTADO_ENVIO.ENVIADO }),
    });
    expect(r.enviados).toBe(1);
  });

  it('Excepción 2: si el reintento también falla, queda FALLIDO para revisión manual', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);
    (mail.sendRecordatorioPago as jest.Mock).mockRejectedValue(
      new Error('SMTP caído'),
    );

    const r = await service.ejecutar(HOY);

    expect(mail.sendRecordatorioPago).toHaveBeenCalledTimes(2);
    expect(prisma.log_notificacion.update).toHaveBeenCalledWith({
      where: { id_notificacion: 1n },
      data: expect.objectContaining({ estado_envio: ESTADO_ENVIO.FALLIDO }),
    });
    expect(r.fallidos).toBe(1);
  });

  it('un envío que falla no tumba el resto de la tanda', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([
      factura({ id_factura: 1 }),
      factura({
        id_factura: 2,
        contrato: {
          cliente: { id_cliente: 11, nombre_completo: 'Ana', email: 'a@b.cl' },
        },
      }),
    ]);
    (mail.sendRecordatorioPago as jest.Mock)
      .mockRejectedValueOnce(new Error('falla'))
      .mockRejectedValueOnce(new Error('falla'))
      .mockResolvedValue({});

    const r = await service.ejecutar(HOY);

    expect(r).toMatchObject({ detectadas: 2, enviados: 1, fallidos: 1 });
  });

  // ─── Frecuencia: una vez por ciclo. Los dos candados ─────────────────────

  it('no manda nada si otra instancia tiene el candado', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { pg_try_advisory_lock: false },
    ]);
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);

    const r = await service.ejecutar(HOY);

    expect(r.ejecutada).toBe(false);
    expect(prisma.factura.findMany).not.toHaveBeenCalled();
    expect(mail.sendRecordatorioPago).not.toHaveBeenCalled();
  });

  it('salta al cliente que ya tiene un registro de hoy', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);
    (prisma.log_notificacion.findFirst as jest.Mock).mockResolvedValue({
      id_notificacion: 99n,
    });

    const r = await service.ejecutar(HOY);

    expect(mail.sendRecordatorioPago).not.toHaveBeenCalled();
    expect(prisma.log_notificacion.create).not.toHaveBeenCalled();
    expect(r.yaAvisados).toBe(1);
  });

  it('busca el registro previo desde el inicio del día, no desde ahora', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);

    await service.ejecutar(HOY);

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
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);

    await service.ejecutar(HOY);

    const { where } = (prisma.log_notificacion.findFirst as jest.Mock).mock
      .calls[0]![0] as { where: Record<string, unknown> };
    expect(where).toMatchObject({ id_plantilla: 5 });
    expect(where).not.toHaveProperty('canal');
  });

  it('usa la plantilla que ya existe en vez de crear otra', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);

    await service.ejecutar(HOY);

    expect(prisma.plantilla_notificacion.create).not.toHaveBeenCalled();
  });

  it('crea la plantilla la primera vez, con el tipo de evento y el canal', async () => {
    (prisma.plantilla_notificacion.findFirst as jest.Mock).mockResolvedValue(
      null,
    );
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);

    await service.ejecutar(HOY);

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
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);

    const r = await service.ejecutar(HOY);

    expect(r.enviados).toBe(1);
    expect(prisma.log_notificacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ id_plantilla: null }),
      select: { id_notificacion: true },
    });
  });

  // ─── RNF-49.1: tope de 50 mensajes por segundo ───────────────────────────

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

    const r = await service.ejecutar(HOY);

    expect(r.enviados).toBe(TANDA_MAXIMA + 5);
    // Una sola pausa: 55 mensajes son dos tandas.
    expect(pausas).toEqual([1000]);
    sleep.mockRestore();
  });

  it('no pausa cuando entra todo en una tanda', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([factura()]);
    const sleep = jest.spyOn(global, 'setTimeout');

    await service.ejecutar(HOY);

    expect(sleep).not.toHaveBeenCalled();
    sleep.mockRestore();
  });

  // ─── Robustez ────────────────────────────────────────────────────────────

  it('no despacha si no hay facturas por vencer', async () => {
    const r = await service.ejecutar(HOY);

    expect(mail.sendRecordatorioPago).not.toHaveBeenCalled();
    expect(r).toMatchObject({ detectadas: 0, ejecutada: true });
  });

  it('si no se puede tomar el candado por un error de base, no manda nada', async () => {
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(
      new Error('sin conexión'),
    );

    const r = await service.ejecutar(HOY);

    expect(r.ejecutada).toBe(false);
    expect(mail.sendRecordatorioPago).not.toHaveBeenCalled();
  });

  it('una factura sin cliente asociado no revienta la tanda', async () => {
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([
      factura({ contrato: null }),
    ]);

    const r = await service.ejecutar(HOY);

    expect(r).toMatchObject({ detectadas: 1, sinCanal: 1 });
  });
});
