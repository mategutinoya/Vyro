import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import { Checklist } from '@/components/shopping/checklist';
import { EmptyState, PageSkeleton } from '@/components/ui/card';
import { addDays, isISODate, shortDate, weekStart } from '@/lib/domain/dates';
import { buildShoppingList, formatAmount } from '@/lib/domain/shopping';
import { getOnboardedSession, getWeekIngredients } from '@/lib/server/data';

export const metadata = { title: 'Lista de compras' };

type SP = Promise<{ semana?: string }>;

export default function ShoppingPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Shopping searchParams={searchParams} />
    </Suspense>
  );
}

async function Shopping({ searchParams }: { searchParams: SP }) {
  const { semana } = await searchParams;
  const s = await getOnboardedSession();
  const monday = isISODate(semana) ? weekStart(semana) : weekStart(s.today);
  const groups = buildShoppingList(await getWeekIngredients(s, monday)).map((g) => ({
    category: g.category,
    items: g.items.map((i) => ({ key: i.key, name: i.name, meals: i.meals, amount: i.amounts.map(formatAmount).join(' + ') })),
  }));
  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <Link href={`/calendario?semana=${monday}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" /> Calendario</Link>
        <div>
          <p className="text-sm text-muted">Semana del {shortDate(monday)} al {shortDate(addDays(monday, 6))}</p>
          <h1 className="text-3xl font-bold tracking-tight">Lista de compras</h1>
        </div>
        <p className="text-sm text-muted">Cantidades orientativas para una persona, sumadas de todos los platos de la semana (sin los omitidos).</p>
      </header>
      {groups.length ? (
        <Checklist storageKey={`vyro-compras-${monday}`} groups={groups} />
      ) : (
        <EmptyState title="Aún no hay plan esta semana">Genera el plan desde el calendario y aquí aparecerá la lista de compras.</EmptyState>
      )}
    </div>
  );
}
