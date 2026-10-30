import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import {
  Environment,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
  type Options,
} from 'transbank-sdk';
import {
  ErrorWebpay,
  WebpayService,
  type SdkWebpay,
  type TransaccionSdk,
} from './webpay.service.js';
import { TIMEOUT_WEBPAY_MS } from './pagos.constantes.js';

const TOKEN =
  'tokendepruebatokendepruebatokendepruebatokendepruebatokendeprueb';
const RETORNO = 'http://localhost:4000/api/pagos/webpay/retorno';

/** La respuesta de referencia de Transbank al commit (su documentación). */
const COMMIT = {
  vci: 'TSY',
  amount: 10000,
  status: 'AUTHORIZED',
  buy_order: 'ordenCompra12345678',
  session_id: 'sesion1234557545',
  card_detail: { card_number: '6623' },
  accounting_date: '0522',
  transaction_date: '2019-05-22T16:41:21.063Z',
  authorization_code: '1213',
  payment_type_code: 'VN',
  response_code: 0,
  installments_number: 0,
};

/** CU-42: el SDK oficial de Webpay (RNF-31.1), con su configuración. */
describe('WebpayService', () => {
  let config: Record<string, string | undefined>;
  let tx: { [K in keyof TransaccionSdk]: jest.Mock };
  let sdk: jest.Mock<SdkWebpay>;
  let webpay: WebpayService;

  beforeEach(() => {
    config = { WEBPAY_URL_RETORNO: RETORNO };
    tx = {
      create: jest.fn(),
      commit: jest.fn(),
      status: jest.fn(),
      refund: jest.fn(),
    };
    sdk = jest.fn<SdkWebpay>(() => tx as unknown as TransaccionSdk);
    webpay = new WebpayService(
      { get: (k: string) => config[k] } as unknown as ConfigService,
      sdk as unknown as SdkWebpay,
    );
  });

  const opciones = () => sdk.mock.calls[0][0] as Options;

  describe('ambiente', () => {
    it('por defecto, integración con las credenciales de prueba del SDK', async () => {
      tx.status.mockResolvedValue(COMMIT);

      await webpay.estado(TOKEN);

      expect(opciones().commerceCode).toBe(
        IntegrationCommerceCodes.WEBPAY_PLUS,
      );
      expect(opciones().apiKey).toBe(IntegrationApiKeys.WEBPAY);
      expect(opciones().environment).toBe(Environment.Integration);
    });

    it('no espera los 10 minutos del SDK', async () => {
      tx.status.mockResolvedValue(COMMIT);

      await webpay.estado(TOKEN);

      expect(opciones().timeout).toBe(TIMEOUT_WEBPAY_MS);
    });

    it('en producción usa el código y la llave del .env', async () => {
      config.WEBPAY_AMBIENTE = 'produccion';
      config.WEBPAY_CODIGO_COMERCIO = 'codigo-de-prueba';
      config.WEBPAY_API_KEY = 'llave-de-prueba';
      tx.status.mockResolvedValue(COMMIT);

      await webpay.estado(TOKEN);

      expect(opciones()).toMatchObject({
        commerceCode: 'codigo-de-prueba',
        apiKey: 'llave-de-prueba',
        environment: Environment.Production,
      });
    });

    it('en producción, sin credenciales no se llama y se nombra lo que falta, no su valor', async () => {
      config.WEBPAY_AMBIENTE = 'produccion';
      config.WEBPAY_CODIGO_COMERCIO = 'codigo-de-prueba';

      const intento = webpay.estado(TOKEN);

      await expect(intento).rejects.toBeInstanceOf(ErrorWebpay);
      await expect(intento).rejects.toThrow('Falta configurar WEBPAY_API_KEY');
      await expect(intento).rejects.not.toThrow('codigo-de-prueba');
      expect(sdk).not.toHaveBeenCalled();
    });

    it('un ambiente desconocido es un error', async () => {
      config.WEBPAY_AMBIENTE = 'pruebas';

      await expect(webpay.estado(TOKEN)).rejects.toThrow('WEBPAY_AMBIENTE');
    });
  });

  describe('crear', () => {
    it('manda la orden, la sesión, el monto y la URL de retorno', async () => {
      tx.create.mockResolvedValue({
        token: TOKEN,
        url: 'https://webpay3gint.transbank.cl/webpayserver/initTransaction',
      });

      const r = await webpay.crear('F101-abc', 's.firmada', 14990);

      expect(tx.create).toHaveBeenCalledWith(
        'F101-abc',
        's.firmada',
        14990,
        RETORNO,
      );
      expect(r).toEqual({
        token: TOKEN,
        url: 'https://webpay3gint.transbank.cl/webpayserver/initTransaction',
      });
    });

    it('sin WEBPAY_URL_RETORNO no se crea nada', async () => {
      delete config.WEBPAY_URL_RETORNO;

      await expect(webpay.crear('F101-abc', 's', 14990)).rejects.toThrow(
        'Falta configurar WEBPAY_URL_RETORNO',
      );
      expect(tx.create).not.toHaveBeenCalled();
    });

    it('en producción, el retorno tiene que ser HTTPS (RNF-31.2)', async () => {
      config.WEBPAY_AMBIENTE = 'produccion';
      config.WEBPAY_CODIGO_COMERCIO = 'codigo-de-prueba';
      config.WEBPAY_API_KEY = 'llave-de-prueba';

      await expect(webpay.crear('F101-abc', 's', 14990)).rejects.toThrow(
        'HTTPS',
      );
    });

    it('una respuesta sin token es un error', async () => {
      tx.create.mockResolvedValue({ url: 'https://webpay3gint.transbank.cl' });

      await expect(webpay.crear('F101-abc', 's', 14990)).rejects.toBeInstanceOf(
        ErrorWebpay,
      );
    });
  });

  describe('confirmar y estado', () => {
    it('el commit se lee con los nombres del portal', async () => {
      tx.commit.mockResolvedValue(COMMIT);

      await expect(webpay.confirmar(TOKEN)).resolves.toEqual({
        estado: 'AUTHORIZED',
        codigoRespuesta: 0,
        monto: 10000,
        ordenCompra: 'ordenCompra12345678',
        sesion: 'sesion1234557545',
        codigoAutorizacion: '1213',
        fecha: '2019-05-22T16:41:21.063Z',
      });
      expect(tx.commit).toHaveBeenCalledWith(TOKEN);
    });

    it('una transacción incompleta es un error, no un pago', async () => {
      tx.status.mockResolvedValue({ status: 'AUTHORIZED' });

      await expect(webpay.estado(TOKEN)).rejects.toBeInstanceOf(ErrorWebpay);
    });

    it('el error del SDK no deja pasar los headers del pedido (con la llave)', async () => {
      const error = Object.assign(
        new Error(
          'AxiosError: Request failed with status code 422\nInvalid status 6\n',
        ),
        { config: { headers: { 'Tbk-Api-Key-Secret': 'llave-secreta' } } },
      );
      tx.commit.mockRejectedValue(error);

      const intento = webpay.confirmar(TOKEN);

      await expect(intento).rejects.toThrow(
        'Webpay respondió con un error: AxiosError: Request failed with status code 422 · Invalid status 6',
      );
      await expect(intento).rejects.not.toThrow('llave-secreta');
    });
  });

  describe('anular', () => {
    it.each([
      ['reversa (el mismo día)', { type: 'REVERSED' }, true],
      ['anulación aceptada', { type: 'NULLIFIED', response_code: 0 }, true],
      ['anulación rechazada', { type: 'NULLIFIED', response_code: 312 }, false],
      ['respuesta que no se entiende', { ok: true }, false],
    ])('%s', async (_caso, respuesta, anulado) => {
      tx.refund.mockResolvedValue(respuesta);

      await expect(webpay.anular(TOKEN, 14990)).resolves.toBe(anulado);
      expect(tx.refund).toHaveBeenCalledWith(TOKEN, 14990);
    });
  });
});
