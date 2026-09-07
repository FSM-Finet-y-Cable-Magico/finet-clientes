"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  RefreshCw,
  Send,
} from "lucide-react";
import PrimaryButton from "@/app/_components/ui/PrimaryButton";
import { api } from "../../utils/api";
import type { ApiError } from "../../utils/api";
import StatusBadge, { type StatusTone } from "@/app/_components/ui/StatusBadge";

type Ticket = {
  id_ticket: number;
  codigo_seguimiento: string | null;
  estado: string;
  prioridad: string;
  descripcion: string | null;
  fecha_creacion: string;
  fecha_cierre: string | null;
  categoria: string;
  origen: string | null;
};

type TicketsData = {
  total: number;
  tiene_tickets: boolean;
  tickets: Ticket[];
};

type Categoria = {
  id_categoria: number;
  nombre: string;
};

type TicketCreado = {
  id_ticket: number;
  codigo_seguimiento: string;
};

function estadoBadge(estado: string): { label: string; tone: StatusTone } {
  const map: Record<string, { label: string; tone: StatusTone }> = {
    abierto: { label: "Abierto", tone: "info" },
    en_progreso: { label: "En progreso", tone: "warning" },
    cerrado: { label: "Cerrado", tone: "success" },
  };
  return map[estado] ?? { label: estado, tone: "neutral" };
}

function prioridadBadge(prioridad: string): {
  label: string;
  tone: StatusTone;
} {
  const map: Record<string, { label: string; tone: StatusTone }> = {
    alta: { label: "Alta", tone: "error" },
    media: { label: "Media", tone: "warning" },
    baja: { label: "Baja", tone: "success" },
  };
  return map[prioridad] ?? { label: prioridad, tone: "neutral" };
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function TicketsPage() {
  const [data, setData] = useState<TicketsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriasError, setCategoriasError] = useState(false);
  const [categoria, setCategoria] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [erroresFormulario, setErroresFormulario] = useState<{
    categoria?: string;
    descripcion?: string;
  }>({});
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");
  const [ticketCreado, setTicketCreado] = useState<TicketCreado | null>(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const json = await api.get<TicketsData>("/portal/tickets");
      setData(json);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategorias = useCallback(async () => {
    setCategoriasError(false);
    try {
      setCategorias(await api.get<Categoria[]>("/portal/tickets/categorias"));
    } catch {
      setCategoriasError(true);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchTickets();
      void fetchCategorias();
    }, 0);
    return () => clearTimeout(timeout);
  }, [fetchCategorias, fetchTickets]);

  async function enviarSolicitud(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errores: { categoria?: string; descripcion?: string } = {};
    if (!categoria) errores.categoria = "Selecciona una categoría.";
    if (!descripcion.trim()) errores.descripcion = "Describe el problema.";

    setErroresFormulario(errores);
    setErrorEnvio("");
    setTicketCreado(null);
    if (Object.keys(errores).length > 0) return;

    setEnviando(true);
    try {
      const creado = await api.post<TicketCreado>("/portal/tickets", {
        id_categoria: Number(categoria),
        descripcion: descripcion.trim(),
      });
      setTicketCreado(creado);
      setCategoria("");
      setDescripcion("");
      await fetchTickets();
    } catch (caught) {
      const apiError = caught as ApiError;
      setErrorEnvio(
        apiError.status === 503
          ? "No fue posible registrar tu solicitud. Intenta nuevamente más tarde."
          : "No fue posible registrar tu solicitud. Revisa los datos e intenta nuevamente.",
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
          <MessageSquare size={20} aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Tickets de Soporte
          </h1>
          <p className="text-sm text-muted">Historial de tus solicitudes</p>
        </div>
      </div>

      <form
        onSubmit={enviarSolicitud}
        noValidate
        className="mb-8 space-y-4 rounded-xl border border-border bg-background p-5"
      >
        <h2 className="text-base font-semibold text-foreground">
          Nueva solicitud
        </h2>

        {ticketCreado && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-success bg-success-container p-3 text-sm text-on-success-container"
          >
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden />
            <p>
              Solicitud registrada. Código de seguimiento:{" "}
              <strong>{ticketCreado.codigo_seguimiento}</strong>
            </p>
          </div>
        )}

        {(errorEnvio || categoriasError) && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-error bg-error-container p-3 text-sm text-on-error-container"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden />
            <div>
              <p>{errorEnvio || "No se pudieron cargar las categorías."}</p>
              {categoriasError && (
                <button
                  type="button"
                  onClick={fetchCategorias}
                  className="mt-2 inline-flex min-h-8 items-center gap-1.5 font-medium"
                >
                  <RefreshCw size={14} aria-hidden />
                  Reintentar
                </button>
              )}
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor="ticket-categoria"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Categoría
          </label>
          <select
            id="ticket-categoria"
            value={categoria}
            onChange={(event) => {
              setCategoria(event.target.value);
              setErroresFormulario((actual) => ({
                ...actual,
                categoria: undefined,
              }));
            }}
            disabled={categoriasError || categorias.length === 0}
            required
            aria-invalid={Boolean(erroresFormulario.categoria)}
            aria-describedby={
              erroresFormulario.categoria ? "ticket-categoria-error" : undefined
            }
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          >
            <option value="">Selecciona una categoría</option>
            {categorias.map((item) => (
              <option key={item.id_categoria} value={item.id_categoria}>
                {item.nombre}
              </option>
            ))}
          </select>
          {erroresFormulario.categoria && (
            <p
              id="ticket-categoria-error"
              role="alert"
              className="mt-1 text-sm text-error"
            >
              {erroresFormulario.categoria}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="ticket-descripcion"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Describe el problema
          </label>
          <textarea
            id="ticket-descripcion"
            value={descripcion}
            onChange={(event) => {
              setDescripcion(event.target.value);
              setErroresFormulario((actual) => ({
                ...actual,
                descripcion: undefined,
              }));
            }}
            rows={4}
            maxLength={5000}
            required
            aria-invalid={Boolean(erroresFormulario.descripcion)}
            aria-describedby={
              erroresFormulario.descripcion
                ? "ticket-descripcion-error"
                : undefined
            }
            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {erroresFormulario.descripcion && (
            <p
              id="ticket-descripcion-error"
              role="alert"
              className="mt-1 text-sm text-error"
            >
              {erroresFormulario.descripcion}
            </p>
          )}
        </div>

        <PrimaryButton
          type="submit"
          disabled={enviando || categoriasError || categorias.length === 0}
        >
          <Send size={17} aria-hidden />
          {enviando ? "Enviando..." : "Enviar solicitud"}
        </PrimaryButton>
      </form>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="border border-border rounded-xl p-5 bg-background animate-pulse"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="h-4 w-24 rounded bg-border" />
                <div className="h-4 w-16 rounded bg-border" />
                <div className="h-4 w-12 rounded bg-border" />
              </div>
              <div className="h-3 w-32 rounded bg-border mb-2" />
              <div className="h-3 w-64 rounded bg-border" />
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
                No se pudo cargar el historial
              </p>
              <p className="mt-1 text-sm text-on-error-container">
                La información de tickets no está disponible temporalmente.
              </p>
              <button
                type="button"
                onClick={fetchTickets}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-on-error-container hover:brightness-110 transition-[filter]"
              >
                <RefreshCw size={14} aria-hidden />
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {data && !data.tiene_tickets && !loading && (
        <div className="border border-border rounded-xl p-8 bg-background text-center">
          <MessageSquare size={32} className="mx-auto text-muted" aria-hidden />
          <p className="mt-3 text-sm font-medium text-foreground">
            Sin tickets
          </p>
          <p className="mt-1 text-sm text-muted">
            No tienes solicitudes de soporte registradas.
          </p>
        </div>
      )}

      {data && data.tiene_tickets && !loading && (
        <div className="space-y-3">
          {data.tickets.map((t) => {
            const estado = estadoBadge(t.estado);
            const prioridad = prioridadBadge(t.prioridad);
            return (
              <div
                key={t.id_ticket}
                className="border border-border rounded-xl p-5 bg-background"
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-foreground">
                    {t.codigo_seguimiento ?? `Ticket #${t.id_ticket}`}
                  </span>
                  <StatusBadge tone={estado.tone}>{estado.label}</StatusBadge>
                  <StatusBadge tone={prioridad.tone}>
                    {prioridad.label}
                  </StatusBadge>
                </div>
                <p className="text-xs text-muted mb-1">{t.categoria}</p>
                <p className="text-sm text-foreground">
                  {t.descripcion ?? "Sin descripción"}
                </p>
                <p className="mt-2 text-xs text-muted">
                  {formatFecha(t.fecha_creacion)}
                  {t.fecha_cierre &&
                    ` — Cerrado: ${formatFecha(t.fecha_cierre)}`}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
