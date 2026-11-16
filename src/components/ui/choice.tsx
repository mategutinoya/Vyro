'use client';

import { X } from 'lucide-react';
import { useState } from 'react';

/** Grupo de opciones de una sola elección (radio). */
export function Choice<T extends string | number>({ options, value, onChange, columns = 1, name }: {
  options: { value: T; label: string; detail?: string }[];
  value: T | null;
  onChange: (v: T) => void;
  columns?: 1 | 2 | 3 | 4 | 7;
  name: string;
}) {
  const cols = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4', 7: 'grid-cols-7' }[columns];
  return (
    <div role="radiogroup" aria-label={name} className={`grid gap-2 ${cols}`}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={`rounded-2xl border px-3.5 py-3 text-left transition active:scale-[0.98] ${on ? 'border-accent bg-accent-soft' : 'border-line bg-surface-2 hover:border-[#3a3a40]'}`}>
            <span className={`block text-sm font-semibold ${on ? 'text-accent' : 'text-fg'} ${columns === 7 ? 'text-center' : ''}`}>{o.label}</span>
            {o.detail ? <span className="mt-0.5 block text-xs text-muted">{o.detail}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Lista de etiquetas editable (alimentos, alergias…). Enter o coma añaden. */
export function TagInput({ value, onChange, placeholder, suggestions = [], label, max = 30 }: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  label: string;
  max?: number;
}) {
  const [text, setText] = useState('');
  const add = (raw: string) => {
    const t = raw.trim().replace(/,$/, '').slice(0, 60);
    if (!t || value.some((v) => v.toLowerCase() === t.toLowerCase()) || value.length >= max) return;
    onChange([...value, t]);
  };
  return (
    <div>
      <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-surface-2 px-2.5 py-2 focus-within:border-accent">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-surface-3 py-1 pl-3 pr-1.5 text-sm">
            {v}
            <button type="button" aria-label={`Quitar ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} className="grid size-5 place-items-center rounded-full text-muted hover:bg-[#33333a] hover:text-fg">
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        <input
          aria-label={label} value={text} placeholder={value.length ? '' : placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(text); setText(''); }
            if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => { if (text.trim()) { add(text); setText(''); } }}
          className="h-8 min-w-28 flex-1 bg-transparent px-1.5 text-[15px] outline-none placeholder:text-faint"
        />
      </div>
      {suggestions.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.filter((sug) => !value.some((v) => v.toLowerCase() === sug.toLowerCase())).slice(0, 8).map((sug) => (
            <button key={sug} type="button" onClick={() => add(sug)} className="rounded-full border border-dashed border-line px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-accent">
              + {sug}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
