# ComprameLaFoto — Checklist de configuración para staging

Checklist operativo derivado del [dry-run seguro](./compramelafoto-release-dry-run.md) (2026-07-06), actualizado tras configurar el **monorepo dnx-suite** en `.env.local`.

Objetivo: habilitar **staging real** en Vercel y obtener **GO** en `release_validate` — sin deploy a producción en esta fase.

**Plataforma:** `compramelafoto` · **Proyecto Vercel:** `compramelafoto` · **Monorepo:** `dnx-suite` en `/Volumes/HD DNX 10/PROGRAMACIONES/dnx-suite`

---

## Estado actual (dry-run monorepo — 2026-07-06)

| Área                  | Estado                                                             | Bloquea GO                |
| --------------------- | ------------------------------------------------------------------ | ------------------------- |
| `.env.local` + dotenv | Carga automática al iniciar MCP (`quiet: true`)                    | —                         |
| Git                   | Repo monorepo OK; puede timeout si el HD externo está lento (~30s) | Parcial                   |
| Prisma binary         | Ruta real en `packages/db/node_modules/.bin/prisma`                | **No** (binary OK)        |
| Prisma validate       | Falla por `DIRECT_URL` / `DATABASE_URL` no en env MCP              | Sí (schema inválido)      |
| Vercel                | Sin `VERCEL_TOKEN` — sin API                                       | Sí (staging no auditable) |
| PostgreSQL            | `POSTGRES_READONLY_DATABASE_URL` vacío                             | Sí                        |
| DNX Brain             | `shouldBlock: true` mientras PG/Prisma bloqueen                    | **Sí**                    |

Decisión actual: **NO-GO** (esperado hasta completar env y conectividad).

---

## 1. Variables DNX-MCP

El servidor carga automáticamente `.env` y `.env.local` al arrancar (ver `src/config/bootstrap-env.ts`).  
`.env.local` está en `.gitignore` — crearlo en la raíz de `dnx-mcp`.

Referencia: `.env.example` + plantilla monorepo abajo.

### Obligatorias para dry-run monorepo

| Variable                    | Descripción                       | Valor ComprameLaFoto (monorepo)               |
| --------------------------- | --------------------------------- | --------------------------------------------- |
| `GIT_REPO_PATH`             | Raíz del monorepo git             | `/Volumes/HD DNX 10/PROGRAMACIONES/dnx-suite` |
| `GIT_DEFAULT_BRANCH`        | Rama de release                   | `main`                                        |
| `PRISMA_SCHEMA_PATH`        | Schema Prisma                     | `.../packages/db/prisma/schema.prisma`        |
| `PRISMA_MIGRATIONS_PATH`    | Migraciones                       | `.../packages/db/prisma/migrations`           |
| `PRISMA_BINARY`             | Ejecutable prisma (ruta absoluta) | `.../packages/db/node_modules/.bin/prisma`    |
| `POSTGRES_QUERY_TIMEOUT_MS` | Timeout assess PG                 | `10000`                                       |

### Placeholders (vacíos hasta staging real)

| Variable                         | Descripción                 |
| -------------------------------- | --------------------------- |
| `VERCEL_TOKEN`                   | Token API Vercel            |
| `VERCEL_TEAM_ID`                 | ID del team                 |
| `VERCEL_TEAM_SLUG`               | Slug del team               |
| `POSTGRES_READONLY_DATABASE_URL` | URL solo lectura PostgreSQL |

### Prisma + schema del monorepo

El `schema.prisma` de `packages/db` referencia `env("DATABASE_URL")` y `env("DIRECT_URL")`.  
Para que `prisma validate` pase desde MCP, esas variables deben existir en el proceso (copiar desde el `.env` del monorepo o definirlas en `.env.local` **sin commitear**).

> **No usar** `PRISMA_BINARY=pnpm prisma` — el executor requiere un único ejecutable (`spawn` sin shell).

### Descubrir `PRISMA_BINARY`

```bash
find "/Volumes/HD DNX 10/PROGRAMACIONES/dnx-suite" -path "*node_modules/.bin/prisma" -type f
```

Resultado esperado:

```text
/Volumes/HD DNX 10/PROGRAMACIONES/dnx-suite/packages/db/node_modules/.bin/prisma
```

### Plantilla `.env.local` (sin secretos)

```bash
NODE_ENV=development
LOG_LEVEL=info

GIT_REPO_PATH="/Volumes/HD DNX 10/PROGRAMACIONES/dnx-suite"
GIT_DEFAULT_BRANCH=main

PRISMA_SCHEMA_PATH="/Volumes/HD DNX 10/PROGRAMACIONES/dnx-suite/packages/db/prisma/schema.prisma"
PRISMA_MIGRATIONS_PATH="/Volumes/HD DNX 10/PROGRAMACIONES/dnx-suite/packages/db/prisma/migrations"
PRISMA_BINARY="/Volumes/HD DNX 10/PROGRAMACIONES/dnx-suite/packages/db/node_modules/.bin/prisma"

POSTGRES_QUERY_TIMEOUT_MS=10000
POSTGRES_READONLY_DATABASE_URL=

VERCEL_TOKEN=
VERCEL_TEAM_ID=
VERCEL_TEAM_SLUG=

# Opcional: copiar desde dnx-suite/.env para prisma validate (no commitear)
# DATABASE_URL=
# DIRECT_URL=
```

### Opcionales / diagnóstico

| Variable    | Descripción                    |
| ----------- | ------------------------------ |
| `LOG_LEVEL` | `info` o `debug` durante setup |
| `NODE_ENV`  | `development`                  |

---

## 2. Variables Vercel staging

Variables en el **proyecto Vercel** `compramelafoto`, entorno **Preview** (staging).  
Deben alinearse entre preview y lo que el release orchestrator audita.

### Proyecto y dominios (Platform Catalog)

| Concepto                           | Valor                                             |
| ---------------------------------- | ------------------------------------------------- |
| Proyecto Vercel                    | `compramelafoto`                                  |
| Preview / staging                  | `preview.compramelafoto.com`                      |
| Producción (no tocar en esta fase) | `compramelafoto.com`, `www.compramelafoto.com`    |
| Health API prod (referencia)       | `https://compramelafoto.com/api/health`           |
| Smoke tests staging                | `https://preview.compramelafoto.com`, `/checkout` |

### Variables de entorno Preview (checklist)

Marcar cuando estén definidas y verificadas en Vercel → Project → Settings → Environment Variables → **Preview**:

| Variable                         | Requerida staging     | Notas                                                        |
| -------------------------------- | --------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`                   | Sí                    | BD de staging/preview (no prod si se separan)                |
| `REDIS_URL`                      | Sí                    | Prefijo app `cmlf:`                                          |
| `NEXTAUTH_URL` / URL pública     | Sí                    | Debe apuntar a preview                                       |
| `GMAIL_SENDER`                   | Si email activo       | Platform catalog: Gmail enabled                              |
| Google OAuth (`GOOGLE_*`)        | Si login Google       | Scopes: openid, email, profile                               |
| Mercado Pago                     | Si checkout staging   | Webhook `/api/webhooks/mercadopago`                          |
| R2 / assets                      | Si uploads en staging | Bucket `cmlf-assets`                                         |
| Secrets compartidos prod/preview | Revisar               | `vercel_prepare_staging` reporta `changed` / `onlyInPreview` |

### Criterios Vercel para GO

- [ ] Deployment **preview** activo y `READY`
- [ ] Dominio `preview.compramelafoto.com` verificado
- [ ] Sin issues de entorno entre preview y production (o documentados y aceptados)
- [ ] `vercel_validate_staging` → `passed: true` con `dryRun: false`

---

## 3. Correcciones antes de staging

Acciones derivadas del dry-run. Completar **antes** de `release_*` con `dryRun: false`.

### Crítico — Prisma (binary + env del schema)

- [x] `PRISMA_BINARY` apunta al ejecutable real (`packages/db/node_modules/.bin/prisma`)
- [x] DNX-MCP carga `.env.local` al iniciar (dotenv, `quiet: true`)
- [ ] Definir `DATABASE_URL` y `DIRECT_URL` en `.env.local` (copiar desde monorepo `.env`) para `prisma validate`
- [ ] Confirmar `prisma validate` exitoso desde MCP (`schemaValid: true` en `release_prepare`)

### Crítico — PostgreSQL

- [ ] Confirmar que `POSTGRES_READONLY_DATABASE_URL` (o `DATABASE_URL`) conecta desde el host MCP
  - Probar: `assessReleaseReadiness` debe devolver `connected: true`
- [ ] Verificar tabla `_prisma_migrations` en schema `public`
- [ ] Resolver SSL/red si aparece warning de `pg` (usar `sslmode=verify-full` o `require` según proveedor)
- [ ] Sin queries de larga duración ni locks bloqueantes en el momento del release

### Alto — Prisma (formato)

- [ ] Ejecutar en el monorepo:

```bash
cd "/Volumes/HD DNX 10/PROGRAMACIONES/dnx-suite"
pnpm --filter @dnx/db exec prisma format
pnpm --filter @dnx/db exec prisma validate
```

- [ ] Confirmar `formatDrift: false` en `release_prepare`

### Medio — Git

- [ ] Repo en `GIT_REPO_PATH` accesible (HD externo despierto; git puede timeout >30s si está lento)
- [ ] Configurar upstream en rama de trabajo si aplica

### Vercel — habilitar auditoría real

- [ ] `VERCEL_TOKEN` configurado en MCP
- [ ] Reiniciar servidor MCP tras cargar variables
- [ ] Ya no usar mock invoker — el orchestrator debe llamar API real en `dryRun: false`

### Opcional — higiene

- [ ] Documentar aceptación de 169 migraciones locales (informativo, no bloqueante si no hay pendientes)
- [ ] Revisar `maintenanceMode.enabled: false` en platform catalog

---

## 4. Checklist GO / NO-GO

Usar tras `release_validate` con `dryRun: false` (staging real auditado).

### GO — todos deben cumplirse

| #   | Criterio              | Campo / señal                                                         |
| --- | --------------------- | --------------------------------------------------------------------- |
| 1   | Decisión orchestrator | `decision: "GO"`                                                      |
| 2   | Brain no bloquea      | `brain.shouldBlock: false`                                            |
| 3   | Brain score           | `brain.score` ≥ 60 (validate)                                         |
| 4   | Listo para validar    | `readyForValidation: true` (prepare)                                  |
| 5   | Vercel staging        | `validation.passed: true`, `stagingReady: true`                       |
| 6   | Git                   | `git.blockers: []`, `riskLevel` ≠ `high`                              |
| 7   | Prisma                | `schemaValid: true`, `pendingMigrations: []`, `formatDrift: false`    |
| 8   | PostgreSQL            | `connected: true`, `migrationTableExists: true`, `riskLevel` ≠ `high` |
| 9   | Sin bloqueos PG       | `postgres.blockers: []`, sin long queries ni locks críticos           |
| 10  | Ejecución permitida   | `canExecute: true`                                                    |

### NO-GO — cualquiera dispara stop

| #   | Condición                                                   | Fuente                         |
| --- | ----------------------------------------------------------- | ------------------------------ |
| 1   | `decision: "NO-GO"`                                         | Orchestrator                   |
| 2   | `brain.shouldBlock: true`                                   | DNX Brain                      |
| 3   | `postgres.connected: false`                                 | PostgreSQL provider            |
| 4   | `migrationTableExists: false`                               | PostgreSQL / orchestrator gate |
| 5   | `postgres.riskLevel: high` o `blockers` no vacío            | PostgreSQL                     |
| 6   | `prisma.schemaValid: false` o migraciones pendientes        | Prisma                         |
| 7   | `git.dirtyTree` o `unpushedCommits > 0` o rama no permitida | Git                            |
| 8   | Validación Vercel fallida o `issues.length > 0`             | Vercel                         |
| 9   | Modo mantenimiento activo                                   | Platform catalog               |
| 10  | Dominios preview sin verificar                              | Vercel staging                 |

### Matriz rápida (estado dry-run → objetivo)

| Señal                  | Dry-run monorepo               | Objetivo staging        |
| ---------------------- | ------------------------------ | ----------------------- |
| `PRISMA_BINARY`        | Ruta absoluta en `packages/db` | Igual                   |
| `prisma.schemaValid`   | `false` (falta `DIRECT_URL`)   | `true`                  |
| `postgres.connected`   | N/A (no configurado)           | `true`                  |
| `migrationTableExists` | N/A                            | `true`                  |
| `vercel`               | Sin token                      | API real, preview READY |
| `decision`             | NO-GO                          | GO                      |

---

## 5. Comandos dryRun (MCP tools)

Usar desde Cursor / cliente MCP conectado a `dnx-mcp`.  
Por defecto **no despliegan** (`dryRun: true`, `confirm: false`).

### `release_prepare`

```json
{
  "platformId": "compramelafoto"
}
```

Equivalente explícito:

```json
{
  "platformId": "compramelafoto",
  "dryRun": true
}
```

**Esperado en dryRun:** `success: true`, secciones `vercel`, `git`, `prisma`, `postgres`, `brain`, `plan`.  
**Revisar:** `blocked`, `readyForValidation`, `brain.recommendation`.

---

### `release_validate`

```json
{
  "platformId": "compramelafoto"
}
```

Equivalente explícito:

```json
{
  "platformId": "compramelafoto",
  "dryRun": true
}
```

**Esperado tras correcciones (aún en dryRun):** estructura completa con `decision`, `blocked`, `canExecute`.  
**Nota:** en dryRun el Brain puede penalizar score; para decisión GO real usar `dryRun: false` cuando Vercel y PG estén configurados.

---

### `release_execute` (solo simulación — sin deploy)

```json
{
  "platformId": "compramelafoto"
}
```

Equivalente explícito:

```json
{
  "platformId": "compramelafoto",
  "dryRun": true,
  "confirm": false
}
```

**Esperado:** `executed: false` o deploy simulado, **sin** cambios en producción.  
**No usar** hasta tener `release_validate` → GO con `dryRun: false`.

---

### Secuencia recomendada durante setup

```
1. Completar secciones 1–3 de este checklist
2. release_prepare  { "platformId": "compramelafoto" }           # dryRun default
3. release_validate { "platformId": "compramelafoto" }           # dryRun default
4. Si blocked → corregir y repetir
5. release_prepare  { "platformId": "compramelafoto", "dryRun": false }
6. release_validate { "platformId": "compramelafoto", "dryRun": false }
7. Si GO → release_execute { "platformId": "compramelafoto" }    # sigue siendo simulación
```

### Cuándo NO usar dryRun (fuera de este checklist)

| Tool               | Input                                  | Efecto                                               |
| ------------------ | -------------------------------------- | ---------------------------------------------------- |
| `release_execute`  | `{ "dryRun": false, "confirm": true }` | **Deploy producción** — no ejecutar en setup staging |
| `release_rollback` | `{ "dryRun": false, "confirm": true }` | **Rollback real** — no ejecutar en setup staging     |

---

## Referencias

- [ComprameLaFoto release dry-run](./compramelafoto-release-dry-run.md)
- [MCP Tools — Release](../tools/release.md)
- [Release Orchestrator](../architecture/release-orchestrator.md)
- Platform catalog: `compramelafoto` en `src/platforms/platforms/compramelafoto.ts`
