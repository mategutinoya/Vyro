/**
 * Edge Function: analyze-meal
 * Recibe una foto de comida (JPEG en base64) del usuario autenticado y devuelve
 * los alimentos estimados con gramos, calorías y macros.
 *
 * - La clave de Anthropic vive SÓLO aquí, como secreto de Supabase (ANTHROPIC_API_KEY).
 * - Cada análisis consume cupo diario (función consume_ai_quota en la base de datos).
 * - La imagen no se guarda en ningún sitio.
 */
import Anthropic from 'npm:@anthropic-ai/sdk@1.4.0';
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

import { buildUserText, MEAL_ANALYSIS_SCHEMA, MEAL_SYSTEM_PROMPT, sanitizeMealAnalysis } from '../_shared/meal-analysis.ts';

const MODEL = 'claude-opus-5-5';
const MAX_IMAGE_BASE64 = 6_000_000; // ~4,5 MB de imagen
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fail = (status: number, error: string) => json({ error }, status);

const anthropic = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail(405, 'Método no permitido.');

  // 1. Usuario autenticado (con su propio token: RLS aplica en todo lo que haga).
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return fail(500, 'Servidor mal configurado.');
  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''));
  if (userErr || !userData.user) return fail(401, 'Inicia sesión para usar esta función.');

  // 2. Petición válida.
  let body: { image?: unknown; mediaType?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Petición no válida.');
  }
  const image = typeof body.image === 'string' ? body.image : '';
  const mediaType = typeof body.mediaType === 'string' ? body.mediaType : 'image/jpeg';
  if (!image || !/^[A-Za-z0-9+/=]+$/.test(image.slice(0, 200))) return fail(400, 'Falta la imagen.');
  if (image.length > MAX_IMAGE_BASE64) return fail(413, 'La imagen es demasiado grande.');
  if (!ALLOWED_TYPES.has(mediaType)) return fail(415, 'Formato de imagen no admitido.');
  const note = typeof body.note === 'string' ? body.note : undefined;

  if (!Deno.env.get('ANTHROPIC_API_KEY')) return fail(503, 'La IA no está configurada todavía en el servidor.');

  // 3. Cupo diario.
  const { data: remaining, error: quotaErr } = await supabase.rpc('consume_ai_quota', { p_feature: 'meal_photo' });
  if (quotaErr) return fail(500, 'No se pudo comprobar tu cupo de análisis.');
  if (remaining === -1) return fail(429, 'Has usado todos los análisis con foto de hoy. Vuelve mañana.');

  // 4. Análisis con Claude (salida estructurada, con reintento en otro modelo si se rechaza).
  try {
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: MEAL_ANALYSIS_SCHEMA },
      },
      system: MEAL_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg', data: image } },
            { type: 'text', text: buildUserText(note) },
          ],
        },
      ],
    });

    if (response.stop_reason === 'refusal') return fail(422, 'No se pudo analizar esta imagen. Prueba con otra foto.');
    if (response.stop_reason === 'max_tokens') return fail(502, 'El análisis quedó incompleto. Inténtalo de nuevo.');

    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return fail(502, 'Respuesta vacía del análisis.');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.text);
    } catch {
      return fail(502, 'Respuesta del análisis no válida. Inténtalo de nuevo.');
    }
    return json({ ...sanitizeMealAnalysis(parsed), remaining });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return fail(503, 'El servicio de IA está saturado. Inténtalo en un minuto.');
    if (err instanceof Anthropic.AuthenticationError) return fail(503, 'La clave de la IA del servidor no es válida.');
    if (err instanceof Anthropic.BadRequestError) {
      console.error('Petición rechazada por la API:', err.message);
      return fail(400, 'No se pudo procesar esta imagen.');
    }
    if (err instanceof Anthropic.APIError) {
      console.error('Error de la API:', err.status, err.message);
      return fail(502, 'El servicio de IA no responde. Inténtalo de nuevo.');
    }
    console.error('Error inesperado:', err);
    return fail(500, 'Error inesperado al analizar la comida.');
  }
});
