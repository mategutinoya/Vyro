import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Session } from '@/lib/server/data';
import { savePlanForDate } from '@/lib/server/ops';
import { FakeDb } from '@/test/fake-db';

// Modelo simulado: devuelve respuestas guionizadas como lo haría la API.
const script: unknown[] = [];
const create = vi.fn(async () => script.shift());
vi.mock('@/lib/ai/client', async (orig) => ({
  ...(await orig<typeof import('@/lib/ai/client')>()),
  getClaude: () => ({ beta: { messages: { create } } }),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

const { chatTurn } = await import('../chat');

const USER = 'u-1';
const TODAY = '2026-11-16';
let db: FakeDb;
let s: Session;

const toolUse = (id: string, name: string, input: unknown) => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name, input }] });
const say = (text: string) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }] });

beforeEach(async () => {
  script.length = 0;
  create.mockClear();
  db = new FakeDb(USER);
  const profile = {
    id: USER, display_name: 'Ana', birth_date: '1995-05-01', sex: 'female', height_cm: 160, goal: 'lose_fat', goal_reason: null,
    activity_level: 'light', training_description: null, training_days_per_week: 2, favorite_foods: [], disliked_foods: [],
    allergies: [], restrictions: [], health_conditions: [], budget: 'low', meals_per_day: 4, checkin_weekday: 1, city: 'La Paz',
    country: 'BO', timezone: 'America/La_Paz', onboarded_at: '2026-11-01',
  };
  db.rows('user_profiles').push(profile);
  s = { db: db.client(), userId: USER, email: null, profile: profile as unknown as Session['profile'], today: TODAY };
  const meal = (slot: string, name: string) => ({ slot, name, description: '', ingredients: [{ name: 'Pollo', quantity: 150, unit: 'g', alternatives: [] }], instructions: ['Cocinar'], kcal: 550, protein_g: 35, carbs_g: 60, fat_g: 15 });
  await savePlanForDate({ db: s.db, userId: USER, today: TODAY, actor: 'system' }, TODAY, [meal('breakfast', 'Api con pastel'), meal('lunch', 'Sajta de pollo'), meal('snack', 'Fruta'), meal('dinner', 'Pollo con arroz')], { generatedBy: 'ai', notes: null, reason: null });
});

describe('chat con herramientas', () => {
  it('"Comí una hamburguesa en vez de mi cena": registra mediante la operación validada y responde', async () => {
    script.push(
      toolUse('t1', 'record_meal', {
        date: TODAY, slot: 'dinner', description: 'Hamburguesa con papas', items: [{ name: 'Hamburguesa', quantity: 1, unit: 'unidad' }],
        kcal: 900, protein_g: 35, carbs_g: 85, fat_g: 45, confidence: 'medium', needs_details: true, relation_to_plan: 'replaced_plan',
      }),
      say('¡Anotado! ¿Las papas eran una porción pequeña o grande?'),
    );
    const r = await chatTurn(s, 'Hoy tenía pollo con arroz para cenar, pero comí una hamburguesa con papas');

    expect(r.reply).toMatch(/porción/);
    expect(r.actions).toEqual([expect.objectContaining({ kind: 'record_meal', ok: true })]);
    expect(db.rows('planned_meals').find((m) => m.slot === 'dinner')!.status).toBe('replaced');
    expect(db.rows('meal_logs')[0]).toMatchObject({ source: 'chat', needs_details: true });
    // Se guardan ambos mensajes con las acciones
    expect(db.rows('chat_messages').map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(db.rows('chat_messages')[1].actions).toHaveLength(1);
    // El modelo recibe el resultado real de la herramienta, incluido el id para corregir después
    const second = (create.mock.calls[1] as unknown as [{ messages: { content: { type: string; content?: string }[] }[] }])[0];
    expect(JSON.stringify(second.messages.at(-1))).toMatch(/id del registro/);
    // El contexto incluye el plan de hoy
    const first = (create.mock.calls[0] as unknown as [{ messages: unknown[] }])[0];
    expect(JSON.stringify(first.messages)).toMatch(/<contexto>[\s\S]*Pollo con arroz/);
  });

  it('si la herramienta falla, el error vuelve al modelo y no se escribe nada', async () => {
    script.push(
      toolUse('t1', 'record_measurement', { date: TODAY, weight_kg: null, waist_cm: null, body_fat_pct: 25, body_fat_source: null, notes: null }),
      say('Necesito saber de dónde sale ese porcentaje.'),
    );
    const r = await chatTurn(s, 'Tengo 25% de grasa');
    expect(r.actions[0]).toMatchObject({ ok: false });
    expect(db.rows('body_measurements')).toHaveLength(0);
    const second = (create.mock.calls[1] as unknown as [{ messages: { content: { is_error?: boolean }[] }[] }])[0];
    expect(second.messages.at(-1)!.content[0].is_error).toBe(true);
  });

  it('"Hoy pesé 75 kg" y "entrené dos días" en un mismo turno', async () => {
    script.push(
      { stop_reason: 'tool_use', content: [
        { type: 'tool_use', id: 'a', name: 'record_measurement', input: { date: TODAY, weight_kg: 75, waist_cm: null, body_fat_pct: null, body_fat_source: null, notes: null } },
        { type: 'tool_use', id: 'b', name: 'record_activity', input: { date: TODAY, kind: 'week_summary', description: 'Entrenó 2 días esta semana', duration_min: null, sessions: 2 } },
      ] },
      say('Perfecto, registrado.'),
    );
    const r = await chatTurn(s, 'Hoy pesé 75 kg y esta semana entrené solamente dos días');
    expect(r.actions.map((a) => a.ok)).toEqual([true, true]);
    expect(db.rows('body_measurements')[0]).toMatchObject({ weight_kg: 75, source: 'chat' });
    expect(db.rows('activity_logs')[0]).toMatchObject({ kind: 'week_summary', sessions: 2 });
  });

  it('una respuesta sólo de texto no modifica ningún registro', async () => {
    script.push(say('He guardado tu peso de 70 kg.')); // el modelo "dice" algo sin llamar herramientas
    await chatTurn(s, 'Peso 70');
    expect(db.rows('body_measurements')).toHaveLength(0);
    expect(db.rows('meal_logs')).toHaveLength(0);
  });
});
