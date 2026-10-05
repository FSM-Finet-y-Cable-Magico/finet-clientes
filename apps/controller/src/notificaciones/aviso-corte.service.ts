import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { EnlacePagoService } from '../common/enlaces/enlace-pago.service.js';
import { SaldoClienteService } from '../common/saldo/saldo-cliente.service.js';
import {
  PASARELA_ACTIVA,
  SALDO_CLIENTE_DEFINIDO,
} from '../common/pendientes.js';
import { conCandado } from './candado.js';
import {
  DespachoNotificacion,
  inicioDelDiaUTC,
  mensaje,
  pausa,
  sumarDias,
} from './despacho-notificacion.js';
import {
  CANDADO_AVISO_CORTE,
  TIPO_EVENTO_AVISO_CORTE,
} from './aviso-corte.constantes.js';
import {
  PAUSA_ENTRE_TANDAS_MS,
  TANDA_MAXIMA,
  ZONA_HORARIA,
} from './recordatorio-pago.constantes.js';
import {
  clientesConFacturasImpagas,
  diaG8,
  facturasQueVencenEl,
} from './deuda-g8.js';

/** Lo que el aviso necesita y todavía no está en el sistema. Ver `common/pendientes.ts`. */
export type DatosAvisoCorte = {
  pasarelaActiva: boolean;
  saldoDefinido: boolean;
};

export type ResumenAvisoCorte = {
  /** Clientes con una factura que, según G8, venció ayer y sigue impaga: un aviso por cada uno. */
  detectadas: number;
  enviados: number;
  sinCanal: number;
  fallidos: number;
  yaAvisados: number;
  /** Clientes por los que G8 no pudo responder: no se adivina. */
  sinDatos: number;
  /** false si falta un dato, o si otra instancia tenía el candado. */
  ejecutada: boolean;
  /** Qué falta para que corra. Vacío cuando no falta nada. */
  faltan: string[];
};

/**
 * CU-68 / RF-50: aviso de corte inminente por morosidad.
 *
 * **Todo lo financiero lo dice G8** (su ratificación del 02-10, §2 y §4): se
 * avisa al cliente con una factura cuya `fechaVencimientoEfectiva` fue ayer,
 * con `saldoExigible` y que acepte pagos. La base solo dice a quién preguntarle
 * (ver `deuda-g8.ts`).
 *
 * **Qué dice:** cuánto debe el cliente (la suma de su `saldoExigible`), cuándo
 * venció y el enlace directo para pagar. **No promete una fecha de corte:** los
 * días de gracia se configuran por contrato en G8 (CU-47, RF-35 y CU-80), y el
 * CU-68 y el RF-50 no piden la fecha.
 *
 * **Uno por cliente**, aunque tenga varios contratos vencidos el mismo día.
 *
 * **Qué falta para que corra** (ver `common/pendientes.ts`), y mientras falte
 * cualquiera la tarea lo registra en el log y no despacha nada:
 * - una pasarela activa: es precondición del CU, sin ella el enlace no lleva a
 *   ningún lado;
 * - el saldo del cliente, que calcula G8 (acuerdo v2.0 §3 y §5).
 */
@Injectable()
export class AvisoCorteService {
  private readonly logger = new Logger(AvisoCorteService.name);
  private readonly despacho: DespachoNotificacion;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly enlaces: EnlacePagoService,
    private readonly saldos: SaldoClienteService,
    private readonly config: ConfigService,
  ) {
    this.despacho = new DespachoNotificacion(
      prisma,
      this.logger,
      TIPO_EVENTO_AVISO_CORTE,
      'CU-68',
    );
  }

  /**
   * A las 9:30 de Chile: media hora después del recordatorio del CU-67, para no
   * pisarse en el SMTP.
   */
  @Cron('30 9 * * *', { name: TIPO_EVENTO_AVISO_CORTE, timeZone: ZONA_HORARIA })
  async tandaDiaria(): Promise<ResumenAvisoCorte> {
    return this.ejecutar(new Date());
  }

  async ejecutar(
    ahora: Date,
    datos: DatosAvisoCorte = {
      pasarelaActiva: PASARELA_ACTIVA,
      saldoDefinido: SALDO_CLIENTE_DEFINIDO,
    },
  ): Promise<ResumenAvisoCorte> {
    const vacio: ResumenAvisoCorte = {
      detectadas: 0,
      enviados: 0,
      sinCanal: 0,
      fallidos: 0,
      yaAvisados: 0,
      sinDatos: 0,
      ejecutada: false,
      faltan: [],
    };

    const faltan: string[] = [];
    if (!datos.pasarelaActiva) {
      faltan.push('una pasarela de pagos activa (precondición del CU-68)');
    }
    if (!datos.saldoDefinido) {
      faltan.push('el saldo del cliente (Grupo 8)');
    }
    if (faltan.length > 0) {
      this.logger.warn(`[CU-68] no se despacha: falta ${faltan.join(', ')}`);
      return { ...vacio, faltan };
    }

    try {
      const r = await conCandado(this.prisma, CANDADO_AVISO_CORTE, () =>
        this.tanda(ahora, vacio, datos),
      );
      if (!r.tomado) {
        this.logger.log(
          '[CU-68] otra instancia ya está despachando los avisos: esta no hace nada',
        );
        return vacio;
      }
      return r.resultado;
    } catch (error) {
      this.logger.error(
        `[CU-68] la tanda no se pudo completar: ${mensaje(error)}`,
      );
      return vacio;
    }
  }

  private async tanda(
    ahora: Date,
    vacio: ResumenAvisoCorte,
    datos: DatosAvisoCorte,
  ): Promise<ResumenAvisoCorte> {
    // Antes de despachar nada: sin la URL del sitio o sin la clave de los
    // enlaces, los correos saldrían con el enlace roto o no saldrían, y cada
    // cliente quedaría como fallido sin haber tenido nada que ver.
    const sitio = this.config.getOrThrow<string>('FRONTEND_URL');
    this.enlaces.verificarClave();

    const hoy = inicioDelDiaUTC(ahora);
    const ayer = sumarDias(hoy, -1);
    const idPlantilla = await this.despacho.plantilla();
    const candidatos = await clientesConFacturasImpagas(this.prisma);

    const resumen: ResumenAvisoCorte = { ...vacio, ejecutada: true };

    for (let i = 0; i < candidatos.length; i += TANDA_MAXIMA) {
      if (i > 0) await pausa(PAUSA_ENTRE_TANDAS_MS);
      for (const c of candidatos.slice(i, i + TANDA_MAXIMA)) {
        // Si la tanda se cae a mitad y se relanza, al que ya se le avisó hoy
        // no se le vuelve a avisar ni se le pregunta de nuevo a G8.
        if (
          await this.despacho.yaSeLeAvisoDesde(c.idCliente, idPlantilla, hoy)
        ) {
          resumen.yaAvisados++;
          continue;
        }

        const facturas = await this.saldos.facturasDe(
          { idCliente: c.idCliente, idContrato: null },
          datos.saldoDefinido,
        );
        if (facturas === null) {
          resumen.sinDatos++;
          continue;
        }
        const vencidas = facturasQueVencenEl(facturas, diaG8(ayer));
        if (vencidas.length === 0) continue;

        resumen.detectadas++;
        // Lo que debe en total, según G8.
        const deuda = facturas.reduce((t, f) => t + f.saldoExigible, 0);
        const estado = await this.despacho.despachar({
          idCliente: c.idCliente,
          email: c.email,
          idPlantilla,
          ahora,
          referencia: `cliente ${c.idCliente}, facturas ${vencidas.map((f) => f.idFactura).join(', ')}`,
          enviar: () =>
            this.mail.sendAvisoCorte(
              c.email!,
              c.nombre,
              deuda,
              ayer,
              this.enlacePago(sitio, c.idCliente),
            ),
        });

        if (estado === 'enviado') resumen.enviados++;
        else if (estado === 'omitido') resumen.sinCanal++;
        else resumen.fallidos++;
      }
    }

    this.logger.log(
      `[CU-68] avisos de corte por vencimientos del ${ayer.toISOString().slice(0, 10)}: ` +
        `${resumen.detectadas} clientes, ${resumen.enviados} enviados, ` +
        `${resumen.sinCanal} sin canal, ${resumen.fallidos} fallidos, ` +
        `${resumen.yaAvisados} ya avisados, ${resumen.sinDatos} sin datos de G8`,
    );
    return resumen;
  }

  /** RF-50 y RNF-50.1: enlace corto, único y firmado. */
  private enlacePago(sitio: string, idCliente: number): string {
    return `${sitio}/pagar?t=${this.enlaces.crearEnlacePago(idCliente)}`;
  }
}
