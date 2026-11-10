import type { ReactNode } from 'react';
import { View } from 'react-native';

import { colors, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

interface Props {
  title: string;
  subtitle?: string;
  value?: string;
  valueSub?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  right?: ReactNode;
  accessibilityLabel?: string;
}

/** Fila de lista: nombre + detalle a la izquierda, cifra a la derecha. */
export function ListRow({ title, subtitle, value, valueSub, onPress, onLongPress, right, accessibilityLabel }: Props) {
  return (
    <PressableScale
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      haptic={false}
      scaleTo={0.985}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>{title}</AppText>
        {subtitle ? <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>{subtitle}</AppText> : null}
      </View>
      {value ? (
        <View style={{ alignItems: 'flex-end' }}>
          <AppText variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>{value}</AppText>
          {valueSub ? <AppText variant="caption" color={colors.textTertiary}>{valueSub}</AppText> : null}
        </View>
      ) : null}
      {right}
    </PressableScale>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.hairline }} />;
}
