import { beforeEach, describe, expect, it } from 'vitest';

import { FakeDb } from '@/test/fake-db';

import {
  deleteMealLog, OpError, recordMeal, recordMeasurement, remember, replacePlannedMeal, savePlanForDate,
  setPlannedStatus, updatePreferences, type OpContext,
} from '../ops';

const USER = 'u-1';
const TODAY = '2026-11-16';

const meal = (slot: string, name: string, kcal = 600) => ({
  slot, name, description: `${name} casero`,
  ingredients: [{ name: 'Arroz', quantity: 80, unit: 'g', alternatives: ['Quinua'] }],
  instructions: ['Cocinar.'], kcal, protein_g: 30, carbs_g: 70, fat_g: 15,
});

let db: FakeDb;
let ctx: OpContext;
beforeEach(async () => {
  db = new FakeDb(USER);
  db.rows('user_profiles').push({ id: USER, favorite_foods: ['papa'], disliked_foods: [], allergies: ['maní'], restrictions: [] });
  ctx = { db: db.client(), userId: USER, today: TODAY, actor: 'assistant' };
  await savePlanForDate(ctx, TODAY, [meal('breakfast', 'Avena con plátano', 400), meal('lunch', 'Sopa de quinua'), meal('dinner', 'Pollo con arroz')], { generatedBy: 'ai', notes: null, reason: null });
});

const planned = (slot: string) => db.rows('planned_meals').find((m) => m.slot === slot)!;
const history = () => db.rows('meal_change_history');

describe('registro inteligente de comidas', () => {
  it('"Tenía pollo con arroz, pero comí una hamburguesa": guarda lo real y marca el plan como REEMPLAZADO', async () => {
    const r = await recordMeal(ctx, {
      date: TODAY, slot: 'dinner', description: 'Hamburguesa con papas fritas',
      items: [{ name: 'Hamburguesa', quantity: 1, unit: 'unidad' }, { name: 'Papas fritas', quantity: null, unit: 'porción' }],
      kcal: 950, protein_g: 35, carbs_g: 90, fat_g: 48, confidence: 'medium', needs_details: true, relation_to_plan: 'replaced_plan',
    }, 'chat');

    const log = db.rows('meal_logs')[0];
    expect(log).toMatchObject({ description: 'Hamburguesa con papas fritas', kcal: 950, followed_plan: false, needs_details: true, source: 'chat' });
    expect(planned('dinner')).toMatchObject({ status: 'replaced', replaced_by: log.id });
    const h = history().find((x) => x.action === 'replaced')!;
    expect(h).toMatchObject({ actor: 'assistant', entity: 'planned_meal' });
    expect(String(h.summary)).toContain('Pollo con arroz');
    expect(r.summary).toMatch(/reemplazado/);
  });

  it('"Lo comí": cumple el plan copiando sus valores, y se puede deshacer', async () => {
    await setPlannedStatus({ ...ctx, actor: 'user' }, { date: TODAY, slot: 'breakfast', status: 'completed' });
    expect(planned('breakfast').status).toBe('completed');
    expect(db.rows('meal_logs')[0]).toMatchObject({ followed_plan: true, kcal: 400, source: 'plan' });

    await setPlannedStatus(ctx, { date: TODAY, slot: 'breakfast', status: 'planned' });
    expect(planned('breakfast').status).toBe('planned');
    expect(db.rows('meal_logs')).toHaveLength(0);
    expect(history().map((h) => h.action)).toEqual(expect.arrayContaining(['completed', 'reopened']));
  });

  it('eliminar el reemplazo devuelve la comida planificada a pendiente', async () => {
    const r = await recordMeal(ctx, { date: TODAY, slot: 'dinner', description: 'Salteña', items: [], kcal: 450, protein_g: 15, carbs_g: 50, fat_g: 20, confidence: 'medium', needs_details: false, relation_to_plan: 'replaced_plan' });
    await deleteMealLog(ctx, r.data!.log_id);
    expect(planned('dinner')).toMatchObject({ status: 'planned', replaced_by: null });
    expect(history().some((h) => h.action === 'deleted')).toBe(true);
  });

  it('una comida extra no toca el plan', async () => {
    await recordMeal(ctx, { date: TODAY, slot: 'snack', description: 'Manzana', items: [], kcal: 80, protein_g: 0, carbs_g: 20, fat_g: 0, confidence: 'high', needs_details: false, relation_to_plan: 'extra' });
    expect(db.rows('planned_meals').every((m) => m.status === 'planned')).toBe(true);
  });

  it('rechaza datos inválidos o fechas absurdas sin escribir nada', async () => {
    await expect(recordMeal(ctx, { date: '2026-11-16', slot: 'dinner', description: '', relation_to_plan: 'extra' })).rejects.toBeInstanceOf(OpError);
    await expect(recordMeal(ctx, { date: '2024-01-01', slot: 'dinner', description: 'x', items: [], kcal: 1, protein_g: 0, carbs_g: 0, fat_g: 0, confidence: null, needs_details: false, relation_to_plan: 'extra' })).rejects.toThrow(/fuera del rango/);
    await expect(recordMeal(ctx, { date: TODAY, slot: 'dinner', description: 'x', items: [], kcal: 99999, protein_g: 0, carbs_g: 0, fat_g: 0, confidence: null, needs_details: false, relation_to_plan: 'extra' })).rejects.toBeInstanceOf(OpError);
    expect(db.rows('meal_logs')).toHaveLength(0);
  });
});

describe('planes', () => {
  it('regenerar el día conserva lo ya comido o reemplazado', async () => {
    await setPlannedStatus(ctx, { date: TODAY, slot: 'breakfast', status: 'completed' });
    await savePlanForDate(ctx, TODAY, [meal('breakfast', 'Otro desayuno'), meal('lunch', 'Picante de pollo'), meal('dinner', 'Trucha con ensalada')], { generatedBy: 'ai', notes: null, reason: 'Quiere algo diferente' });
    expect(planned('breakfast').name).toBe('Avena con plátano');
    expect(planned('lunch').name).toBe('Picante de pollo');
    expect(history().find((h) => h.action === 'regenerated')!.reason).toBe('Quiere algo diferente');
  });

  it('cambiar un plato guarda el antes y el después', async () => {
    await replacePlannedMeal(ctx, TODAY, meal('dinner', 'Tortilla de verduras'), 'No tiene pollo en casa');
    expect(planned('dinner').name).toBe('Tortilla de verduras');
    const h = history().find((x) => x.action === 'swapped')!;
    expect(h.before).toMatchObject({ name: 'Pollo con arroz' });
    expect(h.reason).toBe('No tiene pollo en casa');
  });
});

describe('perfil, mediciones y memoria', () => {
  it('el % de grasa necesita origen y el peso del mismo día se fusiona', async () => {
    await expect(recordMeasurement(ctx, { date: TODAY, weight_kg: null, body_fat_pct: 20, body_fat_source: null, waist_cm: null, notes: null })).rejects.toThrow(/origen/);
    await recordMeasurement(ctx, { date: TODAY, weight_kg: 75, body_fat_pct: null, body_fat_source: null, waist_cm: null, notes: null });
    await recordMeasurement(ctx, { date: TODAY, weight_kg: null, body_fat_pct: 22, body_fat_source: 'self_estimate', waist_cm: 84, notes: null });
    expect(db.rows('body_measurements')).toHaveLength(1);
    expect(db.rows('body_measurements')[0]).toMatchObject({ weight_kg: 75, body_fat_pct: 22, body_fat_source: 'self_estimate', waist_cm: 84 });
  });

  it('las alergias sólo se añaden desde el chat; gustos y disgustos se mueven entre listas', async () => {
    await updatePreferences(ctx, { add_disliked_foods: ['Papa'], add_allergies: ['Mariscos'] });
    const p = db.rows('user_profiles')[0];
    expect(p.favorite_foods).toEqual([]);
    expect(p.disliked_foods).toEqual(['Papa']);
    expect(p.allergies).toEqual(['maní', 'Mariscos']);
  });

  it('la memoria no duplica: cuenta las veces que aparece', async () => {
    await remember(ctx, { kind: 'substitution', content: 'Suele cambiar la cena por comida rápida' });
    await remember(ctx, { kind: 'substitution', content: 'suele cambiar la cena por comida rápida' });
    expect(db.rows('user_memories')).toHaveLength(1);
    expect(db.rows('user_memories')[0].times_seen).toBe(2);
  });
});
