import { generatePlans } from '@/lib/ai/plan-service';
import { isISODate } from '@/lib/domain/dates';
import { readJson, withSession } from '@/lib/server/api';
import { OpError } from '@/lib/server/ops';

export const maxDuration = 300;

/** Genera el plan de 1 a 7 días: { start: 'AAAA-MM-DD', days: 1..7, request?: string } */
export async function POST(req: Request) {
  const body = await readJson(req);
  return withSession('plan', async (s) => {
    const start = isISODate(body.start) ? body.start : s.today;
    const days = Number(body.days ?? 1);
    if (!Number.isInteger(days)) throw new OpError('Número de días no válido.');
    const request = typeof body.request === 'string' && body.request.trim() ? body.request.trim().slice(0, 300) : null;
    return generatePlans(s, start, days, request, 'user');
  });
}
