import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/app/_lib/auth", () => ({ useAuth: () => ({ cliente: null }) }));

import PortalPage from "@/app/portal/page";
import PerfilPage from "@/app/perfil/page";
import PagosAnteriores from "@/app/_components/portal/PagosAnteriores";
import PlanCard from "@/app/_components/catalog/PlanCard";

// Fija cómo muestra cada pantalla los montos (§11.5) y las fechas (§11.4) para
// que juntar sus formateadores en uno no cambie nada de lo que ve el cliente.
// Las fechas sin hora llegan como medianoche UTC y las con hora son instantes:
// se prueba en hora de Chile para notar si alguna se corre un día.
process.env.TZ = "America/Santiago";

function responder(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}

describe("formato de montos y fechas en las pantallas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it("panel: saldo, precio del plan y vencimiento corto de la factura", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      responder({
        cliente: {
          id_cliente: 1,
          nombre_completo: "Ana Pérez",
          rut: "123456785",
          email: "ana@example.com",
          telefono: "+56912345678",
        },
        contratos: [
          {
            id_contrato: 1,
            estado: "ACTIVO",
            fecha_inicio: "2025-03-05",
            dia_vencimiento: 10,
            plan: {
              id_plan: 1,
              nombre_comercial: "Fibra 400 Mbps",
              tipo_plan: "FIBRA",
              velocidad_mbps: 400,
              precio_mensual: 25990,
            },
          },
        ],
        resumen_deuda: {
          tiene_deuda: true,
          saldo_total: 39980,
          facturas_pendientes: [
            {
              id_factura: 1,
              periodo: "Mayo 2026",
              monto: 39980,
              fecha_limite_pago: "2026-05-10",
              estado: "pendiente",
              dias_vencida: null,
            },
          ],
        },
        tickets_recientes: [],
      }),
    );

    render(<PortalPage />);

    expect(await screen.findByText("$39.980")).toBeInTheDocument();
    expect(screen.getByText("$25.990")).toBeInTheDocument();
    expect(screen.getByText("Vence: 10 may")).toBeInTheDocument();
  });

  it("perfil: fecha larga de \"Cliente desde\", en hora de Chile", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      responder({
        id_cliente: 1,
        nombre_completo: "Ana Pérez",
        rut: "123456785",
        email: "ana@example.com",
        telefono: "+56912345678",
        // 22:30 del 4 de marzo en Chile.
        fecha_creacion: "2026-03-05T01:30:00.000Z",
      }),
    );

    render(<PerfilPage />);

    expect(await screen.findByText("4 de marzo de 2026")).toBeInTheDocument();
  });

  it("pagos anteriores: DD/MM/AAAA en hora de Chile y el monto", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      responder({
        comprobante_disponible: false,
        pagos: [
          {
            id_pago: 7,
            // 22:30 del 10 de mayo en Chile: en UTC ya es el 11.
            fecha_pago: "2026-05-11T02:30:00.000Z",
            periodo: "Mayo 2026",
            monto: 25990,
            pasarela: "Webpay",
          },
        ],
      }),
    );

    render(<PagosAnteriores />);

    expect((await screen.findAllByText(/10\/05\/2026/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText("$25.990").length).toBeGreaterThan(0);
  });

  it("tarjeta de plan: precio mensual del catálogo", () => {
    render(
      <PlanCard
        plan={{
          id_plan: 1,
          nombre_comercial: "Fibra 400 Mbps",
          tipo_plan: "FIBRA",
          tipo_cliente: "RESIDENCIAL",
          velocidad_mbps: 400,
          precio_mensual: 25990,
          descripcion: null,
        }}
      />,
    );

    expect(screen.getByText(/\$25\.990/)).toBeInTheDocument();
  });
});
