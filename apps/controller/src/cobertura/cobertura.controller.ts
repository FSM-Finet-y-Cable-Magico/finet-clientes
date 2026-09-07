import { Controller, Get, Header, Query } from '@nestjs/common';
import { CoberturaService } from './cobertura.service.js';
import { ZodValidationPipe } from '../auth/pipes/zod-validation.pipe.js';
import { consultaPuntosCoberturaSchema } from './dto/cobertura.dto.js';
import type { ConsultaPuntosCoberturaDto } from './dto/cobertura.dto.js';

/**
 * CU-59 / CU-60: visor cartográfico público de factibilidad técnica.
 * Sin autenticación — se consume desde /cobertura en el sitio.
 *
 * Base path: /api/cobertura
 */
@Controller('cobertura')
export class CoberturaController {
  constructor(private readonly coberturaService: CoberturaService) {}

  /**
   * CU-59: GET /cobertura/config
   *
   * Encuadre inicial del visor, más los límites de zoom (CU-61) y de
   * paneo (CU-62) que el cliente debe respetar.
   */
  @Get('config')
  @Header('Cache-Control', 'public, max-age=86400')
  getConfig() {
    return this.coberturaService.getConfig();
  }

  /**
   * CU-60: GET /cobertura/puntos
   *
   * Puntos de densidad que alimentan la capa de mapa de calor.
   * Lee exclusivamente la ultima publicacion, tambien cuando publica el CRM.
   *
   * @query tipo_cobertura?: string — opcional, filtra la capa por tipo.
   */
  @Get('puntos')
  @Header('Cache-Control', 'no-store')
  getPuntos(
    @Query(new ZodValidationPipe(consultaPuntosCoberturaSchema))
    query: ConsultaPuntosCoberturaDto,
  ) {
    return this.coberturaService.getPuntos(query.tipo_cobertura);
  }
}
