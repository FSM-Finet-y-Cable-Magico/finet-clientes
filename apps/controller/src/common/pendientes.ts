/**
 * Lo que falta para que funcionen los casos de uso del Incremento 3.
 *
 * Cada constante es un dato que todavía no tenemos. El código que lo necesita lo
 * lee desde acá, y mientras esté vacío ese caso de uso **no se ejecuta**: cae en
 * la excepción o precondición que su tabla del Documento 0 ya define, nunca en un
 * éxito falso. Cuando respondan, se rellena acá.
 *
 * `PENDIENTES` es la lista legible: qué falta, de quién, y qué destraba. Se
 * muestra en el log al arrancar el backend.
 */

/**
 * Si hay una pasarela de pagos operativa. La precondición del CU-68 lo exige: el
 * aviso de corte lleva un enlace para pagar, y sin pasarela ese enlace no lleva a
 * ningún lado. Se rellena cuando se construya el pago (CU-42 y CU-43).
 */
export const PASARELA_ACTIVA = false;

/**
 * El registro de un pago confirmado (RF-32: fecha, monto y código de
 * autorización). Es de Grupo 8 (§3 del acuerdo v2.0). En su respuesta del 01-10
 * lo definió: `POST /api/integrations/g2/payments`, con `codigo_autorizacion`
 * como campo nuevo. Falta que apliquen la migración y lo desplieguen, y hasta que
 * lo confirmen no se consume. Sin él no hay pago registrado, y el CU-69, cuya
 * precondición es justamente ese registro, no tiene qué confirmar.
 */
export const REGISTRO_PAGO_DEFINIDO = false;

/**
 * El saldo que debe cada cliente. La deuda la calcula G8, no nosotros: el acuerdo
 * v2.0 pone Factura y Pago de su lado (§3) y dice que G2 no reconstruye reglas
 * derivadas (§5). En su respuesta del 01-10, G8 confirmó que el saldo no es una
 * columna: lo calcula su Billing y lo entrega `GET /api/integrations/g2/invoices`,
 * con el vencimiento efectivo de cada factura. Falta que lo desplieguen. Sin él,
 * el pago no tiene un total que cobrar (la precondición del CU-42 y del CU-43 es
 * "una deuda pendiente identificada"), y el aviso de corte (CU-68) no tiene monto.
 */
export const SALDO_CLIENTE_DEFINIDO = false;

/**
 * El ticket del cambio de clave WiFi. G8 lo definió el 01-10: categoría
 * `CAMBIO_CREDENCIALES_WIFI` y servicio en `ticket.id_servicio` (FK a
 * `servicio_contratado`), que nuestro esquema todavía no tiene. El resultado se
 * le informa con `POST /api/integrations/g2/tickets/{idTicket}/wifi-result`.
 * Falta que G8 lo despliegue. El §6.4 pide crear el ticket antes de llamar a G3 y
 * mandarle su id como correlación, así que sin él el CU-32 no llama a G3: sigue
 * con el flujo v1, que el §6.7 permite conservar mientras tanto.
 */
export const TICKET_WIFI_DEFINIDO = false;

export type Pendiente = {
  dato: string;
  quien: 'Grupo 2' | 'Grupo 8' | 'Grupo 3';
  destraba: string;
  estaVacio: () => boolean;
};

export const PENDIENTES: readonly Pendiente[] = [
  {
    dato: 'Pasarela de pagos operativa',
    quien: 'Grupo 2',
    destraba: 'CU-42, CU-43, CU-68, CU-69',
    estaVacio: () => !PASARELA_ACTIVA,
  },
  {
    dato: 'Registro del pago desplegado (POST /api/integrations/g2/payments)',
    quien: 'Grupo 8',
    destraba: 'CU-42, CU-43, CU-69',
    estaVacio: () => !REGISTRO_PAGO_DEFINIDO,
  },
  {
    dato: 'Saldo del cliente desplegado (GET /api/integrations/g2/invoices)',
    quien: 'Grupo 8',
    destraba: 'CU-42, CU-43, CU-68',
    estaVacio: () => !SALDO_CLIENTE_DEFINIDO,
  },
  {
    dato: 'Ticket WiFi desplegado (categoría, ticket.id_servicio y wifi-result)',
    quien: 'Grupo 8',
    destraba: 'CU-32 (envío directo a G3)',
    estaVacio: () => !TICKET_WIFI_DEFINIDO,
  },
];

/** Los que siguen vacíos, en una línea cada uno, para el log de arranque. */
export function pendientesVacios(): string[] {
  return PENDIENTES.filter((p) => p.estaVacio()).map(
    (p) => `${p.destraba} ← ${p.dato} (${p.quien})`,
  );
}
