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

## Staging

DNX Payments staging documentado: Neon `ep-round-fog*`.
`ep-dawn-dew` es ambiguo (InfoSpot / riesgo prod histórico) — **no** aplicar migraciones allí sin autorización explícita.

## Runbook (resumen)

1. Identificar staging (`ep-round-fog` + evidencia)
2. Dry-run fixture local
3. Aplicar migraciones 10D3I-C/D solo en staging confirmado
4. Dry-run DB (sin apply) → revisar conflictos
5. Apply lote pequeño TEST
6. Smoke LEGACY_ONLY → PREFER → rollback LEGACY_ONLY
