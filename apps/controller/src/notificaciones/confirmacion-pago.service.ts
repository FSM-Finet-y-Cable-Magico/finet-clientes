import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import {
  DespachoNotificacion,
  type EstadoDespacho,
  mensaje,
} from './despacho-notificacion.js';
import { TIPO_EVENTO_CONFIRMACION_PAGO } from './confirmacion-pago.constantes.js';

/** RF-32: lo que queda registrado de cada pago confirmado. */
export type PagoRegistrado = {
  idCliente: number;
  monto: number;
  fecha: Date;
  codigoAutorizacion: string;
};

/**
 * CU-69 / RF-51: confirmación de pago registrado.
 *
 * No es una tarea programada: la dispara el registro del pago, apenas la
 * pasarela devuelve un estado exitoso (RNF-51.1: "inmediatamente").
 *
 * **Una vez por cada pago** lo asegura quien llama: el registro rechaza un
 * código de transacción repetido (RF-33) antes de llegar acá. Este servicio no
 * puede deduplicar solo, porque `log_notificacion` no tiene columna para
 * referenciar el pago.
 *
 * **Qué falta para que se dispare:** el pago. Hoy nada lo llama; se conecta al
 * construir el checkout (CU-42, CU-43), cuando se sepa dónde queda registrado
 * el pago confirmado.
 */
@Injectable()
export class ConfirmacionPagoService {
  private readonly logger = new Logger(ConfirmacionPagoService.name);
  private readonly despacho: DespachoNotificacion;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {
    this.despacho = new DespachoNotificacion(
      prisma,
      this.logger,
      TIPO_EVENTO_CONFIRMACION_PAGO,
      'CU-69',
    );
  }

  /**
   * No lanza: si algo falla queda en el log, y el pago, que ya está registrado,
   * no se toca. Quien llama puede no esperarlo, para no demorar la respuesta a
   * la pasarela.
   */
  async confirmar(
    pago: PagoRegistrado,
    ahora = new Date(),
  ): Promise<EstadoDespacho> {
    try {
      // "El sistema recupera los datos del pago y los canales de contacto del cliente."
      const cliente = await this.prisma.cliente.findUnique({
        where: { id_cliente: pago.idCliente },
        select: { nombre_completo: true, email: true },
      });
      const idPlantilla = await this.despacho.plantilla();

      return await this.despacho.despachar({
        idCliente: pago.idCliente,
        email: cliente?.email ?? null,
        idPlantilla,
        ahora,
        referencia: `pago ${pago.codigoAutorizacion}`,
        enviar: () =>
          this.mail.sendConfirmacionPago(
            cliente!.email!,
            cliente!.nombre_completo,
            pago.monto,
            pago.fecha,
            pago.codigoAutorizacion,
          ),
      });
    } catch (error) {
      this.logger.error(
        `[CU-69] no se pudo confirmar el pago ${pago.codigoAutorizacion}: ${mensaje(error)}`,
      );
      return 'fallido';
    }
  }
}
