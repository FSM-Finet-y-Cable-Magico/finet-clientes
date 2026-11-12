import { afterEach, describe, it, expect } from '@jest/globals';
import {
  EMPRESAS,
  empresaDe,
  esEmpresaConocida,
  urlDelSitio,
} from './empresas.js';

/** Las dos empresas del portal (Documento 0, §6.6), con los ids de la base. */
describe('empresas', () => {
  it('Finet es la empresa 1 y Cable Mágico la 2, como en la tabla empresa', () => {
    expect(EMPRESAS[1].nombre).toBe('Finet');
    expect(EMPRESAS[2].nombre).toBe('Cable Mágico');
  });

  it('cada una tiene la región que se escribe en el prospecto', () => {
    expect(EMPRESAS[1].region).toBe('Metropolitana de Santiago');
    expect(EMPRESAS[2].region).toBe('Valparaíso');
  });

  it('el sitio de Cable Mágico va bajo /cable-magico; el de Finet en la raíz', () => {
    expect(EMPRESAS[1].prefijoWeb).toBe('');
    expect(EMPRESAS[2].prefijoWeb).toBe('/cable-magico');
  });

  // Los "datos de la empresa" del comprobante de pago (CU-52, RF-38): los que
  // entregó cada una. En la base, empresa.rut_empresa está vacío en las dos.
  it('cada una tiene sus datos legales para el comprobante de pago', () => {
    expect(EMPRESAS[1]).toMatchObject({
      razonSocial: 'Fibernet Limitada',
      rut: null,
      direccion: 'Avenida Santa Rosa 12980, La Pintana',
      telefono: '+56 9 4500 2319',
      correo: null,
    });
    expect(EMPRESAS[2]).toMatchObject({
      razonSocial: 'Cable Magico Estelar S.A.',
      rut: '76.620.850-9',
      direccion: 'Avenida Peñablanca 525, Algarrobo',
      telefono: '+56 9 3303 1480',
      correo: 'pagos@cablemagico.cl',
    });
  });

  it('una empresa que no se conoce, o ninguna, cae en Finet', () => {
    expect(empresaDe(2)).toBe(EMPRESAS[2]);
    expect(empresaDe(99)).toBe(EMPRESAS[1]);
    expect(empresaDe(null)).toBe(EMPRESAS[1]);
    expect(empresaDe(undefined)).toBe(EMPRESAS[1]);
  });

  it('solo 1 y 2 son empresas conocidas', () => {
    expect(esEmpresaConocida(1)).toBe(true);
    expect(esEmpresaConocida(2)).toBe(true);
    expect(esEmpresaConocida(3)).toBe(false);
    expect(esEmpresaConocida(null)).toBe(false);
  });

  describe('urlDelSitio', () => {
    const SITIO = 'http://localhost:18200';
    const antes = process.env.FRONTEND_URL_CABLE_MAGICO;
    afterEach(() => {
      if (antes === undefined) delete process.env.FRONTEND_URL_CABLE_MAGICO;
      else process.env.FRONTEND_URL_CABLE_MAGICO = antes;
    });

    it('mientras comparten host, Cable Mágico va bajo su prefijo', () => {
      delete process.env.FRONTEND_URL_CABLE_MAGICO;
      expect(urlDelSitio(1, '/pagar', SITIO)).toBe(`${SITIO}/pagar`);
      expect(urlDelSitio(2, '/pagar', SITIO)).toBe(
        `${SITIO}/cable-magico/pagar`,
      );
      expect(urlDelSitio(null, '/pagar', SITIO)).toBe(`${SITIO}/pagar`);
    });

    it('con su propio host, Cable Mágico va ahí y sin prefijo; Finet no cambia', () => {
      process.env.FRONTEND_URL_CABLE_MAGICO =
        'http://cablemagico.localhost:18200/';
      expect(urlDelSitio(2, '/pagar', SITIO)).toBe(
        'http://cablemagico.localhost:18200/pagar',
      );
      expect(urlDelSitio(1, '/pagar', SITIO)).toBe(`${SITIO}/pagar`);
      expect(urlDelSitio(99, '/pagar', SITIO)).toBe(`${SITIO}/pagar`);
    });

    it('una variable vacía es como no tenerla', () => {
      process.env.FRONTEND_URL_CABLE_MAGICO = '  ';
      expect(urlDelSitio(2, '/pagar', SITIO)).toBe(
        `${SITIO}/cable-magico/pagar`,
      );
    });
  });
});
