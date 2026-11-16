import { CalendarCheck2 } from 'lucide-react';
import { Suspense } from 'react';

import { CheckinForm } from '@/components/progress/checkin-form';
import { ProgressReview } from '@/components/progress/review';
import { CaloriesChart, WeeklyBars, WeightChart } from '@/components/progress/weight-chart';
import { Card, PageSkeleton, Pill, SectionTitle } from '@/components/ui/card';
import { addDays, ageOn, isoWeekday, shortDate, WEEKDAYS_ES } from '@/lib/domain/dates';
import { movingAverage, summarizeProgress } from '@/lib/domain/progress';
import { isMinor } from '@/lib/domain/safety';
import { BODY_FAT_SOURCE_LABELS } from '@/lib/domain/schemas';
import { getActivity, getAdherence, getMeasurements, getOnboardedSession, getTargets } from '@/lib/server/data';

export const metadata = { title: 'Mi progreso' };
export const maxDuration = 120;

export default function ProgressPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Progress />
    </Suspense>
  );
}

const nf = (n: number, d = 1) => new Intl.NumberFormat('es-BO', { maximumFractionDigits: d }).format(n);

async function Progress() {
  const s = await getOnboardedSession();
  const p = s.profile;
  const age = p.birth_date ? ageOn(p.birth_date, s.today) : null;
  const minor = isMinor(age);
  const from = addDays(s.today, -27);
  const [measurements, targets, adherence, activity, logs] = await Promise.all([
    getMeasurements(s, 180), getTargets(s, s.today), getAdherence(s, 28), getActivity(s, 28),
    s.db.from('meal_logs').select('log_date, kcal, protein_g').gte('log_date', from).lte('log_date', s.today),
  ]);

  const weights = measurements.filter((m) => m.weight_kg !== null).map((m) => ({ date: m.measured_on, weight: m.weight_kg! }));
  const chart = movingAverage(weights);
  const summary = summarizeProgress(weights, p.goal);
  const fats = measurements.filter((m) => m.body_fat_pct !== null);
  const waists = measurements.filter((m) => m.waist_cm !== null);

  const byDay = new Map<string, { kcal: number; protein: number }>();
  for (const l of (logs.data ?? []) as { log_date: string; kcal: number | null; protein_g: number | null }[]) {
    const d = byDay.get(l.log_date) ?? { kcal: 0, protein: 0 };
    byDay.set(l.log_date, { kcal: d.kcal + (Number(l.kcal) || 0), protein: d.protein + (Number(l.protein_g) || 0) });
  }
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(s.today, i - 13)).map((date) => ({ date, kcal: byDay.get(date)?.kcal ?? 0 }));
  const loggedDays = [...byDay.values()].filter((d) => d.kcal > 0);
  const avgKcal = loggedDays.length ? loggedDays.reduce((a, d) => a + d.kcal, 0) / loggedDays.length : null;
  const avgProtein = loggedDays.length ? loggedDays.reduce((a, d) => a + d.protein, 0) / loggedDays.length : null;
  const isCheckinDay = p.checkin_weekday === isoWeekday(s.today);
  const trainingWeeks = activity.filter((a) => a.kind === 'week_summary');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Mi progreso</h1>
        <p className="mt-1 text-sm text-muted">Tu día de control es el {p.checkin_weekday ? WEEKDAYS_ES[p.checkin_weekday - 1] : '—'}.</p>
      </header>

      <Card className={`space-y-4 ${isCheckinDay ? 'border-accent/40' : ''}`}>
        <div className="flex items-center gap-2">
          <CalendarCheck2 className="size-5 text-accent" aria-hidden />
          <h2 className="font-semibold">{isCheckinDay ? 'Hoy es tu control semanal' : 'Registrar una medición'}</h2>
        </div>
        <p className="text-sm text-muted">Pésate en ayunas, después de ir al baño y con poca ropa. Una vez por semana es suficiente.</p>
        <CheckinForm today={s.today} isCheckinDay={isCheckinDay} minor={minor} />
      </Card>

      <section className="space-y-3">
        <SectionTitle>Evolución del peso</SectionTitle>
        <Card className="space-y-4">
          <div>
            <p className="text-lg font-semibold">{summary.headline}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{summary.explanation}</p>
          </div>
          <WeightChart data={chart} />
          {summary.weeks.length >= 2 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Promedio por semana</p>
              <WeeklyBars data={summary.weeks} />
            </div>
          ) : null}
        </Card>
      </section>

      <section className="space-y-3">
        <SectionTitle>Revisión del nutricionista</SectionTitle>
        <Card className="space-y-3">
          <p className="text-sm text-muted">
            {summary.enoughForAdjustments
              ? 'Con tus semanas de datos, la IA puede revisar la tendencia y, si hace falta, proponer un ajuste moderado que tú decides aplicar.'
              : 'Cuando tengas al menos 3 semanas de controles, la IA podrá sugerir ajustes. Antes de eso sólo explicará tu evolución.'}
          </p>
          <ProgressReview />
        </Card>
      </section>

      {!minor && (fats.length || waists.length) ? (
        <section className="space-y-3">
          <SectionTitle>Composición y medidas</SectionTitle>
          <Card className="divide-y divide-line py-1">
            {[...fats.slice(-4).map((m) => ({ key: `f${m.id}`, date: m.measured_on, label: `${nf(m.body_fat_pct!)} % de grasa`, src: BODY_FAT_SOURCE_LABELS[m.body_fat_source as keyof typeof BODY_FAT_SOURCE_LABELS] ?? 'Origen no indicado', estimated: m.body_fat_source === 'self_estimate' })),
              ...waists.slice(-4).map((m) => ({ key: `w${m.id}`, date: m.measured_on, label: `Cintura ${nf(m.waist_cm!)} cm`, src: 'Medición propia', estimated: false }))]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((r) => (
                <div key={r.key} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>{r.label}</span>
                  <span className="flex items-center gap-2 text-xs text-muted">{shortDate(r.date)} <Pill tone={r.estimated ? 'warn' : 'default'}>{r.estimated ? 'Estimado' : r.src}</Pill></span>
                </div>
              ))}
          </Card>
          <p className="px-1 text-xs text-faint">El porcentaje de grasa varía mucho según el método y el momento: úsalo como referencia, no como cifra exacta.</p>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionTitle>Alimentación · últimas 2 semanas</SectionTitle>
        <Card className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><p className="tabular text-2xl font-bold">{avgKcal ? nf(avgKcal, 0) : '—'}</p><p className="text-xs text-muted">kcal/día{targets ? ` (obj. ${targets.calories})` : ''}</p></div>
            <div><p className="tabular text-2xl font-bold text-protein">{avgProtein ? nf(avgProtein, 0) : '—'}</p><p className="text-xs text-muted">g proteína/día</p></div>
            <div><p className="tabular text-2xl font-bold">{loggedDays.length}</p><p className="text-xs text-muted">días con registros</p></div>
          </div>
          <CaloriesChart data={last14} target={targets?.calories ?? 2000} />
          <p className="text-xs text-faint">Medias calculadas sólo con los días que tienen registros.</p>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionTitle>Constancia · 4 semanas</SectionTitle>
        <Card className="space-y-3">
          {adherence.total ? (
            <>
              <div className="flex h-3 overflow-hidden rounded-full bg-surface-3">
                {([['completed', 'var(--accent)'], ['replaced', 'var(--warn)'], ['skipped', 'var(--info)']] as const).map(([k, c]) => (
                  <div key={k} style={{ width: `${(adherence[k] / adherence.total) * 100}%`, background: c }} />
                ))}
              </div>
              <p className="text-sm text-muted">
                {adherence.completed} comidas según el plan, {adherence.replaced} reemplazadas y {adherence.skipped} omitidas de {adherence.total} planificadas.
                {adherence.replaced > adherence.completed ? ' Si sueles cambiar ciertas comidas, cuéntaselo al nutricionista: adaptará el plan a lo que de verdad comes.' : ''}
              </p>
            </>
          ) : <p className="text-sm text-muted">Aún no hay suficientes días con plan.</p>}
          {trainingWeeks.length ? <p className="text-sm text-muted">Entrenamiento: {trainingWeeks.map((a) => `${a.sessions} días (semana del ${shortDate(a.log_date)})`).join(' · ')}</p> : null}
        </Card>
      </section>
    </div>
  );
}
