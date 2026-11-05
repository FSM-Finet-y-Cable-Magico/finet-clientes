/**
 * CU-69 / RF-51: confirmación de pago registrado.
 *
 * Reutiliza la convención de `log_notificacion` del CU-67 y del CU-71 (`email`
 * como canal; `enviado`, `fallido` y `omitido` como estados).
 */

export const TIPO_EVENTO_CONFIRMACION_PAGO = 'CONFIRMACION_PAGO';
