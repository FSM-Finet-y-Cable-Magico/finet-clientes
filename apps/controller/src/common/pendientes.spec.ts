import { describe, it, expect } from '@jest/globals';
import { PENDIENTES, pendientesVacios } from './pendientes.js';

/** Lo que el backend lista al arrancar: qué falta, de quién, y qué destraba. */
describe('pendientes del Incremento 3', () => {
  it('hoy falta un dato, de Grupo 8: la boleta (CU-52)', () => {
    expect(pendientesVacios()).toEqual([
      'CU-52 ← Boleta del pago (GET /api/integrations/g2/payments/{id}/tax-document) y que Finet confirme la descarga (Grupo 8)',
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
