import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText, Button, Card, Divider, ErrorCard, ListRow, PressableScale, Screen, Skeleton } from '@/components/ui';
import { useActiveSession, useRoutines, useSessionHistory, useStartSession } from '@/features/workouts/api';
import { durationMinutes, formatDuration, weekdaysLabel } from '@/features/workouts/logic';
import { WEEKDAY_SHORT, type Routine } from '@/features/workouts/types';
import { useToday } from '@/hooks/useToday';
import { isoWeekday } from '@/lib/date';
import { fmt } from '@/lib/format';
import { colors, radius, space } from '@/theme/tokens';

export default function WorkoutsScreen() {
  const today = useToday();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const active = useActiveSession();
  const routines = useRoutines();
  const history = useSessionHistory(5);
  const start = useStartSession();

  const weekday = isoWeekday(today);
  const todays = (routines.data ?? []).filter((r) => r.weekdays.includes(weekday));

  async function begin(r: Routine | null) {
    const id = await start.mutateAsync(r);
    router.push({ pathname: '/workout/session/[id]', params: { id } });
  }

  async function onRefresh() {
    setRefreshing(true);
    await qc.invalidateQueries();
    setRefreshing(false);
  }

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>
      <AppText variant="title">Entrenamiento</AppText>

      {active.data ? (
        <Animated.View entering={FadeInDown.duration(300)}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Continuar entrenamiento en curso"
            onPress={() => router.push({ pathname: '/workout/session/[id]', params: { id: active.data!.id } })}
            style={{ backgroundColor: colors.accent, borderRadius: radius.lg, padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <AppText variant="overline" color={colors.onAccent}>En curso · {formatDuration(durationMinutes(active.data.started_at, null))}</AppText>
              <AppText variant="heading" color={colors.onAccent}>{active.data.name}</AppText>
            </View>
            <AppText variant="bodyStrong" color={colors.onAccent}>Continuar ›</AppText>
          </PressableScale>
        </Animated.View>
      ) : null}

      {!active.data && todays.length > 0 ? (
        <Card style={{ gap: space.md }}>
          <AppText variant="overline" color={colors.accent}>Hoy toca</AppText>
          {todays.map((r) => (
            <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <AppText variant="heading">{r.name}</AppText>
                <AppText variant="caption" color={colors.textSecondary}>{r.exercises.length} ejercicios</AppText>
              </View>
              <Button title="Empezar" onPress={() => begin(r)} loading={start.isPending} style={{ height: 44 }} />
            </View>
          ))}
        </Card>
      ) : null}

      {start.error ? <AppText variant="caption" color={colors.danger}>No se pudo empezar: {start.error.message}</AppText> : null}

      <Card style={{ paddingVertical: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.xs }}>
          <AppText variant="overline" color={colors.textSecondary} style={{ flex: 1 }}>Mis rutinas</AppText>
          <AppText variant="bodyStrong" color={colors.accent} suppressHighlighting accessibilityRole="button"
            onPress={() => router.push({ pathname: '/workout/routine/[id]', params: { id: 'new' } })}>
            + Nueva
          </AppText>
        </View>
        {routines.error ? (
          <ErrorCard message={routines.error.message} onRetry={() => routines.refetch()} />
        ) : routines.isPending ? (
          <Skeleton height={60} />
        ) : routines.data!.length === 0 ? (
          <AppText variant="caption" color={colors.textSecondary} style={{ paddingVertical: space.md }}>
            Crea tu primera rutina: elige ejercicios, series, repeticiones, descanso y los días en que la haces.
          </AppText>
        ) : (
          routines.data!.map((r, i) => (
            <View key={r.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={r.name}
                subtitle={[`${r.exercises.length} ejercicios`, weekdaysLabel(r.weekdays, WEEKDAY_SHORT)].filter(Boolean).join(' · ')}
                onPress={() => router.push({ pathname: '/workout/routine/[id]', params: { id: r.id } })}
                accessibilityLabel={`Editar rutina ${r.name}`}
                right={
                  !active.data ? (
                    <PressableScale accessibilityRole="button" accessibilityLabel={`Empezar ${r.name}`} onPress={() => begin(r)}
                      style={{ height: 34, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.accentDim, justifyContent: 'center' }}>
                      <AppText variant="caption" color={colors.accent}>Empezar</AppText>
                    </PressableScale>
                  ) : undefined
                }
              />
            </View>
          ))
        )}
      </Card>

      {!active.data ? <Button title="Entreno libre" variant="secondary" onPress={() => begin(null)} disabled={start.isPending} /> : null}

      <Card style={{ paddingVertical: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.xs }}>
          <AppText variant="overline" color={colors.textSecondary} style={{ flex: 1 }}>Últimos entrenamientos</AppText>
          {(history.data?.length ?? 0) > 0 ? (
            <AppText variant="caption" color={colors.accent} suppressHighlighting onPress={() => router.push('/workout/history')}>Ver todo</AppText>
          ) : null}
        </View>
        {history.isPending ? (
          <Skeleton height={60} />
        ) : (history.data?.length ?? 0) === 0 ? (
          <AppText variant="caption" color={colors.textSecondary} style={{ paddingVertical: space.md }}>Aquí verás tus entrenamientos terminados.</AppText>
        ) : (
          history.data!.map((h, i) => (
            <View key={h.session.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={h.session.name}
                subtitle={`${new Date(h.session.started_at).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} · ${formatDuration(durationMinutes(h.session.started_at, h.session.ended_at))}`}
                value={`${h.completedSets}`}
                valueSub={h.volumeKg ? `series · ${fmt(h.volumeKg)} kg` : 'series'}
                onPress={() => router.push({ pathname: '/workout/session/[id]', params: { id: h.session.id } })}
              />
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}
