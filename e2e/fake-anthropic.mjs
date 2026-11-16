/**
 * Entorno de PRUEBAS: imita la API de mensajes de Claude con respuestas preparadas
 * (mismo formato de JSON, incluidas las llamadas a herramientas). No hay IA real aquí:
 * sirve para probar que la app usa bien las respuestas.
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:54322  node e2e/fake-anthropic.mjs
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 54322);
const MENU = {
  breakfast: ['Api morado con pastel de queso', 'Avena con plátano y canela', 'Pan integral con huevo revuelto y tomate', 'Quinua con leche y manzana'],
  mid_morning: ['Mandarina y maní', 'Yogur con granola'],
  lunch: ['Sopa de quinua y pollo a la plancha con arroz', 'Picante de pollo con chuño y arroz', 'Trucha al horno con papa y ensalada', 'Majadito de charque con huevo'],
  snack: ['Yogur natural con fruta', 'Tostadas con queso fresco', 'Licuado de papaya con leche'],
  dinner: ['Tortilla de verduras con ensalada', 'Pollo con arroz y verduras salteadas', 'Lentejas guisadas con arroz', 'Sopa de fideo con carne'],
  late_snack: ['Leche tibia con canela'],
};
let counter = 0;

function meal(slot, kcal, salt = 0) {
  const names = MENU[slot] ?? ['Plato casero'];
  const name = names[(counter++ + salt) % names.length];
  return {
    slot, name, description: 'Opción casera con ingredientes de mercado.',
    ingredients: [
      { name: slot === 'lunch' || slot === 'dinner' ? 'Pechuga de pollo' : 'Avena', quantity: slot === 'lunch' ? 150 : 60, unit: 'g', alternatives: ['Huevo'] },
      { name: 'Arroz', quantity: 70, unit: 'g', alternatives: ['Quinua'] },
      { name: 'Tomate', quantity: 1, unit: 'unidad', alternatives: [] },
      { name: 'Aceite', quantity: 1, unit: 'cdta', alternatives: [] },
    ],
    instructions: ['Lavar y cortar los ingredientes.', 'Cocinar a fuego medio.', 'Servir caliente.'],
    kcal, protein_g: Math.round(kcal * 0.075), carbs_g: Math.round(kcal * 0.11), fat_g: Math.round(kcal * 0.03),
  };
}

const textOf = (content) => (typeof content === 'string' ? content : content.filter((b) => b.type === 'text').map((b) => b.text).join('\n'));
const reply = (content, stop = 'end_turn') => ({
  id: `msg_${Date.now()}`, type: 'message', role: 'assistant', model: 'claude-opus-5-5', content, stop_reason: stop, stop_sequence: null,
  usage: { input_tokens: 100, output_tokens: 100 },
});
const json = (obj) => reply([{ type: 'text', text: JSON.stringify(obj) }]);

function structured(body) {
  const schema = body.output_config.format.schema;
  const user = textOf(body.messages.at(-1).content);
  if (schema.properties?.meals) {
    const slots = [...user.matchAll(/^- (\w+) \([^)]*\): ~(\d+) kcal/gm)].map((m) => ({ slot: m[1], kcal: Number(m[2]) }));
    const salt = Number((user.match(/\d{4}-\d{2}-(\d{2})/) ?? [])[1] ?? 0);
    return json({ meals: slots.map((s) => meal(s.slot, s.kcal, salt)), notes: 'Toma agua durante el día y prioriza verduras de temporada.' });
  }
  if (schema.properties?.meal) {
    const slot = (user.match(/slot "(\w+)"/) ?? [])[1] ?? 'dinner';
    const kcal = Number((user.match(/unas (\d+) kcal/) ?? [])[1] ?? 500);
    const m = meal(slot, kcal, 2);
    return json({ meal: { ...m, name: /pollo/i.test(user) ? 'Tortilla de huevo con quinua y verduras' : `${m.name} (nueva opción)` } });
  }
  if (schema.properties?.question) {
    return json({ items: [{ name: 'Hamburguesa', quantity: 1, unit: 'unidad' }, { name: 'Papas fritas', quantity: null, unit: 'porción' }], kcal: 920, protein_g: 34, carbs_g: 88, fat_g: 46, confidence: 'medium', question: '¿La porción de papas era pequeña, mediana o grande?' });
  }
  if (schema.properties?.headline) {
    return json({ headline: 'Vas a un ritmo estable', explanation: 'Tu promedio semanal bajó poco a poco. Es normal que el peso suba o baje de un día a otro.', suggest_calorie_change: true, new_calories: 1500, reason: 'La tendencia es estable desde hace varias semanas.' });
  }
  return json({});
}

function chat(body) {
  const last = body.messages.at(-1);
  if (Array.isArray(last.content) && last.content.some((b) => b.type === 'tool_result')) {
    const results = last.content.filter((b) => b.type === 'tool_result');
    const failed = results.find((r) => r.is_error);
    return reply([{ type: 'text', text: failed ? `No pude guardarlo: ${String(failed.content).replace(/^ERROR: /, '')}` : `Listo. ${results.map((r) => String(r.content).replace(/ \(id del registro: .*\)$/, '')).join(' ')} ¿Algo más?` }]);
  }
  const text = textOf(last.content).split('</contexto>').pop().trim();
  const date = (textOf(last.content).match(/\((\d{4}-\d{2}-\d{2})\), son aprox/) ?? [])[1];
  const tool = (name, input) => reply([{ type: 'text', text: 'Déjame anotarlo.' }, { type: 'tool_use', id: `toolu_${Date.now()}_${name}`, name, input }], 'tool_use');

  const peso = text.match(/pes[eé]\s+(\d+(?:[.,]\d+)?)\s*kg/i);
  if (peso) return tool('record_measurement', { date, weight_kg: Number(peso[1].replace(',', '.')), waist_cm: null, body_fat_pct: null, body_fat_source: null, notes: null });
  if (/hamburguesa/i.test(text)) return tool('record_meal', { date, slot: 'dinner', description: 'Hamburguesa con papas fritas', items: [{ name: 'Hamburguesa', quantity: 1, unit: 'unidad' }], kcal: 920, protein_g: 34, carbs_g: 88, fat_g: 46, confidence: 'medium', needs_details: true, relation_to_plan: 'replaced_plan' });
  const noTengo = text.match(/no tengo (\w+)/i);
  if (noTengo) return tool('swap_meal', { date, slot: 'dinner', reason: `No tiene ${noTengo[1]} en casa`, avoid_ingredients: [noTengo[1]] });
  if (/entren[eé].*(dos|2)/i.test(text)) return tool('record_activity', { date, kind: 'week_summary', description: 'Entrenó 2 días esta semana', duration_min: null, sessions: 2 });
  return reply([{ type: 'text', text: 'Entendido. Cuéntame qué comiste o cómo te fue y lo anoto.' }]);
}

createServer((req, res) => {
  let data = '';
  req.on('data', (c) => (data += c));
  req.on('end', () => {
    const body = data ? JSON.parse(data) : {};
    const out = body.output_config?.format ? structured(body) : chat(body);
    res.writeHead(200, { 'Content-Type': 'application/json', 'request-id': 'req_e2e' });
    res.end(JSON.stringify(out));
  });
}).listen(PORT, () => console.log(`fake-anthropic en http://127.0.0.1:${PORT}`));
