"use client";

import { useEffect, useState, useCallback } from "react";
import { Wifi, Zap, Calendar, AlertCircle, RefreshCw } from "lucide-react";
import { api } from "../../utils/api";
import StatusBadge from "@/app/_components/ui/StatusBadge";
import { estadoContratoBadge } from "@/app/_lib/estado-contrato";
import WifiPasswordSection from "@/app/_components/portal/WifiPasswordSection";

type Plan = {
  id_plan: number;
  nombre_comercial: string;
  tipo_plan: string;
  velocidad_mbps: number | null;
  precio_mensual: number;
} | null;

type Contrato = {
  id_contrato: number;
  estado: string;
  fecha_inicio: string;
  dia_vencimiento: number;
  plan: Plan;
};

function formatPrecio(precio: number) {
  return `$${precio.toLocaleString("es-CL")}`;
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}


export default function ServiciosPage() {
  const [contratos, setContratos] = useState<Contrato[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchServicios = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const json = await api.get<Contrato[]>("/portal/contratos/vigentes");
      setContratos(json);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchServicios(), 0);
    return () => clearTimeout(t);
  }, [fetchServicios]);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
          <Wifi size={20} aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mis Servicios</h1>
          <p className="text-sm text-muted">
            Detalle de tus planes contratados
          </p>
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="border border-border rounded-xl p-6 bg-background animate-pulse"
            >
              <div className="h-3 w-24 rounded bg-border mb-3" />
              <div className="h-6 w-40 rounded bg-border mb-2" />
              <div className="h-8 w-32 rounded bg-border" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="border border-error bg-error-container rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle
              size={20}
              className="text-error mt-0.5 shrink-0"
              aria-hidden
            />
            <div>
              <p className="text-sm font-medium text-on-error-container">
                No se pudo cargar tus servicios
              </p>
              <p className="mt-1 text-sm text-on-error-container">
                La información de tus planes no está disponible temporalmente.
              </p>
              <button
                type="button"
                onClick={fetchServicios}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-on-error-container hover:brightness-110 transition-[filter]"
              >
                <RefreshCw size={14} aria-hidden />
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {contratos && contratos.length === 0 && !loading && (
        <div className="border border-border rounded-xl p-8 bg-background text-center">
          <Wifi size={32} className="mx-auto text-muted" aria-hidden />
          <p className="mt-3 text-sm font-medium text-foreground">
            Aún no tienes servicios contratados
          </p>
          <p className="mt-1 text-sm text-muted">
            Contrata un plan para empezar a disfrutar de tu conexión.
          </p>
        </div>
      )}

      {contratos && contratos.length > 0 && !loading && (
        <div className="space-y-4">
          {contratos.map((c) => {
            const badge = estadoContratoBadge(c.estado);
            return (
              <div
                key={c.id_contrato}
                className="border border-border rounded-xl p-6 bg-background"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Abonado #{c.id_contrato}
                    </p>
                    {c.plan ? (
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {c.plan.nombre_comercial}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-muted">
                        Sin plan asociado
                      </p>
                    )}
                  </div>
                  <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                </div>

                {c.plan && (
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    {c.plan.velocidad_mbps != null && (
                      <div className="flex items-center gap-1.5 text-sm text-muted">
                        <Zap size={14} aria-hidden />
                        <span>{c.plan.velocidad_mbps} Mbps</span>
                      </div>
                    )}
                    <p className="text-xl font-extrabold text-foreground">
                      {formatPrecio(c.plan.precio_mensual)}
                      <span className="text-sm font-normal text-muted">/mes</span>
                    </p>
                  </div>
                )}

                <div className="mt-4 grid gap-2 border-t border-border pt-4 text-sm sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-muted">
                    <Calendar size={14} aria-hidden />
                    <span>Inicio: {formatFecha(c.fecha_inicio)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted">
                    <Calendar size={14} aria-hidden />
                    <span>Vence el día {c.dia_vencimiento} de cada mes</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CU-31 + CU-32: el cambio de clave WiFi se pide sobre un contrato, asi
          que vive junto a la lista de servicios y reusa los contratos ya
          cargados en vez de volver a pedirlos. */}
      {contratos && contratos.length > 0 && !loading && (
        <div className="mt-6">
          <WifiPasswordSection contratos={contratos} />
        </div>
      )}
    </div>
  );
}
