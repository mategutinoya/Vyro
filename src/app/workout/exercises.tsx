import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';

import { AppText, Button, Card, Divider, ListRow, PressableScale, ScreenHeader } from '@/components/ui';
import { addExerciseToSession, useCreateExercise, useExercises, workoutKeys } from '@/features/workouts/api';
import { routineDraft, useRoutineDraft } from '@/features/workouts/routine-draft';
import { EQUIPMENT_LABELS, MUSCLE_LABELS, type Equipment, type Exercise, type MuscleGroup } from '@/features/workouts/types';
import { useQueryClient } from '@tanstack/react-query';
import { colors, fonts, radius, space } from '@/theme/tokens';

const MUSCLES = Object.keys(MUSCLE_LABELS) as MuscleGroup[];
const EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[];

export default function ExercisePickerScreen() {
  const { mode, routineId, sessionId } = useLocalSearchParams<{ mode: 'routine' | 'session'; routineId?: string; sessionId?: string }>();
  const qc = useQueryClient();
  const exercises = useExercises();
  const create = useCreateExercise();
  const draft = useRoutineDraft();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [newEquipment, setNewEquipment] = useState<Equipment | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const already = new Set(mode === 'routine' ? draft.exercises.map((e) => e.exercise.id) : []);
  const list = (exercises.data ?? []).filter((e) => (!q || e.name.toLowerCase().includes(q)) && (!muscle || e.muscle_group === muscle));

  async function choose(e: Exercise) {
    setError(null);
    if (mode === 'routine') {
      routineDraft.addExercise(e);
      router.back();
      return;
    }
    if (!sessionId) return;
    setAdding(e.id);
    try {
      await addExerciseToSession(sessionId, e.id);
      await qc.invalidateQueries({ queryKey: workoutKeys.session(sessionId) });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAdding(null);
    }
  }

  async function createAndChoose() {
    if (!query.trim() || !muscle) return;
    const e = await create.mutateAsync({ name: query, muscle_group: muscle, equipment: newEquipment });
    await choose(e);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Añadir ejercicio" subtitle={mode === 'session' ? 'Al entrenamiento en curso' : routineId === 'new' ? 'A la nueva rutina' : 'A la rutina'} />
      <View style={{ paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.md }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar ejercicio"
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          keyboardAppearance="dark"
          autoCorrect={false}
          accessibilityLabel="Buscar ejercicio"
          style={{ height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: space.lg, color: colors.text, fontFamily: fonts.medium, fontSize: 16 }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          <Chip label="Todos" on={!muscle} onPress={() => setMuscle(null)} />
          {MUSCLES.map((m) => <Chip key={m} label={MUSCLE_LABELS[m]} on={muscle === m} onPress={() => setMuscle(m)} />)}
        </ScrollView>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxxl, gap: space.md }}>
        {error ? <AppText variant="caption" color={colors.danger}>{error}</AppText> : null}
        <Card style={{ paddingVertical: space.sm }}>
          {exercises.isPending ? (
            <ActivityIndicator color={colors.textSecondary} style={{ padding: space.lg }} />
          ) : list.length === 0 ? (
            <AppText variant="caption" color={colors.textSecondary} style={{ paddingVertical: space.md }}>Ningún ejercicio coincide.</AppText>
          ) : (
            list.map((e, i) => (
              <View key={e.id}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  title={e.name}
                  subtitle={[MUSCLE_LABELS[e.muscle_group], e.equipment ? EQUIPMENT_LABELS[e.equipment] : null, e.user_id ? 'Propio' : null].filter(Boolean).join(' · ')}
                  onPress={already.has(e.id) ? undefined : () => choose(e)}
                  right={adding === e.id ? <ActivityIndicator color={colors.accent} /> : already.has(e.id) ? <AppText variant="caption" color={colors.textTertiary}>Añadido</AppText> : undefined}
                />
              </View>
            ))
          )}
        </Card>

        {!creating ? (
          <Button title="Crear ejercicio propio" variant="secondary" onPress={() => setCreating(true)} />
        ) : (
          <Card style={{ gap: space.md }}>
            <AppText variant="heading">Nuevo ejercicio</AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              {query.trim() ? `Nombre: “${query.trim()}”` : 'Escribe el nombre en el buscador de arriba.'}
            </AppText>
            <AppText variant="caption" color={colors.textSecondary}>Grupo muscular{muscle ? `: ${MUSCLE_LABELS[muscle]}` : ' (elígelo arriba)'}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {EQUIPMENT.map((eq) => <Chip key={eq} label={EQUIPMENT_LABELS[eq]} on={newEquipment === eq} onPress={() => setNewEquipment(newEquipment === eq ? null : eq)} />)}
            </View>
            {create.error ? <AppText variant="caption" color={colors.danger}>{create.error.message}</AppText> : null}
            <Button title="Crear y añadir" onPress={createAndChoose} disabled={!query.trim() || !muscle} loading={create.isPending} />
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} haptic={false}
      style={{ height: 34, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center',
        backgroundColor: on ? colors.accentDim : colors.surface, borderWidth: 1, borderColor: on ? colors.accent : colors.border }}>
      <AppText variant="caption" color={on ? colors.accent : colors.text}>{label}</AppText>
    </PressableScale>
  );
}
