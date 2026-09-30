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
  acepta_politica_privacidad: true,
  version_politica_privacidad: '1.1',
};

const IP = '203.0.113.7';
const IP_ANONIMIZADA = '203.0.113.0/24';

const RESULTADO_MOCK = { id_prospecto: 99 };

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
    log_auditoria: {
      create: jest.fn(),
    },
  };
}

/**
 * CU-18: el formulario público crea solo el Prospecto (acuerdo v2.0 §4 y
 * prueba §14.1).
 */
describe('ContratacionesService', () => {
  let service: ContratacionesService;
  let prisma: jest.Mocked<PrismaService>;
  let tx: ReturnType<typeof mockTx>;

  function mockTransaccionExitosa() {
    (tx.cliente.findUnique as jest.Mock).mockResolvedValue(null);
    (tx.plan.findFirst as jest.Mock).mockResolvedValue({ id_plan: 1 });
    (tx.prospecto.create as jest.Mock).mockResolvedValue({ id_prospecto: 99 });
  }

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
    it('crea el prospecto en la etapa NUEVO del pipeline (§11.10) y retorna su id', async () => {
      mockTransaccionExitosa();

      const result = await service.crear(DTO_MOCK, IP);

      expect(result).toEqual(RESULTADO_MOCK);
      expect(tx.prospecto.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id_empresa: 1,
          rut: '123456789',
          nombre_completo: 'Juan Pérez',
          email: 'juan@example.com',
          telefono: '+56912345678',
          direccion: 'Av. Siempre Viva 742, Providencia, Santiago',
          estado_pipeline: 'NUEVO',
        }),
        select: { id_prospecto: true },
      });
    });

    it('no crea cliente, dirección, contrato ni orden de trabajo (acuerdo v2.0 §14.1)', async () => {
      mockTransaccionExitosa();

      await service.crear(DTO_MOCK, IP);

      expect(tx.cliente.create).not.toHaveBeenCalled();
      expect(tx.direccion_servicio.create).not.toHaveBeenCalled();
      expect(tx.contrato.create).not.toHaveBeenCalled();
      expect(tx.orden_trabajo.create).not.toHaveBeenCalled();
    });

    it('el prospecto no queda asociado a un cliente ni convertido', async () => {
      mockTransaccionExitosa();

      await service.crear(DTO_MOCK, IP);

      const data = (tx.prospecto.create as jest.Mock).mock.calls[0]![0] as {
        data: Record<string, unknown>;
      };
      expect(data.data).not.toHaveProperty('id_cliente');
      expect(data.data).not.toHaveProperty('fecha_conversion');
    });

    it('registra la auditoría con el plan de interés, que prospecto no tiene dónde guardar', async () => {
      mockTransaccionExitosa();

      await service.crear(DTO_MOCK, IP);

      expect(prisma.log_auditoria.create).toHaveBeenCalledWith({
        data: {
          accion: 'CREAR_PROSPECTO_PORTAL',
          entidad_afectada: 'prospecto',
          id_entidad_afectada: 99,
          valor_nuevo: {
            rut: '123456789',
            id_plan: 1,
            etapa: 'NUEVO',
            origen: 'PORTAL',
          },
        },
      });
    });

    it('no lanza error si falla el registro de auditoría', async () => {
      mockTransaccionExitosa();
      (prisma.log_auditoria.create as jest.Mock).mockRejectedValue(
        new Error('DB audit down'),
      );

      const result = await service.crear(DTO_MOCK, IP);

      expect(result).toEqual(RESULTADO_MOCK);
    });

    it('acepta telefono y ciudad como null/undefined', async () => {
      const dtoSinOpcionales: ContratacionDto = {
        ...DTO_MOCK,
        telefono: null as unknown as string,
        ciudad: undefined,
      };
      mockTransaccionExitosa();

      const result = await service.crear(dtoSinOpcionales, IP);

      expect(result).toEqual(RESULTADO_MOCK);
      expect(tx.prospecto.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            telefono: null,
            direccion: 'Av. Siempre Viva 742, Providencia',
          }),
        }),
      );
    });

    // ─── Error: RUT duplicado ──────────────────────────────────────────────

    it('lanza ConflictException si el RUT ya está registrado', async () => {
      (tx.cliente.findUnique as jest.Mock).mockResolvedValue({
        id_cliente: 99,
      });

      await expect(service.crear(DTO_MOCK, IP)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.crear(DTO_MOCK, IP)).rejects.toThrow(
        'El RUT ya está registrado',
      );
    });

    // ─── Error: plan no existe ─────────────────────────────────────────────

    it('lanza NotFoundException si el plan no existe o no está activo', async () => {
      (tx.cliente.findUnique as jest.Mock).mockResolvedValue(null);
      (tx.plan.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.crear(DTO_MOCK, IP)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.crear(DTO_MOCK, IP)).rejects.toThrow(
        'El plan seleccionado no existe o no está disponible',
      );
    });

    // ─── Error: fallo inesperado ───────────────────────────────────────────

    it('lanza InternalServerErrorException con mensaje amigable si Prisma falla', async () => {
      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error('connection refused'),
      );

      await expect(service.crear(DTO_MOCK, IP)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.crear(DTO_MOCK, IP)).rejects.toThrow(
        'No fue posible procesar la contratación en este momento',
      );
    });

    it('lanza InternalServerErrorException si el callback de transacción lanza un error no-HttpException', async () => {
      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error('TX rollback'),
      );

      await expect(service.crear(DTO_MOCK, IP)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    // ─── CU-75: aceptación de la Política de Privacidad ────────────────────

    it('registra la aceptación a nombre del prospecto, dentro de la transacción (CU-75)', async () => {
      mockTransaccionExitosa();

      await service.crear(DTO_MOCK, IP);

      expect(tx.log_auditoria.create).toHaveBeenCalledWith({
        data: {
          accion: 'ACEPTAR_POLITICA_PRIVACIDAD',
          entidad_afectada: 'prospecto',
          id_entidad_afectada: 99,
          ip_origen: IP_ANONIMIZADA,
          valor_nuevo: {
            formulario: 'CONTRATACION',
            version_politica: '1.1',
            datos: {
              nombre_completo: 'Juan Pérez',
              rut: '123456789',
              email: 'juan@example.com',
              telefono: '+56912345678',
              id_plan: 1,
              direccion_completa: 'Av. Siempre Viva 742',
              comuna: 'Providencia',
              ciudad: 'Santiago',
            },
          },
        },
      });
    });

    it('anonimiza también la IPv4 mapeada en IPv6 que entrega Express (RNF-59.1)', async () => {
      mockTransaccionExitosa();

      await service.crear(DTO_MOCK, '::ffff:203.0.113.7');

      expect(tx.log_auditoria.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ ip_origen: '203.0.113.0/24' }),
      });
    });

    it('no procesa la contratación si no se puede registrar la aceptación (CU-75)', async () => {
      mockTransaccionExitosa();
      (tx.log_auditoria.create as jest.Mock).mockRejectedValue(
        new Error('insert failed'),
      );

      await expect(service.crear(DTO_MOCK, IP)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(prisma.log_auditoria.create).not.toHaveBeenCalled();
    });
  });
});
