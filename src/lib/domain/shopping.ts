/** Lista de compras: suma los ingredientes de los planes de la semana (determinista, sin IA). */

export interface Ingredient {
  name: string;
  quantity: number | null;
  unit: string;
  alternatives?: string[];
}

export interface ShoppingItem {
  key: string;
  name: string;
  amounts: { quantity: number | null; unit: string }[];
  category: Category;
  meals: number;
}

export type Category = 'Verduras y frutas' | 'Carnes, huevos y pescado' | 'Lácteos' | 'Granos, cereales y tubérculos' | 'Legumbres y frutos secos' | 'Despensa' | 'Otros';

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

/** Unidades equivalentes a una base común. */
const UNIT_MAP: Record<string, { unit: string; factor: number }> = {
  g: { unit: 'g', factor: 1 }, gr: { unit: 'g', factor: 1 }, gramo: { unit: 'g', factor: 1 }, gramos: { unit: 'g', factor: 1 },
  kg: { unit: 'g', factor: 1000 }, kilo: { unit: 'g', factor: 1000 }, kilos: { unit: 'g', factor: 1000 },
  ml: { unit: 'ml', factor: 1 }, l: { unit: 'ml', factor: 1000 }, litro: { unit: 'ml', factor: 1000 }, litros: { unit: 'ml', factor: 1000 },
  unidad: { unit: 'unidad', factor: 1 }, unidades: { unit: 'unidad', factor: 1 }, u: { unit: 'unidad', factor: 1 }, pieza: { unit: 'unidad', factor: 1 }, piezas: { unit: 'unidad', factor: 1 },
  taza: { unit: 'taza', factor: 1 }, tazas: { unit: 'taza', factor: 1 },
  cda: { unit: 'cda', factor: 1 }, cucharada: { unit: 'cda', factor: 1 }, cucharadas: { unit: 'cda', factor: 1 },
  cdta: { unit: 'cdta', factor: 1 }, cucharadita: { unit: 'cdta', factor: 1 }, cucharaditas: { unit: 'cdta', factor: 1 },
};

export function normalizeUnit(unit: string): { unit: string; factor: number } {
  return UNIT_MAP[strip(unit)] ?? { unit: strip(unit) || 'unidad', factor: 1 };
}

/** Clave para agrupar: sin tildes, en singular aproximado. */
export function ingredientKey(name: string): string {
  return strip(name)
    .replace(/\(.*?\)/g, '')
    .split(' ')
    .map((w) => {
      if (w.length <= 3 || !w.endsWith('s')) return w;
      const base = w.slice(0, -1); // tomates → tomate, pechugas → pechuga
      // limones → limon, panes → pan, flores → flor, papeles → papel
      return base.length > 3 && /[nrld]e$/.test(base) ? base.slice(0, -1) : base;
    })
    .join(' ')
    .trim();
}

const CATEGORY_WORDS: [Category, string[]][] = [
  ['Carnes, huevos y pescado', ['pollo', 'carne', 'res', 'cerdo', 'chancho', 'pescado', 'trucha', 'pejerrey', 'atun', 'huevo', 'pavo', 'higado', 'charque', 'sardina', 'cordero', 'llama']],
  ['Lácteos', ['leche', 'yogur', 'queso', 'quesillo', 'mantequilla', 'requeson']],
  ['Legumbres y frutos secos', ['lenteja', 'garbanzo', 'frejol', 'poroto', 'haba', 'arveja seca', 'mani', 'almendra', 'nuez', 'tarwi', 'chocho']],
  ['Granos, cereales y tubérculos', ['arroz', 'quinua', 'avena', 'fideo', 'pan', 'tortilla', 'papa', 'camote', 'yuca', 'chuno', 'tunta', 'maiz', 'mote', 'amaranto', 'cañahua', 'canahua', 'harina', 'oca', 'pasta', 'galleta', 'cereal']],
  ['Verduras y frutas', ['tomate', 'cebolla', 'zanahoria', 'lechuga', 'espinaca', 'acelga', 'brocoli', 'coliflor', 'zapallo', 'zapallito', 'pepino', 'locoto', 'aji', 'pimenton', 'ajo', 'perejil', 'cilantro', 'apio', 'beterraga', 'repollo', 'vainita', 'choclo', 'arveja', 'platano', 'banana', 'manzana', 'naranja', 'mandarina', 'papaya', 'pina', 'frutilla', 'durazno', 'limon', 'palta', 'mango', 'uva', 'pera', 'sandia', 'melon', 'chirimoya', 'maracuya', 'tumbo', 'verdura', 'fruta', 'hierba']],
  ['Despensa', ['aceite', 'sal', 'azucar', 'vinagre', 'miel', 'mermelada', 'comino', 'oregano', 'pimienta', 'canela', 'cafe', 'te', 'mate', 'caldo', 'salsa', 'mostaza', 'cacao', 'chia', 'linaza']],
];

export function categorize(name: string): Category {
  const k = strip(name);
  for (const [cat, words] of CATEGORY_WORDS) if (words.some((w) => k.includes(w))) return cat;
  return 'Otros';
}

const CATEGORY_ORDER: Category[] = ['Verduras y frutas', 'Carnes, huevos y pescado', 'Lácteos', 'Granos, cereales y tubérculos', 'Legumbres y frutos secos', 'Despensa', 'Otros'];

export function buildShoppingList(ingredientLists: Ingredient[][]): { category: Category; items: ShoppingItem[] }[] {
  const map = new Map<string, ShoppingItem>();
  for (const list of ingredientLists) {
    for (const ing of list) {
      if (!ing?.name?.trim()) continue;
      const key = ingredientKey(ing.name);
      const item = map.get(key) ?? { key, name: ing.name.trim(), amounts: [], category: categorize(ing.name), meals: 0 };
      item.meals += 1;
      const { unit, factor } = normalizeUnit(ing.unit ?? '');
      const qty = typeof ing.quantity === 'number' && Number.isFinite(ing.quantity) && ing.quantity > 0 ? ing.quantity * factor : null;
      const existing = item.amounts.find((a) => a.unit === unit);
      if (existing) existing.quantity = existing.quantity !== null && qty !== null ? existing.quantity + qty : (existing.quantity ?? qty);
      else item.amounts.push({ unit, quantity: qty });
      map.set(key, item);
    }
  }
  return CATEGORY_ORDER.map((category) => ({
    category,
    items: [...map.values()].filter((i) => i.category === category).sort((a, b) => a.name.localeCompare(b.name, 'es')),
  })).filter((g) => g.items.length > 0);
}

/** "1,2 kg", "350 g", "3 unidades", "al gusto" */
export function formatAmount(a: { quantity: number | null; unit: string }): string {
  if (a.quantity === null) return a.unit === 'unidad' ? 'al gusto' : a.unit;
  const nf = (n: number) => new Intl.NumberFormat('es-BO', { maximumFractionDigits: 1 }).format(n);
  if (a.unit === 'g' && a.quantity >= 1000) return `${nf(a.quantity / 1000)} kg`;
  if (a.unit === 'ml' && a.quantity >= 1000) return `${nf(a.quantity / 1000)} l`;
  if (a.unit === 'unidad') return `${nf(a.quantity)} ${a.quantity === 1 ? 'unidad' : 'unidades'}`;
  return `${nf(Math.round(a.quantity))} ${a.unit}`;
}
