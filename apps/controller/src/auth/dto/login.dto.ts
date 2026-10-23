import { z } from 'zod';
import { rutSchema } from '../../common/utils/validaciones.js';

export const loginSchema = z.object({
  rut: rutSchema,
  password: z.string().min(1, 'Contraseña es requerida'),
});

export type LoginDto = z.infer<typeof loginSchema>;
