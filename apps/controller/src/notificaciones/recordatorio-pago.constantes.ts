/**
 * CU-67 / RF-49: recordatorio de pago previo al vencimiento.
 *
 * Los valores de `canal` y `estado_envio` no están en la tabla §11.15 de
 * enumeraciones del Documento 0 — ahí no existe "Canal notificación" ni
 * "Estado envío". Se reutilizan **los que el portal ya escribe** desde el CU-71
 * (`portal.service.ts`, tickets, agosto 2026): minúsculas, `email` como canal y
 * `enviado`/`fallido`/`omitido` como estados. Una sola convención por columna,
 * aunque el §11.15 use mayúsculas para los enums que sí define.
 *
 * Hay que reflejarlos en el diccionario común antes de producción (§13.2 del
 * acuerdo con G8).
 */

/**
 * §11 del Documento 0: la zona horaria del sistema es la de Chile continental.
 * Sin esto el cron corre a la hora del servidor, que en Railway es UTC: las 9
 * serían las 6 de la mañana en Chile.
 */
export const ZONA_HORARIA = 'America/Santiago';

/** RF-49: "tres días corridos antes de la fecha de vencimiento". */
export const DIAS_ANTES_DEL_VENCIMIENTO = 3;

/** El único canal que el portal sabe despachar hoy. Igual que el CU-71. */
export const CANAL_CORREO = 'email';

export const TIPO_EVENTO_RECORDATORIO = 'RECORDATORIO_PAGO';

export const ESTADO_ENVIO = {
  /** Se escribe antes de despachar: si el proceso muere, no se re-manda. */
  EN_CURSO: 'en_curso',
  /** Poscondición del CU: despacho exitoso con marca de tiempo. */
  ENVIADO: 'enviado',
  /**
   * Excepción 1: el cliente no tiene canales de contacto registrados. El CU lo
   * llama "no notificado"; el portal ya usaba `omitido` para exactamente esto
   * en el CU-71, así que se reutiliza en vez de abrir un segundo nombre.
   */
  NO_NOTIFICADO: 'omitido',
  /** Excepción 2: falló el despacho y también el reintento. */
  FALLIDO: 'fallido',
} as const;

/** Estados de factura que cuentan como deuda viva (igual que deuda-publica). */
export const ESTADOS_IMPAGOS = ['pendiente', 'vencida'];

/**
 * RNF-49.1: tope de 50 mensajes por segundo. Se despacha en tandas de ese
 * tamaño con una pausa de un segundo entre ellas.
 */
export const TANDA_MAXIMA = 50;
export const PAUSA_ENTRE_TANDAS_MS = 1000;

/**
 * Clave del candado de Postgres que evita que dos instancias del backend manden
 * el mismo recordatorio. Es un número arbitrario pero fijo: lo único que
 * importa es que nadie más lo use.
 */
export const CANDADO_RECORDATORIO_PAGO = 6720260929;
