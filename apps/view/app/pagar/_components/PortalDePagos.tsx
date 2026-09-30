"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Lock,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { api } from "@/app/utils/api";
import IdentificarCuenta from "./IdentificarCuenta";

export type Identificador = { rut: string } | { abonado: string } | { t: string };

type MedioId = "webpay" | "mercadopago";

type Medio = {
  id: MedioId;
  nombre: string;
  descripcion: string;
  disponible: boolean;
};

type Resumen = {
  encontrado: boolean;
  cliente: {
    nombre: string;
    rut: string | null;
    codigo_abonado: number | null;
  } | null;
  /** Lo da G8. `null` mientras no se pueda obtener. */
  saldo: number | null;
  medios: Medio[];
};

type Estado =
  | { tipo: "cargando" }
  | { tipo: "error" }
  | { tipo: "listo"; resumen: Resumen };

const ICONO_MEDIO: Record<MedioId, typeof CreditCard> = {
  webpay: CreditCard,
  mercadopago: Wallet,
};

function pesos(monto: number) {
  return `$${monto.toLocaleString("es-CL")}`;
}

/**
 * CU-42 / CU-43. El resumen se pide desde el navegador y no desde el servidor
 * de Next: el backend limita los intentos por IP, y desde el servidor todos los
 * clientes compartirían la misma.
 */
export default function PortalDePagos({
  identificador,
}: {
  identificador: Identificador | null;
}) {
  const consulta = identificador
    ? new URLSearchParams(identificador).toString()
    : null;
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });

  const cargar = useCallback(async () => {
    if (!consulta) return;
    setEstado({ tipo: "cargando" });
    try {
      const resumen = await api.get<Resumen>(`/pagos/resumen?${consulta}`);
      setEstado({ tipo: "listo", resumen });
    } catch {
      setEstado({ tipo: "error" });
    }
  }, [consulta]);

  useEffect(() => {
    const t = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(t);
  }, [cargar]);

  return (
    <div className="mx-auto max-w-xl">
      <section className="overflow-hidden rounded-3xl border border-border bg-background shadow-[0_12px_24px_rgba(47,174,201,0.08)]">
        <Encabezado
          resumen={estado.tipo === "listo" ? estado.resumen : null}
          conCuenta={!!identificador}
        />
        {!identificador ? (
          <div className="p-6">
            <p className="mb-5 text-sm text-muted">
              Paga el total de tu deuda con tu RUT o tu código de abonado. No
              necesitas iniciar sesión.
            </p>
            <IdentificarCuenta />
          </div>
        ) : estado.tipo === "cargando" ? (
          <Cargando />
        ) : estado.tipo === "error" ? (
          <Aviso tono="error" titulo="No pudimos cargar tu cuenta">
            <button
              type="button"
              onClick={() => void cargar()}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium underline"
            >
              <RefreshCw size={14} aria-hidden />
              Reintentar
            </button>
          </Aviso>
        ) : (
          <Cuenta resumen={estado.resumen} identificador={identificador} />
        )}
      </section>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted">
        <Lock size={12} aria-hidden />
        El pago se hace en el sitio seguro de Webpay o Mercado Pago.
      </p>
    </div>
  );
}

function Encabezado({
  resumen,
  conCuenta,
}: {
  resumen: Resumen | null;
  conCuenta: boolean;
}) {
  const cliente = resumen?.cliente;
  return (
    <header className="relative overflow-hidden bg-foreground px-6 pb-6 pt-7 text-background">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 h-60 w-60 rounded-full border-[10px] border-primary/20"
      />
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
        Portal de pagos
      </p>
      <h1 className="mt-1 text-2xl font-bold">Paga tu cuenta</h1>
      {cliente ? (
        <div className="mt-3 text-sm text-background/80">
          <p>
            Cuenta de{" "}
            <strong className="font-semibold text-background">
              {cliente.nombre}
            </strong>
          </p>
          <p className="mt-0.5 font-mono text-xs">
            {cliente.rut ? `RUT ${cliente.rut}` : null}
            {cliente.codigo_abonado !== null
              ? ` · Abonado ${cliente.codigo_abonado}`
              : null}
          </p>
        </div>
      ) : null}
      {conCuenta ? (
        <Link
          href="/pagar"
          className="relative mt-4 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          Pagar otra cuenta
        </Link>
      ) : null}
    </header>
  );
}

function Cuenta({
  resumen,
  identificador,
}: {
  resumen: Resumen;
  identificador: Identificador;
}) {
  if (!resumen.encontrado) {
    return (
      <Aviso tono="neutro" titulo="No encontramos una cuenta con esos datos">
        <p className="mt-1">Revisa el RUT o el código de abonado.</p>
      </Aviso>
    );
  }
  // Precondición del CU-42 y del CU-43: "una deuda pendiente identificada".
  if (resumen.saldo === null) {
    return (
      <Aviso tono="alerta" titulo="No pudimos obtener tu deuda en este momento">
        <p className="mt-1">Intenta más tarde.</p>
      </Aviso>
    );
  }
  if (resumen.saldo <= 0) {
    return (
      <div className="p-8 text-center">
        <CheckCircle2 size={36} className="mx-auto text-success" aria-hidden />
        <p className="mt-3 text-lg font-semibold text-success">Estás al día</p>
        <p className="mt-1 text-sm text-muted">No tienes deuda pendiente.</p>
      </div>
    );
  }
  return (
    <Pago
      saldo={resumen.saldo}
      medios={resumen.medios}
      identificador={identificador}
    />
  );
}

function Pago({
  saldo,
  medios,
  identificador,
}: {
  saldo: number;
  medios: Medio[];
  identificador: Identificador;
}) {
  const [medio, setMedio] = useState<MedioId | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState("");

  async function pagar() {
    if (!medio) return;
    setEnviando(true);
    setAviso("");
    try {
      // La respuesta exitosa se define con la pasarela: cómo se va y se vuelve
      // de Webpay o de Mercado Pago depende de cuál se elija.
      await api.post("/pagos/iniciar", { ...identificador, medio });
    } catch (e) {
      // Excepción 1 del CU-42 / CU-43: el medio no está disponible.
      setAviso(
        (e as { message?: string }).message ??
          "No pudimos iniciar el pago. Intenta más tarde.",
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <ol className="divide-y divide-border">
        <li className="p-6">
          <Paso numero={1} titulo="Tu deuda" />
          <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border-2 border-primary bg-surface px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Saldo total
              </p>
              <p className="text-xs text-muted">
                Se paga el total de tu deuda.
              </p>
            </div>
            <p className="text-2xl font-extrabold text-foreground">
              {pesos(saldo)}
            </p>
          </div>
        </li>
        <li className="p-6">
          <fieldset>
            <legend className="contents">
              <Paso numero={2} titulo="Elige un medio de pago" />
            </legend>
            <div className="mt-4 grid gap-3">
              {medios.map((m) => {
                const Icono = ICONO_MEDIO[m.id];
                return (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-4 rounded-2xl border border-border px-4 py-3.5 transition-all hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-surface has-[:checked]:shadow-[0_12px_24px_rgba(47,174,201,0.08)]"
                  >
                    <input
                      type="radio"
                      name="medio"
                      value={m.id}
                      checked={medio === m.id}
                      onChange={() => {
                        setMedio(m.id);
                        setAviso("");
                      }}
                      className="h-4 w-4 accent-primary-bright"
                    />
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-deep text-primary-bright">
                      <Icono size={20} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold text-foreground">
                          {m.nombre}
                        </span>
                        {m.disponible ? null : (
                          <span className="rounded-full bg-warning-container px-2 py-0.5 text-[11px] font-semibold text-on-warning-container">
                            No disponible
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {m.descripcion}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div aria-live="polite">
            {aviso ? (
              <p
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-xl bg-warning-container px-4 py-3 text-sm text-on-warning-container"
              >
                <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden />
                {aviso}
              </p>
            ) : null}
          </div>
        </li>
      </ol>
      <footer className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-border bg-background/95 px-6 py-4 backdrop-blur">
        <div>
          <p className="text-xs text-muted">Total a pagar</p>
          <p className="text-2xl font-extrabold text-foreground">
            {pesos(saldo)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void pagar()}
          disabled={!medio || enviando}
          className="min-w-32 rounded-xl bg-accent px-7 py-3 text-base font-bold text-on-accent shadow-sm transition-all hover:shadow-md hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? "Un momento…" : "Pagar"}
        </button>
      </footer>
    </>
  );
}

function Paso({ numero, titulo }: { numero: number; titulo: string }) {
  return (
    <h2 className="flex items-center gap-3 text-base font-semibold text-foreground">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-bright text-sm font-bold text-background">
        {numero}
      </span>
      {titulo}
    </h2>
  );
}

function Cargando() {
  return (
    <div className="animate-pulse space-y-4 p-6" aria-busy="true">
      <div className="h-4 w-32 rounded bg-border" />
      <div className="h-20 rounded-2xl bg-border" />
      <div className="h-4 w-44 rounded bg-border" />
      <div className="h-16 rounded-2xl bg-border" />
      <span className="sr-only">Cargando tu cuenta…</span>
    </div>
  );
}

const TONO_AVISO = {
  error: "bg-error-container text-on-error-container",
  alerta: "bg-warning-container text-on-warning-container",
  neutro: "bg-surface text-foreground",
} as const;

function Aviso({
  tono,
  titulo,
  children,
}: {
  tono: keyof typeof TONO_AVISO;
  titulo: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="p-6">
      <div className={`flex items-start gap-3 rounded-2xl p-5 text-sm ${TONO_AVISO[tono]}`}>
        <AlertCircle size={20} className="mt-0.5 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">{titulo}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
