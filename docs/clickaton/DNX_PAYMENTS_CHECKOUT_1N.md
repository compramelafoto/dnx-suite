# DNX Payments — checkout desde snapshot (Etapa 6)

## Flujo real

1. Inscripción pendiente con fase/promo/merch ya validados.
2. Se lee o crea `ClickatonRegistration.financialDistributionSnapshot` (v2).
3. **No** se recalcula la distribución desde la versión ACTIVE actual.
4. Se valida suma = 10.000 bps y `paymentAccountId` por allocation.
5. Se crea orden DNX Payments con `editionFinance.snapshot`.
6. Se persisten `DnxPaymentOrderAllocation` (settlement projection, idempotente).
7. Se crea preferencia/orden en Mercado Pago.
8. Webhook firmado → confirma pago → marca inscripción → allocations PAID / RECONCILED.

Unidades: `amountMinor` / montos del snapshot = **centavos ARS** (misma convención que `pesosToMinorUnits`).

## Modalidad Mercado Pago (honesta)

| Caso | Modalidad |
|---|---|
| Tammy 100% (N=1) | **Checkout Pro Preferences** con **access token OAuth del `DnxPaymentAccount` de Tammy** como collector |
| N>1 | **No** se simula multi-receptor en Preferences. Path previsto: Orders API 1:N (staging), u otra liquidación documentada |

No hay `application_fee` / marketplace fee implementado. No afirmar “split real” en Preferences.

## 1:1 operativo vs 1:N preparado

- **Operativo hoy:** N=1 collector OAuth (Tammy 10.000 bps).
- **Preparado:** motor `allocateByBasisPoints`, persistencia N allocations, splits DNX desde snapshot, tests 2/3 beneficiarios.
- **Bloqueado comercialmente N>1:** hasta estrategia legal/técnica Orders o settlement.

## Fees

- Antes del pago: `providerFeeEstimated` (puede ser 0 si desconocida).
- Después: extracción desde `fee_details` / `net_received_amount` si MP informa; si no, allocations quedan PAID sin RECONCILED.
- `platformFee` = 0 en Argentina 2026.
- Tammy recibe 100% del **importe distribuible** (`charged − providerFee − platformFee`).

## Idempotencia

Claves: inscripción, orden (`idempotencyKey` + `payloadHash` incluye versionId), allocations (`orderId:beneficiary:versionId`), preferencia MP, webhook inbox, confirmación.

Redirect success **nunca** marca PAID.

## Refunds / chargebacks

Gap productivo. LIVE bloqueado hasta política mínima. Estados modelados en allocations: `REVERSED` / `FAILED`.

## Blockers LIVE

- Conexión OAuth Tammy ACTIVE + vault
- Webhook LIVE
- Distribución ACTIVADA (no auto-seed)
- Refund/chargeback policy
- Orders 1:N solo si N>1 se habilita a propósito
