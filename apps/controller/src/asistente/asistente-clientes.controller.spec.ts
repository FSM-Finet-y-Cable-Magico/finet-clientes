import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AsistenteClientesController } from './asistente-clientes.controller.js';
import { AsistenteClientesService } from './asistente-clientes.service.js';
import {
  EscalarConversacionDto,
  IdentificarClienteDto,
} from './dto/asistente.dto.js';
import { ChatbotApiKeyGuard } from './guards/chatbot-api-key.guard.js';

const contexto = (headers: Record<string, string>) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  }) as unknown as ExecutionContext;

const guard = (clave?: string) =>
  new ChatbotApiKeyGuard({
    get: () => clave,
  } as unknown as ConfigService);

describe('AsistenteClientesController', () => {
  let controller: AsistenteClientesController;
  let service: jest.Mocked<AsistenteClientesService>;

  beforeEach(async () => {
    const mockService = {
      identificar: jest
        .fn()
        .mockResolvedValue({ encontrado: false, cliente: null } as never),
      escalar: jest.fn().mockResolvedValue({
        id_ticket: 123,
        codigo_seguimiento: 'FIN-2026-000123',
      } as never),
    };
    const module = await Test.createTestingModule({
      controllers: [AsistenteClientesController],
      providers: [
        { provide: AsistenteClientesService, useValue: mockService },
        { provide: ConfigService, useValue: { get: () => 'clave' } },
      ],
    }).compile();
    controller = module.get(AsistenteClientesController);
    service = module.get(AsistenteClientesService);
  });

  describe('CU-63: POST /asistente/clientes/identificar', () => {
    it('acepta un RUT valido y llama al service', async () => {
      const dto = IdentificarClienteDto.parse({ rut: '123456785' });
      await controller.identificar(dto);
      expect(service.identificar).toHaveBeenCalledWith('123456785');
    });

    it('rechaza un RUT con digito verificador incorrecto', () => {
      const result = IdentificarClienteDto.safeParse({ rut: '123456784' });
      expect(result.success).toBe(false);
    });
  });

  describe('CU-77: POST /asistente/clientes/escalamientos', () => {
    const valido = {
      id_sesion: 'web:3f6c8a52-7d1e-4b9a-9c2f-5e8d1a0b7c64',
      rut: '12.345.678-5',
      plataforma: 'web',
      motivo: 'Pide la baja del servicio',
      historial: [
        { rol: 'user', contenido: 'quiero dar de baja mi plan' },
        { rol: 'assistant', contenido: 'Puedo derivarte con una persona.' },
        { rol: 'user', contenido: 'si' },
      ],
    };

    it('acepta la derivacion y devuelve el codigo del ticket', async () => {
      const dto = EscalarConversacionDto.parse(valido);

      await expect(controller.escalar(dto)).resolves.toEqual({
        id_ticket: 123,
        codigo_seguimiento: 'FIN-2026-000123',
      });
      expect(service.escalar).toHaveBeenCalledWith(dto);
    });

    it('acepta una derivacion sin motivo', () => {
      const sinMotivo = { ...valido, motivo: undefined };
      expect(EscalarConversacionDto.safeParse(sinMotivo).success).toBe(true);
    });

    it.each([
      ['un RUT invalido', { rut: '123456784' }],
      ['un historial vacio', { historial: [] }],
      [
        'un rol desconocido',
        { historial: [{ rol: 'system', contenido: 'x' }] },
      ],
      ['una plataforma desconocida', { plataforma: 'telegram' }],
      ['campos de mas', { id_usuario_asignado: 4 }],
    ])('rechaza %s', (_, cambio) => {
      expect(
        EscalarConversacionDto.safeParse({ ...valido, ...cambio }).success,
      ).toBe(false);
    });
  });

  describe('ChatbotApiKeyGuard', () => {
    it('deja pasar con la API key correcta', () => {
      expect(
        guard('clave').canActivate(contexto({ 'x-api-key': 'clave' })),
      ).toBe(true);
    });

    it('rechaza una API key incorrecta', () => {
      expect(() =>
        guard('clave').canActivate(contexto({ 'x-api-key': 'otra' })),
      ).toThrow(UnauthorizedException);
    });

    it('rechaza una peticion sin API key', () => {
      expect(() => guard('clave').canActivate(contexto({}))).toThrow(
        UnauthorizedException,
      );
    });

    it('no deja pasar a nadie si ASISTENTE_API_KEY no esta configurada', () => {
      expect(() =>
        guard(undefined).canActivate(contexto({ 'x-api-key': '' })),
      ).toThrow(UnauthorizedException);
    });
  });
});
