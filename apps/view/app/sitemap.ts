import type { MetadataRoute } from "next";
import { fetchLandingPlanes, type PlanBackend } from "./_lib/api";
import { BASE_URL } from "./_lib/consts";
import { RUTA_PLAN, RUTAS_PUBLICAS } from "./_lib/rutas-publicas";

/**
 * CU-74: sitemap.xml con las rutas publicas indexables del registro. Se
 * regenera en cada build (rutas nuevas o borradas) y cada 5 minutos por el
 * revalidate del catalogo (planes nuevos o dados de baja).
 *
 * Sin `lastModified`: no hay fecha real de cambio por ruta, y la hora de
 * generacion le diria a los buscadores que todo cambio en cada regeneracion.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const planes = await planesPublicados();

  return RUTAS_PUBLICAS.flatMap((ruta) => {
    if (!ruta.indexable) return [];
    const { changeFrequency, priority } = ruta;

    if (ruta.path === RUTA_PLAN) {
      return planes.map((plan) => ({
        url: `${BASE_URL}/contratar/${plan.id_plan}`,
        changeFrequency,
        priority,
      }));
    }

    return [
      {
        url: ruta.path === "/" ? BASE_URL : `${BASE_URL}${ruta.path}`,
        changeFrequency,
        priority,
      },
    ];
  });
}

/**
 * Excepcion 1 del CU-74: sin catalogo no se publica un sitemap incompleto.
 * El error se relanza: en runtime Next sigue sirviendo la ultima version
 * valida, y en el build lo hace fallar para que el deploy anterior siga en
 * pie con sus archivos (sin el controller corriendo no compila).
 */
async function planesPublicados(): Promise<PlanBackend[]> {
  try {
    return await fetchLandingPlanes();
  } catch (error) {
    console.error(
      "[CU-74] sitemap.xml: no se pudo leer el catalogo de planes; se conserva la ultima version valida.",
      error,
    );
    throw error;
  }
}
