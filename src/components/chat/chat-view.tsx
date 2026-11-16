'use client';

import { ArrowUp, CheckCircle2, CircleAlert, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { clearChat } from '@/app/actions';
import { Disclaimer } from '@/components/disclaimer';
import { postJSON } from '@/lib/client/api';
import type { ChatMessage } from '@/lib/types';

const SUGGESTIONS = [
  'Hoy pesé 75 kg',
  'Hoy tenía pollo con arroz para cenar, pero comí una hamburguesa con papas',
  'No tengo pollo en mi casa',
  'Quiero comer algo diferente mañana',
  'No me gustó el almuerzo',
  'Esta semana entrené solamente dos días',
];

type Msg = Pick<ChatMessage, 'role' | 'content' | 'actions'> & { id: string; pending?: boolean; error?: boolean };

export function ChatView({ initial, name }: { initial: ChatMessage[]; name: string | null }) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs.length, busy]);

  async function send(raw: string) {
    const content = raw.trim();
    if (!content || busy) return;
    setText('');
    setBusy(true);
    const tmp = `tmp-${Date.now()}`;
    setMsgs((m) => [...m, { id: tmp, role: 'user', content, actions: [] }]);
    try {
      const r = await postJSON<{ reply: string; actions: ChatMessage['actions'] }>('/api/chat', { message: content });
      setMsgs((m) => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: r.reply, actions: r.actions }]);
      if (r.actions.some((a) => a.ok)) router.refresh();
    } catch (e) {
      setMsgs((m) => [...m, { id: `e-${Date.now()}`, role: 'assistant', content: e instanceof Error ? e.message : String(e), actions: [], error: true }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-220px)] flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nutricionista IA</h1>
          <p className="mt-1 text-sm text-muted">Cuéntame qué comiste, cómo te fue o qué necesitas. Yo actualizo tu plan y tus registros.</p>
        </div>
        {msgs.length ? (
          <button type="button" aria-label="Borrar conversación" title="Borrar conversación (tus registros se conservan)"
            onClick={() => start(async () => { const r = await clearChat(); if (r.ok) setMsgs([]); })}
            className="grid size-9 shrink-0 place-items-center rounded-full text-faint hover:bg-surface-2 hover:text-fg"><Trash2 className="size-4" /></button>
        ) : null}
      </div>
      <div className="mt-3"><Disclaimer compact /></div>

      <div className="mt-5 flex-1 space-y-4" aria-live="polite">
        {msgs.length === 0 ? (
          <div className="animate-rise space-y-3">
            <p className="text-sm text-muted">{name ? `Hola, ${name}. ` : ''}Puedes escribirme con naturalidad, por ejemplo:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((sug) => (
                <button key={sug} type="button" onClick={() => send(sug)} className="rounded-2xl border border-line bg-surface px-3.5 py-2 text-left text-sm text-muted transition hover:border-accent hover:text-fg">{sug}</button>
              ))}
            </div>
          </div>
        ) : null}
        {msgs.map((m) => (
          <div key={m.id} className={`flex animate-rise ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] space-y-2 ${m.role === 'user' ? 'items-end' : ''}`}>
              <div className={`whitespace-pre-wrap rounded-3xl px-4 py-3 text-[15px] leading-relaxed ${m.role === 'user' ? 'rounded-br-lg bg-accent text-accent-ink' : m.error ? 'rounded-bl-lg border border-danger/40 bg-[#2a1515] text-danger' : 'rounded-bl-lg bg-surface-2'}`}>
                {m.content}
              </div>
              {m.actions?.length ? (
                <ul className="space-y-1">
                  {m.actions.map((a, i) => (
                    <li key={i} className={`flex items-start gap-1.5 text-xs ${a.ok ? 'text-accent' : 'text-danger'}`}>
                      {a.ok ? <CheckCircle2 className="mt-px size-3.5 shrink-0" /> : <CircleAlert className="mt-px size-3.5 shrink-0" />}
                      <span>{a.summary}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ))}
        {busy ? (
          <div className="flex justify-start" role="status" aria-label="Vyro está escribiendo">
            <div className="flex gap-1.5 rounded-3xl rounded-bl-lg bg-surface-2 px-4 py-4">
              {[0, 1, 2].map((i) => <span key={i} className="size-2 animate-pulse-soft rounded-full bg-muted" style={{ animationDelay: `${i * 180}ms` }} />)}
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(text); }}
        className="sticky bottom-[calc(env(safe-area-inset-bottom)+76px)] mt-4 flex items-end gap-2 rounded-[28px] border border-line bg-surface/95 p-2 backdrop-blur-xl lg:bottom-4">
        <label htmlFor="msg" className="sr-only">Mensaje</label>
        <textarea
          id="msg" ref={inputRef} rows={1} value={text} maxLength={2000} placeholder="Escribe a tu nutricionista…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text); } }}
          className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] outline-none placeholder:text-faint"
        />
        <button type="submit" aria-label="Enviar" disabled={!text.trim() || busy} className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition active:scale-95 disabled:opacity-40">
          <ArrowUp className="size-5" />
        </button>
      </form>
    </div>
  );
}
