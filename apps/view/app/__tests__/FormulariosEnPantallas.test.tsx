import "@testing-library/jest-dom";
import type { ReactElement } from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/app/_lib/auth", () => ({
  useAuth: () => ({
    login: jest.fn(),
    isAuthenticated: false,
    isLoading: false,
  }),
}));
jest.mock("@/app/utils/api", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

import { api } from "@/app/utils/api";
import LoginForm from "@/app/components/LoginForm";
import RegisterForm from "@/app/components/RegisterForm";
import RecoveryForm from "@/app/components/RecoveryForm";
import ResetPasswordForm from "@/app/components/ResetPasswordForm";
import ChangePasswordForm from "@/app/components/ChangePasswordForm";
import UpdateEmailForm from "@/app/components/UpdateEmailForm";
import UpdateTelefonoForm from "@/app/components/UpdateTelefonoForm";

// Fija el HTML de cada formulario en sus estados (vacío, con errores de campo,
// con error del servidor y, si tiene, con el mensaje de éxito) para que pasar
// su marcado repetido a componentes compartidos no cambie lo que se ve.

type Caso = {
  nombre: string;
  elemento: () => ReactElement;
  /** Valores válidos para los campos de texto, en el orden en que aparecen. */
  valores: string[];
  casilla?: boolean;
  metodo: "post" | "patch";
  exito?: unknown;
};

const CASOS: Caso[] = [
  {
    nombre: "login",
    elemento: () => <LoginForm />,
    valores: ["12.345.678-5", "Clave2026"],
    metodo: "post",
  },
  {
    nombre: "registro",
    elemento: () => <RegisterForm />,
    valores: ["Ana Pérez", "ana@example.com", "+56912345678", "12.345.678-5", "Clave2026", "Clave2026"],
    casilla: true,
    metodo: "post",
  },
  {
    nombre: "recuperar contraseña",
    elemento: () => <RecoveryForm />,
    valores: ["12.345.678-5"],
    metodo: "post",
    exito: { message: "ok" },
  },
  {
    nombre: "restablecer contraseña",
    elemento: () => <ResetPasswordForm token="token-de-prueba" />,
    valores: ["Clave2026", "Clave2026"],
    metodo: "post",
    exito: { message: "ok" },
  },
  {
    nombre: "cambiar contraseña",
    elemento: () => <ChangePasswordForm />,
    valores: ["Actual2026", "Clave2026", "Clave2026"],
    metodo: "patch",
    exito: { mensaje: "ok" },
  },
  {
    nombre: "cambiar correo",
    elemento: () => <UpdateEmailForm currentEmail="ana@example.com" />,
    valores: ["Actual2026", "nueva@example.com"],
    metodo: "patch",
    exito: { id_cliente: 1, email: "nueva@example.com" },
  },
  {
    nombre: "cambiar teléfono",
    elemento: () => <UpdateTelefonoForm />,
    valores: ["Actual2026", "+56912345678"],
    metodo: "patch",
    exito: { id_cliente: 1, telefono: "+56912345678" },
  },
];

function llenar(container: HTMLElement, caso: Caso) {
  const campos = container.querySelectorAll<HTMLInputElement>(
    'input:not([type="checkbox"])',
  );
  expect(campos).toHaveLength(caso.valores.length);
  campos.forEach((campo, i) =>
    fireEvent.change(campo, { target: { value: caso.valores[i] } }),
  );
  if (caso.casilla) {
    fireEvent.click(container.querySelector('input[type="checkbox"]')!);
  }
}

async function enviar(container: HTMLElement) {
  await act(async () => {
    fireEvent.submit(container.querySelector("form")!);
  });
}

describe.each(CASOS)("formulario: $nombre", (caso) => {
  beforeEach(() => jest.clearAllMocks());

  it("vacío y con los errores de cada campo", async () => {
    const { container } = render(caso.elemento());
    expect(container.innerHTML).toMatchSnapshot("vacío");

    await enviar(container);
    expect(container.innerHTML).toMatchSnapshot("errores de campo");
  });

  it("con el error del servidor", async () => {
    (api[caso.metodo] as jest.Mock).mockRejectedValue({
      message: "Mensaje de error del servidor",
      status: 400,
    });
    const { container, findByText } = render(caso.elemento());

    llenar(container, caso);
    await enviar(container);

    await findByText("Mensaje de error del servidor");
    expect(container.innerHTML).toMatchSnapshot("error del servidor");
  });

  if (caso.exito) {
    it("con el mensaje de éxito", async () => {
      (api[caso.metodo] as jest.Mock).mockResolvedValue(caso.exito);
      const { container } = render(caso.elemento());

      llenar(container, caso);
      await enviar(container);

      await waitFor(() => expect(api[caso.metodo]).toHaveBeenCalled());
      expect(container.innerHTML).toMatchSnapshot("éxito");
    });
  }
});
