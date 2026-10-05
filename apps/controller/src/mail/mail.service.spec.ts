import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service.js';

/**
 * Lo que lee el cliente en los correos del CU-68 y el CU-69, con los formatos
 * del §11 del Documento 0.
 */
describe('MailService — correos del Incremento 3', () => {
  let mail: MailService;
  let sendMail: jest.Mock;

  function html(): string {
    return (sendMail.mock.calls[0]![0] as { html: string }).html;
  }

  beforeEach(() => {
    mail = new MailService({
      get: (_k: string, porDefecto?: unknown) => porDefecto,
    } as unknown as ConfigService);
    sendMail = jest.fn().mockResolvedValue({});
    (mail as unknown as { transporter: unknown }).transporter = { sendMail };
  });

  describe('CU-68: aviso de corte', () => {
    beforeEach(async () => {
      await mail.sendAvisoCorte(
        'ana@b.cl',
        'Ana <b>',
        144940,
        new Date('2026-10-03T00:00:00.000Z'),
        'https://portal.finet.cl/pagar?t=p.1.x.y.z',
      );
    });

    it('va al cliente con el asunto del aviso', () => {
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'ana@b.cl',
          subject: 'Aviso de corte de servicio - Portal Clientes',
        }),
      );
    });

    it('avisa el corte inminente por deuda vencida', () => {
      expect(html()).toContain('próximo a ser cortado por una deuda vencida');
    });

    it('dice cuánto debe y cuándo venció, en DD/MM/AAAA', () => {
      expect(html()).toContain('$144.940');
      expect(html()).toContain('Venció el');
      expect(html()).toContain('03/10/2026');
    });

    it('no promete una fecha de corte: los días de gracia los maneja G8', () => {
      expect(html()).not.toContain('Fecha de corte');
      expect(html()).not.toMatch(/se cortar[aá] el/i);
    });

    it('no muestra los días de gracia: son un cálculo interno', () => {
      expect(html()).not.toMatch(/d[ií]as de gracia/i);
    });

    it('RF-50: lleva el enlace directo para pagar', () => {
      expect(html()).toContain(
        'href="https://portal.finet.cl/pagar?t=p.1.x.y.z"',
      );
    });

    it('sin la URL del sitio, el logo va en texto: no queda una imagen rota', () => {
      expect(html()).not.toContain('<img');
      expect(html()).toContain('>FI<');
    });

    it('no interpreta como HTML lo que escribió el cliente', () => {
      expect(html()).toContain('Ana &lt;b&gt;');
      expect(html()).not.toContain('Ana <b>');
    });
  });

  describe('CU-67: recordatorio de pago', () => {
    beforeEach(async () => {
      await mail.sendRecordatorioPago(
        'ana@b.cl',
        'Ana <b>',
        24990,
        new Date('2026-10-04T00:00:00.000Z'),
      );
    });

    it('va al cliente con el asunto del recordatorio', () => {
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'ana@b.cl',
          subject: 'Tu factura vence en 3 días - Portal Clientes',
        }),
      );
    });

    it('usa el mismo molde que el aviso de corte y la confirmación de pago', () => {
      expect(html()).toContain('Recordatorio de pago');
      expect(html()).toContain('Tu factura vence en 3 días');
      expect(html()).toContain('>FI<');
    });

    it('dice el monto y el vencimiento en DD/MM/AAAA (§11.4)', () => {
      expect(html()).toContain('04/10/2026');
      expect(html()).not.toContain('2026-10-04');
      expect(html()).toContain('$24.990');
    });

    it('no lleva botón para pagar: el CU-67 y el RF-49 no lo piden', () => {
      expect(html()).not.toContain('<a href=');
    });

    it('no interpreta como HTML lo que escribió el cliente', () => {
      expect(html()).toContain('Ana &lt;b&gt;');
      expect(html()).not.toContain('Ana <b>');
    });
  });

  describe('CU-69: confirmación de pago', () => {
    beforeEach(async () => {
      await mail.sendConfirmacionPago(
        'ana@b.cl',
        'Ana',
        57980,
        new Date('2026-10-01T01:30:00.000Z'),
        'AUT-<123>',
      );
    });

    it('va al cliente con el asunto de la confirmación', () => {
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'ana@b.cl',
          subject: 'Confirmación de pago - Portal Clientes',
        }),
      );
    });

    it('RF-32: informa monto, fecha y código de autorización', () => {
      expect(html()).toContain('$57.980');
      expect(html()).toContain('AUT-&lt;123&gt;');
    });

    it('la fecha del pago va en hora de Chile, DD/MM/AAAA HH:MM', () => {
      // 01:30 UTC del 1 de octubre son las 22:30 del 30 de septiembre en Chile.
      expect(html()).toContain('30/09/2026 22:30');
    });
  });

  it('con la URL del sitio, el logo es el del portal', async () => {
    const conSitio = new MailService({
      get: (k: string, porDefecto?: unknown) =>
        k === 'FRONTEND_URL' ? 'https://portal.finet.cl' : porDefecto,
    } as unknown as ConfigService);
    (conSitio as unknown as { transporter: unknown }).transporter = {
      sendMail,
    };

    await conSitio.sendAvisoCorte(
      'a@b.cl',
      'Ana',
      1000,
      new Date('2026-10-03T00:00:00.000Z'),
      'https://x/pagar?t=1',
    );

    expect(html()).toContain(
      'src="https://portal.finet.cl/brand/FinetLogo.png"',
    );
  });
});
