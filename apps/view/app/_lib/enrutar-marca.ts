import {
  enlaceEntreSitios,
  MARCA_POR_DEFECTO,
  MARCAS,
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
 * 2. la de la URL: el prefijo de una marca o, si cada empresa tiene su host,
 *    el host (ahí las dos viven en la raíz del suyo y nadie lleva prefijo);
 * 3. la que eligió antes el visitante (cookie `empresa`), para que siga en su
 *    sitio aunque un enlace no traiga el prefijo;
 * 4. Finet.
 *
 * Si la empresa elegida vive en otro host, se redirige a su URL configurada.
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
  /** La dueña del host pedido, si cada empresa tiene el suyo (`marcaPorHost`). */
  marcaHost?: SlugMarca | null;
};

/**
 * Una sola barra al comienzo: para el navegador "//sitio" es otro dominio, y
 * una redirección a eso sacaría al visitante del portal (OWASP A01).
 */
function sinBarrasDobles(ruta: string): string {
  return ruta.replace(/^\/{2,}/, "/");
}

export function enrutarMarca(entrada: EntradaMarca): DecisionMarca {
  const e = { ...entrada, pathname: sinBarrasDobles(entrada.pathname) };
  // El sitio al que llegó la petición: el de su host, o el de Finet.
  const sitio = e.marcaHost ? MARCAS[e.marcaHost] : MARCA_POR_DEFECTO;

  // La ruta interna (`/finet/…`) de una marca que vive en la raíz de su sitio
  // no se publica: sería la misma página en dos URLs.
  for (const marca of Object.values(MARCAS)) {
    const interna = `/${marca.slug}`;
    if (marca.prefijo) continue;
    if (e.pathname === interna || e.pathname.startsWith(`${interna}/`)) {
      const ruta = sinBarrasDobles(e.pathname.slice(interna.length)) || "/";
      return {
        tipo: "redirigir",
        destino: `${enlaceEntreSitios(sitio, marca, ruta as `/${string}`)}${e.search}`,
      };
    }
  }

  const separada = separarMarca(e.pathname);
  const ruta = sinBarrasDobles(separada.ruta);
  const conPrefijo = separada.marca.prefijo !== "";
  const deLaUrl = conPrefijo ? (separada.marca.slug as SlugMarca) : e.marcaHost;
  const elegida: SlugMarca =
    e.marcaToken ??
    deLaUrl ??
    e.marcaCookie ??
    (MARCA_POR_DEFECTO.slug as SlugMarca);

  const canonica = enlaceEntreSitios(sitio, MARCAS[elegida], ruta as `/${string}`);
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

/**
 * A dónde volver después del login (`?redirect=`): solo a una ruta del mismo
 * sitio. Una URL absoluta, "//otro" o "/\\otro" sacaría al cliente del portal
 * recién autenticado: un open redirect que sirve para phishing (OWASP A01).
 */
export function destinoInterno(
  valor: string | null | undefined,
  porDefecto: string,
): string {
  return valor && /^\/(?![/\\])/.test(valor) ? valor : porDefecto;
}
