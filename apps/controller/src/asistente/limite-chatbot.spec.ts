import { describe, it, expect } from '@jest/globals';
import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  LIMITE_CHATBOT_POR_MINUTO,
  LIMITE_POR_MINUTO,
  limitePorMinuto,
} from './limite-chatbot.js';

const config = (clave?: string) =>
  ({ get: () => clave }) as unknown as ConfigService;

const peticion = (headers: Record<string, string> = {}) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  }) as unknown as ExecutionContext;

describe('limitePorMinuto', () => {
  it('da el limite alto a quien trae la clave del chatbot', () => {
    const limite = limitePorMinuto(config('clave-del-bot'));

    expect(limite(peticion({ 'x-api-key': 'clave-del-bot' }))).toBe(
      LIMITE_CHATBOT_POR_MINUTO,
    );
  });

  it('deja el limite comun sin clave', () => {
    expect(limitePorMinuto(config('clave-del-bot'))(peticion())).toBe(
      LIMITE_POR_MINUTO,
    );
  });

  it('deja el limite comun con una clave equivocada', () => {
    const limite = limitePorMinuto(config('clave-del-bot'));

    expect(limite(peticion({ 'x-api-key': 'otra-clave-123' }))).toBe(
      LIMITE_POR_MINUTO,
    );
  });

  it('deja el limite comun si ASISTENTE_API_KEY no esta configurada', () => {
    const limite = limitePorMinuto(config(undefined));

    expect(limite(peticion({ 'x-api-key': '' }))).toBe(LIMITE_POR_MINUTO);
  });

  it('el limite del chatbot es alto pero finito', () => {
    expect(LIMITE_CHATBOT_POR_MINUTO).toBeGreaterThan(LIMITE_POR_MINUTO);
    expect(Number.isFinite(LIMITE_CHATBOT_POR_MINUTO)).toBe(true);
  });
});
