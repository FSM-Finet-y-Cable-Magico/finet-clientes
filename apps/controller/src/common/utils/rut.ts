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

/**
 * Dígito verificador por módulo 11: los dígitos del cuerpo de derecha a
 * izquierda, multiplicados por 2, 3, 4, 5, 6 y 7 (y de vuelta al 2), se suman;
 * el dígito es 11 menos el resto de dividir por 11, con 11 → 0 y 10 → K.
 *
 * Antes se multiplicaba de izquierda a derecha por una lista fija
 * (3, 2, 7, 6, 5, 4, 3, 2), que solo coincide con este cálculo cuando el cuerpo
 * tiene 8 dígitos: rechazaba los RUT bajo 10 millones (9.345.678-5, el ejemplo
 * del §11 del Documento 0) y aceptaba algunos inválidos (7.777.777-K).
 */
export function validateRut(rut: string): boolean {
  const clean = cleanRut(rut);
  if (!/^\d{1,8}[\dkK]$/.test(clean)) return false;

  const body = clean.slice(0, -1);
  const dvIngresado = clean.slice(-1).toUpperCase();

  // Modulo 11: los factores 2..7 se aplican desde el ultimo digito hacia la
  // izquierda. Contarlos desde la izquierda solo acierta con cuerpos de 8
  // digitos y rechaza los RUT bajo 10 millones.
  let suma = 0;
  let factor = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    suma += parseInt(body[i], 10) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }

  const dvEsperado = 11 - (suma % 11);
  const dvChar =
    dvEsperado === 11 ? '0' : dvEsperado === 10 ? 'K' : String(dvEsperado);

  return dvChar === dvIngresado;
}
