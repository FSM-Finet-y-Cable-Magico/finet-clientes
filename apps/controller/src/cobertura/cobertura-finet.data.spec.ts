import { describe, expect, it } from '@jest/globals';
import { CoberturaService } from './cobertura.service.js';
import { COBERTURA_FINET } from './cobertura-finet.data.js';

/** Paso de la grilla, en grados (~220 m). Igual que en el extractor. */
const PASO = 0.002;
const snap = (valor: number) => Number((Math.round(valor / PASO) * PASO).toFixed(6));

/**
 * El dataset se genera con `scripts/extraer-cobertura-kml.mjs` desde un KML que
 * contiene datos personales de clientes. Estas pruebas son la red de seguridad
 * de esa extraccion: si alguien regenera el archivo con otro filtro, o lo edita
 * a mano, fallan aca antes de que nada llegue al mapa publico.
 */
describe('Capa de cobertura estatica de Finet', () => {
  it('no contiene texto libre fuera de los tipos conocidos', () => {
    // Un nombre, RUT o direccion solo podria colarse por `tipo_cobertura`:
    // es el unico campo de texto del contrato.
    expect([...new Set(COBERTURA_FINET.map((p) => p.tipo_cobertura))].sort()) //
      .toEqual(['fibra', 'mixta', 'parcial']);
  });

  it('mantiene las densidades dentro del rango publicable', () => {
    expect(
      COBERTURA_FINET.filter(
        (p) =>
          !Number.isInteger(p.densidad_cobertura) ||
          p.densidad_cobertura < 0 ||
          p.densidad_cobertura > 100,
      ),
    ).toEqual([]);
  });

  it('cae entero dentro de los limites del visor', () => {
    const { limites } = new CoberturaService().getConfig();
    expect(
      COBERTURA_FINET.filter(
        (p) =>
          p.latitud < limites.sur_oeste.latitud ||
          p.latitud > limites.nor_este.latitud ||
          p.longitud < limites.sur_oeste.longitud ||
          p.longitud > limites.nor_este.longitud,
      ),
    ).toEqual([]);
  });

  it('esta alineado a la grilla publica y sin celdas repetidas', () => {
    expect(
      COBERTURA_FINET.filter(
        (p) => p.latitud !== snap(p.latitud) || p.longitud !== snap(p.longitud),
      ),
    ).toEqual([]);
    expect(
      new Set(COBERTURA_FINET.map((p) => `${p.latitud}|${p.longitud}`)).size,
    ).toBe(COBERTURA_FINET.length);
  });
});

describe('CoberturaService.getPuntos', () => {
  const service = new CoberturaService();

  it('devuelve la capa completa sin filtro', () => {
    expect(service.getPuntos()).toHaveLength(COBERTURA_FINET.length);
    expect(COBERTURA_FINET.length).toBeGreaterThan(0);
  });

  it('filtra por tipo de cobertura', () => {
    const fibra = service.getPuntos('fibra');
    expect(fibra.length).toBeGreaterThan(0);
    expect(fibra.every((p) => p.tipo_cobertura === 'fibra')).toBe(true);
    expect(fibra.length).toBeLessThan(COBERTURA_FINET.length);
  });

  it('devuelve vacio para un tipo que no existe', () => {
    expect(service.getPuntos('satelital')).toEqual([]);
  });
});
