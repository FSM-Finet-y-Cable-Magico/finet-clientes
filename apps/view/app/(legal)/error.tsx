"use client";

import { useEffect } from "react";
import { FileWarning } from "lucide-react";
import PrimaryButton from "../_components/ui/PrimaryButton";
import { securityLogger } from "../_lib/logger";

/**
 * CU-73, Excepcion 1: la pagina legal no se pudo recuperar. Avisa que no esta
 * disponible en este momento e invita a intentarlo mas tarde.
 */
export default function LegalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  // Next 16 recomienda unstable_retry sobre reset: vuelve a pedir el
  // contenido en vez de solo re-renderizar lo que ya fallo.
  unstable_retry: () => void;
}) {
  useEffect(() => {
    securityLogger.pageError(window.location.pathname, {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div role="alert" className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-container text-on-warning-container">
          <FileWarning size={28} aria-hidden />
        </div>
        <h1 className="mb-2 text-xl font-bold text-foreground">
          Esta página no está disponible en este momento
        </h1>
        <p className="mb-6 text-sm text-muted">
          No pudimos cargar su contenido. Intenta nuevamente más tarde.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-background shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
          >
            Reintentar
          </button>
          <PrimaryButton href="/" variant="outline">
            Volver al inicio
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
