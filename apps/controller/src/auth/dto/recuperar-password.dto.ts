import { z } from 'zod';
import { empresaSchema, rutSchema } from '../../common/utils/validaciones.js';

export const recuperarPasswordSchema = z.object({
  rut: rutSchema,
  /** La empresa del sitio: el RUT se busca entre sus clientes. */
  id_empresa: empresaSchema.optional(),
});

export type RecuperarPasswordDto = z.infer<typeof recuperarPasswordSchema>;
