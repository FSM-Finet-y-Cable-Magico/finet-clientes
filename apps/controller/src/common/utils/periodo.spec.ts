import { formatPeriodo } from './periodo.js';

describe('formatPeriodo', () => {
  it('"Mes AAAA", de enero a diciembre', () => {
    expect(formatPeriodo(1, 2026)).toBe('Enero 2026');
    expect(formatPeriodo(5, 2026)).toBe('Mayo 2026');
    expect(formatPeriodo(12, 2025)).toBe('Diciembre 2025');
  });
});
