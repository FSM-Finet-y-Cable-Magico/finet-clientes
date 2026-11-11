import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import Footer from "@/app/_components/layout/footer/Footer";
import AudienceSwitch from "@/app/_components/layout/navbar/AudienceSwitch";
import DesktopNavItem from "@/app/_components/layout/navbar/DesktopNavItem";
import PagaTuCuentaButton from "@/app/_components/layout/navbar/PagaTuCuentaButton";
import PortalClienteButton from "@/app/_components/layout/navbar/PortalClienteButton";
import { audienceSwitch } from "@/app/_components/layout/navbar/nav.config";
import { MarcaProvider } from "@/app/_lib/marca";
import { MARCAS } from "@/app/_lib/company";

let pathname = "/cable-magico";
jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: jest.fn() }),
}));

function enCable(ui: React.ReactNode) {
  return render(<MarcaProvider slug="cable-magico">{ui}</MarcaProvider>);
}

/** El sitio de cada empresa enlaza a sus propias páginas y contactos. */
describe("pie de página por empresa", () => {
  it("Cable Mágico: sus páginas, su WhatsApp, su Instagram y su razón social", () => {
    render(<Footer marca={MARCAS["cable-magico"]} />);

    expect(screen.getByRole("link", { name: /paga tu cuenta/i })).toHaveAttribute(
      "href",
      "/cable-magico/consultar-deuda",
    );
    expect(screen.getByRole("link", { name: "Términos" })).toHaveAttribute(
      "href",
      "/cable-magico/terminos",
    );
    expect(screen.getByRole("link", { name: "Escríbenos por WhatsApp" })).toHaveAttribute(
      "href",
      "https://wa.me/56933031480",
    );
    expect(screen.getByRole("link", { name: "Síguenos en Instagram" })).toHaveAttribute(
      "href",
      "https://www.instagram.com/cablemagicoestelar/",
    );
    expect(screen.getByText(/Cable Magico Estelar S\.A\./)).toBeInTheDocument();
  });

  it("Finet sigue igual", () => {
    render(<Footer marca={MARCAS.finet} />);

    expect(screen.getByRole("link", { name: /paga tu cuenta/i })).toHaveAttribute(
      "href",
      "/consultar-deuda",
    );
    expect(screen.getByRole("link", { name: "Escríbenos por WhatsApp" })).toHaveAttribute(
      "href",
      "https://wa.me/56945002319",
    );
    expect(screen.getByText(/Fibernet Limitada/)).toBeInTheDocument();
  });
});

describe("barra de navegación por empresa", () => {
  it("Personas / Empresas llevan al sitio de Cable Mágico y marcan dónde está", () => {
    pathname = "/cable-magico/empresas";
    enCable(<AudienceSwitch items={audienceSwitch} />);

    const empresas = screen.getByRole("link", { name: "Empresas" });
    expect(empresas).toHaveAttribute("href", "/cable-magico/empresas");
    expect(empresas).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Personas" })).toHaveAttribute(
      "href",
      "/cable-magico",
    );
  });

  it("un enlace de la barra marca la página actual aunque lleve el prefijo", () => {
    pathname = "/cable-magico/planes";
    enCable(<DesktopNavItem item={{ label: "Planes", href: "/planes" }} />);

    const planes = screen.getByRole("link", { name: "Planes" });
    expect(planes).toHaveAttribute("href", "/cable-magico/planes");
    expect(planes).toHaveAttribute("aria-current", "page");
  });

  it("Paga tu cuenta y Portal Cliente van a las páginas de Cable Mágico", () => {
    enCable(
      <>
        <PagaTuCuentaButton />
        <PortalClienteButton />
      </>,
    );
    expect(screen.getByRole("link", { name: /paga tu cuenta/i })).toHaveAttribute(
      "href",
      "/cable-magico/consultar-deuda",
    );
    expect(screen.getByRole("link", { name: /portal cliente/i })).toHaveAttribute(
      "href",
      "/cable-magico/inicio-sesion",
    );
  });
});
