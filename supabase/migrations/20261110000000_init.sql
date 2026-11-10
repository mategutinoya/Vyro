-- =============================================================================
-- Vyro · Esquema inicial (Fase 1 · MVP personal)
-- -----------------------------------------------------------------------------
-- Principios:
--   * Cada registro pertenece a un usuario (user_id -> auth.users).
--   * Row Level Security (RLS) activado en TODAS las tablas.
--   * Catálogos públicos (user_id IS NULL) son de solo lectura para la app.
--   * Los valores nutricionales de cada registro se guardan como "snapshot"
--     para que editar un alimento no altere el historial.
--   * La tabla `subscriptions` queda preparada, pero sólo el backend
--     (service role) podrá escribir en ella. No hay pagos todavía.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Perfil
-- ---------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  display_name    text check (char_length(display_name) <= 60),
  sex             text check (sex in ('male', 'female')),
  birth_date      date check (birth_date > '1900-01-01'),
  height_cm       numeric(5,1) check (height_cm between 100 and 250),
  goal            text check (goal in ('lose', 'maintain', 'gain')),
  activity_level  text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  onboarded_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crea automáticamente el perfil al registrarse.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Objetivos nutricionales (con historial: el vigente es el último
-- effective_from <= fecha consultada)
-- ---------------------------------------------------------------------------
create table public.nutrition_targets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  effective_from  date not null default current_date,
  calories        integer not null check (calories between 800 and 8000),
  protein_g       integer not null check (protein_g between 0 and 600),
  carbs_g         integer not null check (carbs_g between 0 and 1200),
  fat_g           integer not null check (fat_g between 0 and 400),
  water_ml        integer not null check (water_ml between 0 and 10000),
  is_custom       boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (user_id, effective_from)
);

-- ---------------------------------------------------------------------------
-- Alimentos y recetas
-- ---------------------------------------------------------------------------
create table public.foods (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid default auth.uid() references auth.users (id) on delete cascade, -- NULL = catálogo público
  name               text not null check (char_length(name) between 1 and 120),
  brand              text check (char_length(brand) <= 80),
  kcal_per_100g      numeric(6,1) not null check (kcal_per_100g >= 0 and kcal_per_100g <= 950),
  protein_per_100g   numeric(5,1) not null default 0 check (protein_per_100g between 0 and 100),
  carbs_per_100g     numeric(5,1) not null default 0 check (carbs_per_100g between 0 and 100),
  fat_per_100g       numeric(5,1) not null default 0 check (fat_per_100g between 0 and 100),
  fiber_per_100g     numeric(5,1) check (fiber_per_100g between 0 and 100),
  serving_g          numeric(6,1) check (serving_g > 0),
  source             text not null default 'user' check (source in ('user', 'catalog', 'openfoodfacts')),
  external_id        text,
  barcode            text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index foods_user_idx on public.foods (user_id);
create index foods_name_idx on public.foods using gin (to_tsvector('spanish', name));
create unique index foods_user_external_uidx on public.foods (user_id, source, external_id) where external_id is not null;

create trigger foods_updated_at before update on public.foods
  for each row execute function public.set_updated_at();

create table public.recipes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  servings    numeric(4,1) not null default 1 check (servings > 0),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

create table public.recipe_ingredients (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id   uuid not null references public.recipes (id) on delete cascade,
  food_id     uuid not null references public.foods (id) on delete restrict,
  grams       numeric(7,1) not null check (grams > 0),
  position    smallint not null default 0
);

create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id);

-- ---------------------------------------------------------------------------
-- Registros diarios
-- ---------------------------------------------------------------------------
create table public.food_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date    date not null,
  meal        text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_id     uuid references public.foods (id) on delete set null,
  recipe_id   uuid references public.recipes (id) on delete set null,
  name        text not null,
  grams       numeric(7,1) not null check (grams > 0),
  kcal        numeric(7,1) not null check (kcal >= 0),
  protein_g   numeric(6,1) not null default 0,
  carbs_g     numeric(6,1) not null default 0,
  fat_g       numeric(6,1) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index food_logs_user_date_idx on public.food_logs (user_id, log_date);

create trigger food_logs_updated_at before update on public.food_logs
  for each row execute function public.set_updated_at();

create table public.water_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date    date not null,
  amount_ml   integer not null check (amount_ml between 1 and 5000),
  created_at  timestamptz not null default now()
);

create index water_logs_user_date_idx on public.water_logs (user_id, log_date);

create table public.body_weights (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on  date not null,
  weight_kg    numeric(5,2) not null check (weight_kg between 25 and 400),
  created_at   timestamptz not null default now(),
  unique (user_id, measured_on)
);

-- ---------------------------------------------------------------------------
-- Entrenamiento
-- ---------------------------------------------------------------------------
create table public.exercises (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid default auth.uid() references auth.users (id) on delete cascade, -- NULL = catálogo público
  name          text not null check (char_length(name) between 1 and 80),
  muscle_group  text not null check (muscle_group in ('chest','back','shoulders','biceps','triceps','legs','glutes','core','full_body','cardio','other')),
  equipment     text check (equipment in ('barbell','dumbbell','machine','cable','bodyweight','kettlebell','band','other')),
  created_at    timestamptz not null default now()
);

create index exercises_user_idx on public.exercises (user_id);

create table public.routines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  notes       text,
  -- Días ISO (1 = lunes … 7 = domingo) en los que toca esta rutina.
  weekdays    smallint[] not null default '{}' check (weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  position    smallint not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index routines_user_idx on public.routines (user_id);

create trigger routines_updated_at before update on public.routines
  for each row execute function public.set_updated_at();

create table public.routine_exercises (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id    uuid not null references public.routines (id) on delete cascade,
  exercise_id   uuid not null references public.exercises (id) on delete restrict,
  position      smallint not null default 0,
  target_sets   smallint not null default 3 check (target_sets between 1 and 20),
  target_reps   smallint check (target_reps between 1 and 100),
  rest_seconds  smallint not null default 90 check (rest_seconds between 0 and 900)
);

create index routine_exercises_routine_idx on public.routine_exercises (routine_id);

create table public.workout_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id  uuid references public.routines (id) on delete set null,
  name        text not null,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  notes       text,
  created_at  timestamptz not null default now()
);

create index workout_sessions_user_started_idx on public.workout_sessions (user_id, started_at desc);

create table public.workout_sets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id    uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id   uuid not null references public.exercises (id) on delete restrict,
  set_index     smallint not null check (set_index >= 0),
  reps          smallint check (reps between 0 and 500),
  weight_kg     numeric(6,2) check (weight_kg between 0 and 1000),
  completed     boolean not null default false,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index workout_sets_session_idx on public.workout_sets (session_id);
create index workout_sets_user_exercise_idx on public.workout_sets (user_id, exercise_id);

-- ---------------------------------------------------------------------------
-- Suscripciones (preparado para el futuro; sin pagos todavía)
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  plan                text not null default 'free' check (plan in ('free', 'pro')),
  status              text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled', 'expired')),
  provider            text check (provider in ('revenuecat', 'app_store', 'play_store', 'stripe', 'manual')),
  provider_ref        text,
  current_period_end  timestamptz,
  updated_at          timestamptz not null default now()
);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles           enable row level security;
alter table public.nutrition_targets  enable row level security;
alter table public.foods              enable row level security;
alter table public.recipes            enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.food_logs          enable row level security;
alter table public.water_logs         enable row level security;
alter table public.body_weights       enable row level security;
alter table public.exercises          enable row level security;
alter table public.routines           enable row level security;
alter table public.routine_exercises  enable row level security;
alter table public.workout_sessions   enable row level security;
alter table public.workout_sets       enable row level security;
alter table public.subscriptions      enable row level security;

-- Perfil: cada usuario sólo ve y edita el suyo (la fila la crea el trigger).
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Tablas 100 % privadas: CRUD sólo sobre filas propias.
do $$
declare t text;
begin
  foreach t in array array[
    'nutrition_targets', 'recipes', 'recipe_ingredients', 'food_logs', 'water_logs',
    'body_weights', 'routines', 'routine_exercises', 'workout_sessions', 'workout_sets'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)',
      t || '_owner_all', t);
  end loop;
end $$;

-- Catálogos (foods, exercises): leer públicos + propios; escribir sólo propios.
create policy "foods_select" on public.foods
  for select to authenticated using (user_id is null or (select auth.uid()) = user_id);
create policy "foods_insert_own" on public.foods
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "foods_update_own" on public.foods
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "foods_delete_own" on public.foods
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "exercises_select" on public.exercises
  for select to authenticated using (user_id is null or (select auth.uid()) = user_id);
create policy "exercises_insert_own" on public.exercises
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "exercises_update_own" on public.exercises
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "exercises_delete_own" on public.exercises
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Suscripciones: el usuario sólo puede LEER su estado. Escribe el backend (service role).
create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);

-- =============================================================================
-- Catálogo público de ejercicios (sólo nombres; sin datos numéricos)
-- =============================================================================
insert into public.exercises (user_id, name, muscle_group, equipment) values
  (null, 'Press de banca',              'chest',     'barbell'),
  (null, 'Press inclinado con mancuernas','chest',   'dumbbell'),
  (null, 'Aperturas en polea',          'chest',     'cable'),
  (null, 'Fondos en paralelas',         'chest',     'bodyweight'),
  (null, 'Flexiones',                   'chest',     'bodyweight'),
  (null, 'Dominadas',                   'back',      'bodyweight'),
  (null, 'Remo con barra',              'back',      'barbell'),
  (null, 'Remo con mancuerna',          'back',      'dumbbell'),
  (null, 'Jalón al pecho',              'back',      'cable'),
  (null, 'Remo en polea baja',          'back',      'cable'),
  (null, 'Peso muerto',                 'back',      'barbell'),
  (null, 'Press militar',               'shoulders', 'barbell'),
  (null, 'Press de hombro con mancuernas','shoulders','dumbbell'),
  (null, 'Elevaciones laterales',       'shoulders', 'dumbbell'),
  (null, 'Face pull',                   'shoulders', 'cable'),
  (null, 'Curl con barra',              'biceps',    'barbell'),
  (null, 'Curl con mancuernas',         'biceps',    'dumbbell'),
  (null, 'Curl martillo',               'biceps',    'dumbbell'),
  (null, 'Extensión de tríceps en polea','triceps',  'cable'),
  (null, 'Press francés',               'triceps',   'barbell'),
  (null, 'Sentadilla',                  'legs',      'barbell'),
  (null, 'Prensa de piernas',           'legs',      'machine'),
  (null, 'Zancadas',                    'legs',      'dumbbell'),
  (null, 'Extensión de cuádriceps',     'legs',      'machine'),
  (null, 'Curl femoral',                'legs',      'machine'),
  (null, 'Peso muerto rumano',          'legs',      'barbell'),
  (null, 'Elevación de gemelos',        'legs',      'machine'),
  (null, 'Hip thrust',                  'glutes',    'barbell'),
  (null, 'Plancha',                     'core',      'bodyweight'),
  (null, 'Rueda abdominal',             'core',      'other'),
  (null, 'Elevación de piernas colgado','core',      'bodyweight'),
  (null, 'Cinta de correr',             'cardio',    'machine'),
  (null, 'Bicicleta estática',          'cardio',    'machine'),
  (null, 'Remo ergómetro',              'cardio',    'machine');
