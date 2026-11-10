import { View, type ViewProps } from 'react-native';

import { colors, radius, space } from '@/theme/tokens';

export function Card({ style, ...rest }: ViewProps) {
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: colors.hairline,
          padding: space.lg,
        },
        style,
      ]}
    />
  );
}
