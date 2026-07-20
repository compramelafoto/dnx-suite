# Clickatón — 10D3F-B — Hardening de reservas, expiración y seguridad

**Estado:** hardening del flujo público 10D3F previo a checkout (10D3G).  
**Fuera de alcance:** DNX Payments, Mercado Pago, webhooks, emails, QR.

## Objetivo

Cerrar hasta donde permite el modelo actual:

1. Expiración idempotente de holds
2. Liberación segura de cupo y `reservedStock`
3. Seguridad del resumen (token v2 + PII enmascarada)
4. Duplicados reforzados (email/documento + holds vencidos)
5. Rate limiting pluggable (in-memory para tests/dev)
6. Contrato `getRegistrationCheckoutEligibility`

## Gaps previos (10D3F)

| Gap | Resolución 10D3F-B |
| --- | ------------------ |
| Sin job de expiración | Caso de uso batch + script dry-run |
| `reservedStock` no se liberaba | Decrement al expirar holds ACTIVE |
| Anti-duplicado bloqueaba holds vencidos | `countsAsActiveRegistration` ignora stale |
| Token sin slug/purpose | Token v2 firmado |
| PII completa en resumen | DTO enmascarado |
| Rate limiting ausente | Interfaz + adaptador memory (prod = gap) |

## Reglas de expiración

Candidata si:

- `status ∈ {PENDING_PAYMENT, DRAFT}`
- `paymentStatus ≠ APPROVED`
- `holdExpiresAt <= now`
- no confirmada/cancelada/refunded/disqualified

**Estado final (sin enum nuevo):**

- `status = CANCELLED`
- `paymentStatus = EXPIRED`
- holds ACTIVE → `EXPIRED` + `releasedAt`
- `reservedStock -= quantity` (una sola vez)
- audit `PUBLIC_REGISTRATION_EXPIRED`

Alineado a `DESIGN_STATUS_TO_DOMAIN.PAYMENT_EXPIRED`.

## Idempotencia y concurrencia

- Re-ejecutar expire → `already_processed` / skip
- Lock por `registrationId` (in-memory) / transacción Prisma
- Dos workers: un solo efecto material

## Batch

`expirePendingRegistrations({ now, limit, dryRun })` →

`{ scanned, expired, skipped, failed, releasedCapacityHolds, releasedStockHolds, errors, dryRun }`

Sin PII.

## Script operativo

```bash
pnpm --filter clickaton registrations:expire-holds          # dry-run
pnpm --filter clickaton registrations:expire-holds -- --apply --limit 50
```

- Requiere `DATABASE_URL`
- Solo localhost (bloquea Neon/remoto)
- No imprime connection string
- `--now` para pruebas
- Exit ≠ 0 si `failed > 0`

## Contrato scheduler futuro

| Parámetro | Recomendación |
| --------- | ------------- |
| Frecuencia | cada 1–5 min |
| Lote | 50–200 |
| Timeout | 30–60 s |
| Reintentos | idempotentes; safe retry |
| Lock | lease/DB advisory o queue única |
| Observabilidad | métricas scanned/expired/failed |
| Alertas | failed > 0 o lag de holds vencidos |
| Fallo parcial | continuar lote; reportar errors |

No configurar cron real en esta etapa.

## Token del resumen (v2)

Formato: `v2.{expiresAtMs}.{sig}`  
Payload firmado: `v2|summary|{editionSlug}|{registrationId}|{expiresAtMs}`  
Comparación timing-safe. Sin PII. Compat legacy 10D3F.

Códigos: `TOKEN_INVALID`, `TOKEN_EXPIRED`.

## PII

Resumen público: nombre + inicial apellido, email/tel/documento enmascarados. Sin audits/notas.

## Duplicados

Activa = no terminal y no stale (`holdExpiresAt` pasado).  
Reinscripción permitida tras expiración materializada.  
Garantía absoluta diferida (unique parcial schema).

## Rate limiting

Interfaz `RateLimitStore` + in-memory.  
**Producción no cubierta** hasta backend compartido (Redis). Documentado.

## Checkout eligibility

`getRegistrationCheckoutEligibility` → eligible solo si reserva activa, holds ACTIVE vigentes, no pago aprobado, estado payable. Sin crear orden ni llamar payments.

## Selfchecks

- `selfcheck:public-registration-hardening`
- `selfcheck:public-registration-reservation` (regresión)

## Riesgos / diferidos

- Rate limit prod
- Unique `(editionId, email)` / idempotency key
- Cron real
- Token persistido
- 10D3G checkout

## Veredicto esperado

`HARDENING APROBABLE — LISTO PARA 10D3G` si selfchecks OK y sin schema change requerido para operar expire + eligibility.
