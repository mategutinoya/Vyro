import { View } from 'react-native';

import { DemoBadge } from '@/components/DemoBadge';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/api';
import { ACTIVITY_LABELS, GOAL_LABELS } from '@/features/profile/types';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';

export default function ProfileScreen() {
  const { session } = useAuth();
  const { data: profile } = useProfile();

  return (
    <Screen>
      <AppText variant="title" style={{ marginBottom: space.sm }}>Perfil</AppText>
      <Card style={{ gap: space.md }}>
        <Row label="Nombre" value={profile?.display_name ?? '—'} />
        <Row label="Correo" value={session?.user.email ?? '—'} />
        <Row label="Objetivo" value={profile?.goal ? GOAL_LABELS[profile.goal].title : '—'} />
        <Row label="Actividad" value={profile?.activity_level ? ACTIVITY_LABELS[profile.activity_level].title : '—'} />
      </Card>
      <DemoBadge long />
      <AppText variant="caption" color={colors.textTertiary}>La edición del perfil y de los objetivos llega en una próxima etapa.</AppText>
      <Button title="Cerrar sesión" variant="secondary" onPress={() => supabase.auth.signOut()} style={{ marginTop: space.lg }} />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.lg }}>
      <AppText color={colors.textSecondary}>{label}</AppText>
      <AppText variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>{value}</AppText>
    </View>
  );
}
