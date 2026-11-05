"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { api } from "../utils/api";
import type { ApiError } from "../utils/api";
import LoginBranding from "../components/LoginBranding";
import PanelAviso from "./PanelAviso";
import { CamposNuevaPassword, useNuevaPassword } from "./CamposNuevaPassword";
import { MensajeError } from "./MensajesFormulario";

type Props = {
  token: string;
};

export default function ResetPasswordForm({ token }: Props) {
  const campos = useNuevaPassword();
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");

    const password = campos.validar();
    if (password === null) return;

    setLoading(true);

    try {
      await api.post<{ message: string }>("/auth/restablecer-password", {
        token,
        password,
      });
      setDone(true);
    } catch (err) {
      const apiError = err as ApiError;
      setServerError(apiError.message ?? "Error al restablecer la contraseña");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <PanelAviso
        icono={<CheckCircle2 size={40} className="text-primary" aria-hidden />}
        titulo="Contraseña actualizada"
      >
        <p className="mt-2 text-sm text-muted">
          Tu contraseña ha sido restablecida exitosamente.
        </p>
        <Link
          href="/inicio-sesion"
          className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90"
        >
          Ir al inicio de sesión
        </Link>
      </PanelAviso>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-background p-8 shadow-sm sm:p-10">
      <LoginBranding />

      <div className="mt-6 text-center">
        <h2 className="text-lg font-semibold text-foreground">
          Nueva contraseña
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          Ingresa tu nueva contraseña
        </p>
      </div>

      {serverError && (
        <MensajeError margen="mt-5">{serverError}</MensajeError>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-5" noValidate>
        <CamposNuevaPassword campos={campos} />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-background shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Cambiando..." : "Cambiar contraseña"}
        </button>
      </form>

      <p className="mt-6 text-center">
        <Link
          href="/inicio-sesion"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden />
          Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}
