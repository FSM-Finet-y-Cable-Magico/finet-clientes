import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CoberturaController } from './cobertura.controller.js';
import { CoberturaService } from './cobertura.service.js';
import { consultaPuntosCoberturaSchema } from './dto/cobertura.dto.js';

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
    controller.getConfig();
    expect(service.getConfig).toHaveBeenCalledTimes(1);
  });

  it('delega la capa sin filtro', async () => {
    service.getPuntos.mockResolvedValue([]);
    await controller.getPuntos(consultaPuntosCoberturaSchema.parse({}));
    expect(service.getPuntos).toHaveBeenCalledWith(undefined);
  });

  it('delega el filtro de tipo', async () => {
    service.getPuntos.mockResolvedValue([]);
    await controller.getPuntos(
      consultaPuntosCoberturaSchema.parse({ tipo_cobertura: 'fibra' }),
    );
    expect(service.getPuntos).toHaveBeenCalledWith('fibra');
  });
});
