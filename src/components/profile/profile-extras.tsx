'use client';

import { Download, LogOut, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';

import { deleteAccount, removeFavorite, removeMemory, saveProfile } from '@/app/actions';
import { signOutAction } from '@/app/login/actions';
import { ProfileForm, type ProfileFormValues } from '@/components/profile-form';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorText, Input, Label } from '@/components/ui/field';
import type { Favorite, Memory } from '@/lib/types';

const KIND_LABELS: Record<string, string> = {
  likes: 'Le gusta', dislikes: 'No le gusta', habit: 'Hábito', schedule: 'Horario', substitution: 'Suele cambiar',
  goal: 'Objetivo', context: 'Contexto', training: 'Entrenamiento',
};

export function EditProfile({ initial, today }: { initial: ProfileFormValues; today: string }) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="space-y-2">
      <ProfileForm mode="edit" today={today} initial={initial} onSubmit={async (v, o) => {
        setSaved(false);
        const r = await saveProfile(v, o);
        if (!r?.error) setSaved(true);
        return r;
      }} />
      {saved ? <p role="status" className="text-sm text-accent">Perfil guardado.</p> : null}
    </div>
  );
}

export function MemoryList({ memories }: { memories: Memory[] }) {
  const [, start] = useTransition();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const list = memories.filter((m) => !hidden.has(m.id));
  if (!list.length) return <p className="text-sm text-muted">Aún no hay recuerdos. Se irán guardando cuando hables con el nutricionista.</p>;
  return (
    <ul className="divide-y divide-line">
      {list.map((m) => (
        <li key={m.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
          <div>
            <span className="text-xs text-faint">{KIND_LABELS[m.kind] ?? m.kind}{m.times_seen > 1 ? ` · ${m.times_seen} veces` : ''}</span>
            <p>{m.content}</p>
          </div>
          <button type="button" aria-label={`Olvidar: ${m.content}`} onClick={() => { setHidden(new Set(hidden).add(m.id)); start(async () => { await removeMemory(m.id); }); }}
            className="grid size-8 shrink-0 place-items-center rounded-full text-faint hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
        </li>
      ))}
    </ul>
  );
}

export function FavoriteList({ favorites }: { favorites: Favorite[] }) {
  const [, start] = useTransition();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const list = favorites.filter((f) => !hidden.has(f.id));
  if (!list.length) return <p className="text-sm text-muted">Guarda platos con el corazón ♡ en tu plan para reutilizarlos.</p>;
  return (
    <ul className="divide-y divide-line">
      {list.map((f) => (
        <li key={f.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
          <span>{f.name} <span className="tabular text-faint">· {f.kcal ? Math.round(f.kcal) : '—'} kcal</span></span>
          <button type="button" aria-label={`Quitar ${f.name} de favoritos`} onClick={() => { setHidden(new Set(hidden).add(f.id)); start(async () => { await removeFavorite(f.id); }); }}
            className="grid size-8 place-items-center rounded-full text-faint hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
        </li>
      ))}
    </ul>
  );
}

export function DataControls() {
  const [confirm, setConfirm] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <a href="/api/export" className="inline-flex h-11 items-center gap-2 rounded-full bg-surface-3 px-5 text-sm font-semibold hover:bg-[#2b2b30]"><Download className="size-4" /> Descargar mis datos (JSON)</a>
        <form action={signOutAction}><Button variant="ghost" type="submit"><LogOut className="size-4" /> Cerrar sesión</Button></form>
      </div>
      {!open ? (
        <Button variant="danger" onClick={() => setOpen(true)}><Trash2 className="size-4" /> Eliminar mi cuenta</Button>
      ) : (
        <Card className="space-y-3 border-danger/30">
          <p className="text-sm">Se borrarán <b>para siempre</b> tu perfil, planes, registros, mediciones, conversaciones y memoria. Descarga tus datos antes si los quieres conservar.</p>
          <div><Label htmlFor="confirm">Escribe ELIMINAR para confirmar</Label><Input id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></div>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <Button variant="danger" disabled={confirm.trim().toUpperCase() !== 'ELIMINAR'} loading={pending} onClick={() => start(async () => { const r = await deleteAccount(confirm); if (r && !r.ok) setError(r.error); })}>Eliminar definitivamente</Button>
            <Button variant="ghost" onClick={() => { setOpen(false); setConfirm(''); }}>Cancelar</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
