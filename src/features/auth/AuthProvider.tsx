import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setState({ session: data.session, loading: false }))
      .catch(() => setState({ session: null, loading: false }));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Al cambiar de usuario, nunca mostrar datos cacheados del anterior.
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') queryClient.clear();
      setState({ session, loading: false });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Traduce los errores habituales de Supabase Auth al español. */
export function authErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(msg)) return 'Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.';
  if (/already registered|already exists/i.test(msg)) return 'Ya existe una cuenta con este correo.';
  if (/password should be at least/i.test(msg)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/rate limit/i.test(msg)) return 'Demasiados intentos. Espera un momento y vuelve a probar.';
  if (/network|fetch/i.test(msg)) return 'Sin conexión con el servidor. Revisa tu internet.';
  return msg;
}
