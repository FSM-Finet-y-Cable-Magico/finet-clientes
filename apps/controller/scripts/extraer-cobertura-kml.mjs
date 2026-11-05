/**
 * Genera la capa de cobertura estatica de Finet a partir del KML de planta externa.
 *
 *   node scripts/extraer-cobertura-kml.mjs "<ruta al .kml>"
 *
 * El KML de origen NO se versiona: contiene nombre, RUT, telefono y direccion de
 * clientes reales. Este script existe para que la extraccion sea reproducible y,
 * sobre todo, para que quede escrito que del KML solo sale geometria.
 *
 * Lo unico que se emite son coordenadas y una densidad calculada. Ningun texto
 * del archivo llega al resultado, y `assertSinDatosPersonales` lo verifica antes
 * de escribir.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const ORIGEN = process.argv[2];
assert(ORIGEN, 'Uso: node scripts/extraer-cobertura-kml.mjs "<ruta al .kml>"');
const DESTINO = new URL(
  '../src/cobertura/cobertura-finet.data.ts',
  import.meta.url,
);

/** Mismos limites que VISOR_CONFIG en cobertura.service.ts. */
const LIMITES = {
  latMin: -33.72,
  latMax: -33.48,
  lngMin: -70.78,
  lngMax: -70.45,
};

/**
 * Paso de la grilla, en grados (~220 m).
 *
 * El campo de densidad es suave — los alcances son de 200 a 350 m — asi que a
 * esta escala el heatmap ya se ve igual: `leaflet.heat` aplica un blur de 20 px
 * encima. Afinar el paso multiplica el peso de la respuesta sin agregar
 * informacion real.
 */
const PASO = 0.002;

/**
 * Alcance de cada tipo de elemento, en metros.
 *
 * `lleno` es el radio donde la cobertura se da por total; entre `lleno` y `cero`
 * la intensidad cae linealmente. Los valores salen de como funciona una red FTTH:
 * un NAP es la caja terminal desde la que se acomete al domicilio, asi que manda;
 * un empalme o un tramo de fibra indican factibilidad, no servicio disponible.
 */
const ALCANCE = {
  nap: { lleno: 120, cero: 350, pico: 100 },
  mufa: { lleno: 60, cero: 250, pico: 55 },
  fibra: { lleno: 60, cero: 200, pico: 75 },
};

/** Por debajo de esto la celda no aporta al heatmap y solo pesa en la respuesta. */
const DENSIDAD_MINIMA = 8;

// --- Lectura del KML --------------------------------------------------------

const xml = readFileSync(ORIGEN, 'utf8');

const coordenadas = (texto) =>
  texto
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => {
      const [lng, lat] = t.split(',').map(Number);
      return [lat, lng];
    });

const placemarks = [...xml.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g)].map(
  (m) => {
    const cuerpo = m[1];
    const nombre = (cuerpo.match(/<name>([\s\S]*?)<\/name>/) || [, ''])[1].trim();
    const punto = cuerpo.match(/<Point>\s*<coordinates>([\s\S]*?)<\/coordinates>/);
    const linea = cuerpo.match(
      /<LineString>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/,
    );
    return {
      nombre,
      geometria: punto ? 'punto' : 'linea',
      coords: coordenadas((punto || linea)[1]),
    };
  },
);

// --- Filtrado ---------------------------------------------------------------

const RUT = /\b\d{1,2}\.\d{3}\.\d{3}-[\dkK]\b/;
const TELEFONO = /\b9[\s.]?\d{4}[\s.]?\d{4}\b/;

const dentroDeLimites = ([lat, lng]) =>
  lat >= LIMITES.latMin &&
  lat <= LIMITES.latMax &&
  lng >= LIMITES.lngMin &&
  lng <= LIMITES.lngMax;

/**
 * Clasifica por nombre. El `<color>` del icono seria mas directo, pero el archivo
 * usa 32 colores distintos con una cola larga de valores unicos: no es fiable.
 */
function clasificar({ nombre, geometria }) {
  const n = nombre.toUpperCase();
  if (geometria === 'linea') return /TRONCAL|BRAZO/.test(n) ? 'fibra' : null;
  if (/BRAZO|TRONCAL/.test(n)) return null;
  if (/\bNAP\b|\bNAP\d|NAP#|\bCTO\b|CTO\d/.test(n)) return 'nap';
  if (/\bMUFA\b|MUFA\d|\bNODO\b|\bOLT\b/.test(n)) return 'mufa';
  return null;
}

const descartados = {
  fueraDeLimites: 0,
  conDatosPersonales: 0,
  sinClasificar: 0,
};
const elementos = [];

for (const p of placemarks) {
  // Un registro con RUT o telefono es una ficha de cliente, no infraestructura.
  // Se descarta antes de mirar su geometria: no aporta y no debe viajar.
  if (RUT.test(p.nombre) || TELEFONO.test(p.nombre)) {
    descartados.conDatosPersonales++;
    continue;
  }
  if (!p.coords.every(dentroDeLimites)) {
    descartados.fueraDeLimites++;
    continue;
  }
  const tipo = clasificar(p);
  if (!tipo) {
    descartados.sinClasificar++;
    continue;
  }
  elementos.push({ tipo, coords: p.coords });
}

const naps = elementos.filter((e) => e.tipo === 'nap').map((e) => e.coords[0]);
const mufas = elementos.filter((e) => e.tipo === 'mufa').map((e) => e.coords[0]);
const tramos = elementos.filter((e) => e.tipo === 'fibra').map((e) => e.coords);

assert(naps.length > 100, `Se esperaban NAPs y solo hay ${naps.length}`);
assert(tramos.length > 50, `Se esperaban tramos y solo hay ${tramos.length}`);

// --- Geometria en metros ----------------------------------------------------

const R = 6371000;
const rad = (x) => (x * Math.PI) / 180;

/** Plano local equirectangular: a esta escala el error es despreciable. */
const proyectar = ([lat, lng], latRef) => [
  rad(lng) * Math.cos(rad(latRef)) * R,
  rad(lat) * R,
];

const distanciaAPunto = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Distancia de un punto al segmento AB, no a sus extremos. */
function distanciaASegmento(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const largoCuadrado = dx * dx + dy * dy;
  if (largoCuadrado === 0) return distanciaAPunto(p, a);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / largoCuadrado;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Meseta hasta `lleno`, caida lineal hasta `cero`. */
function intensidad(distancia, { lleno, cero, pico }) {
  if (distancia <= lleno) return pico;
  if (distancia >= cero) return 0;
  return pico * (1 - (distancia - lleno) / (cero - lleno));
}

// --- Campo de densidad sobre la grilla publica ------------------------------

const snap = (valor) => Number((Math.round(valor / PASO) * PASO).toFixed(6));

const todas = [...naps, ...mufas, ...tramos.flat()];
const latRef = todas.reduce((s, c) => s + c[0], 0) / todas.length;

const napsXY = naps.map((c) => proyectar(c, latRef));
const mufasXY = mufas.map((c) => proyectar(c, latRef));
const segmentos = tramos.flatMap((linea) =>
  linea.slice(1).map((v, i) => [proyectar(linea[i], latRef), proyectar(v, latRef)]),
);

// El alcance mas largo define cuanto hay que salirse de la caja envolvente.
const margenGrados = Math.max(...Object.values(ALCANCE).map((a) => a.cero)) / 111_000;

const lats = todas.map((c) => c[0]);
const lngs = todas.map((c) => c[1]);
const caja = {
  latMin: Math.max(LIMITES.latMin, snap(Math.min(...lats) - margenGrados)),
  latMax: Math.min(LIMITES.latMax, snap(Math.max(...lats) + margenGrados)),
  lngMin: Math.max(LIMITES.lngMin, snap(Math.min(...lngs) - margenGrados)),
  lngMax: Math.min(LIMITES.lngMax, snap(Math.max(...lngs) + margenGrados)),
};

const minimo = (punto, lista) => {
  let d = Infinity;
  for (const q of lista) {
    const actual = distanciaAPunto(punto, q);
    if (actual < d) d = actual;
  }
  return d;
};

const celdas = [];
for (let lat = caja.latMin; lat <= caja.latMax + PASO / 2; lat += PASO) {
  for (let lng = caja.lngMin; lng <= caja.lngMax + PASO / 2; lng += PASO) {
    const latitud = snap(lat);
    const longitud = snap(lng);
    const centro = proyectar([latitud, longitud], latRef);

    let dFibra = Infinity;
    for (const [a, b] of segmentos) {
      const actual = distanciaASegmento(centro, a, b);
      if (actual < dFibra) dFibra = actual;
    }

    // La celda se queda con su mejor razon para estar cubierta, no con la suma:
    // un NAP al lado y un troncal pasando no son mas cobertura que el NAP solo.
    const densidad = Math.round(
      Math.max(
        intensidad(minimo(centro, napsXY), ALCANCE.nap),
        intensidad(minimo(centro, mufasXY), ALCANCE.mufa),
        intensidad(dFibra, ALCANCE.fibra),
      ),
    );

    if (densidad < DENSIDAD_MINIMA) continue;

    celdas.push({
      latitud,
      longitud,
      densidad_cobertura: densidad,
      // El tipo refleja que tan directa es la cobertura, no otra tecnologia:
      // toda la red es fibra. Alimenta el filtro `tipo_cobertura` del endpoint.
      tipo_cobertura:
        densidad >= 65 ? 'fibra' : densidad >= 30 ? 'mixta' : 'parcial',
    });
  }
}

celdas.sort((a, b) => a.latitud - b.latitud || a.longitud - b.longitud);

// --- Escritura --------------------------------------------------------------

const cuerpo = celdas
  .map(
    (c) =>
      `  { latitud: ${c.latitud}, longitud: ${c.longitud}, ` +
      `densidad_cobertura: ${c.densidad_cobertura}, ` +
      `tipo_cobertura: '${c.tipo_cobertura}' },`,
  )
  .join('\n');

const archivo = `/**
 * Capa de cobertura de Finet. GENERADO - no editar a mano.
 *
 * Origen: KML de planta externa (NAPs, MUFAs y trazado de fibra de la red FTTH
 * de La Pintana y Puente Alto). Regenerar con:
 *
 *     node scripts/extraer-cobertura-kml.mjs "<ruta al .kml>"
 *
 * Contiene solo geometria y una densidad derivada. Ningun dato de cliente: el
 * script descarta las fichas con RUT o telefono antes de calcular nada.
 *
 * Elementos usados: ${naps.length} NAP/CTO, ${mufas.length} MUFA/nodo, ${tramos.length} tramos de fibra.
 * Celdas de ${PASO} grados (~220 m).
 */

export interface PuntoCoberturaEstatico {
  latitud: number;
  longitud: number;
  densidad_cobertura: number;
  tipo_cobertura: string;
}

export const COBERTURA_FINET: readonly PuntoCoberturaEstatico[] = [
${cuerpo}
];
`;

/** El archivo generado es numerico por construccion; esto lo deja verificado. */
function assertSinDatosPersonales(texto) {
  const literales = [...texto.matchAll(/'([^']*)'/g)].map((m) => m[1]);
  const permitidos = new Set(['fibra', 'mixta', 'parcial']);
  const intrusos = literales.filter((l) => !permitidos.has(l));
  assert.deepEqual(intrusos, [], `Literales inesperados: ${intrusos}`);
  assert(!RUT.test(texto), 'La salida contiene algo con forma de RUT');
  assert(!TELEFONO.test(texto), 'La salida contiene algo con forma de telefono');
}

assertSinDatosPersonales(archivo);
writeFileSync(DESTINO, archivo);

console.log(
  `Descartados: ${descartados.conDatosPersonales} con datos personales, ` +
    `${descartados.fueraDeLimites} fuera de los limites del visor, ` +
    `${descartados.sinClasificar} sin clasificar.`,
);
console.log(
  `Infraestructura: ${naps.length} NAP/CTO, ${mufas.length} MUFA/nodo, ` +
    `${tramos.length} tramos (${segmentos.length} segmentos).`,
);
console.log(`Escritas ${celdas.length} celdas.`);
