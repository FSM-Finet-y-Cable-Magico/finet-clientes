import { z } from 'zod';
import { passwordSchema } from '../../common/utils/validaciones.js';

export const restablecerPasswordSchema = z.object({
  token: z.string().min(1, 'Token es requerido'),
  password: passwordSchema,
});

export type RestablecerPasswordDto = z.infer<typeof restablecerPasswordSchema>;
