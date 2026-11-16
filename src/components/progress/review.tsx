'use client';

import { Sparkles } from 'lucide-react';
import { useState, useTransition } from 'react';

import { applyCalorieAdjustment } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { postJSON } from '@/lib/client/api';

interface Review {
  headline: string;
  explanation: string;
  suggestion: { calories: number; current: number; reason: string } | null;
}

export function ProgressReview() {
  const [r, setR] = useState<Review | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();

  async function run() {
    setLoading(true);
    setMsg(null);
    try {
      setR(await postJSON<Review>('/api/review'));
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {!r ? (
        <Button variant="secondary" onClick={run} loading={loading}><Sparkles className="size-4" /> {loading ? 'Revisando tus semanas…' : 'Revisar mi progreso con la IA'}</Button>
      ) : (
        <div className="animate-rise space-y-3">
          <p className="font-semibold">{r.headline}</p>
          <p className="text-sm leading-relaxed text-muted">{r.explanation}</p>
          {r.suggestion ? (
            <div className="space-y-2 rounded-2xl border border-accent/30 bg-accent-soft p-4">
              <p className="text-sm">Sugerencia moderada: pasar de <b className="tabular">{r.suggestion.current}</b> a <b className="tabular">{r.suggestion.calories} kcal</b> diarias.</p>
              <p className="text-xs text-muted">{r.suggestion.reason}</p>
              <Button size="sm" loading={pending} onClick={() => start(async () => {
                const res = await applyCalorieAdjustment(r.suggestion!.calories, r.suggestion!.reason);
                setMsg(res.ok ? { text: res.message ?? 'Objetivo actualizado.' } : { text: res.error, error: true });
                if (res.ok) setR({ ...r, suggestion: null });
              })}>Aplicar ajuste</Button>
            </div>
          ) : null}
        </div>
      )}
      {msg ? <p role="status" className={`text-sm ${msg.error ? 'text-danger' : 'text-accent'}`}>{msg.text}</p> : null}
    </div>
  );
}
