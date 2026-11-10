-- =============================================================================
-- Vyro · Etapa 2 · Integridad entre usuarios
-- Las claves foráneas no aplican RLS: sin esto, un usuario podría enlazar
-- en sus recetas o su diario un alimento/receta PRIVADO de otra persona.
-- Estos triggers exigen que lo enlazado sea propio o del catálogo público.
-- =============================================================================

create or replace function public.assert_visible_food(p_food uuid, p_user uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_food is null then return; end if;
  if not exists (
    select 1 from public.foods f
    where f.id = p_food and (f.user_id is null or f.user_id = p_user)
  ) then
    raise exception 'Alimento no disponible para este usuario' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.check_recipe_ingredient_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_visible_food(new.food_id, new.user_id);
  if not exists (select 1 from public.recipes r where r.id = new.recipe_id and r.user_id = new.user_id) then
    raise exception 'Receta no disponible para este usuario' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger recipe_ingredients_refs
  before insert or update on public.recipe_ingredients
  for each row execute function public.check_recipe_ingredient_refs();

create or replace function public.check_food_log_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_visible_food(new.food_id, new.user_id);
  if new.recipe_id is not null
     and not exists (select 1 from public.recipes r where r.id = new.recipe_id and r.user_id = new.user_id) then
    raise exception 'Receta no disponible para este usuario' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger food_logs_refs
  before insert or update of food_id, recipe_id on public.food_logs
  for each row execute function public.check_food_log_refs();

-- Estas funciones son internas: nadie debe llamarlas directamente por la API.
revoke all on function public.assert_visible_food(uuid, uuid) from public, anon, authenticated;
revoke all on function public.check_recipe_ingredient_refs() from public, anon, authenticated;
revoke all on function public.check_food_log_refs() from public, anon, authenticated;

-- Búsqueda por nombre sin distinguir mayúsculas (ilike) más rápida.
create extension if not exists pg_trgm with schema extensions;
create index if not exists foods_name_trgm_idx on public.foods using gin (name extensions.gin_trgm_ops);
