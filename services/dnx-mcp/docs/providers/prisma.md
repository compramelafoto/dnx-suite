# Prisma Provider

Provider de **solo lectura** para inspeccionar el schema Prisma y el estado de migraciones locales. Diseñado para que el Brain y el Release Orchestrator sepan si el estado Prisma permite un release seguro.

## Principios

- **Solo lectura**: no ejecuta `migrate dev`, `migrate deploy`, `db push`, `db pull` ni `generate`
- **Spawn seguro**: usa `child_process.spawn` sin shell
- **Allowlist de subcomandos**: solo `validate`, `format --check` y `migrate status`
- **Tipado fuerte + Zod**: schemas para inputs y outputs
- **Sin modificar BD**: no aplica migraciones ni altera el schema

## Configuración

| Variable                 | Descripción                     | Default                      |
| ------------------------ | ------------------------------- | ---------------------------- |
| `PRISMA_SCHEMA_PATH`     | Ruta al archivo `schema.prisma` | `{cwd}/prisma/schema.prisma` |
| `PRISMA_MIGRATIONS_PATH` | Directorio de migraciones       | `{schema_dir}/migrations`    |
| `PRISMA_BINARY`          | Binario de Prisma CLI           | `prisma`                     |

```bash
PRISMA_SCHEMA_PATH=/path/to/prisma/schema.prisma
PRISMA_MIGRATIONS_PATH=/path/to/prisma/migrations
PRISMA_BINARY=pnpm exec prisma
```

El provider considera **configurado** cuando existe el archivo de schema.

## Estructura

```
src/providers/prisma/
├── provider.ts              # PrismaProvider facade
├── config.ts                # Schema y resolución de config
├── errors.ts                # Errores tipados
├── client/
│   └── prisma-executor.ts   # Ejecutor seguro (spawn)
├── parsers/
│   ├── schema-parser.ts     # Stats y hash del schema
│   └── migration-parser.ts  # Migraciones locales y migrate status
├── services/
│   ├── schema.service.ts    # Validación y stats
│   ├── migration.service.ts # Migraciones locales
│   └── security.service.ts  # Drift y pendientes
├── helpers/
│   └── release-readiness.ts # assessReleaseReadiness
└── types/
    └── index.ts             # Schemas Zod
```

## API

### Estado de schema

| Método             | Descripción                                      |
| ------------------ | ------------------------------------------------ |
| `getSchemaPath()`  | Ruta absoluta al schema                          |
| `schemaExists()`   | `true` si el archivo existe                      |
| `validateSchema()` | Ejecuta `prisma validate` (solo lectura)         |
| `getSchemaHash()`  | Hash SHA-256 (16 chars) del contenido del schema |
| `getSchemaStats()` | Modelos, enums, datasources y generators         |

### Migraciones locales

| Método                      | Descripción                                |
| --------------------------- | ------------------------------------------ |
| `listMigrations()`          | Carpetas con `migration.sql` ordenadas     |
| `getLatestMigration()`      | Última migración por nombre o `null`       |
| `getMigrationCount()`       | Cantidad de migraciones locales            |
| `getMigrationStatusLocal()` | Estado del directorio (sin conectar a BD)  |
| `getMigrateStatus()`        | Salida de `prisma migrate status` parseada |

### Estado seguro

| Método                     | Descripción                                     |
| -------------------------- | ----------------------------------------------- |
| `hasPendingMigrations()`   | `true` si hay migraciones sin aplicar (vía CLI) |
| `hasSchemaChanges()`       | `true` si falla validate o `format --check`     |
| `detectDriftRisk()`        | Nivel de riesgo y razones consolidadas          |
| `assessReleaseReadiness()` | Evaluación completa para release                |

### Helper de alto nivel

```typescript
import { createPrismaProvider } from "./providers/prisma/index.js";

const prisma = createPrismaProvider();

if (prisma.isConfigured()) {
  const readiness = await prisma.assessReleaseReadiness();

  console.log(readiness.riskLevel); // "low" | "medium" | "high"
  console.log(readiness.blockers); // bloqueos duros
  console.log(readiness.warnings); // advertencias
  console.log(readiness.recommendation);
}
```

`assessReleaseReadiness()` devuelve:

| Campo               | Tipo       | Descripción                       |
| ------------------- | ---------- | --------------------------------- |
| `schemaValid`       | `boolean`  | Resultado de `prisma validate`    |
| `schemaPath`        | `string`   | Ruta del schema                   |
| `schemaHash`        | `string`   | Hash del contenido                |
| `migrationCount`    | `number`   | Migraciones locales               |
| `latestMigration`   | `string?`  | Última migración local            |
| `pendingMigrations` | `string[]` | Pendientes según `migrate status` |
| `driftRisk`         | `object`   | Detalle de riesgo de drift        |
| `riskLevel`         | `enum`     | `low` / `medium` / `high`         |
| `blockers`          | `string[]` | Impiden release                   |
| `warnings`          | `string[]` | Requieren revisión                |
| `recommendation`    | `string`   | Texto accionable                  |

## Comandos permitidos

| Comando                 | Uso                                       |
| ----------------------- | ----------------------------------------- |
| `prisma validate`       | Validar sintaxis y referencias del schema |
| `prisma format --check` | Detectar drift de formato (sin escribir)  |
| `prisma migrate status` | Estado de migraciones vs BD (lectura)     |

## Errores

| Error                         | Cuándo                           |
| ----------------------------- | -------------------------------- |
| `PrismaNotConfiguredError`    | Schema path no configurado       |
| `PrismaSchemaNotFoundError`   | Archivo schema no existe         |
| `PrismaForbiddenCommandError` | Comando fuera de allowlist       |
| `PrismaCommandError`          | CLI falló con exit code != 0     |
| `PrismaValidationError`       | Argumentos inválidos al executor |

## Uso con Release Orchestrator / Brain

El provider expone señales para integración futura:

- `schemaValid`, `pendingMigrations`, `driftRisk.level`
- `blockers` y `warnings` listos para el motor de decisión

No registra MCP tools nuevas; se consume desde orquestadores y el Brain vía código.

## Integración con Release Orchestrator

El Release Orchestrator invoca `assessReleaseReadiness()` en cada fase (`prepare`, `validate`, `execute`) y expone el resultado en `result.prisma` y `report.prisma`. Si hay bloqueos críticos, fuerza `NO-GO` y `brain.shouldBlock = true` (excepto en `dryRun`).

```typescript
const orchestrator = new ReleaseOrchestrator({
  prisma: createPrismaProvider(),
  git: createGitProvider(),
});
```

## Tests

```bash
pnpm test src/providers/prisma
```

Los tests usan fixtures temporales y mocks del `PrismaExecutor` — no requieren Prisma CLI ni base de datos real.
