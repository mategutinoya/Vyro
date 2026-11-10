import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

interface Props {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onBack?: () => void;
}

/** Cabecera de pantallas secundarias: atrás + título + acción opcional. */
export function ScreenHeader({ title, subtitle, right, onBack }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top + space.sm,
        paddingHorizontal: space.lg,
        paddingBottom: space.md,
        backgroundColor: colors.bg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
      }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Volver"
        haptic={false}
        hitSlop={8}
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <AppText variant="heading" style={{ marginTop: -2 }}>‹</AppText>
      </PressableScale>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="heading" numberOfLines={1}>{title}</AppText>
        {subtitle ? <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>{subtitle}</AppText> : null}
      </View>
      {right}
    </View>
  );
}
