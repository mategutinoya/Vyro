-- =============================================================================
-- Vyro · Etapa 3 · Entrenamientos + registro de comidas con foto (IA)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Entrenamientos
-- ---------------------------------------------------------------------------

-- Orden de los ejercicios dentro de una sesión.
alter table public.workout_sets add column if not exists exercise_position smallint not null default 0;

-- Como mucho un entrenamiento en curso por usuario.
create unique index if not exists workout_sessions_one_active_idx
  on public.workout_sessions (user_id) where ended_at is null;

create or replace function public.assert_visible_exercise(p_exercise uuid, p_user uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.exercises e
    where e.id = p_exercise and (e.user_id is null or e.user_id = p_user)
  ) then
    raise exception 'Ejercicio no disponible para este usuario' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.check_routine_exercise_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_visible_exercise(new.exercise_id, new.user_id);
  if not exists (select 1 from public.routines r where r.id = new.routine_id and r.user_id = new.user_id) then
    raise exception 'Rutina no disponible para este usuario' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger routine_exercises_refs
  before insert or update on public.routine_exercises
  for each row execute function public.check_routine_exercise_refs();

create or replace function public.check_workout_session_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.routine_id is not null
     and not exists (select 1 from public.routines r where r.id = new.routine_id and r.user_id = new.user_id) then
    raise exception 'Rutina no disponible para este usuario' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger workout_sessions_refs
  before insert or update of routine_id on public.workout_sessions
  for each row execute function public.check_workout_session_refs();

create or replace function public.check_workout_set_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_visible_exercise(new.exercise_id, new.user_id);
  if not exists (select 1 from public.workout_sessions s where s.id = new.session_id and s.user_id = new.user_id) then
    raise exception 'Sesión no disponible para este usuario' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger workout_sets_refs
  before insert or update of session_id, exercise_id on public.workout_sets
  for each row execute function public.check_workout_set_refs();

revoke all on function public.assert_visible_exercise(uuid, uuid) from public, anon, authenticated;
revoke all on function public.check_routine_exercise_refs() from public, anon, authenticated;
revoke all on function public.check_workout_session_refs() from public, anon, authenticated;
revoke all on function public.check_workout_set_refs() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Registro de comidas con foto (IA)
-- ---------------------------------------------------------------------------

-- Origen de cada registro (útil para estadísticas y para revisar estimaciones de la IA).
alter table public.food_logs add column if not exists entry_source text not null default 'manual'
  check (entry_source in ('manual', 'recipe', 'ai_photo'));

-- Uso diario de la IA por usuario: controla el coste y prepara los planes de suscripción.
create table public.ai_usage (
  user_id  uuid not null references auth.users (id) on delete cascade,
  day      date not null,
  feature  text not null default 'meal_photo',
  count    integer not null default 0 check (count >= 0),
  primary key (user_id, day, feature)
);

alter table public.ai_usage enable row level security;

-- El usuario puede consultar su consumo; nunca escribirlo directamente.
create policy "ai_usage_select_own" on public.ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);

/**
 * Reserva un uso de IA para el usuario que llama (si le queda cupo hoy).
 * Devuelve cuántos usos le quedan tras reservar, o -1 si ya no le quedan.
 * El límite depende del plan (tabla subscriptions); sin suscripción = free.
 */
create or replace function public.consume_ai_quota(p_feature text default 'meal_photo')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_limit integer;
  v_count integer;
begin
  if v_user is null then
    raise exception 'Sesión no iniciada' using errcode = '42501';
  end if;

  select case when s.plan = 'pro' and s.status in ('active', 'trialing') then 100 else 15 end
    into v_limit
    from (select 1) one
    left join public.subscriptions s on s.user_id = v_user;

  insert into public.ai_usage as u (user_id, day, feature, count)
  values (v_user, current_date, p_feature, 1)
  on conflict (user_id, day, feature) do update set count = u.count + 1
    where u.count < v_limit
  returning u.count into v_count;

  if v_count is null then
    return -1;
  end if;
  return v_limit - v_count;
end;
$$;

revoke all on function public.consume_ai_quota(text) from public, anon;
grant execute on function public.consume_ai_quota(text) to authenticated;
