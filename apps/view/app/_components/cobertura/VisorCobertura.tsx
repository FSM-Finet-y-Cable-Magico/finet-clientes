"use client";

import dynamic from "next/dynamic";
import type {
  PuntoCobertura,
  VisorCoberturaConfig,
} from "../../_lib/api";

type VisorCoberturaProps = {
  config: VisorCoberturaConfig;
  puntos: PuntoCobertura[];
  /** Silueta borrosa de la cobertura, ya embebida en el HTML. */
  vistaPrevia: string | null;
};

/** Marco del visor, con la misma caja que usa el mapa una vez cargado. */
function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-[60vh] min-h-[380px] w-full overflow-hidden rounded-2xl border border-border bg-surface-deep">
      {children}
    </div>
  );
}

/**
 * CU-59: Leaflet toca `window` al importarse, asi que el visor se carga solo
 * en el cliente. Este wrapper existe unicamente para poder usar
 * `dynamic(..., { ssr: false })`, que no esta permitido en Server Components.
 */
const MapaCobertura = dynamic(() => import("./MapaCobertura"), { ssr: false });

export default function VisorCobertura({
  config,
  puntos,
  vistaPrevia,
}: VisorCoberturaProps) {
  return (
    <div className="relative">
      {/*
        Se pinta debajo del mapa y no como estado de carga: viaja en el HTML,
        asi que aparece antes de que exista Leaflet y el mapa la tapa al montar.
        Es el elemento mas grande de la pagina, o sea el que mide el LCP.
      */}
      <Marco>
        {vistaPrevia && (
          <img
            src={vistaPrevia}
            alt=""
            aria-hidden
            className="h-full w-full object-cover"
          />
        )}
      </Marco>

      <div className="absolute inset-0" role="status" aria-label="Mapa de cobertura">
        <MapaCobertura config={config} puntos={puntos} />
      </div>
    </div>
  );
}
