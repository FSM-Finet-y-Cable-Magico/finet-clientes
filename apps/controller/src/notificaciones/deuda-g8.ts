import type { PrismaService } from '../prisma/prisma.service.js';
import type { FacturaG8 } from '../common/g8/g8-integracion.service.js';
import { ESTADOS_IMPAGOS } from './recordatorio-pago.constantes.js';

/**
 * Lo que el recordatorio (CU-67) y el aviso de corte (CU-68) hacen igual para
 * decidir con los datos de G8.
 *
 * G8 los dejó en nuestro lado "siempre que las decisiones financieras se basen
 * en datos entregados por G8 y no en un cálculo paralelo de saldo o
 * vencimiento" (su ratificación del 02-10, §2 y §4). Por eso la base solo dice
 * **a quién preguntarle**; si se avisa, cuánto y con qué fecha lo dice G8.
 */

export type ClienteConDeuda = {
  idCliente: number;
  nombre: string;
  email: string | null;
};

/**
 * Los clientes con alguna factura impaga, uno por cliente: los únicos a los que
 * vale la pena preguntarle a G8. Lectura directa de `factura`, que el §5 del
 * acuerdo v2.0 permite. Una factura sin cliente no se puede consultar y queda
 * fuera.
 */
export async function clientesConFacturasImpagas(
  prisma: PrismaService,
): Promise<ClienteConDeuda[]> {
  const facturas = await prisma.factura.findMany({
    where: { estado: { in: ESTADOS_IMPAGOS } },
    select: {
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

  const porCliente = new Map<number, ClienteConDeuda>();
  for (const f of facturas) {
    const cliente = f.contrato?.cliente;
    if (!cliente || porCliente.has(cliente.id_cliente)) continue;
    porCliente.set(cliente.id_cliente, {
      idCliente: cliente.id_cliente,
      nombre: cliente.nombre_completo ?? '',
      email: cliente.email ?? null,
    });
  }
  return [...porCliente.values()];
}

/**
 * Las facturas que, según G8, vencen el `dia` (`YYYY-MM-DD`), todavía tienen
 * algo que cobrar y aceptan pagos. Una factura sin vencimiento efectivo o sin
 * `aceptaPagos` no cuenta: no se adivina.
 */
export function facturasQueVencenEl(
  facturas: FacturaG8[],
  dia: string,
): FacturaG8[] {
  return facturas.filter(
    (f) =>
      f.fechaVencimientoEfectiva === dia &&
      f.saldoExigible > 0 &&
      f.aceptaPagos === true,
  );
}

/** El día de una fecha a medianoche UTC, en el formato de G8 (`YYYY-MM-DD`). */
export function diaG8(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}
