import { describe, it, expect } from '@jest/globals';
import { categoriaVisible } from './ticket.js';

describe('categoriaVisible', () => {
  it('no le muestra al cliente el nombre técnico de la categoría WiFi', () => {
    expect(categoriaVisible('CAMBIO_CREDENCIALES_WIFI')).toBe(
      'Cambio de contraseña WiFi',
    );
  });

  it('deja las demás categorías como están', () => {
    expect(categoriaVisible('Falla de Internet')).toBe('Falla de Internet');
  });
});
