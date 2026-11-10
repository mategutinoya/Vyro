import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { requireUserId, supabase } from '@/lib/supabase';

import { lastPerformance } from './logic';
import type { Equipment, Exercise, MuscleGroup, Routine, WorkoutSession, WorkoutSet } from './types';

export const workoutKeys = {
  exercises: ['exercises'] as const,
  routines: ['routines'] as const,
  routine: (id: string) => ['routines', id] as const,
  active: ['workout', 'active'] as const,
  session: (id: string) => ['workout', 'session', id] as const,
  history: ['workout', 'history'] as const,
};

const EX_COLS = 'id, user_id, name, muscle_group, equipment';
const SET_COLS = 'id, session_id, exercise_id, exercise_position, set_index, reps, weight_kg, completed, completed_at';
const SESSION_COLS = 'id, routine_id, name, started_at, ended_at, notes';

const normSet = (r: Record<string, unknown>): WorkoutSet => ({
  ...(r as unknown as WorkoutSet),
  reps: r.reps === null || r.reps === undefined ? null : Number(r.reps),
  weight_kg: r.weight_kg === null || r.weight_kg === undefined ? null : Number(r.weight_kg),
  set_index: Number(r.set_index),
  exercise_position: Number(r.exercise_position ?? 0),
});

/** Refresca todo lo que muestra entrenos (pestaña, Inicio, resumen semanal). */
function invalidateWorkouts(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['workout'] });
  qc.invalidateQueries({ queryKey: ['workout_today'] });
  qc.invalidateQueries({ queryKey: ['week_summary'] });
}

// ---------------------------------------------------------------------------
// Ejercicios
// ---------------------------------------------------------------------------

export function useExercises() {
  return useQuery({
    queryKey: workoutKeys.exercises,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Exercise[]> => {
      const { data, error } = await supabase.from('exercises').select(EX_COLS).order('name');
      if (error) throw error;
      return (data ?? []) as Exercise[];
    },
  });
}

export function useCreateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; muscle_group: MuscleGroup; equipment: Equipment | null }): Promise<Exercise> => {
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from('exercises')
        .insert({ ...input, name: input.name.trim(), user_id: userId })
        .select(EX_COLS)
        .single();
      if (error) throw error;
      return data as Exercise;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: workoutKeys.exercises }),
  });
}

// ---------------------------------------------------------------------------
// Rutinas
// ---------------------------------------------------------------------------

async function loadRoutines(id?: string): Promise<Routine[]> {
  let q = supabase.from('routines').select('id, name, notes, weekdays, position').eq('archived', false).order('position').order('name');
  if (id) q = q.eq('id', id);
  const { data: routines, error } = await q;
  if (error) throw error;
  if (!routines?.length) return [];

  const ids = routines.map((r) => r.id as string);
  const { data: rex, error: rErr } = await supabase
    .from('routine_exercises')
    .select('routine_id, exercise_id, position, target_sets, target_reps, rest_seconds')
    .in('routine_id', ids)
    .order('position');
  if (rErr) throw rErr;

  const exIds = [...new Set((rex ?? []).map((r) => r.exercise_id as string))];
  const exercises = new Map<string, Exercise>();
  if (exIds.length) {
    const { data: ex, error: eErr } = await supabase.from('exercises').select(EX_COLS).in('id', exIds);
    if (eErr) throw eErr;
    (ex ?? []).forEach((e) => exercises.set(e.id as string, e as Exercise));
  }

  return routines.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    notes: (r.notes as string | null) ?? null,
    weekdays: ((r.weekdays as number[] | null) ?? []).map(Number),
    position: Number(r.position ?? 0),
    exercises: (rex ?? [])
      .filter((x) => x.routine_id === r.id && exercises.has(x.exercise_id as string))
      .map((x) => ({
        exercise: exercises.get(x.exercise_id as string)!,
        target_sets: Number(x.target_sets),
        target_reps: x.target_reps === null ? null : Number(x.target_reps),
        rest_seconds: Number(x.rest_seconds),
      })),
  }));
}

export function useRoutines() {
  return useQuery({ queryKey: workoutKeys.routines, queryFn: () => loadRoutines() });
}

export function useRoutine(id: string | undefined) {
  return useQuery({
    queryKey: workoutKeys.routine(id ?? ''),
    enabled: !!id && id !== 'new',
    queryFn: async () => {
      const [r] = await loadRoutines(id);
      if (!r) throw new Error('Esta rutina ya no existe.');
      return r;
    },
  });
}

export interface RoutineInput {
  name: string;
  notes: string | null;
  weekdays: number[];
  exercises: { exerciseId: string; target_sets: number; target_reps: number | null; rest_seconds: number }[];
}

export function useSaveRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: RoutineInput }): Promise<string> => {
      const userId = await requireUserId();
      const fields = { name: input.name.trim(), notes: input.notes, weekdays: [...new Set(input.weekdays)].sort() };
      let routineId = id;
      if (routineId) {
        const { error } = await supabase.from('routines').update(fields).eq('id', routineId);
        if (error) throw error;
        const { error: dErr } = await supabase.from('routine_exercises').delete().eq('routine_id', routineId);
        if (dErr) throw dErr;
      } else {
        const { data, error } = await supabase.from('routines').insert({ ...fields, user_id: userId }).select('id').single();
        if (error) throw error;
        routineId = data.id as string;
      }
      if (input.exercises.length) {
        const { error } = await supabase.from('routine_exercises').insert(
          input.exercises.map((e, position) => ({
            user_id: userId,
            routine_id: routineId,
            exercise_id: e.exerciseId,
            position,
            target_sets: e.target_sets,
            target_reps: e.target_reps,
            rest_seconds: e.rest_seconds,
          })),
        );
        if (error) throw error;
      }
      return routineId!;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workoutKeys.routines });
      qc.invalidateQueries({ queryKey: ['workout_today'] });
    },
  });
}

/** Se archiva (no se borra) para no perder el historial de sesiones hechas con ella. */
export function useArchiveRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('routines').update({ archived: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workoutKeys.routines });
      qc.invalidateQueries({ queryKey: ['workout_today'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Sesiones
// ---------------------------------------------------------------------------

export function useActiveSession() {
  return useQuery({
    queryKey: workoutKeys.active,
    queryFn: async (): Promise<WorkoutSession | null> => {
      const { data, error } = await supabase.from('workout_sessions').select(SESSION_COLS).is('ended_at', null).limit(1).maybeSingle();
      if (error) throw error;
      return (data as WorkoutSession) ?? null;
    },
  });
}

/** Series completadas más recientes de otros entrenamientos para estos ejercicios. */
async function previousSets(exerciseIds: string[], excludeSession?: string) {
  if (!exerciseIds.length) return new Map<string, WorkoutSet[]>();
  let q = supabase
    .from('workout_sets')
    .select(SET_COLS)
    .in('exercise_id', exerciseIds)
    .eq('completed', true)
    .order('completed_at', { ascending: false })
    .limit(300);
  if (excludeSession) q = q.neq('session_id', excludeSession);
  const { data, error } = await q;
  if (error) throw error;
  return lastPerformance((data ?? []).map(normSet));
}

export function useStartSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (routine: Routine | null): Promise<string> => {
      const userId = await requireUserId();

      // Si ya hay uno en curso, se continúa ese.
      const { data: active } = await supabase.from('workout_sessions').select('id').is('ended_at', null).limit(1).maybeSingle();
      if (active) return active.id as string;

      const { data, error } = await supabase
        .from('workout_sessions')
        .insert({ user_id: userId, routine_id: routine?.id ?? null, name: routine?.name ?? 'Entreno libre' })
        .select('id')
        .single();
      if (error) throw error;
      const sessionId = data.id as string;

      if (routine?.exercises.length) {
        // Se precargan peso y repeticiones de la última vez para avanzar más rápido.
        const prev = await previousSets(routine.exercises.map((e) => e.exercise.id));
        const rows = routine.exercises.flatMap((e, position) =>
          Array.from({ length: e.target_sets }, (_, i) => {
            const last = prev.get(e.exercise.id)?.[i] ?? prev.get(e.exercise.id)?.at(-1);
            return {
              user_id: userId,
              session_id: sessionId,
              exercise_id: e.exercise.id,
              exercise_position: position,
              set_index: i,
              reps: last?.reps ?? e.target_reps,
              weight_kg: last?.weight_kg ?? null,
              completed: false,
            };
          }),
        );
        const { error: sErr } = await supabase.from('workout_sets').insert(rows);
        if (sErr) throw sErr;
      }
      return sessionId;
    },
    onSuccess: () => invalidateWorkouts(qc),
  });
}

export interface SessionDetail {
  session: WorkoutSession;
  sets: WorkoutSet[];
  exercises: Map<string, Exercise>;
  previous: Map<string, WorkoutSet[]>;
  /** Descanso configurado en la rutina para cada ejercicio (segundos). */
  rest: Map<string, number>;
}

export function useSession(id: string | undefined) {
  return useQuery({
    queryKey: workoutKeys.session(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<SessionDetail> => {
      const { data: session, error } = await supabase.from('workout_sessions').select(SESSION_COLS).eq('id', id!).maybeSingle();
      if (error) throw error;
      if (!session) throw new Error('Este entrenamiento ya no existe.');

      const { data: sets, error: sErr } = await supabase.from('workout_sets').select(SET_COLS).eq('session_id', id!);
      if (sErr) throw sErr;
      const list = (sets ?? []).map(normSet);
      const exIds = [...new Set(list.map((s) => s.exercise_id))];

      const exercises = new Map<string, Exercise>();
      if (exIds.length) {
        const { data: ex, error: eErr } = await supabase.from('exercises').select(EX_COLS).in('id', exIds);
        if (eErr) throw eErr;
        (ex ?? []).forEach((e) => exercises.set(e.id as string, e as Exercise));
      }

      const rest = new Map<string, number>();
      if (session.routine_id) {
        const { data: rex } = await supabase.from('routine_exercises').select('exercise_id, rest_seconds').eq('routine_id', session.routine_id);
        (rex ?? []).forEach((r) => rest.set(r.exercise_id as string, Number(r.rest_seconds)));
      }

      return { session: session as WorkoutSession, sets: list, exercises, previous: await previousSets(exIds, id), rest };
    },
  });
}

/** Actualiza una serie al instante en pantalla y la guarda en segundo plano. */
export function useUpdateSet(sessionId: string) {
  const qc = useQueryClient();
  const key = workoutKeys.session(sessionId);
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<WorkoutSet, 'reps' | 'weight_kg' | 'completed'>> }) => {
      const body: Record<string, unknown> = { ...patch };
      if (patch.completed !== undefined) body.completed_at = patch.completed ? new Date().toISOString() : null;
      const { error } = await supabase.from('workout_sets').update(body).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<SessionDetail>(key);
      if (prev)
        qc.setQueryData<SessionDetail>(key, {
          ...prev,
          sets: prev.sets.map((s) =>
            s.id === id
              ? { ...s, ...patch, completed_at: patch.completed === undefined ? s.completed_at : patch.completed ? new Date().toISOString() : null }
              : s,
          ),
        });
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(key, ctx.prev),
  });
}

export function useAddSet(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ exerciseId, position, after }: { exerciseId: string; position: number; after?: WorkoutSet }) => {
      const userId = await requireUserId();
      const detail = qc.getQueryData<SessionDetail>(workoutKeys.session(sessionId));
      const existing = detail?.sets.filter((s) => s.exercise_id === exerciseId) ?? [];
      const nextIndex = existing.length ? Math.max(...existing.map((s) => s.set_index)) + 1 : 0;
      const { error } = await supabase.from('workout_sets').insert({
        user_id: userId,
        session_id: sessionId,
        exercise_id: exerciseId,
        exercise_position: position,
        set_index: nextIndex,
        reps: after?.reps ?? null,
        weight_kg: after?.weight_kg ?? null,
        completed: false,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: workoutKeys.session(sessionId) }),
  });
}

export function useDeleteSet(sessionId: string) {
  const qc = useQueryClient();
  const key = workoutKeys.session(sessionId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workout_sets').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<SessionDetail>(key);
      if (prev) qc.setQueryData<SessionDetail>(key, { ...prev, sets: prev.sets.filter((s) => s.id !== id) });
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(key, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

/** Añade un ejercicio al entrenamiento en curso (con una serie vacía). */
export async function addExerciseToSession(sessionId: string, exerciseId: string) {
  const userId = await requireUserId();
  const { data: sets, error } = await supabase.from('workout_sets').select('exercise_id, exercise_position').eq('session_id', sessionId);
  if (error) throw error;
  if ((sets ?? []).some((s) => s.exercise_id === exerciseId)) return;
  const position = (sets ?? []).reduce((m, s) => Math.max(m, Number(s.exercise_position) + 1), 0);
  const prev = await previousSets([exerciseId]);
  const last = prev.get(exerciseId)?.[0];
  const { error: iErr } = await supabase.from('workout_sets').insert({
    user_id: userId,
    session_id: sessionId,
    exercise_id: exerciseId,
    exercise_position: position,
    set_index: 0,
    reps: last?.reps ?? null,
    weight_kg: last?.weight_kg ?? null,
    completed: false,
  });
  if (iErr) throw iErr;
}

export function useFinishSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      // Las series sin completar no cuentan: se eliminan al terminar.
      const { error: dErr } = await supabase.from('workout_sets').delete().eq('session_id', sessionId).eq('completed', false);
      if (dErr) throw dErr;
      const { error } = await supabase.from('workout_sessions').update({ ended_at: new Date().toISOString() }).eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      invalidateWorkouts(qc);
      qc.invalidateQueries({ queryKey: workoutKeys.session(id) });
    },
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.from('workout_sessions').delete().eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => invalidateWorkouts(qc),
  });
}

export interface HistoryItem {
  session: WorkoutSession;
  completedSets: number;
  volumeKg: number;
  exerciseCount: number;
}

export function useSessionHistory(limit = 30) {
  return useQuery({
    queryKey: [...workoutKeys.history, limit],
    queryFn: async (): Promise<HistoryItem[]> => {
      const { data: sessions, error } = await supabase
        .from('workout_sessions')
        .select(SESSION_COLS)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      if (!sessions?.length) return [];
      const { data: sets, error: sErr } = await supabase
        .from('workout_sets')
        .select('session_id, exercise_id, reps, weight_kg, completed')
        .in('session_id', sessions.map((s) => s.id as string))
        .eq('completed', true);
      if (sErr) throw sErr;
      return sessions.map((s) => {
        const mine = (sets ?? []).filter((x) => x.session_id === s.id);
        return {
          session: s as WorkoutSession,
          completedSets: mine.length,
          volumeKg: mine.reduce((v, x) => v + (Number(x.reps) || 0) * (Number(x.weight_kg) || 0), 0),
          exerciseCount: new Set(mine.map((x) => x.exercise_id)).size,
        };
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Inicio: entrenamiento del día
// ---------------------------------------------------------------------------

export interface TodayWorkout {
  routine: { id: string; name: string; exerciseCount: number } | null;
  /** Sesión ya registrada hoy, si existe. */
  session: { id: string; name: string; ended_at: string | null; completedSets: number } | null;
}

export function useTodayWorkout(date: string) {
  return useQuery({
    queryKey: ['workout_today', date],
    queryFn: async (): Promise<TodayWorkout> => {
      const js = new Date(`${date}T00:00:00`).getDay();
      const weekday = js === 0 ? 7 : js;

      const { data: routines, error: rErr } = await supabase
        .from('routines')
        .select('id, name, position')
        .eq('archived', false)
        .contains('weekdays', [weekday])
        .order('position')
        .limit(1);
      if (rErr) throw rErr;
      const r = routines?.[0];
      let exerciseCount = 0;
      if (r) {
        const { count } = await supabase.from('routine_exercises').select('id', { count: 'exact', head: true }).eq('routine_id', r.id);
        exerciseCount = count ?? 0;
      }

      // Sesiones iniciadas en el día local consultado.
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const { data: sessions, error: sErr } = await supabase
        .from('workout_sessions')
        .select('id, name, ended_at, started_at')
        .gte('started_at', start.toISOString())
        .lt('started_at', end.toISOString())
        .order('started_at', { ascending: false })
        .limit(1);
      if (sErr) throw sErr;
      const s = sessions?.[0];
      let completedSets = 0;
      if (s) {
        const { count } = await supabase
          .from('workout_sets')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', s.id)
          .eq('completed', true);
        completedSets = count ?? 0;
      }

      return {
        routine: r ? { id: r.id as string, name: r.name as string, exerciseCount } : null,
        session: s ? { id: s.id as string, name: s.name as string, ended_at: (s.ended_at as string | null) ?? null, completedSets } : null,
      };
    },
  });
}
