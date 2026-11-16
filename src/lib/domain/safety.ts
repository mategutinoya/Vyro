/** Reglas de seguridad compartidas por la interfaz, el servidor y las instrucciones de la IA. */

export const MIN_AGE = 13;
export const ADULT_AGE = 18;

export const DISCLAIMER =
  'Vyro ofrece orientación nutricional general. No da diagnósticos ni sustituye a un nutricionista o médico titulado.';

export function isMinor(age: number | null): boolean {
  return age !== null && age < ADULT_AGE;
}

/** Objetivos que puede elegir cada usuario: un menor no puede pedir pérdida de grasa. */
export const GOALS_ADULT = ['lose_fat', 'maintain', 'gain_muscle', 'eat_healthier', 'performance'] as const;
export const GOALS_MINOR = ['eat_healthier', 'maintain', 'performance'] as const;
export type Goal = (typeof GOALS_ADULT)[number];

export const GOAL_LABELS: Record<Goal, string> = {
  lose_fat: 'Perder grasa',
  maintain: 'Mantener mi peso',
  gain_muscle: 'Ganar músculo',
  eat_healthier: 'Comer más sano',
  performance: 'Rendir mejor en mi deporte',
};

export function allowedGoals(age: number | null): readonly Goal[] {
  return isMinor(age) ? GOALS_MINOR : GOALS_ADULT;
}

/** Normaliza un objetivo pedido por un menor a uno seguro. */
export function safeGoal(goal: Goal, age: number | null): Goal {
  if (!isMinor(age)) return goal;
  return goal === 'lose_fat' || goal === 'gain_muscle' ? 'eat_healthier' : goal;
}
