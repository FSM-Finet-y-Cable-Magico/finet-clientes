import { describe, it, expect } from '@jest/globals';
import { PENDIENTES, pendientesVacios } from './pendientes.js';

/** Lo que el backend lista al arrancar: qué falta, de quién, y qué destraba. */
describe('pendientes del Incremento 3', () => {
  // El comprobante del CU-52 lo genera el portal y lo guarda en pago desde el
  // 12-11, con el permiso de G8 sobre esas dos columnas.
  it('hoy no falta ningún dato de otro grupo', () => {
    expect(pendientesVacios()).toEqual([]);
  });

  it('cada dato dice quién tiene que responder y qué caso de uso destraba', () => {
    for (const p of PENDIENTES) {
      expect(p.dato).not.toBe('');
      expect(p.destraba).toMatch(/^CU-\d+/);
      expect(['Grupo 2', 'Grupo 3', 'Grupo 8']).toContain(p.quien);
    }
  });
});
