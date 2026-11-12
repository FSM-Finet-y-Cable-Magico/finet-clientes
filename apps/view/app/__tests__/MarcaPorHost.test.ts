/**
 * Cada empresa en su propio host (lo prende `NEXT_PUBLIC_SITE_URL_CABLE_MAGICO`):
 * las dos viven en la raíz del suyo, sin prefijo, y `proxy.ts` reconoce la
 * marca por el host. Las marcas se leen al cargar el módulo, así que aquí se
 * cargan con las variables puestas.
 */
const FINET = "http://finet.localhost:18200";
const CABLE = "http://cablemagico.localhost:18200";
const ANTES = { ...process.env };

let company: typeof import("@/app/_lib/company");
let enrutarMarca: (typeof import("@/app/_lib/enrutar-marca"))["enrutarMarca"];

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SITE_URL = FINET;
  process.env.NEXT_PUBLIC_SITE_URL_CABLE_MAGICO = `${CABLE}/`;
  jest.resetModules();
  company = await import("@/app/_lib/company");
  ({ enrutarMarca } = await import("@/app/_lib/enrutar-marca"));
});

afterAll(() => {
  process.env = ANTES;
  jest.resetModules();
});

const sinNada = { search: "", marcaToken: null, marcaCookie: null };
const enFinet = { ...sinNada, marcaHost: "finet" as const };
const enCable = { ...sinNada, marcaHost: "cable-magico" as const };

describe("marcas con un host por empresa", () => {
  it("Cable Mágico vive en la raíz de su host: sus enlaces no llevan prefijo", () => {
    const { MARCAS, rutaMarca, urlMarca } = company;
    expect(rutaMarca(MARCAS["cable-magico"], "/planes")).toBe("/planes");
    expect(urlMarca(MARCAS["cable-magico"], "/planes")).toBe(`${CABLE}/planes`);
    expect(urlMarca(MARCAS["cable-magico"], "/")).toBe(CABLE);
    expect(urlMarca(MARCAS.finet, "/planes")).toBe(`${FINET}/planes`);
  });

  it("reconoce la marca solo por un host de la lista", () => {
    const { MARCAS, marcaPorHost } = company;
    expect(marcaPorHost("cablemagico.localhost:18200")).toBe(MARCAS["cable-magico"]);
    expect(marcaPorHost("CableMagico.localhost:18200")).toBe(MARCAS["cable-magico"]);
    expect(marcaPorHost("finet.localhost:18200")).toBe(MARCAS.finet);
    // Otro puerto, otro host o ninguno no eligen marca.
    expect(marcaPorHost("cablemagico.localhost")).toBeNull();
    expect(marcaPorHost("evil.example")).toBeNull();
    expect(marcaPorHost(null)).toBeNull();
  });

  it("de un sitio al otro se va con la URL completa; dentro del mismo, con la ruta", () => {
    const { MARCAS, enlaceEntreSitios } = company;
    expect(enlaceEntreSitios(MARCAS.finet, MARCAS["cable-magico"], "/planes")).toBe(
      `${CABLE}/planes`,
    );
    expect(enlaceEntreSitios(MARCAS["cable-magico"], MARCAS.finet, "/")).toBe(FINET);
    expect(enlaceEntreSitios(MARCAS.finet, MARCAS.finet, "/planes")).toBe("/planes");
  });
});

describe("enrutarMarca con un host por empresa", () => {
  it("cada host sirve el sitio de su empresa, sin cambiar la URL", () => {
    expect(enrutarMarca({ ...enCable, pathname: "/planes", search: "?x=1" })).toEqual({
      tipo: "reescribir",
      destino: "/cable-magico/planes?x=1",
      marca: "cable-magico",
      guardarCookie: null,
    });
    expect(enrutarMarca({ ...enCable, pathname: "/" })).toMatchObject({
      tipo: "reescribir",
      destino: "/cable-magico",
    });
    expect(enrutarMarca({ ...enFinet, pathname: "/planes" })).toMatchObject({
      tipo: "reescribir",
      destino: "/finet/planes",
    });
  });

  it("un host que no está en la lista no elige marca: se sirve Finet", () => {
    expect(enrutarMarca({ ...sinNada, pathname: "/planes" })).toMatchObject({
      tipo: "reescribir",
      destino: "/finet/planes",
    });
  });

  it("un enlace viejo con /cable-magico lleva al host de Cable Mágico", () => {
    expect(
      enrutarMarca({ ...enFinet, pathname: "/cable-magico/pagar", search: "?t=abc" }),
    ).toEqual({ tipo: "redirigir", destino: `${CABLE}/pagar?t=abc` });
    // Ya en su host, solo pierde el prefijo.
    expect(enrutarMarca({ ...enCable, pathname: "/cable-magico/pagar" })).toEqual({
      tipo: "redirigir",
      destino: "/pagar",
    });
    expect(enrutarMarca({ ...enCable, pathname: "/finet" })).toEqual({
      tipo: "redirigir",
      destino: FINET,
    });
  });

  it("con sesión manda la empresa del token: lleva al host de esa empresa", () => {
    expect(
      enrutarMarca({ ...enFinet, pathname: "/portal", marcaToken: "cable-magico" }),
    ).toEqual({ tipo: "redirigir", destino: `${CABLE}/portal` });
    expect(
      enrutarMarca({ ...enCable, pathname: "/portal", marcaToken: "finet" }),
    ).toEqual({ tipo: "redirigir", destino: `${FINET}/portal` });
    expect(
      enrutarMarca({ ...enCable, pathname: "/portal", marcaToken: "cable-magico" }),
    ).toMatchObject({ tipo: "reescribir", destino: "/cable-magico/portal" });
  });

  it("en el host de una empresa no manda la cookie de la otra", () => {
    expect(
      enrutarMarca({ ...enFinet, pathname: "/planes", marcaCookie: "cable-magico" }),
    ).toMatchObject({ tipo: "reescribir", destino: "/finet/planes" });
  });

  // OWASP A01: la redirección a otro host solo sale de las URLs configuradas.
  it("nunca redirige a un host que no sea el de una empresa", () => {
    const permitido = new RegExp(
      "^(/(?!/)|http://(finet|cablemagico)\\.localhost:18200(/(?!/)|[?]|$))",
    );
    for (const pathname of [
      "//evil.example",
      "/cable-magico//evil.example",
      "/finet//evil.example/x",
    ]) {
      for (const entrada of [enFinet, enCable, sinNada]) {
        const decision = enrutarMarca({ ...entrada, pathname });
        if (decision.tipo === "redirigir") {
          expect(decision.destino).toMatch(permitido);
        }
      }
    }
  });
});
