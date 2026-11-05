import { anonimizarIp } from './ip.js';

describe('anonimizarIp', () => {
  describe('IPv4', () => {
    it.each([
      ['203.0.113.7', '203.0.113.0/24'],
      ['203.0.113.0', '203.0.113.0/24'],
      ['255.255.255.255', '255.255.255.0/24'],
      ['10.0.0.1', '10.0.0.0/24'],
      ['  203.0.113.7  ', '203.0.113.0/24'],
    ])('%s conserva la red y descarta el equipo', (entrada, esperado) => {
      expect(anonimizarIp(entrada)).toBe(esperado);
    });
  });

  // Es lo que entrega Express en local y detrás de proxies que hablan IPv6.
  describe('IPv4 mapeada en IPv6', () => {
    it.each([
      ['::ffff:127.0.0.1', '127.0.0.0/24'],
      ['::FFFF:203.0.113.7', '203.0.113.0/24'],
      ['::ffff:0:203.0.113.7', '203.0.113.0/24'],
      ['[::ffff:203.0.113.7]', '203.0.113.0/24'],
    ])('%s se trata como IPv4', (entrada, esperado) => {
      expect(anonimizarIp(entrada)).toBe(esperado);
    });
  });

  describe('IPv6', () => {
    it.each([
      ['2001:0db8:85a3:0000:0000:8a2e:0370:7334', '2001:db8:85a3::/48'],
      ['2001:db8:85a3::8a2e:370:7334', '2001:db8:85a3::/48'],
      ['2001:db8::1', '2001:db8::/48'],
      ['::1', '::/48'],
      ['fe80::1%eth0', 'fe80::/48'],
    ])('%s conserva los primeros 48 bits', (entrada, esperado) => {
      expect(anonimizarIp(entrada)).toBe(esperado);
    });
  });

  // Sin IP el consentimiento se registra igual: la columna es `inet` y un valor
  // inválido tumbaría la transacción del formulario.
  describe('devuelve null cuando no hay origen que anonimizar', () => {
    it.each([
      ['0.0.0.0', 'centinela que ponen los controllers'],
      ['::', 'mismo centinela en IPv6'],
      ['', 'cadena vacía'],
      ['   ', 'solo espacios'],
      ['999.1.1.1', 'octeto fuera de rango'],
      ['203.0.113', 'IPv4 incompleta'],
      ['1.2.3.4, 5.6.7.8', 'lista de IPs'],
      ['2001:db8:::1', 'IPv6 malformada'],
      ['12345:db8::1', 'grupo IPv6 demasiado largo'],
      ['hola', 'texto cualquiera'],
    ])('%s (%s)', (entrada) => {
      expect(anonimizarIp(entrada)).toBeNull();
    });
  });

  it('nunca conserva el último octeto de una IPv4 (RNF-59.1)', () => {
    for (const ip of ['1.2.3.4', '190.45.23.199', '200.14.85.7']) {
      const anonima = anonimizarIp(ip);
      expect(anonima).not.toBe(ip);
      expect(anonima).toMatch(/\.0\/24$/);
    }
  });
});
