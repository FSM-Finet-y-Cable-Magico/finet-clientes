"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LayoutDashboard,
  Wifi,
  AlertCircle,
  RefreshCw,
  Zap,
  CreditCard,
} from "lucide-react";
import { useAuth } from "../_lib/auth";
import { api } from "../utils/api";
import StatusBadge from "@/app/_components/ui/StatusBadge";
import { estadoContratoBadge } from "@/app/_lib/estado-contrato";

type Contrato = {
  id_contrato: number;
  estado: string;
  fecha_inicio: string;
  dia_vencimiento: number;
  plan: {
    id_plan: number;
    nombre_comercial: string;
    tipo_plan: string;
    velocidad_mbps: number;
    precio_mensual: number;
  } | null;
};

type Factura = {
  id_factura: number;
  periodo: string;
  monto: number;
  fecha_limite_pago: string;
  estado: string;
  dias_vencida: number | null;
};

type Ticket = {
  id_ticket: number;
  codigo_seguimiento: string;
  estado: string;
  prioridad: string;
  descripcion: string;
  fecha_creacion: string;
  categoria: string;
};

type PanelData = {
  cliente: {
    id_cliente: number;
    nombre_completo: string;
    rut: string;
    email: string;
    telefono: string;
  };
  contratos: Contrato[];
  resumen_deuda: {
    tiene_deuda: boolean;
    saldo_total: number;
    facturas_pendientes: Factura[];
  };
  tickets_recientes: Ticket[];
};

function formatPrecio(precio: number) {
  return `$${precio.toLocaleString("es-CL")}`;
}

function formatFechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
  });
}


export default function PortalPage() {
  const { cliente: authCliente } = useAuth();
  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchPanel = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const json = await api.get<PanelData>("/portal/panel");
      setData(json);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchPanel(), 0);
    return () => clearTimeout(t);
  }, [fetchPanel]);

  const nombre =
    data?.cliente.nombre_completo ?? authCliente?.nombre_completo ?? "";

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
          <LayoutDashboard size={20} aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Bienvenido{nombre ? `, ${nombre.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-muted">
            Resumen de tus servicios
          </p>
        </div>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="border border-border rounded-xl p-6 bg-background animate-pulse"
            >
              <div className="h-3 w-24 rounded bg-border mb-3" />
              <div className="h-8 w-32 rounded bg-border mb-2" />
              <div className="h-4 w-20 rounded bg-border" />
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
                No se pudo cargar la información
              </p>
              <p className="mt-1 text-sm text-on-error-container">
                El estado de tus servicios no pudo obtenerse en este momento.
              </p>
              <button
                type="button"
                onClick={fetchPanel}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-on-error-container hover:brightness-110 transition-[filter]"
              >
                <RefreshCw size={14} aria-hidden />
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Contratos */}
          {data.contratos.length === 0 ? (
            <div className="border border-border rounded-xl p-8 bg-background text-center">
              <Wifi
                size={32}
                className="mx-auto text-muted"
                aria-hidden
              />
              <p className="mt-3 text-sm font-medium text-foreground">
                Aún no tienes servicios contratados
              </p>
              <p className="mt-1 text-sm text-muted">
                Contrata un plan para empezar.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.contratos.map((c) => {
                const badge = estadoContratoBadge(c.estado);
                return (
                  <div
                    key={c.id_contrato}
                    className="border border-border rounded-xl p-6 bg-background"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                        Mi Plan
                      </p>
                      <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                    </div>
                    {c.plan ? (
                      <>
                        <p className="text-lg font-semibold text-foreground">
                          {c.plan.nombre_comercial}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Zap
                            size={14}
                            className="text-muted"
                            aria-hidden
                          />
                          <span className="text-sm text-muted">
                            {c.plan.velocidad_mbps} Mbps
                          </span>
                        </div>
                        <p className="mt-3 text-2xl font-extrabold text-foreground">
                          {formatPrecio(c.plan.precio_mensual)}
                          <span className="text-sm font-normal text-muted">
                            /mes
                          </span>
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted">
                        Sin plan asociado
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Deuda + Tickets summary row */}
          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            <div className="border border-border rounded-xl p-6 bg-background">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
                Mi Deuda
              </p>
              {data.resumen_deuda.tiene_deuda ? (
                (() => {
                  const masProxima = data.resumen_deuda.facturas_pendientes
                    .filter((f) => f.fecha_limite_pago)
                    .sort(
                      (a, b) =>
                        new Date(a.fecha_limite_pago).getTime() -
                        new Date(b.fecha_limite_pago).getTime(),
                    )[0];

                  return (
                    <>
                      <p className="text-3xl font-extrabold text-error">
                        {formatPrecio(data.resumen_deuda.saldo_total)}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {data.resumen_deuda.facturas_pendientes.length} factura
                        {data.resumen_deuda.facturas_pendientes.length !== 1
                          ? "s"
                          : ""}{" "}
                        pendiente
                        {data.resumen_deuda.facturas_pendientes.length !== 1
                          ? "s"
                          : ""}
                      </p>
                      {masProxima && (
                        <p className="mt-1 text-xs text-muted">
                          {masProxima.estado === "vencida"
                            ? `Vencida: ${formatFechaCorta(masProxima.fecha_limite_pago)}`
                            : `Vence: ${formatFechaCorta(masProxima.fecha_limite_pago)}`}
                        </p>
                      )}
                      {/* TODO: enlazar a la pasarela de pago (CU-42+). Por ahora sin acción. */}
                      <button
                        type="button"
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-background shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
                      >
                        <CreditCard size={16} aria-hidden />
                        Pagar ahora
                      </button>
                    </>
                  );
                })()
              ) : (
                <>
                  <p className="text-lg font-semibold text-success">
                    Estás al día
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Sin facturas pendientes
                  </p>
                </>
              )}
            </div>
            <div className="border border-border rounded-xl p-6 bg-background">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
                Tickets Recientes
              </p>
              {data.tickets_recientes.length === 0 ? (
                <>
                  <p className="text-lg font-semibold text-foreground">
                    Sin tickets
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    No tienes solicitudes de soporte
                  </p>
                </>
              ) : (
                <ul className="space-y-2">
                  {data.tickets_recientes.map((t) => (
                    <li key={t.id_ticket} className="text-sm">
                      <span className="font-medium text-foreground">
                        {t.codigo_seguimiento}
                      </span>
                      <span className="text-muted">
                        {" "}
                        — {t.estado}
                      </span>
                      <p className="text-xs text-muted truncate">
                        {t.descripcion}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
