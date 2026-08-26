# DNX Partners — ETAPA 04 / IMPLEMENTACIÓN 02 — Resultado

**Fecha:** 2026-08-03  
**Estado:** `BLOCKED`  
**Recomendación:** `BLOCKED` (staging aún no desbloqueado para migrate/deploy/shadow)

---

## Resumen

Se intentó desbloquear staging. Se crearon scripts protegidos de preflight/migración. **No** se migró ni se desplegó.

Bloqueo persistente: no hay URL staging completa y verificable en el runtime del agente.

---

## Prerrequisitos encontrados

| Variable / acceso | Estado |
|-------------------|--------|
| `CLICKATON_STAGING_DATABASE_URL` | ABSENT |
| `PARTNERS_STAGING_DATABASE_URL` | ABSENT |
| `COMMUNICATIONS_STAGING_DATABASE_URL` | ABSENT |
| `NEON_API_KEY` / `NEON_PROJECT_ID` | ABSENT |
| Neon CLI (`neon`/`neonctl`) | NO |
| `VERCEL_TOKEN` env | ABSENT (CLI login OK como `compramelafoto`) |
| `CLOUDFLARE_API_TOKEN` | ABSENT |
| Vercel link `apps/clickaton` | `clickaton-staging` / `prj_MM6Bkdi8…` |
| Root `.vercel` | `clickaton-dnxsuite` (**prod** — no usado) |

---

## Intentos de obtención de URL staging

1. Variables explícitas de proceso → ausentes.  
2. `vercel env pull --environment=production` sobre `clickaton-staging` → nombres presentes; **valores `DATABASE_URL`/`DIRECT_URL` vacíos** (sensitive).  
3. `vercel env run -e production` sin `.env.local` → `DATABASE_URL` **ABSENT**.  
4. `vercel env run` con `.env.local` → **rechazado**: host `ep-dawn-dew…` (denylist).  
5. Neon CLI/API → no disponible.

Health público staging (solo lectura):  
`https://clickaton-staging.vercel.app/api/public/health/db` → `ok:true`, hostHint `ep-round-fog…` (no sustituye credenciales).

---

## Scripts creados

| Comando | Archivo |
|---------|---------|
| `pnpm --filter @repo/db partners:staging:preflight` | `packages/db/scripts/partners-staging-preflight.mts` |
| `pnpm --filter @repo/db partners:migrate:staging -- --confirm-staging-migration --backup-ref=<id>` | `packages/db/scripts/partners-migrate-staging.mts` |
| Helpers + tests | `partners-staging-identity.mts` / `.test.ts` |

Garantías:

- Sin fallback a `DATABASE_URL`.
- Allowlist host `ep-round-fog`.
- Denylist `ep-dawn-dew` / dominio productivo.
- Migración exige `--confirm-staging-migration` **y** `--backup-ref`.
- Usa `prisma migrate deploy` (no `db push` / `migrate dev`).

Ejecución actual de preflight: `NOT_READY` / `STAGING_DATABASE_URL_absent` (esperado).

---

## Backup / migraciones / deploy

| Paso | Estado |
|------|--------|
| Backup Neon | **NO** — sin API/CLI/URL |
| Migraciones aplicadas | **NO** |
| Aislamiento WIP / worktree deploy | **NO** (bloqueado antes) |
| Deploy Clickatón staging | **NO** |
| Flags shadow runtime | **NO** |
| Shadow mínimo | **NO** |
| Deploy FotoOffice | **NO** — staging host 404; superficie `/beneficios` ausente en branch |

Producción intacta.

---

## Validaciones locales

| Check | Resultado |
|-------|-----------|
| `partners-staging-identity` tests | PASS |
| `@repo/partners` tests | 67/67 PASS (regresión) |
| Preflight sin URL | NOT_READY (correcto) |

---

## Bloqueos restantes

```text
STAGING_DATABASE_URL_UNAVAILABLE
VERCEL_SENSITIVE_DATABASE_URL_NOT_DECRYPTABLE
NEON_CLI_OR_API_UNAVAILABLE
BACKUP_UNAVAILABLE
CONFIRM_STAGING_MIGRATION_NOT_EXECUTABLE
DEPLOY_STAGING_PENDING
FOTOFFICE_STAGING_IDENTITY_UNCLEAR
PARTNERS_WIP_ISOLATION_PENDING
CLOUDFLARE_R2_TOKEN_INVALID
```

---

## Acción humana requerida

1. Exportar en el shell (sin commit):

```bash
export CLICKATON_STAGING_DATABASE_URL='postgresql://…@ep-round-fog…/neondb…'
# opcional DIRECT:
export CLICKATON_STAGING_DIRECT_URL='…'
```

2. Crear branch/snapshot Neon, p. ej. `backup-partners-stage04-pre-migrate-20260803`, y anotar el ID.  
3. Ejecutar:

```bash
pnpm --filter @repo/db partners:staging:preflight
pnpm --filter @repo/db partners:migrate:staging -- \
  --confirm-staging-migration \
  --backup-ref=<id-verificado>
```

4. Autorizar aislamiento worktree + deploy CLI solo a `clickaton-staging`.  
5. Setear flags solo staging: `AUTO_SYNC=true`, `WRITES=false`.  
6. Resolver proyecto FotoOffice staging o diferir FO.

---

## Acción legal

Sin cambios. Mantener publication/writes apagadas. Shadow ≠ aprobación legal.

## Próxima implementación

Reintentar Imp 02 (o Imp 01 shadow completo) **después** de recibir URL staging + backup ID verificable.

---

Continuación: [`PARTNERS_STAGE_04_IMPLEMENTATION_03_RESULT.md`](./PARTNERS_STAGE_04_IMPLEMENTATION_03_RESULT.md) — `BLOCKED BY OPERATOR INPUT`.
