/**
 * Cómo se le muestran al cliente los montos y las fechas, según el §11 del
 * Documento 0. Todas las pantallas formatean desde acá.
 */

/** §11.5: `$XX.XXX`, separador de miles con punto. */
export function formatPrecio(monto: number): string {
  return `$${monto.toLocaleString("es-CL")}`;
}

/**
 * - `larga`: "1 de junio de 2026";
 * - `corta`: "29 may";
 * - `numerica`: "01/06/2026" (§11.4, DD/MM/AAAA).
 */
export type EstiloFecha = "larga" | "corta" | "numerica";

const OPCIONES: Record<EstiloFecha, Intl.DateTimeFormatOptions> = {
  larga: { year: "numeric", month: "long", day: "numeric" },
  corta: { day: "numeric", month: "short" },
  numerica: { day: "2-digit", month: "2-digit", year: "numeric" },
};

function formatear(fecha: string, estilo: EstiloFecha, timeZone: string) {
  const formato = new Intl.DateTimeFormat("es-CL", {
    ...OPCIONES[estilo],
    timeZone,
  });
  if (estilo !== "numerica") return formato.format(new Date(fecha));
  // es-CL separa con guiones ("01-06-2026"); el §11.4 pide barras.
  const partes = Object.fromEntries(
    formato.formatToParts(new Date(fecha)).map((p) => [p.type, p.value]),
  );
  return `${partes.day}/${partes.month}/${partes.year}`;
}

/**
 * Una fecha de calendario, sin hora (`@db.Date`: `fecha_inicio`,
 * `fecha_limite_pago`). Llega como medianoche UTC y se formatea en UTC: en hora
 * de Chile caería el día anterior.
 */
export function fechaCalendario(fecha: string, estilo: EstiloFecha): string {
  return formatear(fecha, estilo, "UTC");
}

/**
 * Un instante, con hora (`fecha_creacion`, `fecha_cierre`, `fecha_pago`). Se
 * muestra en la hora de Chile (§11.4, America/Santiago).
 */
export function fechaInstante(fecha: string, estilo: EstiloFecha): string {
  return formatear(fecha, estilo, "America/Santiago");
}
