# 05 — Ledger design

## Principios

1. **Append-only.** Nunca update ni delete de `LedgerEntry`.
2. **El ledger es la fuente de verdad** de dinero interno. `Balance` es proyección.
3. Cada evento financiero genera **uno o más** journal sets (legs que suman cero).
4. Corrección = **asiento compensatorio**, no edición.

## Cuentas tipicas

| Código (ejemplo) | Tipo | Uso |
|---|---|---|
| `clearing.provider.{provider}` | ASSET/CLEARING | Dinero en tránsito provider |
| `liability.recipient.{recipientId}` | LIABILITY | Adeudado a beneficiario |
| `revenue.platform.fee` | REVENUE | Fee plataforma |
| `expense.provider.fee` | EXPENSE | Fee provider (`WAITING_MP_CONFIRMATION` cómo se prorratea) |
| `liability.held.{recipientId}` | LIABILITY | Retenciones / holds |
| `equity.adjustments` | — | Ajustes manuales auditados |

Los códigos exactos viven en configuración; el dominio exige unicidad y tipo válido.

## Eventos → movimientos

| Evento de dominio | Efecto ledger (conceptual) |
|---|---|
| `ProviderOrderCreated` | Opcional: memo / reservation (sin cash) |
| `PaymentApproved` | Dr clearing; Cr liabilities por DistributionEntry |
| `PaymentRejected` | No cash; audit only (o reverse reservation) |
| `RefundProcessed` | Dr liabilities (o expense); Cr clearing |
| `ChargebackReceived` | Hold: Dr liability available → Cr liability held; luego finalización |
| `ManualAdjustment` | Legs explícitos + `AuditEvent` obligatorio |
| `SettlementGenerated` | Agrupa liabilities → settlement clearing |
| `PayoutCompleted` | Dr settlement/liability; Cr cash/bank (u otro provider) |

## Invariantes

- Toda `LedgerEntry` tiene `id`, `postedAt`, `journalId`, `legs[]`, `cause` (event type + aggregate id).
- `sum(legs.amountMinor) === 0` en la misma moneda.
- Prohibido `amountMinor` no entero / float.
- Idempotencia: `(causeType, causeId, purpose)` único para no doble-postear el mismo hecho.

## Reconciliación

`ReconciliationRun` compara:

- sumas ledger por `externalReference` / provider payment id
- reportes de liberaciones del provider

Diffs se registran; no se “arreglan” mutando el pasado.

## Qué queda abierto

- Prorrateo exacto del fee MP entre participants → `WAITING_MP_CONFIRMATION`
- Cuentas fiscales / retenciones → `WAITING_MP_CONFIRMATION`
