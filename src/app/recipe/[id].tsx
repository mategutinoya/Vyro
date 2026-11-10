import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Card, Divider, ErrorCard, MacroSummary, PressableScale, ScreenHeader, Skeleton, TextField } from '@/components/ui';
import { macrosForGrams, recipeNutrition } from '@/features/nutrition/calc';
import { parseDecimal } from '@/features/profile/validation';
import { useDeleteRecipe, useRecipe, useSaveRecipe } from '@/features/recipes/api';
import { emptyDraft, recipeDraft, useRecipeDraft } from '@/features/recipes/draft';
import { todayISO } from '@/lib/date';
import { fmt, fmt1 } from '@/lib/format';
import { colors, fonts, radius, space } from '@/theme/tokens';

export default function RecipeEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const insets = useSafeAreaInsets();
  const existing = useRecipe(isNew ? undefined : id);
  const save = useSaveRecipe();
  const del = useDeleteRecipe();
  const draft = useRecipeDraft();
  const [confirm, setConfirm] = useState(false);

  // Inicializa el borrador sólo al entrar en esta receta (no al volver de añadir un ingrediente).
  useEffect(() => {
    if (draft.forId === id) return;
    if (isNew) recipeDraft.reset(emptyDraft('new'));
    else if (existing.data)
      recipeDraft.reset({
        forId: id,
        name: existing.data.name,
        servings: fmt1(existing.data.servings),
        notes: existing.data.notes ?? '',
        ingredients: existing.data.ingredients,
      });
  }, [id, isNew, existing.data, draft.forId]);

  const ready = draft.forId === id;
  const servings = parseDecimal(draft.servings, 0.5, 100);
  const n = recipeNutrition(draft.ingredients, servings ?? 1);
  const valid = ready && draft.name.trim().length > 0 && servings !== null && draft.ingredients.length > 0;

  async function submit() {
    if (!valid) return;
    await save.mutateAsync({
      id: isNew ? undefined : id,
      input: {
        name: draft.name,
        servings: servings!,
        notes: draft.notes.trim() || null,
        ingredients: draft.ingredients.map((i) => ({ foodId: i.food.id, grams: i.grams })),
      },
    });
    recipeDraft.reset(emptyDraft());
    router.back();
  }

  async function remove() {
    if (isNew) return;
    if (!confirm) return setConfirm(true);
    await del.mutateAsync(id);
    recipeDraft.reset(emptyDraft());
    router.back();
  }

  const addIngredient = () =>
    router.push({ pathname: '/food/search', params: { mode: 'ingredient', recipeId: id, date: todayISO(), meal: 'lunch' } });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title={isNew ? 'Nueva receta' : 'Editar receta'} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }}>
        {existing.error ? (
          <ErrorCard message={existing.error.message} />
        ) : !ready ? (
          <Skeleton height={240} />
        ) : (
          <>
            <TextField label="Nombre" value={draft.name} onChangeText={(t) => recipeDraft.set({ name: t })} placeholder="Ej.: Avena con plátano" maxLength={120} />
            <TextField label="Raciones que salen" suffix="raciones" keyboardType="decimal-pad" value={draft.servings}
              onChangeText={(t) => recipeDraft.set({ servings: t })} error={draft.servings && servings === null ? 'Entre 0,5 y 100' : null} />

            <Card style={{ paddingVertical: space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.xs }}>
                <AppText variant="overline" color={colors.textSecondary} style={{ flex: 1 }}>
                  Ingredientes{'  '}
                  <AppText variant="caption" color={colors.textTertiary} style={{ textTransform: 'none', letterSpacing: 0 }}>{fmt(n.totalGrams)} g</AppText>
                </AppText>
                <AppText variant="bodyStrong" color={colors.accent} onPress={addIngredient} suppressHighlighting accessibilityRole="button">
                  + Añadir
                </AppText>
              </View>
              {draft.ingredients.length === 0 ? (
                <AppText variant="caption" color={colors.textSecondary} style={{ paddingVertical: space.md }}>
                  Añade los alimentos y sus gramos en crudo, tal como los pesas.
                </AppText>
              ) : (
                draft.ingredients.map((ing, i) => (
                  <View key={ing.food.id}>
                    {i > 0 ? <Divider /> : null}
                    <IngredientRow
                      name={ing.food.name}
                      grams={ing.grams}
                      kcal={macrosForGrams(ing.food, ing.grams).kcal}
                      onChange={(g) => recipeDraft.updateIngredient(i, g)}
                      onRemove={() => recipeDraft.removeIngredient(i)}
                    />
                  </View>
                ))
              )}
            </Card>

            {draft.ingredients.length ? (
              <Card style={{ gap: space.md }}>
                <AppText variant="overline" color={colors.textSecondary}>
                  Por ración{'  '}
                  <AppText variant="caption" color={colors.textTertiary} style={{ textTransform: 'none', letterSpacing: 0 }}>{fmt(n.gramsPerServing)} g</AppText>
                </AppText>
                <MacroSummary size="lg" kcal={n.perServing.kcal} protein={n.perServing.protein_g} carbs={n.perServing.carbs_g} fat={n.perServing.fat_g} />
                <AppText variant="caption" color={colors.textTertiary}>Receta completa: {fmt(n.total.kcal)} kcal</AppText>
              </Card>
            ) : null}

            <TextField label="Notas (opcional)" value={draft.notes} onChangeText={(t) => recipeDraft.set({ notes: t })} multiline style={{ height: 88, paddingTop: 14, textAlignVertical: 'top' }} />
            {save.error ? <AppText variant="caption" color={colors.danger}>No se guardó: {save.error.message}</AppText> : null}
            {!isNew ? (
              <Button title={confirm ? 'Pulsa otra vez para borrar' : 'Borrar receta'} variant="ghost" onPress={remove} loading={del.isPending} />
            ) : null}
          </>
        )}
      </ScrollView>
      <View style={{ padding: space.lg, paddingBottom: insets.bottom + space.lg }}>
        <Button title="Guardar receta" onPress={submit} disabled={!valid} loading={save.isPending} />
      </View>
    </KeyboardAvoidingView>
  );
}

function IngredientRow({ name, grams, kcal, onChange, onRemove }: { name: string; grams: number; kcal: number; onChange: (g: number) => void; onRemove: () => void }) {
  const [text, setText] = useState(fmt1(grams));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>{name}</AppText>
        <AppText variant="caption" color={colors.textSecondary}>{fmt(kcal)} kcal</AppText>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceRaised, borderRadius: radius.sm, paddingHorizontal: space.sm }}>
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            const g = parseDecimal(t, 1, 5000);
            if (g) onChange(g);
          }}
          keyboardType="decimal-pad"
          keyboardAppearance="dark"
          selectTextOnFocus
          accessibilityLabel={`Gramos de ${name}`}
          style={{ width: 56, height: 36, color: colors.text, fontFamily: fonts.semibold, fontSize: 15, textAlign: 'right' }}
        />
        <AppText variant="caption" color={colors.textTertiary}> g</AppText>
      </View>
      <PressableScale accessibilityRole="button" accessibilityLabel={`Quitar ${name}`} onPress={onRemove}
        style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised }}>
        <AppText variant="bodyStrong" color={colors.textSecondary}>×</AppText>
      </PressableScale>
    </View>
  );
}
