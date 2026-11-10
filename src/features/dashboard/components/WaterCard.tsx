import { View } from 'react-native';

import { AppText, Card, PressableScale, ProgressBar } from '@/components/ui';
import { fmtWater } from '@/lib/format';
import { colors, radius, space } from '@/theme/tokens';

interface Props {
  consumedMl: number;
  targetMl: number;
  onAdd: (ml: number) => void;
  onUndo: () => void;
  canUndo: boolean;
}

const AMOUNTS = [250, 500];

export function WaterCard({ consumedMl, targetMl, onAdd, onUndo, canUndo }: Props) {
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <AppText variant="heading">Agua</AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          <AppText variant="bodyStrong" color={colors.water}>{fmtWater(consumedMl)}</AppText> de {fmtWater(targetMl)}
        </AppText>
      </View>
      <ProgressBar progress={targetMl ? consumedMl / targetMl : 0} color={colors.water} height={8} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {AMOUNTS.map((ml) => (
          <PressableScale
            key={ml}
            accessibilityRole="button"
            accessibilityLabel={`Añadir ${ml} mililitros de agua`}
            onPress={() => onAdd(ml)}
            style={{ flex: 1, height: 44, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
            <AppText variant="bodyStrong">+ {ml} ml</AppText>
          </PressableScale>
        ))}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Deshacer último registro de agua"
          onPress={onUndo}
          disabled={!canUndo}
          style={{ width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
          <AppText variant="bodyStrong" color={colors.textSecondary}>↺</AppText>
        </PressableScale>
      </View>
    </Card>
  );
}
