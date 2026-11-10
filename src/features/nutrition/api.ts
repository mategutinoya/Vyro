import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { requireUserId, supabase } from '@/lib/supabase';

import { scaleMacros, type Macros } from './calc';

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  dinner: 'Cena',
  snack: 'Snacks',
};

export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export function isMeal(v: unknown): v is Meal {
  return typeof v === 'string' && (MEALS as string[]).includes(v);
}

/** Comida sugerida según la hora del día. */
export function mealForHour(h: number): Meal {
  if (h >= 5 && h < 11) return 'breakfast';
  if (h >= 11 && h < 16) return 'lunch';
  if (h >= 19 || h < 2) return 'dinner';
  return 'snack';
}

export interface FoodLog {
  id: string;
  log_date: string;
  food_id: string | null;
  recipe_id: string | null;
  meal: Meal;
  name: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MacroTotals {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export const nutritionKeys = {
  day: (date: string) => ['food_logs', date] as const,
  log: (id: string) => ['food_log', id] as const,
};

const LOG_COLS = 'id, log_date, food_id, recipe_id, meal, name, grams, kcal, protein_g, carbs_g, fat_g';

function normalizeLog(r: Record<string, unknown>): FoodLog {
  return {
    ...(r as unknown as FoodLog),
    grams: Number(r.grams),
    kcal: Number(r.kcal),
    protein_g: Number(r.protein_g),
    carbs_g: Number(r.carbs_g),
    fat_g: Number(r.fat_g),
  };
}

export function useFoodLogsDay(date: string) {
  return useQuery({
    queryKey: nutritionKeys.day(date),
    queryFn: async (): Promise<FoodLog[]> => {
      const { data, error } = await supabase
        .from('food_logs')
        .select(LOG_COLS)
        .eq('log_date', date)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(normalizeLog);
    },
  });
}

export function sumMacros(logs: Pick<FoodLog, 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>[] | undefined): MacroTotals {
  return (logs ?? []).reduce<MacroTotals>(
    (t, l) => ({
      kcal: t.kcal + l.kcal,
      protein_g: t.protein_g + l.protein_g,
      carbs_g: t.carbs_g + l.carbs_g,
      fat_g: t.fat_g + l.fat_g,
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

export function useFoodLog(id: string | undefined) {
  return useQuery({
    queryKey: nutritionKeys.log(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<FoodLog> => {
      const { data, error } = await supabase.from('food_logs').select(LOG_COLS).eq('id', id!).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Este registro ya no existe.');
      return normalizeLog(data);
    },
  });
}

/** Tras cambiar el diario de un día, refresca todo lo que depende de él. */
function invalidateDay(qc: QueryClient, date: string) {
  qc.invalidateQueries({ queryKey: nutritionKeys.day(date) });
  qc.invalidateQueries({ queryKey: ['week_summary'] });
  qc.invalidateQueries({ queryKey: ['foods', 'recent'] });
  qc.invalidateQueries({ queryKey: ['nutrition_stats'] });
}

export interface NewFoodLog extends Macros {
  log_date: string;
  meal: Meal;
  name: string;
  grams: number;
  food_id?: string | null;
  recipe_id?: string | null;
}

export function useAddFoodLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (log: NewFoodLog) => {
      const userId = await requireUserId();
      const { error } = await supabase.from('food_logs').insert({ ...log, user_id: userId });
      if (error) throw error;
    },
    onSuccess: (_d, log) => invalidateDay(qc, log.log_date),
  });
}

/** Cambia cantidad y/o comida de un registro; los macros se reescalan desde su "foto" guardada. */
export function useUpdateFoodLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ log, grams, meal }: { log: FoodLog; grams: number; meal: Meal }) => {
      const m = scaleMacros(log, log.grams, grams);
      const { error } = await supabase.from('food_logs').update({ grams, meal, ...m }).eq('id', log.id);
      if (error) throw error;
    },
    onSuccess: (_d, { log }) => {
      invalidateDay(qc, log.log_date);
      qc.invalidateQueries({ queryKey: nutritionKeys.log(log.id) });
    },
  });
}

export function useDeleteFoodLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (log: Pick<FoodLog, 'id' | 'log_date'>) => {
      const { error } = await supabase.from('food_logs').delete().eq('id', log.id);
      if (error) throw error;
    },
    onMutate: async (log) => {
      // Optimista: desaparece al instante del diario.
      const key = nutritionKeys.day(log.log_date);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<FoodLog[]>(key);
      qc.setQueryData<FoodLog[]>(key, (prev ?? []).filter((l) => l.id !== log.id));
      return { prev };
    },
    onError: (_e, log, ctx) => qc.setQueryData(nutritionKeys.day(log.log_date), ctx?.prev),
    onSettled: (_d, _e, log) => invalidateDay(qc, log.log_date),
  });
}
