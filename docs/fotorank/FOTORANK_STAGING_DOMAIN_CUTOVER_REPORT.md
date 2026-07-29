# FotoRank Staging — informe de dominio / cutover (10B.6.3)

**Fecha:** 2026-07-29  
**Etapa:** 10B.6.3  
**Branch:** `migration-legacy-clf-to-monorepo`

## Veredicto

```text
DNX UNIVERSAL ACCOUNT READY IN STAGING
```

Sub-estado dominio FotoRank:

```text
FOTORANK SOURCE DOMAIN EMPTY — NO IMPORT REQUIRED
```

No se ejecutó import de concursos desde `ep-empty-moon…` (endpoint inaccesible / clasificado disposable).  
Las tablas de dominio FotoRank existen en `ep-round-fog…` vía migraciones versionadas (`prisma migrate deploy`); conteos de dominio = 0.

---

## Destino

| Campo | Valor sanitizado |
| ----- | ---------------- |
| Proyecto Neon | `fragrant-union-80829821` (dnx-suite-staging) |
| Endpoint | `ep-round-fog-a4xgibtv…` (+ pooler) |
| Database | `neondb` |
| Rol en suite | `DNX_STAGING_IDENTITY_DATABASE` (identidad + dominio apps) |

Production FotoRank (`ep-dawn-dew…`) **no** se modificó.

---

## Backups

| Nombre | Branch | Endpoint | Notas |
| ------ | ------ | -------- | ----- |
| `backup-before-identity-cutover` | `br-polished-night-…` | `ep-winter-unit…` | Pre-cutover Clickatón (etapa previa) |
| `backup-before-clickaton-import` | `br-patient-breeze-…` | `ep-purple-dawn…` | Pre-import Clickatón |
| `backup-before-fotorank-import` | `br-rough-base-a482gvuw` | `ep-misty-lake-a4hzpxra…` | Pre-trabajo dominio FotoRank 10B.6.3 |

Origen empty-moon: **sin backup API** (host no visible en org Neon Dnx). Justificado por clasificación `IDENTITY_ONLY_OR_DISPOSABLE` — ver `FOTORANK_PREVIEW_DATABASE_DISCOVERY.md`.

---

## Inventario dominio en round-fog (post-migración)

| Entidad | Cantidad |
| ------- | -------: |
| Contests (`FotorankContest`) | 0 |
| Entries (`FotorankContestEntry` / assets) | 0 / 0 |
| Participants | 0 |
| Judges (`FotorankJudgeProfile` / accounts) | 0 / 0 |
| Jury assignments | 0 |
| Categories (contest / global) | 0 / 0 |
| Rules versions | 0 |
| Scores / jury evaluations | 0 |
| Results batches | 0 |
| Profiles FotoRank | 0 |
| Organizations (tabla dedicada FR) | n/a (0 memberships) |

### Identidad compartida (misma DB)

| Entidad | Cantidad |
| ------- | -------: |
| `User` | 26 |
| `UserSession` | 40 |
| `UserIdentityAlias` | 0 |
| Clickatón Editions | 6 |
| Clickatón Registrations | 11 |

Separación:

- **Identidad** → `User` / sesiones DNX (`@repo/auth`).  
- **Dominio FotoRank** → tablas `Fotorank*` propias sobre la DB compartida (vacías en Staging, listas para uso).

No se importaron passwords, sesiones legacy ni OAuth tokens desde empty-moon (no hubo origen).

---

## Schema / build

| Paso | Resultado |
| ---- | --------- |
| Drift jury/rules | Corregido — ver `FOTORANK_SCHEMA_CLIENT_DRIFT_AUDIT.md` |
| `prisma generate` | OK |
| Typecheck FotoRank | 0 errores |
| Build local | PASS |
| Build Vercel Preview | READY |

### Runtime 500 (post-build)

Causa: `"type": "module"` en `apps/fotorank/package.json` → `ERR_REQUIRE_ESM` (`___next_launcher.cjs` require de `page.js`/`route.js`).  
Fix: mismo patrón que CLF — eliminar `type: module`; `next.config.ts` + `eslint.config.mjs`.  
Commit: `f308683`.

---

## Deploy Preview / Staging

| Campo | Valor |
| ----- | ----- |
| Commit | `f308683` |
| Deploy ID | `dpl_DLpvW5PN5vjihaMvBYGGoXyyJbbQ` |
| Alias | `https://fotorank.staging.dnxsuite.com` |
| DB host (health) | `ep-round-fog-a4xgibtv-pooler` |
| Health | `ok:true` — users>0, fotorankContests=0, clickatonEditions=6 |

### Smoke HTTP (no destructivo)

| Ruta | HTTP |
| ---- | ---: |
| `/` | 200 |
| `/login` | 200 |
| `/crear-cuenta` | 200 |
| `/recuperar` | 200 |
| `/jurado/login` | 200 |
| `/jurado/panel` | 200 |
| `/jurados` | 200 |
| `/concursos` | 200 |
| `/participaciones` | 200 |
| `/ranking` | 200 |
| `/api/public/health/db` | 200 |
| `/api/public/v1/events` | 200 (`items: []`) |
| `/api/auth/google` | redirect a Google accounts |

---

## Variables Preview

| Variable | Staging / Preview |
| -------- | ----------------- |
| `DATABASE_URL` / `DIRECT_URL` | `ep-round-fog…` |
| `APP_URL` / `NEXT_PUBLIC_APP_URL` / `AUTH_URL` | `https://fotorank.staging.dnxsuite.com` |
| Production URLs / dawn-dew | Intactas |

---

## Auth-UI

**No** se hizo rollout de `@repo/auth-ui` en esta etapa.  
Pendiente: `ETAPA 10B.7.1 — ROLLOUT AUTH-UI COMPRAMELAFOTO MONOREPO + CLICKATÓN + FOTORANK`.

---

## Controles

| Control | Estado |
| ------- | ------ |
| Re-cutover Clickatón | No ejecutado |
| Production | No tocada |
| `prisma db push` | No usado |
| Import empty-moon | No requerido |
| Concursos LIVE | No alterados (Staging sin contests) |
