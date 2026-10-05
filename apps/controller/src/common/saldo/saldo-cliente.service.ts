import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  G8IntegracionService,
  type FacturaG8,
} from '../g8/g8-integracion.service.js';
import { SALDO_CLIENTE_DEFINIDO } from '../pendientes.js';

/** A quién se le cobra: por código de abonado, solo ese contrato. */
export type Cuenta = { idCliente: number; idContrato: number | null };

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
 * Lo usan el pago (CU-42, CU-43: el total a cobrar) y el aviso de corte (CU-68:
 * el monto que se informa). Con `idContrato`, el saldo de ese contrato (pago por
 * código de abonado); sin él, el de todos los contratos del cliente.
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
    return facturas === null
      ? null
      : facturas.reduce((total, f) => total + f.saldoExigible, 0);
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

      return await this.g8.facturas(
        cuenta.idContrato === null
          ? { idEmpresa, idCliente: cuenta.idCliente }
          : { idEmpresa, idContrato: cuenta.idContrato },
      );
    } catch (error) {
      this.logger.warn(
        `No se pudieron obtener las facturas del cliente ${cuenta.idCliente} desde G8: ${error instanceof Error ? error.message : 'error desconocido'}`,
      );
      return null;
    }
  }
}
