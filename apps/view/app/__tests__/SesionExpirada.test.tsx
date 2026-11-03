import "@testing-library/jest-dom";
import { render, waitFor } from "@testing-library/react";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { AuthProvider } from "@/app/_lib/auth";
import { api } from "@/app/utils/api";

// Fija el aviso de sesión vencida entre utils/api (que lo emite ante un 401)
// y AuthProvider (que lo escucha y manda al login), para que el nombre del
// evento pueda vivir en una sola constante sin que se desconecten.

function respuesta(status: number, body: unknown = {}) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) };
}

describe("sesión vencida", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue(respuesta(401));
  });

  it("un 401 del portal lleva al login con ?expired=1", async () => {
    render(<AuthProvider>contenido</AuthProvider>);

    await expect(api.get("/portal/deuda")).rejects.toMatchObject({ status: 401 });

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/inicio-sesion?expired=1"),
    );
  });

  it("un 401 del login no, porque es una clave equivocada", async () => {
    render(<AuthProvider>contenido</AuthProvider>);

    await expect(api.post("/auth/login", {})).rejects.toMatchObject({
      status: 401,
    });

    expect(push).not.toHaveBeenCalledWith("/inicio-sesion?expired=1");
  });
});
