/** Fechas como "AAAA-MM-DD" en la zona horaria del usuario (por defecto Bolivia). */

export const DEFAULT_TZ = 'America/La_Paz';

export function todayIn(tz: string = DEFAULT_TZ, now: Date = new Date()): string {
  // en-CA formatea como AAAA-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function hourIn(tz: string = DEFAULT_TZ, now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(now)) % 24;
}

export const isISODate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

const toUTC = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fromUTC = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(iso: string, n: number): string {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUTC(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 86_400_000);
}

/** 1 = lunes … 7 = domingo */
export function isoWeekday(iso: string): number {
  const d = toUTC(iso).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Lunes de la semana de esa fecha. */
export function weekStart(iso: string): string {
  return addDays(iso, 1 - isoWeekday(iso));
}

export function weekDays(mondayISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayISO, i));
}

export function ageOn(birthISO: string, onISO: string): number {
  const [by, bm, bd] = birthISO.split('-').map(Number);
  const [y, m, d] = onISO.split('-').map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

export const WEEKDAYS_ES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export const WEEKDAYS_SHORT_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_SHORT_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** "lunes 16 de noviembre" */
export function longDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${WEEKDAYS_ES[isoWeekday(iso) - 1]} ${d} de ${MONTHS_ES[m - 1]}`;
}

/** "16 nov" */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_SHORT_ES[m - 1]}`;
}

export function relativeDay(iso: string, today: string): string {
  const diff = diffDays(iso, today);
  if (diff === 0) return 'Hoy';
  if (diff === -1) return 'Ayer';
  if (diff === 1) return 'Mañana';
  const s = longDate(iso);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
