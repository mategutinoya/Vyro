import { Card } from '@/components/ui/card';

export const metadata = { title: 'Configuración pendiente' };

export default function SetupPage() {
  return (
    <main className="mx-auto max-w-xl space-y-5 px-5 py-12">
      <p className="text-4xl font-extrabold tracking-tight">Vyro<span className="text-accent">.</span></p>
      <h1 className="text-2xl font-bold">Falta conectar Supabase</h1>
      <p className="text-muted">Crea el archivo <code className="rounded bg-surface-2 px-1.5 py-0.5">.env.local</code> en la raíz del proyecto (copia <code className="rounded bg-surface-2 px-1.5 py-0.5">.env.example</code>) y reinicia el servidor. El README explica cada paso.</p>
      <Card className="space-y-1 break-all font-mono text-[13px]">
        <p>NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co</p>
        <p>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…</p>
        <p>ANTHROPIC_API_KEY=sk-ant-…  <span className="text-faint"># sólo servidor</span></p>
      </Card>
    </main>
  );
}
