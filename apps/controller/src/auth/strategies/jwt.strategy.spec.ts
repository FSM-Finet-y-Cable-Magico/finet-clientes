import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const mockCliente = {
  id_cliente: 1,
  rut: '123456785',
  nombre_completo: 'Juan Pérez',
  email: 'juan@test.cl',
  telefono: '912345678',
  estado: 'activo',
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: PrismaService,
          useValue: {
            sesion_portal: {
              findFirst: jest.fn(),
              updateMany: jest.fn(),
            },
            cliente: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('test-jwt-secret'),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    prisma = module.get<PrismaService>(PrismaService);
  });

  const mockReq = {
    headers: {
      authorization: 'Bearer test-token',
    },
    cookies: {},
  } as any;

  const mockPayload = { sub: 1, rut: '123456785' };

  describe('session inactivity', () => {
    it('return cliente and extend session when active', async () => {
      (prisma.sesion_portal.findFirst as jest.Mock).mockResolvedValue({
        id_sesion: 10,
        token: 'test-token',
      });
      (prisma.sesion_portal.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue(mockCliente);

      const result = await strategy.validate(mockReq, mockPayload);

      expect(result).toEqual(mockCliente);
      expect(prisma.sesion_portal.findFirst).toHaveBeenCalledWith({
        where: {
          token: 'test-token',
          fecha_expiracion: { gt: expect.any(Date) },
        },
      });
      expect(prisma.sesion_portal.updateMany).toHaveBeenCalledWith({
        where: { token: 'test-token' },
        data: { fecha_expiracion: expect.any(Date) },
      });
    });

    it('throw UnauthorizedException when session expired', async () => {
      (prisma.sesion_portal.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue(mockCliente);

      await expect(strategy.validate(mockReq, mockPayload)).rejects.toThrow(
        'Sesión expirada por inactividad',
      );

      expect(prisma.cliente.findUnique).not.toHaveBeenCalled();
    });

    it('throw UnauthorizedException when cliente not found after valid session', async () => {
      (prisma.sesion_portal.findFirst as jest.Mock).mockResolvedValue({
        id_sesion: 10,
        token: 'test-token',
      });
      (prisma.sesion_portal.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(strategy.validate(mockReq, mockPayload)).rejects.toThrow(
        'Cliente no encontrado',
      );
    });
  });

  /** Un token por empresa, como G8 (11-11): la empresa del token es la del cliente. */
  describe('empresa del token', () => {
    const clienteCable = { ...mockCliente, id_empresa: 2 };

    beforeEach(() => {
      (prisma.sesion_portal.findFirst as jest.Mock).mockResolvedValue({
        id_sesion: 10,
        token: 'test-token',
      });
      (prisma.sesion_portal.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue(clienteCable);
    });

    it('la sesión trae la empresa del cliente, leída de la base', async () => {
      const result = await strategy.validate(mockReq, {
        ...mockPayload,
        id_empresa: 2,
      });

      expect(result).toEqual(clienteCable);
      expect(prisma.cliente.findUnique).toHaveBeenCalledWith({
        where: { id_cliente: 1 },
        select: expect.objectContaining({ id_empresa: true }),
      });
    });

    it('un token con otra empresa no sirve', async () => {
      await expect(
        strategy.validate(mockReq, { ...mockPayload, id_empresa: 1 }),
      ).rejects.toThrow('Token de empresa invalido');
    });

    it('un token anterior, sin la empresa, sigue sirviendo con la de la base', async () => {
      const result = await strategy.validate(mockReq, mockPayload);

      expect(result).toEqual(clienteCable);
    });
  });
});
