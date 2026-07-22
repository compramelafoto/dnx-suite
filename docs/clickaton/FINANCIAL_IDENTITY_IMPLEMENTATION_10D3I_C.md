# CLICKATÓN — ETAPA 10D3I-C — IMPLEMENTACIÓN FINANCIAL IDENTITY

## Resumen

Implementación del núcleo transversal Financial Identity + Economic Agreement según diseño 10D3I-B aprobado.

## Archivos principales

### Persistencia (`@repo/db`)

- `packages/db/prisma/schema.prisma` — modelos `DnxFinancialIdentity`, `DnxPaymentAccount`, `DnxEconomicAgreement`, participantes, versiones, reglas, snapshots, grants, bridge recipient
- `packages/db/prisma/migrations/20260722220000_add_financial_identity_and_economic_agreements/migration.sql`

### Dominio (`@repo/payments`)

- `src/financial-identity/*` — identidad + cuentas + store memoria
- `src/economic-agreement/*` — acuerdos, versiones, publish, snapshots
- `src/distribution/snapshot.ts` — builder tipado + JSON compatible
- `src/finance-permissions/*` — grants/policies
- `src/legacy/clf/*` — mapper dry-run `User.mpUserId` → candidate
- `src/bridges/to-dnx-payments.ts` — bridges a Recipient / engine
- `src/testing/financial-fixtures.ts` — Dani/Rodri/Tammy Test

### Docs

- `docs/dnx-payments/financial-identity-domain.md`
- `docs/architecture/decisions/0002-financial-identity-and-economic-agreements.md`
- este documento

## Migración

| Campo | Valor |
|---|---|
| Nombre | `20260722220000_add_financial_identity_and_economic_agreements` |
| Tipo | Aditiva |
| Producción | **No aplicada** |
| Neon `.env` local (`ep-dawn-dew`) | **No aplicada** (host ≠ staging documentado `ep-round-fog`) |
| Validación | `prisma format` + `prisma validate` + `prisma generate` OK |

## Tests

Suite Node test en `@repo/payments`:

- FinancialIdentity
- EconomicAgreement (+ authz + versionado)
- Snapshot
- Finance permissions
- CLF legacy dry-run

## Qué NO se activó

- Orders API Split 1:N en ventas Clickatón
- Cambio de checkout Clickatón / CLF Preferences
- Dual-read runtime de `User.mp*`
- Migración/copia de tokens
- OAuth real / cuentas MP reales
- UI pública
- Settlements / refunds / chargebacks
- Feature flags productivos
- Deploy / push

## `User.mp*`

Permanece intacto. Sin backfill. Preparado mapper dry-run para 10D3I-D.

## Asignación de permisos (staging, documental)

```sql
-- Ejemplo (no ejecutar en Production desde esta etapa):
-- INSERT INTO "DnxFinanceGrant" (id, "userId", capability, "productKey", status, "createdAt", "updatedAt")
-- VALUES ('...', <userId>, 'DNX_FINANCE_OWNER', NULL, 'ACTIVE', NOW(), NOW());
```

No usar email en guards. Resolver `userId` offline y grabar grant explícito.

## Siguiente etapa

**10D3I-D — Migración segura y dual-read de cuentas Mercado Pago legacy**
