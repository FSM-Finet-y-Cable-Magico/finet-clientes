import type { PuntoCobertura } from "../../_lib/api";

/**
 * Silueta borrosa de la cobertura, como data URI de SVG.
 *
 * El elemento LCP de `/cobertura` era una tesela de OpenStreetMap, que no se
 * puede pedir hasta que la pagina hidrata y baja el chunk de Leaflet: quedaba
 * al final de una cadena larga y arrastraba el LCP a mas de 7 s. Un `<img>` con
 * el SVG embebido viaja dentro del HTML, se descubre al instante y pasa a ser
 * el elemento mas grande, asi que el LCP se mide contra el.
 *
 * No es solo para el numero: en una conexion lenta se ve enseguida donde hay
 * cobertura, en vez de un rectangulo pulsando durante segundos.
 *
 * Va borrosa a proposito. La altura del visor es `60vh`, asi que desde el
 * servidor no se sabe su proporcion final y la silueta no puede calzar exacta
 * con el mapa que llega despues; difuminada se lee como un anticipo y no como
 * un mapa mal alineado.
 */
export function vistaPreviaCobertura(puntos: PuntoCobertura[]): string | null {
  if (puntos.length === 0) return null;

  const lats = puntos.map((p) => p.latitud);
  const lngs = puntos.map((p) => p.longitud);
  const latMin = Math.min(...lats);
  const latMax = Math.max(...lats);
  const lngMin = Math.min(...lngs);
  const lngMax = Math.max(...lngs);

  const ancho = lngMax - lngMin || 1;
  const alto = latMax - latMin || 1;

  const circulos = puntos
    .map((p) => {
      const x = ((p.longitud - lngMin) / ancho) * 100;
      // El eje Y del SVG crece hacia abajo y la latitud hacia arriba.
      const y = ((latMax - p.latitud) / alto) * 100;
      const t = Math.max(0, Math.min(1, (p.densidad_cobertura ?? 0) / 100));
      // Mismo criterio que el heatmap: frio para poca densidad, calido para mucha.
      const tono = Math.round(240 * (1 - t));
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="hsl(${tono} 85% 50%)"/>`;
    })
    .join("");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">` +
    `<filter id="b"><feGaussianBlur stdDeviation="2.5"/></filter>` +
    `<g filter="url(#b)" opacity="0.55">${circulos}</g>` +
    `</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
