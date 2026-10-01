import { z } from 'zod';

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
