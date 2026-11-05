"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/app/utils/api";
import { formatPrecio, fechaInstante } from "@/app/_lib/formato";
import { WHATSAPP_URL } from "@/app/_lib/company";
import PanelAviso from "@/app/components/PanelAviso";

/** Lo que Transbank dice del pago, a través del backend. */
type Detalle = {
  estado: "aprobado" | "anulado" | "rechazado" | "error";
  monto: number;
  fecha: string | null;
  codigo_autorizacion: string | null;
  orden: string;
  id_factura: number;
};

type Vista =
  | "aprobado"
  | "pendiente"
  | "anulado"
  | "rechazado"
  | "cancelado"
  | "error";

const SUBTITULO = "Resultado de tu pago";

/**
 * CU-42: adonde vuelve el cliente desde Webpay. El estado se le pregunta a
 * Transbank (a través del backend) con el token, y no se toma de la URL: así
 * nadie puede armar un enlace que muestre un pago aprobado que no existe. De la
 * URL solo se toma lo que no se puede consultar: que el cliente canceló, o que
 * G8 todavía no registra un pago aprobado.
 */
export default function ResultadoPago({
  resultado,
  token,
}: {
  resultado: string | null;
  token: string | null;
}) {
  const [detalle, setDetalle] = useState<Detalle | null | undefined>(
    token ? undefined : null,
  );

  useEffect(() => {
    if (!token) return;
    let vigente = true;
    api
      .get<Detalle>(`/pagos/webpay/resultado?token_ws=${encodeURIComponent(token)}`)
      .then((d) => vigente && setDetalle(d))
      .catch(() => vigente && setDetalle(null));
    return () => {
      vigente = false;
    };
  }, [token]);

  if (detalle === undefined) {
    return (
      <div
        className="mx-auto max-w-md animate-pulse space-y-4 rounded-2xl border border-border bg-background p-8"
        aria-busy="true"
      >
        <div className="mx-auto h-10 w-10 rounded-full bg-border" />
        <div className="mx-auto h-4 w-40 rounded bg-border" />
        <span className="sr-only">Consultando el resultado de tu pago…</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <Resultado vista={vistaDe(resultado, detalle)} detalle={detalle} />
    </div>
  );
}

function vistaDe(resultado: string | null, detalle: Detalle | null): Vista {
  if (detalle) {
    if (detalle.estado === "aprobado") {
      return resultado === "pendiente" ? "pendiente" : "aprobado";
    }
    return detalle.estado;
  }
  return resultado === "cancelado" ? "cancelado" : "error";
}

function Resultado({ vista, detalle }: { vista: Vista; detalle: Detalle | null }) {
  switch (vista) {
    case "aprobado":
      return (
        <PanelAviso
          icono={<CheckCircle2 size={40} className="text-success" aria-hidden />}
          titulo="Pago aprobado"
          subtitulo={SUBTITULO}
        >
          {detalle ? (
            <p className="mt-2 text-sm text-muted">
              Pagaste {formatPrecio(detalle.monto)} de la factura N°{" "}
              {detalle.id_factura}.
            </p>
          ) : null}
          {detalle ? <DatosPago detalle={detalle} /> : null}
          <p className="mt-4 text-sm text-muted">
            Si tienes un correo registrado, te llegará la confirmación.
          </p>
        </PanelAviso>
      );
    case "pendiente":
      return (
        <PanelAviso
          icono={<AlertCircle size={40} className="text-warning" aria-hidden />}
          titulo="Tu pago fue aprobado"
          subtitulo={SUBTITULO}
        >
          <p className="mt-2 text-sm text-muted">
            Webpay aprobó el pago, pero todavía no se refleja en tu cuenta. Si en
            24 horas no aparece, escríbenos por WhatsApp con tu código de
            autorización.
          </p>
          {detalle ? <DatosPago detalle={detalle} /> : null}
          <EnlaceWhatsApp />
        </PanelAviso>
      );
    case "anulado":
      return (
        <PanelAviso
          icono={<AlertCircle size={40} className="text-warning" aria-hidden />}
          titulo="No pudimos aplicar tu pago"
          subtitulo={SUBTITULO}
        >
          <p className="mt-2 text-sm text-muted">
            No pudimos aplicar el pago a tu factura, así que lo anulamos en
            Webpay. Revisa tu deuda antes de intentarlo de nuevo.
          </p>
          <VolverAPagar />
        </PanelAviso>
      );
    case "rechazado":
      return (
        <PanelAviso
          icono={<XCircle size={40} className="text-error" aria-hidden />}
          titulo="El pago no fue aprobado"
          subtitulo={SUBTITULO}
        >
          <p className="mt-2 text-sm text-muted">
            Webpay rechazó la transacción y no se hizo ningún cargo. Puedes
            intentarlo de nuevo con otra tarjeta.
          </p>
          <VolverAPagar />
        </PanelAviso>
      );
    case "cancelado":
      return (
        <PanelAviso
          icono={<XCircle size={40} className="text-muted" aria-hidden />}
          titulo="Pago cancelado"
          subtitulo={SUBTITULO}
        >
          <p className="mt-2 text-sm text-muted">
            No se completó el pago y no se hizo ningún cargo.
          </p>
          <VolverAPagar />
        </PanelAviso>
      );
    case "error":
      return (
        <PanelAviso
          icono={<AlertCircle size={40} className="text-error" aria-hidden />}
          titulo="No pudimos confirmar el resultado de tu pago"
          subtitulo={SUBTITULO}
        >
          <p className="mt-2 text-sm text-muted">
            Antes de intentarlo de nuevo, revisa si te llegó un correo de
            confirmación o escríbenos por WhatsApp.
          </p>
          <EnlaceWhatsApp />
        </PanelAviso>
      );
  }
}

function DatosPago({ detalle }: { detalle: Detalle }) {
  return (
    <dl className="mt-4 w-full divide-y divide-border rounded-xl border border-border text-left text-sm">
      {detalle.codigo_autorizacion ? (
        <Dato nombre="Código de autorización">{detalle.codigo_autorizacion}</Dato>
      ) : null}
      {detalle.fecha ? (
        <Dato nombre="Fecha">{fechaInstante(detalle.fecha, "numerica")}</Dato>
      ) : null}
      <Dato nombre="Monto">{formatPrecio(detalle.monto)}</Dato>
      <Dato nombre="Orden de compra">{detalle.orden}</Dato>
    </dl>
  );
}

function Dato({ nombre, children }: { nombre: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <dt className="text-muted">{nombre}</dt>
      <dd className="font-medium text-foreground">{children}</dd>
    </div>
  );
}

function VolverAPagar() {
  return (
    <Link
      href="/pagar"
      className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90"
    >
      Volver al portal de pagos
    </Link>
  );
}

function EnlaceWhatsApp() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90"
    >
      Escribir por WhatsApp
      <span className="sr-only"> (se abre en una pestaña nueva)</span>
    </a>
  );
}
