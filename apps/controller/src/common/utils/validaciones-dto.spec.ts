import { loginSchema } from '../../auth/dto/login.dto.js';
import { recuperarPasswordSchema } from '../../auth/dto/recuperar-password.dto.js';
import { registerSchema } from '../../auth/dto/register.dto.js';
import { restablecerPasswordSchema } from '../../auth/dto/restablecer-password.dto.js';
import { CambiarPasswordDto } from '../../perfil/dto/perfil.dto.js';
import { ConsultaDeudaRutDto } from '../../deuda-publica/dto/deuda-publica.dto.js';

/**
 * Fija las reglas del RUT y de la contraseña en cada DTO que las usa, para que
 * juntarlas en un solo esquema no cambie qué se acepta ni qué mensaje se da.
 */

type Esquema = {
  safeParse: (v: unknown) => {
    success: boolean;
    error?: { issues: { path: PropertyKey[]; message: string }[] };
  };
};

function mensajes(esquema: Esquema, valor: unknown, campo: string): string[] {
  const r = esquema.safeParse(valor);
  if (r.success) return [];
  return r
    .error!.issues.filter((i) => i.path.join('.') === campo)
    .map((i) => i.message);
}

const RUT_VALIDO = '123456785';

describe('regla del RUT', () => {
  const conRut: [string, Esquema, Record<string, unknown>][] = [
    ['login', loginSchema, { password: 'x' }],
    ['recuperar contraseña', recuperarPasswordSchema, {}],
    [
      'registro',
      registerSchema,
      {
        nombre_completo: 'Ana Pérez',
        email: 'ana@example.com',
        password: 'Clave2026',
        password_confirmation: 'Clave2026',
        acepta_politica_privacidad: true,
        version_politica_privacidad: '1.0',
      },
    ],
    ['consulta pública de deuda', ConsultaDeudaRutDto, {}],
  ];

  it.each(conRut)('%s: acepta un RUT válido', (_n, esquema, resto) => {
    expect(mensajes(esquema, { ...resto, rut: RUT_VALIDO }, 'rut')).toEqual([]);
  });

  it.each(conRut)('%s: dígito verificador incorrecto', (_n, esquema, resto) => {
    expect(mensajes(esquema, { ...resto, rut: '123456789' }, 'rut')).toEqual([
      'RUT inválido — dígito verificador incorrecto',
    ]);
  });

  it.each(conRut)(
    '%s: con puntos y guion no es el formato',
    (_n, esquema, resto) => {
      expect(
        mensajes(esquema, { ...resto, rut: '12.345.678-5' }, 'rut'),
      ).toContain('Formato inválido. Ej: 123456785');
    },
  );

  it.each(conRut)('%s: vacío', (_n, esquema, resto) => {
    expect(mensajes(esquema, { ...resto, rut: '' }, 'rut')[0]).toBe(
      'RUT es requerido',
    );
  });

  it('consulta pública de deuda: más de 12 caracteres', () => {
    expect(
      mensajes(ConsultaDeudaRutDto, { rut: '1234567890123' }, 'rut'),
    ).toContain('Too big: expected string to have <=12 characters');
  });
});

describe('regla de la contraseña (CU-11 / RF-09)', () => {
  const MENSAJES = {
    corta: 'Contraseña debe tener al menos 8 caracteres',
    mayuscula: 'Contraseña debe contener al menos una mayúscula',
    numero: 'Contraseña debe contener al menos un número',
  };

  const conPassword: [string, Esquema, (p: string) => unknown, string][] = [
    [
      'registro',
      registerSchema,
      (p) => ({
        rut: RUT_VALIDO,
        nombre_completo: 'Ana Pérez',
        email: 'ana@example.com',
        password: p,
        password_confirmation: p,
        acepta_politica_privacidad: true,
        version_politica_privacidad: '1.0',
      }),
      'password',
    ],
    [
      'restablecer',
      restablecerPasswordSchema,
      (p) => ({ token: 't', password: p }),
      'password',
    ],
    [
      'cambiar desde el perfil',
      CambiarPasswordDto,
      (p) => ({
        password_actual: 'Actual2026',
        password_nuevo: p,
        password_confirmacion: p,
      }),
      'password_nuevo',
    ],
  ];

  it.each(conPassword)(
    '%s: acepta 8 caracteres con mayúscula y número',
    (_n, esquema, datos, campo) => {
      expect(mensajes(esquema, datos('Clave2026'), campo)).toEqual([]);
    },
  );

  it.each(conPassword)('%s: corta', (_n, esquema, datos, campo) => {
    expect(mensajes(esquema, datos('Cl4ve'), campo)).toEqual([MENSAJES.corta]);
  });

  it.each(conPassword)('%s: sin mayúscula', (_n, esquema, datos, campo) => {
    expect(mensajes(esquema, datos('clave2026'), campo)).toEqual([
      MENSAJES.mayuscula,
    ]);
  });

  it.each(conPassword)('%s: sin número', (_n, esquema, datos, campo) => {
    expect(mensajes(esquema, datos('ClaveClave'), campo)).toEqual([
      MENSAJES.numero,
    ]);
  });

  // bcrypt usa solo los primeros 72 bytes: lo que pase de ahí no cuenta.
  it.each(conPassword)(
    '%s: más de 72 caracteres',
    (_n, esquema, datos, campo) => {
      expect(
        mensajes(esquema, datos('A1' + 'a'.repeat(71)), campo),
      ).toHaveLength(1);
    },
  );
});
