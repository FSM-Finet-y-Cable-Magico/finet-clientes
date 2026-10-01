import "server-only";
import { cookies } from "next/headers";
import { EncryptJWT, jwtDecrypt } from "jose";
import {
  COOKIE_CONSENTIMIENTO,
  VIGENCIA_CONSENTIMIENTO_DIAS,
  type ConsentimientoCookies,
  type DecisionCookies,
} from "./cookies-consentimiento";

/**
 * RNF-57.1: "El estado del consentimiento debe persistir en una cookie
 * cifrada." Se usa JWE (`dir` + A256GCM) con `jose`, que ya es dependencia del
 * proyecto y es lo que `proxy.ts` usa para verificar el JWT de sesión.
 *
 * Cifrada y no solo firmada significa que el valor es opaco para el navegador:
 * nadie puede leer ni fabricar un "aceptado" desde la consola.
 */

const ALGORITMO = "dir";
const CIFRADO = "A256GCM";

/**
 * La clave sale del entorno. Se deriva por SHA-256 para aceptar un secreto de
 * cualquier largo y entregarle a A256GCM los 32 bytes que exige.
 */
async function clave(): Promise<Uint8Array> {
  const secreto = process.env.COOKIE_CONSENTIMIENTO_SECRET;
  if (!secreto) {
    throw new Error(
      "COOKIE_CONSENTIMIENTO_SECRET no está configurada en las variables de entorno",
    );
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secreto),
  );
  return new Uint8Array(digest);
}

export async function cifrarConsentimiento(
  valor: ConsentimientoCookies,
): Promise<string> {
  return new EncryptJWT({ ...valor })
    .setProtectedHeader({ alg: ALGORITMO, enc: CIFRADO })
    .setIssuedAt()
    .encrypt(await clave());
}

/**
 * Devuelve null si la cookie no está, no se puede descifrar o viene con una
 * forma que no reconocemos. Null se trata como "no hay preferencia": el banner
 * vuelve a preguntar y el seguimiento queda apagado.
 */
export async function descifrarConsentimiento(
  cookie: string,
): Promise<ConsentimientoCookies | null> {
  try {
    const { payload } = await jwtDecrypt(cookie, await clave());
    const decision = payload.decision;
    if (decision !== "aceptado" && decision !== "rechazado") return null;
    return {
      decision,
      version: typeof payload.version === "string" ? payload.version : "",
      fecha: typeof payload.fecha === "string" ? payload.fecha : "",
    };
  } catch {
    return null;
  }
}

/** Lee la preferencia guardada, ya descifrada. */
export async function leerConsentimiento(): Promise<ConsentimientoCookies | null> {
  const cookie = (await cookies()).get(COOKIE_CONSENTIMIENTO)?.value;
  if (!cookie) return null;
  return descifrarConsentimiento(cookie);
}

/**
 * Escribe la cookie cifrada.
 *
 * `httpOnly` en false a propósito: el banner necesita ver si la cookie existe
 * para saber si preguntar (Excepción 1). El valor sigue siendo ilegible, así
 * que lo único que el navegador puede deducir es que ya hubo una decisión.
 */
export async function guardarConsentimiento(
  decision: DecisionCookies,
  version: string,
): Promise<void> {
  const valor = await cifrarConsentimiento({
    decision,
    version,
    fecha: new Date().toISOString(),
  });

  (await cookies()).set({
    name: COOKIE_CONSENTIMIENTO,
    value: valor,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VIGENCIA_CONSENTIMIENTO_DIAS * 24 * 60 * 60,
  });
}
