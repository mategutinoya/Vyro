import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, ScreenHeader, TextField } from '@/components/ui';
import { kcalMismatch } from '@/features/nutrition/calc';
import { useDeleteFood, useFood, useSaveFood, type FoodInput } from '@/features/nutrition/foods';
import { flowToParams, readFlowParams } from '@/features/nutrition/params';
import { parseDecimal } from '@/features/profile/validation';
import { fmt, fmt1 } from '@/lib/format';
import { colors, space } from '@/theme/tokens';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

type Field = 'name' | 'brand' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'serving';

export default function FoodFormScreen() {
  const raw = useLocalSearchParams();
  const flow = readFlowParams(raw);
  const editId = one(raw.edit) === '1' ? one(raw.id) : undefined;
  const insets = useSafeAreaInsets();

  const existing = useFood(editId);
  const save = useSaveFood();
  const del = useDeleteFood();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [v, setV] = useState<Record<Field, string>>({
    name: one(raw.name) ?? '',
    brand: '',
    kcal: '',
    protein: '',
    carbs: '',
    fat: '',
    fiber: '',
    serving: '',
  });
  const [loaded, setLoaded] = useState(false);
  // Carga los valores del alimento al editarlo (una sola vez).
  if (existing.data && !loaded) {
    const f = existing.data;
    setV({
      name: f.name,
      brand: f.brand ?? '',
      kcal: fmt1(f.kcal_per_100g),
      protein: fmt1(f.protein_per_100g),
      carbs: fmt1(f.carbs_per_100g),
      fat: fmt1(f.fat_per_100g),
      fiber: f.fiber_per_100g === null ? '' : fmt1(f.fiber_per_100g),
      serving: f.serving_g === null ? '' : fmt1(f.serving_g),
    });
    setLoaded(true);
  }

  const set = (k: Field) => (t: string) => setV((s) => ({ ...s, [k]: t }));

  // fmt1 usa coma decimal y no agrupa miles en es-ES, así que parseDecimal la entiende.
  const kcal = parseDecimal(v.kcal, 0, 950);
  const protein = parseDecimal(v.protein || '0', 0, 100);
  const carbs = parseDecimal(v.carbs || '0', 0, 100);
  const fat = parseDecimal(v.fat || '0', 0, 100);
  const fiber = v.fiber ? parseDecimal(v.fiber, 0, 100) : null;
  const serving = v.serving ? parseDecimal(v.serving, 1, 5000) : null;
  const macroSumOk = protein !== null && carbs !== null && fat !== null && protein + carbs + fat <= 100;

  const valid =
    v.name.trim().length > 0 && kcal !== null && protein !== null && carbs !== null && fat !== null && macroSumOk &&
    (!v.fiber || fiber !== null) && (!v.serving || serving !== null);

  const mismatch = valid ? kcalMismatch({ kcal_per_100g: kcal!, protein_per_100g: protein!, carbs_per_100g: carbs!, fat_per_100g: fat! }) : 0;
  const expected = valid ? protein! * 4 + carbs! * 4 + fat! * 9 : 0;

  async function submit() {
    if (!valid) return;
    const input: FoodInput = {
      name: v.name.trim(),
      brand: v.brand.trim() || null,
      kcal_per_100g: kcal!,
      protein_per_100g: protein!,
      carbs_per_100g: carbs!,
      fat_per_100g: fat!,
      fiber_per_100g: fiber,
      serving_g: serving,
    };
    const id = await save.mutateAsync({ id: editId, input });
    if (editId) router.back();
    else router.replace({ pathname: '/food/amount', params: { ...flowToParams(flow), foodId: id } });
  }

  async function remove() {
    if (!editId) return;
    if (!confirmDelete) return setConfirmDelete(true);
    await del.mutateAsync(editId);
    router.dismissTo({ pathname: '/food/search', params: flowToParams(flow) });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title={editId ? 'Editar alimento' : 'Nuevo alimento'} subtitle="Valores por 100 g, como en la etiqueta" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }}>
        <TextField label="Nombre" value={v.name} onChangeText={set('name')} placeholder="Ej.: Pechuga de pollo" maxLength={120} autoCapitalize="sentences" />
        <TextField label="Marca (opcional)" value={v.brand} onChangeText={set('brand')} maxLength={80} />
        <TextField label="Calorías" suffix="kcal / 100 g" keyboardType="decimal-pad" value={v.kcal} onChangeText={set('kcal')}
          error={v.kcal && kcal === null ? 'Entre 0 y 950 kcal' : null} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}><TextField label="Proteína" suffix="g" keyboardType="decimal-pad" value={v.protein} onChangeText={set('protein')} placeholder="0" /></View>
          <View style={{ flex: 1 }}><TextField label="Carbos" suffix="g" keyboardType="decimal-pad" value={v.carbs} onChangeText={set('carbs')} placeholder="0" /></View>
          <View style={{ flex: 1 }}><TextField label="Grasas" suffix="g" keyboardType="decimal-pad" value={v.fat} onChangeText={set('fat')} placeholder="0" /></View>
        </View>
        {!macroSumOk && protein !== null && carbs !== null && fat !== null ? (
          <AppText variant="caption" color={colors.danger}>Proteína + carbohidratos + grasas no pueden superar 100 g en 100 g.</AppText>
        ) : null}
        {mismatch > 0.2 ? (
          <AppText variant="caption" color={colors.fat}>
            Con esos macros saldrían unas {fmt(expected)} kcal. Revisa que los valores sean por 100 g.
          </AppText>
        ) : null}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}><TextField label="Fibra (opcional)" suffix="g" keyboardType="decimal-pad" value={v.fiber} onChangeText={set('fiber')} /></View>
          <View style={{ flex: 1 }}><TextField label="Ración (opcional)" suffix="g" keyboardType="decimal-pad" value={v.serving} onChangeText={set('serving')} placeholder="Ej.: 125" /></View>
        </View>

        {save.error ? <AppText variant="caption" color={colors.danger}>No se guardó: {save.error.message}</AppText> : null}
        {editId ? (
          <View style={{ gap: space.sm }}>
            <Button title={confirmDelete ? 'Pulsa otra vez para borrar' : 'Borrar alimento'} variant="ghost" onPress={remove} loading={del.isPending} />
            <AppText variant="caption" color={colors.textTertiary} align="center">
              Los registros que ya hiciste con este alimento se conservan.
            </AppText>
            {del.error ? <AppText variant="caption" color={colors.danger} align="center">{del.error.message}</AppText> : null}
          </View>
        ) : null}
      </ScrollView>
      <View style={{ padding: space.lg, paddingBottom: insets.bottom + space.lg }}>
        <Button title={editId ? 'Guardar cambios' : 'Guardar y continuar'} onPress={submit} disabled={!valid} loading={save.isPending} />
      </View>
    </KeyboardAvoidingView>
  );
}
