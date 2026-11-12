import { z } from 'zod';
import { empresaSchema, rutSchema } from '../../common/utils/validaciones.js';

export const loginSchema = z.object({
  rut: rutSchema,
  password: z.string().min(1, 'Contraseña es requerida'),
  /** La empresa del sitio: el RUT se busca entre sus clientes. */
  id_empresa: empresaSchema.optional(),
});

export type LoginDto = z.infer<typeof loginSchema>;
