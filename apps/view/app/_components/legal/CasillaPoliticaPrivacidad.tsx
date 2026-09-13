import Link from "next/link";
import type { Ref } from "react";

type CasillaPoliticaPrivacidadProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  ref?: Ref<HTMLInputElement>;
};

/**
 * CU-75: casilla obligatoria de aceptación de la Política de Privacidad. No
 * usa `required` nativo: el aviso del navegador no dice qué hay que aceptar,
 * así que cada formulario valida la casilla y muestra este mensaje.
 */
export default function CasillaPoliticaPrivacidad({
  checked,
  onChange,
  error,
  ref,
}: CasillaPoliticaPrivacidadProps) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          ref={ref}
          id="aceptaPoliticaPrivacidad"
          name="aceptaPoliticaPrivacidad"
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-required="true"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "aceptaPoliticaPrivacidad-error" : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-primary"
        />
        <label
          htmlFor="aceptaPoliticaPrivacidad"
          className="cursor-pointer text-sm leading-5 text-foreground"
        >
          He leído y acepto la{" "}
          {/* Pestaña nueva: que abrir la política no borre lo ya escrito. */}
          <Link
            href="/privacidad"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
          >
            Política de Privacidad
            <span className="sr-only"> (se abre en una pestaña nueva)</span>
          </Link>
        </label>
      </div>
      {error ? (
        <p
          id="aceptaPoliticaPrivacidad-error"
          role="alert"
          className="mt-1.5 text-xs text-error"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
