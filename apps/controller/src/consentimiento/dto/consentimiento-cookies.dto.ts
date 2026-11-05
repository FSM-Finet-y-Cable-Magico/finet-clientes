import { z } from 'zod';

/**
 * CU-76 / RF-57: decisión del banner de cookies.
 *
 * `acepto` cubre las dos opciones que exige el RF-57: aceptar o rechazar el
 * seguimiento para analítica. El rechazo también se registra — es la prueba de
 * que se preguntó y de qué contestó el visitante.
 */
export const ConsentimientoCookiesDto = z.object({
  acepto: z.boolean(),
  /** La versión del documento de privacidad que el visitante tenía a la vista. */
  version_documento: z.string().trim().min(1).max(20),
});
export type ConsentimientoCookiesDto = z.infer<typeof ConsentimientoCookiesDto>;

export interface ConsentimientoCookiesResponseDto {
  registrado: boolean;
}
