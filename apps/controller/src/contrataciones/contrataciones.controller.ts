import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { ContratacionesService } from './contrataciones.service.js';
import { ZodValidationPipe } from '../auth/pipes/zod-validation.pipe.js';
import { ContratacionDto } from './dto/contratacion.dto.js';

/**
 * Endpoint público — no requiere autenticación.
 * Base path: /api/contrataciones
 */
@Controller('contrataciones')
export class ContratacionesController {
  constructor(private readonly contratacionesService: ContratacionesService) {}

  /**
   * POST /contrataciones
   * Registra un nuevo cliente desde el formulario web:
   * crea cliente, dirección, contrato, orden de instalación y prospecto CRM en una sola transacción.
   * CU-75: exige `acepta_politica_privacidad: true` y registra la aceptación
   * (con la IP de origen) en esa misma transacción.
   *
   * Rate limit: 3 intentos por minuto por IP.
   */
  @Post()
  @Throttle({ default: { limit: 3, ttl: 60 } })
  @HttpCode(201)
  crear(
    @Body(new ZodValidationPipe(ContratacionDto))
    dto: ContratacionDto,
    @Req() req: Request,
  ) {
    return this.contratacionesService.crear(dto, req.ip ?? '0.0.0.0');
  }
}
