# Plan técnico de Vyro

## 1. Entorno analizado (10/11/2026)

- Repositorio vacío; Node 22, npm 10.
- Expo **SDK 58** (última estable): React Native 0.88, React 19.3, Expo Router 58, Reanimated 4.7, TypeScript 6. Nueva arquitectura obligatoria. React Compiler activado.
- Versiones de dependencias nativas resueltas con `expo install` contra el mapa de compatibilidad del SDK → todas incluidas en **Expo Go** (no hace falta compilar para probar).

## 2. Decisiones de arquitectura

| Tema | Decisión | Motivo |
|---|---|---|
| Navegación | Expo Router con `Stack.Protected` + `NativeTabs` | Rutas protegidas por sesión/onboarding; barra de pestañas nativa de iOS/Android |
| Datos remotos | Supabase (Postgres + Auth) con **RLS en todas las tablas** | Cada fila pertenece a un `user_id`; la seguridad no depende del código móvil |
| Estado servidor | TanStack Query | Caché, reintentos, actualización optimista (p. ej. agua) e invalidación entre pantallas |
| Almacenamiento local | AsyncStorage para la sesión; caché de Query en memoria | Fase 2: persistir caché para uso sin conexión |
| Organización | `src/features/<dominio>` (datos + reglas) separado de `src/app` (pantallas) | Escalable: cada dominio crece sin tocar los demás |
| Diseño | Tokens propios (`src/theme/tokens.ts`), Inter, negro + grafito, lima como único acento | Coherencia visual tipo Apple Fitness / WHOOP |
| Claves | Sólo URL + *publishable key* en el móvil; bloqueo si se detecta una clave secreta | Nunca exponer secretos |
| Historial fiable | `food_logs` guarda un *snapshot* de kcal/macros; `nutrition_targets` tiene `effective_from` | Editar un alimento u objetivo no reescribe días pasados |

## 3. Modelo de datos

```
auth.users ─┬─ profiles (1:1, creado por trigger)
            ├─ nutrition_targets (historial por fecha)
            ├─ foods (privados) ── recipe_ingredients ── recipes
            ├─ food_logs (fecha, comida, gramos, snapshot de macros)
            ├─ water_logs
            ├─ body_weights (1 por día)
            ├─ exercises (privados) ── routine_exercises ── routines (weekdays[])
            ├─ workout_sessions ── workout_sets (reps, peso, completada)
            └─ subscriptions (sólo lectura para el usuario; preparada, sin pagos)

Catálogos públicos (user_id NULL, sólo lectura): foods, exercises.
```

Políticas: CRUD sólo sobre filas propias; catálogos públicos legibles pero no editables; `subscriptions` sólo la escribe el backend con *service role*. Verificado con `supabase/tests/rls_test.sql`.

## 4. Pantallas principales

| Pestaña | Pantallas |
|---|---|
| Acceso | Entrar / Crear cuenta |
| Onboarding | Sobre ti → Objetivo y actividad → Plan calculado (editable) |
| **Inicio** | Calorías (anillo), proteína/carbohidratos/grasas, agua, entrenamiento del día, resumen 7 días |
| Comidas | Diario por fecha y comida → Buscar alimento → Cantidad en gramos → Crear alimento / receta |
| Entreno | Rutinas → Editor de rutina → Sesión activa (series, temporizador) → Historial |
| Progreso | Peso corporal + gráfico, estadísticas nutricionales, progresión por ejercicio |
| Perfil | Datos, objetivo, actividad, objetivos nutricionales, ajustes, cerrar sesión |

## 5. Plan por etapas

**Etapa 1 — Fundamentos + Inicio ✅ (esta entrega)**
1. Proyecto Expo SDK 58 + TypeScript + Router. ✅
2. Esquema SQL completo + RLS + pruebas de aislamiento. ✅
3. Sistema de diseño y componentes base. ✅
4. Autenticación por correo. ✅
5. Onboarding con cálculo de objetivos (Mifflin‑St Jeor). ✅
6. Inicio: calorías, macros, agua (registrar/deshacer), entreno del día, resumen semanal. ✅
7. Pruebas unitarias + typecheck + lint + bundle iOS/Android. ✅

**Etapa 2 — Alimentación ✅**
- Diario por fecha con las 4 comidas; añadir/editar/eliminar registros. ✅
- Crear y editar alimentos propios (valores por 100 g) y buscar entre ellos; recientes. ✅
- Búsqueda en **Open Food Facts** (base pública real, sin clave); los productos elegidos se guardan como copia propia. ✅
- Recetas a partir de alimentos; registrar raciones. ✅
- Integridad: no se pueden enlazar alimentos/recetas privados de otro usuario (triggers + pruebas). ✅
- Pendiente para más adelante: escáner de código de barras (la función `getOpenFoodFactsProduct` ya existe).

**Etapa 3 — Entrenamientos**
- Rutinas con ejercicios (catálogo + propios), días de la semana.
- Sesión activa: series, repeticiones, peso, marcar completadas, temporizador de descanso con háptica.
- Historial de sesiones.

**Etapa 4 — Progreso y Perfil**
- Registro de peso y gráfico; estadísticas nutricionales semanales/mensuales; récords y progresión por ejercicio.
- Edición de perfil y objetivos (nuevo `effective_from`), ajustes.

**Etapa 5 — Pulido para uso diario**
- Caché persistente sin conexión, notificaciones de recordatorio, icono y splash propios, build instalable con EAS.

**Después (no ahora):** IA (registro por foto/voz, recomendaciones) y suscripciones (RevenueCat + tabla `subscriptions` ya preparada).
