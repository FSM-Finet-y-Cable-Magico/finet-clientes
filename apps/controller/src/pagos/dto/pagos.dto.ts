import { z } from 'zod';
import { ConsultaDeudaRutDto } from '../../deuda-publica/dto/deuda-publica.dto.js';
import { IDS_MEDIOS_PAGO, type MedioPago } from '../pagos.constantes.js';

/**
 * A quién se le paga: por RUT (CU-39) o por el enlace firmado del aviso de corte
 * o del portal (RNF-50.1). Exactamente uno.
 */
const identificadorShape = {
  rut: ConsultaDeudaRutDto.shape.rut.optional(),
  t: z.string().min(1).max(100).optional(),
};

const unoSolo = (v: { rut?: string; t?: string }) =>
  [v.rut, v.t].filter((x) => x !== undefined).length === 1;

const MENSAJE_UNO_SOLO = 'Indica tu RUT o tu enlace de pago';

export const IdentificadorPagoDto = z
  .object(identificadorShape)
  .refine(unoSolo, { message: MENSAJE_UNO_SOLO });
export type IdentificadorPagoDto = z.infer<typeof IdentificadorPagoDto>;

/**
 * Se paga una factura entera, la que el cliente elige (diagrama de G8 del 29-10
 * y su §4 del 02-10: `id_factura` obligatorio). No hay campo de monto: lo que se
 * cobra es el `saldoExigible` que da G8.
 */
export const IniciarPagoDto = z
  .object({
    ...identificadorShape,
    id_factura: z.number().int().positive(),
    medio: z.enum(IDS_MEDIOS_PAGO),
  })
  .refine(unoSolo, { message: MENSAJE_UNO_SOLO });
export type IniciarPagoDto = z.infer<typeof IniciarPagoDto>;

/** El token de una transacción de Webpay: 64 caracteres. */
const tokenWebpay = z
  .string()
  .max(64)
  .regex(/^[A-Za-z0-9]+$/, 'Token de Webpay inválido');

/**
 * Lo que manda Webpay al volver, por GET o por POST según el caso (su
 * documentación de Webpay Plus):
 * - pago aprobado o rechazado: solo `token_ws`;
 * - el cliente anuló en el formulario: `TBK_TOKEN`, `TBK_ORDEN_COMPRA` y
 *   `TBK_ID_SESION`;
 * - se le acabó el tiempo: solo `TBK_ORDEN_COMPRA` y `TBK_ID_SESION`;
 * - error en el formulario: los cuatro.
 */
export const RetornoWebpayDto = z.object({
  token_ws: tokenWebpay.optional(),
  TBK_TOKEN: tokenWebpay.optional(),
  TBK_ORDEN_COMPRA: z.string().max(26).optional(),
  TBK_ID_SESION: z.string().max(61).optional(),
});
export type RetornoWebpayDto = z.infer<typeof RetornoWebpayDto>;

export const ResultadoWebpayDto = z.object({ token_ws: tokenWebpay });
export type ResultadoWebpayDto = z.infer<typeof ResultadoWebpayDto>;

export interface MedioPagoDto {
  id: MedioPago;
  nombre: string;
  descripcion: string;
  disponible: boolean;
}

export interface ResumenPagoDto {
  encontrado: boolean;
  cliente: {
    nombre: string;
    /** Enmascarado: al que llega por el enlace no se le muestra el RUT entero. */
    rut: string | null;
  } | null;
  /** Lo que deja G8. `null` mientras no se sepa dónde (ver pendientes.ts). */
  saldo: number | null;
  /** Las que G8 deja pagar (`aceptaPagos` y saldo). `null` igual que `saldo`. */
  facturas: FacturaPagableDto[] | null;
  medios: MedioPagoDto[];
}

/** Una factura que se puede pagar, con los datos de G8 (su §2 del 02-10). */
export interface FacturaPagableDto {
  id_factura: number;
  /** El `saldoExigible`: lo que se cobra. */
  saldo: number;
  /** El vencimiento con prórroga (`YYYY-MM-DD`), si G8 lo dio. */
  vence: string | null;
}

/** Para ir a Webpay: su formulario y el token que se le manda por POST. */
export interface InicioPagoDto {
  url: string;
  token: string;
}

/** El resultado de un pago, consultado a Transbank. */
export interface ResultadoWebpayRespuestaDto {
  estado: 'aprobado' | 'anulado' | 'rechazado' | 'error';
  monto: number;
  /** Fecha y hora de la autorización (ISO 8601). */
  fecha: string | null;
  /** Solo si fue aprobado. */
  codigo_autorizacion: string | null;
  orden: string;
  id_factura: number;
}
