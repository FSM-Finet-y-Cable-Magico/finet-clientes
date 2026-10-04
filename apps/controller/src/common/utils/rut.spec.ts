import { cleanRut, formatRut, validateRut } from './rut.js';

describe('cleanRut', () => {
  it('remove dots and dash from formatted RUT', () => {
    expect(cleanRut('12.345.678-5')).toBe('123456785');
  });

  it('remove only dash if no dots', () => {
    expect(cleanRut('12345678-5')).toBe('123456785');
  });

  it('handle RUT with K DV', () => {
    expect(cleanRut('11.111.111-K')).toBe('11111111K');
  });

  it('handle RUT with lowercase k DV', () => {
    expect(cleanRut('11.111.111-k')).toBe('11111111k');
  });

  it('return same if already clean', () => {
    expect(cleanRut('123456785')).toBe('123456785');
  });
});

describe('formatRut', () => {
  it('add dash to clean RUT', () => {
    expect(formatRut('123456785')).toBe('12345678-5');
  });

  it('handle K DV', () => {
    expect(formatRut('11111111K')).toBe('11111111-K');
  });
});

describe('validateRut', () => {
  const validRuts = [
    '12.345.678-5',
    '11.111.111-1',
    '7.777.777-6',
    '9.876.543-3',
    '30.686.957-4',
    '123456785',
    '111111111',
    '77777776',
    '98765433',
    '306869574',
  ];

  for (const rut of validRuts) {
    it(`return true for valid RUT ${rut}`, () => {
      expect(validateRut(rut)).toBe(true);
    });
  }

  const invalidRuts = [
    '11.111.111-K',
    '12.345.678-0',
    '7.777.777-0',
    '7.777.777-K',
    '',
    'hola',
    '12.345.678',
    '123456780',
    '77777770',
  ];

  for (const rut of invalidRuts) {
    it(`return false for invalid RUT ${rut}`, () => {
      expect(validateRut(rut)).toBe(false);
    });
  }
});
