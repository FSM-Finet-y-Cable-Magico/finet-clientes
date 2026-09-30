import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EnlacePagoService } from '../common/enlaces/enlace-pago.service.js';
import { PASARELA_ACTIVA } from '../common/pendientes.js';
import { cleanRut, formatRut } from '../common/utils/rut.js';
import {
  SaldoClienteService,
  type Cuenta,
} from '../common/saldo/saldo-cliente.service.js';
import { MEDIOS_PAGO, type MedioPago } from './pagos.constantes.js';
import type {
  IdentificadorPagoDto,
  MedioPagoDto,
  ResumenPagoDto,
} from './dto/pagos.dto.js';

type Pagador = Cuenta & { nombre: string; rut: string | null };

/**
 * CU-42 / CU-43: pagar la deuda con Webpay o con Mercado Pago.
 *
 * Se paga **el total**, sin abonos parciales: todo lo del RUT, o todo lo del
 * código de abonado. Ese total no lo calculamos nosotros: lo da G8
 * (`SaldoClienteService`).
 *
 * **Qué falta** (ver `common/pendientes.ts`):
 * - el saldo de G8: sin él no hay "deuda pendiente identificada", que es la
 *   precondición de los dos CU;
 * - la pasarela: sin ella, elegir un medio cae en la Excepción 1 de cada CU.
 *
 * Cómo se va y se vuelve de la pasarela depende de cuál se elija, así que esa
 * parte se construye junto con ella.
 */
@Injectable()
export class PagosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enlaces: EnlacePagoService,
    private readonly saldos: SaldoClienteService,
  ) {}

  /** "El cliente accede al resumen de su deuda" (CU-43). */
  async resumen(id: IdentificadorPagoDto): Promise<ResumenPagoDto> {
    const pagador = await this.identificar(id);
    if (!pagador) {
      return { encontrado: false, cliente: null, saldo: null, medios: [] };
    }

    return {
      encontrado: true,
      cliente: {
        nombre: pagador.nombre,
        rut: pagador.rut === null ? null : enmascararRut(pagador.rut),
        codigo_abonado: pagador.idContrato,
      },
      saldo: await this.saldos.saldoDe(pagador),
      medios: this.medios(),
    };
  }

  /**
   * "El cliente selecciona Webpay / Mercado Pago como medio de pago
   * [Excepción 1]". El total se vuelve a pedir acá y no se recibe del
   * navegador: lo que se cobra es lo que dice G8, no lo que llegue en el body.
   */
  async iniciar(id: IdentificadorPagoDto, medio: MedioPago): Promise<never> {
    const pagador = await this.identificar(id);
    if (!pagador) {
      throw new NotFoundException('No encontramos una cuenta con esos datos');
    }

    // Precondición de los dos CU: "una deuda pendiente identificada".
    const saldo = await this.saldos.saldoDe(pagador);
    if (saldo === null) {
      throw new ServiceUnavailableException(
        'No pudimos obtener tu deuda en este momento. Intenta más tarde.',
      );
    }
    if (saldo <= 0) {
      throw new ConflictException('No tienes deuda pendiente.');
    }

    // Excepción 1 del CU-42 y del CU-43: la pasarela no está disponible.
    const elegido = MEDIOS_PAGO.find((m) => m.id === medio)!;
    throw new ServiceUnavailableException(elegido.noDisponible);
  }

  private medios(): MedioPagoDto[] {
    return MEDIOS_PAGO.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      descripcion: m.descripcion,
      disponible: PASARELA_ACTIVA,
    }));
  }

  private async identificar(id: IdentificadorPagoDto): Promise<Pagador | null> {
    if (id.abonado !== undefined) {
      const contrato = await this.prisma.contrato.findUnique({
        where: { id_contrato: Number(id.abonado) },
        select: {
          id_contrato: true,
          cliente: {
            select: { id_cliente: true, nombre_completo: true, rut: true },
          },
        },
      });
      if (!contrato?.cliente) return null;
      return {
        idCliente: contrato.cliente.id_cliente,
        idContrato: contrato.id_contrato,
        nombre: contrato.cliente.nombre_completo,
        rut: contrato.cliente.rut,
      };
    }

    const cliente =
      id.t !== undefined
        ? await this.clientePorEnlace(id.t)
        : await this.prisma.cliente.findUnique({
            where: { rut: cleanRut(id.rut!) },
            select: { id_cliente: true, nombre_completo: true, rut: true },
          });
    if (!cliente) return null;
    return {
      idCliente: cliente.id_cliente,
      idContrato: null,
      nombre: cliente.nombre_completo,
      rut: cliente.rut,
    };
  }

  /** Un enlace alterado o vencido se trata igual que una cuenta que no existe. */
  private async clientePorEnlace(token: string) {
    const idCliente = this.enlaces.verificarEnlacePago(token);
    if (idCliente === null) return null;
    return this.prisma.cliente.findUnique({
      where: { id_cliente: idCliente },
      select: { id_cliente: true, nombre_completo: true, rut: true },
    });
  }
}

/** `123456785` → `XX.XXX.678-5`: lo justo para que el cliente reconozca su cuenta. */
export function enmascararRut(rut: string): string {
  const [cuerpo, dv] = formatRut(rut).split('-');
  const visibles = cuerpo.slice(-3);
  const ocultos = cuerpo.slice(0, -3).replace(/\d/g, 'X');
  const conPuntos = `${ocultos}${visibles}`.replace(/\B(?=(.{3})+$)/g, '.');
  return `${conPuntos}-${dv}`;
}
