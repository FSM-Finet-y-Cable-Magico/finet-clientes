export function cleanRut(rut: string): string {
  return rut.replace(/\./g, '').replace(/-/g, '');
}

export function formatRut(rut: string): string {
  const clean = cleanRut(rut);
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1).toUpperCase();
  return `${body}-${dv}`;
}

/**
 * Las formas en que un mismo RUT puede estar guardado en `cliente.rut`, para
 * buscarlo con `{ rut: { in: variantesRut(rut) } }`.
 *
 * El §11 del Documento 0 pide guardarlo sin puntos ni guion, y así lo
 * escribimos. Pero la base es compartida: G3 midió en producción (29-09) 14 de
 * 25 clientes guardados con guion, y recomendó buscar en las dos formas. Lo que
 * escribimos no cambia; solo la búsqueda acepta ambas, con la K en mayúscula o
 * minúscula.
 */
export function variantesRut(rut: string): string[] {
  const limpio = cleanRut(rut);
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  const formas = [dv.toUpperCase(), dv.toLowerCase()].flatMap((d) => [
    `${cuerpo}${d}`,
    `${cuerpo}-${d}`,
  ]);
  return [...new Set(formas)];
}

const FACTORES = [3, 2, 7, 6, 5, 4, 3, 2];

export function validateRut(rut: string): boolean {
  const clean = cleanRut(rut);
  if (!/^\d{1,8}[\dkK]$/.test(clean)) return false;

  const body = clean.slice(0, -1);
  const dvIngresado = clean.slice(-1).toUpperCase();

  let suma = 0;
  for (let i = 0; i < body.length; i++) {
    suma += parseInt(body[i], 10) * FACTORES[i];
  }

  const dvEsperado = 11 - (suma % 11);
  const dvChar =
    dvEsperado === 11 ? '0' : dvEsperado === 10 ? 'K' : String(dvEsperado);

  return dvChar === dvIngresado;
}
