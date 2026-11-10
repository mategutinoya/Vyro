import { ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, style }: Props) {
  const bg = variant === 'primary' ? colors.accent : variant === 'secondary' ? colors.surfaceRaised : 'transparent';
  const fg = variant === 'primary' ? colors.onAccent : colors.text;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        {
          height: 54,
          borderRadius: radius.pill,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: space.xl,
        },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : <AppText variant="bodyStrong" color={fg}>{title}</AppText>}
    </PressableScale>
  );
}
