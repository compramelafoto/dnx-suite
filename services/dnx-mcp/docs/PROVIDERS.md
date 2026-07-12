# Providers

Los providers encapsulan toda la integración con servicios externos. Cada provider vive en `src/providers/<nombre>/`.

## Interfaz base

```typescript
interface Provider {
  readonly name: string;
  isConfigured(): boolean;
}
```

Al implementar funcionalidad real, extender el provider con métodos específicos del dominio manteniendo la interfaz base.

## Providers registrados

| Nombre      | Directorio               | Estado       |
| ----------- | ------------------------ | ------------ |
| git         | `providers/git/`         | Stub         |
| vercel      | `providers/vercel/`      | Implementado |
| docker      | `providers/docker/`      | Stub         |
| postgres    | `providers/postgres/`    | Stub         |
| prisma      | `providers/prisma/`      | Stub         |
| cloudflare  | `providers/cloudflare/`  | Stub         |
| mercadopago | `providers/mercadopago/` | Stub         |
| r2          | `providers/r2/`          | Stub         |
| redis       | `providers/redis/`       | Stub         |
| gmail       | `providers/gmail/`       | Stub         |
| google      | `providers/google/`      | Stub         |
| cursor      | `providers/cursor/`      | Stub         |

## Cómo implementar un provider

Documentación de referencia del provider Vercel: [`src/providers/vercel/README.md`](../src/providers/vercel/README.md).

### 1. Reemplazar el stub

// src/providers/git/index.ts
import { loadEnv } from "../../config/index.js";
import type { Provider } from "../../types/provider.js";

class GitProvider implements Provider {
readonly name = "git" as const;

isConfigured(): boolean {
return Boolean(loadEnv().GIT_DEFAULT_BRANCH);
}

// Métodos del dominio
async getStatus(cwd: string): Promise<GitStatus> {
// implementación
}
}

export const gitProvider = new GitProvider();

````

### 2. Agregar tipos específicos

```typescript
// src/providers/git/types.ts
export interface GitStatus {
  branch: string;
  clean: boolean;
  staged: string[];
  modified: string[];
}
````

### 3. Separar operaciones complejas

Para providers con muchas operaciones, usar subdirectorios:

```
providers/git/
  index.ts
  types.ts
  operations/
    status.ts
    diff.ts
    branch.ts
```

### 4. Manejo de errores

Usar `ProviderError` y `ProviderNotConfiguredError` de `src/utils/errors.ts`:

```typescript
import { ProviderNotConfiguredError } from "../../utils/errors.js";

function assertConfigured(provider: Provider): void {
  if (!provider.isConfigured()) {
    throw new ProviderNotConfiguredError(provider.name);
  }
}
```

## Variables de entorno

Cada provider declara sus variables en `src/config/schema.ts`. Ver `.env.example` para la lista completa.

## Registro central

Todos los providers se exportan desde `src/providers/index.ts`:

```typescript
import { getProvider, getConfiguredProviders } from "./providers/index.js";

const git = getProvider("git");
const active = getConfiguredProviders();
```

## Buenas prácticas

- Un provider = un servicio externo.
- No importar tools desde providers.
- No compartir estado mutable entre invocaciones.
- Preferir funciones puras en `operations/` y estado en la clase del provider.
- Documentar métodos públicos con JSDoc.
