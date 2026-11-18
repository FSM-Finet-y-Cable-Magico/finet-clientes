import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { AuthProvider, useAuth } from "@/app/_lib/auth";
import { api } from "@/app/utils/api";
import PerfilPage from "@/app/[marca]/perfil/page";

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

  // Rama ppt: al login de la empresa de la página, por su ruta explícita,
  // sin depender de la empresa recordada en la cookie (15-11: un cliente de
  // Finet terminaba en el login de Cable Mágico).
  it("un 401 del portal de Finet lleva al login de Finet con ?expired=1", async () => {
    window.history.pushState({}, "", "/portal/deuda");
    render(<AuthProvider>contenido</AuthProvider>);

    await expect(api.get("/portal/deuda")).rejects.toMatchObject({ status: 401 });

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/finet/inicio-sesion?expired=1"),
    );
  });

  it("un 401 del portal de Cable Mágico lleva al login de Cable Mágico", async () => {
    window.history.pushState({}, "", "/cable-magico/portal/deuda");
    render(<AuthProvider>contenido</AuthProvider>);

    await expect(api.get("/portal/deuda")).rejects.toMatchObject({ status: 401 });

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/cable-magico/inicio-sesion?expired=1"),
    );
  });

  // Rama ppt (15-11): con la sesión muerta, Mi Perfil quedaba en «No se pudo
  // cargar la información» y el cliente no podía hacer nada.
  it("Mi Perfil con la sesión vencida lleva al login, no a un error", async () => {
    window.history.pushState({}, "", "/perfil");
    render(
      <AuthProvider>
        <PerfilPage />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/finet/inicio-sesion?expired=1"),
    );
    expect(screen.queryByText("No se pudo cargar la información")).not.toBeInTheDocument();
  });

  it("un 401 del login no, porque es una clave equivocada", async () => {
    render(<AuthProvider>contenido</AuthProvider>);

    await expect(api.post("/auth/login", {})).rejects.toMatchObject({
      status: 401,
    });

    expect(push).not.toHaveBeenCalled();
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

