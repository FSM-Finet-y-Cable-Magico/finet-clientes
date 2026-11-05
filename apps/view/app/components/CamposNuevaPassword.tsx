"use client";

import { useState } from "react";
import { resetPasswordSchema } from "../utils/login-schema";
import PasswordInput from "./PasswordInput";
import { erroresPorCampo, validarCampo } from "../utils/errores-formulario";

type Campo = "password" | "confirmPassword";

/**
 * La contraseña nueva y su confirmación: RF-09 y CU-11 (8 caracteres, una
 * mayúscula y un número) y que coincidan. Las piden restablecer la contraseña
 * (CU-03) y crear la cuenta (CU-04, Excepción 3).
 */
export function useNuevaPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function cambiar(campo: Campo, valor: string) {
    if (campo === "password") setPassword(valor);
    else setConfirmPassword(valor);
    setErrors((prev) => ({ ...prev, [campo]: "" }));
  }

  function validateField(campo: Campo, valor: string) {
    const data: Record<string, string> = { password, confirmPassword, [campo]: valor };
    const error = validarCampo(resetPasswordSchema, data, campo);
    setErrors((prev) => ({ ...prev, [campo]: error }));
  }

  /** Valida las dos. Si están bien devuelve la contraseña; si no, `null`. */
  function validar(): string | null {
    const result = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      setErrors(erroresPorCampo(result.error.issues));
      return null;
    }
    setErrors({});
    return result.data.password;
  }

  return { password, confirmPassword, errors, cambiar, validateField, validar };
}

export function CamposNuevaPassword({
  campos,
}: {
  campos: ReturnType<typeof useNuevaPassword>;
}) {
  return (
    <>
      <PasswordInput
        value={campos.password}
        error={campos.errors.password}
        onChange={(v) => campos.cambiar("password", v)}
        onBlur={() => campos.validateField("password", campos.password)}
      />
      <PasswordInput
        id="confirmPassword"
        label="Confirmar contraseña"
        value={campos.confirmPassword}
        error={campos.errors.confirmPassword}
        onChange={(v) => campos.cambiar("confirmPassword", v)}
        onBlur={() =>
          campos.validateField("confirmPassword", campos.confirmPassword)
        }
      />
    </>
  );
}
