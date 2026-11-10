/**
 * Variables públicas de Supabase (se incluyen en la app; NO son secretas).
 * La seguridad real la aplican las políticas RLS de la base de datos.
 * NUNCA pongas aquí la "service_role" / "secret key".
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const env = {
  supabaseUrl: url,
  supabaseKey: key,
  isConfigured: url.startsWith('https://') && key.length > 20,
  // Protección extra: una clave secreta jamás debe llegar al móvil.
  looksSecret: key.startsWith('sb_secret_') || key.includes('service_role'),
};
