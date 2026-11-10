/** Utilidades de fecha en hora LOCAL (los registros diarios usan la fecha del teléfono). */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Día ISO de la semana: 1 = lunes … 7 = domingo. */
export function isoWeekday(iso: string): number {
  const js = parseISODate(iso).getDay();
  return js === 0 ? 7 : js;
}

export function ageFromBirthDate(birthISO: string, onISO: string = todayISO()): number {
  const b = parseISODate(birthISO);
  const t = parseISODate(onISO);
  let age = t.getFullYear() - b.getFullYear();
  const beforeBirthday =
    t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "lunes, 10 de noviembre" */
export function formatLongDate(iso: string): string {
  const d = parseISODate(iso);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

export function greeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 13) return 'Buenos días';
  if (h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}
