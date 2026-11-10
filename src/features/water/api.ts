import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { requireUserId, supabase } from '@/lib/supabase';

export interface WaterLog {
  id: string;
  amount_ml: number;
  created_at: string;
}

export const waterKeys = { day: (date: string) => ['water', date] as const };

export function useWaterDay(date: string) {
  return useQuery({
    queryKey: waterKeys.day(date),
    queryFn: async (): Promise<WaterLog[]> => {
      const { data, error } = await supabase
        .from('water_logs')
        .select('id, amount_ml, created_at')
        .eq('log_date', date)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as WaterLog[];
    },
  });
}

export const sumWater = (logs: WaterLog[] | undefined) => (logs ?? []).reduce((s, l) => s + l.amount_ml, 0);

/** Añade agua con actualización optimista (la UI responde al instante). */
export function useAddWater(date: string) {
  const qc = useQueryClient();
  const key = waterKeys.day(date);
  return useMutation({
    mutationFn: async (amount: number) => {
      const userId = await requireUserId();
      const { error } = await supabase.from('water_logs').insert({ user_id: userId, log_date: date, amount_ml: amount });
      if (error) throw error;
    },
    onMutate: async (amount) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<WaterLog[]>(key);
      qc.setQueryData<WaterLog[]>(key, [
        ...(prev ?? []),
        { id: `tmp-${Date.now()}`, amount_ml: amount, created_at: new Date().toISOString() },
      ]);
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

/** Deshace el último registro de agua del día. */
export function useUndoWater(date: string) {
  const qc = useQueryClient();
  const key = waterKeys.day(date);
  return useMutation({
    mutationFn: async () => {
      const logs = qc.getQueryData<WaterLog[]>(key) ?? [];
      const last = logs.filter((l) => !l.id.startsWith('tmp-')).at(-1);
      if (!last) return;
      const { error } = await supabase.from('water_logs').delete().eq('id', last.id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
