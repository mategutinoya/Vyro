/** Lógica pura de entrenamiento (sin red ni UI). */
import type { WorkoutSet } from './types';

type SetLike = Pick<WorkoutSet, 'reps' | 'weight_kg' | 'completed'>;

/** Volumen = kg × repeticiones de las series completadas. */
export function volumeKg(sets: SetLike[]): number {
  return sets.reduce((s, x) => (x.completed && x.reps && x.weight_kg ? s + x.reps * Number(x.weight_kg) : s), 0);
}

export function completedCount(sets: Pick<WorkoutSet, 'completed'>[]): number {
  return sets.filter((s) => s.completed).length;
}

/** Duración en minutos entre dos instantes (o hasta ahora). */
export function durationMinutes(startISO: string, endISO: string | null, now: number = Date.now()): number {
  const end = endISO ? Date.parse(endISO) : now;
  return Math.max(0, Math.round((end - Date.parse(startISO)) / 60000));
}

/** "1:05:09" o "05:09" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "1 h 5 min" / "45 min" */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Segundos que faltan de descanso (redondeando hacia arriba). */
export function restRemaining(endsAt: number, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** Agrupa las series por ejercicio respetando el orden de la sesión. */
export function groupByExercise<T extends Pick<WorkoutSet, 'exercise_id' | 'exercise_position' | 'set_index'>>(sets: T[]) {
  const map = new Map<string, { exerciseId: string; position: number; sets: T[] }>();
  for (const s of sets) {
    const g = map.get(s.exercise_id) ?? { exerciseId: s.exercise_id, position: s.exercise_position, sets: [] };
    g.position = Math.min(g.position, s.exercise_position);
    g.sets.push(s);
    map.set(s.exercise_id, g);
  }
  return [...map.values()]
    .map((g) => ({ ...g, sets: [...g.sets].sort((a, b) => a.set_index - b.set_index) }))
    .sort((a, b) => a.position - b.position);
}

/**
 * Del historial de series completadas de varios entrenamientos (más recientes primero),
 * devuelve por ejercicio las series de su ÚLTIMA sesión, ordenadas por número de serie.
 */
export function lastPerformance<T extends Pick<WorkoutSet, 'exercise_id' | 'session_id' | 'set_index'>>(
  historyNewestFirst: T[],
): Map<string, T[]> {
  const sessionFor = new Map<string, string>();
  const out = new Map<string, T[]>();
  for (const s of historyNewestFirst) {
    if (!sessionFor.has(s.exercise_id)) sessionFor.set(s.exercise_id, s.session_id);
    if (sessionFor.get(s.exercise_id) !== s.session_id) continue;
    out.set(s.exercise_id, [...(out.get(s.exercise_id) ?? []), s]);
  }
  for (const [k, v] of out) out.set(k, v.sort((a, b) => a.set_index - b.set_index));
  return out;
}

/** 1RM estimado (fórmula de Epley). Útil para la progresión en la etapa de Progreso. */
export function estimated1RM(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

/** Días de la semana ordenados y sin duplicados, en texto: "L · X · V". */
export function weekdaysLabel(days: number[], short: string[]): string {
  return [...new Set(days)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b).map((d) => short[d - 1]).join(' · ');
}
