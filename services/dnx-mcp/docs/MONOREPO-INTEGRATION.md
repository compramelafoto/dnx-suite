# Clasificación de dependencias del MCP (post-migración)

## Mantener dentro de `services/dnx-mcp`

- Registro de tools MCP (`src/tools`)
- Servidor MCP (`src/server`, `src/index.ts`)
- Seguridad / guards / auditoría específicas del MCP
- Adaptadores de infraestructura (providers Vercel, Cloudflare, Git, Postgres, Prisma)
- Configuración de clientes MCP
- Ejecutores de comandos (git/prisma executors)
- Políticas de confirmación y orchestrators de release
- Brain / decision engine del MCP

## Potencialmente compartir en una fase futura (vía `packages/`)

- Tipos de dominio de plataformas
- Acceso a base de datos (`@repo/db`) — solo si se define un contrato estable
- Autenticación (`@repo/auth`) — no acoplar al MCP sin necesidad
- Schemas comunes (Zod compartidos)
- Logging unificado
- Configuración de aplicaciones
- Clientes internos reutilizables

## Reglas

- No importar directamente desde `apps/*`
- Dependencias compartidas solo desde `packages/*`
- No centralizar secretos del MCP en packages compartidos
- No migrar Google Cloud en esta etapa
