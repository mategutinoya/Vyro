import { View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import type { WeekSummary } from '@/features/progress/api';
import { isoWeekday } from '@/lib/date';
import { fmt, fmt1 } from '@/lib/format';
import { colors, radius, space } from '@/theme/tokens';

const DAY_INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const CHART_H = 64;

export function WeekCard({ data, targetKcal }: { data: WeekSummary; targetKcal: number }) {
  const max = Math.max(targetKcal * 1.25, ...data.days.map((d) => d.kcal), 1);
  const targetY = (targetKcal / max) * CHART_H;

  return (
    <Card style={{ gap: space.lg }}>
      <AppText variant="overline" color={colors.textSecondary}>Últimos 7 días</AppText>

      <View>
        <View style={{ height: CHART_H, flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
          {data.days.map((d, i) => {
            const isToday = i === data.days.length - 1;
            const h = d.kcal > 0 ? Math.max(4, (d.kcal / max) * CHART_H) : 4;
            return (
              <View key={d.date} style={{ flex: 1, alignItems: 'center' }}>
                <View
                  style={{
                    width: '100%',
                    maxWidth: 22,
                    height: h,
                    borderRadius: radius.sm / 2,
                    backgroundColor: d.kcal === 0 ? colors.track : isToday ? colors.accent : colors.textTertiary,
                  }}
                />
              </View>
            );
          })}
        </View>
        {targetKcal > 0 ? (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, bottom: targetY, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.accentDim }}
          />
        ) : null}
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
          {data.days.map((d) => (
            <AppText key={d.date} variant="caption" color={colors.textTertiary} align="center" style={{ flex: 1 }}>
              {DAY_INITIALS[isoWeekday(d.date) - 1]}
            </AppText>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: 'row' }}>
        <Metric label="Media diaria" value={data.avgKcal !== null ? fmt(data.avgKcal) : '—'} unit={data.avgKcal !== null ? 'kcal' : ''} />
        <Metric
          label="Peso"
          value={data.latestWeight ? fmt1(data.latestWeight.kg) : '—'}
          unit={data.latestWeight ? 'kg' : ''}
          sub={data.weightChange !== null ? `${data.weightChange > 0 ? '+' : ''}${fmt1(data.weightChange)} kg en 30 d` : undefined}
        />
        <Metric label="Entrenos" value={String(data.workoutsThisWeek)} unit="" />
      </View>
    </Card>
  );
}

function Metric({ label, value, unit, sub }: { label: string; value: string; unit: string; sub?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <AppText variant="caption" color={colors.textSecondary}>{label}</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <AppText variant="metric" style={{ fontSize: 19 }}>{value}</AppText>
        {unit ? <AppText variant="caption" color={colors.textTertiary}>{unit}</AppText> : null}
      </View>
      {sub ? <AppText variant="caption" color={colors.textTertiary} style={{ fontSize: 11 }}>{sub}</AppText> : null}
    </View>
  );
}
