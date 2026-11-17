import { beforeEach, describe, it, expect } from '@jest/globals';
import { BruteForceFallback } from './auth.service.js';

/**
 * CU-05 Excepción 1: el bloqueo en memoria cuando la base no responde. Fija su
 * comportamiento para poder cambiar la estructura interna sin cambiar a quién
 * bloquea ni cuándo.
 */
describe('BruteForceFallback', () => {
  const INICIO = new Date('2026-10-23T12:00:00.000Z');
  let ahora: Date;
  let fallback: BruteForceFallback;

  function avanzar(minutos: number) {
    ahora = new Date(ahora.getTime() + minutos * 60_000);
  }

  function intentos(n: number, rut: string, ip: string) {
    let ultimo = fallback.registrarIntento(rut, ip);
    for (let i = 1; i < n; i++) ultimo = fallback.registrarIntento(rut, ip);
    return ultimo;
  }

  beforeEach(() => {
    ahora = INICIO;
    fallback = new BruteForceFallback(() => ahora);
  });

  it('el 5.º intento desde una IP en 5 minutos bloquea la IP por 15 minutos', () => {
    for (let i = 0; i < 4; i++) {
      expect(fallback.registrarIntento(`11111111${i}`, '10.0.0.1')).toEqual({
        bloquearRut: false,
        bloquearIp: false,
        bloquearHasta: null,
      });
    }
    expect(fallback.registrarIntento('111111114', '10.0.0.1')).toEqual({
      bloquearRut: false,
      bloquearIp: true,
      bloquearHasta: new Date(INICIO.getTime() + 15 * 60_000),
    });
    expect(fallback.estaBloqueado('999999999', '10.0.0.1')).toEqual({
      ip: true,
      rut: false,
    });
  });

  it('los intentos de hace más de 5 minutos no cuentan para la IP', () => {
    intentos(4, '123456785', '10.0.0.1');
    avanzar(6);
    expect(fallback.registrarIntento('123456785', '10.0.0.1').bloquearIp).toBe(
      false,
    );
  });

  it('el 5.º intento contra un RUT en 10 minutos bloquea el RUT, desde cualquier IP', () => {
    for (let i = 0; i < 4; i++) {
      fallback.registrarIntento('123456785', `10.0.0.${i}`);
      avanzar(2);
    }
    const r = fallback.registrarIntento('123456785', '10.0.0.9');
    expect(r.bloquearRut).toBe(true);
    expect(r.bloquearIp).toBe(false);
    expect(fallback.estaBloqueado('123456785', '10.0.0.200')).toEqual({
      ip: false,
      rut: true,
    });
  });

  it('los intentos de hace más de 10 minutos no cuentan para el RUT', () => {
    for (let i = 0; i < 4; i++)
      fallback.registrarIntento('123456785', `10.0.0.${i}`);
    avanzar(11);
    expect(fallback.registrarIntento('123456785', '10.0.0.9').bloquearRut).toBe(
      false,
    );
  });

  it('el intento que bloquea queda bloqueado por su IP y por su RUT', () => {
    intentos(5, '123456785', '10.0.0.1');
    expect(fallback.estaBloqueado('123456785', '10.0.0.2')).toEqual({
      ip: false,
      rut: true,
    });
    expect(fallback.estaBloqueado('765432108', '10.0.0.1')).toEqual({
      ip: true,
      rut: false,
    });
  });

  it('el bloqueo dura 15 minutos', () => {
    intentos(5, '123456785', '10.0.0.1');
    avanzar(14);
    expect(fallback.estaBloqueado('123456785', '10.0.0.1')).toEqual({
      ip: true,
      rut: true,
    });
    avanzar(2);
    expect(fallback.estaBloqueado('123456785', '10.0.0.1')).toEqual({
      ip: false,
      rut: false,
    });
  });

  it('un login correcto limpia los intentos del RUT, también del conteo de su IP', () => {
    intentos(5, '123456785', '10.0.0.1');
    fallback.limpiarBloqueoRut('123456785');
    expect(fallback.estaBloqueado('123456785', '10.0.0.1')).toEqual({
      ip: false,
      rut: false,
    });
    // Los cinco se fueron: desde esa IP hacen falta otros cinco.
    for (let i = 0; i < 4; i++) {
      expect(
        fallback.registrarIntento('765432108', '10.0.0.1').bloquearIp,
      ).toBe(false);
    }
    expect(fallback.registrarIntento('765432108', '10.0.0.1').bloquearIp).toBe(
      true,
    );
  });

  it('limpiar un RUT no toca los intentos de otro RUT desde la misma IP', () => {
    intentos(2, '123456785', '10.0.0.1');
    intentos(2, '765432108', '10.0.0.1');
    fallback.limpiarBloqueoRut('123456785');
    fallback.registrarIntento('765432108', '10.0.0.1');
    fallback.registrarIntento('765432108', '10.0.0.1');
    expect(fallback.registrarIntento('765432108', '10.0.0.1').bloquearIp).toBe(
      true,
    );
  });

  it('IPs y RUTs distintos no se mezclan', () => {
    intentos(4, '123456785', '10.0.0.1');
    intentos(4, '765432108', '10.0.0.2');
    expect(fallback.estaBloqueado('123456785', '10.0.0.1')).toEqual({
      ip: false,
      rut: false,
    });
  });
});
