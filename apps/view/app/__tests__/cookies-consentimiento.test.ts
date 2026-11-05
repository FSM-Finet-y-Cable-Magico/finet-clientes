import {
  COOKIE_CONSENTIMIENTO,
  hayPreferenciaGuardada,
  olvidarDecision,
  recordarDecision,
  seguimientoPermitido,
} from "@/app/_lib/cookies-consentimiento";

function borrarCookies() {
  for (const c of document.cookie.split(";")) {
    const nombre = c.split("=")[0]?.trim();
    if (nombre) document.cookie = `${nombre}=; max-age=0; path=/`;
  }
}

describe("CU-76: la puerta del seguimiento", () => {
  beforeEach(() => {
    borrarCookies();
    olvidarDecision();
    jest.restoreAllMocks();
  });

  it("sin preferencia guardada no permite seguimiento", async () => {
    await expect(seguimientoPermitido()).resolves.toBe(false);
  });

  it("detecta la cookie sin necesitar leer su contenido (está cifrada)", () => {
    expect(hayPreferenciaGuardada()).toBe(false);

    document.cookie = `${COOKIE_CONSENTIMIENTO}=valor-cifrado-opaco; path=/`;

    expect(hayPreferenciaGuardada()).toBe(true);
  });

  it("no confunde la cookie con otra que empiece parecido", () => {
    document.cookie = `${COOKIE_CONSENTIMIENTO}_otra=x; path=/`;

    expect(hayPreferenciaGuardada()).toBe(false);
  });

  it("le pregunta al servidor cuando hay cookie pero no memoria", async () => {
    document.cookie = `${COOKIE_CONSENTIMIENTO}=valor-cifrado-opaco; path=/`;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ decision: "aceptado" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(seguimientoPermitido()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/consentimiento-cookies", {
      cache: "no-store",
    });
  });

  it("memoriza la respuesta y no vuelve a preguntar", async () => {
    document.cookie = `${COOKIE_CONSENTIMIENTO}=valor-cifrado-opaco; path=/`;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ decision: "aceptado" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await seguimientoPermitido();
    await seguimientoPermitido();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ante la duda no rastrea: si el servidor falla, devuelve false", async () => {
    document.cookie = `${COOKIE_CONSENTIMIENTO}=valor-cifrado-opaco; path=/`;
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("sin red")) as unknown as typeof fetch;

    await expect(seguimientoPermitido()).resolves.toBe(false);
  });

  it("la decisión recordada manda sobre cualquier consulta", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    recordarDecision("rechazado");

    await expect(seguimientoPermitido()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
