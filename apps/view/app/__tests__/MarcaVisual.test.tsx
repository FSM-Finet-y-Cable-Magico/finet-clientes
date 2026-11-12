import { fireEvent, render, screen } from "@testing-library/react";
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

let autenticado = false;
jest.mock("@/app/_lib/auth", () => ({
  useAuth: () => ({ isAuthenticated: autenticado, isLoading: false }),
}));

beforeEach(() => {
  push.mockClear();
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

  it("cambiar a Finet lleva a la misma página de Finet y recuerda la elección", () => {
    conMarca("cable-magico");
    fireEvent.click(screen.getByRole("button", { name: "Finet" }));
    expect(push).toHaveBeenCalledWith("/planes");
    expect(document.cookie).toContain("empresa=finet");
  });

  it("cambiar a Cable Mágico lleva a la misma página con su prefijo", () => {
    pathname = "/empresas";
    conMarca("finet");
    fireEvent.click(screen.getByRole("button", { name: "Cable Mágico" }));
    expect(push).toHaveBeenCalledWith("/cable-magico/empresas");
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

  it("con sesión no aparece: la empresa la fija el token", () => {
    autenticado = true;
    const { container } = conMarca("cable-magico");
    expect(container.innerHTML).toBe("");
  });
});
