# Evidencia de migración staging — Etapa 03 Imp. 02

Fecha: 2026-08-01  
Operación: `prisma migrate deploy`  
Herramienta: Prisma 6.19.2 via `packages/db`

## Identidad del entorno (sanitizada)

| Campo | Valor |
|-------|--------|
| App staging | `clickaton-staging` / `https://clickaton-staging.vercel.app` |
| Proyecto Neon | `fragrant-union-80829821` — **dnx-suite-staging** |
| Host fingerprint | `ep-round-fog…` |
| Database | `neondb` |
| Fuente URL ops | `packages/db/.env.cutover.local` → `DNX_IDENTITY_DATABASE_URL` / `DIRECT_URL` |
| ¿Producción (`ep-dawn-dew` / clickaton-production)? | **No** |
| Health pre/post | `publishedEditions: 11`, host `ep-round-fog-a4xgibtv-pooler` |

## Precheck

```
environment=staging_identity_ep_round_fog
denylistProd=false
pendingMigrations=5
backupBranch=backup-before-ux03-cover-vertical-20260801 (br-plain-dawn-a4fx8igt)
```

## Estado previo

Migraciones pendientes:

1. `20260731170000_clickaton_edition_status_reprogrammed`
2. `20260801010000_clickaton_edition_cover_vertical`
3. `20260801120000_dnx_communication_webhook_events`
4. `20260801180000_clickaton_home_banners`
5. `20260801200000_clickaton_home_banner_carousel_settings`

## Acción ejecutada

```text
pnpm exec prisma migrate deploy
# Datasource: neondb @ ep-round-fog-a4xgibtv… (staging identity)
# duration_s ≈ 13
```

## Estado posterior

```text
All migrations have been successfully applied.
Database schema is up to date!
```

## Verificación columna

```text
coverImageVerticalUrl | text | YES | null default
published_editions = 11
non_null_vertical = 0
```

## Confirmación producción

| Superficie | Resultado |
|------------|-----------|
| Migración sobre `ep-dawn-dew` | No ejecutada |
| Proyecto Neon `clickaton-production` | No tocado |
| Alias `maratonfotografica.com` | Siguió en deploy Ready previo (`dpl_85Ahn…`); intento erróneo de deploy quedó en **Error** sin promoción |

## Secretos

- No se registran `DATABASE_URL` completas, passwords ni tokens en este documento.
- `vercel env pull` devolvió placeholders vacíos para secrets Sensitive; no se usó.
