"use client";

import CampoTexto from "./CampoTexto";
import { formatRut } from "../utils/login-schema";

export default function RutInput({
  value,
  error,
  onChange,
  onBlur,
}: {
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  return (
    <CampoTexto
      id="rut"
      label="RUT"
      type="text"
      // Sin teclado numérico: no trae la K del dígito verificador.
      inputMode="text"
      placeholder="12.345.678-9"
      value={value}
      error={error}
      onChange={(v) => onChange(formatRut(v))}
      onBlur={onBlur}
    />
  );
}
