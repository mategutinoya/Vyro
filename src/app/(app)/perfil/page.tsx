import { Suspense } from 'react';

import { Disclaimer } from '@/components/disclaimer';
import { DataControls, EditProfile, FavoriteList, MemoryList } from '@/components/profile/profile-extras';
import { Card, PageSkeleton, SectionTitle } from '@/components/ui/card';
import { getFavorites, getMeasurements, getMemories, getOnboardedSession, getTargets } from '@/lib/server/data';

export const metadata = { title: 'Mi perfil' };

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  const s = await getOnboardedSession();
  const p = s.profile;
  const [targets, memories, favorites, measurements] = await Promise.all([getTargets(s, s.today), getMemories(s, 100), getFavorites(s), getMeasurements(s, 30)]);
  const lastWeight = measurements.filter((m) => m.weight_kg !== null).at(-1);
  const lastFat = measurements.filter((m) => m.body_fat_pct !== null).at(-1);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Mi perfil</h1>
        <p className="mt-1 text-sm text-muted">{s.email}</p>
      </header>

      {targets ? (
        <section className="space-y-3">
          <SectionTitle>Objetivos diarios</SectionTitle>
          <Card className="space-y-3">
            <div className="grid grid-cols-4 gap-2 text-center">
              {([['kcal', targets.calories, ''], ['Proteína', targets.protein_g, 'text-protein'], ['Carbos', targets.carbs_g, 'text-carbs'], ['Grasas', targets.fat_g, 'text-fat']] as const).map(([l, v, c]) => (
                <div key={l}><p className={`tabular text-xl font-bold ${c}`}>{v}{l === 'kcal' ? '' : ' g'}</p><p className="text-xs text-muted">{l}</p></div>
              ))}
            </div>
            {targets.rationale ? <p className="text-sm text-muted">{targets.rationale}</p> : null}
            <p className="text-xs text-faint">Desde el {targets.effective_from.split('-').reverse().join('/')} · {targets.source === 'assistant_adjustment' ? 'ajuste tras revisión' : 'calculado con tus datos'}.</p>
          </Card>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionTitle>Mis datos</SectionTitle>
        <Card>
          <EditProfile today={s.today} initial={{
            display_name: p.display_name ?? '', birth_date: p.birth_date ?? '', sex: p.sex ?? 'female', height_cm: p.height_cm ? String(p.height_cm) : '',
            weight_kg: lastWeight?.weight_kg ? String(lastWeight.weight_kg) : '', body_fat_pct: lastFat?.body_fat_pct ? String(lastFat.body_fat_pct) : '',
            body_fat_source: (lastFat?.body_fat_source as never) ?? null, goal: p.goal ?? 'eat_healthier', goal_reason: p.goal_reason ?? '',
            activity_level: p.activity_level ?? 'light', training_description: p.training_description ?? '', training_days_per_week: p.training_days_per_week ?? 0,
            favorite_foods: p.favorite_foods, disliked_foods: p.disliked_foods, allergies: p.allergies, restrictions: p.restrictions,
            health_conditions: p.health_conditions, budget: p.budget ?? 'medium', meals_per_day: p.meals_per_day, checkin_weekday: p.checkin_weekday ?? 1, city: p.city ?? '',
          }} />
          <p className="mt-3 text-xs text-faint">El peso y el % de grasa se registran en “Mi progreso”; aquí sólo se usan para recalcular objetivos.</p>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionTitle>Lo que Vyro recuerda de ti</SectionTitle>
        <Card><MemoryList memories={memories} /></Card>
      </section>

      <section className="space-y-3">
        <SectionTitle>Comidas favoritas</SectionTitle>
        <Card><FavoriteList favorites={favorites} /></Card>
      </section>

      <section className="space-y-3">
        <SectionTitle>Privacidad y cuenta</SectionTitle>
        <Card className="space-y-3">
          <p className="text-sm text-muted">Tus datos sólo los puedes ver tú (protección por usuario en la base de datos). La IA los recibe sólo para responderte y no se usan para otra cosa dentro de Vyro.</p>
          <DataControls />
        </Card>
      </section>

      <Disclaimer />
    </div>
  );
}
