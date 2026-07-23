# Financial Identity Domain (DNX Suite)

## Propósito

Módulo transversal que administra:

1. **FinancialIdentity** — sujeto económico (persona u organización)
2. **PaymentAccount** — cuentas PSP / destino (Mercado Pago hoy)
3. **EconomicAgreement** — acuerdos económicos versionados
4. **OrderDistributionSnapshot** — congelado inmutable por orden

Principio: la cuenta Mercado Pago pertenece a la Financial Identity del User DNX, nunca a un producto ni a un rol.

## Entidades

| Entidad | Responsabilidad |
|---|---|
| `DnxFinancialIdentity` | Persona/org; sin % ni secretos |
| `DnxPaymentAccount` | Provider + env + refs opacas |
| `DnxEconomicAgreement` | Contrato por `productKey` + scope opaco |
| `DnxAgreementParticipant` | Quién participa (roleLabel económico) |
| `DnxDistributionVersion` | Versión de %/fijos; PUBLISHED inmutable |
| `DnxDistributionRule` | Reglas en bps o minor units |
| `DnxOrderDistributionSnapshot` | Snapshot formal append-only |
| `DnxFinanceGrant` | Permisos financieros explícitos |

## Invariantes

- Una identidad personal primaria activa por User
- Único `(provider, providerUserId, environment)` live en la suite
- Porcentajes solo en versiones; suma 10000 bps en modo % puro
- Snapshot inmutable; no recalcular histórico
- `credentialReference` es puntero a vault — nunca token plaintext
- TEST y PROD no se mezclan

## Estados

Ver enums Prisma `DnxFinancialIdentityStatus`, `DnxPaymentAccountStatus`, `DnxEconomicAgreementStatus`, `DnxAgreementParticipantStatus`, `DnxDistributionVersionStatus`.

## Seguridad

- No hay encryption service app-level aún → no migrar tokens en 10D3I-C
- APIs públicas de dominio exponen `PublicPaymentAccount` (sin `credentialReference`)
- Auditoría via `DnxPaymentAuditEvent` / store audit (acciones `distribution_version.publish`, etc.)
- Grants por `userId`, nunca email hardcodeado en guards

## Permisos

| Capability | Alcance |
|---|---|
| `DNX_FINANCE_OWNER` | Suite |
| `DNX_FINANCE_ADMIN` | Ops suite |
| `PRODUCT_FINANCE_MANAGER` | productKey (+ scope opcional) |
| `PRODUCT_FINANCE_VIEWER` | lectura |
| PARTICIPANT_SELF | ownership de identity (aceptar / elegir cuenta) |

Asignación staging (documental): insertar `DnxFinanceGrant` por `userId` — no por email en runtime.

## Compatibilidad

- CLF `User.mp*` intacto; mapper dry-run en `@repo/payments/legacy/clf`
- Dual-read / vault migration → etapa **10D3I-D**
- DNX Payments: bridges tipados a Recipient / ProviderAccount / DistributionRule
- Clickatón checkout Preferences intacto; Orders 1:N no activado

## Ejemplo (fixtures)

Dani/Rodri/Tammy Test + `TEST_DANI` / `TEST_RODRI` / `TEST_TAMMY` → acuerdo Clickatón 3400/3300/3300 → snapshot simulado.

## Staging 10D3I-E (acuerdo socios Clickatón)

Configurado en `clickaton_staging` (`ep-divine-smoke-av8hmt7s*`):

- Fixtures User TEST (sin MP real) + identities PERSON + PaymentAccount TEST
- Grant `DNX_FINANCE_OWNER` solo Dani; Rodrigo/Tamara = PARTICIPANT_SELF
- Acuerdo `clickaton` / `STAGING_TEST` / `partners-10d3i-e` — 3400/3300/3300 bps PUBLISHED
- Snapshot 100000 ARS → 34000/33000/33000; Orders 1:N solo dry-run local
- CLI: `economic-agreement:configure-clickaton-staging`
- Doc: `docs/clickaton/ECONOMIC_AGREEMENT_1N_STAGING_10D3I_E.md`
- Runtime FI permanece `LEGACY_ONLY`; Orders real off

## Límites de esta etapa (10D3I-C / E)

- Sin OAuth real / sin cutover Orders
- Sin backfill productivo
- Sin UI pública (E: CLI/servicio validado)
- Sin settlements/refunds automáticos
- Sin Stripe/bancos (enum extensible)
- Migración SQL creada; **no aplicada a Production**; no asumir host del `.env` local
- Porcentajes 34/33/33 son **solo TEST**, no acuerdo productivo definitivo
