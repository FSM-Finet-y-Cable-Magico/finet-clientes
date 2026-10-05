/**
 * Contrato del endpoint de Grupo 3 para el cambio de clave WiFi
 * (`RESPUESTA-A-G2.md`, punto 3, y `RESPUESTA-A-G2-DESPLIEGUE.md`, 01-10-2026).
 * La URL base va en `G3_API_URL`: es el mismo host de sus otras integraciones.
 */
export const RUTA_CLAVE_WIFI_G3 = '/api/integraciones/contrasena-wifi';

/** Cuánto se espera cada intento antes de darlo por cortado. */
export const TIMEOUT_G3_MS = 8_000;

/**
 * Reintentos tras un corte, un timeout o un 5xx. Van con el mismo `request_id`
 * y el mismo body: G3 lo ratificó como idempotente (punto 3.6) y el acuerdo
 * v2.0 lo pide así (§6.6). Uno solo, porque el cliente está esperando la
 * respuesta en el formulario.
 */
export const REINTENTOS_G3 = 1;
