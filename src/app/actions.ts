'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { ageOn } from '@/lib/domain/dates';
import { MIN_AGE, safeGoal } from '@/lib/domain/safety';
import { profileSchema, recordMealSchema, type ProfileInput } from '@/lib/domain/schemas';
import { isSlot } from '@/lib/domain/slots';
import { bmr, calorieFloor, clampAdjustment, computeTargets, macrosForCalories } from '@/lib/domain/targets';
import { getMeasurements, getSession, getTargets, opContext } from '@/lib/server/data';
import {
  applyFavorite, applyTargets, deleteMealLog, deleteMeasurement, editPlannedIngredients, forgetMemory, OpError,
  recordActivity, recordMeal, recordMeasurement, saveFavoriteFromPlanned, setPlannedStatus,
} from '@/lib/server/ops';

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

/** Ejecuta una operación y convierte errores en mensajes para la interfaz. */
async function run(fn: () => Promise<{ summary?: string } | void>): Promise<ActionResult> {
  try {
    const r = await fn();
    refresh();
    return { ok: true, message: r && 'summary' in r ? r.summary : undefined };
  } catch (err) {
    if (err instanceof OpError) return { ok: false, error: err.message };
    if (err && typeof err === 'object' && 'digest' in err) throw err; // redirect()
    console.error('[action]', err);
    return { ok: false, error: 'Algo salió mal. Inténtalo de nuevo.' };
  }
}

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------
export async function saveProfile(raw: ProfileInput, opts: { recalc: boolean }): Promise<{ error?: string }> {
  const s = await getSession();
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Revisa los datos.' };
  const p = parsed.data;
  const age = ageOn(p.birth_date, s.today);
  if (age < MIN_AGE) return { error: `Vyro es para mayores de ${MIN_AGE} años.` };
  const goal = safeGoal(p.goal, age);
  const first = !s.profile.onboarded_at;

  const { error } = await s.db.from('user_profiles').update({
    display_name: p.display_name || null, birth_date: p.birth_date, sex: p.sex, height_cm: p.height_cm, goal,
    goal_reason: p.goal_reason || null, activity_level: p.activity_level, training_description: p.training_description || null,
    training_days_per_week: p.training_days_per_week, favorite_foods: p.favorite_foods, disliked_foods: p.disliked_foods,
    allergies: p.allergies, restrictions: p.restrictions, health_conditions: p.health_conditions, budget: p.budget,
    meals_per_day: p.meals_per_day, checkin_weekday: p.checkin_weekday, city: p.city || null,
    ...(first ? { onboarded_at: new Date().toISOString() } : {}),
  }).eq('id', s.userId);
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  const ctx = opContext(s, 'user');
  try {
    if (first) {
      await recordMeasurement(ctx, {
        date: s.today, weight_kg: p.weight_kg, body_fat_pct: age < 18 ? null : p.body_fat_pct,
        body_fat_source: age < 18 ? null : p.body_fat_source, waist_cm: null, notes: null, is_checkin: true,
      }, 'onboarding');
    }
    if (first || opts.recalc) {
      const latest = (await getMeasurements(s, 30)).filter((m) => m.weight_kg !== null).at(-1)?.weight_kg ?? p.weight_kg;
      const t = computeTargets({ sex: p.sex, age, heightCm: p.height_cm, weightKg: latest, activity: p.activity_level, goal, hasHealthConditions: p.health_conditions.length > 0 });
      await applyTargets(ctx, t, 'calculated');
    }
  } catch (err) {
    return { error: err instanceof OpError ? err.message : 'No se pudieron calcular tus objetivos.' };
  }
  if (first) redirect('/hoy?nuevo=1');
  refresh();
  return {};
}

// ---------------------------------------------------------------------------
// Comidas
// ---------------------------------------------------------------------------
export async function setMealStatus(date: string, slot: string, status: 'completed' | 'skipped' | 'planned') {
  const s = await getSession();
  return run(() => setPlannedStatus(opContext(s), { date, slot, status }));
}

export async function logMeal(raw: unknown) {
  const s = await getSession();
  return run(() => recordMeal(opContext(s), recordMealSchema.parse(raw)));
}

export async function removeMealLog(id: string) {
  const s = await getSession();
  return run(() => deleteMealLog(opContext(s), id));
}

export async function updateIngredients(plannedId: string, ingredients: unknown) {
  const s = await getSession();
  return run(() => editPlannedIngredients(opContext(s), plannedId, ingredients));
}

export async function addFavorite(plannedId: string) {
  const s = await getSession();
  return run(() => saveFavoriteFromPlanned(opContext(s), plannedId));
}

export async function applyFavoriteAction(favoriteId: string, date: string, slot: string) {
  const s = await getSession();
  if (!isSlot(slot)) return { ok: false, error: 'Momento no válido.' } as ActionResult;
  return run(() => applyFavorite(opContext(s), favoriteId, date, slot));
}

export async function removeFavorite(id: string) {
  const s = await getSession();
  return run(async () => {
    const { error } = await s.db.from('favorite_meals').delete().eq('id', z.string().uuid().parse(id));
    if (error) throw new OpError(error.message);
    return { summary: 'Favorito eliminado.' };
  });
}

// ---------------------------------------------------------------------------
// Mediciones, actividad, memoria
// ---------------------------------------------------------------------------
export async function saveMeasurement(raw: unknown) {
  const s = await getSession();
  return run(() => recordMeasurement(opContext(s), raw));
}

export async function removeMeasurement(id: string) {
  const s = await getSession();
  return run(() => deleteMeasurement(opContext(s), id));
}

export async function saveActivity(raw: unknown) {
  const s = await getSession();
  return run(() => recordActivity(opContext(s), raw));
}

export async function removeMemory(id: string) {
  const s = await getSession();
  return run(() => forgetMemory(opContext(s), id));
}

/** Aplica un ajuste de calorías sugerido en la revisión. Se vuelve a validar en el servidor. */
export async function applyCalorieAdjustment(calories: number, reason: string) {
  const s = await getSession();
  return run(async () => {
    const p = s.profile;
    const t = await getTargets(s, s.today);
    const weights = (await getMeasurements(s, 30)).filter((m) => m.weight_kg !== null);
    if (!t || !p.sex || !p.height_cm || !p.birth_date || !weights.length) throw new OpError('Faltan datos para ajustar.');
    if (weights.length < 3) throw new OpError('Hacen falta al menos 3 semanas de controles para ajustar.');
    const age = ageOn(p.birth_date, s.today);
    const weight = weights.at(-1)!.weight_kg!;
    const floor = calorieFloor(p.sex, bmr({ sex: p.sex, age, heightCm: Number(p.height_cm), weightKg: weight }));
    const next = clampAdjustment(t.calories, Number(calories), floor, t.minor_safe_mode || age < 18);
    if (next === t.calories) throw new OpError('El ajuste no cambia tus objetivos.');
    return applyTargets(opContext(s), { ...macrosForCalories(next, t.protein_g, weight), minor_safe_mode: t.minor_safe_mode, rationale: `Ajuste moderado tras revisión: ${reason}`.slice(0, 1000) }, 'assistant_adjustment');
  });
}

// ---------------------------------------------------------------------------
// Cuenta
// ---------------------------------------------------------------------------
export async function deleteAccount(confirmText: string): Promise<ActionResult> {
  if (confirmText.trim().toUpperCase() !== 'ELIMINAR') return { ok: false, error: 'Escribe ELIMINAR para confirmar.' };
  const s = await getSession();
  const { error } = await s.db.rpc('delete_my_account');
  if (error) return { ok: false, error: `No se pudo eliminar la cuenta: ${error.message}` };
  await s.db.auth.signOut();
  redirect('/login');
}

export async function clearChat(): Promise<ActionResult> {
  const s = await getSession();
  return run(async () => {
    const { error } = await s.db.from('chat_messages').delete().eq('user_id', s.userId);
    if (error) throw new OpError(error.message);
    return { summary: 'Conversación borrada. Tu memoria y registros se conservan.' };
  });
}
