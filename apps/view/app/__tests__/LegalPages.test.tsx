import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PrivacidadPage from "@/app/[marca]/(legal)/privacidad/page";
import TerminosPage from "@/app/[marca]/(legal)/terminos/page";
import LegalError from "@/app/[marca]/(legal)/error";

const conMarca = (marca: string) => ({ params: Promise.resolve({ marca }) });
import { Correo, Dato } from "@/app/_components/legal/Pendiente";
import { legalLinks } from "@/app/_components/layout/footer/footer.config";

describe("CU-73: acceso desde el pie de pagina", () => {
  it("enlaza Terminos, Privacidad y Reclamos a sus paginas y secciones", () => {
    const hrefs = Object.fromEntries(legalLinks.map((l) => [l.label, l.href]));

    expect(hrefs).toMatchObject({
      Términos: "/terminos",
      Privacidad: "/privacidad",
      Reclamos: "/terminos#reclamos",
      Subtel: "https://tramites.subtel.gob.cl",
    });
  });
});

describe("CU-73: Terminos y Condiciones", () => {
  it("presenta el documento con su indice", async () => {
    render(await TerminosPage(conMarca("finet")));

    expect(
      screen.getByRole("heading", { level: 1, name: /Términos y Condiciones/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("navigation", { name: "Índice" }).length).toBeGreaterThan(0);
  });

  // Los enlaces del footer y las redirecciones de /legal/* apuntan a estas anclas.
  it.each(["planes", "neutralidad", "termino", "reclamos"])(
    "tiene la seccion #%s",
    async (id) => {
      const { container } = render(await TerminosPage(conMarca("finet")));

      expect(container.querySelector(`section#${id}`)).not.toBeNull();
    },
  );

  it("remite el tratamiento de datos a la Politica de Privacidad", async () => {
    const { container } = render(await TerminosPage(conMarca("finet")));
    const seccion = container.querySelector<HTMLElement>("section#datos-personales")!;

    expect(
      within(seccion).getByRole("link", { name: "Política de Privacidad" }),
    ).toHaveAttribute("href", "/privacidad");
  });
});

describe("CU-73: Politica de Privacidad", () => {
  it("presenta el detalle del tratamiento de datos personales", async () => {
    const { container } = render(await PrivacidadPage(conMarca("finet")));

    expect(
      screen.getByRole("heading", { level: 1, name: /Política de Privacidad/ }),
    ).toBeInTheDocument();
    for (const id of ["datos", "finalidades", "cookies", "conservacion", "destinatarios", "derechos"]) {
      expect(container.querySelector(`section#${id}`)).not.toBeNull();
    }
  });

  // Lo declarado tiene que coincidir con lo que el sitio hace: una sola
  // cookie propia y el tema en almacenamiento local.
  it("declara solo los elementos de sesion que el sitio usa", async () => {
    render(await PrivacidadPage(conMarca("finet")));
    const tabla = screen.getByRole("table", { name: "Cookies y almacenamiento del navegador" });

    expect(within(tabla).getAllByRole("row")).toHaveLength(3);
    expect(within(tabla).getByText(/access_token/)).toBeInTheDocument();
  });
});

describe("CU-73: datos pendientes", () => {
  it("muestra el dato cuando ya esta", () => {
    render(<p><Dato valor="76.123.456-7" /></p>);

    expect(screen.getByText("76.123.456-7")).toBeInTheDocument();
  });

  it("deja el hueco anunciado como pendiente cuando falta", () => {
    render(<p><Dato valor={null} /></p>);

    expect(screen.getByText("dato pendiente")).toHaveClass("sr-only");
  });

  it("enlaza el correo cuando ya esta", () => {
    render(<p><Correo valor="privacidad@finet.cl" /></p>);

    expect(screen.getByRole("link", { name: "privacidad@finet.cl" })).toHaveAttribute(
      "href",
      "mailto:privacidad@finet.cl",
    );
  });
});

describe("CU-73, Excepcion 1: la pagina no se puede recuperar", () => {
  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("informa que no esta disponible e invita a intentarlo mas tarde", () => {
    render(<LegalError error={new Error("fallo")} unstable_retry={jest.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /no está disponible en este momento.*Intenta nuevamente más tarde/,
    );
  });

  it("permite reintentar", async () => {
    const reintentar = jest.fn();
    render(<LegalError error={new Error("fallo")} unstable_retry={reintentar} />);

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(reintentar).toHaveBeenCalledTimes(1);
  });
});

/** Las páginas legales de Cable Mágico llevan sus datos (entregados el 11-11). */
describe("CU-73: páginas legales de Cable Mágico", () => {
  it("los Términos dicen su razón social, RUT, domicilio y correo", async () => {
    const { container } = render(await TerminosPage(conMarca("cable-magico")));

    const texto = container.textContent ?? "";
    expect(texto).toContain("Cable Magico Estelar S.A.");
    expect(texto).toContain("76.620.850-9");
    expect(texto).toContain("Avenida Peñablanca 525");
    expect(texto).toContain("pagos@cablemagico.cl");
    expect(texto).not.toContain("Fibernet");
    const seccion = container.querySelector<HTMLElement>("section#datos-personales")!;
    expect(
      within(seccion).getByRole("link", { name: "Política de Privacidad" }),
    ).toHaveAttribute("href", "/cable-magico/privacidad");
  });

  it("la Política de Privacidad nombra a Cable Mágico como responsable", async () => {
    const { container } = render(await PrivacidadPage(conMarca("cable-magico")));

    const texto = container.textContent ?? "";
    expect(texto).toContain("Cable Magico Estelar S.A.");
    expect(texto).toContain("76.620.850-9");
    expect(texto).not.toContain("Fibernet");
  });
});
