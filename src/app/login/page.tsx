import type { Metadata } from 'next';

import { Disclaimer } from '@/components/disclaimer';

import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Entrar' };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-5 py-10">
      <div className="animate-rise space-y-3">
        <p className="text-5xl font-extrabold tracking-tight">Vyro<span className="text-accent">.</span></p>
        <p className="text-lg text-muted">Tu nutricionista personal con IA. Planes reales, sin culpas, adaptados a ti y a lo que hay en Bolivia.</p>
      </div>
      <LoginForm />
      <Disclaimer />
    </main>
  );
}
