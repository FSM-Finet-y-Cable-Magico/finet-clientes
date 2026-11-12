import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { AsistenteController } from './asistente.controller.js';
import { AsistenteService } from './asistente.service.js';
import { MensajeAsistenteDto } from './dto/asistente.dto.js';

const SESION = '3f6c8a52-7d1e-4b9a-9c2f-5e8d1a0b7c64';

describe('AsistenteController', () => {
  let controller: AsistenteController;
  let service: jest.Mocked<AsistenteService>;

  beforeEach(async () => {
    const mockService = {
      responder: jest.fn().mockResolvedValue({ respuesta: 'Hola' }),
    };
    const module = await Test.createTestingModule({
      controllers: [AsistenteController],
      providers: [{ provide: AsistenteService, useValue: mockService }],
    }).compile();
    controller = module.get(AsistenteController);
    service = module.get(AsistenteService);
  });

  describe('CU-65: POST /asistente/mensajes', () => {
    it('acepta un mensaje valido y llama al service', async () => {
      const dto = MensajeAsistenteDto.parse({
        id_sesion: SESION,
        mensaje: '  ¿Que planes tienen?  ',
      });
      const result = await controller.enviar(dto);

      expect(service.responder).toHaveBeenCalledWith(
        {
          id_sesion: SESION,
          mensaje: '¿Que planes tienen?',
        },
        undefined,
        undefined,
      );
      expect(result).toEqual({ respuesta: 'Hola' });
    });

    it('le pasa al service la IP del visitante', async () => {
      const dto = MensajeAsistenteDto.parse({
        id_sesion: SESION,
        mensaje: 'hola',
      });

      await controller.enviar(dto, {
        ip: '203.0.113.9',
        headers: {},
      } as never);

      expect(service.responder).toHaveBeenCalledWith(
        dto,
        undefined,
        '203.0.113.9',
      );
    });

    it('rechaza una sesion que no es UUID', () => {
      const result = MensajeAsistenteDto.safeParse({
        id_sesion: '1',
        mensaje: 'hola',
      });
      expect(result.success).toBe(false);
    });

    it('rechaza un mensaje vacio o solo con espacios', () => {
      const result = MensajeAsistenteDto.safeParse({
        id_sesion: SESION,
        mensaje: '   ',
      });
      expect(result.success).toBe(false);
    });

    it('acepta la empresa del sitio (Finet o Cable Mágico) y rechaza otra', () => {
      const base = { id_sesion: SESION, mensaje: 'hola' };
      expect(
        MensajeAsistenteDto.parse({ ...base, id_empresa: 2 }).id_empresa,
      ).toBe(2);
      expect(
        MensajeAsistenteDto.safeParse({ ...base, id_empresa: 3 }).success,
      ).toBe(false);
      expect(
        MensajeAsistenteDto.safeParse({ ...base, id_empresa: '2' }).success,
      ).toBe(false);
    });

    it('rechaza un mensaje demasiado largo', () => {
      const result = MensajeAsistenteDto.safeParse({
        id_sesion: SESION,
        mensaje: 'a'.repeat(1001),
      });
      expect(result.success).toBe(false);
    });
  });
});
