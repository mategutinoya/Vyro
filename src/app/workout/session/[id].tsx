import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOutDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Card, ErrorCard, PressableScale, ProgressBar, ScreenHeader, Skeleton } from '@/components/ui';
import { useAddSet, useDeleteSession, useDeleteSet, useFinishSession, useSession, useUpdateSet, type SessionDetail } from '@/features/workouts/api';
import { completedCount, durationMinutes, formatClock, formatDuration, groupByExercise, volumeKg } from '@/features/workouts/logic';
import { restTimer, useRestTimer } from '@/features/workouts/rest-timer';
import { MUSCLE_LABELS, type WorkoutSet } from '@/features/workouts/types';
import { parseDecimal } from '@/features/profile/validation';
import { fmt, fmt1 } from '@/lib/format';
import { colors, fonts, radius, space } from '@/theme/tokens';

const haptic = (type: Haptics.NotificationFeedbackType) => {
  if (Platform.OS !== 'web') Haptics.notificationAsync(type);
};

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const q = useSession(id);
  const finish = useFinishSession();
  const del = useDeleteSession();
  const [confirm, setConfirm] = useState<'finish' | 'discard' | 'delete' | null>(null);

  const d = q.data;
  const active = !!d && !d.session.ended_at;
  const groups = d ? groupByExercise(d.sets) : [];
  const done = d ? completedCount(d.sets) : 0;
  const volume = d ? volumeKg(d.sets) : 0;

  async function doFinish() {
    await finish.mutateAsync(id);
    restTimer.stop();
    haptic(Haptics.NotificationFeedbackType.Success);
    setConfirm(null);
  }

  async function doDelete() {
    await del.mutateAsync(id);
    restTimer.stop();
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {active && Platform.OS !== 'web' ? <KeepScreenOn /> : null}
      <ScreenHeader
        title={d?.session.name ?? 'Entrenamiento'}
        subtitle={d ? (active ? undefined : new Date(d.session.started_at).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })) : undefined}
        right={active ? <ElapsedClock startedAt={d!.session.started_at} /> : undefined}
      />

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 220 }}>
        {q.error ? (
          <ErrorCard message={q.error.message} onRetry={() => q.refetch()} />
        ) : !d ? (
          <>
            <Skeleton height={160} />
            <Skeleton height={160} />
          </>
        ) : (
          <>
            {!active ? (
              <Animated.View entering={FadeIn}>
                <Card style={{ flexDirection: 'row', paddingVertical: space.lg }}>
                  <Stat label="Duración" value={formatDuration(durationMinutes(d.session.started_at, d.session.ended_at))} />
                  <Stat label="Series" value={String(done)} />
                  <Stat label="Volumen" value={volume ? `${fmt(volume)} kg` : '—'} />
                </Card>
              </Animated.View>
            ) : null}

            {groups.length === 0 ? (
              <Card>
                <AppText color={colors.textSecondary}>
                  {active ? 'Añade un ejercicio para empezar a registrar series.' : 'Este entrenamiento no tiene series completadas.'}
                </AppText>
              </Card>
            ) : (
              groups.map((g) => <ExerciseCard key={g.exerciseId} detail={d} group={g} active={active} sessionId={id} />)
            )}

            {active ? (
              <Button title="+ Añadir ejercicio" variant="secondary" onPress={() => router.push({ pathname: '/workout/exercises', params: { mode: 'session', sessionId: id } })} />
            ) : null}

            {active && confirm === null ? (
              <View style={{ gap: space.sm, marginTop: space.lg }}>
                <Button title="Terminar entrenamiento" onPress={() => setConfirm('finish')} />
                <Button title="Descartar" variant="ghost" onPress={() => setConfirm('discard')} />
              </View>
            ) : null}

            {active && confirm === 'finish' ? (
              <Animated.View entering={FadeInDown}>
                <Card style={{ gap: space.md, borderColor: colors.accentDim }}>
                  <AppText variant="heading">¿Terminar?</AppText>
                  <AppText color={colors.textSecondary}>
                    {done === 0
                      ? 'No has completado ninguna serie. Se guardará el entrenamiento vacío.'
                      : `${done} series completadas · ${volume ? `${fmt(volume)} kg de volumen · ` : ''}${formatDuration(durationMinutes(d.session.started_at, null))}. Las series sin marcar se descartan.`}
                  </AppText>
                  <Button title="Guardar entrenamiento" onPress={doFinish} loading={finish.isPending} />
                  <Button title="Seguir entrenando" variant="ghost" onPress={() => setConfirm(null)} />
                  {finish.error ? <AppText variant="caption" color={colors.danger}>{finish.error.message}</AppText> : null}
                </Card>
              </Animated.View>
            ) : null}

            {(active && confirm === 'discard') || (!active && confirm === 'delete') ? (
              <Animated.View entering={FadeInDown}>
                <Card style={{ gap: space.md, borderColor: colors.dangerDim }}>
                  <AppText variant="heading">{active ? '¿Descartar este entrenamiento?' : '¿Eliminar este entrenamiento?'}</AppText>
                  <AppText color={colors.textSecondary}>Se borrarán todas sus series. No se puede deshacer.</AppText>
                  <Button title={active ? 'Descartar' : 'Eliminar'} variant="secondary" onPress={doDelete} loading={del.isPending} />
                  <Button title="Cancelar" variant="ghost" onPress={() => setConfirm(null)} />
                </Card>
              </Animated.View>
            ) : null}

            {!active && confirm === null ? (
              <Button title="Eliminar entrenamiento" variant="ghost" onPress={() => setConfirm('delete')} style={{ marginTop: space.lg }} />
            ) : null}
          </>
        )}
      </ScrollView>

      {active ? <RestBar bottomInset={insets.bottom} /> : null}
    </KeyboardAvoidingView>
  );
}

function KeepScreenOn() {
  useKeepAwake();
  return null;
}

function ElapsedClock({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <AppText variant="bodyStrong" color={colors.accent} style={{ fontVariant: ['tabular-nums'] }} accessibilityLabel="Tiempo de entrenamiento">
      {formatClock((now - Date.parse(startedAt)) / 1000)}
    </AppText>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <AppText variant="caption" color={colors.textSecondary}>{label}</AppText>
      <AppText variant="metric" style={{ fontSize: 19 }}>{value}</AppText>
    </View>
  );
}

function ExerciseCard({ detail, group, active, sessionId }: {
  detail: SessionDetail;
  group: { exerciseId: string; position: number; sets: WorkoutSet[] };
  active: boolean;
  sessionId: string;
}) {
  const ex = detail.exercises.get(group.exerciseId);
  const prev = detail.previous.get(group.exerciseId) ?? [];
  const addSet = useAddSet(sessionId);
  const visible = active ? group.sets : group.sets.filter((s) => s.completed);
  if (!active && visible.length === 0) return null;

  return (
    <Animated.View layout={LinearTransition.duration(200)}>
      <Card style={{ gap: space.sm }}>
        <View>
          <AppText variant="heading">{ex?.name ?? 'Ejercicio'}</AppText>
          {ex ? <AppText variant="caption" color={colors.textSecondary}>{MUSCLE_LABELS[ex.muscle_group]}</AppText> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.xs }}>
          <Head w={34} label="#" />
          <Head flex label="Anterior" />
          <Head w={66} label="kg" />
          <Head w={56} label="Reps" />
          {active ? <Head w={40} label="" /> : null}
        </View>
        {visible.map((s, i) => (
          <SetRow
            key={s.id}
            set={s}
            number={i + 1}
            previous={prev[s.set_index] ?? null}
            active={active}
            sessionId={sessionId}
            restSeconds={detail.rest.get(group.exerciseId) ?? 90}
            exerciseName={ex?.name ?? ''}
          />
        ))}
        {active ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Añadir serie a ${ex?.name ?? 'ejercicio'}`}
            onPress={() => addSet.mutate({ exerciseId: group.exerciseId, position: group.position, after: group.sets.at(-1) })}
            style={{ height: 38, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center', marginTop: space.xs }}>
            <AppText variant="caption" color={colors.text}>{addSet.isPending ? 'Añadiendo…' : '+ Añadir serie'}</AppText>
          </PressableScale>
        ) : null}
      </Card>
    </Animated.View>
  );
}

function Head({ label, w, flex }: { label: string; w?: number; flex?: boolean }) {
  return (
    <AppText variant="overline" color={colors.textTertiary} style={{ width: w, flex: flex ? 1 : undefined, textAlign: flex ? 'left' : 'center' }}>
      {label}
    </AppText>
  );
}

function SetRow({ set, number, previous, active, sessionId, restSeconds, exerciseName }: {
  set: WorkoutSet;
  number: number;
  previous: WorkoutSet | null;
  active: boolean;
  sessionId: string;
  restSeconds: number;
  exerciseName: string;
}) {
  const update = useUpdateSet(sessionId);
  const del = useDeleteSet(sessionId);
  const [kg, setKg] = useState(set.weight_kg === null ? '' : fmt1(set.weight_kg));
  const [reps, setReps] = useState(set.reps === null ? '' : String(set.reps));

  const kgN = kg ? parseDecimal(kg, 0, 1000) : null;
  const repsN = reps ? Number(reps) : null;
  const repsValid = repsN === null || (Number.isInteger(repsN) && repsN >= 0 && repsN <= 500);
  const kgValid = !kg || kgN !== null;

  const saveFields = () => {
    if (!kgValid || !repsValid) return;
    if (kgN === set.weight_kg && repsN === set.reps) return;
    update.mutate({ id: set.id, patch: { weight_kg: kgN, reps: repsN } });
  };

  function toggle() {
    if (!kgValid || !repsValid) return;
    const completing = !set.completed;
    update.mutate({ id: set.id, patch: { completed: completing, weight_kg: kgN, reps: repsN } });
    if (completing) {
      haptic(Haptics.NotificationFeedbackType.Success);
      if (restSeconds > 0) restTimer.start(restSeconds, exerciseName);
    }
  }

  const prevLabel = previous && (previous.weight_kg !== null || previous.reps !== null)
    ? `${previous.weight_kg !== null ? fmt1(previous.weight_kg) : '—'} × ${previous.reps ?? '—'}`
    : '—';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingVertical: 4,
        marginHorizontal: -6,
        paddingHorizontal: 6,
        borderRadius: radius.sm,
        backgroundColor: set.completed && active ? 'rgba(198, 244, 50, 0.07)' : 'transparent',
      }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Eliminar serie ${number} de ${exerciseName}`}
        accessibilityHint="Mantén pulsado para eliminar la serie"
        disabled={!active}
        haptic={false}
        onLongPress={() => del.mutate(set.id)}
        style={{ width: 34, height: 36, alignItems: 'center', justifyContent: 'center' }}>
        <AppText variant="bodyStrong" color={set.completed ? colors.accent : colors.textSecondary}>{number}</AppText>
      </PressableScale>
      <AppText variant="caption" color={colors.textTertiary} style={{ flex: 1 }} numberOfLines={1}>{prevLabel}</AppText>
      {active ? (
        <>
          <Field value={kg} onChange={setKg} onBlur={saveFields} invalid={!kgValid} width={66} label={`Peso serie ${number} de ${exerciseName}`} decimal placeholder={previous?.weight_kg != null ? fmt1(previous.weight_kg) : '0'} />
          <Field value={reps} onChange={setReps} onBlur={saveFields} invalid={!repsValid} width={56} label={`Repeticiones serie ${number} de ${exerciseName}`} placeholder={previous?.reps != null ? String(previous.reps) : '0'} />
          <PressableScale
            accessibilityRole="checkbox"
            accessibilityState={{ checked: set.completed }}
            accessibilityLabel={`Serie ${number} de ${exerciseName} completada`}
            onPress={toggle}
            haptic={false}
            style={{
              width: 40, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center',
              backgroundColor: set.completed ? colors.accent : colors.surfaceRaised,
            }}>
            <AppText variant="bodyStrong" color={set.completed ? colors.onAccent : colors.textTertiary}>✓</AppText>
          </PressableScale>
        </>
      ) : (
        <>
          <AppText variant="bodyStrong" style={{ width: 66, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{set.weight_kg !== null ? fmt1(set.weight_kg) : '—'}</AppText>
          <AppText variant="bodyStrong" style={{ width: 56, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{set.reps ?? '—'}</AppText>
        </>
      )}
    </View>
  );
}

function Field({ value, onChange, onBlur, invalid, width, label, decimal, placeholder }: {
  value: string; onChange: (t: string) => void; onBlur: () => void; invalid: boolean; width: number; label: string; decimal?: boolean; placeholder: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      onEndEditing={onBlur}
      onBlur={onBlur}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      keyboardAppearance="dark"
      selectTextOnFocus
      placeholder={placeholder}
      placeholderTextColor={colors.textTertiary}
      accessibilityLabel={label}
      style={{
        width, height: 36, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised, color: colors.text,
        fontFamily: fonts.semibold, fontSize: 15, textAlign: 'center', borderWidth: 1, borderColor: invalid ? colors.danger : 'transparent',
      }}
    />
  );
}

/** Barra flotante del temporizador de descanso. */
function RestBar({ bottomInset }: { bottomInset: number }) {
  const t = useRestTimer();
  const notified = useRef<number | null>(null);

  // Al terminar: vibración una sola vez y se oculta a los 4 segundos.
  useEffect(() => {
    if (!t.finished) return;
    if (notified.current !== t.endsAt) {
      notified.current = t.endsAt;
      haptic(Haptics.NotificationFeedbackType.Warning);
    }
    const h = setTimeout(() => restTimer.stop(), 4000);
    return () => clearTimeout(h);
  }, [t.finished, t.endsAt]);

  if (!t.endsAt) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(250)}
      exiting={FadeOutDown.duration(200)}
      style={{
        position: 'absolute', left: space.lg, right: space.lg, bottom: bottomInset + space.lg,
        backgroundColor: t.finished ? colors.accent : colors.surfaceRaised, borderRadius: radius.lg, padding: space.lg, gap: space.sm,
        borderWidth: 1, borderColor: colors.border,
      }}
      accessibilityLiveRegion="polite">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <AppText variant="overline" color={t.finished ? colors.onAccent : colors.textSecondary} numberOfLines={1}>
            {t.finished ? '¡A por la siguiente serie!' : `Descanso · ${t.label}`}
          </AppText>
          <AppText variant="display" color={t.finished ? colors.onAccent : colors.text} style={{ fontSize: 36, lineHeight: 40, fontVariant: ['tabular-nums'] }}>
            {formatClock(t.remaining)}
          </AppText>
        </View>
        {!t.finished ? (
          <>
            <TimerBtn label="−15" a11y="Quitar 15 segundos" onPress={() => restTimer.add(-15)} />
            <TimerBtn label="+15" a11y="Añadir 15 segundos" onPress={() => restTimer.add(15)} />
          </>
        ) : null}
        <TimerBtn label={t.finished ? 'Cerrar' : 'Saltar'} a11y={t.finished ? 'Cerrar temporizador' : 'Saltar descanso'} onPress={() => restTimer.stop()} dark={t.finished} />
      </View>
      {!t.finished ? <ProgressBar progress={t.total ? 1 - t.remaining / t.total : 0} height={4} /> : null}
    </Animated.View>
  );
}

function TimerBtn({ label, a11y, onPress, dark }: { label: string; a11y: string; onPress: () => void; dark?: boolean }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress}
      style={{ height: 40, minWidth: 48, paddingHorizontal: space.sm, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
        backgroundColor: dark ? colors.onAccent : colors.surfacePressed }}>
      <AppText variant="bodyStrong" color={dark ? colors.accent : colors.text}>{label}</AppText>
    </PressableScale>
  );
}
