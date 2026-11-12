import type { MetadataRoute } from "next";
import { fetchLandingPlanes, type PlanBackend } from "./_lib/api";
import { MARCAS, urlMarca, type Marca } from "./_lib/company";
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
  // Las rutas de los dos sitios, cada una con la URL del suyo.
  const porMarca = await Promise.all(
    Object.values(MARCAS).map(async (marca) =>
      rutasDe(marca, await planesPublicados(marca)),
    ),
  );
  return porMarca.flat();
}

function rutasDe(marca: Marca, planes: PlanBackend[]): MetadataRoute.Sitemap {
  return RUTAS_PUBLICAS.flatMap((ruta) => {
    if (!ruta.indexable) return [];
    const { changeFrequency, priority } = ruta;

    if (ruta.path === RUTA_PLAN) {
      return planes.map((plan) => ({
        url: urlMarca(marca, `/contratar/${plan.id_plan}`),
        changeFrequency,
        priority,
      }));
    }

    return [
      {
        url: urlMarca(marca, ruta.path as `/${string}`),
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
async function planesPublicados(marca: Marca): Promise<PlanBackend[]> {
  try {
    return await fetchLandingPlanes(undefined, marca.idEmpresa);
  } catch (error) {
    console.error(
      "[CU-74] sitemap.xml: no se pudo leer el catalogo de planes; se conserva la ultima version valida.",
      error,
    );
    throw error;
  }
}
