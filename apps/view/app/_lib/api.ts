const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export type PlanBackend = {
  id_plan: number;
  nombre_comercial: string;
  tipo_plan: string;
  tipo_cliente: string;
  velocidad_mbps: number | null;
  precio_mensual: number;
  descripcion: string | null;
};

function formatPrecio(precio: number): string {
  return `$${precio.toLocaleString("es-CL")}`;
}

export function formatPrecioMensual(precio: number): string {
  return formatPrecio(precio);
}

export async function getLandingPlanes(
  tipoCliente?: string
): Promise<PlanBackend[]> {
  try {
    const url = new URL(`${API_URL}/landing/planes`);
    if (tipoCliente) {
      url.searchParams.set("tipo_cliente", tipoCliente);
    }

    const res = await fetch(url.toString(), { next: { revalidate: 300 } });

    if (!res.ok) {
      if (res.status === 404) return [];
      console.error(`Error al obtener planes: ${res.status}`);
      return [];
    }

    return res.json();
  } catch {
    console.error("Backend no disponible. Mostrando catalogo vacio.");
    return [];
  }
}

export async function getPlanById(
  planId: number
): Promise<PlanBackend | null> {
  const planes = await getLandingPlanes();
  return planes.find((p) => p.id_plan === planId) ?? null;
}

// --- Visor cartografico de factibilidad (CU-59 a CU-62) ---

/**
 * Celda del mapa de calor. No lleva `id_punto`: el backend la arma combinando
 * los poligonos y el pincel sobre la grilla, no es una fila de la base.
 */
export type PuntoCobertura = {
  latitud: number;
  longitud: number;
  densidad_cobertura: number;
  tipo_cobertura: string | null;
};

export type VisorCoberturaConfig = {
  centro: { latitud: number; longitud: number };
  zoom_inicial: number;
  zoom_min: number;
  zoom_max: number;
  limites: {
    sur_oeste: { latitud: number; longitud: number };
    nor_este: { latitud: number; longitud: number };
  };
};

/**
 * Caché de 24 horas para el encuadre del visor (CU-59). Es una constante del
 * backend, así que no hay nada que invalidar: ya no existe un tag porque no
 * queda editor que publique cambios.
 */
const COBERTURA_REVALIDATE = 86400;

/**
 * CU-59: encuadre y limites del visor.
 * Excepcion 2 del CU: si el backend no responde devolvemos `null` y la
 * pagina informa que el visor no esta disponible temporalmente.
 */
export async function getVisorCoberturaConfig(): Promise<VisorCoberturaConfig | null> {
  try {
    const res = await fetch(`${API_URL}/cobertura/config`, {
      next: { revalidate: COBERTURA_REVALIDATE },
    });

    if (!res.ok) {
      console.error(`Error al obtener config del visor: ${res.status}`);
      return null;
    }

    return res.json();
  } catch {
    console.error("Backend no disponible. Visor de cobertura sin config.");
    return null;
  }
}

/**
 * CU-60: puntos de densidad para la capa de mapa de calor.
 * Excepcion 1 del CU: sin datos, el visor se muestra sin la capa tematica,
 * por eso el fallback es una lista vacia y no un error.
 */
export async function getPuntosCobertura(
  tipoCobertura?: string
): Promise<PuntoCobertura[]> {
  try {
    const url = new URL(`${API_URL}/cobertura/puntos`);
    if (tipoCobertura) {
      url.searchParams.set("tipo_cobertura", tipoCobertura);
    }

    // El CRM puede publicar sin pasar por Next. Cada consulta lee la ultima version.
    const res = await fetch(url.toString(), { cache: "no-store" });

    if (!res.ok) {
      console.error(`Error al obtener puntos de cobertura: ${res.status}`);
      return [];
    }

    return res.json();
  } catch {
    console.error("Backend no disponible. Visor sin capa de calor.");
    return [];
  }
}
