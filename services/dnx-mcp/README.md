# DNX MCP

Servidor MCP modular para administrar infraestructura y proyectos DNX.

**Ubicación en el monorepo:** `services/dnx-mcp`  
**Package:** `@dnx/dnx-mcp`  
**Ruta absoluta:** `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/services/dnx-mcp`

El MCP sigue siendo un **servicio independiente** (stdio MCP). No es una app Next.js.

## Stack

| Tecnología | Uso |
| --- | --- |
| Node.js 22+ | Runtime |
| TypeScript | Lenguaje |
| `@modelcontextprotocol/sdk` | Servidor MCP |
| Zod | Validación |
| pnpm (workspace del monorepo) | Dependencias |
| Vitest | Tests |

## Arquitectura

```text
services/dnx-mcp/
├── src/
│   ├── index.ts          # Entry point
│   ├── server/           # Servidor MCP
│   ├── tools/            # Tools expuestas al cliente
│   ├── providers/        # Integraciones externas
│   ├── orchestrators/    # Orquestación de releases
│   ├── platforms/        # Catálogo de plataformas
│   ├── brain/            # Decisiones / recomendaciones
│   ├── config/           # Env + bootstrap
│   ├── utils/
│   └── types/
├── docs/
├── tests (colocados junto al código: *.test.ts)
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Instalación

Desde la raíz de DNX Suite:

```bash
cd /Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite
pnpm install
```

Copiá variables locales (nunca commits):

```bash
cp services/dnx-mcp/.env.example services/dnx-mcp/.env.local
# Editar services/dnx-mcp/.env.local con secretos reales
```

## Comandos

Desde la raíz del monorepo:

```bash
pnpm --filter @dnx/dnx-mcp dev
pnpm --filter @dnx/dnx-mcp build
pnpm --filter @dnx/dnx-mcp start
pnpm --filter @dnx/dnx-mcp test
pnpm --filter @dnx/dnx-mcp typecheck
pnpm --filter @dnx/dnx-mcp lint
```

Atajos en la raíz:

```bash
pnpm dnx-mcp:dev
pnpm dnx-mcp:build
pnpm dnx-mcp:start
pnpm dnx-mcp:test
pnpm dnx-mcp:typecheck
```

Desde la carpeta del servicio:

```bash
cd services/dnx-mcp
pnpm dev
pnpm build && pnpm start
pnpm test
```

## Variables de entorno

Plantilla versionada: `.env.example`  
Secretos locales: `services/dnx-mcp/.env.local` (ignorado por Git)

El bootstrap carga `.env` / `.env.local` desde la raíz del package, aunque el proceso se lance desde la raíz del monorepo o desde un cliente MCP.

Variables principales: `LOG_LEVEL`, `VERCEL_*`, `CLOUDFLARE_*`, `R2_*`, `POSTGRES_URL`, `DATABASE_URL`, etc. Ver `.env.example`.

**No** centralizar secretos del MCP en `packages/` ni en apps.

## Cursor

Ejemplo estable (desarrollo con `tsx`):

```json
{
  "mcpServers": {
    "DNX MCP": {
      "command": "/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/services/dnx-mcp/node_modules/.bin/tsx",
      "args": [
        "/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/services/dnx-mcp/src/index.ts"
      ],
      "cwd": "/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/services/dnx-mcp",
      "env": {
        "NODE_ENV": "development",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

Preferible: poner tokens en `.env.local` del servicio y no duplicarlos en `mcp.json`.

Build + node:

```json
{
  "mcpServers": {
    "DNX MCP": {
      "command": "node",
      "args": [
        "/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/services/dnx-mcp/dist/index.js"
      ],
      "cwd": "/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/services/dnx-mcp"
    }
  }
}
```

Archivo típico: `~/.cursor/mcp.json`

## Claude Desktop / Claude Code

Usá el mismo `command` / `args` / `cwd` apuntando a `services/dnx-mcp`. En Claude Desktop suele vivir en `claude_desktop_config.json`.

## Verificar conexión

1. Reiniciá el servidor MCP en Cursor (Settings → MCP → refresh / restart).
2. Confirmá que aparecen las tools: `vercel_*`, `cloudflare_status`, `r2_*`, `release_*`.
3. Probá una tool read-only, p. ej. `vercel_status` o `cloudflare_status`.

## Agregar una tool nueva

1. Implementá la lógica en `src/providers/`.
2. Creá el registrador en `src/tools/<dominio>/`.
3. Registralo en el index del dominio y en `src/tools/registry.ts`.
4. Agregá tests y documentación en `docs/tools/`.

## Emergencia: volver al MCP anterior

Si algo falla tras la migración:

1. El original migrado está en: `/Users/danielcuart/Desktop/dnx-mcp-legacy-migrated` (no eliminar).
2. Respaldo de código: `/Users/danielcuart/Desktop/dnx-mcp-backup-before-monorepo`
3. Respaldo de config Cursor: `/Users/danielcuart/Desktop/dnx-mcp-config-backups/`
4. Restaurá rutas en `~/.cursor/mcp.json` hacia la carpeta legacy y reiniciá MCP.

## Tools conservadas (legacy)

Vercel: `vercel_status`, `vercel_prepare_staging`, `vercel_validate_staging`, `vercel_prepare_production_release`, `vercel_deploy_release`, `vercel_rollback_release`  
Cloudflare/R2: `cloudflare_status`, `r2_bucket_list`, `r2_bucket_validate`, `r2_bucket_create`, `r2_bucket_delete`, `r2_cors_update`, `r2_public_domain_enable`, `r2_object_upload`, `r2_object_delete`, `r2_staging_plan`, `r2_prepare_staging_bucket`, `r2_prepare_application`  
Release: `release_prepare`, `release_validate`, `release_execute`, `release_rollback`

## Google Cloud (Fase 1)

Documentación: [`docs/GOOGLE-CLOUD.md`](./docs/GOOGLE-CLOUD.md)

Tools nuevas (deshabilitadas por defecto con `DNX_GCP_ENABLED=false`):

- Diagnóstico: `gcp_check_installation`, `gcp_get_auth_status`, `gcp_list_accounts`, `gcp_get_active_account`, `gcp_run_doctor`
- Proyectos: `gcp_list_projects`, `gcp_get_project`, `gcp_get_active_project`, `gcp_set_project`, `gcp_check_billing`
- APIs: `gcp_list_enabled_services`, `gcp_list_available_services`, `gcp_plan_enable_services`, `gcp_enable_services`
- Service accounts: `gcp_list_service_accounts`, `gcp_plan_service_account`, `gcp_create_service_account`
- Secret Manager: `gcp_list_secrets`, `gcp_get_secret_metadata`, `gcp_plan_secret`, `gcp_create_secret`, `gcp_add_secret_version`

