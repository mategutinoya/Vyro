import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { normalizeFood, type Food } from '@/features/nutrition/foods';
import { recipeNutrition, type RecipeNutrition } from '@/features/nutrition/calc';
import { requireUserId, supabase } from '@/lib/supabase';

export interface Ingredient {
  food: Food;
  grams: number;
}

export interface Recipe {
  id: string;
  name: string;
  servings: number;
  notes: string | null;
  ingredients: Ingredient[];
  nutrition: RecipeNutrition;
}

export const recipeKeys = {
  all: ['recipes'] as const,
  list: ['recipes', 'list'] as const,
  one: (id: string) => ['recipes', 'one', id] as const,
};

const FOOD_COLS =
  'id, user_id, name, brand, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, serving_g, source';

/** Carga recetas con sus ingredientes y alimentos (3 consultas, sin depender de joins). */
async function loadRecipes(filterId?: string): Promise<Recipe[]> {
  let rq = supabase.from('recipes').select('id, name, servings, notes').order('name');
  if (filterId) rq = rq.eq('id', filterId);
  const { data: recipes, error } = await rq;
  if (error) throw error;
  if (!recipes?.length) return [];

  const ids = recipes.map((r) => r.id as string);
  const { data: ings, error: iErr } = await supabase
    .from('recipe_ingredients')
    .select('recipe_id, food_id, grams, position')
    .in('recipe_id', ids)
    .order('position');
  if (iErr) throw iErr;

  const foodIds = [...new Set((ings ?? []).map((i) => i.food_id as string))];
  const foods = new Map<string, Food>();
  if (foodIds.length) {
    const { data: fs, error: fErr } = await supabase.from('foods').select(FOOD_COLS).in('id', foodIds);
    if (fErr) throw fErr;
    (fs ?? []).forEach((f) => foods.set(f.id as string, normalizeFood(f)));
  }

  return recipes.map((r) => {
    const ingredients = (ings ?? [])
      .filter((i) => i.recipe_id === r.id && foods.has(i.food_id as string))
      .map((i) => ({ food: foods.get(i.food_id as string)!, grams: Number(i.grams) }));
    const servings = Number(r.servings);
    return {
      id: r.id as string,
      name: r.name as string,
      servings,
      notes: (r.notes as string | null) ?? null,
      ingredients,
      nutrition: recipeNutrition(ingredients, servings),
    };
  });
}

export function useRecipes() {
  return useQuery({ queryKey: recipeKeys.list, queryFn: () => loadRecipes() });
}

export function useRecipe(id: string | undefined) {
  return useQuery({
    queryKey: recipeKeys.one(id ?? ''),
    enabled: !!id && id !== 'new',
    queryFn: async () => {
      const [r] = await loadRecipes(id);
      if (!r) throw new Error('Esta receta ya no existe.');
      return r;
    },
  });
}

export interface RecipeInput {
  name: string;
  servings: number;
  notes: string | null;
  ingredients: { foodId: string; grams: number }[];
}

export function useSaveRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: RecipeInput }): Promise<string> => {
      const userId = await requireUserId();
      let recipeId = id;
      const fields = { name: input.name.trim(), servings: input.servings, notes: input.notes };
      if (recipeId) {
        const { error } = await supabase.from('recipes').update(fields).eq('id', recipeId);
        if (error) throw error;
        const { error: dErr } = await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
        if (dErr) throw dErr;
      } else {
        const { data, error } = await supabase.from('recipes').insert({ ...fields, user_id: userId }).select('id').single();
        if (error) throw error;
        recipeId = data.id as string;
      }
      if (input.ingredients.length) {
        const { error } = await supabase.from('recipe_ingredients').insert(
          input.ingredients.map((i, position) => ({ user_id: userId, recipe_id: recipeId, food_id: i.foodId, grams: i.grams, position })),
        );
        if (error) throw error;
      }
      return recipeId!;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: recipeKeys.all }),
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recipes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: recipeKeys.all }),
  });
}
