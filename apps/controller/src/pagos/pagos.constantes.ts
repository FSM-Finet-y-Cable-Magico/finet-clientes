/**
 * CU-42 / CU-43: los dos medios de pago que el RF-31 nombra.
 *
 * `noDisponible` es el texto de la Excepción 1 de cada CU, que es lo que ve el
 * cliente mientras no haya pasarela: el CU-42 dice "el medio de pago no puede
 * utilizarse temporalmente" y el CU-43 "Mercado Pago se encuentra
 * temporalmente indisponible".
 */
export const MEDIOS_PAGO = [
  {
    id: 'webpay',
    nombre: 'Webpay',
    descripcion: 'Tarjetas de débito, crédito y prepago',
    noDisponible:
      'Webpay no puede utilizarse temporalmente. Intenta más tarde.',
  },
  {
    id: 'mercadopago',
    nombre: 'Mercado Pago',
    descripcion: 'Tarjetas y dinero en tu cuenta de Mercado Pago',
    noDisponible:
      'Mercado Pago se encuentra temporalmente indisponible. Intenta más tarde.',
  },
] as const;

export type MedioPago = (typeof MEDIOS_PAGO)[number]['id'];

export const IDS_MEDIOS_PAGO = MEDIOS_PAGO.map((m) => m.id) as [
  MedioPago,
  ...MedioPago[],
];
