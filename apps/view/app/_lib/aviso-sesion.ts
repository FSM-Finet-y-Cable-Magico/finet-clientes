/**
 * Aviso, sin secreto, de que hay una sesión válida en este dominio. La cookie
 * de la sesión (`access_token`) es httpOnly: el navegador no puede saber si la
 * tiene, y sin este aviso el AuthProvider le preguntaba al backend en cada
 * página; sin sesión, la respuesta era un 401 que la consola marca como error.
 *
 * Lo pone y lo borra `proxy.ts`, que ya verifica el token en cada página. No
 * da acceso a nada: si alguien lo inventa, el backend responde el mismo 401.
 */
export const COOKIE_HAY_SESION = "hay_sesion";

/** En el navegador: si el proxy dejó el aviso (`document.cookie`). */
export function hayAvisoDeSesion(cookies: string): boolean {
  return cookies
    .split(";")
    .some((cookie) => cookie.trim() === `${COOKIE_HAY_SESION}=1`);
}
