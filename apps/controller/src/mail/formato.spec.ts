import { describe, it, expect } from '@jest/globals';
import {
  escaparHtml,
  fechaCliente,
  fechaHoraCliente,
  pesos,
} from './formato.js';

/** §11 del Documento 0: formatos de lo que ve el cliente. */
describe('formato de los correos', () => {
  it('fecha en DD/MM/AAAA', () => {
    expect(fechaCliente(new Date('2026-09-29T00:00:00.000Z'))).toBe(
      '29/09/2026',
    );
  });

  it('una fecha de la base no se corre al día anterior', () => {
    // Medianoche UTC son las 21:00 del día anterior en Chile.
    expect(fechaCliente(new Date('2026-10-01T00:00:00.000Z'))).toBe(
      '01/10/2026',
    );
  });

  it('fecha y hora en DD/MM/AAAA HH:MM, 24 horas', () => {
    expect(fechaHoraCliente(new Date('2026-09-30T17:05:00.000Z'))).toBe(
      '30/09/2026 14:05',
    );
  });

  it('un pago de la noche muestra el día de Chile, no el de UTC', () => {
    expect(fechaHoraCliente(new Date('2026-10-01T01:30:00.000Z'))).toBe(
      '30/09/2026 22:30',
    );
  });

  it('pesos chilenos sin decimales', () => {
    expect(pesos(144940)).toBe('$144.940');
  });

  it('escapa el HTML que escribe el cliente', () => {
    expect(escaparHtml(`<b>Ana</b> & "Beto" 'O'`)).toBe(
      '&lt;b&gt;Ana&lt;/b&gt; &amp; &quot;Beto&quot; &#39;O&#39;',
    );
  });
});
