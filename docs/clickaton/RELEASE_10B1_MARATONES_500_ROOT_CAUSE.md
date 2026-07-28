# RELEASE 10B.1 — Root cause `/maratones` 500

## Causa raíz

**Prisma Query Engine ausente en el bundle de Vercel** (`rhel-openssl-3.0.x`), no un fallo de datos ni de SQL de listado.

Mensaje sanitizado (vía `/api/public/health/db`):

```text
PrismaClientInitializationError
Prisma Client could not locate the Query Engine for runtime "rhel-openssl-3.0.x".
```

## Evidencia

1. Staging Vercel usaba (tras corrección) host `ep-divine-smoke-av8hmt7s-pooler` / DB `clickaton_staging`.
2. La misma query `clickatonEdition.findMany/count` contra esa Neon **OK en local** (6 ediciones publicadas).
3. Home devolvía 200 porque `UpcomingEventsSection` captura errores Prisma y muestra empty state; `/maratones` no captura → 500.
4. Migraciones en Staging: aplicadas (85) **antes** del fix de engine; el 500 persistía con DB correcta.
5. Confusión previa: migraciones 10B se aplicaron a `ep-dawn-dew…/neondb` (local), **no** a Staging real.

## Corrección

1. Identificar Neon Staging real y aplicar `prisma migrate deploy` allí (con backup branch).
2. Reescribir `DATABASE_URL` + `DIRECT_URL` en Vercel Staging hacia `clickaton_staging`.
3. `binaryTargets = ["native", "rhel-openssl-3.0.x"]` en `packages/db/prisma/schema.prisma`.
4. Clickatón `next.config.ts`:
   - `serverExternalPackages: ["@prisma/client", "@repo/db"]`
   - quitar `@repo/db` de `transpilePackages` (conflicto)
   - `outputFileTracingRoot` + `outputFileTracingIncludes` para engines pnpm
5. Endpoint diagnóstico: `GET /api/public/health/db` (sin secretos).

## Test / smoke

| Check | Resultado post-fix |
|-------|---------------------|
| `GET /api/public/health/db` | `ok: true`, `publishedEditions: 6`, host `ep-divine-smoke…` |
| `GET /maratones` | **200**, HTML contiene ediciones `smoke-mp-test-*` |
| Cron sin secret | **401** |
| MP connect sin sesión | **401** `UNAUTHENTICATED` |

## Riesgo

- Redeploy Production **sin** la misma corrección de engine + DB correcta rompería `maratonfotografica.com`.
- No existe Neon “clickaton-production” en la org auditada → Production DB identity pendiente.
