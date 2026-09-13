"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { registerSchema } from "../utils/login-schema";
import { cleanRut } from "../utils/login-schema";
import { cleanTelefono } from "../utils/login-schema";
import { api } from "../utils/api";
import type { ApiError } from "../utils/api";
import { useAuth } from "../_lib/auth";
import type { Cliente } from "../_lib/auth";
import LoginBranding from "./LoginBranding";
import RutInput from "./RutInput";
import PasswordInput from "./PasswordInput";
import TelefonoInput from "./TelefonoInput";

export default function RegisterForm() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [rut, setRut] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/portal");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || isAuthenticated) return null;

  function validateField(field: string, value: string) {
    const current = {
      nombreCompleto,
      email,
      telefono,
      rut,
      password,
      confirmPassword,
      [field]: value,
    };
    const result = registerSchema.safeParse(current);
    if (!result.success) {
      const fieldError = result.error.issues.find(
        (i) =>
          i.path[0] === field ||
          (field === "confirmPassword" && i.path[0] === "confirmPassword"),
      );
      setErrors((prev) => ({
        ...prev,
        [field]: fieldError?.message ?? "",
      }));
    } else {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError("");

    const result = registerSchema.safeParse({
      nombreCompleto,
      email,
      telefono,
      rut,
      password,
      confirmPassword,
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const data = await api.post<{ access_token: string; cliente: Cliente }>(
        "/auth/register",
        {
          rut: cleanRut(result.data.rut),
          nombre_completo: result.data.nombreCompleto,
          email: result.data.email,
          telefono: result.data.telefono
            ? cleanTelefono(result.data.telefono)
            : "",
          password: result.data.password,
          password_confirmation: result.data.password,
        },
      );
      login(data.cliente);
      router.push("/portal");
    } catch (err) {
      const error = err as ApiError;
      setServerError(error.message ?? "Error al registrarse");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors duration-200";

  return (
    <div className="rounded-2xl border border-border bg-background p-8 shadow-sm sm:p-10">
      <LoginBranding subtitle="Crea tu cuenta" />

      {serverError && (
        <div className="mb-5 rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm text-error">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="nombreCompleto"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Nombre completo
          </label>
          <input
            id="nombreCompleto"
            type="text"
            placeholder="Tu nombre completo"
            value={nombreCompleto}
            onChange={(e) => {
              setNombreCompleto(e.target.value);
              setErrors((prev) => ({ ...prev, nombreCompleto: "" }));
            }}
            onBlur={() => validateField("nombreCompleto", nombreCompleto)}
            data-error={!!errors.nombreCompleto}
            className={`${inputClass}
              data-[error=false]:border-border data-[error=false]:bg-background data-[error=false]:text-foreground data-[error=false]:placeholder:text-muted data-[error=false]:focus-visible:outline data-[error=false]:focus-visible:outline-2 data-[error=false]:focus-visible:outline-offset-0 data-[error=false]:focus-visible:outline-primary
              border-error bg-error-container text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-error`}
          />
          {errors.nombreCompleto && (
            <p className="mt-1 text-xs text-error">{errors.nombreCompleto}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="correo@ejemplo.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((prev) => ({ ...prev, email: "" }));
            }}
            onBlur={() => validateField("email", email)}
            data-error={!!errors.email}
            className={`${inputClass}
              data-[error=false]:border-border data-[error=false]:bg-background data-[error=false]:text-foreground data-[error=false]:placeholder:text-muted data-[error=false]:focus-visible:outline data-[error=false]:focus-visible:outline-2 data-[error=false]:focus-visible:outline-offset-0 data-[error=false]:focus-visible:outline-primary
              border-error bg-error-container text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-error`}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-error">{errors.email}</p>
          )}
        </div>

        <TelefonoInput
          value={telefono}
          error={errors.telefono}
          onChange={(v) => {
            setTelefono(v);
            setErrors((prev) => ({ ...prev, telefono: "" }));
          }}
          onBlur={() => validateField("telefono", telefono)}
        />

        <RutInput
          value={rut}
          error={errors.rut}
          onChange={(v) => {
            setRut(v);
            setErrors((prev) => ({ ...prev, rut: "" }));
          }}
          onBlur={() => validateField("rut", rut)}
        />

        <PasswordInput
          value={password}
          error={errors.password}
          onChange={(v) => {
            setPassword(v);
            setErrors((prev) => ({ ...prev, password: "" }));
          }}
          onBlur={() => validateField("password", password)}
        />

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Confirmar Contraseña
          </label>
          <PasswordInput
            id="confirmPassword"
            value={confirmPassword}
            error={errors.confirmPassword}
            onChange={(v) => {
              setConfirmPassword(v);
              setErrors((prev) => ({ ...prev, confirmPassword: "" }));
            }}
            onBlur={() => validateField("confirmPassword", confirmPassword)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-background shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Registrando..." : "Registrarse"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-muted">
        Al registrarte aceptas nuestros{" "}
        <a
          href="/terminos"
          className="text-primary underline hover:opacity-80"
        >
          Términos y Condiciones
        </a>
      </p>
    </div>
  );
}
