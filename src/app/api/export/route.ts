import { NextResponse } from 'next/server';

import { loadSession } from '@/lib/server/data';

const TABLES = [
  'nutrition_targets', 'body_measurements', 'activity_logs', 'meal_plans', 'planned_meals', 'meal_logs',
  'meal_change_history', 'favorite_meals', 'user_memories', 'chat_messages', 'ai_usage',
];

/** Descarga TODOS los datos del usuario en JSON (derecho de acceso y portabilidad). */
export async function GET() {
  const s = await loadSession();
  if (!s) return NextResponse.json({ error: 'Inicia sesión para continuar.' }, { status: 401 });
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), email: s.email, profile: s.profile };
  for (const t of TABLES) {
    const { data, error } = await s.db.from(t).select('*');
    out[t] = error ? { error: error.message } : data;
  }
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="vyro-mis-datos-${s.today}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
