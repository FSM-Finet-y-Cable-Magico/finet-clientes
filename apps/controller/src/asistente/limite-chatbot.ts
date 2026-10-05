import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { esClaveDelChatbot } from './guards/chatbot-api-key.guard.js';

/** Peticiones por minuto y por IP: el limite global de siempre. */
export const LIMITE_POR_MINUTO = 10;

/**
 * Peticiones por minuto para finet-chatbot. Consulta por todos los clientes
 * del chat desde una sola IP (CU-64 usa la consulta publica de deuda), asi
 * que con el limite comun 10 consultas por minuto alcanzarian para todos.
 * Alto, pero no infinito: si la clave se filtra, sigue habiendo un tope.
 */
export const LIMITE_CHATBOT_POR_MINUTO = 600;

/**
 * Limite global del ThrottlerModule. Se decide por peticion: con la clave
 * del chatbot en `X-API-Key` (la misma `ASISTENTE_API_KEY` de su guard) toca
 * el limite alto. Las rutas con `@Throttle` propio, como
 * `/asistente/mensajes`, siguen con el suyo.
 */
export function limitePorMinuto(config: ConfigService) {
  return (context: ExecutionContext): number => {
    const recibida = context.switchToHttp().getRequest<Request>().headers[
      'x-api-key'
    ];
    const esperada = config.get<string>('ASISTENTE_API_KEY')?.trim();

    return esClaveDelChatbot(recibida, esperada)
      ? LIMITE_CHATBOT_POR_MINUTO
      : LIMITE_POR_MINUTO;
  };
}
