import {
  jest,
  afterEach,
  beforeEach,
  describe,
  it,
  expect,
} from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import {
  ErrorIntegracionG8,
  G8IntegracionService,
} from './g8-integracion.service.js';

const API_KEY = 'b'.repeat(64);

/** El ejemplo de la respuesta complementaria de G8 (02-10-2026, §2), tal cual. */
const FACTURAS_EJEMPLO_G8 = {
  items: [
    {
      idFactura: 101,
      idContrato: 456,
      monto: 19990,
      fechaLimitePago: '2026-10-10',
      pagado: 5000,
      saldo: 14990,
      saldoFavor: 0,
      saldoExigible: 14990,
      fechaVencimientoEfectiva: '2026-10-15',
      diasAtraso: 0,
      estadoCalculado: 'Parcial',
      aceptaPagos: true,
    },
  ],
};

const respuesta = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Los contratos S2S de G8 de su respuesta del 02-10. */
describe('G8IntegracionService', () => {
  let service: G8IntegracionService;
  let config: Record<string, string | undefined>;
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    config = {
      INTEGRACION_G8_API_URL: 'https://g8.test/',
      INTEGRACION_G8_API_KEY: API_KEY,
    };
    service = new G8IntegracionService({
      get: (k: string) => config[k],
    } as unknown as ConfigService);
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  describe('facturas (§2)', () => {
    it('pide las de un cliente dentro de su empresa, con la clave en X-API-KEY', async () => {
      fetchMock.mockResolvedValue(respuesta(200, FACTURAS_EJEMPLO_G8));

      const facturas = await service.facturas({ idEmpresa: 1, idCliente: 123 });

      expect(facturas).toEqual([{ idFactura: 101, saldoExigible: 14990 }]);
      const [url, init] = fetchMock.mock.calls[0];
      expect((url as URL).href).toBe(
        'https://g8.test/api/integrations/g2/invoices?id_empresa=1&id_cliente=123',
      );
      expect(init?.method).toBe('GET');
      expect((init?.headers as Record<string, string>)['X-API-KEY']).toBe(
        API_KEY,
      );
      expect(init?.redirect).toBe('error');
    });

    it('por código de abonado pide las del contrato', async () => {
      fetchMock.mockResolvedValue(respuesta(200, { items: [] }));

      await service.facturas({ idEmpresa: 2, idContrato: 456 });

      expect((fetchMock.mock.calls[0][0] as URL).href).toBe(
        'https://g8.test/api/integrations/g2/invoices?id_empresa=2&id_contrato=456',
      );
    });

    it('una respuesta sin `items` o sin `saldoExigible` es un error, no "sin deuda"', async () => {
      fetchMock.mockResolvedValue(
        respuesta(200, { items: [{ idFactura: 101, saldo: 14990 }] }),
      );

      await expect(
        service.facturas({ idEmpresa: 1, idCliente: 123 }),
      ).rejects.toBeInstanceOf(ErrorIntegracionG8);
    });

    it('un 5xx se reintenta una vez', async () => {
      fetchMock
        .mockResolvedValueOnce(respuesta(503, {}))
        .mockResolvedValueOnce(respuesta(200, FACTURAS_EJEMPLO_G8));

      await expect(
        service.facturas({ idEmpresa: 1, idCliente: 123 }),
      ).resolves.toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('un 4xx no se reintenta y se informa con su código', async () => {
      fetchMock.mockResolvedValue(respuesta(403, { message: 'scope' }));

      await expect(
        service.facturas({ idEmpresa: 3, idCliente: 123 }),
      ).rejects.toMatchObject({ status: 403 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('si G8 no responde, el error no trae la clave', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));

      const error = await service
        .facturas({ idEmpresa: 1, idCliente: 123 })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ErrorIntegracionG8);
      expect((error as ErrorIntegracionG8).status).toBeNull();
      expect((error as Error).message).not.toContain(API_KEY);
    });

    it('sin configuración no se llama y se nombra la variable, no su valor', async () => {
      config.INTEGRACION_G8_API_KEY = undefined;

      await expect(
        service.facturas({ idEmpresa: 1, idCliente: 123 }),
      ).rejects.toThrow('Falta configurar INTEGRACION_G8_API_KEY');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
