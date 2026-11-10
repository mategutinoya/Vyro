/**
 * Variables públicas de Supabase (se incluyen en la app; NO son secretas).
 * La seguridad real la aplican las políticas RLS de la base de datos.
 * NUNCA pongas aquí la "service_role" / "secret key".
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const demo = process.env.EXPO_PUBLIC_DEMO === '1';

export const env = {
  /** Modo demo: datos locales en el dispositivo, sin Supabase (sólo para previsualizar). */
  demo,
  supabaseUrl: url,
  supabaseKey: key,
  isConfigured: demo || (url.startsWith('https://') && key.length > 20),
  // Protección extra: una clave secreta jamás debe llegar al móvil.
  looksSecret: !demo && (key.startsWith('sb_secret_') || key.includes('service_role')),
};
