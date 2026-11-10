/** Cálculos nutricionales puros (sin red ni UI). Todos los valores de alimentos son por 100 g. */

export interface Per100 {
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
}

export interface Macros {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export const ZERO: Macros = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

const r1 = (n: number) => Math.round(n * 10) / 10;

export function roundMacros(m: Macros): Macros {
  return { kcal: r1(m.kcal), protein_g: r1(m.protein_g), carbs_g: r1(m.carbs_g), fat_g: r1(m.fat_g) };
}

/** Macros de una cantidad en gramos de un alimento. */
export function macrosForGrams(food: Per100, grams: number): Macros {
  const f = grams / 100;
  return roundMacros({
    kcal: Number(food.kcal_per_100g) * f,
    protein_g: Number(food.protein_per_100g) * f,
    carbs_g: Number(food.carbs_per_100g) * f,
    fat_g: Number(food.fat_per_100g) * f,
  });
}

export function addMacros(a: Macros, b: Macros): Macros {
  return { kcal: a.kcal + b.kcal, protein_g: a.protein_g + b.protein_g, carbs_g: a.carbs_g + b.carbs_g, fat_g: a.fat_g + b.fat_g };
}

/**
 * Reescala un registro guardado a una nueva cantidad.
 * Sirve igual para alimentos y recetas porque el registro guarda su "foto" nutricional.
 */
export function scaleMacros(m: Macros, fromGrams: number, toGrams: number): Macros {
  if (fromGrams <= 0) return ZERO;
  const f = toGrams / fromGrams;
  return roundMacros({ kcal: m.kcal * f, protein_g: m.protein_g * f, carbs_g: m.carbs_g * f, fat_g: m.fat_g * f });
}

export interface IngredientLike {
  grams: number;
  food: Per100;
}

export interface RecipeNutrition {
  totalGrams: number;
  total: Macros;
  servings: number;
  gramsPerServing: number;
  perServing: Macros;
}

export function recipeNutrition(ingredients: IngredientLike[], servings: number): RecipeNutrition {
  const total = ingredients.reduce((acc, i) => addMacros(acc, macrosForGrams(i.food, i.grams)), ZERO);
  const totalGrams = ingredients.reduce((s, i) => s + i.grams, 0);
  const sv = servings > 0 ? servings : 1;
  return {
    totalGrams,
    total: roundMacros(total),
    servings: sv,
    gramsPerServing: r1(totalGrams / sv),
    perServing: roundMacros({ kcal: total.kcal / sv, protein_g: total.protein_g / sv, carbs_g: total.carbs_g / sv, fat_g: total.fat_g / sv }),
  };
}

/**
 * Comprueba si las calorías declaradas cuadran con los macros (4/4/9 kcal por gramo).
 * Devuelve la diferencia relativa (0,25 = 25 %). Útil para avisar de errores de escritura.
 */
export function kcalMismatch(food: Per100): number {
  const fromMacros = food.protein_per_100g * 4 + food.carbs_per_100g * 4 + food.fat_per_100g * 9;
  if (food.kcal_per_100g <= 0 && fromMacros <= 0) return 0;
  return Math.abs(fromMacros - food.kcal_per_100g) / Math.max(food.kcal_per_100g, fromMacros);
}
