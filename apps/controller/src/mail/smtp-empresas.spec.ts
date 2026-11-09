import { describe, it, expect, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service.js';
import { leerSmtpEmpresas } from './smtp-empresas.js';

const EMPRESAS = JSON.stringify([
  { idEmpresa: 1, alias: 'FINET' },
  { idEmpresa: 2, alias: 'CABLE_MAGICO' },
]);

function cuenta(alias: string, usuario: string): Record<string, string> {
  return {
    [`SMTP_${alias}_HOST`]: 'smtp.ejemplo.test',
    [`SMTP_${alias}_PORT`]: '587',
    [`SMTP_${alias}_USER`]: usuario,
    [`SMTP_${alias}_PASSWORD`]: 'clave-de-mentira',
    [`SMTP_${alias}_FROM`]: usuario,
    [`SMTP_${alias}_FROM_NAME`]: alias,
  };
}

const COMPLETA = {
  SMTP_COMPANIES: EMPRESAS,
  ...cuenta('FINET', 'finet@ejemplo.test'),
  ...cuenta('CABLE_MAGICO', 'cable@ejemplo.test'),
};

function leerDe(env: Record<string, string>) {
  return (clave: string): string | undefined => env[clave];
}

describe('leerSmtpEmpresas', () => {
  it('sin SMTP_COMPANIES no hay cuentas por empresa ni avisos', () => {
    const avisar = jest.fn();
    expect(leerSmtpEmpresas(leerDe({}), avisar)).toEqual([]);
    expect(avisar).not.toHaveBeenCalled();
  });

  it('arma una cuenta por empresa, con su remitente', () => {
    expect(leerSmtpEmpresas(leerDe(COMPLETA), jest.fn())).toEqual([
      expect.objectContaining({
        idEmpresa: 1,
        user: 'finet@ejemplo.test',
        port: 587,
        from: '"FINET" <finet@ejemplo.test>',
      }),
      expect.objectContaining({
        idEmpresa: 2,
        user: 'cable@ejemplo.test',
        from: '"CABLE_MAGICO" <cable@ejemplo.test>',
      }),
    ]);
  });

  it('un JSON inválido avisa y deja solo la cuenta general', () => {
    const avisar = jest.fn();
    expect(leerSmtpEmpresas(leerDe({ SMTP_COMPANIES: '{no' }), avisar)).toEqual(
      [],
    );
    expect(avisar).toHaveBeenCalledTimes(1);
  });

  it('una empresa incompleta se omite y el aviso no trae la clave', () => {
    const avisar = jest.fn<(m: string) => void>();
    const sinUsuario: Record<string, string> = { ...COMPLETA };
    delete sinUsuario.SMTP_CABLE_MAGICO_USER;

    const cuentas = leerSmtpEmpresas(leerDe(sinUsuario), avisar);

    expect(cuentas.map((c) => c.idEmpresa)).toEqual([1]);
    expect(avisar.mock.calls[0]![0]).toContain('USER');
    expect(avisar.mock.calls[0]![0]).not.toContain('clave-de-mentira');
  });
});

describe('MailService — una cuenta por empresa', () => {
  function servicio() {
    const env: Record<string, string> = {
      ...COMPLETA,
      MAIL_FROM: 'general@ejemplo.test',
    };
    const mail = new MailService({
      get: (clave: string, porDefecto?: unknown) => env[clave] ?? porDefecto,
    } as unknown as ConfigService);
    const interno = mail as unknown as {
      transporter: unknown;
      porEmpresa: Map<number, { transporter: unknown; from: string }>;
    };
    const general = jest.fn<(a: unknown) => Promise<unknown>>();
    const finet = jest.fn<(a: unknown) => Promise<unknown>>();
    const cable = jest.fn<(a: unknown) => Promise<unknown>>();
    interno.transporter = { sendMail: general.mockResolvedValue({}) };
    interno.porEmpresa.get(1)!.transporter = {
      sendMail: finet.mockResolvedValue({}),
    };
    interno.porEmpresa.get(2)!.transporter = {
      sendMail: cable.mockResolvedValue({}),
    };
    return { mail, general, finet, cable };
  }

  it('el cliente de Cable Mágico recibe desde la cuenta de Cable Mágico', async () => {
    const { mail, general, finet, cable } = servicio();

    await mail.sendRegistroCuenta('a@b.cl', 'Ana', 'https://x/y', 2);

    expect(cable).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"CABLE_MAGICO" <cable@ejemplo.test>',
        to: 'a@b.cl',
      }),
    );
    expect(finet).not.toHaveBeenCalled();
    expect(general).not.toHaveBeenCalled();
  });

  it('el cliente de FiNet recibe desde la cuenta de FiNet', async () => {
    const { mail, finet, cable } = servicio();

    await mail.sendTicketCreated(
      'a@b.cl',
      'Ana',
      'FIN-2026-000001',
      'Mudanza',
      1,
    );

    expect(finet).toHaveBeenCalledTimes(1);
    expect(cable).not.toHaveBeenCalled();
  });

  it('sin empresa, o con una sin cuenta, sale por la cuenta general', async () => {
    const { mail, general, finet, cable } = servicio();

    await mail.sendPasswordChanged('a@b.cl', 'Ana', null);
    await mail.sendPasswordChanged('a@b.cl', 'Ana', 99);

    expect(general).toHaveBeenCalledTimes(2);
    expect(general).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'general@ejemplo.test' }),
    );
    expect(finet).not.toHaveBeenCalled();
    expect(cable).not.toHaveBeenCalled();
  });
});
