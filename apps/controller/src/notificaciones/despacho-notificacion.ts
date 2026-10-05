import type { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CANAL_CORREO, ESTADO_ENVIO } from './recordatorio-pago.constantes.js';

export type EstadoDespacho = 'enviado' | 'fallido' | 'omitido';

export type Despacho = {
  idCliente: number | null;
  email: string | null;
  idPlantilla: number | null;
  ahora: Date;
  /** Para el log: qué se está avisando ("factura 42", "pago ABC"). */
  referencia: string;
  enviar: () => Promise<unknown>;
};

/**
 * Lo que el CU-68 y el CU-69 hacen igual que el CU-67 al avisarle algo al
 * cliente:
 *
 * - la plantilla que identifica el tipo de aviso en `log_notificacion`;
 * - **Excepción 1** — sin correo registrado no se despacha, y queda `omitido`;
 * - la fila se escribe **antes** de enviar, para no mandar dos veces si el
 *   proceso muere justo después del envío;
 * - **Excepción 2** — si falla se reintenta una vez, y si vuelve a fallar queda
 *   `fallido` para revisión manual.
 *
 * El CU-67 conserva su propia copia a propósito: está en revisión en el PR #18 y
 * migrarlo acá queda para el Incremento 4.
 */
export class DespachoNotificacion {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
    private readonly tipoEvento: string,
    private readonly cu: string,
  ) {}

  /**
   * Busca la plantilla del tipo de aviso y la crea una vez si no está. Es una
   * fila de datos maestros en una tabla que ya existe, no un cambio de esquema.
   * El texto del correo vive en `MailService`: la fila etiqueta, no plantilla.
   */
  async plantilla(): Promise<number | null> {
    try {
      const existente = await this.prisma.plantilla_notificacion.findFirst({
        where: { tipo_evento: this.tipoEvento, canal: CANAL_CORREO },
        select: { id_plantilla: true },
      });
      if (existente) return existente.id_plantilla;

      const creada = await this.prisma.plantilla_notificacion.create({
        data: {
          tipo_evento: this.tipoEvento,
          canal: CANAL_CORREO,
          activa: true,
        },
        select: { id_plantilla: true },
      });
      this.logger.log(
        `[${this.cu}] plantilla ${this.tipoEvento} creada (${creada.id_plantilla})`,
      );
      return creada.id_plantilla;
    } catch (error) {
      this.logger.error(
        `[${this.cu}] no se pudo resolver la plantilla: ${mensaje(error)}`,
      );
      return null;
    }
  }

  /**
   * Si al cliente ya se le mandó este tipo de aviso desde `desde`. Filtra por
   * plantilla y no por canal: otros flujos del portal también escriben con
   * `canal: 'email'`, y no deben tapar este aviso.
   */
  async yaSeLeAvisoDesde(
    idCliente: number | null,
    idPlantilla: number | null,
    desde: Date,
  ): Promise<boolean> {
    if (idCliente === null || idPlantilla === null) return false;
    const previo = await this.prisma.log_notificacion.findFirst({
      where: {
        id_cliente: idCliente,
        id_plantilla: idPlantilla,
        fecha_envio: { gte: desde },
      },
      select: { id_notificacion: true },
    });
    return previo !== null;
  }

  async despachar(d: Despacho): Promise<EstadoDespacho> {
    if (!d.email?.trim()) {
      await this.registrar(d, ESTADO_ENVIO.NO_NOTIFICADO, d.ahora);
      return 'omitido';
    }

    const id = await this.registrar(d, ESTADO_ENVIO.EN_CURSO, d.ahora);
    const enviado = (await this.intentar(d)) || (await this.intentar(d));
    await this.marcar(
      id,
      enviado ? ESTADO_ENVIO.ENVIADO : ESTADO_ENVIO.FALLIDO,
      new Date(),
    );
    return enviado ? 'enviado' : 'fallido';
  }

  private async intentar(d: Despacho): Promise<boolean> {
    try {
      await d.enviar();
      return true;
    } catch (error) {
      this.logger.warn(
        `[${this.cu}] falló el envío (${d.referencia}): ${mensaje(error)}`,
      );
      return false;
    }
  }

  private async registrar(
    d: Despacho,
    estado: string,
    fecha: Date,
  ): Promise<bigint | null> {
    try {
      const fila = await this.prisma.log_notificacion.create({
        data: {
          id_cliente: d.idCliente,
          id_plantilla: d.idPlantilla,
          canal: CANAL_CORREO,
          fecha_envio: fecha,
          estado_envio: estado,
        },
        select: { id_notificacion: true },
      });
      return fila.id_notificacion;
    } catch (error) {
      this.logger.error(
        `[${this.cu}] no se pudo registrar la notificación (${d.referencia}): ${mensaje(error)}`,
      );
      return null;
    }
  }

  private async marcar(
    id: bigint | null,
    estado: string,
    fecha: Date,
  ): Promise<void> {
    if (id === null) return;
    try {
      await this.prisma.log_notificacion.update({
        where: { id_notificacion: id },
        data: { estado_envio: estado, fecha_envio: fecha },
      });
    } catch (error) {
      this.logger.error(
        `[${this.cu}] no se pudo cerrar la notificación ${id}: ${mensaje(error)}`,
      );
    }
  }
}

export function inicioDelDiaUTC(fecha: Date): Date {
  return new Date(
    Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()),
  );
}

export function sumarDias(fecha: Date, dias: number): Date {
  const r = new Date(fecha);
  r.setUTCDate(r.getUTCDate() + dias);
  return r;
}

export function pausa(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function mensaje(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
