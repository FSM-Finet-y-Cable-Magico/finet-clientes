"use client";

import { ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useTokenDelEnlace } from "../../_lib/token-del-enlace";
import ResetPasswordForm from "../../components/ResetPasswordForm";
import PanelAviso from "../../components/PanelAviso";

export default function RestablecerPasswordPage() {
  const { listo, token } = useTokenDelEnlace();

  if (!listo) return null;

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface p-4">
        <div className="w-full max-w-md">
          <PanelAviso
            icono={<AlertCircle size={40} className="text-error" aria-hidden />}
            titulo="Enlace inválido o expirado"
          >
            <p className="mt-2 text-sm text-muted">
              El enlace de recuperación no es válido o ha expirado. Solicita
              uno nuevo.
            </p>
            <Link
              href="/recuperar-password"
              className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90"
            >
              Solicitar nuevo enlace
            </Link>
            <Link
              href="/inicio-sesion"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
            >
              <ArrowLeft size={14} aria-hidden />
              Volver al inicio de sesión
            </Link>
          </PanelAviso>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md">
        <ResetPasswordForm token={token} />
      </div>
    </main>
  );
}
