import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { nombreMedioPago } from '../../pagos/pagos.constantes.js';
import { formatPeriodo } from '../utils/periodo.js';
import { COMPROBANTE_EN_PAGO } from '../pendientes.js';
import {
  PREFIJO_PDF_GUARDADO,
  TOPE_PDF_BYTES,
} from './comprobante-pago.constantes.js';
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
  comprobante_pdf_url: true,
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
 * del cliente. Se genera la primera vez y, con el permiso de G8, queda guardado
 * en `pago.comprobante_pdf_url` (el PDF entero); desde ahí se entrega siempre
 * el mismo. Mientras no haya permiso, se genera cada vez desde `pago`.
 */
@Injectable()
export class ComprobantePagoService {
  private readonly logger = new Logger(ComprobantePagoService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    const { nombreArchivo } = contenidoComprobante(datos);

    // El que ya está guardado en pago es el comprobante: el mismo cada vez.
    const guardado = pdfGuardado(pago.comprobante_pdf_url);
    if (guardado) return { archivo: guardado, nombreArchivo };

    let archivo: Buffer;
    try {
      archivo = await this.pdf(datos);
    } catch (error) {
      this.logger.error(
        `[CU-52] no se pudo generar el comprobante del pago ${pago.id_pago}: ${mensaje(error)}`,
      );
      return null;
    }

    await this.guardarEnPago(pago.id_pago, archivo);
    return { archivo, nombreArchivo };
  }

  /**
   * Con el permiso de G8, el PDF queda guardado en `pago.comprobante_pdf_url`
   * y el pago en GENERADO. Solo esas dos columnas (Emilio, 12-11), y solo si
   * nadie lo había guardado: nunca pisa lo que ponga G8. Si la base lo
   * rechaza, se registra y el comprobante se entrega igual.
   */
  private async guardarEnPago(idPago: number, archivo: Buffer): Promise<void> {
    if (!this.marcaEnPago()) return;
    try {
      await this.prisma.pago.updateMany({
        where: {
          id_pago: idPago,
          comprobante_estado: 'PENDIENTE',
          comprobante_pdf_url: null,
        },
        data: {
          comprobante_pdf_url: `${PREFIJO_PDF_GUARDADO}${archivo.toString('base64')}`,
          comprobante_estado: 'GENERADO',
        },
      });
    } catch (error) {
      this.logger.warn(
        `[CU-52] no se pudo guardar el comprobante del pago ${idPago} en pago: ${mensaje(error)}`,
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

/**
 * El PDF guardado en `pago.comprobante_pdf_url`, si es uno de verdad. Otra URL
 * no se sigue (sería pedirle al servidor que descargue lo que alguien escribió
 * en la base) y otro tipo de archivo no se entrega: en esos casos, `null`, y el
 * comprobante se rehace.
 */
function pdfGuardado(valor: string | null | undefined): Buffer | null {
  if (!valor?.startsWith(PREFIJO_PDF_GUARDADO)) return null;
  const base64 = valor.slice(PREFIJO_PDF_GUARDADO.length);
  // Cuatro caracteres de base64 son tres bytes: se descarta antes de decodificar.
  if ((base64.length * 3) / 4 > TOPE_PDF_BYTES) return null;
  const archivo = Buffer.from(base64, 'base64');
  const esPdf = archivo.subarray(0, 5).toString('latin1') === '%PDF-';
  return esPdf && archivo.length <= TOPE_PDF_BYTES ? archivo : null;
}
