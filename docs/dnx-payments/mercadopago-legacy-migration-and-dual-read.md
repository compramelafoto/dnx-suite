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

Remote dry-run / apply (staging confirmado `ep-divine-smoke-av8hmt7s*` / `clickaton_staging`):

```bash
# Dry-run
pnpm --filter @repo/payments exec tsx src/cli/backfill-mp-legacy.ts \
  --remote --dry-run --confirm-staging --environment=test --source=all

# Apply controlado
DNX_FINANCIAL_IDENTITY_BACKFILL_ENABLED=true \
pnpm --filter @repo/payments exec tsx src/cli/backfill-mp-legacy.ts \
  --remote --apply --confirm-staging --environment=test \
  --source=user --user-id=<id> --limit=1
```

Host gate: `ep-divine-smoke-av8hmt7s*` (preferido) o `ep-round-fog*` (legacy docs). Bloquea `ep-dawn-dew*` / `ep-falling-darkness*`.

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

## Staging (actualizado 10D3I-D3)

| Host | Clasificación | Evidencia |
|---|---|---|
| `ep-divine-smoke-av8hmt7s*` | **Histórica (10D3I-D3)** — Clickatón staging documentado entonces | Neon project/branch `clickaton-staging`; DB `clickaton_staging`; migrate C/D aplicados 10D3I-D3 |
| `ep-round-fog*` | **Vigente Imp09** para runtime Vercel `clickaton-staging` (health `ep-round-fog*-pooler` / `neondb`); también CLF preview compartido | Ver `docs/infrastructure/DATABASE_IDENTITIES.md` — no asumir `ep-divine-smoke` sin revalidar |
| `ep-falling-darkness*` | **PRODUCTION_CONFIRMED** (CLF) | Vercel `compramelafoto-dnxsuite` Production |
| `ep-dawn-dew*` | **PRODUCTION_CONFIRMED** (FotoRank) / **NO USAR** | Vercel `fotorank-dnxsuite` Production |

**Decisión 10D3I-D3:** migraciones 10D3I-C/D **aplicadas** en `ep-divine-smoke*` / `clickaton_staging`.
**Decisión 10D3I-D4:** dry-run + backfill TEST `limit=1` + PREFER temporal validado; runtime final `LEGACY_ONLY`.

Detalle apply: [`docs/clickaton/FINANCIAL_IDENTITY_MIGRATION_APPLY_10D3I_D3.md`](../clickaton/FINANCIAL_IDENTITY_MIGRATION_APPLY_10D3I_D3.md).
Detalle D4: [`docs/clickaton/FINANCIAL_IDENTITY_BACKFILL_AND_DUAL_READ_10D3I_D4.md`](../clickaton/FINANCIAL_IDENTITY_BACKFILL_AND_DUAL_READ_10D3I_D4.md).
Auditoría D2 (bloqueo previo): [`docs/clickaton/FINANCIAL_IDENTITY_STAGING_ACTIVATION_10D3I_D2.md`](../clickaton/FINANCIAL_IDENTITY_STAGING_ACTIVATION_10D3I_D2.md).

### Fingerprint post-D4 `ep-divine-smoke*`

- DB `clickaton_staging` / schema `public`
- `_prisma_migrations`: 64; up to date
- FI: 1 identity / 1 account (`DISABLED` tras rollback TEST) / 1 encrypted credential
- Backup branch Neon: `pre-10d3i-financial-identity`
- CLI remoto: `--remote` + host gate `ep-divine-smoke-av8hmt7s*`

### Post-10D3I-E (acuerdo socios TEST)

- +3 identities / +3 PaymentAccount TEST / 1 agreement ACTIVE / versión PUBLISHED 3400/3300/3300
- 1 snapshot 100000 ARS; Orders 1:N solo dry-run local
- Grant `DNX_FINANCE_OWNER` Dani; runtime FI sigue `LEGACY_ONLY`
- Doc: [`docs/clickaton/ECONOMIC_AGREEMENT_1N_STAGING_10D3I_E.md`](../clickaton/ECONOMIC_AGREEMENT_1N_STAGING_10D3I_E.md)

## Runbook (resumen)

1. Identificar staging inequívoco — **confirmado** `ep-divine-smoke-av8hmt7s*` / `clickaton_staging`
2. Dry-run fixture local
3. Aplicar migraciones 10D3I-C/D solo en staging confirmado
4. Dry-run DB (sin apply) → revisar conflictos
5. Apply lote pequeño TEST
6. Smoke LEGACY_ONLY → PREFER → rollback LEGACY_ONLY
7. (10D3I-E) Configurar acuerdo socios TEST vía CLI `economic-agreement:configure-clickaton-staging` — **sin Orders real**
