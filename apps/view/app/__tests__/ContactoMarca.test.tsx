import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

/** Cada sitio da los contactos y la zona de su propia empresa. */
describe("ayuda de cada empresa", () => {
  it("Cable Mágico: su WhatsApp y sus comunas, también en los datos para Google", async () => {
    const { default: Ayuda } = await import("@/app/[marca]/ayuda/page");
    const { container } = render(
      await Ayuda({ params: Promise.resolve({ marca: "cable-magico" }) }),
    );

    expect(
      screen.getAllByRole("link").some(
        (a) => a.getAttribute("href") === "https://wa.me/56933031480",
      ),
    ).toBe(true);
    expect(container.textContent).toContain("cobertura en Algarrobo y El Quisco");
    const jsonLd = container.querySelector('script[type="application/ld+json"]');
    expect(jsonLd?.innerHTML).toContain("Algarrobo y El Quisco");
    expect(container.textContent).not.toContain("La Pintana");
  });

  it("Finet sigue igual", async () => {
    const { default: Ayuda } = await import("@/app/[marca]/ayuda/page");
    const { container } = render(
      await Ayuda({ params: Promise.resolve({ marca: "finet" }) }),
    );

    expect(container.textContent).toContain(
      "cobertura en La Pintana, Puente Alto, La Florida y La Granja",
    );
    expect(
      screen.getAllByRole("link").some(
        (a) => a.getAttribute("href") === "https://wa.me/56945002319",
      ),
    ).toBe(true);
  });
});
