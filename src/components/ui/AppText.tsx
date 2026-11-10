import { Text, type TextProps } from 'react-native';

import { colors, type as typeScale, type TypeVariant } from '@/theme/tokens';

interface Props extends TextProps {
  variant?: TypeVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

export function AppText({ variant = 'body', color = colors.text, align, style, ...rest }: Props) {
  return <Text {...rest} style={[typeScale[variant], { color, textAlign: align }, style]} />;
}
