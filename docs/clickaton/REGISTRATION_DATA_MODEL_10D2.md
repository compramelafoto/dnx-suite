# Clickatón — Modelo de datos de inscripciones (10D2)

Documento de implementación. Fuente de diseño: `REGISTRATION_QR_CHECKIN_KIT_AUDIT_10D1.md`.

## Diferencias respecto a 10D1 (documentadas)

| 10D1 | 10D2 (persistido) | Motivo |
|------|-------------------|--------|
| Estados `PAYMENT_*` / `TRANSFER_*` en un solo enum de inscripción | `ClickatonRegistrationStatus` + `ClickatonPaymentStatus` | Pago desacoplado; compatible con DNX Payments |
| `ClickatonKit` / `ClickatonKitItem` | `ClickatonTicketTypeItem` | MVP: productos incluidos en ticket (entrada±remera); kits compuestos = evolución |
| Check-in como enum en registration | Entidad `ClickatonCheckIn` + índice parcial activo | Un check-in activo; historial de reversiones |
| `soldCount` en ticket | Agregado: confirmed + holds ACTIVE | Evitar contadores desincronizados |
| Relación rígida a Orders | Soft refs `paymentOrderId` / provider / externalRef / idempotencyKey | Orders DNX evolucionan aparte |

## Entidades

Ver schema Prisma `packages/db/prisma/schema.prisma` (bloque Clickaton*).

Resumen: TicketType, Product, ProductVariant, TicketTypeItem, Registration (+ snapshot participante y dinero Int), RegistrationItem, CapacityHold, StockHold, EditionSequence, ParticipantCredential, QrToken (`tokenHash` SHA-256), CheckIn, KitDelivery (+Item), StatusHistory, Audit.

## Enums

- Registration: `DRAFT | PENDING_PAYMENT | CONFIRMED | WAITLISTED | CANCELLED | REFUNDED | DISQUALIFIED`
- Payment: `NOT_REQUIRED | PENDING | PROCESSING | APPROVED | FAILED | EXPIRED | CANCELLED | REFUNDED | PARTIALLY_REFUNDED | MANUAL_REVIEW`
- Hold: `ACTIVE | CONSUMED | EXPIRED | RELEASED`
- Credential: `ACTIVE | REVOKED | REPLACED`
- QR: `ACTIVE | REVOKED`
- Kit delivery: `PENDING | PARTIAL | DELIVERED | REVERSED`
- Check-in source: `QR_SCAN | MANUAL_SEARCH | ADMIN`

## Código visible y secuencia

- `ClickatonEditionSequence(editionId, lastValue)` — contador transaccional (`UPDATE … RETURNING` / `lastValue+1` en tx).
- `visibleCode` + `sequenceNumber` únicos por `editionId`.
- Prefijo en `ClickatonEdition.visibleCodePrefix`.
- **Prohibido** `count(*)+1`.

## QR y credencial

- 1 credencial por registration (`registrationId` unique).
- Token opaco: solo `tokenHash` (+ `tokenPrefix` opcional soporte). Nunca plaintext.
- Índice parcial: un QR `ACTIVE` por credential.

## Check-in

- Evento con `reversedAt` nullable.
- SQL manual: `UNIQUE (registrationId) WHERE reversedAt IS NULL`.

## Kit

- Separado del check-in.
- Índice parcial: una entrega no revertida activa por registration.

## Cupos y stock

- `ClickatonCapacityHold` 1:1 registration (unique).
- `ClickatonStockHold` por variante; `reservedStock` en variante.

## Pagos (DNX)

Sin FK a `DnxPaymentIntent`/Orders. Soft refs en registration. `productId=clickaton` a nivel integración (app), no columna obligatoria aquí.

## Datos sensibles

Nullable: documento, birthDate. Sin índices. No en QR ni logs. Sin cobertura médica detallada / notas clínicas en schema.

## Borrado

`ON DELETE RESTRICT` en FKs operativas. Soft `isActive` en catálogo. Auditoría y QR revocados se conservan.

## Migración

- Nombre: `20260718220000_clickaton_registrations_credentials_checkin_kits`
- Posterior a WIP ajeno `20260718180000_cuanto_cobro_financial_profile` (no modificada).
- Additive only; SQL Clickaton* + 3 índices parciales manuales.
- Validada en Postgres local `127.0.0.1:55434` (no Neon).

### SQL manual (parciales)

```sql
CREATE UNIQUE INDEX "ClickatonCheckIn_registrationId_active_key"
ON "ClickatonCheckIn" ("registrationId") WHERE "reversedAt" IS NULL;

CREATE UNIQUE INDEX "ClickatonQrToken_credentialId_active_key"
ON "ClickatonQrToken" ("credentialId") WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "ClickatonKitDelivery_registrationId_active_key"
ON "ClickatonKitDelivery" ("registrationId")
WHERE "reversedAt" IS NULL AND "status" <> 'REVERSED';
```

## Simulaciones

| Caso | Resultado |
|------|-----------|
| Cadena vacía (incl. WIP Cuánto Cobro + 10D2) | OK |
| Estado sintético (edition+venue+user, 0 regs) + apply 10D2 | OK |
| Segundo `migrate deploy` | No pending |
| Neon | No usado |

## Protección `.env`

Simulaciones usan `DATABASE_URL` local explícita en copia `/tmp/10d2-db-copy`. Abort si host contiene `ep-dawn-dew` / `neon.tech` en scripts de auditoría live.

## Riesgos

- Drift general schema vs historial (diff completo tenía DROPs ajenos) — mitigado con migración hand-extracted.
- WIP Cuánto Cobro en la cadena local — no tocado; simulación lo incluye.
- Generador de `visibleCode` en app aún no productivo (solo modelo + selfcheck in-memory).

## Próximo paso

**10D2B — Autorización y aplicación controlada de migración** (no iniciado).
