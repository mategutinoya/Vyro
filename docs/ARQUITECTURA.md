# Arquitectura de Vyro (web)

## Visión general

```
Navegador (móvil primero)
  │  Server Components (lectura)    Server Actions (botones)    fetch → /api/* (IA)
  ▼
Next.js 16 en el servidor ──────────────────────────────────────────────┐
  │ lib/server/data.ts   lecturas con la sesión del usuario              │
  │ lib/server/ops.ts    ÚNICA vía de escritura (validación zod +        │
  │                      historial de cambios)                           │
  │ lib/ai/*             Claude: chat con herramientas, planificador,     │
  │                      estimación de comidas, revisión del progreso    │
  ▼                                                       ▼
Supabase (Postgres + Auth, RLS en todas las tablas)     API de Claude (clave sólo en el servidor)
```

Principios:

1. **La IA nunca escribe por sí sola.** El chat expone herramientas *strict* (`record_meal`,
   `record_measurement`, `swap_meal`, …). Cada llamada se valida con zod y se ejecuta con
   `lib/server/ops.ts`, con el token del usuario (RLS aplica igual). Si una operación falla, el modelo
   recibe el error y no puede afirmar que guardó algo. Un mensaje sólo de texto no modifica nada
   (probado en `src/lib/ai/__tests__/chat.test.ts`).
2. **Nada se pierde:** cada cambio en comidas, planes u objetivos añade una fila a
   `meal_change_history` (antes, después, motivo y si lo hizo el usuario o la IA). Esa tabla sólo admite
   lectura e inserción.
3. **Sin culpas ni castigos:** comer otra cosa marca el plan como *reemplazado* (no "fallado");
   el ajuste posterior reduce como mucho un 15 % lo que queda del día, nunca elimina comidas y no se aplica
   a menores (`lib/domain/adjust.ts`).
4. **Seguridad por edad:** menores de 18 → sin déficit, sin objetivos de pérdida de peso ni % de grasa,
   con recomendación de acompañamiento profesional (`lib/domain/safety.ts`, `targets.ts`). Menores de 13
   no pueden registrarse.
5. **Sin falsa precisión:** el % de grasa siempre lleva su origen (estimado, bioimpedancia…); la base de
   datos rechaza un % sin origen.
6. **Ajustes moderados:** cualquier cambio de calorías sugerido por la IA se recorta en el servidor a
   ±10 % (máx. 250 kcal), nunca por debajo de un mínimo seguro, y sólo con ≥ 3 semanas de datos.

## Base de datos (`supabase/migrations/20261116000000_vyro_nutricion.sql`)

| Tabla | Contenido |
|---|---|
| `user_profiles` | Datos personales, objetivo y motivo, actividad, gustos, alergias, restricciones, condiciones de salud, presupuesto, comidas/día, día de control, zona horaria. Se crea sola al registrarse. |
| `nutrition_targets` | Objetivos diarios con historial (`effective_from`), modo seguro de menores y explicación. |
| `body_measurements` | Peso, cintura y % de grasa con origen; uno por día. |
| `activity_logs` | Sesiones de entrenamiento o resúmenes semanales. |
| `meal_plans` / `planned_meals` | Plan por día y sus comidas (ingredientes con alternativas, instrucciones, macros, estado: pendiente / cumplido / reemplazado / omitido). |
| `meal_logs` | Lo que se comió de verdad, con macros estimados, confianza y si faltan detalles; enlazado a la comida planificada que reemplaza o cumple. |
| `meal_change_history` | Registro inalterable de cambios. |
| `favorite_meals` | Platos guardados para reutilizar. |
| `user_memories` | Memoria del asistente (gustos, hábitos, horarios, sustituciones frecuentes…), sin duplicados y con número de apariciones. |
| `chat_messages` | Conversación completa con las acciones realizadas en cada respuesta. |
| `ai_usage` | Uso diario de IA por función; lo escribe sólo `consume_ai_quota()`. |

Funciones: `consume_ai_quota(feature)` (cupo diario), `delete_my_account()` (borra la cuenta y, en
cascada, todos los datos). Triggers impiden enlazar comidas o planes de otro usuario.

## Memoria del asistente

En cada mensaje, el servidor construye un contexto con: perfil, objetivos, plan y registros de hoy (con
ids), plan de mañana, últimos pesos, adherencia de 14 días, actividad, memoria guardada y cambios
recientes; más los últimos 24 mensajes del chat. El historial completo queda en la base de datos y la
memoria a largo plazo en `user_memories`, que el asistente amplía con la herramienta `remember` y el
usuario puede revisar y borrar en su perfil.

## Privacidad

- Claves: sólo la URL y la clave *publishable* de Supabase van al navegador; `ANTHROPIC_API_KEY` vive
  únicamente en el servidor.
- RLS en todas las tablas; probado con `npm run test:db` (un usuario no puede leer, modificar, enlazar ni
  borrar datos de otro; anónimos sin acceso).
- Exportación completa en JSON (`/api/export`) y eliminación de la cuenta desde el perfil.

## Siguientes etapas sugeridas

- Recordatorios (notificaciones) en el día de control y antes de cada comida.
- Registro de comidas por foto (la arquitectura de herramientas ya lo permite).
- Suscripciones: el cupo diario de `consume_ai_quota` ya está preparado para distinguir planes.
- Resumen automático del historial de chat muy antiguo para conversaciones muy largas.
