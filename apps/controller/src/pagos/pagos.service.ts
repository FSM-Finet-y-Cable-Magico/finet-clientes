import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  EnlacePagoService,
  type SesionPago,
} from '../common/enlaces/enlace-pago.service.js';
import {
  PASARELA_ACTIVA,
  REGISTRO_PAGO_DEFINIDO,
} from '../common/pendientes.js';
import { formatRut, variantesRut } from '../common/utils/rut.js';
import {
  SaldoClienteService,
  sumarSaldo,
  type Cuenta,
} from '../common/saldo/saldo-cliente.service.js';
import {
  ErrorIntegracionG8,
  G8IntegracionService,
  type FacturaG8,
  type PagoG8,
} from '../common/g8/g8-integracion.service.js';
import { ConfirmacionPagoService } from '../notificaciones/confirmacion-pago.service.js';
import {
  MEDIOS_PAGO,
  PASARELA_G8,
  type MedioPago,
  type ResultadoPago,
} from './pagos.constantes.js';
import { WebpayService, type TransaccionWebpay } from './webpay.service.js';
import {
  RetornoWebpayDto,
  type FacturaPagableDto,
  type IdentificadorPagoDto,
  type InicioPagoDto,
  type MedioPagoDto,
  type ResultadoWebpayRespuestaDto,
  type ResumenPagoDto,
} from './dto/pagos.dto.js';
import { urlDelSitio } from '../common/constants/empresas.js';

type Pagador = Cuenta & {
  nombre: string;
  rut: string | null;
  idEmpresa: number | null;
};

/** Los interruptores de `common/pendientes.ts` que deciden si se puede cobrar. */
export type Interruptores = { pasarela: boolean; registro: boolean };

const INTERRUPTORES: Interruptores = {
  pasarela: PASARELA_ACTIVA,
  registro: REGISTRO_PAGO_DEFINIDO,
};

/**
 * CU-42: pagar una factura con Webpay Plus.
 *
 * Se paga una factura entera, la que el cliente elige (diagrama de G8 del 29-10):
 * se cobra su `saldoExigible`, que da G8 (`SaldoClienteService`), sin abonos.
 *
 * Al volver de Webpay se confirma la transacción y se le manda el pago a G8, que
 * lo registra (CU-44 y CU-45 son suyos). Recién entonces sale la confirmación al
 * cliente (CU-69).
 *
 * No hay tabla de pagos pendientes: a quién y qué factura se cobra viaja firmado
 * en el `session_id` de Webpay (`EnlacePagoService`).
 */
@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly enlaces: EnlacePagoService,
    private readonly saldos: SaldoClienteService,
    private readonly g8: G8IntegracionService,
    private readonly webpay: WebpayService,
    private readonly confirmacion: ConfirmacionPagoService,
  ) {}

  /** La cuenta, su saldo y las facturas que G8 deja pagar. */
  async resumen(
    id: IdentificadorPagoDto,
    interruptores = INTERRUPTORES,
  ): Promise<ResumenPagoDto> {
    const pagador = await this.identificar(id);
    if (!pagador) {
      return {
        encontrado: false,
        cliente: null,
        saldo: null,
        facturas: null,
        medios: [],
      };
    }

    const facturas = await this.saldos.facturasDe(pagador);
    return {
      encontrado: true,
      cliente: {
        nombre: pagador.nombre,
        rut: pagador.rut === null ? null : enmascararRut(pagador.rut),
      },
      saldo: facturas === null ? null : sumarSaldo(facturas),
      facturas:
        facturas === null ? null : facturas.filter(sePuedePagar).map(pagable),
      medios: this.medios(interruptores),
    };
  }

  /**
   * "El cliente selecciona Webpay como pasarela de pago [Excepción 1], el
   * sistema prepara la transacción y la envía a Webpay". El monto se vuelve a
   * pedir a G8 y no se recibe del navegador.
   */
  async iniciar(
    id: IdentificadorPagoDto,
    idFactura: number,
    medio: MedioPago,
    interruptores = INTERRUPTORES,
  ): Promise<InicioPagoDto> {
    const pagador = await this.identificar(id);
    if (!pagador) {
      throw new NotFoundException('No encontramos una cuenta con esos datos');
    }

    // Precondición: "una deuda pendiente identificada". La da G8, por factura.
    const facturas = await this.saldos.facturasDe(pagador);
    if (facturas === null) {
      throw new ServiceUnavailableException(
        'No pudimos obtener tu deuda en este momento. Intenta más tarde.',
      );
    }
    const factura = facturas.find((f) => f.idFactura === idFactura);
    if (!factura || !sePuedePagar(factura)) {
      throw new ConflictException(
        'Esa factura no tiene un saldo que se pueda pagar en línea.',
      );
    }

    // Excepción 1: la pasarela no está disponible. Si G8 no puede registrar el
    // pago, tampoco se cobra.
    const elegido = MEDIOS_PAGO.find((m) => m.id === medio)!;
    if (!this.disponible(interruptores) || pagador.idEmpresa === null) {
      throw new ServiceUnavailableException(elegido.noDisponible);
    }

    try {
      const sesion = this.enlaces.firmarSesionPago({
        idEmpresa: pagador.idEmpresa,
        idCliente: pagador.idCliente,
        idFactura,
      });
      return await this.webpay.crear(
        ordenDeCompra(idFactura),
        sesion,
        factura.saldoExigible,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo iniciar el pago de la factura ${idFactura} en Webpay: ${mensaje(error)}`,
      );
      throw new ServiceUnavailableException(elegido.noDisponible);
    }
  }

  /**
   * "El sistema recibe el resultado de la transacción desde el proveedor y
   * continúa con el proceso de registro [Excepción 3]". Devuelve adónde mandar
   * al cliente: la pantalla de resultado de la vista.
   */
  async retorno(
    datos: unknown,
    interruptores = INTERRUPTORES,
  ): Promise<string> {
    const leidos = RetornoWebpayDto.safeParse(datos);
    if (!leidos.success) return this.urlResultado('error');
    const {
      token_ws: token,
      TBK_TOKEN: tokenAnulado,
      TBK_ORDEN_COMPRA: orden,
      TBK_ID_SESION: sesionAnulada,
    } = leidos.data;

    // Excepción 2: el cliente anuló, se le acabó el tiempo o falló el
    // formulario. No hay nada que confirmar.
    if (tokenAnulado || !token) {
      if (!tokenAnulado && !orden && !sesionAnulada) {
        return this.urlResultado('error');
      }
      const motivo = !tokenAnulado
        ? 'tiempo_agotado'
        : token
          ? 'error_formulario'
          : 'anulado';
      const anulada = await this.noCompletado(
        orden ?? null,
        sesionAnulada ?? null,
        motivo,
      );
      return this.urlResultado('cancelado', undefined, anulada?.idEmpresa);
    }

    const tx = await this.transaccionDe(token);
    if (!tx) return this.urlResultado('error');
    const sesion = this.sesionDe(tx.sesion);
    if (!sesion) {
      this.logger.warn(
        `Webpay devolvió la orden ${tx.ordenCompra} con una sesión que no firmó el portal`,
      );
      return this.urlResultado('error');
    }

    const resultado = resultadoDe(tx);
    if (resultado !== 'aprobado') {
      return this.urlResultado(resultado, token, sesion.idEmpresa);
    }
    return this.urlResultado(
      await this.registrar(tx, sesion, token, interruptores.registro),
      token,
      sesion.idEmpresa,
    );
  }

  /**
   * Para la pantalla de resultado: el estado lo dice Transbank, no el
   * navegador, y la sesión tiene que ser una que firmó el portal.
   */
  async resultado(token: string): Promise<ResultadoWebpayRespuestaDto> {
    let tx: TransaccionWebpay;
    try {
      tx = await this.webpay.estado(token);
    } catch (error) {
      this.logger.warn(
        `No se pudo consultar un pago en Webpay: ${mensaje(error)}`,
      );
      throw new ServiceUnavailableException(
        'No pudimos consultar el resultado de tu pago. Intenta más tarde.',
      );
    }
    const sesion = this.sesionDe(tx.sesion);
    if (!sesion) throw new NotFoundException('No encontramos ese pago');

    const estado = resultadoDe(tx);
    return {
      estado,
      monto: tx.monto,
      fecha: tx.fecha,
      codigo_autorizacion: estado === 'aprobado' ? tx.codigoAutorizacion : null,
      orden: tx.ordenCompra,
      id_factura: sesion.idFactura,
    };
  }

  /**
   * Webpay aprobó: el pago se le manda a G8. Si lo registra por primera vez,
   * sale la confirmación del CU-69.
   */
  private async registrar(
    tx: TransaccionWebpay,
    sesion: SesionPago,
    token: string,
    registroDefinido: boolean,
  ): Promise<ResultadoPago> {
    const pago: PagoG8 = {
      requestId: idPedidoPago(tx.ordenCompra),
      idEmpresa: sesion.idEmpresa,
      idFactura: sesion.idFactura,
      monto: tx.monto,
      fechaPago: tx.fecha ?? new Date().toISOString(),
      codigoAutorizacion: tx.codigoAutorizacion ?? '',
      codigoTransaccion: tx.ordenCompra,
      pasarela: PASARELA_G8,
    };

    if (!registroDefinido) {
      await this.auditar('PAGO_SIN_REGISTRAR', sesion.idCliente, {
        ...pago,
        token,
        motivo: 'el registro de pagos de G8 no está disponible',
      });
      return 'pendiente';
    }

    try {
      const { duplicado } = await this.g8.registrarPago(pago);
      if (!duplicado) {
        // RNF-51.1: "inmediatamente". No se espera: el CU-69 no lanza, y lo
        // que pase queda en log_notificacion.
        void this.confirmacion.confirmar({
          idCliente: sesion.idCliente,
          monto: pago.monto,
          fecha: new Date(pago.fechaPago),
          codigoAutorizacion: pago.codigoAutorizacion,
        });
      }
      return 'aprobado';
    } catch (error) {
      const status = error instanceof ErrorIntegracionG8 ? error.status : null;
      const rechazadoPorG8 =
        status !== null && status >= 400 && status < 500 && status !== 409;

      if (rechazadoPorG8) {
        // G8 no lo registró (sobrepago, factura cerrada…). Se anula para no
        // cobrar algo que no se aplica a la factura (decisión de Emilio, 29-10).
        const anulado = await this.webpay
          .anular(token, tx.monto)
          .catch(() => false);
        await this.auditar(
          anulado ? 'PAGO_ANULADO' : 'PAGO_SIN_REGISTRAR',
          sesion.idCliente,
          { ...pago, token, status_g8: status, anulado },
        );
        return anulado ? 'anulado' : 'pendiente';
      }

      // Sin respuesta, 5xx o 409: pudo quedar registrado, así que no se anula.
      // Se reenvía con el mismo request_id, que G8 trata como idempotente.
      await this.auditar('PAGO_SIN_REGISTRAR', sesion.idCliente, {
        ...pago,
        token,
        status_g8: status,
        motivo: mensaje(error),
      });
      return 'pendiente';
    }
  }

  /**
   * El commit. Si falla porque ya se hizo (el cliente recargó la página), el
   * estado dice cómo terminó.
   */
  private async transaccionDe(
    token: string,
  ): Promise<TransaccionWebpay | null> {
    try {
      return await this.webpay.confirmar(token);
    } catch (errorCommit) {
      try {
        return await this.webpay.estado(token);
      } catch (error) {
        this.logger.error(
          `No se pudo confirmar ni consultar un pago en Webpay: ${mensaje(errorCommit)} / ${mensaje(error)}`,
        );
        return null;
      }
    }
  }

  /** Excepción 2: "registra el intento como no completado". */
  /** Devuelve la sesión del pago, si es del portal: dice a qué sitio volver. */
  private async noCompletado(
    orden: string | null,
    sesionTexto: string | null,
    motivo: string,
  ): Promise<SesionPago | null> {
    const sesion = sesionTexto ? this.sesionDe(sesionTexto) : null;
    if (!sesion) {
      this.logger.warn(
        `Pago no completado (${motivo}) sin una sesión del portal, orden ${orden ?? 'sin orden'}`,
      );
      return null;
    }
    await this.auditar('PAGO_NO_COMPLETADO', sesion.idCliente, {
      orden,
      id_factura: sesion.idFactura,
      motivo,
    });
    return sesion;
  }

  private sesionDe(texto: string): SesionPago | null {
    try {
      return this.enlaces.verificarSesionPago(texto);
    } catch (error) {
      this.logger.error(
        `No se pudo verificar la sesión de un pago: ${mensaje(error)}`,
      );
      return null;
    }
  }

  private async auditar(
    accion: string,
    idCliente: number,
    valor: Prisma.InputJsonObject,
  ): Promise<void> {
    try {
      await this.prisma.log_auditoria.create({
        data: {
          accion,
          entidad_afectada: 'cliente',
          id_entidad_afectada: idCliente,
          valor_nuevo: valor,
        },
      });
    } catch {
      this.logger.error(
        `No se pudo registrar ${accion} del cliente ${idCliente}`,
      );
    }
  }

  /** La pantalla de resultado del sitio de la empresa del cliente. */
  private urlResultado(
    resultado: ResultadoPago,
    token?: string,
    idEmpresa?: number | null,
  ): string {
    const url = new URL(
      urlDelSitio(
        idEmpresa,
        '/pagar/resultado',
        this.config.getOrThrow<string>('FRONTEND_URL'),
      ),
    );
    url.searchParams.set('resultado', resultado);
    if (token) url.searchParams.set('token_ws', token);
    return url.toString();
  }

  private disponible(interruptores: Interruptores): boolean {
    return interruptores.pasarela && interruptores.registro;
  }

  private medios(interruptores: Interruptores): MedioPagoDto[] {
    return MEDIOS_PAGO.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      descripcion: m.descripcion,
      disponible: this.disponible(interruptores),
    }));
  }

  private async identificar(id: IdentificadorPagoDto): Promise<Pagador | null> {
    const cliente =
      id.t !== undefined
        ? await this.clientePorEnlace(id.t)
        : await this.prisma.cliente.findFirst({
            where: { rut: { in: variantesRut(id.rut!) } },
            select: SELECCION_PAGADOR,
          });
    if (!cliente) return null;
    return {
      idCliente: cliente.id_cliente,
      nombre: cliente.nombre_completo,
      rut: cliente.rut,
      idEmpresa: cliente.id_empresa,
    };
  }

  /** Un enlace alterado o vencido se trata igual que una cuenta que no existe. */
  private async clientePorEnlace(token: string) {
    const idCliente = this.enlaces.verificarEnlacePago(token);
    if (idCliente === null) return null;
    return this.prisma.cliente.findUnique({
      where: { id_cliente: idCliente },
      select: SELECCION_PAGADOR,
    });
  }
}

const SELECCION_PAGADOR = {
  id_cliente: true,
  id_empresa: true,
  nombre_completo: true,
  rut: true,
} as const;

/** G8 deja pagarla y tiene algo que cobrar (su §2 del 02-10). */
function sePuedePagar(f: FacturaG8): boolean {
  return f.aceptaPagos === true && f.saldoExigible > 0;
}

function pagable(f: FacturaG8): FacturaPagableDto {
  return {
    id_factura: f.idFactura,
    saldo: f.saldoExigible,
    vence: f.fechaVencimientoEfectiva,
  };
}

/** Cómo terminó una transacción, según el estado que da Webpay. */
function resultadoDe(
  tx: TransaccionWebpay,
): 'aprobado' | 'anulado' | 'rechazado' | 'error' {
  if (tx.estado === 'AUTHORIZED') {
    return tx.codigoRespuesta === 0 ? 'aprobado' : 'rechazado';
  }
  if (tx.estado === 'FAILED') return 'rechazado';
  if (['REVERSED', 'NULLIFIED', 'PARTIALLY_NULLIFIED'].includes(tx.estado)) {
    return 'anulado';
  }
  return 'error';
}

/**
 * La orden de compra de Webpay: única, de 26 caracteres como máximo, con el
 * número de factura a la vista. Es también el `codigo_transaccion` para G8.
 */
export function ordenDeCompra(idFactura: number, ahora = Date.now()): string {
  return `F${idFactura}-${ahora.toString(36)}${randomBytes(3).toString('hex')}`;
}

/** Espacio de nombres de los `request_id` de pagos del portal (UUID v5). */
const ESPACIO_PEDIDOS_PAGO = '6f1c2a3e-8b4d-4f5a-9c7e-2d3b4a5c6e7f';

/**
 * El `request_id` para G8, sacado de la orden de compra: el mismo pago da
 * siempre el mismo, así que reintentar o recargar no duplica (su §4).
 */
export function idPedidoPago(ordenCompra: string): string {
  const espacio = Buffer.from(ESPACIO_PEDIDOS_PAGO.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1')
    .update(Buffer.concat([espacio, Buffer.from(ordenCompra, 'utf8')]))
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const h = hash.subarray(0, 16).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function mensaje(error: unknown): string {
  return error instanceof Error ? error.message : 'error desconocido';
}

/** `123456785` → `XX.XXX.678-5`: lo justo para que el cliente reconozca su cuenta. */
export function enmascararRut(rut: string): string {
  const [cuerpo, dv] = formatRut(rut).split('-');
  const visibles = cuerpo.slice(-3);
  const ocultos = cuerpo.slice(0, -3).replace(/\d/g, 'X');
  const conPuntos = `${ocultos}${visibles}`.replace(/\B(?=(.{3})+$)/g, '.');
  return `${conPuntos}-${dv}`;
}
