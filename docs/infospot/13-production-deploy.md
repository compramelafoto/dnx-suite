# Info Spot — Deploy y migraciones (PASO 9)

## Plataforma

Mismo patrón que ComprameLaFoto / FotoRank: **Vercel** (monorepo pnpm).

| Ítem | Valor |
| --- | --- |
| Root Directory | `apps/infospot` |
| Install | `cd ../.. && pnpm install` (ver `vercel.json`) |
| Build | `cd ../.. && pnpm --filter infospot build` |
| Output | Next.js default (`.next`) |
| Framework | Next.js |
| Puerto local | **3004** (`next dev --port 3004`) — no usar en prod |
| Healthcheck | `GET /api/health` |

## Dominio

Pendiente de confirmación. Configurar:

- DNS → proyecto Vercel Info Spot  
- `NEXT_PUBLIC_INFOSPOT_URL=https://<dominio-final>`  
- `InfoSpotSettings.publicUrl` alineada en `/admin/configuracion`

**No desplegar** hasta tener dominio + credenciales confirmadas.

## Variables de entorno (prod)

Ver también `docs/infospot/10-launch-checklist.md`.

Obligatorias / críticas:

- `DATABASE_URL` / `DIRECT_URL` (Postgres prod)
- `NEXT_PUBLIC_INFOSPOT_URL`
- `COOKIE_DOMAIN` — **no** en el primer deploy `*.vercel.app` (cookie host-only). Configurar solo con dominio propio si hace falta SSO entre subdominios (p. ej. `.dnxsuite.com`)
- `CLF_READONLY_DATABASE_URL` (SELECT CLF real; nunca write; nunca migrate)
- `COMPRAMELAFOTO_PUBLIC_URL`
- Secretos de sesión compartida `@repo/auth` / `dnx_session` (mismos que el ecosistema DNX)
- R2: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, bucket, `R2_PUBLIC_URL`
- `INFOSPOT_IP_HASH_SALT`

Ver también `docs/infospot/17-remote-access.md`.

No en prod: `ALLOW_INFOSPOT_DEMO_SEED`

## Comandos de deploy (cuando esté autorizado)

```bash
# 1) Diagnóstico migraciones (solo lectura) — ver sección abajo
# 2) Migrar prod SOLO tras diagnóstico OK
pnpm --filter @repo/db exec prisma migrate deploy

# 3) Deploy Vercel (CLI o Git integration)
# Root: apps/infospot — build vía vercel.json

# 4) Post-deploy
curl -sS https://<dominio>/api/health
curl -sS https://<dominio>/robots.txt
curl -sS https://<dominio>/sitemap.xml | head
```

## Diagnóstico migraciones (ANTES de escribir en prod)

### Checksum local de la migración pedida

Archivo: `packages/db/prisma/migrations/20260708150000_organizer_direct_mp_commission_ledger/migration.sql`

```
SHA-256: f609ab9c28d6d3623724451405f5557ac805ac7cc7d28fc43dcb426b8ecbf2d6
```

### Migraciones Info Spot en el repo

- `20260709210000_add_infospot_editorial_cms`
- `20260710010000_add_infospot_article_assets`
- `20260710180000_add_infospot_events_mvp`
- `20260710190000_infospot_launch_readiness`

### Qué falta ejecutar (manual, con credenciales prod)

Conectar a **producción** y **staging** por separado (no asumir mismo historial):

```sql
-- En cada entorno:
SELECT migration_name, checksum, finished_at, rolled_back_at
FROM "_prisma_migrations"
ORDER BY finished_at;

SELECT migration_name, checksum
FROM "_prisma_migrations"
WHERE migration_name = '20260708150000_organizer_direct_mp_commission_ledger';
```

Comparar:

1. Que el checksum de prod coincida con el SHA local de arriba.  
2. Que staging y prod tengan el mismo conjunto de migraciones aplicadas (o documentar divergencias).  
3. Si hay mismatch de checksum → **no** `migrate deploy`, **no** reset, **no** db push; diagnosticar primero.

**Estado PASO 9:** no se escribió en producción. El `.env` local de `packages/db` apunta al entorno de desarrollo/staging; **no se inspeccionó `_prisma_migrations` de producción** por falta de `DATABASE_URL` de prod en esta sesión.

## Sesión compartida

Cookie `dnx_session` vía `@repo/auth`. Roles `INFOSPOT_DIRECTOR` / `INFOSPOT_REDACTOR`.  
Alinear dominio de cookie / secretos con el resto del suite al colgar el dominio público.
