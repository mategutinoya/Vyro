import Link from 'next/link';

import { Card } from '@/components/ui/card';

export const metadata = { title: 'Instalar la base de datos' };

export default function TablesPage() {
  return (
    <main className="mx-auto max-w-xl space-y-5 px-5 py-12">
      <p className="text-4xl font-extrabold tracking-tight">Vyro<span className="text-accent">.</span></p>
      <h1 className="text-2xl font-bold">Falta un paso: instalar las tablas</h1>
      <p className="text-muted">Tu base de datos de Supabase está conectada, pero todavía está vacía. Se arregla en un minuto:</p>
      <Card className="space-y-3">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted marker:text-faint">
          <li>Abre tu proyecto en <b className="text-fg">supabase.com</b> y entra en <b className="text-fg">SQL Editor</b>.</li>
          <li>Pulsa <b className="text-fg">New query</b>.</li>
          <li>En GitHub, abre el archivo <code className="rounded bg-surface-2 px-1.5 py-0.5 text-fg">supabase/migrations/20261116000000_vyro_nutricion.sql</code>, copia todo su contenido y pégalo.</li>
          <li>Pulsa <b className="text-fg">Run</b> y vuelve aquí.</li>
        </ol>
      </Card>
      <Link href="/" className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink">Ya lo hice, entrar</Link>
    </main>
  );
}
