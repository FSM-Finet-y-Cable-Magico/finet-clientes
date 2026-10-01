import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  MensajeAsistenteDto,
  RespuestaAsistenteDto,
} from './dto/asistente.dto.js';

/**
 * Lo que puede tardar el chatbot. El motor tiene 30 s por intento y hasta 2
 * reintentos (ver `OPENAI_TIMEOUT_MS` y `OPENAI_MAX_RETRIES` en finet-chatbot);
 * pasado este plazo el visitante ve el error en vez de quedar esperando.
 */
const TIMEOUT_MS = 60_000;

const NO_DISPONIBLE = 'El asistente no esta disponible en este momento';

type RespuestaChatbot = {
  content?: unknown;
};

/**
 * CU-65: reenvia el mensaje del visitante a finet-chatbot y devuelve su
 * respuesta.
 *
 * El navegador no habla directo con el chatbot: ese servicio se protege con
 * una API key que no puede viajar al cliente, y el rate limit por IP tiene que
 * vivir aca, junto a los visitantes que limita, porque cada mensaje gasta
 * tokens del motor.
 *
 * El historial de la conversacion lo guarda el chatbot (en memoria) bajo
 * `id_sesion`; aca no se persiste nada todavia. Las tablas `conversacion_bot`
 * y `mensaje_bot` quedan para CU-79 (auditoria de sesiones).
 */
@Injectable()
export class AsistenteService {
  private readonly logger = new Logger(AsistenteService.name);

  // Se lee por ConfigService y no con `process.env` a nivel de modulo: las
  // constantes de modulo se evaluan antes de que Nest cargue el ConfigModule.
  constructor(private readonly configService: ConfigService) {}

  async responder(dto: MensajeAsistenteDto): Promise<RespuestaAsistenteDto> {
    const baseUrl = this.configService.get<string>('CHATBOT_URL')?.trim();
    const apiKey = this.configService.get<string>('CHATBOT_API_KEY')?.trim();

    if (!baseUrl || !apiKey) {
      this.logger.error('CHATBOT_URL o CHATBOT_API_KEY no estan configurados');
      throw new ServiceUnavailableException(NO_DISPONIBLE);
    }

    let data: RespuestaChatbot;
    try {
      const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/web/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
        },
        body: JSON.stringify({
          sessionId: dto.id_sesion,
          content: dto.mensaje,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(`finet-chatbot respondio ${res.status}`);
      }
      data = (await res.json()) as RespuestaChatbot;
    } catch (error) {
      this.logger.error(
        `No se pudo consultar al chatbot: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(NO_DISPONIBLE);
    }

    if (typeof data.content !== 'string' || data.content.trim() === '') {
      this.logger.error('El chatbot respondio sin contenido');
      throw new ServiceUnavailableException(NO_DISPONIBLE);
    }

    return { respuesta: data.content };
  }
}
