import type { MetadataRoute } from "next";
import { BASE_URL } from "./_lib/consts";
import { PREFIJOS_PRIVADOS } from "./_lib/rutas-publicas";
import { MARCAS, rutaMarca } from "./_lib/company";

/**
 * CU-74: directrices de indexacion. Las rutas publicas no indexables no van
 * aca sino con noindex en su metadata: si robots.txt las bloqueara, el
 * buscador no podria leer ese noindex.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Las rutas privadas de los dos sitios (Cable Mágico lleva su prefijo).
      disallow: [
        "/api/",
        ...Object.values(MARCAS).flatMap((marca) =>
          PREFIJOS_PRIVADOS.map((p) => rutaMarca(marca, p as `/${string}`)),
        ),
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
