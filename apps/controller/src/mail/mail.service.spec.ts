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
        new Date('2026-09-29T00:00:00.000Z'),
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

    it('dice la deuda, el vencimiento y la fecha de corte en DD/MM/AAAA', () => {
      expect(html()).toContain('$144.940');
      expect(html()).toContain('29/09/2026');
      expect(html()).toContain('03/10/2026');
    });

    it('RF-50: lleva el enlace directo para pagar', () => {
      expect(html()).toContain(
        'href="https://portal.finet.cl/pagar?t=p.1.x.y.z"',
      );
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
});
