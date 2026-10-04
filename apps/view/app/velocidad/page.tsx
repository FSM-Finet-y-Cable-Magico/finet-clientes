import type { Metadata } from "next";
import { metadataSeccion } from "../_lib/seo";
import FastSpeedTest from "../_components/FastSpeedTest";

export const metadata: Metadata = metadataSeccion({
  path: "/velocidad",
  title: "Test de velocidad",
  description:
    "Mide la velocidad de bajada, subida y latencia de tu conexión a internet.",
});

export default function VelocidadPage() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold text-foreground">Test de velocidad</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Mide la velocidad real de tu conexión. La prueba corre desde tu propio
        dispositivo contra los servidores de fast.com y demora menos de medio
        minuto.
      </p>

      <div className="mt-8">
        <FastSpeedTest />
      </div>

      <p className="mt-6 text-xs text-muted">
        Los resultados dependen de tu equipo, de la red WiFi y de cuántos
        dispositivos estén conectados. Para una medición más fiel, conéctate por
        cable y cierra las descargas en curso.
      </p>
    </section>
  );
}
