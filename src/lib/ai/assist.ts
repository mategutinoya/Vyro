import 'server-only';

import { z } from 'zod';

import { ageOn } from '@/lib/domain/dates';
import { summarizeProgress } from '@/lib/domain/progress';
import { isMinor } from '@/lib/domain/safety';
import { mealItemSchema } from '@/lib/domain/schemas';
import { calorieFloor, clampAdjustment, bmr } from '@/lib/domain/targets';
import { getAdherence, getMeasurements, getTargets, type Session } from '@/lib/server/data';

import { AIError, structuredCall } from './client';
import { BOLIVIA_FOOD, SAFETY_RULES } from './prompts';

// ---------------------------------------------------------------------------
// Estimar una comida descrita por el usuario (formulario "Comí otra cosa")
// ---------------------------------------------------------------------------
const ESTIMATE_JSON = {
  type: 'object', additionalProperties: false,
  required: ['items', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'confidence', 'question'],
  properties: {
    items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'quantity', 'unit'], properties: { name: { type: 'string' }, quantity: { type: ['number', 'null'] }, unit: { type: 'string' } } } },
    kcal: { type: 'number' }, protein_g: { type: 'number' }, carbs_g: { type: 'number' }, fat_g: { type: 'number' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    question: { type: ['string', 'null'], description: 'Una pregunta concreta si falta una cantidad importante; null si no hace falta' },
  },
};

const estimateSchema = z.object({
  items: z.array(mealItemSchema).max(20),
  kcal: z.number().min(0).max(5000),
  protein_g: z.number().min(0).max(1000),
  carbs_g: z.number().min(0).max(1000),
  fat_g: z.number().min(0).max(1000),
  confidence: z.enum(['high', 'medium', 'low']),
  question: z.string().max(300).nullable(),
});
export type MealEstimate = z.infer<typeof estimateSchema>;

export async function estimateMeal(description: string): Promise<MealEstimate> {
  const text = description.trim().slice(0, 500);
  if (text.length < 2) throw new AIError('Describe lo que comiste.', 400);
  const raw = await structuredCall({
    system: `Estimas calorías y macronutrientes de comidas descritas en lenguaje natural, con valores habituales de tablas de composición. ${BOLIVIA_FOOD}\n${SAFETY_RULES}\nSi no se indica tamaño, asume una porción típica en Bolivia y bájale la confianza. Responde en español.`,
    user: `Comida: «${text}»`,
    schema: ESTIMATE_JSON,
    effort: 'low',
    maxTokens: 4000,
  });
  const parsed = estimateSchema.safeParse(raw);
  if (!parsed.success) throw new AIError('No se pudo estimar esa comida. Prueba a describirla con más detalle.', 502);
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Revisión del progreso (varias semanas) con sugerencia moderada
// ---------------------------------------------------------------------------
const REVIEW_JSON = {
  type: 'object', additionalProperties: false,
  required: ['headline', 'explanation', 'suggest_calorie_change', 'new_calories', 'reason'],
  properties: {
    headline: { type: 'string', description: 'Una frase' },
    explanation: { type: 'string', description: '3–5 frases sencillas, sin tecnicismos' },
    suggest_calorie_change: { type: 'boolean' },
    new_calories: { type: ['number', 'null'] },
    reason: { type: 'string' },
  },
};

const reviewSchema = z.object({
  headline: z.string().max(200),
  explanation: z.string().max(1500),
  suggest_calorie_change: z.boolean(),
  new_calories: z.number().nullable(),
  reason: z.string().max(600),
});

export interface ReviewResult {
  headline: string;
  explanation: string;
  suggestion: { calories: number; current: number; reason: string } | null;
}

export async function reviewProgress(s: Session): Promise<ReviewResult> {
  const p = s.profile;
  const [weights, targets, adherence] = await Promise.all([getMeasurements(s, 120), getTargets(s, s.today), getAdherence(s, 28)]);
  if (!targets) throw new AIError('Completa tu perfil primero.', 400);
  const points = weights.filter((w) => w.weight_kg !== null).map((w) => ({ date: w.measured_on, weight: w.weight_kg! }));
  const summary = summarizeProgress(points, p.goal);
  const age = p.birth_date ? ageOn(p.birth_date, s.today) : null;
  const minor = isMinor(age) || targets.minor_safe_mode;

  const raw = await structuredCall({
    system: `Eres el nutricionista virtual de Vyro y revisas la evolución semanal del usuario. ${SAFETY_RULES}
- Sólo sugiere cambiar calorías si hay al menos 3 semanas de datos y la tendencia lo justifica de forma clara; los cambios deben ser moderados (máx. ±10 %).
- Considera la adherencia: si casi no se siguió el plan, primero sugiere mejorar la constancia, no bajar calorías.
${minor ? '- El usuario es MENOR DE EDAD: nunca sugieras bajar calorías ni hables de pérdida de peso.' : ''}
Responde en español sencillo.`,
    user: `Objetivo: ${p.goal ?? '—'}. Objetivo diario actual: ${targets.calories} kcal.
Promedios semanales de peso (kg): ${summary.weeks.map((w) => `${w.week}: ${w.average} (${w.count} registros)`).join('; ') || 'sin datos'}.
Tendencia últimas semanas: ${summary.trendKgPerWeek ?? 'sin datos'} kg/semana.
Adherencia 4 semanas: ${adherence.completed} cumplidas, ${adherence.replaced} reemplazadas, ${adherence.skipped} omitidas de ${adherence.total}.`,
    schema: REVIEW_JSON,
    maxTokens: 6000,
  });
  const r = reviewSchema.safeParse(raw);
  if (!r.success) throw new AIError('No se pudo completar la revisión. Inténtalo de nuevo.', 502);

  let suggestion: ReviewResult['suggestion'] = null;
  if (r.data.suggest_calorie_change && r.data.new_calories && summary.enoughForAdjustments && p.sex && p.height_cm && age !== null && points.length) {
    // El servidor recorta cualquier sugerencia a un cambio moderado y seguro.
    const floor = calorieFloor(p.sex, bmr({ sex: p.sex, age, heightCm: Number(p.height_cm), weightKg: points.at(-1)!.weight }));
    const calories = clampAdjustment(targets.calories, r.data.new_calories, floor, minor);
    if (calories !== targets.calories) suggestion = { calories, current: targets.calories, reason: r.data.reason };
  }
  return { headline: r.data.headline, explanation: r.data.explanation, suggestion };
}
