import { z } from 'zod';
import { passwordSchema } from '../../common/utils/validaciones.js';

// ─── CU-08: Actualizar número de teléfono ─────────────────────────────────────
export const ActualizarTelefonoDto = z.object({
  password_actual: z.string().min(1, 'La contraseña actual es requerida'),
  telefono: z
    .string()
    .min(8, 'El teléfono debe tener al menos 8 caracteres')
    .max(20)
    .regex(/^\+?[\d\s\-()]+$/, 'Formato de teléfono inválido'),
});
export type ActualizarTelefonoDto = z.infer<typeof ActualizarTelefonoDto>;

// ─── CU-09: Actualizar correo electrónico ─────────────────────────────────────
export const ActualizarEmailDto = z.object({
  password_actual: z.string().min(1, 'La contraseña actual es requerida'),
  email: z
    .string()
    .email('El correo electrónico no tiene un formato válido')
    .max(120),
});
export type ActualizarEmailDto = z.infer<typeof ActualizarEmailDto>;

// ─── CU-10 / CU-11: Cambiar contraseña con validación de complejidad ──────────
export const CambiarPasswordDto = z
  .object({
    password_actual: z.string().min(1, 'La contraseña actual es requerida'),
    // RF-09 / CU-11: misma regla que registro y recuperación
    password_nuevo: passwordSchema,
    password_confirmacion: z
      .string()
      .min(1, 'Debe confirmar la nueva contraseña'),
  })
  .refine((data) => data.password_nuevo === data.password_confirmacion, {
    message: 'Las contraseñas no coinciden',
    path: ['password_confirmacion'],
  });
export type CambiarPasswordDto = z.infer<typeof CambiarPasswordDto>;

// ─── CU-07: Respuesta del perfil ──────────────────────────────────────────────
export interface PerfilResponseDto {
  id_cliente: number;
  nombre_completo: string;
  rut: string | null;
  email: string | null;
  telefono: string | null;
  fecha_creacion: string | null;
}
