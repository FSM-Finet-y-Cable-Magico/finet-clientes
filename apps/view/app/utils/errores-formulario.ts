import type { ZodType } from "zod";

type Issue = { path: PropertyKey[]; message: string };

/** El primer error de cada campo: es el que muestra el formulario debajo del campo. */
export function erroresPorCampo(issues: readonly Issue[]): Record<string, string> {
  const errores: Record<string, string> = {};
  for (const issue of issues) {
    const campo = String(issue.path[0]);
    if (!errores[campo]) errores[campo] = issue.message;
  }
  return errores;
}

/** El primer error de un campo, o "" si no tiene. */
export function errorDeCampo(issues: readonly Issue[], campo: string): string {
  return issues.find((i) => i.path[0] === campo)?.message ?? "";
}

/**
 * Al salir de un campo: valida el formulario completo, con el valor nuevo de
 * ese campo, y devuelve solo su error. Así las reglas que cruzan campos (como
 * "las contraseñas no coinciden") se revisan con lo que ya está escrito.
 */
export function validarCampo(
  esquema: ZodType,
  datos: Record<string, unknown>,
  campo: string,
): string {
  const r = esquema.safeParse(datos);
  return r.success ? "" : errorDeCampo(r.error.issues, campo);
}
