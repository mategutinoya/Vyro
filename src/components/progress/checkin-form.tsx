'use client';

import { useState, useTransition } from 'react';

import { saveActivity, saveMeasurement } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { ErrorText, Input, Label, Select } from '@/components/ui/field';
import { BODY_FAT_SOURCE_LABELS, BODY_FAT_SOURCES } from '@/lib/domain/schemas';

const n = (s: string) => {
  const v = Number(s.replace(',', '.'));
  return s.trim() && Number.isFinite(v) ? v : null;
};

export function CheckinForm({ today, isCheckinDay, minor }: { today: string; isCheckinDay: boolean; minor: boolean }) {
  const [v, setV] = useState({ weight: '', waist: '', bf: '', bfSource: '', notes: '', sessions: '' });
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setMsg(null);
    if (!v.weight && !v.waist && !v.bf && !v.sessions) return setMsg({ text: 'Escribe al menos un dato.', error: true });
    if (v.bf && !v.bfSource) return setMsg({ text: 'Indica de dónde sale el % de grasa (estimado o medido).', error: true });
    start(async () => {
      if (v.weight || v.waist || v.bf) {
        const r = await saveMeasurement({
          date: today, weight_kg: n(v.weight), waist_cm: n(v.waist), body_fat_pct: minor ? null : n(v.bf),
          body_fat_source: minor || !v.bf ? null : v.bfSource, notes: v.notes.trim() || null, is_checkin: isCheckinDay,
        });
        if (!r.ok) return setMsg({ text: r.error, error: true });
      }
      if (v.sessions) {
        const r = await saveActivity({ date: today, kind: 'week_summary', description: `Entrené ${v.sessions} días esta semana`, duration_min: null, sessions: Math.round(Number(v.sessions)) });
        if (!r.ok) return setMsg({ text: r.error, error: true });
      }
      setV({ weight: '', waist: '', bf: '', bfSource: '', notes: '', sessions: '' });
      setMsg({ text: 'Control guardado.' });
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div><Label htmlFor="w" hint="kg">Peso</Label><Input id="w" inputMode="decimal" value={v.weight} onChange={(e) => setV({ ...v, weight: e.target.value })} placeholder="75,2" /></div>
        <div><Label htmlFor="waist" hint="cm · opcional">Cintura</Label><Input id="waist" inputMode="decimal" value={v.waist} onChange={(e) => setV({ ...v, waist: e.target.value })} /></div>
        <div><Label htmlFor="ses" hint="opcional">Entrenos</Label><Input id="ses" inputMode="numeric" value={v.sessions} onChange={(e) => setV({ ...v, sessions: e.target.value.replace(/\D/g, '').slice(0, 2) })} placeholder="esta semana" /></div>
      </div>
      {!minor ? (
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="bf" hint="opcional">% grasa</Label><Input id="bf" inputMode="decimal" value={v.bf} onChange={(e) => setV({ ...v, bf: e.target.value })} /></div>
          <div><Label htmlFor="bfs">Origen del dato</Label>
            <Select id="bfs" value={v.bfSource} onChange={(e) => setV({ ...v, bfSource: e.target.value })}>
              <option value="">—</option>
              {BODY_FAT_SOURCES.map((s) => <option key={s} value={s}>{BODY_FAT_SOURCE_LABELS[s]}</option>)}
            </Select>
          </div>
        </div>
      ) : null}
      <div><Label htmlFor="notes" hint="opcional">Notas</Label><Input id="notes" maxLength={500} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} placeholder="Cómo te sentiste esta semana" /></div>
      <ErrorText>{msg?.error ? msg.text : null}</ErrorText>
      {msg && !msg.error ? <p role="status" className="text-sm text-accent">{msg.text}</p> : null}
      <Button onClick={save} loading={pending}>Guardar control</Button>
    </div>
  );
}
