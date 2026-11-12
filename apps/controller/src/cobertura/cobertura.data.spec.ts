import { describe, expect, it } from '@jest/globals';
import { CoberturaService } from './cobertura.service.js';
import { COBERTURA_CABLE_MAGICO } from './cobertura-cable-magico.data.js';
import { COBERTURA_FINET } from './cobertura-finet.data.js';

/** Paso de la grilla, en grados (~220 m). Igual que en el extractor. */
const PASO = 0.002;
const snap = (valor: number) =>
  Number((Math.round(valor / PASO) * PASO).toFixed(6));

/**
 * Cada dataset se genera con `scripts/extraer-cobertura-kml.mjs` desde un KML que
 * puede traer datos personales de clientes. Estas pruebas son la red de seguridad
 * de esa extraccion: si alguien regenera el archivo con otro filtro, o lo edita
 * a mano, fallan aca antes de que nada llegue al mapa publico.
 */
for (const [nombre, idEmpresa, capa] of [
  ['Finet', 1, COBERTURA_FINET],
  ['Cable Mágico', 2, COBERTURA_CABLE_MAGICO],
] as const) {
  describe(`Capa de cobertura estatica de ${nombre}`, () => {
    it('no contiene texto libre fuera de los tipos conocidos', () => {
      // Un nombre, RUT o direccion solo podria colarse por `tipo_cobertura`:
      // es el unico campo de texto del contrato.
      expect([...new Set(capa.map((p) => p.tipo_cobertura))].sort()) //
        .toEqual(['fibra', 'mixta', 'parcial']);
    });

    it('mantiene las densidades dentro del rango publicable', () => {
      expect(
        capa.filter(
          (p) =>
            !Number.isInteger(p.densidad_cobertura) ||
            p.densidad_cobertura < 0 ||
            p.densidad_cobertura > 100,
        ),
      ).toEqual([]);
    });

    it('cae entero dentro de los limites del visor', () => {
      const { limites } = new CoberturaService().getConfig(idEmpresa);
      expect(
        capa.filter(
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
        capa.filter(
          (p) =>
            p.latitud !== snap(p.latitud) || p.longitud !== snap(p.longitud),
        ),
      ).toEqual([]);
      expect(new Set(capa.map((p) => `${p.latitud}|${p.longitud}`)).size).toBe(
        capa.length,
      );
    });
  });
}

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

  it('con la empresa, devuelve la capa de su red y no la de Finet', () => {
    expect(service.getPuntos(undefined, 2)).toBe(COBERTURA_CABLE_MAGICO);
    expect(service.getPuntos(undefined, 1)).toBe(COBERTURA_FINET);
    expect(service.getPuntos('fibra', 2)).toEqual(
      COBERTURA_CABLE_MAGICO.filter((p) => p.tipo_cobertura === 'fibra'),
    );
  });
});

describe('CoberturaService.getConfig', () => {
  const service = new CoberturaService();

  it('sin empresa, el visor de Finet', () => {
    expect(service.getConfig()).toBe(service.getConfig(1));
  });

  it.each([1, 2] as const)(
    'el visor de la empresa %s abre centrado dentro de sus limites',
    (idEmpresa) => {
      const { centro, limites } = service.getConfig(idEmpresa);
      expect(centro.latitud).toBeGreaterThan(limites.sur_oeste.latitud);
      expect(centro.latitud).toBeLessThan(limites.nor_este.latitud);
      expect(centro.longitud).toBeGreaterThan(limites.sur_oeste.longitud);
      expect(centro.longitud).toBeLessThan(limites.nor_este.longitud);
    },
  );

  it('Cable Mágico abre en el litoral, no en Santiago', () => {
    expect(service.getConfig(2).centro.longitud).toBeLessThan(-71.5);
    expect(service.getConfig(1).centro.longitud).toBeGreaterThan(-71);
  });
});
