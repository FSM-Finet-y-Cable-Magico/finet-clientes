import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { EnlacePagoService } from '../common/enlaces/enlace-pago.service.js';
import { PASARELA_ACTIVA } from '../common/pendientes.js';
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
  ESTADOS_IMPAGOS,
  PAUSA_ENTRE_TANDAS_MS,
  TANDA_MAXIMA,
  ZONA_HORARIA,
} from './recordatorio-pago.constantes.js';

/** Lo que el aviso necesita y todavía no está en el sistema. Ver `common/pendientes.ts`. */
export type DatosAvisoCorte = {
  pasarelaActiva: boolean;
};

export type ResumenAvisoCorte = {
  /** Clientes con al menos una factura impaga que venció ayer: un aviso por cada uno. */
  detectadas: number;
  enviados: number;
  sinCanal: number;
  fallidos: number;
  yaAvisados: number;
  /** false si falta un dato, o si otra instancia tenía el candado. */
  ejecutada: boolean;
  /** Qué falta para que corra. Vacío cuando no falta nada. */
  faltan: string[];
};

/** Un cliente a avisar, con las facturas que le vencieron ayer. */
type Moroso = {
  id_cliente: number | null;
  nombre: string;
  email: string | null;
  facturas: number[];
};

/**
 * CU-68 / RF-50: aviso de corte inminente por morosidad.
 *
 * **Qué dice:** que el servicio está próximo a cortarse por una deuda vencida, y
 * el enlace directo para pagar. Es lo que piden el CU y el RF-50; ni monto ni
 * fecha de corte: el monto lo ve al abrir el enlace.
 *
 * **Cuándo avisa:** el día siguiente al vencimiento de una factura impaga. El CU
 * habla de un "umbral de morosidad" que el Documento 0 no define; así el aviso
 * solo depende de la fecha de vencimiento.
 *
 * **Uno por cliente**, aunque tenga varios contratos vencidos el mismo día.
 *
 * **Qué falta para que corra:** una pasarela activa, que es precondición del CU:
 * sin ella el enlace no lleva a ningún lado (ver `common/pendientes.ts`).
 * Mientras falte, la tarea lo registra en el log y no despacha nada.
 */
@Injectable()
export class AvisoCorteService {
  private readonly logger = new Logger(AvisoCorteService.name);
  private readonly despacho: DespachoNotificacion;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly enlaces: EnlacePagoService,
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
    datos: DatosAvisoCorte = { pasarelaActiva: PASARELA_ACTIVA },
  ): Promise<ResumenAvisoCorte> {
    const vacio: ResumenAvisoCorte = {
      detectadas: 0,
      enviados: 0,
      sinCanal: 0,
      fallidos: 0,
      yaAvisados: 0,
      ejecutada: false,
      faltan: [],
    };

    if (!datos.pasarelaActiva) {
      const faltan = ['una pasarela de pagos activa (precondición del CU-68)'];
      this.logger.warn(`[CU-68] no se despacha: falta ${faltan[0]}`);
      return { ...vacio, faltan };
    }

    try {
      const r = await conCandado(this.prisma, CANDADO_AVISO_CORTE, () =>
        this.tanda(ahora, vacio),
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
  ): Promise<ResumenAvisoCorte> {
    // Antes de despachar nada: sin la URL del sitio o sin la clave de los
    // enlaces, los correos saldrían con el enlace roto o no saldrían, y cada
    // cliente quedaría como fallido sin haber tenido nada que ver.
    const sitio = this.config.getOrThrow<string>('FRONTEND_URL');
    this.enlaces.verificarClave();

    const hoy = inicioDelDiaUTC(ahora);
    const ayer = sumarDias(hoy, -1);
    const idPlantilla = await this.despacho.plantilla();
    const morosos = await this.vencidosAyer(ayer);

    const resumen: ResumenAvisoCorte = {
      ...vacio,
      detectadas: morosos.length,
      ejecutada: true,
    };

    for (let i = 0; i < morosos.length; i += TANDA_MAXIMA) {
      if (i > 0) await pausa(PAUSA_ENTRE_TANDAS_MS);
      for (const m of morosos.slice(i, i + TANDA_MAXIMA)) {
        // Si la tanda se cae a mitad y se relanza, al que ya se le avisó hoy
        // no se le vuelve a avisar.
        if (
          await this.despacho.yaSeLeAvisoDesde(m.id_cliente, idPlantilla, hoy)
        ) {
          resumen.yaAvisados++;
          continue;
        }

        const estado = await this.despacho.despachar({
          idCliente: m.id_cliente,
          email: m.email,
          idPlantilla,
          ahora,
          referencia: `cliente ${m.id_cliente}, facturas ${m.facturas.join(', ')}`,
          enviar: () =>
            this.mail.sendAvisoCorte(
              m.email!,
              m.nombre,
              this.enlacePago(sitio, m.id_cliente!),
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
        `${resumen.yaAvisados} ya avisados`,
    );
    return resumen;
  }

  /** Clientes con facturas que vencieron ayer y siguen impagas, uno por cliente. */
  private async vencidosAyer(ayer: Date): Promise<Moroso[]> {
    const facturas = await this.prisma.factura.findMany({
      where: { fecha_limite_pago: ayer, estado: { in: ESTADOS_IMPAGOS } },
      select: {
        id_factura: true,
        contrato: {
          select: {
            cliente: {
              select: { id_cliente: true, nombre_completo: true, email: true },
            },
          },
        },
      },
      orderBy: { id_factura: 'asc' },
    });

    const porCliente = new Map<number | null, Moroso>();
    for (const f of facturas) {
      const cliente = f.contrato?.cliente;
      const id = cliente?.id_cliente ?? null;
      const previo = porCliente.get(id);
      if (previo) {
        previo.facturas.push(f.id_factura);
        continue;
      }
      porCliente.set(id, {
        id_cliente: id,
        nombre: cliente?.nombre_completo ?? '',
        email: cliente?.email ?? null,
        facturas: [f.id_factura],
      });
    }
    return [...porCliente.values()];
  }

  /** RF-50 y RNF-50.1: enlace corto, único y firmado. */
  private enlacePago(sitio: string, idCliente: number): string {
    return `${sitio}/pagar?t=${this.enlaces.crearEnlacePago(idCliente)}`;
  }
}
