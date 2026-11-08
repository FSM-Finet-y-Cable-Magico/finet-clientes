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
 * ningún lado. Webpay Plus (CU-42) ya está construido, en el ambiente que diga
 * `WEBPAY_AMBIENTE`: de integración mientras Finet no entregue su código de
 * comercio. Para cobrar falta además el registro de G8 (abajo).
 */
export const PASARELA_ACTIVA = true;

/**
 * El registro de un pago confirmado (RF-32: fecha, monto y código de
 * autorización). Es de Grupo 8 (§3 del acuerdo v2.0). En su respuesta del 01-10
 * lo definió: `POST /api/integrations/g2/payments`, con `codigo_autorizacion`
 * como campo nuevo. El 08-11 G8 lo confirmó desplegado y validado en la VPS
 * (QA-G2-14: 201 la primera vez y `duplicado: true` la segunda, con un solo
 * pago) y autorizó prenderlo, con Webpay en integración. Sin él no hay pago
 * registrado, y el CU-69, cuya precondición es justamente ese registro, no
 * tiene qué confirmar.
 */
export const REGISTRO_PAGO_DEFINIDO = true;

/**
 * El saldo que debe cada cliente. La deuda la calcula G8, no nosotros: el acuerdo
 * v2.0 pone Factura y Pago de su lado (§3) y dice que G2 no reconstruye reglas
 * derivadas (§5). En su respuesta del 01-10, G8 confirmó que el saldo no es una
 * columna: lo calcula su Billing y lo entrega `GET /api/integrations/g2/invoices`.
 * El 02-10 mandó el formato (`saldoExigible` por factura), y la lectura ya está
 * construida (`common/saldo/saldo-cliente.service.ts`). El 07-11 G8 activó la
 * clave de G2 y validó la consulta (HTTP 200 con su cliente QA), y pidió prender
 * este interruptor, dejando apagado el registro del pago hasta probar Webpay en
 * conjunto. Sin el saldo, el pago no tiene un total que cobrar (la precondición
 * del CU-42 es "una deuda pendiente identificada"), y el aviso de corte (CU-68)
 * no tiene monto.
 */
export const SALDO_CLIENTE_DEFINIDO = true;

/**
 * El ticket del cambio de clave WiFi. G8 lo definió el 01-10: categoría
 * `CAMBIO_CREDENCIALES_WIFI` y servicio en `ticket.id_servicio` (FK a
 * `servicio_contratado`), que nuestro esquema todavía no tiene. El resultado se
 * le informa con `POST /api/integrations/g2/tickets/{idTicket}/wifi-result`,
 * cuyo formato mandó el 02-10 y ya está construido. Falta que G8 lo despliegue. El §6.4 pide crear el ticket antes de llamar a G3 y
 * mandarle su id como correlación, así que sin él el CU-32 no llama a G3: sigue
 * con el flujo v1, que el §6.7 permite conservar mientras tanto.
 */
export const TICKET_WIFI_DEFINIDO = false;

/**
 * La boleta de un pago, para descargarla (CU-52). En la reunión con G8 quedó que
 * el "comprobante" del CU-52 es la boleta: la emite G8 con Facturacion.cl y la
 * entrega `GET /api/integrations/g2/payments/{id_pago}/tax-document` (su
 * respuesta del 02-10, §10, con `documento_url`). Falta que G8 lo implemente y
 * que Finet confirme que quiere la descarga en el portal (G8 le pregunta al área
 * comercial). Hasta entonces el cliente ve sus pagos anteriores, pero la descarga
 * cae en la Excepción 2 del CU-52: el comprobante no está disponible.
 */
export const COMPROBANTE_G8_DEFINIDO = false;

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
    destraba: 'CU-42, CU-68, CU-69',
    estaVacio: () => !PASARELA_ACTIVA,
  },
  {
    dato: 'Registro del pago desplegado (POST /api/integrations/g2/payments)',
    quien: 'Grupo 8',
    destraba: 'CU-42, CU-69',
    estaVacio: () => !REGISTRO_PAGO_DEFINIDO,
  },
  {
    dato: 'Saldo del cliente desplegado (GET /api/integrations/g2/invoices)',
    quien: 'Grupo 8',
    destraba: 'CU-42, CU-68',
    estaVacio: () => !SALDO_CLIENTE_DEFINIDO,
  },
  {
    dato: 'Ticket WiFi desplegado (categoría, ticket.id_servicio y wifi-result)',
    quien: 'Grupo 8',
    destraba: 'CU-32 (envío directo a G3)',
    estaVacio: () => !TICKET_WIFI_DEFINIDO,
  },
  {
    dato: 'Boleta del pago (GET /api/integrations/g2/payments/{id}/tax-document) y que Finet confirme la descarga',
    quien: 'Grupo 8',
    destraba: 'CU-52',
    estaVacio: () => !COMPROBANTE_G8_DEFINIDO,
  },
];

/** Los que siguen vacíos, en una línea cada uno, para el log de arranque. */
export function pendientesVacios(): string[] {
  return PENDIENTES.filter((p) => p.estaVacio()).map(
    (p) => `${p.destraba} ← ${p.dato} (${p.quien})`,
  );
}
