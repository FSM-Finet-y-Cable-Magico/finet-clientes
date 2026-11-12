import { Controller, Get, Header, Query } from '@nestjs/common';
import { CoberturaService } from './cobertura.service.js';
import { ZodValidationPipe } from '../auth/pipes/zod-validation.pipe.js';
import {
  consultaPuntosCoberturaSchema,
  consultaVisorCoberturaSchema,
} from './dto/cobertura.dto.js';
import type {
  ConsultaPuntosCoberturaDto,
  ConsultaVisorCoberturaDto,
} from './dto/cobertura.dto.js';

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
   *
   * @query id_empresa?: 1 | 2 — opcional. El visor de esa empresa (Finet o Cable Mágico).
   */
  @Get('config')
  @Header('Cache-Control', 'public, max-age=86400')
  getConfig(
    @Query(new ZodValidationPipe(consultaVisorCoberturaSchema))
    query: ConsultaVisorCoberturaDto,
  ) {
    return this.coberturaService.getConfig(query.id_empresa);
  }

  /**
   * CU-60: GET /cobertura/puntos
   *
   * Celdas de densidad que alimentan la capa de mapa de calor. Salen de la capa
   * estatica generada desde el KML de planta externa, no de la base de datos.
   *
   * @query tipo_cobertura?: string — opcional, filtra la capa por tipo.
   * @query id_empresa?: 1 | 2 — opcional. La capa de esa empresa.
   */
  @Get('puntos')
  @Header('Cache-Control', 'no-store')
  getPuntos(
    @Query(new ZodValidationPipe(consultaPuntosCoberturaSchema))
    query: ConsultaPuntosCoberturaDto,
  ) {
    return this.coberturaService.getPuntos(
      query.tipo_cobertura,
      query.id_empresa,
    );
  }
}
