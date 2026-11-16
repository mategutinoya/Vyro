import { isMinor, safeGoal, type Goal } from './safety';

export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export const ACTIVITY_FACTORS: Record<Activity, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<Activity, { title: string; detail: string }> = {
  sedentary: { title: 'Sedentario', detail: 'Trabajo sentado, casi sin ejercicio' },
  light: { title: 'Ligero', detail: 'Ejercicio 1–3 días por semana' },
  moderate: { title: 'Moderado', detail: 'Ejercicio 3–5 días por semana' },
  active: { title: 'Activo', detail: 'Ejercicio 6–7 días por semana' },
  very_active: { title: 'Muy activo', detail: 'Trabajo físico y entrenamiento diario' },
};

export interface TargetInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: Goal;
  hasHealthConditions?: boolean;
}

export interface Targets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  minor_safe_mode: boolean;
  rationale: string;
}

export function bmr({ sex, age, heightCm, weightKg }: Pick<TargetInput, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

const round10 = (n: number) => Math.round(n / 10) * 10;

/** Peso de referencia para la proteína: con IMC > 30 se usa el peso equivalente a IMC 27. */
export function proteinReferenceWeight(weightKg: number, heightCm: number): number {
  const h = heightCm / 100;
  const bmi = weightKg / (h * h);
  return bmi > 30 ? 27 * h * h : weightKg;
}

/** Mínimo absoluto de calorías que nunca se propone por debajo. */
export function calorieFloor(sex: Sex, bmrValue: number): number {
  return Math.max(sex === 'male' ? 1500 : 1300, Math.round(bmrValue * 1.05));
}

/**
 * Objetivos diarios orientativos.
 * - Adultos: Mifflin-St Jeor × actividad; déficit moderado (−15 %, máx. 500 kcal) o superávit (+10 %, máx. 350 kcal).
 * - Menores de 18: SIN déficit ni objetivos de pérdida de peso; energía suficiente para crecer.
 * - Nunca por debajo de un mínimo seguro.
 */
export function computeTargets(input: TargetInput): Targets {
  const minor = isMinor(input.age);
  const goal = safeGoal(input.goal, input.age);
  const base = bmr(input);
  const tdee = base * ACTIVITY_FACTORS[input.activity];

  let calories = tdee;
  const notes: string[] = [];
  if (!minor && goal === 'lose_fat') {
    calories = tdee - Math.min(tdee * 0.15, 500);
    notes.push('Déficit moderado (≈15 %) para perder grasa de forma sostenible.');
  } else if (!minor && goal === 'gain_muscle') {
    calories = tdee + Math.min(tdee * 0.1, 350);
    notes.push('Superávit ligero para ganar músculo con entrenamiento de fuerza.');
  } else {
    notes.push('Calorías de mantenimiento estimadas.');
  }
  if (minor) notes.push('Al ser menor de edad no se fija déficit: la prioridad es comer suficiente y variado. Recomendamos acompañamiento de un profesional de la salud.');
  if (input.hasHealthConditions) notes.push('Indicaste condiciones de salud: valida estos objetivos con tu médico o nutricionista.');

  calories = Math.max(calorieFloor(input.sex, base), round10(calories));

  const refWeight = proteinReferenceWeight(input.weightKg, input.heightCm);
  const proteinPerKg = minor ? 1.2 : goal === 'lose_fat' || goal === 'gain_muscle' ? 1.8 : goal === 'performance' ? 1.6 : 1.4;
  const protein_g = Math.round(refWeight * proteinPerKg);
  const fat_g = Math.round(Math.max((calories * (minor ? 0.3 : 0.28)) / 9, input.weightKg * 0.6));
  const carbs_g = Math.max(0, Math.round((calories - protein_g * 4 - fat_g * 9) / 4));

  return { calories, protein_g, carbs_g, fat_g, minor_safe_mode: minor, rationale: notes.join(' ') };
}

/**
 * Valida un ajuste de calorías propuesto (por la IA o el usuario):
 * cambios moderados (máx. ±10 % y ±250 kcal), nunca por debajo del mínimo, y sin bajar a un menor.
 */
export function clampAdjustment(current: number, proposed: number, floor: number, minor: boolean): number {
  const maxDelta = Math.min(current * 0.1, 250);
  let next = Math.min(current + maxDelta, Math.max(current - maxDelta, proposed));
  if (minor) next = Math.max(next, current);
  return Math.max(floor, round10(next));
}

/** Reparte unas calorías nuevas manteniendo la proteína y recalculando grasa y carbohidratos. */
export function macrosForCalories(calories: number, protein_g: number, weightKg: number) {
  const fat_g = Math.round(Math.max((calories * 0.28) / 9, weightKg * 0.6));
  const carbs_g = Math.max(0, Math.round((calories - protein_g * 4 - fat_g * 9) / 4));
  return { calories, protein_g, carbs_g, fat_g };
}
