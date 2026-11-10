import { View } from 'react-native';

import { colors, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card style={{ gap: space.md, borderColor: colors.dangerDim }}>
      <AppText variant="bodyStrong">No se pudieron cargar los datos</AppText>
      <AppText variant="caption" color={colors.textSecondary}>{message}</AppText>
      {onRetry ? <Button title="Reintentar" variant="secondary" onPress={onRetry} /> : null}
    </Card>
  );
}

export function Skeleton({ height, radius = 20 }: { height: number; radius?: number }) {
  return <View style={{ height, borderRadius: radius, backgroundColor: colors.surface, opacity: 0.6 }} />;
}
