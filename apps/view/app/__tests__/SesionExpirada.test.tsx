import "@testing-library/jest-dom";
import { render, waitFor } from "@testing-library/react";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { AuthProvider, useAuth } from "@/app/_lib/auth";
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

/**
 * Sin el aviso de sesión que deja el proxy, no se le pregunta al backend por
 * el perfil: sería un 401 seguro, que la consola marca como error.
 */
describe("perfil al cargar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.cookie = "hay_sesion=; max-age=0; path=/";
    global.fetch = jest.fn().mockResolvedValue(
      respuesta(200, { id_cliente: 1, nombre_completo: "Ana" }),
    );
  });

  // Lo último que vio el componente: un objeto, para que TS no lo achique a null.
  const visto: { estado: ReturnType<typeof useAuth> | null } = { estado: null };
  function Ver() {
    visto.estado = useAuth();
    return null;
  }

  it("sin sesión no pregunta y queda como visitante", async () => {
    render(
      <AuthProvider>
        <Ver />
      </AuthProvider>,
    );

    await waitFor(() => expect(visto.estado?.isLoading).toBe(false));
    expect(visto.estado?.isAuthenticated).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("con sesión pregunta por el perfil, como siempre", async () => {
    document.cookie = "hay_sesion=1; path=/";
    render(
      <AuthProvider>
        <Ver />
      </AuthProvider>,
    );

    await waitFor(() => expect(visto.estado?.isAuthenticated).toBe(true));
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain("/auth/perfil");
  });
});

