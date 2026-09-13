import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("@/app/_lib/auth", () => ({
  useAuth: () => ({ login: jest.fn(), isAuthenticated: false, isLoading: false }),
}));
jest.mock("@/app/utils/api", () => ({ api: { post: jest.fn() } }));

import FormularioContratacion from "@/app/_components/catalog/FormularioContratacion";
import RegisterForm from "@/app/components/RegisterForm";
import type { PlanBackend } from "@/app/_lib/api";
import { POLITICA_PRIVACIDAD_VERSION } from "@/app/_lib/legal";
import { api } from "@/app/utils/api";

const MENSAJE = "Debes aceptar la Política de Privacidad para continuar.";

const plan: PlanBackend = {
  id_plan: 3,
  nombre_comercial: "Fibra Plus 600",
  tipo_plan: "INTERNET",
  tipo_cliente: "RESIDENCIAL",
  velocidad_mbps: 600,
  precio_mensual: 24990,
  descripcion: null,
};

describe("CU-75: formulario de contratación", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  async function completarFormulario() {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nombre completo"), "Juan Pérez Soto");
    await user.type(screen.getByLabelText("RUT"), "11.111.111-1");
    await user.type(screen.getByLabelText("Correo electronico"), "juan@ejemplo.cl");
    await user.type(screen.getByLabelText("Telefono movil"), "+56 9 1234 5678");
    await user.type(screen.getByLabelText("Calle + numero"), "Av. Siempre Viva 742");
    await user.type(screen.getByLabelText("Comuna"), "La Pintana");
    return user;
  }

  it("presenta la casilla con enlace directo a la Política de Privacidad", () => {
    render(<FormularioContratacion plan={plan} />);

    expect(screen.getByRole("checkbox", { name: /acepto la Política de Privacidad/ })).not.toBeChecked();
    expect(screen.getByRole("link", { name: /Política de Privacidad/ })).toHaveAttribute(
      "href",
      "/privacidad",
    );
  });

  // Excepción 1
  it("bloquea el envío sin la casilla e informa que debe aceptar la política", async () => {
    render(<FormularioContratacion plan={plan} />);
    await completarFormulario();

    fireEvent.submit(screen.getByRole("button", { name: "Enviar solicitud" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(MENSAJE);
    expect(screen.getByRole("checkbox")).toHaveFocus();
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envía la aceptación junto con los datos, con los nombres del backend, y confirma el registro", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<FormularioContratacion plan={plan} />);
    const user = await completarFormulario();

    await user.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("button", { name: "Enviar solicitud" }));

    await screen.findByText("Solicitud enviada");
    expect(screen.getByText(/quedó registrada tu aceptación de la Política de Privacidad/)).toBeInTheDocument();
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/contrataciones$/);
    expect(JSON.parse(opciones.body)).toEqual({
      id_plan: 3,
      nombre_completo: "Juan Pérez Soto",
      rut: "11.111.111-1",
      email: "juan@ejemplo.cl",
      telefono: "+56 9 1234 5678",
      direccion_completa: "Av. Siempre Viva 742",
      comuna: "La Pintana",
      acepta_politica_privacidad: true,
      version_politica_privacidad: POLITICA_PRIVACIDAD_VERSION,
    });
  });

  it("muestra el mensaje que devuelve el backend si rechaza la solicitud", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ message: "El RUT ya está registrado" }),
    });
    render(<FormularioContratacion plan={plan} />);
    const user = await completarFormulario();

    await user.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("button", { name: "Enviar solicitud" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El RUT ya está registrado");
  });
});

describe("CU-75: formulario de registro de cuenta", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function completarRegistro(container: HTMLElement) {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nombre completo"), "Juan Pérez");
    await user.type(screen.getByLabelText("Email"), "juan@ejemplo.cl");
    await user.type(container.querySelector<HTMLInputElement>("#rut")!, "11.111.111-1");
    await user.type(container.querySelector<HTMLInputElement>("#password")!, "Password1");
    await user.type(container.querySelector<HTMLInputElement>("#confirmPassword")!, "Password1");
    return user;
  }

  // Excepción 1
  it("bloquea el registro sin la casilla e informa que debe aceptar la política", async () => {
    const { container } = render(<RegisterForm />);
    const user = await completarRegistro(container);

    await user.click(screen.getByRole("button", { name: "Registrarse" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(MENSAJE);
    expect(api.post).not.toHaveBeenCalled();
  });

  it("envía la aceptación y la versión de la política junto con los datos", async () => {
    (api.post as jest.Mock).mockResolvedValue({
      access_token: "jwt",
      cliente: { id: 1 },
    });
    const { container } = render(<RegisterForm />);
    const user = await completarRegistro(container);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Registrarse" }));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith(
      "/auth/register",
      expect.objectContaining({
        rut: "111111111",
        acepta_politica_privacidad: true,
        version_politica_privacidad: POLITICA_PRIVACIDAD_VERSION,
      }),
    );
    expect(push).toHaveBeenCalledWith("/portal");
  });
});
