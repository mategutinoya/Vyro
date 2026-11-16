'use client';

import { Sparkles } from 'lucide-react';
import { useState, useTransition } from 'react';

import { logMeal } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { ErrorText, Input, Label, Select, Textarea } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { postJSON } from '@/lib/client/api';
import { SLOT_LABELS, type Slot } from '@/lib/domain/slots';

interface Estimate {
  items: { name: string; quantity: number | null; unit: string }[];
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: 'high' | 'medium' | 'low';
  question: string | null;
}

const n = (s: string) => {
  const v = Number(s.replace(',', '.'));
  return s.trim() && Number.isFinite(v) ? v : null;
};

/**
 * "Comí otra cosa" / "Registrar comida". Si en ese momento había una comida planificada pendiente,
 * se registra como REEMPLAZO (el plan queda como reemplazado, no como cumplido).
 */
export function LogMealSheet({ open, onClose, date, slots, defaultSlot, plannedName, onDone }: {
  open: boolean;
  onClose: () => void;
  date: string;
  slots: Slot[];
  defaultSlot: Slot;
  plannedName?: (slot: Slot) => string | null;
  onDone: (msg: string) => void;
}) {
  const [slot, setSlot] = useState<Slot>(defaultSlot);
  const [desc, setDesc] = useState('');
  const [m, setM] = useState({ kcal: '', protein_g: '', carbs_g: '', fat_g: '' });
  const [est, setEst] = useState<Estimate | null>(null);
  const [needsDetails, setNeedsDetails] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const planned = plannedName?.(slot) ?? null;

  async function estimate() {
    setError(null);
    setEstimating(true);
    try {
      const e = await postJSON<Estimate>('/api/estimate', { description: desc });
      setEst(e);
      setM({ kcal: String(Math.round(e.kcal)), protein_g: String(Math.round(e.protein_g)), carbs_g: String(Math.round(e.carbs_g)), fat_g: String(Math.round(e.fat_g)) });
      setNeedsDetails(!!e.question);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEstimating(false);
    }
  }

  function save() {
    setError(null);
    start(async () => {
      const r = await logMeal({
        date, slot, description: desc.trim(), items: est?.items ?? [],
        kcal: n(m.kcal), protein_g: n(m.protein_g), carbs_g: n(m.carbs_g), fat_g: n(m.fat_g),
        confidence: est?.confidence ?? null, needs_details: needsDetails,
        relation_to_plan: planned ? 'replaced_plan' : 'extra',
      }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? 'Revisa los datos.' : String(e) }));
      if (!r.ok) return setError(r.error);
      setDesc(''); setEst(null); setM({ kcal: '', protein_g: '', carbs_g: '', fat_g: '' }); setNeedsDetails(false);
      onDone(r.message ?? 'Comida registrada.');
      onClose();
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title="Registrar lo que comí">
      <div className="space-y-4">
        <div>
          <Label htmlFor="slot">Momento</Label>
          <Select id="slot" value={slot} onChange={(e) => setSlot(e.target.value as Slot)}>
            {slots.map((s) => <option key={s} value={s}>{SLOT_LABELS[s]}</option>)}
          </Select>
          {planned ? (
            <p className="mt-1.5 text-xs text-muted">Reemplazará a «{planned}» del plan (quedará marcado como reemplazado, no como cumplido).</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="desc">¿Qué comiste?</Label>
          <Textarea id="desc" value={desc} maxLength={300} onChange={(e) => setDesc(e.target.value)} placeholder="Ej.: una hamburguesa con papas fritas y una gaseosa mediana" />
          <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={estimate} loading={estimating} disabled={desc.trim().length < 3}>
            <Sparkles className="size-4" aria-hidden /> Estimar con IA
          </Button>
        </div>
        {est ? (
          <div className="rounded-2xl bg-surface-2 p-3 text-sm text-muted">
            <p>Estimación {est.confidence === 'high' ? 'bastante segura' : est.confidence === 'medium' ? 'aproximada' : 'poco precisa'}. Puedes corregir las cifras.</p>
            {est.question ? <p className="mt-1 text-warn">Para afinar: {est.question}</p> : null}
          </div>
        ) : null}
        <div className="grid grid-cols-4 gap-2">
          {([['kcal', 'kcal'], ['protein_g', 'Prot. g'], ['carbs_g', 'Carb. g'], ['fat_g', 'Grasa g']] as const).map(([k, label]) => (
            <div key={k}><Label htmlFor={k}>{label}</Label><Input id={k} inputMode="decimal" value={m[k]} onChange={(e) => setM({ ...m, [k]: e.target.value })} className="px-3 text-center" /></div>
          ))}
        </div>
        <p className="text-xs text-faint">Las cifras son opcionales. Si no las sabes, usa “Estimar con IA” o déjalas vacías.</p>
        <ErrorText>{error}</ErrorText>
        <Button size="lg" className="w-full" onClick={save} loading={pending} disabled={desc.trim().length < 2}>Guardar</Button>
      </div>
    </Sheet>
  );
}
