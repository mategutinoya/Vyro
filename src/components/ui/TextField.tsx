import { useState, type ComponentRef, type Ref } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';

export type TextFieldRef = ComponentRef<typeof TextInput>;

interface Props extends TextInputProps {
  ref?: Ref<TextFieldRef>;
  label: string;
  suffix?: string;
  error?: string | null;
}

export function TextField({ ref, label, suffix, error, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space.xs + 2 }}>
      <AppText variant="caption" color={colors.textSecondary}>{label}</AppText>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: error ? colors.danger : focused ? colors.accent : colors.border,
          paddingHorizontal: space.lg,
        }}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          keyboardAppearance="dark"
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          style={[{ flex: 1, minWidth: 0, height: 52, color: colors.text, fontFamily: fonts.medium, fontSize: 16 }, style]}
          {...rest}
        />
        {suffix ? <AppText variant="caption" color={colors.textTertiary}>{suffix}</AppText> : null}
      </View>
      {error ? <AppText variant="caption" color={colors.danger}>{error}</AppText> : null}
    </View>
  );
}
