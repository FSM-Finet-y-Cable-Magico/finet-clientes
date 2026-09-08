"use client";

import { useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
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
 * Cuanto se extiende el mapa por fuera de su marco visible, en pixeles.
 *
 * Es lo que permite arrastrar sin ver el borde de la capa de calor: la franja
 * que el canvas destapa al moverse cae dentro de este margen, que el marco
 * recorta. Cada pixel de mas agranda el viewport y con el la cantidad de
 * teselas de la carga inicial, asi que se queda en lo justo para tapar el
 * arrastre tipico.
 */
const DESBORDE = 96;

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

    /**
     * Mantiene el canvas de la capa del tamano del contenedor.
     *
     * leaflet.heat dimensiona su canvas en `_reset`, que solo corre al agregarse
     * la capa y en `moveend`. Leaflet, a su vez, solo se entera de un cambio de
     * tamano por el `resize` de la ventana — y el contenedor cambia sin que eso
     * ocurra: la barra de scroll de la pagina que aparece o desaparece le quita
     * o devuelve ~15 px de ancho, y en el telefono la barra del navegador cambia
     * el `60vh` de su alto. Cuando el canvas queda chico, la capa se ve cortada
     * contra un borde recto, con mapa base del otro lado.
     *
     * No basta con avisarle a Leaflet: `invalidateSize` no emite `moveend` si el
     * desplazamiento del centro redondea a cero, y ahi el canvas se queda como
     * estaba. Por eso, ademas de avisar, se vuelve a agregar la capa — su alta
     * ejecuta `_reset` con el tamano ya actualizado, sin depender de que algun
     * evento intermedio se dispare.
     */
    const observador = new ResizeObserver(() => {
      // Con el contenedor en cero — primer cuadro, o la pagina en segundo plano —
      // el canvas queda de ancho 0 y el repintado revienta en `getImageData`.
      if (!map.getContainer().clientWidth) return;
      map.invalidateSize();
      if (!map.hasLayer(capa)) return;
      capa.remove();
      capa.addTo(map);
    });
    observador.observe(map.getContainer());

    /**
     * Maximo desfase tolerado entre el canvas y el contenedor, en pixeles.
     *
     * Se queda algo por debajo de `DESBORDE`: mientras la franja descubierta
     * quepa en lo que el marco recorta, no se ve nada y no hay para que
     * repintar. Se repinta justo antes de que asome.
     *
     * Un repintado cuesta ~14 ms — mas de lo que dura un cuadro — asi que
     * espaciarlos por distancia recorrida es lo que mantiene fluido el arrastre.
     */
    const MAX_DESFASE = DESBORDE - 20;

    /**
     * Mantiene la capa cubriendo el viewport mientras se arrastra el mapa.
     *
     * El canvas de leaflet.heat mide exactamente lo que el viewport y solo se
     * reposiciona al terminar el movimiento. Durante el arrastre viaja con el
     * mapa, asi que va dejando al descubierto la franja que todavia no cubre: se
     * ve el borde recto de la capa y, al soltar, reaparece completa.
     *
     * `_reset` es interno, pero es lo unico que reposiciona el canvas y lo
     * vuelve a pintar en una sola pasada. `redraw()` no sirve: repinta sobre un
     * canvas que quedo en la posicion anterior, asi que desalinea.
     */
    const seguirElMovimiento = () => {
      const canvas = map.getPanes().overlayPane.querySelector("canvas");
      if (!canvas) return;

      const suyo = canvas.getBoundingClientRect();
      const nuestro = map.getContainer().getBoundingClientRect();
      const desfase = Math.max(
        Math.abs(suyo.top - nuestro.top),
        Math.abs(suyo.left - nuestro.left)
      );

      if (desfase < MAX_DESFASE) return;
      (capa as unknown as { _reset?: () => void })._reset?.();
    };

    sincronizarVisibilidad();
    map.on("zoomend", sincronizarVisibilidad);
    map.on("move", seguirElMovimiento);

    return () => {
      observador.disconnect();
      map.off("zoomend", sincronizarVisibilidad);
      map.off("move", seguirElMovimiento);
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
    // El marco es lo que se ve; el mapa de adentro lo desborda por `DESBORDE`
    // en los cuatro lados y este `overflow-hidden` lo recorta. Ver
    // `.mapa-con-desborde` en globals.css para el porque.
    //
    // `isolate` encierra los z-index de Leaflet (paneles 400, controles 1000)
    // en este marco; sin eso se cuelan por encima del header.
    <div
      className="mapa-con-desborde relative isolate h-[60vh] min-h-[380px] w-full overflow-hidden rounded-2xl border border-border"
      style={{ "--desborde-mapa": `${DESBORDE}px` } as CSSProperties}
    >
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
        className="absolute"
        style={{ top: -DESBORDE, right: -DESBORDE, bottom: -DESBORDE, left: -DESBORDE }}
      >
        <TileLayer
          attribution='&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={config.zoom_max}
        />
        <CapaCalor puntos={puntos} />
      </MapContainer>
    </div>
  );
}
