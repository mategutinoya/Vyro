import 'server-only';

import { adjustedRemainingTargets } from '@/lib/domain/adjust';
import { addDays, diffDays } from '@/lib/domain/dates';
import { SLOT_LABELS, type Slot } from '@/lib/domain/slots';
import { getDay, getTargets, opContext, type Session } from '@/lib/server/data';
import { OpError, replacePlannedMeal, savePlanForDate, type Actor } from '@/lib/server/ops';

import { AIError } from './client';
import { buildPlannerContext, generateDay, generateMeal, mapLimit } from './planner';

/** Genera y guarda el plan de `days` días a partir de `start`. */
export async function generatePlans(s: Session, start: string, days: number, request: string | null, actor: Actor) {
  if (days < 1 || days > 7) throw new OpError('Se pueden generar entre 1 y 7 días.');
  if (diffDays(start, s.today) < -1 || diffDays(start, s.today) > 14) throw new OpError('Elige una fecha entre hoy y las próximas dos semanas.');
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
  const ctx = await buildPlannerContext(s, start);
  const results = await mapLimit(dates, 3, async (date, i) => {
    try {
      const plan = await generateDay(ctx, date, { request: request ?? undefined, dayIndex: i });
      await savePlanForDate(opContext(s, actor), date, plan.meals, { generatedBy: 'ai', notes: plan.notes || null, reason: request });
      return { date, ok: true as const, names: plan.meals.map((m) => m.name) };
    } catch (err) {
      return { date, ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });
  const okCount = results.filter((r) => r.ok).length;
  if (okCount === 0) throw new AIError((results[0] as { error?: string }).error ?? 'No se pudo generar el plan.', 502);
  return { results, summary: okCount === days ? `Plan creado para ${days === 1 ? 'el día' : `${days} días`}.` : `Plan creado para ${okCount} de ${days} días; vuelve a intentarlo con los que faltan.` };
}

/** Cambia un plato concreto ("no tengo pollo", "no me gustó el almuerzo"). */
export async function swapMeal(s: Session, date: string, slot: Slot, reason: string, avoid: string[], actor: Actor) {
  const day = await getDay(s, date);
  const current = day.meals.find((m) => m.slot === slot);
  if (current && current.status !== 'planned') throw new OpError(`El ${SLOT_LABELS[slot].toLowerCase()} de ese día ya está registrado; no se cambia.`);
  const ctx = await buildPlannerContext(s, date);
  const meal = await generateMeal(ctx, date, slot, { reason, avoid, currentName: current?.name, kcal: current?.kcal ?? undefined });
  return replacePlannedMeal(opContext(s, actor), date, meal, reason);
}

/**
 * Recalcula las comidas pendientes de un día tras una comida más abundante.
 * Regla: como mucho −15 % de lo que quedaba, nunca se elimina una comida ni se propone ayuno.
 */
export async function adjustRemaining(s: Session, date: string, reason: string, actor: Actor) {
  const [day, targets] = await Promise.all([getDay(s, date), getTargets(s, date)]);
  if (!targets) throw new OpError('Primero completa tu perfil.');
  if (targets.minor_safe_mode) return { ok: true as const, summary: 'No ajusto las comidas: lo importante es que comas lo suficiente durante el día.' };
  const consumed = day.logs.reduce((sum, l) => sum + (l.kcal ?? 0), 0);
  const pending = day.meals.filter((m) => m.status === 'planned' && m.kcal !== null);
  if (!pending.length) return { ok: true as const, summary: 'No quedan comidas pendientes ese día.' };
  const next = adjustedRemainingTargets(targets.calories, consumed, pending.map((m) => ({ slot: m.slot, kcal: m.kcal! })));
  const changed = next.filter((n, i) => n.kcal < (pending[i].kcal ?? 0) - 20);
  if (!changed.length) return { ok: true as const, summary: 'Tu día sigue equilibrado: no hace falta cambiar las próximas comidas.' };

  const ctx = await buildPlannerContext(s, date);
  const summaries: string[] = [];
  for (const c of changed) {
    const current = pending.find((m) => m.slot === c.slot)!;
    const meal = await generateMeal(ctx, date, c.slot as Slot, {
      kcal: c.kcal,
      reason: `${reason}. Versión algo más ligera y saciante (más verduras y proteína), sin dejar de ser una comida completa.`,
      currentName: current.name,
    });
    const r = await replacePlannedMeal(opContext(s, actor), date, meal, reason, 'adjusted');
    summaries.push(r.summary);
  }
  return { ok: true as const, summary: `Ajusté con moderación: ${summaries.join(' ')}` };
}
