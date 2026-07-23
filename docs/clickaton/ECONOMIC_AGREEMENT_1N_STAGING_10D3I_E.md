# CLICKATÓN — ETAPA 10D3I-E — ACUERDO ECONÓMICO 1:N EN STAGING

**Fecha:** 2026-07-22  
**Rama:** `migration-legacy-clf-to-monorepo`  
**HEAD base:** `a1445ad`  
**Veredicto:** **VALIDADO — ACUERDO 1:N STAGING LISTO**

## Fingerprint staging

| Campo | Valor |
|---|---|
| Host | `ep-divine-smoke-av8hmt7s*` |
| Database | `clickaton_staging` |
| Migrations | 64/64 |
| Runtime FI | `LEGACY_ONLY` |
| Orders 1:N real | DESACTIVADO |

## Usuarios / fixtures

No había usuarios staging inequívocos para Dani/Rodrigo/Tamara. Se crearon fixtures TEST:

| Participante | Tipo | User staging | Classification |
|---|---|---:|---|
| Dani | fixture TEST | 3 | USER_FIXTURE_CREATED → confirmado en re-run |
| Rodrigo | fixture TEST | 4 | USER_FIXTURE_CREATED |
| Tamara | fixture TEST | 5 | USER_FIXTURE_CREATED |
| Admin Clickatón sin finance | fixture TEST | 6 | USER_FIXTURE_CREATED |

Emails: dominio `clickaton.staging.test` (prefijo `e10*`). Sin `User.mp*`. Sin OAuth. Sin emails productivos en reportes.

## Financial Identities + Payment Accounts TEST

| Participante | Identity | Provider | Environment | Status | providerUserId (ficticio) |
|---|---|---|---|---|---|
| Dani | PERSON primary | MERCADOPAGO | TEST | ACTIVE | `TEST_E10_DANI` |
| Rodrigo | PERSON primary | MERCADOPAGO | TEST | ACTIVE | `TEST_E10_RODRI` |
| Tamara | PERSON primary | MERCADOPAGO | TEST | ACTIVE | `TEST_E10_TAMMY` |

Credential refs opacas vault TEST (sin tokens productivos). Filas D4 (user 1) intactas (account DISABLED).

## Grants

| Participante | Capability | Scope |
|---|---|---|
| Dani | `DNX_FINANCE_OWNER` | clickaton / STAGING_TEST / partners-10d3i-e |
| Rodrigo | PARTICIPANT_SELF (ownership identity) | — |
| Tamara | PARTICIPANT_SELF (ownership identity) | — |
| Admin Clickatón | ninguno financiero | — |

Autorización runtime por `userId` + grants + ownership. **No** por email.

## Economic Agreement

| Campo | Valor |
|---|---|
| productKey | `clickaton` |
| scopeType | `STAGING_TEST` |
| scopeId | `partners-10d3i-e` |
| name | Clickatón — Acuerdo socios TEST |
| status | ACTIVE |
| environment conceptual | TEST |

### Participantes

| Socio | roleLabel | status | cuenta |
|---|---|---|---|
| Dani | PARTNER | ACCEPTED/ACTIVE | TEST propia |
| Rodrigo | PARTNER | ACCEPTED/ACTIVE | TEST propia |
| Tamara | PARTNER | ACCEPTED/ACTIVE | TEST propia |

### Distribution Version 1

| Participante | Bps | % |
|---|---:|---:|
| Dani | 3400 | 34% |
| Rodrigo | 3300 | 33% |
| Tamara | 3300 | 33% |
| **Total** | **10000** | **100%** |

Status: `PUBLISHED` + `rulesHash`. Inmutable (re-publish DRAFT-only).

### Snapshot TEST (100000 ARS)

| Participante | Importe |
|---|---:|
| Dani | 34000 |
| Rodrigo | 33000 |
| Tamara | 33000 |
| **Total** | **100000** |

Sin tokens, sin `credentialReference`, sin emails en payload.

## Bridge DNX Payments + Orders mock

- Bridges: identity → recipient draft; account → provider account draft; rules → engine input.
- Orders 1:N: **SIMULADO — NO ENVIADO** (`buildOrders1nDryRun`).
- Orders 1:N real: **DESACTIVADO**.

## Permisos validados

| Probe | Resultado |
|---|---|
| Dani crea / publica | permitido |
| Rodrigo/Tamara assign own account | permitido |
| Rodrigo/Tamara publican | bloqueado |
| Admin Clickatón sin grant publica | bloqueado |
| Acceso cruzado a identity ajena | bloqueado |

## UI financiera

**NO IMPLEMENTADA — CLI/SERVICIO VALIDADO**

CLI: `pnpm --filter @repo/payments economic-agreement:configure-clickaton-staging -- --remote --confirm-staging --apply`

## Compatibilidad

- CLF Preferences / marketplace_fee / collector: no tocados.
- `User.mp*` / `Lab.mp*`: intactos (partners sin mp; user 1 TEST legacy intacto).
- Clickatón checkout actual: intacto; sin pagos reales.
- Distribución: únicamente TEST 34/33/33; no porcentajes productivos definitivos.

## Flags finales

| Flag | Valor |
|---|---|
| `DNX_FINANCIAL_IDENTITY_READ_MODE` | LEGACY_ONLY |
| `DNX_FINANCIAL_IDENTITY_WRITE_ENABLED` | off |
| `DNX_FINANCIAL_IDENTITY_BACKFILL_ENABLED` | off |
| `FINANCIAL_IDENTITY_ONLY` | off |
| Orders 1:N | off |

## Estado fixtures

**Opción A:** mantener identities/accounts/agreement TEST activos en staging, claramente identificados, sin capacidad de ejecutar pagos reales. Auditoría preservada.

## Idempotencia

Segundo `--apply`: `alreadyConfigured=true`, persist deltas 0 (sin duplicados).

## Código

| Pieza | Path |
|---|---|
| Orquestación dominio | `packages/payments/src/economic-agreement/configure-clickaton-partners.ts` |
| Persistencia Prisma | `packages/payments/src/infrastructure/prisma/economic-agreement-remote.ts` |
| Orders dry-run | `packages/payments/src/bridges/orders-1n-dry-run.ts` |
| CLI staging | `packages/payments/src/cli/configure-clickaton-agreement-staging.ts` |
| Tests | `configure-clickaton-partners.test.ts` |

## Caso Rodrigo

- cuenta real consultada: **no**
- cuenta real conectada: **no**
- fixture TEST creado: **sí**
- migración real pendiente: **sí**

## Limitaciones

- Sin UI admin.
- Sin OAuth / cuentas MP reales.
- Porcentajes solo TEST (no acuerdo productivo definitivo).
- Sin liquidaciones / retiros / deuda.

## Seguimiento 10D3I-F

Orders 1:N TEST real validado en staging (flag final OFF). Ver:

`docs/clickaton/ORDERS_1N_STAGING_ACTIVATION_10D3I_F.md`

## Seguimiento 10D3I-H

Checkout inscripción Clickatón + DNX Payments staging. Ver:

`docs/clickaton/REGISTRATION_CHECKOUT_DNX_PAYMENTS_STAGING_10D3I_H.md`

## Seguimiento 10D3I-I0

Gobernanza / preflight para cuentas MP reales de socios (sin OAuth real; owner pendiente). Ver:

`docs/clickaton/MERCADO_PAGO_PARTNERS_PRODUCTION_ONBOARDING_10D3I_I0.md`

El acuerdo TEST `partners-10d3i-e` permanece intacto; el scope productivo propuesto es `partners-production` (aún no publicado).
