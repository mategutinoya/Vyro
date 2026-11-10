import { describe, expect, it } from '@jest/globals';

import { kcalMismatch, macrosForGrams, recipeNutrition, scaleMacros } from '@/features/nutrition/calc';

const avena = { kcal_per_100g: 379, protein_per_100g: 13.2, carbs_per_100g: 67.7, fat_per_100g: 6.5 };
const leche = { kcal_per_100g: 46, protein_per_100g: 3.4, carbs_per_100g: 4.8, fat_per_100g: 1.6 };

describe('cálculos nutricionales', () => {
  it('calcula macros por gramos', () => {
    expect(macrosForGrams(avena, 60)).toEqual({ kcal: 227.4, protein_g: 7.9, carbs_g: 40.6, fat_g: 3.9 });
    expect(macrosForGrams(avena, 0)).toEqual({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  });

  it('reescala un registro al editar la cantidad', () => {
    const m = macrosForGrams(leche, 200);
    expect(scaleMacros(m, 200, 300)).toEqual(macrosForGrams(leche, 300));
    expect(scaleMacros(m, 0, 100).kcal).toBe(0);
  });

  it('calcula recetas por ración', () => {
    const r = recipeNutrition([{ grams: 80, food: avena }, { grams: 250, food: leche }], 2);
    expect(r.totalGrams).toBe(330);
    expect(r.gramsPerServing).toBe(165);
    expect(r.total.kcal).toBeCloseTo(303.2 + 115, 0);
    expect(r.perServing.kcal).toBeCloseTo(r.total.kcal / 2, 0);
  });

  it('detecta calorías que no cuadran con los macros', () => {
    expect(kcalMismatch(avena)).toBeLessThan(0.05);
    expect(kcalMismatch({ ...avena, kcal_per_100g: 37.9 })).toBeGreaterThan(0.5);
  });
});
