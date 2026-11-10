import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { relativeDayLabel } from '@/components/ui/DateNavigator';
import { AppText, Button, Card, ErrorCard, MacroSummary, ScreenHeader, Segmented, Skeleton, TextField } from '@/components/ui';
import { MEALS, useDeleteFoodLog, useFoodLog, useUpdateFoodLog, type Meal } from '@/features/nutrition/api';
import { scaleMacros } from '@/features/nutrition/calc';
import { parseDecimal } from '@/features/profile/validation';
import { fmt1 } from '@/lib/format';
import { colors, space } from '@/theme/tokens';

const MEAL_SHORT: Record<Meal, string> = { breakfast: 'Desayuno', lunch: 'Almuerzo', dinner: 'Cena', snack: 'Snack' };

export default function EditLogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const log = useFoodLog(id);
  const update = useUpdateFoodLog();
  const del = useDeleteFoodLog();

  const [gramsText, setGramsText] = useState<string | null>(null);
  const [meal, setMeal] = useState<Meal | null>(null);
  const [confirm, setConfirm] = useState(false);

  const l = log.data;
  const text = gramsText ?? (l ? fmt1(l.grams) : '');
  const grams = parseDecimal(text, 1, 5000);
  const m = l && grams ? scaleMacros(l, l.grams, grams) : null;
  const currentMeal = meal ?? l?.meal ?? 'breakfast';

  async function save() {
    if (!l || !grams) return;
    await update.mutateAsync({ log: l, grams, meal: currentMeal });
    router.back();
  }

  async function remove() {
    if (!l) return;
    if (!confirm) return setConfirm(true);
    router.back();
    del.mutate({ id: l.id, log_date: l.log_date });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Editar registro" subtitle={l ? relativeDayLabel(l.log_date) : undefined} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        {log.error ? (
          <ErrorCard message={log.error.message} />
        ) : !l ? (
          <Skeleton height={220} />
        ) : (
          <>
            <AppText variant="title">{l.name}</AppText>
            <TextField label="Cantidad" suffix="g" keyboardType="decimal-pad" value={text} onChangeText={setGramsText} selectTextOnFocus
              error={text && !grams ? 'Entre 1 y 5000 g' : null} />
            {m ? (
              <Card style={{ gap: space.md }}>
                <AppText variant="overline" color={colors.textSecondary}>Total</AppText>
                <MacroSummary size="lg" kcal={m.kcal} protein={m.protein_g} carbs={m.carbs_g} fat={m.fat_g} />
              </Card>
            ) : null}
            <View style={{ gap: space.sm }}>
              <AppText variant="caption" color={colors.textSecondary}>Comida</AppText>
              <Segmented<Meal> value={currentMeal} onChange={setMeal} options={MEALS.map((x) => ({ value: x, label: MEAL_SHORT[x] }))} />
            </View>
            {update.error ? <AppText variant="caption" color={colors.danger}>No se guardó: {update.error.message}</AppText> : null}
            <Button title={confirm ? 'Pulsa otra vez para eliminar' : 'Eliminar registro'} variant="ghost" onPress={remove} />
          </>
        )}
      </ScrollView>
      <View style={{ padding: space.lg, paddingBottom: insets.bottom + space.lg }}>
        <Button title="Guardar cambios" onPress={save} disabled={!l || !grams} loading={update.isPending} />
      </View>
    </KeyboardAvoidingView>
  );
}
