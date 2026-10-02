/**
 * Contratos server-to-server de Grupo 8 (su respuesta complementaria del
 * 02-10-2026). La URL base va en `INTEGRACION_G8_API_URL` y la clave en
 * `INTEGRACION_G8_API_KEY`, los nombres del acuerdo del 12-09 (§17).
 *
 * Nada de esto se llama hasta que G8 confirme su §15 (migración, deploy, clave y
 * smoke): lo deciden los huecos de `common/pendientes.ts`.
 */

/** §2: las facturas de un cliente o de un contrato, con su saldo. */
export const RUTA_FACTURAS_G8 = '/api/integrations/g2/invoices';

/** Cuánto se espera cada intento antes de darlo por cortado. */
export const TIMEOUT_G8_MS = 8_000;

/**
 * Reintentos tras un corte, un timeout o un 5xx. Una consulta se puede repetir
 * sin efectos; uno solo, porque hay alguien esperando la respuesta.
 */
export const REINTENTOS_G8 = 1;
