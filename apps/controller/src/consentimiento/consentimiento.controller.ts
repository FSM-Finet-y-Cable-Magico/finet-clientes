import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { ConsentimientoService } from './consentimiento.service.js';
import { ZodValidationPipe } from '../auth/pipes/zod-validation.pipe.js';
import { ConsentimientoCookiesDto } from './dto/consentimiento-cookies.dto.js';

/**
 * Endpoint público — el banner sale antes de cualquier sesión.
 * Base path: /api/consentimiento
 */
@Controller('consentimiento')
export class ConsentimientoController {
  constructor(private readonly consentimientoService: ConsentimientoService) {}

  /**
   * POST /consentimiento/cookies
   * CU-76: registra la decisión del banner, sea aceptar o rechazar.
   *
   * Rate limit: 3 por minuto por IP. Una persona decide una vez; más que eso
   * es un script.
   */
  @Post('cookies')
  @Throttle({ default: { limit: 3, ttl: 60 } })
  @HttpCode(201)
  registrarCookies(
    @Body(new ZodValidationPipe(ConsentimientoCookiesDto))
    dto: ConsentimientoCookiesDto,
    @Req() req: Request,
  ) {
    return this.consentimientoService.registrarCookies(
      dto,
      req.ip ?? '0.0.0.0',
    );
  }
}
