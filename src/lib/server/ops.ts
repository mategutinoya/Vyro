/**
 * Operaciones que MODIFICAN datos. Son la única vía de escritura de la app:
 * las usan los botones de la interfaz (Server Actions) y las herramientas del
 * asistente de IA. Cada entrada se valida con zod antes de tocar la base de datos,
 * y cada cambio en comidas o planes deja una fila en meal_change_history.
 *
 * Reciben un cliente de Supabase con la sesión del usuario: RLS se aplica siempre.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { addDays, diffDays, relativeDay } from '@/lib/domain/dates';
import {
  activitySchema, measurementSchema, memorySchema, plannedMealSchema, plannedStatusSchema, preferencesSchema,
  recordMealSchema, updateMealLogSchema, ingredientSchema, type PlannedMealInput,
} from '@/lib/domain/schemas';
import { SLOT_LABELS, type Slot } from '@/lib/domain/slots';
import type { MealLog, PlannedMeal } from '@/lib/types';

export type Actor = 'user' | 'assistant' | 'system';

export interface OpContext {
  db: SupabaseClient;
  userId: string;
  today: string; // fecha local del usuario
  actor: Actor;
}

export interface OpResult<T = unknown> {
  ok: true;
  summary: string;
  data?: T;
}

/** Error con mensaje en español pensado para mostrarse al usuario (o devolverse a la IA). */
export class OpError extends Error {}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new OpError(`Datos no válidos${first?.path?.length ? ` (${first.path.join('.')})` : ''}: ${first?.message ?? 'revisa los campos'}`);
  }
  return r.data;
}

function check(error: { message: string } | null, what: string) {
  if (error) throw new OpError(`No se pudo ${what}: ${error.message}`);
}

/** Sólo se permiten fechas cercanas (evita errores de la IA con años o meses). */
function assertDateWindow(ctx: OpContext, date: string, pastDays = 60, futureDays = 14) {
  const d = diffDays(date, ctx.today);
  if (d < -pastDays || d > futureDays) throw new OpError(`La fecha ${date} está fuera del rango permitido.`);
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const es = (n: number) => new Intl.NumberFormat('es-BO', { maximumFractionDigits: 1 }).format(n);

async function logChange(
  ctx: OpContext,
  e: { happened_on: string; entity: string; entity_id?: string | null; action: string; summary: string; before?: unknown; after?: unknown; reason?: string | null },
) {
  const { error } = await ctx.db.from('meal_change_history').insert({
    user_id: ctx.userId,
    happened_on: e.happened_on,
    entity: e.entity,
    entity_id: e.entity_id ?? null,
    action: e.action,
    summary: e.summary,
    before: e.before ?? null,
    after: e.after ?? null,
    reason: e.reason ?? null,
    actor: ctx.actor,
  });
  check(error, 'guardar el historial');
}

async function findPlanned(ctx: OpContext, date: string, slot: Slot): Promise<PlannedMeal | null> {
  const { data, error } = await ctx.db.from('planned_meals').select('*').eq('plan_date', date).eq('slot', slot).maybeSingle();
  check(error, 'leer el plan');
  return (data as PlannedMeal) ?? null;
}

const mealSnapshot = (m: Pick<PlannedMeal, 'name' | 'kcal'> | null) => (m ? { name: m.name, kcal: num(m.kcal) } : null);

// ---------------------------------------------------------------------------
// Registro de comidas
// ---------------------------------------------------------------------------

/**
 * Guarda lo que el usuario comió de verdad. Si había una comida planificada en ese momento:
 * - followed_plan → la marca como cumplida;
 * - replaced_plan → la marca como REEMPLAZADA (no cumplida) y enlaza la comida real.
 */
export async function recordMeal(ctx: OpContext, raw: unknown, source: 'manual' | 'chat' | 'plan' = 'manual'): Promise<OpResult<{ log_id: string }>> {
  const input = parse(recordMealSchema, raw);
  assertDateWindow(ctx, input.date, 60, 1);
  const planned = input.relation_to_plan === 'extra' ? null : await findPlanned(ctx, input.date, input.slot);
  const label = SLOT_LABELS[input.slot].toLowerCase();

  if (input.relation_to_plan === 'followed_plan' && !planned) {
    throw new OpError(`No hay ${label} planificado el ${input.date}; regístralo como comida fuera del plan.`);
  }

  // Si siguió el plan y no se dieron cifras, se usan las del plan.
  const fromPlan = input.relation_to_plan === 'followed_plan' && planned;
  const row = {
    user_id: ctx.userId,
    log_date: input.date,
    slot: input.slot,
    planned_meal_id: planned?.id ?? null,
    description: input.description,
    items: input.items,
    kcal: input.kcal ?? (fromPlan ? num(planned.kcal) : null),
    protein_g: input.protein_g ?? (fromPlan ? num(planned.protein_g) : null),
    carbs_g: input.carbs_g ?? (fromPlan ? num(planned.carbs_g) : null),
    fat_g: input.fat_g ?? (fromPlan ? num(planned.fat_g) : null),
    estimate_confidence: input.confidence,
    needs_details: input.needs_details,
    followed_plan: input.relation_to_plan === 'followed_plan',
    source,
  };
  const { data, error } = await ctx.db.from('meal_logs').insert(row).select('id').single();
  check(error, 'guardar la comida');
  const logId = (data as { id: string }).id;

  if (planned && input.relation_to_plan === 'replaced_plan') {
    const { error: uErr } = await ctx.db.from('planned_meals').update({ status: 'replaced', replaced_by: logId }).eq('id', planned.id);
    check(uErr, 'actualizar el plan');
    await logChange(ctx, {
      happened_on: input.date, entity: 'planned_meal', entity_id: planned.id, action: 'replaced',
      summary: `${SLOT_LABELS[input.slot]}: «${planned.name}» se reemplazó por «${input.description}».`,
      before: mealSnapshot(planned), after: { description: input.description, kcal: row.kcal },
    });
    return { ok: true, summary: `Guardé «${input.description}» como ${label} y marqué «${planned.name}» como reemplazado.`, data: { log_id: logId } };
  }
  if (planned && input.relation_to_plan === 'followed_plan') {
    const { error: uErr } = await ctx.db.from('planned_meals').update({ status: 'completed', replaced_by: null }).eq('id', planned.id);
    check(uErr, 'actualizar el plan');
    await logChange(ctx, {
      happened_on: input.date, entity: 'planned_meal', entity_id: planned.id, action: 'completed',
      summary: `${SLOT_LABELS[input.slot]}: «${planned.name}» cumplido.`, before: { status: planned.status }, after: { status: 'completed' },
    });
    return { ok: true, summary: `Marqué el ${label} «${planned.name}» como cumplido.`, data: { log_id: logId } };
  }
  await logChange(ctx, {
    happened_on: input.date, entity: 'meal_log', entity_id: logId, action: 'created',
    summary: `${SLOT_LABELS[input.slot]}: se registró «${input.description}».`, after: { description: input.description, kcal: row.kcal },
  });
  return { ok: true, summary: `Guardé «${input.description}» como ${label}.`, data: { log_id: logId } };
}

/** Completa o corrige un registro (p. ej. cuando el usuario da las cantidades que faltaban). */
export async function updateMealLog(ctx: OpContext, raw: unknown): Promise<OpResult> {
  const input = parse(updateMealLogSchema, raw);
  const { data: before, error } = await ctx.db.from('meal_logs').select('*').eq('id', input.log_id).maybeSingle();
  check(error, 'leer el registro');
  if (!before) throw new OpError('Ese registro no existe.');
  const b = before as MealLog;
  const patch: Record<string, unknown> = {};
  for (const k of ['description', 'items', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'needs_details'] as const) {
    if (input[k] !== null) patch[k] = input[k];
  }
  if (!Object.keys(patch).length) return { ok: true, summary: 'No había nada que cambiar.' };
  const { error: uErr } = await ctx.db.from('meal_logs').update(patch).eq('id', b.id);
  check(uErr, 'actualizar el registro');
  await logChange(ctx, {
    happened_on: b.log_date, entity: 'meal_log', entity_id: b.id, action: 'edited',
    summary: `${SLOT_LABELS[b.slot]}: se actualizó «${(patch.description as string) ?? b.description}».`,
    before: { description: b.description, kcal: num(b.kcal) }, after: patch,
  });
  return { ok: true, summary: `Actualicé el registro de ${SLOT_LABELS[b.slot].toLowerCase()}.` };
}

/** Elimina un registro. Si había reemplazado o cumplido una comida del plan, ésta vuelve a "planificada". */
export async function deleteMealLog(ctx: OpContext, logId: string): Promise<OpResult> {
  parse(z.string().uuid(), logId);
  const { data, error } = await ctx.db.from('meal_logs').select('*').eq('id', logId).maybeSingle();
  check(error, 'leer el registro');
  if (!data) throw new OpError('Ese registro no existe.');
  const log = data as MealLog;
  if (log.planned_meal_id) {
    const { data: pm } = await ctx.db.from('planned_meals').select('id, status, replaced_by').eq('id', log.planned_meal_id).maybeSingle();
    const p = pm as Pick<PlannedMeal, 'id' | 'status' | 'replaced_by'> | null;
    if (p && (p.replaced_by === log.id || (p.status === 'completed' && log.followed_plan))) {
      const { error: uErr } = await ctx.db.from('planned_meals').update({ status: 'planned', replaced_by: null }).eq('id', p.id);
      check(uErr, 'actualizar el plan');
    }
  }
  const { error: dErr } = await ctx.db.from('meal_logs').delete().eq('id', logId);
  check(dErr, 'eliminar el registro');
  await logChange(ctx, {
    happened_on: log.log_date, entity: 'meal_log', entity_id: log.id, action: 'deleted',
    summary: `${SLOT_LABELS[log.slot]}: se eliminó «${log.description}».`, before: { description: log.description, kcal: num(log.kcal) },
  });
  return { ok: true, summary: `Eliminé «${log.description}».` };
}

/** "Lo comí" / "Lo omití" / "Deshacer" sobre una comida planificada. */
export async function setPlannedStatus(ctx: OpContext, raw: unknown): Promise<OpResult> {
  const input = parse(plannedStatusSchema, raw);
  assertDateWindow(ctx, input.date, 60, 1);
  const planned = await findPlanned(ctx, input.date, input.slot);
  if (!planned) throw new OpError(`No hay ${SLOT_LABELS[input.slot].toLowerCase()} planificado ese día.`);
  if (planned.status === input.status) return { ok: true, summary: 'Ya estaba así.' };

  if (input.status === 'completed') {
    if (planned.status === 'replaced') throw new OpError('Esa comida ya se reemplazó por otra. Elimina el reemplazo si te equivocaste.');
    return recordMeal(ctx, {
      date: input.date, slot: input.slot, description: planned.name,
      items: (planned.ingredients ?? []).map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit })),
      kcal: null, protein_g: null, carbs_g: null, fat_g: null, confidence: 'high', needs_details: false, relation_to_plan: 'followed_plan',
    }, 'plan');
  }

  if (input.status === 'planned') {
    if (planned.status === 'replaced') throw new OpError('Para deshacer un reemplazo, elimina la comida que la reemplazó.');
    // Deshacer: se eliminan los registros creados automáticamente al marcarla como cumplida.
    const { data: logs } = await ctx.db.from('meal_logs').select('id').eq('planned_meal_id', planned.id).eq('followed_plan', true);
    for (const l of (logs ?? []) as { id: string }[]) {
      const { error } = await ctx.db.from('meal_logs').delete().eq('id', l.id);
      check(error, 'deshacer el registro');
    }
  }

  const { error } = await ctx.db.from('planned_meals').update({ status: input.status, replaced_by: null }).eq('id', planned.id);
  check(error, 'actualizar el plan');
  await logChange(ctx, {
    happened_on: input.date, entity: 'planned_meal', entity_id: planned.id,
    action: input.status === 'skipped' ? 'skipped' : 'reopened',
    summary: `${SLOT_LABELS[input.slot]}: «${planned.name}» ${input.status === 'skipped' ? 'omitido' : 'vuelve a estar pendiente'}.`,
    before: { status: planned.status }, after: { status: input.status },
  });
  return { ok: true, summary: input.status === 'skipped' ? `Marqué «${planned.name}» como omitido.` : `«${planned.name}» vuelve a estar pendiente.` };
}

// ---------------------------------------------------------------------------
// Planes
// ---------------------------------------------------------------------------

async function ensurePlan(ctx: OpContext, date: string, generatedBy: 'ai' | 'manual', notes: string | null): Promise<string> {
  const { data: existing, error } = await ctx.db.from('meal_plans').select('id').eq('plan_date', date).maybeSingle();
  check(error, 'leer el plan');
  if (existing) {
    if (notes !== null) await ctx.db.from('meal_plans').update({ notes, generated_by: generatedBy }).eq('id', (existing as { id: string }).id);
    return (existing as { id: string }).id;
  }
  const { data, error: iErr } = await ctx.db.from('meal_plans').insert({ user_id: ctx.userId, plan_date: date, generated_by: generatedBy, notes }).select('id').single();
  check(iErr, 'crear el plan');
  return (data as { id: string }).id;
}

const mealRow = (m: PlannedMealInput) => ({
  name: m.name, description: m.description, ingredients: m.ingredients, instructions: m.instructions,
  kcal: m.kcal, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g,
});

/**
 * Guarda el plan de un día. Las comidas ya cumplidas, reemplazadas u omitidas NO se tocan:
 * sólo se sustituyen las que siguen pendientes.
 */
export async function savePlanForDate(
  ctx: OpContext,
  date: string,
  meals: unknown[],
  opts: { generatedBy: 'ai' | 'manual'; notes: string | null; reason: string | null },
): Promise<OpResult<{ plan_id: string }>> {
  assertDateWindow(ctx, date, 7, 21);
  const parsed = meals.map((m) => parse(plannedMealSchema, m));
  const planId = await ensurePlan(ctx, date, opts.generatedBy, opts.notes);
  const { data: existing, error } = await ctx.db.from('planned_meals').select('*').eq('plan_id', planId);
  check(error, 'leer el plan');
  const bySlot = new Map(((existing ?? []) as PlannedMeal[]).map((m) => [m.slot, m]));
  const before = [...bySlot.values()].map((m) => ({ slot: m.slot, name: m.name, status: m.status }));
  const kept: string[] = [];

  for (const m of parsed) {
    const prev = bySlot.get(m.slot);
    if (prev && prev.status !== 'planned') {
      kept.push(SLOT_LABELS[m.slot].toLowerCase());
      continue;
    }
    if (prev) {
      const { error: uErr } = await ctx.db.from('planned_meals').update(mealRow(m)).eq('id', prev.id);
      check(uErr, 'actualizar el plan');
    } else {
      const { error: iErr } = await ctx.db.from('planned_meals').insert({ user_id: ctx.userId, plan_id: planId, plan_date: date, slot: m.slot, status: 'planned', ...mealRow(m) });
      check(iErr, 'guardar el plan');
    }
  }
  // Momentos pendientes que ya no están en el plan nuevo (p. ej. cambió el número de comidas).
  const newSlots = new Set(parsed.map((m) => m.slot));
  for (const prev of bySlot.values()) {
    if (!newSlots.has(prev.slot) && prev.status === 'planned') {
      const { error: dErr } = await ctx.db.from('planned_meals').delete().eq('id', prev.id);
      check(dErr, 'actualizar el plan');
    }
  }

  await logChange(ctx, {
    happened_on: date, entity: 'meal_plan', entity_id: planId, action: before.length ? 'regenerated' : 'created',
    summary: before.length ? `Plan del día actualizado${kept.length ? ` (se conservaron: ${kept.join(', ')})` : ''}.` : 'Plan del día creado.',
    before: before.length ? before : null, after: parsed.map((m) => ({ slot: m.slot, name: m.name })), reason: opts.reason,
  });
  return { ok: true, summary: before.length ? 'Actualicé el plan del día.' : 'Creé el plan del día.', data: { plan_id: planId } };
}

/** Cambia una comida planificada por otra (cambio de plato, favorito o recalculo). */
export async function replacePlannedMeal(ctx: OpContext, date: string, raw: unknown, reason: string | null, action: 'swapped' | 'adjusted' = 'swapped'): Promise<OpResult> {
  const meal = parse(plannedMealSchema, raw);
  assertDateWindow(ctx, date, 7, 21);
  const prev = await findPlanned(ctx, date, meal.slot);
  if (prev && prev.status !== 'planned') throw new OpError('Esa comida ya está cumplida o reemplazada; no se puede cambiar el plato.');
  const before = mealSnapshot(prev);
  const prevName = prev?.name;
  if (prev) {
    const { error } = await ctx.db.from('planned_meals').update(mealRow(meal)).eq('id', prev.id);
    check(error, 'cambiar el plato');
  } else {
    const planId = await ensurePlan(ctx, date, 'manual', null);
    const { error } = await ctx.db.from('planned_meals').insert({ user_id: ctx.userId, plan_id: planId, plan_date: date, slot: meal.slot, status: 'planned', ...mealRow(meal) });
    check(error, 'guardar el plato');
  }
  await logChange(ctx, {
    happened_on: date, entity: 'planned_meal', entity_id: prev?.id ?? null, action,
    summary: prevName
      ? `${SLOT_LABELS[meal.slot]}: «${prevName}» → «${meal.name}».`
      : `${SLOT_LABELS[meal.slot]}: se añadió «${meal.name}».`,
    before, after: { name: meal.name, kcal: meal.kcal }, reason,
  });
  return { ok: true, summary: prevName ? `Cambié «${prevName}» por «${meal.name}».` : `Añadí «${meal.name}» al plan.` };
}

/** Edición manual de ingredientes de un plato planificado. */
export async function editPlannedIngredients(ctx: OpContext, plannedId: string, rawIngredients: unknown): Promise<OpResult> {
  parse(z.string().uuid(), plannedId);
  const ingredients = parse(z.array(ingredientSchema).min(1).max(15), rawIngredients);
  const { data, error } = await ctx.db.from('planned_meals').select('*').eq('id', plannedId).maybeSingle();
  check(error, 'leer el plato');
  if (!data) throw new OpError('Ese plato no existe.');
  const pm = data as PlannedMeal;
  const { error: uErr } = await ctx.db.from('planned_meals').update({ ingredients }).eq('id', plannedId);
  check(uErr, 'guardar los ingredientes');
  await logChange(ctx, {
    happened_on: pm.plan_date, entity: 'planned_meal', entity_id: pm.id, action: 'edited',
    summary: `${SLOT_LABELS[pm.slot]}: se editaron los ingredientes de «${pm.name}».`,
    before: { ingredients: pm.ingredients }, after: { ingredients },
  });
  return { ok: true, summary: 'Ingredientes actualizados. Las calorías mostradas son las del plato original.' };
}

// ---------------------------------------------------------------------------
// Favoritos
// ---------------------------------------------------------------------------

export async function saveFavoriteFromPlanned(ctx: OpContext, plannedId: string): Promise<OpResult> {
  parse(z.string().uuid(), plannedId);
  const { data, error } = await ctx.db.from('planned_meals').select('*').eq('id', plannedId).maybeSingle();
  check(error, 'leer el plato');
  if (!data) throw new OpError('Ese plato no existe.');
  const pm = data as PlannedMeal;
  const { error: uErr } = await ctx.db.from('favorite_meals').upsert({
    user_id: ctx.userId, name: pm.name, slot: pm.slot, description: pm.description, ingredients: pm.ingredients,
    instructions: pm.instructions, kcal: pm.kcal, protein_g: pm.protein_g, carbs_g: pm.carbs_g, fat_g: pm.fat_g,
  }, { onConflict: 'user_id,name' });
  check(uErr, 'guardar el favorito');
  await remember(ctx, { kind: 'likes', content: `Le gusta el plato «${pm.name}»` });
  return { ok: true, summary: `«${pm.name}» guardado en favoritos.` };
}

export async function applyFavorite(ctx: OpContext, favoriteId: string, date: string, slot: Slot): Promise<OpResult> {
  parse(z.string().uuid(), favoriteId);
  const { data, error } = await ctx.db.from('favorite_meals').select('*').eq('id', favoriteId).maybeSingle();
  check(error, 'leer el favorito');
  if (!data) throw new OpError('Ese favorito no existe.');
  const f = data as { name: string; description: string | null; ingredients: unknown[]; instructions: unknown[]; kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null };
  return replacePlannedMeal(ctx, date, {
    slot, name: f.name, description: f.description ?? '', ingredients: f.ingredients, instructions: f.instructions?.length ? f.instructions : ['Preparar como de costumbre.'],
    kcal: num(f.kcal) ?? 0, protein_g: num(f.protein_g) ?? 0, carbs_g: num(f.carbs_g) ?? 0, fat_g: num(f.fat_g) ?? 0,
  }, 'Elegido de favoritos');
}

// ---------------------------------------------------------------------------
// Mediciones, actividad, preferencias y memoria
// ---------------------------------------------------------------------------

export async function recordMeasurement(ctx: OpContext, raw: unknown, source: 'manual' | 'chat' | 'onboarding' = 'manual'): Promise<OpResult> {
  const input = parse(measurementSchema, raw);
  assertDateWindow(ctx, input.date, 365, 0);
  const { data: existing } = await ctx.db.from('body_measurements').select('*').eq('measured_on', input.date).maybeSingle();
  const e = existing as Record<string, unknown> | null;
  const row = {
    user_id: ctx.userId,
    measured_on: input.date,
    weight_kg: input.weight_kg ?? num(e?.weight_kg),
    body_fat_pct: input.body_fat_pct ?? num(e?.body_fat_pct),
    body_fat_source: input.body_fat_pct !== null ? input.body_fat_source : (e?.body_fat_source as string | null) ?? null,
    waist_cm: input.waist_cm ?? num(e?.waist_cm),
    notes: input.notes ?? (e?.notes as string | null) ?? null,
    is_checkin: input.is_checkin || Boolean(e?.is_checkin),
    source,
  };
  const { error } = await ctx.db.from('body_measurements').upsert(row, { onConflict: 'user_id,measured_on' });
  check(error, 'guardar la medición');
  const parts = [
    row.weight_kg !== null ? `${es(row.weight_kg)} kg` : null,
    row.waist_cm !== null ? `cintura ${es(row.waist_cm)} cm` : null,
    row.body_fat_pct !== null ? `${es(row.body_fat_pct)} % de grasa (${row.body_fat_source === 'self_estimate' ? 'estimado' : 'medido'})` : null,
  ].filter(Boolean);
  return { ok: true, summary: `Registré ${parts.join(', ')} (${relativeDay(input.date, ctx.today).toLowerCase()}).` };
}

export async function deleteMeasurement(ctx: OpContext, id: string): Promise<OpResult> {
  parse(z.string().uuid(), id);
  const { error } = await ctx.db.from('body_measurements').delete().eq('id', id);
  check(error, 'eliminar la medición');
  return { ok: true, summary: 'Medición eliminada.' };
}

export async function recordActivity(ctx: OpContext, raw: unknown, source: 'manual' | 'chat' = 'manual'): Promise<OpResult> {
  const input = parse(activitySchema, raw);
  assertDateWindow(ctx, input.date, 60, 0);
  const { error } = await ctx.db.from('activity_logs').insert({
    user_id: ctx.userId, log_date: input.date, kind: input.kind, description: input.description,
    duration_min: input.duration_min, sessions: input.sessions, source,
  });
  check(error, 'guardar el entrenamiento');
  return {
    ok: true,
    summary: input.kind === 'week_summary'
      ? `Anoté ${input.sessions ?? 0} entrenamientos esta semana.`
      : `Anoté el entrenamiento: ${input.description}.`,
  };
}

const dedupe = (list: string[]) => {
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = x.trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};
const without = (list: string[], remove: string[]) => list.filter((x) => !remove.some((r) => r.trim().toLowerCase() === x.trim().toLowerCase()));

/**
 * Actualiza gustos, alergias, presupuesto o comidas al día.
 * Las alergias sólo se AÑADEN desde el chat; quitarlas exige hacerlo en el perfil (por seguridad).
 */
export async function updatePreferences(ctx: OpContext, raw: unknown): Promise<OpResult> {
  const input = parse(preferencesSchema, raw);
  const { data, error } = await ctx.db.from('user_profiles').select('favorite_foods, disliked_foods, allergies, restrictions').eq('id', ctx.userId).single();
  check(error, 'leer el perfil');
  const p = data as { favorite_foods: string[]; disliked_foods: string[]; allergies: string[]; restrictions: string[] };
  const patch: Record<string, unknown> = {
    favorite_foods: dedupe([...without(p.favorite_foods, [...input.remove_favorite_foods, ...input.add_disliked_foods]), ...input.add_favorite_foods]).slice(0, 30),
    disliked_foods: dedupe([...without(p.disliked_foods, [...input.remove_disliked_foods, ...input.add_favorite_foods]), ...input.add_disliked_foods]).slice(0, 30),
    allergies: dedupe([...p.allergies, ...input.add_allergies]).slice(0, 30),
    restrictions: dedupe([...p.restrictions, ...input.add_restrictions]).slice(0, 30),
  };
  if (input.budget) patch.budget = input.budget;
  if (input.meals_per_day) patch.meals_per_day = input.meals_per_day;
  const { error: uErr } = await ctx.db.from('user_profiles').update(patch).eq('id', ctx.userId);
  check(uErr, 'guardar tus preferencias');
  const changes = [
    input.add_favorite_foods.length && `te gusta: ${input.add_favorite_foods.join(', ')}`,
    input.add_disliked_foods.length && `no te gusta: ${input.add_disliked_foods.join(', ')}`,
    input.add_allergies.length && `alergias: ${input.add_allergies.join(', ')}`,
    input.add_restrictions.length && `restricciones: ${input.add_restrictions.join(', ')}`,
    input.budget && `presupuesto ${input.budget === 'low' ? 'bajo' : input.budget === 'medium' ? 'medio' : 'alto'}`,
    input.meals_per_day && `${input.meals_per_day} comidas al día`,
  ].filter(Boolean);
  return { ok: true, summary: changes.length ? `Actualicé tu perfil (${changes.join('; ')}).` : 'Perfil sin cambios.' };
}

/** Guarda un recuerdo (hábito, gusto, sustitución frecuente…). Si ya existía, suma una aparición. */
export async function remember(ctx: OpContext, raw: unknown): Promise<OpResult> {
  const input = parse(memorySchema, raw);
  const { data } = await ctx.db.from('user_memories').select('id, times_seen').eq('kind', input.kind).ilike('content', input.content.replace(/[%_]/g, ''));
  const found = (data as { id: string; times_seen: number }[] | null)?.[0];
  if (found) {
    const { error } = await ctx.db.from('user_memories').update({ times_seen: found.times_seen + 1, last_seen_at: new Date().toISOString() }).eq('id', found.id);
    check(error, 'actualizar la memoria');
    return { ok: true, summary: 'Lo tenía presente.' };
  }
  const { error } = await ctx.db.from('user_memories').insert({ user_id: ctx.userId, kind: input.kind, content: input.content, source: 'chat' });
  check(error, 'guardar la memoria');
  return { ok: true, summary: `Lo recordaré: ${input.content}.` };
}

export async function forgetMemory(ctx: OpContext, id: string): Promise<OpResult> {
  parse(z.string().uuid(), id);
  const { error } = await ctx.db.from('user_memories').delete().eq('id', id);
  check(error, 'borrar el recuerdo');
  return { ok: true, summary: 'Recuerdo eliminado.' };
}

// ---------------------------------------------------------------------------
// Objetivos
// ---------------------------------------------------------------------------

export async function applyTargets(
  ctx: OpContext,
  t: { calories: number; protein_g: number; carbs_g: number; fat_g: number; minor_safe_mode: boolean; rationale: string },
  source: 'calculated' | 'assistant_adjustment' | 'manual',
): Promise<OpResult> {
  const v = parse(z.object({
    calories: z.number().int().min(1000).max(6000), protein_g: z.number().int().min(0).max(400),
    carbs_g: z.number().int().min(0).max(900), fat_g: z.number().int().min(0).max(300), minor_safe_mode: z.boolean(), rationale: z.string().max(1000),
  }), t);
  const { data: prev } = await ctx.db.from('nutrition_targets').select('calories').lte('effective_from', ctx.today).order('effective_from', { ascending: false }).limit(1).maybeSingle();
  const { error } = await ctx.db.from('nutrition_targets').upsert({ user_id: ctx.userId, effective_from: ctx.today, ...v, source }, { onConflict: 'user_id,effective_from' });
  check(error, 'guardar los objetivos');
  if (prev) {
    await logChange(ctx, {
      happened_on: ctx.today, entity: 'targets', action: 'adjusted',
      summary: `Objetivo diario: ${(prev as { calories: number }).calories} → ${v.calories} kcal.`,
      before: prev, after: v, reason: v.rationale,
    });
  }
  return { ok: true, summary: `Objetivo diario: ${v.calories} kcal, ${v.protein_g} g de proteína.` };
}

export const dateWindowForPlans = (today: string) => ({ from: addDays(today, -7), to: addDays(today, 21) });
