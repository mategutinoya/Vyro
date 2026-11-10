import { useQuery } from '@tanstack/react-query';

import { addDays } from '@/lib/date';
import { supabase } from '@/lib/supabase';

export interface WeekSummary {
  /** kcal por día de los últimos 7 días (incluido hoy), del más antiguo al más reciente. */
  days: { date: string; kcal: number }[];
  /** Media de kcal sólo de los días con algún registro. */
  avgKcal: number | null;
  loggedDays: number;
  latestWeight: { kg: number; date: string } | null;
  weightChange: number | null; // vs. registro más antiguo de los últimos 30 días
  workoutsThisWeek: number;
}

export const progressKeys = { week: (date: string) => ['week_summary', date] as const };

export function useWeekSummary(date: string) {
  return useQuery({
    queryKey: progressKeys.week(date),
    queryFn: async (): Promise<WeekSummary> => {
      const from = addDays(date, -6);
      const [logsRes, weightsRes, sessionsRes] = await Promise.all([
        supabase.from('food_logs').select('log_date, kcal').gte('log_date', from).lte('log_date', date),
        supabase
          .from('body_weights')
          .select('measured_on, weight_kg')
          .gte('measured_on', addDays(date, -30))
          .lte('measured_on', date)
          .order('measured_on', { ascending: true }),
        supabase
          .from('workout_sessions')
          .select('id', { count: 'exact', head: true })
          .gte('started_at', new Date(`${from}T00:00:00`).toISOString())
          .not('ended_at', 'is', null),
      ]);
      if (logsRes.error) throw logsRes.error;
      if (weightsRes.error) throw weightsRes.error;
      if (sessionsRes.error) throw sessionsRes.error;

      const byDay = new Map<string, number>();
      for (const l of logsRes.data ?? []) byDay.set(l.log_date, (byDay.get(l.log_date) ?? 0) + Number(l.kcal));
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = addDays(from, i);
        return { date: d, kcal: byDay.get(d) ?? 0 };
      });
      const logged = days.filter((d) => byDay.has(d.date));

      const weights = (weightsRes.data ?? []).map((w) => ({ date: w.measured_on as string, kg: Number(w.weight_kg) }));
      const latest = weights.at(-1) ?? null;
      const first = weights[0];

      return {
        days,
        avgKcal: logged.length ? logged.reduce((s, d) => s + d.kcal, 0) / logged.length : null,
        loggedDays: logged.length,
        latestWeight: latest,
        weightChange: latest && first && first !== latest ? latest.kg - first.kg : null,
        workoutsThisWeek: sessionsRes.count ?? 0,
      };
    },
  });
}
