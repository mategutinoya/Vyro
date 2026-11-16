import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/auth', '/configuracion'];

/**
 * Refresca la sesión de Supabase en cada navegación y redirige a /login si no hay sesión.
 * (Comprobación optimista: cada página y operación vuelve a verificar al usuario en el servidor.)
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const path = request.nextUrl.pathname;

  if (!url || !key) {
    if (path.startsWith('/configuracion')) return NextResponse.next();
    return NextResponse.redirect(new URL('/configuracion', request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list, headers) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims?.sub;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!signedIn && !isPublic && !path.startsWith('/api/')) {
    const to = new URL('/login', request.url);
    return NextResponse.redirect(to);
  }
  if (signedIn && path === '/login') return NextResponse.redirect(new URL('/', request.url));
  return response;
}

export const config = {
  // Todo menos estáticos, imágenes y archivos con extensión.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|woff2?)$).*)'],
};
