# ComprameLaFoto — monorepo

App Next.js de ComprameLaFoto dentro del monorepo DNX Suite.

## Estado

| Fase | Descripción |
|------|-------------|
| **Oleada 0** ✅ | Esqueleto: config, bridges (`lib/prisma`, `lib/auth`), middleware, página mínima |
| **Oleada 1+** | Import progresivo desde legacy Desktop |

**Fuente legacy:** `/Users/danielcuart/Desktop/compramelafoto`  
**Plan:** [`docs/architecture/migration/22-code-import-execution-plan.md`](../../docs/architecture/migration/22-code-import-execution-plan.md)  
**Reporte Oleada 0:** [`docs/architecture/migration/23-code-import-wave0-report.md`](../../docs/architecture/migration/23-code-import-wave0-report.md)

## Desarrollo

```bash
# Desde la raíz del monorepo
pnpm install
pnpm --filter compramelafoto dev    # http://localhost:3002
pnpm --filter compramelafoto build
pnpm --filter compramelafoto lint
pnpm --filter compramelafoto typecheck
```

## Variables de entorno

Copiar `.env.example` → `.env.local` en esta carpeta. La `DATABASE_URL` apunta al mismo PostgreSQL que `@repo/db` (`packages/db`).

Prisma CLI **no** vive en esta app:

```bash
pnpm --filter @repo/db run db:generate
```

## Paquetes workspace

| Paquete | Uso en app |
|---------|------------|
| `@repo/db` | Prisma vía `lib/prisma.ts` |
| `@repo/auth` | Sesiones `dnx_session` vía `lib/auth.ts` |
| `@repo/auth-guards` | Reexport en `lib/auth-guards.ts` |
| `@repo/design-system` | `ComprameLaFotoDesignProvider` |

## Deploy

**No deployar** hasta completar oleadas de import y validar rutas API/crons. `vercel.json` conserva crons legacy para cuando existan las rutas.

## Archive (no usar como base)

```
apps/_archive/compramelafoto-monorepo-stale-2026-07/
```

Tag de referencia: `clf/monorepo-pre-legacy-import`
