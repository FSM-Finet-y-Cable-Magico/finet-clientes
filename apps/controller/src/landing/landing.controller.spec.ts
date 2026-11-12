import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { LandingController } from './landing.controller.js';
import { LandingService } from './landing.service.js';
import { ConsultaPlanesDto } from './dto/landing.dto.js';

describe('LandingController', () => {
  let controller: LandingController;
  let service: jest.Mocked<LandingService>;

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

  beforeEach(async () => {
    const mockService = {
      getPlanes: jest.fn().mockResolvedValue(mockPlanes),
    };
    const module = await Test.createTestingModule({
      controllers: [LandingController],
      providers: [{ provide: LandingService, useValue: mockService }],
    }).compile();
    controller = module.get(LandingController);
    service = module.get(LandingService);
  });

  describe('CU-15: GET /landing/planes', () => {
    it('llama al service sin argumentos cuando no hay query param', async () => {
      const query = ConsultaPlanesDto.parse({});
      await controller.getPlanes(query);
      expect(service.getPlanes).toHaveBeenCalledWith(undefined, undefined);
    });

    it('pasa tipo_cliente al service cuando se envia query param', async () => {
      const query = ConsultaPlanesDto.parse({ tipo_cliente: 'residencial' });
      await controller.getPlanes(query);
      expect(service.getPlanes).toHaveBeenCalledWith('residencial', undefined);
    });

    it('pasa la empresa al service: cada sitio pide sus planes (Finet o Cable Mágico)', async () => {
      const query = ConsultaPlanesDto.parse({ id_empresa: '2' });
      await controller.getPlanes(query);
      expect(service.getPlanes).toHaveBeenCalledWith(undefined, 2);
    });
  });

  describe('CU-15: Zod validacion de query params', () => {
    it('rechaza tipo_cliente mayor a 20 caracteres', () => {
      const result = ConsultaPlanesDto.safeParse({
        tipo_cliente: 'a'.repeat(21),
      });
      expect(result.success).toBe(false);
    });

    it('id_empresa llega como texto en la URL y se convierte a número', () => {
      expect(ConsultaPlanesDto.parse({ id_empresa: '1' }).id_empresa).toBe(1);
    });

    it('rechaza una empresa que no existe o que no es un número', () => {
      expect(ConsultaPlanesDto.safeParse({ id_empresa: '3' }).success).toBe(
        false,
      );
      expect(ConsultaPlanesDto.safeParse({ id_empresa: 'abc' }).success).toBe(
        false,
      );
      expect(ConsultaPlanesDto.safeParse({ id_empresa: '1.5' }).success).toBe(
        false,
      );
    });

    it('acepta sin tipo_cliente (es opcional)', () => {
      const result = ConsultaPlanesDto.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});
