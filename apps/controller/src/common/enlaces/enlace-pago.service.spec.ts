import { beforeEach, describe, it, expect } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import {
  EnlacePagoService,
  VIGENCIA_ENLACE_PAGO_MS,
} from './enlace-pago.service.js';

const AHORA = new Date('2026-10-01T09:00:00.000Z');

function servicio(secreto?: string) {
  return new EnlacePagoService({
    get: () => secreto,
  } as unknown as ConfigService);
}

const CLAVE = 'secreto-de-prueba';

/**
 * RF-50 y RNF-50.1: el enlace del aviso de corte es corto, único, y solo sirve
 * para el cliente a quien se le mandó.
 */
describe('EnlacePagoService', () => {
  let enlaces: EnlacePagoService;

  beforeEach(() => {
    enlaces = servicio(CLAVE);
  });

  it('el enlace devuelve el cliente para el que se creó', () => {
    const token = enlaces.crearEnlacePago(130, AHORA);

    expect(enlaces.verificarEnlacePago(token, AHORA)).toBe(130);
  });

  it('es corto (RNF-50.1: "URL acortada")', () => {
    expect(enlaces.crearEnlacePago(130, AHORA).length).toBeLessThan(60);
  });

  it('es único: dos enlaces del mismo cliente no se repiten', () => {
    expect(enlaces.crearEnlacePago(130, AHORA)).not.toBe(
      enlaces.crearEnlacePago(130, AHORA),
    );
  });

  it('no deja cambiar el cliente del enlace', () => {
    const token = enlaces.crearEnlacePago(130, AHORA);
    const partes = token.split('.');
    partes[1] = (131).toString(36);

    expect(enlaces.verificarEnlacePago(partes.join('.'), AHORA)).toBeNull();
  });

  it('rechaza una firma alterada', () => {
    const token = enlaces.crearEnlacePago(130, AHORA);
    const inicio = token.lastIndexOf('.') + 1;
    const otro = token[inicio] === 'A' ? 'B' : 'A';
    const alterado = token.slice(0, inicio) + otro + token.slice(inicio + 1);

    expect(enlaces.verificarEnlacePago(alterado, AHORA)).toBeNull();
  });

  it('rechaza otra escritura de la misma firma: el enlace es único (RNF-50.1)', () => {
    // 16 bytes en base64url son 22 caracteres, y los 4 bits bajos del último
    // son relleno: cambiarlos da otro texto que decodifica a la misma firma.
    const ALFABETO =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const token = enlaces.crearEnlacePago(130, AHORA);
    const ultimo = ALFABETO.indexOf(token.at(-1)!);
    const variante = token.slice(0, -1) + ALFABETO[ultimo + 1];

    expect(enlaces.verificarEnlacePago(variante, AHORA)).toBeNull();
  });

  it('rechaza un enlace firmado con otra clave', () => {
    const ajeno = servicio('otra-clave').crearEnlacePago(130, AHORA);

    expect(enlaces.verificarEnlacePago(ajeno, AHORA)).toBeNull();
  });

  it('vence a los siete días', () => {
    const token = enlaces.crearEnlacePago(130, AHORA);
    const justoAntes = new Date(
      AHORA.getTime() + VIGENCIA_ENLACE_PAGO_MS - 1000,
    );
    const despues = new Date(AHORA.getTime() + VIGENCIA_ENLACE_PAGO_MS + 1000);

    expect(enlaces.verificarEnlacePago(token, justoAntes)).toBe(130);
    expect(enlaces.verificarEnlacePago(token, despues)).toBeNull();
  });

  it.each([
    ['vacío', ''],
    ['sin puntos', 'basura'],
    ['con partes de más', 'p.a.b.c.d.e'],
    ['demasiado largo', 'p.' + 'a'.repeat(200)],
  ])('rechaza un enlace %s', (_caso, token) => {
    expect(enlaces.verificarEnlacePago(token, AHORA)).toBeNull();
  });

  it('falla claro si no está configurada la clave', () => {
    expect(() => servicio().crearEnlacePago(130, AHORA)).toThrow(
      /ENLACE_PAGO_SECRET/,
    );
  });

  it('deja comprobar la clave antes de crear ningún enlace', () => {
    expect(() => servicio().verificarClave()).toThrow(/ENLACE_PAGO_SECRET/);
    expect(() => servicio(CLAVE).verificarClave()).not.toThrow();
  });
});
