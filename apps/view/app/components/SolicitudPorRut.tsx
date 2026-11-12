"use client";

import { useState } from "react";
import { cleanRut, recoverySchema } from "../utils/login-schema";
import { api } from "../utils/api";
import type { ApiError } from "../utils/api";
import RutInput from "./RutInput";
import { MensajeError } from "./MensajesFormulario";
import { errorDeCampo, validarCampo } from "../utils/errores-formulario";
import { useMarca } from "../_lib/marca";

/**
 * El RUT con su validación y su envío. Lo piden la recuperación de contraseña
 * (CU-03) y el registro (CU-04); cada uno decide qué hacer con la respuesta.
 */
export default function SolicitudPorRut<T>({
  endpoint,
  textoBoton,
  textoEnviando,
  errorPorDefecto,
  onRespuesta,
}: {
  endpoint: string;
  textoBoton: string;
  textoEnviando: string;
  errorPorDefecto: string;
  onRespuesta: (respuesta: T) => void;
}) {
  const marca = useMarca();
  const [rut, setRut] = useState("");
  const [error, setError] = useState("");
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  function validateField(value: string) {
    setError(validarCampo(recoverySchema, { rut: value }, "rut"));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");

    const result = recoverySchema.safeParse({ rut });
    if (!result.success) {
      setError(errorDeCampo(result.error.issues, "rut") || "RUT inválido");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const respuesta = await api.post<T>(endpoint, {
        rut: cleanRut(result.data.rut),
        // El RUT se busca entre los clientes de la empresa de este sitio: la
        // misma persona puede ser cliente de las dos.
        id_empresa: marca.idEmpresa,
      });
      onRespuesta(respuesta);
    } catch (err) {
      const apiError = err as ApiError;
      setServerError(apiError.message ?? errorPorDefecto);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {serverError && (
        <MensajeError margen="mt-5">{serverError}</MensajeError>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-5" noValidate>
        <RutInput
          value={rut}
          error={error}
          onChange={(v) => {
            setRut(v);
            setError("");
          }}
          onBlur={() => validateField(rut)}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-background shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? textoEnviando : textoBoton}
        </button>
      </form>
    </>
  );
}
