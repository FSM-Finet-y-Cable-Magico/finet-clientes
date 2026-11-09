/**
 * CU-77: categoria de los tickets que abre el asistente al derivar. El ticket
 * exige una; el operador la cambia desde el CRM si corresponde otra.
 *
 * La pone el sistema, no el cliente: no se ofrece al reportar una falla, ni
 * en el portal (CU-29) ni en el asistente (CU-66).
 */
export const CATEGORIA_ESCALAMIENTO = 'Asistente virtual';

/**
 * Como nacen los tickets del asistente (CU-66 y CU-77). En MAYUSCULAS por la
 * convencion del §11.15 del Documento 0 para los catalogos cerrados, la misma
 * que usa el CRM (G8) en sus tickets (`ABIERTO`, `EN_PROGRESO`; origen `CRM`,
 * `PORTAL`, `WHATSAPP`...): si no, el CRM no los encuentra al filtrar.
 *
 * Sin operador: la asignacion es del CRM (G8 es dueño de los tickets).
 */
export const TICKET_ASISTENTE = {
  estado: 'ABIERTO',
  prioridad: 'MEDIA',
  origen: 'ASISTENTE',
} as const;

/**
 * Como nacen los tickets del portal (CU-71 y CU-32). El acuerdo v2.0 (§7) pide
 * origen PORTAL, y el CRM los filtra en mayusculas.
 */
export const TICKET_PORTAL = {
  estado: 'ABIERTO',
  prioridad: 'MEDIA',
  origen: 'PORTAL',
} as const;

/** CU-32: categoria del ticket de cambio de clave WiFi (acuerdo v2.0, §6.1). */
export const CATEGORIA_CAMBIO_WIFI = 'CAMBIO_CREDENCIALES_WIFI';

/** Como ve el cliente la categoria en su historial (CU-30). */
export function categoriaVisible(nombre: string): string {
  return nombre === CATEGORIA_CAMBIO_WIFI
    ? 'Cambio de contraseña WiFi'
    : nombre;
}

/**
 * CU-77: rol de los operadores que atienden lo que deriva el asistente. En la
 * base esta como `Soporte`; se compara sin distinguir mayusculas.
 */
export const ROL_OPERADOR = 'SOPORTE';
