import 'server-only';

import Anthropic from '@anthropic-ai/sdk';

/** Modelo usado en toda la app. */
export const MODEL = 'claude-opus-5-5';
/** Si el modelo rechaza una petición por sus filtros de seguridad, el servidor la reintenta en otro modelo. */
export const FALLBACK = { betas: ['server-side-fallback-2026-07-01'] as Anthropic.Beta.AnthropicBeta[], fallbacks: 'default' as const };

let client: Anthropic | null = null;

export class AIError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

export function getClaude(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new AIError('La IA no está configurada: falta ANTHROPIC_API_KEY en el servidor.', 503);
  client ??= new Anthropic();
  return client;
}

/** Traduce los errores del SDK a mensajes para el usuario. */
export function toAIError(err: unknown): AIError {
  if (err instanceof AIError) return err;
  if (err instanceof Anthropic.RateLimitError) return new AIError('El servicio de IA está saturado. Inténtalo en un minuto.', 503);
  if (err instanceof Anthropic.AuthenticationError) return new AIError('La clave de la IA del servidor no es válida.', 503);
  if (err instanceof Anthropic.BadRequestError) {
    console.error('[IA] petición rechazada:', err.message);
    return new AIError('La IA no pudo procesar esta petición.', 400);
  }
  if (err instanceof Anthropic.APIError) {
    console.error('[IA] error de la API:', err.status, err.message);
    return new AIError('El servicio de IA no responde. Inténtalo de nuevo.', 502);
  }
  console.error('[IA] error inesperado:', err);
  return new AIError('Error inesperado al consultar la IA.', 500);
}

/** Texto plano de una respuesta. */
export function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

/**
 * Llamada con salida JSON estructurada. El JSON se valida después con zod en quien la llama:
 * nunca se confía en la respuesta del modelo sin comprobarla.
 */
export async function structuredCall(opts: {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  effort?: 'low' | 'medium' | 'high';
  maxTokens?: number;
}): Promise<unknown> {
  const claude = getClaude();
  try {
    const response = await claude.beta.messages.create({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      ...FALLBACK,
      output_config: { effort: opts.effort ?? 'medium', format: { type: 'json_schema', schema: opts.schema } },
      system: opts.system,
      messages: [{ role: 'user', content: opts.user }],
    });
    if (response.stop_reason === 'refusal') throw new AIError('La IA no pudo responder a esta petición.', 422);
    if (response.stop_reason === 'max_tokens') throw new AIError('La respuesta de la IA quedó incompleta. Inténtalo de nuevo.', 502);
    const text = textOf(response.content);
    try {
      return JSON.parse(text);
    } catch {
      throw new AIError('La IA devolvió un formato no válido. Inténtalo de nuevo.', 502);
    }
  } catch (err) {
    throw toAIError(err);
  }
}
