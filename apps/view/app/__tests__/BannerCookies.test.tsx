import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const registrarDecisionCookies = jest.fn().mockResolvedValue({ ok: true });
jest.mock("@/app/_lib/cookies-actions", () => ({
  registrarDecisionCookies: (...args: unknown[]) =>
    registrarDecisionCookies(...args),
}));

import BannerCookies from "@/app/_components/legal/BannerCookies";
import {
  COOKIE_CONSENTIMIENTO,
  olvidarDecision,
  seguimientoPermitido,
} from "@/app/_lib/cookies-consentimiento";

function borrarCookies() {
  for (const c of document.cookie.split(";")) {
    const nombre = c.split("=")[0]?.trim();
    if (nombre) document.cookie = `${nombre}=; max-age=0; path=/`;
  }
}

/**
 * CU-76 / RF-57. Cada bloque nombra la condición del caso de uso que comprueba.
 */
describe("CU-76: banner de consentimiento de cookies", () => {
  beforeEach(() => {
    borrarCookies();
    olvidarDecision();
    registrarDecisionCookies.mockClear();
  });

  // ─── RF-57: aparece al primer ingreso, con aceptar y rechazar ─────────────

  it("aparece cuando el navegador no tiene preferencia guardada", async () => {
    render(<BannerCookies />);

    expect(
      await screen.findByRole("heading", { name: "Cookies y analítica" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aceptar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rechazar" })).toBeInTheDocument();
  });

  it("enlaza a la Política de Privacidad", async () => {
    render(<BannerCookies />);

    const enlace = await screen.findByRole("link", {
      name: "Política de Privacidad",
    });
    expect(enlace).toHaveAttribute("href", "/privacidad");
  });

  // ─── Excepción 1: si ya hay preferencia, no sale ──────────────────────────

  it("NO aparece si ya hay una preferencia registrada (Excepción 1)", async () => {
    document.cookie = `${COOKIE_CONSENTIMIENTO}=valor-cifrado-opaco; path=/`;

    render(<BannerCookies />);

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Cookies y analítica" }),
      ).not.toBeInTheDocument();
    });
  });

  // ─── Poscondición: la decisión se registra y el banner se va ──────────────

  it.each([
    ["Aceptar", "aceptado"],
    ["Rechazar", "rechazado"],
  ])(
    "al pulsar %s oculta el banner y registra la decisión",
    async (boton, decision) => {
      const user = userEvent.setup();
      render(<BannerCookies />);
      await screen.findByRole("button", { name: boton });

      await user.click(screen.getByRole("button", { name: boton }));

      await waitFor(() => {
        expect(
          screen.queryByRole("heading", { name: "Cookies y analítica" }),
        ).not.toBeInTheDocument();
      });
      expect(registrarDecisionCookies).toHaveBeenCalledWith(decision);
    },
  );

  // ─── Descripción: se aplica la configuración de seguimiento ───────────────

  it("tras aceptar, el seguimiento queda permitido", async () => {
    const user = userEvent.setup();
    render(<BannerCookies />);
    await screen.findByRole("button", { name: "Aceptar" });

    await user.click(screen.getByRole("button", { name: "Aceptar" }));

    await expect(seguimientoPermitido()).resolves.toBe(true);
  });

  it("tras rechazar, el seguimiento queda prohibido", async () => {
    const user = userEvent.setup();
    render(<BannerCookies />);
    await screen.findByRole("button", { name: "Rechazar" });

    await user.click(screen.getByRole("button", { name: "Rechazar" }));

    await expect(seguimientoPermitido()).resolves.toBe(false);
  });

  // ─── Operable por teclado (WCAG 2.1.1) ───────────────────────────────────

  it("se puede decidir con el teclado", async () => {
    const user = userEvent.setup();
    render(<BannerCookies />);
    await screen.findByRole("button", { name: "Rechazar" });

    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Rechazar" })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(registrarDecisionCookies).toHaveBeenCalledWith("rechazado");
  });

  // ─── No interrumpe la navegación: no es un diálogo modal ─────────────────

  it("no es un diálogo modal: no atrapa el foco ni bloquea la página", async () => {
    render(<BannerCookies />);
    await screen.findByRole("heading", { name: "Cookies y analítica" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body).not.toHaveAttribute("aria-hidden");
  });
});
