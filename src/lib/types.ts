import type { Goal } from '@/lib/domain/safety';
import type { Slot } from '@/lib/domain/slots';
import type { Activity, Sex } from '@/lib/domain/targets';

export interface Profile {
  id: string;
  display_name: string | null;
  birth_date: string | null;
  sex: Sex | null;
  height_cm: number | null;
  goal: Goal | null;
  goal_reason: string | null;
  activity_level: Activity | null;
  training_description: string | null;
  training_days_per_week: number | null;
  favorite_foods: string[];
  disliked_foods: string[];
  allergies: string[];
  restrictions: string[];
  health_conditions: string[];
  budget: 'low' | 'medium' | 'high' | null;
  meals_per_day: number;
  checkin_weekday: number | null;
  city: string | null;
  country: string;
  timezone: string;
  onboarded_at: string | null;
}

export interface TargetsRow {
  effective_from: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  minor_safe_mode: boolean;
  rationale: string | null;
  source: string;
}

export interface Ingredient {
  name: string;
  quantity: number | null;
  unit: string;
  alternatives?: string[];
}

export type PlannedStatus = 'planned' | 'completed' | 'replaced' | 'skipped';

export interface PlannedMeal {
  id: string;
  plan_id: string;
  plan_date: string;
  slot: Slot;
  name: string;
  description: string | null;
  ingredients: Ingredient[];
  instructions: string[];
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  status: PlannedStatus;
  replaced_by: string | null;
}

export interface MealLog {
  id: string;
  log_date: string;
  slot: Slot;
  planned_meal_id: string | null;
  description: string;
  items: { name: string; quantity: number | null; unit: string }[];
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  estimate_confidence: 'high' | 'medium' | 'low' | null;
  needs_details: boolean;
  followed_plan: boolean;
  source: string;
  created_at: string;
}

export interface ChangeEntry {
  id: string;
  happened_on: string;
  entity: string;
  action: string;
  summary: string;
  reason: string | null;
  actor: 'user' | 'assistant' | 'system';
  created_at: string;
}

export interface Measurement {
  id: string;
  measured_on: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  body_fat_source: string | null;
  waist_cm: number | null;
  notes: string | null;
  is_checkin: boolean;
}

export interface Memory {
  id: string;
  kind: string;
  content: string;
  times_seen: number;
  last_seen_at: string;
}

export interface Favorite {
  id: string;
  name: string;
  slot: Slot | null;
  description: string | null;
  ingredients: Ingredient[];
  instructions: string[];
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions: { kind: string; summary: string; ok: boolean }[];
  created_at: string;
}
