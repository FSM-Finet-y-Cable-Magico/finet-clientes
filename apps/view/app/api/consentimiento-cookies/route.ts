import { NextResponse } from "next/server";
import { leerConsentimiento } from "@/app/_lib/cookies-consentimiento.servidor";

/**
 * CU-76: le dice al navegador qué decidió, para que el gate de seguimiento
 * pueda aplicarla.
 *
 * Hace falta un route handler y no basta la cookie porque el valor va cifrado
 * (RNF-57.1): descifrarlo necesita la clave, que vive solo en el servidor.
 *
 * `no-store`: es estado por visitante, no se cachea en ninguna capa.
 */
export async function GET() {
  const consentimiento = await leerConsentimiento();

  return NextResponse.json(
    { decision: consentimiento?.decision ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
