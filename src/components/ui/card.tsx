import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={`rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5 ${className}`} />;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function Pill({ children, tone = 'default', className = '' }: { children: React.ReactNode; tone?: 'default' | 'accent' | 'warn' | 'danger' | 'info'; className?: string }) {
  const tones = {
    default: 'bg-surface-3 text-muted',
    accent: 'bg-accent-soft text-accent',
    warn: 'bg-[rgba(245,185,113,0.12)] text-warn',
    danger: 'bg-danger-soft text-danger',
    info: 'bg-[rgba(125,211,252,0.12)] text-info',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]} ${className}`}>{children}</span>;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse-soft rounded-[var(--radius-card)] bg-surface ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40" />
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card className="flex flex-col items-start gap-3 py-6">
      <h3 className="text-base font-semibold">{title}</h3>
      {children ? <div className="text-sm text-muted">{children}</div> : null}
      {action}
    </Card>
  );
}
