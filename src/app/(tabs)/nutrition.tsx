import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { AppText, Card, DateNavigator, ErrorCard, ProgressBar, Screen, Skeleton } from '@/components/ui';
import { MEALS, sumMacros, useFoodLogsDay } from '@/features/nutrition/api';
import { MealSection } from '@/features/nutrition/components/MealSection';
import { useTargets } from '@/features/profile/api';
import { useToday } from '@/hooks/useToday';
import { fmt } from '@/lib/format';
import { colors, space } from '@/theme/tokens';

export default function NutritionScreen() {
  const today = useToday();
  const [date, setDate] = useState(today);
  const [refreshing, setRefreshing] = useState(false);
  const qc = useQueryClient();

  // Si la app pasa de un día a otro mientras estabas en "hoy", te sigue a la nueva fecha.
  const [lastToday, setLastToday] = useState(today);
  if (today !== lastToday) {
    setLastToday(today);
    if (date === lastToday) setDate(today);
  }

  const logs = useFoodLogsDay(date);
  const targets = useTargets(date);
  const total = sumMacros(logs.data);
  const t = targets.data;

  async function onRefresh() {
    setRefreshing(true);
    await qc.invalidateQueries();
    setRefreshing(false);
  }

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>
      <AppText variant="title">Alimentación</AppText>
      <DateNavigator date={date} onChange={setDate} today={today} />

      {t ? (
        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <AppText variant="caption" color={colors.textSecondary}>Calorías del día</AppText>
            <AppText variant="caption" color={colors.textSecondary} style={{ fontVariant: ['tabular-nums'] }}>
              <AppText variant="bodyStrong">{fmt(total.kcal)}</AppText> / {fmt(t.calories)} kcal
            </AppText>
          </View>
          <ProgressBar progress={total.kcal / t.calories} color={total.kcal > t.calories ? colors.danger : colors.accent} />
          <View style={{ flexDirection: 'row', gap: space.lg }}>
            <Mini label="Proteína" value={total.protein_g} target={t.protein_g} color={colors.protein} />
            <Mini label="Carbos" value={total.carbs_g} target={t.carbs_g} color={colors.carbs} />
            <Mini label="Grasas" value={total.fat_g} target={t.fat_g} color={colors.fat} />
          </View>
        </Card>
      ) : null}

      {logs.error ? (
        <ErrorCard message={logs.error.message} onRetry={() => logs.refetch()} />
      ) : logs.isPending ? (
        <>
          <Skeleton height={90} />
          <Skeleton height={90} />
        </>
      ) : (
        MEALS.map((m) => <MealSection key={m} meal={m} date={date} logs={(logs.data ?? []).filter((l) => l.meal === m)} />)
      )}
    </Screen>
  );
}

function Mini({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>
        {label} <AppText variant="caption" color={colors.text}>{fmt(value)}</AppText>/{fmt(target)}
      </AppText>
      <ProgressBar progress={target ? value / target : 0} color={color} height={4} />
    </View>
  );
}
