import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

import DeudaPage from "@/app/portal/deuda/page";
import DeudaLookupForm from "@/app/components/DeudaLookupForm";

// Fija el HTML de la tabla de facturas de la consulta pública y de Mi deuda
// para que pasarlas a un componente compartido no cambie lo que se ve.
process.env.TZ = "America/Santiago";

const FACTURAS = [
  {
    id_factura: 1,
    periodo: "Mayo 2026",
    monto: 19990,
    fecha_limite_pago: "2026-05-10",
    estado: "pendiente",
    dias_vencida: null,
    dias_para_vencer: 15,
  },
  {
    id_factura: 2,
    periodo: "Abril 2026",
    monto: 19990,
    fecha_limite_pago: "2026-04-10",
    estado: "vencida",
    dias_vencida: 45,
    dias_para_vencer: null,
  },
  {
    id_factura: 3,
    periodo: "Marzo 2026",
    monto: 19990,
    fecha_limite_pago: "2026-03-10",
    estado: "vencida",
    dias_vencida: 1,
    dias_para_vencer: null,
  },
];

function responder(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}

function seccionDeFacturas() {
  return screen.getByText("Detalle de facturas").parentElement!.outerHTML;
}

describe("tabla de facturas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it("consulta pública", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      responder({
        encontrado: true,
        cliente: { nombre_completo: "Ana Pérez", rut: "12345678-5" },
        tiene_deuda: true,
        saldo_total: 59970,
        facturas: FACTURAS,
        planes: [],
        detalle_disponible: true,
        informacion_completa: true,
      }),
    );

    render(<DeudaLookupForm />);
    await user.type(screen.getByPlaceholderText("12.345.678-9"), "12345678-5");
    await user.click(screen.getByRole("button", { name: /consultar/i }));
    await screen.findByText("Detalle de facturas");

    expect(seccionDeFacturas()).toMatchSnapshot();
  });

  it("Mi deuda", async () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve(responder({ comprobante_disponible: false, pagos: [] })),
    );
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      responder({
        tiene_deuda: true,
        saldo_total: 59970,
        saldo_confirmado: true,
        facturas_pendientes: FACTURAS,
      }),
    );

    render(<DeudaPage />);
    await screen.findByText("Detalle de facturas");

    expect(seccionDeFacturas()).toMatchSnapshot();
  });
});
