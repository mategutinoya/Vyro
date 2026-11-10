import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { relativeDayLabel } from '@/components/ui/DateNavigator';
import { AppText, Button, Card, ErrorCard, MacroSummary, PressableScale, ScreenHeader, Segmented, Skeleton, TextField } from '@/components/ui';
import { MEAL_LABELS, MEALS, useAddFoodLog, type Meal } from '@/features/nutrition/api';
import { macrosForGrams, roundMacros } from '@/features/nutrition/calc';
import { useFood } from '@/features/nutrition/foods';
import { flowToParams, readFlowParams } from '@/features/nutrition/params';
import { parseDecimal } from '@/features/profile/validation';
import { useRecipe } from '@/features/recipes/api';
import { recipeDraft } from '@/features/recipes/draft';
import { fmt, fmt1 } from '@/lib/format';
import { colors, radius, space } from '@/theme/tokens';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const MEAL_SHORT: Record<Meal, string> = { breakfast: 'Desayuno', lunch: 'Almuerzo', dinner: 'Cena', snack: 'Snack' };

export default function AmountScreen() {
  const raw = useLocalSearchParams();
  const flow = readFlowParams(raw);
  const foodId = one(raw.foodId);
  const recipeId = one(raw.recipeId) && flow.mode === 'log' ? one(raw.recipeId) : undefined;
  const insets = useSafeAreaInsets();

  const food = useFood(recipeId ? undefined : foodId);
  const recipe = useRecipe(recipeId);
  const add = useAddFoodLog();

  const [meal, setMeal] = useState<Meal>(flow.meal);
  const [amountText, setAmountText] = useState<string | null>(null);

  const isRecipe = !!recipeId;
  const loading = isRecipe ? recipe.isPending : food.isPending;
  const error = isRecipe ? recipe.error : food.error;

  // Valor por defecto: 1 ración para recetas; ración del producto o 100 g para alimentos.
  const defaultAmount = isRecipe ? '1' : food.data?.serving_g ? fmt1(food.data.serving_g) : '100';
  const text = amountText ?? defaultAmount;
  const amount = parseDecimal(text, isRecipe ? 0.1 : 1, isRecipe ? 50 : 5000);

  let grams = 0;
  let macros = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  let name = '';
  if (isRecipe && recipe.data) {
    const n = recipe.data.nutrition;
    name = recipe.data.name;
    grams = (amount ?? 0) * n.gramsPerServing;
    const f = amount ?? 0;
    macros = roundMacros({ kcal: n.perServing.kcal * f, protein_g: n.perServing.protein_g * f, carbs_g: n.perServing.carbs_g * f, fat_g: n.perServing.fat_g * f });
  } else if (food.data) {
    name = food.data.name;
    grams = amount ?? 0;
    macros = macrosForGrams(food.data, grams);
  }

  async function save() {
    if (!amount || grams <= 0) return;
    if (flow.mode === 'ingredient' && food.data) {
      recipeDraft.addIngredient(food.data, grams);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.dismissTo({ pathname: '/recipe/[id]', params: { id: flow.recipeId ?? 'new' } });
      return;
    }
    await add.mutateAsync({
      log_date: flow.date,
      meal,
      name,
      grams: Math.round(grams * 10) / 10,
      food_id: isRecipe ? null : foodId,
      recipe_id: isRecipe ? recipeId : null,
      ...macros,
    });
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.dismissTo('/nutrition');
  }

  const chips = isRecipe
    ? [0.5, 1, 1.5, 2]
    : [...new Set([food.data?.serving_g ?? null, 50, 100, 150, 200].filter((v): v is number => !!v))].slice(0, 5);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        title={flow.mode === 'ingredient' ? 'Cantidad del ingrediente' : 'Cantidad'}
        subtitle={flow.mode === 'log' ? relativeDayLabel(flow.date) : undefined}
      />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        {error ? (
          <ErrorCard message={error.message} />
        ) : loading ? (
          <Skeleton height={200} />
        ) : (
          <Animated.View entering={FadeIn.duration(250)} style={{ gap: space.lg }}>
            <View style={{ gap: 4 }}>
              <AppText variant="title">{name}</AppText>
              {isRecipe && recipe.data ? (
                <AppText variant="caption" color={colors.textSecondary}>
                  Receta · {fmt(recipe.data.nutrition.gramsPerServing)} g y {fmt(recipe.data.nutrition.perServing.kcal)} kcal por ración
                </AppText>
              ) : food.data ? (
                <AppText variant="caption" color={colors.textSecondary}>
                  {[food.data.brand, `${fmt(food.data.kcal_per_100g)} kcal por 100 g`].filter(Boolean).join(' · ')}
                </AppText>
              ) : null}
            </View>

            <TextField
              label={isRecipe ? 'Raciones' : 'Cantidad'}
              suffix={isRecipe ? 'raciones' : 'g'}
              keyboardType="decimal-pad"
              value={text}
              onChangeText={setAmountText}
              selectTextOnFocus
              error={text && amount === null ? (isRecipe ? 'Entre 0,1 y 50 raciones' : 'Entre 1 y 5000 g') : null}
            />
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              {chips.map((c) => {
                const label = isRecipe ? `${fmt1(c)}` : `${fmt1(c)} g`;
                const selected = amount === c;
                return (
                  <PressableScale
                    key={c}
                    accessibilityRole="button"
                    accessibilityLabel={isRecipe ? `${label} raciones` : label}
                    onPress={() => setAmountText(fmt1(c))}
                    style={{ paddingHorizontal: space.md, height: 34, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: selected ? colors.accentDim : colors.surface, borderWidth: 1, borderColor: selected ? colors.accent : colors.border }}>
                    <AppText variant="caption" color={selected ? colors.accent : colors.text}>
                      {!isRecipe && c === food.data?.serving_g ? `1 ración · ${label}` : label}
                    </AppText>
                  </PressableScale>
                );
              })}
            </View>

            <Card style={{ gap: space.md }}>
              <AppText variant="overline" color={colors.textSecondary}>
                Total
                {isRecipe ? <AppText variant="caption" color={colors.textTertiary} style={{ textTransform: 'none', letterSpacing: 0 }}>{`  ${fmt(grams)} g`}</AppText> : null}
              </AppText>
              <MacroSummary size="lg" kcal={macros.kcal} protein={macros.protein_g} carbs={macros.carbs_g} fat={macros.fat_g} />
            </Card>

            {flow.mode === 'log' ? (
              <View style={{ gap: space.sm }}>
                <AppText variant="caption" color={colors.textSecondary}>Comida</AppText>
                <Segmented<Meal> value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: MEAL_SHORT[m] }))} />
              </View>
            ) : null}

            {food.data?.source === 'openfoodfacts' ? (
              <AppText variant="caption" color={colors.textTertiary}>
                Datos de Open Food Facts, aportados por la comunidad. Si no coinciden con la etiqueta, edita el alimento.
              </AppText>
            ) : null}
            {food.data && food.data.user_id ? (
              <AppText
                variant="caption"
                color={colors.accent}
                suppressHighlighting
                onPress={() => router.push({ pathname: '/food/new', params: { ...flowToParams(flow), id: food.data!.id, edit: '1' } })}>
                Editar valores del alimento
              </AppText>
            ) : null}
            {add.error ? <AppText variant="caption" color={colors.danger}>No se guardó: {add.error.message}</AppText> : null}
          </Animated.View>
        )}
      </ScrollView>
      <View style={{ padding: space.lg, paddingBottom: insets.bottom + space.lg }}>
        <Button
          title={flow.mode === 'ingredient' ? 'Añadir a la receta' : `Añadir a ${MEAL_LABELS[meal]}`}
          onPress={save}
          loading={add.isPending}
          disabled={!amount || grams <= 0 || loading || !!error}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
