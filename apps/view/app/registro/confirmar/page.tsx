"use client";

import { ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useTokenDelEnlace } from "../../_lib/token-del-enlace";
import ConfirmarRegistroForm from "../../components/ConfirmarRegistroForm";
import PanelAviso from "../../components/PanelAviso";

export default function ConfirmarRegistroPage() {
  const { listo, token } = useTokenDelEnlace();

  if (!listo) return null;

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface p-4">
        <div className="w-full max-w-md">
          <PanelAviso
            icono={<AlertCircle size={40} className="text-error" aria-hidden />}
            titulo="Enlace inválido o expirado"
            subtitulo="Crea tu cuenta"
          >
            <p className="mt-2 text-sm text-muted">
              El enlace para crear tu cuenta no es válido o ha expirado.
              Solicita uno nuevo desde Registrarse.
            </p>
            <Link
              href="/inicio-sesion"
              className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
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
        <ConfirmarRegistroForm token={token} />
      </div>
    </main>
  );
}
