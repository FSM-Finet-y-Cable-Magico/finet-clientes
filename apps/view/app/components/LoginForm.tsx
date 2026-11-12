"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { loginSchema } from "../utils/login-schema";
import { cleanRut } from "../utils/login-schema";
import { api } from "../utils/api";
import type { ApiError } from "../utils/api";
import { useAuth } from "../_lib/auth";
import type { Cliente } from "../_lib/auth";
import { securityLogger } from "../_lib/logger";
import LoginBranding from "./LoginBranding";
import RutInput from "./RutInput";
import PasswordInput from "./PasswordInput";
import { MensajeError } from "./MensajesFormulario";
import { erroresPorCampo, validarCampo } from "../utils/errores-formulario";
import { useMarca } from "../_lib/marca";
import { marcaPorEmpresa, rutaMarca, urlMarca, type Marca } from "../_lib/company";
import { destinoInterno } from "../_lib/enrutar-marca";

export default function LoginForm() {
  const marca = useMarca();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const expired = searchParams.get("expired") === "1";
  const { login, logout, isAuthenticated, isLoading } = useAuth();
  // La empresa del cliente, si su sitio está en otro host.
  const [otroSitio, setOtroSitio] = useState<Marca | null>(null);
  const [rut, setRut] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/portal");
    }
  }, [isAuthenticated, isLoading, router]);

  function validateField(field: string, value: string) {
    const error = validarCampo(loginSchema, { rut, password, [field]: value }, field);
    setErrors((prev) => ({ ...prev, [field]: error }));
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError("");
    setOtroSitio(null);

    const result = loginSchema.safeParse({ rut, password });
    if (!result.success) {
      setErrors(erroresPorCampo(result.error.issues));
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const data = await api.post<{ access_token: string; cliente: Cliente }>(
        "/auth/login",
        { rut: cleanRut(result.data.rut), password: result.data.password }
      );
      // Con un host por empresa, la sesión queda en el host donde se inicia:
      // un cliente de la otra empresa tiene que entrar en su sitio (proxy.ts
      // no le daría sesión aquí). Se cierra y se le muestra a dónde ir.
      const suya = marcaPorEmpresa(data.cliente.id_empresa);
      if (suya.url !== marca.url) {
        await logout();
        setOtroSitio(suya);
        return;
      }
      login(data.cliente);
      // Solo a una página del portal; por defecto, el de su empresa.
      router.push(destinoInterno(redirect, rutaMarca(marca, "/portal")));
    } catch (err) {
      const error = err as ApiError;
      securityLogger.loginFailed(result.data.rut, error.message ?? "Error desconocido");
      setServerError(error.message ?? "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-background p-8 shadow-sm sm:p-10">
      <LoginBranding />

      {expired && (
        <div className="mb-5 rounded-lg border border-warning/20 bg-warning-container px-4 py-3 text-sm text-on-warning-container">
          Tu sesión fue cerrada por inactividad. Ingresa nuevamente.
        </div>
      )}

      {serverError && (
        <MensajeError margen="mb-5">{serverError}</MensajeError>
      )}

      {otroSitio && (
        <MensajeError margen="mb-5">
          Tu cuenta es de {otroSitio.nombre}.{" "}
          <a
            href={urlMarca(otroSitio, "/inicio-sesion")}
            className="font-semibold underline"
          >
            Ingresa desde su sitio
          </a>
          .
        </MensajeError>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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

        <div className="flex items-center justify-between text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-muted">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border text-primary outline-none focus:ring-2 focus:ring-primary/30"
            />
            Recordarme
          </label>
          <Link
            href={rutaMarca(marca, "/recuperar-password")}
            className="text-primary transition-colors hover:opacity-80"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-background shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-muted">
        Al ingresar aceptas nuestros{" "}
        <Link
          href={rutaMarca(marca, "/terminos")}
          className="text-primary underline hover:opacity-80"
        >
          Términos y Condiciones
        </Link>
      </p>
    </div>
  );
}
