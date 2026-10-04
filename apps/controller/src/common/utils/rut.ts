export function cleanRut(rut: string): string {
  return rut.replace(/\./g, '').replace(/-/g, '');
}

export function formatRut(rut: string): string {
  const clean = cleanRut(rut);
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1).toUpperCase();
  return `${body}-${dv}`;
}

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
