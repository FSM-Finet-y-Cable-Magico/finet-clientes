import { describe, it, expect } from '@jest/globals';
import { PENDIENTES, pendientesVacios } from './pendientes.js';

/** Lo que el backend lista al arrancar: qué falta, de quién, y qué destraba. */
describe('pendientes del Incremento 3', () => {
  it('hoy faltan los cinco datos', () => {
    expect(pendientesVacios()).toEqual([
      'CU-42, CU-43, CU-68, CU-69 ← Pasarela de pagos operativa (Grupo 2)',
      'CU-42, CU-43, CU-69 ← Registro del pago desplegado (POST /api/integrations/g2/payments) (Grupo 8)',
      'CU-42, CU-43, CU-68 ← Saldo del cliente desplegado (GET /api/integrations/g2/invoices) (Grupo 8)',
      'CU-32 (envío directo a G3) ← Ticket WiFi desplegado (categoría, ticket.id_servicio y wifi-result) (Grupo 8)',
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
