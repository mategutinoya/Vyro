'use client';

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const nf = (n: number) => new Intl.NumberFormat('es-BO', { maximumFractionDigits: 1 }).format(n);
const dm = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;

export function WeightChart({ data }: { data: { date: string; weight: number; avg: number }[] }) {
  if (data.length < 2) return <p className="py-10 text-center text-sm text-faint">Con dos registros verás aquí tu evolución.</p>;
  const ws = data.map((d) => d.weight);
  const min = Math.floor(Math.min(...ws) - 1);
  const max = Math.ceil(Math.max(...ws) + 1);
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="date" tickFormatter={dm} stroke="var(--faint)" fontSize={11} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis domain={[min, max]} stroke="var(--faint)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={nf} width={48} />
          <Tooltip
            contentStyle={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 14, color: 'var(--fg)', fontSize: 13 }}
            labelFormatter={(l) => dm(String(l))}
            formatter={(v, n) => [`${nf(Number(v))} kg`, n === 'avg' ? 'Media 7 días' : 'Peso']}
          />
          <Area type="monotone" dataKey="avg" stroke="var(--accent)" strokeWidth={2.5} fill="url(#wfill)" dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="weight" stroke="var(--muted)" strokeWidth={0} dot={{ r: 3, fill: 'var(--muted)', strokeWidth: 0 }} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WeeklyBars({ data }: { data: { week: string; average: number }[] }) {
  if (data.length < 2) return null;
  const vals = data.map((d) => d.average);
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="week" tickFormatter={dm} stroke="var(--faint)" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis domain={[Math.floor(Math.min(...vals) - 1), Math.ceil(Math.max(...vals) + 1)]} stroke="var(--faint)" fontSize={11} tickLine={false} axisLine={false} width={48} />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 14, color: 'var(--fg)', fontSize: 13 }}
            labelFormatter={(l) => `Semana del ${dm(String(l))}`} formatter={(v) => [`${nf(Number(v))} kg`, 'Promedio']} />
          <Bar dataKey="average" fill="var(--surface-3)" radius={[8, 8, 3, 3]} activeBar={{ fill: 'var(--accent)' }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CaloriesChart({ data, target }: { data: { date: string; kcal: number }[]; target: number }) {
  return (
    <div className="h-36 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="date" tickFormatter={dm} stroke="var(--faint)" fontSize={11} tickLine={false} axisLine={false} minTickGap={12} />
          <YAxis stroke="var(--faint)" fontSize={11} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => nf(v)} domain={[0, Math.ceil(Math.max(target * 1.3, ...data.map((d) => d.kcal)) / 500) * 500]} />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 14, color: 'var(--fg)', fontSize: 13 }}
            labelFormatter={(l) => dm(String(l))} formatter={(v) => [`${Math.round(Number(v))} kcal`, 'Registrado']} />
          <Bar dataKey="kcal" fill="var(--carbs)" fillOpacity={0.7} radius={[6, 6, 2, 2]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
