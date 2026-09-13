import type { PlanBackend } from "@/app/_lib/api";
import {
  DEFAULT_SHARE_IMAGE,
  SEO_DEFAULTS,
  metadataPlan,
  metadataSeccion,
  resumenPlanes,
} from "@/app/_lib/seo";

const plan: PlanBackend = {
  id_plan: 3,
  nombre_comercial: "Fibra Plus 600",
  tipo_plan: "INTERNET",
  tipo_cliente: "RESIDENCIAL",
  velocidad_mbps: 600,
  precio_mensual: 24990,
  descripcion: "600 Mbps simetricos",
};

describe("metadataSeccion (CU-72)", () => {
  it("genera titulo, descripcion y etiquetas para compartir de la seccion", () => {
    const meta = metadataSeccion({
      path: "/planes",
      title: "Planes de Internet",
      description: "Todos los planes.",
    });

    expect(meta.title).toBe("Planes de Internet");
    expect(meta.description).toBe("Todos los planes.");
    expect(meta.openGraph).toMatchObject({
      url: "/planes",
      siteName: "Finet",
      locale: "es_CL",
      title: "Planes de Internet | Finet",
      description: "Todos los planes.",
      images: [DEFAULT_SHARE_IMAGE],
    });
  });

  // Antes el canonical vivia en el layout y cada pagina lo heredaba: todas se
  // declaraban copia de la home.
  it("declara la propia seccion como canonical", () => {
    expect(metadataSeccion({ path: "/empresas" }).alternates).toEqual({
      canonical: "/empresas",
    });
  });

  it("no fija titulo en twitter para que lo herede de openGraph", () => {
    expect(metadataSeccion({ path: "/tv", title: "TV" }).twitter).toEqual({
      card: "summary_large_image",
    });
  });

  it("respeta el titulo y la descripcion propios para compartir", () => {
    const meta = metadataSeccion({
      path: "/empresas",
      title: "Planes Empresa",
      description: "Para empresas.",
      shareTitle: "Empresas — Finet",
      shareDescription: "Fibra corporativa.",
    });

    expect(meta.openGraph).toMatchObject({
      title: "Empresas — Finet",
      description: "Fibra corporativa.",
    });
  });

  describe("Excepcion 1: sin informacion suficiente", () => {
    it("usa los valores genericos del sitio para titulo, descripcion e imagen", () => {
      const meta = metadataSeccion({ path: "/faqs" });

      expect(meta.title).toEqual({ absolute: SEO_DEFAULTS.title });
      expect(meta.description).toBe(SEO_DEFAULTS.description);
      expect(meta.openGraph).toMatchObject({
        title: SEO_DEFAULTS.shareTitle,
        description: SEO_DEFAULTS.description,
        images: [DEFAULT_SHARE_IMAGE],
      });
    });

    it("trata los textos vacios como ausentes", () => {
      const meta = metadataSeccion({
        path: "/faqs",
        title: "  ",
        description: "",
      });

      expect(meta.title).toEqual({ absolute: SEO_DEFAULTS.title });
      expect(meta.description).toBe(SEO_DEFAULTS.description);
    });
  });
});

describe("resumenPlanes (CU-72)", () => {
  it("toma las cifras desde los datos del catalogo", () => {
    const resumen = resumenPlanes([
      plan,
      { ...plan, id_plan: 4, precio_mensual: 19990, velocidad_mbps: 200 },
      { ...plan, id_plan: 5, precio_mensual: 9990, velocidad_mbps: null },
    ]);

    expect(resumen).toEqual({
      cantidad: 3,
      precioDesde: "$9.990/mes",
      mbpsDesde: 200,
    });
  });

  it("no inventa velocidad si ningun plan la trae", () => {
    expect(
      resumenPlanes([{ ...plan, velocidad_mbps: null }])?.mbpsDesde,
    ).toBeNull();
  });

  // Excepcion 1: sin catalogo la seccion arma su texto sin cifras.
  it("devuelve null si el backend no trae planes", () => {
    expect(resumenPlanes([])).toBeNull();
  });
});

describe("metadataPlan (CU-72)", () => {
  it("genera las etiquetas con los datos del plan", () => {
    const meta = metadataPlan(plan, "/contratar/3");

    expect(meta.title).toBe("Contratar Fibra Plus 600");
    expect(meta.description).toContain("600 Mbps simetricos");
    expect(meta.description).toContain("$24.990/mes");
    expect(meta.alternates).toEqual({ canonical: "/contratar/3" });
    expect(meta.openGraph).toMatchObject({
      url: "/contratar/3",
      title: "Fibra Plus 600 por $24.990/mes | Finet",
    });
  });

  it("es indexable", () => {
    expect(metadataPlan(plan, "/contratar/3").robots).toBeUndefined();
  });

  // Con la clave `images` presente, Next descarta la opengraph-image de la
  // ruta, que es la que muestra el plan.
  it("deja la imagen a la opengraph-image de la ruta", () => {
    expect(metadataPlan(plan, "/contratar/3").openGraph).not.toHaveProperty(
      "images",
    );
    expect(metadataPlan(null, "/contratar/99").openGraph).not.toHaveProperty(
      "images",
    );
  });

  describe("Excepcion 1: sin informacion suficiente", () => {
    it("usa la descripcion generica si el plan no trae la suya", () => {
      const meta = metadataPlan({ ...plan, descripcion: null }, "/contratar/3");

      expect(meta.title).toBe("Contratar Fibra Plus 600");
      expect(meta.description).toBe(SEO_DEFAULTS.description);
    });

    it("usa los valores genericos si el plan no existe", () => {
      const meta = metadataPlan(null, "/contratar/99");

      expect(meta.title).toEqual({ absolute: SEO_DEFAULTS.title });
      expect(meta.description).toBe(SEO_DEFAULTS.description);
      expect(meta.openGraph?.title).toBe(SEO_DEFAULTS.shareTitle);
    });
  });
});
