import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TicketsPage from "@/app/portal/tickets/page";

const sinTickets = { total: 0, tiene_tickets: false, tickets: [] };
const categorias = [
  { id_categoria: 1, nombre: "Conectividad" },
  { id_categoria: 2, nombre: "Televisión" },
];

function prepararCargaInicial() {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(sinTickets),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(categorias),
    });
}

describe("TicketsPage (CU-71)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it("informa los campos obligatorios y evita el envío", async () => {
    const user = userEvent.setup();
    prepararCargaInicial();
    render(<TicketsPage />);

    await screen.findByRole("option", { name: "Conectividad" });
    await user.click(screen.getByRole("button", { name: /enviar solicitud/i }));

    expect(screen.getByText("Selecciona una categoría.")).toBeInTheDocument();
    expect(screen.getByText("Describe el problema.")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("registra la solicitud y muestra el código de seguimiento", async () => {
    const user = userEvent.setup();
    prepararCargaInicial();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id_ticket: 42,
            codigo_seguimiento: "FIN-2026-000042",
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            total: 1,
            tiene_tickets: true,
            tickets: [
              {
                id_ticket: 42,
                codigo_seguimiento: "FIN-2026-000042",
                estado: "abierto",
                prioridad: "media",
                descripcion: "No tengo conexión",
                fecha_creacion: "2026-08-24T10:00:00.000Z",
                fecha_cierre: null,
                categoria: "Conectividad",
                origen: "portal",
              },
            ],
          }),
      });

    render(<TicketsPage />);
    await screen.findByRole("option", { name: "Conectividad" });
    await user.selectOptions(screen.getByLabelText("Categoría"), "1");
    await user.type(
      screen.getByLabelText("Describe el problema"),
      "No tengo conexión",
    );
    await user.click(screen.getByRole("button", { name: /enviar solicitud/i }));

    await waitFor(() => {
      expect(screen.getAllByText("FIN-2026-000042")).toHaveLength(2);
    });
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      "http://localhost:4000/api/portal/tickets",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          id_categoria: 1,
          descripcion: "No tengo conexión",
        }),
      }),
    );
  });

  it("invita a reintentar cuando soporte no está disponible", async () => {
    const user = userEvent.setup();
    prepararCargaInicial();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ message: "Servicio no disponible" }),
    });

    render(<TicketsPage />);
    await screen.findByRole("option", { name: "Conectividad" });
    await user.selectOptions(screen.getByLabelText("Categoría"), "1");
    await user.type(screen.getByLabelText("Describe el problema"), "Sin señal");
    await user.click(screen.getByRole("button", { name: /enviar solicitud/i }));

    expect(
      await screen.findByText(/intenta nuevamente más tarde/i),
    ).toBeInTheDocument();
  });
});
