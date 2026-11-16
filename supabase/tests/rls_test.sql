-- Pruebas de seguridad y reglas de datos. Cada bloque lanza una excepción si algo falla.
\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

do $$ begin
  if (select count(*) from public.user_profiles) <> 2 then raise exception 'perfiles no creados por trigger'; end if;
end $$;

-- ---------------------------------------------------------------- Usuario A
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

update public.user_profiles set display_name = 'A', goal = 'lose_fat' where id = auth.uid();
insert into public.body_measurements (measured_on, weight_kg) values (current_date, 80);
insert into public.meal_plans (plan_date) values (current_date);
insert into public.planned_meals (plan_id, plan_date, slot, name)
  select id, plan_date, 'dinner', 'Pollo con arroz' from public.meal_plans;
insert into public.meal_logs (log_date, slot, description) values (current_date, 'dinner', 'Hamburguesa con papas');
insert into public.chat_messages (role, content) values ('user', 'Hoy comí una hamburguesa');
insert into public.user_memories (kind, content) values ('likes', 'Le gusta el api morado');
insert into public.meal_change_history (happened_on, entity, action, summary, actor)
  values (current_date, 'planned_meal', 'replaced', 'Cena reemplazada', 'assistant');

-- % de grasa sin origen: rechazado (no fingimos precisión)
do $$ begin
  begin
    insert into public.body_measurements (measured_on, body_fat_pct) values (current_date - 1, 20);
    raise exception 'FALLO: aceptó %% de grasa sin origen';
  exception when check_violation then null;
  end;
end $$;

-- El historial no se puede modificar ni borrar
update public.meal_change_history set summary = 'manipulado';
delete from public.meal_change_history;
do $$ begin
  if (select summary from public.meal_change_history limit 1) <> 'Cena reemplazada' then
    raise exception 'FALLO: el historial se pudo modificar';
  end if;
end $$;

-- Cupo de IA: 12 planes al día
do $$ declare i int; r int; begin
  for i in 1..12 loop r := public.consume_ai_quota('plan'); end loop;
  if r <> 0 then raise exception 'cupo incorrecto %', r; end if;
  if public.consume_ai_quota('plan') <> -1 then raise exception 'FALLO: superó el cupo'; end if;
end $$;

-- ---------------------------------------------------------------- Usuario B
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$
declare a_plan uuid; a_meal uuid;
begin
  if (select count(*) from public.user_profiles) <> 1 then raise exception 'B ve perfiles ajenos'; end if;
  if exists (select 1 from public.body_measurements) then raise exception 'B ve pesos de A'; end if;
  if exists (select 1 from public.meal_logs) then raise exception 'B ve comidas de A'; end if;
  if exists (select 1 from public.planned_meals) then raise exception 'B ve el plan de A'; end if;
  if exists (select 1 from public.chat_messages) then raise exception 'B ve el chat de A'; end if;
  if exists (select 1 from public.user_memories) then raise exception 'B ve la memoria de A'; end if;
  if exists (select 1 from public.meal_change_history) then raise exception 'B ve el historial de A'; end if;

  -- B no puede colgar comidas del plan de A aunque conozca los ids
  reset role;
  select id into a_plan from public.meal_plans limit 1;
  select id into a_meal from public.planned_meals limit 1;
  set role authenticated;
  begin
    insert into public.planned_meals (plan_id, plan_date, slot, name) values (a_plan, current_date, 'lunch', 'x');
    raise exception 'FALLO: B añadió comidas al plan de A';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.meal_logs (log_date, slot, description, planned_meal_id) values (current_date, 'dinner', 'x', a_meal);
    raise exception 'FALLO: B enlazó su registro a la comida de A';
  exception when insufficient_privilege then null;
  end;
  -- B no puede escribir a nombre de A
  begin
    insert into public.chat_messages (user_id, role, content) values ('00000000-0000-0000-0000-00000000000a', 'user', 'x');
    raise exception 'FALLO: B escribió en el chat de A';
  exception when insufficient_privilege then null;
  end;
end $$;

-- B no puede borrar datos de A (0 filas afectadas)
delete from public.meal_logs;
update public.user_profiles set display_name = 'hack' where id = '00000000-0000-0000-0000-00000000000a';

-- B elimina SU cuenta: desaparecen sus datos, no los de A
insert into public.body_measurements (measured_on, weight_kg) values (current_date, 70);
select public.delete_my_account();

reset role;
do $$ begin
  if exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000b') then raise exception 'FALLO: no se borró la cuenta de B'; end if;
  if exists (select 1 from public.body_measurements where user_id = '00000000-0000-0000-0000-00000000000b') then raise exception 'FALLO: quedaron datos de B'; end if;
  if (select display_name from public.user_profiles where id = '00000000-0000-0000-0000-00000000000a') <> 'A' then raise exception 'FALLO: B modificó a A'; end if;
  if (select count(*) from public.meal_logs) <> 1 then raise exception 'FALLO: B borró comidas de A'; end if;
end $$;

-- Anónimo: sin acceso
set role anon;
do $$ begin
  begin
    perform count(*) from public.user_profiles;
    raise exception 'FALLO: anon leyó perfiles';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'RLS OK' as resultado;
