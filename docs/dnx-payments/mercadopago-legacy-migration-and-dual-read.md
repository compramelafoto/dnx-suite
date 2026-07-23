# Mercado Pago legacy migration + dual-read (10D3I-D)

## Arquitectura

```
User.mp* / Lab.mp*  (legacy, intacto)
        │
        ├─ backfill (dry-run / apply controlado)
        ▼
DnxFinancialIdentity → DnxPaymentAccount → DnxEncryptedCredential (AES-256-GCM)
        │
        └─ dual-read resolver (flag)
              ├─ LEGACY_ONLY
              ├─ PREFER_FINANCIAL_IDENTITY (fallback legacy)
              └─ FINANCIAL_IDENTITY_ONLY (no default)
```

## Vault

- Algoritmo: AES-256-GCM
- Nonce 12 bytes único por secreto
- Auth tag GCM
- `keyVersion` en registro
- Master key solo env:
  - `DNX_FINANCIAL_CREDENTIAL_MASTER_KEY_TEST` (TEST)
  - `DNX_FINANCIAL_CREDENTIAL_MASTER_KEY` (PROD)
  - `DNX_FINANCIAL_CREDENTIAL_KEY_VERSION` (default `v1`)
- Fail closed si falta clave / tag inválido / key incorrecta
- Nunca plaintext en DB, logs ni APIs públicas

## Feature flags

| Flag | Default | Valores |
|---|---|---|
| `DNX_FINANCIAL_IDENTITY_READ_MODE` | `LEGACY_ONLY` | `LEGACY_ONLY` \| `PREFER_FINANCIAL_IDENTITY` \| `FINANCIAL_IDENTITY_ONLY` |
| `DNX_FINANCIAL_IDENTITY_WRITE_ENABLED` | off | truthy |
| `DNX_FINANCIAL_IDENTITY_BACKFILL_ENABLED` | off | truthy |

Valor inválido → `LEGACY_ONLY`.

## Backfill CLI

```bash
pnpm --filter @repo/payments financial-identity:backfill-mp -- --dry-run --fixture
pnpm --filter @repo/payments financial-identity:backfill-mp -- --apply --fixture --environment=test
```

Remote apply (no autorizado en 10D3I-D salvo staging `ep-round-fog*` confirmado):

```bash
DNX_FINANCIAL_IDENTITY_BACKFILL_ENABLED=true \
pnpm --filter @repo/payments financial-identity:backfill-mp -- \
  --apply --confirm-staging --environment=test
```

Clasificaciones: `ELIGIBLE`, `ALREADY_MIGRATED`, `CONFLICT_PROVIDER_ID`, `CONFLICT_IDENTITY`, `INCOMPLETE`, `ENVIRONMENT_UNKNOWN`, `REVIEW_REQUIRED`, `SKIPPED`.

## Dual-read CLF

Hook: `apps/compramelafoto/lib/mercadopago/financial-identity-dual-read.ts`
Usado por `resolveAlbumOrderMercadoPagoCredentials` (fotógrafo + organizador).

Con `LEGACY_ONLY` el comportamiento es idéntico al histórico.

## Rollback

1. Set `DNX_FINANCIAL_IDENTITY_READ_MODE=LEGACY_ONLY`
2. CLF vuelve a `User.mp*` / `Lab.mp*`
3. Opcional: `rollbackMigratedPaymentAccount` → status `DISABLED`
4. No revocar tokens MP, no borrar columnas legacy, no borrar audit

## Staging (actualizado 10D3I-D2)

| Host | Clasificación | Evidencia |
|---|---|---|
| `ep-round-fog*` | **CLF_PREVIEW_CONFIRMED** + candidato DNX Payments | Vercel `compramelafoto-dnxsuite` Preview; fingerprint read-only (45 migraciones; `DnxPaymentIntent` sí; tablas 10D3I-C/D **no**; 3 users testish) |
| `ep-falling-darkness*` | **PRODUCTION_CONFIRMED** (CLF) | Vercel `compramelafoto-dnxsuite` Production |
| `ep-dawn-dew*` | **PRODUCTION_CONFIRMED** (FotoRank) / **AMBIGUOUS_DO_NOT_USE** | Vercel `fotorank-dnxsuite` Production; InfoSpot histórico |
| `clickaton-staging` DB | **AMBIGUOUS_DO_NOT_USE** | `DATABASE_URL` tipo `sensitive`; pull CLI vacío; host desconocido |

**Decisión 10D3I-D2:** `NO_STAGING_INEQUÍVOCO` — no migrate remoto, no PREFER, no backfill apply.

Detalle: [`docs/clickaton/FINANCIAL_IDENTITY_STAGING_ACTIVATION_10D3I_D2.md`](../clickaton/FINANCIAL_IDENTITY_STAGING_ACTIVATION_10D3I_D2.md).

### Fingerprint `ep-round-fog*` (sanitizado)

- DB `neondb` / schema `public`
- `_prisma_migrations`: 45; head `20260715170000_dnx_payments_core_persistence`
- FI tables: ausentes
- Users/Labs: 3/1; MP token presente en 1 user; emails testish 3/3

### Bloqueo Clickatón

Sin host inequívoco de `clickaton-staging` no se puede afirmar `SHARED_DNX_STAGING_CONFIRMED`. Financial Identity no debe duplicarse en una DB Clickatón separada sin decisión explícita.

## Runbook (resumen)

1. Identificar staging inequívoco (CLF `ep-round-fog*` **y** Clickatón alineado) — **pendiente D2**
2. Dry-run fixture local
3. Aplicar migraciones 10D3I-C/D solo en staging confirmado
4. Dry-run DB (sin apply) → revisar conflictos
5. Apply lote pequeño TEST
6. Smoke LEGACY_ONLY → PREFER → rollback LEGACY_ONLY
