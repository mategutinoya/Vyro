import { ageFromBirthDate, todayISO } from '@/lib/date';

/** Convierte "DD/MM/AAAA" a "AAAA-MM-DD"; devuelve null si la fecha no es válida o la edad no está entre 13 y 100. */
export function parseBirthDate(input: string, today: string = todayISO()): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input.trim());
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const age = ageFromBirthDate(iso, today);
  return age >= 13 && age <= 100 ? iso : null;
}

/** Inserta las barras mientras se escribe: "15041992" -> "15/04/1992". */
export function maskBirthDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Acepta coma o punto decimal. Devuelve null si no es un número dentro del rango. */
export function parseDecimal(input: string, min: number, max: number): number | null {
  const n = Number(input.trim().replace(',', '.'));
  if (!input.trim() || !Number.isFinite(n) || n < min || n > max) return null;
  return n;
}
