/**
 * CU-76 / RF-57: consentimiento de cookies.
 *
 * Este archivo es el contrato compartido entre el banner (navegador), la server
 * action y el route handler. No importa `jose` a propósito: el cifrado vive en
 * `cookies-consentimiento.servidor.ts` para que nada de esto arrastre la clave
 * al bundle del cliente.
 */

export type DecisionCookies = "aceptado" | "rechazado";

export const COOKIE_CONSENTIMIENTO = "finet_cookies";

/**
 * Un año. El RF-57 habla del "primer ingreso" y la poscondición del CU-76 pide
 * que el banner no vuelva a salir; un vencimiento le da al visitante la ocasión
 * de reconsiderar sin tener que borrar cookies a mano.
 */
export const VIGENCIA_CONSENTIMIENTO_DIAS = 365;

/** Lo que va cifrado dentro de la cookie. */
export type ConsentimientoCookies = {
  decision: DecisionCookies;
  /** Versión del documento de privacidad vigente cuando decidió. */
  version: string;
  /** ISO 8601. */
  fecha: string;
};

/**
 * Excepción 1 del CU-76: si ya hay preferencia registrada, el banner no sale.
 *
 * Solo mira si la cookie existe, no su contenido — el valor está cifrado y el
 * navegador no puede leerlo. Con la presencia alcanza para decidir si preguntar.
 */
export function hayPreferenciaGuardada(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith(`${COOKIE_CONSENTIMIENTO}=`));
}

/** Memoria del proceso: evita preguntarle al servidor en cada evento. */
let decisionEnMemoria: DecisionCookies | null = null;

/** La usa el banner para que el gate sepa la decisión sin ir al servidor. */
export function recordarDecision(decision: DecisionCookies): void {
  decisionEnMemoria = decision;
}

/**
 * El gate. Cualquier seguimiento tiene que preguntar acá antes de mandar nada.
 *
 * Hoy el único que manda datos afuera es el envío a Sentry de `logger.ts`. Sin
 * esto el banner sería un cartel que no apaga nada.
 *
 * Es asíncrono porque la cookie está cifrada: la decisión la descifra el
 * servidor. Si no hay preferencia, o si no se puede averiguar, devuelve false —
 * ante la duda no se rastrea.
 */
export async function seguimientoPermitido(): Promise<boolean> {
  if (decisionEnMemoria !== null) return decisionEnMemoria === "aceptado";
  if (!hayPreferenciaGuardada()) return false;

  try {
    const res = await fetch("/api/consentimiento-cookies", {
      cache: "no-store",
    });
    if (!res.ok) return false;
    const { decision } = (await res.json()) as {
      decision: DecisionCookies | null;
    };
    if (decision === null) return false;
    decisionEnMemoria = decision;
    return decision === "aceptado";
  } catch {
    return false;
  }
}

/** Para los tests: borra la memoria del proceso. */
export function olvidarDecision(): void {
  decisionEnMemoria = null;
}
