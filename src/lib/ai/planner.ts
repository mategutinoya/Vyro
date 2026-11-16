import 'server-only';

import { z } from 'zod';

import { addDays, ageOn, longDate } from '@/lib/domain/dates';
import { isMinor, GOAL_LABELS } from '@/lib/domain/safety';
import { dayPlanSchema, plannedMealSchema, type PlannedMealInput } from '@/lib/domain/schemas';
import { SLOT_LABELS, slotCalories, slotsFor, type Slot } from '@/lib/domain/slots';
import type { Session } from '@/lib/server/data';
import { getFavorites, getMemories, getTargets } from '@/lib/server/data';
import type { TargetsRow } from '@/lib/types';

import { AIError, structuredCall } from './client';
import { BOLIVIA_FOOD, SAFETY_RULES } from './prompts';

const INGREDIENT_JSON = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'quantity', 'unit', 'alternatives'],
  properties: {
    name: { type: 'string', description: 'Ingrediente en español' },
    quantity: { type: ['number', 'null'], description: 'Cantidad orientativa para una persona; null si es "al gusto"' },
    unit: { type: 'string', description: 'g, ml, unidad, taza, cda, cdta…' },
    alternatives: { type: 'array', items: { type: 'string' }, description: '0 a 3 alternativas fáciles de conseguir' },
  },
} as const;

const MEAL_JSON = {
  type: 'object',
  additionalProperties: false,
  required: ['slot', 'name', 'description', 'ingredients', 'instructions', 'kcal', 'protein_g', 'carbs_g', 'fat_g'],
  properties: {
    slot: { type: 'string', enum: ['breakfast', 'mid_morning', 'lunch', 'snack', 'dinner', 'late_snack'] },
    name: { type: 'string', description: 'Nombre corto del plato' },
    description: { type: 'string', description: 'Una frase atractiva' },
    ingredients: { type: 'array', items: INGREDIENT_JSON },
    instructions: { type: 'array', items: { type: 'string' }, description: '2 a 6 pasos sencillos' },
    kcal: { type: 'number' },
    protein_g: { type: 'number' },
    carbs_g: { type: 'number' },
    fat_g: { type: 'number' },
  },
} as const;

const DAY_JSON = {
  type: 'object',
  additionalProperties: false,
  required: ['meals', 'notes'],
  properties: { meals: { type: 'array', items: MEAL_JSON }, notes: { type: 'string', description: 'Consejo breve del día (opcional, una frase)' } },
} as const;

const PLANNER_SYSTEM = `Eres el planificador de comidas de Vyro, un nutricionista virtual. Diseñas menús realistas, sabrosos y variados.
${BOLIVIA_FOOD}

${SAFETY_RULES}

Cómo planificar:
- Ajusta cada comida a las calorías indicadas (±10 %) y reparte bien la proteína a lo largo del día.
- Los valores nutricionales son estimaciones orientativas a partir de tablas habituales; sé coherente con las cantidades.
- Instrucciones cortas y caseras. Ingredientes con cantidades orientativas para UNA persona.
- Ofrece alternativas para los ingredientes menos comunes o más caros.
- Respeta el presupuesto: si es bajo, usa cortes y productos económicos y de temporada.
- Evita repetir platos de los últimos días.
- Responde en español.`;

export interface PlannerContext {
  profileText: string;
  targets: TargetsRow;
  slots: Slot[];
  avoidRecent: string[];
}

/** Resumen del usuario para el planificador (sin datos personales innecesarios). */
export async function buildPlannerContext(s: Session, date: string): Promise<PlannerContext> {
  const p = s.profile;
  const targets = await getTargets(s, date);
  if (!targets) throw new AIError('Completa tu perfil antes de generar un plan.', 400);
  const [memories, favorites, recent] = await Promise.all([
    getMemories(s, 30),
    getFavorites(s),
    s.db.from('planned_meals').select('name').gte('plan_date', addDays(date, -10)).lte('plan_date', addDays(date, 10)).neq('plan_date', date),
  ]);
  const age = p.birth_date ? ageOn(p.birth_date, s.today) : null;
  const lines = [
    `Edad: ${age ?? 'desconocida'}${isMinor(age) ? ' (MENOR DE EDAD: sin restricción calórica)' : ''}. Sexo: ${p.sex === 'male' ? 'hombre' : p.sex === 'female' ? 'mujer' : '—'}.`,
    `Objetivo: ${p.goal ? GOAL_LABELS[p.goal] : '—'}. Entrenamiento: ${p.training_description || '—'} (${p.training_days_per_week ?? 0} días/semana).`,
    `Presupuesto: ${p.budget === 'low' ? 'bajo' : p.budget === 'high' ? 'alto' : 'medio'}. Ciudad: ${p.city || 'Bolivia'}.`,
    `ALERGIAS (nunca incluir): ${p.allergies.join(', ') || 'ninguna'}.`,
    `Restricciones: ${p.restrictions.join(', ') || 'ninguna'}. Condiciones de salud: ${p.health_conditions.join(', ') || 'ninguna indicada'}.`,
    `Le gusta: ${p.favorite_foods.join(', ') || '—'}. No le gusta (evitar): ${p.disliked_foods.join(', ') || '—'}.`,
    favorites.length ? `Platos favoritos guardados: ${favorites.map((f) => f.name).join(', ')}.` : '',
    memories.length ? `Lo que sabemos de sus hábitos:\n${memories.map((m) => `- (${m.kind}) ${m.content}`).join('\n')}` : '',
  ].filter(Boolean);
  return {
    profileText: lines.join('\n'),
    targets,
    slots: slotsFor(p.meals_per_day),
    avoidRecent: [...new Set(((recent.data ?? []) as { name: string }[]).map((r) => r.name))].slice(0, 40),
  };
}

const PROTEIN_ROTATION = ['pollo', 'huevo y lácteos', 'carne de res', 'legumbres (lenteja, frejol o garbanzo)', 'pescado (trucha, pejerrey o atún)', 'cerdo magro o pollo', 'quinua con huevo o queso'];

/** Genera el plan completo de un día. Reintenta una vez si la respuesta no pasa la validación. */
export async function generateDay(ctx: PlannerContext, date: string, opts: { request?: string; dayIndex?: number } = {}): Promise<{ meals: PlannedMealInput[]; notes: string }> {
  const kcal = slotCalories(ctx.slots, ctx.targets.calories);
  const focus = PROTEIN_ROTATION[(opts.dayIndex ?? new Date(`${date}T12:00:00Z`).getUTCDay()) % PROTEIN_ROTATION.length];
  const user = `Datos del usuario:
${ctx.profileText}

Objetivo diario: ${ctx.targets.calories} kcal · proteína ${ctx.targets.protein_g} g · carbohidratos ${ctx.targets.carbs_g} g · grasas ${ctx.targets.fat_g} g.
Planifica el ${longDate(date)} (${date}) con EXACTAMENTE estas comidas y calorías aproximadas:
${ctx.slots.map((s) => `- ${s} (${SLOT_LABELS[s]}): ~${kcal[s]} kcal`).join('\n')}
Proteína principal sugerida para el almuerzo o la cena de este día (para dar variedad): ${focus}.
${ctx.avoidRecent.length ? `No repitas estos platos de días cercanos: ${ctx.avoidRecent.join('; ')}.` : ''}
${opts.request ? `Petición del usuario: «${opts.request}».` : ''}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await structuredCall({ system: PLANNER_SYSTEM, user, schema: DAY_JSON });
    const parsed = dayPlanSchema.safeParse(raw);
    if (!parsed.success) continue;
    const bySlot = new Map(parsed.data.meals.map((m) => [m.slot, m]));
    if (ctx.slots.every((s) => bySlot.has(s))) {
      return { meals: ctx.slots.map((s) => bySlot.get(s)!), notes: parsed.data.notes };
    }
  }
  throw new AIError('No se pudo generar un plan válido. Inténtalo de nuevo.', 502);
}

/** Genera un único plato para un momento del día (cambio de plato o recalculo). */
export async function generateMeal(
  ctx: PlannerContext,
  date: string,
  slot: Slot,
  opts: { kcal?: number; reason: string; avoid?: string[]; currentName?: string },
): Promise<PlannedMealInput> {
  const kcal = opts.kcal ?? slotCalories(ctx.slots, ctx.targets.calories)[slot];
  const user = `Datos del usuario:
${ctx.profileText}

Propón UN plato para ${SLOT_LABELS[slot]} (slot "${slot}") del ${longDate(date)}, de unas ${kcal} kcal.
Motivo del cambio: «${opts.reason}».
${opts.currentName ? `Debe ser distinto de «${opts.currentName}».` : ''}
${opts.avoid?.length ? `No uses: ${opts.avoid.join(', ')}.` : ''}`;
  const schema = { type: 'object', additionalProperties: false, required: ['meal'], properties: { meal: MEAL_JSON } };
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await structuredCall({ system: PLANNER_SYSTEM, user, schema, effort: 'low' });
    const parsed = z.object({ meal: plannedMealSchema }).safeParse(raw);
    if (parsed.success) return { ...parsed.data.meal, slot };
  }
  throw new AIError('No se pudo proponer otro plato. Inténtalo de nuevo.', 502);
}

/** Ejecuta tareas con un máximo de peticiones simultáneas. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}
