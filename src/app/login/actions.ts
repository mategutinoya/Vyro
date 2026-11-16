'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export interface AuthState {
  error?: string;
  notice?: string;
}

function message(err: string): string {
  if (/invalid login credentials/i.test(err)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(err)) return 'Confirma tu correo antes de entrar (revisa tu bandeja de entrada).';
  if (/already registered|already exists/i.test(err)) return 'Ya existe una cuenta con este correo. Inicia sesión.';
  if (/password/i.test(err) && /least|short|weak/i.test(err)) return 'La contraseña debe tener al menos 8 caracteres.';
  if (/rate limit/i.test(err)) return 'Demasiados intentos. Espera un momento.';
  return 'No se pudo completar. Inténtalo de nuevo.';
}

export async function authAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const mode = form.get('mode') === 'signup' ? 'signup' : 'signin';
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Escribe un correo válido.' };
  if (password.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres.' };

  const supabase = await createClient();
  if (mode === 'signin') {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: message(error.message) };
    redirect('/');
  }

  if (form.get('terms') !== 'on') return { error: 'Debes aceptar el aviso de orientación nutricional y privacidad.' };
  const h = await headers();
  const origin = h.get('origin') ?? `https://${h.get('host')}`;
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/auth/callback` } });
  if (error) return { error: message(error.message) };
  if (!data.session) return { notice: 'Te enviamos un correo para confirmar tu cuenta. Ábrelo y vuelve aquí.' };
  redirect('/bienvenida');
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
