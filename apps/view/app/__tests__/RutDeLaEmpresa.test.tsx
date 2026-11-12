import "@testing-library/jest-dom";
import { act, fireEvent, render } from "@testing-library/react";
import LoginForm from "@/app/components/LoginForm";
import RecoveryForm from "@/app/components/RecoveryForm";
import RegistroForm from "@/app/components/RegistroForm";
import { MarcaProvider } from "@/app/_lib/marca";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/app/_lib/auth", () => ({
  useAuth: () => ({
    login: jest.fn(),
    logout: jest.fn(),
    isAuthenticated: false,
    isLoading: false,
  }),
}));
const post = jest.fn();
jest.mock("@/app/utils/api", () => ({ api: { post: (...a: unknown[]) => post(...a) } }));

beforeEach(() => {
  post.mockReset().mockResolvedValue({});
});

async function enviar(ui: React.ReactElement, valores: string[]) {
  const { container } = render(<MarcaProvider slug="cable-magico">{ui}</MarcaProvider>);
  const campos = container.querySelectorAll<HTMLInputElement>('input:not([type="checkbox"])');
  valores.forEach((v, i) => fireEvent.change(campos[i], { target: { value: v } }));
  await act(async () => {
    fireEvent.submit(container.querySelector("form")!);
  });
}

/**
 * La misma persona puede ser cliente de Finet y de Cable Mágico. Cada sitio
 * le dice al backend de qué empresa es, para que busque el RUT entre sus
 * clientes: si no, la recuperación cambiaba la clave de un registro y el
 * login pedía la del otro (prueba de Emilio en la VPS, 12-11).
 */
describe("cada sitio busca el RUT en su empresa", () => {
  it("el login", async () => {
    await enviar(<LoginForm />, ["12.345.678-5", "Clave2026"]);
    expect(post).toHaveBeenCalledWith("/auth/login", {
      rut: "123456785",
      password: "Clave2026",
      id_empresa: 2,
    });
  });

  it("la recuperación de contraseña", async () => {
    await enviar(<RecoveryForm />, ["12.345.678-5"]);
    expect(post).toHaveBeenCalledWith("/auth/recuperar-password", {
      rut: "123456785",
      id_empresa: 2,
    });
  });

  it("el registro", async () => {
    await enviar(<RegistroForm onIniciarSesion={() => {}} />, ["12.345.678-5"]);
    expect(post).toHaveBeenCalledWith("/auth/registro", {
      rut: "123456785",
      id_empresa: 2,
    });
  });
});
