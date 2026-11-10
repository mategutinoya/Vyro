import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { requireUserId, supabase } from '@/lib/supabase';
import { todayISO } from '@/lib/date';

import type { ActivityLevel, Goal, NutritionTargets, Profile, Sex } from './types';

export const profileKeys = {
  profile: ['profile'] as const,
  targets: (date: string) => ['targets', date] as const,
};

export function useProfile(enabled = true) {
  return useQuery({
    queryKey: profileKeys.profile,
    enabled,
    queryFn: async (): Promise<Profile | null> => {
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, sex, birth_date, height_cm, goal, activity_level, onboarded_at')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

/** Objetivos vigentes en una fecha (el último definido hasta ese día). */
export function useTargets(date: string) {
  return useQuery({
    queryKey: profileKeys.targets(date),
    queryFn: async (): Promise<NutritionTargets | null> => {
      const { data, error } = await supabase
        .from('nutrition_targets')
        .select('calories, protein_g, carbs_g, fat_g, water_ml')
        .lte('effective_from', date)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as NutritionTargets | null;
    },
  });
}

export interface OnboardingInput {
  displayName: string;
  sex: Sex;
  birthDate: string;
  heightCm: number;
  weightKg: number;
  goal: Goal;
  activity: ActivityLevel;
  targets: NutritionTargets;
}

export function useCompleteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: OnboardingInput) => {
      const userId = await requireUserId();
      const today = todayISO();

      const { error: pErr } = await supabase
        .from('profiles')
        .update({
          display_name: input.displayName.trim() || null,
          sex: input.sex,
          birth_date: input.birthDate,
          height_cm: input.heightCm,
          goal: input.goal,
          activity_level: input.activity,
          onboarded_at: new Date().toISOString(),
        })
        .eq('id', userId);
      if (pErr) throw pErr;

      const { error: wErr } = await supabase
        .from('body_weights')
        .upsert({ user_id: userId, measured_on: today, weight_kg: input.weightKg }, { onConflict: 'user_id,measured_on' });
      if (wErr) throw wErr;

      await saveTargets(userId, today, input.targets, false);
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

export async function saveTargets(userId: string, from: string, t: NutritionTargets, isCustom: boolean) {
  const { error } = await supabase
    .from('nutrition_targets')
    .upsert({ user_id: userId, effective_from: from, ...t, is_custom: isCustom }, { onConflict: 'user_id,effective_from' });
  if (error) throw error;
}
