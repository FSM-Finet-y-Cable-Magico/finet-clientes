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
import ConfirmarRegistroForm from "@/app/components/ConfirmarRegistroForm";
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
    // Como lo escribiría alguien: sin puntos, con mayúsculas y sin el +56.
    await user.type(screen.getByLabelText("RUT"), "111111111");
    await user.type(screen.getByLabelText("Correo electronico"), "Juan@Ejemplo.cl");
    await user.type(screen.getByLabelText("Telefono movil"), "912345678");
    await user.type(screen.getByLabelText("Calle + numero"), "Av. Siempre Viva 742");
    await user.selectOptions(screen.getByLabelText("Región"), "Metropolitana de Santiago");
    await user.selectOptions(screen.getByLabelText("Comuna"), "La Pintana");
    return user;
  }

  it("da formato al RUT y al teléfono, y pasa el correo a minúsculas mientras se escribe", async () => {
    render(<FormularioContratacion plan={plan} />);
    await completarFormulario();

    expect(screen.getByLabelText("RUT")).toHaveValue("11.111.111-1");
    expect(screen.getByLabelText("Correo electronico")).toHaveValue("juan@ejemplo.cl");
    expect(screen.getByLabelText("Telefono movil")).toHaveValue("9 1234 5678");
  });

  describe("teléfono, como lo escribe o pega una persona", () => {
    async function telefonoTras(accion: (u: ReturnType<typeof userEvent.setup>, campo: HTMLElement) => Promise<void>) {
      const user = userEvent.setup();
      render(<FormularioContratacion plan={plan} />);
      const campo = screen.getByLabelText("Telefono movil");
      await accion(user, campo);
      return campo;
    }

    it.each([
      ["+56 9 1234 5678"],
      ["+56912345678"],
      ["56912345678"],
      ["912345678"],
      ["9 1234 5678"],
      ["9-1234-5678"],
      ["(9) 1234 5678"],
      ["+56 (9) 1234-5678"],
      ["0056912345678"],
    ])("pegar %s deja 9 1234 5678", async (pegado) => {
      const campo = await telefonoTras(async (u, c) => {
        await u.click(c);
        await u.paste(pegado);
      });
      expect(campo).toHaveValue("9 1234 5678");
    });

    it("ignora letras y símbolos al escribir", async () => {
      const campo = await telefonoTras((u, c) => u.type(c, "9a1b2c3d4 5.6/7*8"));
      expect(campo).toHaveValue("9 1234 5678");
    });

    it("no deja pasar de 9 dígitos", async () => {
      const campo = await telefonoTras((u, c) => u.type(c, "9123456789999"));
      expect(campo).toHaveValue("9 1234 5678");
    });

    it("borrar desde el final saca un dígito por vez y no deja espacios colgando", async () => {
      const campo = await telefonoTras(async (u, c) => {
        await u.type(c, "912345678");
        await u.type(c, "{Backspace}{Backspace}{Backspace}{Backspace}");
      });
      expect(campo).toHaveValue("9 1234");
    });

    it("borrar todo deja el campo vacío", async () => {
      const campo = await telefonoTras(async (u, c) => {
        await u.type(c, "912345678");
        await u.clear(c);
      });
      expect(campo).toHaveValue("");
    });

    it("un número incompleto no pasa la validación del navegador", async () => {
      const campo = await telefonoTras((u, c) => u.type(c, "91234"));
      expect(campo).toHaveValue("9 1234");
      expect(campo).not.toBeValid();
    });

    it("un celular que no empieza con 9 no pasa la validación del navegador", async () => {
      const campo = await telefonoTras((u, c) => u.type(c, "212345678"));
      expect(campo).toHaveValue("2 1234 5678");
      expect(campo).not.toBeValid();
    });

    it("un celular completo pasa la validación del navegador", async () => {
      const campo = await telefonoTras((u, c) => u.type(c, "912345678"));
      expect(campo).toBeValid();
    });
  });

  describe("RUT, como lo escribe o pega una persona", () => {
    async function rutTras(accion: (u: ReturnType<typeof userEvent.setup>, campo: HTMLElement) => Promise<void>) {
      const user = userEvent.setup();
      render(<FormularioContratacion plan={plan} />);
      const campo = screen.getByLabelText("RUT");
      await accion(user, campo);
      return campo;
    }

    it.each([
      ["12.345.678-5", "12.345.678-5"],
      ["123456785", "12.345.678-5"],
      ["12345678-5", "12.345.678-5"],
      ["1.234.567-k", "1.234.567-K"],
      ["1234567K", "1.234.567-K"],
    ])("pegar %s deja %s", async (pegado, esperado) => {
      const campo = await rutTras(async (u, c) => {
        await u.click(c);
        await u.paste(pegado);
      });
      expect(campo).toHaveValue(esperado);
      expect(campo).toBeValid();
    });

    it("borrar el dígito verificador vuelve a armar el RUT con el número anterior", async () => {
      const campo = await rutTras(async (u, c) => {
        await u.type(c, "123456785");
        await u.type(c, "{Backspace}");
      });
      expect(campo).toHaveValue("1.234.567-8");
    });

    it("un RUT a medias no pasa la validación del navegador", async () => {
      const campo = await rutTras((u, c) => u.type(c, "1234"));
      expect(campo).toHaveValue("123-4");
      expect(campo).not.toBeValid();
    });
  });

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
      telefono: "+56912345678",
      direccion_completa: "Av. Siempre Viva 742",
      comuna: "La Pintana",
      region: "Metropolitana de Santiago",
      origen_contacto: "Formulario web",
      acepta_politica_privacidad: true,
      version_politica_privacidad: POLITICA_PRIVACIDAD_VERSION,
    });
  });

  /**
   * El formato del registro de prospectos de G8 (fotos del 12-11): mismos
   * textos, letra por letra, mayúsculas, minúsculas y tildes incluidas.
   */
  describe("formato del prospecto de G8", () => {
    const opciones = (etiqueta: string) =>
      Array.from(
        (screen.getByLabelText(etiqueta) as HTMLSelectElement).options,
        (o) => o.textContent,
      );

    it("Origen de contacto: las 6 opciones de G8, en su orden, con Formulario web marcado", () => {
      render(<FormularioContratacion plan={plan} />);
      expect(opciones("Origen de contacto")).toEqual([
        "Formulario web",
        "Telefono",
        "Sucursal",
        "Referido",
        "Redes sociales",
        "Terreno",
      ]);
      expect(screen.getByLabelText("Origen de contacto")).toHaveValue("Formulario web");
    });

    it("Región: «Seleccionar región» y las 16 regiones, en el orden de G8", () => {
      render(<FormularioContratacion plan={plan} />);
      expect(opciones("Región")).toEqual([
        "Seleccionar región",
        "Tarapacá",
        "Antofagasta",
        "Atacama",
        "Coquimbo",
        "Valparaíso",
        "Libertador General Bernardo O'Higgins",
        "Maule",
        "Biobío",
        "La Araucanía",
        "Los Lagos",
        "Aysén del General Carlos Ibáñez del Campo",
        "Magallanes y de la Antártica Chilena",
        "Metropolitana de Santiago",
        "Los Ríos",
        "Arica y Parinacota",
        "Ñuble",
      ]);
    });

    it("Comuna: sin región, deshabilitada con «Selecciona primero una región»", () => {
      render(<FormularioContratacion plan={plan} />);
      expect(screen.getByLabelText("Comuna")).toBeDisabled();
      expect(opciones("Comuna")).toEqual(["Selecciona primero una región"]);
    });

    it("Comuna: con región, «Seleccionar comuna» y sus comunas, como en la foto", async () => {
      render(<FormularioContratacion plan={plan} />);
      await userEvent.setup().selectOptions(
        screen.getByLabelText("Región"),
        "Metropolitana de Santiago",
      );
      expect(screen.getByLabelText("Comuna")).toBeEnabled();
      expect(opciones("Comuna").slice(0, 20)).toEqual([
        "Seleccionar comuna",
        "Alhué",
        "Buin",
        "Calera de Tango",
        "Cerrillos",
        "Cerro Navia",
        "Colina",
        "Conchalí",
        "Curacaví",
        "El Bosque",
        "El Monte",
        "Estación Central",
        "Huechuraba",
        "Independencia",
        "Isla de Maipo",
        "La Cisterna",
        "La Florida",
        "La Granja",
        "La Pintana",
        "La Reina",
      ]);
    });

    it("cada región trae todas sus comunas oficiales: 346 en total", async () => {
      const COMUNAS = {
        Tarapacá: 7,
        Antofagasta: 9,
        Atacama: 9,
        Coquimbo: 15,
        Valparaíso: 38,
        "Libertador General Bernardo O'Higgins": 33,
        Maule: 30,
        Biobío: 33,
        "La Araucanía": 32,
        "Los Lagos": 30,
        "Aysén del General Carlos Ibáñez del Campo": 10,
        "Magallanes y de la Antártica Chilena": 11,
        "Metropolitana de Santiago": 52,
        "Los Ríos": 12,
        "Arica y Parinacota": 4,
        Ñuble: 21,
      };
      render(<FormularioContratacion plan={plan} />);
      const user = userEvent.setup();
      for (const [region, cantidad] of Object.entries(COMUNAS)) {
        await user.selectOptions(screen.getByLabelText("Región"), region);
        const comunas = opciones("Comuna").slice(1);
        expect([region, comunas.length]).toEqual([region, cantidad]);
        expect(new Set(comunas).size).toBe(cantidad);
      }
      expect(Object.values(COMUNAS).reduce((a, b) => a + b, 0)).toBe(346);
    });

    it("cambiar la región borra la comuna elegida", async () => {
      render(<FormularioContratacion plan={plan} />);
      const user = userEvent.setup();
      await user.selectOptions(screen.getByLabelText("Región"), "Metropolitana de Santiago");
      await user.selectOptions(screen.getByLabelText("Comuna"), "La Pintana");
      await user.selectOptions(screen.getByLabelText("Región"), "Valparaíso");
      expect(screen.getByLabelText("Comuna")).toHaveValue("");
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

describe("CU-75: crear la cuenta con el enlace del correo (CU-04)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function completarContrasena(container: HTMLElement) {
    const user = userEvent.setup();
    await user.type(container.querySelector<HTMLInputElement>("#password")!, "Password1");
    await user.type(container.querySelector<HTMLInputElement>("#confirmPassword")!, "Password1");
    return user;
  }

  // Excepción 1
  it("bloquea la cuenta sin la casilla, informa y lleva el foco a la casilla", async () => {
    const { container } = render(<ConfirmarRegistroForm token="token-de-prueba" />);
    const user = await completarContrasena(container);

    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(MENSAJE);
    expect(screen.getByRole("checkbox")).toHaveFocus();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("envía la aceptación y la versión de la política junto con el enlace", async () => {
    (api.post as jest.Mock).mockResolvedValue({
      access_token: "jwt",
      cliente: { id: 1 },
    });
    const { container } = render(<ConfirmarRegistroForm token="token-de-prueba" />);
    const user = await completarContrasena(container);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith(
      "/auth/registro/confirmar",
      expect.objectContaining({
        token: "token-de-prueba",
        acepta_politica_privacidad: true,
        version_politica_privacidad: POLITICA_PRIVACIDAD_VERSION,
      }),
    );
    expect(push).toHaveBeenCalledWith("/portal");
  });
});
