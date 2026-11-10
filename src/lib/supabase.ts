import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { createDemoClient } from './demo/demo-client';
import { env } from './env';

export const supabase: SupabaseClient = env.demo
  ? createDemoClient()
  : createClient(
  env.supabaseUrl || 'https://not-configured.invalid',
  env.supabaseKey || 'not-configured',
  {
    auth: {
      // En web durante el renderizado del servidor no existe window.
      storage: Platform.OS === 'web' && typeof window === 'undefined' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Refresca el token sólo mientras la app está en primer plano.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Devuelve el id del usuario con sesión o lanza un error claro. */
export async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Sesión no iniciada');
  return id;
}
