import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConsentimientoService } from './consentimiento.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const IP = '203.0.113.7';

/**
 * CU-76 / RF-57. Cada test nombra la condición del caso de uso que comprueba,
 * para que al marcarlo listo se pueda rastrear una por una.
 */
describe('ConsentimientoService', () => {
  let service: ConsentimientoService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      consentimiento_cookies: { create: jest.fn().mockResolvedValue({}) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentimientoService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(ConsentimientoService);
    prisma = module.get(PrismaService);
  });

  // ─── RF-57: se registran las dos opciones, aceptar y rechazar ─────────────

  it.each([
    ['la aceptación', true],
    ['el rechazo', false],
  ])('registra %s del seguimiento (RF-57)', async (_caso, acepto) => {
    const r = await service.registrarCookies(
      { acepto, version_documento: '1.1' },
      IP,
    );

    expect(r).toEqual({ registrado: true });
    expect(prisma.consentimiento_cookies.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ acepto, version_documento: '1.1' }),
    });
  });

  // ─── Queda la versión del documento que el visitante tenía a la vista ─────

  it('guarda la versión del documento tal como llega', async () => {
    await service.registrarCookies(
      { acepto: true, version_documento: '2.0' },
      IP,
    );

    expect(prisma.consentimiento_cookies.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ version_documento: '2.0' }),
    });
  });

  // ─── La IP se guarda anonimizada, igual que el consentimiento del CU-75 ───

  it('anonimiza la IP: guarda la red, no el equipo', async () => {
    await service.registrarCookies(
      { acepto: true, version_documento: '1.1' },
      IP,
    );

    expect(prisma.consentimiento_cookies.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ip_anonimizada: '203.0.113.0/24' }),
    });
  });

  it('anonimiza la IPv4 mapeada en IPv6 que entrega Express en local', async () => {
    await service.registrarCookies(
      { acepto: true, version_documento: '1.1' },
      '::ffff:203.0.113.7',
    );

    expect(prisma.consentimiento_cookies.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ip_anonimizada: '203.0.113.0/24' }),
    });
  });

  it('deja la IP en null si no se puede determinar el origen', async () => {
    await service.registrarCookies(
      { acepto: true, version_documento: '1.1' },
      '0.0.0.0',
    );

    expect(prisma.consentimiento_cookies.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ip_anonimizada: null }),
    });
  });

  // ─── No se vincula a una persona: la preferencia es del navegador ─────────

  it('no guarda id_cliente: la preferencia es por navegador, no por persona', async () => {
    await service.registrarCookies(
      { acepto: true, version_documento: '1.1' },
      IP,
    );

    const { data } = (prisma.consentimiento_cookies.create as jest.Mock).mock
      .calls[0]![0] as { data: Record<string, unknown> };
    expect(data).not.toHaveProperty('id_cliente');
  });

  it('pone la fecha de aceptación', async () => {
    await service.registrarCookies(
      { acepto: true, version_documento: '1.1' },
      IP,
    );

    const { data } = (prisma.consentimiento_cookies.create as jest.Mock).mock
      .calls[0]![0] as { data: { fecha_aceptacion: Date } };
    expect(data.fecha_aceptacion).toBeInstanceOf(Date);
  });

  // ─── Excepción 1: no se le interrumpe la navegación al visitante ──────────

  it('no lanza error si la base falla: la preferencia ya vive en la cookie', async () => {
    (prisma.consentimiento_cookies.create as jest.Mock).mockRejectedValue(
      new Error('DB caída'),
    );

    await expect(
      service.registrarCookies({ acepto: true, version_documento: '1.1' }, IP),
    ).resolves.toEqual({ registrado: false });
  });
});
