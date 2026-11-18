import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { fetchLandingPlanes } from "@/app/_lib/api";
import { navItems } from "@/app/_components/layout/navbar/nav.config";
import { Hero } from "@/app/_components/layout/hero/Hero";
import sitemap from "@/app/sitemap";

jest.mock("@/app/_lib/api", () => ({
  fetchLandingPlanes: jest.fn(),
}));

/**
 * Rama ppt: no hay contenido de TV que mostrar, así que las páginas de TV no se
 * enlazan desde el menú ni van al sitemap (decisión de Emilio, 15-11).
 */
describe("TV oculta", () => {
  it("el menú no tiene TV, Canales ni Parrilla", () => {
    const hrefs = navItems.flatMap((i) => [i.href, ...(i.children ?? []).map((c) => c.href)]);
    expect(hrefs.filter((h) => h.startsWith("/tv"))).toEqual([]);
  });

  // El carrusel de la portada sí queda con sus dos diapositivas (CU-16; Emilio,
  // 18-11: «el carrusel tiene que estar»).
  it("la portada mantiene el carrusel con sus dos diapositivas, flechas y puntos (CU-16)", () => {
    // jsdom no trae matchMedia; el Hero lo usa para el movimiento reducido.
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
    render(<Hero />);
    expect(screen.getByText("Internet de Alta Velocidad")).toBeInTheDocument();
    expect(screen.getByText("Television Digital HD")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Diapositiva anterior" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Diapositiva siguiente" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("el sitemap no lista la TV", async () => {
    jest.mocked(fetchLandingPlanes).mockResolvedValue([]);
    const rutas = (await sitemap()).map((e) => new URL(e.url).pathname);
    expect(rutas.filter((r) => r.includes("/tv"))).toEqual([]);
  });
});
