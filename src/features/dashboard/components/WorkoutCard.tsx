import { View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import type { TodayWorkout } from '@/features/workouts/api';
import { colors, radius, space } from '@/theme/tokens';

export function WorkoutCard({ data }: { data: TodayWorkout }) {
  const { routine, session } = data;

  let title: string;
  let detail: string;
  let status: 'done' | 'active' | 'planned' | 'rest';

  if (session) {
    title = session.name;
    status = session.ended_at ? 'done' : 'active';
    detail = `${session.completedSets} ${session.completedSets === 1 ? 'serie completada' : 'series completadas'}`;
  } else if (routine) {
    title = routine.name;
    status = 'planned';
    detail = `${routine.exerciseCount} ${routine.exerciseCount === 1 ? 'ejercicio' : 'ejercicios'}`;
  } else {
    title = 'Sin entrenamiento programado';
    status = 'rest';
    detail = 'Asigna días a tus rutinas para verlas aquí.';
  }

  const badge = { done: 'Completado', active: 'En curso', planned: 'Hoy', rest: 'Descanso' }[status];

  return (
    <Card style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <AppText variant="overline" color={colors.textSecondary}>Entrenamiento del día</AppText>
        <View
          style={{
            paddingHorizontal: space.sm + 2,
            paddingVertical: 3,
            borderRadius: radius.pill,
            backgroundColor: status === 'done' || status === 'planned' ? colors.accentDim : colors.surfaceRaised,
          }}>
          <AppText variant="caption" color={status === 'done' || status === 'planned' ? colors.accent : colors.textSecondary}>{badge}</AppText>
        </View>
      </View>
      <AppText variant="heading">{title}</AppText>
      <AppText variant="caption" color={colors.textSecondary}>{detail}</AppText>
    </Card>
  );
}
