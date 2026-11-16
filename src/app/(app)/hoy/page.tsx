import { Suspense } from 'react';

import { DayView } from '@/components/day/day-view';
import { PageSkeleton } from '@/components/ui/card';
import { relativeDay } from '@/lib/domain/dates';
import { slotsFor } from '@/lib/domain/slots';
import { getDay, getFavorites, getOnboardedSession, getTargets } from '@/lib/server/data';

export const metadata = { title: 'Mi plan de hoy' };
export const maxDuration = 300;

export default function TodayPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Today />
    </Suspense>
  );
}

async function Today() {
  const s = await getOnboardedSession();
  const [day, targets, favorites] = await Promise.all([getDay(s, s.today), getTargets(s, s.today), getFavorites(s)]);
  return (
    <div className="space-y-5">
      <header className="animate-rise">
        <p className="text-sm text-muted">{relativeDay(s.today, s.today)} · {s.today.split('-').reverse().join('/')}</p>
        <h1 className="text-3xl font-bold tracking-tight">Mi plan de hoy</h1>
      </header>
      <DayView
        date={s.today} today={s.today} meals={day.meals} logs={day.logs} history={day.history} targets={targets}
        favorites={favorites} slots={slotsFor(s.profile.meals_per_day)} planNotes={day.planNotes}
      />
    </div>
  );
}
