import { describe, expect, it } from 'vitest';

import { adjustedRemainingTargets } from '../adjust';
import { addDays, ageOn, isoWeekday, longDate, todayIn, weekStart } from '../dates';
import { movingAverage, summarizeProgress, weeklyAverages, weeklyTrend } from '../progress';
import { allowedGoals, safeGoal } from '../safety';
import { buildShoppingList, formatAmount, ingredientKey } from '../shopping';
import { slotCalories, slotsFor } from '../slots';
import { calorieFloor, clampAdjustment, computeTargets } from '../targets';

describe('fechas', () => {
  it('calcula "hoy" en la zona horaria de Bolivia', () => {
    // 2026-11-17 02:00 UTC = 16 nov 22:00 en La Paz (UTC-4)
    expect(todayIn('America/La_Paz', new Date('2026-11-17T02:00:00Z'))).toBe('2026-11-16');
  });
  it('opera con días y semanas', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(isoWeekday('2026-11-16')).toBe(1);
    expect(weekStart('2026-11-22')).toBe('2026-11-16');
    expect(ageOn('2010-11-17', '2026-11-16')).toBe(15);
    expect(longDate('2026-11-16')).toBe('lunes 16 de noviembre');
  });
});

describe('objetivos seguros', () => {
  const adult = { sex: 'male' as const, age: 30, heightCm: 175, weightKg: 80, activity: 'moderate' as const };

  it('adulto que quiere perder grasa: déficit moderado (≤15 %, ≤500 kcal)', () => {
    const maint = computeTargets({ ...adult, goal: 'maintain' });
    const lose = computeTargets({ ...adult, goal: 'lose_fat' });
    expect(maint.calories - lose.calories).toBeGreaterThan(0);
    expect(maint.calories - lose.calories).toBeLessThanOrEqual(500);
    expect(lose.minor_safe_mode).toBe(false);
  });

  it('menor de edad: sin déficit aunque pida perder grasa, y con modo seguro', () => {
    const teen = { sex: 'female' as const, age: 15, heightCm: 160, weightKg: 60, activity: 'light' as const };
    const lose = computeTargets({ ...teen, goal: 'lose_fat' });
    const maint = computeTargets({ ...teen, goal: 'maintain' });
    expect(lose.calories).toBe(maint.calories);
    expect(lose.minor_safe_mode).toBe(true);
    expect(lose.rationale).toMatch(/profesional/);
    expect(safeGoal('lose_fat', 15)).toBe('eat_healthier');
    expect(allowedGoals(15)).not.toContain('lose_fat');
    expect(allowedGoals(30)).toContain('lose_fat');
  });

  it('nunca baja del mínimo seguro', () => {
    const t = computeTargets({ sex: 'female', age: 60, heightCm: 148, weightKg: 45, activity: 'sedentary', goal: 'lose_fat' });
    expect(t.calories).toBeGreaterThanOrEqual(1300);
  });

  it('con condiciones de salud recomienda validar con un profesional', () => {
    expect(computeTargets({ ...adult, goal: 'maintain', hasHealthConditions: true }).rationale).toMatch(/médico/);
  });

  it('los ajustes son moderados y nunca bajan a un menor', () => {
    expect(clampAdjustment(2000, 1200, 1300, false)).toBe(1800); // máx −10 %
    expect(clampAdjustment(3000, 2000, 1500, false)).toBe(2750); // máx −250 kcal
    expect(clampAdjustment(2000, 1800, 1300, true)).toBe(2000);
    expect(clampAdjustment(1400, 1300, calorieFloor('female', 1400), false)).toBeGreaterThanOrEqual(1470);
  });
});

describe('comidas del día', () => {
  it('elige los momentos según comidas al día', () => {
    expect(slotsFor(3)).toEqual(['breakfast', 'lunch', 'dinner']);
    expect(slotsFor(4)).toEqual(['breakfast', 'lunch', 'snack', 'dinner']);
    expect(slotsFor(9)).toHaveLength(6);
  });
  it('reparte calorías dando más peso al almuerzo', () => {
    const c = slotCalories(slotsFor(4), 2000);
    expect(c.lunch).toBeGreaterThan(c.dinner);
    expect(Object.values(c).reduce((s, x) => s + x, 0)).toBeGreaterThan(1950);
  });
  it('tras una comida más pesada ajusta como mucho un 15 % y sin eliminar comidas', () => {
    const r = adjustedRemainingTargets(2000, 1800, [{ slot: 'snack', kcal: 250 }, { slot: 'dinner', kcal: 500 }]);
    expect(r.map((x) => x.kcal)).toEqual([210, 430]);
    expect(adjustedRemainingTargets(2000, 900, [{ slot: 'dinner', kcal: 500 }])[0].kcal).toBe(500);
    expect(adjustedRemainingTargets(2000, 3000, [{ slot: 'dinner', kcal: 320 }])[0].kcal).toBe(300);
  });
});

describe('lista de compras', () => {
  it('agrupa, suma y convierte unidades', () => {
    const list = buildShoppingList([
      [{ name: 'Pechuga de pollo', quantity: 200, unit: 'g' }, { name: 'Arroz', quantity: 0.5, unit: 'kg' }],
      [{ name: 'pechugas de pollo', quantity: 300, unit: 'gramos' }, { name: 'Arroz', quantity: 1, unit: 'taza' }, { name: 'Sal', quantity: null, unit: '' }],
    ]);
    const meat = list.find((g) => g.category === 'Carnes, huevos y pescado')!;
    expect(meat.items[0].amounts).toEqual([{ unit: 'g', quantity: 500 }]);
    const rice = list.find((g) => g.category === 'Granos, cereales y tubérculos')!.items[0];
    expect(rice.amounts).toEqual([{ unit: 'g', quantity: 500 }, { unit: 'taza', quantity: 1 }]);
    expect(formatAmount({ unit: 'g', quantity: 1500 })).toBe('1,5 kg');
    expect(ingredientKey('Tomates')).toBe(ingredientKey('tomate'));
  });
});

describe('progreso', () => {
  const pts = [
    { date: '2026-10-19', weight: 82 }, { date: '2026-10-21', weight: 81.6 },
    { date: '2026-10-26', weight: 81.4 }, { date: '2026-11-02', weight: 80.9 },
    { date: '2026-11-09', weight: 80.6 }, { date: '2026-11-16', weight: 80.2 },
  ];
  it('calcula promedios semanales y tendencia', () => {
    const w = weeklyAverages(pts);
    expect(w[0]).toEqual({ week: '2026-10-19', average: 81.8, count: 2 });
    expect(weeklyTrend(w.slice(-4))).toBeLessThan(0);
    expect(movingAverage(pts).at(-1)!.avg).toBe(80.2);
  });
  it('explica con lenguaje sencillo y recuerda la fluctuación natural', () => {
    const s = summarizeProgress(pts, 'lose_fat');
    expect(s.headline).toMatch(/bajó/);
    expect(s.explanation).toMatch(/varias semanas/);
    expect(s.enoughForAdjustments).toBe(true);
    expect(summarizeProgress([], null).enoughForAdjustments).toBe(false);
  });
});

describe('plurales en la lista de compras', () => {
  it('une singular y plural', () => {
    for (const [a, b] of [['Tomates', 'tomate'], ['limones', 'Limón'], ['Panes', 'pan'], ['papas', 'papa'], ['Huevos', 'huevo']])
      expect(ingredientKey(a)).toBe(ingredientKey(b));
  });
});
