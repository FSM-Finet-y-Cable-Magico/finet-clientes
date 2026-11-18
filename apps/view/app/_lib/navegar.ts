/**
 * Carga la página completa, sin el router de Next: así no queda nada de la
 * página anterior (ni su caché ni sus precargas). Va aparte para poder
 * probarla: jsdom no deja reemplazar `window.location`.
 */
export function irA(url: string): void {
  window.location.assign(url);
}
