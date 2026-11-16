import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/** Enlace del correo de confirmación: canjea el código por una sesión. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL('/bienvenida', url.origin));
  }
  return NextResponse.redirect(new URL('/login', url.origin));
}
