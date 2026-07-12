# Release Orchestrator

Capa de orquestación que coordina múltiples MCP tools para ejecutar un pipeline de release completo. **No es un provider** y **no realiza llamadas HTTP**.

## Posición en la arquitectura

```
┌─────────────────────────────────────────┐
│           MCP Client (Cursor)           │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│              MCP Tools                  │
│   vercel_status, vercel_deploy_release  │
└─────────────────┬───────────────────────┘
                  │  (invocación in-process)
┌─────────────────▼───────────────────────┐
│         Release Orchestrator            │  ← esta capa
│   prepare → validate → execute → rollback│
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│            VercelProvider               │
└─────────────────────────────────────────┘
```

El orquestador **solo invoca tools** a través de la abstracción `ToolInvoker`. No importa providers ni clientes HTTP.

## Módulo

```
src/orchestrators/release/
├── release-orchestrator.ts   # Clase principal + LocalToolInvoker
├── release-types.ts          # Tipos, interfaces, inputs/outputs
├── release-state.ts          # Máquina de estados + snapshots
├── release-checklist.ts      # Riesgos y checklist
├── release-brain.ts          # Adaptador señales → DNX Brain
├── release-git.ts            # Adaptador Git → señales + bloqueos
├── release-prisma.ts         # Adaptador Prisma → señales + bloqueos
├── release-postgres.ts       # Adaptador PostgreSQL → señales + bloqueos
├── release-report.ts         # Reportes y métricas
└── index.ts                  # Exports públicos

Ver también: [Provider Registry](./provider-registry.md) para resolución centralizada de providers.
```

## Integración con DNX Brain

Tras recopilar datos de las MCP tools, el orquestador construye señales estructuradas y consulta al [DNX Brain](./dnx-brain.md):

| Fase              | Tools consultadas                                                    | Operación Brain    |
| ----------------- | -------------------------------------------------------------------- | ------------------ |
| `prepareRelease`  | `vercel_status`, `vercel_prepare_staging`                            | `release.prepare`  |
| `validateRelease` | `vercel_status`, `vercel_prepare_staging`, `vercel_validate_staging` | `release.validate` |
| `executeRelease`  | snapshots + re-evaluación                                            | `release.execute`  |

### Decisión GO / NO-GO

`validateRelease` determina GO solo si:

1. `vercel_validate_staging` pasa sin issues
2. La plataforma no está en mantenimiento
3. **Git** no tiene bloqueos críticos (`blockers` o `riskLevel: high`)
4. **Prisma** no tiene bloqueos críticos (schema inválido, migraciones pendientes, drift, `riskLevel: high`)
5. **PostgreSQL** no tiene bloqueos críticos (sin conexión, locks, queries largas, tabla migraciones, `riskLevel: high`)
6. **DNX Brain** devuelve `shouldBlock: false`

Si `shouldBlock: true`, la decisión es **NO-GO** aunque la validación técnica haya pasado.

### Bloqueo de ejecución

`executeRelease` re-evalúa el Brain antes del deploy. Si `shouldBlock: true`, lanza error **aunque `confirm: true`**. En `dryRun` el Brain evalúa pero no bloquea (solo simula).

### Campos Brain en resultados

Cada fase expone `brain` y lo incluye en `report.brain`:

- `score`, `confidence`, `verdict`, `shouldBlock`
- `reasoning`, `recommendation`
- `risks`, `nextActions`

## Integración con Git Provider

El orquestador puede recibir un `GitProvider` o resolverlo por plataforma:

```typescript
import { createGitProvider } from "../../providers/git/index.js";
import { ReleaseOrchestrator } from "./orchestrators/release/index.js";

const orchestrator = new ReleaseOrchestrator({
  git: createGitProvider({ config: { repoPath: "/path/to/repo" } }),
  // o por plataforma:
  getGitProvider: (platform) =>
    createGitProvider({ config: { repoPath: `/repos/${platform.repository}` } }),
});
```

En cada fase se ejecuta `git.assessReleaseReadiness()` (solo lectura) y el resultado:

1. Se convierte en señales para el Brain
2. Se incluye en `result.git` y `report.git`
3. Puede forzar `NO-GO` / `shouldBlock`

### Bloqueos Git

| Condición                                  | Efecto en validate | Efecto en execute (real) |
| ------------------------------------------ | ------------------ | ------------------------ |
| `dirtyTree`                                | NO-GO              | Bloqueado                |
| `unpushedCommits > 0`                      | NO-GO              | Bloqueado                |
| Rama ∉ `allowedBranches` / `defaultBranch` | NO-GO              | Bloqueado                |
| `riskLevel: high`                          | NO-GO              | Bloqueado                |
| Cualquiera en `dryRun`                     | Visible en reporte | No bloquea (simula)      |

### Campos Git en reportes

`report.git` incluye: `branch`, `dirtyTree`, `unpushedCommits`, `changedFilesCount`, `lastCommit`, `latestTag`, `riskLevel`, `blockers`, `warnings`, `recommendation`.

## Integración con Prisma Provider

El orquestador puede recibir un `PrismaProvider` o resolverlo por plataforma:

```typescript
import { createPrismaProvider } from "../../providers/prisma/index.js";
import { ReleaseOrchestrator } from "./orchestrators/release/index.js";

const orchestrator = new ReleaseOrchestrator({
  prisma: createPrismaProvider({ config: { schemaPath: "/path/to/schema.prisma" } }),
  getPrismaProvider: (platform) =>
    createPrismaProvider({ config: { schemaPath: `/repos/${platform.id}/prisma/schema.prisma` } }),
});
```

En cada fase se ejecuta `prisma.assessReleaseReadiness()` (solo lectura) y el resultado:

1. Se convierte en señales para el Brain
2. Se incluye en `result.prisma` y `report.prisma`
3. Puede forzar `NO-GO` / `shouldBlock`

### Bloqueos Prisma

| Condición               | Efecto en validate | Efecto en execute (real) |
| ----------------------- | ------------------ | ------------------------ |
| `schemaValid: false`    | NO-GO              | Bloqueado                |
| `pendingMigrations`     | NO-GO              | Bloqueado                |
| `driftRisk.formatDrift` | NO-GO              | Bloqueado                |
| `riskLevel: high`       | NO-GO              | Bloqueado                |
| Cualquiera en `dryRun`  | Visible en reporte | No bloquea (simula)      |

### Campos Prisma en reportes

`report.prisma` incluye: `schemaValid`, `schemaPath`, `schemaHash`, `migrationCount`, `latestMigration`, `pendingMigrations`, `driftRisk`, `riskLevel`, `blockers`, `warnings`, `recommendation`.

## Integración con PostgreSQL Provider

El orquestador puede recibir un `PostgresProvider` o resolverlo por plataforma / registry:

```typescript
import { createPostgresProvider } from "../../providers/postgres/index.js";
import { ReleaseOrchestrator } from "./orchestrators/release/index.js";

const orchestrator = new ReleaseOrchestrator({
  postgres: createPostgresProvider(),
  getPostgresProvider: (platform) =>
    createPostgresProvider({ config: { databaseUrl: platform.databaseUrl } }),
});
```

En cada fase se ejecuta `postgres.assessReleaseReadiness()` (solo lectura) y el resultado:

1. Se convierte en señales para el Brain
2. Se incluye en `result.postgres` y `report.postgres`
3. Puede forzar `NO-GO` / `shouldBlock`

### Bloqueos PostgreSQL

| Condición                     | Efecto en validate | Efecto en execute (real) |
| ----------------------------- | ------------------ | ------------------------ |
| `connected: false`            | NO-GO              | Bloqueado                |
| `riskLevel: high`             | NO-GO              | Bloqueado                |
| `blockers` no vacío           | NO-GO              | Bloqueado                |
| Locks no concedidos           | NO-GO              | Bloqueado                |
| `longRunningQueries`          | NO-GO              | Bloqueado                |
| `migrationTableExists: false` | NO-GO              | Bloqueado                |
| Cualquiera en `dryRun`        | Visible en reporte | No bloquea (simula)      |

### Campos PostgreSQL en reportes

`report.postgres` incluye: `connected`, `version`, `databaseSize`, `activeConnections`, `longRunningQueries`, `locks`, `migrationTableExists`, `riskLevel`, `blockers`, `warnings`, `recommendation`.

## Provider Registry

El orquestador acepta un `ProviderRegistry` para resolver `vercel`, `git`, `prisma` y `postgres` sin inyección directa:

```typescript
import { createDefaultProviderRegistry } from "../../providers/registry/index.js";

const orchestrator = new ReleaseOrchestrator({
  providerRegistry: createDefaultProviderRegistry(),
});
```

### Prioridad de resolución

| Orden | Fuente                  | Ejemplo                       |
| ----- | ----------------------- | ----------------------------- |
| 1     | Inyección directa       | `git: createMockGit()`        |
| 2     | Resolver por plataforma | `getGitProvider: (p) => ...`  |
| 3     | Provider Registry       | `registry.getProvider("git")` |
| 4     | Singleton por defecto   | `gitProvider`                 |

La inyección directa sigue teniendo prioridad para mantener compatibilidad con tests y código existente.

## Ciclo de vida

```
idle
  → preparing → prepared
                → validating → validated
                              → executing → completed
                                           ↘ failed
  rolling_back → rolled_back
```

| Fase           | Descripción                   |
| -------------- | ----------------------------- |
| `idle`         | Sin release activo            |
| `preparing`    | Ejecutando `prepareRelease`   |
| `prepared`     | Status + staging consolidados |
| `validating`   | Ejecutando `validateRelease`  |
| `validated`    | GO — listo para deploy        |
| `executing`    | Deploy en progreso            |
| `completed`    | Deploy exitoso                |
| `failed`       | Error o NO-GO                 |
| `rolling_back` | Rollback en progreso          |
| `rolled_back`  | Rollback completado           |

## Integración con Platform Catalog

El orquestador recibe `PlatformDefinition` — no strings como `"my-app"`:

```typescript
import { getPlatform } from "../../platforms/index.js";

const platform = getPlatform("compramelafoto")!;
await release.prepareRelease({ platform });
```

Ver [platform-catalog.md](./platform-catalog.md).

## API

### `prepareRelease(input)`

Ejecuta:

1. `vercel_status`
2. `vercel_prepare_staging`

Consolida resultados, calcula riesgos, genera checklist, consulta al **DNX Brain** y produce plan de release.

```typescript
const orchestrator = new ReleaseOrchestrator();

const result = await orchestrator.prepareRelease({
  platform: getPlatform("fotorank")!,
  dryRun: false,
});

// result.plan.readyForValidation  (incluye criterio Brain)
// result.brain.score
// result.brain.shouldBlock
// result.report.brain.reasoning
```

### `validateRelease(input)`

Ejecuta:

1. `vercel_status` + `vercel_prepare_staging` (desde cache o fresh)
2. `vercel_validate_staging`
3. **DNX Brain** → GO / NO-GO

```typescript
const result = await orchestrator.validateRelease({
  platform: getPlatform("fotorank")!,
});

console.log(result.decision); // "GO" | "NO-GO"
console.log(result.brain.score); // 0–100
console.log(result.brain.shouldBlock);
console.log(result.report.brain); // reasoning, risks, nextActions
```

Requiere fase `prepared` (excepto en dryRun).

### `executeRelease(input)`

Ejecuta:

1. `vercel_deploy_release`

Requiere:

- Fase `validated` con decisión GO
- `confirm: true` (o `dryRun: true` para simular)
- **Brain `shouldBlock: false`** (en ejecución real)

```typescript
// Simulación — Brain evalúa pero no bloquea
await orchestrator.executeRelease({
  platform: getPlatform("fotorank")!,
  dryRun: true,
});

// Ejecución real — bloqueada si Brain rechaza
await orchestrator.executeRelease({
  platform: getPlatform("fotorank")!,
  target: "production",
  confirm: true,
  timeoutMs: 600_000,
});
```

### `rollbackRelease(input)`

Ejecuta:

1. `vercel_rollback_release`

```typescript
await orchestrator.rollbackRelease({
  project: "my-app",
  confirm: true,
});
```

## Pipeline completo

```typescript
import { getPlatform } from "../../platforms/index.js";
import { ReleaseOrchestrator } from "./orchestrators/release/index.js";

const platform = getPlatform("fotorank")!;
const release = new ReleaseOrchestrator();

// 1. Preparar
const prepared = await release.prepareRelease({ platform });
if (!prepared.plan.readyForValidation || prepared.brain.shouldBlock) {
  console.log("Resolver riesgos:", prepared.brain.recommendation);
  return;
}

// 2. Validar
const validated = await release.validateRelease({ platform });
if (validated.decision === "NO-GO") {
  console.log("Release bloqueado:", validated.brain.reasoning);
  return;
}

// 3. Desplegar
const deployed = await release.executeRelease({
  platform,
  confirm: true,
});
```

## dryRun

Todas las operaciones soportan `dryRun: true`:

| Método            | Comportamiento en dryRun                  |
| ----------------- | ----------------------------------------- |
| `prepareRelease`  | Tools en modo preview, checklist simulado |
| `validateRelease` | No valida fase previa                     |
| `executeRelease`  | Simula deploy sin `confirm`               |
| `rollbackRelease` | Simula rollback sin `confirm`             |

## Auditoría y métricas

Cada operación registra:

```json
{
  "tool": "release_orchestrator",
  "action": "prepareRelease",
  "project": "my-app",
  "dryRun": false,
  "outcome": "success",
  "durationMs": 3200
}
```

Métricas por step:

```json
{
  "totalDurationMs": 3200,
  "steps": [
    { "step": "status", "tool": "vercel_status", "durationMs": 1200, "success": true },
    { "step": "staging", "tool": "vercel_prepare_staging", "durationMs": 2000, "success": true }
  ]
}
```

## ToolInvoker

Abstracción para invocar tools sin acoplar al orquestador:

```typescript
interface ToolInvoker {
  invoke<T>(tool: ReleaseToolName, input: Record<string, unknown>): Promise<T>;
}
```

- **`LocalToolInvoker`** — invoca handlers en proceso (producción)
- **Mock invoker** — para tests

```typescript
const orchestrator = new ReleaseOrchestrator({
  invoker: customInvoker,
});
```

## Extensibilidad

Para agregar Git o PostgreSQL al pipeline en el futuro:

1. Crear MCP tools de alto nivel (ej. `git_verify_branch`)
2. Agregar el tool name a `ReleaseToolName`
3. Extender `LocalToolInvoker`
4. Invocar desde el método del orquestador correspondiente

El orquestador **nunca** importa providers directamente.

## Decisiones de diseño

| Decisión           | Razón                                                         |
| ------------------ | ------------------------------------------------------------- |
| No es provider     | Separación de responsabilidades — orquestación vs integración |
| ToolInvoker        | Desacopla orquestador de implementación de tools              |
| State machine      | Trazabilidad del ciclo de release                             |
| Doble confirmación | Orquestador + tool para operaciones mutables                  |
| Reportes separados | Cada fase genera artefacto auditable                          |

## Tests

```bash
pnpm test src/orchestrators/release
```

Los tests usan `ToolInvoker` mock — sin credenciales ni HTTP.
