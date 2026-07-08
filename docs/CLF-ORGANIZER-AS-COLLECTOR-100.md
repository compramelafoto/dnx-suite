# CLF-ORGANIZER-AS-COLLECTOR-100

## Resumen

Cuando un evento tiene comisión del organizador al **100%**, el **organizador** (no el fotógrafo) actúa como cobrador OAuth en Mercado Pago. ComprameLaFoto retiene solo el `marketplace_fee` (fee de plataforma).

Complementa `CLF-ORGANIZER-COMMISSION-100` (tope 100%).

## Flujo antes / después

| Comisión | Antes (riesgoso) | Ahora |
|----------|------------------|-------|
| &lt; 100% | Fotógrafo collector; retención organizador en `marketplace_fee` | Igual |
| 100% | Fotógrafo collector con payout $0; `marketplace_fee = total` | **Organizador collector**; `marketplace_fee = fee plataforma`; organizador recibe el neto |

## API central

- `lib/events/resolve-event-payment-collector.ts`
  - `PaymentCollectorType = "PHOTOGRAPHER" | "ORGANIZER"`
  - `resolveEventPaymentCollectorFromData()` — pura (tests)
  - `ORGANIZER_FULL_COMMISSION_MP_REQUIRED_ERROR`
- `lib/mercadopago/resolve-album-order-mp-credentials.ts`
  - `resolveEventPaymentCollector({ eventId, photographerUserId })` — async con Prisma
  - `resolveAlbumOrderMercadoPagoCredentials()` — usado en checkout
  - `resolveAlbumOrderMpAccessTokenByOrderId()` — webhook / finalize

## Checkout

Rutas que resuelven collector + `paymentCollectorType`:

- `lib/mercadopago/album-order-mp-preference.ts`
- `app/api/payments/mp/create-preference/route.ts`
- `app/api/a/[id]/orders/route.ts`
- `app/api/album-pack-orders/[orderId]/create-payment-preference/route.ts`

Validación split: `validateEventOrganizerCommissionMpSplit` — rechaza collector $0 y `marketplace_fee >= total`.

## Snapshot post-pago

`lib/event-organizer-commission-snapshot.ts`:

- **&lt; 100%:** `PENDING` + `HELD_BY_PLATFORM` → pipeline de retiro (15 días).
- **100% organizer collector:** `PAID_DIRECT_TO_ORGANIZER` + `ORGANIZER_AS_COLLECTOR` — registro informativo; **no** suma al saldo retirable.

Clasificación: `lib/event-organizer-commission-ledger.ts`

## Panel organizador / admin

- API `GET /api/organizer/commissions`: expone `totalDirectMpCollection`, `totalPlatformHeldGenerated`, `collectionType` por ítem.
- Retiros (`withdrawal-request`): solo comisiones `HELD_BY_PLATFORM` + `AVAILABLE`.
- Admin command center: métrica «Cobro directo MP» separada del pipeline de retiro.

`components/organizer/EventOrganizerCommissionSection.tsx`:

- Aviso al elegir 100%
- CTA «Conectar Mercado Pago» si falta OAuth
- No bloquea guardar evento; bloquea checkout automático vía API

## Tests

```bash
node --import tsx --test \
  lib/events/resolve-event-payment-collector.test.ts \
  lib/event-organizer-commission-ledger.test.ts \
  lib/event-organizer-commission.test.ts \
  lib/pricing/checkout-fee-financial-close.test.ts
```

## Pendiente sandbox/producción

- [ ] Validar en sandbox MP que preferencia con token del organizador cobra correctamente
- [ ] Confirmar webhook/finalize con token organizador en pago real
- [ ] Probar pack orders con evento 100%
- [ ] Verificar que MP acepta marketplace_fee &lt; total con collector organizador
