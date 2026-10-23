"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { resetPasswordSchema } from "../utils/login-schema";
import { api } from "../utils/api";
import type { ApiError } from "../utils/api";
import LoginBranding from "../components/LoginBranding";
import PasswordInput from "../components/PasswordInput";
import { MensajeError } from "./MensajesFormulario";
import { erroresPorCampo, validarCampo } from "../utils/errores-formulario";

type Props = {
  token: string;
};

export default function ResetPasswordForm({ token }: Props) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function validateField(field: string, value: string) {
    const data: Record<string, string> = { password, confirmPassword, [field]: value };
    const error = validarCampo(resetPasswordSchema, data, field);
    setErrors((prev) => ({ ...prev, [field]: error }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");

    const result = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      setErrors(erroresPorCampo(result.error.issues));
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      await api.post<{ message: string }>("/auth/restablecer-password", {
        token,
        password: result.data.password,
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
      <div className="rounded-2xl border border-border bg-background p-8 shadow-sm sm:p-10">
        <LoginBranding />
        <div className="mt-6 flex flex-col items-center text-center">
          <CheckCircle2 size={40} className="text-primary" aria-hidden />
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            Contraseña actualizada
          </h2>
          <p className="mt-2 text-sm text-muted">
            Tu contraseña ha sido restablecida exitosamente.
          </p>
          <Link
            href="/inicio-sesion"
            className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90"
          >
            Ir al inicio de sesión
          </Link>
        </div>
      </div>
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
        <PasswordInput
          value={password}
          error={errors.password}
          onChange={(v) => {
            setPassword(v);
            setErrors((prev) => ({ ...prev, password: "" }));
          }}
          onBlur={() => validateField("password", password)}
        />
        <PasswordInput
          value={confirmPassword}
          error={errors.confirmPassword}
          onChange={(v) => {
            setConfirmPassword(v);
            setErrors((prev) => ({ ...prev, confirmPassword: "" }));
          }}
          onBlur={() => validateField("confirmPassword", confirmPassword)}
        />

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
