import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
let sesion = { isAuthenticated: false, isLoading: false };
jest.mock("@/app/_lib/auth", () => ({ useAuth: () => sesion }));

import RestablecerPasswordPage from "@/app/restablecer-password/page";

// Fija lo que muestra /restablecer-password (CU-03) con y sin el token del
// enlace, para que la lectura del token y el aviso de enlace inválido se
// puedan compartir con el registro (CU-04) sin cambiar esta página.

describe("/restablecer-password", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sesion = { isAuthenticated: false, isLoading: false };
    window.location.hash = "";
  });

  it("sin token: el aviso de enlace inválido, igual que hoy", () => {
    const { container } = render(<RestablecerPasswordPage />);

    expect(screen.getByText("Enlace inválido o expirado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Solicitar nuevo enlace" })).toHaveAttribute(
      "href",
      "/recuperar-password",
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  it("con el token del enlace: el formulario de la contraseña nueva", () => {
    window.location.hash = "#token=abc.def.ghi";

    render(<RestablecerPasswordPage />);

    expect(screen.getByText("Nueva contraseña")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar contraseña")).toBeInTheDocument();
  });

  it("con sesión iniciada va al portal y no muestra nada", () => {
    sesion = { isAuthenticated: true, isLoading: false };
    window.location.hash = "#token=abc.def.ghi";

    const { container } = render(<RestablecerPasswordPage />);

    expect(container).toBeEmptyDOMElement();
    expect(push).toHaveBeenCalledWith("/portal");
  });
});
