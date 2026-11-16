/**
 * Ajuste de las comidas restantes del día SIN castigos:
 * - nunca se elimina una comida ni se propone ayuno;
 * - como mucho se reduce un 15 % lo que quedaba planificado;
 * - nunca por debajo de un mínimo por comida.
 */
export const MIN_MEAL_KCAL: Record<string, number> = {
  breakfast: 250, mid_morning: 120, lunch: 350, snack: 120, dinner: 300, late_snack: 80,
};

export interface RemainingPlan {
  slot: string;
  kcal: number;
}

export function adjustedRemainingTargets(dayTarget: number, consumed: number, remaining: RemainingPlan[]): RemainingPlan[] {
  const originalRemaining = remaining.reduce((s, r) => s + r.kcal, 0);
  if (originalRemaining <= 0) return remaining;
  const budget = dayTarget - consumed;
  // Si vamos por debajo o justos, no se toca nada.
  if (budget >= originalRemaining) return remaining;
  const factor = Math.max(0.85, budget / originalRemaining);
  return remaining.map((r) => ({
    slot: r.slot,
    kcal: Math.max(MIN_MEAL_KCAL[r.slot] ?? 100, Math.round((r.kcal * factor) / 10) * 10),
  }));
}
