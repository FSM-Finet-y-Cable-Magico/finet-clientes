"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, UserCheck } from "lucide-react";
import { WHATSAPP_URL } from "../_lib/company";
import LoginBranding from "./LoginBranding";
import PanelAviso from "./PanelAviso";
import SolicitudPorRut from "./SolicitudPorRut";

/** Lo que responde `POST /auth/registro`; el texto de cada caso lo pone la vista. */
type ResultadoRegistro =
  | "NO_CLIENTE"
  | "YA_REGISTRADO"
  | "SIN_CORREO"
  | "ENLACE_ENVIADO";

const SUBTITULO = "Crea tu cuenta";

const enlaceSecundario =
  "inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground";
const botonPrincipal =
  "mt-6 inline-flex items-center gap-1.5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90";

/**
 * CU-04: la cuenta se crea sobre un cliente que G8 ya dio de alta (acuerdo
 * v2.0, §3 y §4). Se pide solo el RUT y la contraseña se crea con un enlace de
 * un solo uso al correo que ya tiene registrado (G8, 01-10, §6).
 */
export default function RegistroForm({
  onIniciarSesion,
}: {
  onIniciarSesion: () => void;
}) {
  const [resultado, setResultado] = useState<ResultadoRegistro | null>(null);

  const volverAlLogin = (margen: "mt-3" | "mt-6") => (
    <button
      type="button"
      onClick={onIniciarSesion}
      className={`${margen} ${enlaceSecundario}`}
    >
      <ArrowLeft size={14} aria-hidden />
      Volver al inicio de sesión
    </button>
  );

  if (resultado === "ENLACE_ENVIADO") {
    return (
      <PanelAviso
        icono={<CheckCircle2 size={40} className="text-primary" aria-hidden />}
        titulo="Revisa tu correo"
        subtitulo={SUBTITULO}
      >
        <p className="mt-2 text-sm text-muted">
          Te enviamos un enlace a tu correo registrado para que crees tu
          contraseña. Expira en 30 minutos.
        </p>
        {volverAlLogin("mt-6")}
      </PanelAviso>
    );
  }

  // Excepción 4 del CU-04: el cliente ya tiene una cuenta.
  if (resultado === "YA_REGISTRADO") {
    return (
      <PanelAviso
        icono={<UserCheck size={40} className="text-primary" aria-hidden />}
        titulo="Ya tienes una cuenta"
        subtitulo={SUBTITULO}
      >
        <p className="mt-2 text-sm text-muted">
          Ese RUT ya tiene una cuenta en el portal. Inicia sesión con tu
          contraseña o, si no la recuerdas, recupérala.
        </p>
        <button type="button" onClick={onIniciarSesion} className={botonPrincipal}>
          Iniciar sesión
        </button>
        <Link href="/recuperar-password" className={`mt-3 ${enlaceSecundario}`}>
          Recuperar mi contraseña
        </Link>
      </PanelAviso>
    );
  }

  // Sin correo no hay a dónde mandar el enlace: G8 (01-10, §6.2) pide
  // validarlo a mano.
  if (resultado === "SIN_CORREO") {
    return (
      <PanelAviso
        icono={<AlertCircle size={40} className="text-warning" aria-hidden />}
        titulo="No podemos crear tu cuenta en línea"
        subtitulo={SUBTITULO}
      >
        <p className="mt-2 text-sm text-muted">
          No tenemos un correo registrado para enviarte el enlace. Escríbenos
          por WhatsApp y te ayudamos a crear tu cuenta.
        </p>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={botonPrincipal}
        >
          Escribir por WhatsApp
          <span className="sr-only"> (se abre en una pestaña nueva)</span>
        </a>
        {volverAlLogin("mt-3")}
      </PanelAviso>
    );
  }

  if (resultado === "NO_CLIENTE") {
    return (
      <PanelAviso
        icono={<AlertCircle size={40} className="text-error" aria-hidden />}
        titulo="No encontramos ese RUT entre nuestros clientes"
        subtitulo={SUBTITULO}
      >
        <p className="mt-2 text-sm text-muted">
          La cuenta del portal es para clientes con un servicio contratado. Si
          todavía no lo eres, revisa nuestros planes.
        </p>
        <Link href="/planes" className={botonPrincipal}>
          Ver planes
        </Link>
        <button
          type="button"
          onClick={() => setResultado(null)}
          className={`mt-3 ${enlaceSecundario}`}
        >
          <ArrowLeft size={14} aria-hidden />
          Intentar con otro RUT
        </button>
      </PanelAviso>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-background p-8 shadow-sm sm:p-10">
      <LoginBranding subtitle={SUBTITULO} />

      <p className="text-center text-sm text-muted">
        Ingresa tu RUT y te enviaremos un enlace a tu correo registrado para
        que crees tu contraseña
      </p>

      <SolicitudPorRut<{ resultado: ResultadoRegistro }>
        endpoint="/auth/registro"
        textoBoton="Continuar"
        textoEnviando="Enviando..."
        errorPorDefecto="Error al enviar la solicitud"
        onRespuesta={(respuesta) => setResultado(respuesta.resultado)}
      />

      <p className="mt-6 text-center text-xs text-muted">
        Al registrarte aceptas nuestros{" "}
        <a
          href="/terminos"
          className="text-primary underline hover:opacity-80"
        >
          Términos y Condiciones
        </a>
      </p>
    </div>
  );
}
