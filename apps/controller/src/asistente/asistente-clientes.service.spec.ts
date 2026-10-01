import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { AsistenteClientesService } from './asistente-clientes.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('AsistenteClientesService', () => {
  let service: AsistenteClientesService;
  let findFirst: jest.Mock;

  beforeEach(async () => {
    findFirst = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AsistenteClientesService,
        { provide: PrismaService, useValue: { cliente: { findFirst } } },
      ],
    }).compile();
    service = module.get(AsistenteClientesService);
  });

  describe('CU-63: identificar', () => {
    it('retorna encontrado:false si el RUT no existe', async () => {
      findFirst.mockResolvedValue(null as never);

      await expect(service.identificar('12.345.678-5')).resolves.toEqual({
        encontrado: false,
        cliente: null,
      });
    });

    it('devuelve nombre y planes con el estado de cada contrato', async () => {
      findFirst.mockResolvedValue({
        nombre_completo: 'Juan Pérez',
        contrato: [
          {
            estado: 'activo',
            plan: {
              nombre_comercial: 'Fibra 600',
              tipo_plan: 'fibra',
              velocidad_mbps: 600,
            },
          },
          // Contrato sin plan asociado: no aporta nada que mostrar.
          { estado: 'activo', plan: null },
        ],
      } as never);

      await expect(service.identificar('12.345.678-5')).resolves.toEqual({
        encontrado: true,
        cliente: {
          nombre_completo: 'Juan Pérez',
          planes: [
            {
              nombre_comercial: 'Fibra 600',
              tipo_plan: 'fibra',
              velocidad_mbps: 600,
              estado_contrato: 'activo',
            },
          ],
        },
      });
    });

    it('busca el RUT limpio, con la K en ambas cajas', async () => {
      findFirst.mockResolvedValue(null as never);

      await service.identificar('7.654.302-K');

      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { rut: { in: ['7654302K', '7654302k'] } },
        }),
      );
    });

    it('no pide a la base datos que no se mandan al asistente', async () => {
      findFirst.mockResolvedValue(null as never);

      await service.identificar('12.345.678-5');

      const { select } = findFirst.mock.calls[0][0] as {
        select: Record<string, unknown>;
      };
      expect(Object.keys(select).sort()).toEqual([
        'contrato',
        'nombre_completo',
      ]);
    });
  });
});
