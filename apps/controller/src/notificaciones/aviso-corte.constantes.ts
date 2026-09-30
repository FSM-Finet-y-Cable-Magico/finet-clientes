/**
 * CU-68 / RF-50: aviso de corte inminente por morosidad.
 *
 * Reutiliza la convención de `log_notificacion` del CU-67 y del CU-71 (`email`
 * como canal; `enviado`, `fallido` y `omitido` como estados).
 */

export const TIPO_EVENTO_AVISO_CORTE = 'AVISO_CORTE';

/**
 * Clave del candado de Postgres de esta tarea. Distinta de la del CU-67: si
 * fueran la misma, una tarea bloquearía a la otra.
 */
export const CANDADO_AVISO_CORTE = 6820260930;
