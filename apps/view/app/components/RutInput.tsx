"use client";

import CampoTexto from "./CampoTexto";

function formatRut(value: string) {
  const digits = value.replace(/[^\dkK]/g, "").slice(0, 10);
  if (digits.length <= 1) return digits;
  const body = digits.slice(0, -1);
  const dv = digits.slice(-1);
  const dotted = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${dotted}-${dv}`;
}

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
      inputMode="numeric"
      placeholder="12.345.678-9"
      value={value}
      error={error}
      onChange={(v) => onChange(formatRut(v))}
      onBlur={onBlur}
    />
  );
}
