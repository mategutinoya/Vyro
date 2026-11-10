import { View } from 'react-native';

import { fmt } from '@/lib/format';
import { colors, space } from '@/theme/tokens';

import { AppText } from './AppText';

interface Props {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  size?: 'sm' | 'lg';
}

/** Fila compacta: kcal · P · C · G con sus colores. */
export function MacroSummary({ kcal, protein, carbs, fat, size = 'sm' }: Props) {
  const big = size === 'lg';
  return (
    <View style={{ flexDirection: 'row', gap: big ? space.sm : space.md, alignItems: 'baseline', flexWrap: 'wrap' }}>
      {big ? (
        <Cell big value={fmt(kcal)} unit="kcal" label="Energía" color={colors.text} />
      ) : (
        <AppText variant="caption" color={colors.text}>{fmt(kcal)} kcal</AppText>
      )}
      <Cell big={big} value={fmt(protein)} unit={big ? 'g' : 'P'} label="Proteína" color={colors.protein} />
      <Cell big={big} value={fmt(carbs)} unit={big ? 'g' : 'C'} label="Carbos" color={colors.carbs} />
      <Cell big={big} value={fmt(fat)} unit={big ? 'g' : 'G'} label="Grasas" color={colors.fat} />
    </View>
  );
}

function Cell({ value, unit, label, color, big }: { value: string; unit: string; label: string; color: string; big?: boolean }) {
  if (!big)
    return (
      <AppText variant="caption" color={colors.textSecondary}>
        <AppText variant="caption" color={color}>{value}</AppText> {unit}
      </AppText>
    );
  return (
    <View style={{ flex: 1, minWidth: 64, backgroundColor: colors.surfaceRaised, borderRadius: 14, padding: space.md, gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
        <AppText variant="metric" color={color} style={{ fontSize: 20 }}>{value}</AppText>
        <AppText variant="caption" color={colors.textTertiary}>{unit}</AppText>
      </View>
      <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>{label}</AppText>
    </View>
  );
}
