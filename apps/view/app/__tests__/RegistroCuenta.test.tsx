import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = jest.fn();
const login = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));
let sesion = { isAuthenticated: false, isLoading: false };
jest.mock("@/app/_lib/auth", () => ({ useAuth: () => ({ ...sesion, login }) }));
jest.mock("@/app/utils/api", () => ({ api: { post: jest.fn() } }));

import { api } from "@/app/utils/api";
import { MARCAS } from "@/app/_lib/company";
import RegistroForm from "@/app/components/RegistroForm";
import ConfirmarRegistroForm from "@/app/components/ConfirmarRegistroForm";
import ConfirmarRegistroPage from "@/app/[marca]/registro/confirmar/page";
import InicioSesionPage from "@/app/[marca]/inicio-sesion/page";

// CU-04 sobre un cliente que G8 ya creó: se pide el RUT, se manda un enlace al
// correo registrado y con él se crea la contraseña y se abre la sesión.

const post = api.post as jest.Mock;

async function pedirConRut(container: HTMLElement, resultado: string) {
  post.mockResolvedValue({ resultado });
  const user = userEvent.setup();
  await user.type(container.querySelector<HTMLInputElement>("#rut")!, "12.345.678-5");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  return user;
}

describe("CU-04: el RUT (paso 1)", () => {
  const onIniciarSesion = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it("pide solo el RUT y lo manda limpio a /auth/registro", async () => {
    const { container } = render(<RegistroForm onIniciarSesion={onIniciarSesion} />);

    expect(container.querySelectorAll("input")).toHaveLength(1);
    await pedirConRut(container, "ENLACE_ENVIADO");

    // Con la empresa del sitio (Finet, sin provider): el RUT se busca entre sus clientes.
    expect(post).toHaveBeenCalledWith("/auth/registro", { rut: "123456785", id_empresa: 1 });
  });

  it("enlace enviado: avisa que revise su correo y cuánto dura", async () => {
    const { container } = render(<RegistroForm onIniciarSesion={onIniciarSesion} />);
    const user = await pedirConRut(container, "ENLACE_ENVIADO");

    expect(await screen.findByText("Revisa tu correo")).toBeInTheDocument();
    expect(screen.getByText(/Expira en 30 minutos/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Volver al inicio de sesión" }));
    expect(onIniciarSesion).toHaveBeenCalled();
  });

  it("ya registrado (Excepción 4): lleva a iniciar sesión o a recuperar la contraseña", async () => {
    const { container } = render(<RegistroForm onIniciarSesion={onIniciarSesion} />);
    const user = await pedirConRut(container, "YA_REGISTRADO");

    expect(await screen.findByText("Ya tienes una cuenta")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Recuperar mi contraseña" })).toHaveAttribute(
      "href",
      "/recuperar-password",
    );

    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(onIniciarSesion).toHaveBeenCalled();
  });

  it("sin correo: manda a WhatsApp, en una pestaña nueva", async () => {
    const { container } = render(<RegistroForm onIniciarSesion={onIniciarSesion} />);
    await pedirConRut(container, "SIN_CORREO");

    expect(await screen.findByText("No podemos crear tu cuenta en línea")).toBeInTheDocument();
    const whatsapp = screen.getByRole("link", { name: /Escribir por WhatsApp/ });
    expect(whatsapp).toHaveAttribute("href", MARCAS.finet.whatsappUrl);
    expect(whatsapp).toHaveAttribute("target", "_blank");
    expect(whatsapp).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("no es cliente: ofrece los planes y deja probar con otro RUT", async () => {
    const { container } = render(<RegistroForm onIniciarSesion={onIniciarSesion} />);
    const user = await pedirConRut(container, "NO_CLIENTE");

    expect(
      await screen.findByText("No encontramos ese RUT entre nuestros clientes"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver planes" })).toHaveAttribute("href", "/planes");

    await user.click(screen.getByRole("button", { name: "Intentar con otro RUT" }));
    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument();
  });

  it("si el correo no sale, muestra el error del servidor y no un panel", async () => {
    post.mockRejectedValue({
      message: "No pudimos enviar el correo. Intenta de nuevo en unos minutos",
      status: 503,
    });
    const { container } = render(<RegistroForm onIniciarSesion={onIniciarSesion} />);
    const user = userEvent.setup();
    await user.type(container.querySelector<HTMLInputElement>("#rut")!, "12.345.678-5");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(
      await screen.findByText("No pudimos enviar el correo. Intenta de nuevo en unos minutos"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Revisa tu correo")).not.toBeInTheDocument();
  });
});

describe("CU-04: la contraseña con el enlace (paso 2)", () => {
  beforeEach(() => jest.clearAllMocks());

  async function completar(container: HTMLElement, confirmacion = "Clave2026") {
    const user = userEvent.setup();
    await user.type(container.querySelector<HTMLInputElement>("#password")!, "Clave2026");
    await user.type(container.querySelector<HTMLInputElement>("#confirmPassword")!, confirmacion);
    return user;
  }

  it("crea la contraseña, abre la sesión y va al portal", async () => {
    const cliente = { id_cliente: 7, rut: "123456785", nombre_completo: "Ana Pérez" };
    post.mockResolvedValue({ access_token: "jwt", cliente });
    const { container } = render(<ConfirmarRegistroForm token="token-de-prueba" />);
    const user = await completar(container);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/portal"));
    expect(post).toHaveBeenCalledWith(
      "/auth/registro/confirmar",
      expect.objectContaining({
        token: "token-de-prueba",
        password: "Clave2026",
        password_confirmation: "Clave2026",
      }),
    );
    expect(login).toHaveBeenCalledWith(cliente);
  });

  it("Excepción 3: si las contraseñas no coinciden no se envía", async () => {
    const { container } = render(<ConfirmarRegistroForm token="token-de-prueba" />);
    const user = await completar(container, "Clave2027");

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText("Las contraseñas no coinciden")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("un enlace ya usado muestra el mensaje del backend", async () => {
    post.mockRejectedValue({
      message: "Este enlace ya fue usado. Si todavía no tienes contraseña, solicita uno nuevo",
      status: 400,
    });
    const { container } = render(<ConfirmarRegistroForm token="token-de-prueba" />);
    const user = await completar(container);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText(/Este enlace ya fue usado/)).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("/registro/confirmar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sesion = { isAuthenticated: false, isLoading: false };
    window.location.hash = "";
  });

  it("sin token: el aviso de enlace inválido, que manda a pedir otro", () => {
    render(<ConfirmarRegistroPage />);

    expect(screen.getByText("Enlace inválido o expirado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al inicio de sesión" })).toHaveAttribute(
      "href",
      "/inicio-sesion",
    );
  });

  it("con el token del enlace: el formulario de la contraseña y la casilla", () => {
    window.location.hash = "#token=abc.def.ghi";

    render(<ConfirmarRegistroPage />);

    expect(screen.getByText("Crea tu contraseña")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar contraseña")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("con sesión iniciada va al portal y no muestra nada", () => {
    sesion = { isAuthenticated: true, isLoading: false };
    window.location.hash = "#token=abc.def.ghi";

    const { container } = render(<ConfirmarRegistroPage />);

    expect(container).toBeEmptyDOMElement();
    expect(push).toHaveBeenCalledWith("/portal");
  });
});

describe("/inicio-sesion: la pestaña Registrarse", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sesion = { isAuthenticated: false, isLoading: false };
  });

  it("muestra el formulario del RUT y vuelve al login desde el aviso", async () => {
    const { container } = render(<InicioSesionPage />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Registrarse" }));
    expect(container.querySelector("#password")).not.toBeInTheDocument();
    await pedirConRut(container, "YA_REGISTRADO");

    await user.click(await screen.findByRole("button", { name: "Iniciar sesión" }));
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeInTheDocument();
  });
});
