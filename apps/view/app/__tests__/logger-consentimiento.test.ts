const seguimientoPermitido = jest.fn();
jest.mock("@/app/_lib/cookies-consentimiento", () => ({
  seguimientoPermitido: () => seguimientoPermitido(),
}));

import { securityLogger } from "@/app/_lib/logger";

/**
 * CU-76, Descripción: "el sistema (…) aplica la configuración de seguimiento
 * según la preferencia seleccionada". Hoy el único envío a un tercero es el de
 * Sentry, así que esto es lo que comprueba que el banner apaga algo de verdad.
 */
describe("CU-76: el envío a Sentry respeta el consentimiento", () => {
  const entornoOriginal = process.env.NODE_ENV;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    seguimientoPermitido.mockReset();
    // El logger solo reporta fuera de desarrollo.
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "production",
      configurable: true,
    });
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://dsn-de-prueba";
  });

  afterEach(() => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: entornoOriginal,
      configurable: true,
    });
  });

  it("NO manda nada si el visitante rechazó el seguimiento", async () => {
    seguimientoPermitido.mockResolvedValue(false);

    securityLogger.sessionExpired();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("manda si el visitante aceptó", async () => {
    seguimientoPermitido.mockResolvedValue(true);

    securityLogger.sessionExpired();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://sentry.io/api/error",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("no consulta el consentimiento si no hay DSN configurado", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    securityLogger.sessionExpired();
    await Promise.resolve();

    expect(seguimientoPermitido).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
