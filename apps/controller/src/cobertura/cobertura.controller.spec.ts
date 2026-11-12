import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoberturaController } from './cobertura.controller.js';
import { CoberturaService } from './cobertura.service.js';
import {
  consultaPuntosCoberturaSchema,
  consultaVisorCoberturaSchema,
} from './dto/cobertura.dto.js';

describe('CoberturaController publico', () => {
  let controller: CoberturaController;
  let service: { getConfig: jest.Mock; getPuntos: jest.Mock };

  beforeEach(async () => {
    // Los mocks se crean por test en vez de limpiarse con `jest.clearAllMocks()`:
    // el `jest` que exporta `@jest/globals` en ESM no expone ese metodo.
    service = { getConfig: jest.fn(), getPuntos: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [CoberturaController],
      providers: [{ provide: CoberturaService, useValue: service }],
    }).compile();
    controller = module.get(CoberturaController);
  });

  it('delega la configuracion publica', () => {
    controller.getConfig(consultaVisorCoberturaSchema.parse({}));
    expect(service.getConfig).toHaveBeenCalledWith(undefined);
  });

  it('delega la capa sin filtro', () => {
    controller.getPuntos(consultaPuntosCoberturaSchema.parse({}));
    expect(service.getPuntos).toHaveBeenCalledWith(undefined, undefined);
  });

  it('delega el filtro de tipo', () => {
    controller.getPuntos(
      consultaPuntosCoberturaSchema.parse({ tipo_cobertura: 'fibra' }),
    );
    expect(service.getPuntos).toHaveBeenCalledWith('fibra', undefined);
  });

  it('cada sitio pide el visor y la capa de su empresa', () => {
    // Llega como texto en la URL y se convierte a número.
    controller.getConfig(
      consultaVisorCoberturaSchema.parse({ id_empresa: '2' }),
    );
    controller.getPuntos(
      consultaPuntosCoberturaSchema.parse({ id_empresa: '2' }),
    );
    expect(service.getConfig).toHaveBeenCalledWith(2);
    expect(service.getPuntos).toHaveBeenCalledWith(undefined, 2);
  });

  it('rechaza una empresa que no es del portal', () => {
    for (const id_empresa of ['3', 'abc', '1.5']) {
      expect(
        consultaVisorCoberturaSchema.safeParse({ id_empresa }).success,
      ).toBe(false);
      expect(
        consultaPuntosCoberturaSchema.safeParse({ id_empresa }).success,
      ).toBe(false);
    }
  });
});
