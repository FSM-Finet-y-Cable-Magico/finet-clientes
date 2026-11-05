const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/** El periodo de una factura como se le muestra al cliente: "Mayo 2026". */
export function formatPeriodo(mes: number, anio: number): string {
  return `${MESES[mes - 1]} ${anio}`;
}
