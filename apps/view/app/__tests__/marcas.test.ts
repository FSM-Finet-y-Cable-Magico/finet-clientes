import {
  MARCAS,
  enlaceEntreSitios,
  esSlugMarca,
  marcaPorEmpresa,
  marcaPorHost,
  marcaPorSlug,
  rutaMarca,
  separarMarca,
  urlMarca,
} from "@/app/_lib/company";
import { BASE_URL } from "@/app/_lib/consts";

/**
 * Las dos empresas del portal (Documento 0, §6.6): mismo sitio, una marca por
 * empresa. Finet vive en la raíz y Cable Mágico bajo /cable-magico.
 */
describe("marcas", () => {
  it("Finet es la empresa 1 y Cable Mágico la 2, como en la base", () => {
    expect(MARCAS.finet.idEmpresa).toBe(1);
    expect(MARCAS["cable-magico"].idEmpresa).toBe(2);
  });

  it("los datos de Cable Mágico son los que entregó la empresa (11-11)", () => {
    const cm = MARCAS["cable-magico"];
    expect(cm.razonSocial).toBe("Cable Magico Estelar S.A.");
    expect(cm.rut).toBe("76.620.850-9");
    expect(cm.direccion.calle).toBe("Avenida Peñablanca 525");
    expect(MARCAS.finet.direccion.calle).toBe("Avenida Santa Rosa 12980");
    expect(cm.direccion.comuna).toBe("Algarrobo");
    expect(cm.telefono.display).toBe("+56 9 3303 1480");
    expect(cm.whatsappUrl).toBe("https://wa.me/56933031480");
  });

  it("solo finet y cable-magico son marcas", () => {
    expect(esSlugMarca("finet")).toBe(true);
    expect(esSlugMarca("cable-magico")).toBe(true);
    expect(esSlugMarca("otra")).toBe(false);
    expect(esSlugMarca(undefined)).toBe(false);
  });

  it("una marca o empresa desconocida cae en Finet", () => {
    expect(marcaPorSlug("cable-magico")).toBe(MARCAS["cable-magico"]);
    expect(marcaPorSlug("otra")).toBe(MARCAS.finet);
    expect(marcaPorEmpresa(2)).toBe(MARCAS["cable-magico"]);
    expect(marcaPorEmpresa(9)).toBe(MARCAS.finet);
    expect(marcaPorEmpresa(null)).toBe(MARCAS.finet);
  });

  it("las rutas de Cable Mágico llevan su prefijo; las de Finet no", () => {
    expect(rutaMarca(MARCAS.finet, "/planes")).toBe("/planes");
    expect(rutaMarca(MARCAS["cable-magico"], "/planes")).toBe(
      "/cable-magico/planes",
    );
    expect(rutaMarca(MARCAS["cable-magico"], "/")).toBe("/cable-magico");
    expect(rutaMarca(MARCAS.finet, "/")).toBe("/");
  });

  // Sin dominios (hoy): los dos sitios en un host. Con un host por empresa,
  // ver MarcaPorHost.test.ts.
  it("mientras comparten host, la URL de Cable Mágico lleva su prefijo y el host no elige marca", () => {
    expect(urlMarca(MARCAS.finet, "/")).toBe(BASE_URL);
    expect(urlMarca(MARCAS["cable-magico"], "/")).toBe(`${BASE_URL}/cable-magico`);
    expect(urlMarca(MARCAS["cable-magico"], "/planes")).toBe(
      `${BASE_URL}/cable-magico/planes`,
    );
    expect(
      enlaceEntreSitios(MARCAS.finet, MARCAS["cable-magico"], "/planes"),
    ).toBe("/cable-magico/planes");
    expect(marcaPorHost(new URL(BASE_URL).host)).toBeNull();
  });

  it("cada empresa tiene su ícono de pestaña", () => {
    expect(MARCAS.finet.icono).toBe("/favicon.ico");
    expect(MARCAS["cable-magico"].icono).toBe("/brand/CableMagicoIcon.png");
  });

  it("separa la marca de una ruta del navegador", () => {
    expect(separarMarca("/cable-magico/planes")).toEqual({
      marca: MARCAS["cable-magico"],
      ruta: "/planes",
    });
    expect(separarMarca("/cable-magico")).toEqual({
      marca: MARCAS["cable-magico"],
      ruta: "/",
    });
    expect(separarMarca("/planes")).toEqual({
      marca: MARCAS.finet,
      ruta: "/planes",
    });
    // Un prefijo que solo empieza igual no es la marca.
    expect(separarMarca("/cable-magicos")).toEqual({
      marca: MARCAS.finet,
      ruta: "/cable-magicos",
    });
  });
});
