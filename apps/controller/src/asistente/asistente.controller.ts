import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AsistenteService } from './asistente.service.js';
import { ZodValidationPipe } from '../auth/pipes/zod-validation.pipe.js';
import { MensajeAsistenteDto } from './dto/asistente.dto.js';

/**
 * CU-65: asistente virtual del sitio publico (widget de chat).
 * Sin autenticacion — lo usa cualquier visitante.
 *
 * Base path: /api/asistente
 */
@Controller('asistente')
export class AsistenteController {
  constructor(private readonly asistenteService: AsistenteService) {}

  /**
   * CU-65: POST /asistente/mensajes
   *
   * Un turno del visitante; responde con el texto del asistente.
   *
   * Rate limit: 10 mensajes por minuto por IP. Alcanza para conversar y frena
   * a quien quiera gastar tokens del motor a costa de Finet. `ttl` va en
   * milisegundos desde @nestjs/throttler v5.
   */
  @Post('mensajes')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  enviar(
    @Body(new ZodValidationPipe(MensajeAsistenteDto))
    dto: MensajeAsistenteDto,
    @Req() request?: Request,
  ) {
    const accessToken =
      request?.cookies?.access_token ??
      request?.headers.authorization?.replace(/^Bearer\s+/i, '');
    return accessToken
      ? this.asistenteService.responder(dto, accessToken)
      : this.asistenteService.responder(dto);
  }
}
