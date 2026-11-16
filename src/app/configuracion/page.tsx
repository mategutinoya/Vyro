import { Card } from '@/components/ui/card';

export const metadata = { title: 'Configuración pendiente' };

export default function SetupPage() {
  return (
    <main className="mx-auto max-w-xl space-y-5 px-5 py-12">
      <p className="text-4xl font-extrabold tracking-tight">Vyro<span className="text-accent">.</span></p>
      <h1 className="text-2xl font-bold">Falta conectar la base de datos</h1>
      <p className="text-muted">La app todavía no sabe a qué proyecto de Supabase conectarse.</p>
      <Card className="space-y-2 text-sm text-muted">
        <p><b className="text-fg">Si la publicaste en Vercel:</b> en tu proyecto de Vercel ve a <b className="text-fg">Storage → Create / Connect → Supabase</b>, conéctalo y pulsa <b className="text-fg">Redeploy</b>.</p>
        <p><b className="text-fg">Si la usas en tu ordenador:</b> copia <code className="rounded bg-surface-2 px-1.5 py-0.5">.env.example</code> como <code className="rounded bg-surface-2 px-1.5 py-0.5">.env.local</code>, rellena estos valores y reinicia:</p>
      </Card>
      <Card className="space-y-1 break-all font-mono text-[13px]">
        <p>NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co</p>
        <p>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…</p>
        <p>ANTHROPIC_API_KEY=sk-ant-…  <span className="text-faint"># sólo servidor</span></p>
      </Card>
    </main>
  );
}
