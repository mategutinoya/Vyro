import { View } from 'react-native';

import { AppText, Card, ProgressBar } from '@/components/ui';
import { fmt } from '@/lib/format';
import { colors, space } from '@/theme/tokens';

interface Props {
  protein: [number, number];
  carbs: [number, number];
  fat: [number, number];
}

export function MacrosCard({ protein, carbs, fat }: Props) {
  return (
    <Card style={{ gap: space.lg }}>
      <Macro label="Proteína" value={protein} color={colors.protein} emphasis />
      <View style={{ flexDirection: 'row', gap: space.lg }}>
        <View style={{ flex: 1 }}><Macro label="Carbohidratos" value={carbs} color={colors.carbs} /></View>
        <View style={{ flex: 1 }}><Macro label="Grasas" value={fat} color={colors.fat} /></View>
      </View>
    </Card>
  );
}

function Macro({ label, value: [current, target], color, emphasis }: { label: string; value: [number, number]; color: string; emphasis?: boolean }) {
  const left = target - current;
  return (
    <View style={{ gap: space.sm }}>
      <View
        style={{
          flexDirection: emphasis ? 'row' : 'column',
          justifyContent: 'space-between',
          alignItems: emphasis ? 'baseline' : 'flex-start',
          gap: emphasis ? 0 : 2,
        }}>
        <AppText variant={emphasis ? 'bodyStrong' : 'caption'} color={emphasis ? colors.text : colors.textSecondary}>{label}</AppText>
        <AppText variant="caption" color={colors.textSecondary} style={{ fontVariant: ['tabular-nums'] }}>
          <AppText variant={emphasis ? 'caption' : 'bodyStrong'} color={colors.text}>{fmt(current)}</AppText> / {fmt(target)} g
        </AppText>
      </View>
      <ProgressBar progress={target ? current / target : 0} color={color} height={emphasis ? 8 : 6} />
      {emphasis ? (
        <AppText variant="caption" color={colors.textTertiary}>
          {left > 0 ? `Te faltan ${fmt(left)} g para tu objetivo de proteína` : 'Objetivo de proteína cumplido'}
        </AppText>
      ) : null}
    </View>
  );
}
