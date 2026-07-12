# Tools

Las tools son la capa de exposición MCP. Traducen invocaciones del protocolo en llamadas a providers.

## Principio fundamental

> **Las tools orquestan. Los providers ejecutan.**

Una tool nunca debe:

- Llamar directamente a APIs HTTP o SDKs externos.
- Duplicar lógica que ya existe en un provider.
- Contener configuración de servicios.

## Estructura

```
src/tools/
  index.ts          # Re-exporta registerTools
  registry.ts       # Lista central de registradores
  git/              # Tools del dominio git (futuro)
    index.ts
    git-status.ts
  vercel/           # Tools del dominio vercel (futuro)
    index.ts
```

## Cómo agregar una tool

### 1. Implementar el método en el provider

```typescript
// src/providers/git/operations/status.ts
export async function getGitStatus(cwd: string): Promise<GitStatus> {
  // lógica real
}
```

### 2. Crear la tool

```typescript
// src/tools/git/git-status.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { gitProvider } from "../../providers/git/index.js";

const inputSchema = {
  cwd: z.string().describe("Directorio del repositorio"),
};

export function registerGitStatusTool(server: McpServer): void {
  server.tool(
    "git_status",
    "Obtiene el estado del repositorio git",
    inputSchema,
    async ({ cwd }) => {
      const status = await gitProvider.getStatus(cwd);
      return {
        content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
      };
    },
  );
}
```

### 3. Registrar en el dominio

```typescript
// src/tools/git/index.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGitStatusTool } from "./git-status.js";

export function registerGitTools(server: McpServer): void {
  registerGitStatusTool(server);
}
```

### 4. Agregar al registry global

```typescript
// src/tools/registry.ts
import { registerGitTools } from "./git/index.js";

const toolRegistrars: ToolRegistrar[] = [registerGitTools];
```

## Convenciones de nombres

| Elemento        | Convención                          | Ejemplo                       |
| --------------- | ----------------------------------- | ----------------------------- |
| Tool name (MCP) | `snake_case` con prefijo de dominio | `git_status`, `vercel_deploy` |
| Archivo         | `kebab-case.ts`                     | `git-status.ts`               |
| Registrador     | `register<Domain>Tools`             | `registerGitTools`            |

## Validación de inputs

Siempre usar Zod en el `inputSchema` de la tool. El SDK de MCP convierte el schema automáticamente.

## Respuestas

Retornar contenido en formato MCP:

```typescript
return {
  content: [{ type: "text", text: "Resultado legible" }],
};
```

Para errores, dejar que el provider lance excepciones tipadas (`ProviderError`). La tool puede capturarlas y formatear un mensaje claro.

## Estado actual

El registry incluye herramientas Vercel de alto nivel. Ver [docs/tools/vercel.md](./tools/vercel.md).

El [Release Orchestrator](./architecture/release-orchestrator.md) coordina tools en pipelines de release.
