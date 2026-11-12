import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import PlanCard from "@/app/_components/catalog/PlanCard";
import { MARCAS } from "@/app/_lib/company";
import type { PlanBackend } from "@/app/_lib/api";

const redirect = jest.fn((destino: string) => {
  throw new Error(`redirect:${destino}`);
});
jest.mock("next/navigation", () => ({
  redirect: (destino: string) => redirect(destino),
  notFound: () => {
    throw new Error("notFound");
  },
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/",
}));

const getLandingPlanes = jest.fn<Promise<PlanBackend[]>, [string?, number?]>();
const getPlanById = jest.fn<Promise<PlanBackend | null>, [number]>();
jest.mock("@/app/_lib/api", () => {
  const real = jest.requireActual("@/app/_lib/api");
  return {
    ...real,
    getLandingPlanes: (...a: [string?, number?]) => getLandingPlanes(...a),
    getPlanById: (id: number) => getPlanById(id),
  };
});

function plan(id: number, idEmpresa: number): PlanBackend {
  return {
    id_plan: id,
    id_empresa: idEmpresa,
    nombre_comercial: `Plan ${id}`,
    tipo_plan: "fibra",
    tipo_cliente: "RESIDENCIAL",
    velocidad_mbps: 300,
    precio_mensual: 19990,
    descripcion: null,
  };
}

// El carrusel del inicio pregunta por prefers-reduced-motion; jsdom no lo trae.
beforeAll(() => {
  window.matchMedia ??= ((media: string) => ({
    matches: false,
    media,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

beforeEach(() => {
  getLandingPlanes.mockReset().mockResolvedValue([plan(2, 2)]);
  getPlanById.mockReset();
  redirect.mockClear();
});

/** Cada empresa muestra y vende sus planes (Documento 0, §6.6). */
describe("catálogo por empresa", () => {
  it("la tarjeta de Cable Mágico dice su soporte local y lleva a su contratación", () => {
    render(<PlanCard plan={plan(2, 2)} marca={MARCAS["cable-magico"]} />);
    expect(screen.getByText("Soporte local en Algarrobo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /contratar/i })).toHaveAttribute(
      "href",
      "/cable-magico/contratar/2",
    );
  });

  it("la tarjeta de Finet sigue igual", () => {
    render(<PlanCard plan={plan(1, 1)} marca={MARCAS.finet} />);
    expect(screen.getByText("Soporte local en La Pintana")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /contratar/i })).toHaveAttribute(
      "href",
      "/contratar/1",
    );
  });

  it("el inicio de Cable Mágico pide sus planes y habla de su zona", async () => {
    const { default: Inicio } = await import("@/app/[marca]/page");
    render(await Inicio({ params: Promise.resolve({ marca: "cable-magico" }) }));

    expect(getLandingPlanes).toHaveBeenCalledWith(undefined, 2);
    expect(screen.getByText("Por que elegir Cable Mágico")).toBeInTheDocument();
    expect(screen.getByText("Algarrobo")).toBeInTheDocument();
    expect(screen.getByText("El Quisco")).toBeInTheDocument();
    expect(screen.queryByText("La Pintana")).not.toBeInTheDocument();
  });

  it("/planes de Cable Mágico pide solo sus planes", async () => {
    const { default: Planes } = await import("@/app/[marca]/planes/page");
    render(await Planes({ params: Promise.resolve({ marca: "cable-magico" }) }));
    expect(getLandingPlanes).toHaveBeenCalledWith(undefined, 2);
  });

  it("/empresas de Cable Mágico pide sus planes empresariales", async () => {
    const { default: Empresas } = await import("@/app/[marca]/empresas/page");
    render(await Empresas({ params: Promise.resolve({ marca: "cable-magico" }) }));
    expect(getLandingPlanes).toHaveBeenCalledWith("EMPRESARIAL", 2);
  });

  it("un plan de Cable Mágico abierto en el sitio de Finet lleva a su sitio", async () => {
    getPlanById.mockResolvedValue(plan(2, 2));
    const { default: Contratar } = await import(
      "@/app/[marca]/contratar/[planId]/page"
    );
    await expect(
      Contratar({ params: Promise.resolve({ marca: "finet", planId: "2" }) }),
    ).rejects.toThrow("redirect:/cable-magico/contratar/2");
  });

  it("la contratación genera solo los planes de su empresa", async () => {
    getLandingPlanes.mockResolvedValue([plan(2, 2)]);
    const { generateStaticParams } = await import(
      "@/app/[marca]/contratar/[planId]/page"
    );
    await expect(
      generateStaticParams({ params: { marca: "cable-magico" } }),
    ).resolves.toEqual([{ planId: "2" }]);
    expect(getLandingPlanes).toHaveBeenCalledWith(undefined, 2);
  });
});
