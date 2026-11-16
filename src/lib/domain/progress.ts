/** Análisis de la evolución del peso con lenguaje sencillo. El peso fluctúa: se razona con promedios semanales. */
import { addDays, weekStart } from './dates';

export interface WeightPoint {
  date: string;
  weight: number;
}

export interface WeekAverage {
  week: string; // lunes
  average: number;
  count: number;
}

export function weeklyAverages(points: WeightPoint[]): WeekAverage[] {
  const map = new Map<string, number[]>();
  for (const p of points) {
    const w = weekStart(p.date);
    map.set(w, [...(map.get(w) ?? []), p.weight]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, ws]) => ({ week, average: Math.round((ws.reduce((s, x) => s + x, 0) / ws.length) * 100) / 100, count: ws.length }));
}

/** Media móvil de 7 días (sobre los días con dato). */
export function movingAverage(points: WeightPoint[], days = 7): (WeightPoint & { avg: number })[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((p) => {
    const from = addDays(p.date, -(days - 1));
    const win = sorted.filter((q) => q.date >= from && q.date <= p.date);
    return { ...p, avg: Math.round((win.reduce((s, q) => s + q.weight, 0) / win.length) * 100) / 100 };
  });
}

/** Pendiente en kg/semana por mínimos cuadrados sobre los promedios semanales. */
export function weeklyTrend(weeks: WeekAverage[]): number | null {
  if (weeks.length < 2) return null;
  const xs = weeks.map((_, i) => i);
  const ys = weeks.map((w) => w.average);
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length;
  const my = ys.reduce((s, y) => s + y, 0) / ys.length;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  return den === 0 ? null : Math.round((num / den) * 100) / 100;
}

const nf = (n: number, d = 1) => new Intl.NumberFormat('es-BO', { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);

export interface ProgressSummary {
  weeks: WeekAverage[];
  trendKgPerWeek: number | null;
  enoughForAdjustments: boolean;
  headline: string;
  explanation: string;
}

/** Resumen sin IA: comparación de semanas y tendencia, recordando que el peso varía de un día a otro. */
export function summarizeProgress(points: WeightPoint[], goal: string | null): ProgressSummary {
  const weeks = weeklyAverages(points).slice(-8);
  const trend = weeklyTrend(weeks.slice(-4));
  const enough = weeks.length >= 3;

  if (points.length === 0) {
    return { weeks, trendKgPerWeek: null, enoughForAdjustments: false, headline: 'Aún no hay registros de peso', explanation: 'Registra tu peso en tu día de control semanal (en ayunas, después de ir al baño) para ver tu evolución.' };
  }
  if (weeks.length < 2) {
    return { weeks, trendKgPerWeek: null, enoughForAdjustments: false, headline: 'Primer control registrado', explanation: 'Con dos semanas de datos podremos comparar. El peso puede variar 1–2 kg entre días por agua, sal o digestión: lo que importa es la tendencia.' };
  }

  const last = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];
  const delta = Math.round((last.average - prev.average) * 10) / 10;
  const dir = delta < -0.05 ? 'bajó' : delta > 0.05 ? 'subió' : 'se mantuvo';
  const headline = dir === 'se mantuvo' ? 'Tu promedio semanal se mantuvo' : `Tu promedio semanal ${dir} ${nf(Math.abs(delta))} kg`;

  let explanation = `Promedio de esta semana: ${nf(last.average)} kg (semana anterior: ${nf(prev.average)} kg). `;
  if (trend !== null && weeks.length >= 3) {
    const t = Math.abs(trend);
    explanation += trend < -0.05
      ? `En las últimas semanas la tendencia es de unos ${nf(t, 2)} kg menos por semana. `
      : trend > 0.05
        ? `En las últimas semanas la tendencia es de unos ${nf(t, 2)} kg más por semana. `
        : 'En las últimas semanas tu peso está estable. ';
    if (goal === 'lose_fat' && trend < -1) explanation += 'Es un ritmo rápido: conviene asegurarse de comer lo suficiente. ';
    if (goal === 'lose_fat' && trend >= -0.05 && weeks.length >= 3) explanation += 'Si se mantiene así varias semanas, se puede plantear un ajuste moderado. ';
  }
  explanation += 'Un cambio de una sola semana puede deberse a líquidos o a la comida del día anterior; por eso miramos varias semanas.';

  return { weeks, trendKgPerWeek: trend, enoughForAdjustments: enough, headline, explanation };
}
