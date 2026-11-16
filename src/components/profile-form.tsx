'use client';

import { ArrowLeft, Info } from 'lucide-react';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Choice, TagInput } from '@/components/ui/choice';
import { ErrorText, Input, Label, Select, Textarea } from '@/components/ui/field';
import { ageOn, WEEKDAYS_ES } from '@/lib/domain/dates';
import { allowedGoals, GOAL_LABELS, isMinor, MIN_AGE, type Goal } from '@/lib/domain/safety';
import { BODY_FAT_SOURCE_LABELS, BODY_FAT_SOURCES, type ProfileInput } from '@/lib/domain/schemas';
import { ACTIVITY_LABELS, type Activity } from '@/lib/domain/targets';

export type ProfileFormValues = Omit<ProfileInput, 'height_cm' | 'weight_kg' | 'body_fat_pct'> & {
  height_cm: string;
  weight_kg: string;
  body_fat_pct: string;
};

export const EMPTY_PROFILE: ProfileFormValues = {
  display_name: '', birth_date: '', sex: 'female', height_cm: '', weight_kg: '', body_fat_pct: '', body_fat_source: null,
  goal: 'eat_healthier', goal_reason: '', activity_level: 'light', training_description: '', training_days_per_week: 0,
  favorite_foods: [], disliked_foods: [], allergies: [], restrictions: [], health_conditions: [],
  budget: 'medium', meals_per_day: 4, checkin_weekday: 1, city: '',
};

const num = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() && Number.isFinite(n) ? n : null;
};

const STEPS = ['Sobre ti', 'Tu objetivo', 'Tu alimentación', 'Tu control semanal'];

export function ProfileForm({ initial, today, mode, onSubmit }: {
  initial: ProfileFormValues;
  today: string;
  mode: 'onboarding' | 'edit';
  onSubmit: (v: ProfileInput, opts: { recalc: boolean }) => Promise<{ error?: string } | void>;
}) {
  const [v, setV] = useState<ProfileFormValues>(initial);
  const [step, setStep] = useState(0);
  const [recalc, setRecalc] = useState(mode === 'onboarding');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof ProfileFormValues>(k: K, val: ProfileFormValues[K]) => setV((s) => ({ ...s, [k]: val }));

  const age = /^\d{4}-\d{2}-\d{2}$/.test(v.birth_date) ? ageOn(v.birth_date, today) : null;
  const minor = isMinor(age);
  const goals = allowedGoals(age);
  const goal: Goal = goals.includes(v.goal) ? v.goal : goals[0];

  const stepErrors = [
    () => {
      if (age === null) return 'Indica tu fecha de nacimiento.';
      if (age < MIN_AGE) return `Vyro es para mayores de ${MIN_AGE} años.`;
      if (age > 110) return 'Revisa la fecha de nacimiento.';
      const h = num(v.height_cm); const w = num(v.weight_kg);
      if (h === null || h < 90 || h > 250) return 'Altura entre 90 y 250 cm.';
      if (w === null || w < 20 || w > 400) return 'Peso entre 20 y 400 kg.';
      if (!minor && v.body_fat_pct && (num(v.body_fat_pct) === null || !v.body_fat_source)) return 'Si indicas tu % de grasa, di de dónde sale.';
      return null;
    },
    () => null,
    () => null,
    () => null,
  ];

  function next() {
    const e = stepErrors[step]();
    setError(e);
    if (!e && step < STEPS.length - 1) setStep(step + 1);
  }

  function submit() {
    for (const f of stepErrors) {
      const e = f();
      if (e) return setError(e);
    }
    const payload: ProfileInput = {
      ...v,
      goal,
      height_cm: num(v.height_cm)!,
      weight_kg: num(v.weight_kg)!,
      body_fat_pct: minor ? null : num(v.body_fat_pct),
      body_fat_source: minor || !num(v.body_fat_pct) ? null : v.body_fat_source,
    };
    setError(null);
    start(async () => {
      const r = await onSubmit(payload, { recalc });
      if (r && 'error' in r && r.error) setError(r.error);
    });
  }

  const showAll = mode === 'edit';
  const visible = (i: number) => showAll || step === i;

  return (
    <div className="space-y-5">
      {mode === 'onboarding' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            <span>Paso {step + 1} de {STEPS.length}</span>
            {step > 0 ? (
              <button type="button" onClick={() => { setError(null); setStep(step - 1); }} className="inline-flex items-center gap-1 normal-case tracking-normal text-accent">
                <ArrowLeft className="size-3.5" /> Atrás
              </button>
            ) : null}
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
          <h1 className="pt-3 text-3xl font-bold tracking-tight">{STEPS[step]}</h1>
        </div>
      ) : null}

      {visible(0) ? (
        <section key="s0" className="animate-rise space-y-4">
          {showAll ? <h2 className="text-lg font-semibold">Sobre ti</h2> : <p className="text-muted">Con estos datos estimamos tus necesidades. Puedes cambiarlos cuando quieras.</p>}
          <div><Label htmlFor="name">Nombre (opcional)</Label><Input id="name" value={v.display_name} maxLength={60} onChange={(e) => set('display_name', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="birth">Fecha de nacimiento</Label><Input id="birth" type="date" max={today} value={v.birth_date} onChange={(e) => set('birth_date', e.target.value)} /></div>
            <div><Label htmlFor="sex">Sexo biológico</Label>
              <Select id="sex" value={v.sex} onChange={(e) => set('sex', e.target.value as 'male' | 'female')}>
                <option value="female">Mujer</option><option value="male">Hombre</option>
              </Select>
            </div>
            <div><Label htmlFor="height" hint="cm">Altura</Label><Input id="height" inputMode="decimal" placeholder="165" value={v.height_cm} onChange={(e) => set('height_cm', e.target.value)} /></div>
            <div><Label htmlFor="weight" hint="kg">Peso actual</Label><Input id="weight" inputMode="decimal" placeholder="68,5" value={v.weight_kg} onChange={(e) => set('weight_kg', e.target.value)} /></div>
          </div>
          {minor ? (
            <Card className="flex gap-3 border-[rgba(125,211,252,0.3)] text-sm text-muted">
              <Info className="mt-0.5 size-4 shrink-0 text-info" />
              <p>Como eres menor de edad, Vyro no fija objetivos de pérdida de peso ni de porcentaje de grasa: te ayudará a comer suficiente y equilibrado. Te recomendamos hacerlo junto a un profesional de la salud y tu familia.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="bf" hint="opcional">% de grasa corporal</Label><Input id="bf" inputMode="decimal" placeholder="Si lo conoces" value={v.body_fat_pct} onChange={(e) => set('body_fat_pct', e.target.value)} /></div>
              <div><Label htmlFor="bfs">¿De dónde sale?</Label>
                <Select id="bfs" value={v.body_fat_source ?? ''} onChange={(e) => set('body_fat_source', (e.target.value || null) as ProfileFormValues['body_fat_source'])}>
                  <option value="">—</option>
                  {BODY_FAT_SOURCES.map((s) => <option key={s} value={s}>{BODY_FAT_SOURCE_LABELS[s]}</option>)}
                </Select>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {visible(1) ? (
        <section key="s1" className="animate-rise space-y-4">
          {showAll ? <h2 className="pt-2 text-lg font-semibold">Objetivo y actividad</h2> : null}
          <div><Label>Objetivo principal</Label>
            <Choice name="Objetivo" value={goal} onChange={(g) => set('goal', g)} options={goals.map((g) => ({ value: g, label: GOAL_LABELS[g] }))} columns={2} />
          </div>
          <div><Label htmlFor="reason" hint="opcional">¿Por qué es importante para ti?</Label><Textarea id="reason" maxLength={500} value={v.goal_reason} onChange={(e) => set('goal_reason', e.target.value)} placeholder="Ej.: tener más energía en el trabajo y jugar fútbol los fines de semana" /></div>
          <div><Label>Nivel de actividad</Label>
            <Choice name="Actividad" value={v.activity_level} onChange={(a) => set('activity_level', a)} options={(Object.keys(ACTIVITY_LABELS) as Activity[]).map((a) => ({ value: a, label: ACTIVITY_LABELS[a].title, detail: ACTIVITY_LABELS[a].detail }))} />
          </div>
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div><Label htmlFor="train" hint="opcional">¿Qué entrenas?</Label><Input id="train" maxLength={500} value={v.training_description} onChange={(e) => set('training_description', e.target.value)} placeholder="Gimnasio, fútbol, caminar…" /></div>
            <div><Label htmlFor="days">Días/semana</Label><Input id="days" type="number" min={0} max={14} value={v.training_days_per_week} onChange={(e) => set('training_days_per_week', Math.max(0, Math.min(14, Number(e.target.value) || 0)))} /></div>
          </div>
        </section>
      ) : null}

      {visible(2) ? (
        <section key="s2" className="animate-rise space-y-4">
          {showAll ? <h2 className="pt-2 text-lg font-semibold">Alimentación</h2> : null}
          <div><Label>Comidas que te gustan</Label><TagInput label="Comidas que te gustan" value={v.favorite_foods} onChange={(x) => set('favorite_foods', x)} placeholder="Escribe y pulsa Enter" suggestions={['Pollo', 'Quinua', 'Huevo', 'Plátano', 'Api', 'Trucha', 'Papa']} /></div>
          <div><Label>Comidas que NO te gustan</Label><TagInput label="Comidas que no te gustan" value={v.disliked_foods} onChange={(x) => set('disliked_foods', x)} placeholder="Escribe y pulsa Enter" suggestions={['Hígado', 'Pescado', 'Brócoli', 'Lentejas']} /></div>
          <div><Label>Alergias e intolerancias</Label><TagInput label="Alergias" value={v.allergies} onChange={(x) => set('allergies', x)} placeholder="Ninguna" suggestions={['Maní', 'Lactosa', 'Gluten', 'Mariscos', 'Huevo']} /></div>
          <div><Label>Restricciones</Label><TagInput label="Restricciones" value={v.restrictions} onChange={(x) => set('restrictions', x)} placeholder="Ninguna" suggestions={['Vegetariano', 'Vegano', 'Sin cerdo', 'Bajo en sal']} /></div>
          <div><Label hint="opcional">Condiciones de salud</Label><TagInput label="Condiciones de salud" value={v.health_conditions} onChange={(x) => set('health_conditions', x)} placeholder="Ej.: diabetes, hipertensión" suggestions={['Diabetes', 'Hipertensión', 'Colesterol alto', 'Embarazo']} />
            <p className="mt-1.5 text-xs text-faint">Si indicas alguna, Vyro será más prudente y te sugerirá validar el plan con tu médico.</p>
          </div>
          <div><Label>Presupuesto para comida</Label>
            <Choice name="Presupuesto" value={v.budget} onChange={(b) => set('budget', b)} columns={3} options={[{ value: 'low', label: 'Ajustado' }, { value: 'medium', label: 'Medio' }, { value: 'high', label: 'Holgado' }]} />
          </div>
          <div><Label>Comidas al día</Label>
            <Choice name="Comidas al día" value={v.meals_per_day} onChange={(n) => set('meals_per_day', n)} columns={4} options={[3, 4, 5, 6].map((n) => ({ value: n, label: String(n), detail: n === 3 ? 'Sin meriendas' : n === 4 ? 'Con merienda' : n === 5 ? '+ media mañana' : '+ colación' }))} />
          </div>
        </section>
      ) : null}

      {visible(3) ? (
        <section key="s3" className="animate-rise space-y-4">
          {showAll ? <h2 className="pt-2 text-lg font-semibold">Control semanal</h2> : <p className="text-muted">Una vez por semana registrarás tu peso (y si quieres, cintura). Elige el día que te venga mejor.</p>}
          <div><Label>Día de control</Label>
            <Choice name="Día de control" value={v.checkin_weekday} onChange={(d) => set('checkin_weekday', d)} columns={7} options={WEEKDAYS_ES.map((d, i) => ({ value: i + 1, label: d.slice(0, 2).toUpperCase() }))} />
            <p className="mt-1.5 text-xs text-faint">Seleccionado: {WEEKDAYS_ES[v.checkin_weekday - 1]}. Pésate en ayunas, después de ir al baño.</p>
          </div>
          <div><Label htmlFor="city" hint="opcional">Ciudad</Label><Input id="city" maxLength={80} value={v.city} onChange={(e) => set('city', e.target.value)} placeholder="La Paz, Santa Cruz, Cochabamba…" /></div>
          {mode === 'edit' ? (
            <label className="flex items-start gap-3 text-sm text-muted">
              <input type="checkbox" checked={recalc} onChange={(e) => setRecalc(e.target.checked)} className="mt-1 size-4 accent-[var(--accent)]" />
              <span>Recalcular mis objetivos diarios con estos datos y mi último peso.</span>
            </label>
          ) : null}
        </section>
      ) : null}

      <ErrorText>{error}</ErrorText>
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+80px)] pt-2 lg:bottom-4">
        {mode === 'onboarding' && step < STEPS.length - 1 ? (
          <Button size="lg" className="w-full" onClick={next}>Continuar</Button>
        ) : (
          <Button size="lg" className="w-full" onClick={submit} loading={pending}>{mode === 'onboarding' ? 'Crear mi plan' : 'Guardar cambios'}</Button>
        )}
      </div>
    </div>
  );
}
