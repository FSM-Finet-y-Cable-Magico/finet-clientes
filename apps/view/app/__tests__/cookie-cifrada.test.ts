/**
 * Corre en entorno node y no jsdom: este módulo es solo de servidor, y jsdom no
 * trae TextEncoder ni crypto.subtle, que es lo que usa el cifrado.
 *
 * @jest-environment node
 */
process.env.COOKIE_CONSENTIMIENTO_SECRET = "secreto-de-prueba-para-los-tests";

import {
  cifrarConsentimiento,
  descifrarConsentimiento,
} from "@/app/_lib/cookies-consentimiento.servidor";

const VALOR = {
  decision: "aceptado" as const,
  version: "1.1",
  fecha: "2026-09-28T12:00:00.000Z",
};

/**
 * RNF-57.1: "El estado del consentimiento debe persistir en una cookie
 * cifrada". Esto es lo que lo comprueba.
 */
describe("CU-76 / RNF-57.1: la cookie del consentimiento va cifrada", () => {
  it("el valor guardado no contiene la decisión en claro", async () => {
    const cookie = await cifrarConsentimiento(VALOR);

    expect(cookie).not.toContain("aceptado");
    expect(cookie).not.toContain("rechazado");
    expect(cookie).not.toContain("1.1");
    expect(cookie).not.toContain("2026-09-28");
  });

  it("es un JWE, no un token firmado que cualquiera pueda leer", async () => {
    const cookie = await cifrarConsentimiento(VALOR);

    // Un JWE trae 5 partes; un JWS firmado (legible en base64) trae 3.
    expect(cookie.split(".")).toHaveLength(5);

    const cabecera = JSON.parse(
      Buffer.from(cookie.split(".")[0]!, "base64url").toString(),
    ) as { alg: string; enc: string };
    expect(cabecera.enc).toBe("A256GCM");
  });

  it("descifra de vuelta el mismo valor", async () => {
    const cookie = await cifrarConsentimiento(VALOR);

    await expect(descifrarConsentimiento(cookie)).resolves.toMatchObject(VALOR);
  });

  it("rechaza una cookie fabricada a mano", async () => {
    await expect(
      descifrarConsentimiento("no.es.un.jwe.valido"),
    ).resolves.toBeNull();
  });

  it("rechaza una cookie cifrada con otra clave", async () => {
    const cookie = await cifrarConsentimiento(VALOR);
    process.env.COOKIE_CONSENTIMIENTO_SECRET = "otra-clave-distinta";

    try {
      await expect(descifrarConsentimiento(cookie)).resolves.toBeNull();
    } finally {
      process.env.COOKIE_CONSENTIMIENTO_SECRET =
        "secreto-de-prueba-para-los-tests";
    }
  });

  it("rechaza un payload con una decisión que no reconocemos", async () => {
    const cookie = await cifrarConsentimiento({
      ...VALOR,
      decision: "quizas" as unknown as "aceptado",
    });

    await expect(descifrarConsentimiento(cookie)).resolves.toBeNull();
  });

  it("falla claro si no está configurada la clave", async () => {
    const original = process.env.COOKIE_CONSENTIMIENTO_SECRET;
    delete process.env.COOKIE_CONSENTIMIENTO_SECRET;

    try {
      await expect(cifrarConsentimiento(VALOR)).rejects.toThrow(
        /COOKIE_CONSENTIMIENTO_SECRET/,
      );
    } finally {
      process.env.COOKIE_CONSENTIMIENTO_SECRET = original;
    }
  });
});
