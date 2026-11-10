import { todayISO } from '@/lib/date';

import { isMeal, mealForHour, type Meal } from './api';

export type PickMode = 'log' | 'ingredient';

/** Parámetros que viajan por el flujo buscar → cantidad → guardar. */
export interface FlowParams {
  mode: PickMode;
  date: string;
  meal: Meal;
  recipeId?: string;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function readFlowParams(p: Record<string, string | string[] | undefined>): FlowParams {
  const date = one(p.date);
  const meal = one(p.meal);
  return {
    mode: one(p.mode) === 'ingredient' ? 'ingredient' : 'log',
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO(),
    meal: isMeal(meal) ? meal : mealForHour(new Date().getHours()),
    recipeId: one(p.recipeId),
  };
}

/** Convierte a parámetros de ruta (sólo strings). */
export function flowToParams(f: FlowParams): Record<string, string> {
  const out: Record<string, string> = { mode: f.mode, date: f.date, meal: f.meal };
  if (f.recipeId) out.recipeId = f.recipeId;
  return out;
}
