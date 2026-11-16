'use client';

import { CalendarDays, Home, LineChart, MessageCircle, User, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const NAV = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/hoy', label: 'Mi plan', icon: UtensilsCrossed },
  { href: '/chat', label: 'Nutricionista', icon: MessageCircle },
  { href: '/calendario', label: 'Calendario', icon: CalendarDays },
  { href: '/progreso', label: 'Progreso', icon: LineChart },
  { href: '/perfil', label: 'Perfil', icon: User },
];

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`));

/** Lista de navegación sin hooks: se usa tal cual como estado inicial (sin pestaña activa). */
export function NavList({ variant, path }: { variant: 'side' | 'bottom' | 'avatar'; path: string }) {
  if (variant === 'avatar') {
    const on = isActive(path, '/perfil');
    return (
      <Link href="/perfil" aria-label="Mi perfil" className={`grid size-9 place-items-center rounded-full border ${on ? 'border-accent text-accent' : 'border-line text-muted'}`}>
        <User className="size-[18px]" aria-hidden />
      </Link>
    );
  }
  if (variant === 'side') {
    return (
      <>
        {NAV.map(({ href, label, icon: Icon }) => {
          const on = isActive(path, href);
          return (
            <Link key={href} href={href} aria-current={on ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${on ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface hover:text-fg'}`}>
              <Icon className={`size-[18px] ${on ? 'text-accent' : ''}`} aria-hidden />
              {label}
            </Link>
          );
        })}
      </>
    );
  }
  return (
    <ul className="mx-auto grid max-w-lg grid-cols-5">
      {NAV.filter((n) => n.href !== '/perfil').map(({ href, label, icon: Icon }) => {
        const on = isActive(path, href);
        return (
          <li key={href}>
            <Link href={href} aria-current={on ? 'page' : undefined} className="flex flex-col items-center gap-1 pb-2 pt-2.5 text-[10.5px] font-medium">
              <span className={`grid h-7 w-12 place-items-center rounded-full transition ${on ? 'bg-accent-soft text-accent' : 'text-faint'}`}>
                <Icon className="size-[19px]" aria-hidden />
              </span>
              <span className={on ? 'text-fg' : 'text-faint'}>{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Igual que NavList, pero marcando la pestaña actual (lee la URL: va dentro de <Suspense>). */
export function ActiveNav({ variant }: { variant: 'side' | 'bottom' | 'avatar' }) {
  return <NavList variant={variant} path={usePathname()} />;
}
