import { z } from 'zod';

import { isISODate } from './dates';
import { GOALS_ADULT } from './safety';
import { SLOTS } from './slots';

export const isoDate = z.string().refine(isISODate, 'Fecha no válida (AAAA-MM-DD)');
export const slot = z.enum(SLOTS);
const shortText = (max: number) => z.string().trim().min(1).max(max);
const kcal = z.number().min(0).max(5000);
const grams = z.number().min(0).max(1000);
const textList = z.array(z.string().trim().min(1).max(60)).max(30);

export const ingredientSchema = z.object({
  name: shortText(80),
  quantity: z.number().positive().max(10000).nullable(),
  unit: z.string().trim().max(20),
  alternatives: z.array(z.string().trim().min(1).max(80)).max(4).default([]),
});
export type IngredientInput = z.infer<typeof ingredientSchema>;

export const mealItemSchema = z.object({
  name: shortText(80),
  quantity: z.number().positive().max(10000).nullable(),
  unit: z.string().trim().max(20),
});

export const macrosSchema = z.object({ kcal, protein_g: grams, carbs_g: grams, fat_g: grams });

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------
export const BODY_FAT_SOURCES = ['self_estimate', 'smart_scale', 'bioimpedance', 'skinfold', 'dexa', 'other'] as const;
export const BODY_FAT_SOURCE_LABELS: Record<(typeof BODY_FAT_SOURCES)[number], string> = {
  self_estimate: 'Estimación propia',
  smart_scale: 'Balanza inteligente',
  bioimpedance: 'Bioimpedancia (consulta)',
  skinfold: 'Pliegues cutáneos',
  dexa: 'Densitometría (DEXA)',
  other: 'Otro método',
};

export const profileSchema = z.object({
  display_name: z.string().trim().max(60).default(''),
  birth_date: isoDate,
  sex: z.enum(['male', 'female']),
  height_cm: z.number().min(90).max(250),
  weight_kg: z.number().min(20).max(400),
  body_fat_pct: z.number().min(2).max(70).nullable(),
  body_fat_source: z.enum(BODY_FAT_SOURCES).nullable(),
  goal: z.enum(GOALS_ADULT),
  goal_reason: z.string().trim().max(500).default(''),
  activity_level: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  training_description: z.string().trim().max(500).default(''),
  training_days_per_week: z.number().int().min(0).max(14),
  favorite_foods: textList,
  disliked_foods: textList,
  allergies: textList,
  restrictions: textList,
  health_conditions: textList,
  budget: z.enum(['low', 'medium', 'high']),
  meals_per_day: z.number().int().min(3).max(6),
  checkin_weekday: z.number().int().min(1).max(7),
  city: z.string().trim().max(80).default(''),
}).refine((p) => p.body_fat_pct === null || p.body_fat_source !== null, {
  message: 'Indica de dónde sale el porcentaje de grasa (estimado o medido).',
  path: ['body_fat_source'],
});
export type ProfileInput = z.infer<typeof profileSchema>;

// ---------------------------------------------------------------------------
// Operaciones sobre registros (las usa la interfaz y las herramientas de la IA)
// ---------------------------------------------------------------------------
export const recordMealSchema = z.object({
  date: isoDate,
  slot,
  description: shortText(300),
  items: z.array(mealItemSchema).max(20).default([]),
  kcal: kcal.nullable(),
  protein_g: grams.nullable(),
  carbs_g: grams.nullable(),
  fat_g: grams.nullable(),
  confidence: z.enum(['high', 'medium', 'low']).nullable(),
  needs_details: z.boolean().default(false),
  /** followed_plan: comió lo planificado · replaced_plan: comió otra cosa en lugar del plan · extra: fuera de plan */
  relation_to_plan: z.enum(['followed_plan', 'replaced_plan', 'extra']),
});
export type RecordMealInput = z.infer<typeof recordMealSchema>;

export const updateMealLogSchema = z.object({
  log_id: z.string().uuid(),
  description: shortText(300).nullable(),
  items: z.array(mealItemSchema).max(20).nullable(),
  kcal: kcal.nullable(),
  protein_g: grams.nullable(),
  carbs_g: grams.nullable(),
  fat_g: grams.nullable(),
  needs_details: z.boolean().nullable(),
});

export const plannedStatusSchema = z.object({
  date: isoDate,
  slot,
  status: z.enum(['completed', 'skipped', 'planned']),
});

export const measurementSchema = z.object({
  date: isoDate,
  weight_kg: z.number().min(20).max(400).nullable(),
  body_fat_pct: z.number().min(2).max(70).nullable(),
  body_fat_source: z.enum(BODY_FAT_SOURCES).nullable(),
  waist_cm: z.number().min(30).max(250).nullable(),
  notes: z.string().trim().max(500).nullable(),
  is_checkin: z.boolean().default(false),
}).refine((m) => m.weight_kg !== null || m.body_fat_pct !== null || m.waist_cm !== null, 'Indica al menos un dato.')
  .refine((m) => m.body_fat_pct === null || m.body_fat_source !== null, 'El % de grasa necesita su origen.');
export type MeasurementInput = z.infer<typeof measurementSchema>;

export const activitySchema = z.object({
  date: isoDate,
  kind: z.enum(['session', 'week_summary']),
  description: shortText(300),
  duration_min: z.number().int().min(1).max(600).nullable(),
  sessions: z.number().int().min(0).max(14).nullable(),
});

export const preferencesSchema = z.object({
  add_favorite_foods: textList.default([]),
  add_disliked_foods: textList.default([]),
  add_allergies: textList.default([]),
  add_restrictions: textList.default([]),
  remove_favorite_foods: textList.default([]),
  remove_disliked_foods: textList.default([]),
  budget: z.enum(['low', 'medium', 'high']).nullable().default(null),
  meals_per_day: z.number().int().min(3).max(6).nullable().default(null),
});

export const MEMORY_KINDS = ['likes', 'dislikes', 'habit', 'schedule', 'substitution', 'goal', 'context', 'training'] as const;
export const memorySchema = z.object({ kind: z.enum(MEMORY_KINDS), content: z.string().trim().min(2).max(300) });

// ---------------------------------------------------------------------------
// Salida de la IA al generar comidas
// ---------------------------------------------------------------------------
export const plannedMealSchema = z.object({
  slot,
  name: shortText(120),
  description: z.string().trim().max(400),
  ingredients: z.array(ingredientSchema).min(1).max(15),
  instructions: z.array(z.string().trim().min(1).max(300)).min(1).max(8),
  kcal,
  protein_g: grams,
  carbs_g: grams,
  fat_g: grams,
});
export type PlannedMealInput = z.infer<typeof plannedMealSchema>;

export const dayPlanSchema = z.object({
  meals: z.array(plannedMealSchema).min(3).max(6),
  notes: z.string().trim().max(500),
});
