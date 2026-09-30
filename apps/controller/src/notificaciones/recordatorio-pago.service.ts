import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { conCandado } from './candado.js';
import {
  CANAL_CORREO,
  CANDADO_RECORDATORIO_PAGO,
  DIAS_ANTES_DEL_VENCIMIENTO,
  ESTADOS_IMPAGOS,
  ESTADO_ENVIO,
  PAUSA_ENTRE_TANDAS_MS,
  TANDA_MAXIMA,
  TIPO_EVENTO_RECORDATORIO,
} from './recordatorio-pago.constantes.js';

/** Lo que necesita saber el despacho de una factura por vencer. */
type PorVencer = {
  id_factura: number;
  id_cliente: number | null;
  nombre: string;
  email: string | null;
  monto: number;
  fechaLimite: Date;
};

export type ResumenTanda = {
  detectadas: number;
  enviados: number;
  sinCanal: number;
  fallidos: number;
  yaAvisados: number;
  /** false cuando otra instancia del backend tenía el candado. */
  ejecutada: boolean;
};

/**
 * CU-67 / RF-49: recordatorio de pago tres días antes del vencimiento.
 *
 * Solo lee `factura`, `contrato` y `cliente`, que el §5 del acuerdo v2.0 con G8
 * autoriza expresamente, y escribe en `log_notificacion`. Sin cambios de
 * schema: las tablas ya existen.
 */
@Injectable()
export class RecordatorioPagoService {
  private readonly logger = new Logger(RecordatorioPagoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Una vez al día. La hora no la fija el RF-49 (solo el "tres días antes"), y
   * las 9 de la mañana es cuando un aviso de cobro tiene sentido para alguien.
   */
  @Cron('0 9 * * *', { name: TIPO_EVENTO_RECORDATORIO })
  async tandaDiaria(): Promise<ResumenTanda> {
    return this.ejecutar(new Date());
  }

  /**
   * El reloj entra por parámetro para poder probar el cálculo de la fecha sin
   * depender del día en que corran los tests.
   */
  async ejecutar(ahora: Date): Promise<ResumenTanda> {
    const vacio: ResumenTanda = {
      detectadas: 0,
      enviados: 0,
      sinCanal: 0,
      fallidos: 0,
      yaAvisados: 0,
      ejecutada: false,
    };

    try {
      const r = await conCandado(this.prisma, CANDADO_RECORDATORIO_PAGO, () =>
        this.tanda(ahora, vacio),
      );
      if (!r.tomado) {
        this.logger.log(
          '[CU-67] otra instancia ya está despachando los recordatorios: esta no hace nada',
        );
        return vacio;
      }
      return r.resultado;
    } catch (error) {
      this.logger.error(
        `[CU-67] la tanda no se pudo completar: ${this.mensaje(error)}`,
      );
      return vacio;
    }
  }

  private async tanda(ahora: Date, vacio: ResumenTanda): Promise<ResumenTanda> {
    const objetivo = this.fechaObjetivo(ahora);
    const idPlantilla = await this.plantilla();
    const facturas = await this.facturasPorVencer(objetivo);
    const resumen: ResumenTanda = {
      ...vacio,
      detectadas: facturas.length,
      ejecutada: true,
    };

    for (let i = 0; i < facturas.length; i += TANDA_MAXIMA) {
      if (i > 0) await this.pausa(PAUSA_ENTRE_TANDAS_MS);
      for (const factura of facturas.slice(i, i + TANDA_MAXIMA)) {
        await this.despachar(factura, ahora, idPlantilla, resumen);
      }
    }

    this.logger.log(
      `[CU-67] recordatorios para el ${objetivo.toISOString().slice(0, 10)}: ` +
        `${resumen.detectadas} detectadas, ${resumen.enviados} enviados, ` +
        `${resumen.sinCanal} sin canal, ${resumen.fallidos} fallidos, ` +
        `${resumen.yaAvisados} ya avisados`,
    );
    return resumen;
  }

  // ─── Detección ────────────────────────────────────────────────────────────

  /** RF-49: la fecha que vence en tres días corridos, a medianoche UTC. */
  private fechaObjetivo(ahora: Date): Date {
    const objetivo = new Date(
      Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()),
    );
    objetivo.setUTCDate(objetivo.getUTCDate() + DIAS_ANTES_DEL_VENCIMIENTO);
    return objetivo;
  }

  /**
   * Precondición del CU: "el pago del ciclo actual no ha sido realizado". Por
   * eso solo entran las facturas impagas.
   */
  private async facturasPorVencer(objetivo: Date): Promise<PorVencer[]> {
    const facturas = await this.prisma.factura.findMany({
      where: {
        fecha_limite_pago: objetivo,
        estado: { in: ESTADOS_IMPAGOS },
      },
      select: {
        id_factura: true,
        monto: true,
        fecha_limite_pago: true,
        contrato: {
          select: {
            cliente: {
              select: { id_cliente: true, nombre_completo: true, email: true },
            },
          },
        },
      },
    });

    return facturas.map((f) => ({
      id_factura: f.id_factura,
      id_cliente: f.contrato?.cliente?.id_cliente ?? null,
      nombre: f.contrato?.cliente?.nombre_completo ?? '',
      email: f.contrato?.cliente?.email ?? null,
      monto: Number(f.monto ?? 0),
      fechaLimite: f.fecha_limite_pago,
    }));
  }

  // ─── Despacho ─────────────────────────────────────────────────────────────

  private async despachar(
    factura: PorVencer,
    ahora: Date,
    idPlantilla: number | null,
    resumen: ResumenTanda,
  ): Promise<void> {
    if (await this.yaSeLeAviso(factura, ahora, idPlantilla)) {
      resumen.yaAvisados++;
      return;
    }

    // Excepción 1: sin canales de contacto no se despacha, pero el evento queda
    // registrado como no notificado.
    if (!factura.email?.trim()) {
      await this.registrar(
        factura,
        ESTADO_ENVIO.NO_NOTIFICADO,
        ahora,
        idPlantilla,
      );
      resumen.sinCanal++;
      return;
    }

    // La fila va antes del envío: si el proceso muere justo después de que el
    // correo salga, el registro ya existe y nadie recibe el aviso dos veces.
    const id = await this.registrar(
      factura,
      ESTADO_ENVIO.EN_CURSO,
      ahora,
      idPlantilla,
    );

    // Excepción 2: si falla el despacho se reintenta una vez; si el reintento
    // también falla, queda como fallido para revisión manual.
    const enviado =
      (await this.intentarEnvio(factura)) ||
      (await this.intentarEnvio(factura));

    await this.marcar(
      id,
      enviado ? ESTADO_ENVIO.ENVIADO : ESTADO_ENVIO.FALLIDO,
      new Date(),
    );
    if (enviado) resumen.enviados++;
    else resumen.fallidos++;
  }

  private async intentarEnvio(factura: PorVencer): Promise<boolean> {
    try {
      await this.mail.sendRecordatorioPago(
        factura.email!,
        factura.nombre,
        factura.monto,
        factura.fechaLimite,
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `[CU-67] falló el envío de la factura ${factura.id_factura}: ${this.mensaje(error)}`,
      );
      return false;
    }
  }

  // ─── Historial ────────────────────────────────────────────────────────────

  /**
   * Segundo candado, contra el reintento: si el job se cayó a mitad y alguien
   * lo vuelve a correr el mismo día, el que ya tiene registro se salta.
   *
   * Filtra por plantilla y no por canal porque el CU-71 (tickets) también
   * escribe en `log_notificacion` con `canal: 'email'`: sin esto, un cliente
   * que abrió un ticket hoy se quedaría sin su recordatorio.
   */
  private async yaSeLeAviso(
    factura: PorVencer,
    ahora: Date,
    idPlantilla: number | null,
  ): Promise<boolean> {
    if (factura.id_cliente === null || idPlantilla === null) return false;

    const inicioDelDia = new Date(
      Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()),
    );

    const previo = await this.prisma.log_notificacion.findFirst({
      where: {
        id_cliente: factura.id_cliente,
        id_plantilla: idPlantilla,
        fecha_envio: { gte: inicioDelDia },
      },
      select: { id_notificacion: true },
    });
    return previo !== null;
  }

  /** RNF-49.2: canal, marca de tiempo y estado de entrega. */
  private async registrar(
    factura: PorVencer,
    estado: string,
    fecha: Date,
    idPlantilla: number | null,
  ): Promise<bigint | null> {
    try {
      const fila = await this.prisma.log_notificacion.create({
        data: {
          id_cliente: factura.id_cliente,
          id_plantilla: idPlantilla,
          canal: CANAL_CORREO,
          fecha_envio: fecha,
          estado_envio: estado,
        },
        select: { id_notificacion: true },
      });
      return fila.id_notificacion;
    } catch (error) {
      this.logger.error(
        `[CU-67] no se pudo registrar la notificación de la factura ${factura.id_factura}: ${this.mensaje(error)}`,
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
        `[CU-67] no se pudo cerrar la notificación ${id}: ${this.mensaje(error)}`,
      );
    }
  }

  /**
   * La plantilla que identifica a este recordatorio dentro de
   * `log_notificacion`. Se busca por tipo de evento y canal; si no está, se
   * crea una vez. Es una fila de datos maestros, no un cambio de esquema: la
   * tabla `plantilla_notificacion` ya existe con estas columnas.
   *
   * El texto del correo vive en `MailService`, así que `contenido_texto` queda
   * en null a propósito — esta fila sirve para etiquetar, no para plantillar.
   */
  private async plantilla(): Promise<number | null> {
    try {
      const existente = await this.prisma.plantilla_notificacion.findFirst({
        where: { tipo_evento: TIPO_EVENTO_RECORDATORIO, canal: CANAL_CORREO },
        select: { id_plantilla: true },
      });
      if (existente) return existente.id_plantilla;

      const creada = await this.prisma.plantilla_notificacion.create({
        data: {
          tipo_evento: TIPO_EVENTO_RECORDATORIO,
          canal: CANAL_CORREO,
          activa: true,
        },
        select: { id_plantilla: true },
      });
      this.logger.log(
        `[CU-67] plantilla ${TIPO_EVENTO_RECORDATORIO} creada (${creada.id_plantilla})`,
      );
      return creada.id_plantilla;
    } catch (error) {
      this.logger.error(
        `[CU-67] no se pudo resolver la plantilla: ${this.mensaje(error)}`,
      );
      return null;
    }
  }

  // ─── Auxiliares ───────────────────────────────────────────────────────────

  private pausa(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private mensaje(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
