# Vyro

App móvil de nutrición y entrenamiento para iOS y Android.
React Native + Expo (SDK 58) · TypeScript · Expo Router · Supabase.

> Estado: **Etapa 1 del MVP** — acceso, onboarding con cálculo de objetivos y pantalla de Inicio funcional.
> Plan completo en [`docs/PLAN.md`](docs/PLAN.md).

---

## 0. Vista rápida sin configurar nada

- **Enlace de demo:** la app funcionando en el navegador (también desde el móvil). Los datos se guardan sólo en ese navegador.
- **En tu ordenador**, sin Supabase: `npm install` y después `npm run demo`. Se abre en el navegador en modo demo.

El modo demo (`EXPO_PUBLIC_DEMO=1`) usa un sustituto local de la base de datos (`src/lib/demo/`) que empieza vacío y respeta el mismo aislamiento por usuario. Es sólo para previsualizar; la app real usa Supabase.

## 1. Lo que necesitas (una sola vez)

| Qué | Para qué | Dónde |
|---|---|---|
| **Node.js 20 o superior** (LTS) | Ejecutar el proyecto en tu ordenador | nodejs.org |
| **Cuenta de Supabase** (gratis) | Usuarios y base de datos | supabase.com |
| **Expo Go** en tu teléfono | Ver la app mientras se desarrolla | App Store / Google Play |
| Cuenta de Expo (gratis, opcional) | Generar versiones instalables | expo.dev |

## 2. Configurar Supabase (≈10 minutos)

1. Entra en supabase.com → **New project**. Elige una región cercana (p. ej. *West EU*) y guarda la contraseña de la base de datos en un lugar seguro.
2. **Crear las tablas:** menú lateral → **SQL Editor** → **New query**. Abre el archivo
   `supabase/migrations/20261110000000_init.sql` de este proyecto, copia **todo** su contenido, pégalo y pulsa **Run**.
   Debe terminar con “Success”.
3. **Acceso por correo:** menú → **Authentication → Sign In / Providers → Email**.
   - Para uso personal puedes **desactivar “Confirm email”** y así entras directamente al registrarte.
   - Si lo dejas activado, recibirás un correo de confirmación: púlsalo y luego inicia sesión en la app.
4. **Copiar las claves públicas:** menú → **Project Settings → API Keys** (y **Data API** para la URL):
   - **Project URL** → `https://xxxx.supabase.co`
   - **Publishable key** (`sb_publishable_…`). En proyectos antiguos se llama **anon public**; también sirve.
   - ⚠️ **Nunca** copies la *secret key* ni la *service_role key* en la app. La app se niega a arrancar si detecta una.

## 3. Arrancar el proyecto en tu ordenador

```bash
git clone https://github.com/mategutinoya/Vyro.git
```

```bash
cd Vyro
```

```bash
npm install
```

Crea el archivo `.env` copiando la plantilla y rellena tus dos valores:

```bash
cp .env.example .env
```

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
```

Arranca el servidor de desarrollo:

```bash
npx expo start
```

## 4. Ver la app en tu teléfono con Expo Go

1. Instala **Expo Go** (App Store o Google Play).
2. Teléfono y ordenador **en la misma red Wi‑Fi**.
3. Con `npx expo start` en marcha aparece un **código QR** en la terminal:
   - **iPhone:** abre la app **Cámara** y apunta al QR.
   - **Android:** abre **Expo Go** → *Scan QR code*.
4. Cada vez que se guarda un cambio en el código, la app se recarga sola.

**Si no conecta** (redes de empresa/universidad, VPN…): para el servidor con `Ctrl + C` y usa un túnel:

```bash
npx expo start --tunnel
```

Si cambias el archivo `.env`, reinicia limpiando la caché:

```bash
npx expo start -c
```

> Todas las librerías usadas hasta ahora están incluidas en Expo Go, así que **no necesitas compilar nada** para probar.

## 5. Obtener una versión instalable (cuando quieras)

Expo Go es ideal para desarrollar. Para tener la app con su propio icono en el teléfono usa **EAS Build** (compila en la nube, no necesitas Mac ni Android Studio):

```bash
npm install -g eas-cli
```

```bash
eas login
```

Android — genera un `.apk` que instalas directamente desde el enlace que te da EAS:

```bash
eas build --profile preview --platform android
```

iPhone — requiere una cuenta de **Apple Developer** (99 USD/año). Registra tu teléfono y compila:

```bash
eas device:create
```

```bash
eas build --profile preview --platform ios
```

Las variables del `.env` también deben existir en EAS (Expo → tu proyecto → **Environment variables**) para que la versión compilada se conecte a Supabase.

## 6. Comprobaciones de calidad

```bash
npm run check      # TypeScript + lint + pruebas unitarias
```

```bash
npm run test:db    # Migración + pruebas de seguridad RLS (requiere PostgreSQL local)
```

## Estructura

```
src/
  app/                  Rutas (Expo Router): cada archivo es una pantalla
    (auth)/             Acceso y registro
    (tabs)/             Inicio · Comidas · Entreno · Progreso · Perfil
    onboarding.tsx      Configuración inicial en 3 pasos
  features/             Lógica por dominio (datos + reglas)
    auth/ profile/ nutrition/ water/ workouts/ progress/ dashboard/
  components/ui/        Sistema de componentes (tarjetas, botones, anillos…)
  theme/tokens.ts       Colores, tipografía, espaciado
  lib/                  Cliente Supabase, fechas, formato
supabase/
  migrations/           Esquema SQL + políticas RLS
  tests/                Pruebas de aislamiento entre usuarios
```
