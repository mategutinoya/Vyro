import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/lib/supabase', () => ({ supabase: {}, requireUserId: jest.fn() }));

import { sumMacros } from '@/features/nutrition/api';
import { sumWater } from '@/features/water/api';
import { fmtWater } from '@/lib/format';

describe('totales del día', () => {
  it('suma macros de varios registros', () => {
    expect(
      sumMacros([
        { kcal: 300, protein_g: 20, carbs_g: 30, fat_g: 10 },
        { kcal: 150.5, protein_g: 5.5, carbs_g: 20, fat_g: 5 },
      ]),
    ).toEqual({ kcal: 450.5, protein_g: 25.5, carbs_g: 50, fat_g: 15 });
  });
  it('sin registros devuelve ceros (no datos inventados)', () => {
    expect(sumMacros(undefined)).toEqual({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
    expect(sumWater(undefined)).toBe(0);
  });
  it('suma agua y la formatea', () => {
    expect(sumWater([{ id: '1', amount_ml: 250, created_at: '' }, { id: '2', amount_ml: 500, created_at: '' }])).toBe(750);
    expect(fmtWater(750)).toBe('750 ml');
    expect(fmtWater(1500)).toBe('1,5 L');
  });
});
