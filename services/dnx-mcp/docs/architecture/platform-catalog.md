# Platform Catalog

Catálogo declarativo de todas las plataformas DNX. Permite que DNX-MCP conozca cada producto **sin hardcodear** nombres de proyecto, dominios o políticas en el código de orquestación.

## Principio

> La configuración de cada plataforma vive en un archivo. El código consume `PlatformDefinition`.

## Estructura

```
src/platforms/
├── index.ts              # Exports públicos
├── registry.ts           # getPlatform, listPlatforms, validatePlatform
├── types.ts              # PlatformDefinition + schemas Zod
├── validators.ts         # Validación estructural y semántica
└── platforms/
    ├── compramelafoto.ts
    ├── fotooffice.ts
    ├── fotorank.ts
    ├── camofduty.ts
    └── cuantocobro.ts
```

## PlatformDefinition

Cada plataforma exporta un objeto tipado con:

| Campo             | Descripción                      |
| ----------------- | -------------------------------- |
| `id`              | Identificador único (kebab-case) |
| `name`            | Nombre legible                   |
| `description`     | Descripción del producto         |
| `repository`      | Repo Git (`org/repo`)            |
| `defaultBranch`   | Rama principal                   |
| `vercelProject`   | Nombre del proyecto en Vercel    |
| `domains`         | `production[]` y `preview[]`     |
| `workers`         | Workers asociados                |
| `database`        | Config Postgres/Prisma o `null`  |
| `redis`           | Config Redis o `null`            |
| `r2`              | Config R2 o `null`               |
| `cloudflare`      | Zone/account o `null`            |
| `mercadoPago`     | Pagos o `null`                   |
| `gmail`           | Email o `null`                   |
| `google`          | OAuth Google o `null`            |
| `healthEndpoints` | Endpoints de salud               |
| `smokeTests`      | Tests post-deploy                |
| `releasePolicy`   | Política de release              |
| `rollbackPolicy`  | Política de rollback             |
| `maintenanceMode` | Modo mantenimiento               |
| `featureFlags`    | Feature flags declarativos       |

## API del registry

```typescript
import {
  getPlatform,
  listPlatforms,
  validatePlatform,
  comprameLaFotoPlatform,
} from "./platforms/index.js";

// Por id
const platform = getPlatform("compramelafoto");

// Listar todas
const all = listPlatforms();

// Validar
const result = validatePlatform("fotorank");
// { valid: true, platformId: "fotorank", errors: [] }

// Validar definición directa
validatePlatform(comprameLaFotoPlatform);
```

## Plataformas registradas

| ID               | Nombre         | Vercel Project |
| ---------------- | -------------- | -------------- |
| `compramelafoto` | ComprameLaFoto | compramelafoto |
| `fotooffice`     | FotoOffice     | fotooffice     |
| `fotorank`       | FotoRank       | fotorank       |
| `camofduty`      | CamOfDuty      | camofduty      |
| `cuantocobro`    | CuantoCobro    | cuantocobro    |

## Integración con Release Orchestrator

El orquestador **ya no acepta strings** como `"my-app"`. Recibe `PlatformDefinition`:

```typescript
import { ReleaseOrchestrator } from "./orchestrators/release/index.js";
import { getPlatform } from "./platforms/index.js";

const platform = getPlatform("compramelafoto");
if (!platform) throw new Error("Platform not found");

const release = new ReleaseOrchestrator();

await release.prepareRelease({ platform });
await release.validateRelease({ platform });
await release.executeRelease({ platform, confirm: true });
```

Internamente el orquestador resuelve:

```typescript
platform.vercelProject  → invocación de MCP tools Vercel
platform.id             → auditoría y estado
platform.releasePolicy  → validación de targets y confirmación
platform.rollbackPolicy → habilitación de rollback
platform.maintenanceMode → bloqueo GO/NO-GO
```

## Agregar una nueva plataforma

1. Crear `src/platforms/platforms/nueva-plataforma.ts`
2. Exportar `PlatformDefinition` completo
3. Registrar en `registry.ts`
4. Ejecutar `validatePlatform("nueva-plataforma")`

No se requiere modificar providers ni MCP tools.

## Validación

Dos niveles:

1. **Estructural** — Zod schema (`platformDefinitionSchema`)
2. **Semántica** — reglas de negocio en `validators.ts`:
   - smokeTests requeridos si `requireStagingValidation`
   - rollback debe requerir confirmación si está habilitado
   - maintenanceMode requiere mensaje si está activo
   - featureFlags sin duplicados

## Extensibilidad futura

El catálogo está preparado para que tools y orquestadores adicionales consuman la misma definición:

- Git tools → `platform.repository`, `platform.defaultBranch`
- Postgres tools → `platform.database`
- Smoke test runner → `platform.smokeTests`
- Health checker → `platform.healthEndpoints`

## Tests

```bash
pnpm test src/platforms
```
