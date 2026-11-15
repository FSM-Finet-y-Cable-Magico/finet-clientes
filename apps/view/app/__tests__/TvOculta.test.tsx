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
 * Rama ppt: no hay contenido de TV que mostrar, así que la sección no se
 * enlaza desde ninguna parte ni se anuncia (decisión de Emilio, 15-11).
 */
describe("TV oculta", () => {
  it("el menú no tiene TV, Canales ni Parrilla", () => {
    const hrefs = navItems.flatMap((i) => [i.href, ...(i.children ?? []).map((c) => c.href)]);
    expect(hrefs.filter((h) => h.startsWith("/tv"))).toEqual([]);
  });

  it("la portada no anuncia televisión ni deja flechas de un carrusel de una sola diapositiva", () => {
    // jsdom no trae matchMedia; el Hero lo usa para el movimiento reducido.
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
    render(<Hero />);
    expect(screen.queryByText(/Televisi[oó]n/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Diapositiva siguiente" })).not.toBeInTheDocument();
    expect(screen.getByText("Internet de Alta Velocidad")).toBeInTheDocument();
  });

  it("el sitemap no lista la TV", async () => {
    jest.mocked(fetchLandingPlanes).mockResolvedValue([]);
    const rutas = (await sitemap()).map((e) => new URL(e.url).pathname);
    expect(rutas.filter((r) => r.includes("/tv"))).toEqual([]);
  });
});
