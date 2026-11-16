'use client';

import { Check, ChevronDown, Heart, PencilLine, Plus, RefreshCw, SkipForward, Trash2, Undo2, Utensils } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { addFavorite, applyFavoriteAction, setMealStatus, updateIngredients, type ActionResult } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, Pill } from '@/components/ui/card';
import { ErrorText, Input, Label, Textarea } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { postJSON } from '@/lib/client/api';
import { SLOT_LABELS } from '@/lib/domain/slots';
import type { Favorite, Ingredient, MealLog, PlannedMeal } from '@/lib/types';

const STATUS: Record<PlannedMeal['status'], { label: string; tone: 'default' | 'accent' | 'warn' | 'info' }> = {
  planned: { label: 'Pendiente', tone: 'default' },
  completed: { label: 'Cumplido', tone: 'accent' },
  replaced: { label: 'Reemplazado', tone: 'warn' },
  skipped: { label: 'Omitido', tone: 'info' },
};

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : Math.round(n).toString());

function amount(i: Ingredient) {
  if (i.quantity === null) return i.unit || 'al gusto';
  return `${new Intl.NumberFormat('es-BO', { maximumFractionDigits: 1 }).format(i.quantity)} ${i.unit}`;
}

export function MealCard({ meal, replacement, date, editable, favorites, onMessage, onReplace }: {
  meal: PlannedMeal;
  replacement: MealLog | null;
  date: string;
  editable: boolean;
  favorites: Favorite[];
  onMessage: (msg: string, error?: boolean) => void;
  onReplace: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [favOpen, setFavOpen] = useState(false);
  const st = STATUS[meal.status];

  const act = (key: string, fn: () => Promise<ActionResult>) => {
    setBusy(key);
    start(async () => {
      const r = await fn();
      setBusy(null);
      onMessage(r.ok ? r.message ?? 'Hecho.' : r.error, !r.ok);
    });
  };

  return (
    <Card className={`transition ${meal.status === 'planned' ? '' : 'opacity-[0.92]'}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{SLOT_LABELS[meal.slot]}</span>
            <Pill tone={st.tone}>{st.label}</Pill>
          </div>
          <h3 className={`text-[17px] font-semibold leading-snug ${meal.status === 'replaced' ? 'text-muted line-through decoration-faint' : ''}`}>{meal.name}</h3>
          {meal.description ? <p className="mt-0.5 text-sm text-muted">{meal.description}</p> : null}
          <p className="tabular mt-2 text-xs text-faint">
            ~{fmt(meal.kcal)} kcal · <span className="text-protein">P {fmt(meal.protein_g)}</span> · <span className="text-carbs">C {fmt(meal.carbs_g)}</span> · <span className="text-fat">G {fmt(meal.fat_g)}</span>
          </p>
        </div>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? 'Ocultar receta' : 'Ver receta'} className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-muted transition hover:text-fg">
          <ChevronDown className={`size-4 transition ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {replacement ? (
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-[rgba(245,185,113,0.08)] p-3 text-sm">
          <Utensils className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
          <div>
            <p><span className="text-muted">Comiste:</span> {replacement.description}</p>
            <p className="tabular text-xs text-faint">{replacement.kcal !== null ? `~${fmt(replacement.kcal)} kcal` : 'sin estimar'}{replacement.needs_details ? ' · faltan detalles' : ''}</p>
          </div>
        </div>
      ) : null}

      {open ? (
        <div className="mt-4 animate-fade space-y-4 border-t border-line pt-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">Ingredientes</p>
            <ul className="space-y-1.5 text-sm">
              {meal.ingredients.map((i, idx) => (
                <li key={idx} className="flex justify-between gap-3">
                  <span>{i.name}{i.alternatives?.length ? <span className="text-faint"> · o {i.alternatives.join(', ')}</span> : null}</span>
                  <span className="tabular shrink-0 text-muted">{amount(i)}</span>
                </li>
              ))}
            </ul>
          </div>
          {meal.instructions.length ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">Preparación</p>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted marker:text-faint">
                {meal.instructions.map((s, idx) => <li key={idx}>{s}</li>)}
              </ol>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => act('fav', () => addFavorite(meal.id))} loading={busy === 'fav'}><Heart className="size-4" /> Guardar favorito</Button>
            {editable && meal.status === 'planned' ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}><PencilLine className="size-4" /> Editar ingredientes</Button>
                {favorites.length ? <Button size="sm" variant="ghost" onClick={() => setFavOpen(true)}><Heart className="size-4" /> Usar un favorito</Button> : null}
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {editable ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {meal.status === 'planned' ? (
            <>
              <Button size="sm" onClick={() => act('done', () => setMealStatus(date, meal.slot, 'completed'))} loading={busy === 'done'} disabled={pending}><Check className="size-4" /> Lo comí</Button>
              <Button size="sm" variant="secondary" onClick={onReplace} disabled={pending}><Plus className="size-4" /> Comí otra cosa</Button>
              <Button size="sm" variant="secondary" onClick={() => setSwapOpen(true)} disabled={pending}><RefreshCw className="size-4" /> Cambiar plato</Button>
              <Button size="sm" variant="ghost" onClick={() => act('skip', () => setMealStatus(date, meal.slot, 'skipped'))} loading={busy === 'skip'} disabled={pending}><SkipForward className="size-4" /> Omitir</Button>
            </>
          ) : meal.status !== 'replaced' ? (
            <Button size="sm" variant="ghost" onClick={() => act('undo', () => setMealStatus(date, meal.slot, 'planned'))} loading={busy === 'undo'}><Undo2 className="size-4" /> Deshacer</Button>
          ) : null}
        </div>
      ) : null}

      <SwapSheet open={swapOpen} onClose={() => setSwapOpen(false)} date={date} meal={meal} onDone={(msg) => { onMessage(msg); router.refresh(); }} onError={(msg) => onMessage(msg, true)} />
      <IngredientsSheet open={editOpen} onClose={() => setEditOpen(false)} meal={meal} onDone={(r) => onMessage(r.ok ? r.message ?? 'Guardado.' : r.error, !r.ok)} />
      <Sheet open={favOpen} onClose={() => setFavOpen(false)} title={`Usar un favorito en ${SLOT_LABELS[meal.slot].toLowerCase()}`}>
        <ul className="space-y-2">
          {favorites.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => { setFavOpen(false); act('usefav', () => applyFavoriteAction(f.id, date, meal.slot)); }}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 p-3 text-left hover:border-accent">
                <span className="font-medium">{f.name}</span>
                <span className="tabular text-xs text-muted">{fmt(f.kcal)} kcal</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </Card>
  );
}

function SwapSheet({ open, onClose, date, meal, onDone, onError }: { open: boolean; onClose: () => void; date: string; meal: PlannedMeal; onDone: (m: string) => void; onError: (m: string) => void }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const quick = ['No tengo los ingredientes', 'No me apetece', 'Algo más rápido de preparar', 'Algo más económico'];
  async function go() {
    setLoading(true);
    try {
      const r = await postJSON<{ summary: string }>('/api/swap', { date, slot: meal.slot, reason: reason || 'Quiere otra opción' });
      onDone(r.summary);
      onClose();
      setReason('');
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title={`Cambiar «${meal.name}»`}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <button key={q} type="button" onClick={() => setReason(q)} className={`rounded-full border px-3 py-1.5 text-sm ${reason === q ? 'border-accent text-accent' : 'border-line text-muted'}`}>{q}</button>
          ))}
        </div>
        <div><Label htmlFor="why" hint="opcional">Cuéntale qué prefieres</Label><Textarea id="why" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: no tengo pollo, pero sí huevos y quinua" /></div>
        <p className="text-xs text-faint">La IA propondrá un plato con calorías similares, respetando tus alergias y gustos. El cambio queda en el historial.</p>
        <Button size="lg" className="w-full" onClick={go} loading={loading}>{loading ? 'Buscando otra opción…' : 'Proponer otro plato'}</Button>
      </div>
    </Sheet>
  );
}

function IngredientsSheet({ open, onClose, meal, onDone }: { open: boolean; onClose: () => void; meal: PlannedMeal; onDone: (r: ActionResult) => void }) {
  const [rows, setRows] = useState(() => meal.ingredients.map((i) => ({ name: i.name, quantity: i.quantity === null ? '' : String(i.quantity), unit: i.unit, alternatives: (i.alternatives ?? []).join(', ') })));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const update = (idx: number, k: 'name' | 'quantity' | 'unit' | 'alternatives', v: string) => setRows((r) => r.map((x, i) => (i === idx ? { ...x, [k]: v } : x)));
  function save() {
    const ingredients = rows.filter((r) => r.name.trim()).map((r) => ({
      name: r.name.trim(), unit: r.unit.trim(),
      quantity: r.quantity.trim() ? Number(r.quantity.replace(',', '.')) : null,
      alternatives: r.alternatives.split(',').map((a) => a.trim()).filter(Boolean).slice(0, 4),
    }));
    if (ingredients.some((i) => i.quantity !== null && !(i.quantity > 0))) return setError('Revisa las cantidades.');
    start(async () => {
      const r = await updateIngredients(meal.id, ingredients);
      if (!r.ok) return setError(r.error);
      onDone(r);
      onClose();
    });
  }
  return (
    <Sheet open={open} onClose={onClose} title="Editar ingredientes">
      <div className="space-y-3">
        {rows.map((r, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_72px_72px_36px] items-end gap-2">
            <div><Label htmlFor={`n${idx}`}>{idx === 0 ? 'Ingrediente' : <span className="sr-only">Ingrediente</span>}</Label><Input id={`n${idx}`} value={r.name} onChange={(e) => update(idx, 'name', e.target.value)} /></div>
            <div><Label htmlFor={`q${idx}`}>{idx === 0 ? 'Cant.' : <span className="sr-only">Cantidad</span>}</Label><Input id={`q${idx}`} inputMode="decimal" value={r.quantity} onChange={(e) => update(idx, 'quantity', e.target.value)} className="px-2 text-center" /></div>
            <div><Label htmlFor={`u${idx}`}>{idx === 0 ? 'Unidad' : <span className="sr-only">Unidad</span>}</Label><Input id={`u${idx}`} value={r.unit} onChange={(e) => update(idx, 'unit', e.target.value)} className="px-2 text-center" /></div>
            <button type="button" aria-label={`Quitar ${r.name}`} onClick={() => setRows(rows.filter((_, i) => i !== idx))} className="mb-1.5 grid size-9 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
          </div>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setRows([...rows, { name: '', quantity: '', unit: 'g', alternatives: '' }])}><Plus className="size-4" /> Añadir ingrediente</Button>
        <p className="text-xs text-faint">Las calorías mostradas siguen siendo las del plato original; si el cambio es grande, pide a la IA “Cambiar plato”.</p>
        <ErrorText>{error}</ErrorText>
        <Button size="lg" className="w-full" onClick={save} loading={pending}>Guardar ingredientes</Button>
      </div>
    </Sheet>
  );
}
