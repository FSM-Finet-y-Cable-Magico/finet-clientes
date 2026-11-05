"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import LoginBranding from "./LoginBranding";
import PanelAviso from "./PanelAviso";
import SolicitudPorRut from "./SolicitudPorRut";

export default function RecoveryForm() {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <PanelAviso
        icono={<CheckCircle2 size={40} className="text-primary" aria-hidden />}
        titulo="Revisa tu correo"
      >
        <p className="mt-2 text-sm text-muted">
          Si el RUT está registrado, recibirás un enlace de recuperación en tu
          correo electrónico.
        </p>
        <Link
          href="/inicio-sesion"
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-primary transition-colors hover:opacity-80"
        >
          <ArrowLeft size={14} aria-hidden />
          Volver al inicio de sesión
        </Link>
      </PanelAviso>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-background p-8 shadow-sm sm:p-10">
      <LoginBranding />

      <div className="mt-6 text-center">
        <h2 className="text-lg font-semibold text-foreground">
          Recuperar contraseña
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          Ingresa tu RUT y te enviaremos un enlace de recuperación
        </p>
      </div>

      <SolicitudPorRut<{ message: string }>
        endpoint="/auth/recuperar-password"
        textoBoton="Enviar enlace"
        textoEnviando="Enviando..."
        errorPorDefecto="Error al enviar la solicitud"
        onRespuesta={() => setSent(true)}
      />

      <p className="mt-6 text-center">
        <Link
          href="/inicio-sesion"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden />
          Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}
