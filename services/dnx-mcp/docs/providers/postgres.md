# PostgreSQL Provider

Provider de **solo lectura** para evaluar el estado de PostgreSQL antes de releases. Usa `pg` con transacciones en modo read-only y no modifica datos.

## Principios

- **Solo lectura**: solo queries `SELECT` sobre catálogo y vistas del sistema
- **Sin writes**: rechaza `INSERT`, `UPDATE`, `DELETE`, `DDL`, `VACUUM`, etc.
- **Timeout configurable**: cada query respeta `POSTGRES_QUERY_TIMEOUT_MS`
- **Sin secretos en logs**: URLs de conexión redactadas en errores
- **Tipado fuerte + Zod**: schemas para inputs y outputs

## Configuración

| Variable                         | Descripción                     | Prioridad / Default |
| -------------------------------- | ------------------------------- | ------------------- |
| `POSTGRES_READONLY_DATABASE_URL` | URL de solo lectura (preferida) | 1ª                  |
| `POSTGRES_DATABASE_URL`          | URL principal                   | 2ª                  |
| `POSTGRES_URL`                   | Alias legacy                    | 3ª                  |
| `DATABASE_URL`                   | Fallback Prisma                 | 4ª                  |
| `POSTGRES_QUERY_TIMEOUT_MS`      | Timeout por query (ms)          | `10000`             |

```bash
POSTGRES_READONLY_DATABASE_URL=postgresql://readonly:pass@host:5432/app
POSTGRES_QUERY_TIMEOUT_MS=15000
```

El pool se crea con `default_transaction_read_only=on` y `application_name=dnx-mcp-readonly`.

El provider considera **configurado** cuando hay una `databaseUrl` no vacía.

## Estructura

```
src/providers/postgres/
├── provider.ts              # PostgresProvider facade
├── config.ts                # Schema Zod y resolución de env
├── errors.ts                # Errores tipados
├── client/
│   └── postgres-client.ts   # Pool pg con timeout y allowlist
├── queries/
│   └── readonly-queries.ts  # SQL SELECT + validación
├── services/
│   ├── connection.service.ts
│   └── stats.service.ts     # Stats + monitoring
├── helpers/
│   └── release-readiness.ts # assessReleaseReadiness
└── types/
    └── index.ts             # Schemas Zod
```

## API

### Conexión

| Método         | Descripción                   |
| -------------- | ----------------------------- |
| `connect()`    | Abre pool y verifica conexión |
| `disconnect()` | Cierra el pool                |
| `ping()`       | `SELECT 1` + latencia         |
| `getVersion()` | Versión de PostgreSQL         |

### Métricas

| Método                      | Descripción                             |
| --------------------------- | --------------------------------------- |
| `getDatabaseSize()`         | Tamaño en bytes (`pg_database_size`)    |
| `getConnectionCount()`      | Conexiones activas a la BD actual       |
| `getTableStats()`           | Top 50 tablas por `pg_stat_user_tables` |
| `getMigrationTableStatus()` | Estado de `_prisma_migrations`          |

### Monitoreo

| Método                    | Descripción                        |
| ------------------------- | ---------------------------------- |
| `getActiveQueries()`      | Queries en `pg_stat_activity`      |
| `getLongRunningQueries()` | Activas > `longRunningThresholdMs` |
| `getLocks()`              | Locks actuales (`pg_locks`)        |

### Helper de alto nivel

```typescript
import { createPostgresProvider } from "./providers/postgres/index.js";

const postgres = createPostgresProvider();

if (postgres.isConfigured()) {
  const readiness = await postgres.assessReleaseReadiness();

  if (readiness.riskLevel === "high") {
    console.log(readiness.blockers);
  }
}
```

`assessReleaseReadiness()` devuelve:

| Campo                  | Tipo       | Descripción                    |
| ---------------------- | ---------- | ------------------------------ |
| `connected`            | `boolean`  | Ping exitoso                   |
| `version`              | `string?`  | Versión PostgreSQL             |
| `databaseSize`         | `number?`  | Bytes                          |
| `activeConnections`    | `number`   | Conexiones activas             |
| `longRunningQueries`   | `array`    | Queries lentas                 |
| `locks`                | `array`    | Locks detectados               |
| `migrationTableExists` | `boolean`  | `_prisma_migrations` en public |
| `riskLevel`            | `enum`     | `low` / `medium` / `high`      |
| `blockers`             | `string[]` | Impiden release                |
| `warnings`             | `string[]` | Requieren revisión             |
| `recommendation`       | `string`   | Texto accionable               |

### Bloqueos típicos

- No se puede conectar o hacer ping
- Queries de larga duración activas
- Locks no concedidos (`granted: false`)

### Advertencias típicas

- Muchas conexiones activas (≥ `maxConnectionWarning`, default 50)
- Tabla `_prisma_migrations` no encontrada

## Errores

| Error                         | Cuándo                            |
| ----------------------------- | --------------------------------- |
| `PostgresNotConfiguredError`  | Sin URL de conexión               |
| `PostgresConnectionError`     | Fallo al conectar (URL redactada) |
| `PostgresForbiddenQueryError` | Query fuera de allowlist          |
| `PostgresQueryTimeoutError`   | Query excedió timeout             |
| `PostgresQueryError`          | Error SQL genérico                |

## Provider Registry

Registrado en `createDefaultProviderRegistry()` como provider **real** (no stub):

```typescript
import { createDefaultProviderRegistry } from "./providers/registry/index.js";

const registry = createDefaultProviderRegistry();
registry.assertConfigured("postgres"); // si hay URL configurada
const health = registry.getHealth();
```

## Integración con Release Orchestrator

En `prepareRelease`, `validateRelease` y `executeRelease`, el orquestador llama a `assessReleaseReadiness()` y expone el resultado en `result.postgres` y `report.postgres`. Los bloqueos críticos fuerzan `NO-GO` y bloquean `executeRelease` (excepto en `dryRun`).

Prioridad de resolución del provider: inyección directa → `getPostgresProvider(platform)` → `ProviderRegistry.getProvider("postgres")`.

## Tests

```bash
pnpm test src/providers/postgres
```

Los tests usan mocks de `PostgresClient` — no requieren PostgreSQL real.

## Uso con inyección para tests

```typescript
const provider = createPostgresProvider({
  config: {
    databaseUrl: "postgresql://localhost:5432/test",
    queryTimeoutMs: 3000,
  },
  client: mockClient,
});
```
