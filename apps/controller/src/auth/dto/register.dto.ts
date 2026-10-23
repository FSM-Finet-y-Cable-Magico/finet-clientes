import { z } from 'zod';
import { passwordSchema, rutSchema } from '../../common/utils/validaciones.js';
import { aceptacionPoliticaShape } from '../../common/politica-privacidad.js';

export const registerSchema = z
  .object({
    ...aceptacionPoliticaShape,
    rut: rutSchema,
    nombre_completo: z
      .string()
      .min(2, 'Nombre debe tener al menos 2 caracteres')
      .max(120),
    email: z
      .string()
      .min(1, 'Email es requerido')
      .email('Email inválido')
      .max(120),
    telefono: z.string().max(20).optional().or(z.literal('')),
    password: passwordSchema,
    password_confirmation: z
      .string()
      .min(1, 'Confirmación de contraseña es requerida'),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'Las contraseñas no coinciden',
    path: ['password_confirmation'],
  });

export type RegisterDto = z.infer<typeof registerSchema>;
