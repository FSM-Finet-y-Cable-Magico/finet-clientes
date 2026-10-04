import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import type { Request } from 'express';
import { Test } from '@nestjs/testing';
import { ConsentimientoController } from './consentimiento.controller.js';
import { ConsentimientoService } from './consentimiento.service.js';
import { ConsentimientoCookiesDto } from './dto/consentimiento-cookies.dto.js';

describe('ConsentimientoController', () => {
  let controller: ConsentimientoController;
  let service: jest.Mocked<ConsentimientoService>;

  beforeEach(async () => {
    const mockService = {
      registrarCookies: jest.fn().mockResolvedValue({ registrado: true }),
    };
    const module = await Test.createTestingModule({
      controllers: [ConsentimientoController],
      providers: [{ provide: ConsentimientoService, useValue: mockService }],
    }).compile();
    controller = module.get(ConsentimientoController);
    service = module.get(ConsentimientoService);
  });

  it('pasa la decisión y la IP de origen al servicio', async () => {
    const req = { ip: '203.0.113.7' } as Request;

    await controller.registrarCookies(
      { acepto: false, version_documento: '1.1' },
      req,
    );

    expect(service.registrarCookies).toHaveBeenCalledWith(
      { acepto: false, version_documento: '1.1' },
      '203.0.113.7',
    );
  });

  it('usa el centinela cuando Express no pudo determinar la IP', async () => {
    const req = {} as Request;

    await controller.registrarCookies(
      { acepto: true, version_documento: '1.1' },
      req,
    );

    expect(service.registrarCookies).toHaveBeenCalledWith(
      expect.anything(),
      '0.0.0.0',
    );
  });

  // ─── Validación del cuerpo ────────────────────────────────────────────────

  describe('ConsentimientoCookiesDto', () => {
    it('acepta un cuerpo válido', () => {
      expect(
        ConsentimientoCookiesDto.safeParse({
          acepto: true,
          version_documento: '1.1',
        }).success,
      ).toBe(true);
    });

    it.each([
      ['sin acepto', { version_documento: '1.1' }],
      ['acepto como texto', { acepto: 'si', version_documento: '1.1' }],
      ['sin versión', { acepto: true }],
      ['versión vacía', { acepto: true, version_documento: '   ' }],
      [
        'versión demasiado larga',
        { acepto: true, version_documento: 'x'.repeat(21) },
      ],
    ])('rechaza un cuerpo %s', (_caso, cuerpo) => {
      expect(ConsentimientoCookiesDto.safeParse(cuerpo).success).toBe(false);
    });
  });
});
