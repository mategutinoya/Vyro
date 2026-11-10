export type Sex = 'male' | 'female';
export type Goal = 'lose' | 'maintain' | 'gain';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface Profile {
  id: string;
  display_name: string | null;
  sex: Sex | null;
  birth_date: string | null;
  height_cm: number | null;
  goal: Goal | null;
  activity_level: ActivityLevel | null;
  onboarded_at: string | null;
}

export interface NutritionTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_ml: number;
}

export const GOAL_LABELS: Record<Goal, { title: string; detail: string }> = {
  lose: { title: 'Perder grasa', detail: 'Déficit moderado del 20 %' },
  maintain: { title: 'Mantener', detail: 'Calorías de mantenimiento' },
  gain: { title: 'Ganar músculo', detail: 'Superávit ligero del 10 %' },
};

export const ACTIVITY_LABELS: Record<ActivityLevel, { title: string; detail: string }> = {
  sedentary: { title: 'Sedentario', detail: 'Trabajo de oficina, poco movimiento' },
  light: { title: 'Ligero', detail: 'Entrenas 1–3 días por semana' },
  moderate: { title: 'Moderado', detail: 'Entrenas 3–5 días por semana' },
  active: { title: 'Activo', detail: 'Entrenas 6–7 días por semana' },
  very_active: { title: 'Muy activo', detail: 'Trabajo físico + entrenamiento diario' },
};
