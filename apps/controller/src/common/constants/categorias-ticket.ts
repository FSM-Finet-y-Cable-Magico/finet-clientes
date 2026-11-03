/**
 * Categorías de ticket que el cliente puede elegir al pedir soporte (CU-71).
 *
 * Son las siete de la **Tabla 11.9 del Documento 0** ("Catálogo de Categorías
 * de Ticket", CAT-01 a CAT-07). El RF-53 pide "seleccionar una categoría de
 * tipificación predefinida".
 *
 * `categoria_falla` es una tabla compartida y en la base real tiene más filas:
 * las internas de otros grupos (por ejemplo `CAMBIO_CREDENCIALES_WIFI`,
 * "Cliente ausente" o "IPTV pirata") y la que pone el sistema al derivar desde
 * el asistente (CU-77). Esas no se le ofrecen al cliente ni se aceptan al crear
 * un ticket. El catálogo es de G8 (acuerdo v2.0 §3): si en su base los nombres
 * son otros, se corrige esta lista.
 */
export const CATEGORIAS_CLIENTE = [
  'Falla de Internet',
  'Falla de TV',
  'Cambio de plan',
  'Mudanza',
  'Facturación y cobro',
  'Consulta general',
  'Baja de servicio',
];

/**
 * El filtro de Prisma para quedarse con esas siete. No distingue mayúsculas:
 * "Falla de internet" en la base también cuenta.
 */
export const FILTRO_CATEGORIAS_CLIENTE = {
  nombre: { in: CATEGORIAS_CLIENTE, mode: 'insensitive' as const },
};
