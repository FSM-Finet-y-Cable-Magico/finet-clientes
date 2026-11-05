"use client";

import { useState } from "react";
import { api } from "../utils/api";
import type { ApiError } from "../utils/api";
import PasswordInput from "./PasswordInput";
import { MensajeError, MensajeExito } from "./MensajesFormulario";

export default function UpdateEmailForm({
  currentEmail,
  onUpdate,
}: {
  currentEmail: string;
  onUpdate?: (nuevoEmail: string) => void;
}) {
  const [passwordActual, setPasswordActual] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function validateEmail(value: string) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      return "El correo electrónico no tiene un formato válido";
    if (value === currentEmail)
      return "El nuevo correo electrónico no puede ser igual al actual";
    return "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");

    const fieldErrors: Record<string, string> = {};

    if (!passwordActual.trim()) {
      fieldErrors.passwordActual = "La contraseña actual es requerida";
    }

    if (!email.trim()) {
      fieldErrors.email = "El correo electrónico es requerido";
    } else {
      const emailError = validateEmail(email);
      if (emailError) fieldErrors.email = emailError;
    }

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const result = await api.patch<{
        id_cliente: number;
        email: string;
      }>("/auth/perfil/email", {
        password_actual: passwordActual,
        email: email.trim(),
      });

      setDone(true);
      setPasswordActual("");
      setEmail("");
      onUpdate?.(result.email);
    } catch (err) {
      const apiError = err as ApiError;
      setServerError(apiError.message ?? "Error al actualizar el correo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-border rounded-xl bg-background p-6">
      <h2 className="text-lg font-semibold text-foreground mb-1">
        Actualizar Correo Electrónico
      </h2>
      <p className="text-sm text-muted mb-6">
        Ingresa tu contraseña actual y el nuevo correo electrónico
      </p>

      {done && (
        <MensajeExito>Correo electrónico actualizado correctamente.</MensajeExito>
      )}

      {serverError && (
        <MensajeError margen="mb-6">{serverError}</MensajeError>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <PasswordInput
          id="password-actual-email"
          label="Contraseña actual"
          value={passwordActual}
          error={errors.passwordActual}
          onChange={(v) => {
            setPasswordActual(v);
            setErrors((prev) => ({ ...prev, passwordActual: "" }));
            setDone(false);
          }}
        />

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-foreground mb-1"
          >
            Nuevo correo electrónico
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((prev) => ({ ...prev, email: "" }));
              setDone(false);
            }}
            placeholder={currentEmail}
            className={`w-full rounded-lg border px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              errors.email ? "border-error" : "border-border"
            }`}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-error">{errors.email}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-background shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Actualizando..." : "Actualizar correo"}
        </button>
      </form>
    </div>
  );
}
