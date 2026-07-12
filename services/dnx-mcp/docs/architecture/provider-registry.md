# Provider Registry

Registro centralizado de providers para que orquestadores, Brain y tools resuelvan integraciones sin recibir instancias sueltas.

## Posición en la arquitectura

```
┌─────────────────────────────────────────┐
│     Release Orchestrator / Brain        │
└─────────────────┬───────────────────────┘
                  │ getProvider("git" | "prisma" | "vercel")
┌─────────────────▼───────────────────────┐
│           ProviderRegistry              │
└─────────────────┬───────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
 Vercel        Git          Prisma
 Provider    Provider      Provider
    + stubs (docker, postgres, cloudflare, …)
```

## Módulo

```
src/providers/registry/
├── provider-registry.ts        # Clase ProviderRegistry
├── provider-registry-types.ts  # Tipos, health, errores
├── provider-factory.ts           # createDefaultProviderRegistry()
├── provider-health.ts          # buildProviderHealthReport()
└── index.ts
```

## API

| Método                             | Descripción                                |
| ---------------------------------- | ------------------------------------------ |
| `registerProvider(name, provider)` | Registra o reemplaza un provider           |
| `getProvider(name)`                | Devuelve el provider o `undefined`         |
| `hasProvider(name)`                | `true` si está registrado                  |
| `listProviders()`                  | Nombres registrados (ordenados)            |
| `isConfigured(name)`               | `true` si registrado y `isConfigured()`    |
| `assertConfigured(name)`           | Lanza si no existe o no está configurado   |
| `getHealth()`                      | Snapshot de salud de todos los registrados |

## Factory por defecto

`createDefaultProviderRegistry(config?)` registra:

| Provider                                                                                      | Tipo  |
| --------------------------------------------------------------------------------------------- | ----- |
| `vercel`                                                                                      | Real  |
| `git`                                                                                         | Real  |
| `prisma`                                                                                      | Real  |
| `docker`, `postgres`, `cloudflare`, `mercadopago`, `r2`, `redis`, `gmail`, `google`, `cursor` | Stubs |

Overrides opcionales:

```typescript
import { createDefaultProviderRegistry } from "./providers/registry/index.js";
import { createGitProvider } from "./providers/git/index.js";

const registry = createDefaultProviderRegistry({
  providers: {
    git: createGitProvider({ config: { repoPath: "/repos/app" } }),
  },
});
```

## Health

```typescript
const health = registry.getHealth();
// {
//   providers: [{ name: "git", registered: true, configured: true, status: "healthy" }, ...],
//   configuredCount: 3,
//   totalCount: 12,
//   checkedAt: "2026-07-06T..."
// }
```

Estados:

- `healthy` — registrado y `isConfigured() === true`
- `unconfigured` — registrado pero sin configuración

## Errores

| Error                        | Cuándo                                         |
| ---------------------------- | ---------------------------------------------- |
| `ProviderNotRegisteredError` | `assertConfigured` sin registro previo         |
| `ProviderNotConfiguredError` | Provider registrado pero sin env/config        |
| `ProviderNameMismatchError`  | `registerProvider("git", providerConOtroName)` |

## Uso con Release Orchestrator

```typescript
import { createDefaultProviderRegistry } from "./providers/registry/index.js";
import { ReleaseOrchestrator } from "./orchestrators/release/index.js";

const registry = createDefaultProviderRegistry();

const orchestrator = new ReleaseOrchestrator({
  providerRegistry: registry,
});
```

### Prioridad de resolución

Para `vercel`, `git` y `prisma` el orquestador resuelve en este orden:

1. Inyección directa (`vercel`, `git`, `prisma`, `getGitProvider`, `getPrismaProvider`)
2. `providerRegistry.getProvider(name)`
3. Singleton por defecto (`vercelProvider`, etc.)

La inyección directa mantiene **compatibilidad hacia atrás** con tests y código existente.

## Tests

```bash
pnpm test src/providers/registry
```
