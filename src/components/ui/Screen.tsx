import type { PropsWithChildren, ReactElement } from 'react';
import { Platform, ScrollView, type RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space } from '@/theme/tokens';

interface Props extends PropsWithChildren {
  refreshControl?: ReactElement<RefreshControlProps>;
}

/** Contenedor de pantalla con scroll, márgenes y zonas seguras. */
export function Screen({ children, refreshControl }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        // En web la barra de pestañas flota arriba; dejamos su hueco.
        paddingTop: insets.top + space.lg + (Platform.OS === 'web' ? 72 : 0),
        paddingBottom: insets.bottom + 120,
        paddingHorizontal: space.lg,
        gap: space.md,
      }}
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}>
      {children}
    </ScrollView>
  );
}
