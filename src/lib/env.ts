/** Variables públicas (van al navegador; no son secretas: la seguridad la da RLS). */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
};

export const isConfigured = () => publicEnv.supabaseUrl.startsWith('http') && publicEnv.supabaseKey.length > 20;
