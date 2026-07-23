# CLICKATÓN — ETAPA 10D3I-D4 — DRY-RUN, BACKFILL TEST Y PREFER TEMPORAL

**Fecha:** 2026-07-22  
**Rama:** `migration-legacy-clf-to-monorepo`  
**HEAD base:** `b066a48`  
**Veredicto:** **VALIDADO — PREFER FUNCIONA, ACUERDO 1:N PENDIENTE**

## Fingerprint staging

| Campo | Valor |
|---|---|
| Host | `ep-divine-smoke-av8hmt7s*` |
| Database | `clickaton_staging` |
| Migrations | 64/64 up to date |
| FI tables | presentes |
| Backup | `pre-10d3i-financial-identity` |

## Vault TEST

- Clave: `DNX_FINANCIAL_CREDENTIAL_MASTER_KEY_TEST` generada para sesión D4 en `.local/audit-10d3i-d4/` (ignorada por Git).
- Versión: `v1`.
- No se usó clave PROD.
- No se persistió clave en Vercel ni en Git.

## Flags

| Momento | READ_MODE | BACKFILL | WRITE | FI_ONLY | Orders 1:N |
|---|---|---|---|---|---|
| Inicial | LEGACY_ONLY | off | off | off | off |
| Apply CLI (temporal) | LEGACY_ONLY | on (solo proceso) | off | off | off |
| PREFER smoke | PREFER (solo flags de proceso) | off | off | off | off |
| Final | LEGACY_ONLY | off | off | off | off |

Vercel no modificado.

## Dry-run

Fuente remota (`--remote`) contra staging.

| Clasificación | User | Lab | All |
|---|---:|---:|---:|
| ELIGIBLE | 2 | 0 | 2 |
| ALREADY_MIGRATED | 0 | 0 | 0 |
| CONFLICT_* | 0 | 0 | 0 |
| INCOMPLETE | 0 | 0 | 0 |
| REVIEW_REQUIRED | 0 | 0 | 0 |
| SKIPPED | 0 | 0 | 0 |

## Contaminación TEST/PROD

**NO DETECTADA** en filas MP: tokens `TEST-*`, provider IDs `TEST_STAGING_*`, emails testish (`testuser.com` / `example.test`). Sin Labs reales.

## Fixtures TEST creados en staging

| Rol | userId | Tipo | Real |
|---|---:|---|---|
| Migrate target | 1 | User TEST con MP ficticio | no |
| Fallback unmigrated | 2 | User TEST con MP ficticio | no |

Sin Dani/Rodri/Tammy. Sin Labs.

## Apply

- `--remote --apply --environment=test --source=user --user-id=1 --limit=1 --confirm-staging`
- Resultado: written=1 (identity + account + encrypted credential)
- Idempotencia: segundo apply → `ALREADY_MIGRATED`, written=0

| Entidad | Cantidad |
|---|---:|
| DnxFinancialIdentity | 1 |
| DnxPaymentAccount | 1 |
| DnxEncryptedCredential | 1 |
| DnxEconomicAgreement | 0 |
| DnxFinanceGrant | 0 |

Legacy `User.mp*` intacto (mismo token TEST).

## Dual-read smokes

| Prueba | Resultado |
|---|---|
| LEGACY_ONLY user 1 | `source=legacy_user` ok |
| PREFER user 1 (migrado) | `source=financial_identity` ok; provider coincide |
| PREFER user 2 (no migrado) | `usedLegacyFallback=true`, `source=legacy_user` |
| Conflicto (providerUserId divergente) | `CONFLICT` / `conflict_blocked` |
| Rollback account | status `DISABLED`; legacy sigue ok |

## Código

- CLI `--remote` + gate `ep-divine-smoke-av8hmt7s*` / `clickaton_staging`
- Prisma loader/hydrate/persist para backfill
- Smoke CLI `financial-identity:smoke-dual-read-staging`
- Resolver: conflicto si legacy≠account/vault o vault≠account `providerUserId`

## Seguridad

- Reportes en `.local/audit-10d3i-d4/` (ignorado)
- Sin tokens/emails/ciphertext en docs
- Sin push; producción intacta
- PREFER no quedó activo en runtime/Vercel

## Caso Rodrigo

- Consultado: no  
- Migrado: no  
- Siguiente etapa: pendiente (10D3I-E)

## Próximo paso (no iniciado)

**CLICKATÓN — ETAPA 10D3I-E — CONFIGURACIÓN DE SOCIOS, CUENTAS Y ACUERDO ECONÓMICO 1:N EN STAGING**

Sin Orders 1:N productivo. Sin porcentajes reales hasta autorización.
