import { describe, expect, it } from '@jest/globals';

import { addDays, ageFromBirthDate, formatLongDate, isoWeekday, toISODate } from '@/lib/date';

describe('fechas locales', () => {
  it('formatea a AAAA-MM-DD', () => expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05'));
  it('suma días cruzando meses y años', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('día ISO de la semana (lunes = 1, domingo = 7)', () => {
    expect(isoWeekday('2026-11-09')).toBe(1);
    expect(isoWeekday('2026-11-15')).toBe(7);
  });
  it('calcula la edad respetando el cumpleaños', () => {
    expect(ageFromBirthDate('1990-11-10', '2026-11-09')).toBe(35);
    expect(ageFromBirthDate('1990-11-10', '2026-11-10')).toBe(36);
  });
  it('formato largo en español', () => expect(formatLongDate('2026-11-10')).toBe('martes, 10 de noviembre'));
});
