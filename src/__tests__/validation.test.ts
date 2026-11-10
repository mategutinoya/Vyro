import { describe, expect, it } from '@jest/globals';

import { maskBirthDate, parseBirthDate, parseDecimal } from '@/features/profile/validation';

describe('validación de formularios', () => {
  it('aplica la máscara de fecha mientras se escribe', () => {
    expect(maskBirthDate('1504')).toBe('15/04');
    expect(maskBirthDate('15041992')).toBe('15/04/1992');
    expect(maskBirthDate('15/04/19921')).toBe('15/04/1992');
  });
  it('acepta fechas reales y rechaza imposibles', () => {
    expect(parseBirthDate('15/04/1992', '2026-11-10')).toBe('1992-04-15');
    expect(parseBirthDate('31/02/1992', '2026-11-10')).toBeNull();
    expect(parseBirthDate('15/04/2020', '2026-11-10')).toBeNull(); // menor de 13
  });
  it('acepta coma decimal', () => {
    expect(parseDecimal('72,5', 25, 400)).toBe(72.5);
    expect(parseDecimal('', 25, 400)).toBeNull();
    expect(parseDecimal('10', 25, 400)).toBeNull();
  });
});
