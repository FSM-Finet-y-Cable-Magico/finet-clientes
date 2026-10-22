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

export const IniciarPagoDto = z
  .object({ ...identificadorShape, medio: z.enum(IDS_MEDIOS_PAGO) })
  .refine(unoSolo, { message: MENSAJE_UNO_SOLO });
export type IniciarPagoDto = z.infer<typeof IniciarPagoDto>;

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
  medios: MedioPagoDto[];
}
