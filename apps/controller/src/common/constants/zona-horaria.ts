/**
 * §11 del Documento 0: la zona horaria del sistema es la de Chile continental.
 * La usan las tareas programadas (sin ella el cron corre a la hora del
 * servidor, que en Railway es UTC) y las fechas de los correos.
 */
export const ZONA_HORARIA = 'America/Santiago';
