import { Controller, Get, Header } from '@nestjs/common';
import { DiagnosticoService } from './diagnostico.service.js';

/**
 * CU-34 / CU-35: prueba de velocidad de red del cliente.
 * Sin autenticacion — se consume desde /velocidad en el sitio publico.
 *
 * Base path: /api/diagnostico
 */
@Controller('diagnostico')
export class DiagnosticoController {
  constructor(private readonly diagnosticoService: DiagnosticoService) {}

  /**
   * CU-34: GET /diagnostico/servidores
   *
   * Devuelve las URLs de los CDN contra los que el navegador hace la medicion.
   * El navegador no puede pedirselas a fast.com por su cuenta porque esa API
   * solo acepta el origen `https://fast.com`.
   *
   * Los servidores son los mismos para todos los clientes —los elige Netflix
   * segun la IP del servidor— asi que se cachean; el `max-age` acompana ese
   * mismo criterio.
   */
  @Get('servidores')
  @Header('Cache-Control', 'public, max-age=300')
  getServidores() {
    return this.diagnosticoService.getServidores();
  }
}
