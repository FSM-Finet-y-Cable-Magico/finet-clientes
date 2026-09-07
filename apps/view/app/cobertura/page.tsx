import type { Metadata } from "next";
import { MapPinOff } from "lucide-react";
import VisorCobertura from "../_components/cobertura/VisorCobertura";
import { getPuntosCobertura, getVisorCoberturaConfig } from "../_lib/api";

export const metadata: Metadata = {
  title: "Consulta de cobertura",
  description:
    "Explora el mapa de cobertura de fibra optica de Finet en La Pintana y Puente Alto.",
};

export default async function CoberturaPage() {
  const [config, puntos] = await Promise.all([
    getVisorCoberturaConfig(),
    getPuntosCobertura(),
  ]);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-bold text-foreground">
        Consulta de cobertura
      </h1>
      <p className="mt-3 max-w-2xl text-muted">
        Explora el mapa para ver la densidad de cobertura de nuestra red de
        fibra optica. Acerca, aleja y desplaza la vista para revisar tu zona.
      </p>

      <div className="mt-8">
        {/* CU-59, Excepcion 2: el visor no pudo inicializarse. */}
        {config === null ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface px-4 py-16 text-center">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-error-container text-on-error-container">
              <MapPinOff size={28} strokeWidth={1.5} aria-hidden />
            </div>
            <p className="font-medium text-foreground">
              El visor no esta disponible temporalmente
            </p>
            <p className="mt-2 max-w-sm text-sm text-muted">
              No pudimos cargar el mapa de cobertura. Intentalo nuevamente en
              unos minutos.
            </p>
          </div>
        ) : (
          <>
            <VisorCobertura config={config} puntos={puntos} />

            {/* CU-60, Excepcion 1: sin datos se muestra el visor sin capa tematica. */}
            {puntos.length === 0 && (
              <p className="mt-4 rounded-xl bg-warning-container px-4 py-3 text-sm text-on-warning-container">
                La capa de cobertura no esta disponible por ahora. El mapa se
                muestra sin los datos de densidad.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
