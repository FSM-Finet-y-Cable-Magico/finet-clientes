import type { MetadataRoute } from "next";

/**
 * CU-74: registro de las rutas del sitio. De aca salen sitemap.xml,
 * robots.txt y el noindex de cada pagina (CU-72).
 *
 * `rutas-publicas.test.ts` lo compara con las page.tsx de app/: agregar o
 * borrar una pagina sin declararla aca rompe los tests.
 */

type Entrada = MetadataRoute.Sitemap[number];

export type RutaPublica =
  | {
      path: string;
      indexable: true;
      changeFrequency: NonNullable<Entrada["changeFrequency"]>;
      priority: number;
    }
  /** Publica pero sin valor en buscadores: noindex y fuera del sitemap. */
  | { path: string; indexable: false };

/** Plantilla de los planes: el sitemap la expande con el catalogo del backend. */
export const RUTA_PLAN = "/contratar/[planId]";

export const RUTAS_PUBLICAS: RutaPublica[] = [
  { path: "/", indexable: true, changeFrequency: "daily", priority: 1 },
  { path: "/planes", indexable: true, changeFrequency: "weekly", priority: 0.9 },
  { path: RUTA_PLAN, indexable: true, changeFrequency: "weekly", priority: 0.7 },
  { path: "/empresas", indexable: true, changeFrequency: "weekly", priority: 0.8 },
  { path: "/cobertura", indexable: true, changeFrequency: "monthly", priority: 0.8 },
  { path: "/tv", indexable: true, changeFrequency: "weekly", priority: 0.7 },
  { path: "/tv/canales", indexable: true, changeFrequency: "weekly", priority: 0.6 },
  { path: "/tv/parrilla", indexable: true, changeFrequency: "weekly", priority: 0.6 },
  { path: "/velocidad", indexable: true, changeFrequency: "monthly", priority: 0.6 },
  { path: "/ayuda", indexable: true, changeFrequency: "monthly", priority: 0.6 },
  { path: "/consultar-deuda", indexable: true, changeFrequency: "monthly", priority: 0.6 },
  { path: "/inicio-sesion", indexable: true, changeFrequency: "yearly", priority: 0.4 },
  { path: "/terminos", indexable: true, changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacidad", indexable: true, changeFrequency: "yearly", priority: 0.3 },
  // Solo sirven a quien ya llego desde el login o el correo.
  { path: "/recuperar-password", indexable: false },
  { path: "/restablecer-password", indexable: false },
];

/** Las mismas que protege `proxy.ts`; robots.txt las bloquea. */
export const PREFIJOS_PRIVADOS = ["/portal", "/perfil"];

export function esIndexable(path: string): boolean {
  return !RUTAS_PUBLICAS.some((ruta) => ruta.path === path && !ruta.indexable);
}
