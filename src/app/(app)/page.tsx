import { ArrowRight, CalendarCheck2, MessageCircle, Scale, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import { Disclaimer } from '@/components/disclaimer';
import { Card, PageSkeleton, Pill, SectionTitle } from '@/components/ui/card';
import { Bar, Ring } from '@/components/ui/ring';
import { hourIn, isoWeekday, longDate, WEEKDAYS_ES } from '@/lib/domain/dates';
import { summarizeProgress } from '@/lib/domain/progress';
import { SLOT_HOUR, SLOT_LABELS } from '@/lib/domain/slots';
import { getAdherence, getDay, getMeasurements, getOnboardedSession, getTargets } from '@/lib/server/data';

export const metadata = { title: 'Inicio' };

export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Home />
    </Suspense>
  );
}

function greeting(h: number) {
  if (h < 5) return 'Buenas noches';
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const nf = (n: number, d = 0) => new Intl.NumberFormat('es-BO', { maximumFractionDigits: d }).format(n);

async function Home() {
  const s = await getOnboardedSession();
  const p = s.profile;
  const hour = hourIn(p.timezone);
  const [day, targets, measurements, adherence] = await Promise.all([getDay(s, s.today), getTargets(s, s.today), getMeasurements(s, 60), getAdherence(s, 7)]);

  const consumed = day.logs.reduce((a, l) => ({ kcal: a.kcal + (l.kcal ?? 0), p: a.p + (l.protein_g ?? 0), c: a.c + (l.carbs_g ?? 0), f: a.f + (l.fat_g ?? 0) }), { kcal: 0, p: 0, c: 0, f: 0 });
  const pending = day.meals.filter((m) => m.status === 'planned');
  const next = pending.find((m) => SLOT_HOUR[m.slot] + 1.5 >= hour) ?? pending[0] ?? null;
  const weights = measurements.filter((m) => m.weight_kg !== null).map((m) => ({ date: m.measured_on, weight: m.weight_kg! }));
  const progress = summarizeProgress(weights, p.goal);
  const isCheckin = p.checkin_weekday === isoWeekday(s.today);
  const checkedToday = measurements.some((m) => m.measured_on === s.today && m.weight_kg !== null);
  const remaining = targets ? targets.calories - consumed.kcal : 0;

  return (
    <div className="space-y-5">
      <header className="animate-rise">
        <p className="text-sm text-muted">{longDate(s.today).charAt(0).toUpperCase() + longDate(s.today).slice(1)}</p>
        <h1 className="text-3xl font-bold tracking-tight">{greeting(hour)}{p.display_name ? `, ${p.display_name.split(' ')[0]}` : ''}</h1>
      </header>

      <div className="stagger space-y-4">
        {isCheckin && !checkedToday ? (
          <Link href="/progreso" className="block">
            <Card className="flex items-center gap-4 border-accent/40 bg-accent-soft transition hover:brightness-110">
              <CalendarCheck2 className="size-6 shrink-0 text-accent" aria-hidden />
              <div className="flex-1">
                <p className="font-semibold">Hoy es tu control semanal</p>
                <p className="text-sm text-muted">Registra tu peso para ver cómo vas.</p>
              </div>
              <ArrowRight className="size-5 text-accent" aria-hidden />
            </Card>
          </Link>
        ) : null}

        {targets ? (
          <Card className="flex items-center gap-5 sm:gap-8">
            <Ring value={consumed.kcal} max={targets.calories}>
              <div>
                <p className="tabular text-2xl font-bold leading-none">{nf(Math.abs(remaining))}</p>
                <p className="mt-1 text-[11px] text-muted">{remaining >= 0 ? 'kcal restantes' : 'kcal por encima'}</p>
              </div>
            </Ring>
            <div className="min-w-0 flex-1 space-y-3">
              <p className="tabular text-sm text-muted"><span className="text-lg font-semibold text-fg">{nf(consumed.kcal)}</span> de {nf(targets.calories)} kcal</p>
              {([['Proteína', consumed.p, targets.protein_g, 'var(--protein)'], ['Carbohidratos', consumed.c, targets.carbs_g, 'var(--carbs)'], ['Grasas', consumed.f, targets.fat_g, 'var(--fat)']] as const).map(([l, v, t, c]) => (
                <div key={l} className="space-y-1">
                  <div className="tabular flex justify-between text-xs"><span className="text-muted">{l}</span><span>{nf(v)} / {t} g</span></div>
                  <Bar value={v} max={t} color={c} className="h-1" />
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <section className="space-y-2">
          <SectionTitle action={<Link href="/hoy" className="text-sm text-accent">Ver plan</Link>}>Tu próxima comida</SectionTitle>
          {day.meals.length === 0 ? (
            <Link href="/hoy" className="block">
              <Card className="flex items-center gap-4 transition hover:border-[#3a3a40]">
                <UtensilsCrossed className="size-6 shrink-0 text-accent" aria-hidden />
                <div className="flex-1"><p className="font-semibold">Genera tu plan de hoy</p><p className="text-sm text-muted">Un menú con alimentos que encuentras en el mercado.</p></div>
                <ArrowRight className="size-5 text-muted" aria-hidden />
              </Card>
            </Link>
          ) : next ? (
            <Link href="/hoy" className="block">
              <Card className="transition hover:border-[#3a3a40]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{SLOT_LABELS[next.slot]}</span>
                  <span className="tabular text-xs text-faint">~{nf(next.kcal ?? 0)} kcal</span>
                </div>
                <p className="mt-1 text-lg font-semibold">{next.name}</p>
                {next.description ? <p className="text-sm text-muted">{next.description}</p> : null}
              </Card>
            </Link>
          ) : (
            <Card><p className="font-semibold">¡Día completado!</p><p className="text-sm text-muted">Todas las comidas de hoy están registradas.</p></Card>
          )}
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/progreso" className="block">
            <Card className="h-full space-y-1 transition hover:border-[#3a3a40]">
              <div className="flex items-center gap-2 text-muted"><Scale className="size-4" aria-hidden /><span className="text-xs font-semibold uppercase tracking-[0.12em]">Peso</span></div>
              <p className="tabular text-2xl font-bold">{weights.length ? `${nf(weights.at(-1)!.weight, 1)} kg` : '—'}</p>
              <p className="text-sm text-muted">{progress.headline}</p>
            </Card>
          </Link>
          <Card className="space-y-2">
            <div className="flex items-center gap-2 text-muted"><UtensilsCrossed className="size-4" aria-hidden /><span className="text-xs font-semibold uppercase tracking-[0.12em]">Esta semana</span></div>
            {adherence.total ? (
              <div className="flex flex-wrap gap-1.5">
                <Pill tone="accent">{adherence.completed} según plan</Pill>
                <Pill tone="warn">{adherence.replaced} cambiadas</Pill>
                {adherence.skipped ? <Pill tone="info">{adherence.skipped} omitidas</Pill> : null}
              </div>
            ) : <p className="text-sm text-muted">Tu resumen aparecerá tras unos días.</p>}
            <p className="text-xs text-faint">Control semanal: {p.checkin_weekday ? WEEKDAYS_ES[p.checkin_weekday - 1] : '—'}</p>
          </Card>
        </div>

        <Link href="/chat" className="block">
          <Card className="flex items-center gap-4 transition hover:border-[#3a3a40]">
            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink"><MessageCircle className="size-5" aria-hidden /></div>
            <div className="flex-1">
              <p className="font-semibold">Habla con tu nutricionista</p>
              <p className="text-sm text-muted">“Hoy comí una salteña a media mañana” · “No tengo pollo”</p>
            </div>
            <ArrowRight className="size-5 text-muted" aria-hidden />
          </Card>
        </Link>
      </div>

      <Disclaimer />
    </div>
  );
}
