import { fetchLandingPlanes, type PlanBackend } from "@/app/_lib/api";
import { BASE_URL } from "@/app/_lib/consts";
import { MARCAS } from "@/app/_lib/company";
import { metadataPlan, metadataSeccion, seoDe } from "@/app/_lib/seo";
import { organizacionJsonLd, productJsonLd } from "@/app/_lib/jsonld";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";

jest.mock("@/app/_lib/api", () => ({
  ...jest.requireActual("@/app/_lib/api"),
  fetchLandingPlanes: jest.fn(),
}));
const fetchPlanes = jest.mocked(fetchLandingPlanes);

// El layout se importa solo por su generateMetadata; el shell (barra, pie,
// aviso de cookies con jose) no hace falta para eso.
jest.mock("@/app/_components/layout/MarcaShell", () => ({
  __esModule: true,
  default: () => null,
}));

const CM = MARCAS["cable-magico"];

function plan(id: number, idEmpresa: number, nombre = `Plan ${id}`): PlanBackend {
  return {
    id_plan: id,
    id_empresa: idEmpresa,
    nombre_comercial: nombre,
    tipo_plan: "fibra",
    tipo_cliente: "RESIDENCIAL",
    velocidad_mbps: 300,
    precio_mensual: 19990,
    descripcion: "Fibra simetrica",
  };
}

/** SEO de cada empresa: sus URLs, su nombre y su zona (CU-72 y CU-74). */
describe("metadata por empresa", () => {
  it("una sección de Cable Mágico declara su URL, su nombre y su imagen", () => {
    const meta = metadataSeccion({ path: "/empresas", title: "Planes Empresa" }, CM);

    expect(meta.alternates).toEqual({ canonical: "/cable-magico/empresas" });
    expect(meta.openGraph).toMatchObject({
      url: "/cable-magico/empresas",
      siteName: "Cable Mágico",
      title: "Planes Empresa | Cable Mágico",
      images: [expect.objectContaining({ url: "/cable-magico/opengraph-image" })],
    });
  });

  it("sin datos propios usa los valores de Cable Mágico, con su zona", () => {
    const meta = metadataSeccion({ path: "/faqs" }, CM);
    expect(meta.title).toEqual({ absolute: seoDe(CM).title });
    expect(seoDe(CM).title).toContain("Cable Mágico");
    expect(seoDe(CM).description).toContain("Algarrobo y El Quisco");
  });

  it("Finet conserva sus valores de siempre", () => {
    expect(seoDe(MARCAS.finet)).toEqual({
      title: "Finet — Internet Fibra Optica y TV Digital | La Pintana, Puente Alto",
      shareTitle: "Finet — Internet Fibra Optica y TV Digital",
      description:
        "Internet de fibra optica simetrica de alta velocidad. Planes hogar y empresa en La Pintana, Puente Alto, La Florida y La Granja. Contrata en linea.",
    });
  });

  it("un plan de Cable Mágico se publica en su sitio y con su zona", () => {
    const meta = metadataPlan(plan(2, 2), "/contratar/2", CM);
    expect(meta.alternates).toEqual({ canonical: "/cable-magico/contratar/2" });
    expect(meta.description).toContain("Algarrobo y El Quisco");
    expect(meta.openGraph).toMatchObject({ title: expect.stringContaining("Cable Mágico") });
  });

  it("las páginas de Cable Mágico describen su zona, no la de Finet", async () => {
    const { generateMetadata } = await import("@/app/[marca]/empresas/page");
    const meta = await generateMetadata({ params: Promise.resolve({ marca: "cable-magico" }) });
    expect(String(meta.description)).toContain("Algarrobo y El Quisco");
    expect(JSON.stringify(meta)).not.toContain("La Pintana");
  });

  it("el layout de Cable Mágico pone su nombre en el título y en la app", async () => {
    const { generateMetadata } = await import("@/app/[marca]/layout");
    const meta = await generateMetadata({ params: Promise.resolve({ marca: "cable-magico" }) });
    expect(meta.title).toMatchObject({ template: expect.stringContaining("Cable Mágico") });
    expect(meta.appleWebApp).toMatchObject({ title: "Cable Mágico" });
    expect(meta.authors).toEqual([{ name: "Cable Magico Estelar S.A." }]);
  });
});

describe("datos estructurados por empresa", () => {
  it("la organización de Cable Mágico lleva su razón social, RUT, teléfono y dirección", () => {
    const org = JSON.parse(organizacionJsonLd(CM));
    expect(org).toMatchObject({
      "@type": "Organization",
      name: "Cable Magico Estelar S.A.",
      alternateName: "Cable Mágico",
      taxID: "76.620.850-9",
      url: `${BASE_URL}/cable-magico`,
      address: expect.objectContaining({
        streetAddress: "Avenida Peñablanca 525",
        addressLocality: "Algarrobo",
      }),
    });
  });

  it("el producto de un plan de Cable Mágico es de su marca y apunta a su sitio", () => {
    const producto = JSON.parse(productJsonLd(plan(2, 2), CM));
    expect(producto.brand.name).toBe("Cable Mágico");
    expect(producto.offers.url).toBe(`${BASE_URL}/cable-magico/contratar/2`);
  });

  it("un nombre con </script> no puede cerrar la etiqueta del JSON-LD", () => {
    const texto = productJsonLd(plan(2, 2, "</script><script>alert(1)</script>"), CM);
    expect(texto).not.toContain("</script>");
    expect(JSON.parse(texto).name).toBe("</script><script>alert(1)</script>");
  });
});

describe("sitemap y robots de las dos empresas", () => {
  beforeEach(() => {
    fetchPlanes.mockReset();
    fetchPlanes.mockImplementation(async (_tipo?: string, idEmpresa?: number) =>
      idEmpresa === 2 ? [plan(2, 2)] : [plan(1, 1)],
    );
  });

  it("publica las páginas y los planes de cada empresa en su sitio", async () => {
    const urls = (await sitemap()).map((e) => e.url.replace(BASE_URL, "") || "/");
    expect(urls).toEqual(
      expect.arrayContaining([
        "/",
        "/planes",
        "/contratar/1",
        "/cable-magico",
        "/cable-magico/planes",
        "/cable-magico/contratar/2",
      ]),
    );
    expect(urls).not.toContain("/contratar/2");
    expect(urls).not.toContain("/cable-magico/contratar/1");
  });

  it("robots no indexa el portal de ninguna de las dos", () => {
    const { rules } = robots();
    const disallow = (Array.isArray(rules) ? rules[0] : rules).disallow;
    expect(disallow).toEqual(
      expect.arrayContaining(["/portal", "/perfil", "/cable-magico/portal", "/cable-magico/perfil"]),
    );
  });
});
