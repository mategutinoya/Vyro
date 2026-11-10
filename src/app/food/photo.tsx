import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { relativeDayLabel } from '@/components/ui/DateNavigator';
import { AppText, Button, Card, Divider, MacroSummary, PressableScale, ScreenHeader, Segmented, TextField } from '@/components/ui';
import { analyzeMealPhoto, pickMealPhoto, scaleItem, type MealItem, type PickedPhoto } from '@/features/nutrition/ai';
import { MEAL_LABELS, MEALS, useAddFoodLogs, type Meal } from '@/features/nutrition/api';
import { addMacros, ZERO } from '@/features/nutrition/calc';
import { readFlowParams } from '@/features/nutrition/params';
import { parseDecimal } from '@/features/profile/validation';
import { fmt, fmt1 } from '@/lib/format';
import { colors, fonts, radius, space } from '@/theme/tokens';

const MEAL_SHORT: Record<Meal, string> = { breakfast: 'Desayuno', lunch: 'Almuerzo', dinner: 'Cena', snack: 'Snack' };
const CONFIDENCE: Record<MealItem['confidence'], { label: string; color: string }> = {
  high: { label: 'Seguro', color: colors.accent },
  medium: { label: 'Aproximado', color: colors.fat },
  low: { label: 'Dudoso', color: colors.danger },
};

interface Row {
  base: MealItem; // estimación original de la IA
  grams: string;
  included: boolean;
}

export default function MealPhotoScreen() {
  const flow = readFlowParams(useLocalSearchParams());
  const insets = useSafeAreaInsets();
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'pick' | 'analyze' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [notes, setNotes] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const [meal, setMeal] = useState<Meal>(flow.meal);
  const save = useAddFoodLogs();

  async function pick(source: 'camera' | 'library') {
    setError(null);
    setBusy('pick');
    try {
      const p = await pickMealPhoto(source);
      if (p) {
        setPhoto(p);
        setRows(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function analyze() {
    if (!photo) return;
    setError(null);
    setBusy('analyze');
    try {
      const r = await analyzeMealPhoto(photo, note);
      setRemaining(r.remaining);
      setNotes(r.notes);
      if (!r.is_food) {
        setRows([]);
        setError(r.notes || 'No se ve comida en la foto. Prueba con otra.');
      } else {
        setRows(r.items.map((i) => ({ base: i, grams: fmt1(i.grams), included: true })));
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const current = (rows ?? []).map((r) => {
    const g = parseDecimal(r.grams, 1, 3000);
    return { ...r, valid: g !== null, item: g ? scaleItem(r.base, g) : r.base };
  });
  const chosen = current.filter((r) => r.included && r.valid);
  const total = chosen.reduce((acc, r) => addMacros(acc, r.item), ZERO);
  const allValid = current.every((r) => !r.included || r.valid);

  async function submit() {
    await save.mutateAsync(
      chosen.map((r) => ({
        log_date: flow.date,
        meal,
        name: r.item.name,
        grams: r.item.grams,
        kcal: r.item.kcal,
        protein_g: r.item.protein_g,
        carbs_g: r.item.carbs_g,
        fat_g: r.item.fat_g,
        entry_source: 'ai_photo' as const,
      })),
    );
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.dismissTo('/nutrition');
  }

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => (rs ?? []).map((r, n) => (n === i ? { ...r, ...patch } : r)));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Registrar con foto" subtitle={relativeDayLabel(flow.date)} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }}>
        {photo ? (
          <Animated.View entering={FadeIn.duration(250)} style={{ borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface }}>
            <Image source={{ uri: photo.uri }} style={{ width: '100%', aspectRatio: 4 / 3 }} contentFit="cover" accessibilityLabel="Foto de la comida" />
          </Animated.View>
        ) : (
          <Card style={{ gap: space.md, paddingVertical: space.xl }}>
            <AppText variant="heading">Haz una foto de tu plato</AppText>
            <AppText color={colors.textSecondary}>
              La IA identifica los alimentos y estima cantidades, calorías y macros. Después podrás revisarlos antes de guardar.
            </AppText>
            <AppText variant="caption" color={colors.textTertiary}>
              Consejo: encuadra el plato completo desde arriba, con buena luz y algún cubierto como referencia de tamaño.
            </AppText>
          </Card>
        )}

        {!rows ? (
          <>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button title={photo ? 'Repetir foto' : 'Hacer foto'} onPress={() => pick('camera')} variant={photo ? 'secondary' : 'primary'} style={{ flex: 1 }} loading={busy === 'pick'} disabled={busy === 'analyze'} />
              <Button title="Galería" onPress={() => pick('library')} variant="secondary" style={{ flex: 1 }} disabled={!!busy} />
            </View>
            {photo ? (
              <>
                <TextField
                  label="Detalles (opcional)"
                  value={note}
                  onChangeText={setNote}
                  maxLength={300}
                  placeholder="Ej.: 150 g de arroz, frito en aceite de oliva"
                />
                <Button title="Analizar comida" onPress={analyze} loading={busy === 'analyze'} />
                {busy === 'analyze' ? (
                  <AppText variant="caption" color={colors.textSecondary} align="center">Analizando la foto… puede tardar unos segundos.</AppText>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}

        {error ? (
          <Card style={{ borderColor: colors.dangerDim }}>
            <AppText variant="caption" color={colors.danger}>{error}</AppText>
          </Card>
        ) : null}

        {rows && rows.length > 0 ? (
          <Animated.View entering={FadeInDown.duration(300)} style={{ gap: space.lg }}>
            <Card style={{ paddingVertical: space.sm }}>
              <AppText variant="overline" color={colors.textSecondary} style={{ paddingVertical: space.xs }}>
                Alimentos detectados
              </AppText>
              {current.map((r, i) => (
                <View key={`${r.base.name}-${i}`}>
                  {i > 0 ? <Divider /> : null}
                  <ItemRow
                    row={r}
                    item={r.item}
                    onToggle={() => update(i, { included: !r.included })}
                    onGrams={(t) => update(i, { grams: t })}
                  />
                </View>
              ))}
            </Card>

            <Card style={{ gap: space.md }}>
              <AppText variant="overline" color={colors.textSecondary}>Total seleccionado</AppText>
              <MacroSummary size="lg" kcal={total.kcal} protein={total.protein_g} carbs={total.carbs_g} fat={total.fat_g} />
            </Card>

            <View style={{ gap: space.sm }}>
              <AppText variant="caption" color={colors.textSecondary}>Comida</AppText>
              <Segmented<Meal> value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: MEAL_SHORT[m] }))} />
            </View>

            <AppText variant="caption" color={colors.textTertiary}>
              {notes ? `${notes} ` : ''}Son estimaciones de la IA a partir de la imagen: revisa los gramos antes de guardar.
              {remaining !== null ? ` Te quedan ${remaining} análisis hoy.` : ''}
            </AppText>
            <AppText variant="caption" color={colors.accent} suppressHighlighting onPress={() => { setRows(null); setError(null); }}>
              Analizar otra foto
            </AppText>
            {save.error ? <AppText variant="caption" color={colors.danger}>No se guardó: {save.error.message}</AppText> : null}
          </Animated.View>
        ) : null}
      </ScrollView>

      {rows && rows.length > 0 ? (
        <View style={{ padding: space.lg, paddingBottom: insets.bottom + space.lg }}>
          <Button
            title={chosen.length === 1 ? `Añadir 1 alimento a ${MEAL_LABELS[meal]}` : `Añadir ${chosen.length} alimentos a ${MEAL_LABELS[meal]}`}
            onPress={submit}
            disabled={!chosen.length || !allValid}
            loading={save.isPending}
          />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function ItemRow({ row, item, onToggle, onGrams }: { row: Row & { valid: boolean }; item: MealItem; onToggle: () => void; onGrams: (t: string) => void }) {
  const conf = CONFIDENCE[item.confidence];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, opacity: row.included ? 1 : 0.45 }}>
      <PressableScale
        accessibilityRole="checkbox"
        accessibilityState={{ checked: row.included }}
        accessibilityLabel={`Incluir ${item.name}`}
        onPress={onToggle}
        style={{
          width: 26, height: 26, borderRadius: 8, borderWidth: 2,
          borderColor: row.included ? colors.accent : colors.textTertiary,
          backgroundColor: row.included ? colors.accent : 'transparent',
          alignItems: 'center', justifyContent: 'center',
        }}>
        {row.included ? <AppText variant="caption" color={colors.onAccent} style={{ fontFamily: fonts.bold }}>✓</AppText> : null}
      </PressableScale>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText variant="bodyStrong" numberOfLines={2}>{item.name}</AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          {fmt(item.kcal)} kcal · P {fmt(item.protein_g)} · C {fmt(item.carbs_g)} · G {fmt(item.fat_g)}
        </AppText>
        <AppText variant="caption" color={conf.color}>{conf.label}</AppText>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceRaised, borderRadius: radius.sm, paddingHorizontal: space.sm, borderWidth: 1, borderColor: row.valid ? 'transparent' : colors.danger }}>
        <TextInput
          value={row.grams}
          onChangeText={onGrams}
          editable={row.included}
          keyboardType="decimal-pad"
          keyboardAppearance="dark"
          selectTextOnFocus
          accessibilityLabel={`Gramos de ${item.name}`}
          style={{ width: 52, height: 36, color: colors.text, fontFamily: fonts.semibold, fontSize: 15, textAlign: 'right' }}
        />
        <AppText variant="caption" color={colors.textTertiary}> g</AppText>
      </View>
    </View>
  );
}
