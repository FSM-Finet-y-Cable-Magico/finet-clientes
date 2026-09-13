import { fetchLandingPlanes, type PlanBackend } from "@/app/_lib/api";
import { BASE_URL } from "@/app/_lib/consts";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

jest.mock("@/app/_lib/api", () => ({
  fetchLandingPlanes: jest.fn(),
}));

const fetchPlanes = jest.mocked(fetchLandingPlanes);

const plan = (id_plan: number): PlanBackend => ({
  id_plan,
  nombre_comercial: `Plan ${id_plan}`,
  tipo_plan: "INTERNET",
  tipo_cliente: "RESIDENCIAL",
  velocidad_mbps: 600,
  precio_mensual: 24990,
  descripcion: null,
});

const urls = (entradas: Awaited<ReturnType<typeof sitemap>>) =>
  entradas.map((e) => e.url.replace(BASE_URL, "") || "/");

describe("sitemap.xml (CU-74)", () => {
  beforeEach(() => {
    fetchPlanes.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("lista las rutas publicas indexables y un enlace por plan", async () => {
    fetchPlanes.mockResolvedValue([plan(3), plan(4)]);

    const rutas = urls(await sitemap());

    expect(rutas).toEqual(
      expect.arrayContaining([
        "/",
        "/planes",
        "/consultar-deuda",
        "/inicio-sesion",
        "/terminos",
        "/privacidad",
        "/contratar/3",
        "/contratar/4",
      ]),
    );
  });

  it("deja fuera las no indexables y la plantilla del plan", async () => {
    fetchPlanes.mockResolvedValue([plan(3)]);

    const rutas = urls(await sitemap());

    expect(rutas).not.toContain("/recuperar-password");
    expect(rutas).not.toContain("/restablecer-password");
    expect(rutas).not.toContain("/contratar/[planId]");
    expect(rutas.some((r) => r.startsWith("/portal"))).toBe(false);
  });

  it("no inventa fechas de modificacion", async () => {
    fetchPlanes.mockResolvedValue([plan(3)]);

    for (const entrada of await sitemap()) {
      expect(entrada).not.toHaveProperty("lastModified");
    }
  });

  // Lanzar es lo que conserva la version valida: en runtime Next sigue
  // sirviendo la anterior, y en el build falla y queda el deploy anterior.
  describe("Excepcion 1: no puede leer el catalogo", () => {
    it.each([
      ["el backend responde con error", new Error("Error al obtener planes: 503")],
      ["el backend no esta disponible", new TypeError("fetch failed")],
    ])("no genera un sitemap sin planes si %s, y lo registra", async (_, error) => {
      fetchPlanes.mockRejectedValue(error);

      await expect(sitemap()).rejects.toBe(error);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("[CU-74]"),
        error,
      );
    });
  });
});

describe("robots.txt (CU-74)", () => {
  it("bloquea las rutas privadas y apunta al sitemap", () => {
    const { rules, sitemap: url } = robots();

    expect(rules).toMatchObject({
      userAgent: "*",
      allow: "/",
      disallow: expect.arrayContaining(["/portal", "/perfil"]),
    });
    expect(url).toBe(`${BASE_URL}/sitemap.xml`);
  });

  // Bloquearlas impediria que el buscador lea su noindex.
  it("no bloquea las publicas no indexables", () => {
    const { rules } = robots();
    const disallow = [rules].flat().flatMap((r) => [r.disallow ?? []].flat());

    expect(disallow).not.toContain("/recuperar-password");
    expect(disallow).not.toContain("/restablecer-password");
  });
});
