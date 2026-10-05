"use server";

import { POLITICA_PRIVACIDAD_VERSION } from "./legal";
import type { DecisionCookies } from "./cookies-consentimiento";
import { guardarConsentimiento } from "./cookies-consentimiento.servidor";

function apiUrl(path: string): string {
  const base = process.env.API_URL;
  if (!base)
    throw new Error("API_URL no está configurada en las variables de entorno");
  return `${base}${path}`;
}

/**
 * CU-76: guarda la decisión del banner.
 *
 * Dos cosas, en este orden:
 *  1. La cookie cifrada, que es lo que el RNF-57.1 exige y lo que hace que el
 *     banner no vuelva a salir y que el seguimiento quede apagado o encendido.
 *  2. El registro en la base, que es la prueba de que se preguntó y de qué se
 *     contestó.
 *
 * Si falla el registro en la base, la cookie ya quedó puesta: al visitante no
 * se le vuelve a preguntar ni se le interrumpe la navegación. Es lo que pide la
 * Excepción 1. El backend deja el error en su log.
 */
export async function registrarDecisionCookies(
  decision: DecisionCookies,
): Promise<{ ok: boolean }> {
  await guardarConsentimiento(decision, POLITICA_PRIVACIDAD_VERSION);

  try {
    const res = await fetch(apiUrl("/consentimiento/cookies"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acepto: decision === "aceptado",
        version_documento: POLITICA_PRIVACIDAD_VERSION,
      }),
      cache: "no-store",
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
