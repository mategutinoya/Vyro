import { chatTurn } from '@/lib/ai/chat';
import { readJson, withSession } from '@/lib/server/api';

export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await readJson(req);
  return withSession('chat', (s) => chatTurn(s, String(body.message ?? '')));
}
