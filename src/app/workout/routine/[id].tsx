import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Card, Divider, ErrorCard, PressableScale, ScreenHeader, Skeleton, TextField } from '@/components/ui';
import { useArchiveRoutine, useRoutine, useSaveRoutine } from '@/features/workouts/api';
import { emptyRoutineDraft, routineDraft, useRoutineDraft, type DraftExercise } from '@/features/workouts/routine-draft';
import { MUSCLE_LABELS, WEEKDAY_NAMES, WEEKDAY_SHORT } from '@/features/workouts/types';
import { colors, fonts, radius, space } from '@/theme/tokens';

const int = (t: string, min: number, max: number) => {
  const n = Number(t);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

export default function RoutineEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const insets = useSafeAreaInsets();
  const existing = useRoutine(isNew ? undefined : id);
  const save = useSaveRoutine();
  const archive = useArchiveRoutine();
  const draft = useRoutineDraft();
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (draft.forId === id) return;
    if (isNew) routineDraft.reset(emptyRoutineDraft('new'));
    else if (existing.data)
      routineDraft.reset({
        forId: id,
        name: existing.data.name,
        notes: existing.data.notes ?? '',
        weekdays: existing.data.weekdays,
        exercises: existing.data.exercises.map((e) => ({
          exercise: e.exercise,
          sets: String(e.target_sets),
          reps: e.target_reps === null ? '' : String(e.target_reps),
          rest: String(e.rest_seconds),
        })),
      });
  }, [id, isNew, existing.data, draft.forId]);

  const ready = draft.forId === id;
  const rows = draft.exercises.map((e) => ({
    ...e,
    setsN: int(e.sets, 1, 20),
    repsN: e.reps ? int(e.reps, 1, 100) : null,
    restN: int(e.rest, 0, 900),
  }));
  const rowsValid = rows.every((r) => r.setsN !== null && (!r.reps || r.repsN !== null) && r.restN !== null);
  const valid = ready && draft.name.trim().length > 0 && draft.exercises.length > 0 && rowsValid;

  async function submit() {
    if (!valid) return;
    await save.mutateAsync({
      id: isNew ? undefined : id,
      input: {
        name: draft.name,
        notes: draft.notes.trim() || null,
        weekdays: draft.weekdays,
        exercises: rows.map((r) => ({ exerciseId: r.exercise.id, target_sets: r.setsN!, target_reps: r.repsN, rest_seconds: r.restN! })),
      },
    });
    routineDraft.reset(emptyRoutineDraft());
    router.back();
  }

  async function remove() {
    if (!confirm) return setConfirm(true);
    await archive.mutateAsync(id);
    routineDraft.reset(emptyRoutineDraft());
    router.back();
  }

  const toggleDay = (d: number) =>
    routineDraft.set({ weekdays: draft.weekdays.includes(d) ? draft.weekdays.filter((x) => x !== d) : [...draft.weekdays, d] });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title={isNew ? 'Nueva rutina' : 'Editar rutina'} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }}>
        {existing.error ? (
          <ErrorCard message={existing.error.message} />
        ) : !ready ? (
          <Skeleton height={240} />
        ) : (
          <>
            <TextField label="Nombre" value={draft.name} onChangeText={(t) => routineDraft.set({ name: t })} placeholder="Ej.: Empuje · Pecho y hombro" maxLength={80} />

            <View style={{ gap: space.sm }}>
              <AppText variant="caption" color={colors.textSecondary}>Días en que la haces</AppText>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {WEEKDAY_SHORT.map((label, i) => {
                  const d = i + 1;
                  const on = draft.weekdays.includes(d);
                  return (
                    <PressableScale key={d} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={WEEKDAY_NAMES[i]}
                      onPress={() => toggleDay(d)}
                      style={{ flex: 1, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: on ? colors.accent : colors.surface, borderWidth: 1, borderColor: on ? colors.accent : colors.border }}>
                      <AppText variant="bodyStrong" color={on ? colors.onAccent : colors.textSecondary}>{label}</AppText>
                    </PressableScale>
                  );
                })}
              </View>
              <AppText variant="caption" color={colors.textTertiary}>Aparecerá en Inicio como “Entrenamiento del día” esos días.</AppText>
            </View>

            <Card style={{ paddingVertical: space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.xs }}>
                <AppText variant="overline" color={colors.textSecondary} style={{ flex: 1 }}>Ejercicios</AppText>
                <AppText variant="bodyStrong" color={colors.accent} suppressHighlighting accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/workout/exercises', params: { mode: 'routine', routineId: id } })}>
                  + Añadir
                </AppText>
              </View>
              {draft.exercises.length === 0 ? (
                <AppText variant="caption" color={colors.textSecondary} style={{ paddingVertical: space.md }}>
                  Añade los ejercicios en el orden en que los haces.
                </AppText>
              ) : (
                rows.map((r, i) => (
                  <View key={r.exercise.id}>
                    {i > 0 ? <Divider /> : null}
                    <ExerciseEditor row={r} index={i} count={rows.length} invalid={{ sets: r.setsN === null, reps: !!r.reps && r.repsN === null, rest: r.restN === null }} />
                  </View>
                ))
              )}
            </Card>

            <TextField label="Notas (opcional)" value={draft.notes} onChangeText={(t) => routineDraft.set({ notes: t })} multiline style={{ height: 80, paddingTop: 14, textAlignVertical: 'top' }} />
            {save.error ? <AppText variant="caption" color={colors.danger}>No se guardó: {save.error.message}</AppText> : null}
            {!isNew ? (
              <View style={{ gap: space.xs }}>
                <Button title={confirm ? 'Pulsa otra vez para eliminar' : 'Eliminar rutina'} variant="ghost" onPress={remove} loading={archive.isPending} />
                <AppText variant="caption" color={colors.textTertiary} align="center">Tus entrenamientos ya hechos con esta rutina se conservan.</AppText>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <View style={{ padding: space.lg, paddingBottom: insets.bottom + space.lg }}>
        <Button title="Guardar rutina" onPress={submit} disabled={!valid} loading={save.isPending} />
      </View>
    </KeyboardAvoidingView>
  );
}

function ExerciseEditor({ row, index, count, invalid }: { row: DraftExercise; index: number; count: number; invalid: { sets: boolean; reps: boolean; rest: boolean } }) {
  return (
    <View style={{ paddingVertical: space.md, gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="bodyStrong" numberOfLines={1}>{row.exercise.name}</AppText>
          <AppText variant="caption" color={colors.textSecondary}>{MUSCLE_LABELS[row.exercise.muscle_group]}</AppText>
        </View>
        <SmallBtn label="↑" a11y={`Subir ${row.exercise.name}`} disabled={index === 0} onPress={() => routineDraft.move(index, -1)} />
        <SmallBtn label="↓" a11y={`Bajar ${row.exercise.name}`} disabled={index === count - 1} onPress={() => routineDraft.move(index, 1)} />
        <SmallBtn label="×" a11y={`Quitar ${row.exercise.name}`} onPress={() => routineDraft.remove(index)} />
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <NumBox label="Series" value={row.sets} invalid={invalid.sets} onChange={(t) => routineDraft.updateExercise(index, { sets: t })} />
        <NumBox label="Reps" value={row.reps} invalid={invalid.reps} onChange={(t) => routineDraft.updateExercise(index, { reps: t })} />
        <NumBox label="Descanso (s)" value={row.rest} invalid={invalid.rest} onChange={(t) => routineDraft.updateExercise(index, { rest: t })} />
      </View>
    </View>
  );
}

function NumBox({ label, value, onChange, invalid }: { label: string; value: string; onChange: (t: string) => void; invalid: boolean }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <AppText variant="caption" color={colors.textTertiary}>{label}</AppText>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        keyboardAppearance="dark"
        selectTextOnFocus
        accessibilityLabel={label}
        style={{ height: 40, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised, color: colors.text, fontFamily: fonts.semibold,
          fontSize: 15, textAlign: 'center', borderWidth: 1, borderColor: invalid ? colors.danger : 'transparent' }}
      />
    </View>
  );
}

function SmallBtn({ label, a11y, onPress, disabled }: { label: string; a11y: string; onPress: () => void; disabled?: boolean }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} disabled={disabled}
      style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
      <AppText variant="bodyStrong" color={colors.textSecondary}>{label}</AppText>
    </PressableScale>
  );
}
