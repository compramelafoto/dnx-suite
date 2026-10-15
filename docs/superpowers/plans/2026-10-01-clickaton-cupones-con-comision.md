# Plan — Clickatón: cupones con comisión (Split 1:N)

Diseño: `docs/superpowers/specs/2026-10-01-clickaton-cupones-con-comision-design.md`.
Worktree: `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-ck-cupon-comision`, rama
`feat/clickaton-cupones-con-comision`. Todo lo nuevo nace apagado.

Convenciones del repo: comentarios y textos en español rioplatense; pruebas con
`node:test` + `tsx --test`; dinero en centavos (Int); migraciones a mano, aditivas e
idempotentes (`CREATE TABLE IF NOT EXISTS`, tipos en `DO $$ ... duplicate_object`), carpeta
`packages/db/prisma/migrations/<timestamp>_clickaton_<nombre>/migration.sql`.
Verificación por tarea: `pnpm --filter clickaton exec tsc --noEmit -p tsconfig.json`
(con `NODE_OPTIONS=--max-old-space-size=8192`; ojo: si muere por memoria devuelve éxito,
mirá que imprima algo o cuente errores), eslint de los archivos tocados y los tests.

## Tarea A — Datos, cálculo y vinculación con MP

1. Prisma (`packages/db/prisma/schema.prisma`) + migración `20261001150000_clickaton_afiliados`:
   - `ClickatonAffiliate`: id cuid, userId Int? (User DNX), displayName, email (contacto),
     mpSellerEmail, paymentRecipientId String? (→ `DnxPaymentRecipient.id`), consentReceiverId
     String? (UUID de MP), consentStatus String (NONE|PENDING|ACTIVE|REJECTED|CANCELED|EXPIRED),
     consentInviteUrl String?, consentCheckedAt DateTime?, isActive Bool, notes?, timestamps.
     Únicos: userId, mpSellerEmail.
   - `ClickatonAffiliateCommission`: id, registrationId @unique (FK cascade), editionId,
     affiliateId (FK), promotionId String, promotionCodeSnapshot, commissionBps Int,
     baseAmount Int, grossAmount Int, mpFeeBps Int, mpFeeShareAmount Int, netAmount Int,
     mode enum ClickatonAffiliateCommissionMode (SPLIT|MANUAL) nullable hasta el cobro,
     status enum ClickatonAffiliateCommissionStatus (PENDING|PAID_BY_SPLIT|OWED|PAID_OUT|REVERSED),
     providerOrderId?, paidAt?, paidOutAt?, paidOutByUserId?, paidOutReference?, reversedAt?,
     reversalReason?, timestamps. Índices (affiliateId,status), (editionId,status).
2. Dominio puro `apps/clickaton/lib/affiliates/domain/`:
   - `commission.ts`: `computeAffiliateCommission({ baseAmount, commissionBps, mpFeeBps, totalAmount })`
     → `{ grossAmount, mpFeeShareAmount, netAmount, ownerAmount, splittable }` según §4 del diseño.
   - `coupon-affiliate.ts`: `readCouponAffiliate(metadata)` / `withCouponAffiliate(metadata, value|null)`,
     tolerante a metadata mala (devuelve null), commissionBps 1..10000.
   - `labels.ts`: textos de estados.
   - Tests de todo.
3. Vinculación `apps/clickaton/lib/affiliates/infrastructure/split-consent.ts`:
   - Adapter `MercadoPagoSplitConsentAdapter` (`packages/payments/src/providers/mercado-pago/split-consent/adapter.ts`)
     con `createMercadoPagoProviderConfig({ accessToken, environment: "production" })`, token
     de la cuenta cobradora DNX vía `resolveCollectorAccessTokenFromPaymentAccount("pa_ba733fa7a35f4326")`
     (`apps/clickaton/lib/admin/edition-finance/infrastructure/resolve-collector-token.ts`).
   - `inviteAffiliate(affiliateId)`: invita `mpSellerEmail` (idempotencyKey UUID v4), guarda
     `consentReceiverId`, estado e `inviteUrl`; asegura `DnxPaymentRecipient` (recipientType
     AFFILIATE, userId) y upsert `DnxSplitConsent` (provider mercadopago, environment PRODUCTION,
     providerReceiverId = UUID, recipientId, invitationReference, source APPLICATION,
     primaryProviderAccountReference = "97484805").
   - `refreshAffiliateConsent(affiliateId)`: `getConsent(consentReceiverId)` (**por UUID**,
     no por id numérico — el bug de FOTOFFICE), actualiza ambas tablas.
   - `getActiveSplitReceiver(affiliateId)` → `{ receiverId, recipientId } | null` sólo si ACTIVE.
   - Leé cómo lo hace FOTOFFICE (`apps/fotoffice/lib/payments/connect/consent-invite.ts`,
     `consent.ts`) y el enum/valores reales de `DnxSplitConsent` en el schema.

## Tarea B — Ciclo de la comisión

- Al crear la inscripción (`apps/clickaton/lib/public-registration/application/public-registration-service.ts`,
  después de cupón/referidos y del envío): si quedó `promotionId` y el cupón tiene
  `metadata.affiliate` activo → crear `ClickatonAffiliateCommission` PENDING con
  base = precio de lista (`montoDeLista`, sin envío), mpFeeBps = `ClickatonEditionResultSettings.mpProcessingFeeBps`
  ?? env `DNX_CLICKATON_AFFILIATE_DEFAULT_MP_FEE_BPS` ?? 0. Mismo repo/transacción que la
  inscripción (seguir el patrón de `shipping` en `createReservedRegistration`, puerto opcional
  en el repo en memoria) y tolerante a tabla ausente.
- Al confirmar pago (`apps/clickaton/lib/checkout/infrastructure/prisma-checkout-mutations.ts`,
  donde se confirma la redención del cupón): PENDING → PAID_BY_SPLIT si el cobro fue Orders con
  split del afiliado (providerOrderId empieza con `ORD` y se registró split), si no → OWED.
  Inscripción gratis ($0) → REVERSED con motivo "sin cobro".
- Reversa: vencimiento de reserva, anulación desde el panel (`lib/admin-registration`), REFUNDED/
  CHARGEBACK entrante → REVERSED (si estaba PAID_BY_SPLIT, guardar motivo "recuperar del afiliado").
- Tests con el repo en memoria (`home-delivery-funnel.test.ts` es el modelo).

## Tarea C — Panel y Mi cuenta

- `/admin/afiliados`: listar, alta (email del usuario DNX + email de MP + nombre), enviar
  invitación, refrescar estado, link de invitación, activar/desactivar.
- `/admin/promociones`: en el alta del cupón, "Código de fotógrafo" (select de afiliado
  activo + % de comisión) → `metadata.affiliate`. Mostrar dueño y % en la lista.
- `/admin/comisiones`: totales por estado, lista filtrable por afiliado/edición, marcar
  "transferido" (OWED → PAID_OUT con referencia).
- `mi-cuenta`: sección "Mis códigos" para quien es afiliado: códigos, usos, comisiones por
  estado, y el estado de su vinculación con MP (link de invitación + botón "ya acepté").
- Enlaces en la navegación admin (`config/admin/navigation`).

## Tarea D — Cobro dividido en producción

- `packages/payments`: nuevo puente Orders 1:N **productivo** para Clickatón
  (`clickaton-checkout/orders-1n-affiliate-split-bridge.ts`) que recibe en `createCheckout`
  un `affiliateSplit { recipientId, receiverId, partnerAmountMinor }` y la tarjeta; arma
  owner = 97484805 + partner con monto fijo; evidencia de permiso real (no fixture);
  `allowTestFixtures:false`; `allowProductionWrites:true`; token de la cuenta DNX.
  `refreshCheckout` con `getOrder` en producción y `liveMode:true`.
- Puente compuesto: `mode: "mercado_pago_production"`; createCheckout → Orders si viene
  `cardPayment` + `affiliateSplit`, si no Checkout Pro. refreshCheckout → Orders si el id
  empieza con `ORD`, si no Checkout Pro. external_reference con guiones para Orders.
  Ajustar `allocate-bps` / gates para no tirar `CHECKOUT_PRO_N1_ONLY` en este caso
  (el snapshot de edición sigue N=1; el reparto al afiliado es aparte).
- Clickatón: `create-registration-checkout.ts` busca la comisión PENDING + receptor ACTIVE
  y, si `DNX_CLICKATON_AFFILIATE_SPLIT_ENABLED` y `splittable`, pasa `affiliateSplit`.
  Página de resumen: si la inscripción califica para split, muestra Card Brick en producción
  (public key `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`/`MERCADOPAGO_LIVE_PUBLIC_KEY`) aunque el
  resto siga en Checkout Pro; la acción de tarjeta usa `getCheckoutServiceReady()`.
- Con el interruptor apagado no cambia nada del cobro actual.

## Tarea E — Cierre

Docs (`docs/clickaton/cupones-con-comision/README.md`), prueba en rama Neon copia de
producción, PR.
