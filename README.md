# Vyro · Nutricionista personal con IA

Aplicación web (móvil primero) que funciona como un nutricionista virtual: crea planes de comida
con alimentos fáciles de conseguir en Bolivia, registra lo que comes de verdad (sin culpas), entiende
mensajes en lenguaje natural y sigue tu evolución semana a semana.

> Vyro ofrece orientación nutricional general. No da diagnósticos ni sustituye a un nutricionista o médico titulado.

**Tecnología:** Next.js 16 (App Router) + TypeScript · Tailwind CSS 4 · Supabase (autenticación y base de
datos con RLS) · API de Claude (servidor) · Recharts.
La arquitectura y la base de datos están explicadas en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

---

## Qué incluye esta primera versión

| Pantalla | Qué puedes hacer |
|---|---|
| **Inicio** | Calorías y macros del día, tu próxima comida, aviso del control semanal, resumen de peso y constancia. |
| **Mi plan de hoy** | Generar el plan; ver ingredientes, alternativas y preparación; “Lo comí”, “Comí otra cosa” (estimación con IA), “Cambiar plato”, editar ingredientes, omitir, deshacer, favoritos; aligerar el resto del día tras una comida abundante; historial de cambios. |
| **Nutricionista IA** | Chat que entiende “Hoy pesé 75 kg”, “Comí una hamburguesa en vez de mi cena”, “No tengo pollo”, “Quiero algo diferente mañana”, “Entrené dos días”… y actualiza tus datos con operaciones validadas. Muestra bajo cada respuesta qué cambió. |
| **Calendario** | Semana completa con el estado de cada comida (cumplida, reemplazada, omitida, pendiente), generar los días que faltan y entrar a cualquier día. |
| **Lista de compras** | Ingredientes de la semana sumados y agrupados por sección del mercado. |
| **Mi progreso** | Control semanal (peso, cintura, % de grasa **con su origen**, entrenos), gráficas, explicación sencilla y revisión con IA con ajustes moderados. |
| **Mi perfil** | Editar todos tus datos, ver tus objetivos, lo que la IA recuerda de ti (y borrarlo), favoritos, **descargar tus datos** y **eliminar tu cuenta**. |

Seguridad para menores: si la persona tiene menos de 18 años, no se ofrecen objetivos de pérdida de
peso, no se pide % de grasa, no hay déficit calórico y se recomienda acompañamiento profesional.

---

## 1. Lo que necesitas

| Qué | Para qué |
|---|---|
| **Node.js 20.9 o superior** | Ejecutar el proyecto (nodejs.org, versión LTS). |
| **Cuenta de Supabase** (gratis) | Usuarios y base de datos (supabase.com). |
| **Clave de la API de Claude** | La IA (console.anthropic.com → API Keys; requiere saldo en *Billing*). |
| Cuenta de Vercel (opcional, gratis) | Publicar la app con un enlace para usarla desde el móvil. |

## 2. Configurar Supabase (≈10 minutos)

Recomendado: **crea un proyecto nuevo** para esta versión web (la app móvil anterior usaba otras tablas).

1. **New project** → elige una región cercana (p. ej. São Paulo) y guarda la contraseña.
2. **Crear las tablas:** menú **SQL Editor → New query** → copia **todo** el archivo
   `supabase/migrations/20261116000000_vyro_nutricion.sql`, pégalo y pulsa **Run** (debe decir *Success*).
3. **Correo de confirmación:** **Authentication → Sign In / Providers → Email**.
   - Para probar tú solo, puedes desactivar **Confirm email** y entrar directamente.
   - Si lo dejas activo, configura **Authentication → URL Configuration**:
     *Site URL* = la dirección de tu app (p. ej. `http://localhost:3000` o tu enlace de Vercel) y añade
     `…/auth/callback` en *Redirect URLs*.
4. **Claves públicas:** **Project Settings → API Keys** (y **Data API** para la URL):
   - *Project URL* → `https://xxxx.supabase.co`
   - *Publishable key* (`sb_publishable_…`; en proyectos antiguos se llama *anon public*).
   - ⚠️ **Nunca** uses la *secret key* / *service_role* en esta app.

## 3. Ejecutar en tu ordenador

```bash
git clone https://github.com/mategutinoya/Vyro.git
```

```bash
cd Vyro
```

```bash
npm install
```

Crea `.env.local` a partir de la plantilla y rellena tus tres valores:

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
ANTHROPIC_API_KEY=sk-ant-…
```

La clave de Claude **no** lleva el prefijo `NEXT_PUBLIC_`: así nunca llega al navegador.

Arranca la app:

```bash
npm run dev
```

Abre **http://localhost:3000**, crea tu cuenta, completa el perfil y pulsa **Generar el plan del día**.

**Desde tu móvil (misma Wi‑Fi):** la terminal muestra una línea *Network: http://192.168.x.x:3000*;
ábrela en el navegador del móvil. Si activaste la confirmación por correo, añade esa dirección en las
*Redirect URLs* de Supabase.

## 4. Publicarla para usarla desde el móvil (recomendado)

1. Sube el proyecto a GitHub (ya está en este repositorio).
2. En vercel.com → **Add New → Project** → importa el repositorio.
3. En **Environment Variables** añade las tres variables de `.env.local`.
4. **Deploy**. Abre el enlace en el móvil y usa *Compartir → Añadir a pantalla de inicio* para tenerla como app.
5. En Supabase → **URL Configuration**, pon ese enlace como *Site URL* y `https://tu-app.vercel.app/auth/callback` en *Redirect URLs*.

Generar una semana entera hace varias peticiones a la IA y puede tardar 1–2 minutos.

## 5. Costes y límites de la IA

- Modelo: Claude Opus 5.5. Cada usuario tiene un **cupo diario** controlado por la base de datos:
  80 mensajes de chat, 12 generaciones de plan y 6 revisiones de progreso. Se cambia en la función
  `consume_ai_quota` de la migración.
- Coste orientativo: un mensaje de chat ronda 0,01–0,04 USD; un día de plan, 0,03–0,08 USD
  (estimaciones; dependen de la longitud de las respuestas).

## 6. Pruebas

```bash
npm run check      # TypeScript + lint + 28 pruebas unitarias (lógica, operaciones y chat con IA simulada)
```

```bash
npm run test:db    # Migración + pruebas de seguridad RLS en PostgreSQL local (usuario postgres)
```

Prueba de punta a punta (opcional, avanzado): `e2e/` contiene un servidor que imita Supabase sobre
PostgreSQL local, otro que imita la API de Claude y un recorrido de 19 pasos con Playwright
(registro → plan → registros → chat → calendario → compras → progreso → perfil → eliminar cuenta).
Ver cabecera de cada archivo para ejecutarlo.

## Estructura

```
src/
  app/                    Pantallas (App Router) y rutas de API
    (app)/                Inicio, hoy, chat, calendario, compras, progreso, perfil
    api/                  chat · plan · swap · adjust · estimate · review · export
    actions.ts            Server Actions (botones)
  components/             Interfaz (día, chat, progreso, perfil, UI base)
  lib/
    domain/               Lógica pura y probada: objetivos, seguridad, fechas, compras, progreso, esquemas
    server/ops.ts         ÚNICA vía de escritura: operaciones validadas + historial de cambios
    server/data.ts        Lecturas con la sesión del usuario
    ai/                   Claude: chat con herramientas, planificador, estimaciones, revisión
  proxy.ts                Refresco de sesión y protección de rutas
supabase/
  migrations/             Esquema SQL + RLS + funciones
  tests/                  Pruebas de seguridad de la base de datos
e2e/                      Entorno de pruebas de punta a punta
```
