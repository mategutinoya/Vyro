import { estimateMeal } from '@/lib/ai/assist';
import { readJson, withSession } from '@/lib/server/api';

export const maxDuration = 120;

export async function POST(req: Request) {
  const body = await readJson(req);
  return withSession('chat', () => estimateMeal(String(body.description ?? '')));
}
