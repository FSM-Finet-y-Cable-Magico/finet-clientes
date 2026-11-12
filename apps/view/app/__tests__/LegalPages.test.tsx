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

/** Solo lo que exige una norma; lo que ninguna pide no se publica (Emilio, 12-11). */
describe("CU-73: Terminos con respaldo normativo", () => {
  it("no publica lo que ninguna norma exige: direccionamiento IP ni tribunales", async () => {
    const { container } = render(await TerminosPage(conMarca("finet")));

    expect(container.textContent).not.toMatch(/Direccionamiento IP|tribunales/);
  });

  it("identifica al representante legal (DS 6/2021, art. 7 N° 6)", async () => {
    render(await TerminosPage(conMarca("finet")));

    expect(screen.getByText(/Representante legal/)).toBeInTheDocument();
  });

  it("publica lo que el Decreto 368 pide de cada plan, con su norma", async () => {
    render(await TerminosPage(conMarca("finet")));
    const tabla = screen.getByRole("table", { name: "Características del servicio" });

    for (const fila of [/Límite de descarga/, /Tasa de agregación o sobreventa/, /nacional e internacional/]) {
      expect(within(tabla).getAllByRole("rowheader", { name: fila }).length).toBeGreaterThan(0);
    }
    expect(within(tabla).getByText("Ley N° 18.168, art. 24 K")).toBeInTheDocument();
  });

  it("los indicadores trimestrales son los del Decreto 368, art. 5 letras c y d", async () => {
    render(await TerminosPage(conMarca("finet")));
    const tabla = screen.getByRole("table", { name: "Indicadores de calidad medidos por trimestre" });

    expect(within(tabla).getAllByRole("row")).toHaveLength(8);
    expect(within(tabla).getByRole("rowheader", { name: /login/ })).toBeInTheDocument();
    expect(within(tabla).getByRole("rowheader", { name: /tiempo objetivo/ })).toBeInTheDocument();
  });

  it("publica la gestión de tráfico y el control parental (Decreto 368, arts. 5 f y 9)", async () => {
    const { container } = render(await TerminosPage(conMarca("finet")));

    expect(container.querySelector("h3#gestion-trafico")).not.toBeNull();
    expect(container.querySelector("h3#control-parental")).not.toBeNull();
  });

  it("la compensación por interrupciones es la del art. 27 de la Ley 18.168", async () => {
    const { container } = render(await TerminosPage(conMarca("finet")));
    const seccion = container.querySelector<HTMLElement>("section#interrupciones")!;

    expect(seccion).toHaveTextContent(/un día por cada 24 horas/);
    expect(seccion).toHaveTextContent(/triple de la tarifa diaria/);
    expect(within(seccion).queryByText("dato pendiente")).toBeNull();
  });

  // DS 6/2021, art. 7 N° 4 y DS 194, art. 5: basta el teléfono; el correo es opcional.
  it("sin correo de contacto no deja huecos donde basta el teléfono", async () => {
    const { container } = render(await TerminosPage(conMarca("finet")));

    for (const id of ["uso", "termino"]) {
      const seccion = container.querySelector<HTMLElement>(`section#${id}`)!;
      expect(within(seccion).queryByText("dato pendiente")).toBeNull();
    }
    expect(container.querySelector("section#uso")).toHaveTextContent(/WhatsApp o al \+56 9 4500 2319\./);
  });

  it("reclamos: los plazos de Subtel y el texto del reglamento (DS 194, arts. 14, 16 y 33)", async () => {
    const { container } = render(await TerminosPage(conMarca("finet")));
    const seccion = container.querySelector<HTMLElement>("section#reclamos")!;

    expect(seccion).toHaveTextContent(/30 días hábiles/);
    expect(seccion).toHaveTextContent(/15 días hábiles/);
    expect(within(seccion).getByRole("link", { name: /Decreto N° 194/ })).toHaveAttribute(
      "href",
      "https://www.bcn.cl/leychile/navegar?idNorma=1048887",
    );
    expect(
      within(seccion).getByRole("table", { name: /línea telefónica de reclamos/ }),
    ).toBeInTheDocument();
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

/** Ley 19.628, art. 14 ter (Ley 21.719, desde el 1-12-2026): lo que se informa. */
describe("CU-73: Politica de Privacidad con respaldo normativo", () => {
  it("identifica al responsable con su representante legal (letra b)", async () => {
    render(await PrivacidadPage(conMarca("finet")));
    const tabla = screen.getByRole("table", { name: "Responsable del tratamiento de datos" });

    expect(within(tabla).getByRole("rowheader", { name: "Representante legal" })).toBeInTheDocument();
  });

  it("nombra a los proveedores reales: Transbank, y ya no Railway (letra d)", async () => {
    const { container } = render(await PrivacidadPage(conMarca("finet")));

    expect(container.textContent).toContain("Transbank (Webpay)");
    expect(container.textContent).not.toContain("Railway");
  });

  it("informa las transferencias internacionales (letra h)", async () => {
    const { container } = render(await PrivacidadPage(conMarca("finet")));

    expect(
      within(container.querySelector<HTMLElement>("section#transferencias")!).getByRole("heading", {
        name: /Transferencias internacionales/,
      }),
    ).toBeInTheDocument();
  });

  it("el plazo de respuesta es el de la ley: hoy y desde la Ley 21.719", async () => {
    const { container } = render(await PrivacidadPage(conMarca("finet")));
    const seccion = container.querySelector<HTMLElement>("section#derechos")!;

    expect(seccion).toHaveTextContent(/2 días hábiles/);
    expect(seccion).toHaveTextContent(/30 días corridos/);
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
