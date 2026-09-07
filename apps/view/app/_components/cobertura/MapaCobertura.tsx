"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import type {
  PuntoCobertura,
  VisorCoberturaConfig,
} from "../../_lib/api";

type MapaCoberturaProps = {
  config: VisorCoberturaConfig;
  puntos: PuntoCobertura[];
};

/**
 * Zoom contra el que leaflet.heat normaliza la intensidad.
 *
 * La libreria escala cada punto por `1 / 2^(maxZoom - zoomActual)` y, si no se
 * le pasa `maxZoom`, toma el del mapa. Eso ata los colores de la capa al tope
 * de zoom del visor: bajar `zoom_max` de 18 a 15 multiplicaba la intensidad por
 * ocho y dejaba todo rojo. Fijandolo, la capa se ve igual sin importar hasta
 * donde se permita acercar.
 *
 * El efecto buscado depende de esa escala: a zoom bajo muchas celdas caen en la
 * misma grilla interna, suman y dan los naranjas; al acercarse dejan de
 * solaparse, cada una aporta sola y la capa cae al extremo frio del gradiente.
 * Asi el mapa se atenua a una veladura azul justo cuando su resolucion — celdas
 * de ~220 m — ya no da para mas detalle.
 */
const ZOOM_REFERENCIA_INTENSIDAD = 18;

/**
 * Ultimo zoom en el que se dibuja la capa.
 *
 * Pasado este nivel las celdas quedan tan separadas que el heatmap deja de leerse
 * como una mancha y se ve la grilla: manchones azules alineados en filas, que no
 * dicen nada sobre la cuadra que se esta mirando. Con celdas de ~220 m no hay
 * respuesta que dar a esa escala, asi que se retira la capa y queda el mapa base.
 */
const ULTIMO_ZOOM_CON_CAPA = 15;

/**
 * CU-60: capa de mapa de calor sobre el visor.
 * La intensidad se normaliza contra la densidad maxima del set para que la
 * escala de color sea legible sin importar el rango absoluto de los datos.
 */
function CapaCalor({ puntos }: { puntos: PuntoCobertura[] }) {
  const map = useMap();

  useEffect(() => {
    if (puntos.length === 0) return;

    const densidadMaxima = Math.max(
      ...puntos.map((p) => p.densidad_cobertura ?? 0),
      1
    );

    const datos: [number, number, number][] = puntos.map((p) => [
      p.latitud,
      p.longitud,
      (p.densidad_cobertura ?? 0) / densidadMaxima,
    ]);

    const capa = L.heatLayer(datos, {
      radius: 28,
      blur: 20,
      minOpacity: 0.35,
      maxZoom: ZOOM_REFERENCIA_INTENSIDAD,
    });

    const sincronizarVisibilidad = () => {
      const corresponde = map.getZoom() <= ULTIMO_ZOOM_CON_CAPA;
      if (corresponde && !map.hasLayer(capa)) capa.addTo(map);
      else if (!corresponde && map.hasLayer(capa)) capa.remove();
    };

    sincronizarVisibilidad();
    map.on("zoomend", sincronizarVisibilidad);

    return () => {
      map.off("zoomend", sincronizarVisibilidad);
      capa.remove();
    };
  }, [map, puntos]);

  return null;
}

export default function MapaCobertura({ config, puntos }: MapaCoberturaProps) {
  // CU-62: mas alla de estos limites el paneo no avanza.
  const limites = useMemo(
    () =>
      L.latLngBounds(
        [config.limites.sur_oeste.latitud, config.limites.sur_oeste.longitud],
        [config.limites.nor_este.latitud, config.limites.nor_este.longitud]
      ),
    [config.limites]
  );

  return (
    <MapContainer
      center={[config.centro.latitud, config.centro.longitud]}
      zoom={config.zoom_inicial}
      // CU-61: el rango de escala queda acotado por el backend.
      minZoom={config.zoom_min}
      maxZoom={config.zoom_max}
      maxBounds={limites}
      maxBoundsViscosity={1}
      // CU-61: rueda, doble click y pellizco. CU-62: arrastre con puntero o dedo.
      scrollWheelZoom
      doubleClickZoom
      touchZoom
      dragging
      className="h-[60vh] min-h-[380px] w-full rounded-2xl border border-border"
    >
      <TileLayer
        attribution='&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={config.zoom_max}
      />
      <CapaCalor puntos={puntos} />
    </MapContainer>
  );
}
