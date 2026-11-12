import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AsistenteWidget from "@/app/_components/asistente/AsistenteWidget";
import { MarcaProvider } from "@/app/_lib/marca";

const respuesta = (texto: string) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ respuesta: texto }),
});

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  global.fetch = jest.fn();
});

function abrir(slug: "finet" | "cable-magico") {
  render(
    <MarcaProvider slug={slug}>
      <AsistenteWidget />
    </MarcaProvider>,
  );
}

/** El asistente funciona para las dos empresas (Emilio, 11-11). */
describe("asistente de cada empresa", () => {
  it("en el sitio de Cable Mágico se presenta como el de Cable Mágico", async () => {
    const user = userEvent.setup();
    abrir("cable-magico");
    await user.click(screen.getByRole("button", { name: /abrir asistente/i }));

    expect(
      screen.getByRole("dialog", { name: "Asistente virtual de Cable Mágico" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/soy el asistente virtual de cable mágico/i)).toBeInTheDocument();
    expect(screen.queryByText(/finet/i)).not.toBeInTheDocument();
  });

  it("le dice al portal de qué empresa es el sitio", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce(respuesta("Hola"));
    abrir("cable-magico");
    await user.click(screen.getByRole("button", { name: /abrir asistente/i }));
    await user.type(screen.getByLabelText(/escribe tu mensaje/i), "hola");
    await user.click(screen.getByRole("button", { name: /enviar mensaje/i }));
    await screen.findByText("Hola");

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(init.body).id_empresa).toBe(2);
  });

  it("la conversación de Cable Mágico se guarda aparte de la de Finet", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce(respuesta("Hola"));
    abrir("cable-magico");
    await user.click(screen.getByRole("button", { name: /abrir asistente/i }));
    await user.type(screen.getByLabelText(/escribe tu mensaje/i), "hola");
    await user.click(screen.getByRole("button", { name: /enviar mensaje/i }));
    await screen.findByText("Hola");

    expect(localStorage.getItem("cable-magico-asistente")).not.toBeNull();
    expect(localStorage.getItem("finet-asistente")).toBeNull();
  });

  it("en el sitio de Finet manda la empresa 1", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce(respuesta("Hola"));
    abrir("finet");
    await user.click(screen.getByRole("button", { name: /abrir asistente/i }));
    await user.type(screen.getByLabelText(/escribe tu mensaje/i), "hola");
    await user.click(screen.getByRole("button", { name: /enviar mensaje/i }));
    await screen.findByText("Hola");

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(init.body).id_empresa).toBe(1);
  });
});
