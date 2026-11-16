/** Anillo de progreso (SVG). value/max; si se pasa del máximo se dibuja completo en otro tono. */
export function Ring({ value, max, size = 132, stroke = 11, color = 'var(--accent)', children }: { value: number; max: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = max > 0 ? Math.min(value / max, 1) : 0;
  const over = max > 0 && value > max * 1.05;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={over ? 'var(--warn)' : color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.2,0.8,0.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Bar({ value, max, color = 'var(--accent)', className = '' }: { value: number; max: number; color?: string; className?: string }) {
  const p = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-surface-3 ${className}`}>
      <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${p * 100}%`, background: color }} />
    </div>
  );
}
