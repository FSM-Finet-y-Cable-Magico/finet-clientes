import { Throttle } from '@nestjs/throttler';

/**
 * El `ttl` de `@nestjs/throttler` (v6) va en milisegundos: `ttl: 60` son 60 ms,
 * no un minuto.
 */
export const UN_MINUTO_MS = 60_000;

/**
 * Peticiones por minuto en las rutas que exigen sesión (portal, perfil y
 * cierre de sesión).
 *
 * El Documento 0 pide 10 por minuto por IP solo en los endpoints públicos
 * (RNF-29.2 y la tabla de tecnologías), que es el límite global. Cada pantalla
 * del portal hace 2 o 3 peticiones, así que con 10 un cliente que recorre su
 * cuenta veía "No se pudo cargar la información" a la cuarta o quinta pantalla
 * (recorrido en la VPS, 07-11). Estas rutas ya exigen un JWT válido: el tope
 * solo frena un abuso, no la navegación normal.
 */
export const LIMITE_CON_SESION_POR_MINUTO = 120;

/**
 * Descargas de comprobantes por minuto (CU-52): cada una genera un PDF en el
 * servidor, así que tiene un tope propio, más bajo que el del resto del portal.
 */
export const LIMITE_COMPROBANTES_POR_MINUTO = 20;

/** El límite de las rutas con sesión, para el controlador o la ruta. */
export const ConLimiteDeSesion = () =>
  Throttle({
    default: { limit: LIMITE_CON_SESION_POR_MINUTO, ttl: UN_MINUTO_MS },
  });
