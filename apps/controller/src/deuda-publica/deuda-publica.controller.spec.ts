import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { DeudaPublicaController } from './deuda-publica.controller.js';
import { DeudaPublicaService } from './deuda-publica.service.js';
import { ConsultaDeudaRutDto } from './dto/deuda-publica.dto.js';

const respuestaVacia = {
  encontrado: false,
  cliente: null,
  tiene_deuda: false,
  saldo_total: 0,
  facturas: [],
};

describe('DeudaPublicaController', () => {
  let controller: DeudaPublicaController;
  let service: jest.Mocked<DeudaPublicaService>;

  beforeEach(async () => {
    const mockService = {
      consultarPorRut: jest.fn().mockResolvedValue(respuestaVacia),
    };
    const module = await Test.createTestingModule({
      controllers: [DeudaPublicaController],
      providers: [{ provide: DeudaPublicaService, useValue: mockService }],
    }).compile();
    controller = module.get(DeudaPublicaController);
    service = module.get(DeudaPublicaService);
  });

  describe('CU-39: GET /deuda-publica/rut', () => {
    it('rechaza RUT con formato inválido', () => {
      const result = ConsultaDeudaRutDto.safeParse({ rut: 'abc' });
      expect(result.success).toBe(false);
    });

    it('acepta RUT válido y llama al service', async () => {
      const query = ConsultaDeudaRutDto.parse({ rut: '123456785' });
      await controller.consultarPorRut(query);
      expect(service.consultarPorRut).toHaveBeenCalledWith('123456785');
    });
  });
});
