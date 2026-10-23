import "@testing-library/jest-dom";

// Fija a qué URL del backend llama cada módulo, para que juntar las copias de
// `API_URL` y de `apiUrl()` en un solo lugar no cambie ninguna.
// Los módulos leen la variable al cargarse: cada test los vuelve a importar, y
// con ellos testing-library, para que usen la misma copia de React.

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "token-de-prueba" }) }),
}));
jest.mock("@/app/_lib/cookies-consentimiento.servidor", () => ({
  guardarConsentimiento: jest.fn(),
}));

const BASE = "https://backend.ejemplo.test/api";
const ENV_ORIGINAL = { ...process.env };

function respuesta(body: unknown = []) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}

// La versión `pure` no registra el cleanup al importarse (no se puede dentro
// de un test); se limpia en el afterEach.
let limpiar: (() => void) | null = null;
async function cargarTestingLibrary() {
  const tl = await import("@testing-library/react/pure");
  limpiar = tl.cleanup;
  return tl;
}

afterEach(() => {
  limpiar?.();
  limpiar = null;
});

function urlLlamada(n = 0) {
  return String((global.fetch as jest.Mock).mock.calls[n][0]);
}

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ENV_ORIGINAL, NEXT_PUBLIC_API_URL: BASE, API_URL: BASE };
  global.fetch = jest.fn().mockResolvedValue(respuesta());
});

afterAll(() => {
  process.env = ENV_ORIGINAL;
});

describe("URL del backend desde el navegador (NEXT_PUBLIC_API_URL)", () => {
  it("utils/api", async () => {
    const { api } = await import("@/app/utils/api");
    await api.get("/portal/tickets");
    expect(urlLlamada()).toBe(`${BASE}/portal/tickets`);
  });

  it("catálogo", async () => {
    const { fetchLandingPlanes } = await import("@/app/_lib/api");
    await fetchLandingPlanes("RESIDENCIAL");
    expect(urlLlamada()).toBe(`${BASE}/landing/planes?tipo_cliente=RESIDENCIAL`);
  });

  it("prueba de velocidad", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });
    const { medirVelocidad } = await import("@/app/_lib/fast-speedtest");
    await expect(
      medirVelocidad({ signal: new AbortController().signal }),
    ).rejects.toThrow();
    expect(urlLlamada()).toBe(`${BASE}/diagnostico/servidores`);
  });

  it("sesión: perfil y cierre", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401 });
    const { fireEvent, render, screen, waitFor } = await cargarTestingLibrary();
    const { AuthProvider, useAuth } = await import("@/app/_lib/auth");
    function Cerrar() {
      const { logout } = useAuth();
      return <button onClick={() => logout()}>cerrar</button>;
    }
    render(
      <AuthProvider>
        <Cerrar />
      </AuthProvider>,
    );
    await waitFor(() => expect(urlLlamada()).toBe(`${BASE}/auth/perfil`));
    const llamadas = (global.fetch as jest.Mock).mock.calls.length;
    fireEvent.click(screen.getByText("cerrar"));
    await waitFor(() =>
      expect(urlLlamada(llamadas)).toBe(`${BASE}/auth/logout`),
    );
  });

  it("formulario de contratación", async () => {
    const { fireEvent, render, screen, waitFor } = await cargarTestingLibrary();
    const { default: FormularioContratacion } = await import(
      "@/app/_components/catalog/FormularioContratacion"
    );
    const { container } = render(
      <FormularioContratacion
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
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(urlLlamada()).toBe(`${BASE}/contrataciones`);
  });

  it("formulario de contratación sin la variable: cae al backend local, no al dominio de la vista", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    const { fireEvent, render, screen, waitFor } = await cargarTestingLibrary();
    const { default: FormularioContratacion } = await import(
      "@/app/_components/catalog/FormularioContratacion"
    );
    const { container } = render(
      <FormularioContratacion
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
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(urlLlamada()).toBe("http://localhost:4000/api/contrataciones");
  });
});

describe("URL del backend desde el servidor de Next (API_URL)", () => {
  it("cambio de clave WiFi", async () => {
    const { changeWifiPassword } = await import(
      "@/app/portal/_lib/portal-actions"
    );
    await expect(changeWifiPassword(1, "MiRed2026")).resolves.toEqual({
      success: true,
    });
    expect(urlLlamada()).toBe(`${BASE}/portal/wifi/password`);
  });

  it("cambio de clave WiFi sin API_URL: no llama y avisa", async () => {
    delete process.env.API_URL;
    const { changeWifiPassword } = await import(
      "@/app/portal/_lib/portal-actions"
    );
    const r = await changeWifiPassword(1, "MiRed2026");
    expect(r.success).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("decisión de cookies", async () => {
    const { registrarDecisionCookies } = await import(
      "@/app/_lib/cookies-actions"
    );
    await expect(registrarDecisionCookies("aceptado")).resolves.toEqual({
      ok: true,
    });
    expect(urlLlamada()).toBe(`${BASE}/consentimiento/cookies`);
  });

  it("decisión de cookies sin API_URL: no llama", async () => {
    delete process.env.API_URL;
    const { registrarDecisionCookies } = await import(
      "@/app/_lib/cookies-actions"
    );
    await expect(registrarDecisionCookies("aceptado")).resolves.toEqual({
      ok: false,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
