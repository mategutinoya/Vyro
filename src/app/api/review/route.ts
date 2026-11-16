import { reviewProgress } from '@/lib/ai/assist';
import { withSession } from '@/lib/server/api';

export const maxDuration = 120;

export async function POST() {
  return withSession('review', (s) => reviewProgress(s));
}
