import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WifiPasswordSection, {
  type ContratoWifi,
} from "@/app/_components/portal/WifiPasswordSection";
import { changeWifiPassword } from "@/app/portal/_lib/portal-actions";

jest.mock("@/app/portal/_lib/portal-actions", () => ({
  changeWifiPassword: jest.fn(),
}));

const mockChange = changeWifiPassword as jest.MockedFunction<
  typeof changeWifiPassword
>;

// El estado llega como lo devuelve `/portal/contratos/vigentes`: el valor
// canonico en MAYUSCULAS de la Tabla 11.15 del Documento 0, no el "Activo" del
// formato de presentacion. Las fixtures en minuscula escondian que el filtro
// del componente dejaba el formulario sin renderizar nunca.
const CONTRATO_ACTIVO: ContratoWifi = {
  id_contrato: 1,
  estado: "ACTIVO",
  plan: { nombre_comercial: "Fibra 200" },
};
const CONTRATO_SUSPENDIDO: ContratoWifi = {
  id_contrato: 2,
  estado: "SUSPENDIDO",
  plan: { nombre_comercial: "Fibra 400" },
};
// Valor heredado que sigue vivo en la base compartida.
const CONTRATO_ACTIVO_HEREDADO: ContratoWifi = {
  id_contrato: 3,
  estado: "activo",
  plan: { nombre_comercial: "Fibra 600" },
};

describe("WifiPasswordSection (CU-31 / CU-32)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChange.mockResolvedValue({ success: true });
  });

  // CU-32 Excepcion 2: el plan no esta activo.
  it("impide pedir el cambio si no hay ningún servicio activo", () => {
    render(<WifiPasswordSection contratos={[CONTRATO_SUSPENDIDO]} />);

    expect(
      screen.getByText(/solo puedes solicitar el cambio de clave cuando/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /solicitar cambio/i }),
    ).not.toBeInTheDocument();
  });

  it("no muestra el selector cuando hay un único servicio activo", () => {
    render(<WifiPasswordSection contratos={[CONTRATO_ACTIVO]} />);

    expect(screen.queryByLabelText("Servicio")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /solicitar cambio/i }),
    ).toBeInTheDocument();
  });

  it("acepta el estado heredado en minuscula que queda en la base", () => {
    render(<WifiPasswordSection contratos={[CONTRATO_ACTIVO_HEREDADO]} />);

    expect(
      screen.getByRole("button", { name: /solicitar cambio/i }),
    ).toBeInTheDocument();
  });

  it("ofrece solo los servicios activos cuando hay varios", () => {
    render(
      <WifiPasswordSection
        contratos={[
          CONTRATO_ACTIVO,
          CONTRATO_SUSPENDIDO,
          { ...CONTRATO_ACTIVO, id_contrato: 3 },
        ]}
      />,
    );

    expect(screen.getByLabelText("Servicio")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(3); // placeholder + 2 activos
    expect(
      screen.queryByRole("option", { name: /abonado #2/i }),
    ).not.toBeInTheDocument();
  });

  // CU-31 Excepcion 1: campo vacio.
  it("pide completar la clave cuando está vacía y no envía nada", async () => {
    const user = userEvent.setup();
    render(<WifiPasswordSection contratos={[CONTRATO_ACTIVO]} />);

    await user.click(screen.getByRole("button", { name: /solicitar cambio/i }));

    expect(screen.getByText("Ingresa la nueva contraseña")).toBeInTheDocument();
    expect(mockChange).not.toHaveBeenCalled();
  });

  // Decision del equipo (pedido de Dani): se permiten simbolos, aunque CU-31
  // y RF-24 digan "unicamente alfanumericos". Ver
  // docs/CAMBIOS-PARA-EQUIPO-DOCUMENTACION.md.
  it("acepta una clave con símbolos", async () => {
    const user = userEvent.setup();
    render(<WifiPasswordSection contratos={[CONTRATO_ACTIVO]} />);

    await user.type(
      screen.getByLabelText(/^nueva contraseña/i),
      "MiClave-2026!",
    );
    await user.type(
      screen.getByLabelText(/repite la nueva/i),
      "MiClave-2026!",
    );
    await user.click(screen.getByRole("button", { name: /solicitar cambio/i }));

    await waitFor(() =>
      expect(mockChange).toHaveBeenCalledWith(1, "MiClave-2026!"),
    );
  });

  // Lo unico que se sigue rechazando del formato: espacios en blanco.
  it("rechaza la clave con espacios en blanco", async () => {
    const user = userEvent.setup();
    render(<WifiPasswordSection contratos={[CONTRATO_ACTIVO]} />);

    await user.type(
      screen.getByLabelText(/^nueva contraseña/i),
      "Mi Red 2026",
    );
    await user.click(screen.getByRole("button", { name: /solicitar cambio/i }));

    expect(
      screen.getByText("No se permiten espacios en blanco"),
    ).toBeInTheDocument();
    expect(mockChange).not.toHaveBeenCalled();
  });

  it("rechaza la clave más corta que el mínimo", async () => {
    const user = userEvent.setup();
    render(<WifiPasswordSection contratos={[CONTRATO_ACTIVO]} />);

    await user.type(screen.getByLabelText(/^nueva contraseña/i), "Corta1");
    await user.click(screen.getByRole("button", { name: /solicitar cambio/i }));

    expect(screen.getByText("Mínimo 8 caracteres")).toBeInTheDocument();
    expect(mockChange).not.toHaveBeenCalled();
  });

  it("exige que la confirmación coincida", async () => {
    const user = userEvent.setup();
    render(<WifiPasswordSection contratos={[CONTRATO_ACTIVO]} />);

    await user.type(screen.getByLabelText(/^nueva contraseña/i), "MiRed2026");
    await user.type(screen.getByLabelText(/repite la nueva/i), "OtraRed2026");
    await user.click(screen.getByRole("button", { name: /solicitar cambio/i }));

    expect(screen.getByText("Las contraseñas no coinciden")).toBeInTheDocument();
    expect(mockChange).not.toHaveBeenCalled();
  });

  // CU-32 poscondicion: la solicitud queda registrada y el cliente lo ve.
  it("registra la solicitud y confirma que el cambio lo aplica el equipo", async () => {
    const user = userEvent.setup();
    render(<WifiPasswordSection contratos={[CONTRATO_ACTIVO]} />);

    await user.type(screen.getByLabelText(/^nueva contraseña/i), "MiRed2026");
    await user.type(screen.getByLabelText(/repite la nueva/i), "MiRed2026");
    await user.click(screen.getByRole("button", { name: /solicitar cambio/i }));

    await waitFor(() =>
      expect(mockChange).toHaveBeenCalledWith(1, "MiRed2026"),
    );
    expect(await screen.findByText("Solicitud registrada")).toBeInTheDocument();
    // No debe decir que la clave ya cambio: la aplica el CRM despues (CU-33).
    expect(
      screen.getByText(/equipo técnico la aplicará/i),
    ).toBeInTheDocument();
  });

  it("muestra el motivo cuando el backend rechaza la solicitud", async () => {
    const user = userEvent.setup();
    mockChange.mockResolvedValue({
      success: false,
      error: "Solo puedes solicitar el cambio de clave en un servicio activo",
    });
    render(<WifiPasswordSection contratos={[CONTRATO_ACTIVO]} />);

    await user.type(screen.getByLabelText(/^nueva contraseña/i), "MiRed2026");
    await user.type(screen.getByLabelText(/repite la nueva/i), "MiRed2026");
    await user.click(screen.getByRole("button", { name: /solicitar cambio/i }));

    expect(
      await screen.findByText(
        "Solo puedes solicitar el cambio de clave en un servicio activo",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Solicitud registrada")).not.toBeInTheDocument();
  });
});
