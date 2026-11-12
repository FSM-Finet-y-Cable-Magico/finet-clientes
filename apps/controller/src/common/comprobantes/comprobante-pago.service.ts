import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { nombreMedioPago } from '../../pagos/pagos.constantes.js';
import { formatPeriodo } from '../utils/periodo.js';
import { urlDelSitio } from '../constants/empresas.js';
import { COMPROBANTE_EN_PAGO } from '../pendientes.js';
import {
  generarComprobantePdf,
  contenidoComprobante,
  type DatosComprobante,
} from './comprobante-pago.pdf.js';

/** El comprobante listo para descargar o adjuntar. */
export type ArchivoComprobante = {
  readonly archivo: Buffer;
  readonly nombreArchivo: string;
};

/**
 * Los pagos de un cliente: los suyos por `id_cliente` o por la factura de un
 * contrato suyo, porque `pago.id_cliente` puede venir vacío. Lo usan la lista
 * de pagos anteriores y la descarga de su comprobante (CU-52).
 */
export function pagosDelCliente(idCliente: number): Prisma.pagoWhereInput {
  return {
    OR: [
      { id_cliente: idCliente },
      { factura: { contrato: { id_cliente: idCliente } } },
    ],
  };
}

/** Lo que el comprobante necesita de `pago` (se lee directo, acuerdo v2.0 §5). */
const SELECT_PAGO = {
  id_pago: true,
  fecha_pago: true,
  monto: true,
  pasarela: true,
  codigo_transaccion: true,
  codigo_autorizacion: true,
  factura: { select: { periodo_mes: true, periodo_anio: true } },
} satisfies Prisma.pagoSelect;

const SELECT_CLIENTE = {
  nombre_completo: true,
  rut: true,
  id_empresa: true,
} satisfies Prisma.clienteSelect;

type PagoLeido = Prisma.pagoGetPayload<{ select: typeof SELECT_PAGO }>;
type ClienteLeido = Prisma.clienteGetPayload<{
  select: typeof SELECT_CLIENTE;
}>;

/**
 * CU-52 / RF-38: el comprobante de un pago en PDF, con la marca de la empresa
 * del cliente. Se genera cada vez desde `pago`, que no cambia: el portal solo
 * puede leer esa tabla, y no hay almacenamiento en la nube (RNF-38.2 queda
 * pendiente).
 */
@Injectable()
export class ComprobantePagoService {
  private readonly logger = new Logger(ComprobantePagoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * La descarga desde el portal. Un pago de otro cliente responde 404, igual
   * que uno que no existe: no se confirma su existencia.
   */
  async delCliente(
    idCliente: number,
    idPago: number,
  ): Promise<ArchivoComprobante> {
    const pago = await this.prisma.pago.findFirst({
      where: { id_pago: idPago, ...pagosDelCliente(idCliente) },
      select: SELECT_PAGO,
    });
    if (!pago) throw new NotFoundException('No encontramos ese pago');

    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente: idCliente },
      select: SELECT_CLIENTE,
    });

    const archivo = await this.generar(pago, cliente);
    if (!archivo) {
      throw new ServiceUnavailableException(
        'El comprobante de este pago no está disponible en este momento. Intenta más tarde.',
      );
    }
    return archivo;
  }

  /**
   * El adjunto del correo de confirmación (CU-53 dentro del CU-69), con el
   * cliente del pago. `null` si no se pudo: el correo sale igual, sin él.
   */
  async delPago(idPago: number): Promise<ArchivoComprobante | null> {
    const pago = await this.prisma.pago.findFirst({
      where: { id_pago: idPago },
      select: { ...SELECT_PAGO, cliente: { select: SELECT_CLIENTE } },
    });
    if (!pago) {
      this.logger.warn(`[CU-52] el pago ${idPago} no está en la base`);
      return null;
    }
    return this.generar(pago, pago.cliente);
  }

  /**
   * Excepción 1 del CU-52: sin los datos esenciales no se genera y se registra
   * la incidencia. Excepción 2: si falla el PDF, se informa y queda pendiente.
   */
  private async generar(
    pago: PagoLeido,
    cliente: ClienteLeido | null,
  ): Promise<ArchivoComprobante | null> {
    const monto = Number(pago.monto);
    if (!cliente || !(monto > 0)) {
      this.logger.warn(
        `[CU-52] el pago ${pago.id_pago} no tiene los datos del comprobante (cliente o monto)`,
      );
      return null;
    }

    const datos: DatosComprobante = {
      idEmpresa: cliente.id_empresa,
      cliente: { nombre: cliente.nombre_completo, rut: cliente.rut },
      pago: {
        idPago: pago.id_pago,
        fecha: pago.fecha_pago,
        monto,
        medio: nombreMedioPago(pago.pasarela),
        periodo: pago.factura
          ? formatPeriodo(pago.factura.periodo_mes, pago.factura.periodo_anio)
          : null,
        ordenCompra: pago.codigo_transaccion,
        codigoAutorizacion: pago.codigo_autorizacion,
      },
      generado: new Date(),
    };

    let archivo: Buffer;
    try {
      archivo = await this.pdf(datos);
    } catch (error) {
      this.logger.error(
        `[CU-52] no se pudo generar el comprobante del pago ${pago.id_pago}: ${mensaje(error)}`,
      );
      return null;
    }

    await this.marcarEnPago(pago.id_pago, cliente.id_empresa);
    return {
      archivo,
      nombreArchivo: contenidoComprobante(datos).nombreArchivo,
    };
  }

  /**
   * Con el permiso de G8, el pago queda con la URL de su comprobante y en
   * GENERADO. Solo esas dos columnas de `pago` (Emilio, 12-11), y solo si nadie
   * lo había marcado: nunca pisa lo que ponga G8. Si la base lo rechaza, se
   * registra y el comprobante se entrega igual.
   */
  private async marcarEnPago(
    idPago: number,
    idEmpresa: number | null,
  ): Promise<void> {
    if (!this.marcaEnPago()) return;
    try {
      await this.prisma.pago.updateMany({
        where: {
          id_pago: idPago,
          comprobante_estado: 'PENDIENTE',
          comprobante_pdf_url: null,
        },
        data: {
          comprobante_pdf_url: urlDelSitio(
            idEmpresa,
            `/api/portal/pagos/${idPago}/comprobante`,
            this.config.getOrThrow<string>('FRONTEND_URL'),
          ),
          comprobante_estado: 'GENERADO',
        },
      });
    } catch (error) {
      this.logger.warn(
        `[CU-52] no se pudo marcar el comprobante del pago ${idPago} en pago: ${mensaje(error)}`,
      );
    }
  }

  /** El interruptor de G8, aparte para poder probar los dos casos. */
  protected marcaEnPago(): boolean {
    return COMPROBANTE_EN_PAGO;
  }

  /** El dibujo, aparte para poder simular su falla en los tests. */
  protected pdf(datos: DatosComprobante): Promise<Buffer> {
    return generarComprobantePdf(datos);
  }
}

function mensaje(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
