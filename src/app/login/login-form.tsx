'use client';

import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ErrorText, Input, Label } from '@/components/ui/field';

import { authAction, type AuthState } from './actions';

export function LoginForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [state, action, pending] = useActionState<AuthState, FormData>(authAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="mode" value={mode} />
      <div role="tablist" className="grid grid-cols-2 rounded-full bg-surface-2 p-1 text-sm font-semibold">
        {(['signin', 'signup'] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={`h-9 rounded-full transition ${mode === m ? 'bg-surface-3 text-fg' : 'text-muted'}`}>
            {m === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        ))}
      </div>
      <div>
        <Label htmlFor="email">Correo electrónico</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="tu@correo.com" />
      </div>
      <div>
        <Label htmlFor="password" hint="Mínimo 8 caracteres">Contraseña</Label>
        <Input id="password" name="password" type="password" minLength={8} required autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
      </div>
      {mode === 'signup' ? (
        <label className="flex items-start gap-3 text-sm text-muted">
          <input type="checkbox" name="terms" className="mt-1 size-4 accent-[var(--accent)]" required />
          <span>Entiendo que Vyro ofrece orientación nutricional general, no diagnósticos, y que mis datos se guardan de forma privada (puedo exportarlos o borrarlos cuando quiera).</span>
        </label>
      ) : null}
      <ErrorText>{state.error}</ErrorText>
      {state.notice ? <p className="rounded-2xl bg-accent-soft p-3 text-sm text-accent">{state.notice}</p> : null}
      <Button type="submit" size="lg" className="w-full" loading={pending}>{mode === 'signin' ? 'Entrar' : 'Crear mi cuenta'}</Button>
    </form>
  );
}
