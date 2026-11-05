import type { MetadataRoute } from "next";
import { BASE_URL } from "./_lib/consts";
import { PREFIJOS_PRIVADOS } from "./_lib/rutas-publicas";

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
      disallow: ["/api/", ...PREFIJOS_PRIVADOS],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
