import { useQuery } from '@tanstack/react-query';

import { isoWeekday } from '@/lib/date';
import { supabase } from '@/lib/supabase';

export interface TodayWorkout {
  routine: { id: string; name: string; exerciseCount: number } | null;
  /** Sesión ya registrada hoy, si existe. */
  session: { id: string; name: string; ended_at: string | null; completedSets: number } | null;
}

export const workoutKeys = { today: (date: string) => ['workout_today', date] as const };

export function useTodayWorkout(date: string) {
  return useQuery({
    queryKey: workoutKeys.today(date),
    queryFn: async (): Promise<TodayWorkout> => {
      const weekday = isoWeekday(date);

      const { data: routines, error: rErr } = await supabase
        .from('routines')
        .select('id, name, routine_exercises(count)')
        .eq('archived', false)
        .contains('weekdays', [weekday])
        .order('position')
        .limit(1);
      if (rErr) throw rErr;

      // Sesiones iniciadas en el día local consultado.
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const { data: sessions, error: sErr } = await supabase
        .from('workout_sessions')
        .select('id, name, ended_at, workout_sets(count)')
        .gte('started_at', start.toISOString())
        .lt('started_at', end.toISOString())
        .eq('workout_sets.completed', true)
        .order('started_at', { ascending: false })
        .limit(1);
      if (sErr) throw sErr;

      const r = routines?.[0] as { id: string; name: string; routine_exercises: { count: number }[] } | undefined;
      const s = sessions?.[0] as { id: string; name: string; ended_at: string | null; workout_sets: { count: number }[] } | undefined;

      return {
        routine: r ? { id: r.id, name: r.name, exerciseCount: r.routine_exercises?.[0]?.count ?? 0 } : null,
        session: s ? { id: s.id, name: s.name, ended_at: s.ended_at, completedSets: s.workout_sets?.[0]?.count ?? 0 } : null,
      };
    },
  });
}
