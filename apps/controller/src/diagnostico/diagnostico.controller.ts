import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
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
   *
   * Sin `@SkipThrottle`, el limite global (10/min) se agotaba con un par de
   * recargas de pagina o clicks en "Medir de nuevo" y el cliente veia
   * "la herramienta de medicion no esta disponible" con fast.com sano: el
   * servicio ya cachea la respuesta real (arriba, ~1h) y esta misma
   * `Cache-Control` la cachea tambien en el navegador, asi que no hay nada
   * que este limite protegiera.
   */
  @Get('servidores')
  @Header('Cache-Control', 'public, max-age=300')
  @SkipThrottle()
  getServidores() {
    return this.diagnosticoService.getServidores();
  }
}
