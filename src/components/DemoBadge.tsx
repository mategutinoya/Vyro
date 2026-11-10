import { View } from 'react-native';

import { AppText } from '@/components/ui';
import { env } from '@/lib/env';
import { colors, radius, space } from '@/theme/tokens';

/** Aviso visible de que los datos son locales (sólo en modo demo). */
export function DemoBadge({ long }: { long?: boolean }) {
  if (!env.demo) return null;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: space.sm + 2,
        paddingVertical: 4,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.border,
      }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.fat }} />
      <AppText variant="caption" color={colors.textSecondary}>
        {long ? 'Modo demo · tus datos se guardan sólo en este navegador' : 'Modo demo'}
      </AppText>
    </View>
  );
}
