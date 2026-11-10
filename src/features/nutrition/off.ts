/**
 * Open Food Facts — base de datos pública y colaborativa de alimentos (https://world.openfoodfacts.org).
 * No requiere clave. Límite de uso de su API de búsqueda: ~10 búsquedas/minuto por cliente,
 * por eso la app sólo busca tras una pausa al escribir y guarda en caché los resultados.
 * Los datos los aportan usuarios: pueden contener errores, y así se indica en la interfaz.
 */
import type { Per100 } from './calc';

export interface OffFood extends Per100 {
  code: string;
  name: string;
  brand: string | null;
  fiber_per_100g: number | null;
  serving_g: number | null;
}

const FIELDS = 'code,product_name,product_name_es,generic_name_es,brands,nutriments,serving_quantity';
const USER_AGENT = 'Vyro/1.0 (app de nutricion)';

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
const clamp = (n: number, max: number) => Math.min(Math.max(n, 0), max);
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Convierte un producto de OFF a nuestro formato. Devuelve null si faltan datos esenciales. */
export function parseOffProduct(p: unknown): OffFood | null {
  if (!p || typeof p !== 'object') return null;
  const o = p as Record<string, unknown>;
  const n = (o.nutriments ?? {}) as Record<string, unknown>;

  const name = String(o.product_name_es || o.product_name || o.generic_name_es || '').trim();
  const code = String(o.code ?? '').trim();
  if (!name || !code) return null;

  let kcal = num(n['energy-kcal_100g']);
  if (kcal === null) {
    const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g']);
    if (kj !== null) kcal = kj / 4.184;
  }
  const protein = num(n['proteins_100g']);
  const carbs = num(n['carbohydrates_100g']);
  const fat = num(n['fat_100g']);
  if (kcal === null || protein === null || carbs === null || fat === null) return null;
  if (kcal > 950) return null; // dato imposible (máx. teórico ~900 kcal/100 g)

  const fiber = num(n['fiber_100g']);
  const serving = num(o.serving_quantity);
  const brand = typeof o.brands === 'string' ? o.brands.split(',')[0].trim() || null : null;

  return {
    code,
    name: name.slice(0, 120),
    brand: brand ? brand.slice(0, 80) : null,
    kcal_per_100g: r1(kcal),
    protein_per_100g: r1(clamp(protein, 100)),
    carbs_per_100g: r1(clamp(carbs, 100)),
    fat_per_100g: r1(clamp(fat, 100)),
    fiber_per_100g: fiber === null ? null : r1(clamp(fiber, 100)),
    serving_g: serving !== null && serving > 0 && serving < 5000 ? r1(serving) : null,
  };
}

export function parseOffSearch(json: unknown): OffFood[] {
  const products = (json as { products?: unknown[] })?.products;
  if (!Array.isArray(products)) return [];
  const seen = new Set<string>();
  const out: OffFood[] = [];
  for (const p of products) {
    const f = parseOffProduct(p);
    if (f && !seen.has(f.code)) {
      seen.add(f.code);
      out.push(f);
    }
  }
  return out;
}

export async function searchOpenFoodFacts(query: string, signal?: AbortSignal): Promise<OffFood[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '25',
    lc: 'es',
    fields: FIELDS,
  });
  const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`, {
    signal,
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });
  if (res.status === 429) throw new Error('Demasiadas búsquedas seguidas. Espera un minuto.');
  if (!res.ok) throw new Error(`Open Food Facts no responde (${res.status}).`);
  return parseOffSearch(await res.json());
}

/** Busca un producto por código de barras (para el futuro escáner). */
export async function getOpenFoodFactsProduct(code: string, signal?: AbortSignal): Promise<OffFood | null> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`, {
    signal,
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { product?: unknown; status?: number };
  return json.status === 1 ? parseOffProduct({ ...(json.product as object), code }) : null;
}
