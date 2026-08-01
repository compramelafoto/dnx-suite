# 06 — CLF PAYMENT CURRENT STATE

**Fecha:** 2026-07-29  
**Importante:** DNX Payments 1:N es **POST_MIGRATION** — no bloquea paridad Legacy.

---

## 1. Cómo cobra CLF Legacy hoy

**Motor:** Mercado Pago **Checkout Pro (Preferences)** — **no** Orders API 1:N.

### Flujo

1. Resolver **collector** (access token OAuth):
   - Default: fotógrafo (`User.mpAccessToken`)
   - Evento comisión organizador **100%**: collector = organizador (`ORGANIZER_MP_NOT_CONNECTED` si falta)
   - Print: fotógrafo o lab
   - Curso DNX: `MP_ACCESS_TOKEN` de aplicación
2. Crear preference `POST /checkout/preferences`:
   - `external_reference` = id pedido (a veces `PREFIX:id`)
   - `metadata.orderType` ∈ `ALBUM_ORDER` | `PRINT_ORDER` | `PRECOMPRA_ORDER` | `DNX_COURSE_ENROLLMENT`
   - `marketplace_fee` (ARS) = fee plataforma (+ retención org si &lt;100%)
   - `notification_url` = `{APP_URL}/api/payments/mp/webhook?orderId=&orderType=`
   - `back_urls` → `/pago/{success,failure,pending}`
3. Webhook: `getPaymentById`, idempotencia `WebhookEvent (paymentId, status)`, finalize o reverse
4. Refunds/chargebacks: status MP → reverse order, revoca downloads, cancela comisiones
5. “Split” Legacy = **2 vías** Checkout Pro (`total` − `marketplace_fee`), no N recipients
6. Ledger interno: `OrganizerCommission`, `EventOrganizerCommission`, `PaymentSplit` (print), `ReferralEarning`

### Archivos clave Legacy

- `lib/mercadopago.ts`
- `lib/mercadopago/album-order-mp-preference.ts`
- `app/api/payments/mp/{create-preference,webhook,confirm,retry-payment,failure-context}`
- `lib/mercadopago/finalize-album-order-mp-approved.ts`
- `lib/mercadopago/reverse-album-order-mercado-pago.ts`
- `lib/events/resolve-event-payment-collector.ts`
- `lib/event-organizer-commission-mp-*.ts`
- OAuth: `app/api/mercadopago/oauth/*`
- Crons: `reconcile-mp-pending-orders`, `reconcile-mp-paid-status`

---

## 2. Cómo cobra CLF Monorepo hoy

**Mismo motor Legacy.** Comparación de archivos core: **IDENTICAL** salvo:

| Archivo | Diff |
|---------|------|
| `resolve-album-order-mp-credentials.ts` | Dual-read Financial Identity |
| Imports Prisma | `@/lib/prisma` vs `@prisma/client` |

Con `DNX_FINANCIAL_IDENTITY_READ_MODE=LEGACY_ONLY` (default seguro) → lee `User.mp*` igual que Legacy.

`@repo/payments` **no** crea preferences de álbum CLF.

---

## 3. Qué partes de DNX Payments ya existen

Package: `packages/payments` + docs `docs/dnx-payments/`

| Capacidad | Estado |
|-----------|--------|
| Money / distribution / ledger / contracts | Sí |
| Orders API Split 1:N adapter | Sandbox/TEST + flags |
| Checkout Pro adapter (N=1) | Clickatón TEST |
| Financial Identity + vault + dual-read | Sí |
| Legacy CLF map/backfill | Dry-run/apply controlado |
| Consumidor cobro productivo | **Clickatón** (no álbum CLF) |

---

## 4. Coexistencia viejo / nuevo

```
CLF productivo (Legacy ≈ Mono)
  Checkout Pro + marketplace_fee
  User.mp* / Lab.mp*
  WebhookEvent + Order.mp*
       │
       └─ dual-read opcional → DnxFinancialIdentity (default OFF / LEGACY_ONLY)

@repo/payments (paralelo)
  Orders 1:N + FI + agreements
  Usado por Clickatón staging
```

---

## 5. LEGACY_PAYMENT_PARITY_REQUIRED

Mantener hasta cutover + estabilización:

1. Checkout Pro Preferences + `marketplace_fee` 2-vías  
2. Collector fotógrafo vs organizador 100%  
3. `external_reference` + `metadata.orderType` + query webhook  
4. Idempotencia `WebhookEvent`  
5. Finalize / reverse / reconcile crons  
6. OAuth MP fotógrafo/lab/organizador → columnas `mp*`  
7. Comisiones escuela/evento/referidos + `PaymentSplit` print  
8. Bloqueo pedidos test/simulated en prod  
9. FI en `LEGACY_ONLY` hasta backfill explícito  

---

## 6. POST_MIGRATION_DNX_PAYMENTS_1N

**No implementar en etapas de paridad:**

- Split 1:N Orders API en checkout álbum  
- Nuevos collectors DNX-only  
- Ledger DNX como SoT de cobro CLF  
- Settlement/referidos nuevos vía DNX  
- Apagar `marketplace_fee` ad-hoc  
- `ORDERS_1N_PRODUCTION_ENABLED` en CLF  

Puente ya listo (`legacy/clf`, dual-read) — **cutover de cobro** es etapa posterior al freeze Legacy.

---

## 7. Commits Legacy pagos a revalidar

- `1dc8084a` — CLF-ORGANIZER-AS-COLLECTOR-100  
  Archivos collector reportados idénticos en mono; **smoke staging obligatorio** con evento 100% org.
