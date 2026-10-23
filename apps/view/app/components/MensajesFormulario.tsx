import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

/** El error que devolvió el backend, arriba del formulario. */
export function MensajeError({
  margen,
  children,
}: {
  /** El espacio con lo que está arriba o abajo: cada pantalla tiene el suyo. */
  margen: "mb-5" | "mb-6" | "mt-5";
  children: ReactNode;
}) {
  return (
    <div
      className={`${margen} rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm text-error`}
    >
      {children}
    </div>
  );
}

/** Que el cambio del perfil quedó hecho (CU-08, 09 y 10). */
export function MensajeExito({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 rounded-lg border border-success/20 bg-success-container px-4 py-3 text-sm text-on-success-container flex items-start gap-2">
      <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden />
      {children}
    </div>
  );
}
