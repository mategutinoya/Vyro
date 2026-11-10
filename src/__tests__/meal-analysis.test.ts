import { describe, expect, it } from '@jest/globals';

import { buildUserText, sanitizeMealAnalysis } from '../../supabase/functions/_shared/meal-analysis';

describe('análisis de comida por foto: validación de la respuesta', () => {
  it('conserva elementos válidos y redondea', () => {
    const r = sanitizeMealAnalysis({
      is_food: true,
      notes: 'Arroz cocido con aceite.',
      items: [{ name: ' Arroz blanco cocido ', grams: 180.33, kcal: 234.4, protein_g: 4.86, carbs_g: 50.4, fat_g: 0.54, confidence: 'high' }],
    });
    expect(r).toEqual({
      is_food: true,
      notes: 'Arroz cocido con aceite.',
      items: [{ name: 'Arroz blanco cocido', grams: 180.3, kcal: 234.4, protein_g: 4.9, carbs_g: 50.4, fat_g: 0.5, confidence: 'high' }],
    });
  });

  it('recorta valores físicamente imposibles', () => {
    const r = sanitizeMealAnalysis({
      is_food: true,
      notes: '',
      items: [{ name: 'Galleta', grams: 30, kcal: 9999, protein_g: 80, carbs_g: 20, fat_g: 5, confidence: 'rara' }],
    });
    expect(r.items[0].kcal).toBeLessThanOrEqual(30 * 9.5);
    expect(r.items[0].protein_g).toBeLessThanOrEqual(30);
    expect(r.items[0].confidence).toBe('medium');
  });

  it('descarta elementos sin nombre o sin cantidad, y lo que no es comida', () => {
    expect(sanitizeMealAnalysis({ is_food: true, notes: '', items: [{ name: '', grams: 100 }, { name: 'X', grams: 0 }] }).items).toEqual([]);
    expect(sanitizeMealAnalysis({ is_food: false, notes: 'Es un perro', items: [] })).toEqual({ is_food: false, items: [], notes: 'Es un perro' });
    expect(sanitizeMealAnalysis(null).is_food).toBe(false);
  });

  it('limita y delimita la nota del usuario', () => {
    expect(buildUserText(undefined)).toBe('Analiza esta comida.');
    const t = buildUserText('  con   aceite \n de oliva ');
    expect(t).toContain('«con aceite de oliva»');
    expect(buildUserText('a'.repeat(1000)).length).toBeLessThan(400);
  });
});
