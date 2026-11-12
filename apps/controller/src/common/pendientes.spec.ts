import { describe, it, expect } from '@jest/globals';
import { PENDIENTES, pendientesVacios } from './pendientes.js';

/** Lo que el backend lista al arrancar: qué falta, de quién, y qué destraba. */
describe('pendientes del Incremento 3', () => {
  // El comprobante del CU-52 lo genera el portal desde el 12-11: ya no se
  // espera la boleta de G8 (tax-document). Falta solo su permiso para marcarlo
  // en pago.
  it('hoy falta un dato, de Grupo 8: el permiso para guardar el comprobante', () => {
    expect(pendientesVacios()).toEqual([
      'CU-52 (el PDF guardado en pago y en GENERADO) ← Permiso para guardar el comprobante en pago (UPDATE de comprobante_pdf_url y comprobante_estado) (Grupo 8)',
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
