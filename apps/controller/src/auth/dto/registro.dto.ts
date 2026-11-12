import { z } from 'zod';
import {
  empresaSchema,
  passwordSchema,
  rutSchema,
} from '../../common/utils/validaciones.js';
import { aceptacionPoliticaShape } from '../../common/politica-privacidad.js';

/** CU-04, paso 1: el RUT del cliente que quiere crear su cuenta. */
export const solicitudRegistroSchema = z.object({
  rut: rutSchema,
  /** La empresa del sitio: el RUT se busca entre sus clientes. */
  id_empresa: empresaSchema.optional(),
});
export type SolicitudRegistroDto = z.infer<typeof solicitudRegistroSchema>;

/**
 * CU-04, paso 2: la contraseña nueva, con el enlace que le llegó al correo.
 * RF-09 y CU-11 (complejidad, validada en el backend por el RNF-09.1),
 * Excepción 3 (la confirmación tiene que coincidir) y CU-75 (la casilla).
 */
export const confirmacionRegistroSchema = z
  .object({
    ...aceptacionPoliticaShape,
    token: z.string().min(1, 'Token es requerido'),
    password: passwordSchema,
    password_confirmation: z
      .string()
      .min(1, 'Confirmación de contraseña es requerida'),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'Las contraseñas no coinciden',
    path: ['password_confirmation'],
  });
export type ConfirmacionRegistroDto = z.infer<
  typeof confirmacionRegistroSchema
>;
