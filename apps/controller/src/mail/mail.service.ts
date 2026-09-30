import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { escaparHtml, fechaHoraCliente, pesos } from './formato.js';

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
      subject: 'Tu factura vence en 3 dias - Portal Clientes',
      html: this.recordatorioPagoTemplate(nombre, monto, fechaLimite),
    });

    this.logger.log('Payment reminder email sent');
  }

  /**
   * CU-68 / RF-50: aviso de corte inminente por morosidad, con el enlace directo
   * para pagar. Solo eso: el CU no pide monto ni fecha de corte. Lanza si el
   * despacho falla: quien llama decide si reintenta.
   */
  async sendAvisoCorte(email: string, nombre: string, enlacePago: string) {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      '"Portal Clientes" <no-reply@finet.cl>';

    await this.transporter.sendMail({
      from,
      to: email,
      subject: 'Aviso de corte de servicio - Portal Clientes',
      html: this.avisoCorteTemplate(nombre, enlacePago),
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
      text: `Hola ${nombre}, registramos tu solicitud en la categoria ${categoria}. Tu codigo de seguimiento es ${codigoSeguimiento}.`,
    });

    this.logger.log('Ticket created email sent');
  }

  private recordatorioPagoTemplate(
    nombre: string,
    monto: number,
    fechaLimite: Date,
  ): string {
    const montoFormateado = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(monto);
    const fecha = fechaLimite.toISOString().slice(0, 10);

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #333;">
  <div style="max-width: 480px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #1a56db;">Portal Clientes</h2>
    <p>Hola ${nombre},</p>
    <p>Te recordamos que tu factura vence el <strong>${fecha}</strong>.</p>
    <p>Monto a pagar: <strong>${montoFormateado}</strong></p>
    <p>Si ya pagaste, puedes ignorar este mensaje.</p>
    <p style="font-size: 12px; color: #666;">Este es un aviso automatico, no respondas a este correo.</p>
  </div>
</body>
</html>`;
  }

  private avisoCorteTemplate(nombre: string, enlacePago: string): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #333;">
  <div style="max-width: 480px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #1a56db;">Portal Clientes</h2>
    <p>Hola ${escaparHtml(nombre)},</p>
    <p>Tu servicio está próximo a ser cortado por una deuda vencida. Para evitarlo, paga tu deuda:</p>
    <p style="margin: 24px 0;">
      <a href="${escaparHtml(enlacePago)}" style="background: #1a56db; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none;">Pagar mi deuda</a>
    </p>
    <p>Si ya pagaste, puedes ignorar este mensaje.</p>
    <p style="font-size: 12px; color: #666;">Este es un aviso automatico, no respondas a este correo.</p>
  </div>
</body>
</html>`;
  }

  private confirmacionPagoTemplate(
    nombre: string,
    monto: number,
    fecha: Date,
    codigoAutorizacion: string,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #333;">
  <div style="max-width: 480px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #1a56db;">Portal Clientes</h2>
    <p>Hola ${escaparHtml(nombre)},</p>
    <p>Registramos tu pago de <strong>${pesos(monto)}</strong> el <strong>${fechaHoraCliente(fecha)}</strong>.</p>
    <p>Código de autorización: <strong>${escaparHtml(codigoAutorizacion)}</strong></p>
    <p>Guarda este correo como respaldo de tu pago.</p>
    <p style="font-size: 12px; color: #666;">Este es un aviso automatico, no respondas a este correo.</p>
  </div>
</body>
</html>`;
  }

  private resetTemplate(nombre: string, link: string): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #333;">
  <div style="max-width: 480px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #1a56db;">Portal Clientes</h2>
    <p>Hola ${nombre},</p>
    <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo para continuar:</p>
    <p style="text-align: center;">
      <a href="${link}" style="display: inline-block; background: #1a56db; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Restablecer contraseña</a>
    </p>
    <p style="font-size: 12px; color: #666;">Este enlace expira en 15 minutos. Si no solicitaste este cambio, ignora este mensaje.</p>
  </div>
</body>
</html>`;
  }

  private changedTemplate(nombre: string): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #333;">
  <div style="max-width: 480px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #1a56db;">Portal Clientes</h2>
    <p>Hola ${nombre},</p>
    <p>Tu contraseña ha sido actualizada exitosamente.</p>
    <p style="font-size: 12px; color: #666;">Si no realizaste este cambio, contacta a soporte de inmediato.</p>
  </div>
</body>
</html>`;
  }
}
