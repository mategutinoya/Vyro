import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { AppText, Card, Divider, ErrorCard, ListRow, ScreenHeader, Skeleton } from '@/components/ui';
import { useSessionHistory } from '@/features/workouts/api';
import { durationMinutes, formatDuration } from '@/features/workouts/logic';
import { fmt } from '@/lib/format';
import { colors, space } from '@/theme/tokens';

export default function HistoryScreen() {
  const h = useSessionHistory(100);
  // Agrupado por mes: "noviembre de 2026"
  const groups = new Map<string, NonNullable<typeof h.data>>();
  for (const item of h.data ?? []) {
    const key = new Date(item.session.started_at).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Historial" subtitle="Entrenamientos terminados" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxxl }}>
        {h.error ? (
          <ErrorCard message={h.error.message} onRetry={() => h.refetch()} />
        ) : h.isPending ? (
          <Skeleton height={200} />
        ) : groups.size === 0 ? (
          <Card><AppText color={colors.textSecondary}>Aún no has terminado ningún entrenamiento.</AppText></Card>
        ) : (
          [...groups.entries()].map(([month, items]) => (
            <Card key={month} style={{ paddingVertical: space.sm }}>
              <AppText variant="overline" color={colors.textSecondary} style={{ paddingVertical: space.xs }}>{month}</AppText>
              {items.map((it, i) => (
                <View key={it.session.id}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow
                    title={it.session.name}
                    subtitle={`${new Date(it.session.started_at).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })} · ${formatDuration(durationMinutes(it.session.started_at, it.session.ended_at))} · ${it.exerciseCount} ejercicios`}
                    value={String(it.completedSets)}
                    valueSub={it.volumeKg ? `series · ${fmt(it.volumeKg)} kg` : 'series'}
                    onPress={() => router.push({ pathname: '/workout/session/[id]', params: { id: it.session.id } })}
                  />
                </View>
              ))}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
