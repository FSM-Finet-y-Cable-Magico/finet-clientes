import { z } from "zod";
import { MENSAJE_POLITICA_REQUERIDA } from "../_lib/legal";

export function cleanRut(rut: string) {
  return rut.replace(/[^0-9kK]/g, "").toUpperCase();
}

export function cleanTelefono(telefono: string) {
  return telefono.replace(/\s/g, "");
}

function validateRut(rut: string) {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 3) return false;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  const expectedDv =
    remainder === 11 ? "0" : remainder === 10 ? "K" : String(remainder);

  return expectedDv === dv;
}

function validateTelefonoChileno(telefono: string) {
  const cleaned = telefono.replace(/\s/g, "");
  if (!/^\+56\d{9}$/.test(cleaned)) return false;
  const digits = cleaned.slice(3);
  const first = digits[0];
  if (first === "9") return /^9\d{8}$/.test(digits);
  if (["2", "3", "4", "5", "6", "7", "8"].includes(first)) return true;
  return false;
}

export const loginSchema = z.object({
  rut: z
    .string({ message: "El RUT es obligatorio" })
    .min(1, "El RUT es obligatorio")
    .refine((val) => validateRut(val), "RUT inválido"),
  password: z
    .string({ message: "La contraseña es obligatoria" })
    .min(8, "Mínimo 8 caracteres")
    .regex(/^(?=.*[A-Z])(?=.*\d).+$/, "Al menos 1 mayúscula y 1 número"),
});

export const registerSchema = z
  .object({
    nombreCompleto: z
      .string({ message: "El nombre es obligatorio" })
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(100, "El nombre es demasiado largo")
      .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, "Solo letras y espacios"),
    email: z
      .string({ message: "El email es obligatorio" })
      .min(1, "El email es obligatorio")
      .email("Email inválido")
      .max(254, "El email es demasiado largo"),
    telefono: z
      .string()
      .optional()
      .refine(
        (val) => !val || val === "" || validateTelefonoChileno(val),
        "Teléfono chileno inválido",
      ),
    rut: z
      .string({ message: "El RUT es obligatorio" })
      .min(1, "El RUT es obligatorio")
      .refine((val) => validateRut(val), "RUT inválido"),
    password: z
      .string({ message: "La contraseña es obligatoria" })
      .min(8, "Mínimo 8 caracteres")
      .max(128, "La contraseña es demasiado larga")
      .regex(/^(?=.*[A-Z])(?=.*\d).+$/, "Al menos 1 mayúscula y 1 número"),
    confirmPassword: z
      .string({ message: "Debes confirmar la contraseña" })
      .min(1, "Debes confirmar la contraseña"),
    // CU-75: casilla obligatoria de la Política de Privacidad.
    aceptaPolitica: z.literal(true, { error: MENSAJE_POLITICA_REQUERIDA }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export const recoverySchema = z.object({
  rut: z
    .string({ message: "El RUT es obligatorio" })
    .min(1, "El RUT es obligatorio")
    .refine((val) => validateRut(val), "RUT inválido"),
});

const passwordField = z
  .string({ message: "La contraseña es obligatoria" })
  .min(8, "Mínimo 8 caracteres")
  .max(128, "La contraseña es demasiado larga")
  .regex(/^(?=.*[A-Z])(?=.*\d).+$/, "Al menos 1 mayúscula y 1 número");

export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z
      .string({ message: "Debes confirmar la contraseña" })
      .min(1, "Debes confirmar la contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    passwordActual: z
      .string({ message: "La contraseña actual es requerida" })
      .min(1, "La contraseña actual es requerida"),
    // RF-09 / CU-11: misma regla que registro y recuperación (8 + mayúscula + número)
    passwordNuevo: z
      .string({ message: "La nueva contraseña es obligatoria" })
      .min(8, "Mínimo 8 caracteres")
      .max(128, "La contraseña es demasiado larga")
      .regex(/[A-Z]/, "Al menos 1 letra mayúscula")
      .regex(/[0-9]/, "Al menos 1 número"),
    passwordConfirmacion: z
      .string({ message: "Debes confirmar la nueva contraseña" })
      .min(1, "Debes confirmar la nueva contraseña"),
  })
  .refine((data) => data.passwordNuevo === data.passwordConfirmacion, {
    message: "Las contraseñas no coinciden",
    path: ["passwordConfirmacion"],
  });

export type LoginInput = z.infer<typeof loginSchema>;

export type RegisterInput = z.infer<typeof registerSchema>;

export type RecoveryInput = z.infer<typeof recoverySchema>;

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
