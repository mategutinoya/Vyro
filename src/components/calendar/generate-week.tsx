'use client';

import { Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { postJSON } from '@/lib/client/api';

/** Genera los días pendientes de la semana (desde hoy o desde el lunes si es futura). */
export function GenerateWeek({ start, days, label }: { start: string; days: number; label: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  async function go() {
    setLoading(true);
    setMsg(null);
    try {
      const r = await postJSON<{ summary: string }>('/api/plan', { start, days });
      setMsg({ text: r.summary });
      router.refresh();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="space-y-2">
      {days > 0 || loading ? (
        <Button onClick={go} loading={loading}><Sparkles className="size-4" /> {loading ? `Preparando ${days} días… (puede tardar un minuto)` : label}</Button>
      ) : null}
      {msg ? <p role="status" className={`text-sm ${msg.error ? 'text-danger' : 'text-accent'}`}>{msg.text}</p> : null}
    </div>
  );
}
