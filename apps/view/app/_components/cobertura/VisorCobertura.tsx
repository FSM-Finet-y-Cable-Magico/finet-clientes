"use client";

import dynamic from "next/dynamic";
import type {
  PuntoCobertura,
  VisorCoberturaConfig,
} from "../../_lib/api";

/**
 * CU-59: Leaflet toca `window` al importarse, asi que el visor se carga solo
 * en el cliente. Este wrapper existe unicamente para poder usar
 * `dynamic(..., { ssr: false })`, que no esta permitido en Server Components.
 */
const MapaCobertura = dynamic(() => import("./MapaCobertura"), {
  ssr: false,
  loading: () => (
    <div
      className="h-[60vh] min-h-[380px] w-full animate-pulse rounded-2xl border border-border bg-surface-deep"
      role="status"
      aria-label="Cargando visor cartografico"
    />
  ),
});

type VisorCoberturaProps = {
  config: VisorCoberturaConfig;
  puntos: PuntoCobertura[];
};

export default function VisorCobertura({
  config,
  puntos,
}: VisorCoberturaProps) {
  return <MapaCobertura config={config} puntos={puntos} />;
}
