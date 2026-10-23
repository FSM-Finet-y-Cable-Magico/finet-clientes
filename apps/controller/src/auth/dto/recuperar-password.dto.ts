import { z } from 'zod';
import { rutSchema } from '../../common/utils/validaciones.js';

export const recuperarPasswordSchema = z.object({
  rut: rutSchema,
});

export type RecuperarPasswordDto = z.infer<typeof recuperarPasswordSchema>;
