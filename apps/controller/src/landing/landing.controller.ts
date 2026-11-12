import { Controller, Get, Query } from '@nestjs/common';
import { LandingService } from './landing.service.js';
import { ZodValidationPipe } from '../auth/pipes/zod-validation.pipe.js';
import { ConsultaPlanesDto } from './dto/landing.dto.js';

/**
 * CU-15 / CU-17: Catalogo de planes publico para la landing page.
 * Endpoint sin autenticacion — accesible desde el sitio web.
 *
 * Base path: /api/landing
 */
@Controller('landing')
export class LandingController {
  constructor(private readonly landingService: LandingService) {}

  /**
   * CU-15 / CU-17: GET /landing/planes
   *
   * Devuelve planes activos, opcionalmente filtrados por tipo_cliente.
   * CU-15: filtrar por segmento.
   * CU-17: mostrar detalles tecnicos y comerciales (nombre, velocidad, precio, descripcion).
   *
   * @query tipo_cliente?: string — opcional. Filtra por segmento (ej: residencial, empresarial).
   * @query id_empresa?: 1 | 2 — opcional. Solo los planes de esa empresa (Finet o Cable Mágico).
   */
  @Get('planes')
  getPlanes(
    @Query(new ZodValidationPipe(ConsultaPlanesDto))
    query: ConsultaPlanesDto,
  ) {
    return this.landingService.getPlanes(query.tipo_cliente, query.id_empresa);
  }
}
