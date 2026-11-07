import { describe, it, expect } from '@jest/globals';
import { AuthController } from '../../auth/auth.controller.js';
import { ConsentimientoController } from '../../consentimiento/consentimiento.controller.js';
import { ContratacionesController } from '../../contrataciones/contrataciones.controller.js';
import { PerfilController } from '../../perfil/perfil.controller.js';
import { PortalController } from '../../portal/portal.controller.js';
import { LIMITE_CON_SESION_POR_MINUTO, UN_MINUTO_MS } from './limites.js';

/** Lo que dejó `@Throttle` para el throttler `default`. */
function limite(objetivo: object): { limit: unknown; ttl: unknown } {
  return {
    limit: Reflect.getMetadata('THROTTLER:LIMITdefault', objetivo) as unknown,
    ttl: Reflect.getMetadata('THROTTLER:TTLdefault', objetivo) as unknown,
  };
}

describe('Límites de peticiones', () => {
  it('las rutas con sesión permiten navegar el portal: 120 por minuto', () => {
    const esperado = { limit: LIMITE_CON_SESION_POR_MINUTO, ttl: UN_MINUTO_MS };
    expect(limite(PortalController)).toEqual(esperado);
    expect(limite(PerfilController)).toEqual(esperado);
    expect(limite(AuthController.prototype.logout)).toEqual(esperado);
  });

  it('las rutas públicas con límite propio cuentan por minuto, no por milisegundos', () => {
    expect(limite(AuthController.prototype.login)).toEqual({
      limit: 5,
      ttl: UN_MINUTO_MS,
    });
    for (const ruta of [
      AuthController.prototype.solicitarRegistro,
      AuthController.prototype.confirmarRegistro,
      AuthController.prototype.recuperarPassword,
      AuthController.prototype.restablecerPassword,
      ContratacionesController.prototype.crear,
      ConsentimientoController.prototype.registrarCookies,
    ]) {
      expect(limite(ruta)).toEqual({ limit: 3, ttl: UN_MINUTO_MS });
    }
  });
});
