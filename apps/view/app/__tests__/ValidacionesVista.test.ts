import {
  changePasswordSchema,
  formatRut,
  formatTelefono,
  loginSchema,
  recoverySchema,
  resetPasswordSchema,
} from "@/app/utils/login-schema";
import { changeWifiPassword } from "@/app/portal/_lib/portal-actions";

// Fija las reglas de RUT, contraseña y clave WiFi de la vista para que
// juntarlas en una sola constante no cambie qué se acepta ni qué se muestra.

jest.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

type Esquema = {
  safeParse: (v: unknown) => {
    success: boolean;
    error?: { issues: { path: PropertyKey[]; message: string }[] };
  };
};

function mensajes(esquema: Esquema, valor: unknown, campo: string): string[] {
  const r = esquema.safeParse(valor);
  if (r.success) return [];
  return r.error!.issues
    .filter((i) => i.path.join(".") === campo)
    .map((i) => i.message);
}

describe("RUT", () => {
  const conRut: [string, Esquema, Record<string, unknown>][] = [
    ["login", loginSchema, { password: "Clave2026" }],
    ["recuperar", recoverySchema, {}],
  ];

  it.each(conRut)("%s: acepta con o sin puntos y guion", (_n, esquema, resto) => {
    expect(mensajes(esquema, { ...resto, rut: "12.345.678-5" }, "rut")).toEqual([]);
    expect(mensajes(esquema, { ...resto, rut: "123456785" }, "rut")).toEqual([]);
  });

  it.each(conRut)("%s: vacío y dígito verificador", (_n, esquema, resto) => {
    expect(mensajes(esquema, { ...resto, rut: "" }, "rut")[0]).toBe(
      "El RUT es obligatorio",
    );
    expect(mensajes(esquema, { ...resto, rut: "12.345.678-9" }, "rut")).toEqual([
      "RUT inválido",
    ]);
  });
});

describe("contraseña (CU-11 / RF-09)", () => {
  const conPassword: [string, Esquema, (p: string) => unknown, string][] = [
    ["login", loginSchema, (p) => ({ rut: "123456785", password: p }), "password"],
    [
      "restablecer",
      resetPasswordSchema,
      (p) => ({ password: p, confirmPassword: p }),
      "password",
    ],
    [
      "cambiar",
      changePasswordSchema,
      (p) => ({
        passwordActual: "Actual2026",
        passwordNuevo: p,
        passwordConfirmacion: p,
      }),
      "passwordNuevo",
    ],
  ];

  it.each(conPassword)("%s: acepta 8 con mayúscula y número", (_n, esquema, datos, campo) => {
    expect(mensajes(esquema, datos("Clave2026"), campo)).toEqual([]);
  });

  it.each(conPassword)("%s: corta", (_n, esquema, datos, campo) => {
    expect(mensajes(esquema, datos("Cl4ve"), campo)).toEqual(["Mínimo 8 caracteres"]);
  });

  it.each(conPassword)("%s: sin mayúscula o sin número", (_n, esquema, datos, campo) => {
    expect(mensajes(esquema, datos("clave2026"), campo)).toEqual([
      "Al menos 1 mayúscula y 1 número",
    ]);
    expect(mensajes(esquema, datos("ClaveClave"), campo)).toEqual([
      "Al menos 1 mayúscula y 1 número",
    ]);
  });

  it.each(conPassword)("%s: acepta justo 72", (_n, esquema, datos, campo) => {
    expect(mensajes(esquema, datos("A1" + "a".repeat(70)), campo)).toEqual([]);
  });

  it.each(conPassword)("%s: más de 72, el tope del backend", (_n, esquema, datos, campo) => {
    expect(mensajes(esquema, datos("A1" + "a".repeat(71)), campo)).toEqual([
      "La contraseña es demasiado larga",
    ]);
  });
});

describe("clave WiFi (CU-31): de 8 a 63 caracteres, sin espacios", () => {
  it.each([
    ["7 caracteres", "a".repeat(7)],
    ["64 caracteres", "a".repeat(64)],
  ])("la acción del servidor rechaza %s", async (_n, clave) => {
    global.fetch = jest.fn();
    await expect(changeWifiPassword(1, clave)).resolves.toEqual({
      success: false,
      error: "La contraseña debe tener entre 8 y 63 caracteres",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("la acción del servidor rechaza espacios", async () => {
    global.fetch = jest.fn();
    await expect(changeWifiPassword(1, "mi clave wifi")).resolves.toEqual({
      success: false,
      error: "No se permiten espacios en blanco",
    });
  });
});

describe("formato mientras se escribe", () => {
  it.each([
    ["1", "1"],
    ["123456785", "12.345.678-5"],
    ["12.345.678-5", "12.345.678-5"],
    ["1234567k", "1.234.567-K"],
    ["12345678-k", "12.345.678-K"],
  ])("RUT %s queda %s", (escrito, esperado) => {
    expect(formatRut(escrito)).toBe(esperado);
  });

  it.each([
    ["", ""],
    ["9", "9"],
    ["91234", "9 1234"],
    ["912345678", "9 1234 5678"],
    ["9123456789", "9 1234 5678"],
    ["+56 9 1234 5678", "9 1234 5678"],
    ["+56912345678", "9 1234 5678"],
    ["56912345678", "9 1234 5678"],
    ["9-1234-5678", "9 1234 5678"],
  ])("teléfono %s queda %s", (escrito, esperado) => {
    expect(formatTelefono(escrito)).toBe(esperado);
  });

  it("teléfono: escribir 569... de corrido termina en el mismo número", () => {
    let valor = "";
    for (const tecla of "56912345678") valor = formatTelefono(valor + tecla);
    expect(valor).toBe("9 1234 5678");
  });

  it("teléfono: borrar el último dígito no deja un espacio colgando", () => {
    expect(formatTelefono("9 1234 ")).toBe("9 1234");
  });
});
