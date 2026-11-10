import { useSyncExternalStore } from 'react';

import type { Food } from '@/features/nutrition/foods';

/**
 * Borrador de la receta en edición. Vive en memoria mientras navegas
 * entre el editor y la búsqueda de ingredientes.
 */
export interface RecipeDraft {
  /** Receta a la que pertenece el borrador ('new' para una nueva). */
  forId: string;
  name: string;
  servings: string;
  notes: string;
  ingredients: { food: Food; grams: number }[];
}

const empty = (forId = ''): RecipeDraft => ({ forId, name: '', servings: '1', notes: '', ingredients: [] });

let draft: RecipeDraft = empty();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const emptyDraft = empty;

export const recipeDraft = {
  get: () => draft,
  set(patch: Partial<RecipeDraft>) {
    draft = { ...draft, ...patch };
    emit();
  },
  reset(value: RecipeDraft) {
    draft = value;
    emit();
  },
  addIngredient(food: Food, grams: number) {
    const existing = draft.ingredients.findIndex((i) => i.food.id === food.id);
    const ingredients = [...draft.ingredients];
    if (existing >= 0) ingredients[existing] = { food, grams: ingredients[existing].grams + grams };
    else ingredients.push({ food, grams });
    draft = { ...draft, ingredients };
    emit();
  },
  updateIngredient(index: number, grams: number) {
    draft = { ...draft, ingredients: draft.ingredients.map((i, n) => (n === index ? { ...i, grams } : i)) };
    emit();
  },
  removeIngredient(index: number) {
    draft = { ...draft, ingredients: draft.ingredients.filter((_, n) => n !== index) };
    emit();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useRecipeDraft(): RecipeDraft {
  return useSyncExternalStore(recipeDraft.subscribe, recipeDraft.get, recipeDraft.get);
}
