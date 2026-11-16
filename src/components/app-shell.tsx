import Link from 'next/link';
import { Suspense } from 'react';

import { ActiveNav, NavList } from './nav';

/** Estructura de la app: lateral en escritorio, cabecera + barra inferior en móvil. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const nav = (variant: 'side' | 'bottom' | 'avatar') => (
    <Suspense fallback={<NavList variant={variant} path="" />}>
      <ActiveNav variant={variant} />
    </Suspense>
  );
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-1 border-r border-line px-4 py-6 lg:flex">
        <Link href="/" className="mb-6 px-3 text-2xl font-extrabold tracking-tight">Vyro<span className="text-accent">.</span></Link>
        {nav('side')}
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line/60 bg-bg/85 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur-xl lg:hidden">
          <Link href="/" className="text-xl font-extrabold tracking-tight">Vyro<span className="text-accent">.</span></Link>
          {nav('avatar')}
        </header>
        <main className="mx-auto w-full max-w-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-5 sm:px-6 lg:pb-12 lg:pt-10">{children}</main>
      </div>

      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-[rgba(11,11,12,0.92)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        {nav('bottom')}
      </nav>
    </div>
  );
}
