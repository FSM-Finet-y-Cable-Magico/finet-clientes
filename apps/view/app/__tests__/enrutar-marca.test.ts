import { enrutarMarca } from "@/app/_lib/enrutar-marca";

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
