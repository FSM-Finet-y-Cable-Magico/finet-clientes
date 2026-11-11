import {
  MARCA_POR_DEFECTO,
  MARCAS,
  rutaMarca,
  separarMarca,
  type SlugMarca,
} from "./company";

/**
 * Qué hace `proxy.ts` con cada ruta. Las páginas viven una sola vez en
 * `app/[marca]/` y se generan por empresa; el navegador ve `/planes` (Finet) o
 * `/cable-magico/planes`, y el proxy las reescribe a `/finet/planes` y
 * `/cable-magico/planes`.
 *
 * La empresa se decide, en este orden:
 * 1. la del token de la sesión: como en G8, el token por empresa cambia las
 *    vistas, así que un cliente ve siempre el sitio de su empresa;
 * 2. la de la URL, si trae el prefijo de una marca;
 * 3. la que eligió antes el visitante (cookie `empresa`), para que siga en su
 *    sitio aunque un enlace no traiga el prefijo;
 * 4. Finet.
 *
 * Función pura, sin `next/server`, para probarla sin el runtime de Next.
 */

/** La empresa que eligió el visitante: solo una preferencia, no da acceso. */
export const COOKIE_MARCA = "empresa";

export type DecisionMarca =
  | { tipo: "redirigir"; destino: string }
  | {
      tipo: "reescribir";
      destino: string;
      marca: SlugMarca;
      /** La marca que hay que recordar en la cookie, si cambió. */
      guardarCookie: SlugMarca | null;
    };

export type EntradaMarca = {
  pathname: string;
  search: string;
  /** Empresa del token válido de la sesión, si hay. */
  marcaToken: SlugMarca | null;
  /** La que eligió antes el visitante. */
  marcaCookie: SlugMarca | null;
};

const PREFIJO_INTERNO = `/${MARCA_POR_DEFECTO.slug}`;

export function enrutarMarca(e: EntradaMarca): DecisionMarca {
  // La ruta interna de la marca por defecto no se publica: sería la misma
  // página en dos URLs.
  if (e.pathname === PREFIJO_INTERNO || e.pathname.startsWith(`${PREFIJO_INTERNO}/`)) {
    const ruta = e.pathname.slice(PREFIJO_INTERNO.length) || "/";
    return { tipo: "redirigir", destino: `${ruta}${e.search}` };
  }

  const { marca: deLaUrl, ruta } = separarMarca(e.pathname);
  const conPrefijo = deLaUrl.prefijo !== "";
  const elegida: SlugMarca =
    e.marcaToken ??
    (conPrefijo ? (deLaUrl.slug as SlugMarca) : e.marcaCookie) ??
    (MARCA_POR_DEFECTO.slug as SlugMarca);

  const canonica = rutaMarca(MARCAS[elegida], ruta as `/${string}`);
  if (canonica !== e.pathname) {
    return { tipo: "redirigir", destino: `${canonica}${e.search}` };
  }

  return {
    tipo: "reescribir",
    destino: `/${elegida}${ruta === "/" ? "" : ruta}${e.search}`,
    marca: elegida,
    guardarCookie: e.marcaCookie === elegida ? null : conPrefijo || e.marcaToken ? elegida : null,
  };
}
