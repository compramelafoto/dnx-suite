# ComprameLaFoto — Configuración de base de datos para staging (DNX-MCP)

**Fecha:** 2026-07-07  
**Plataforma:** `compramelafoto`  
**Monorepo:** `dnx-suite` → `packages/db/prisma/schema.prisma`  
**Estado Git:** desbloqueado (working tree limpio, rama `migration-legacy-clf-to-monorepo` permitida)  
**Bloqueo pendiente:** Prisma `schemaValid: false` + PostgreSQL no configurado  
**Relacionado:** [`compramelafoto-release-blockers-plan.md`](./compramelafoto-release-blockers-plan.md)

---

## Objetivo

Documentar **qué URLs de base de datos** necesitás, **para qué sirve cada una** en DNX-MCP, y **dónde cargarlas** en `.env.local` — sin tocar producción, sin ejecutar migraciones, sin deploy.

---

## Resumen rápido

| Variable                         | ¿Obligatoria para `release_prepare`? | Uso principal                                |
| -------------------------------- | ------------------------------------ | -------------------------------------------- |
| `DATABASE_URL`                   | **Sí** (Prisma)                      | `prisma validate`, `prisma migrate status`   |
| `DIRECT_URL`                     | **Sí** (Prisma)                      | `prisma validate` (schema exige `directUrl`) |
| `POSTGRES_READONLY_DATABASE_URL` | **Recomendada**                      | Assess PostgreSQL (`postgres` provider)      |

**Archivo destino:** `dnx-mcp/.env.local` (gitignored, no commitear).

**Carga:** automática al iniciar MCP vía `src/config/bootstrap-env.ts` (`.env` + `.env.local`).

---

## 1. Las tres variables explicadas

### `DATABASE_URL`

- **Qué es:** URL principal de conexión PostgreSQL que usa Prisma.
- **Dónde la exige el monorepo:** `packages/db/prisma/schema.prisma`:

  ```prisma
  datasource db {
    provider  = "postgresql"
    url       = env("DATABASE_URL")
    directUrl = env("DIRECT_URL")
  }
  ```

- **Cómo la usa DNX-MCP:** el `PrismaExecutor` ejecuta `prisma validate` y `prisma migrate status` con `env: process.env` y `cwd: GIT_REPO_PATH`. Si `DATABASE_URL` no está en el proceso MCP, **`prisma validate` falla** y el Brain bloquea con `schemaValid: false`.

- **Qué base usar:** **staging / preview** de `compramelafoto-dnxsuite` — la misma lógica que usaría el deploy preview del monorepo.

---

### `DIRECT_URL`

- **Qué es:** conexión directa a PostgreSQL, sin pooler (requerida por Prisma cuando hay `directUrl` en el schema).
- **Cuándo difiere de `DATABASE_URL`:**
  - **Con pooler** (Neon, Supabase pooler, PgBouncer en modo transaction): `DATABASE_URL` → pooler; `DIRECT_URL` → host directo.
  - **Sin pooler** (Postgres local, RDS directo): pueden ser **la misma URL** en ambas variables.
- **Cómo la usa DNX-MCP:** igual que `DATABASE_URL` — debe existir en `process.env` para `prisma validate`.

---

### `POSTGRES_READONLY_DATABASE_URL`

- **Qué es:** URL dedicada al **Postgres Provider** de DNX-MCP (assess de salud, no Prisma CLI).
- **Resolución en código** (`src/providers/postgres/config.ts`), en orden:

  1. `POSTGRES_READONLY_DATABASE_URL`
  2. `POSTGRES_DATABASE_URL`
  3. `POSTGRES_URL`
  4. `DATABASE_URL` (fallback)

- **Qué hace el assess:** ping, versión, tamaño DB, conexiones activas, queries largas, locks, existencia de `_prisma_migrations`.
- **Si está vacía:** `postgres.isConfigured()` → `false` → `release_prepare` devuelve `postgres: null` (assess omitido).
- **Permisos recomendados:** usuario **solo lectura** (`SELECT` en `pg_catalog`, `information_schema`, tablas de monitoreo). **Sin** `INSERT`/`UPDATE`/`DELETE`/`DDL`.

---

## 2. Qué variable usar para cada check

| Operación                    | Provider / comando                          | Variables necesarias                      | Conexión real                                                                                                                   |
| ---------------------------- | ------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **`prisma validate`**        | Prisma CLI                                  | `DATABASE_URL` + `DIRECT_URL`             | No siempre (Prisma valida schema; con URLs válidas puede pasar sin conectar en algunos casos, pero el schema exige que existan) |
| **`prisma migrate status`**  | Prisma CLI                                  | `DATABASE_URL` (+ `DIRECT_URL` en schema) | **Sí** — consulta `_prisma_migrations`                                                                                          |
| **Prisma release readiness** | `PrismaProvider.assessReleaseReadiness()`   | `DATABASE_URL` + `DIRECT_URL`             | **Sí** para migrate status                                                                                                      |
| **PostgreSQL readiness**     | `PostgresProvider.assessReleaseReadiness()` | `POSTGRES_READONLY_DATABASE_URL` (ideal)  | **Sí** — solo lectura                                                                                                           |

### Comandos que DNX-MCP **nunca** ejecutará

El `PrismaExecutor` bloquea comandos mutables: `migrate deploy`, `migrate dev`, `migrate reset`, `db push`, etc.  
Configurar URLs **no dispara migraciones** — solo lectura/assess.

---

## 3. Por qué NO usar producción todavía

| Riesgo                     | Detalle                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Datos reales**           | `migrate status` y assess PG leen estado de la DB; errores de config en staging no deben interpretarse contra prod |
| **Carga en prod**          | Assess PG ejecuta queries de monitoreo (`pg_stat_activity`, locks, etc.)                                           |
| **Política de release**    | Platform Catalog: `allowedTargets: ["preview"]`, dominios productivos legacy **NO TOCAR**                          |
| **Proyecto Vercel activo** | Staging usa `compramelafoto-dnxsuite`, no el legacy `compramelafoto`                                               |
| **Fase actual**            | Solo `release_prepare` dry-run — validar pipeline antes de cualquier cutover                                       |

**Usar siempre:** base de datos de **staging / preview** asociada a `compramelafoto-dnxsuite`.

---

## 4. Dónde obtener las URLs (sin modificar Vercel)

No es necesario cambiar variables en Vercel para este paso. Solo **copiar** valores existentes de staging:

| Fuente                                                                                                                     | Qué copiar                                         |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Dashboard Vercel** → proyecto `compramelafoto-dnxsuite` → Settings → Environment Variables → **Preview** (o Development) | `DATABASE_URL`, `DIRECT_URL` si existen            |
| **`.env` local del monorepo** (`dnx-suite/.env` o `apps/compramelafoto/.env.local`)                                        | Si ya apuntan a staging                            |
| **Proveedor DB** (Neon, Supabase, RDS)                                                                                     | Connection string del branch/instancia **staging** |
| **Equipo**                                                                                                                 | Credenciales readonly de staging si existen        |

> Si solo tenés URL de producción disponible, **detenerse** y provisionar staging antes de continuar.

### Formato esperado

```bash
# PostgreSQL estándar
postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require

# Neon (ejemplo con pooler + direct)
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/db?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/db?sslmode=require"
```

---

## 5. Cómo cargarlo en `.env.local` de DNX-MCP

**Archivo:** `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/services/dnx-mcp/.env.local`  
**No commitear.** Ya está en `.gitignore`.

### Bloque a añadir (plantilla — reemplazar `****`)

```bash
# --- Prisma (staging compramelafoto-dnxsuite) ---
# Copiar desde Vercel Preview o .env staging del monorepo.
# NO usar URLs de producción.

DATABASE_URL="postgresql://staging_user:****@staging-host.example.com:5432/dnx_staging?sslmode=require"
DIRECT_URL="postgresql://staging_user:****@staging-host.example.com:5432/dnx_staging?sslmode=require"

# --- PostgreSQL assess (solo lectura) ---
# Idealmente usuario readonly distinto; puede ser la misma URL staging si solo tiene SELECT.

POSTGRES_READONLY_DATABASE_URL="postgresql://readonly:****@staging-host.example.com:5432/dnx_staging?sslmode=require"

# Ya configurado (no cambiar):
# POSTGRES_QUERY_TIMEOUT_MS=10000
# PRISMA_SCHEMA_PATH=.../packages/db/prisma/schema.prisma
# PRISMA_BINARY=.../packages/db/node_modules/.bin/prisma
# GIT_REPO_PATH=.../dnx-suite
```

### Reglas

| Regla                                              | Motivo                                             |
| -------------------------------------------------- | -------------------------------------------------- |
| Sin comillas rotas ni espacios al final            | `spawn` de Prisma hereda `process.env` tal cual    |
| Misma DB staging para las tres (o readonly subset) | Coherencia entre Prisma migrate status y PG assess |
| Reiniciar proceso MCP tras editar                  | `dotenv` carga al arranque                         |
| No commitear `.env.local`                          | Secretos                                           |

### Verificación manual (antes de `release_prepare`)

```bash
cd "/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/services/dnx-mcp"

# Cargar env como MCP
node --import tsx/esm -e "
import './src/config/bootstrap-env.ts';
console.log('DATABASE_URL set:', Boolean(process.env.DATABASE_URL));
console.log('DIRECT_URL set:', Boolean(process.env.DIRECT_URL));
console.log('POSTGRES_READONLY set:', Boolean(process.env.POSTGRES_READONLY_DATABASE_URL));
"

# Prisma validate directo (mismo binary que MCP)
cd "/Volumes/HD DNX 10/PROGRAMACIONES/dnx-suite"
export DATABASE_URL="..."   # o cargar desde .env.local del MCP en la misma shell
export DIRECT_URL="..."
packages/db/node_modules/.bin/prisma validate --schema packages/db/prisma/schema.prisma

# Migrate status (solo lectura — NO aplica migraciones)
packages/db/node_modules/.bin/prisma migrate status --schema packages/db/prisma/schema.prisma
```

---

## 6. Volver a ejecutar `release_prepare` (dryRun)

Tras configurar `.env.local` y verificar `prisma validate`:

### Desde handler local (mismo que MCP)

```bash
cd "/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/services/dnx-mcp"

node --import tsx/esm -e "
import './src/config/bootstrap-env.ts';
import { handleReleasePrepare } from './src/tools/release/release-prepare.ts';

const result = await handleReleasePrepare({
  platformId: 'compramelafoto',
  dryRun: true,
});

console.log(JSON.stringify({
  blocked: result.blocked,
  readyForValidation: result.readyForValidation,
  git: { dirtyTree: result.git?.dirtyTree, blockers: result.git?.blockers },
  prisma: { schemaValid: result.prisma?.schemaValid, blockers: result.prisma?.blockers },
  postgres: result.postgres ? { connected: result.postgres.connected, blockers: result.postgres.blockers } : null,
  brain: { score: result.brain?.score, shouldBlock: result.brain?.shouldBlock },
}, null, 2));
"
```

### Input MCP equivalente

```json
{
  "platformId": "compramelafoto",
  "dryRun": true
}
```

### Resultado esperado tras configurar DB staging

| Campo                | Antes          | Objetivo                               |
| -------------------- | -------------- | -------------------------------------- |
| `git.dirtyTree`      | `false`        | `false`                                |
| `git.blockers`       | `[]`           | `[]`                                   |
| `prisma.schemaValid` | `false`        | **`true`**                             |
| `postgres`           | `null`         | objeto con `connected: true`           |
| `brain.shouldBlock`  | `true`         | **`false`** (si no hay otros bloqueos) |
| `readyForValidation` | `false`        | **`true`**                             |
| Vercel               | `dryRun: true` | sin cambio — **no toca API real**      |

---

## 7. Matriz de decisión

| Escenario                               | `DATABASE_URL` / `DIRECT_URL` | `POSTGRES_READONLY_DATABASE_URL` | ¿Alcanza para prepare?                               |
| --------------------------------------- | ----------------------------- | -------------------------------- | ---------------------------------------------------- |
| Solo dummy local (`127.0.0.1`)          | URLs sintácticas              | vacío                            | Parcial — validate puede pasar, migrate status falla |
| Staging real (misma URL)                | URLs staging                  | misma URL readonly               | **Sí** (recomendado)                                 |
| Staging + usuario readonly dedicado     | URLs staging (app user)       | URL readonly                     | **Sí** (ideal)                                       |
| Solo `POSTGRES_READONLY` sin Prisma env | vacío                         | staging                          | **No** — Prisma sigue bloqueando                     |
| Producción                              | URLs prod                     | —                                | **No usar** en esta fase                             |

---

## 8. Qué NO hacer en esta fase

| Acción                              | Motivo                                    |
| ----------------------------------- | ----------------------------------------- |
| `prisma migrate deploy` / `db push` | Fuera de alcance; executor MCP lo bloquea |
| Apuntar a DB de producción          | Riesgo y política de staging              |
| Modificar variables en Vercel       | No necesario para assess local            |
| Deploy preview o producción         | Requiere `release_validate` GO + confirm  |
| Commitear `.env.local`              | Secretos                                  |

---

## 9. Checklist

- [ ] Obtener URLs de **staging** (no producción) de `compramelafoto-dnxsuite`
- [ ] Añadir `DATABASE_URL` y `DIRECT_URL` a `dnx-mcp/.env.local`
- [ ] Añadir `POSTGRES_READONLY_DATABASE_URL` (usuario readonly)
- [ ] `prisma validate` exit 0 manual
- [ ] `prisma migrate status` conecta (sin aplicar migraciones)
- [ ] `release_prepare { dryRun: true }` → `prisma.schemaValid: true`
- [ ] `postgres.connected: true`
- [ ] `brain.shouldBlock: false`

---

## Referencias

| Documento                                                                                    | Contenido                                |
| -------------------------------------------------------------------------------------------- | ---------------------------------------- |
| [`compramelafoto-release-blockers-plan.md`](./compramelafoto-release-blockers-plan.md)       | Estado desbloqueo Git + Prisma pendiente |
| [`compramelafoto-staging-setup-checklist.md`](./compramelafoto-staging-setup-checklist.md)   | Checklist env MCP completo               |
| [`compramelafoto-release-prepare-monorepo.md`](./compramelafoto-release-prepare-monorepo.md) | Último dry-run con bloqueos              |
| `src/providers/prisma/client/prisma-executor.ts`                                             | Comandos Prisma permitidos/bloqueados    |
| `src/providers/postgres/config.ts`                                                           | Resolución de URL PostgreSQL             |

---

_Solo documentación. `.env.local` no modificado en la generación de este informe._
