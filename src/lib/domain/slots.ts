export const SLOTS = ['breakfast', 'mid_morning', 'lunch', 'snack', 'dinner', 'late_snack'] as const;
export type Slot = (typeof SLOTS)[number];

export const SLOT_LABELS: Record<Slot, string> = {
  breakfast: 'Desayuno',
  mid_morning: 'Media mañana',
  lunch: 'Almuerzo',
  snack: 'Merienda',
  dinner: 'Cena',
  late_snack: 'Colación nocturna',
};

/** Hora orientativa de cada momento (para saber cuál es "la siguiente comida"). */
export const SLOT_HOUR: Record<Slot, number> = {
  breakfast: 7, mid_morning: 10, lunch: 13, snack: 17, dinner: 20, late_snack: 22,
};

/** Momentos del día según el número de comidas elegido. */
export function slotsFor(mealsPerDay: number): Slot[] {
  switch (Math.min(6, Math.max(3, Math.round(mealsPerDay)))) {
    case 3: return ['breakfast', 'lunch', 'dinner'];
    case 4: return ['breakfast', 'lunch', 'snack', 'dinner'];
    case 5: return ['breakfast', 'mid_morning', 'lunch', 'snack', 'dinner'];
    default: return ['breakfast', 'mid_morning', 'lunch', 'snack', 'dinner', 'late_snack'];
  }
}

/** Reparto orientativo de calorías por momento (en Bolivia el almuerzo es la comida principal). */
const WEIGHTS: Record<Slot, number> = { breakfast: 0.22, mid_morning: 0.08, lunch: 0.35, snack: 0.12, dinner: 0.25, late_snack: 0.06 };

export function slotCalories(slots: Slot[], dayCalories: number): Record<Slot, number> {
  const total = slots.reduce((s, x) => s + WEIGHTS[x], 0);
  const out = {} as Record<Slot, number>;
  for (const s of slots) out[s] = Math.round(((dayCalories * WEIGHTS[s]) / total) / 10) * 10;
  return out;
}

export const isSlot = (v: unknown): v is Slot => typeof v === 'string' && (SLOTS as readonly string[]).includes(v);
