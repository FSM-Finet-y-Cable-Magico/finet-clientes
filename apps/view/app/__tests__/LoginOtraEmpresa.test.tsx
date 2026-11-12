import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginForm from "@/app/components/LoginForm";
import { MarcaProvider } from "@/app/_lib/marca";

/**
 * Con un host por empresa, la sesión queda en el host donde se inicia. Un
 * cliente de Cable Mágico que entra en el sitio de Finet no queda con sesión
 * ahí (proxy.ts la borraría y lo dejaba sin salida): se cierra y se le dice
 * a qué sitio ir.
 */
const CABLE = "http://cablemagico.localhost:18200";
const ANTES = { ...process.env };

// Las marcas leen sus URLs al cargarse, y consts es lo primero que importan:
// así quedan con un host por empresa sin cargar React dos veces.
jest.mock("@/app/_lib/consts", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "http://finet.localhost:18200";
  process.env.NEXT_PUBLIC_SITE_URL_CABLE_MAGICO = "http://cablemagico.localhost:18200";
  return jest.requireActual("@/app/_lib/consts");
});

const push = jest.fn();
const login = jest.fn();
const logout = jest.fn();
const post = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/app/_lib/auth", () => ({
  useAuth: () => ({ login, logout, isAuthenticated: false, isLoading: false }),
}));
jest.mock("@/app/utils/api", () => ({ api: { post: (...a: unknown[]) => post(...a) } }));

afterAll(() => {
  process.env = ANTES;
});

async function entrar(idEmpresa: number) {
  post.mockResolvedValue({
    access_token: "t",
    cliente: { id_cliente: 7, nombre_completo: "Cliente", rut: "1", email: "", telefono: "", id_empresa: idEmpresa },
  });
  render(
    <MarcaProvider slug="finet">
      <LoginForm />
    </MarcaProvider>,
  );
  fireEvent.change(screen.getByLabelText(/^RUT/i), { target: { value: "12.345.678-5" } });
  fireEvent.change(document.getElementById("password")!, { target: { value: "Clave2026" } });
  fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
}

describe("login en el sitio de otra empresa", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logout.mockResolvedValue(true);
  });

  it("un cliente de Cable Mágico en el sitio de Finet no queda con sesión y va al suyo", async () => {
    await entrar(2);
    const enlace = await screen.findByRole("link", { name: "Ingresa desde su sitio" });
    expect(enlace).toHaveAttribute("href", `${CABLE}/inicio-sesion`);
    expect(screen.getByText(/Tu cuenta es de Cable Mágico/)).toBeInTheDocument();
    expect(logout).toHaveBeenCalled();
    expect(login).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("un cliente de Finet entra a su portal", async () => {
    await entrar(1);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/portal"));
    expect(login).toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
  });
});
