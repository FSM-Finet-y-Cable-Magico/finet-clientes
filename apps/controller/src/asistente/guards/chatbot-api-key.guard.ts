import { timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Deja pasar solo a finet-chatbot: header `X-API-Key` igual a
 * `ASISTENTE_API_KEY`. Sin la variable configurada no pasa nadie.
 */
@Injectable()
export class ChatbotApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const esperada = this.configService
      .get<string>('ASISTENTE_API_KEY')
      ?.trim();
    if (!esperada) {
      throw new UnauthorizedException('ASISTENTE_API_KEY not configured');
    }

    const recibida = context.switchToHttp().getRequest<Request>().headers[
      'x-api-key'
    ];
    if (!recibida || typeof recibida !== 'string') {
      throw new UnauthorizedException('X-API-Key header is required');
    }

    // timingSafeEqual lanza si los largos difieren, asi que se descarta antes.
    const a = Buffer.from(recibida);
    const b = Buffer.from(esperada);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
