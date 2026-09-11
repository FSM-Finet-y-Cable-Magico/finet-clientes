"use client";

import { useId, useState, useTransition } from "react";
import { Wifi, CheckCircle2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { changeWifiPassword } from "@/app/portal/_lib/portal-actions";

// CU-31, su Excepcion 2 y RF-24 dicen "unicamente alfanumericos". Se decidio
// permitir simbolos igual (pedido de Dani, confirmado por Emilio) — diverge
// del CU escrito, ver docs/CAMBIOS-PARA-EQUIPO-DOCUMENTACION.md. Se mantienen
// prohibidos los espacios en blanco.
const WIFI_REGEX = /^\S+$/;
const MIN_LEN = 8;
const MAX_LEN = 63;

export type ContratoWifi = {
  id_contrato: number;
  estado: string;
  plan: { nombre_comercial: string } | null;
};

// CU-31: valida el formato y devuelve el motivo cuando no se cumple.
function validarClave(valor: string): string {
  if (!valor) return "Ingresa la nueva contraseña"; // CU-31 Excepcion 1
  if (valor.length < MIN_LEN) return `Mínimo ${MIN_LEN} caracteres`;
  if (valor.length > MAX_LEN) return `Máximo ${MAX_LEN} caracteres`;
  if (!WIFI_REGEX.test(valor)) {
    return "No se permiten espacios en blanco";
  }
  return "";
}

type Props = {
  /** Contratos del cliente. Solo los activos pueden pedir el cambio (CU-32 Excepcion 2). */
  contratos: ContratoWifi[];
};

export default function WifiPasswordSection({ contratos }: Props) {
  const activos = contratos.filter((c) => c.estado === "activo");

  const selectId = useId();
  const claveId = useId();
  const confirmacionId = useId();
  const errorClaveId = useId();
  const errorConfirmacionId = useId();

  const [idContrato, setIdContrato] = useState<number | null>(
    activos.length === 1 ? activos[0].id_contrato : null,
  );
  const [clave, setClave] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [errorClave, setErrorClave] = useState("");
  const [errorConfirmacion, setErrorConfirmacion] = useState("");
  const [errorEnvio, setErrorEnvio] = useState("");
  const [enviada, setEnviada] = useState(false);
  const [isPending, startTransition] = useTransition();

  // CU-32 Excepcion 2: sin un servicio activo no se puede crear la solicitud.
  if (activos.length === 0) {
    return (
      <section
        aria-labelledby={`${selectId}-titulo`}
        className="border border-border rounded-xl p-6 bg-background"
      >
        <div className="flex items-center gap-2">
          <Wifi size={18} className="text-primary shrink-0" aria-hidden />
          <h2
            id={`${selectId}-titulo`}
            className="text-sm font-semibold text-foreground"
          >
            Cambiar contraseña WiFi
          </h2>
        </div>
        <p className="mt-3 text-sm text-muted">
          Solo puedes solicitar el cambio de clave cuando tienes un servicio
          activo. Si tu servicio está suspendido, regulariza tu situación para
          habilitar esta opción.
        </p>
      </section>
    );
  }

  const reiniciar = () => {
    setEnviada(false);
    setClave("");
    setConfirmacion("");
    setErrorClave("");
    setErrorConfirmacion("");
    setErrorEnvio("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorEnvio("");

    const errClave = validarClave(clave);
    const errConfirmacion =
      confirmacion !== clave ? "Las contraseñas no coinciden" : "";

    setErrorClave(errClave);
    setErrorConfirmacion(errConfirmacion);
    if (errClave || errConfirmacion) return;

    if (idContrato === null) {
      setErrorEnvio("Selecciona el servicio al que aplicar el cambio");
      return;
    }

    startTransition(async () => {
      const res = await changeWifiPassword(idContrato, clave);
      if (res.success) {
        setEnviada(true);
        setClave("");
        setConfirmacion("");
      } else {
        setErrorEnvio(res.error ?? "No se pudo registrar la solicitud");
      }
    });
  };

  // CU-32 poscondicion: el cliente recibe confirmacion de que la solicitud fue
  // creada. Ojo con el texto: la clave todavia NO cambio, la aplica el equipo
  // tecnico despues (CU-33).
  if (enviada) {
    return (
      <section className="border border-border rounded-xl p-6 bg-background">
        <div className="flex items-start gap-3" role="status">
          <CheckCircle2 size={20} className="text-success shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Solicitud registrada
            </p>
            <p className="mt-1 text-sm text-muted">
              Dejamos tu solicitud de cambio de clave WiFi en curso. Nuestro
              equipo técnico la aplicará en tu equipo y te avisaremos cuando el
              cambio esté listo.
            </p>
            <button
              type="button"
              onClick={reiniciar}
              className="mt-3 text-sm font-medium text-primary underline underline-offset-2"
            >
              Solicitar otro cambio
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={`${selectId}-titulo`}
      className="border border-border rounded-xl p-6 bg-background"
    >
      <div className="flex items-center gap-2 mb-1">
        <Wifi size={18} className="text-primary shrink-0" aria-hidden />
        <h2
          id={`${selectId}-titulo`}
          className="text-sm font-semibold text-foreground"
        >
          Cambiar contraseña WiFi
        </h2>
      </div>
      <p className="text-sm text-muted mb-4">
        Registra tu solicitud y nuestro equipo aplicará la nueva clave en tu
        equipo.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {activos.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={selectId}
              className="text-xs font-medium text-foreground"
            >
              Servicio
            </label>
            <select
              id={selectId}
              value={idContrato ?? ""}
              onChange={(e) =>
                setIdContrato(e.target.value ? Number(e.target.value) : null)
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">Selecciona un servicio</option>
              {activos.map((c) => (
                <option key={c.id_contrato} value={c.id_contrato}>
                  Abonado #{c.id_contrato}
                  {c.plan ? ` — ${c.plan.nombre_comercial}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={claveId}
            className="text-xs font-medium text-foreground"
          >
            Nueva contraseña{" "}
            <span className="text-muted">
              (entre {MIN_LEN} y {MAX_LEN} caracteres, sin espacios)
            </span>
          </label>
          <div className="relative">
            <input
              id={claveId}
              type={verClave ? "text" : "password"}
              value={clave}
              onChange={(e) => {
                setClave(e.target.value);
                if (errorClave) setErrorClave(validarClave(e.target.value));
              }}
              placeholder="Ej: MiRed2026"
              autoComplete="new-password"
              aria-invalid={errorClave ? true : undefined}
              aria-describedby={errorClave ? errorClaveId : undefined}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-11 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <button
              type="button"
              onClick={() => setVerClave((v) => !v)}
              aria-label={
                verClave ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
            >
              {verClave ? (
                <EyeOff size={16} aria-hidden />
              ) : (
                <Eye size={16} aria-hidden />
              )}
            </button>
          </div>
          {errorClave && (
            <p
              id={errorClaveId}
              role="alert"
              className="flex items-center gap-1.5 text-xs text-error"
            >
              <AlertCircle size={13} className="shrink-0" aria-hidden />
              {errorClave}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={confirmacionId}
            className="text-xs font-medium text-foreground"
          >
            Repite la nueva contraseña
          </label>
          <input
            id={confirmacionId}
            type={verClave ? "text" : "password"}
            value={confirmacion}
            onChange={(e) => {
              setConfirmacion(e.target.value);
              if (errorConfirmacion) setErrorConfirmacion("");
            }}
            autoComplete="new-password"
            aria-invalid={errorConfirmacion ? true : undefined}
            aria-describedby={
              errorConfirmacion ? errorConfirmacionId : undefined
            }
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          {errorConfirmacion && (
            <p
              id={errorConfirmacionId}
              role="alert"
              className="flex items-center gap-1.5 text-xs text-error"
            >
              <AlertCircle size={13} className="shrink-0" aria-hidden />
              {errorConfirmacion}
            </p>
          )}
        </div>

        {errorEnvio && (
          <p
            role="alert"
            className="flex items-center gap-1.5 text-sm text-error"
          >
            <AlertCircle size={15} className="shrink-0" aria-hidden />
            {errorEnvio}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Registrando solicitud..." : "Solicitar cambio"}
        </button>
      </form>
    </section>
  );
}
