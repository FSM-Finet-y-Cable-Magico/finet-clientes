import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { PagosController } from './pagos.controller.js';
import { PagosService } from './pagos.service.js';

const TOKEN =
  'tokendepruebatokendepruebatokendepruebatokendepruebatokendeprueb';
const DESTINO = `https://portal.test/pagar/resultado?resultado=aprobado&token_ws=${TOKEN}`;

/** CU-42: las rutas del pago y adónde vuelve el cliente desde Webpay. */
describe('PagosController', () => {
  let controller: PagosController;
  let pagos: { iniciar: jest.Mock; retorno: jest.Mock; resultado: jest.Mock };

  beforeEach(async () => {
    pagos = {
      iniciar: jest.fn().mockResolvedValue({ url: 'https://w', token: TOKEN }),
      retorno: jest.fn().mockResolvedValue(DESTINO),
      resultado: jest.fn().mockResolvedValue({ estado: 'aprobado' }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PagosController],
      providers: [{ provide: PagosService, useValue: pagos }],
    }).compile();
    controller = module.get(PagosController);
  });

  it('iniciar separa la cuenta, la factura y el medio', async () => {
    await controller.iniciar({
      rut: '123456785',
      id_factura: 101,
      medio: 'webpay',
    });

    expect(pagos.iniciar).toHaveBeenCalledWith(
      { rut: '123456785' },
      101,
      'webpay',
    );
  });

  it.each([
    ['GET', (c: PagosController) => c.retornoPorGet({ token_ws: TOKEN })],
    ['POST', (c: PagosController) => c.retornoPorPost({ token_ws: TOKEN })],
  ])(
    'el retorno por %s responde 303 a la pantalla de resultado',
    async (_metodo, retorno) => {
      await expect(retorno(controller)).resolves.toEqual({
        url: DESTINO,
        statusCode: 303,
      });
      expect(pagos.retorno).toHaveBeenCalledWith({ token_ws: TOKEN });
    },
  );

  it('el resultado se consulta con el token', async () => {
    await controller.resultado({ token_ws: TOKEN });

    expect(pagos.resultado).toHaveBeenCalledWith(TOKEN);
  });
});
