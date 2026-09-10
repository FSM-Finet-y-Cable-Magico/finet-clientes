"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, RotateCcw, TriangleAlert } from "lucide-react";
import PrimaryButton from "./ui/PrimaryButton";
import {
  medirVelocidad,
  type FaseMedicion,
  type ResultadoVelocidad,
} from "../_lib/fast-speedtest";

type Estado =
  | { tipo: "inicial" }
  | { tipo: "midiendo"; fase: FaseMedicion; mbps: number | null; progreso: number }
  | { tipo: "listo"; resultado: ResultadoVelocidad }
  | { tipo: "error" };

const ETIQUETA_FASE: Record<FaseMedicion, string> = {
  descubriendo: "Preparando la prueba",
  latencia: "Midiendo latencia",
  bajada: "Midiendo velocidad de bajada",
  subida: "Midiendo velocidad de subida",
};

function formatearMbps(valor: number | null): string {
  if (valor === null) return "--";
  return valor >= 100 ? valor.toFixed(0) : valor.toFixed(1);
}

const BARRAS = 5;
// Extremos de la escala, calibrados al catalogo de Finet: los planes van de 200
// a 900 Mbps, asi que el tope se pone en 900 para que esa franja ocupe barritas
// distintas y no todos vean el maximo.
const MBPS_MINIMO = 10;
const MBPS_MAXIMO = 900;

/**
 * Barritas tipo senal. La escala es logaritmica porque la diferencia entre 5 y
 * 50 Mbps se nota mucho mas que entre 500 y 550; en escala lineal casi todos
 * los planes de fibra quedarian pegados al tope.
 */
function BarritasSenal({
  mbps,
  animando,
}: {
  mbps: number | null;
  animando: boolean;
}) {
  const TOTAL = BARRAS;
  const encendidas =
    mbps === null || mbps <= 0
      ? 0
      : Math.min(
          TOTAL,
          Math.max(
            1,
            Math.round(
              1 +
                (TOTAL - 1) *
                  ((Math.log10(mbps) - Math.log10(MBPS_MINIMO)) /
                    (Math.log10(MBPS_MAXIMO) - Math.log10(MBPS_MINIMO))),
            ),
          ),
        );

  return (
    <div
      className="flex items-end justify-center gap-1.5"
      aria-hidden
    >
      {Array.from({ length: TOTAL }, (_, i) => {
        const activa = i < encendidas;
        return (
          <span
            key={i}
            className={`w-2.5 rounded-sm transition-all duration-500 ${
              activa ? "bg-primary" : "bg-border"
            } ${animando ? "animate-pulse" : ""}`}
            style={{
              height: `${10 + i * 7}px`,
              // El pulso corre en cascada, de la barrita mas baja a la mas alta.
              animationDelay: animando ? `${i * 120}ms` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

type SecundarioProps = {
  etiqueta: string;
  detalle: string;
  valor: string;
  unidad: string;
  activo?: boolean;
};

function Secundario({
  etiqueta,
  detalle,
  valor,
  unidad,
  activo,
}: SecundarioProps) {
  return (
    <div
      className={`border-t pt-4 transition-colors ${
        activo ? "border-primary" : "border-border"
      }`}
    >
      <p className="text-xs font-medium text-foreground">{etiqueta}</p>
      <p className="text-xs text-muted">{detalle}</p>
      <p className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums text-foreground">
          {valor}
        </span>
        <span className="text-xs text-muted">{unidad}</span>
      </p>
    </div>
  );
}

export default function FastSpeedTest() {
  const [estado, setEstado] = useState<Estado>({ tipo: "inicial" });
  const abortRef = useRef<AbortController | null>(null);

  // Si el cliente se va a mitad de la prueba, cortamos las descargas en curso
  // en vez de dejarlas consumiendo su conexion.
  useEffect(() => () => abortRef.current?.abort(), []);

  const iniciar = useCallback(async () => {
    abortRef.current?.abort();
    const control = new AbortController();
    abortRef.current = control;

    setEstado({
      tipo: "midiendo",
      fase: "descubriendo",
      mbps: null,
      progreso: 0,
    });

    try {
      const resultado = await medirVelocidad({
        signal: control.signal,
        onProgress: ({ fase, mbps, progreso }) =>
          setEstado({
            tipo: "midiendo",
            fase,
            mbps: mbps ?? null,
            progreso,
          }),
      });
      if (control.signal.aborted) return;
      setEstado({ tipo: "listo", resultado });
    } catch {
      if (control.signal.aborted) return;
      // CU-34 Excepcion 2: la herramienta de medicion no carga.
      setEstado({ tipo: "error" });
    }
  }, []);

  // CU-34 Excepcion 2: indisponibilidad temporal de la herramienta.
  if (estado.tipo === "error") {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface px-4 py-16 text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-error-container text-on-error-container">
          <TriangleAlert size={28} strokeWidth={1.5} aria-hidden />
        </div>
        <p className="font-medium text-foreground">
          La herramienta de medicion no esta disponible
        </p>
        <p className="mt-2 max-w-sm text-sm text-muted">
          No pudimos conectar con el servidor de pruebas. Revisa tu conexion e
          intentalo nuevamente en unos minutos.
        </p>
        <div className="mt-6">
          <PrimaryButton variant="outline" type="button" onClick={iniciar}>
            <RotateCcw size={16} aria-hidden />
            Reintentar
          </PrimaryButton>
        </div>
      </div>
    );
  }

  const midiendo = estado.tipo === "midiendo";
  const resultado = estado.tipo === "listo" ? estado.resultado : null;
  const inicial = estado.tipo === "inicial";
  const progreso = midiendo ? estado.progreso : resultado ? 1 : 0;

  // El numero grande es siempre la bajada, que es lo que la gente entiende por
  // "mi velocidad". Durante la prueba muestra el valor en vivo de esa fase; en
  // la de subida se congela en lo ya medido.
  const bajadaEnVivo =
    midiendo && estado.fase === "bajada" ? estado.mbps : null;
  const subidaEnVivo =
    midiendo && estado.fase === "subida" ? estado.mbps : null;
  const bajada = bajadaEnVivo ?? resultado?.bajadaMbps ?? null;

  return (
    <div className="rounded-2xl border border-border bg-surface px-6 py-10 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <BarritasSenal mbps={bajada} animando={midiendo} />

        <div className="mt-5 flex items-center gap-2 text-muted">
          <ArrowDownToLine size={16} aria-hidden />
          <span className="text-xs font-medium uppercase tracking-wide">
            Velocidad de bajada
          </span>
        </div>

        <p
          className="mt-2 flex items-baseline justify-center gap-2"
          role="status"
          aria-live="polite"
        >
          <span className="text-6xl font-bold leading-none tabular-nums text-foreground sm:text-7xl">
            {formatearMbps(bajada)}
          </span>
          <span className="text-2xl font-semibold text-muted">Mbps</span>
        </p>

        {/* Barra de progreso: solo aparece durante la prueba. */}
        <div
          className={`mt-6 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-border transition-opacity duration-300 ${
            midiendo ? "opacity-100" : "opacity-0"
          }`}
          role="progressbar"
          aria-valuenow={Math.round(progreso * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Avance de la prueba"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${progreso * 100}%` }}
          />
        </div>

        <div className="mt-4 min-h-[2.5rem] flex items-center">
          {midiendo ? (
            <span className="text-sm text-muted">
              {ETIQUETA_FASE[estado.fase]}...
            </span>
          ) : (
            <PrimaryButton type="button" onClick={iniciar}>
              {inicial ? (
                "Iniciar prueba"
              ) : (
                <>
                  <RotateCcw size={16} aria-hidden />
                  Medir de nuevo
                </>
              )}
            </PrimaryButton>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-3">
        <Secundario
          etiqueta="Latencia"
          detalle="En reposo"
          valor={resultado?.latenciaMs?.toString() ?? "--"}
          unidad="ms"
          activo={midiendo && estado.fase === "latencia"}
        />
        <Secundario
          etiqueta="Latencia"
          detalle="Con la linea cargada"
          valor={resultado?.latenciaCargaMs?.toString() ?? "--"}
          unidad="ms"
          activo={midiendo && estado.fase === "bajada"}
        />
        <Secundario
          etiqueta="Subida"
          detalle="Velocidad"
          valor={formatearMbps(subidaEnVivo ?? resultado?.subidaMbps ?? null)}
          unidad="Mbps"
          activo={midiendo && estado.fase === "subida"}
        />
      </div>

      {/* CU-35 Excepcion 1: la prueba termino sin ningun valor utilizable. */}
      {resultado &&
        resultado.bajadaMbps === null &&
        resultado.subidaMbps === null &&
        resultado.latenciaMs === null && (
          <p className="mt-6 rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container">
            No fue posible obtener una medicion concluyente. Intentalo
            nuevamente.
          </p>
        )}

      {/* CU-35 Excepcion 2: se muestran solo los valores disponibles. */}
      {resultado &&
        resultado.parcial &&
        (resultado.bajadaMbps !== null ||
          resultado.subidaMbps !== null ||
          resultado.latenciaMs !== null) && (
          <p className="mt-6 rounded-xl bg-warning-container px-4 py-3 text-sm text-on-warning-container">
            La medicion quedo incompleta. Te mostramos solo los valores que
            pudimos obtener.
          </p>
        )}
    </div>
  );
}
