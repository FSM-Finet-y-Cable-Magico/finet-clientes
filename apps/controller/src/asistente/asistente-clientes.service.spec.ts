import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AsistenteClientesService,
  CATEGORIA_ESCALAMIENTO,
} from './asistente-clientes.service.js';
import type { EscalarConversacionDto } from './dto/asistente.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';

describe('AsistenteClientesService', () => {
  let service: AsistenteClientesService;
  let findFirst: jest.Mock;
  let tx: {
    cliente: { findFirst: jest.Mock };
    categoria_falla: { findFirst: jest.Mock; create: jest.Mock };
    conversacion_bot: { create: jest.Mock };
    ticket: { create: jest.Mock; update: jest.Mock };
    log_auditoria: { create: jest.Mock };
  };

  beforeEach(async () => {
    findFirst = jest.fn();
    tx = {
      cliente: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id_cliente: 7, id_empresa: 1 } as never),
      },
      categoria_falla: {
        findFirst: jest.fn().mockResolvedValue({ id_categoria: 9 } as never),
        create: jest.fn().mockResolvedValue({ id_categoria: 10 } as never),
      },
      conversacion_bot: {
        create: jest.fn().mockResolvedValue({ id_conversacion: 55 } as never),
      },
      ticket: {
        create: jest.fn().mockResolvedValue({
          id_ticket: 123,
          fecha_creacion: new Date('2026-10-04T12:00:00'),
        } as never),
        update: jest.fn().mockResolvedValue({} as never),
      },
      log_auditoria: { create: jest.fn().mockResolvedValue({} as never) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AsistenteClientesService,
        {
          provide: PrismaService,
          useValue: {
            cliente: { findFirst },
            $transaction: (trabajo: (t: typeof tx) => Promise<unknown>) =>
              trabajo(tx),
          },
        },
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
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

  describe('CU-77: escalar', () => {
    const derivacion: EscalarConversacionDto = {
      id_sesion: 'web:3f6c8a52-7d1e-4b9a-9c2f-5e8d1a0b7c64',
      rut: '12.345.678-5',
      plataforma: 'web',
      motivo: 'Pide la baja del servicio',
      historial: [
        { rol: 'user', contenido: 'quiero dar de baja mi plan' },
        { rol: 'assistant', contenido: 'Puedo derivarte con una persona.' },
      ],
    };

    it('abre un ticket del cliente y devuelve su codigo de seguimiento', async () => {
      await expect(service.escalar(derivacion)).resolves.toEqual({
        id_ticket: 123,
        codigo_seguimiento: 'FIN-2026-000123',
      });
      expect(tx.cliente.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { rut: { in: ['123456785'] } },
        }),
      );
      expect(tx.ticket.update).toHaveBeenCalledWith({
        where: { id_ticket: 123 },
        data: { codigo_seguimiento: 'FIN-2026-000123' },
      });
    });

    it('guarda la conversacion derivada con su historial', async () => {
      await service.escalar(derivacion);

      expect(tx.conversacion_bot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id_cliente: 7,
            plataforma: 'web',
            derivada_humano: true,
            mensaje_bot: {
              create: [
                { rol: 'cliente', contenido: 'quiero dar de baja mi plan' },
                {
                  rol: 'asistente',
                  contenido: 'Puedo derivarte con una persona.',
                },
              ],
            },
          }),
        }),
      );
    });

    it('deja el ticket abierto y sin operador, para que lo tome el CRM', async () => {
      await service.escalar(derivacion);

      const { data } = tx.ticket.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).toEqual({
        id_cliente: 7,
        id_empresa: 1,
        id_categoria: 9,
        id_conversacion_bot: 55,
        prioridad: 'media',
        estado: 'abierto',
        descripcion: 'Pide la baja del servicio',
        origen: 'asistente',
      });
    });

    it('usa una descripcion fija si el asistente no mando motivo', async () => {
      await service.escalar({ ...derivacion, motivo: undefined });

      const { data } = tx.ticket.create.mock.calls[0][0] as {
        data: { descripcion: string };
      };
      expect(data.descripcion).toContain('asistente virtual');
    });

    it('crea la categoria del asistente la primera vez', async () => {
      tx.categoria_falla.findFirst.mockResolvedValue(null as never);

      await service.escalar(derivacion);

      expect(tx.categoria_falla.create).toHaveBeenCalledWith({
        data: { nombre: CATEGORIA_ESCALAMIENTO },
        select: { id_categoria: true },
      });
      const { data } = tx.ticket.create.mock.calls[0][0] as {
        data: { id_categoria: number };
      };
      expect(data.id_categoria).toBe(10);
    });

    it('registra la derivacion en la auditoria', async () => {
      await service.escalar(derivacion);

      expect(tx.log_auditoria.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accion: 'ESCALAR_CONVERSACION_ASISTENTE',
          entidad_afectada: 'ticket',
          id_entidad_afectada: 123,
        }),
      });
    });

    it('rechaza un RUT que no esta en los registros', async () => {
      tx.cliente.findFirst.mockResolvedValue(null as never);

      await expect(service.escalar(derivacion)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(tx.ticket.create).not.toHaveBeenCalled();
    });

    it('responde 503 si la base de datos falla (excepcion 1)', async () => {
      tx.ticket.create.mockRejectedValue(new Error('db caida') as never);

      await expect(service.escalar(derivacion)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});
