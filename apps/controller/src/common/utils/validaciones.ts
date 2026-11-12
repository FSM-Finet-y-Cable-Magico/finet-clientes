import { z } from 'zod';
import { validateRut } from './rut.js';
import { esEmpresaConocida } from '../constants/empresas.js';

/** El RUT sin puntos ni guion, con dígito verificador válido (§11 del Documento 0). */
export const rutSchema = z
  .string()
  .min(1, 'RUT es requerido')
  .refine((val) => /^\d{1,8}[\dkK]$/.test(val), {
    message: 'Formato inválido. Ej: 123456785',
  })
  .refine((val) => validateRut(val), {
    message: 'RUT inválido — dígito verificador incorrecto',
  });

/**
 * CU-11 / RF-09: 8 caracteres como mínimo, una mayúscula y un número. El tope
 * de 72 es el de bcrypt: lo que pase de ahí no cuenta en el hash.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Contraseña debe tener al menos 8 caracteres')
  .max(72)
  .refine((val) => /[A-Z]/.test(val), {
    message: 'Contraseña debe contener al menos una mayúscula',
  })
  .refine((val) => /[0-9]/.test(val), {
    message: 'Contraseña debe contener al menos un número',
  });

/**
 * La empresa de la base (1 Finet, 2 Cable Mágico) desde cuyo sitio se escribe.
 * Elige marca, contenido y entre qué clientes se busca un RUT; nunca da
 * acceso a datos de otra empresa.
 */
export const empresaSchema = z
  .number()
  .int()
  .refine(esEmpresaConocida, { message: 'Empresa desconocida' });
