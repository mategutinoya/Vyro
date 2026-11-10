import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { AppText, Card, Divider, ListRow, PressableScale } from '@/components/ui';
import { MEAL_LABELS, sumMacros, type FoodLog, type Meal } from '@/features/nutrition/api';
import { fmt } from '@/lib/format';
import { colors, radius, space } from '@/theme/tokens';

interface Props {
  meal: Meal;
  date: string;
  logs: FoodLog[];
}

export function MealSection({ meal, date, logs }: Props) {
  const t = sumMacros(logs);
  const add = () => router.push({ pathname: '/food/search', params: { date, meal } });

  return (
    <Card style={{ paddingVertical: space.md, gap: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs }}>
        <View style={{ flex: 1 }}>
          <AppText variant="heading">{MEAL_LABELS[meal]}</AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            {logs.length ? `${fmt(t.kcal)} kcal · P ${fmt(t.protein_g)} · C ${fmt(t.carbs_g)} · G ${fmt(t.fat_g)}` : 'Sin registros'}
          </AppText>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Foto de ${MEAL_LABELS[meal]}`}
          onPress={() => router.push({ pathname: '/food/photo', params: { date, meal } })}
          style={{ width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
          <AppText variant="bodyStrong" color={colors.text}>◉</AppText>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Añadir a ${MEAL_LABELS[meal]}`}
          onPress={add}
          style={{ height: 36, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.accentDim, alignItems: 'center', justifyContent: 'center' }}>
          <AppText variant="bodyStrong" color={colors.accent}>+ Añadir</AppText>
        </PressableScale>
      </View>

      {logs.length > 0 ? (
        <Animated.View layout={LinearTransition.duration(220)} style={{ marginTop: space.sm }}>
          {logs.map((l, i) => (
            <Animated.View key={l.id} entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={l.name}
                subtitle={`${fmt(l.grams)} g · P ${fmt(l.protein_g)} · C ${fmt(l.carbs_g)} · G ${fmt(l.fat_g)}`}
                value={fmt(l.kcal)}
                valueSub="kcal"
                accessibilityLabel={`Editar ${l.name}`}
                onPress={() => router.push({ pathname: '/food/log/[id]', params: { id: l.id } })}
              />
            </Animated.View>
          ))}
        </Animated.View>
      ) : null}
    </Card>
  );
}
