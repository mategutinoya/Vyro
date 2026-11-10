-- Pruebas de aislamiento RLS. Cada bloque falla con una excepción si algo va mal.
\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

-- El trigger crea los perfiles
do $$ begin
  if (select count(*) from public.profiles) <> 2 then raise exception 'perfiles no creados por trigger'; end if;
end $$;

-- Usuario A escribe datos
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

update public.profiles set display_name = 'A', goal = 'lose' where id = auth.uid();
insert into public.water_logs (log_date, amount_ml) values (current_date, 250);
insert into public.foods (name, kcal_per_100g, protein_per_100g) values ('Alimento A', 100, 10);
insert into public.food_logs (log_date, meal, name, grams, kcal) values (current_date, 'lunch', 'Alimento A', 100, 100);
insert into public.nutrition_targets (calories, protein_g, carbs_g, fat_g, water_ml) values (2000, 150, 200, 60, 2500);
insert into public.routines (name, weekdays) values ('Empuje', '{1,4}');

-- A no puede insertar a nombre de B
do $$ begin
  begin
    insert into public.water_logs (user_id, log_date, amount_ml)
      values ('00000000-0000-0000-0000-00000000000b', current_date, 100);
    raise exception 'FALLO: A insertó datos de B';
  exception when insufficient_privilege then null; -- esperado
  end;
end $$;

-- A no puede escribir en el catálogo público ni en suscripciones
do $$ begin
  begin
    insert into public.exercises (user_id, name, muscle_group) values (null, 'X', 'other');
    raise exception 'FALLO: A escribió en catálogo público';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.subscriptions (user_id, plan) values (auth.uid(), 'pro');
    raise exception 'FALLO: A se otorgó suscripción';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Usuario B no ve nada de A
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'B ve perfiles ajenos'; end if;
  if (select count(*) from public.water_logs) <> 0 then raise exception 'B ve agua de A'; end if;
  if (select count(*) from public.food_logs) <> 0 then raise exception 'B ve comidas de A'; end if;
  if (select count(*) from public.foods) <> 0 then raise exception 'B ve alimentos privados de A'; end if;
  if (select count(*) from public.nutrition_targets) <> 0 then raise exception 'B ve objetivos de A'; end if;
  if (select count(*) from public.routines) <> 0 then raise exception 'B ve rutinas de A'; end if;
  if (select count(*) from public.exercises) < 30 then raise exception 'B no ve el catálogo público'; end if;
end $$;

-- B no puede modificar ni borrar datos de A (0 filas afectadas)
update public.profiles set display_name = 'hack' where id = '00000000-0000-0000-0000-00000000000a';
delete from public.water_logs;

-- Etapa 2: B no puede enlazar el alimento privado de A en su receta ni en su diario
do $$
declare a_food uuid; b_recipe uuid;
begin
  reset role;
  select id into a_food from public.foods where name = 'Alimento A';
  set role authenticated;
  insert into public.recipes (name) values ('Receta B') returning id into b_recipe;
  begin
    insert into public.recipe_ingredients (recipe_id, food_id, grams) values (b_recipe, a_food, 100);
    raise exception 'FALLO: B usó un alimento privado de A en su receta';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.food_logs (log_date, meal, food_id, name, grams, kcal) values (current_date, 'lunch', a_food, 'x', 100, 100);
    raise exception 'FALLO: B registró un alimento privado de A';
  exception when insufficient_privilege then null;
  end;
  -- Con un alimento propio sí funciona
  insert into public.foods (name, kcal_per_100g) values ('Alimento B', 50);
  insert into public.recipe_ingredients (recipe_id, food_id, grams)
    select b_recipe, id, 100 from public.foods where name = 'Alimento B';
  -- Borrar la receta borra sus ingredientes
  delete from public.recipes where id = b_recipe;
  if exists (select 1 from public.recipe_ingredients) then raise exception 'ingredientes huérfanos'; end if;
end $$;

-- Etapa 3: entrenamientos e IA
do $$
declare a_routine uuid; b_session uuid; ex uuid; left_ integer; i integer;
begin
  reset role;
  select id into a_routine from public.routines where name = 'Empuje';
  select id into ex from public.exercises where user_id is null limit 1;
  set role authenticated;  -- sigue siendo B

  -- B no puede iniciar sesión con la rutina de A ni añadirla a la suya
  begin
    insert into public.workout_sessions (routine_id, name) values (a_routine, 'x');
    raise exception 'FALLO: B usó la rutina de A';
  exception when insufficient_privilege then null;
  end;

  -- B sí puede entrenar con el catálogo público
  insert into public.workout_sessions (name) values ('Libre') returning id into b_session;
  insert into public.workout_sets (session_id, exercise_id, set_index, reps, weight_kg) values (b_session, ex, 0, 10, 60);

  -- Sólo un entrenamiento en curso a la vez
  begin
    insert into public.workout_sessions (name) values ('Otra');
    raise exception 'FALLO: dos entrenamientos en curso';
  exception when unique_violation then null;
  end;

  -- B no puede añadir series a una sesión ajena aunque conozca su id
  reset role;
  insert into public.workout_sessions (user_id, name)
    values ('00000000-0000-0000-0000-00000000000a', 'Sesión A') returning id into a_routine;
  set role authenticated;
  begin
    insert into public.workout_sets (session_id, exercise_id, set_index) values (a_routine, ex, 0);
    raise exception 'FALLO: B añadió series a la sesión de A';
  exception when insufficient_privilege then null;
  end;

  -- Cupo de IA: 15 usos diarios en el plan gratuito
  for i in 1..15 loop
    left_ := public.consume_ai_quota();
  end loop;
  if left_ <> 0 then raise exception 'cupo IA incorrecto: %', left_; end if;
  if public.consume_ai_quota() <> -1 then raise exception 'FALLO: superó el cupo de IA'; end if;

  -- Nadie puede escribir su propio consumo directamente
  begin
    update public.ai_usage set count = 0;
    if exists (select 1 from public.ai_usage where count = 0) then raise exception 'FALLO: B reinició su cupo'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;

-- Usuario anónimo no ve nada
reset role;
set role anon;
do $$ begin
  begin
    perform count(*) from public.profiles;
    raise exception 'FALLO: anon pudo leer perfiles';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
do $$ begin
  if (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a') <> 'A' then
    raise exception 'B modificó el perfil de A';
  end if;
  if (select count(*) from public.water_logs) <> 1 then raise exception 'B borró agua de A'; end if;
end $$;

select 'RLS OK' as resultado;
