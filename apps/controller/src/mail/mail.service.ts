import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  escaparHtml,
  fechaCliente,
  fechaHoraCliente,
  pesos,
} from './formato.js';
import { comprobante, plantillaCorreo } from './plantilla-correo.js';

@Injectable()
export class MailService {
  private transporter: Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST', 'localhost');
    const port = this.configService.get<number>('SMTP_PORT', 1025);

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth:
        host !== 'localhost'
          ? {
              user: this.configService.get<string>('SMTP_USER', ''),
              pass: this.configService.get<string>('SMTP_PASS', ''),
            }
          : undefined,
    });

    this.logger.log(`Mail configured: ${host}:${port}`);
  }

  async sendPasswordReset(email: string, nombre: string, link: string) {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      '"Portal Clientes" <no-reply@finet.cl>';

    const html = this.resetTemplate(nombre, link);

    await this.transporter.sendMail({
      from,
      to: email,
      subject: 'Recuperación de contraseña - Portal Clientes',
      html,
    });

    this.logger.log('Password reset email sent');
  }

  /**
   * CU-04: el enlace de un solo uso para que un cliente que ya existe cree su
   * contraseña del portal (G8, 01-10, §6).
   */
  async sendRegistroCuenta(email: string, nombre: string, link: string) {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      '"Portal Clientes" <no-reply@finet.cl>';

    await this.transporter.sendMail({
      from,
      to: email,
      subject: 'Crea tu cuenta - Portal Clientes',
      html: this.registroCuentaTemplate(nombre, link),
    });

    this.logger.log('Account registration email sent');
  }

  async sendPasswordChanged(email: string, nombre: string) {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      '"Portal Clientes" <no-reply@finet.cl>';

    const html = this.changedTemplate(nombre);

    await this.transporter.sendMail({
      from,
      to: email,
      subject: 'Contraseña actualizada - Portal Clientes',
      html,
    });

    this.logger.log('Password changed email sent');
  }

  /**
   * CU-67 / RF-49: recordatorio de pago tres dias antes del vencimiento.
   * Lanza si el despacho falla — quien llama decide si reintenta y como lo
   * registra en el historial.
   */
  async sendRecordatorioPago(
    email: string,
    nombre: string,
    monto: number,
    fechaLimite: Date,
  ) {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      '"Portal Clientes" <no-reply@finet.cl>';

    await this.transporter.sendMail({
      from,
      to: email,
      subject: 'Tu factura vence en 3 días - Portal Clientes',
      html: this.recordatorioPagoTemplate(nombre, monto, fechaLimite),
    });

    this.logger.log('Payment reminder email sent');
  }

  /**
   * CU-68 / RF-50: aviso de corte inminente por morosidad: la deuda, cuándo
   * venció y el enlace directo para pagar. No promete una fecha de corte: los
   * días de gracia son de cada contrato y los maneja G8. Lanza si el despacho
   * falla: quien llama decide si reintenta.
   */
  async sendAvisoCorte(
    email: string,
    nombre: string,
    deuda: number,
    vencimiento: Date,
    enlacePago: string,
  ) {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      '"Portal Clientes" <no-reply@finet.cl>';

    await this.transporter.sendMail({
      from,
      to: email,
      subject: 'Aviso de corte de servicio - Portal Clientes',
      html: this.avisoCorteTemplate(nombre, deuda, vencimiento, enlacePago),
    });

    this.logger.log('Service cut notice email sent');
  }

  /**
   * CU-69 / RF-51: confirmación de un pago registrado, con los datos que el
   * RF-32 exige guardar de cada pago. Lanza si el despacho falla: quien llama
   * decide si reintenta.
   */
  async sendConfirmacionPago(
    email: string,
    nombre: string,
    monto: number,
    fecha: Date,
    codigoAutorizacion: string,
  ) {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      '"Portal Clientes" <no-reply@finet.cl>';

    await this.transporter.sendMail({
      from,
      to: email,
      subject: 'Confirmación de pago - Portal Clientes',
      html: this.confirmacionPagoTemplate(
        nombre,
        monto,
        fecha,
        codigoAutorizacion,
      ),
    });

    this.logger.log('Payment confirmation email sent');
  }

  async sendTicketCreated(
    email: string,
    nombre: string,
    codigoSeguimiento: string,
    categoria: string,
  ) {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      '"Portal Clientes" <no-reply@finet.cl>';

    await this.transporter.sendMail({
      from,
      to: email,
      subject: `Solicitud de soporte ${codigoSeguimiento}`,
      html: this.ticketCreadoTemplate(nombre, codigoSeguimiento, categoria),
    });

    this.logger.log('Ticket created email sent');
  }

  private recordatorioPagoTemplate(
    nombre: string,
    monto: number,
    fechaLimite: Date,
  ): string {
    return plantillaCorreo({
      resumen: `Tu factura de ${pesos(monto)} vence el ${fechaCliente(fechaLimite)}.`,
      etiqueta: { texto: 'Recordatorio de pago', tono: 'aviso' },
      titulo: 'Tu factura vence en 3 días',
      cuerpo:
        `Hola ${escaparHtml(nombre)}: te recordamos que tu factura está por vencer.` +
        comprobante([
          ['Monto a pagar', pesos(monto)],
          // §11.4 del Documento 0: DD/MM/AAAA.
          ['Vence el', fechaCliente(fechaLimite)],
        ]) +
        '<p style="margin:16px 0 0;font-size:14px;color:#6D797D;">Si ya pagaste, puedes ignorar este mensaje.</p>',
      sitio: this.sitio(),
    });
  }

  private avisoCorteTemplate(
    nombre: string,
    deuda: number,
    vencimiento: Date,
    enlacePago: string,
  ): string {
    return plantillaCorreo({
      resumen: `Tienes una deuda vencida de ${pesos(deuda)}. Tu servicio puede ser cortado.`,
      etiqueta: { texto: 'Aviso de corte', tono: 'alerta' },
      titulo: 'Tu servicio está por ser cortado',
      cuerpo:
        `Hola ${escaparHtml(nombre)}: tu servicio está próximo a ser cortado por una deuda vencida. ` +
        'Para evitarlo, paga lo antes posible.' +
        comprobante([
          ['Deuda pendiente', pesos(deuda)],
          ['Venció el', fechaCliente(vencimiento)],
        ]) +
        '<p style="margin:16px 0 0;font-size:14px;color:#6D797D;">Si ya pagaste, puedes ignorar este mensaje.</p>',
      boton: { texto: 'Pagar mi deuda', enlace: enlacePago },
      sitio: this.sitio(),
    });
  }

  private confirmacionPagoTemplate(
    nombre: string,
    monto: number,
    fecha: Date,
    codigoAutorizacion: string,
  ): string {
    return plantillaCorreo({
      resumen: `Registramos tu pago de ${pesos(monto)}.`,
      etiqueta: { texto: 'Pago confirmado', tono: 'exito' },
      titulo: 'Registramos tu pago',
      cuerpo:
        `Hola ${escaparHtml(nombre)}: tu pago quedó registrado. Guarda este correo como respaldo.` +
        comprobante([
          ['Monto pagado', pesos(monto)],
          ['Fecha', fechaHoraCliente(fecha)],
          ['Código de autorización', codigoAutorizacion],
        ]),
      sitio: this.sitio(),
    });
  }

  /** CU-71: el código de seguimiento y la categoría del ticket recién creado. */
  private ticketCreadoTemplate(
    nombre: string,
    codigoSeguimiento: string,
    categoria: string,
  ): string {
    return plantillaCorreo({
      resumen: `Registramos tu solicitud ${codigoSeguimiento}.`,
      etiqueta: { texto: 'Solicitud de soporte', tono: 'aviso' },
      titulo: 'Registramos tu solicitud',
      cuerpo:
        `Hola ${escaparHtml(nombre)}: registramos tu solicitud de soporte. Guarda el código para hacerle seguimiento.` +
        comprobante([
          ['Código de seguimiento', codigoSeguimiento],
          ['Categoría', categoria],
        ]),
      sitio: this.sitio(),
    });
  }

  /** Para el logo de los correos. Sin la URL del sitio va el nombre en texto. */
  private sitio(): string | undefined {
    return this.configService.get<string>('FRONTEND_URL') || undefined;
  }

  /** CU-03: el enlace de un solo uso para crear una contraseña nueva (RNF-04.1). */
  private resetTemplate(nombre: string, link: string): string {
    return plantillaCorreo({
      resumen:
        'Usa el enlace para crear una contraseña nueva. Expira en 30 minutos.',
      etiqueta: { texto: 'Recuperar contraseña', tono: 'aviso' },
      titulo: 'Restablece tu contraseña',
      cuerpo:
        `Hola ${escaparHtml(nombre)}: recibimos una solicitud para restablecer tu contraseña del Portal Clientes. Usa el botón para crear una nueva.` +
        '<p style="margin:16px 0 0;font-size:14px;color:#6D797D;">Este enlace expira en 30 minutos y sirve una sola vez. Si no solicitaste este cambio, ignora este mensaje.</p>',
      boton: { texto: 'Restablecer contraseña', enlace: link },
      sitio: this.sitio(),
    });
  }

  /** CU-04: el enlace para crear la contraseña de una cuenta nueva. */
  private registroCuentaTemplate(nombre: string, link: string): string {
    return plantillaCorreo({
      resumen:
        'Usa el enlace para crear la contraseña de tu cuenta. Expira en 30 minutos.',
      etiqueta: { texto: 'Crear cuenta', tono: 'aviso' },
      titulo: 'Crea tu contraseña',
      cuerpo:
        `Hola ${escaparHtml(nombre)}: recibimos una solicitud para crear tu cuenta del Portal Clientes. Usa el botón para crear tu contraseña.` +
        '<p style="margin:16px 0 0;font-size:14px;color:#6D797D;">Este enlace expira en 30 minutos y sirve una sola vez. Si no lo pediste, ignora este mensaje.</p>',
      boton: { texto: 'Crear mi contraseña', enlace: link },
      sitio: this.sitio(),
    });
  }

  /** CU-03: el aviso de que la contraseña cambió. */
  private changedTemplate(nombre: string): string {
    return plantillaCorreo({
      resumen: 'La contraseña de tu cuenta del Portal Clientes cambió.',
      etiqueta: { texto: 'Contraseña actualizada', tono: 'exito' },
      titulo: 'Tu contraseña fue actualizada',
      cuerpo:
        `Hola ${escaparHtml(nombre)}: tu contraseña ha sido actualizada exitosamente.` +
        '<p style="margin:16px 0 0;font-size:14px;color:#6D797D;">Si no realizaste este cambio, contacta a soporte de inmediato.</p>',
      sitio: this.sitio(),
    });
  }
}
