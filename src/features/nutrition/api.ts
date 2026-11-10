import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  dinner: 'Cena',
  snack: 'Snacks',
};

export interface FoodLog {
  id: string;
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

export const nutritionKeys = { day: (date: string) => ['food_logs', date] as const };

export function useFoodLogsDay(date: string) {
  return useQuery({
    queryKey: nutritionKeys.day(date),
    queryFn: async (): Promise<FoodLog[]> => {
      const { data, error } = await supabase
        .from('food_logs')
        .select('id, meal, name, grams, kcal, protein_g, carbs_g, fat_g')
        .eq('log_date', date)
        .order('created_at', { ascending: true });
      if (error) throw error;
      // numeric de Postgres llega como número o texto según el driver: normalizamos.
      return (data ?? []).map((r) => ({
        ...r,
        grams: Number(r.grams),
        kcal: Number(r.kcal),
        protein_g: Number(r.protein_g),
        carbs_g: Number(r.carbs_g),
        fat_g: Number(r.fat_g),
      })) as FoodLog[];
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
