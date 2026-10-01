import { z } from 'zod';
import { validateRut } from '../../common/utils/rut.js';

/**
 * Largo maximo de un mensaje del visitante. Cada mensaje se cobra en tokens
 * del motor, asi que se corta aca y no recien en finet-chatbot (que acepta
 * hasta 4096 porque tambien recibe mensajes de Chatwoot).
 */
export const MAX_LARGO_MENSAJE = 1000;

// CU-65: un turno del visitante en el widget del asistente virtual
export const MensajeAsistenteDto = z.object({
  /**
   * Sesion anonima que genera el widget en el navegador. Es la conversacion:
   * el chatbot guarda el historial bajo este id, por eso tiene que ser
   * inadivinable (UUID) y no un correlativo.
   */
  id_sesion: z.uuid('Sesion invalida'),
  mensaje: z
    .string()
    .trim()
    .min(1, 'El mensaje es requerido')
    .max(
      MAX_LARGO_MENSAJE,
      `El mensaje no puede superar ${MAX_LARGO_MENSAJE} caracteres`,
    ),
});
export type MensajeAsistenteDto = z.infer<typeof MensajeAsistenteDto>;

export interface RespuestaAsistenteDto {
  respuesta: string;
}

// CU-63: RUT que finet-chatbot pide verificar al inicio de una conversacion
export const IdentificarClienteDto = z.object({
  rut: z
    .string()
    .min(1, 'El RUT es requerido')
    .max(12)
    .refine((val) => validateRut(val), { message: 'RUT invalido' }),
});
export type IdentificarClienteDto = z.infer<typeof IdentificarClienteDto>;

/**
 * Lo que el asistente sabe del cliente una vez verificado. Solo nombre y
 * planes: esto viaja al proveedor del motor LLM, asi que no se manda RUT,
 * correo, telefono, direccion ni deuda (la deuda es CU-64).
 */
export interface ClienteIdentificadoDto {
  encontrado: boolean;
  cliente: {
    nombre_completo: string;
    planes: PlanClienteAsistenteDto[];
  } | null;
}

export interface PlanClienteAsistenteDto {
  nombre_comercial: string;
  tipo_plan: string;
  velocidad_mbps: number | null;
  estado_contrato: string;
}
