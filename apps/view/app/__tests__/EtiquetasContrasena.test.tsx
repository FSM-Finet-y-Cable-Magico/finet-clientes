import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/app/_lib/auth", () => ({
  useAuth: () => ({ login: jest.fn(), isAuthenticated: false, isLoading: false }),
}));

import RegisterForm from "@/app/components/RegisterForm";
import ResetPasswordForm from "@/app/components/ResetPasswordForm";

// Cada campo de contraseña tiene un id propio y una sola etiqueta que dice qué
// es: así el lector de pantalla y el clic en la etiqueta llevan al campo correcto.

function idsUnicos(container: HTMLElement) {
  const ids = [...container.querySelectorAll("[id]")].map((e) => e.id);
  expect(ids).toEqual([...new Set(ids)]);
}

describe("etiquetas de los campos de contraseña", () => {
  it("restablecer: la nueva contraseña y su confirmación se distinguen", () => {
    const { container } = render(<ResetPasswordForm token="token-de-prueba" />);

    idsUnicos(container);
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("id", "password");
    expect(screen.getByLabelText("Confirmar contraseña")).toHaveAttribute(
      "id",
      "confirmPassword",
    );
  });

  it("registro: la confirmación tiene una sola etiqueta", () => {
    const { container } = render(<RegisterForm />);

    idsUnicos(container);
    expect(container.querySelectorAll('label[for="confirmPassword"]')).toHaveLength(1);
    expect(screen.getByLabelText("Confirmar Contraseña")).toHaveAttribute(
      "id",
      "confirmPassword",
    );
  });
});
