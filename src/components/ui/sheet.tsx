'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

/** Hoja inferior en móvil / diálogo centrado en escritorio. Cierra con Escape o tocando fuera. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 animate-fade bg-black/60 backdrop-blur-sm" />
      <div ref={ref} className="relative max-h-[90dvh] w-full animate-rise overflow-y-auto rounded-t-3xl border border-line bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-5 sm:max-w-lg sm:rounded-3xl sm:pb-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full bg-surface-2 text-muted hover:text-fg"><X className="size-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
