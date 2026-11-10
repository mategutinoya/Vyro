import { describe, expect, it } from '@jest/globals';

import { bmr, caloriesFromMacros, computeTargets, tdee } from '@/features/profile/targets';

describe('Mifflin-St Jeor', () => {
  it('calcula el metabolismo basal de un hombre', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 1780
    expect(bmr({ sex: 'male', age: 30, heightCm: 180, weightKg: 80 })).toBe(1780);
  });

  it('calcula el metabolismo basal de una mujer', () => {
    // 10*60 + 6.25*165 - 5*28 - 161 = 1330.25
    expect(bmr({ sex: 'female', age: 28, heightCm: 165, weightKg: 60 })).toBeCloseTo(1330.25);
  });

  it('aplica el factor de actividad', () => {
    expect(tdee({ sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'maintain' })).toBeCloseTo(1780 * 1.55);
  });
});

describe('computeTargets', () => {
  const base = { sex: 'male' as const, age: 30, heightCm: 180, weightKg: 80, activity: 'moderate' as const };

  it('mantenimiento: calorías = gasto total redondeado a 10', () => {
    const t = computeTargets({ ...base, goal: 'maintain' });
    expect(t.calories).toBe(2760); // 2759 -> 2760
    expect(t.protein_g).toBe(144); // 1.8 g/kg
    expect(t.water_ml).toBe(2800); // 35 ml/kg
  });

  it('perder grasa: déficit del 20 % y más proteína', () => {
    const t = computeTargets({ ...base, goal: 'lose' });
    expect(t.calories).toBe(2210); // 2759 * 0.8 = 2207 -> 2210
    expect(t.protein_g).toBe(160);
  });

  it('ganar músculo: superávit del 10 %', () => {
    expect(computeTargets({ ...base, goal: 'gain' }).calories).toBe(3030);
  });

  it('los macros suman aproximadamente las calorías objetivo', () => {
    for (const goal of ['lose', 'maintain', 'gain'] as const) {
      const t = computeTargets({ ...base, goal });
      expect(Math.abs(caloriesFromMacros(t) - t.calories)).toBeLessThanOrEqual(12);
    }
  });

  it('nunca baja de un mínimo seguro de calorías', () => {
    const t = computeTargets({ sex: 'female', age: 70, heightCm: 145, weightKg: 40, activity: 'sedentary', goal: 'lose' });
    expect(t.calories).toBe(1200);
    expect(t.carbs_g).toBeGreaterThanOrEqual(0);
  });
});
