-- =============================================================================
-- Vyro · Nutricionista personal con IA (aplicación web)
-- -----------------------------------------------------------------------------
-- Principios
--   * Cada fila pertenece a un usuario (user_id -> auth.users) y RLS está activo
--     en TODAS las tablas: un usuario sólo puede ver y tocar lo suyo.
--   * Nada se borra en silencio: los cambios de comidas y planes se registran en
--     meal_change_history (quién, qué, antes/después y motivo).
--   * Los valores nutricionales se guardan como "foto" en cada registro.
--   * El porcentaje de grasa SIEMPRE lleva su origen (estimado / medido y cómo).
--   * La IA nunca escribe directamente: el servidor valida cada operación y la
--     ejecuta con el token del usuario (RLS aplica igual).
-- Tablas con nombres propios (user_profiles, meal_logs, …) para poder convivir
-- con el esquema anterior de la app móvil si se usa el mismo proyecto.
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Perfil
-- ---------------------------------------------------------------------------
create table public.user_profiles (
  id                     uuid primary key references auth.users (id) on delete cascade,
  display_name           text check (char_length(display_name) <= 60),
  birth_date             date check (birth_date > '1900-01-01'),
  sex                    text check (sex in ('male', 'female')),
  height_cm              numeric(5,1) check (height_cm between 90 and 250),
  goal                   text check (goal in ('lose_fat', 'maintain', 'gain_muscle', 'eat_healthier', 'performance')),
  goal_reason            text check (char_length(goal_reason) <= 500),
  activity_level         text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  training_description   text check (char_length(training_description) <= 500),
  training_days_per_week smallint check (training_days_per_week between 0 and 14),
  favorite_foods         text[] not null default '{}',
  disliked_foods         text[] not null default '{}',
  allergies              text[] not null default '{}',
  restrictions           text[] not null default '{}',
  health_conditions      text[] not null default '{}',
  budget                 text check (budget in ('low', 'medium', 'high')),
  meals_per_day          smallint not null default 4 check (meals_per_day between 3 and 6),
  checkin_weekday        smallint check (checkin_weekday between 1 and 7), -- 1 = lunes … 7 = domingo
  city                   text check (char_length(city) <= 80),
  country                text not null default 'BO',
  timezone               text not null default 'America/La_Paz' check (char_length(timezone) <= 60),
  onboarded_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger user_profiles_updated_at before update on public.user_profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_vyro_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_vyro
  after insert on auth.users
  for each row execute function public.handle_new_vyro_user();

-- Objetivos diarios con historial (el vigente es el último effective_from <= fecha).
create table public.nutrition_targets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  effective_from date not null default current_date,
  calories       integer not null check (calories between 1000 and 6000),
  protein_g      integer not null check (protein_g between 0 and 400),
  carbs_g        integer not null check (carbs_g between 0 and 900),
  fat_g          integer not null check (fat_g between 0 and 300),
  minor_safe_mode boolean not null default false,
  rationale      text,
  source         text not null default 'calculated' check (source in ('calculated', 'assistant_adjustment', 'manual')),
  created_at     timestamptz not null default now(),
  unique (user_id, effective_from)
);

-- Peso y medidas (control semanal u ocasional).
create table public.body_measurements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on     date not null,
  weight_kg       numeric(5,2) check (weight_kg between 20 and 400),
  body_fat_pct    numeric(4,1) check (body_fat_pct between 2 and 70),
  body_fat_source text check (body_fat_source in ('self_estimate', 'smart_scale', 'bioimpedance', 'skinfold', 'dexa', 'other')),
  waist_cm        numeric(5,1) check (waist_cm between 30 and 250),
  notes           text check (char_length(notes) <= 500),
  is_checkin      boolean not null default false,
  source          text not null default 'manual' check (source in ('manual', 'chat', 'onboarding')),
  created_at      timestamptz not null default now(),
  unique (user_id, measured_on),
  -- Un % de grasa sin origen no se acepta: no fingimos precisión.
  check (body_fat_pct is null or body_fat_source is not null),
  check (weight_kg is not null or body_fat_pct is not null or waist_cm is not null)
);

-- Entrenamiento: sesiones sueltas o resumen semanal ("esta semana entrené 2 días").
create table public.activity_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date      date not null,
  kind          text not null default 'session' check (kind in ('session', 'week_summary')),
  description   text not null check (char_length(description) between 1 and 300),
  duration_min  smallint check (duration_min between 1 and 600),
  sessions      smallint check (sessions between 0 and 14),
  source        text not null default 'manual' check (source in ('manual', 'chat')),
  created_at    timestamptz not null default now()
);
create index activity_logs_user_date_idx on public.activity_logs (user_id, log_date);

-- ---------------------------------------------------------------------------
-- Planes y comidas
-- ---------------------------------------------------------------------------
-- Momentos de comida admitidos (según comidas al día).
-- breakfast, mid_morning, lunch, snack, dinner, late_snack

create table public.meal_plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_date   date not null,
  notes       text,
  generated_by text not null default 'ai' check (generated_by in ('ai', 'manual')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, plan_date)
);
create trigger meal_plans_updated_at before update on public.meal_plans
  for each row execute function public.set_updated_at();

create table public.planned_meals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id       uuid not null references public.meal_plans (id) on delete cascade,
  plan_date     date not null,
  slot          text not null check (slot in ('breakfast', 'mid_morning', 'lunch', 'snack', 'dinner', 'late_snack')),
  name          text not null check (char_length(name) between 1 and 120),
  description   text,
  ingredients   jsonb not null default '[]'::jsonb, -- [{name, quantity, unit, alternatives[]}]
  instructions  jsonb not null default '[]'::jsonb, -- ["paso 1", ...]
  kcal          numeric(6,1) check (kcal >= 0),
  protein_g     numeric(5,1) check (protein_g >= 0),
  carbs_g       numeric(5,1) check (carbs_g >= 0),
  fat_g         numeric(5,1) check (fat_g >= 0),
  status        text not null default 'planned' check (status in ('planned', 'completed', 'replaced', 'skipped')),
  replaced_by   uuid, -- meal_logs.id (FK abajo)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (plan_id, slot)
);
create index planned_meals_user_date_idx on public.planned_meals (user_id, plan_date);
create trigger planned_meals_updated_at before update on public.planned_meals
  for each row execute function public.set_updated_at();

-- Lo que el usuario comió de verdad (planificado o no).
create table public.meal_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date        date not null,
  slot            text not null check (slot in ('breakfast', 'mid_morning', 'lunch', 'snack', 'dinner', 'late_snack')),
  planned_meal_id uuid references public.planned_meals (id) on delete set null,
  description     text not null check (char_length(description) between 1 and 300),
  items           jsonb not null default '[]'::jsonb, -- [{name, quantity, unit}]
  kcal            numeric(6,1) check (kcal >= 0),
  protein_g       numeric(5,1) check (protein_g >= 0),
  carbs_g         numeric(5,1) check (carbs_g >= 0),
  fat_g           numeric(5,1) check (fat_g >= 0),
  estimate_confidence text check (estimate_confidence in ('high', 'medium', 'low')),
  needs_details   boolean not null default false,
  followed_plan   boolean not null default false,
  source          text not null default 'manual' check (source in ('manual', 'chat', 'plan')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index meal_logs_user_date_idx on public.meal_logs (user_id, log_date);
create trigger meal_logs_updated_at before update on public.meal_logs
  for each row execute function public.set_updated_at();

alter table public.planned_meals
  add constraint planned_meals_replaced_by_fk foreign key (replaced_by) references public.meal_logs (id) on delete set null;

-- Historial de todos los cambios en comidas y planes.
create table public.meal_change_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  happened_on date not null,          -- día al que afecta el cambio
  entity      text not null check (entity in ('planned_meal', 'meal_log', 'meal_plan', 'targets')),
  entity_id   uuid,
  action      text not null check (action in ('created', 'completed', 'replaced', 'skipped', 'swapped', 'edited', 'deleted', 'regenerated', 'adjusted', 'reopened')),
  summary     text not null,
  before      jsonb,
  after       jsonb,
  reason      text,
  actor       text not null check (actor in ('user', 'assistant', 'system')),
  created_at  timestamptz not null default now()
);
create index meal_change_history_user_day_idx on public.meal_change_history (user_id, happened_on);

create table public.favorite_meals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 120),
  slot         text check (slot in ('breakfast', 'mid_morning', 'lunch', 'snack', 'dinner', 'late_snack')),
  description  text,
  ingredients  jsonb not null default '[]'::jsonb,
  instructions jsonb not null default '[]'::jsonb,
  kcal         numeric(6,1),
  protein_g    numeric(5,1),
  carbs_g      numeric(5,1),
  fat_g        numeric(5,1),
  created_at   timestamptz not null default now(),
  unique (user_id, name)
);

-- ---------------------------------------------------------------------------
-- Memoria del asistente y chat
-- ---------------------------------------------------------------------------
create table public.user_memories (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind         text not null check (kind in ('likes', 'dislikes', 'habit', 'schedule', 'substitution', 'goal', 'context', 'training')),
  content      text not null check (char_length(content) between 2 and 300),
  times_seen   integer not null default 1 check (times_seen >= 1),
  source       text not null default 'chat' check (source in ('chat', 'profile', 'system')),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create unique index user_memories_dedupe_idx on public.user_memories (user_id, kind, lower(content));

create table public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null check (char_length(content) between 1 and 8000),
  actions     jsonb not null default '[]'::jsonb, -- resumen de operaciones ejecutadas en ese turno
  created_at  timestamptz not null default now()
);
create index chat_messages_user_created_idx on public.chat_messages (user_id, created_at desc);

-- Uso de IA por día (control de coste; preparado para planes de pago).
create table public.ai_usage (
  user_id  uuid not null references auth.users (id) on delete cascade,
  day      date not null,
  feature  text not null check (feature in ('chat', 'plan', 'review')),
  count    integer not null default 0 check (count >= 0),
  primary key (user_id, day, feature)
);

-- =============================================================================
-- Integridad entre tablas del mismo usuario (las FK no aplican RLS)
-- =============================================================================
create or replace function public.check_same_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'planned_meals' then
    if not exists (select 1 from public.meal_plans p where p.id = new.plan_id and p.user_id = new.user_id and p.plan_date = new.plan_date) then
      raise exception 'Plan no disponible para este usuario' using errcode = '42501';
    end if;
    if new.replaced_by is not null and not exists (select 1 from public.meal_logs l where l.id = new.replaced_by and l.user_id = new.user_id) then
      raise exception 'Registro no disponible para este usuario' using errcode = '42501';
    end if;
  elsif tg_table_name = 'meal_logs' then
    if new.planned_meal_id is not null and not exists (select 1 from public.planned_meals m where m.id = new.planned_meal_id and m.user_id = new.user_id) then
      raise exception 'Comida planificada no disponible para este usuario' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger planned_meals_same_owner before insert or update on public.planned_meals
  for each row execute function public.check_same_owner();
create trigger meal_logs_same_owner before insert or update on public.meal_logs
  for each row execute function public.check_same_owner();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.user_profiles       enable row level security;
alter table public.nutrition_targets   enable row level security;
alter table public.body_measurements   enable row level security;
alter table public.activity_logs       enable row level security;
alter table public.meal_plans          enable row level security;
alter table public.planned_meals       enable row level security;
alter table public.meal_logs           enable row level security;
alter table public.meal_change_history enable row level security;
alter table public.favorite_meals      enable row level security;
alter table public.user_memories       enable row level security;
alter table public.chat_messages       enable row level security;
alter table public.ai_usage            enable row level security;

create policy "user_profiles_select_own" on public.user_profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "user_profiles_update_own" on public.user_profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

do $$
declare t text;
begin
  foreach t in array array[
    'nutrition_targets', 'body_measurements', 'activity_logs', 'meal_plans', 'planned_meals',
    'meal_logs', 'favorite_meals', 'user_memories', 'chat_messages'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)',
      t || '_owner_all', t);
  end loop;
end $$;

-- El historial de cambios sólo se puede leer y AÑADIR: no se edita ni se borra
-- (salvo al eliminar la cuenta, por la cascada).
create policy "meal_change_history_select_own" on public.meal_change_history
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "meal_change_history_insert_own" on public.meal_change_history
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- El consumo de IA sólo se lee; lo escribe consume_ai_quota().
create policy "ai_usage_select_own" on public.ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);

-- =============================================================================
-- Funciones
-- =============================================================================

/* Reserva un uso de IA si queda cupo hoy. Devuelve los usos restantes o -1. */
create or replace function public.consume_ai_quota(p_feature text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_user  uuid := auth.uid();
  v_limit integer;
  v_count integer;
begin
  if v_user is null then
    raise exception 'Sesión no iniciada' using errcode = '42501';
  end if;
  v_limit := case p_feature when 'chat' then 80 when 'plan' then 12 when 'review' then 6 else 0 end;
  if v_limit = 0 then
    raise exception 'Función de IA desconocida' using errcode = '22023';
  end if;
  insert into public.ai_usage as u (user_id, day, feature, count)
  values (v_user, current_date, p_feature, 1)
  on conflict (user_id, day, feature) do update set count = u.count + 1 where u.count < v_limit
  returning u.count into v_count;
  if v_count is null then return -1; end if;
  return v_limit - v_count;
end;
$$;
revoke all on function public.consume_ai_quota(text) from public, anon;
grant execute on function public.consume_ai_quota(text) to authenticated;

/* Elimina la cuenta del usuario que llama y TODOS sus datos (cascada). */
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Sesión no iniciada' using errcode = '42501';
  end if;
  delete from auth.users where id = v_user;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

revoke all on function public.check_same_owner() from public, anon, authenticated;
revoke all on function public.handle_new_vyro_user() from public, anon, authenticated;
