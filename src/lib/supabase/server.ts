import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { publicEnv } from '@/lib/env';

/** Cliente de Supabase con la sesión del usuario (RLS se aplica a todo lo que haga). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el proxy ya refresca la sesión.
        }
      },
    },
  });
}
