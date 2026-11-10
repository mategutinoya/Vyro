import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Card, PressableScale, TextField, type TextFieldRef } from '@/components/ui';
import { authErrorMessage } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const passwordRef = useRef<TextFieldRef>(null);

  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());
  const canSubmit = emailValid && password.length >= 6;

  async function submit() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) {
          setNotice('Cuenta creada. Te hemos enviado un correo para confirmarla; después vuelve aquí e inicia sesión.');
          setMode('signin');
        }
      }
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', padding: space.xl, paddingTop: insets.top + space.xxxl, paddingBottom: insets.bottom + space.xl, gap: space.xxl }}>
        <Animated.View entering={FadeInDown.duration(500)} style={{ gap: space.sm }}>
          <AppText variant="display">
            Vyro<AppText variant="display" color={colors.accent}>.</AppText>
          </AppText>
          <AppText color={colors.textSecondary}>Nutrición y entrenamiento, en un solo lugar.</AppText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(500)} style={{ gap: space.lg }}>
          {notice ? (
            <Card style={{ borderColor: colors.accentDim }}>
              <AppText variant="caption">{notice}</AppText>
            </Card>
          ) : null}

          <TextField
            label="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            placeholder="tu@correo.com"
          />
          <TextField
            ref={passwordRef}
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            textContentType={mode === 'signin' ? 'password' : 'newPassword'}
            returnKeyType="go"
            onSubmitEditing={submit}
            placeholder="Mínimo 6 caracteres"
            error={error}
          />

          <Button title={mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'} onPress={submit} loading={loading} disabled={!canSubmit} />

          <PressableScale
            haptic={false}
            onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
            style={{ alignSelf: 'center', padding: space.sm }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <AppText variant="caption" color={colors.textSecondary}>
                {mode === 'signin' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
              </AppText>
              <AppText variant="caption" color={colors.accent}>{mode === 'signin' ? 'Regístrate' : 'Inicia sesión'}</AppText>
            </View>
          </PressableScale>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
