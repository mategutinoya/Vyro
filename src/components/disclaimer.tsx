import { ShieldCheck } from 'lucide-react';

import { DISCLAIMER } from '@/lib/domain/safety';

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`flex items-start gap-2 text-faint ${compact ? 'text-[11px]' : 'text-xs'}`}>
      <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{DISCLAIMER}</span>
    </p>
  );
}
