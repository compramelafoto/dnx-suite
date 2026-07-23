# CLICKATÓN — ETAPA 10D3I-D2 — CONFIRMACIÓN DE STAGING

**Fecha:** 2026-07-22  
**Rama:** `migration-legacy-clf-to-monorepo`  
**HEAD base:** `d8b9c9f` (10D3I-D)  
**Veredicto:** **BLOQUEADO — NO STAGING INEQUÍVOCO**  
**Superseded:** 10D3I-D3 identificó y migró `ep-divine-smoke-av8hmt7s*` — ver [`FINANCIAL_IDENTITY_MIGRATION_APPLY_10D3I_D3.md`](./FINANCIAL_IDENTITY_MIGRATION_APPLY_10D3I_D3.md).

## Objetivo

Identificar staging inequívoco para DNX Payments + Comprame La Foto + Clickatón, aplicar migraciones 10D3I-C/D, dry-run/apply TEST y smoke dual-read LEGACY → PREFER → LEGACY.

## Decisión de arquitectura staging

Financial Identity es transversal. Fuente de verdad preferida:

- **una DB DNX compartida** (no copias por app), o
- un servicio central DNX Payments con acceso controlado.

No duplicar identities entre Clickatón DB / CLF DB / InfoSpot DB.

### Candidato técnico confirmado (parcial)

| Host | Evidencia | Clasificación |
|---|---|---|
| `ep-round-fog*` | Vercel `compramelafoto-dnxsuite` **Preview** `DATABASE_URL`; `.env.preview.local`; `services/dnx-mcp/.env.local`; docs DNX Payments + ops CLF | **CLF_PREVIEW_CONFIRMED** + candidato **DNX_PAYMENTS_STAGING** |
| `ep-falling-darkness*` | Vercel `compramelafoto-dnxsuite` **Production** | **PRODUCTION_CONFIRMED** |
| `ep-dawn-dew*` | Vercel `fotorank-dnxsuite` **Production**; InfoSpot histórico; Clickatón local | **PRODUCTION_CONFIRMED** (FotoRank) / **AMBIGUOUS_DO_NOT_USE** para migrate FI |
| Clickatón Vercel `clickaton-staging` | `DATABASE_URL` tipo `sensitive`; `vercel env pull` → vacío; host **desconocido** | **AMBIGUOUS_DO_NOT_USE** |

### Staging elegido (obligatorio)

**NO_STAGING_INEQUÍVOCO**

No se asigna `SHARED_DNX_STAGING_CONFIRMED` porque Clickatón no tiene host de DB legible desde CLI/MCP, y la documentación de 10D3H-C apunta a Neon `clickaton_staging` (proyecto/DB distintos a `ep-round-fog`).

## Fuente de verdad Financial Identity (diseño)

Cuando se desbloquee:

1. Persistir FI / PaymentAccount / vault / agreements en la DB que consume **DNX Payments + CLF preview** (`ep-round-fog*` salvo reasignación explícita).
2. Clickatón staging debe **apuntar a esa misma fuente** (misma `DATABASE_URL`/`DIRECT_URL` o cliente de servicio), no a una copia.
3. No usar `ep-dawn-dew*` ni `ep-falling-darkness*`.

## Fingerprint `ep-round-fog*` (solo lectura)

| Campo | Valor |
|---|---|
| Database | `neondb` |
| Schema | `public` |
| Migraciones `_prisma_migrations` | 45 |
| Última migración | `20260715170000_dnx_payments_core_persistence` |
| `User` / `Lab` | sí / sí |
| `DnxPaymentIntent` | sí |
| Tablas 10D3I-C/D (`DnxFinancialIdentity`, …) | **ausentes** |
| Users / Labs | 3 / 1 |
| Users con `mpAccessToken` / `mpUserId` | 1 / 1 |
| Señales email testish / total | 3 / 3 |

Reporte local (no Git): `.local/audit-10d3i-d2/fingerprint_round_fog.json`.

## Migraciones

| Migración | Resultado |
|---|---|
| `20260722220000_add_financial_identity_and_economic_agreements` | **NO APLICADA** (stop rule) |
| `20260722230000_add_encrypted_credentials_and_legacy_mp_fields` | **NO APLICADA** |

No se creó branch Neon de backup porque no hubo apply remoto.

## Dual-read / backfill remoto

| Paso | Estado |
|---|---|
| Dry-run DB real | NO EJECUTADO |
| Apply TEST | NO EJECUTADO |
| PREFER en staging | NO ACTIVADO |
| Rollback flag | N/A (sigue default `LEGACY_ONLY`) |

## Gap Lab/PRINT

- Helper: `resolveLabMpAccessTokenDualRead` en `financial-identity-dual-read.ts`.
- Rutas `create-preference` / álbum usan `resolveAlbumOrderMercadoPagoCredentials` (User/organizador).
- **Wiring Lab collector en rutas PRINT:** todavía no cableado al helper.
- En esta etapa **no se modificó código** de CLF (bloqueo staging + WIP ajeno intacto).

## Grants staging

No asignados. Procedimiento futuro por `userId` (`DNX_FINANCE_OWNER` / `PRODUCT_FINANCE_MANAGER`). Sin emails hardcodeados. Sin roles Rodri/Tammy de modificación porcentual.

## Flags finales (runtime conocido)

| Flag | Valor |
|---|---|
| `DNX_FINANCIAL_IDENTITY_READ_MODE` | `LEGACY_ONLY` (default; no cambiado en Vercel) |
| `DNX_FINANCIAL_IDENTITY_WRITE_ENABLED` | off |
| `DNX_FINANCIAL_IDENTITY_BACKFILL_ENABLED` | off |
| Orders 1:N | off |
| `FINANCIAL_IDENTITY_ONLY` | off |

## Corrección exacta para desbloquear

1. Recuperar el valor real de `DATABASE_URL` / `DIRECT_URL` de Vercel proyecto `clickaton-staging` (tipo `sensitive` hoy no sale por `vercel env pull` ni MCP `vercel_prepare_staging` con schema roto en `sensitive`).
2. Comparar host sanitizado con `ep-round-fog*`.
3. Si diverge: o bien **reapuntar** Clickatón staging a la DB DNX compartida (con autorización), o bien documentar un servicio FI central y no migrar schema en la DB Clickatón.
4. Confirmar que Preview/Production de `clickaton-dnxsuite` (prod) no se toca.
5. Re-ejecutar 10D3I-D2 desde Fase 4 (backup → migrate → dry-run → apply TEST → PREFER temporal → rollback).

## Caso Rodrigo

- Cuenta real consultada: **no**
- Cuenta real migrada: **no**
- Requiere futura migración controlada: **sí**

## Producción

Preservada. Sin push. Sin migrate remoto. Sin PREFER activo. Sin Orders 1:N. Sin acuerdos/porcentajes reales.

## Próximo paso

**No iniciar 10D3I-E** hasta veredicto `VALIDADO — LISTO PARA 10D3I-E`.

Primero: desbloquear host Clickatón staging y alinear fuente de verdad FI.
