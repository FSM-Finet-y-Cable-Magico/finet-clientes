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

    it('el logo va adjunto al correo y la plantilla lo muestra por su Content-ID', () => {
      expect(html()).toContain('src="cid:logo@finet"');
      const { attachments } = sendMail.mock.calls[0]![0] as {
        attachments: { cid: string; contentType: string; content: Buffer }[];
      };
      expect(attachments).toEqual([
        expect.objectContaining({
          cid: 'logo@finet',
          contentType: 'image/png',
        }),
      ]);
      // La firma de un PNG: el adjunto es la imagen y no un texto cualquiera.
      expect(attachments[0]!.content.subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
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
      expect(html()).toContain('src="cid:logo@finet"');
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

  it('el logo no se descarga del portal: Gmail no llega a una URL privada', async () => {
    const conSitio = new MailService({
      get: (k: string, porDefecto?: unknown) =>
        k === 'FRONTEND_URL' ? 'http://localhost:18200' : porDefecto,
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

    expect(html()).not.toContain('FinetLogo.png');
    expect(html()).toContain('src="cid:logo@finet"');
  });

  it('el correo que sale por la cuenta de Cable Mágico lleva el logo de Cable Mágico', async () => {
    const sendMailEmpresa = jest.fn().mockResolvedValue({});
    (mail as unknown as { porEmpresa: Map<number, unknown> }).porEmpresa.set(
      2,
      {
        transporter: { sendMail: sendMailEmpresa },
        from: '"Cable Mágico" <no-reply@cable.invalid>',
      },
    );

    await mail.sendTicketCreated('a@b.cl', 'Ana', 'FIN-1', 'Sin internet', 2);

    expect(sendMail).not.toHaveBeenCalled();
    expect(sendMailEmpresa).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            cid: 'logo@cable-magico',
            contentType: 'image/jpeg',
          }),
        ],
      }),
    );
  });
});

/**
 * Lo que le llega a Cable Mágico tiene que ser de Cable Mágico (Emilio, 11-11):
 * mismo molde que Finet, con su logo, su rojo y su nombre.
 */
describe('MailService — marca de cada empresa', () => {
  let mail: MailService;
  let sendMail: jest.Mock;

  function enviado(): { html: string; attachments: { cid: string }[] } {
    return sendMail.mock.calls[0]![0] as {
      html: string;
      attachments: { cid: string }[];
    };
  }

  beforeEach(() => {
    mail = new MailService({
      get: (_k: string, porDefecto?: unknown) => porDefecto,
    } as unknown as ConfigService);
    sendMail = jest.fn().mockResolvedValue({});
    (mail as unknown as { transporter: unknown }).transporter = { sendMail };
  });

  it('Cable Mágico: su logo, su rojo en el botón y su nombre en el pie', async () => {
    await mail.sendPasswordReset('a@b.cl', 'Ana', 'https://x/r#t', 2);

    const { html, attachments } = enviado();
    expect(html).toContain('src="cid:logo@cable-magico"');
    expect(html).toContain('background:#D7141A');
    expect(html).toContain('Este es un aviso automático de Cable Mágico.');
    expect(attachments.map((a) => a.cid)).toEqual(['logo@cable-magico']);
  });

  it('Cable Mágico: nada de Finet en el correo', async () => {
    await mail.sendConfirmacionPago('a@b.cl', 'Ana', 1000, new Date(), '1', 2);

    expect(enviado().html).not.toMatch(/finet/i);
  });

  it('Finet sigue igual: su logo, su botón lima y su nombre en el pie', async () => {
    await mail.sendPasswordReset('a@b.cl', 'Ana', 'https://x/r#t', 1);

    const { html, attachments } = enviado();
    expect(html).toContain('src="cid:logo@finet"');
    expect(html).toContain('background:#E3E446');
    expect(html).toContain('Este es un aviso automático de Finet.');
    expect(attachments.map((a) => a.cid)).toEqual(['logo@finet']);
  });

  it('una empresa desconocida o ninguna sale con la marca de Finet', async () => {
    await mail.sendTicketCreated('a@b.cl', 'Ana', 'FIN-1', 'Sin internet', 9);
    await mail.sendTicketCreated('a@b.cl', 'Ana', 'FIN-1', 'Sin internet');

    for (const [correo] of sendMail.mock.calls) {
      expect((correo as { html: string }).html).toContain('cid:logo@finet');
    }
  });
});

/**
 * Los correos del CU-03 (recuperar contraseña) y del CU-71 (ticket creado).
 * "Lo que se mantiene" pasa con las plantillas anteriores; "lo que cambia" es
 * el paso al molde de los demás correos del portal.
 */
describe('MailService — correos del CU-03 y del CU-71', () => {
  let mail: MailService;
  let sendMail: jest.Mock;

  function enviado(): {
    to: string;
    subject: string;
    html?: string;
    text?: string;
  } {
    return sendMail.mock.calls[0]![0] as {
      to: string;
      subject: string;
      html?: string;
      text?: string;
    };
  }

  function contenido(): string {
    const c = enviado();
    return `${c.html ?? ''}${c.text ?? ''}`;
  }

  beforeEach(() => {
    mail = new MailService({
      get: (_k: string, porDefecto?: unknown) => porDefecto,
    } as unknown as ConfigService);
    sendMail = jest.fn().mockResolvedValue({});
    (mail as unknown as { transporter: unknown }).transporter = { sendMail };
  });

  describe('CU-03: enlace para restablecer la contraseña', () => {
    const enlace =
      'https://portal.finet.cl/restablecer-password#token=abc.def.ghi';

    beforeEach(async () => {
      await mail.sendPasswordReset('ana@b.cl', 'Ana <b>', enlace);
    });

    describe('lo que se mantiene', () => {
      it('va al cliente con el asunto de la recuperación', () => {
        expect(enviado()).toMatchObject({
          to: 'ana@b.cl',
          subject: 'Recuperación de contraseña - Portal Clientes',
        });
      });

      it('lleva el enlace en un botón para restablecer la contraseña', () => {
        expect(contenido()).toContain(`href="${enlace}"`);
        expect(contenido()).toContain('Restablecer contraseña');
      });

      it('RNF-04.1: dice que el enlace expira en 30 minutos', () => {
        expect(contenido()).toContain('30 minutos');
      });

      it('dice qué hacer si no lo pidió', () => {
        expect(contenido()).toContain('Si no solicitaste este cambio');
      });
    });

    describe('lo que cambia', () => {
      it('usa el molde de los correos del portal', () => {
        expect(contenido()).toContain('src="cid:logo@finet"');
        expect(contenido()).toContain('Recuperar contraseña');
      });

      it('no interpreta como HTML lo que escribió el cliente', () => {
        expect(contenido()).toContain('Ana &lt;b&gt;');
        expect(contenido()).not.toContain('Ana <b>');
      });
    });
  });

  describe('CU-03: aviso de contraseña cambiada', () => {
    beforeEach(async () => {
      await mail.sendPasswordChanged('ana@b.cl', 'Ana <b>');
    });

    describe('lo que se mantiene', () => {
      it('va al cliente con el asunto del cambio', () => {
        expect(enviado()).toMatchObject({
          to: 'ana@b.cl',
          subject: 'Contraseña actualizada - Portal Clientes',
        });
      });

      it('avisa el cambio y qué hacer si no fue él', () => {
        expect(contenido()).toContain('actualizada exitosamente');
        expect(contenido()).toContain(
          'Si no realizaste este cambio, contacta a soporte de inmediato.',
        );
      });
    });

    describe('lo que cambia', () => {
      it('usa el molde de los correos del portal', () => {
        expect(contenido()).toContain('src="cid:logo@finet"');
        expect(contenido()).toContain('Contraseña actualizada');
      });

      it('no interpreta como HTML lo que escribió el cliente', () => {
        expect(contenido()).toContain('Ana &lt;b&gt;');
        expect(contenido()).not.toContain('Ana <b>');
      });
    });
  });

  describe('CU-71: ticket creado', () => {
    beforeEach(async () => {
      await mail.sendTicketCreated(
        'ana@b.cl',
        'Ana <b>',
        'FIN-2026-000042',
        'Falla de Internet',
      );
    });

    describe('lo que se mantiene', () => {
      it('va al cliente con el código en el asunto', () => {
        expect(enviado()).toMatchObject({
          to: 'ana@b.cl',
          subject: 'Solicitud de soporte FIN-2026-000042',
        });
      });

      it('dice el código de seguimiento y la categoría', () => {
        expect(contenido()).toContain('FIN-2026-000042');
        expect(contenido()).toContain('Falla de Internet');
      });
    });

    describe('lo que cambia', () => {
      it('usa el molde de los correos del portal', () => {
        expect(enviado().html).toContain('src="cid:logo@finet"');
        expect(enviado().html).toContain('Solicitud de soporte');
      });

      it('escribe "código" y "categoría" con tilde', () => {
        expect(contenido()).toContain('Código de seguimiento');
        expect(contenido()).toContain('Categoría');
        expect(contenido()).not.toMatch(/codigo|categoria/);
      });

      it('no interpreta como HTML lo que escribió el cliente', () => {
        expect(contenido()).toContain('Ana &lt;b&gt;');
        expect(contenido()).not.toContain('Ana <b>');
      });
    });
  });
});

describe('MailService — correo del CU-04 (crear la cuenta)', () => {
  let mail: MailService;
  let sendMail: jest.Mock;
  const enlace = 'https://portal.finet.cl/registro/confirmar#token=abc.def.ghi';

  function enviado(): { to: string; subject: string; html: string } {
    return sendMail.mock.calls[0]![0] as {
      to: string;
      subject: string;
      html: string;
    };
  }

  beforeEach(async () => {
    mail = new MailService({
      get: (_k: string, porDefecto?: unknown) => porDefecto,
    } as unknown as ConfigService);
    sendMail = jest.fn().mockResolvedValue({});
    (mail as unknown as { transporter: unknown }).transporter = { sendMail };
    await mail.sendRegistroCuenta('ana@b.cl', 'Ana <b>', enlace);
  });

  it('va al correo registrado del cliente, con su asunto', () => {
    expect(enviado()).toMatchObject({
      to: 'ana@b.cl',
      subject: 'Crea tu cuenta - Portal Clientes',
    });
  });

  it('lleva el enlace en el botón para crear la contraseña', () => {
    expect(enviado().html).toContain(`href="${enlace}"`);
    expect(enviado().html).toContain('Crear mi contraseña');
  });

  it('RNF-04.1: dice que expira en 30 minutos y sirve una sola vez', () => {
    expect(enviado().html).toContain('30 minutos y sirve una sola vez');
  });

  it('usa el molde del portal y no interpreta como HTML el nombre', () => {
    expect(enviado().html).toContain('src="cid:logo@finet"');
    expect(enviado().html).toContain('Ana &lt;b&gt;');
    expect(enviado().html).not.toContain('Ana <b>');
  });
});

describe('MailService — CU-77, excepcion 1: derivacion sin ticket', () => {
  let sendMail: jest.Mock;

  beforeEach(async () => {
    const mail = new MailService({
      get: (_k: string, porDefecto?: unknown) => porDefecto,
    } as unknown as ConfigService);
    sendMail = jest.fn().mockResolvedValue({});
    (mail as unknown as { transporter: unknown }).transporter = { sendMail };

    await mail.sendEscalamientoSinTicket(['ana@finet.cl', 'luis@finet.cl'], {
      rut: '123456785',
      plataforma: 'web',
      motivo: 'Quiere <b>dar de baja</b> su plan',
      historial: [
        { rol: 'user', contenido: 'mi rut es [RUT] <script>' },
        { rol: 'assistant', contenido: 'Puedo derivarte.' },
      ],
    });
  });

  const enviado = () =>
    sendMail.mock.calls[0]![0] as {
      to: string[];
      subject: string;
      html: string;
    };

  it('va a los operadores, con el RUT en el asunto', () => {
    expect(enviado().to).toEqual(['ana@finet.cl', 'luis@finet.cl']);
    expect(enviado().subject).toBe(
      'Asistente virtual: derivacion sin ticket (RUT 12345678-5)',
    );
  });

  it('lleva el canal, el motivo y el historial, escapados', () => {
    const { html } = enviado();
    expect(html).toContain('web');
    expect(html).toContain('Quiere &lt;b&gt;dar de baja&lt;/b&gt; su plan');
    expect(html).toContain(
      '<strong>Cliente:</strong> mi rut es [RUT] &lt;script&gt;',
    );
    expect(html).toContain('<strong>Asistente:</strong> Puedo derivarte.');
    expect(html).not.toContain('<script>');
  });
});
