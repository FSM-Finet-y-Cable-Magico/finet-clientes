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

/**
 * Días entre el vencimiento y el corte. §6.7.3 del Documento 0: "ante
 * morosidad, se otorga una prórroga de 4 días antes de efectuar un corte del
 * servicio". Solo sirven para calcular la **fecha de corte** del aviso: al
 * cliente se le muestra la fecha, no los días.
 */
export const DIAS_GRACIA_CORTE = 4;
