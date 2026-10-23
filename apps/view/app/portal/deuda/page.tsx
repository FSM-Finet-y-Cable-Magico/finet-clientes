"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { api } from "../../utils/api";
import { fechaCalendario, formatPrecio } from "@/app/_lib/formato";
import StatusBadge, { type StatusTone } from "@/app/_components/ui/StatusBadge";
import IrAPagarButton from "@/app/_components/portal/IrAPagarButton";
import PagosAnteriores from "@/app/_components/portal/PagosAnteriores";
import { FilaFactura, TablaFacturas } from "@/app/_components/deuda/TablaFacturas";

type Factura = {
  id_factura: number;
  periodo: string;
  monto: number;
  fecha_limite_pago: string;
  estado: string;
  dias_vencida: number | null;
};

type DeudaData = {
  tiene_deuda: boolean;
  saldo_total: number;
  saldo_confirmado: boolean;
  facturas_pendientes: Factura[];
};

function estadoBadge(estado: string): { label: string; tone: StatusTone } {
  const map: Record<string, { label: string; tone: StatusTone }> = {
    vencida: { label: "Vencida", tone: "error" },
    pendiente: { label: "Pendiente", tone: "warning" },
  };
  return map[estado] ?? { label: estado, tone: "neutral" };
}

export default function DeudaPage() {
  const [data, setData] = useState<DeudaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchDeuda = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const json = await api.get<DeudaData>("/portal/deuda");
      setData(json);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchDeuda(), 0);
    return () => clearTimeout(t);
  }, [fetchDeuda]);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
          <CreditCard size={20} aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mi Deuda</h1>
          <p className="text-sm text-muted">
            Detalle de tus facturas pendientes
          </p>
        </div>
      </div>

      {loading && (
        <div className="border border-border rounded-xl p-6 bg-background animate-pulse">
          <div className="h-3 w-24 rounded bg-border mb-3" />
          <div className="h-10 w-40 rounded bg-border mb-4" />
          <div className="h-3 w-full rounded bg-border mb-2" />
          <div className="h-3 w-2/3 rounded bg-border" />
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
                No se pudo cargar tu deuda
              </p>
              <p className="mt-1 text-sm text-on-error-container">
                La información de tus facturas no está disponible temporalmente.
              </p>
              <button
                type="button"
                onClick={fetchDeuda}
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
          {/* CU-27 Excepción 3: saldo no confirmado */}
          {!data.saldo_confirmado && (
            <div className="mb-4 border border-warning/20 bg-warning-container rounded-xl p-6">
              <div className="flex items-start gap-3">
                <AlertCircle
                  size={20}
                  className="text-on-warning-container mt-0.5 shrink-0"
                  aria-hidden
                />
                <p className="text-sm font-medium text-on-warning-container">
                  No pudimos confirmar tu saldo en este momento. Contáctanos
                  para regularizar tu situación.
                </p>
              </div>
            </div>
          )}

          {data.tiene_deuda ? (
            <div className="border border-border rounded-xl bg-background divide-y divide-border">
              <div className="p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Saldo pendiente
                </p>
                <p className="mt-2 text-3xl font-extrabold text-error">
                  {formatPrecio(data.saldo_total)}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {data.facturas_pendientes.length} factura
                  {data.facturas_pendientes.length !== 1 ? "s" : ""} pendiente
                  {data.facturas_pendientes.length !== 1 ? "s" : ""}
                </p>
                <IrAPagarButton />
              </div>

              <TablaFacturas>
                {data.facturas_pendientes.map((f) => {
                  const badge = estadoBadge(f.estado);
                  return (
                    <FilaFactura
                      key={f.id_factura}
                      periodo={f.periodo}
                      monto={f.monto}
                      vence={
                        <>
                          {fechaCalendario(f.fecha_limite_pago, "larga")}
                          {f.dias_vencida != null && f.dias_vencida > 0 && (
                            <span className="block text-xs text-error">
                              Hace {f.dias_vencida} día
                              {f.dias_vencida !== 1 ? "s" : ""}
                            </span>
                          )}
                        </>
                      }
                      estado={
                        <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                      }
                    />
                  );
                })}
              </TablaFacturas>
            </div>
          ) : (
            <div className="border border-border rounded-xl p-8 bg-background text-center">
              <CheckCircle2
                size={32}
                className="mx-auto text-success"
                aria-hidden
              />
              <p className="mt-3 text-lg font-semibold text-success">
                Estás al día
              </p>
              <p className="mt-1 text-sm text-muted">
                No tienes facturas pendientes de pago.
              </p>
            </div>
          )}

          {/* CU-52: pagos anteriores y su comprobante */}
          <PagosAnteriores />
        </>
      )}
    </div>
  );
}
