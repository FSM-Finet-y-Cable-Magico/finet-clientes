/**
 * Cómo se le muestra al cliente lo que va dentro de un correo, según el §11 del
 * Documento 0.
 *
 * Las plantillas anteriores al CU-68 todavía muestran la fecha como se guarda en
 * la base (AAAA-MM-DD) e interpolan el nombre sin escapar: alinearlas queda para
 * el Incremento 4.
 */

/** §11: la zona horaria del sistema. La misma que usan las tareas programadas. */
const ZONA_HORARIA = 'America/Santiago';

/**
 * §11 "Fecha (display)": DD/MM/AAAA.
 *
 * Para columnas `@db.Date`, que llegan como medianoche UTC: se leen en UTC a
 * propósito. Pasadas a hora de Chile caerían en el día anterior.
 */
export function fechaCliente(fecha: Date): string {
  const dia = String(fecha.getUTCDate()).padStart(2, '0');
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${fecha.getUTCFullYear()}`;
}

/**
 * §11 "Fecha + hora": DD/MM/AAAA HH:MM, 24 horas, en hora de Chile.
 *
 * Para instantes (`@db.Timestamp`): un pago de las 22:30 en Chile ya es el día
 * siguiente en UTC, y el cliente tiene que ver su propia fecha.
 */
export function fechaHoraCliente(instante: Date): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('es-CL', {
      timeZone: ZONA_HORARIA,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instante)
      .map((p) => [p.type, p.value]),
  );
  return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute}`;
}

/** Pesos chilenos, sin decimales: $25.990. */
export function pesos(monto: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(monto);
}

/**
 * Escapa lo que va dentro del HTML de un correo. El nombre lo escribe el propio
 * cliente al registrarse, así que no se interpola tal cual.
 */
export function escaparHtml(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
