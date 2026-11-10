import { describe, expect, it } from '@jest/globals';

import { createDemoClient } from '@/lib/demo/demo-client';

describe('cliente demo (sustituto local de Supabase)', () => {
  const db = createDemoClient();

  it('registra, crea perfil y aísla los datos entre usuarios', async () => {
    const a = await db.auth.signUp({ email: 'a@demo.local', password: '123456' });
    expect(a.error).toBeNull();
    const { data: profile } = await db.from('profiles').select('*').maybeSingle();
    expect(profile).toMatchObject({ onboarded_at: null });

    await db.from('water_logs').insert({ log_date: '2026-11-10', amount_ml: 250 });
    await db.from('water_logs').insert({ log_date: '2026-11-10', amount_ml: 500 });
    const { data: water } = await db.from('water_logs').select('id, amount_ml').eq('log_date', '2026-11-10');
    expect((water as { amount_ml: number }[]).map((w) => w.amount_ml)).toEqual([250, 500]);

    await db.auth.signOut();
    await db.auth.signUp({ email: 'b@demo.local', password: '123456' });
    const { data: waterB } = await db.from('water_logs').select('*');
    expect(waterB).toEqual([]);
    const { error } = await db.from('water_logs').insert({ user_id: 'otro', log_date: '2026-11-10', amount_ml: 1 });
    expect(error).not.toBeNull();
  });

  it('upsert respeta la clave de conflicto y el objetivo vigente por fecha', async () => {
    const { data: s } = await db.auth.getSession();
    const uid = s.session!.user.id;
    await db.from('nutrition_targets').upsert({ user_id: uid, effective_from: '2026-11-01', calories: 2000 }, { onConflict: 'user_id,effective_from' });
    await db.from('nutrition_targets').upsert({ user_id: uid, effective_from: '2026-11-01', calories: 2100 }, { onConflict: 'user_id,effective_from' });
    await db.from('nutrition_targets').upsert({ user_id: uid, effective_from: '2026-11-20', calories: 2500 }, { onConflict: 'user_id,effective_from' });
    const { data } = await db.from('nutrition_targets').select('calories').lte('effective_from', '2026-11-10').order('effective_from', { ascending: false }).limit(1).maybeSingle();
    expect(data).toMatchObject({ calories: 2100 });
  });

  it('rechaza credenciales incorrectas', async () => {
    const r = await db.auth.signInWithPassword({ email: 'a@demo.local', password: 'mala' });
    expect(r.error?.message).toMatch(/invalid login/i);
  });
});
