import { View } from 'react-native';

import { colors, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

interface Props {
  title: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
}

/** Opción seleccionable (radio) para formularios. */
export function OptionCard({ title, detail, selected, onPress }: Props) {
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        padding: space.lg,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected ? colors.accentDim : colors.surface,
      }}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong">{title}</AppText>
        {detail ? <AppText variant="caption" color={colors.textSecondary}>{detail}</AppText> : null}
      </View>
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: selected ? colors.accent : colors.textTertiary,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} /> : null}
      </View>
    </PressableScale>
  );
}
