import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  G8IntegracionService,
  type FacturaG8,
} from '../g8/g8-integracion.service.js';
import { SALDO_CLIENTE_DEFINIDO } from '../pendientes.js';
import { ZONA_HORARIA } from '../constants/zona-horaria.js';
import { formatPeriodo } from '../utils/periodo.js';

/** A quién se le cobra: el cliente, con todos sus contratos. */
export type Cuenta = { idCliente: number };

/** El saldo de la cuenta: la suma del `saldoExigible` que dio G8 por factura. */
export function sumarSaldo(facturas: readonly FacturaG8[]): number {
  return facturas.reduce((total, f) => total + f.saldoExigible, 0);
}

/** Una factura con saldo, como la ven el panel, "Mi deuda" y la consulta por RUT. */
export type FacturaConDeuda = {
  idFactura: number;
  /** "Mayo 2026", de la tabla `factura`. `null` si esa fila no está en la base. */
  periodo: string | null;
  /** El `saldoExigible` de G8. */
  monto: number;
  /** `fechaVencimientoEfectiva` de G8, `AAAA-MM-DD`. `null` si no vino o no es una fecha. */
  fechaLimite: string | null;
  vencida: boolean;
  diasVencida: number | null;
  diasParaVencer: number | null;
};

/** La deuda del cliente, armada solo con lo que entrega G8. */
export type DeudaCliente = {
  /** Las facturas con saldo mayor a cero, de la que vence antes a la que vence después. */
  facturas: FacturaConDeuda[];
  saldoTotal: number;
  /** `false` si alguna factura no trae su vencimiento (CU-41, Excepción 2). */
  completa: boolean;
  /** `true` si G8 entregó un saldo negativo o que no es un número (CU-27, Excepción 3). */
  inconsistente: boolean;
};

const DIA_MS = 86_400_000;

/** `AAAA-MM-DD` de hoy en Chile (§11 del Documento 0), no en la hora del servidor. */
function hoyEnChile(ahora: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA }).format(
    ahora,
  );
}

/**
 * Las facturas de G8 como detalle de deuda. Vencida es que la fecha efectiva de
 * G8 ya pasó en el calendario de Chile: no se recalcula ninguna regla de cobro
 * (acuerdo v2.0, §5). La que vence hoy todavía no está vencida.
 */
export function armarDeuda(
  facturasG8: readonly FacturaG8[],
  periodos: ReadonlyMap<number, string>,
  ahora = new Date(),
): DeudaCliente {
  const inconsistente = facturasG8.some(
    (f) => !Number.isFinite(f.saldoExigible) || f.saldoExigible < 0,
  );
  const hoy = Date.parse(hoyEnChile(ahora));

  const facturas = facturasG8
    .filter((f) => Number.isFinite(f.saldoExigible) && f.saldoExigible > 0)
    .map((f): FacturaConDeuda => {
      const instante = f.fechaVencimientoEfectiva
        ? Date.parse(f.fechaVencimientoEfectiva)
        : Number.NaN;
      const fechaLimite = Number.isNaN(instante)
        ? null
        : new Date(instante).toISOString().split('T')[0];
      const dias =
        fechaLimite === null
          ? null
          : Math.round((Date.parse(fechaLimite) - hoy) / DIA_MS);
      return {
        idFactura: f.idFactura,
        periodo: periodos.get(f.idFactura) ?? null,
        monto: f.saldoExigible,
        fechaLimite,
        vencida: dias !== null && dias < 0,
        diasVencida: dias !== null && dias < 0 ? -dias : null,
        diasParaVencer: dias !== null && dias >= 0 ? dias : null,
      };
    })
    .sort((a, b) =>
      (a.fechaLimite ?? '9999-12-31').localeCompare(
        b.fechaLimite ?? '9999-12-31',
      ),
    );

  return {
    facturas,
    saldoTotal: facturas.reduce((total, f) => total + f.monto, 0),
    completa: facturas.every((f) => f.fechaLimite !== null),
    inconsistente,
  };
}

/**
 * El saldo que debe un cliente, tal como lo deja Grupo 8.
 *
 * La deuda la calcula G8, no nosotros (acuerdo v2.0 §3 y §5): acá no se suman
 * facturas de la base. Lo entrega `GET /api/integrations/g2/invoices`, y cada
 * factura trae su `saldoExigible`, "el monto actualmente cobrable" (respuesta de
 * G8 del 02-10, §2). El saldo de la cuenta es la suma de esos montos.
 *
 * Mientras G8 no confirme su deploy (`SALDO_CLIENTE_DEFINIDO` en
 * `common/pendientes.ts`) no se le llama y el servicio devuelve `null`. También
 * devuelve `null` si G8 no puede darlo: el pago cae en su precondición ("una
 * deuda pendiente identificada") y el aviso de corte en su Excepción 2, y nunca
 * se cobra ni se avisa un total inventado.
 *
 * Lo usan el pago (CU-42: lo que se cobra de cada factura), el aviso de corte
 * (CU-68: el monto que se informa) y lo que ve el cliente de su deuda: el panel
 * y "Mi deuda" (CU-27 y 28) y la consulta por RUT (CU-39 y 41). Siempre es el
 * saldo de todos los contratos del cliente.
 */
@Injectable()
export class SaldoClienteService {
  private readonly logger = new Logger(SaldoClienteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly g8: G8IntegracionService,
  ) {}

  async saldoDe(
    cuenta: Cuenta,
    saldoDefinido = SALDO_CLIENTE_DEFINIDO,
  ): Promise<number | null> {
    const facturas = await this.facturasDe(cuenta, saldoDefinido);
    return facturas === null ? null : sumarSaldo(facturas);
  }

  /**
   * La deuda del cliente para mostrarla (CU-27, 28, 39 y 41): el monto y el
   * vencimiento salen de G8, y de la base solo el periodo de cada factura.
   * `null` si G8 todavía no está o no pudo responder.
   */
  async deudaDe(
    cuenta: Cuenta,
    saldoDefinido = SALDO_CLIENTE_DEFINIDO,
    ahora = new Date(),
  ): Promise<DeudaCliente | null> {
    const facturas = await this.facturasDe(cuenta, saldoDefinido);
    if (facturas === null) return null;
    return armarDeuda(facturas, await this.periodosDe(facturas), ahora);
  }

  /** El periodo solo acompaña al monto: si no se puede leer, la deuda igual se muestra. */
  private async periodosDe(
    facturas: readonly FacturaG8[],
  ): Promise<Map<number, string>> {
    const ids = facturas.map((f) => f.idFactura);
    if (!ids.length) return new Map();
    try {
      const filas = await this.prisma.factura.findMany({
        where: { id_factura: { in: ids } },
        select: { id_factura: true, periodo_mes: true, periodo_anio: true },
      });
      return new Map(
        filas.map((f) => [
          f.id_factura,
          formatPeriodo(f.periodo_mes, f.periodo_anio),
        ]),
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo leer el periodo de las facturas: ${error instanceof Error ? error.message : 'error desconocido'}`,
      );
      return new Map();
    }
  }

  /**
   * Las facturas del cliente tal como las entrega G8, con su saldo y su
   * vencimiento efectivo. El recordatorio (CU-67) y el aviso de corte (CU-68)
   * deciden con esto y no con la base (ratificación de G8 del 02-10, §4).
   * `null` si G8 todavía no está o no pudo responder.
   */
  async facturasDe(
    cuenta: Cuenta,
    saldoDefinido = SALDO_CLIENTE_DEFINIDO,
  ): Promise<FacturaG8[] | null> {
    if (!saldoDefinido) return null;

    try {
      // §2 de G8: toda consulta va dentro de la empresa del cliente.
      const cliente = await this.prisma.cliente.findUnique({
        where: { id_cliente: cuenta.idCliente },
        select: { id_empresa: true },
      });
      const idEmpresa = cliente?.id_empresa;
      if (!idEmpresa) {
        this.logger.warn(
          `El cliente ${cuenta.idCliente} no tiene empresa: no se le pueden pedir sus facturas a G8`,
        );
        return null;
      }

      return await this.g8.facturas({ idEmpresa, idCliente: cuenta.idCliente });
    } catch (error) {
      this.logger.warn(
        `No se pudieron obtener las facturas del cliente ${cuenta.idCliente} desde G8: ${error instanceof Error ? error.message : 'error desconocido'}`,
      );
      return null;
    }
  }
}
