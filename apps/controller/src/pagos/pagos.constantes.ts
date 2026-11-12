/**
 * CU-42: el medio de pago. El RF-31 nombra Webpay y Mercado Pago, pero solo se
 * usa Transbank (decisión del 22-10): Mercado Pago no se construye.
 *
 * `noDisponible` es el texto de la Excepción 1 del CU-42: "el medio de pago no
 * puede utilizarse temporalmente".
 */
export const MEDIOS_PAGO = [
  {
    id: 'webpay',
    nombre: 'Webpay',
    descripcion: 'Tarjetas de débito, crédito y prepago',
    noDisponible:
      'Webpay no puede utilizarse temporalmente. Intenta más tarde.',
  },
] as const;

export type MedioPago = (typeof MEDIOS_PAGO)[number]['id'];

/**
 * El nombre del medio, el mismo que muestra `/pagar` (`webpay` → Webpay). El
 * §11.15 no define un enum de medio de pago, así que un valor que no
 * conocemos se muestra tal como está guardado.
 */
export function nombreMedioPago(pasarela: string): string {
  const medio = MEDIOS_PAGO.find((m) => m.id === pasarela.trim().toLowerCase());
  return medio?.nombre ?? pasarela;
}

export const IDS_MEDIOS_PAGO = MEDIOS_PAGO.map((m) => m.id) as [
  MedioPago,
  ...MedioPago[],
];

/**
 * Cuánto se espera cada llamada a Transbank. El SDK trae 10 minutos, y hay un
 * cliente esperando la respuesta.
 */
export const TIMEOUT_WEBPAY_MS = 15_000;

/**
 * Con qué se pagó, para G8 (`pasarela`: "identifica medio/proveedor/canal", su
 * respuesta del 01-10, §4.1). Es el id del medio: así el historial de pagos del
 * CU-52, que lee `pago.pasarela`, lo muestra como "Webpay". Se confirma en la
 * prueba conjunta con G8.
 */
export const PASARELA_G8: MedioPago = 'webpay';

/**
 * Cómo terminó un pago, para la pantalla de resultado:
 * - `aprobado`: Webpay lo aprobó y G8 lo registró;
 * - `pendiente`: Webpay lo aprobó, pero G8 todavía no lo registra;
 * - `anulado`: G8 lo rechazó y se anuló en Webpay;
 * - `rechazado`: Webpay no lo aprobó (Excepción 3 del CU-42);
 * - `cancelado`: el cliente no lo terminó (Excepción 2);
 * - `error`: no se pudo saber.
 */
export const RESULTADOS_PAGO = [
  'aprobado',
  'pendiente',
  'anulado',
  'rechazado',
  'cancelado',
  'error',
] as const;

export type ResultadoPago = (typeof RESULTADOS_PAGO)[number];
