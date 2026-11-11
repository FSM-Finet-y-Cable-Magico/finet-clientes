import { describe, it, expect } from '@jest/globals';
import {
  EMPRESAS,
  empresaDe,
  esEmpresaConocida,
  rutaDelSitio,
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

  it('una ruta del sitio lleva el prefijo de su empresa', () => {
    expect(rutaDelSitio(1, '/pagar')).toBe('/pagar');
    expect(rutaDelSitio(2, '/pagar')).toBe('/cable-magico/pagar');
    expect(rutaDelSitio(null, '/pagar')).toBe('/pagar');
  });
});
