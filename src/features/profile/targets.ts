import type { ActivityLevel, Goal, NutritionTargets, Sex } from './types';

/**
 * Cálculo de objetivos diarios.
 *  - Metabolismo basal: ecuación de Mifflin-St Jeor.
 *  - Gasto total: basal × factor de actividad.
 *  - Ajuste por objetivo: −20 % (perder), 0 % (mantener), +10 % (ganar).
 *  - Proteína: 2,0 g/kg perdiendo grasa, 1,8 g/kg en el resto.
 *  - Grasa: 25 % de las calorías (mínimo 0,6 g/kg).
 *  - Carbohidratos: el resto de calorías.
 *  - Agua: 35 ml/kg.
 * Son estimaciones de partida; el usuario puede editarlas en su perfil.
 */

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_FACTORS: Record<Goal, number> = { lose: 0.8, maintain: 1, gain: 1.1 };

export interface TargetInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
}

export function bmr({ sex, age, heightCm, weightKg }: Pick<TargetInput, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

export function tdee(input: TargetInput): number {
  return bmr(input) * ACTIVITY_FACTORS[input.activity];
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

export function computeTargets(input: TargetInput): NutritionTargets {
  const minCalories = input.sex === 'male' ? 1500 : 1200;
  const calories = Math.max(minCalories, roundTo(tdee(input) * GOAL_FACTORS[input.goal], 10));

  const proteinPerKg = input.goal === 'lose' ? 2.0 : 1.8;
  const protein_g = Math.round(input.weightKg * proteinPerKg);
  const fat_g = Math.round(Math.max((calories * 0.25) / 9, input.weightKg * 0.6));
  const carbs_g = Math.max(0, Math.round((calories - protein_g * 4 - fat_g * 9) / 4));
  const water_ml = roundTo(input.weightKg * 35, 50);

  return { calories, protein_g, carbs_g, fat_g, water_ml };
}

/** Calorías implícitas de unos macros (útil para validar objetivos editados a mano). */
export function caloriesFromMacros(m: Pick<NutritionTargets, 'protein_g' | 'carbs_g' | 'fat_g'>): number {
  return m.protein_g * 4 + m.carbs_g * 4 + m.fat_g * 9;
}
