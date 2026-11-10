import { describe, expect, it } from '@jest/globals';

import { parseOffProduct, parseOffSearch } from '@/features/nutrition/off';

// Formato de respuesta documentado de la API de búsqueda de Open Food Facts.
const product = {
  code: '8410000000001',
  product_name: 'Greek yogurt',
  product_name_es: 'Yogur griego natural',
  brands: 'Marca A, Marca B',
  serving_quantity: '125',
  nutriments: { 'energy-kcal_100g': 124, proteins_100g: 3.7, carbohydrates_100g: 4.4, fat_100g: 10.2, fiber_100g: '0' },
};

describe('Open Food Facts', () => {
  it('convierte un producto al formato de Vyro', () => {
    expect(parseOffProduct(product)).toEqual({
      code: '8410000000001',
      name: 'Yogur griego natural',
      brand: 'Marca A',
      kcal_per_100g: 124,
      protein_per_100g: 3.7,
      carbs_per_100g: 4.4,
      fat_per_100g: 10.2,
      fiber_per_100g: 0,
      serving_g: 125,
    });
  });

  it('calcula kcal desde kJ si faltan', () => {
    const p = parseOffProduct({ ...product, nutriments: { 'energy-kj_100g': 418.4, proteins_100g: 1, carbohydrates_100g: 1, fat_100g: 1 } });
    expect(p?.kcal_per_100g).toBe(100);
  });

  it('descarta productos incompletos, imposibles o repetidos', () => {
    expect(parseOffProduct({ ...product, nutriments: { 'energy-kcal_100g': 100 } })).toBeNull();
    expect(parseOffProduct({ ...product, product_name: '', product_name_es: '' })).toBeNull();
    expect(parseOffProduct({ ...product, nutriments: { ...product.nutriments, 'energy-kcal_100g': 4000 } })).toBeNull();
    expect(parseOffSearch({ products: [product, product, null] })).toHaveLength(1);
    expect(parseOffSearch({})).toEqual([]);
  });
});
