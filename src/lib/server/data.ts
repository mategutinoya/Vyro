import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { cache } from 'react';

import { addDays, DEFAULT_TZ, todayIn, weekDays } from '@/lib/domain/dates';
import { createClient } from '@/lib/supabase/server';
import type {
  ChangeEntry, ChatMessage, Favorite, Measurement, MealLog, Memory, PlannedMeal, Profile, TargetsRow,
} from '@/lib/types';

import type { OpContext } from './ops';

export interface Session {
  db: SupabaseClient;
  userId: string;
  email: string | null;
  profile: Profile;
  today: string;
}

/** Usuario actual o null (una vez por petición). */
export const loadSession = cache(async (): Promise<Session | null> => {
  // Datos personales y "hoy" dependen de cada petición: nunca se prerenderizan.
  await connection();
  const db = await createClient();
  const { data } = await db.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) return null;
  const { data: profile, error } = await db.from('user_profiles').select('*').eq('id', userId).maybeSingle();
  if (error) {
    // Tablas sin instalar: se explica cómo hacerlo en vez de mostrar un error técnico.
    if (/does not exist|Could not find the table|PGRST205|42P01/i.test(`${error.code} ${error.message}`)) redirect('/configuracion/tablas');
    throw new Error(`No se pudo leer el perfil: ${error.message}`);
  }
  if (!profile) return null;
  const p = profile as Profile;
  return { db, userId, email: (data?.claims?.email as string) ?? null, profile: p, today: todayIn(p.timezone || DEFAULT_TZ) };
});

/** Usuario actual. Redirige a /login si no hay sesión. */
export async function getSession(): Promise<Session> {
  const s = await loadSession();
  if (!s) redirect('/login');
  return s;
}

/** Igual que getSession, pero exige haber completado el perfil inicial. */
export async function getOnboardedSession(): Promise<Session> {
  const s = await getSession();
  if (!s.profile.onboarded_at) redirect('/bienvenida');
  return s;
}

export const opContext = (s: Session, actor: OpContext['actor'] = 'user'): OpContext => ({ db: s.db, userId: s.userId, today: s.today, actor });

const numberish = <T extends Record<string, unknown>>(row: T, keys: string[]): T => {
  const out: Record<string, unknown> = { ...row };
  for (const k of keys) if (out[k] !== null && out[k] !== undefined) out[k] = Number(out[k]);
  return out as T;
};
const MACROS = ['kcal', 'protein_g', 'carbs_g', 'fat_g'];

export async function getTargets(s: Session, date: string): Promise<TargetsRow | null> {
  const { data } = await s.db
    .from('nutrition_targets')
    .select('effective_from, calories, protein_g, carbs_g, fat_g, minor_safe_mode, rationale, source')
    .lte('effective_from', date)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as TargetsRow) ?? null;
}

export interface DayData {
  date: string;
  planNotes: string | null;
  hasPlan: boolean;
  meals: PlannedMeal[];
  logs: MealLog[];
  history: ChangeEntry[];
}

export async function getDay(s: Session, date: string): Promise<DayData> {
  const [plan, meals, logs, history] = await Promise.all([
    s.db.from('meal_plans').select('id, notes').eq('plan_date', date).maybeSingle(),
    s.db.from('planned_meals').select('*').eq('plan_date', date),
    s.db.from('meal_logs').select('*').eq('log_date', date).order('created_at'),
    s.db.from('meal_change_history').select('id, happened_on, entity, action, summary, reason, actor, created_at').eq('happened_on', date).order('created_at', { ascending: false }).limit(50),
  ]);
  const order = ['breakfast', 'mid_morning', 'lunch', 'snack', 'dinner', 'late_snack'];
  return {
    date,
    planNotes: (plan.data as { notes: string | null } | null)?.notes ?? null,
    hasPlan: !!plan.data,
    meals: ((meals.data ?? []) as PlannedMeal[]).map((m) => numberish(m as unknown as Record<string, unknown>, MACROS) as unknown as PlannedMeal).sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot)),
    logs: ((logs.data ?? []) as MealLog[]).map((l) => numberish(l as unknown as Record<string, unknown>, MACROS) as unknown as MealLog),
    history: (history.data ?? []) as ChangeEntry[],
  };
}

export interface WeekDaySummary {
  date: string;
  meals: { slot: string; name: string; status: string; kcal: number | null }[];
  loggedKcal: number;
  extraLogs: number;
}

export async function getWeek(s: Session, monday: string): Promise<WeekDaySummary[]> {
  const days = weekDays(monday);
  const to = days[6];
  const [meals, logs] = await Promise.all([
    s.db.from('planned_meals').select('plan_date, slot, name, status, kcal').gte('plan_date', monday).lte('plan_date', to),
    s.db.from('meal_logs').select('log_date, kcal, planned_meal_id').gte('log_date', monday).lte('log_date', to),
  ]);
  const order = ['breakfast', 'mid_morning', 'lunch', 'snack', 'dinner', 'late_snack'];
  return days.map((date) => {
    const dayLogs = ((logs.data ?? []) as { log_date: string; kcal: number | null; planned_meal_id: string | null }[]).filter((l) => l.log_date === date);
    return {
      date,
      meals: ((meals.data ?? []) as { plan_date: string; slot: string; name: string; status: string; kcal: number | null }[])
        .filter((m) => m.plan_date === date)
        .sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot))
        .map((m) => ({ slot: m.slot, name: m.name, status: m.status, kcal: m.kcal === null ? null : Number(m.kcal) })),
      loggedKcal: dayLogs.reduce((sum, l) => sum + (Number(l.kcal) || 0), 0),
      extraLogs: dayLogs.filter((l) => !l.planned_meal_id).length,
    };
  });
}

export async function getWeekIngredients(s: Session, monday: string) {
  const { data } = await s.db.from('planned_meals').select('ingredients, status').gte('plan_date', monday).lte('plan_date', addDays(monday, 6));
  return ((data ?? []) as { ingredients: { name: string; quantity: number | null; unit: string }[]; status: string }[])
    .filter((m) => m.status !== 'skipped')
    .map((m) => m.ingredients ?? []);
}

export async function getMeasurements(s: Session, limit = 120): Promise<Measurement[]> {
  const { data } = await s.db.from('body_measurements').select('*').order('measured_on', { ascending: false }).limit(limit);
  return ((data ?? []) as Measurement[]).map((m) => numberish(m as unknown as Record<string, unknown>, ['weight_kg', 'body_fat_pct', 'waist_cm']) as unknown as Measurement).reverse();
}

export async function getMemories(s: Session, limit = 60): Promise<Memory[]> {
  const { data } = await s.db.from('user_memories').select('id, kind, content, times_seen, last_seen_at').order('last_seen_at', { ascending: false }).limit(limit);
  return (data ?? []) as Memory[];
}

export async function getFavorites(s: Session): Promise<Favorite[]> {
  const { data } = await s.db.from('favorite_meals').select('*').order('name');
  return ((data ?? []) as Favorite[]).map((f) => numberish(f as unknown as Record<string, unknown>, MACROS) as unknown as Favorite);
}

export async function getChat(s: Session, limit = 60): Promise<ChatMessage[]> {
  const { data } = await s.db.from('chat_messages').select('id, role, content, actions, created_at').order('created_at', { ascending: false }).limit(limit);
  return ((data ?? []) as ChatMessage[]).reverse();
}

export async function getActivity(s: Session, days = 28) {
  const { data } = await s.db.from('activity_logs').select('log_date, kind, description, duration_min, sessions').gte('log_date', addDays(s.today, -days)).order('log_date', { ascending: false });
  return (data ?? []) as { log_date: string; kind: string; description: string; duration_min: number | null; sessions: number | null }[];
}

/** Adherencia de los últimos días: cuántas comidas planificadas se cumplieron, reemplazaron u omitieron. */
export async function getAdherence(s: Session, days = 14) {
  const { data } = await s.db.from('planned_meals').select('status, slot, name').gte('plan_date', addDays(s.today, -days)).lt('plan_date', s.today);
  const rows = (data ?? []) as { status: string; slot: string; name: string }[];
  const count = (st: string) => rows.filter((r) => r.status === st).length;
  return { total: rows.length, completed: count('completed'), replaced: count('replaced'), skipped: count('skipped'), pending: count('planned') };
}
