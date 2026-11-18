import { afterEach, describe, it, expect } from '@jest/globals';
import { AsistenteController } from '../../asistente/asistente.controller.js';
import { AuthController } from '../../auth/auth.controller.js';
import { ConsentimientoController } from '../../consentimiento/consentimiento.controller.js';
import { ContratacionesController } from '../../contrataciones/contrataciones.controller.js';
import { PerfilController } from '../../perfil/perfil.controller.js';
import { PortalController } from '../../portal/portal.controller.js';
import { LIMITE_CON_SESION_POR_MINUTO, UN_MINUTO_MS } from './limites.js';

/**
 * Lo que dejó `@Throttle` para el throttler `default`. El límite puede ser una
 * función (se evalúa en cada petición): aquí se evalúa igual.
 */
function limite(objetivo: object): { limit: unknown; ttl: unknown } {
  const limit = Reflect.getMetadata(
    'THROTTLER:LIMITdefault',
    objetivo,
  ) as unknown;
  return {
    limit: typeof limit === 'function' ? (limit as () => unknown)() : limit,
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

// Rama ppt: en la demo local todos los usuarios salen de la misma IP, y con
// estos límites cambiar de usuario un par de veces daba «Demasiadas solicitudes».
describe('Límites en la demo local (PPT_MULTIPLICADOR_LIMITES)', () => {
  afterEach(() => {
    delete process.env.PPT_MULTIPLICADOR_LIMITES;
  });

  it('multiplica los límites por ruta', () => {
    process.env.PPT_MULTIPLICADOR_LIMITES = '20';
    expect(limite(AuthController.prototype.login)).toEqual({
      limit: 100,
      ttl: UN_MINUTO_MS,
    });
    expect(limite(AuthController.prototype.solicitarRegistro).limit).toBe(60);
    expect(limite(ContratacionesController.prototype.crear).limit).toBe(60);
    expect(
      limite(ConsentimientoController.prototype.registrarCookies).limit,
    ).toBe(60);
    expect(limite(AsistenteController.prototype.enviar).limit).toBe(200);
    expect(limite(PortalController).limit).toBe(
      LIMITE_CON_SESION_POR_MINUTO * 20,
    );
  });

  it.each(['', '1', '0', '-3', 'muchas', '2.5'])(
    'con un valor que no es un entero mayor que 1 (%s) queda como en main',
    (valor) => {
      process.env.PPT_MULTIPLICADOR_LIMITES = valor;
      expect(limite(AuthController.prototype.login).limit).toBe(5);
      expect(limite(AsistenteController.prototype.enviar).limit).toBe(10);
    },
  );
});
