import 'server-only';

import type Anthropic from '@anthropic-ai/sdk';

import { addDays, ageOn, hourIn, longDate } from '@/lib/domain/dates';
import { BODY_FAT_SOURCE_LABELS, MEMORY_KINDS } from '@/lib/domain/schemas';
import { GOAL_LABELS, isMinor } from '@/lib/domain/safety';
import { SLOT_LABELS, SLOTS, isSlot } from '@/lib/domain/slots';
import { ACTIVITY_LABELS } from '@/lib/domain/targets';
import {
  getActivity, getAdherence, getChat, getDay, getMeasurements, getMemories, getTargets, opContext, type Session,
} from '@/lib/server/data';
import {
  OpError, recordActivity, recordMeal, recordMeasurement, remember, setPlannedStatus, updateMealLog, updatePreferences,
} from '@/lib/server/ops';

import { AIError, FALLBACK, getClaude, MODEL, textOf, toAIError } from './client';
import { adjustRemaining, generatePlans, swapMeal } from './plan-service';
import { SAFETY_RULES } from './prompts';

export interface ChatAction {
  kind: string;
  summary: string;
  ok: boolean;
}

// ---------------------------------------------------------------------------
// Instrucciones (estables → se cachean)
// ---------------------------------------------------------------------------
const SYSTEM = `Eres Vyro, el nutricionista virtual del usuario: profesional, cercano y realista. Hablas en español, con frases claras y breves.

${SAFETY_RULES}

Cómo trabajas:
- Al inicio de cada mensaje del usuario recibes <contexto>: su perfil, objetivos, plan y registros de hoy, pesos, memoria y cambios recientes. Úsalo para personalizar.
- Interpreta lo que cuenta y ACTUALIZA sus datos con las herramientas. Nunca digas que guardaste, cambiaste o anotaste algo si no llamaste a la herramienta y ésta respondió con éxito. Si una herramienta devuelve un error, explícaselo con sencillez.
- "Hoy pesé 75 kg" → record_measurement.
- "Hoy comí una hamburguesa en vez de mi cena" → record_meal con relation_to_plan="replaced_plan" (la comida planificada queda como reemplazada, no cumplida). Estima calorías y macros con valores habituales.
- Si faltan cantidades que cambian mucho la estimación (tamaño, cuántas unidades, si era frito), guarda tu mejor estimación con needs_details=true y pregunta UNA cosa concreta. Cuando responda, corrige con update_meal_log (usa el id del registro que ves en el contexto).
- "Comí lo del plan" → set_planned_meal_status con status="completed".
- Tras una comida claramente más abundante de lo previsto, puedes usar adjust_remaining_meals para aligerar un poco lo que queda del día (nunca para saltarse comidas). No lo hagas por pequeñas diferencias.
- "No me gustó el almuerzo" / "no tengo pollo" → swap_meal para el día y momento afectados (si es un plato de hoy o de días futuros) y guarda la preferencia (update_preferences o remember).
- "Quiero comer algo diferente mañana" → regenerate_day para ese día.
- "Esta semana entrené solamente dos días" → record_activity con kind="week_summary".
- Usa remember para hábitos y patrones útiles a futuro (horarios, sustituciones frecuentes, contexto). No guardes datos sensibles innecesarios.
- Fechas: usa AAAA-MM-DD según la fecha de hoy del contexto ("ayer", "mañana"…).
- Responde corto (2–6 frases), con un siguiente paso útil. Sin listas largas salvo que te lo pidan.`;

// ---------------------------------------------------------------------------
// Herramientas (strict: el modelo sólo puede enviar argumentos con este formato)
// ---------------------------------------------------------------------------
const slotEnum = { type: 'string', enum: [...SLOTS] };
const date = { type: 'string', description: 'AAAA-MM-DD' };
const nullableNum = (description: string) => ({ type: ['number', 'null'], description });
const strList = { type: 'array', items: { type: 'string' } };

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'record_meal',
    description: 'Registra lo que el usuario comió realmente. relation_to_plan: followed_plan (comió lo planificado), replaced_plan (comió otra cosa en lugar de lo planificado en ese momento), extra (comida fuera del plan).',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      required: ['date', 'slot', 'description', 'items', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'confidence', 'needs_details', 'relation_to_plan'],
      properties: {
        date, slot: slotEnum,
        description: { type: 'string', description: 'Lo que comió, en pocas palabras' },
        items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'quantity', 'unit'], properties: { name: { type: 'string' }, quantity: { type: ['number', 'null'] }, unit: { type: 'string' } } } },
        kcal: nullableNum('Estimación total'), protein_g: nullableNum('g'), carbs_g: nullableNum('g'), fat_g: nullableNum('g'),
        confidence: { type: ['string', 'null'], enum: ['high', 'medium', 'low', null] },
        needs_details: { type: 'boolean', description: 'true si faltan cantidades importantes y vas a preguntar' },
        relation_to_plan: { type: 'string', enum: ['followed_plan', 'replaced_plan', 'extra'] },
      },
    },
  },
  {
    name: 'update_meal_log',
    description: 'Corrige o completa un registro de comida existente (por ejemplo cuando el usuario da las cantidades). Usa null en lo que no cambia.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      required: ['log_id', 'description', 'items', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'needs_details'],
      properties: {
        log_id: { type: 'string' },
        description: { type: ['string', 'null'] },
        items: { type: ['array', 'null'], items: { type: 'object', additionalProperties: false, required: ['name', 'quantity', 'unit'], properties: { name: { type: 'string' }, quantity: { type: ['number', 'null'] }, unit: { type: 'string' } } } },
        kcal: nullableNum(''), protein_g: nullableNum(''), carbs_g: nullableNum(''), fat_g: nullableNum(''),
        needs_details: { type: ['boolean', 'null'] },
      },
    },
  },
  {
    name: 'set_planned_meal_status',
    description: 'Marca una comida planificada como cumplida (completed), omitida (skipped) o pendiente otra vez (planned).',
    strict: true,
    input_schema: { type: 'object', additionalProperties: false, required: ['date', 'slot', 'status'], properties: { date, slot: slotEnum, status: { type: 'string', enum: ['completed', 'skipped', 'planned'] } } },
  },
  {
    name: 'record_measurement',
    description: 'Registra peso, cintura y/o porcentaje de grasa. El % de grasa SIEMPRE con su origen (self_estimate si es estimación del usuario).',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      required: ['date', 'weight_kg', 'waist_cm', 'body_fat_pct', 'body_fat_source', 'notes'],
      properties: {
        date, weight_kg: nullableNum('kg'), waist_cm: nullableNum('cm'), body_fat_pct: nullableNum('%'),
        body_fat_source: { type: ['string', 'null'], enum: ['self_estimate', 'smart_scale', 'bioimpedance', 'skinfold', 'dexa', 'other', null] },
        notes: { type: ['string', 'null'] },
      },
    },
  },
  {
    name: 'record_activity',
    description: 'Registra entrenamiento: una sesión (kind=session) o un resumen semanal (kind=week_summary, con sessions = número de días entrenados).',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false, required: ['date', 'kind', 'description', 'duration_min', 'sessions'],
      properties: { date, kind: { type: 'string', enum: ['session', 'week_summary'] }, description: { type: 'string' }, duration_min: { type: ['integer', 'null'] }, sessions: { type: ['integer', 'null'] } },
    },
  },
  {
    name: 'update_preferences',
    description: 'Actualiza gustos, disgustos, alergias o restricciones (sólo añadir alergias), presupuesto o número de comidas al día. Listas vacías si no cambian; null si no cambia.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      required: ['add_favorite_foods', 'add_disliked_foods', 'add_allergies', 'add_restrictions', 'remove_favorite_foods', 'remove_disliked_foods', 'budget', 'meals_per_day'],
      properties: {
        add_favorite_foods: strList, add_disliked_foods: strList, add_allergies: strList, add_restrictions: strList,
        remove_favorite_foods: strList, remove_disliked_foods: strList,
        budget: { type: ['string', 'null'], enum: ['low', 'medium', 'high', null] },
        meals_per_day: { type: ['integer', 'null'] },
      },
    },
  },
  {
    name: 'remember',
    description: 'Guarda algo útil para personalizar en el futuro: likes, dislikes, habit, schedule, substitution (lo que suele cambiar), goal, context, training.',
    strict: true,
    input_schema: { type: 'object', additionalProperties: false, required: ['kind', 'content'], properties: { kind: { type: 'string', enum: [...MEMORY_KINDS] }, content: { type: 'string', description: 'Frase corta en tercera persona' } } },
  },
  {
    name: 'swap_meal',
    description: 'Cambia un plato planificado (pendiente) por otro adecuado. Úsalo si no le gusta, no tiene un ingrediente o quiere algo distinto en ese momento.',
    strict: true,
    input_schema: { type: 'object', additionalProperties: false, required: ['date', 'slot', 'reason', 'avoid_ingredients'], properties: { date, slot: slotEnum, reason: { type: 'string' }, avoid_ingredients: strList } },
  },
  {
    name: 'regenerate_day',
    description: 'Genera de nuevo el plan de un día (sólo cambia las comidas aún pendientes). Para "quiero algo diferente mañana" o si no tiene plan.',
    strict: true,
    input_schema: { type: 'object', additionalProperties: false, required: ['date', 'request'], properties: { date, request: { type: 'string', description: 'Lo que pidió el usuario' } } },
  },
  {
    name: 'adjust_remaining_meals',
    description: 'Tras una comida más abundante, aligera con moderación las comidas pendientes de ese día (máx. −15 %, sin saltarse ninguna).',
    strict: true,
    input_schema: { type: 'object', additionalProperties: false, required: ['date', 'reason'], properties: { date, reason: { type: 'string' } } },
  },
];

async function runTool(s: Session, name: string, input: Record<string, unknown>): Promise<string> {
  const ctx = opContext(s, 'assistant');
  switch (name) {
    case 'record_meal': {
      const r = await recordMeal(ctx, input, 'chat');
      return `${r.summary} (id del registro: ${r.data?.log_id})`;
    }
    case 'update_meal_log': return (await updateMealLog(ctx, input)).summary;
    case 'set_planned_meal_status': return (await setPlannedStatus(ctx, input)).summary;
    case 'record_measurement': return (await recordMeasurement(ctx, { ...input, is_checkin: false }, 'chat')).summary;
    case 'record_activity': return (await recordActivity(ctx, input, 'chat')).summary;
    case 'update_preferences': return (await updatePreferences(ctx, input)).summary;
    case 'remember': return (await remember(ctx, input)).summary;
    case 'swap_meal': {
      if (!isSlot(input.slot)) throw new OpError('Momento de comida no válido.');
      return (await swapMeal(s, String(input.date), input.slot, String(input.reason), (input.avoid_ingredients as string[]) ?? [], 'assistant')).summary;
    }
    case 'regenerate_day': return (await generatePlans(s, String(input.date), 1, String(input.request), 'assistant')).summary;
    case 'adjust_remaining_meals': return (await adjustRemaining(s, String(input.date), String(input.reason), 'assistant')).summary;
    default: throw new OpError(`Herramienta desconocida: ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Contexto dinámico del usuario
// ---------------------------------------------------------------------------
async function buildContext(s: Session): Promise<string> {
  const p = s.profile;
  const tomorrow = addDays(s.today, 1);
  const [targets, today, tmr, weights, memories, adherence, activity, history] = await Promise.all([
    getTargets(s, s.today), getDay(s, s.today), getDay(s, tomorrow), getMeasurements(s, 10), getMemories(s, 40),
    getAdherence(s, 14), getActivity(s, 21),
    s.db.from('meal_change_history').select('happened_on, summary, actor').order('created_at', { ascending: false }).limit(12),
  ]);
  const age = p.birth_date ? ageOn(p.birth_date, s.today) : null;
  const consumed = today.logs.reduce((sum, l) => sum + (l.kcal ?? 0), 0);

  const lines = [
    `Hoy es ${longDate(s.today)} (${s.today}), son aprox. las ${hourIn(p.timezone)}:00 en ${p.city || 'Bolivia'}. Mañana: ${tomorrow}.`,
    `Nombre: ${p.display_name || '—'} · Edad: ${age ?? '—'}${isMinor(age) ? ' · MENOR DE EDAD (modo seguro: sin déficit ni % de grasa)' : ''} · Sexo: ${p.sex === 'male' ? 'hombre' : p.sex === 'female' ? 'mujer' : '—'} · Altura: ${p.height_cm ?? '—'} cm`,
    `Objetivo: ${p.goal ? GOAL_LABELS[p.goal] : '—'}${p.goal_reason ? ` (motivo: ${p.goal_reason})` : ''} · Actividad: ${p.activity_level ? ACTIVITY_LABELS[p.activity_level].title : '—'} · Entrena: ${p.training_description || '—'} (${p.training_days_per_week ?? 0} días/sem)`,
    `Alergias: ${p.allergies.join(', ') || 'ninguna'} · Restricciones: ${p.restrictions.join(', ') || 'ninguna'} · Salud: ${p.health_conditions.join(', ') || 'nada indicado'}`,
    `Le gusta: ${p.favorite_foods.join(', ') || '—'} · No le gusta: ${p.disliked_foods.join(', ') || '—'} · Presupuesto: ${p.budget ?? '—'} · Comidas/día: ${p.meals_per_day}`,
    targets ? `Objetivo diario: ${targets.calories} kcal · P ${targets.protein_g} g · C ${targets.carbs_g} g · G ${targets.fat_g} g` : 'Sin objetivos definidos.',
    '',
    `PLAN DE HOY:${today.meals.length ? '' : ' sin plan'}`,
    ...today.meals.map((m) => `- ${m.slot} (${SLOT_LABELS[m.slot]}): ${m.name} · ~${m.kcal ?? '?'} kcal · estado: ${m.status}`),
    `REGISTROS DE HOY (consumido ≈ ${Math.round(consumed)} kcal):${today.logs.length ? '' : ' ninguno'}`,
    ...today.logs.map((l) => `- id ${l.id} · ${l.slot}: ${l.description} · ${l.kcal ?? '?'} kcal${l.needs_details ? ' · FALTAN DETALLES' : ''}${l.followed_plan ? ' · según plan' : ''}`),
    `PLAN DE MAÑANA:${tmr.meals.length ? '' : ' sin plan'}`,
    ...tmr.meals.map((m) => `- ${m.slot}: ${m.name} (${m.status})`),
    '',
    `PESOS RECIENTES: ${weights.filter((w) => w.weight_kg !== null).map((w) => `${w.measured_on}: ${w.weight_kg} kg`).join(' · ') || 'sin registros'}`,
    ...weights.filter((w) => w.body_fat_pct !== null).slice(-2).map((w) => `% grasa ${w.measured_on}: ${w.body_fat_pct} % (${BODY_FAT_SOURCE_LABELS[w.body_fat_source as keyof typeof BODY_FAT_SOURCE_LABELS] ?? 'origen desconocido'})`),
    `ADHERENCIA 14 DÍAS: ${adherence.completed} cumplidas, ${adherence.replaced} reemplazadas, ${adherence.skipped} omitidas de ${adherence.total}.`,
    `ACTIVIDAD 3 SEMANAS: ${activity.map((a) => `${a.log_date}: ${a.description}${a.sessions !== null ? ` (${a.sessions} días)` : ''}`).join(' · ') || 'sin registros'}`,
    '',
    'MEMORIA:',
    ...(memories.length ? memories.map((m) => `- (${m.kind}${m.times_seen > 1 ? ` ×${m.times_seen}` : ''}) ${m.content}`) : ['- (vacía)']),
    'CAMBIOS RECIENTES:',
    ...((history.data ?? []) as { happened_on: string; summary: string; actor: string }[]).map((h) => `- ${h.happened_on} [${h.actor}] ${h.summary}`),
  ];
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Turno de conversación
// ---------------------------------------------------------------------------
export async function chatTurn(s: Session, userText: string): Promise<{ reply: string; actions: ChatAction[] }> {
  const text = userText.trim().slice(0, 2000);
  if (!text) throw new AIError('Escribe un mensaje.', 400);
  const claude = getClaude();

  const [history, context] = await Promise.all([getChat(s, 24), buildContext(s)]);
  const { error: insErr } = await s.db.from('chat_messages').insert({ user_id: s.userId, role: 'user', content: text });
  if (insErr) throw new AIError(`No se pudo guardar tu mensaje: ${insErr.message}`, 500);

  // Historial reciente como texto (las acciones de cada turno se incluyen para que el modelo sepa qué se hizo).
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of history) {
    const content = m.role === 'assistant' && m.actions?.length ? `${m.content}\n[Acciones realizadas: ${m.actions.map((a) => a.summary).join(' | ')}]` : m.content;
    if (!messages.length && m.role === 'assistant') continue; // debe empezar el usuario
    messages.push({ role: m.role, content });
  }
  messages.push({
    role: 'user',
    content: [
      { type: 'text', text: `<contexto>\n${context}\n</contexto>` },
      { type: 'text', text },
    ],
  });

  const actions: ChatAction[] = [];
  let reply = '';
  try {
    for (let i = 0; i < 8; i++) {
      const response = await claude.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        ...FALLBACK,
        cache_control: { type: 'ephemeral' },
        output_config: { effort: 'medium' },
        system: SYSTEM,
        tools: TOOLS,
        messages,
      });

      if (response.stop_reason === 'refusal') {
        reply = 'No puedo ayudarte con eso. Si tienes dudas de salud, consulta a un profesional.';
        break;
      }
      const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
      const said = textOf(response.content);
      if (said) reply = said;
      if (response.stop_reason !== 'tool_use' || !toolUses.length) break;

      messages.push({ role: 'assistant', content: response.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const t of toolUses) {
        try {
          const summary = await runTool(s, t.name, (t.input ?? {}) as Record<string, unknown>);
          actions.push({ kind: t.name, summary: summary.replace(/ \(id del registro: .*\)$/, ''), ok: true });
          results.push({ type: 'tool_result', tool_use_id: t.id, content: summary });
        } catch (err) {
          const msg = err instanceof OpError || err instanceof AIError ? err.message : 'Error interno al ejecutar la acción.';
          if (!(err instanceof OpError)) console.error('[chat] herramienta', t.name, err);
          actions.push({ kind: t.name, summary: msg, ok: false });
          results.push({ type: 'tool_result', tool_use_id: t.id, content: `ERROR: ${msg}`, is_error: true });
        }
      }
      messages.push({ role: 'user', content: results });
    }
  } catch (err) {
    const e = toAIError(err);
    reply = actions.length ? `Hice algunos cambios, pero no pude terminar la respuesta (${e.message}).` : e.message;
    await s.db.from('chat_messages').insert({ user_id: s.userId, role: 'assistant', content: reply, actions });
    if (!actions.length) throw e;
    return { reply, actions };
  }

  if (!reply) reply = actions.length ? 'Listo.' : 'No he podido generar una respuesta. ¿Puedes repetirlo?';
  await s.db.from('chat_messages').insert({ user_id: s.userId, role: 'assistant', content: reply.slice(0, 8000), actions });
  return { reply, actions };
}
