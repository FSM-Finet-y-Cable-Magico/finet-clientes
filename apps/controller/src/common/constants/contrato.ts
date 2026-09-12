/**
 * Estados del servicio contratado.
 *
 * Los valores salen de la **Tabla 11.15 del Documento 0** ("Enumeraciones
 * Consolidadas"), que es la fuente canonica:
 *
 *   Estado servicio: ACTIVO | SUSPENDIDO | CORTADO | BAJA | PENDIENTE | REACTIVADO
 *
 * Ojo: el texto del CU-24 del mismo documento nombra solo tres valores
 * ("Activo", "En Tramite" o "Suspendido"). Esa lista mas corta es la que se
 * habia implementado y es la que dejaba caer el portal cuando llegaba
 * cualquier otro estado. Entre las dos definiciones manda la tabla.
 */
export const ESTADOS_CONTRATO = [
  'ACTIVO',
  'SUSPENDIDO',
  'CORTADO',
  'BAJA',
  'PENDIENTE',
  'REACTIVADO',
] as const;

export type EstadoContrato = (typeof ESTADOS_CONTRATO)[number];

/**
 * Valores heredados que siguen vivos en la base y que no existen en la tabla
 * 11.15. Se mapean al canonico en vez de tratarlos como desconocidos: son
 * datos que escribio este mismo sistema antes de unificar el vocabulario.
 */
const ALIAS_HISTORICOS: Record<string, EstadoContrato> = {
  EN_TRAMITE: 'PENDIENTE',
  INACTIVO: 'BAJA',
};

/**
 * Lleva cualquier variante escrita en la base al valor canonico de la tabla
 * 11.15. Ignora mayusculas y espacios porque la base compartida la escriben
 * cuatro equipos y nadie garantiza el formato.
 *
 * Devuelve `null` si el valor no se reconoce — el llamador decide que hacer,
 * pero **no se lanza una excepcion**: el portal del cliente es una pantalla de
 * lectura y no puede caerse porque otro sistema escribio un estado nuevo.
 */
export function normalizarEstadoContrato(
  estado: string | null | undefined,
): EstadoContrato | null {
  if (!estado) return null;

  const limpio = estado
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

  if ((ESTADOS_CONTRATO as readonly string[]).includes(limpio)) {
    return limpio as EstadoContrato;
  }

  return ALIAS_HISTORICOS[limpio] ?? null;
}

/**
 * Estados en los que el servicio sigue siendo del cliente y por lo tanto se
 * muestra en el portal (CU-25 / CU-26).
 *
 * Incluye SUSPENDIDO y CORTADO a proposito: cuando el CRM suspende o corta por
 * morosidad, el cliente tiene que **ver** ese estado en su portal. Excluye solo
 * BAJA, que es el servicio terminado.
 */
export const ESTADOS_CONTRATO_VIGENTES: EstadoContrato[] = [
  'ACTIVO',
  'REACTIVADO',
  'SUSPENDIDO',
  'CORTADO',
  'PENDIENTE',
];
