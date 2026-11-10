import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Card } from '@/components/ui';
import { colors, space } from '@/theme/tokens';

/** Se muestra cuando faltan las credenciales públicas de Supabase en el archivo .env. */
export function SetupRequired({ secretKey }: { secretKey: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + space.xxxl, padding: space.xl, gap: space.lg }}>
      <AppText variant="overline" color={colors.accent}>Configuración</AppText>
      <AppText variant="title">{secretKey ? 'Clave no permitida' : 'Conecta Supabase'}</AppText>
      {secretKey ? (
        <AppText color={colors.textSecondary}>
          Has puesto una clave secreta (service_role / sb_secret_) en el archivo .env. Esa clave nunca debe ir dentro de la app.
          Sustitúyela por la clave pública (publishable / anon).
        </AppText>
      ) : (
        <AppText color={colors.textSecondary}>
          Falta el archivo .env con las claves públicas de tu proyecto de Supabase. Sigue la guía del archivo README.md.
        </AppText>
      )}
      <Card style={{ gap: space.sm }}>
        <AppText variant="caption" color={colors.textSecondary}>Archivo .env en la raíz del proyecto:</AppText>
        <View style={{ gap: 4 }}>
          <AppText variant="caption">EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co</AppText>
          <AppText variant="caption">EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…</AppText>
        </View>
      </Card>
      <AppText variant="caption" color={colors.textTertiary}>Después reinicia el servidor con: npx expo start -c</AppText>
    </ScrollView>
  );
}
