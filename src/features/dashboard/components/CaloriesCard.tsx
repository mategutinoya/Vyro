import { View } from 'react-native';

import { AppText, Card, ProgressRing } from '@/components/ui';
import { fmt } from '@/lib/format';
import { colors, space } from '@/theme/tokens';

interface Props {
  consumed: number;
  target: number;
}

export function CaloriesCard({ consumed, target }: Props) {
  const remaining = target - consumed;
  const over = remaining < 0;
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.xl, padding: space.xl }}>
      <ProgressRing size={148} stroke={12} progress={target ? consumed / target : 0} color={over ? colors.danger : colors.accent}>
        <AppText variant="metric" style={{ fontSize: 30, lineHeight: 34 }}>{fmt(Math.abs(remaining))}</AppText>
        <AppText variant="caption" color={colors.textSecondary}>{over ? 'kcal de más' : 'kcal restantes'}</AppText>
      </ProgressRing>
      <View style={{ flex: 1, gap: space.lg }}>
        <Stat label="Consumidas" value={fmt(consumed)} />
        <View style={{ height: 1, backgroundColor: colors.hairline }} />
        <Stat label="Objetivo" value={fmt(target)} />
      </View>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <AppText variant="overline" color={colors.textSecondary}>{label}</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <AppText variant="metric">{value}</AppText>
        <AppText variant="caption" color={colors.textTertiary}>kcal</AppText>
      </View>
    </View>
  );
}
