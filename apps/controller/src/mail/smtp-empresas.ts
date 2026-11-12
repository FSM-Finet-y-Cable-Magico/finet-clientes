import { z } from 'zod';

/** La cuenta con la que salen los correos de los clientes de una empresa. */
export type SmtpEmpresa = {
  idEmpresa: number;
  alias: string;
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  /** TLS desde el primer byte (465). Si no se dice, según el puerto. */
  secure: boolean;
  /** Exige STARTTLS antes de autenticar (587), como G8. */
  requireTLS: boolean;
  /** Rechaza un certificado inválido. Solo se apaga diciéndolo. */
  rejectUnauthorized: boolean;
  /** Tope de la conexión y de cada espera, en ms; `null` usa el de nodemailer. */
  timeoutMs: number | null;
};

const EmpresasSmtp = z.array(
  z.object({
    idEmpresa: z.number().int().positive(),
    alias: z.string().regex(/^[A-Z0-9_]+$/),
  }),
);

/**
 * Cada empresa manda sus correos desde su propia cuenta. Se configura igual que
 * en el CRM (G8): `SMTP_COMPANIES` dice qué empresas hay, y cada una trae sus
 * `SMTP_<ALIAS>_*`, con los mismos nombres (`_SECURE`, `_STARTTLS`,
 * `_REJECT_UNAUTHORIZED` y `_TIMEOUT_MS` incluidos).
 *
 * Una empresa mal configurada no se carga y avisa: sus clientes salen por la
 * cuenta general. Un correo que sale por otra cuenta llega igual; uno sin
 * configuración, no. El aviso nunca incluye valores, solo nombres de variable.
 */
export function leerSmtpEmpresas(
  leer: (clave: string) => string | undefined,
  avisar: (mensaje: string) => void,
): SmtpEmpresa[] {
  const crudo = leer('SMTP_COMPANIES')?.trim();
  if (!crudo) return [];

  let empresas: z.infer<typeof EmpresasSmtp>;
  try {
    empresas = EmpresasSmtp.parse(JSON.parse(crudo));
  } catch {
    avisar('SMTP_COMPANIES no es válido: se usa solo la cuenta general');
    return [];
  }

  const cuentas: SmtpEmpresa[] = [];
  for (const { idEmpresa, alias } of empresas) {
    const dato = (nombre: string) =>
      leer(`SMTP_${alias}_${nombre}`)?.trim() ?? '';
    const faltan = ['HOST', 'PORT', 'USER', 'PASSWORD', 'FROM'].filter(
      (nombre) => !dato(nombre),
    );
    const port = Number(dato('PORT'));
    if (faltan.length > 0 || !Number.isInteger(port)) {
      avisar(
        `SMTP de la empresa ${alias} incompleto (${faltan.join(', ') || 'PORT'}): sale por la cuenta general`,
      );
      continue;
    }
    const nombre = dato('FROM_NAME').replace(/["<>\r\n]/g, '');
    const timeout = Number(dato('TIMEOUT_MS'));
    cuentas.push({
      idEmpresa,
      alias,
      host: dato('HOST'),
      port,
      user: dato('USER'),
      pass: dato('PASSWORD'),
      from: nombre ? `"${nombre}" <${dato('FROM')}>` : dato('FROM'),
      secure: dato('SECURE') ? dato('SECURE') === 'true' : port === 465,
      requireTLS: dato('STARTTLS') === 'true',
      rejectUnauthorized: dato('REJECT_UNAUTHORIZED') !== 'false',
      timeoutMs: Number.isInteger(timeout) && timeout > 0 ? timeout : null,
    });
  }
  return cuentas;
}
