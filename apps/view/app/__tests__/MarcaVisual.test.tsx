import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import NavLogo from "@/app/_components/layout/navbar/NavLogo";
import LoginBranding from "@/app/components/LoginBranding";
import SelectorMarca from "@/app/_components/layout/navbar/SelectorMarca";
import { MarcaProvider } from "@/app/_lib/marca";
import { MARCAS } from "@/app/_lib/company";

const push = jest.fn();
let pathname = "/cable-magico/planes";
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
}));

// La página completa: jsdom no deja reemplazar window.location.
const irA = jest.fn();
jest.mock("@/app/_lib/navegar", () => ({ irA: (url: string) => irA(url) }));

let autenticado = false;
const logout = jest.fn().mockResolvedValue(true);
jest.mock("@/app/_lib/auth", () => ({
  useAuth: () => ({ isAuthenticated: autenticado, isLoading: false, logout }),
}));

beforeEach(() => {
  push.mockClear();
  irA.mockClear();
  logout.mockClear();
  autenticado = false;
  pathname = "/cable-magico/planes";
  document.cookie = "empresa=; max-age=0; path=/";
});

/** Lo que le llega a Cable Mágico es de Cable Mágico (Emilio, 11-11). */
describe("logo de cada empresa", () => {
  it("la barra lleva el logo de Cable Mágico y vuelve a su inicio", () => {
    render(<NavLogo marca={MARCAS["cable-magico"]} />);
    const logo = screen.getByAltText("Cable Mágico — Internet y TV");
    expect(logo.getAttribute("src")).toContain("CableMagicoLogo.webp");
    expect(logo.closest("a")?.getAttribute("href")).toBe("/cable-magico");
  });

  it("la barra de Finet sigue igual", () => {
    render(<NavLogo marca={MARCAS.finet} />);
    expect(
      screen.getByAltText("Finet — Internet y TV").closest("a")?.getAttribute("href"),
    ).toBe("/");
  });

  it("el login de Cable Mágico lleva su logo", () => {
    render(
      <MarcaProvider slug="cable-magico">
        <LoginBranding />
      </MarcaProvider>,
    );
    expect(screen.getByAltText("Cable Mágico — Internet y TV")).toBeTruthy();
  });
});

/** Como el selector de empresa de G3: se elige Finet o Cable Mágico. */
describe("selector de empresa", () => {
  function conMarca(slug: "finet" | "cable-magico") {
    return render(
      <MarcaProvider slug={slug}>
        <SelectorMarca />
      </MarcaProvider>,
    );
  }

  it("marca la empresa del sitio en que está", () => {
    conMarca("cable-magico");
    expect(
      screen.getByRole("button", { name: "Cable Mágico" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "Finet" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  // Rama ppt: página completa a la ruta explícita de la empresa. Con
  // router.push, la caché del router servía una redirección vieja a la otra
  // empresa (15-11: elegía Finet y volvía a Cable Mágico).
  it("cambiar a Finet carga la misma página de Finet por /finet/… y recuerda la elección", async () => {
    conMarca("cable-magico");
    fireEvent.click(screen.getByRole("button", { name: "Finet" }));
    await waitFor(() => expect(irA).toHaveBeenCalledWith("/finet/planes"));
    expect(push).not.toHaveBeenCalled();
    expect(document.cookie).toContain("empresa=finet");
  });

  it("cambiar a Cable Mágico carga la misma página con su prefijo", async () => {
    pathname = "/empresas";
    conMarca("finet");
    fireEvent.click(screen.getByRole("button", { name: "Cable Mágico" }));
    await waitFor(() => expect(irA).toHaveBeenCalledWith("/cable-magico/empresas"));
    expect(push).not.toHaveBeenCalled();
    expect(document.cookie).toContain("empresa=cable-magico");
  });

  it("en producción se apaga desde el .env", () => {
    process.env.NEXT_PUBLIC_SELECTOR_EMPRESA = "false";
    try {
      const { container } = conMarca("cable-magico");
      expect(container.innerHTML).toBe("");
    } finally {
      delete process.env.NEXT_PUBLIC_SELECTOR_EMPRESA;
    }
  });

  // Rama ppt (Emilio, 15-11): el selector se ve siempre. Con sesión, la
  // empresa la fija el token, así que para pasar a la otra se cierra la sesión.
  it("con sesión también aparece y, al cambiar de empresa, cierra la sesión antes de ir", async () => {
    autenticado = true;
    conMarca("cable-magico");
    fireEvent.click(screen.getByRole("button", { name: "Finet" }));
    await waitFor(() => expect(irA).toHaveBeenCalledWith("/finet/planes"));
    expect(logout).toHaveBeenCalled();
    expect(logout.mock.invocationCallOrder[0]).toBeLessThan(irA.mock.invocationCallOrder[0]);
  });

  it("elegir la empresa en que ya está no cierra la sesión", () => {
    autenticado = true;
    conMarca("cable-magico");
    fireEvent.click(screen.getByRole("button", { name: "Cable Mágico" }));
    expect(logout).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(irA).not.toHaveBeenCalled();
  });
});
