/**
 * Lógica compartida del análisis de comidas por foto.
 * Sin dependencias: la usan la Edge Function (Deno) y las pruebas de la app (Jest).
 */

export type Confidence = 'high' | 'medium' | 'low';

export interface MealItem {
  name: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: Confidence;
}

export interface MealAnalysis {
  is_food: boolean;
  items: MealItem[];
  notes: string;
}

/** Esquema JSON que se exige a la respuesta del modelo (salida estructurada). */
export const MEAL_ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_food', 'items', 'notes'],
  properties: {
    is_food: { type: 'boolean', description: 'false si la imagen no muestra comida o bebida' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'confidence'],
        properties: {
          name: { type: 'string', description: 'Nombre corto del alimento en español' },
          grams: { type: 'number', description: 'Peso estimado de la porción visible, en gramos' },
          kcal: { type: 'number', description: 'Calorías de esa porción' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    notes: { type: 'string', description: 'Una o dos frases en español con supuestos importantes (aceite, salsas, tamaño)' },
  },
} as const;

export const MEAL_SYSTEM_PROMPT = `Eres un nutricionista que estima el contenido de una comida a partir de una foto.

Para cada alimento distinto que se vea en el plato:
- Nómbralo en español, de forma breve y reconocible ("Arroz blanco cocido", "Pechuga de pollo a la plancha").
- Estima el peso de la porción visible en gramos, tal como está servida (cocinado si está cocinado). Usa referencias de tamaño de la imagen: plato, cubiertos, manos, envases.
- Da calorías, proteína, carbohidratos y grasas de esa porción, coherentes con valores nutricionales habituales.
- Indica tu confianza: "high" si el alimento y la cantidad son claros, "medium" si dudas de la cantidad, "low" si dudas de qué es.

Reglas:
- Incluye sólo lo que se ve o lo que el usuario indique. No añadas alimentos supuestos, salvo grasa de cocinado evidente (por ejemplo, un frito); en ese caso añádela como elemento aparte ("Aceite de oliva") y menciónalo en las notas.
- Si el usuario da cantidades o detalles en su nota, respétalos por encima de tu estimación visual.
- Si la imagen no muestra comida ni bebida, devuelve is_food=false y una lista vacía.
- Las notas: una o dos frases en español sobre los supuestos que más afectan al resultado.`;

const r1 = (n: number) => Math.round(n * 10) / 10;
const num = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, min), max);
};

/**
 * Valida y limpia la respuesta del modelo. Nunca confía en ella a ciegas:
 * recorta valores imposibles, descarta elementos sin nombre o sin gramos
 * y limita la lista a 15 elementos.
 */
export function sanitizeMealAnalysis(raw: unknown): MealAnalysis {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(o.items) ? o.items : [];
  const items: MealItem[] = [];
  for (const it of list) {
    if (!it || typeof it !== 'object') continue;
    const i = it as Record<string, unknown>;
    const name = typeof i.name === 'string' ? i.name.trim().slice(0, 120) : '';
    const grams = num(i.grams, 0, 3000);
    if (!name || !grams || grams < 1) continue;
    const protein = num(i.protein_g, 0, grams) ?? 0;
    const carbs = num(i.carbs_g, 0, grams) ?? 0;
    const fat = num(i.fat_g, 0, grams) ?? 0;
    // Máximo físico: ~9 kcal por gramo (grasa pura).
    const kcal = num(i.kcal, 0, grams * 9.5) ?? protein * 4 + carbs * 4 + fat * 9;
    const confidence: Confidence = i.confidence === 'high' || i.confidence === 'low' ? i.confidence : 'medium';
    items.push({ name, grams: r1(grams), kcal: r1(kcal), protein_g: r1(protein), carbs_g: r1(carbs), fat_g: r1(fat), confidence });
    if (items.length >= 15) break;
  }
  const isFood = o.is_food !== false && items.length > 0;
  return {
    is_food: isFood,
    items: isFood ? items : [],
    notes: typeof o.notes === 'string' ? o.notes.trim().slice(0, 400) : '',
  };
}

/** Texto que acompaña a la imagen. La nota del usuario va delimitada y recortada. */
export function buildUserText(note: string | undefined): string {
  const clean = (note ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  return clean
    ? `Analiza esta comida. Nota del usuario sobre la comida: «${clean}»`
    : 'Analiza esta comida.';
}
