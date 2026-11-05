"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../utils/api";
import type { ApiError } from "../utils/api";
import { useAuth } from "../_lib/auth";
import type { Cliente } from "../_lib/auth";
import {
  MENSAJE_POLITICA_REQUERIDA,
  POLITICA_PRIVACIDAD_VERSION,
} from "../_lib/legal";
import LoginBranding from "./LoginBranding";
import { CamposNuevaPassword, useNuevaPassword } from "./CamposNuevaPassword";
import { MensajeError } from "./MensajesFormulario";
import CasillaPoliticaPrivacidad from "../_components/legal/CasillaPoliticaPrivacidad";

/**
 * CU-04, segundo paso: con el enlace del correo, el cliente crea su contraseña
 * (CU-11), acepta la Política de Privacidad (CU-75) y queda con la sesión
 * iniciada, como pide la poscondición del CU-04.
 */
export default function ConfirmarRegistroForm({ token }: { token: string }) {
  const router = useRouter();
  const { login } = useAuth();
  const campos = useNuevaPassword();
  const [aceptaPolitica, setAceptaPolitica] = useState(false);
  const [errorPolitica, setErrorPolitica] = useState("");
  const casillaRef = useRef<HTMLInputElement>(null);
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError("");

    const password = campos.validar();
    setErrorPolitica(aceptaPolitica ? "" : MENSAJE_POLITICA_REQUERIDA);
    if (password === null) return;
    // CU-75, Excepción 1: sin la casilla no se envía nada.
    if (!aceptaPolitica) {
      casillaRef.current?.focus();
      return;
    }

    setLoading(true);

    try {
      const data = await api.post<{ access_token: string; cliente: Cliente }>(
        "/auth/registro/confirmar",
        {
          token,
          password,
          password_confirmation: password,
          acepta_politica_privacidad: true,
          version_politica_privacidad: POLITICA_PRIVACIDAD_VERSION,
        },
      );
      login(data.cliente);
      router.push("/portal");
    } catch (err) {
      const apiError = err as ApiError;
      setServerError(apiError.message ?? "Error al crear la cuenta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-background p-8 shadow-sm sm:p-10">
      <LoginBranding subtitle="Crea tu cuenta" />

      <div className="text-center">
        <h2 className="text-lg font-semibold text-foreground">
          Crea tu contraseña
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          Con ella vas a ingresar al portal junto con tu RUT
        </p>
      </div>

      {serverError && (
        <MensajeError margen="mt-5">{serverError}</MensajeError>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-5" noValidate>
        <CamposNuevaPassword campos={campos} />

        <CasillaPoliticaPrivacidad
          ref={casillaRef}
          checked={aceptaPolitica}
          error={errorPolitica}
          onChange={(marcada) => {
            setAceptaPolitica(marcada);
            if (marcada) setErrorPolitica("");
          }}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-background shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>
    </div>
  );
}
