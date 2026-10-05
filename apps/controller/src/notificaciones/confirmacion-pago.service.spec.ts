import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConfirmacionPagoService,
  type PagoRegistrado,
} from './confirmacion-pago.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { CANAL_CORREO, ESTADO_ENVIO } from './recordatorio-pago.constantes.js';

const AHORA = new Date('2026-10-05T13:05:00.000Z');
const PAGO: PagoRegistrado = {
  idCliente: 10,
  monto: 57980,
  fecha: new Date('2026-10-05T13:04:30.000Z'),
  codigoAutorizacion: 'AUT-123456',
};

/**
 * CU-69 / RF-51. Cada test nombra la condición del caso de uso que comprueba.
 */
describe('ConfirmacionPagoService', () => {
  let service: ConfirmacionPagoService;
  let prisma: jest.Mocked<PrismaService>;
  let mail: jest.Mocked<MailService>;

  beforeEach(async () => {
    const mockPrisma = {
      cliente: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ nombre_completo: 'Ana', email: 'ana@b.cl' }),
      },
      plantilla_notificacion: {
        findFirst: jest.fn().mockResolvedValue({ id_plantilla: 9 }),
        create: jest.fn().mockResolvedValue({ id_plantilla: 9 }),
      },
      log_notificacion: {
        create: jest.fn().mockResolvedValue({ id_notificacion: 1n }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfirmacionPagoService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: { sendConfirmacionPago: jest.fn() } },
      ],
    }).compile();
    service = module.get(ConfirmacionPagoService);
    prisma = module.get(PrismaService);
    mail = module.get(MailService);
  });

  // ─── Descripción y poscondición ──────────────────────────────────────────

  it('recupera los canales de contacto del cliente que pagó', async () => {
    await service.confirmar(PAGO, AHORA);

    expect(prisma.cliente.findUnique).toHaveBeenCalledWith({
      where: { id_cliente: 10 },
      select: { nombre_completo: true, email: true },
    });
  });

  it('RF-51: despacha la confirmación con los datos del pago registrado (RF-32)', async () => {
    const estado = await service.confirmar(PAGO, AHORA);

    expect(mail.sendConfirmacionPago).toHaveBeenCalledWith(
      'ana@b.cl',
      'Ana',
      57980,
      PAGO.fecha,
      'AUT-123456',
    );
    expect(estado).toBe('enviado');
  });

  it('registra el envío en el historial con su propia plantilla y marca de tiempo', async () => {
    await service.confirmar(PAGO, AHORA);

    expect(prisma.plantilla_notificacion.findFirst).toHaveBeenCalledWith({
      where: { tipo_evento: 'CONFIRMACION_PAGO', canal: CANAL_CORREO },
      select: { id_plantilla: true },
    });
    expect(prisma.log_notificacion.create).toHaveBeenCalledWith({
      data: {
        id_cliente: 10,
        id_plantilla: 9,
        canal: CANAL_CORREO,
        fecha_envio: AHORA,
        estado_envio: ESTADO_ENVIO.EN_CURSO,
      },
      select: { id_notificacion: true },
    });
    expect(prisma.log_notificacion.update).toHaveBeenCalledWith({
      where: { id_notificacion: 1n },
      data: expect.objectContaining({ estado_envio: ESTADO_ENVIO.ENVIADO }),
    });
  });

  it('registra antes de despachar, no después', async () => {
    const orden: string[] = [];
    (prisma.log_notificacion.create as jest.Mock).mockImplementation(() => {
      orden.push('registro');
      return Promise.resolve({ id_notificacion: 1n });
    });
    (mail.sendConfirmacionPago as jest.Mock).mockImplementation(() => {
      orden.push('correo');
      return Promise.resolve();
    });

    await service.confirmar(PAGO, AHORA);

    expect(orden).toEqual(['registro', 'correo']);
  });

  it('RNF-51.1: se dispara al confirmar el pago, no espera a una tarea programada', () => {
    expect(
      Reflect.getMetadata(
        'SCHEDULE_CRON_OPTIONS',
        ConfirmacionPagoService.prototype.confirmar,
      ),
    ).toBeUndefined();
  });

  // ─── Excepciones del CU-69 ───────────────────────────────────────────────

  it('Excepción 1: sin correo, no despacha y queda como no notificado', async () => {
    (prisma.cliente.findUnique as jest.Mock).mockResolvedValue({
      nombre_completo: 'Ana',
      email: null,
    });

    const estado = await service.confirmar(PAGO, AHORA);

    expect(mail.sendConfirmacionPago).not.toHaveBeenCalled();
    expect(prisma.log_notificacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        estado_envio: ESTADO_ENVIO.NO_NOTIFICADO,
      }),
      select: { id_notificacion: true },
    });
    expect(estado).toBe('omitido');
  });

  it('Excepción 2: si falla, reintenta una vez', async () => {
    (mail.sendConfirmacionPago as jest.Mock)
      .mockRejectedValueOnce(new Error('SMTP caído'))
      .mockResolvedValueOnce(undefined);

    const estado = await service.confirmar(PAGO, AHORA);

    expect(mail.sendConfirmacionPago).toHaveBeenCalledTimes(2);
    expect(estado).toBe('enviado');
  });

  it('Excepción 2: si el reintento también falla, queda fallido para revisión manual', async () => {
    (mail.sendConfirmacionPago as jest.Mock).mockRejectedValue(
      new Error('SMTP caído'),
    );

    const estado = await service.confirmar(PAGO, AHORA);

    expect(prisma.log_notificacion.update).toHaveBeenCalledWith({
      where: { id_notificacion: 1n },
      data: expect.objectContaining({ estado_envio: ESTADO_ENVIO.FALLIDO }),
    });
    expect(estado).toBe('fallido');
  });

  // ─── El pago ya está registrado: la confirmación no puede romperlo ───────

  it('no lanza aunque la base falle: el pago ya registrado no se toca', async () => {
    (prisma.cliente.findUnique as jest.Mock).mockRejectedValue(
      new Error('base caída'),
    );

    await expect(service.confirmar(PAGO, AHORA)).resolves.toBe('fallido');
    expect(mail.sendConfirmacionPago).not.toHaveBeenCalled();
  });
});
