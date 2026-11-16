import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { DayView } from '@/components/day/day-view';
import { PageSkeleton } from '@/components/ui/card';
import { addDays, isISODate, relativeDay, weekStart } from '@/lib/domain/dates';
import { slotsFor } from '@/lib/domain/slots';
import { getDay, getFavorites, getOnboardedSession, getTargets } from '@/lib/server/data';

export const maxDuration = 300;

export default function DayPage({ params }: { params: Promise<{ fecha: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Day params={params} />
    </Suspense>
  );
}

async function Day({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = await params;
  if (!isISODate(fecha)) notFound();
  const s = await getOnboardedSession();
  const [day, targets, favorites] = await Promise.all([getDay(s, fecha), getTargets(s, fecha), getFavorites(s)]);
  return (
    <div className="space-y-5">
      <header className="animate-rise space-y-3">
        <Link href={`/calendario?semana=${weekStart(fecha)}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" /> Semana</Link>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{relativeDay(fecha, s.today)}</h1>
          <div className="flex gap-1.5">
            <Link aria-label="Día anterior" href={`/calendario/${addDays(fecha, -1)}`} className="grid size-10 place-items-center rounded-full bg-surface-2 text-muted hover:text-fg"><ChevronLeft className="size-5" /></Link>
            <Link aria-label="Día siguiente" href={`/calendario/${addDays(fecha, 1)}`} className="grid size-10 place-items-center rounded-full bg-surface-2 text-muted hover:text-fg"><ChevronRight className="size-5" /></Link>
          </div>
        </div>
      </header>
      <DayView
        date={fecha} today={s.today} meals={day.meals} logs={day.logs} history={day.history} targets={targets}
        favorites={favorites} slots={slotsFor(s.profile.meals_per_day)} planNotes={day.planNotes}
      />
    </div>
  );
}
