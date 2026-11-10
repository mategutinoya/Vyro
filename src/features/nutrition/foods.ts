import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { requireUserId, supabase } from '@/lib/supabase';

import type { Per100 } from './calc';
import type { OffFood } from './off';
import { searchOpenFoodFacts } from './off';

export interface Food extends Per100 {
  id: string;
  user_id: string | null;
  name: string;
  brand: string | null;
  fiber_per_100g: number | null;
  serving_g: number | null;
  source: 'user' | 'catalog' | 'openfoodfacts';
}

const FOOD_COLS =
  'id, user_id, name, brand, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, serving_g, source';

/** Postgres "numeric" puede llegar como texto: normalizamos a número. */
export function normalizeFood(r: Record<string, unknown>): Food {
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    ...(r as unknown as Food),
    kcal_per_100g: Number(r.kcal_per_100g),
    protein_per_100g: Number(r.protein_per_100g),
    carbs_per_100g: Number(r.carbs_per_100g),
    fat_per_100g: Number(r.fat_per_100g),
    fiber_per_100g: n(r.fiber_per_100g),
    serving_g: n(r.serving_g),
  };
}

export const foodKeys = {
  all: ['foods'] as const,
  search: (q: string) => ['foods', 'search', q] as const,
  recent: ['foods', 'recent'] as const,
  one: (id: string) => ['foods', 'one', id] as const,
  off: (q: string) => ['off', q] as const,
};

/** Busca en los alimentos propios (y el catálogo público, si existe). */
export function useFoodSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: foodKeys.search(q),
    queryFn: async (): Promise<Food[]> => {
      let req = supabase.from('foods').select(FOOD_COLS).order('name').limit(50);
      if (q) req = req.ilike('name', `%${q.replace(/[%_]/g, '')}%`);
      const { data, error } = await req;
      if (error) throw error;
      return (data ?? []).map(normalizeFood);
    },
  });
}

/** Alimentos usados recientemente (a partir del diario), sin repetir. */
export function useRecentFoods() {
  return useQuery({
    queryKey: foodKeys.recent,
    queryFn: async (): Promise<Food[]> => {
      const { data: logs, error } = await supabase
        .from('food_logs')
        .select('food_id, created_at')
        .not('food_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      const ids = [...new Set((logs ?? []).map((l) => l.food_id as string))].slice(0, 12);
      if (!ids.length) return [];
      const { data: foods, error: fErr } = await supabase.from('foods').select(FOOD_COLS).in('id', ids);
      if (fErr) throw fErr;
      const byId = new Map((foods ?? []).map((f) => [f.id as string, normalizeFood(f)]));
      return ids.map((id) => byId.get(id)).filter((f): f is Food => !!f);
    },
  });
}

export function useFood(id: string | undefined) {
  return useQuery({
    queryKey: foodKeys.one(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<Food> => {
      const { data, error } = await supabase.from('foods').select(FOOD_COLS).eq('id', id!).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Este alimento ya no existe.');
      return normalizeFood(data);
    },
  });
}

/** Búsqueda en Open Food Facts (sólo a partir de 3 letras). */
export function useOffSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: foodKeys.off(q.toLowerCase()),
    enabled: q.length >= 3,
    staleTime: 1000 * 60 * 60,
    retry: 0,
    queryFn: ({ signal }) => searchOpenFoodFacts(q, signal),
  });
}

export interface FoodInput {
  name: string;
  brand: string | null;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number | null;
  serving_g: number | null;
}

export function useSaveFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: FoodInput }): Promise<string> => {
      const userId = await requireUserId();
      if (id) {
        const { error } = await supabase.from('foods').update(input).eq('id', id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from('foods')
        .insert({ ...input, user_id: userId, source: 'user' })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: foodKeys.all }),
  });
}

export function useDeleteFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('foods').delete().eq('id', id);
      if (error) {
        if (/foreign key|violates/i.test(error.message))
          throw new Error('Este alimento se usa en una receta. Quítalo de la receta antes de borrarlo.');
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: foodKeys.all }),
  });
}

/**
 * Guarda una copia propia de un producto de Open Food Facts para poder registrarlo,
 * reutilizarlo en recetas y verlo en "Recientes". Si ya se importó, reutiliza la copia.
 */
export async function importOffFood(off: OffFood): Promise<string> {
  const userId = await requireUserId();
  const { data: existing, error: selErr } = await supabase
    .from('foods')
    .select('id')
    .eq('user_id', userId)
    .eq('source', 'openfoodfacts')
    .eq('external_id', off.code)
    .limit(1)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing.id as string;

  const { data, error } = await supabase
    .from('foods')
    .insert({
      user_id: userId,
      source: 'openfoodfacts',
      external_id: off.code,
      barcode: off.code,
      name: off.name,
      brand: off.brand,
      kcal_per_100g: off.kcal_per_100g,
      protein_per_100g: off.protein_per_100g,
      carbs_per_100g: off.carbs_per_100g,
      fat_per_100g: off.fat_per_100g,
      fiber_per_100g: off.fiber_per_100g,
      serving_g: off.serving_g,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}
