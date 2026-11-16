import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { saveProfile } from '@/app/actions';
import { Disclaimer } from '@/components/disclaimer';
import { EMPTY_PROFILE, ProfileForm } from '@/components/profile-form';
import { PageSkeleton } from '@/components/ui/card';
import { getSession } from '@/lib/server/data';

export const metadata = { title: 'Tu perfil' };

export default function WelcomePage() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 pb-16 pt-[calc(env(safe-area-inset-top)+24px)]">
      <p className="mb-6 text-2xl font-extrabold tracking-tight">Vyro<span className="text-accent">.</span></p>
      <Suspense fallback={<PageSkeleton />}>
        <Onboarding />
      </Suspense>
      <div className="mt-8"><Disclaimer /></div>
    </main>
  );
}

async function Onboarding() {
  const s = await getSession();
  if (s.profile.onboarded_at) redirect('/');
  return <ProfileForm mode="onboarding" today={s.today} initial={EMPTY_PROFILE} onSubmit={saveProfile} />;
}
