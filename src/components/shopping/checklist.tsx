'use client';

import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Card } from '@/components/ui/card';

/** Lista marcable. Lo marcado se recuerda en este dispositivo (comodidad personal, no datos importantes). */
export function Checklist({ storageKey, groups }: { storageKey: string; groups: { category: string; items: { key: string; name: string; amount: string; meals: number }[] }[] }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con un sistema externo (localStorage)
      if (raw) setDone(new Set(JSON.parse(raw) as string[]));
    } catch { /* sin almacenamiento */ }
  }, [storageKey]);
  const toggle = (k: string) => {
    const next = new Set(done);
    if (next.has(k)) next.delete(k); else next.add(k);
    setDone(next);
    try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* sin almacenamiento */ }
  };
  const total = groups.reduce((s, g) => s + g.items.length, 0);
  return (
    <div className="space-y-4">
      <p className="tabular text-sm text-muted">{done.size} de {total} comprados</p>
      {groups.map((g) => (
        <section key={g.category} className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{g.category}</h2>
          <Card className="divide-y divide-line px-0 py-0">
            {g.items.map((i) => {
              const on = done.has(i.key);
              return (
                <button key={i.key} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(i.key)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className={`grid size-6 shrink-0 place-items-center rounded-lg border transition ${on ? 'border-accent bg-accent text-accent-ink' : 'border-[#3a3a40]'}`}>{on ? <Check className="size-4" /> : null}</span>
                  <span className={`flex-1 ${on ? 'text-faint line-through' : ''}`}>{i.name}</span>
                  <span className="tabular text-right text-sm text-muted">{i.amount}</span>
                </button>
              );
            })}
          </Card>
        </section>
      ))}
    </div>
  );
}
