'use client';

import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-105',
  secondary: 'bg-surface-3 text-fg hover:bg-[#2b2b30]',
  ghost: 'bg-transparent text-muted hover:text-fg hover:bg-surface-2',
  danger: 'bg-danger-soft text-danger hover:bg-[rgba(255,107,107,0.2)]',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...rest }: Props) {
  const sizes = { sm: 'h-9 px-3.5 text-sm', md: 'h-11 px-5 text-sm', lg: 'h-12 px-6 text-base' };
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 ${sizes[size]} ${VARIANTS[variant]} ${className}`}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
