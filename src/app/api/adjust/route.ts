import { adjustRemaining } from '@/lib/ai/plan-service';
import { isISODate } from '@/lib/domain/dates';
import { readJson, withSession } from '@/lib/server/api';

export const maxDuration = 180;

/** Aligera con moderación las comidas pendientes del día: { date } */
export async function POST(req: Request) {
  const body = await readJson(req);
  return withSession('plan', (s) => adjustRemaining(s, isISODate(body.date) ? body.date : s.today, 'El usuario comió más de lo previsto', 'user'));
}
