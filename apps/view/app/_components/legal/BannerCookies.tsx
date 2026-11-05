"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import {
  hayPreferenciaGuardada,
  recordarDecision,
  type DecisionCookies,
} from "@/app/_lib/cookies-consentimiento";
import { registrarDecisionCookies } from "@/app/_lib/cookies-actions";

/** La cookie no cambia por fuera de este componente: no hay a qué suscribirse. */
const suscribir = () => () => {};

/**
 * En el servidor no se puede saber si el visitante ya decidió. Se responde que
 * sí para que el HTML nunca traiga el banner: aparece recién tras hidratar, si
 * corresponde. Así el que ya decidió no lo ve parpadear.
 */
const enElServidor = () => true;

/**
 * CU-76 / RF-57: banner de consentimiento de cookies al primer ingreso.
 *
 * No es un diálogo modal y no atrapa el foco a propósito: la Excepción 1 del
 * CU-76 pide aplicar la preferencia "sin interrumpir la navegación", así que
 * esto es una región que avisa y se puede ignorar mientras se navega.
 */
export default function BannerCookies() {
  const hayPreferencia = useSyncExternalStore(
    suscribir,
    hayPreferenciaGuardada,
    enElServidor,
  );
  const [decidido, setDecidido] = useState(false);
  const [guardando, iniciarGuardado] = useTransition();

  function decidir(decision: DecisionCookies) {
    // Se recuerda antes de que vuelva el servidor: el gate de seguimiento ya
    // tiene que respetar la decisión en esta misma vista.
    recordarDecision(decision);
    setDecidido(true);
    iniciarGuardado(() => {
      void registrarDecisionCookies(decision);
    });
  }

  if (hayPreferencia || decidido) return null;

  return (
    <section
      aria-labelledby="banner-cookies-titulo"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface shadow-lg"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <h2
            id="banner-cookies-titulo"
            className="text-sm font-semibold text-foreground"
          >
            Cookies y analítica
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted">
            Usamos cookies necesarias para que el sitio funcione. Puedes aceptar
            o rechazar las que usamos para medir cómo se navega. Tu elección se
            guarda en este navegador y puedes revisar el detalle en la{" "}
            <Link
              href="/privacidad"
              className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
            >
              Política de Privacidad
            </Link>
            .
          </p>
        </div>

        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={() => decidir("rechazado")}
            disabled={guardando}
            className="min-h-11 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary disabled:opacity-60"
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={() => decidir("aceptado")}
            disabled={guardando}
            className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-background hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary disabled:opacity-60"
          >
            Aceptar
          </button>
        </div>
      </div>
    </section>
  );
}
