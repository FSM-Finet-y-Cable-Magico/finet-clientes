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
 * Dónde queda registrado un pago confirmado (RF-32: fecha, monto y código de
 * autorización). El registro es de Grupo 8 (§3 del acuerdo v2.0). Sin él no hay
 * pago registrado, y el CU-69, cuya precondición es justamente ese registro, no
 * tiene qué confirmar.
 */
export const REGISTRO_PAGO_DEFINIDO = false;

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
    dato: 'Dónde queda registrado el pago confirmado (tabla y campos)',
    quien: 'Grupo 8',
    destraba: 'CU-42, CU-43, CU-69',
    estaVacio: () => !REGISTRO_PAGO_DEFINIDO,
  },
];

/** Los que siguen vacíos, en una línea cada uno, para el log de arranque. */
export function pendientesVacios(): string[] {
  return PENDIENTES.filter((p) => p.estaVacio()).map(
    (p) => `${p.destraba} ← ${p.dato} (${p.quien})`,
  );
}
