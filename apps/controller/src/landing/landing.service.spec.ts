import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { LandingService } from './landing.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('LandingService', () => {
  let service: LandingService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      plan: { findMany: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LandingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(LandingService);
    prisma = module.get(PrismaService);
  });

  describe('CU-15: Filtrando catalogo de planes por segmento', () => {
    it('retorna planes activos sin filtro', async () => {
      const mockPlanes = [
        {
          id_plan: 1,
          nombre_comercial: 'Fibra 100',
          tipo_plan: 'fibra',
          tipo_cliente: 'residencial',
          velocidad_mbps: 100,
          precio_mensual: 14990,
          descripcion: 'Plan basico',
        },
        {
          id_plan: 2,
          nombre_comercial: 'Fibra 600',
          tipo_plan: 'fibra',
          tipo_cliente: 'empresarial',
          velocidad_mbps: 600,
          precio_mensual: 29990,
          descripcion: null,
        },
      ];
      (prisma.plan.findMany as jest.Mock).mockResolvedValue(mockPlanes);

      const result = await service.getPlanes();

      expect(prisma.plan.findMany).toHaveBeenCalledWith({
        where: { activo: true },
        orderBy: { precio_mensual: 'asc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].precio_mensual).toBe(14990);
      expect(result[0].velocidad_mbps).toBe(100);
    });

    it('filtra por tipo_cliente cuando se pasa', async () => {
      const mockPlanes = [
        {
          id_plan: 1,
          nombre_comercial: 'Fibra 100',
          tipo_plan: 'fibra',
          tipo_cliente: 'residencial',
          velocidad_mbps: 100,
          precio_mensual: 14990,
          descripcion: 'Plan basico',
        },
      ];
      (prisma.plan.findMany as jest.Mock).mockResolvedValue(mockPlanes);

      const result = await service.getPlanes('residencial');

      expect(prisma.plan.findMany).toHaveBeenCalledWith({
        where: { activo: true, tipo_cliente: 'residencial' },
        orderBy: { precio_mensual: 'asc' },
      });
      expect(result).toHaveLength(1);
    });

    it('filtra por empresa cuando se pasa: cada sitio muestra solo sus planes', async () => {
      (prisma.plan.findMany as jest.Mock).mockResolvedValue([
        {
          id_plan: 2,
          id_empresa: 2,
          nombre_comercial: 'Plan QA Cable Magico',
          tipo_plan: 'fibra',
          tipo_cliente: 'Residencial',
          velocidad_mbps: 300,
          precio_mensual: 19990,
          descripcion: null,
        },
      ]);

      const result = await service.getPlanes(undefined, 2);

      expect(prisma.plan.findMany).toHaveBeenCalledWith({
        where: { activo: true, id_empresa: 2 },
        orderBy: { precio_mensual: 'asc' },
      });
      expect(result[0].id_empresa).toBe(2);
    });

    it('Excepcion 2: lanza NotFoundException cuando no hay planes para el segmento', async () => {
      (prisma.plan.findMany as jest.Mock).mockResolvedValue([]);

      await expect(service.getPlanes('empresarial')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getPlanes('empresarial')).rejects.toThrow(
        'No hay planes disponibles para este segmento',
      );
    });

    it('NO lanza error cuando no hay filtro y no hay planes (catalogo vacio)', async () => {
      (prisma.plan.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getPlanes();

      expect(result).toEqual([]);
    });

    it('Excepcion 1: lanza InternalServerErrorException cuando Prisma falla', async () => {
      (prisma.plan.findMany as jest.Mock).mockRejectedValue(
        new Error('connection refused'),
      );

      await expect(service.getPlanes()).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.getPlanes()).rejects.toThrow(
        'La seccion Planes no esta disponible temporalmente',
      );
    });
  });

  describe('CU-17: Consultando detalles de los planes de servicio', () => {
    it('cada plan retornado tiene nombre_comercial, precio_mensual y tipo_plan presentes', async () => {
      const mockPlanes = [
        {
          id_plan: 1,
          nombre_comercial: 'Fibra 100',
          tipo_plan: 'fibra',
          tipo_cliente: 'residencial',
          velocidad_mbps: 100,
          precio_mensual: 14990,
          descripcion: 'Plan basico',
        },
        {
          id_plan: 2,
          nombre_comercial: 'Fibra 600',
          tipo_plan: 'fibra',
          tipo_cliente: 'empresarial',
          velocidad_mbps: null,
          precio_mensual: 29990,
          descripcion: null,
        },
      ];
      (prisma.plan.findMany as jest.Mock).mockResolvedValue(mockPlanes);

      const result = await service.getPlanes();

      for (const plan of result) {
        expect(plan.nombre_comercial).toBeDefined();
        expect(plan.precio_mensual).toBeDefined();
        expect(plan.tipo_plan).toBeDefined();
        expect(plan.tipo_cliente).toBeDefined();
      }
    });

    it('acepta que velocidad_mbps y descripcion sean null (tarjeta con datos opcionales ausentes)', async () => {
      const mockPlanes = [
        {
          id_plan: 1,
          nombre_comercial: 'Fibra 100',
          tipo_plan: 'fibra',
          tipo_cliente: 'residencial',
          velocidad_mbps: null,
          precio_mensual: 14990,
          descripcion: null,
        },
      ];
      (prisma.plan.findMany as jest.Mock).mockResolvedValue(mockPlanes);

      const result = await service.getPlanes();

      expect(result[0].velocidad_mbps).toBeNull();
      expect(result[0].descripcion).toBeNull();
    });
  });
});
