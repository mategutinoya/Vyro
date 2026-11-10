import { FunctionsHttpError } from '@supabase/supabase-js';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import type { MealAnalysis, MealItem } from '../../../supabase/functions/_shared/meal-analysis';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export type { MealAnalysis, MealItem };

export interface PickedPhoto {
  uri: string;
  base64: string;
}

/**
 * Abre la cámara o la galería y devuelve la foto reducida a 1024 px de ancho en JPEG
 * (unos 150–300 KB): suficiente para reconocer la comida y rápido de enviar.
 * Devuelve null si el usuario cancela.
 */
export async function pickMealPhoto(source: 'camera' | 'library'): Promise<PickedPhoto | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Necesitamos permiso para usar la cámara. Actívalo en los ajustes del teléfono.');
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: false };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;

  const asset = res.assets[0];
  const ctx = ImageManipulator.manipulate(asset.uri);
  if ((asset.width ?? 0) > 1024) ctx.resize({ width: 1024 });
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!out.base64) throw new Error('No se pudo preparar la foto.');
  return { uri: out.uri, base64: out.base64 };
}

/** Envía la foto a la función segura del servidor, que consulta a la IA. */
export async function analyzeMealPhoto(photo: PickedPhoto, note: string): Promise<MealAnalysis & { remaining: number }> {
  if (env.demo) throw new Error('El análisis con IA no está disponible en la demo web. Pruébalo en la app del teléfono.');
  const { data, error } = await supabase.functions.invoke('analyze-meal', {
    body: { image: photo.base64, mediaType: 'image/jpeg', note: note.trim() || undefined },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      // Mensaje en español que devuelve la propia función.
      const body = await error.context.json().catch(() => null);
      if (body?.error) throw new Error(body.error);
      if (error.context.status === 404) throw new Error('La función de IA no está instalada en Supabase todavía.');
    }
    throw new Error('No se pudo conectar con el análisis. Revisa tu conexión.');
  }
  return data;
}

/** Reescala un elemento estimado a otros gramos (proporcional). */
export function scaleItem(item: MealItem, grams: number): MealItem {
  const f = item.grams > 0 ? grams / item.grams : 0;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return { ...item, grams, kcal: r1(item.kcal * f), protein_g: r1(item.protein_g * f), carbs_g: r1(item.carbs_g * f), fat_g: r1(item.fat_g * f) };
}
