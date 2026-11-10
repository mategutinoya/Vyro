import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { relativeDayLabel } from '@/components/ui/DateNavigator';
import { AppText, Button, Card, Divider, ListRow, PressableScale, ScreenHeader, Segmented } from '@/components/ui';
import { MEAL_LABELS } from '@/features/nutrition/api';
import { importOffFood, useFoodSearch, useOffSearch, useRecentFoods, type Food } from '@/features/nutrition/foods';
import type { OffFood } from '@/features/nutrition/off';
import { flowToParams, readFlowParams } from '@/features/nutrition/params';
import { useRecipes } from '@/features/recipes/api';
import { useDebounced } from '@/hooks/useDebounced';
import { env } from '@/lib/env';
import { fmt } from '@/lib/format';
import { colors, fonts, radius, space } from '@/theme/tokens';

type Tab = 'foods' | 'recipes';

export default function FoodSearchScreen() {
  const flow = readFlowParams(useLocalSearchParams());
  const [tab, setTab] = useState<Tab>('foods');
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 700);
  const [importing, setImporting] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const own = useFoodSearch(debounced);
  const recent = useRecentFoods();
  const off = useOffSearch(env.demo ? '' : debounced);
  const recipes = useRecipes();

  const q = query.trim();
  const params = flowToParams(flow);

  const openFood = (food: Pick<Food, 'id'>) => router.push({ pathname: '/food/amount', params: { ...params, foodId: food.id } });

  async function openOff(item: OffFood) {
    setImporting(item.code);
    setImportError(null);
    try {
      const id = await importOffFood(item);
      openFood({ id });
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(null);
    }
  }

  const title = flow.mode === 'ingredient' ? 'Añadir ingrediente' : `Añadir a ${MEAL_LABELS[flow.meal]}`;
  const subtitle = flow.mode === 'log' ? relativeDayLabel(flow.date) : undefined;
  const ownMatches = own.data ?? [];
  const showRecent = !q && (recent.data?.length ?? 0) > 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title={title} subtitle={subtitle} />
      <View style={{ paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, paddingHorizontal: space.lg }}>
          <AppText color={colors.textTertiary}>⌕</AppText>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={tab === 'foods' ? 'Buscar alimento o marca' : 'Buscar receta'}
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.accent}
            keyboardAppearance="dark"
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Buscar"
            style={{ flex: 1, minWidth: 0, height: 48, marginLeft: space.sm, color: colors.text, fontFamily: fonts.medium, fontSize: 16 }}
          />
          {query ? (
            <AppText variant="caption" color={colors.textSecondary} onPress={() => setQuery('')} suppressHighlighting accessibilityLabel="Borrar búsqueda">
              Borrar
            </AppText>
          ) : null}
        </View>
        {flow.mode === 'log' ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Registrar con foto e IA"
            onPress={() => router.push({ pathname: '/food/photo', params })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.accentDim, borderWidth: 1, borderColor: 'rgba(198, 244, 50, 0.25)' }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <AppText variant="bodyStrong" color={colors.onAccent}>◉</AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong" color={colors.accent}>Registrar con foto</AppText>
              <AppText variant="caption" color={colors.textSecondary}>La IA estima alimentos, gramos y macros</AppText>
            </View>
            <AppText variant="heading" color={colors.accent}>›</AppText>
          </PressableScale>
        ) : null}
        {flow.mode === 'log' ? (
          <Segmented<Tab> value={tab} onChange={setTab} options={[{ value: 'foods', label: 'Alimentos' }, { value: 'recipes', label: 'Recetas' }]} />
        ) : null}
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxxl, gap: space.md }}>
        {tab === 'foods' ? (
          <>
            {showRecent ? (
              <Section title="Recientes">
                {recent.data!.map((f, i) => (
                  <FoodRow key={f.id} food={f} first={i === 0} onPress={() => openFood(f)} />
                ))}
              </Section>
            ) : null}

            <Section title={q ? 'Mis alimentos' : 'Mis alimentos guardados'}>
              {own.isPending ? (
                <ActivityIndicator color={colors.textSecondary} style={{ padding: space.lg }} />
              ) : ownMatches.length ? (
                ownMatches.map((f, i) => <FoodRow key={f.id} food={f} first={i === 0} onPress={() => openFood(f)} />)
              ) : (
                <AppText variant="caption" color={colors.textSecondary} style={{ paddingVertical: space.md }}>
                  {q ? 'Ningún alimento propio coincide.' : 'Todavía no tienes alimentos guardados. Búscalos abajo o créalos.'}
                </AppText>
              )}
            </Section>

            {q.length >= 3 ? (
              <Section title="Open Food Facts" note="Base de datos pública y colaborativa. Revisa los valores con la etiqueta.">
                {env.demo ? (
                  <AppText variant="caption" color={colors.textSecondary} style={{ paddingVertical: space.md }}>
                    No disponible en la demo web: el navegador bloquea la conexión. En la app del teléfono funciona.
                  </AppText>
                ) : debounced.trim() !== q || off.isFetching ? (
                  <ActivityIndicator color={colors.textSecondary} style={{ padding: space.lg }} />
                ) : off.error ? (
                  <AppText variant="caption" color={colors.danger} style={{ paddingVertical: space.md }}>
                    {off.error.message.includes('Network') ? 'Sin conexión con Open Food Facts.' : off.error.message}
                  </AppText>
                ) : (off.data?.length ?? 0) === 0 ? (
                  <AppText variant="caption" color={colors.textSecondary} style={{ paddingVertical: space.md }}>
                    Sin resultados con datos nutricionales completos.
                  </AppText>
                ) : (
                  off.data!.map((item, i) => (
                    <View key={item.code}>
                      {i > 0 ? <Divider /> : null}
                      <ListRow
                        title={item.name}
                        subtitle={[item.brand, `P ${fmt(item.protein_per_100g)} · C ${fmt(item.carbs_per_100g)} · G ${fmt(item.fat_per_100g)}`].filter(Boolean).join(' · ')}
                        value={fmt(item.kcal_per_100g)}
                        valueSub="kcal/100 g"
                        onPress={() => openOff(item)}
                        right={importing === item.code ? <ActivityIndicator color={colors.accent} /> : undefined}
                      />
                    </View>
                  ))
                )}
                {importError ? <AppText variant="caption" color={colors.danger}>{importError}</AppText> : null}
              </Section>
            ) : q.length > 0 && !env.demo ? (
              <AppText variant="caption" color={colors.textTertiary}>Escribe 3 letras o más para buscar también en Open Food Facts.</AppText>
            ) : null}

            <Button
              title="Crear alimento"
              variant="secondary"
              onPress={() => router.push({ pathname: '/food/new', params: { ...params, name: q } })}
            />
          </>
        ) : (
          <>
            {recipes.isPending ? (
              <ActivityIndicator color={colors.textSecondary} style={{ padding: space.lg }} />
            ) : (
              (() => {
                const list = (recipes.data ?? []).filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()));
                return list.length ? (
                  <Section title="Mis recetas">
                    {list.map((r, i) => (
                      <View key={r.id}>
                        {i > 0 ? <Divider /> : null}
                        <ListRow
                          title={r.name}
                          subtitle={`${r.ingredients.length} ingredientes · ${fmt(r.nutrition.gramsPerServing)} g por ración`}
                          value={fmt(r.nutrition.perServing.kcal)}
                          valueSub="kcal/ración"
                          onPress={() => router.push({ pathname: '/food/amount', params: { ...params, recipeId: r.id } })}
                        />
                      </View>
                    ))}
                  </Section>
                ) : (
                  <AppText variant="caption" color={colors.textSecondary}>
                    {q ? 'Ninguna receta coincide.' : 'Aún no tienes recetas. Crea una con los alimentos que usas.'}
                  </AppText>
                );
              })()
            )}
            <Button title="Nueva receta" variant="secondary" onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: 'new' } })} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeIn.duration(200)}>
      <Card style={{ paddingVertical: space.sm }}>
        <View style={{ paddingTop: space.xs, paddingBottom: space.xs, gap: 2 }}>
          <AppText variant="overline" color={colors.textSecondary}>{title}</AppText>
          {note ? <AppText variant="caption" color={colors.textTertiary}>{note}</AppText> : null}
        </View>
        {children}
      </Card>
    </Animated.View>
  );
}

function FoodRow({ food, first, onPress }: { food: Food; first: boolean; onPress: () => void }) {
  return (
    <View>
      {!first ? <Divider /> : null}
      <ListRow
        title={food.name}
        subtitle={[food.brand, `P ${fmt(food.protein_per_100g)} · C ${fmt(food.carbs_per_100g)} · G ${fmt(food.fat_per_100g)}`].filter(Boolean).join(' · ')}
        value={fmt(food.kcal_per_100g)}
        valueSub="kcal/100 g"
        onPress={onPress}
      />
    </View>
  );
}
