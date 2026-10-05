"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  AlertCircle,
  CheckCircle2,
  FileText,
  Zap,
  CreditCard,
} from "lucide-react";
import { cleanRut } from "../utils/login-schema";
import { recoverySchema } from "../utils/login-schema";
import RutInput from "../components/RutInput";

type Factura = {
  id_factura: number;
  periodo: string;
  monto: number;
  fecha_limite_pago: string;
  estado: string;
  dias_vencida: number | null;
  dias_para_vencer: number | null;
};

type Plan = {
  nombre_comercial: string;
  tipo_plan: string;
  velocidad_mbps: number | null;
  precio_mensual: number;
};

type DeudaData = {
  encontrado: boolean;
  cliente: {
    nombre_completo: string;
    rut: string;
    codigo_abonado: number;
  } | null;
  tiene_deuda: boolean;
  saldo_total: number;
  facturas: Factura[];
  // Detalle del/los plan(es) contratado(s)
  planes: Plan[];
  // CU-41 Exc 1: false si no fue posible obtener el detalle de facturación
  detalle_disponible: boolean;
  // CU-41 Exc 2: false si hay montos o fechas inconsistentes
  informacion_completa: boolean;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

function formatPrecio(precio: number) {
  return `$${precio.toLocaleString("es-CL")}`;
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
  });
}

export default function DeudaLookupForm() {
  const [modo, setModo] = useState<"rut" | "abonado">("rut");
  const [rut, setRut] = useState("");
  const [rutError, setRutError] = useState("");
  const [codigo, setCodigo] = useState("");
  const [codigoError, setCodigoError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DeudaData | null>(null);

  function validateRut(value: string) {
    const r = recoverySchema.safeParse({ rut: value });
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path[0] === "rut");
      setRutError(issue?.message ?? "");
    } else {
      setRutError("");
    }
  }

  function validateCodigo(value: string) {
    if (!value || value.trim() === "") {
      setCodigoError("El código de abonado es obligatorio");
    } else {
      setCodigoError("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);

    if (modo === "rut") {
      const r = recoverySchema.safeParse({ rut });
      if (!r.success) {
        const issue = r.error.issues.find((i) => i.path[0] === "rut");
        setRutError(issue?.message ?? "RUT inválido");
        return;
      }
      setRutError("");
    } else {
      if (!codigo || codigo.trim() === "") {
        setCodigoError("El código de abonado es obligatorio");
        return;
      }
      setCodigoError("");
    }

    setLoading(true);

    const endpoint =
      modo === "rut"
        ? `${API_URL}/deuda-publica/rut?rut=${encodeURIComponent(cleanRut(rut))}`
        : `${API_URL}/deuda-publica/abonado?codigo_abonado=${encodeURIComponent(codigo.trim())}`;

    try {
      const res = await fetch(endpoint, { credentials: "include" });

      if (!res.ok) throw res;

      const data: DeudaData = await res.json();
      setResult(data);
    } catch {
      setError("No se pudo consultar la deuda. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  function resetAll() {
    setResult(null);
    setError("");
    if (modo === "rut") {
      setRut("");
      setRutError("");
    } else {
      setCodigo("");
      setCodigoError("");
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
          <Search size={20} aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Consultar Deuda
          </h1>
          <p className="text-sm text-muted">
            Verifica deudas pendientes sin necesidad de iniciar sesión
          </p>
        </div>
      </div>

      {/* Toggle RUT / Abonado */}
      <div className="flex w-full rounded-lg bg-border p-1 mb-6">
        <button
          type="button"
          onClick={() => {
            setModo("rut");
            resetAll();
          }}
          className={`flex-1 cursor-pointer rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 ${
            modo === "rut"
              ? "bg-primary text-background shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          Por RUT
        </button>
        <button
          type="button"
          onClick={() => {
            setModo("abonado");
            resetAll();
          }}
          className={`flex-1 cursor-pointer rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 ${
            modo === "abonado"
              ? "bg-primary text-background shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          Por Código Abonado
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="border border-border rounded-xl p-6 bg-background mb-6"
        noValidate
      >
        <div className="flex gap-3 items-start">
          <div className="flex-1">
            {modo === "rut" ? (
              <RutInput
                value={rut}
                error={rutError}
                onChange={(v) => {
                  setRut(v);
                  setRutError("");
                  setResult(null);
                }}
                onBlur={() => validateRut(rut)}
              />
            ) : (
              <div>
                <label
                  htmlFor="codigoAbonado"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Código de Abonado
                </label>
                <input
                  id="codigoAbonado"
                  type="text"
                  inputMode="numeric"
                  placeholder="100"
                  value={codigo}
                  onChange={(e) => {
                    setCodigo(e.target.value.replace(/\D/g, ""));
                    setCodigoError("");
                    setResult(null);
                  }}
                  onBlur={() => validateCodigo(codigo)}
                  data-error={!!codigoError}
                  className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors duration-200
                    data-[error=false]:border-border data-[error=false]:bg-background data-[error=false]:text-foreground data-[error=false]:placeholder:text-muted data-[error=false]:focus-visible:outline data-[error=false]:focus-visible:outline-2 data-[error=false]:focus-visible:outline-offset-0 data-[error=false]:focus-visible:outline-primary
                    border-error bg-error-container text-foreground focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-error`}
                />
                {codigoError && (
                  <p className="mt-1 text-xs text-error">{codigoError}</p>
                )}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-7 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-background shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
          >
            {loading ? "Consultando..." : "Consultar"}
          </button>
        </div>
      </form>

      {error && (
        <div className="border border-error/20 bg-error-container rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-error mt-0.5 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-medium text-error">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* CU-41 Excepción 1: no fue posible obtener el detalle de facturación */}
      {result && result.encontrado && !result.detalle_disponible && (
        <div className="border border-warning/20 bg-warning-container rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle
              size={20}
              className="text-on-warning-container mt-0.5 shrink-0"
              aria-hidden
            />
            <p className="text-sm font-medium text-on-warning-container">
              No fue posible obtener el detalle de facturación. Intenta nuevamente más tarde.
            </p>
          </div>
        </div>
      )}

      {result && result.encontrado && result.detalle_disponible && (
        <div className="border border-border rounded-xl bg-background divide-y divide-border">
          {/* CU-41 Excepción 2: información incompleta por inconsistencia de datos */}
          {!result.informacion_completa && (
            <div className="p-6">
              <div className="flex items-start gap-3">
                <AlertCircle
                  size={20}
                  className="text-on-warning-container mt-0.5 shrink-0"
                  aria-hidden
                />
                <p className="text-sm font-medium text-on-warning-container">
                  La información de tu deuda está incompleta. Contáctanos para regularizar tu situación.
                </p>
              </div>
            </div>
          )}

          <div className="p-6">
            <div className="flex items-start gap-2">
              <CheckCircle2 size={18} className="text-success mt-0.5 shrink-0" aria-hidden />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {result.cliente!.nombre_completo}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  RUT {result.cliente!.rut} — Abonado {result.cliente!.codigo_abonado}
                </p>
              </div>
            </div>

            {result.tiene_deuda ? (
              <>
                <p className="mt-4 text-3xl font-extrabold text-error">
                  {formatPrecio(result.saldo_total)}
                </p>
                <p className="text-sm text-muted mt-1">
                  Saldo pendiente
                </p>
                <Link
                  href={
                    modo === "rut"
                      ? `/pagar?rut=${encodeURIComponent(cleanRut(rut))}`
                      : `/pagar?abonado=${encodeURIComponent(codigo.trim())}`
                  }
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-on-accent shadow-sm transition-all hover:shadow-md hover:brightness-105 active:scale-[0.98]"
                >
                  <CreditCard size={16} aria-hidden />
                  Pagar ahora
                </Link>
              </>
            ) : (
              <p className="mt-4 text-lg font-semibold text-success">
                Sin deudas pendientes
              </p>
            )}
          </div>

          {/* Detalle del/los plan(es) contratado(s) */}
          {result.planes.length > 0 && (
            <div className="p-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {result.planes.length > 1 ? "Planes contratados" : "Plan contratado"}
              </h3>
              <div className="grid gap-3">
                {result.planes.map((plan) => (
                  <div
                    key={plan.nombre_comercial}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border p-4"
                  >
                    <div>
                      <p className="font-semibold text-foreground">
                        {plan.nombre_comercial}
                      </p>
                      {plan.velocidad_mbps != null && (
                        <div className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                          <Zap size={14} aria-hidden />
                          <span>{plan.velocidad_mbps} Mbps</span>
                        </div>
                      )}
                    </div>
                    <p className="whitespace-nowrap text-lg font-bold text-foreground">
                      {formatPrecio(plan.precio_mensual)}
                      <span className="text-xs font-normal text-muted">/mes</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.tiene_deuda && result.facturas.length > 0 && (
            <div className="p-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Detalle de facturas
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted border-b border-border">
                      <th className="pb-2 font-medium">Periodo</th>
                      <th className="pb-2 font-medium">Monto</th>
                      <th className="pb-2 font-medium">Vence</th>
                      <th className="pb-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {result.facturas.map((f) => (
                      <tr key={f.id_factura}>
                        <td className="py-2 text-foreground">{f.periodo}</td>
                        <td className="py-2 text-foreground">
                          {formatPrecio(f.monto)}
                        </td>
                        <td className="py-2 text-muted">
                          {formatFecha(f.fecha_limite_pago)}
                        </td>
                        <td className="py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${
                              f.estado === "vencida"
                                ? "bg-error-container text-error border-error"
                                : "bg-warning-container text-on-warning-container border-warning"
                            }`}
                          >
                            {f.estado === "vencida" ? "Vencida" : "Pendiente"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {result && !result.encontrado && (
        <div className="border border-border rounded-xl p-8 bg-background text-center">
          <FileText size={32} className="mx-auto text-muted" aria-hidden />
          <p className="mt-3 text-sm font-medium text-foreground">
            No se encontraron coincidencias
          </p>
          <p className="mt-1 text-sm text-muted">
            {modo === "rut"
              ? "No existe un cliente asociado al RUT ingresado."
              : "No existe un cliente asociado al código de abonado ingresado."}
          </p>
        </div>
      )}
    </div>
  );
}
