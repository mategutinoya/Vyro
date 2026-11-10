import { View } from 'react-native';

import { addDays, parseISODate, todayISO } from '@/lib/date';
import { colors, radius } from '@/theme/tokens';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function relativeDayLabel(iso: string, today: string = todayISO()): string {
  if (iso === today) return 'Hoy';
  if (iso === addDays(today, -1)) return 'Ayer';
  if (iso === addDays(today, 1)) return 'Mañana';
  const d = parseISODate(iso);
  const day = DAYS[d.getDay()];
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

interface Props {
  date: string;
  onChange: (iso: string) => void;
  today: string;
}

/** ‹ Hoy › — navega por días; pulsar el centro vuelve a hoy. No permite ir al futuro más allá de mañana. */
export function DateNavigator({ date, onChange, today }: Props) {
  const canNext = date < addDays(today, 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4 }}>
      <Arrow label="Día anterior" glyph="‹" onPress={() => onChange(addDays(date, -1))} />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={date === today ? 'Hoy' : 'Volver a hoy'}
        haptic={false}
        onPress={() => onChange(today)}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 36 }}>
        <AppText variant="bodyStrong">{relativeDayLabel(date, today)}</AppText>
      </PressableScale>
      <Arrow label="Día siguiente" glyph="›" onPress={() => onChange(addDays(date, 1))} disabled={!canNext} />
    </View>
  );
}

function Arrow({ label, glyph, onPress, disabled }: { label: string; glyph: string; onPress: () => void; disabled?: boolean }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
      <AppText variant="heading" style={{ marginTop: -2 }}>{glyph}</AppText>
    </PressableScale>
  );
}
