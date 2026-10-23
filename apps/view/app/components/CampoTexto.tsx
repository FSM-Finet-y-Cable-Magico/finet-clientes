"use client";

import type { InputHTMLAttributes } from "react";

/**
 * Un campo de texto con su etiqueta y su error, con el estilo de los
 * formularios de acceso. Lo usan `RutInput` y `TelefonoInput`, que agregan el
 * formato mientras se escribe.
 */
export default function CampoTexto({
  id,
  label,
  value,
  error,
  onChange,
  onBlur,
  ...input
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
} & Pick<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode" | "placeholder" | "maxLength"
>) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-foreground"
      >
        {label}
      </label>
      <input
        id={id}
        {...input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        data-error={!!error}
        className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors duration-200
          data-[error=false]:border-border data-[error=false]:bg-background data-[error=false]:text-foreground data-[error=false]:placeholder:text-muted data-[error=false]:focus-visible:outline data-[error=false]:focus-visible:outline-2 data-[error=false]:focus-visible:outline-offset-0 data-[error=false]:focus-visible:outline-primary
          border-error bg-error-container text-foreground focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-error`}
      />
      {error && (
        <p className="mt-1 text-xs text-error">{error}</p>
      )}
    </div>
  );
}
