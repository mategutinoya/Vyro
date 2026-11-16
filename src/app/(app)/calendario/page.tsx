import { ChevronLeft, ChevronRight, ShoppingBasket } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import { GenerateWeek } from '@/components/calendar/generate-week';
import { Card, PageSkeleton } from '@/components/ui/card';
import { addDays, isISODate, shortDate, weekStart, WEEKDAYS_ES } from '@/lib/domain/dates';
import { SLOT_LABELS, type Slot } from '@/lib/domain/slots';
import { getOnboardedSession, getTargets, getWeek } from '@/lib/server/data';

export const metadata = { title: 'Calendario' };
export const maxDuration = 300;

type SP = Promise<{ semana?: string }>;

export default function CalendarPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Calendar searchParams={searchParams} />
    </Suspense>
  );
}

const DOT: Record<string, string> = {
  planned: 'bg-surface-3 ring-1 ring-inset ring-[#3a3a40]',
  completed: 'bg-accent',
  replaced: 'bg-warn',
  skipped: 'bg-info/60',
};

async function Calendar({ searchParams }: { searchParams: SP }) {
  const { semana } = await searchParams;
  const s = await getOnboardedSession();
  const monday = isISODate(semana) ? weekStart(semana) : weekStart(s.today);
  const [week, targets] = await Promise.all([getWeek(s, monday), getTargets(s, s.today)]);
  const isCurrent = monday === weekStart(s.today);
  const firstPlannable = monday > s.today ? monday : s.today;
  const missing = week.filter((d) => d.date >= firstPlannable && d.meals.length === 0);
  const genStart = missing[0]?.date ?? firstPlannable;
  const genDays = missing.length ? Math.min(7, week.filter((d) => d.date >= genStart).length) : 0;

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{isCurrent ? 'Esta semana' : `Semana del ${shortDate(monday)}`}</p>
          <h1 className="text-3xl font-bold tracking-tight">Calendario</h1>
        </div>
        <div className="flex gap-1.5">
          <Link aria-label="Semana anterior" href={`/calendario?semana=${addDays(monday, -7)}`} className="grid size-10 place-items-center rounded-full bg-surface-2 text-muted hover:text-fg"><ChevronLeft className="size-5" /></Link>
          {!isCurrent ? <Link href="/calendario" className="grid h-10 place-items-center rounded-full bg-surface-2 px-4 text-sm text-muted hover:text-fg">Hoy</Link> : null}
          <Link aria-label="Semana siguiente" href={`/calendario?semana=${addDays(monday, 7)}`} className="grid size-10 place-items-center rounded-full bg-surface-2 text-muted hover:text-fg"><ChevronRight className="size-5" /></Link>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {([['completed', 'Cumplido'], ['replaced', 'Reemplazado'], ['skipped', 'Omitido'], ['planned', 'Pendiente']] as const).map(([k, l]) => (
          <span key={k} className="inline-flex items-center gap-1.5"><span className={`size-2.5 rounded-full ${DOT[k]}`} />{l}</span>
        ))}
      </div>

      <div className="stagger grid gap-2.5 sm:grid-cols-2">
        {week.map((d, i) => {
          const isToday = d.date === s.today;
          const planned = d.meals.reduce((sum, m) => sum + (m.kcal ?? 0), 0);
          return (
            <Link key={d.date} href={`/calendario/${d.date}`} className="group min-w-0">
              <Card className={`h-full min-w-0 transition group-hover:border-[#3a3a40] ${isToday ? 'border-accent/50' : ''}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold capitalize">{WEEKDAYS_ES[i]} <span className="font-normal text-muted">{shortDate(d.date)}</span></p>
                  {isToday ? <span className="text-xs font-semibold text-accent">Hoy</span> : null}
                </div>
                {d.meals.length ? (
                  <ul className="mt-2.5 space-y-1.5">
                    {d.meals.map((m) => (
                      <li key={m.slot} className="flex min-w-0 items-center gap-2 text-sm">
                        <span className={`size-2.5 shrink-0 rounded-full ${DOT[m.status] ?? DOT.planned}`} aria-label={m.status} />
                        <span className="w-20 shrink-0 text-xs text-faint">{SLOT_LABELS[m.slot as Slot]}</span>
                        <span className={`min-w-0 truncate ${m.status === 'replaced' ? 'text-muted line-through decoration-faint' : ''}`}>{m.name}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2.5 text-sm text-faint">Sin plan</p>
                )}
                <p className="tabular mt-3 text-xs text-faint">
                  {d.loggedKcal ? `Registrado ~${Math.round(d.loggedKcal)} kcal · ` : ''}{planned ? `Plan ~${Math.round(planned)}` : ''}{targets && planned ? ` / ${targets.calories} kcal` : ''}
                  {d.extraLogs ? ` · ${d.extraLogs} fuera del plan` : ''}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap items-start gap-3">
        {/* Siempre montado: así el mensaje de confirmación sobrevive al refresco aunque ya no falten días. */}
        <GenerateWeek key={monday} start={genStart} days={genDays} label={genDays === 7 ? 'Generar la semana' : `Generar los ${genDays} días que faltan`} />
        <Link href={`/compras?semana=${monday}`} className="inline-flex h-11 items-center gap-2 rounded-full bg-surface-3 px-5 text-sm font-semibold hover:bg-[#2b2b30]">
          <ShoppingBasket className="size-4" /> Lista de compras
        </Link>
      </div>
    </div>
  );
}
