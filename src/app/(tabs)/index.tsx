import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshControl } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText, Card, ErrorCard, Screen, Skeleton } from '@/components/ui';
import { DemoBadge } from '@/components/DemoBadge';
import { CaloriesCard } from '@/features/dashboard/components/CaloriesCard';
import { MacrosCard } from '@/features/dashboard/components/MacrosCard';
import { WaterCard } from '@/features/dashboard/components/WaterCard';
import { WeekCard } from '@/features/dashboard/components/WeekCard';
import { WorkoutCard } from '@/features/dashboard/components/WorkoutCard';
import { sumMacros, useFoodLogsDay } from '@/features/nutrition/api';
import { useProfile, useTargets } from '@/features/profile/api';
import { useWeekSummary } from '@/features/progress/api';
import { sumWater, useAddWater, useUndoWater, useWaterDay } from '@/features/water/api';
import { useTodayWorkout } from '@/features/workouts/api';
import { useToday } from '@/hooks/useToday';
import { formatLongDate, greeting } from '@/lib/date';
import { colors, space } from '@/theme/tokens';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const enter = (i: number) => FadeInDown.delay(60 * i).duration(450);

export default function HomeScreen() {
  const today = useToday();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const profile = useProfile();
  const targets = useTargets(today);
  const food = useFoodLogsDay(today);
  const water = useWaterDay(today);
  const workout = useTodayWorkout(today);
  const week = useWeekSummary(today);
  const addWater = useAddWater(today);
  const undoWater = useUndoWater(today);

  async function onRefresh() {
    setRefreshing(true);
    await qc.invalidateQueries();
    setRefreshing(false);
  }

  const totals = sumMacros(food.data);
  const t = targets.data;
  const firstName = profile.data?.display_name?.split(' ')[0];
  const coreError = targets.error ?? food.error;

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>
      <Animated.View entering={enter(0)} style={{ gap: 2, marginBottom: space.sm }}>
        <DemoBadge />
        <AppText variant="caption" color={colors.textSecondary}>
          {capitalize(formatLongDate(today))}
        </AppText>
        <AppText variant="title">
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </AppText>
      </Animated.View>

      {coreError ? (
        <ErrorCard message={coreError.message} onRetry={onRefresh} />
      ) : targets.isPending || food.isPending ? (
        <>
          <Skeleton height={188} />
          <Skeleton height={150} />
        </>
      ) : !t ? (
        <Card style={{ gap: space.md }}>
          <AppText variant="heading">Sin objetivos definidos</AppText>
          <AppText color={colors.textSecondary}>No hay objetivos nutricionales vigentes para hoy.</AppText>
        </Card>
      ) : (
        <>
          <Animated.View entering={enter(1)}>
            <CaloriesCard consumed={totals.kcal} target={t.calories} />
          </Animated.View>
          <Animated.View entering={enter(2)}>
            <MacrosCard protein={[totals.protein_g, t.protein_g]} carbs={[totals.carbs_g, t.carbs_g]} fat={[totals.fat_g, t.fat_g]} />
          </Animated.View>
        </>
      )}

      <Animated.View entering={enter(3)}>
        {water.error ? (
          <ErrorCard message={water.error.message} onRetry={() => water.refetch()} />
        ) : (
          <WaterCard
            consumedMl={sumWater(water.data)}
            targetMl={t?.water_ml ?? 0}
            onAdd={(ml) => addWater.mutate(ml)}
            onUndo={() => undoWater.mutate()}
            canUndo={(water.data?.length ?? 0) > 0 && !undoWater.isPending}
          />
        )}
        {addWater.error ? (
          <AppText variant="caption" color={colors.danger} style={{ marginTop: space.xs }}>
            No se guardó el agua: {addWater.error.message}
          </AppText>
        ) : null}
      </Animated.View>

      <Animated.View entering={enter(4)}>
        {workout.data ? <WorkoutCard data={workout.data} /> : workout.error ? <ErrorCard message={workout.error.message} /> : <Skeleton height={110} />}
      </Animated.View>

      <Animated.View entering={enter(5)}>
        {week.data ? (
          <WeekCard data={week.data} targetKcal={t?.calories ?? 0} />
        ) : week.error ? (
          <ErrorCard message={week.error.message} />
        ) : (
          <Skeleton height={190} />
        )}
      </Animated.View>
    </Screen>
  );
}

