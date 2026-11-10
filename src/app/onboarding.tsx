import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Card, OptionCard, ProgressBar, TextField } from '@/components/ui';
import { useCompleteOnboarding } from '@/features/profile/api';
import { computeTargets } from '@/features/profile/targets';
import { ACTIVITY_LABELS, GOAL_LABELS, type ActivityLevel, type Goal, type NutritionTargets, type Sex } from '@/features/profile/types';
import { maskBirthDate, parseBirthDate, parseDecimal } from '@/features/profile/validation';
import { ageFromBirthDate } from '@/lib/date';
import { fmt } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';

const STEPS = ['Sobre ti', 'Tu objetivo', 'Tu plan'];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);

  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [birth, setBirth] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState<Goal | null>(null);
  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [overrides, setOverrides] = useState<Partial<Record<keyof NutritionTargets, string>>>({});

  const birthISO = parseBirthDate(birth);
  const heightCm = parseDecimal(height, 100, 250);
  const weightKg = parseDecimal(weight, 25, 400);
  const step0Valid = !!sex && !!birthISO && heightCm !== null && weightKg !== null;
  const step1Valid = !!goal && !!activity;

  const computed = useMemo(() => {
    if (!step0Valid || !step1Valid) return null;
    return computeTargets({ sex: sex!, age: ageFromBirthDate(birthISO!), heightCm: heightCm!, weightKg: weightKg!, goal: goal!, activity: activity! });
  }, [step0Valid, step1Valid, sex, birthISO, heightCm, weightKg, goal, activity]);

  const finalTargets: NutritionTargets | null = computed
    ? {
        calories: Math.round(parseDecimal(overrides.calories ?? '', 800, 8000) ?? computed.calories),
        protein_g: Math.round(parseDecimal(overrides.protein_g ?? '', 0, 600) ?? computed.protein_g),
        carbs_g: Math.round(parseDecimal(overrides.carbs_g ?? '', 0, 1200) ?? computed.carbs_g),
        fat_g: Math.round(parseDecimal(overrides.fat_g ?? '', 0, 400) ?? computed.fat_g),
        water_ml: Math.round(parseDecimal(overrides.water_ml ?? '', 0, 10000) ?? computed.water_ml),
      }
    : null;

  const complete = useCompleteOnboarding();

  function next() {
    if (step < 2) return setStep(step + 1);
    if (!finalTargets) return;
    complete.mutate({
      displayName: name,
      sex: sex!,
      birthDate: birthISO!,
      heightCm: heightCm!,
      weightKg: weightKg!,
      goal: goal!,
      activity: activity!,
      targets: finalTargets,
    });
  }

  const canContinue = step === 0 ? step0Valid : step === 1 ? step1Valid : !!finalTargets;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top + space.md, paddingHorizontal: space.xl, gap: space.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText variant="overline" color={colors.textSecondary}>
            Paso {step + 1} de {STEPS.length}
          </AppText>
          {step > 0 ? (
            <AppText variant="caption" color={colors.accent} onPress={() => setStep(step - 1)} suppressHighlighting>
              Atrás
            </AppText>
          ) : (
            <AppText variant="caption" color={colors.textTertiary} onPress={() => supabase.auth.signOut()} suppressHighlighting>
              Salir
            </AppText>
          )}
        </View>
        <ProgressBar progress={(step + 1) / STEPS.length} height={4} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.xl, gap: space.lg, paddingBottom: space.xxxl }}>
        <Animated.View key={step} entering={FadeInRight.duration(350)} style={{ gap: space.lg }}>
          <AppText variant="title">{STEPS[step]}</AppText>

          {step === 0 && (
            <>
              <AppText color={colors.textSecondary}>Usamos estos datos para estimar tus necesidades diarias. Puedes cambiarlos cuando quieras.</AppText>
              <TextField label="Nombre (opcional)" value={name} onChangeText={setName} placeholder="¿Cómo te llamamos?" autoCapitalize="words" maxLength={60} />
              <View style={{ gap: space.sm }}>
                <AppText variant="caption" color={colors.textSecondary}>Sexo biológico (para la fórmula metabólica)</AppText>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <View style={{ flex: 1 }}><OptionCard title="Hombre" selected={sex === 'male'} onPress={() => setSex('male')} /></View>
                  <View style={{ flex: 1 }}><OptionCard title="Mujer" selected={sex === 'female'} onPress={() => setSex('female')} /></View>
                </View>
              </View>
              <TextField
                label="Fecha de nacimiento"
                value={birth}
                onChangeText={(t) => setBirth(maskBirthDate(t))}
                placeholder="DD/MM/AAAA"
                keyboardType="number-pad"
                error={birth.length === 10 && !birthISO ? 'Fecha no válida (edad entre 13 y 100 años).' : null}
              />
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <TextField label="Altura" value={height} onChangeText={setHeight} keyboardType="decimal-pad" suffix="cm" placeholder="175"
                    error={height && heightCm === null ? '100–250 cm' : null} />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField label="Peso actual" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" suffix="kg" placeholder="72,5"
                    error={weight && weightKg === null ? '25–400 kg' : null} />
                </View>
              </View>
            </>
          )}

          {step === 1 && (
            <>
              <View style={{ gap: space.sm }}>
                <AppText variant="caption" color={colors.textSecondary}>Objetivo físico</AppText>
                {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
                  <OptionCard key={g} title={GOAL_LABELS[g].title} detail={GOAL_LABELS[g].detail} selected={goal === g} onPress={() => setGoal(g)} />
                ))}
              </View>
              <View style={{ gap: space.sm }}>
                <AppText variant="caption" color={colors.textSecondary}>Nivel de actividad</AppText>
                {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((a) => (
                  <OptionCard key={a} title={ACTIVITY_LABELS[a].title} detail={ACTIVITY_LABELS[a].detail} selected={activity === a} onPress={() => setActivity(a)} />
                ))}
              </View>
            </>
          )}

          {step === 2 && computed && finalTargets && (
            <>
              <AppText color={colors.textSecondary}>
                Estimación calculada con la fórmula Mifflin-St Jeor. Es un punto de partida: ajústala si ya conoces tus números.
              </AppText>
              <Animated.View entering={FadeIn.delay(150)}>
                <Card style={{ alignItems: 'center', gap: 4, paddingVertical: space.xxl }}>
                  <AppText variant="overline" color={colors.textSecondary}>Objetivo diario</AppText>
                  <AppText variant="display" color={colors.accent}>{fmt(finalTargets.calories)}</AppText>
                  <AppText variant="caption" color={colors.textSecondary}>kcal</AppText>
                </Card>
              </Animated.View>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <View style={{ flex: 1 }}><TextField label="Calorías" suffix="kcal" keyboardType="number-pad" placeholder={String(computed.calories)} value={overrides.calories ?? ''} onChangeText={(t) => setOverrides({ ...overrides, calories: t })} /></View>
                <View style={{ flex: 1 }}><TextField label="Proteína" suffix="g" keyboardType="number-pad" placeholder={String(computed.protein_g)} value={overrides.protein_g ?? ''} onChangeText={(t) => setOverrides({ ...overrides, protein_g: t })} /></View>
              </View>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <View style={{ flex: 1 }}><TextField label="Carbohidratos" suffix="g" keyboardType="number-pad" placeholder={String(computed.carbs_g)} value={overrides.carbs_g ?? ''} onChangeText={(t) => setOverrides({ ...overrides, carbs_g: t })} /></View>
                <View style={{ flex: 1 }}><TextField label="Grasas" suffix="g" keyboardType="number-pad" placeholder={String(computed.fat_g)} value={overrides.fat_g ?? ''} onChangeText={(t) => setOverrides({ ...overrides, fat_g: t })} /></View>
              </View>
              <TextField label="Agua" suffix="ml" keyboardType="number-pad" placeholder={String(computed.water_ml)} value={overrides.water_ml ?? ''} onChangeText={(t) => setOverrides({ ...overrides, water_ml: t })} />
              <AppText variant="caption" color={colors.textTertiary}>Deja un campo vacío para usar el valor calculado.</AppText>
            </>
          )}

          {complete.error ? (
            <AppText variant="caption" color={colors.danger}>No se pudo guardar: {complete.error.message}</AppText>
          ) : null}
        </Animated.View>
      </ScrollView>

      <View style={{ padding: space.xl, paddingBottom: insets.bottom + space.lg }}>
        <Button title={step < 2 ? 'Continuar' : 'Empezar'} onPress={next} disabled={!canContinue} loading={complete.isPending} />
      </View>
    </KeyboardAvoidingView>
  );
}
