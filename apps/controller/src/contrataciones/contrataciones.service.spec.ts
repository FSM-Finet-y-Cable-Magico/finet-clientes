import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ContratacionesService } from './contrataciones.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ContratacionDto } from './dto/contratacion.dto.js';

const DTO_MOCK: ContratacionDto = {
  nombre_completo: 'Juan Pérez',
  rut: '123456789',
  email: 'juan@example.com',
  telefono: '+56912345678',
  id_plan: 1,
  direccion_completa: 'Av. Siempre Viva 742',
  comuna: 'Providencia',
  ciudad: 'Santiago',
};

const RESULTADO_MOCK = { id_cliente: 10, id_contrato: 20, id_ot: 30 };

function mockTx() {
  return {
    cliente: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    plan: {
      findFirst: jest.fn(),
    },
    direccion_servicio: {
      create: jest.fn(),
    },
    contrato: {
      create: jest.fn(),
    },
    orden_trabajo: {
      create: jest.fn(),
    },
    prospecto: {
      create: jest.fn(),
    },
  };
}

describe('ContratacionesService', () => {
  let service: ContratacionesService;
  let prisma: jest.Mocked<PrismaService>;
  let tx: ReturnType<typeof mockTx>;

  beforeEach(async () => {
    tx = mockTx();

    const mockPrisma = {
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
      log_auditoria: { create: jest.fn().mockResolvedValue({}) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContratacionesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(ContratacionesService);
    prisma = module.get(PrismaService);
  });

  // ─── Happy path ───────────────────────────────────────────────────────────

  describe('crear', () => {
    it('crea cliente, dirección, contrato, OT y prospecto en una transacción y retorna IDs', async () => {
      (tx.cliente.findUnique as jest.Mock).mockResolvedValue(null);
      (tx.plan.findFirst as jest.Mock).mockResolvedValue({ id_plan: 1 });
      (tx.cliente.create as jest.Mock).mockResolvedValue({ id_cliente: 10 });
      (tx.direccion_servicio.create as jest.Mock).mockResolvedValue({
        id_direccion: 50,
      });
      (tx.contrato.create as jest.Mock).mockResolvedValue({ id_contrato: 20 });
      (tx.orden_trabajo.create as jest.Mock).mockResolvedValue({ id_ot: 30 });
      (tx.prospecto.create as jest.Mock).mockResolvedValue({
        id_prospecto: 99,
      });

      const result = await service.crear(DTO_MOCK);

      expect(result).toEqual(RESULTADO_MOCK);

      expect(tx.cliente.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nombre_completo: 'Juan Pérez',
          rut: '123456789',
          email: 'juan@example.com',
          id_empresa: 1,
          estado: 'pendiente',
        }),
      });

      expect(tx.direccion_servicio.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id_cliente: 10,
          direccion_completa: 'Av. Siempre Viva 742',
          comuna: 'Providencia',
          es_principal: true,
        }),
      });

      expect(tx.contrato.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id_cliente: 10,
          id_plan: 1,
          estado: 'PENDIENTE',
          dia_vencimiento: 5,
        }),
      });

      expect(tx.orden_trabajo.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id_cliente: 10,
          id_direccion: 50,
          tipo_ot: 'instalacion',
          estado: 'pendiente',
        }),
      });

      expect(tx.prospecto.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id_cliente: 10,
          rut: '123456789',
          estado_pipeline: 'ACTIVO',
          tiempo_conversion_dias: 0,
        }),
      });
    });

    it('registra auditoría después de crear la contratación', async () => {
      (tx.cliente.findUnique as jest.Mock).mockResolvedValue(null);
      (tx.plan.findFirst as jest.Mock).mockResolvedValue({ id_plan: 1 });
      (tx.cliente.create as jest.Mock).mockResolvedValue({ id_cliente: 10 });
      (tx.direccion_servicio.create as jest.Mock).mockResolvedValue({
        id_direccion: 50,
      });
      (tx.contrato.create as jest.Mock).mockResolvedValue({ id_contrato: 20 });
      (tx.orden_trabajo.create as jest.Mock).mockResolvedValue({ id_ot: 30 });
      (tx.prospecto.create as jest.Mock).mockResolvedValue({
        id_prospecto: 99,
      });

      await service.crear(DTO_MOCK);

      expect(prisma.log_auditoria.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accion: 'CREAR_CONTRATACION',
          entidad_afectada: 'cliente',
          id_entidad_afectada: 10,
          valor_nuevo: expect.objectContaining({
            id_contrato: 20,
            id_ot: 30,
            rut: '123456789',
            plan: 1,
          }),
        }),
      });
    });

    it('no lanza error si falla el registro de auditoría', async () => {
      (tx.cliente.findUnique as jest.Mock).mockResolvedValue(null);
      (tx.plan.findFirst as jest.Mock).mockResolvedValue({ id_plan: 1 });
      (tx.cliente.create as jest.Mock).mockResolvedValue({ id_cliente: 10 });
      (tx.direccion_servicio.create as jest.Mock).mockResolvedValue({
        id_direccion: 50,
      });
      (tx.contrato.create as jest.Mock).mockResolvedValue({ id_contrato: 20 });
      (tx.orden_trabajo.create as jest.Mock).mockResolvedValue({ id_ot: 30 });
      (tx.prospecto.create as jest.Mock).mockResolvedValue({
        id_prospecto: 99,
      });
      (prisma.log_auditoria.create as jest.Mock).mockRejectedValue(
        new Error('DB audit down'),
      );

      const result = await service.crear(DTO_MOCK);

      expect(result).toEqual(RESULTADO_MOCK);
    });

    it('acepta telefono y ciudad como null/undefined', async () => {
      const dtoSinOpcionales: ContratacionDto = {
        ...DTO_MOCK,
        telefono: null as unknown as string,
        ciudad: undefined,
      };
      (tx.cliente.findUnique as jest.Mock).mockResolvedValue(null);
      (tx.plan.findFirst as jest.Mock).mockResolvedValue({ id_plan: 1 });
      (tx.cliente.create as jest.Mock).mockResolvedValue({ id_cliente: 10 });
      (tx.direccion_servicio.create as jest.Mock).mockResolvedValue({
        id_direccion: 50,
      });
      (tx.contrato.create as jest.Mock).mockResolvedValue({ id_contrato: 20 });
      (tx.orden_trabajo.create as jest.Mock).mockResolvedValue({ id_ot: 30 });
      (tx.prospecto.create as jest.Mock).mockResolvedValue({
        id_prospecto: 99,
      });

      const result = await service.crear(dtoSinOpcionales);

      expect(result).toEqual(RESULTADO_MOCK);
    });

    // ─── Error: RUT duplicado ──────────────────────────────────────────────

    it('lanza ConflictException si el RUT ya está registrado', async () => {
      (tx.cliente.findUnique as jest.Mock).mockResolvedValue({
        id_cliente: 99,
      });

      await expect(service.crear(DTO_MOCK)).rejects.toThrow(ConflictException);
      await expect(service.crear(DTO_MOCK)).rejects.toThrow(
        'El RUT ya está registrado',
      );
    });

    // ─── Error: plan no existe ─────────────────────────────────────────────

    it('lanza NotFoundException si el plan no existe o no está activo', async () => {
      (tx.cliente.findUnique as jest.Mock).mockResolvedValue(null);
      (tx.plan.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.crear(DTO_MOCK)).rejects.toThrow(NotFoundException);
      await expect(service.crear(DTO_MOCK)).rejects.toThrow(
        'El plan seleccionado no existe o no está disponible',
      );
    });

    // ─── Error: fallo inesperado ───────────────────────────────────────────

    it('lanza InternalServerErrorException con mensaje amigable si Prisma falla', async () => {
      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error('connection refused'),
      );

      await expect(service.crear(DTO_MOCK)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.crear(DTO_MOCK)).rejects.toThrow(
        'No fue posible procesar la contratación en este momento',
      );
    });

    it('lanza InternalServerErrorException si el callback de transacción lanza un error no-HttpException', async () => {
      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error('TX rollback'),
      );

      await expect(service.crear(DTO_MOCK)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
