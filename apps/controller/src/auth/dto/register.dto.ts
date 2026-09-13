import { z } from 'zod';
import { validateRut } from '../../common/utils/rut.js';
import { aceptacionPoliticaShape } from '../../common/politica-privacidad.js';

export const registerSchema = z
  .object({
    ...aceptacionPoliticaShape,
    rut: z
      .string()
      .min(1, 'RUT es requerido')
      .refine((val) => /^\d{1,8}[\dkK]$/.test(val), {
        message: 'Formato inválido. Ej: 123456785',
      })
      .refine((val) => validateRut(val), {
        message: 'RUT inválido — dígito verificador incorrecto',
      }),
    nombre_completo: z
      .string()
      .min(2, 'Nombre debe tener al menos 2 caracteres')
      .max(120),
    email: z
      .string()
      .min(1, 'Email es requerido')
      .email('Email inválido')
      .max(120),
    telefono: z.string().max(21).optional().or(z.literal('')),
    password: z
      .string()
      .min(8, 'Contraseña debe tener al menos 8 caracteres')
      .max(72)
      .refine((val) => /[A-Z]/.test(val), {
        message: 'Contraseña debe contener al menos una mayúscula',
      })
      .refine((val) => /[0-9]/.test(val), {
        message: 'Contraseña debe contener al menos un número',
      }),
    password_confirmation: z
      .string()
      .min(1, 'Confirmación de contraseña es requerida'),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'Las contraseñas no coinciden',
    path: ['password_confirmation'],
  });

export type RegisterDto = z.infer<typeof registerSchema>;
