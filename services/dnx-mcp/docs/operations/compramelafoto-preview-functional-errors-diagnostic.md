# ComprameLaFoto — Diagnóstico funcional conjunto (preview)

**Fecha:** 2026-07-09  
**Preview:** https://compramelafoto-dnxsuite-dmkly2qso-compramelafotos-projects.vercel.app  
**Proyecto Vercel:** `compramelafoto-dnxsuite` (`prj_onlsJ1X9XOYyBFK0Qn5ojth4D1He`)  
**Restricciones respetadas:** sin producción · sin DNS · sin deploy · sin modificar env Vercel · sin migraciones · sin fixes aplicados

---

## Resumen ejecutivo

Con Protection Bypass activo, las requests **llegan a la app**. Los síntomas de login / home / blog son **fallo de autenticación Prisma contra la DB preview** (`ep-empty-moon…`). El buscador y tutoriales fallan además por **rutas ausentes en el monorepo** (existen en legacy).

| Función                  | Causa raíz                                                                                                                                                        | Fix mínimo                                                                                                                                                                   | Migración | Redeploy                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------- |
| Login                    | `DATABASE_URL` preview apunta a Neon `ep-empty-moon` con credenciales inválidas (`password authentication failed` / Prisma init auth failure). No es P2021/P2022. | Corregir `DATABASE_URL` + `DIRECT_URL` preview hacia la instancia staging válida (hoy DNX-MCP usa `ep-round-fog…`) o rotar password de `ep-empty-moon` y alinear ambas URLs. | No        | Sí (tras cambio env preview) |
| Home álbumes             | Misma causa DB: `prisma.album.findMany()` no autentica.                                                                                                           | Mismo fix de env/DB preview.                                                                                                                                                 | No        | Sí                           |
| Buscador eventos/álbumes | `GET /api/public/events` **no existe** en monorepo (`404` → `/404`). Home sí lo invoca.                                                                           | Portar `app/api/public/events/route.ts` desde legacy.                                                                                                                        | No        | Sí                           |
| Tutoriales               | `app/tutoriales/page.tsx` y `app/api/tutorials/route.ts` **ausentes**; `/tutoriales` cae en `app/[handler]` (`x-matched-path: /[handler]`) → 404/error.           | Portar página + API (o reservar slug y redirigir).                                                                                                                           | No*       | Sí                           |
| Blog                     | SSR `/blog` 500: mismas credenciales DB inválidas al consultar posts/categorías.                                                                                  | Mismo fix de env/DB preview.                                                                                                                                                 | No        | Sí                           |

\*Seed de `SystemSettings.tutorials_videos` puede faltar después; no bloquea “abrir” la ruta si la página existe.

**Capa primaria compartida (login, álbumes, blog):** configuración Vercel preview → Neon incorrecta/inválida.  
**Capa secundaria (buscador, tutoriales):** código faltante en migración monorepo.

---

## 1. Deployment READY del commit `5101185`

| Campo                    | Valor                                                                   |
| ------------------------ | ----------------------------------------------------------------------- |
| **Deployment ID**        | `dpl_4Ny92iPBdYkTHTy1NbEirT38RMWw`                                      |
| **URL**                  | `compramelafoto-dnxsuite-dmkly2qso-compramelafotos-projects.vercel.app` |
| **readyState**           | **READY**                                                               |
| **target**               | `null` (preview)                                                        |
| **Commit**               | `510118554800561276a0ca04d6e96a38742c15c2`                              |
| **Mensaje**              | `fix(clf): resolve preview api esm runtime error`                       |
| **Rama**                 | `migration-legacy-clf-to-monorepo`                                      |
| **Build**                | READY · `hasErrors: false` · ~207 s                                     |
| **Health (orquestador)** | healthy (smoke `/` 200; `/checkout` 500 por misma DB)                   |

Es el preview actual del proyecto y el único READY reciente con SHA `5101185…`.

---

## 2. Runtime logs Vercel

- `GET …/runtime-logs` (stream NDJSON): **timeout de lectura** en esta sesión (mismo comportamiento documentado antes).
- `GET /v3/deployments/{id}/events`: solo eventos de **build**, sin líneas de runtime de request.
- **Evidencia runtime usable:** cuerpos JSON de las APIs (abajo). Exponen el error Prisma de autenticación sin código `P20xx`.

Fragmento típico (login / albums):

```text
Invalid `prisma.user.findUnique()` / `prisma.album.findMany()` invocation:
Authentication failed against database server, the provided database
credentials for `(not available)` are not valid.
```

No apareció `ERR_REQUIRE_ESM` en este deployment (coherente con el fix del commit `5101185` que quitó `"type": "module"` del package de la app).

---

## 3. Probes HTTP con bypass

**Método:** header `x-vercel-protection-bypass` (secret del proyecto, fingerprint `bd642828958d`, coincide con `protectionBypass` de Vercel).  
**Nota:** `x-vercel-set-bypass-cookie: true` puede devolver `307` a la misma path; para APIs preferir **solo header** o cookie `_vercel_jwt` ya establecida.

| Método | Ruta                        | Status  | Content-Type       | Destino | Error exacto / notas                                             |
| ------ | --------------------------- | ------- | ------------------ | ------- | ---------------------------------------------------------------- |
| GET    | `/api/auth/me`              | **200** | `application/json` | app     | `{"user":null}` — OK sin sesión                                  |
| POST   | `/api/auth/login`           | **500** | `application/json` | app     | `error: "Error en el login"` + detail Prisma auth failure        |
| GET    | `/api/public/albums`        | **500** | `application/json` | app     | `error: "Error obteniendo álbumes"` + detail Prisma auth failure |
| GET    | `/api/public/events`        | **404** | `text/html`        | app     | `x-matched-path: /404` — ruta inexistente                        |
| GET    | `/api/public/events?q=test` | **404** | `text/html`        | app     | igual                                                            |
| GET    | `/api/tutorials`            | **404** | `text/html`        | app     | ruta inexistente                                                 |
| GET    | `/tutoriales`               | **404** | `text/html`        | app     | `x-matched-path: /[handler]` — catch-all                         |
| GET    | `/blog`                     | **500** | `text/html`        | app     | `__next_error__` (SSR)                                           |
| GET    | `/`                         | **200** | `text/html`        | app     | shell OK; datos vía APIs fallan en cliente                       |

Login de prueba: `fotografo.staging@clf.dnx.test` / `StagingClf2026!` (password del seed doc).

---

## 4. Endpoints que invoca el código (monorepo @ `5101185`)

| UI                       | Archivo                                         | Endpoint / acceso                                                                                                                          |
| ------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Login                    | `apps/compramelafoto/app/login/LoginClient.tsx` | `POST /api/auth/login` (valida `content-type` JSON; si no, mensaje de protección Vercel; si 500 JSON → `data.error` = «Error en el login») |
| Home álbumes             | `apps/compramelafoto/app/page.tsx`              | `GET /api/public/albums`                                                                                                                   |
| Buscador eventos/álbumes | `app/page.tsx`                                  | `GET /api/public/events` y `?q=` / `?lat=&lng=`                                                                                            |
| Directorio (home)        | `app/page.tsx`                                  | `GET /api/public/directory/counts`                                                                                                         |
| Tutoriales (nav)         | `components/layout/Header.tsx` → `/tutoriales`  | Página SSR esperada: `app/tutoriales/page.tsx` (**MISSING**). Legacy también usa `GET /api/tutorials` / admin ` /api/admin/tutorials`      |
| Blog                     | `app/blog/page.tsx`                             | Server: `lib/blog/public-queries` → Prisma `BlogPost` / categorías                                                                         |

**Existencia en monorepo vs legacy**

| Ruta                               | Monorepo `5101185` | Legacy Desktop |
| ---------------------------------- | ------------------ | -------------- |
| `app/api/public/albums/route.ts`   | Sí                 | Sí             |
| `app/api/public/events/route.ts`   | **No**             | **Sí**         |
| `app/tutoriales/page.tsx`          | **No**             | **Sí**         |
| `app/api/tutorials/route.ts`       | **No**             | **Sí**         |
| `app/api/admin/tutorials/route.ts` | Sí                 | Sí             |

`lib/public-slugs.ts` reserva `"tutoriales"`, pero sin página dedicada el catch-all `[handler]` captura el path.

---

## 5. Detalle por fallo

### 5.1 Login — `POST /api/auth/login`

| Campo                  | Valor                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| Ruta                   | `/api/auth/login`                                                                                               |
| Error exacto (API)     | `"Error en el login"` + detail Prisma: _Authentication failed against database server… credentials … not valid_ |
| Código Prisma `P20xx`  | **No** (fallo de inicialización/auth, no schema)                                                                |
| Tabla/columna faltante | N/A en este deployment (no llega a query exitosa)                                                               |
| Env faltante           | No ausente: `DATABASE_URL` / `DIRECT_URL` **presentes** pero **credenciales inválidas** hacia `ep-empty-moon`   |
| Tipo                   | **Configuración Vercel (DB preview)**                                                                           |

### 5.2 Home álbumes — `GET /api/public/albums`

| Campo         | Valor                                                                          |
| ------------- | ------------------------------------------------------------------------------ |
| Ruta          | `/api/public/albums`                                                           |
| Error exacto  | `"Error obteniendo álbumes"` + mismo detail de auth Prisma en `album.findMany` |
| Código Prisma | No `P20xx`                                                                     |
| Tabla/columna | N/A ahora                                                                      |
| Env           | Misma DB inválida                                                              |
| Tipo          | **Configuración Vercel (DB)**                                                  |

_Post-fix (secundario, en DB DNX-MCP `ep-round-fog`):_ la ruta referencia `isTest`; esa columna **no existe** ahí. Tras apuntar preview a `ep-round-fog` puede aparecer `P2022` hasta migrar o ajustar query. `photographerId` no está en schema (se usa `userId`).

### 5.3 Buscador — `GET /api/public/events`

| Campo        | Valor                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| Ruta         | `/api/public/events`                                                                                              |
| Error exacto | HTTP **404** HTML (`x-matched-path: /404`). UI: «Error al buscar. Probá de nuevo.» al parsear no-JSON / `!res.ok` |
| Prisma       | N/A                                                                                                               |
| Tipo         | **Código** (ruta no migrada)                                                                                      |

### 5.4 Tutoriales — `/tutoriales` (+ `/api/tutorials`)

| Campo        | Valor                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------- |
| Ruta         | `/tutoriales` (matched `/[handler]`); `/api/tutorials` → `/404`                                     |
| Error exacto | **404** / error page Next                                                                           |
| Prisma       | N/A para abrir la ruta                                                                              |
| Seed         | En `ep-round-fog`, `SystemSettings` key `tutorials_videos` = **ausente** (página vacía tras portar) |
| Tipo         | **Código** (página/API faltantes)                                                                   |

### 5.5 Blog — `GET /blog`

| Campo          | Valor                                                      |
| -------------- | ---------------------------------------------------------- |
| Ruta           | `/blog`                                                    |
| Error exacto   | **500** HTML `__next_error__` (SSR Prisma contra misma DB) |
| Prisma `P20xx` | No observado en body HTML; causa alineada a auth DB        |
| Tipo           | **Configuración Vercel (DB)**                              |

---

## 6. Auditoría env preview (solo nombres / fingerprints seguros)

| Variable              | Target   | Presente | Fingerprint / host seguro                                                                                              |
| --------------------- | -------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | preview  | Sí       | fp `e5e1726b471a` · endpoint `ep-empty-moon-ad4teeyd-pooler.c-2.us-east-1.aws.neon.tech` · db `neondb` · pooler **sí** |
| `DIRECT_URL`          | preview  | Sí       | fp `cd4780d9adce` · endpoint `ep-empty-moon-ad4teeyd.c-2.us-east-1.aws.neon.tech` · db `neondb` · pooler **no**        |
| `AUTH_URL`            | preview  | Sí       | `https://compramelafoto.staging.dnxsuite.com` · fp `795a99acec25`                                                      |
| `APP_URL`             | preview  | Sí       | igual que `AUTH_URL`                                                                                                   |
| `NEXT_PUBLIC_APP_URL` | preview  | Sí       | igual                                                                                                                  |
| `COOKIE_DOMAIN`       | preview  | Sí       | `.staging.dnxsuite.com` · fp `bc4a36058540`                                                                            |
| `AUTH_SECRET`         | preview  | Sí       | presente (solo fp interno; no secret)                                                                                  |
| Bypass automation     | proyecto | Sí       | fp `bd642828958d` · scope `automation-bypass`                                                                          |

### ¿Misma instancia Neon que DNX-MCP?

| Fuente                                                                       | Endpoint (sin secretos)                        | ¿Misma instancia?                    |
| ---------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------ |
| Vercel preview `DATABASE_URL` / `DIRECT_URL`                                 | `ep-empty-moon-ad4teeyd` (+ `-pooler` en pool) | Entre sí: **sí** (mismo branch Neon) |
| DNX-MCP `.env.local` (`DATABASE_URL` / `DIRECT_URL` / `POSTGRES_READONLY_…`) | `ep-round-fog-a4xgibtv`                        | **No** — distinta de preview         |

Conexión directa de diagnóstico a URLs preview Vercel:

```text
password authentication failed for user 'neondb_owner'  (SQLSTATE 28P01)
```

Coincide con el error Prisma del runtime. **Las credenciales guardadas en Vercel preview no autentican** contra ese host (password rotado / URL stale / branch recreado).

`AUTH_URL` / `APP_URL` / `COOKIE_DOMAIN` apuntan al custom domain staging (`compramelafoto.staging.dnxsuite.com` / `.staging.dnxsuite.com`), no al hostname `*.vercel.app` del preview. Eso puede afectar cookies/auth en el hostname de deployment, pero **no** explica el 500 de Prisma auth en login/albums/blog.

---

## 7. Verificación DB

### 7.1 Neon preview Vercel (`ep-empty-moon`)

| Check                                  | Resultado                     |
| -------------------------------------- | ----------------------------- |
| Conexión `DIRECT_URL` / `DATABASE_URL` | **Fallo** `28P01`             |
| User / Album / Photo / BlogPost seed   | **No verificable** (sin auth) |
| Columnas Prisma                        | **No verificable**            |

### 7.2 Neon DNX-MCP staging (`ep-round-fog`) — referencia del seed

| Check              | Resultado                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| User seed          | **Sí** — `fotografo.staging@clf.dnx.test` (PHOTOGRAPHER), `admin.staging@clf.dnx.test` (ADMIN), password + `emailVerifiedAt` |
| Album seed         | **Sí** — `staging-clf-demo-album` · público · `coverPhotoId=1`                                                               |
| Photo seed         | **Sí** — 3 filas `staging/clf-minimal-v1/photo-0N.jpg`                                                                       |
| BlogPost seed      | **Sí** — `staging-clf-bienvenida` · `PUBLISHED` · `noIndex=true`                                                             |
| Tutorials settings | **No** — sin row `tutorials_videos`                                                                                          |

Columnas esperadas vs presentes en `ep-round-fog`:

| Tabla      | Faltantes relevantes                             | Presentes clave                                 |
| ---------- | ------------------------------------------------ | ----------------------------------------------- |
| `User`     | `cuantoCobroUser`                                | `id,email,password,role,emailVerifiedAt,tags,…` |
| `Album`    | `isTest`, `photographerId` (modelo usa `userId`) | `isPublic,isHidden,coverPhotoId,publicSlug,…`   |
| `Photo`    | —                                                | `originalKey,previewUrl,isRemoved,…`            |
| `BlogPost` | —                                                | `slug,status,noIndex,publishedAt,…`             |

---

## 8. Mapa causa → síntoma UI

```text
Bypass OK
  ├─ POST /api/auth/login ──► Prisma auth fail (empty-moon) ──► "Error en el login"
  ├─ GET  /api/public/albums ► Prisma auth fail ──────────────► home sin álbumes
  ├─ GET  /api/public/events ► 404 (ruta missing) ────────────► "Error al buscar…"
  ├─ GET  /tutoriales ───────► [handler] 404 (página missing) ► tutoriales no abren
  └─ GET  /blog ─────────────► SSR Prisma auth fail ──────────► 500
```

---

## 9. Orden de remediación sugerido (no aplicado)

1. **Env preview:** alinear `DATABASE_URL` + `DIRECT_URL` a la Neon staging operativa (`ep-round-fog…` según DNX-MCP) **o** regenerar credenciales de `ep-empty-moon` y actualizar ambas vars. Redeploy preview.
2. **Código:** portar `api/public/events` y `tutoriales` (+ API pública si aplica) desde legacy; redeploy.
3. **Post-DB:** si aparece `P2022` por `Album.isTest` / gaps, plan de migración staging (fuera de este diagnóstico).
4. **Opcional:** seed `tutorials_videos`; revisar `COOKIE_DOMAIN`/`AUTH_URL` vs hostname `*.vercel.app` para cookies de sesión en preview puro.

---

## 10. Tabla final pedida

| Función                  | Causa raíz                                                                 | Fix mínimo                                   | Requiere migración | Requiere redeploy |
| ------------------------ | -------------------------------------------------------------------------- | -------------------------------------------- | ------------------ | ----------------- |
| Login                    | Credenciales DB preview inválidas (`ep-empty-moon`, `28P01` / Prisma auth) | Corregir `DATABASE_URL`+`DIRECT_URL` preview | No                 | Sí                |
| Home (álbumes)           | Idem Prisma auth en `/api/public/albums`                                   | Idem env/DB                                  | No*                | Sí                |
| Buscador eventos/álbumes | Ruta `/api/public/events` ausente en monorepo                              | Portar route desde legacy                    | No                 | Sí                |
| Tutoriales               | Página `/tutoriales` (y API) ausentes; catch-all `[handler]`               | Portar página/API; opcional seed videos      | No                 | Sí                |
| Blog                     | Idem Prisma auth en SSR `/blog`                                            | Idem env/DB                                  | No                 | Sí                |

\*Tras apuntar a `ep-round-fog`, posible `P2022` por `isTest` en query de álbumes → ahí sí migración o ajuste de código.

---

_Diagnóstico de solo lectura. No se modificó producción, DNS, env Vercel, ni se ejecutaron migraciones/deploys._
