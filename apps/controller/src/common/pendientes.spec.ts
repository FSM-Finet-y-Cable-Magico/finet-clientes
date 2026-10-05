import { describe, it, expect } from '@jest/globals';
import { PENDIENTES, pendientesVacios } from './pendientes.js';

/** Lo que el backend lista al arrancar: qué falta, de quién, y qué destraba. */
describe('pendientes del Incremento 3', () => {
  it('hoy faltan los cuatro datos', () => {
    expect(pendientesVacios()).toEqual([
      'CU-42, CU-43, CU-68, CU-69 ← Pasarela de pagos operativa (Grupo 2)',
      'CU-42, CU-43, CU-69 ← Dónde queda registrado el pago confirmado (tabla y campos) (Grupo 8)',
      'CU-42, CU-43, CU-68 ← Dónde está el saldo del cliente (tabla y campo) (Grupo 8)',
      'CU-32 (envío directo a G3) ← Ticket del cambio de clave WiFi: categoría y dónde va el servicio (Grupo 8)',
    ]);
  });

  it('cada dato dice quién tiene que responder y qué caso de uso destraba', () => {
    for (const p of PENDIENTES) {
      expect(p.dato).not.toBe('');
      expect(p.destraba).toMatch(/^CU-\d+/);
      expect(['Grupo 2', 'Grupo 3', 'Grupo 8']).toContain(p.quien);
    }
  });
});
