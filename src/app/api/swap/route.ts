import { swapMeal } from '@/lib/ai/plan-service';
import { isISODate } from '@/lib/domain/dates';
import { isSlot } from '@/lib/domain/slots';
import { readJson, withSession } from '@/lib/server/api';
import { OpError } from '@/lib/server/ops';

export const maxDuration = 120;

/** Cambia un plato pendiente: { date, slot, reason } */
export async function POST(req: Request) {
  const body = await readJson(req);
  return withSession('plan', async (s) => {
    if (!isISODate(body.date) || !isSlot(body.slot)) throw new OpError('Comida no válida.');
    const reason = String(body.reason ?? '').trim().slice(0, 300) || 'Quiere otra opción';
    return swapMeal(s, body.date, body.slot, reason, [], 'user');
  });
}
