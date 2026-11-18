import { enlaceAOtraMarca, MARCAS, type SlugMarca } from "@/app/_lib/company";
import { destinoInterno, enrutarMarca } from "@/app/_lib/enrutar-marca";

/**
 * Qué hace `proxy.ts` con cada ruta. Una sola app para las dos empresas, como
 * G8: la URL dice la empresa del sitio público y, con sesión, manda el token
 * ("cambia los permisos y vistas por empresa"). Las páginas viven en
 * app/[marca]/, así que cada ruta se reescribe a /finet/… o /cable-magico/….
 */
const sinNada = { search: "", marcaToken: null, marcaCookie: null };

describe("enrutarMarca", () => {
  it("una ruta de Finet se sirve desde app/[marca] con finet, sin cambiar la URL", () => {
    expect(enrutarMarca({ ...sinNada, pathname: "/planes" })).toEqual({
      tipo: "reescribir",
      destino: "/finet/planes",
      marca: "finet",
      guardarCookie: null,
    });
    expect(enrutarMarca({ ...sinNada, pathname: "/" })).toMatchObject({
      tipo: "reescribir",
      destino: "/finet",
    });
  });

  it("una ruta de Cable Mágico se sirve tal cual y recuerda la marca elegida", () => {
    expect(
      enrutarMarca({ ...sinNada, pathname: "/cable-magico/planes", search: "?x=1" }),
    ).toEqual({
      tipo: "reescribir",
      destino: "/cable-magico/planes?x=1",
      marca: "cable-magico",
      guardarCookie: "cable-magico",
    });
  });

  it("la ruta interna /finet/… no se publica: redirige a la de siempre", () => {
    expect(enrutarMarca({ ...sinNada, pathname: "/finet/planes", search: "?a=1" })).toEqual({
      tipo: "redirigir",
      destino: "/planes?a=1",
    });
    expect(enrutarMarca({ ...sinNada, pathname: "/finet" })).toEqual({
      tipo: "redirigir",
      destino: "/",
    });
  });

  it("la ruta interna /finet/… recuerda Finet a quien venía de Cable Mágico", () => {
    expect(
      enrutarMarca({ ...sinNada, marcaCookie: "cable-magico", pathname: "/finet/contratar/1" }),
    ).toEqual({ tipo: "redirigir", destino: "/contratar/1", guardarCookie: "finet" });
  });

  it("un plan de Finet abierto desde Cable Mágico llega a su página sin dar vueltas", () => {
    // La página de contratar de Cable Mágico manda el plan de Finet a su sitio.
    let destino = enlaceAOtraMarca(MARCAS["cable-magico"], MARCAS.finet, "/contratar/1");
    let cookie: SlugMarca = "cable-magico";
    for (let saltos = 0; saltos < 5; saltos++) {
      const decision = enrutarMarca({ ...sinNada, marcaCookie: cookie, pathname: destino });
      if (decision.tipo === "reescribir") {
        expect(decision.destino).toBe("/finet/contratar/1");
        return;
      }
      if (decision.guardarCookie) cookie = decision.guardarCookie;
      destino = decision.destino;
    }
    throw new Error(`quedó dando vueltas entre ${destino} y Cable Mágico`);
  });

  // Rama ppt: una precarga de Next no es una elección del visitante. Si
  // cambiara la marca, una precarga en vuelo deshace lo que eligió en el
  // selector (15-11: elegía Finet y volvía a quedar en Cable Mágico).
  it("una precarga de una ruta de Cable Mágico no cambia la marca recordada", () => {
    expect(
      enrutarMarca({
        ...sinNada,
        marcaCookie: "finet",
        pathname: "/cable-magico/planes",
        prefetch: true,
      }),
    ).toEqual({
      tipo: "reescribir",
      destino: "/cable-magico/planes",
      marca: "cable-magico",
      guardarCookie: null,
    });
  });

  it("una precarga de /finet/… tampoco cambia la marca recordada", () => {
    expect(
      enrutarMarca({
        ...sinNada,
        marcaCookie: "cable-magico",
        pathname: "/finet/planes",
        prefetch: true,
      }),
    ).toEqual({ tipo: "redirigir", destino: "/planes" });
  });

  it("quien eligió Cable Mágico sigue en su sitio al navegar a una ruta sin prefijo", () => {
    expect(
      enrutarMarca({ ...sinNada, pathname: "/pagar", search: "?rut=1", marcaCookie: "cable-magico" }),
    ).toEqual({ tipo: "redirigir", destino: "/cable-magico/pagar?rut=1" });
  });

  it("con sesión manda la empresa del token: un cliente de Cable Mágico ve su sitio", () => {
    expect(
      enrutarMarca({ ...sinNada, pathname: "/portal", marcaToken: "cable-magico" }),
    ).toEqual({ tipo: "redirigir", destino: "/cable-magico/portal" });
  });

  it("con sesión de Finet, una ruta de Cable Mágico vuelve a la de Finet", () => {
    expect(
      enrutarMarca({
        ...sinNada,
        pathname: "/cable-magico/portal/tickets",
        marcaToken: "finet",
        marcaCookie: "cable-magico",
      }),
    ).toEqual({ tipo: "redirigir", destino: "/portal/tickets" });
  });

  it("el token también fija la cookie, para que al cerrar sesión siga en su sitio", () => {
    expect(
      enrutarMarca({
        ...sinNada,
        pathname: "/cable-magico/portal",
        marcaToken: "cable-magico",
        marcaCookie: "finet",
      }),
    ).toEqual({
      tipo: "reescribir",
      destino: "/cable-magico/portal",
      marca: "cable-magico",
      guardarCookie: "cable-magico",
    });
  });

  // OWASP A01: "//sitio" es una URL de otro dominio para el navegador.
  it("nunca redirige fuera del sitio con una ruta que empieza con //", () => {
    const destinos = [
      enrutarMarca({ ...sinNada, pathname: "/finet//evil.example" }),
      enrutarMarca({ ...sinNada, pathname: "/finet//evil.example/x", search: "?a=1" }),
      enrutarMarca({
        ...sinNada,
        pathname: "/cable-magico//evil.example",
        marcaToken: "finet",
      }),
      enrutarMarca({ ...sinNada, pathname: "//evil.example", marcaCookie: "cable-magico" }),
    ].map((d) => d.destino);

    for (const destino of destinos) {
      expect(destino.startsWith("//")).toBe(false);
      expect(destino.startsWith("/")).toBe(true);
    }
    expect(destinos[0]).toBe("/evil.example");
  });

  it("un prefijo que solo se parece no es una marca", () => {
    expect(enrutarMarca({ ...sinNada, pathname: "/cable-magicos" })).toMatchObject({
      tipo: "reescribir",
      destino: "/finet/cable-magicos",
      marca: "finet",
    });
  });
});

/** OWASP A01: después del login solo se vuelve a una página del portal. */
describe("destinoInterno", () => {
  it("acepta una ruta del portal, con o sin prefijo de empresa", () => {
    expect(destinoInterno("/portal/deuda", "/portal")).toBe("/portal/deuda");
    expect(destinoInterno("/cable-magico/portal?x=1", "/portal")).toBe(
      "/cable-magico/portal?x=1",
    );
  });

  it("descarta cualquier destino fuera del portal", () => {
    for (const malo of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "portal",
      "",
    ]) {
      expect(destinoInterno(malo, "/portal")).toBe("/portal");
    }
    expect(destinoInterno(null, "/cable-magico/portal")).toBe("/cable-magico/portal");
  });
});
