import { z } from 'zod';
import { cleanRut, validateRut } from '../../common/utils/rut.js';
import { aceptacionPoliticaShape } from '../../common/politica-privacidad.js';

export const ContratacionDto = z.object({
  ...aceptacionPoliticaShape,
  nombre_completo: z.string().min(1).max(120),
  rut: z
    .string()
    .transform((v) => cleanRut(v))
    .refine(validateRut, { message: 'RUT inválido' }),
  email: z.string().email().max(120),
  telefono: z.string().max(20).optional().nullable(),
  id_plan: z.number().int().positive(),
  direccion_completa: z.string().min(1).max(200),
  comuna: z.string().min(1).max(80),
  ciudad: z.string().max(80).optional().nullable(),
});
export type ContratacionDto = z.infer<typeof ContratacionDto>;

export interface ContratacionResponseDto {
  id_cliente: number;
  id_contrato: number;
  id_ot: number;
}
