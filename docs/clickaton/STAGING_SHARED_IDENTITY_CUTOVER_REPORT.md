# Informe — Cutover Clickatón a identidad DNX compartida (10B.6)

**Fecha:** 2026-07-29  
**Estado final:**

```text
CLICKATON DATA MIGRATION BLOCKED
```

---

## 1–2. DB origen / destino

| Rol | Host | DB | Evidencia |
| --- | ---- | -- | --------- |
| Origen Clickatón Staging | `ep-divine-smoke-av8hmt7s-pooler` | `clickaton_staging` (doc) | health `publishedEditions: 6` |
| Destino identidad propuesto | `ep-round-fog-a4xgibtv…` | `neondb` | CLF Preview + dnx-mcp |
| FotoRank Preview actual | `ep-empty-moon-ad4teeyd…` | `neondb` | vercel env pull — **≠ destino** |

Detalle: `STAGING_SHARED_IDENTITY_DB_IDENTITY.md`

## 3. Backups

| Backup | Estado |
| ------ | ------ |
| `backup-before-identity-cutover` (origen) | **NO CREADO** — sin URL origen / sin Neon API key |
| `backup-before-clickaton-import` (destino) | **NO CREADO** — bloqueado por política (no avanzar sin origen) |

## 4. Clasificación tablas

Ver `STAGING_CUTOVER_TABLE_CLASSIFICATION.md`.

## 5–8. Usuarios / conflictos / mapa

Inventario origen **no ejecutado** (URL Encrypted vacía).  
Schema preparado:

- `ClickatonLegacyUserMap`
- `UserIdentityAlias`
- migración `20260729120000_clickaton_legacy_user_map`

CLI:

```bash
pnpm clickaton:staging:identity-cutover
```

Fail-closed sin URLs (exit 2).

## 9–12. Migraciones / import / integridad / variables

| Paso | Estado |
| ---- | ------ |
| migrate SQL mapa | **creada** (no deployada a Staging destino aún) |
| Import dominio 6 ediciones | **no ejecutado** |
| Integridad origen↔destino | **no ejecutado** |
| Update Vercel Clickatón → round-fog | **no ejecutado** (faltan backups + import) |
| Alinear FotoRank Preview → round-fog | **pendiente obligatorio** |

## 13. Sesiones

Política documentada: revocar sesiones Staging antiguas; mensaje  
“Actualizamos el sistema de cuentas. Iniciá sesión nuevamente.”

## 14–15. Commit / deploy / smoke

| Ítem | Estado |
| ---- | ------ |
| Commit selectivo tooling/docs | `43f8e30` + `7434b3f` (pushed a `migration-legacy-clf-to-monorepo`) |
| Deploy Staging cutover | **NO** — datos no migrados |
| Smoke 6 ediciones en DB compartida | **NO** |

## 16. Fixtures 1–6

**NO EJECUTADOS** — prerrequisito DB compartida real CLF+Clickatón+FotoRank.

## 17–18. FotoRank / CLF

- FotoRank Preview ≠ CLF Preview → cross-app **imposible** hoy.  
- CLF round-fog intacto (3 users seed).  
- No se modificó Production.

## 19. Warnings architecture

Pendiente clasificación detallada en iteración post-desbloqueo (7 warnings legacy 10B.5).

## 20. Mercado Pago identity

No ejecutado OAuth. Tammy no está en destino round-fog todavía.

## 21. Rollback

| Capa | Plan |
| ---- | ---- |
| App | redeploy anterior Clickatón Staging |
| Env | restaurar DATABASE_URL divine-smoke |
| DB destino | no DELETE users; revertir batch `ClickatonLegacyUserMap` |
| DB origen | mantener intacta / read-only durante validación |

## 22–27. Riesgos

1. **URL Clickatón Encrypted** — bloquea inventario/backup/import.  
2. **FotoRank Preview en otra Neon** — rompe ley de identidad.  
3. **Staging domain FotoRank** sirve deploy Production.  
4. Destino round-fog casi vacío — cutover = import grande.  
5. dawn-dew local tiene 1 ClickatonEdition — **no usar** como destino.

## 28. Estado final

`CLICKATON DATA MIGRATION BLOCKED`

### Acciones exactas para desbloquear (owner: ops)

1. Neon Console → branch `clickaton-staging` → crear backup `backup-before-identity-cutover`.  
2. Neon Console → `ep-round-fog` → backup `backup-before-clickaton-import`.  
3. Re-cargar `DATABASE_URL`/`DIRECT_URL` de `clickaton-staging` en Vercel de forma **pullable** (o exportar URL a secret manager accesible).  
4. Apuntar **FotoRank Preview** `DATABASE_URL`/`DIRECT_URL` a `ep-round-fog` (misma identidad que CLF Preview).  
5. `DNX_IDENTITY_DATABASE_URL=<round-fog> pnpm --filter @repo/db db:migrate:deploy`  
6. `CLICKATON_SOURCE_…` + `DNX_IDENTITY_…` → `pnpm clickaton:staging:identity-cutover` (dry-run → execute fase 1).  
7. Completar PHASE 2 import dominio (6 ediciones) + integrity.  
8. Update Clickatón Staging env → round-fog + redeploy.  
9. Fixtures 1–6.  
10. Recién entonces estado `DNX UNIVERSAL ACCOUNT READY IN STAGING`.

---

## Artefactos entregados en esta iteración

- `docs/clickaton/STAGING_SHARED_IDENTITY_DB_IDENTITY.md`
- `docs/clickaton/STAGING_CUTOVER_TABLE_CLASSIFICATION.md`
- `docs/clickaton/STAGING_IDENTITY_RECONCILIATION_REPORT.md`
- `docs/clickaton/STAGING_SHARED_IDENTITY_CUTOVER_REPORT.md`
- `packages/db/prisma/migrations/20260729120000_clickaton_legacy_user_map/`
- `apps/clickaton/scripts/staging-identity-cutover.ts`
- script root `pnpm clickaton:staging:identity-cutover`
