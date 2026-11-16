'use client';

import { History, Lightbulb, Plus, Scale, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { removeMealLog } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, Pill, SectionTitle } from '@/components/ui/card';
import { Bar } from '@/components/ui/ring';
import { postJSON } from '@/lib/client/api';
import { diffDays } from '@/lib/domain/dates';
import { SLOT_LABELS, type Slot } from '@/lib/domain/slots';
import type { ChangeEntry, Favorite, MealLog, PlannedMeal, TargetsRow } from '@/lib/types';

import { LogMealSheet } from './log-meal-sheet';
import { MealCard } from './meal-card';

const fmt = (n: number) => Math.round(n).toLocaleString('es-BO');

export function DayView({ date, today, meals, logs, history, targets, favorites, slots, planNotes }: {
  date: string;
  today: string;
  meals: PlannedMeal[];
  logs: MealLog[];
  history: ChangeEntry[];
  targets: TargetsRow | null;
  favorites: Favorite[];
  slots: Slot[];
  planNotes: string | null;
}) {
  const router = useRouter();
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [logOpen, setLogOpen] = useState<Slot | null>(null);
  const [generating, setGenerating] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [, start] = useTransition();
  const offset = diffDays(date, today);
  const editable = offset >= -7 && offset <= 1; // registrar: hasta hoy (y corregir la última semana)
  const plannable = offset >= -1 && offset <= 14;

  const say = (text: string, error = false) => {
    setToast({ text, error });
    window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 5000);
  };

  const consumed = logs.reduce((acc, l) => ({
    kcal: acc.kcal + (l.kcal ?? 0), p: acc.p + (l.protein_g ?? 0), c: acc.c + (l.carbs_g ?? 0), f: acc.f + (l.fat_g ?? 0),
  }), { kcal: 0, p: 0, c: 0, f: 0 });
  const plannedKcal = meals.reduce((s, m) => s + (m.kcal ?? 0), 0);
  const replacementFor = (m: PlannedMeal) => (m.replaced_by ? logs.find((l) => l.id === m.replaced_by) ?? null : null);
  const extraLogs = logs.filter((l) => !l.followed_plan && !meals.some((m) => m.replaced_by === l.id));
  const pendingCount = meals.filter((m) => m.status === 'planned').length;
  const hasExtraIntake = targets && consumed.kcal > 0 && pendingCount > 0 && offset === 0;

  async function generate(request?: string) {
    setGenerating(true);
    try {
      const r = await postJSON<{ summary: string }>('/api/plan', { start: date, days: 1, request });
      say(r.summary);
      router.refresh();
    } catch (e) {
      say(e instanceof Error ? e.message : String(e), true);
    } finally {
      setGenerating(false);
    }
  }

  async function adjust() {
    setAdjusting(true);
    try {
      const r = await postJSON<{ summary: string }>('/api/adjust', { date });
      say(r.summary);
      router.refresh();
    } catch (e) {
      say(e instanceof Error ? e.message : String(e), true);
    } finally {
      setAdjusting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Totales del día */}
      {targets ? (
        <Card className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs text-muted">{offset > 0 ? 'Planificado' : 'Registrado'}</p>
              <p className="tabular text-3xl font-bold tracking-tight">{fmt(offset > 0 ? plannedKcal : consumed.kcal)}<span className="ml-1 text-base font-medium text-faint">/ {fmt(targets.calories)} kcal</span></p>
            </div>
            {offset <= 0 && meals.length ? <p className="tabular text-right text-xs text-faint">Plan: ~{fmt(plannedKcal)} kcal</p> : null}
          </div>
          <Bar value={offset > 0 ? plannedKcal : consumed.kcal} max={targets.calories} />
          {offset <= 0 ? (
            <div className="grid grid-cols-3 gap-3 text-xs">
              {([['Proteína', consumed.p, targets.protein_g, 'var(--protein)'], ['Carbos', consumed.c, targets.carbs_g, 'var(--carbs)'], ['Grasas', consumed.f, targets.fat_g, 'var(--fat)']] as const).map(([l, v, t, c]) => (
                <div key={l} className="space-y-1.5">
                  <p className="text-muted">{l}</p>
                  <p className="tabular whitespace-nowrap"><span className="text-fg">{fmt(v)}</span><span className="text-faint"> / {t} g</span></p>
                  <Bar value={v} max={t} color={c} className="h-1" />
                </div>
              ))}
            </div>
          ) : null}
          {targets.minor_safe_mode ? <p className="text-xs text-info">Modo seguro para menores: lo importante es comer suficiente y variado.</p> : null}
        </Card>
      ) : null}

      {hasExtraIntake && consumed.kcal > targets!.calories * 0.75 && pendingCount > 0 ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-[rgba(245,185,113,0.25)]">
          <p className="text-sm text-muted">¿Comiste más de lo previsto? Puedo aligerar un poco lo que queda del día, sin saltarte comidas.</p>
          <Button size="sm" variant="secondary" onClick={adjust} loading={adjusting}><Scale className="size-4" /> Ajustar el resto del día</Button>
        </Card>
      ) : null}

      {/* Comidas planificadas */}
      {meals.length === 0 ? (
        <EmptyState
          title={plannable ? 'Aún no hay plan para este día' : 'Sin plan este día'}
          action={plannable ? <Button onClick={() => generate()} loading={generating}><Sparkles className="size-4" /> {generating ? 'Preparando tu menú…' : 'Generar el plan del día'}</Button> : undefined}>
          {plannable ? 'Vyro preparará desayuno, almuerzo, merienda y cena con alimentos fáciles de conseguir, según tus gustos y objetivos.' : null}
        </EmptyState>
      ) : (
        <div className="stagger space-y-3">
          {meals.map((m) => (
            <MealCard
              key={m.id} meal={m} replacement={replacementFor(m)} date={date} editable={editable} favorites={favorites}
              onMessage={say} onReplace={() => setLogOpen(m.slot)}
            />
          ))}
        </div>
      )}

      {planNotes ? <p className="flex items-start gap-2 px-1 text-sm text-muted"><Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />{planNotes}</p> : null}

      <div className="flex flex-wrap gap-2">
        {editable ? <Button variant="secondary" onClick={() => setLogOpen(slots[0])}><Plus className="size-4" /> Registrar otra comida</Button> : null}
        {meals.length > 0 && plannable && pendingCount > 0 ? (
          <Button variant="ghost" onClick={() => generate('Quiero opciones diferentes para este día')} loading={generating}>
            <Wand2 className="size-4" /> {generating ? 'Regenerando…' : 'Regenerar lo pendiente'}
          </Button>
        ) : null}
      </div>

      {/* Comidas fuera del plan */}
      {extraLogs.length ? (
        <section className="space-y-2">
          <SectionTitle>Fuera del plan</SectionTitle>
          {extraLogs.map((l) => (
            <Card key={l.id} className="flex items-start justify-between gap-3 py-3.5">
              <div className="min-w-0">
                <p className="text-xs text-muted">{SLOT_LABELS[l.slot]}</p>
                <p className="font-medium">{l.description}</p>
                <p className="tabular text-xs text-faint">{l.kcal !== null ? `~${fmt(l.kcal)} kcal` : 'sin estimar'}{l.needs_details ? ' · ' : ''}{l.needs_details ? <Pill tone="warn" className="ml-1 py-0">faltan detalles</Pill> : null}</p>
              </div>
              {editable ? (
                <button type="button" aria-label={`Eliminar ${l.description}`} onClick={() => start(async () => { const r = await removeMealLog(l.id); say(r.ok ? r.message ?? 'Eliminado.' : r.error, !r.ok); })}
                  className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
              ) : null}
            </Card>
          ))}
        </section>
      ) : null}

      {/* Reemplazos: permitir deshacer eliminando el registro */}
      {meals.some((m) => m.status === 'replaced') && editable ? (
        <p className="px-1 text-xs text-faint">
          Para deshacer un reemplazo, elimínalo:{' '}
          {meals.filter((m) => m.status === 'replaced').map((m) => {
            const rep = replacementFor(m);
            return rep ? (
              <button key={m.id} type="button" className="mr-2 underline decoration-dotted hover:text-fg" onClick={() => start(async () => { const r = await removeMealLog(rep.id); say(r.ok ? r.message ?? 'Eliminado.' : r.error, !r.ok); })}>
                quitar «{rep.description}»
              </button>
            ) : null;
          })}
        </p>
      ) : null}

      {/* Historial de cambios */}
      {history.length ? (
        <section className="space-y-2">
          <SectionTitle>Cambios del día</SectionTitle>
          <Card className="divide-y divide-line py-1">
            {history.map((h) => (
              <div key={h.id} className="flex items-start gap-3 py-2.5 text-sm">
                <History className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden />
                <div className="min-w-0">
                  <p>{h.summary}</p>
                  <p className="text-xs text-faint">
                    {new Date(h.created_at).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })} · {h.actor === 'assistant' ? 'Nutricionista IA' : h.actor === 'user' ? 'Tú' : 'Sistema'}
                    {h.reason ? ` · ${h.reason}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      {logOpen ? (
        <LogMealSheet
          key={logOpen} open onClose={() => setLogOpen(null)} date={date} slots={slots} defaultSlot={logOpen}
          plannedName={(s) => meals.find((m) => m.slot === s && m.status === 'planned')?.name ?? null}
          onDone={(msg) => say(msg)}
        />
      ) : null}

      {toast ? (
        <div role="status" aria-live="polite" className={`fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-40 mx-auto max-w-md animate-rise rounded-2xl border px-4 py-3 text-sm shadow-2xl lg:bottom-6 ${toast.error ? 'border-danger/40 bg-[#2a1515] text-danger' : 'border-line bg-surface-3 text-fg'}`}>
          {toast.text}
        </div>
      ) : null}
    </div>
  );
}
