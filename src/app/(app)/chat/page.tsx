import { Suspense } from 'react';

import { ChatView } from '@/components/chat/chat-view';
import { PageSkeleton } from '@/components/ui/card';
import { getChat, getOnboardedSession } from '@/lib/server/data';

export const metadata = { title: 'Nutricionista IA' };
export const maxDuration = 300;

export default function ChatPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Chat />
    </Suspense>
  );
}

async function Chat() {
  const s = await getOnboardedSession();
  const history = await getChat(s, 80);
  return <ChatView initial={history} name={s.profile.display_name} />;
}
