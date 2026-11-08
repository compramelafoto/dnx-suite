# Piloto Split 1:N en un álbum de CLF — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que una compra real de fotos digitales en un álbum piloto de Comprame la Foto se cobre con Orders API + Split 1:N, repartiendo en el momento entre fotógrafo, referidor y plataforma; cualquier otro álbum o carrito sigue con Checkout Pro sin cambios.

**Architecture:** la ruta de pedidos ya desvía los álbumes demo a `/pago-simulado/[orderId]`; el piloto usa el mismo desvío hacia una página nueva `/pagar/[orderId]` con el Card Payment Brick. Una server action crea la orden de Mercado Pago con montos fijos y, si queda acreditada, finaliza el pedido reutilizando la entrega y los avisos de Checkout Pro. El receptor `/api/webhooks/dnx-payments` finaliza de forma idempotente las órdenes del piloto por si la página se cierra antes.

**Tech Stack:** Next.js 16 (App Router, server actions), Prisma, `@repo/payments` (MercadoPagoOrdersAdapter, SplitConsentAdapter, calculateDistribution), `@mercadopago/sdk-react` (CardPayment), `node:test` vía tsx.

**Spec:** diseño aprobado en chat el 2026-11-08 (resumido en "Global Constraints").

## Global Constraints

- Todo el código vive en `apps/compramelafoto/`. **Clickatón no se toca** (ni `apps/clickaton`, ni sus flags, ni sus tests).
- **Sin migraciones.** Los datos de la orden de MP van en `Order.pricingSnapshot.split1nPiloto` (JSON) y `Order.mpPaymentId` (id `PAY01…`).
- En CLF `totalCents` y `platformCommissionCents` están en **pesos enteros**, no centavos. Para MP: `money("ARS", BigInt(pesos * 100))`.
- Variables de entorno nuevas (exactas):
  - `DNX_CLF_SPLIT_1N_PILOTO_ENABLED` = `"true"` para encender.
  - `DNX_CLF_SPLIT_1N_PILOTO_ALBUM_IDS` = ids separados por coma, p. ej. `"1234"`.
  - `DNX_CLF_SPLIT_1N_PILOTO_RECEIVERS` = `userId:receiverId` separados por coma, p. ej. `"35:a7e0f0b0-…,53:9150ee8c-…"`.
  - `DNX_CLF_SPLIT_1N_PILOTO_OWNER_USER_ID` = `"97484805"`.
  - Token: `DNX_MP_PLATFORM_ACCESS_TOKEN`. Public key: `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` (o `MP_PUBLIC_KEY`).
- Elegible sólo si: piloto encendido, álbum en la lista, carrito **sólo DIGITAL** (sin PRINT, sin videos, sin canje, sin pago simulado, origen estándar), el fotógrafo tiene receiver en el mapa, y si tiene referidor `PHOTOGRAPHER_REFERRAL` activo, el referidor también. Si falla cualquier cosa → flujo actual, sin error al comprador.
- Reparto (pesos): fotógrafo = `total − fee`; referidor = `floor(fee × REFERRAL_PROGRAM_FEE_SHARE.PHOTOGRAPHER_REFERRAL)` si hay referidor, si no 0; plataforma = `fee − referidor`. `fee` = `totals.marketplaceFeeCents` del pedido. Total 3450 / fee 450 → 3000 / 225 / 225.
- `external_reference` = `clf-album-order-<orderId>`. `statement_descriptor` = `"CLF FOTOS"`.
- El Order de CLF queda `PAID` sólo con la orden MP `processed`/`accredited` leída por `GET` con el token de plataforma.
- La ganancia del referidor (`ReferralEarning`) se crea igual y se marca `paidOutAt = now()`: MP ya le pagó.
- Textos al comprador en español rioplatense; nunca "plata".

## Review Focus

1. **Doble cobro por reintento:** si Ariel aprieta Pagar dos veces o recarga, no debe crearse una segunda orden MP para un pedido ya pagado o con una orden MP acreditada → test en Task 4.
2. **Pago rechazado:** tarjeta rechazada → el pedido sigue `PENDING`, el comprador ve el motivo y puede reintentar con otra tarjeta → test en Task 4.
3. **Webhook y página a la vez:** la página y el webhook finalizan el mismo pedido → la entrega, los correos y la ganancia del referidor ocurren una sola vez → test en Task 3.
4. **Consentimiento revocado entre la elección y el pago:** al pagar se consulta MP; si alguno no está `ACTIVE`, no se cobra y se informa → test en Task 4.
5. **Pagador que es receptor:** el correo del comprador coincide con el del fotógrafo o el referidor → no se cobra → test en Task 4.

---

### Task 1: Configuración y elegibilidad del piloto (puro)

**Files:**
- Create: `apps/compramelafoto/lib/split-1n-piloto/config.ts`
- Create: `apps/compramelafoto/lib/split-1n-piloto/elegibilidad.ts`
- Test: `apps/compramelafoto/lib/split-1n-piloto/piloto.test.ts`
- Modify: `apps/compramelafoto/package.json` (script `test:split-1n-piloto`: `pnpm --filter @repo/payments exec tsx --test ../../apps/compramelafoto/lib/split-1n-piloto/piloto.test.ts`)

**Interfaces:**
- Produces:
  - `type PilotoConfig = { enabled: boolean; albumIds: Set<number>; receiverByUserId: Map<number, string>; ownerUserId: string | null; accessToken: string | null; publicKey: string | null }`
  - `resolvePilotoConfig(env?: NodeJS.ProcessEnv): PilotoConfig` — nunca lanza; entradas mal formadas se ignoran.
  - `type ElegibilidadInput = { config: PilotoConfig; albumId: number; photographerUserId: number | null; referrerUserId: number | null; items: Array<{ productType: string }>; tieneVideos: boolean; esCanje: boolean; esPagoSimulado: boolean; origenEstandar: boolean }`
  - `evaluarElegibilidadPiloto(input): { ok: true; receivers: { fotografo: string; referidor: string | null } } | { ok: false; motivo: string }`
  - `calcularRepartoPiloto({ totalPesos, feePesos, hayReferidor }): { fotografo: number; referidor: number; plataforma: number }` (en `elegibilidad.ts`), usa `REFERRAL_PROGRAM_FEE_SHARE`.

- [ ] **Step 1: Tests que fallan** — en `piloto.test.ts`:
  - `resolvePilotoConfig` con `ENABLED` ausente → `enabled === false`; con `ALBUM_IDS=" 12, x ,34"` → `albumIds` = {12, 34}; con `RECEIVERS="35:aaa,bad,53:bbb"` → mapa {35→"aaa", 53→"bbb"}.
  - `evaluarElegibilidadPiloto`: apagado → `{ok:false, motivo:"piloto_apagado"}`; álbum fuera de lista → `"album_fuera_de_piloto"`; un ítem `PRINT` → `"carrito_no_solo_digital"`; `tieneVideos` → `"carrito_no_solo_digital"`; fotógrafo sin receiver → `"fotografo_sin_consentimiento"`; referidor sin receiver → `"referidor_sin_consentimiento"`; caso feliz con referidor → `receivers = {fotografo:"aaa", referidor:"bbb"}`; sin referidor → `referidor: null`.
  - `calcularRepartoPiloto({totalPesos:3450, feePesos:450, hayReferidor:true})` → `{fotografo:3000, referidor:225, plataforma:225}`; `{3451, 451, true}` → `{3000, 225, 226}`; `{3450, 450, false}` → `{3000, 0, 450}`; la suma siempre = `totalPesos`.
- [ ] **Step 2:** `pnpm test:split-1n-piloto` → FAIL (módulos inexistentes).
- [ ] **Step 3:** implementar `config.ts` y `elegibilidad.ts`.
- [ ] **Step 4:** `pnpm test:split-1n-piloto` → PASS.
- [ ] **Step 5:** commit `Piloto Split 1:N: configuración, elegibilidad y reparto`.

### Task 2: Desvío en la ruta de pedidos

**Files:**
- Modify: `apps/compramelafoto/app/api/a/[id]/orders/route.ts` (después del bloque `if (pagoSimulado) { … }`, ~línea 761, antes de "Crear preferencia de pago")
- Create: `apps/compramelafoto/lib/split-1n-piloto/referidor.ts`

**Interfaces:**
- Consumes: `resolvePilotoConfig`, `evaluarElegibilidadPiloto` (Task 1).
- Produces:
  - `buscarReferidorActivo(photographerUserId: number): Promise<number | null>` — usa `findActiveReferralAttribution({ referredUserId, referralProgram: PHOTOGRAPHER_REFERRAL })` de `lib/referral/…` (el mismo que usa `create-referral-earnings-for-paid-sale.ts`).
  - Marca en el pedido: `pricingSnapshot.split1nPiloto = { v: 1, estado: "PENDIENTE" }` (merge con el snapshot existente).
  - Respuesta JSON: `{ id, totalCents, initPoint: "/pagar/<id>", split1nPiloto: true }` con status 201.

- [ ] **Step 1:** calcular elegibilidad con los datos que la ruta ya tiene (`album.userId`, `totals.items[].component`, `videoQuote`, `voucher`, `pagoSimulado`, origen). Si `ok`, actualizar `pricingSnapshot` y devolver el `initPoint` del piloto; si no, seguir sin cambios. Envolver en `try/catch`: un error del piloto loguea `[split-1n-piloto] desvio_fallido` y cae al flujo actual.
- [ ] **Step 2:** no reutilizar un pedido viejo con `mpInitPoint` de Checkout Pro para el piloto: si `reusableOrder` existe y el álbum es piloto, el desvío aplica igual sobre ese pedido sólo si sigue `PENDING`.
- [ ] **Step 3:** `npx tsc --noEmit -p tsconfig.json` en `apps/compramelafoto` → 0 errores.
- [ ] **Step 4:** commit `Piloto Split 1:N: la compra de un álbum piloto va a /pagar`.

### Task 3: Finalizar un pedido pagado por Split

**Files:**
- Create: `apps/compramelafoto/lib/split-1n-piloto/mp.ts`
- Create: `apps/compramelafoto/lib/split-1n-piloto/finalizar.ts`
- Test: agregar a `piloto.test.ts`

**Interfaces:**
- Produces:
  - `crearClientesPiloto(config: PilotoConfig): { orders: MercadoPagoOrdersAdapter; consents: MercadoPagoSplitConsentAdapter; http: MercadoPagoHttpClient }` — `environment: "production"`, `allowProductionWrites: true`, `enforceOrders1nStagingGate: false`, `verifyAfterCreate: true`, `defaultStatementDescriptor: "CLF FOTOS"` (mismo armado que `lib/cierre-split-1n/create-production-order.ts`).
  - `pedidoIdDesdeReferencia(ref: string | null | undefined): number | null` — `"clf-album-order-123"` → 123; cualquier otra cosa → null.
  - `decidirFinalizacion({ estadoPedido, mpStatus, mpStatusDetail, refPedidoId, pedidoId }): "aplicar" | "ya_pagado" | "no_acreditada" | "referencia_distinta"` (puro).
  - `finalizarPedidoPiloto({ pedidoId: number; providerOrderId: string }): Promise<{ ok: true; resultado: "aplicado" | "ya_pagado" } | { ok: false; error: string }>`

- [ ] **Step 1: Tests que fallan:** `pedidoIdDesdeReferencia("clf-album-order-42") === 42`, `("clf-cierre-1n-abc") === null`, `(null) === null`; `decidirFinalizacion`: PENDING + processed/accredited + ref igual → `"aplicar"`; PAID → `"ya_pagado"` (aunque MP diga accredited — cubre Review Focus 3); `processed`/`in_process` u otro → `"no_acreditada"`; ref distinta → `"referencia_distinta"`.
- [ ] **Step 2:** correr → FAIL.
- [ ] **Step 3:** implementar. `finalizarPedidoPiloto` hace `GET` de la orden con el token de plataforma; si `"aplicar"`, en este orden: actualizar el pedido con `updateMany({ where: { id, status: { in: ["PENDING","FAILED"] } }, … })` y **continuar sólo si `count === 1`** (esto es lo que impide la doble finalización entre página y webhook); datos: `status:"PAID"`, `mpPaymentId` = id del primer pago (`PAY01…`), `platformCommissionCents` = fee del pedido, `pricingSnapshot.split1nPiloto = { v:1, estado:"PAGADO", providerOrderId, reparto }`. Después: `ensureDigitalDelivery`, los `registerAuditEvent` que hace `finalizeAlbumOrderMercadoPagoApproved` (PAYMENT_APPROVED, CUSTOMER_DATA_RELEASED, ORDER_ITEMS_RELEASED), `createReferralEarningsForPaidSale({ saleRef: "ALBUM_ORDER:<id>", … referralFeeDiscountCents: 0 })` y luego `prisma.referralEarning.updateMany({ where: { saleRef: "ALBUM_ORDER:<id>", paidOutAt: null }, data: { paidOutAt: new Date() } })`, `runAlbumOrderPaidSideEffects`, y `webhookEvent.create` con `orderType: "ALBUM_ORDER"` y `externalRef`.
- [ ] **Step 4:** tests → PASS; `tsc` → 0 errores.
- [ ] **Step 5:** commit `Piloto Split 1:N: finalizar el pedido cuando la orden queda acreditada`.

### Task 4: Pagar — server action

**Files:**
- Create: `apps/compramelafoto/lib/split-1n-piloto/pagar.ts` (`"use server"`)
- Test: agregar a `piloto.test.ts`

**Interfaces:**
- Consumes: Tasks 1 y 3.
- Produces:
  - `prepararCobro({ pedido, config, receivers, correosReceptores, payerEmail }): { ok: true; reparto; reglas } | { ok: false; codigo: "YA_PAGADO" | "ORDEN_EN_CURSO" | "PAGADOR_ES_RECEPTOR" }` (puro): `YA_PAGADO` si el pedido no está PENDING/FAILED; `ORDEN_EN_CURSO` si `pricingSnapshot.split1nPiloto.providerOrderId` existe y su estado guardado es `ACREDITADA`; `PAGADOR_ES_RECEPTOR` vía `pagadorTambienRecibe` de `lib/cierre-split-1n/config.ts`.
  - `pagarPedidoPiloto(input: { pedidoId: number; cardToken: string; paymentMethodId: string; issuerId?: string; installments: number; deviceSessionId: string; payerIdentification?: { type: string; number: string } }): Promise<{ ok: true; estado: "ACREDITADA"; descargaUrl: string | null } | { ok: true; estado: "PENDIENTE" } | { ok: false; codigo: string; mensaje: string }>`

- [ ] **Step 1: Tests que fallan** (sobre `prepararCobro`): pedido PAID → `YA_PAGADO`; snapshot con orden acreditada → `ORDEN_EN_CURSO`; payer = correo del fotógrafo → `PAGADOR_ES_RECEPTOR`; caso feliz → reglas `FIXED` cuyos `fixedAmount` suman el total en centavos (3450 → 345000) y sin regla de referidor cuando es null.
- [ ] **Step 2:** correr → FAIL.
- [ ] **Step 3:** implementar `pagarPedidoPiloto`: recargar pedido (con `album.userId`, `buyerEmail`, `totalCents`, `pricingSnapshot`, fee), re-evaluar elegibilidad, `assertLiveCollectorAccount`, consultar `getConsent` de cada receiver y exigir `ACTIVE` (código `CONSENTIMIENTO_NO_ACTIVO`), `prepararCobro`, `calculateDistribution` con reglas `FIXED`, `createSplitOrder` con `externalReference: "clf-album-order-<id>"`, `idempotencyKey: randomUUID()`, `payerEmail: pedido.buyerEmail`, ítem `"Fotos de «<título del álbum>»"`, `notificationUrl` = `${APP_URL}/api/webhooks/dnx-payments` si el adapter lo admite. Guardar `providerOrderId` y estado en `pricingSnapshot.split1nPiloto`. Si quedó `processed/accredited` → `finalizarPedidoPiloto` y devolver la URL de descarga (la misma que usa `/api/payments/mp/confirm`: `resolveClientDigitalDownloadLinks`). Si MP rechaza (`status_detail` de rechazo), dejar el pedido `PENDING` y devolver `{ ok:false, codigo:"RECHAZADO", mensaje }` con un texto en criollo según el detalle (fondos insuficientes, datos inválidos, rechazo genérico).
- [ ] **Step 4:** tests → PASS; `tsc` → 0.
- [ ] **Step 5:** commit `Piloto Split 1:N: cobrar el pedido con tarjeta y reparto`.

### Task 5: Página `/pagar/[orderId]`

**Files:**
- Create: `apps/compramelafoto/app/pagar/[orderId]/page.tsx`
- Create: `apps/compramelafoto/app/pagar/[orderId]/PagarClient.tsx`

**Interfaces:**
- Consumes: `pagarPedidoPiloto` (Task 4); Brick como en `components/cierre-split-1n/CierreBrick.tsx` (`CardPayment`, `mapBrickFormDataToCardPaymentSubmission`, `assertMercadoPagoDeviceSessionId`).

- [ ] **Step 1:** `page.tsx` (`dynamic = "force-dynamic"`): `notFound()` si el pedido no existe, no tiene `pricingSnapshot.split1nPiloto` o el piloto está apagado; si ya está PAID, mostrar "Esta compra ya está pagada" con link a la descarga. Muestra título del álbum, cantidad de fotos y total, y renderiza `PagarClient` con `publicKey`, `orderId`, `totalPesos`, `volverA = /a/<albumId>/comprar/resumen`.
- [ ] **Step 2:** `PagarClient`: Brick con `amount = totalPesos`; al enviar llama a `pagarPedidoPiloto`; estados: enviando (botón deshabilitado), rechazado (mensaje + "Probar con otra tarjeta"), pendiente ("Tu pago está en revisión, te avisamos por correo"), acreditado ("¡Listo! Ya podés descargar tus fotos" + botón a `descargaUrl`). Sin montos ni receptores en el cliente.
- [ ] **Step 3:** `tsc` → 0; probar en local con el piloto encendido y un pedido de un álbum de prueba: la página carga el Brick con la public key (sin pagar).
- [ ] **Step 4:** commit `Piloto Split 1:N: página de pago con tarjeta`.

### Task 6: Webhook de órdenes del piloto

**Files:**
- Modify: `apps/compramelafoto/app/api/webhooks/dnx-payments/route.ts`
- Create: `apps/compramelafoto/lib/split-1n-piloto/webhook.ts`

**Interfaces:**
- Consumes: `resolvePilotoConfig`, `crearClientesPiloto`, `pedidoIdDesdeReferencia`, `finalizarPedidoPiloto`.
- Produces: `intentarWebhookPiloto({ dataId: string | null; type: string | null }): Promise<{ manejado: false } | { manejado: true; resultado: string }>`

- [ ] **Step 1:** en `route.ts`, antes de `handleClfOrdersWebhook`: si el piloto está encendido y `type` es `order` y hay `data.id`, llamar `intentarWebhookPiloto`. Hace `GET` de la orden con el token de plataforma (la fuente de verdad es el GET, no el cuerpo; por eso no depende de la firma); si la referencia no es `clf-album-order-*` devuelve `manejado:false` y sigue el flujo actual (Muestras y homologación intactos). Si es del piloto, `finalizarPedidoPiloto` y responde 200 `{ ok:true, piloto:true }`. Cualquier error del piloto se loguea y responde 200 para que MP no reintente en loop.
- [ ] **Step 2:** `tsc` → 0; los tests existentes de `lib/homologation/mp-split-1n` siguen en verde (`pnpm test:homologation-mp-split-1n`).
- [ ] **Step 3:** commit `Piloto Split 1:N: el aviso de Mercado Pago también confirma el pedido`.

### Task 7: Cierre de rama

- [ ] `pnpm test:split-1n-piloto`, `pnpm test:cierre-split-1n`, `pnpm test:homologation-mp-split-1n` y `tsc` de `apps/compramelafoto` en verde.
- [ ] Documentar en `docs/payments/mp-split-1n-plan-implementacion.md` (sección nueva "Piloto en un álbum de CLF"): variables, cómo encender/apagar, reembolso manual (`POST /v1/orders/{id}/refund`, cuerpo vacío) y que Clickatón no participa.
- [ ] PR y merge cuando el CI esté verde. La configuración en Vercel y el álbum de prueba se hacen después, fuera de este plan.
