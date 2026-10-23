"use client";

import CampoTexto from "./CampoTexto";

function formatTelefono(value: string) {
  const cleaned = value.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  if (!cleaned) return "";
  return cleaned.startsWith("+") ? cleaned : "+" + cleaned;
}

export default function TelefonoInput({
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
      id="telefono"
      label="Teléfono"
      type="tel"
      inputMode="numeric"
      placeholder="+56912345678"
      maxLength={12}
      value={value}
      error={error}
      onChange={(v) => onChange(formatTelefono(v))}
      onBlur={onBlur}
    />
  );
}
