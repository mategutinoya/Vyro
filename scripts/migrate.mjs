/**
 * Instala o actualiza las tablas de Supabase automáticamente al publicar (se ejecuta antes de `next build`).
 *
 * - Usa la conexión directa a Postgres que crea la integración de Supabase en Vercel
 *   (POSTGRES_URL_NON_POOLING / POSTGRES_URL) o DATABASE_URL. Si no hay ninguna, no hace nada.
 * - Aplica cada archivo de supabase/migrations UNA sola vez (lo anota en public.vyro_migrations).
 * - Si las tablas ya existían porque se ejecutó el SQL a mano, lo detecta y no lo repite.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import pg from 'pg';

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!url) {
  console.log('[migraciones] Sin conexión a la base de datos configurada: se omite (puedes ejecutar el SQL a mano).');
  process.exit(0);
}

const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
// Supabase usa su propio certificado: se cifra la conexión sin validar la cadena de confianza.
const client = new pg.Client({ connectionString: url.replace(/[?&]sslmode=[^&]*/g, ''), ssl: local ? false : { rejectUnauthorized: false } });

const dir = join(process.cwd(), 'supabase', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

try {
  await client.connect();
  await client.query(`create table if not exists public.vyro_migrations (name text primary key, applied_at timestamptz not null default now())`);
  // Tabla interna: invisible para la API (RLS sin políticas).
  await client.query(`alter table public.vyro_migrations enable row level security`);

  const applied = new Set((await client.query('select name from public.vyro_migrations')).rows.map((r) => r.name));
  if (!applied.size) {
    const existing = await client.query(`select to_regclass('public.user_profiles') as t`);
    if (existing.rows[0].t && files[0]) {
      await client.query('insert into public.vyro_migrations (name) values ($1) on conflict do nothing', [files[0]]);
      applied.add(files[0]);
      console.log(`[migraciones] ${files[0]} ya estaba instalada (SQL ejecutado a mano).`);
    }
  }

  for (const f of files) {
    if (applied.has(f)) continue;
    console.log(`[migraciones] Aplicando ${f}…`);
    await client.query('begin');
    try {
      await client.query(readFileSync(join(dir, f), 'utf8'));
      await client.query('insert into public.vyro_migrations (name) values ($1)', [f]);
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    }
  }
  console.log('[migraciones] Base de datos al día.');
} catch (err) {
  console.error('[migraciones] ERROR:', err.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
