import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { SaldoClienteService } from '../common/saldo/saldo-cliente.service.js';
import { SALDO_CLIENTE_DEFINIDO } from '../common/pendientes.js';
import { conCandado } from './candado.js';
import {
  DespachoNotificacion,
  inicioDelDiaUTC,
  mensaje,
  pausa,
} from './despacho-notificacion.js';
import {
  clientesConFacturasImpagas,
  diaG8,
  facturasQueVencenEl,
  type ClienteConDeuda,
} from './deuda-g8.js';
import {
  CANDADO_RECORDATORIO_PAGO,
  DIAS_ANTES_DEL_VENCIMIENTO,
  PAUSA_ENTRE_TANDAS_MS,
  TANDA_MAXIMA,
  TIPO_EVENTO_RECORDATORIO,
} from './recordatorio-pago.constantes.js';
import { ZONA_HORARIA } from '../common/constants/zona-horaria.js';

/** Lo que el recordatorio necesita saber de un cliente con facturas por vencer. */
type PorVencer = {
  id_cliente: number;
  nombre: string;
  email: string | null;
  /** La suma del `saldoExigible` de G8 de las facturas que vencen ese día. */
  monto: number;
  /** La `fechaVencimientoEfectiva` de G8. */
  fechaLimite: Date;
  facturas: number[];
};

/** Lo que el recordatorio necesita y todavía no está. Ver `common/pendientes.ts`. */
export type DatosRecordatorio = { saldoDefinido: boolean };

export type ResumenTanda = {
  /** Clientes con alguna factura que, según G8, vence en tres días. */
  detectadas: number;
  enviados: number;
  sinCanal: number;
  fallidos: number;
  yaAvisados: number;
  /** Clientes por los que G8 no pudo responder: no se adivina. */
  sinDatos: number;
  /** false si falta un dato, o si otra instancia del backend tenía el candado. */
  ejecutada: boolean;
  /** Qué falta para que corra. Vacío cuando no falta nada. */
  faltan: string[];
};

/**
 * CU-67 / RF-49: recordatorio de pago tres días antes del vencimiento.
 *
 * **Quién y cuánto lo dice G8** (su ratificación del 02-10, §2 y §4): se le
 * recuerda al cliente que tenga una factura cuya `fechaVencimientoEfectiva` es
 * en tres días, con `saldoExigible` y que acepte pagos, y el monto es ese saldo.
 * La base solo dice a quién preguntarle (ver `deuda-g8.ts`). Mientras G8 no
 * despliegue (`SALDO_CLIENTE_DEFINIDO`), la tarea no despacha nada.
 *
 * **Uno por cliente**: "una vez por ciclo de facturación por cliente".
 *
 * Escribe en `log_notificacion`. Sin cambios de schema: las tablas ya existen.
 */
@Injectable()
export class RecordatorioPagoService {
  private readonly logger = new Logger(RecordatorioPagoService.name);
  private readonly despacho: DespachoNotificacion;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly saldos: SaldoClienteService,
  ) {
    this.despacho = new DespachoNotificacion(
      prisma,
      this.logger,
      TIPO_EVENTO_RECORDATORIO,
      'CU-67',
    );
  }

  /**
   * Una vez al día. La hora no la fija el RF-49 (solo el "tres días antes"), y
   * las 9 de la mañana es cuando un aviso de cobro tiene sentido para alguien:
   * las 9 de Chile, no las del servidor.
   */
  @Cron('0 9 * * *', { name: TIPO_EVENTO_RECORDATORIO, timeZone: ZONA_HORARIA })
  async tandaDiaria(): Promise<ResumenTanda> {
    return this.ejecutar(new Date());
  }

  /**
   * El reloj entra por parámetro para poder probar el cálculo de la fecha sin
   * depender del día en que corran los tests.
   */
  async ejecutar(
    ahora: Date,
    datos: DatosRecordatorio = { saldoDefinido: SALDO_CLIENTE_DEFINIDO },
  ): Promise<ResumenTanda> {
    const vacio: ResumenTanda = {
      detectadas: 0,
      enviados: 0,
      sinCanal: 0,
      fallidos: 0,
      yaAvisados: 0,
      sinDatos: 0,
      ejecutada: false,
      faltan: [],
    };

    if (!datos.saldoDefinido) {
      const faltan = ['los vencimientos y saldos de G8'];
      this.logger.warn(`[CU-67] no se despacha: falta ${faltan.join(', ')}`);
      return { ...vacio, faltan };
    }

    try {
      const r = await conCandado(this.prisma, CANDADO_RECORDATORIO_PAGO, () =>
        this.tanda(ahora, vacio, datos),
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
        `[CU-67] la tanda no se pudo completar: ${mensaje(error)}`,
      );
      return vacio;
    }
  }

  private async tanda(
    ahora: Date,
    vacio: ResumenTanda,
    datos: DatosRecordatorio,
  ): Promise<ResumenTanda> {
    const objetivo = this.fechaObjetivo(ahora);
    const idPlantilla = await this.despacho.plantilla();
    const candidatos = await clientesConFacturasImpagas(this.prisma);
    const resumen: ResumenTanda = { ...vacio, ejecutada: true };

    for (let i = 0; i < candidatos.length; i += TANDA_MAXIMA) {
      if (i > 0) await pausa(PAUSA_ENTRE_TANDAS_MS);
      for (const cliente of candidatos.slice(i, i + TANDA_MAXIMA)) {
        const porVencer = await this.porVencer(cliente, objetivo, datos);
        if (porVencer === undefined) {
          resumen.sinDatos++;
          continue;
        }
        if (porVencer === null) continue;
        resumen.detectadas++;
        await this.despachar(porVencer, ahora, idPlantilla, resumen);
      }
    }

    this.logger.log(
      `[CU-67] recordatorios para el ${diaG8(objetivo)}: ` +
        `${resumen.detectadas} detectadas, ${resumen.enviados} enviados, ` +
        `${resumen.sinCanal} sin canal, ${resumen.fallidos} fallidos, ` +
        `${resumen.yaAvisados} ya avisados, ${resumen.sinDatos} sin datos de G8`,
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
   * Precondición del CU: "el pago del ciclo actual no ha sido realizado". Lo
   * dice G8: entran las facturas que vencen ese día con `saldoExigible` y que
   * aceptan pagos. `null` si no tiene ninguna; `undefined` si G8 no respondió.
   */
  private async porVencer(
    cliente: ClienteConDeuda,
    objetivo: Date,
    datos: DatosRecordatorio,
  ): Promise<PorVencer | null | undefined> {
    const facturas = await this.saldos.facturasDe(
      { idCliente: cliente.idCliente },
      datos.saldoDefinido,
    );
    if (facturas === null) return undefined;

    const vencen = facturasQueVencenEl(facturas, diaG8(objetivo));
    if (vencen.length === 0) return null;

    return {
      id_cliente: cliente.idCliente,
      nombre: cliente.nombre,
      email: cliente.email,
      monto: vencen.reduce((total, f) => total + f.saldoExigible, 0),
      fechaLimite: objetivo,
      facturas: vencen.map((f) => f.idFactura),
    };
  }

  // ─── Despacho ─────────────────────────────────────────────────────────────

  private async despachar(
    factura: PorVencer,
    ahora: Date,
    idPlantilla: number | null,
    resumen: ResumenTanda,
  ): Promise<void> {
    // Segundo candado, contra el reintento: si el job se cayó a mitad y alguien
    // lo vuelve a correr el mismo día, el que ya tiene registro se salta.
    if (
      await this.despacho.yaSeLeAvisoDesde(
        factura.id_cliente,
        idPlantilla,
        inicioDelDiaUTC(ahora),
      )
    ) {
      resumen.yaAvisados++;
      return;
    }

    // Excepciones 1 y 2, y el registro antes del envío: ver DespachoNotificacion.
    const estado = await this.despacho.despachar({
      idCliente: factura.id_cliente,
      email: factura.email,
      idPlantilla,
      ahora,
      referencia: `cliente ${factura.id_cliente}, facturas ${factura.facturas.join(', ')}`,
      enviar: () =>
        this.mail.sendRecordatorioPago(
          factura.email!,
          factura.nombre,
          factura.monto,
          factura.fechaLimite,
        ),
    });

    if (estado === 'enviado') resumen.enviados++;
    else if (estado === 'omitido') resumen.sinCanal++;
    else resumen.fallidos++;
  }
}
