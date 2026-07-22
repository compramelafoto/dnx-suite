# CLICKATÓN — ETAPA 10D3I-D — MIGRACIÓN SEGURA Y DUAL-READ

## Alcance

- Vault AES-256-GCM (`DnxEncryptedCredential`)
- Backfill User/Lab → FinancialIdentity + PaymentAccount
- Dual-read con flags (default `LEGACY_ONLY`)
- Hook CLF en resolver de collector de álbum/evento
- Adapters Prisma (credential store + dual-read ports)
- Tests + CLI fixture
- Documentación / runbook

## Migraciones

| Migración | Remoto |
|---|---|
| `20260722220000_add_financial_identity_and_economic_agreements` | **No aplicada** (staging no inequívoco) |
| `20260722230000_add_encrypted_credentials_and_legacy_mp_fields` | **No aplicada** |

## Staging

| Host | Clasificación |
|---|---|
| `ep-round-fog*` | Staging DNX Payments / CLF preview documentado |
| `ep-dawn-dew*` | Ambiguo / InfoSpot / riesgo prod histórico — **no usar** |
| Clickatón Vercel `clickaton_staging` | Proyecto app; DB Neon propia — no confirmada como misma que payments |

**CLICKATON_STAGING_CONFIRMED:** no asignado en esta etapa.

## Pruebas

- Vault / backfill / dual-read unit tests en `@repo/payments`
- CLI fixture dry-run + apply local
- Sin cuentas reales Dani/Rodri/Tammy
- Sin OAuth real / sin pagos

## Activado

- Código dual-read + vault + backfill
- Default runtime: `LEGACY_ONLY` (CLF idéntico)

## Desactivado

- Dual-read PREFER en staging/prod
- Backfill remoto
- Migraciones remotas
- Orders 1:N
- Dual-write OAuth
- FINANCIAL_IDENTITY_ONLY
- Borrado `User.mp*` / `Lab.mp*`

## Caso Rodrigo

- Identidad técnica resoluble por diseño: sí
- Cuenta legacy localizable sin producción: no (no consultar prod)
- Migrada en staging: no
- Requiere acción futura: sí (10D3I-E / staging confirmado)

## Siguiente etapa

**10D3I-E — Configuración de socios, cuentas y acuerdo económico 1:N en staging**
