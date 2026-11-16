import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { publicEnv } from '@/lib/env';

/**
 * Cliente con la clave de servicio de Supabase. SÓLO servidor y SÓLO para crear cuentas ya confirmadas
 * (así no hace falta configurar el correo de confirmación). Nunca se usa para leer datos de usuarios.
 * Devuelve null si la clave no está configurada o si se pidió confirmación por correo (VYRO_EMAIL_CONFIRMATION=true).
 */
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!key || process.env.VYRO_EMAIL_CONFIRMATION === 'true' || !publicEnv.supabaseUrl) return null;
  return createClient(publicEnv.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
