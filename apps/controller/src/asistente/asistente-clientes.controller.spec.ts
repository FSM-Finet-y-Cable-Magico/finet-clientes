import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AsistenteClientesController } from './asistente-clientes.controller.js';
import { AsistenteClientesService } from './asistente-clientes.service.js';
import { IdentificarClienteDto } from './dto/asistente.dto.js';
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
