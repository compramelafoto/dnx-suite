# DNX MCP en el monorepo

DNX MCP vive en `services/dnx-mcp` como servicio independiente dentro de DNX Suite.

## Qué es

Servidor MCP (Model Context Protocol) para operar infraestructura y releases DNX (Vercel, Cloudflare R2, orquestación de release, etc.).

No es una aplicación Next.js y no debe colocarse bajo `apps/`.

## Ubicación

```text
/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/services/dnx-mcp
```

Package workspace: `@dnx/dnx-mcp`

## Comandos rápidos

```bash
pnpm --filter @dnx/dnx-mcp install   # vía pnpm install en la raíz
pnpm --filter @dnx/dnx-mcp dev
pnpm --filter @dnx/dnx-mcp build
pnpm --filter @dnx/dnx-mcp test
pnpm --filter @dnx/dnx-mcp typecheck
```

Documentación completa del servicio: [`services/dnx-mcp/README.md`](../services/dnx-mcp/README.md)

## Secretos

- Plantilla: `services/dnx-mcp/.env.example`
- Secretos locales: `services/dnx-mcp/.env.local` (fuera de Git)
- No copiar credenciales a `packages/` ni a configs versionadas

## Clientes

Actualizar Cursor / Claude para apuntar a `services/dnx-mcp` (ver README del servicio).

## Relación con el monorepo

Hoy el MCP **no** importa código desde `apps/`. En fases futuras podría reutilizar tipos o utilidades desde `packages/`, sin acoplarse a una app concreta.

### `turbo.json` raíz

Las entradas `DATABASE_URL` y `DIRECT_URL` en `globalEnv` del `turbo.json` raíz son para apps/Prisma del monorepo (invalidación de caché). **No** son secretos (solo nombres) y **no** son específicas de DNX MCP; el servicio usa su propio `.env.local`.

## Rollback

Ver sección de emergencia en `services/dnx-mcp/README.md`. Respaldos locales fuera del monorepo:

- `/Users/danielcuart/Desktop/dnx-mcp-backup-before-monorepo`
- `/Users/danielcuart/Desktop/dnx-mcp-config-backups/`
- carpeta legacy post-migración: `/Users/danielcuart/Desktop/dnx-mcp-legacy-migrated`
