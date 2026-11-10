import { z } from "zod";

export function cleanRut(rut: string) {
  return rut.replace(/[^0-9kK]/g, "").toUpperCase();
}

export function cleanTelefono(telefono: string) {
  return telefono.replace(/\s/g, "");
}

/** 12.345.678-9 mientras se escribe; la k del dígito verificador sale en mayúscula. */
export function formatRut(value: string) {
  const digits = cleanRut(value).slice(0, 10);
  if (digits.length <= 1) return digits;
  const body = digits.slice(0, -1);
  const dv = digits.slice(-1);
  const dotted = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${dotted}-${dv}`;
}

/**
 * Los 9 dígitos de un celular sin el +56, como "9 1234 5678". El +56 va fuera
 * del campo: si estuviera adentro, al seguir escribiendo no se sabría si un 56
 * es el código del país o parte del número.
 */
export function formatTelefono(value: string) {
  let digits = value.replace(/\D/g, "");
  // Si lo pegan con el código del país (+56 9 1234 5678 o 56912345678).
  if (digits.length > 9 && digits.startsWith("56")) digits = digits.slice(2);
  digits = digits.slice(0, 9);
  return [digits.slice(0, 1), digits.slice(1, 5), digits.slice(5)]
    .filter(Boolean)
    .join(" ");
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

const rutField = z
  .string({ message: "El RUT es obligatorio" })
  .min(1, "El RUT es obligatorio")
  .refine((val) => validateRut(val), "RUT inválido");

// RF-09 / CU-11: 8 caracteres como mínimo, una mayúscula y un número. El tope
// de 72 es el del backend: bcrypt no usa lo que pasa de ahí.
const passwordField = z
  .string({ message: "La contraseña es obligatoria" })
  .min(8, "Mínimo 8 caracteres")
  .max(72, "La contraseña es demasiado larga")
  .regex(/^(?=.*[A-Z])(?=.*\d).+$/, "Al menos 1 mayúscula y 1 número");

export const loginSchema = z.object({
  rut: rutField,
  password: passwordField,
});

export const recoverySchema = z.object({
  rut: rutField,
});

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
    // RF-09 / CU-11: misma regla que registro y recuperación
    passwordNuevo: passwordField,
    passwordConfirmacion: z
      .string({ message: "Debes confirmar la nueva contraseña" })
      .min(1, "Debes confirmar la nueva contraseña"),
  })
  .refine((data) => data.passwordNuevo === data.passwordConfirmacion, {
    message: "Las contraseñas no coinciden",
    path: ["passwordConfirmacion"],
  });
