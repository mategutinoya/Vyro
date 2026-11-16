import 'server-only';

import { NextResponse } from 'next/server';

import { AIError } from '@/lib/ai/client';

import { loadSession, type Session } from './data';
import { OpError } from './ops';

/** Envuelve una ruta de API: exige sesión y perfil completo, controla el cupo de IA y traduce errores. */
export async function withSession(
  feature: 'chat' | 'plan' | 'review' | null,
  fn: (s: Session) => Promise<unknown>,
): Promise<NextResponse> {
  try {
    const s = await loadSession();
    if (!s) return NextResponse.json({ error: 'Inicia sesión para continuar.' }, { status: 401 });
    if (feature) {
      if (!s.profile.onboarded_at) return NextResponse.json({ error: 'Completa tu perfil primero.' }, { status: 400 });
      const { data, error } = await s.db.rpc('consume_ai_quota', { p_feature: feature });
      if (error) return NextResponse.json({ error: 'No se pudo comprobar tu cupo de IA.' }, { status: 500 });
      if (data === -1) return NextResponse.json({ error: 'Has alcanzado el límite diario de esta función. Vuelve mañana.' }, { status: 429 });
    }
    return NextResponse.json(await fn(s));
  } catch (err) {
    if (err instanceof OpError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof AIError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[api]', err);
    return NextResponse.json({ error: 'Error inesperado. Inténtalo de nuevo.' }, { status: 500 });
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
