# Muestras Fotográficas — Etapa 8 (venta con reparto en tres y ediciones certificadas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el botón **"Adquirir obra"** lleve a una página que **vende**: formatos aprobados (copia digital firmada o copia impresa Fine Art, **única o de edición limitada**), precio, entrega (digital, retiro en sede o envío), pago con **Mercado Pago Orders + Split 1:N** repartido en el momento entre **plataforma (15 %)**, **organización** y **fotógrafo** (porcentajes que fija la organización y acepta cada autor), **número de copia reservado 20 minutos** que nunca pasa de N, **certificado PDF firmado (Ed25519) con QR**, **etiqueta para el dorso**, **archivo digital con XMP firmado** y **página pública de verificación**. Todo sale a producción detrás de dos llaves (`MUESTRAS_VENTAS_EN_VIVO` + `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED`): hasta entonces el público sigue viendo "La venta de esta obra todavía no está disponible" y el super admin y los probadores compran en sandbox con usuarios de prueba.

**Architecture:** Igual que las etapas 1 a 7: reglas puras en `packages/muestras` (`sales.ts`, `editions.ts`, `certificates.ts`, con vitest) y la app como capa delgada sobre `@repo/db`. Muestras crea la Order 1:N **directamente** con `@repo/payments` (`MercadoPagoOrdersAdapter.createSplitOrder`, token de la aplicación "DNX Suite"; owner = DNX, partners = organización y fotógrafo con `/v1/split-consent`). La confirmación llega por cuatro caminos que terminan en una sola conciliación idempotente que **siempre** lee `GET /v1/orders/{id}`: respuesta de la creación, página del pedido, aviso firmado del receptor único de CLF (`/api/pagos/aviso`) y barrido cada 10 minutos. Nueve tablas nuevas, sin columnas en tablas existentes. Originales, firmas y archivos vendidos en un **bucket R2 privado** nuevo.

**Tech Stack:** Next.js 16.2.1 (App Router, `params`/`searchParams` como Promise, `after()` de `next/server`, `--webpack`), React 19.2.4, Prisma 6 (`@repo/db`), Tailwind 4, `sharp 0.34.5` (`withXmp`), `pdf-lib`, `qrcode`, `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (misma versión que FOTOFFICE), `@repo/payments` (workspace), `node:crypto` (Ed25519, HMAC), vitest 3; Card Payment Brick por script oficial (`https://sdk.mercadopago.com/js/v2`). **Sin dependencias externas nuevas.**

**Spec:** `docs/superpowers/specs/2026-10-11-muestras-etapa-8-venta-design.md` (D1–D36; respuestas de Daniel del 2026-10-11). Diseño general: `docs/superpowers/specs/2026-10-08-muestras-fotograficas-design.md`. Etapas anteriores: `docs/superpowers/plans/2026-10-10-muestras-etapa-6.md`, `docs/superpowers/plans/2026-10-10-muestras-etapa-7-fotorank.md`.

## Global Constraints

- Todo texto visible y todo comentario en **español rioplatense con voseo**, claro y sin "próximamente"; identificadores en inglés dentro de `packages/muestras`, en español en la app.
- Estados como **texto**, nunca enum de Prisma. Ids de usuario `Int` **sin relación Prisma a `User`**. Ids `cuid()`. `activityWorkId` **sin FK**. **Sin columnas nuevas en tablas existentes.** **No se escribe en tablas `Dnx*`** (el consentimiento se lee y se pide a Mercado Pago, y se guarda en `CulturalPayoutAccount`).
- **Plata en centavos** (`bigint`/`Money` del paquete) dentro del cálculo; en la base, pesos enteros (`INT`) para precio y envío, y centavos (`INT`) para los montos repartidos (`*Cents`). Redondeo de D7. Fechas visibles en **hora argentina** (`dates.ts`), pesos con `toLocaleString("es-AR")`.
- **Modos (D1–D3)**: el modo se calcula en cada pedido con `salesMode` y **nunca** se guarda. En `OFF`, ninguna página pública muestra un precio. En `TEST`, todo pedido y copia lleva `isTest = true` y el `payerEmail` tiene que terminar en `@testuser.com` (lo exige Mercado Pago en sandbox; la página lo avisa a los probadores).
- **Mercado Pago**: `external_reference` = `buildOpaqueExternalReference("muestras", "venta", publicId)` (→ `muestras-venta-<publicId>`); descriptor `MUESTRAS FOTO`; `items` con un ítem (`category_id` `art` para impresa, `virtual_goods` para digital — verificar en sandbox que se acepten; si no, `others`); `payerProfile` con nombre, apellido e identificación del Brick; `deviceSessionId` del Brick; `idempotencyKey` = `order.idempotencyKey`. Nunca se loguea el token de la tarjeta, el documento ni el access token (usar `sanitizeError` de `@repo/payments/mercado-pago-connect`).
- **El webhook no es la fuente de verdad**: todo cambio de estado de un pedido sale de `GET /v1/orders/{id}` comparado con lo congelado (`external_reference`, total, reparto).
- **CLF está en producción con ventas reales**: en `apps/compramelafoto` sólo se tocan los archivos de la Task 14; el aviso es en segundo plano, con espera de 3 s, y nunca cambia la respuesta a Mercado Pago. El Checkout Pro de CLF y `/api/payments/mp/webhook` no se tocan.
- **Dependencias**: a `apps/muestras/package.json` se suman sólo `"@repo/payments": "workspace:*"` y `"@aws-sdk/s3-request-presigner": "^3.972.0"`. Después de `pnpm install`, `git diff pnpm-lock.yaml` sólo puede mostrar esas dos líneas en el importer `apps/muestras`; si se mueve cualquier otra cosa, frenar y avisar. Nada de `@mercadopago/sdk-react`.
- Chequeos de tipos y build con `NODE_OPTIONS=--max-old-space-size=8192` y mirar que realmente terminaron (el chequeo de tipos puede morir por memoria y devolver éxito).
- Diseño de Muestras: tokens de `apps/muestras/app/globals.css`, `.mf-titulo`, líneas finas, botones finos (`h-11 border border-[var(--mf-ink)] px-5`), `rounded-[2px]`. Clases repetidas en `components/ventas/estilos.ts` (puede reexportar `components/montaje/estilos.ts`).
- **Autorización del lado del servidor en cada página, acción y ruta.** Cada `page.tsx` nueva del panel llama `requireUsuario(<su propia ruta>)`; cada acción vuelve a leer la sesión y el permiso **en la base** (`rolEnMuestra` + `puede(usuario, "sales" | "salesFulfill", rol)`, fila propia con `authorUserId = usuario.id`, o super admin). Toda negativa del panel es `notFound()`. Las páginas del comprador validan el token o la cookie con `timingSafeEqual`.
- **Ninguna página pública cacheada lee cookies** (siguen ISR con `revalidate = 300`); las páginas de compra, pedido y verificación son **dinámicas**, `noindex`, `referrer: no-referrer`, `Cache-Control: private, no-store`.
- **Correo apagado**: nada de esta etapa manda correos.
- Puerto de desarrollo de Muestras **3014**; CLF **3000**. Probar con `next dev` (las vistas previas de Vercel no sirven).
- Worktree `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-muestras-8`, rama `feat/muestras-etapa-8-venta` (sale de `origin/main`, con las etapas 1 a 7 en producción).
- La migración **no se aplica sola**: la aplica **a mano en producción el controlador**, con la autorización de Daniel, **antes** de publicar el código, y la registra en `_prisma_migrations` con el SHA-256 del archivo (Task 18).

## Mapa de archivos

```
packages/muestras/src/
  sales.ts (+ sales.test.ts)               — modos, reparto, montos, receptores, referencia, ofertas, comprable, pedido, producción, estado de la página
  editions.ts (+ editions.test.ts)         — etiquetas, quedan, próximo número, cambios de edición
  certificates.ts (+ certificates.test.ts) — código, texto canónico, vista de verificación, XMP
  team.ts, panel.ts, room.ts (+ tests)     — capacidades, secciones, `salePageState`
  index.ts
packages/db/prisma/schema.prisma           — 9 modelos nuevos + relaciones inversas (sin columnas)
packages/db/prisma/migrations/20261102120000_muestras_etapa_8_venta/migration.sql
apps/muestras/
  package.json                             — @repo/payments, @aws-sdk/s3-request-presigner
  .env.example                             — variables nuevas
  vercel.json                              — cron /api/cron/ventas
  lib/ventas/config.ts (+ test)            — lee el entorno → modo y faltas
  lib/ventas/mp.ts (+ test)                — adaptador de Orders, consentimiento, lectura de Order, devolución
  lib/ventas/r2-privado.ts (+ test)        — bucket privado: subir, leer, URL firmada de subida, borrar
  lib/ventas/aviso-firma.ts (+ test)       — firma del aviso CLF→Muestras (copia idéntica de la de CLF)
  lib/ventas/cobros.ts (+ test)            — "use server": cuentas de cobro
  lib/ventas/configurar.ts (+ test)        — "use server": encender venta, reparto, entrega
  lib/ventas/autor.ts (+ test)             — "use server": original, firma, ofertas, aceptar reparto, pedir P/A
  lib/ventas/revision.ts (+ test)          — "use server": aprobar / pedir cambios / pausar ofertas
  lib/ventas/comprable.ts (+ test)         — junta datos y aplica `offerPurchasable`
  lib/ventas/reservar.ts (+ test, + reservar.db.test.ts) — reserva del número (transacción)
  lib/ventas/pagar.ts (+ test)             — "use server": crear la Order con el token del Brick
  lib/ventas/conciliar.ts (+ test)         — conciliación idempotente, emisión y anulación
  lib/ventas/certificado.ts (+ test)       — firmar/verificar Ed25519, PDF del certificado, etiqueta del dorso
  lib/ventas/archivo-firmado.ts (+ test)   — JPEG con XMP
  lib/ventas/pedido.ts (+ test)            — token del pedido, cookie, consultas del comprador
  lib/ventas/pedidos-panel.ts (+ test)     — "use server": producción, pedir devolución, P/A, devolver (super admin), borrar pruebas
  lib/ventas/consultas.ts                  — panel de la muestra, del autor, super admin
  lib/limite.ts (+ test)                   — frenos nuevos
  lib/sala/consultas.ts (+ test)           — `mostrarAdquirir` por ofertas (también obras de concurso)
  app/panel/cobros/page.tsx
  app/panel/muestras/[id]/ventas/page.tsx, app/panel/muestras/[id]/ventas/pedidos/page.tsx
  app/panel/expositor/ventas/[activityId]/page.tsx, app/panel/expositor/page.tsx
  app/panel/ventas/page.tsx
  app/m/[slug]/sala/o/[workId]/adquirir/page.tsx, app/m/[slug]/o/[workId]/adquirir/page.tsx, app/m/[slug]/o/[workId]/page.tsx
  app/compras/[publicId]/page.tsx, .../certificado/route.ts, .../archivo/route.ts, .../arrepentimiento/page.tsx
  app/verificar/page.tsx, app/verificar/[codigo]/page.tsx, app/verificar/clave/route.ts
  app/api/ventas/subida/route.ts, app/api/ventas/archivo/[id]/route.ts, app/api/ventas/etiqueta/[orderId]/route.ts, app/api/ventas/certificado/[orderId]/route.ts
  app/api/pagos/aviso/route.ts, app/api/cron/ventas/route.ts
  app/privacidad/page.tsx
  components/ventas/{estilos.ts, cobros.tsx, configurar-venta.tsx, ofertas-autor.tsx, subir-original.tsx, firma-autor.tsx, revision-ofertas.tsx, compra.tsx, brick-tarjeta.tsx, pedido.tsx, pedidos-panel.tsx, verificacion.tsx}
apps/compramelafoto/
  lib/dnx-payments/aviso-muestras.ts (+ aviso-muestras.test.ts)
  lib/homologation/mp-split-1n/orders-webhook.ts   — `routeTo` en el resultado
  app/api/webhooks/dnx-payments/route.ts           — `after(() => avisarAMuestras(...))`
  .env.example                                     — MUESTRAS_AVISO_PAGOS_URL, MUESTRAS_AVISO_PAGOS_SECRET
docs/operations/muestras-puesta-en-marcha.md       — sección "Etapa 8"
```

Orden: 1 → 2 → 3 (reglas puras; la 1 y la 2 son independientes) → 4 (schema) → 5 (infraestructura) → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18. La 14 (CLF) depende sólo de la 5 (módulo de firma) y puede ir en paralelo desde ahí. La 13 (certificados) depende de la 2 y la 5 y puede ir en paralelo con la 6–12. Los tests de la app mockean `@repo/db`, `@/lib/usuario`, `next/cache`, `next/headers`, `next/server` (`after`), R2 y `lib/ventas/mp.ts` con el patrón de `lib/concursos/acciones.test.ts` y `lib/expositores/revision.test.ts`.

---

### Task 1: Reglas puras de la venta — modos, reparto, montos, ofertas, pedido y producción

**Files:**
- Create: `packages/muestras/src/sales.ts`, `packages/muestras/src/sales.test.ts`
- Modify: `packages/muestras/src/index.ts`

**Interfaces:**
- Consumes: nada (no usa `PRICE_MAX_ARS` de `exhibitors.ts`: ese tope desborda los centavos en `INT`).
- Produces:
  - Constantes: `PLATFORM_FEE_BPS = 1500`, `SPLIT_TOTAL_BPS = 10_000`, `AUTHORS_SHARE_BPS = 8500`, `PRICE_MIN_ARS = 1000`, `SALE_PRICE_MAX_ARS = 20_000_000`, `SHIPPING_MAX_ARS = 1_000_000`, `PAPER_MAX = 120`, `SIZE_MIN_CM = 5`, `SIZE_MAX_CM = 300`, `SALE_STATEMENT_DESCRIPTOR = "MUESTRAS FOTO"`, `SALE_SPLIT_TEXT_VERSION = "2026-10-11"`, `SALE_SPLIT_TEXT(pcts)`, `SALE_TERMS_TEXT_VERSION = "2026-10-11"`, `SALE_TERMS_TEXT`, `SALE_EDITION_DECLARATION` ("Declaro que esta edición no se vende por otros medios y que no voy a emitir más copias de las indicadas."), `SALE_UNAVAILABLE_TEXT` y `SALE_ASK_TEXT` (se mueven desde `room.ts`, que los reexporta).
  - Tipos: `SalesMode = "OFF" | "TEST" | "LIVE"`, `SetupStatus`, `OfferFormat`, `EditionKind`, `OfferStatus`, `OrderStatus`, `Fulfillment`, `Delivery`, `ConsentStatus`.
  - `salesMode(input: { ventasEnVivo: boolean; ordersProduccion: boolean; mpEnv: "sandbox" | "production" | null; tokenEsDePrueba: boolean | null; faltan: string[] }): { mode: SalesMode; motivo: string | null }` — D1–D3: con `faltan` no vacío → `OFF` con "Falta configurar: …"; `sandbox` + token de prueba → `TEST`; `production` + token real + las dos llaves → `LIVE`; `production` sin `ordersProduccion` → `OFF` "Mercado Pago todavía no habilitó la producción del reparto"; `production` sin `ventasEnVivo` → `OFF` "La venta en vivo de Muestras está apagada"; token y ambiente que no coinciden → `OFF` "El token de Mercado Pago no corresponde al ambiente".
  - `canBuy(mode, { esSuperAdmin, esProbador })` → `LIVE` todos; `TEST` sólo super admin o probador; `OFF` nadie.
  - `splitProblems({ organizerBps, photographerBps })` → textos: enteros múltiplos de 100 (puntos enteros), cada uno 0..8500, suma 8500 ("La organización y el fotógrafo se reparten el 85 %: tienen que sumar 85."); `splitExample(priceArs, pcts)` → `{ plataforma, organizacion, fotografo }` en pesos para el panel.
  - `saleAmounts({ priceArs, shippingArs, platformFeeBps, organizerBps })` → `{ priceCents, shippingCents, totalCents, platformCents, organizerCents, photographerCents }` (D7: `platform = round(price × fee)`, `organizer = round(price × org)`, `photographer = price − platform − organizer`; el envío se suma al de la organización en `receiverPlan`, no acá). Invariante: `platform + organizer + photographer = priceCents`.
  - `receiverPlan({ amounts, organizer: { userId, receiverId }, photographer: { userId, receiverId } })` → `{ ownerCents, partners: { recipientId: "organizer" | "photographer" | "both"; receiverId; cents }[] }` — misma `receiverId` → un solo partner `both`; montos 0 fuera; suma = total.
  - `saleExternalReference(publicId)` → `"muestras-venta-" + publicId`; `parseSaleExternalReference(ref)` → `publicId | null` (sólo `[a-z0-9]{16}`).
  - `offerProblems(offer, { hasFirstSale })` → textos (formato y edición válidos; `LIMITED` 2..999; `UNIQUE` → N = 1; P/A 0..5 y ≤ N; impresa con papel 1..120 y medidas 5..300; digital sin papel ni medidas; precio `PRICE_MIN_ARS..SALE_PRICE_MAX_ARS`, entero).
  - `offerTransition(action, offer, ctx)` — acciones `propose`/`withdraw`/`reopen` (autor), `approve`/`requestChanges`/`pause`/`resume` (organización), `changePrice` (autor: aprobada → `PROPOSED`, conserva `approvedPriceArs`). Después de la primera venta: formato, edición, papel y medida fijos; N no sube ni baja de lo emitido + reservado.
  - `offerPurchasable(input)` → `{ ok: true } | { ok: false; reasons: string[] }` con las condiciones de D11 (textos del panel: "La venta de la muestra no está abierta", "La muestra no está publicada", "La organización todavía no aprobó este formato", "<Autor> todavía no aceptó el reparto", "<Autor> todavía no conectó su Mercado Pago", "La organización todavía no conectó su Mercado Pago", "Falta el archivo original", "Falta la firma del autor", "No quedan copias").
  - `saleOrderTransition(current, observed: { orderStatus: string; paymentStatus: string | null })` → `{ next: OrderStatus } | { next: null }` (D30; `PROCESSED_ACCREDITED`/`processed`+`accredited` → `PAID`; `FAILED`/`CANCELED`/pago `rejected` → `REJECTED`; `REFUNDED` → `REFUNDED`; `CHARGED_BACK` → `CHARGED_BACK`; `OPEN`/`action_required`/`in_process` → nada). Nunca hacia atrás.
  - `fulfillmentTransition(current, next, delivery)` → `boolean` (`PENDING → IN_PRODUCTION → READY → DELIVERED` para retiro; `IN_PRODUCTION → SHIPPED → DELIVERED` para envío; digital siempre `NONE`).
  - `deliveryOptions(setup, format)` → `["DIGITAL"]` o `["PICKUP", ("SHIPPING")]`.
  - `salePageState({ mode, viewerCanBuy, anyOfferForSale, purchasableOffers })` → `"NOT_FOR_SALE" | "UNAVAILABLE" | "AVAILABLE" | "SOLD_OUT"`.

- [ ] **Step 1: Escribir los tests que fallan**

`packages/muestras/src/sales.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  canBuy, offerProblems, offerPurchasable, offerTransition, parseSaleExternalReference, receiverPlan,
  saleAmounts, saleExternalReference, saleOrderTransition, salePageState, salesMode, splitProblems,
  fulfillmentTransition,
} from "./sales";

const base = { ventasEnVivo: false, ordersProduccion: false, mpEnv: "sandbox" as const, tokenEsDePrueba: true, faltan: [] };

describe("modos", () => {
  it("sandbox con token de prueba → TEST, aunque la llave de Muestras esté encendida", () => {
    expect(salesMode(base).mode).toBe("TEST");
    expect(salesMode({ ...base, ventasEnVivo: true, ordersProduccion: true }).mode).toBe("TEST");
  });
  it("producción exige las dos llaves y un token real", () => {
    const prod = { ...base, mpEnv: "production" as const, tokenEsDePrueba: false };
    expect(salesMode(prod).mode).toBe("OFF");
    expect(salesMode({ ...prod, ventasEnVivo: true }).motivo).toMatch(/Mercado Pago todavía no habilitó/);
    expect(salesMode({ ...prod, ordersProduccion: true }).motivo).toMatch(/apagada/);
    expect(salesMode({ ...prod, ventasEnVivo: true, ordersProduccion: true }).mode).toBe("LIVE");
    expect(salesMode({ ...prod, ventasEnVivo: true, ordersProduccion: true, tokenEsDePrueba: true }).mode).toBe("OFF");
  });
  it("con faltas → OFF y dice qué falta", () => {
    const r = salesMode({ ...base, faltan: ["MUESTRAS_CERT_PRIVATE_KEY"] });
    expect(r.mode).toBe("OFF");
    expect(r.motivo).toContain("MUESTRAS_CERT_PRIVATE_KEY");
  });
  it("quién compra", () => {
    expect(canBuy("TEST", { esSuperAdmin: false, esProbador: false })).toBe(false);
    expect(canBuy("TEST", { esSuperAdmin: false, esProbador: true })).toBe(true);
    expect(canBuy("LIVE", { esSuperAdmin: false, esProbador: false })).toBe(true);
    expect(canBuy("OFF", { esSuperAdmin: true, esProbador: true })).toBe(false);
  });
});

describe("reparto y montos", () => {
  it("tiene que sumar 85 en puntos enteros", () => {
    expect(splitProblems({ organizerBps: 2500, photographerBps: 6000 })).toEqual([]);
    expect(splitProblems({ organizerBps: 3000, photographerBps: 6000 }).join()).toMatch(/85/);
    expect(splitProblems({ organizerBps: 2550, photographerBps: 5950 }).join()).toMatch(/enteros/);
  });
  it("15 % plataforma y el redondeo cae en el fotógrafo", () => {
    const a = saleAmounts({ priceArs: 33_333, shippingArs: 0, platformFeeBps: 1500, organizerBps: 2500 });
    expect(a.priceCents).toBe(3_333_300);
    expect(a.platformCents).toBe(499_995);
    expect(a.organizerCents).toBe(833_325);
    expect(a.platformCents + a.organizerCents + a.photographerCents).toBe(a.priceCents);
  });
  it("el envío va a la organización; misma cuenta = un partner; ceros fuera", () => {
    const amounts = saleAmounts({ priceArs: 100_000, shippingArs: 8_000, platformFeeBps: 1500, organizerBps: 0 });
    const p = receiverPlan({ amounts, organizer: { userId: 1, receiverId: "r-org" }, photographer: { userId: 2, receiverId: "r-foto" } });
    expect(p.ownerCents).toBe(1_500_000);
    expect(p.partners).toEqual([
      { recipientId: "organizer", receiverId: "r-org", cents: 800_000 },
      { recipientId: "photographer", receiverId: "r-foto", cents: 8_500_000 },
    ]);
    const mismo = receiverPlan({ amounts, organizer: { userId: 1, receiverId: "r" }, photographer: { userId: 1, receiverId: "r" } });
    expect(mismo.partners).toEqual([{ recipientId: "both", receiverId: "r", cents: 9_300_000 }]);
  });
});

describe("referencia", () => {
  it("ida y vuelta, y rechaza lo ajeno", () => {
    expect(saleExternalReference("abcd1234abcd1234")).toBe("muestras-venta-abcd1234abcd1234");
    expect(parseSaleExternalReference("muestras-venta-abcd1234abcd1234")).toBe("abcd1234abcd1234");
    expect(parseSaleExternalReference("clickaton-registration-x")).toBeNull();
    expect(parseSaleExternalReference("muestras-venta-../x")).toBeNull();
  });
});

describe("ofertas", () => {
  const impresa = { format: "PRINT", editionKind: "LIMITED", editionSize: 10, proofCount: 2, priceArs: 150_000, paper: "Hahnemühle Photo Rag 308 g", widthCm: 40, heightCm: 60 } as const;
  it("valida formatos y ediciones", () => {
    expect(offerProblems(impresa, { hasFirstSale: false })).toEqual([]);
    expect(offerProblems({ ...impresa, editionKind: "UNIQUE", editionSize: 3 }, { hasFirstSale: false }).length).toBeGreaterThan(0);
    expect(offerProblems({ ...impresa, paper: null }, { hasFirstSale: false }).length).toBeGreaterThan(0);
    expect(offerProblems({ ...impresa, format: "DIGITAL" }, { hasFirstSale: false }).length).toBeGreaterThan(0);
    expect(offerProblems({ ...impresa, proofCount: 6 }, { hasFirstSale: false }).length).toBeGreaterThan(0);
    expect(offerProblems({ ...impresa, priceArs: 999 }, { hasFirstSale: false }).length).toBeGreaterThan(0);
  });
  it("cambiar el precio de una aprobada la manda a revisión y conserva el precio aprobado", () => {
    const r = offerTransition("changePrice", { status: "APPROVED", priceArs: 100_000, approvedPriceArs: 100_000 }, { actor: "AUTHOR", newPriceArs: 120_000 });
    expect(r).toMatchObject({ ok: true, status: "PROPOSED", priceArs: 120_000, approvedPriceArs: 100_000 });
  });
  it("después de la primera venta N no sube", () => {
    const r = offerTransition("editEdition", { status: "APPROVED", editionSize: 10, firstSoldAt: new Date() }, { actor: "AUTHOR", editionSize: 12, issuedOrReserved: 3 });
    expect(r.ok).toBe(false);
  });
  it("comprable sólo con todo en regla; dice qué falta", () => {
    const ok = { setupStatus: "OPEN", activityPublished: true, offerStatus: "APPROVED", authorAcceptedVersion: 2, splitVersion: 2,
      workSellable: true, organizerConsent: "ACTIVE", authorConsent: "ACTIVE", needsFile: true, fileReady: true, signature: true, remaining: 4, authorName: "Ana" } as const;
    expect(offerPurchasable(ok)).toEqual({ ok: true });
    const r = offerPurchasable({ ...ok, authorAcceptedVersion: 1, authorConsent: "PENDING" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.join(" ")).toMatch(/Ana todavía no aceptó el reparto.*Ana todavía no conectó/);
  });
});

describe("pedido y producción", () => {
  it("transiciones de pedido", () => {
    expect(saleOrderTransition("PENDING_PAYMENT", { orderStatus: "PROCESSED_ACCREDITED", paymentStatus: "accredited" }).next).toBe("PAID");
    expect(saleOrderTransition("PENDING_PAYMENT", { orderStatus: "FAILED", paymentStatus: "rejected" }).next).toBe("REJECTED");
    expect(saleOrderTransition("PENDING_PAYMENT", { orderStatus: "OPEN", paymentStatus: "in_process" }).next).toBeNull();
    expect(saleOrderTransition("PAID", { orderStatus: "REFUNDED", paymentStatus: "refunded" }).next).toBe("REFUNDED");
    expect(saleOrderTransition("PAID", { orderStatus: "PROCESSED_ACCREDITED", paymentStatus: "accredited" }).next).toBeNull();
    expect(saleOrderTransition("REFUNDED", { orderStatus: "PROCESSED_ACCREDITED", paymentStatus: "accredited" }).next).toBeNull();
    expect(saleOrderTransition("PAID_NO_COPY", { orderStatus: "REFUNDED", paymentStatus: "refunded" }).next).toBe("REFUNDED");
  });
  it("circuito de impresión", () => {
    expect(fulfillmentTransition("PENDING", "IN_PRODUCTION", "PICKUP")).toBe(true);
    expect(fulfillmentTransition("IN_PRODUCTION", "SHIPPED", "PICKUP")).toBe(false);
    expect(fulfillmentTransition("IN_PRODUCTION", "SHIPPED", "SHIPPING")).toBe(true);
    expect(fulfillmentTransition("DELIVERED", "READY", "PICKUP")).toBe(false);
  });
  it("estado de la página", () => {
    expect(salePageState({ mode: "OFF", viewerCanBuy: false, anyOfferForSale: true, purchasableOffers: 2 })).toBe("UNAVAILABLE");
    expect(salePageState({ mode: "LIVE", viewerCanBuy: true, anyOfferForSale: false, purchasableOffers: 0 })).toBe("NOT_FOR_SALE");
    expect(salePageState({ mode: "LIVE", viewerCanBuy: true, anyOfferForSale: true, purchasableOffers: 0 })).toBe("SOLD_OUT");
    expect(salePageState({ mode: "TEST", viewerCanBuy: true, anyOfferForSale: true, purchasableOffers: 1 })).toBe("AVAILABLE");
  });
});
```

- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter @repo/muestras test -- sales` — Expected: FAIL (`Cannot find module './sales'`).

- [ ] **Step 3: Implementar `sales.ts`** con las firmas de arriba (sin dependencias; aritmética en enteros con `Math.round` sobre centavos; `SOLD_OUT` cuando hay ofertas aprobadas pero ninguna con números libres) y reexportarlo en `index.ts`.

- [ ] **Step 4: Correr** — Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter @repo/muestras lint` — Expected: en verde.

- [ ] **Step 5: Commit**

```bash
git add packages/muestras
git commit -m "Muestras: reglas puras de la venta — modos, reparto en tres, montos, ofertas y pedidos"
```

**Acceptance:** `saleAmounts` nunca reparte un centavo de más ni de menos (test con precios de 1.000 a 20.000.000 en pasos irregulares: la suma siempre da el precio).

---

### Task 2: Reglas puras de ediciones y certificados

**Files:**
- Create: `packages/muestras/src/editions.ts` (+ test), `packages/muestras/src/certificates.ts` (+ test)
- Modify: `packages/muestras/src/index.ts`

**Interfaces:**
- Consumes: el alfabeto de códigos de sala (`room.ts`: exportar `ROOM_CODE_ALPHABET` si no lo está).
- Produces:
  - `editions.ts`: `RESERVATION_MINUTES = 20`, `PENDING_HOLD_HOURS = 72`, `MAX_PROOFS = 5`, `MAX_OFFERS_PER_WORK = 6`; `editionLabel({ kind, number, size, editionKind, proofCount })` → "Copia única", "3/10", "P/A 1/2"; `copyCounts(rows, now)` → `{ issued, voided, reserved, free }` (reservas vencidas cuentan como libres); `editionRemaining(rows, size, now)`; `nextEditionNumber(rows: { id; number; status; reservedUntil: Date | null }[], size, now)` → `{ reuseId: string; number } | { create: true; number } | null` (número libre más bajo; reutiliza `RELEASED` o `RESERVED` vencida; **nunca** `ISSUED`/`VOIDED`); `canChangeEdition({ firstSoldAt, currentSize, nextSize, issuedOrReserved })`.
  - `certificates.ts`: `CERTIFICATE_CODE_LENGTH = 12`; `newCertificateCode(randomInt)`; `normalizeCertificateCode(raw)` (mayúsculas, sin espacios ni guiones; `null` si no es del alfabeto o de otro largo); `certificatePayload(data)` → texto canónico (JSON con claves ordenadas, sin espacios; campos de D18; `buyer` sólo si `buyerOnCertificate`; `test: true` si es prueba); `certificateView({ status, isTest, voidedAt, signatureValid })` → `"VALID" | "VOIDED" | "TEST" | "INVALID_SIGNATURE"` con su título ("Copia auténtica 3/10 de …", "Esta copia fue anulada el …", "Certificado de prueba, sin validez", "La firma no coincide: este certificado no es válido"); `xmpPacket(data)` → paquete XMP (`<x:xmpmeta>` con `dc:title`, `dc:creator`, `dc:rights`, `xmpRights:WebStatement` y namespace `mf` = `https://muestrasfotograficas.com/ns/certificado/1.0/` con `code`, `edition`, `originalSha256`, `kid`, `signature`), escapando `& < > " '`.

- [ ] **Step 1: Tests que fallan**

`editions.test.ts`: con N = 10 y 9 emitidas → el próximo es 10; con 10 emitidas → `null`; una `RESERVED` vencida (número 4) → `reuseId` de esa y número 4; una `VOIDED` (número 2) **no** se reutiliza y cuenta como ocupada (10 − emitidas − anuladas); `RELEASED` número 1 → se reutiliza primero; P/A se numera aparte; `editionLabel` en los tres casos; `canChangeEdition` rechaza subir después de vender y bajar por debajo de lo emitido + reservado.
`certificates.test.ts`: el texto canónico es igual con las claves en otro orden; sin aceptación no aparece el comprador; con `isTest` aparece `"test":true`; un vector fijo (datos de ejemplo → string exacto esperado); `normalizeCertificateCode(" abcd-efgh-jkmn ")`; `xmpPacket` escapa un título con `<` y `&`; `certificateView` en los cuatro casos.

- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter @repo/muestras test -- editions certificates` — Expected: FAIL.

- [ ] **Step 3: Implementar** y reexportar.

- [ ] **Step 4: Correr** — Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types` — Expected: en verde.

- [ ] **Step 5: Commit**

```bash
git add packages/muestras
git commit -m "Muestras: reglas puras de ediciones numeradas y certificados"
```

**Acceptance:** ninguna combinación de filas hace que `nextEditionNumber` devuelva un número mayor que N o uno `ISSUED`/`VOIDED` (test con todas las combinaciones de 3 estados para N = 4).

---

### Task 3: Capacidades, secciones del panel y estado de la página de compra

**Files:**
- Modify: `packages/muestras/src/team.ts` (+ test), `packages/muestras/src/panel.ts` (+ test), `packages/muestras/src/room.ts` (+ test)

**Interfaces:**
- Produces:
  - `team.ts`: capacidades `sales` (sólo `OWNER`) y `salesFulfill` (`OWNER`, `CO_ORGANIZER`).
  - `panel.ts`: "Cobros" (`/panel/cobros`, grupo "Tu cuenta", `ready: true`); en la muestra "Ventas" (`/panel/muestras/<id>/ventas`, capacidad `sales` o `salesFulfill`); "Ventas de la plataforma" (`/panel/ventas`, sólo super admin).
  - `room.ts`: `SALES_ENABLED` y `saleState` quedan como envoltura de compatibilidad (`@deprecated`, devuelven lo mismo que hoy) hasta que la Task 15 saque sus usos; `showBuyButton({ roomBuy, hasOffers })` (antes `forSale`); `SALE_UNAVAILABLE_TEXT`/`SALE_ASK_TEXT` reexportados desde `sales.ts`.

- [ ] **Step 1: Tests que fallan** — `can("sales", { role: "CO_ORGANIZER" })` falso, `can("salesFulfill", { role: "CO_ORGANIZER" })` verdadero, `TEXT_EDITOR` ninguna, super admin todas; las secciones nuevas aparecen sólo con su capacidad; `showBuyButton`.
- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter @repo/muestras test -- team panel room` — Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr** — Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter muestras test` — Expected: en verde (la app todavía usa `saleState`).
- [ ] **Step 5: Commit**

```bash
git add packages/muestras
git commit -m "Muestras: capacidades de venta, secciones del panel y estado de la página de compra"
```

---

### Task 4: Tablas de la venta (migración escrita a mano, sin aplicar)

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20261102120000_muestras_etapa_8_venta/migration.sql`

**Interfaces:**
- Produces: `prisma.culturalSaleSetup` (único `activityId`), `prisma.culturalSaleAuthorTerms` (único `activityId_userId`), `prisma.culturalPayoutAccount` (único `userId_environment`), `prisma.culturalSaleFile` (único `activityWorkId`), `prisma.culturalAuthorSignature` (id `userId`), `prisma.culturalWorkOffer`, `prisma.culturalEditionCopy` (único `offerId_isTest_kind_number`, único `certificateCode`), `prisma.culturalSaleOrder` (únicos `publicId`, `copyId`, `externalReference`, `providerOrderId`, `idempotencyKey`), `prisma.culturalSaleEvent`. Relaciones inversas en `CulturalActivity` (`saleSetup`, `saleAuthorTerms`, `saleFiles`, `workOffers`, `editionCopies`, `saleOrders`). **Ninguna columna nueva** en modelos existentes.

- [ ] **Step 1: Confirmar el nombre de la migración**

Run: `git fetch origin && git ls-tree --name-only origin/main packages/db/prisma/migrations/ | tail -4`
Expected: las últimas son las tres `20261101120000_*`. Si apareció una posterior a `20261102120000`, usar un timestamp mayor y reemplazarlo en todo el plan.

- [ ] **Step 2: Cambiar el schema (sin `prisma format`: reformatea todo el archivo)**

En `model CulturalActivity`, debajo de `contestAuthors CulturalContestAuthor[]`:
```prisma

  /// Venta de obras (etapa 8).
  saleSetup       CulturalSaleSetup?
  saleAuthorTerms CulturalSaleAuthorTerms[]
  saleFiles       CulturalSaleFile[]
  workOffers      CulturalWorkOffer[]
  editionCopies   CulturalEditionCopy[]
  saleOrders      CulturalSaleOrder[]
```
Al final del archivo:
```prisma
/// Venta habilitada en una muestra (Muestras, etapa 8). Los porcentajes son puntos básicos sobre el
/// precio de la obra: plataforma + organización + fotógrafo = 10000.
model CulturalSaleSetup {
  id              String           @id @default(cuid())
  activityId      String           @unique
  activity        CulturalActivity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  /// DRAFT | OPEN | PAUSED | CLOSED
  status          String           @default("DRAFT")
  /// Quién cobra por la organización (dueño de la muestra al encender la venta).
  organizerUserId Int
  platformFeeBps  Int
  organizerBps    Int
  photographerBps Int
  splitVersion    Int              @default(1)
  pickupText      String?
  shippingEnabled Boolean          @default(false)
  shippingCostArs Int?
  shippingText    String?
  extraTerms      String?
  openedAt        DateTime?
  createdByUserId Int
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
}

/// Aceptación del reparto por cada autor en una muestra.
model CulturalSaleAuthorTerms {
  id              String           @id @default(cuid())
  activityId      String
  activity        CulturalActivity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  userId          Int
  splitVersion    Int
  platformFeeBps  Int
  organizerBps    Int
  photographerBps Int
  textVersion     String
  acceptedAt      DateTime         @default(now())

  @@unique([activityId, userId])
  @@index([userId])
}

/// Cuenta de Mercado Pago que recibe reparto, por persona y ambiente (SANDBOX | PRODUCTION).
/// El consentimiento vive en Mercado Pago; acá se guarda la última lectura.
model CulturalPayoutAccount {
  id            String    @id @default(cuid())
  userId        Int
  environment   String
  mpEmail       String
  receiverId    String?
  /// NONE | PENDING | ACTIVE | REJECTED | CANCELED | EXPIRED
  consentStatus String    @default("NONE")
  inviteUrl     String?
  lastCheckedAt DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([userId, environment])
  @@index([receiverId])
}

/// Archivo original de una obra para la venta, en el bucket privado. `activityWorkId` sin FK.
model CulturalSaleFile {
  id             String           @id @default(cuid())
  activityWorkId String           @unique
  activityId     String
  activity       CulturalActivity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  authorUserId   Int
  storageKey     String
  sha256         String?
  bytes          Int?
  mime           String?
  widthPx        Int?
  heightPx       Int?
  /// PENDING_UPLOAD | READY | REJECTED
  status         String           @default("PENDING_UPLOAD")
  problem        String?
  uploadedAt     DateTime?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  @@index([activityId])
  @@index([authorUserId])
}

/// Firma manuscrita escaneada del autor (bucket privado). Sólo va dentro del certificado.
model CulturalAuthorSignature {
  userId     Int      @id
  storageKey String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

/// Un formato a la venta de una obra: digital o impresa, única o edición limitada.
model CulturalWorkOffer {
  id               String           @id @default(cuid())
  activityId       String
  activity         CulturalActivity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  activityWorkId   String
  authorUserId     Int
  /// DIGITAL | PRINT
  format           String
  /// UNIQUE | LIMITED
  editionKind      String
  editionSize      Int
  proofCount       Int              @default(0)
  priceArs         Int
  /// Precio vigente aprobado por la organización (se vende a este mientras un cambio espera aprobación).
  approvedPriceArs Int?
  paper            String?
  widthCm          Float?
  heightCm         Float?
  /// DRAFT | PROPOSED | CHANGES_REQUESTED | APPROVED | PAUSED | WITHDRAWN
  status           String           @default("DRAFT")
  reviewNote       String?
  proposedAt       DateTime?
  approvedAt       DateTime?
  approvedByUserId Int?
  firstSoldAt      DateTime?
  /// Para unir más adelante una misma edición vendida en varias muestras (sin uso en la etapa 8).
  editionGroupId   String?
  sortOrder        Int              @default(0)
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  copies CulturalEditionCopy[]
  orders CulturalSaleOrder[]

  @@index([activityId, status])
  @@index([activityWorkId])
  @@index([authorUserId])
}

/// Un número de una edición. Una copia ISSUED o VOIDED nunca se reutiliza.
model CulturalEditionCopy {
  id                   String            @id @default(cuid())
  offerId              String
  offer                CulturalWorkOffer @relation(fields: [offerId], references: [id], onDelete: Restrict)
  activityId           String
  activity             CulturalActivity  @relation(fields: [activityId], references: [id], onDelete: Restrict)
  isTest               Boolean           @default(false)
  /// COPY | PROOF
  kind                 String
  number               Int
  /// RESERVED | ISSUED | VOIDED | RELEASED
  status               String
  reservedUntil        DateTime?
  orderId              String?
  certificateCode      String?           @unique
  certificateKid       String?
  certificatePayload   String?
  certificateSignature String?
  issuedAt             DateTime?
  voidedAt             DateTime?
  voidReason           String?
  createdAt            DateTime          @default(now())
  updatedAt            DateTime          @updatedAt

  @@unique([offerId, isTest, kind, number])
  @@index([activityId])
  @@index([orderId])
}

/// Pedido de compra de una copia. El comprador no necesita cuenta.
model CulturalSaleOrder {
  id                   String            @id @default(cuid())
  publicId             String            @unique
  accessTokenHash      String
  activityId           String
  activity             CulturalActivity  @relation(fields: [activityId], references: [id], onDelete: Restrict)
  offerId              String
  offer                CulturalWorkOffer @relation(fields: [offerId], references: [id], onDelete: Restrict)
  copyId               String?           @unique
  isTest               Boolean           @default(false)
  buyerName            String
  buyerEmail           String
  buyerPhone           String?
  buyerOnCertificate   Boolean           @default(false)
  /// DIGITAL | PICKUP | SHIPPING
  delivery             String
  shippingAddress      Json?
  priceArs             Int
  shippingArs          Int               @default(0)
  totalCents           Int
  platformCents        Int
  organizerCents       Int
  photographerCents    Int
  splitSnapshot        Json
  /// PENDING_PAYMENT | PAID | REJECTED | EXPIRED | REFUNDED | CHARGED_BACK | PAID_NO_COPY
  status               String            @default("PENDING_PAYMENT")
  /// NONE | PENDING | IN_PRODUCTION | READY | SHIPPED | DELIVERED
  fulfillment          String            @default("NONE")
  trackingText         String?
  externalReference    String            @unique
  providerOrderId      String?           @unique
  providerStatus       String?
  providerStatusDetail String?
  idempotencyKey       String            @unique
  termsVersion         String
  holdExpiresAt        DateTime
  paidAt               DateTime?
  readyAt              DateTime?
  shippedAt            DateTime?
  deliveredAt          DateTime?
  refundRequestedAt    DateTime?
  regretRequestedAt    DateTime?
  refundedAt           DateTime?
  lastSyncedAt         DateTime?
  createdAt            DateTime          @default(now())
  updatedAt            DateTime          @updatedAt

  events CulturalSaleEvent[]

  @@index([activityId, status])
  @@index([offerId])
  @@index([status, holdExpiresAt])
}

/// Historial de un pedido: de dónde vino cada cambio.
model CulturalSaleEvent {
  id             String            @id @default(cuid())
  orderId        String
  order          CulturalSaleOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  /// CREATE | RETURN | NOTICE | SWEEP | ADMIN | STAFF | BUYER
  source         String
  fromStatus     String?
  toStatus       String?
  providerStatus String?
  detail         String?
  actorUserId    Int?
  createdAt      DateTime          @default(now())

  @@index([orderId, createdAt])
}
```

- [ ] **Step 3: Escribir la migración**

`packages/db/prisma/migrations/20261102120000_muestras_etapa_8_venta/migration.sql`:
```sql
-- Muestras Fotográficas · Etapa 8: venta de obras con reparto en tres y ediciones certificadas.
-- Aditiva: crea nueve tablas nuevas. No agrega columnas a tablas existentes ni toca filas.
-- Sin enums. Ids de usuario INTEGER sin FK a "User". `activityWorkId` sin FK (como etapas 6 y 7).
-- NO SE APLICA SOLA: la aplica a mano el controlador (autorizado por Daniel) en la base de
-- FOTOFFICE/FotoRank/Muestras (Neon `divine-hall-10689679`, rama `development`), DESPUÉS de las
-- `20261101120000_*` y ANTES de publicar el código, y la registra en `_prisma_migrations` con el
-- SHA-256 de este archivo.

-- CreateTable
CREATE TABLE "CulturalSaleSetup" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "organizerUserId" INTEGER NOT NULL,
    "platformFeeBps" INTEGER NOT NULL,
    "organizerBps" INTEGER NOT NULL,
    "photographerBps" INTEGER NOT NULL,
    "splitVersion" INTEGER NOT NULL DEFAULT 1,
    "pickupText" TEXT,
    "shippingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "shippingCostArs" INTEGER,
    "shippingText" TEXT,
    "extraTerms" TEXT,
    "openedAt" TIMESTAMP(3),
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalSaleSetup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalSaleAuthorTerms" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "splitVersion" INTEGER NOT NULL,
    "platformFeeBps" INTEGER NOT NULL,
    "organizerBps" INTEGER NOT NULL,
    "photographerBps" INTEGER NOT NULL,
    "textVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CulturalSaleAuthorTerms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalPayoutAccount" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "environment" TEXT NOT NULL,
    "mpEmail" TEXT NOT NULL,
    "receiverId" TEXT,
    "consentStatus" TEXT NOT NULL DEFAULT 'NONE',
    "inviteUrl" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalPayoutAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalSaleFile" (
    "id" TEXT NOT NULL,
    "activityWorkId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "authorUserId" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT,
    "bytes" INTEGER,
    "mime" TEXT,
    "widthPx" INTEGER,
    "heightPx" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING_UPLOAD',
    "problem" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalSaleFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalAuthorSignature" (
    "userId" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalAuthorSignature_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CulturalWorkOffer" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "activityWorkId" TEXT NOT NULL,
    "authorUserId" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "editionKind" TEXT NOT NULL,
    "editionSize" INTEGER NOT NULL,
    "proofCount" INTEGER NOT NULL DEFAULT 0,
    "priceArs" INTEGER NOT NULL,
    "approvedPriceArs" INTEGER,
    "paper" TEXT,
    "widthCm" DOUBLE PRECISION,
    "heightCm" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewNote" TEXT,
    "proposedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" INTEGER,
    "firstSoldAt" TIMESTAMP(3),
    "editionGroupId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalWorkOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalEditionCopy" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "kind" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "reservedUntil" TIMESTAMP(3),
    "orderId" TEXT,
    "certificateCode" TEXT,
    "certificateKid" TEXT,
    "certificatePayload" TEXT,
    "certificateSignature" TEXT,
    "issuedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalEditionCopy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalSaleOrder" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "copyId" TEXT,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "buyerName" TEXT NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "buyerPhone" TEXT,
    "buyerOnCertificate" BOOLEAN NOT NULL DEFAULT false,
    "delivery" TEXT NOT NULL,
    "shippingAddress" JSONB,
    "priceArs" INTEGER NOT NULL,
    "shippingArs" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "platformCents" INTEGER NOT NULL,
    "organizerCents" INTEGER NOT NULL,
    "photographerCents" INTEGER NOT NULL,
    "splitSnapshot" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    "fulfillment" TEXT NOT NULL DEFAULT 'NONE',
    "trackingText" TEXT,
    "externalReference" TEXT NOT NULL,
    "providerOrderId" TEXT,
    "providerStatus" TEXT,
    "providerStatusDetail" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "holdExpiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "refundRequestedAt" TIMESTAMP(3),
    "regretRequestedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalSaleOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalSaleEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "providerStatus" TEXT,
    "detail" TEXT,
    "actorUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CulturalSaleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CulturalSaleSetup_activityId_key" ON "CulturalSaleSetup"("activityId");
CREATE UNIQUE INDEX "CulturalSaleAuthorTerms_activityId_userId_key" ON "CulturalSaleAuthorTerms"("activityId", "userId");
CREATE INDEX "CulturalSaleAuthorTerms_userId_idx" ON "CulturalSaleAuthorTerms"("userId");
CREATE UNIQUE INDEX "CulturalPayoutAccount_userId_environment_key" ON "CulturalPayoutAccount"("userId", "environment");
CREATE INDEX "CulturalPayoutAccount_receiverId_idx" ON "CulturalPayoutAccount"("receiverId");
CREATE UNIQUE INDEX "CulturalSaleFile_activityWorkId_key" ON "CulturalSaleFile"("activityWorkId");
CREATE INDEX "CulturalSaleFile_activityId_idx" ON "CulturalSaleFile"("activityId");
CREATE INDEX "CulturalSaleFile_authorUserId_idx" ON "CulturalSaleFile"("authorUserId");
CREATE INDEX "CulturalWorkOffer_activityId_status_idx" ON "CulturalWorkOffer"("activityId", "status");
CREATE INDEX "CulturalWorkOffer_activityWorkId_idx" ON "CulturalWorkOffer"("activityWorkId");
CREATE INDEX "CulturalWorkOffer_authorUserId_idx" ON "CulturalWorkOffer"("authorUserId");
CREATE UNIQUE INDEX "CulturalEditionCopy_certificateCode_key" ON "CulturalEditionCopy"("certificateCode");
CREATE UNIQUE INDEX "CulturalEditionCopy_offerId_isTest_kind_number_key" ON "CulturalEditionCopy"("offerId", "isTest", "kind", "number");
CREATE INDEX "CulturalEditionCopy_activityId_idx" ON "CulturalEditionCopy"("activityId");
CREATE INDEX "CulturalEditionCopy_orderId_idx" ON "CulturalEditionCopy"("orderId");
CREATE UNIQUE INDEX "CulturalSaleOrder_publicId_key" ON "CulturalSaleOrder"("publicId");
CREATE UNIQUE INDEX "CulturalSaleOrder_copyId_key" ON "CulturalSaleOrder"("copyId");
CREATE UNIQUE INDEX "CulturalSaleOrder_externalReference_key" ON "CulturalSaleOrder"("externalReference");
CREATE UNIQUE INDEX "CulturalSaleOrder_providerOrderId_key" ON "CulturalSaleOrder"("providerOrderId");
CREATE UNIQUE INDEX "CulturalSaleOrder_idempotencyKey_key" ON "CulturalSaleOrder"("idempotencyKey");
CREATE INDEX "CulturalSaleOrder_activityId_status_idx" ON "CulturalSaleOrder"("activityId", "status");
CREATE INDEX "CulturalSaleOrder_offerId_idx" ON "CulturalSaleOrder"("offerId");
CREATE INDEX "CulturalSaleOrder_status_holdExpiresAt_idx" ON "CulturalSaleOrder"("status", "holdExpiresAt");
CREATE INDEX "CulturalSaleEvent_orderId_createdAt_idx" ON "CulturalSaleEvent"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "CulturalSaleSetup" ADD CONSTRAINT "CulturalSaleSetup_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CulturalSaleAuthorTerms" ADD CONSTRAINT "CulturalSaleAuthorTerms_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CulturalSaleFile" ADD CONSTRAINT "CulturalSaleFile_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CulturalWorkOffer" ADD CONSTRAINT "CulturalWorkOffer_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CulturalEditionCopy" ADD CONSTRAINT "CulturalEditionCopy_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "CulturalWorkOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CulturalEditionCopy" ADD CONSTRAINT "CulturalEditionCopy_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CulturalSaleOrder" ADD CONSTRAINT "CulturalSaleOrder_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CulturalSaleOrder" ADD CONSTRAINT "CulturalSaleOrder_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "CulturalWorkOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CulturalSaleEvent" ADD CONSTRAINT "CulturalSaleEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CulturalSaleOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Nota: con `RESTRICT`, una muestra con copias o pedidos **no se puede borrar** (y una oferta con copias tampoco). Es a propósito: un certificado emitido no puede desaparecer. Revisar si hay algún borrado de muestras en la app (`grep -rn "culturalActivity.delete" apps/muestras/lib`) y, si existe, que frene con "Esta muestra tiene ventas: no se puede borrar." (test).

- [ ] **Step 4: Generar el cliente y verificar**

Run: `pnpm --filter @repo/db exec prisma validate && pnpm --filter @repo/db exec prisma generate && pnpm --filter @repo/db exec prisma migrate diff --from-migrations packages/db/prisma/migrations --to-schema-datamodel packages/db/prisma/schema.prisma --shadow-database-url "$SHADOW_URL" --script` (si hay base sombra; si no, revisar a mano que cada tabla, índice y FK de la SQL esté en el schema y viceversa).
Expected: `prisma validate` OK; el diff no propone nada para las tablas `Cultural*` nuevas.

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20261102120000_muestras_etapa_8_venta
git commit -m "Muestras: tablas de la venta, ediciones y certificados (migración a mano, sin aplicar)"
```

**Acceptance:** `grep -c "ALTER TABLE \"Cultural\(Activity\|ActivityWork\|ExhibitorWork\|ContestWork\)\" ADD COLUMN" migration.sql` = 0.

---

### Task 5: Infraestructura de pagos en Muestras — entorno, Mercado Pago, bucket privado y firma del aviso

**Files:**
- Modify: `apps/muestras/package.json`, `apps/muestras/.env.example`, `apps/muestras/lib/limite.ts` (+ test)
- Create: `apps/muestras/lib/ventas/config.ts` (+ test), `apps/muestras/lib/ventas/mp.ts` (+ test), `apps/muestras/lib/ventas/r2-privado.ts` (+ test), `apps/muestras/lib/ventas/aviso-firma.ts` (+ test)

**Interfaces:**
- Consumes: `salesMode`, `canBuy` (Task 1); de `@repo/payments/next` y `@repo/payments/mercado-pago`: `createMercadoPagoProviderConfig`, `MercadoPagoHttpClient`, `MercadoPagoOrdersAdapter`, `MercadoPagoSplitConsentAdapter`, `isSandboxAccessToken`, `mapMercadoPagoOrderResponse`, `buildOpaqueExternalReference`, `calculateDistribution`, `money`, `singleIntangibleItem` (verificar cada nombre en `packages/payments/src/next-entry.ts` y `src/providers/mercado-pago/index.ts` antes de importar; si alguno no se exporta por esas entradas, importar por la que sí lo hace, nunca por ruta interna).
- Produces:
  - `config.ts` (`server-only`): `leerConfigDeVentas(env = process.env)` → `{ modo: SalesMode; motivo; faltan: string[]; mpEnv; ambienteCuenta: "SANDBOX" | "PRODUCTION"; probadores: Set<number>; avisoConfigurado: boolean; cronConfigurado: boolean }`; `puedeComprar(usuario | null)`; variables: `MUESTRAS_VENTAS_EN_VIVO`, `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED`, `DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED`, `MUESTRAS_MP_ENV`, `MUESTRAS_MP_ACCESS_TOKEN`, `MUESTRAS_MP_PUBLIC_KEY`, `MUESTRAS_MP_OWNER_USER_ID`, `MUESTRAS_VENTAS_PROBADORES` (ids separados por coma), `MUESTRAS_PEDIDOS_SECRET`, `MUESTRAS_CERT_PRIVATE_KEY`, `MUESTRAS_CERT_KEY_ID`, `MUESTRAS_CERT_OLD_PUBLIC_KEYS` (JSON optativo `{kid: pem}`), `MUESTRAS_R2_PRIVATE_BUCKET`, `MUESTRAS_AVISO_PAGOS_SECRET`, `CRON_SECRET`. **Nunca** devuelve valores secretos, sólo nombres.
  - `mp.ts` (`server-only`): `adaptadorDeOrdenes()` (con `allowProductionWrites` sólo en `LIVE`, `defaultStatementDescriptor: "MUESTRAS FOTO"`, `enforceOrders1nStagingGate: false`); `leerOrden(providerOrderId)` → `{ providerOrderId, status, statusDetail, externalReference, totalCents, splits: { receiverId; type; cents }[], paymentStatus, liveMode } | null`; `invitarAReparto(email)` → `{ receiverId, status, inviteUrl } | { error }` (con `assertSplitConsentWriteAllowed`); `leerConsentimiento(receiverId)`; `devolverTotal(providerOrderId, idempotencyKey)`. Todas con `sanitizeError` en los `catch`.
  - `r2-privado.ts` (`server-only`): `urlDeSubida(clave, contentType, maxBytes)` (PUT firmado 10 min con `@aws-sdk/s3-request-presigner`), `leerPrivado(clave)` → `Buffer | null`, `subirPrivado(clave, bytes, contentType)`, `existePrivado(clave)`, `borrarPrivado(clave)`; claves sólo bajo `originales/`, `firmas/`, `ventas/` (otra → error).
  - `aviso-firma.ts`: `firmarAviso(secreto, t, cuerpo)` → `"t=<t>,v1=<hex>"`; `verificarAviso(secreto, encabezado, cuerpo, ahoraSeg, toleranciaSeg = 300)` → `"ok" | "vencido" | "invalido" | "sin-configurar"`. **Vector fijo de test** (secreto `"muestras-aviso-test"`, `t = 1760000000`, cuerpo `{"providerOrderId":"ORDTST01ABC"}` → firma hex exacta calculada una vez y escrita en el test de las dos copias).
  - `lib/limite.ts`: `invitarCobro` 10/h, `verificarCobro` 60/h, `ventaConfig` 60/h, `ofertaAutor` 300/h, `subirOriginal` 30/h, `revisarOfertas` 600/10 min, `reservarCopia` 20/10 min por IP y 10/10 min por email, `pagarPedido` 10/10 min por pedido, `verPedido` 120/10 min por pedido, `descargaVenta` 30/h por pedido, `verificar` 60/10 min por IP, `avisoPagos` 600/10 min por IP, `pedidosPanel` 600/10 min.
  - `package.json`: `"@repo/payments": "workspace:*"`, `"@aws-sdk/s3-request-presigner": "^3.972.0"`. `.env.example` con todas las variables y un comentario por cada una (para qué, quién la carga, valor de ejemplo vacío).

- [ ] **Step 1: Tests que fallan** — `config.test.ts`: sin variables → `OFF` con la lista de faltas; sandbox completo → `TEST`; producción completo con las dos llaves → `LIVE`; nunca aparece un valor secreto en el resultado (`JSON.stringify` no contiene el token de ejemplo); probadores parseados. `mp.test.ts` (con `FakeMercadoPagoHttpClient` o un `fetch` falso): `leerOrden` mapea el GET; un error de red devuelve `null` sin loguear el token; `invitarAReparto` en producción sin `DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED` → error "Mercado Pago todavía no habilitó esta función". `r2-privado.test.ts`: clave fuera de los prefijos → error; `aviso-firma.test.ts`: vector fijo, vencido, alterado, sin secreto.
- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter muestras test -- ventas/config ventas/mp ventas/r2-privado ventas/aviso-firma limite` — Expected: FAIL.
- [ ] **Step 3: Instalar y verificar el lockfile** — Run: `pnpm install && git diff --stat pnpm-lock.yaml && git diff pnpm-lock.yaml | grep '^[+-]' | grep -v '^+++\|^---'` — Expected: sólo las líneas de `@repo/payments` (link) y `@aws-sdk/s3-request-presigner` bajo `apps/muestras`. Si aparece cualquier otra, **frenar y avisar**.
- [ ] **Step 4: Implementar.**
- [ ] **Step 5: Correr** — Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint` — Expected: en verde.
- [ ] **Step 6: Commit**

```bash
git add apps/muestras/package.json apps/muestras/.env.example apps/muestras/lib pnpm-lock.yaml
git commit -m "Muestras: configuración de la venta, cliente de Mercado Pago, bucket privado y firma del aviso de pagos"
```

**Acceptance:** `grep -rn "MUESTRAS_MP_ACCESS_TOKEN" apps/muestras/lib | grep -v "config.ts\|\.test\."` vacío (el token se lee en un solo lugar).

---

### Task 6: Cuentas de cobro — "Cobros" con el consentimiento de reparto

**Files:**
- Create: `apps/muestras/lib/ventas/cobros.ts` (+ test), `apps/muestras/app/panel/cobros/page.tsx`, `apps/muestras/components/ventas/{cobros.tsx, estilos.ts}`

**Interfaces:**
- Consumes: `invitarAReparto`, `leerConsentimiento` (Task 5), `leerConfigDeVentas`.
- Produces:
  - `cuentaDeCobro(userId, ambiente)` → fila o `null`; `consentimientoVigente(userId, ambiente, { maxEdadMs = 10 * 60_000 })` → estado, re-verificando contra Mercado Pago si la lectura es vieja (lo usa la Task 11 al pagar).
  - Acciones (`"use server"`): `guardarCuentaDeCobro(fd)` (email válido, minúsculas; freno `invitarCobro`; llama a `invitarAReparto`; upsert por `(userId, ambiente)` con `receiverId`, `consentStatus`, `inviteUrl`, `lastCheckedAt`; si cambia el email con pedidos pendientes de pago donde es receptor → "Tenés ventas esperando el pago: probá en unos minutos."); `verificarCuentaDeCobro()` (freno `verificarCobro`; `leerConsentimiento`; actualiza).
  - Página `/panel/cobros` (`requireUsuario("/panel/cobros")`): explica en dos líneas para qué sirve ("Para recibir tu parte de cada venta directo en tu Mercado Pago."); formulario de email; estado con su texto (`NONE` "Todavía no conectaste tu Mercado Pago", `PENDING` "Falta que aceptes en Mercado Pago" + botón "Aceptar en Mercado Pago" (`inviteUrl`, `target=_blank`, `rel=noopener`) + "Ya lo acepté, verificar", `ACTIVE` "Listo: vas a recibir tu parte en <email>", `REJECTED`/`CANCELED`/`EXPIRED` "Mercado Pago dice que no está aceptado: volvé a pedirlo"); en `TEST`, la marca "Modo prueba: usá una cuenta de prueba de Mercado Pago"; en `OFF`, "La venta todavía no está habilitada, pero podés dejar esto listo." (y el formulario anda igual en sandbox).

- [ ] **Step 1: Tests que fallan** — sin sesión → "Tenés que ingresar."; email inválido; invita y guarda; segundo pedido con el mismo email no duplica (upsert); `verificar` pasa de `PENDING` a `ACTIVE`; ambientes separados (una cuenta `SANDBOX` no sirve en `PRODUCTION`); `consentimientoVigente` re-lee si pasaron más de 10 minutos y no si no.
- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter muestras test -- ventas/cobros` — Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr** — Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint` — Expected: en verde.
- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: Cobros — conectar Mercado Pago para recibir reparto"
```

---

### Task 7: La organización enciende la venta — reparto, entrega y condiciones

**Files:**
- Create: `apps/muestras/lib/ventas/configurar.ts` (+ test), `apps/muestras/lib/ventas/consultas.ts`, `apps/muestras/app/panel/muestras/[id]/ventas/page.tsx`, `apps/muestras/components/ventas/configurar-venta.tsx`
- Modify: `apps/muestras/app/panel/muestras/[id]/page.tsx` (enlace "Ventas")

**Interfaces:**
- Consumes: `splitProblems`, `splitExample`, `PLATFORM_FEE_BPS`, `rolEnMuestra`, `puede`, `leerConfigDeVentas`, `cuentaDeCobro`.
- Produces:
  - `guardarVenta(activityId, fd)` (`sales`; freno `ventaConfig`): porcentajes (enteros 0..85 en el formulario → bps), `pickupText` (≤ 500, obligatorio si hay obras impresas aprobadas), `shippingEnabled`, `shippingCostArs` (0..`SHIPPING_MAX_ARS`, obligatorio con envío), `shippingText` (≤ 300), `extraTerms` (≤ 1500). Crea la fila si no existe (`organizerUserId` = dueño, `platformFeeBps` = `PLATFORM_FEE_BPS`, `status = DRAFT`). Si cambian los porcentajes: `splitVersion + 1` (con pedidos `PENDING_PAYMENT` de la muestra → "Hay ventas esperando el pago: probá en unos minutos.").
  - `cambiarEstadoDeVenta(activityId, "OPEN" | "PAUSED")` (`sales`): abrir exige reparto válido, la muestra no cancelada y la cuenta de cobro de la organización `ACTIVE` en el ambiente del modo (en `OFF` se puede abrir igual: se vende cuando el modo lo permita; el panel lo dice).
  - `cambiarQuienCobra(activityId, userId)` (dueño o super admin; sin pedidos pendientes).
  - `panelDeVentas(activityId, usuario)` en `consultas.ts`: setup, modo y motivo, cuenta de cobro de la organización, por autor (nombre, aceptó el reparto vigente, cuenta de cobro, firma) y por obra (ofertas con estado, faltas de `offerPurchasable`, vendidas/quedan), totales vendidos por estado.
  - Página `/panel/muestras/[id]/ventas` (`requireUsuario`; `notFound()` sin `sales` ni `salesFulfill`): arriba el **modo** ("Venta en prueba (sandbox): sólo vos y los probadores pueden comprar", "Venta todavía no habilitada en la plataforma: <motivo>", "Venta en vivo"); el bloque **"Reparto"** con dos campos, la plataforma fija en 15 % y el ejemplo con $100.000; **"Entrega de las impresas"** (retiro en la sede con texto; envío optativo con costo y texto); **"Condiciones de la organización"**; botón **"Abrir la venta"** / **"Pausar la venta"**; la lista de autores y obras con sus faltas; enlace a **"Pedidos"**. La coorganización lo ve en lectura. Aviso fijo: "Los autores tienen que aceptar este reparto antes de que se venda una obra suya. Si lo cambiás, lo tienen que aceptar de nuevo."

- [ ] **Step 1: Tests que fallan** — coorganización no puede guardar ("La muestra no existe."); porcentajes que no suman 85 → mensaje; primera vez crea la fila con el dueño y 1500; cambiar porcentajes sube `splitVersion`; con pedidos pendientes no cambia; abrir sin cuenta de cobro `ACTIVE` en `TEST`/`LIVE` → "Primero conectá tu Mercado Pago en Cobros."; muestra cancelada → no abre.
- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter muestras test -- ventas/configurar` — Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr** — Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint` — Expected: en verde.
- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: la organización enciende la venta — reparto, retiro en sede, envío y condiciones"
```

---

### Task 8: El autor — original, firma, formatos con precio y aceptación del reparto

**Files:**
- Create: `apps/muestras/lib/ventas/autor.ts` (+ test), `apps/muestras/app/api/ventas/subida/route.ts`, `apps/muestras/app/panel/expositor/ventas/[activityId]/page.tsx`, `apps/muestras/components/ventas/{ofertas-autor.tsx, subir-original.tsx, firma-autor.tsx}`
- Modify: `apps/muestras/app/panel/expositor/page.tsx` (bloque "Vender tus obras"), `apps/muestras/lib/ventas/consultas.ts`

**Interfaces:**
- Consumes: `offerProblems`, `offerTransition`, `MAX_OFFERS_PER_WORK`, `SALE_SPLIT_TEXT(_VERSION)`, `SALE_EDITION_DECLARATION`, `urlDeSubida`, `leerPrivado`, `subirPrivado`, `procesarImagen` (sólo para medir; el original **no** se transforma).
- Produces:
  - `obrasVendiblesDelAutor(activityId, userId)`: obras de la muestra con `authorUserId = userId` que se pueden vender (D8): de expositor `APPROVED` con `forSale`, de concurso con `forSale` y `saleConsent = ACCEPTED`, o cargadas por la organización con `authorUserId` (en ese caso la organización debe haberlas marcado: **fuera de alcance**, sólo expositores y concurso). Con el `priceArs` de la etapa 6 como sugerencia.
  - Acciones (`"use server"`, siempre con la fila propia): `aceptarReparto(activityId)` (guarda `CulturalSaleAuthorTerms` con la versión vigente y los porcentajes; exige que el formulario mande `splitVersion` = la vigente); `guardarOferta(fd)` (crea o edita `DRAFT`/`CHANGES_REQUESTED`; hasta 6 por obra; `offerProblems`; la casilla de `SALE_EDITION_DECLARATION` obligatoria para `LIMITED`); `proponerOferta(id)`; `cambiarPrecio(id, precio)`; `retirarOferta(id)`; `pedirPruebaDeAutor(offerId)` (registra un pedido de P/A como evento visible a la organización: se guarda en `reviewNote` de la oferta con prefijo "Pedido de P/A:" — sin tabla nueva); `pedirSubidaDeOriginal(activityWorkId, { mime, bytes })` → `{ url, clave }` (JPEG/PNG/TIFF, ≤ 80 MB; si ya hay una venta de esa obra → "Esta obra ya vendió copias: el original no se puede cambiar."); `confirmarOriginal(activityWorkId)` (lee el objeto, SHA-256, mide con sharp `metadata()`, `READY` o `REJECTED` con el motivo); `guardarFirma(fd)` (PNG/JPEG ≤ 5 MB → sharp: recorte de bordes blancos (`trim`), PNG, máximo 1200 px de ancho → `firmas/<userId>.png`).
  - `app/api/ventas/subida/route.ts`: sólo `POST` con sesión que devuelve la URL firmada (la acción la arma; la ruta existe para el `fetch` del componente cliente con `x-www-form` simple). El componente sube con `PUT` directo a R2 con barra de avance y después llama a `confirmarOriginal`.
  - Página `/panel/expositor/ventas/[activityId]` (`requireUsuario`; sin obras vendibles → `notFound()`): (1) **Reparto**: "De cada venta de tus obras en <muestra>: plataforma 15 %, organización X %, vos Y %" + ejemplo + **"Acepto este reparto"** (o "Aceptado el …"; si cambió: "La organización cambió el reparto: revisalo y aceptalo de nuevo"); (2) **Tu firma** (una vez para todas tus muestras) con vista previa; (3) **Cobros**: estado de tu cuenta y enlace a `/panel/cobros`; (4) por obra: **archivo original** (estado, tamaño en píxeles, "Reemplazar" mientras no vendió) y **formatos** (tabla con formato, edición, papel y medida, precio, estado, nota de la organización, vendidas/quedan) con "Agregar formato"; (5) **Tus ventas** (Task 16). Texto de ayuda: "Copia única: se vende una sola. Edición limitada: elegís cuántas (N) y cada una lleva su número y su certificado. Impresa: Fine Art / premium; poné el papel y la medida."
  - "Dónde expongo" suma, por muestra con venta abierta y obras vendibles, "Vender tus obras" con cuántas cosas faltan.
  - `app/api/ventas` rutas: `export const maxDuration = 60` en `confirmarOriginal` (se llama desde una acción: la acción vive en la página, que declara `maxDuration = 60`).

- [ ] **Step 1: Tests que fallan** — otra cuenta → "La muestra no existe."; obra de concurso sin `saleConsent` → no aparece; aceptar con `splitVersion` viejo → "El reparto cambió: recargá la página."; oferta inválida → mensaje; séptima oferta → mensaje; `LIMITED` sin la declaración → mensaje; subida de 90 MB → mensaje; reemplazar original con una copia `ISSUED` → mensaje; `confirmarOriginal` calcula el SHA-256 de un buffer conocido; archivo que no es imagen → `REJECTED`; firma se guarda en `firmas/<userId>.png`; cambiar el precio de una aprobada → `PROPOSED` con `approvedPriceArs` intacto.
- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter muestras test -- ventas/autor` — Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr** — Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint` — Expected: en verde.
- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: el autor propone formatos y precios, sube el original y su firma, y acepta el reparto"
```

**Acceptance:** el original nunca tiene una URL pública: `grep -rn "R2_PUBLIC" apps/muestras/lib/ventas` vacío.

---

### Task 9: La organización aprueba los formatos

**Files:**
- Create: `apps/muestras/lib/ventas/revision.ts` (+ test), `apps/muestras/components/ventas/revision-ofertas.tsx`
- Modify: `apps/muestras/app/panel/muestras/[id]/ventas/page.tsx`

**Interfaces:**
- Consumes: `offerTransition`, `offerPurchasable` (para mostrar faltas).
- Produces: acciones `aprobarOferta(id)` (`approvedPriceArs = priceArs`, `approvedAt`, `approvedByUserId`; dentro de una transacción con `FOR UPDATE` sobre la oferta), `pedirCambiosOferta(id, nota ≤ 500)`, `pausarOferta(id)`, `reanudarOferta(id)`, `emitirPruebaDeAutor(offerId)` (Task 16 la completa con el certificado). Todas `sales`, freno `revisarOfertas`. En el panel: "N formatos para revisar" arriba; por formato la imagen de la obra (la del editor), autor, formato, edición, papel y medida, precio propuesto (y el aprobado si es un cambio: "Antes $X, ahora $Y"), botones; contador también en "Mis muestras".

- [ ] **Step 1: Tests que fallan** — coorganización → no; aprobar un `PROPOSED` → `APPROVED` con precio aprobado; aprobar un cambio de precio de una oferta con ventas → precio nuevo, número de copias intacto; pedir cambios sin nota → mensaje; pausar y reanudar.
- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter muestras test -- ventas/revision` — Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr** — Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types` — Expected: en verde.
- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: la organización aprueba, pide cambios o pausa los formatos a la venta"
```

---

### Task 10: Reservar el número — pedido en espera de pago sin pasarse nunca de N

**Files:**
- Create: `apps/muestras/lib/ventas/comprable.ts` (+ test), `apps/muestras/lib/ventas/reservar.ts` (+ test), `apps/muestras/lib/ventas/reservar.db.test.ts`, `apps/muestras/lib/ventas/pedido.ts` (+ test)

**Interfaces:**
- Consumes: `offerPurchasable`, `nextEditionNumber`, `copyCounts`, `saleAmounts`, `receiverPlan`, `saleExternalReference`, `RESERVATION_MINUTES`, `SALE_TERMS_TEXT_VERSION`, `consentimientoVigente` (Task 6), `leerConfigDeVentas`, `puedeComprar`.
- Produces:
  - `comprable.ts`: `ofertasDeLaObra(activityId, activityWorkId, { modo, ambienteCuenta, ahora })` → por oferta `{ id, format, editionKind, editionSize, proofCount, paper, widthCm, heightCm, priceArs (el aprobado), quedan, comprable: { ok } | { ok: false; reasons } }` (una sola consulta por tabla; la cuenta de cobro desde `CulturalPayoutAccount` sin llamar a Mercado Pago).
  - `pedido.ts`: `nuevoPublicId()` (16 caracteres `[a-z0-9]` con `randomInt`), `tokenDePedido(publicId)` = HMAC-SHA256(`MUESTRAS_PEDIDOS_SECRET`, publicId) en base64url; `hashDeToken`; `pedidoConAcceso(publicId, { token?, cookie? })` (tiempo constante); `cookieDePedido(publicId, token)` (`mf_pedido_<publicId>`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/compras/<publicId>`, 30 días).
  - `reservar.ts` (`"use server"` en `reservarCopia`; la lógica en `reservarEnTransaccion(tx, entrada, ahora)` exportada para el test de base):
    - Entrada validada: `offerId`, `delivery`, comprador (nombre 2..120, email válido —en `TEST`, terminado en `@testuser.com`—, teléfono optativo), dirección (sólo `SHIPPING`: calle, número, piso/depto, ciudad, provincia, código postal; ≤ 120 cada uno), `buyerOnCertificate`, aceptación de términos con `termsVersion` = vigente.
    - Freno `reservarCopia` por IP y por email. `puedeComprar(usuario)` según el modo (si no → "La venta de esta obra todavía no está disponible.").
    - Transacción (`{ timeout: 20_000, maxWait: 5_000 }`): `SELECT id FROM "CulturalWorkOffer" WHERE id = $1 FOR UPDATE`; vuelve a leer setup, oferta, términos del autor y cuentas; `offerPurchasable`; filas de copias de `(offerId, isTest, COPY)`; `nextEditionNumber` → si `null`: "Se vendieron todas las copias de este formato."; reutiliza la fila (`RESERVED`, `reservedUntil = ahora + 20 min`) o crea una nueva; libera (`RELEASED`) las reservas vencidas de esa oferta cuyo pedido sigue `PENDING_PAYMENT` sin `providerOrderId` y los marca `EXPIRED` con evento `SWEEP`; crea `CulturalSaleOrder` con montos congelados (`saleAmounts`, `receiverPlan` con los `receiverId` de las cuentas) y `splitSnapshot` (`{ v: 1, platformFeeBps, organizerBps, photographerBps, splitVersion, environment, organizer: { userId, receiverId }, photographer: { userId, receiverId }, ownerUserId }`), `idempotencyKey = randomUUID()`, `holdExpiresAt`; evento `CREATE`.
    - Devuelve `{ ok: true, publicId, token, totalArs, holdExpiresAt }`; la página pone la cookie y muestra el Brick (Task 11).
  - `reservar.db.test.ts`: corre sólo con `MUESTRAS_DB_TEST_URL` (si no está, `describe.skip` con un mensaje). Crea en esa base una muestra, una oferta `LIMITED` N = 10 y lo necesario, y lanza **25 `reservarEnTransaccion` en paralelo** (`Promise.allSettled`, cada una con su cliente Prisma del pool): exactamente **10** pedidos creados, números **1..10 sin repetir**, 15 con "Se vendieron todas…". Segunda prueba: 3 reservas vencidas → 3 nuevas reservas reutilizan **esos** números; una copia `VOIDED` nunca se toma. Al final borra lo creado.

- [ ] **Step 1: Tests que fallan** — `reservar.test.ts` (mocks): modo `OFF` → mensaje; `TEST` con email que no es `@testuser.com` → "En modo prueba usá un email de comprador de prueba (termina en @testuser.com)."; términos viejos → mensaje; envío no habilitado → mensaje; sin copias → mensaje; crea pedido con montos y foto del reparto correctos (envío a la organización); `pedido.test.ts`: token válido / alterado / de otro pedido; `comprable.test.ts`: faltas por oferta.
- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter muestras test -- ventas/reservar ventas/pedido ventas/comprable` — Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr con base de prueba** — crear una rama Neon descartable de `development` (con permiso del controlador) con la migración aplicada, exportar `MUESTRAS_DB_TEST_URL` y correr `pnpm --filter muestras exec vitest run lib/ventas/reservar.db.test.ts` — Expected: PASS (10 de 25). Borrar la rama después. Sin base de prueba, dejarlo anotado en el PR como pendiente **antes de `LIVE`**.
- [ ] **Step 5: Correr todo** — Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint` — Expected: en verde.
- [ ] **Step 6: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: reservar el número de copia por 20 minutos sin pasarse nunca del total"
```

**Acceptance:** el test de concurrencia contra base real da exactamente N reservas con N números distintos.

---

### Task 11: Pagar — Card Payment Brick y Order 1:N con reparto

**Files:**
- Create: `apps/muestras/lib/ventas/pagar.ts` (+ test), `apps/muestras/components/ventas/brick-tarjeta.tsx`
- Modify: `apps/muestras/lib/ventas/mp.ts`

**Interfaces:**
- Consumes: `adaptadorDeOrdenes`, `consentimientoVigente`, `receiverPlan`, `calculateDistribution`/`money` del paquete, `buildOpaqueExternalReference`, `conciliarDesdeOrden` (Task 12; en esta task se llama con la respuesta de la creación).
- Produces:
  - `pagarPedido({ publicId, token, cardToken, paymentMethodId, installments, identification: { type, number }, deviceSessionId, payerFirstName, payerLastName })` (`"use server"`; freno `pagarPedido`): valida acceso al pedido; estado `PENDING_PAYMENT` y `holdExpiresAt` futuro (si no: "La reserva venció. Volvé a la obra para empezar de nuevo."); `installments = 1` (sin cuotas en esta etapa); si ya tiene `providerOrderId` → no crea otra: concilia y devuelve el estado (doble clic). Re-verifica el consentimiento de los dos receptores (`consentimientoVigente`; si alguno no está `ACTIVE`: libera la copia, pedido `REJECTED` con detalle, "Esta obra no se puede comprar ahora."). Arma la distribución: `rules` con `owner` (fee), `organizer`/`photographer`/`both` en `FIXED` según `splitSnapshot` (o porcentajes que den exactamente los centavos congelados: usar el tipo que acepte `calculateDistribution` para montos fijos; si sólo acepta porcentajes, construir el `CalculatedDistribution` directamente con los montos congelados y validarlo con `validateMercadoPagoSplitOrder` del paquete), `partnerReceiverIds` y `partnerConsentsByRecipientId` (`{ receiverId, status: "ACTIVE", provider: "mercadopago" }`). `createSplitOrder({ environment, externalReference, total, distribution, idempotencyKey: order.idempotencyKey, deviceSessionId, paymentToken: cardToken, paymentMethodId, installments: 1, payerEmail: buyerEmail, payerProfile: { firstName, lastName, identification, phone? }, statementDescriptor: "MUESTRAS FOTO", items: [{ title: "<obra> — <formato> <edición>", categoryId, quantity: 1, unitPrice: total }], metadata: { source: "muestras", orderPublicId } })`. Guarda `providerOrderId` **en una escritura inmediata** y llama a `conciliarDesdeOrden(..., "CREATE")` con la Order devuelta (sin GET extra si la respuesta ya trae estado y pagos; si no, `leerOrden`). Devuelve `{ estado: "PAID" | "PENDING" | "REJECTED", mensaje }` con el texto de `status-detail-messages.ts` del paquete para rechazos.
  - Errores de Mercado Pago al crear: si la respuesta es un error 4xx de validación → pedido `REJECTED`, copia `RELEASED`, mensaje genérico "Mercado Pago no aceptó el pago. Revisá los datos de la tarjeta o probá con otra."; si es un error de red/5xx (no sabemos si se creó) → el pedido queda `PENDING_PAYMENT` con `providerStatus = "UNKNOWN_CREATE"`, y el barrido busca la Order por `external_reference` (`GET /v1/orders?external_reference=…` si el paquete lo ofrece; si no, se libera al vencer la reserva y se deja una alerta). **Nunca** se reintenta crear con otra `idempotencyKey`.
  - `brick-tarjeta.tsx` (cliente): carga `https://sdk.mercadopago.com/js/v2` con `next/script` (`strategy="afterInteractive"`), `new MercadoPago(publicKey, { locale: "es-AR" })`, `bricks().create("cardPayment", "brick-tarjeta", { initialization: { amount: totalArs }, customization: { paymentMethods: { maxInstallments: 1 } }, callbacks: { onSubmit } })`; toma el device id como hace `MpSplit1nHomologationBrick` de CLF (`window.MP_DEVICE_SESSION_ID`, ver `packages/payments/src/frontend/device-session.ts`) y mapea `formData` con la misma lógica que `map-brick-form-data.ts` del paquete (importar la función pura si se exporta por `@repo/payments/frontend`; si arrastra React u otra dependencia, copiarla en el componente). Muestra la cuenta regresiva de la reserva ("Tenés 18 minutos para pagar"), el total y "Modo prueba: usá una tarjeta de prueba de Mercado Pago" en `TEST`. Al terminar navega a `/compras/<publicId>?t=<token>`.
  - Tipos mínimos de `window.MercadoPago` declarados en el componente (sin `@types` nuevos).

- [ ] **Step 1: Tests que fallan** (con `mp.ts` mockeado): reserva vencida → mensaje y no llama a Mercado Pago; doble llamada → una sola creación; consentimiento caído → `REJECTED` y copia `RELEASED`; la distribución mandada suma exactamente `totalCents` con owner = fee y partners congelados; misma persona → un partner; respuesta `processed/accredited` → `PAID` + copia `ISSUED` (vía Task 12); rechazo → `REJECTED` + `RELEASED`; error de red → queda pendiente con `UNKNOWN_CREATE`; nunca se loguea `cardToken` ni el documento (espía sobre `console.*`).
- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter muestras test -- ventas/pagar` — Expected: FAIL.
- [ ] **Step 3: Implementar** (la Task 12 aporta `conciliarDesdeOrden`; si se ejecuta antes, usar un stub y completar en la 12).
- [ ] **Step 4: Correr** — Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint` — Expected: en verde.
- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: pagar con tarjeta — Order de Mercado Pago con reparto en tres"
```

---

### Task 12: Conciliación — pagado, rechazado, devuelto, aviso de CLF y barrido

**Files:**
- Create: `apps/muestras/lib/ventas/conciliar.ts` (+ test), `apps/muestras/app/api/pagos/aviso/route.ts`, `apps/muestras/app/api/cron/ventas/route.ts`
- Modify: `apps/muestras/vercel.json`

**Interfaces:**
- Consumes: `saleOrderTransition`, `parseSaleExternalReference`, `leerOrden`, `verificarAviso`, `revisarLlave`, `newCertificateCode`, `certificatePayload` + `firmarCertificado` (Task 13; aquí se llama a `emitirCopia`, que la 13 completa con la firma), `nextEditionNumber`.
- Produces:
  - `conciliarDesdeOrden(orden: OrdenLeida, origen)` y `conciliarPedido({ publicId } | { providerOrderId }, origen)` (lee con `leerOrden`). Pasos: encontrar el pedido (por `providerOrderId`, o por `external_reference` → `publicId`); **comparar** `externalReference`, `totalCents` y reparto (receptores y montos) con lo congelado y que `liveMode` coincida con `isTest` (prueba ↔ sandbox): si algo no coincide → evento con detalle `MISMATCH:<campo>` y **nada más**; `saleOrderTransition`; si hay `next`: transacción con `UPDATE "CulturalSaleOrder" SET status = $next … WHERE id = $id AND status = $actual` (0 filas → otro camino ganó, salir); según `next`:
    - `PAID`: si la copia sigue `RESERVED` y es de este pedido → `emitirCopia` (`ISSUED`, código, `issuedAt`, payload y firma); si no (venció y otro la tomó) → bloquear la oferta (`FOR UPDATE`) y pedir otro número (`nextEditionNumber`); sin lugar → `PAID_NO_COPY`. `fulfillment = PENDING` si es impresa. `firstSoldAt` de la oferta si es nulo. `paidAt`.
    - `REJECTED`: copia `RELEASED`.
    - `REFUNDED` / `CHARGED_BACK`: copia `VOIDED` (`voidedAt`, `voidReason` "Devolución" / "Contracargo"), `refundedAt`.
    - Siempre: `providerStatus`, `providerStatusDetail`, `lastSyncedAt`, evento con origen.
    - Pendiente en Mercado Pago (`next = null` y estado `OPEN`/`in_process`): extender `reservedUntil` y `holdExpiresAt` hasta `createdAt + 72 h`.
  - `POST /api/pagos/aviso`: lee el cuerpo crudo (≤ 2 KB), `verificarAviso(MUESTRAS_AVISO_PAGOS_SECRET, header "x-dnx-aviso", cuerpo)`; `sin-configurar` → 503; `invalido`/`vencido` → 401; freno `avisoPagos`; `providerOrderId` con forma de id de Mercado Pago (`^[A-Z0-9]{8,64}$`) o 400; responde **202** `{ ok: true }` y concilia en `after()`. Nunca dice si el pedido existe.
  - `GET /api/cron/ventas` (`revisarLlave(authorization, CRON_SECRET)`; `maxDuration = 60`): (1) pedidos `PENDING_PAYMENT` sin `providerOrderId` con `holdExpiresAt` pasado → `EXPIRED` + copia `RELEASED` (en lotes de 200); (2) pedidos `PENDING_PAYMENT` con `providerOrderId` (hasta 50 por corrida, los más viejos primero) → `conciliarPedido(..., "SWEEP")`; los de más de 72 h siguen pendientes → evento `ALERT_STALE_PENDING` (visible en `/panel/ventas`); (3) entre las 4:00 y 4:10 hora argentina, pedidos `PAID` de los últimos 60 días (hasta 100, por `lastSyncedAt` más viejo) → `conciliarPedido` (devoluciones y contracargos hechos fuera); (4) `UNKNOWN_CREATE` → buscar por referencia si se puede. Devuelve un resumen sin datos personales.
  - `vercel.json`: `{ "path": "/api/cron/ventas", "schedule": "*/10 * * * *" }` (verificar que el plan de Vercel del proyecto de Muestras permita crons cada 10 minutos; si no, cada hora y anotarlo).

- [ ] **Step 1: Tests que fallan** — el mismo `processed/accredited` conciliado dos veces → una sola emisión y un solo evento de cambio; por cuatro orígenes en paralelo (simulado con el `updateMany` condicional) → una emisión; total distinto → `MISMATCH` y nada cambia; Order de sandbox en un pedido real → `MISMATCH:liveMode`; pagado con la reserva vencida y el número tomado → otro número; sin números → `PAID_NO_COPY`; `REFUNDED` → copia `VOIDED`, número no reutilizable (`nextEditionNumber` después no lo devuelve); `in_process` → reserva extendida; aviso con firma válida → 202 y concilia; inválida → 401 sin tocar nada; cron sin llave → 401; cron expira reservas viejas.
- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter muestras test -- ventas/conciliar api` — Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr** — Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint` — Expected: en verde.
- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: conciliar pagos con Mercado Pago — al crear, al volver, por aviso de CLF y por barrido"
```

**Acceptance:** ningún camino cambia un pedido sin un `GET /v1/orders/{id}` (o la respuesta de la creación) que coincida con lo congelado.

---

### Task 13: Certificados — firma Ed25519, PDF, etiqueta del dorso, archivo digital firmado y verificación

**Files:**
- Create: `apps/muestras/lib/ventas/certificado.ts` (+ test), `apps/muestras/lib/ventas/archivo-firmado.ts` (+ test), `apps/muestras/app/verificar/page.tsx`, `apps/muestras/app/verificar/[codigo]/page.tsx`, `apps/muestras/app/verificar/clave/route.ts`, `apps/muestras/components/ventas/verificacion.tsx`
- Modify: `apps/muestras/lib/ventas/conciliar.ts` (`emitirCopia` con la firma)

**Interfaces:**
- Consumes: `certificatePayload`, `certificateView`, `xmpPacket`, `editionLabel`, `normalizeCertificateCode` (Task 2); `pdf-lib`, `qrcode`, `sharp`; `leerPrivado`, `subirPrivado`; las fuentes y la forma de armar PDF de `lib/fichas` (reutilizar el registro de fuentes y los helpers de QR existentes).
- Produces:
  - `certificado.ts` (`server-only`): `firmarCertificado(payload: string)` → `{ kid, signature }` (`crypto.sign(null, Buffer.from(payload), privateKey)` en base64url; clave desde `MUESTRAS_CERT_PRIVATE_KEY` base64 → PEM PKCS8 → `createPrivateKey`; error claro si falta); `verificarFirma(payload, signature, kid)` (pública actual derivada de la privada o de `MUESTRAS_CERT_OLD_PUBLIC_KEYS`); `clavesPublicas()` → `{ kid: pem }`; `pdfDeCertificado(copia, datos)` → `Uint8Array` (A4 vertical: encabezado "Certificado de autenticidad", obra en grande, autor, **número grande** ("3/10" o "Copia única" o "P/A 1/2"), formato ("Copia impresa Fine Art · Hahnemühle Photo Rag 308 g · 40 × 60 cm" o "Copia digital firmada · 6000 × 4000 px"), muestra y sede, fecha de emisión en hora argentina, comprador si aceptó, **firma escaneada** del autor (PNG del bucket privado) con su nombre debajo, QR (≥ 3 cm) a `/verificar/<código>`, código en texto, "Huella del original: <primeros 16 del SHA-256>…", "Firma digital DNX <kid>"; en prueba, marca de agua diagonal "CERTIFICADO DE PRUEBA — SIN VALIDEZ"); `pdfDeEtiqueta(copia, datos)` → A4 con una etiqueta de **10 × 6 cm** con marcas de corte (QR de 4 cm, "3/10", título, autor, código, "Verificá en muestrasfotograficas.com/verificar"); los dos se guardan en `ventas/<orderId>/certificado.pdf` y `etiqueta.pdf` la primera vez y después se leen de ahí.
  - `archivo-firmado.ts` (`server-only`): `archivoFirmado(order)` → `Buffer` JPEG: lee el original del bucket privado, `sharp(original, { limitInputPixels: false }).rotate().withXmp(xmpPacket(...)).jpeg({ quality: 95, chromaSubsampling: "4:4:4" })`, guarda en `ventas/<orderId>/<código>.jpg`, y lo devuelve; segunda vez lo lee del bucket. Test: el JPEG resultante contiene el paquete XMP (`sharp(out).metadata()` trae `xmp`) con el código y la firma.
  - `emitirCopia(tx, copia, pedido)` en `conciliar.ts`: código nuevo (reintenta si choca el único), `certificatePayload` con los datos congelados (nombre del autor = cómo firma, título, muestra, formato, edición, número, papel/medida, SHA-256 del original, día argentino, comprador si aceptó, `test`), `firmarCertificado`, guarda `certificateCode`, `certificateKid`, `certificatePayload`, `certificateSignature`, `issuedAt`. **Si falta la clave**, no emite: el pedido queda `PAID` con evento `ALERT_NO_CERT_KEY` y la página del pedido dice "Tu pago está confirmado. El certificado se está generando." (el barrido reintenta la emisión de copias `RESERVED` de pedidos `PAID`).
  - `/verificar` (formulario: "Escribí el código del certificado") y `/verificar/[codigo]` (dinámica, `noindex`, `no-referrer`, freno `verificar`): busca la copia por código; **verifica la firma** sobre el payload guardado; muestra la vista de `certificateView` con obra, autor, número, formato, papel y medida, muestra, fecha, comprador si aceptó, miniatura sólo si la obra se ve online (`workAccess`), y el enlace al perfil del autor. Código inexistente: "No encontramos un certificado con ese código. Revisá que esté bien escrito." (mismo tiempo de respuesta aproximado; nunca "existe pero…").
  - `/verificar/clave`: `text/plain` con las claves públicas PEM por `kid`.
  - Generar la clave (para la guía y para Daniel): `node -e "const {generateKeyPairSync}=require('crypto');const {privateKey}=generateKeyPairSync('ed25519');console.log(Buffer.from(privateKey.export({type:'pkcs8',format:'pem'})).toString('base64'))"`.

- [ ] **Step 1: Tests que fallan** — con una clave Ed25519 de test generada en el test: firmar y verificar; payload alterado → inválida; `kid` viejo verifica con la pública vieja; el PDF tiene una página y contiene el código (texto extraíble con `pdf-lib` no alcanza: verificar que `pdfDeCertificado` recibió el código mirando el QR generado con un `qrcode` mockeado); en prueba aparece la marca; sin comprador aceptado, el nombre no está en el payload; `archivoFirmado` incrusta XMP; `/verificar/<código>` de una copia `VOIDED` muestra "anulada"; código mal escrito → mensaje.
- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter muestras test -- ventas/certificado ventas/archivo-firmado` — Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr** — Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint` — Expected: en verde.
- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: certificado firmado con QR, etiqueta para el dorso, copia digital con XMP y página de verificación"
```

**Acceptance:** un certificado emitido se verifica en `/verificar/<código>`; cambiar a mano un carácter del payload en la base hace que la página diga que la firma no coincide.

---

### Task 14: CLF — avisar a Muestras de las órdenes `muestras-venta-` (cambio mínimo)

**Files:**
- Create: `apps/compramelafoto/lib/dnx-payments/aviso-muestras.ts`, `apps/compramelafoto/lib/dnx-payments/aviso-muestras.test.ts`
- Modify: `apps/compramelafoto/lib/homologation/mp-split-1n/orders-webhook.ts`, `apps/compramelafoto/app/api/webhooks/dnx-payments/route.ts`, `apps/compramelafoto/.env.example`

**Interfaces:**
- Consumes: el resultado de `observeOrdersWebhook` (`observed.outcome`, `observed.canonical?.externalReference`, `observed.providerOrderId`).
- Produces:
  - `aviso-muestras.ts`: `MUESTRAS_REFERENCE_PREFIX = "muestras-venta-"`; `esOrdenDeMuestras(ref: string | null | undefined): boolean`; `firmarAviso(secreto, t, cuerpo)` (**copia idéntica** de `apps/muestras/lib/ventas/aviso-firma.ts`, con el mismo vector fijo en el test y un comentario que dice dónde está la otra copia); `avisarAMuestras(providerOrderId, deps = { fetch, env, ahora })` → `Promise<void>`: sin `MUESTRAS_AVISO_PAGOS_SECRET` → `console.warn` una vez y nada; si no, `POST` a `MUESTRAS_AVISO_PAGOS_URL ?? "https://muestrasfotograficas.com/api/pagos/aviso"` con `AbortSignal.timeout(3000)`; **nunca lanza** (todo en `try/catch`, log sin secretos con el prefijo del id de orden).
  - `orders-webhook.ts`: en la rama `ok` de `handleClfOrdersWebhook`, agregar al objeto devuelto `routeTo: observed.outcome === "processed" && esOrdenDeMuestras(canonical?.externalReference) ? "muestras" : null` y `providerOrderId` (fuera de `evidence`). **Nada más cambia** (guardas, token, persistencia, códigos de respuesta). Actualizar el tipo `ClfOrdersWebhookOutcome`.
  - `route.ts`: `import { after } from "next/server"` y, si `result.ok && result.routeTo === "muestras"`, `after(() => avisarAMuestras(result.providerOrderId))` **antes** del `return`; la respuesta JSON no cambia (`routeTo` y `providerOrderId` no se agregan al cuerpo).
  - `.env.example`: `MUESTRAS_AVISO_PAGOS_URL=` (optativa) y `MUESTRAS_AVISO_PAGOS_SECRET=` (mismo valor que en Muestras), con comentario.

- [ ] **Step 1: Tests que fallan** (`aviso-muestras.test.ts` con el runner que ya usa CLF para `lib/homologation/mp-split-1n/*.test.ts` — verificar en `apps/compramelafoto/package.json` cuál es y agregar el archivo al mismo patrón): prefijo sí/no/`null`; vector fijo de la firma (igual al de Muestras); sin secreto no llama a `fetch`; con secreto manda URL, encabezado y cuerpo correctos; `fetch` que tira o tarda más de 3 s → no lanza. Test de `orders-webhook` (`orders-webhook-guards.test.ts` o uno nuevo): con `canonical.externalReference = "muestras-venta-abc…"` y `outcome = processed` → `routeTo = "muestras"`; `duplicate` → `null`; otra referencia → `null`; las guardas siguen dando los mismos códigos.
- [ ] **Step 2: Correr y ver que fallan** — Run: el comando de tests de CLF para esos archivos (p. ej. `pnpm --filter compramelafoto exec tsx --test lib/dnx-payments/aviso-muestras.test.ts lib/homologation/mp-split-1n/orders-webhook-guards.test.ts`) — Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr** — Run: los mismos tests + `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter compramelafoto exec tsc --noEmit -p .` (o su `check-types`) + `pnpm --filter compramelafoto lint` — Expected: en verde. `git diff origin/main --stat -- apps/compramelafoto` muestra **sólo** los cinco archivos de esta task.
- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto
git commit -m "CLF: el receptor de Mercado Pago avisa a Muestras cuando cambia una orden de venta de obras"
```

**Acceptance:** con `MUESTRAS_AVISO_PAGOS_SECRET` vacía, el comportamiento del receptor de CLF es idéntico al de `main` (mismas respuestas en los tests existentes).

---

### Task 15: La página de compra y el pedido del comprador

**Files:**
- Create: `apps/muestras/components/ventas/{compra.tsx, pedido.tsx}`, `apps/muestras/app/m/[slug]/o/[workId]/adquirir/page.tsx`, `apps/muestras/app/compras/[publicId]/page.tsx`, `apps/muestras/app/compras/[publicId]/certificado/route.ts`, `apps/muestras/app/compras/[publicId]/archivo/route.ts`, `apps/muestras/app/compras/[publicId]/arrepentimiento/page.tsx`
- Modify: `apps/muestras/app/m/[slug]/sala/o/[workId]/adquirir/page.tsx`, `apps/muestras/lib/sala/consultas.ts` (+ tests), `apps/muestras/components/sala/obra-de-sala.tsx`, `apps/muestras/app/m/[slug]/o/[workId]/page.tsx`, `packages/muestras/src/room.ts` (sacar la envoltura de la Task 3 cuando no queden usos)

**Interfaces:**
- Consumes: `ofertasDeLaObra`, `salePageState`, `puedeComprar`, `reservarCopia`, `pagarPedido`, `pedidoConAcceso`, `conciliarPedido`, `pdfDeCertificado`, `archivoFirmado`, `editionLabel`, `deliveryOptions`, `SALE_TERMS_TEXT`.
- Produces:
  - `lib/sala/consultas.ts`: `vistaDeSala` → `mostrarAdquirir = showBuyButton({ roomBuy, hasOffers })` con `hasOffers` = la obra tiene alguna oferta `APPROVED` (vale para obras de **expositores y de concurso**: cierra el hueco de la etapa 7); `obraParaAdquirir` sigue sin traer precios (los trae `ofertasDeLaObra` sólo cuando el estado es `AVAILABLE`).
  - **Página de compra** (las dos rutas renderizan `<Compra>` con los mismos datos; la de sala con el pase como hoy; la pública sólo si la obra se ve online según `workAccess` —si no, `notFound()`—): `dynamic = "force-dynamic"`, `noindex`, `no-referrer`. Estado `salePageState`:
    - `NOT_FOR_SALE` → `notFound()` (como hoy).
    - `UNAVAILABLE` → exactamente lo de hoy: título, autor, `SALE_UNAVAILABLE_TEXT`, `SALE_ASK_TEXT`, volver. **Sin precio en el HTML** (test que serializa).
    - `SOLD_OUT` → "Se vendieron todas las copias de esta obra." + consultar en la sala.
    - `AVAILABLE` → imagen (la de sala por el proxy o la pública), título, autor, y **los formatos** como tarjetas: "Copia digital firmada · Edición de 10 · Quedan 7 · $80.000", "Copia impresa Fine Art · Hahnemühle Photo Rag 308 g · 40 × 60 cm · Copia única · $350.000"; al elegir: entrega (digital / "Retiro en la sede: <texto>" / "Envío: $8.000 — <texto>"), datos (nombre y apellido, email, teléfono optativo, dirección si es envío), "Quiero que mi nombre figure en el certificado", términos (con las condiciones de la organización, plegables) y **"Continuar al pago"** → `reservarCopia` → muestra el total, la cuenta regresiva y el **Brick**. En `TEST` arriba: "Modo prueba: sólo vos ves esto. Usá tarjetas y emails de prueba." Texto fijo para lo digital: "Recibís el archivo original con su certificado de autenticidad firmado. El valor de la copia está en el certificado registrado." Para lo impreso: "Impresión Fine Art / premium hecha por la organización. Lleva al dorso una etiqueta con el QR de su certificado."
  - **Página del pedido** `/compras/[publicId]` (dinámica, `noindex`, `no-referrer`, `no-store`; acceso por `?t=` o cookie, si no `notFound()`; con `?t=` válido pone la cookie y redirige sin el token (303)): si `PENDING_PAYMENT` con `providerOrderId` y `lastSyncedAt` de más de 30 s → `conciliarPedido(..., "RETURN")` (freno `verPedido`). Muestra: estado ("Pago confirmado" / "Esperando la confirmación de Mercado Pago" / "El pago no se aprobó" / "Reserva vencida" / "Pago devuelto" / "Cobrado sin copia disponible: la organización se va a comunicar para devolverte el dinero"), obra, formato, **número** ("Tu copia es la 3/10"), total y desglose ("Incluye envío $8.000"), entrega y **estado de producción** de las impresas (línea de tiempo: en producción → lista para retirar / enviada → entregada, con el texto de seguimiento), **"Descargar certificado (PDF)"** y, si es digital, **"Descargar archivo firmado"**, "Verificar en línea" (`/verificar/<código>`), el recuadro "Guardá este enlace: es la forma de volver a tu pedido y a tu certificado" con "Copiar enlace" (el enlace con `?t=`), datos de contacto de la organización (los de la muestra), y **"Botón de arrepentimiento"** (hasta 10 días corridos desde `paidAt`).
  - `/compras/[publicId]/certificado` y `/archivo` (`GET`, acceso por cookie, `PAID` y copia `ISSUED`; freno `descargaVenta`; `Content-Disposition: attachment; filename="certificado-<código>.pdf"` / `"<titulo-slug>-<código>.jpg"`; `Cache-Control: private, no-store`; `maxDuration = 60`). Una copia `VOIDED` → 410 "Esta copia fue anulada.".
  - `/compras/[publicId]/arrepentimiento`: formulario con motivo optativo → `regretRequestedAt` + evento `BUYER`; "Recibimos tu pedido de arrepentimiento. La organización y la plataforma lo van a revisar y te van a devolver el dinero según los términos." Visible para la organización y el super admin (Task 16).
  - `app/m/[slug]/o/[workId]/page.tsx` (pública, ISR): **no** lee ofertas ni modo (sigue cacheada); muestra el enlace "Adquirir obra" sólo si la obra tiene alguna oferta `APPROVED` (dato sin precio, se cachea igual) — la página de compra decide el resto.

- [ ] **Step 1: Tests que fallan** — `consultas.test.ts`: obra de concurso con oferta aprobada → `mostrarAdquirir`; sin ofertas → no. Página de compra (render del componente servidor con datos falsos): en `OFF` el HTML no contiene el precio; en `TEST` para un visitante sin permiso tampoco; para un probador sí; obra oculta online en la ruta pública → `notFound`. Pedido: sin token ni cookie → `notFound`; token de otro pedido → `notFound`; `PENDING` viejo concilia una vez; descarga de copia anulada → 410; arrepentimiento después de 10 días → mensaje.
- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter muestras test -- sala ventas/pedido compras` — Expected: FAIL.
- [ ] **Step 3: Implementar** y sacar `SALES_ENABLED`/`saleState` de `room.ts` (y de `index.ts`) cuando `grep -rn "SALES_ENABLED\|saleState(" apps packages --include=*.ts --include=*.tsx` no devuelva usos.
- [ ] **Step 4: Correr** — Run: `pnpm --filter @repo/muestras test && pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint` — Expected: en verde.
- [ ] **Step 5: Commit**

```bash
git add apps/muestras packages/muestras
git commit -m "Muestras: la página Adquirir obra vende — formatos, reserva, pago y el pedido del comprador con su certificado"
```

**Acceptance:** con el modo en `OFF`, `curl` de `/m/<slug>/sala/o/<id>/adquirir` (con pase) devuelve el mismo texto que hoy y ningún número con `$`.

---

### Task 16: Pedidos en el panel — producción, etiquetas, P/A, devoluciones y ventas de prueba

**Files:**
- Create: `apps/muestras/lib/ventas/pedidos-panel.ts` (+ test), `apps/muestras/app/panel/muestras/[id]/ventas/pedidos/page.tsx`, `apps/muestras/app/panel/ventas/page.tsx`, `apps/muestras/app/api/ventas/archivo/[id]/route.ts`, `apps/muestras/app/api/ventas/etiqueta/[orderId]/route.ts`, `apps/muestras/app/api/ventas/certificado/[orderId]/route.ts`, `apps/muestras/components/ventas/pedidos-panel.tsx`
- Modify: `apps/muestras/app/panel/expositor/ventas/[activityId]/page.tsx` ("Tus ventas"), `apps/muestras/lib/ventas/consultas.ts`

**Interfaces:**
- Consumes: `fulfillmentTransition`, `devolverTotal`, `conciliarPedido`, `pdfDeCertificado`, `pdfDeEtiqueta`, `emitirCopia`.
- Produces:
  - Acciones: `cambiarProduccion(orderId, next, trackingText?)` (`salesFulfill`; `fulfillmentTransition`; fecha del paso; evento `STAFF`); `pedirDevolucion(orderId, motivo)` (`sales`; `refundRequestedAt` + evento); `devolverPago(orderId, motivo)` (**super admin**; pedido `PAID`/`PAID_NO_COPY`; `devolverTotal(providerOrderId, "refund-" + order.id)` y después `conciliarPedido(..., "ADMIN")` → `REFUNDED` + copia `VOIDED`; si Mercado Pago rechaza: mensaje con `sanitizeError`); `emitirPruebaDeAutor(offerId)` (`sales`; transacción con `FOR UPDATE` sobre la oferta; próximo P/A libre ≤ `proofCount`; copia `PROOF` `ISSUED` sin pedido con certificado; en prueba `isTest`); `borrarVentasDePrueba(activityId)` (**super admin**; borra pedidos, eventos y copias `isTest = true` de la muestra y sus archivos `ventas/<orderId>/`; nunca toca `isTest = false`).
  - Rutas (`GET`, permiso releído en la base, `Cache-Control: private, no-store`): `/api/ventas/archivo/[id]` (original para imprimir: `salesFulfill` de la muestra o el autor; nombre `original-<obra>.<ext>`); `/api/ventas/etiqueta/[orderId]` y `/api/ventas/certificado/[orderId]` (`salesFulfill`, pedido `PAID` impreso; también para copias P/A con `?copia=<id>`).
  - Página `/panel/muestras/[id]/ventas/pedidos` (`requireUsuario`; `notFound()` sin `salesFulfill`): arriba en rojo los `PAID_NO_COPY` y los arrepentimientos/devoluciones pedidas; filtros por estado; por pedido: fecha (hora argentina), obra, formato y número, comprador (nombre, email, teléfono; dirección si es envío), entrega, total y desglose (plataforma / organización / fotógrafo / envío), estado del pago (con "Prueba" si `isTest`), producción con botones del siguiente paso, "Bajar original para imprimir", "Certificado (PDF)", "Etiqueta del dorso (PDF)", historial plegable, "Pedir devolución" (dueño). "Emitir certificado de P/A" por oferta con P/A disponibles.
  - Página `/panel/ventas` (super admin): todos los pedidos de la plataforma con filtros, alertas (`PAID_NO_COPY`, pendientes de más de 72 h, `MISMATCH`, `ALERT_NO_CERT_KEY`), devoluciones pedidas con **"Devolver el pago"**, y "Borrar las ventas de prueba" por muestra.
  - "Tus ventas" del autor: por obra y formato, fecha, número, estado, tu parte (`photographerCents`) — **sin datos del comprador** salvo el nombre si aceptó figurar en el certificado.

- [ ] **Step 1: Tests que fallan** — coorganización cambia producción pero no pide devolución; texto no ve pedidos; salto inválido de producción → mensaje; devolver sin ser super admin → no; devolver llama con la clave de idempotencia fija (dos clics → una devolución); P/A no pasa de `proofCount`; borrar pruebas no toca reales; el autor no ve email ni teléfono del comprador; descarga del original por otra cuenta → 404.
- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter muestras test -- ventas/pedidos-panel` — Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr** — Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint` — Expected: en verde.
- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: pedidos en el panel — producción de impresas, etiquetas, P/A, devoluciones y ventas de prueba"
```

---

### Task 17: Lo público, privacidad y textos

**Files:**
- Modify: `apps/muestras/app/privacidad/page.tsx`, `apps/muestras/lib/portada/funciones.ts` (si el ítem de venta de la portada dice algo que ahora cambia), `apps/muestras/app/panel/page.tsx` (contadores "N formatos para revisar", "N pedidos para producir"), `apps/muestras/app/panel/expositor/page.tsx`

**Interfaces:**
- Produces: `/privacidad` suma cuatro párrafos (datos del comprador: nombre, email, teléfono y dirección para entregar y para el certificado si lo aceptó, documento sólo a Mercado Pago, se guardan mientras la copia exista; firma escaneada del autor: sólo en certificados; email de Mercado Pago de quien cobra: para el reparto; verificación pública: muestra obra, número y comprador sólo si aceptó). Portada: el paso "vender" dice "Vendé copias digitales firmadas y copias impresas Fine Art, únicas o en edición limitada, con certificado y QR de autenticidad; el cobro se reparte solo entre la organización, el fotógrafo y la plataforma." (verificar el texto actual y ajustar sólo lo que deje de ser verdadero). Contadores en el tablero del panel.

- [ ] **Step 1: Tests** — `lib/portada` (si tiene test de textos), contadores en `consultas`.
- [ ] **Step 2: Implementar.**
- [ ] **Step 3: Correr** — Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint` — Expected: en verde.
- [ ] **Step 4: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: privacidad, portada y contadores de la venta"
```

---

### Task 18: Verificación final, migración en producción, guía y PR

**Files:**
- Modify: `docs/operations/muestras-puesta-en-marcha.md` (sección "Etapa 8")

- [ ] **Step 1: Todos los chequeos**

Run: `git fetch origin && git rebase origin/main` (resolver sólo conflictos de esta etapa). Después:
`pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter @repo/muestras lint && pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint && <tests de CLF de la Task 14> && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter compramelafoto check-types && pnpm --filter compramelafoto lint && pnpm --filter @repo/payments test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras build && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter compramelafoto build`
Expected: todo en verde. En el build de Muestras: `/compras/[publicId]`, `/verificar/[codigo]`, las dos `adquirir`, `/api/pagos/aviso`, `/api/cron/ventas` y las páginas del panel nuevas dinámicas (`ƒ`); `/m/[slug]` y `/m/[slug]/o/[workId]` siguen con revalidación. `git diff origin/main -- pnpm-lock.yaml` muestra sólo las dos líneas del importer de Muestras. `git diff origin/main --stat -- apps/compramelafoto` muestra sólo los archivos de la Task 14. `grep -rn "priceArs\|approvedPriceArs" apps/muestras/app/m apps/muestras/components/sala` sólo en el componente de compra con estado `AVAILABLE`.

- [ ] **Step 2: Aplicar la migración en producción — la hace el controlador (autorizado por Daniel)**

Qué hace: crea **nueve tablas vacías**; no agrega columnas ni modifica o borra datos. Requisito: las tres `20261101120000_*` aplicadas (`select migration_name from "_prisma_migrations" where migration_name like '20261101120000_%';` → tres filas). Va **antes** de publicar el código. Para deshacer (sólo si el código nuevo **no** está publicado y las tablas están vacías):
```sql
drop table "CulturalSaleEvent", "CulturalSaleOrder", "CulturalEditionCopy", "CulturalWorkOffer", "CulturalAuthorSignature", "CulturalSaleFile", "CulturalPayoutAccount", "CulturalSaleAuthorTerms", "CulturalSaleSetup";
```
1. Correr `packages/db/prisma/migrations/20261102120000_muestras_etapa_8_venta/migration.sql` en la rama `development` (`br-old-rain-adwthzng`) del proyecto `divine-hall-10689679` (Neon MCP `run_sql_transaction`, una sentencia por elemento, sin comentarios).
2. Verificar:
```sql
select table_name from information_schema.tables
where table_name in ('CulturalSaleSetup','CulturalSaleAuthorTerms','CulturalPayoutAccount','CulturalSaleFile','CulturalAuthorSignature','CulturalWorkOffer','CulturalEditionCopy','CulturalSaleOrder','CulturalSaleEvent') order by table_name;
select conname, confdeltype from pg_constraint where conname like 'Cultural%fkey' and conrelid::regclass::text in ('"CulturalSaleSetup"','"CulturalSaleAuthorTerms"','"CulturalSaleFile"','"CulturalWorkOffer"','"CulturalEditionCopy"','"CulturalSaleOrder"','"CulturalSaleEvent"') order by conname;
select indexname from pg_indexes where indexname = 'CulturalEditionCopy_offerId_isTest_kind_number_key';
```
Expected: nueve tablas; nueve claves foráneas (las de `CulturalEditionCopy` y `CulturalSaleOrder` con `confdeltype = 'r'`, el resto `'c'`); el índice único de la numeración.
3. Probar los tipos y el índice único, en una transacción que se deshace:
```sql
begin;
insert into "CulturalWorkOffer" ("id","activityId","activityWorkId","authorUserId","format","editionKind","editionSize","priceArs","updatedAt")
select 'prueba-oferta', id, 'w', 1, 'PRINT', 'LIMITED', 10, 100000, now() from "CulturalActivity" limit 1;
insert into "CulturalEditionCopy" ("id","offerId","activityId","kind","number","status","updatedAt")
select 'prueba-1', 'prueba-oferta', "activityId", 'COPY', 1, 'RESERVED', now() from "CulturalWorkOffer" where id = 'prueba-oferta';
insert into "CulturalEditionCopy" ("id","offerId","activityId","kind","number","status","updatedAt")
select 'prueba-2', 'prueba-oferta', "activityId", 'COPY', 1, 'RESERVED', now() from "CulturalWorkOffer" where id = 'prueba-oferta';
rollback;
```
Expected: el segundo insert de copia falla con `duplicate key value violates unique constraint "CulturalEditionCopy_offerId_isTest_kind_number_key"` (y la transacción se deshace).
4. Registrar con el checksum:

Run: `shasum -a 256 packages/db/prisma/migrations/20261102120000_muestras_etapa_8_venta/migration.sql`
```sql
insert into "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
values (gen_random_uuid()::text, '<sha256 del paso anterior>', now(), '20261102120000_muestras_etapa_8_venta', null, null, now(), 1);
```
5. Confirmar: `select migration_name, checksum from "_prisma_migrations" where migration_name = '20261102120000_muestras_etapa_8_venta';` → una fila con el mismo checksum.

- [ ] **Step 3: Recorrido completo en local contra la base ya migrada, en sandbox**

Con `pnpm --filter muestras dev` (3014) y `pnpm --filter compramelafoto dev` (3000), `MUESTRAS_MP_ENV=sandbox`, el token y owner del usuario de prueba de "DNX Suite" (los de `services/dnx-mcp/.env.local` / `MERCADOPAGO_TEST_*`), una clave Ed25519 de prueba, un bucket privado de prueba (o el real con prefijo de prueba), `MUESTRAS_VENTAS_PROBADORES` con la cuenta P, y cuentas: O (dueña de una muestra de prueba publicada), C (coorganización), A (autor expositor) y B (autor de concurso), con dos usuarios de prueba de Mercado Pago como receptores (`MERCADOPAGO_TEST_PARTNER_EMAIL(_2)`):
1. Con `MUESTRAS_MP_ENV` vacío: la página "Adquirir obra" dice lo mismo que hoy y no muestra precios; el panel de Ventas dice por qué no está habilitada.
2. O conecta su Mercado Pago de prueba en Cobros, acepta en Mercado Pago y verifica → `ACTIVE`. Fija 25 % / 60 %, retiro en sede y envío a $8.000, abre la venta.
3. A acepta el reparto, sube su firma, sube un original de ~30 MB (barra de avance; hash y medidas), propone: digital edición de 5 a $80.000 e impresa copia única 40×60 en Photo Rag a $350.000. B (obra de concurso con venta aceptada) propone una impresa edición de 3. O aprueba, pide cambios a una, B corrige, O aprueba.
4. Hasta que A y B conecten Cobros, el panel dice "Falta que … conecte su Mercado Pago" y la página de compra no ofrece sus formatos. Conectan.
5. Visitante sin permiso (modo TEST): ve "todavía no está disponible". P (probador) escanea el QR de sala, ve los formatos con precio y "Quedan 5 de 5", compra la digital con tarjeta de prueba `APRO` y email `@testuser.com` → pedido pagado, "Tu copia es la 1/5 (prueba)", descarga el certificado (marca de prueba, firma, QR) y el JPEG firmado (XMP con código y firma: verificar con `exiftool` o `sharp().metadata()`); `/verificar/<código>` dice "Certificado de prueba". En Mercado Pago de prueba: la orden con tres receptores y montos 15 % / 25 % / 60 %.
6. P compra la impresa única con envío: total + $8.000; el envío va al receptor de O. O la lleva a "en producción" → "enviada" (con seguimiento) → "entregada"; P lo ve en su pedido. O baja etiqueta y certificado.
7. Dos pestañas compran la última copia de la edición de 3 a la vez: una reserva, la otra "Se vendieron todas…"; dejar vencer una reserva (o adelantar `holdExpiresAt` en la base de prueba) → el barrido la libera y el número vuelve a estar disponible.
8. Tarjeta de prueba rechazada (`OTHE`) → "El pago no se aprobó", la copia vuelve.
9. Con CLF local recibiendo una notificación de prueba de Mercado Pago (o el CLI `imp05`), el aviso llega a `/api/pagos/aviso` (log) y Muestras concilia; con firma inválida, 401.
10. Super admin devuelve el pago de la digital → `REFUNDED`, `/verificar/<código>` dice "anulada"; la siguiente compra recibe el número 2, no el 1.
11. C ve pedidos y cambia la producción, pero no ve "Pedir devolución" ni la configuración editable; el texto no ve Ventas. A ve "Tus ventas" sin email ni teléfono del comprador.
12. "Borrar las ventas de prueba" deja la muestra sin pedidos de prueba y con la numeración real intacta.
13. A 375 px: página de compra con el Brick, pedido, panel de Ventas y del autor, sin scroll horizontal.

- [ ] **Step 4: Guía de puesta en marcha**

Agregar al final de `docs/operations/muestras-puesta-en-marcha.md`:
```markdown
## Etapa 8 — venta de obras con reparto en tres y ediciones certificadas

1. Verificar que las migraciones `20261101120000_*` están aplicadas. — Controlador.
2. Aplicar la migración `20261102120000_muestras_etapa_8_venta` y registrarla con su SHA-256 (plan de la etapa 8, Task 18 Step 2). — Controlador, autorizado por Daniel. Antes del deploy. Sólo crea tablas.
3. Crear el bucket privado de R2 (sin dominio público) y cargar su nombre en `MUESTRAS_R2_PRIVATE_BUCKET`. — Daniel (o el controlador con permiso).
4. Generar la clave Ed25519 (comando en la Task 13 del plan), cargarla en `MUESTRAS_CERT_PRIVATE_KEY` (Production, sensible) con `MUESTRAS_CERT_KEY_ID=mf-2026-10`, y guardar una copia fuera de Vercel. — Daniel.
5. Generar y cargar `MUESTRAS_PEDIDOS_SECRET` (48 bytes al azar) y `MUESTRAS_AVISO_PAGOS_SECRET` (el mismo valor también en el proyecto de CLF). Si cambian después, los enlaces de pedidos ya entregados dejan de andar (la cookie del comprador sigue valiendo 30 días). — Daniel.
6. Modo prueba: `MUESTRAS_MP_ENV=sandbox`, `MUESTRAS_MP_ACCESS_TOKEN`/`MUESTRAS_MP_PUBLIC_KEY`/`MUESTRAS_MP_OWNER_USER_ID` = los del usuario de prueba de "DNX Suite" (los mismos que `MERCADOPAGO_TEST_*` de CLF), `MUESTRAS_VENTAS_PROBADORES` = ids de quienes prueban, `MUESTRAS_VENTAS_EN_VIVO=false`. Con esto, sólo los probadores compran y el público sigue viendo "todavía no está disponible". — Daniel.
7. Verificar que `CRON_SECRET` está cargada y que el cron `/api/cron/ventas` aparece en Vercel. — Controlador.
8. Fusionar el PR. Se publican Muestras y CLF.
9. Apenas se publica: CLF responde igual en `/api/webhooks/dnx-payments` (prueba con una notificación de sandbox); en Muestras, una compra de prueba completa (Task 18 Step 3, puntos 5 y 10). — Controlador.
10. Antes de vender de verdad: revisión legal de los términos y del arrepentimiento; prueba de concurrencia contra base real (Task 10 Step 4); cierre de la homologación de Mercado Pago (orden productiva). Después: `MUESTRAS_MP_ENV=production` con el token y owner reales de "DNX Suite", `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED=true`, `DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED=true` y, último, `MUESTRAS_VENTAS_EN_VIVO=true`. Las cuentas de cobro de prueba no sirven en producción: cada persona conecta su cuenta real. — Daniel.
11. Para tener avisos en vivo, el receptor de CLF tiene que procesar órdenes de producción (cambio del cierre de homologación, fuera de esta etapa). Mientras tanto, Muestras confirma al crear, en la página del pedido y con el barrido. — Controlador.
```

- [ ] **Step 5: Commit y PR**

```bash
git add docs/operations/muestras-puesta-en-marcha.md
git commit -m "Guía de puesta en marcha de la Etapa 8 de Muestras"
git push -u origin feat/muestras-etapa-8-venta
gh pr create --base main --title "Muestras Fotográficas — Etapa 8: venta de obras con reparto en tres y ediciones certificadas" --body "<resumen en español: modos OFF/TEST/LIVE y por qué el público sigue viendo 'todavía no disponible'; reparto 15 % plataforma + organización + fotógrafo, aceptado por cada autor; formatos que propone el autor y aprueba la organización; Cobros con consentimiento de reparto; reserva de número 20 min y prueba de concurrencia; Order 1:N con Card Brick; conciliación por cuatro caminos; aviso CLF→Muestras (archivos de CLF tocados y por qué es seguro); certificado Ed25519, etiqueta del dorso, archivo con XMP y /verificar; pedidos y producción; devoluciones sólo totales; migración ya aplicada; variables nuevas; preguntas abiertas para Daniel; checklist del Step 3>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Etapa 8 (venta con reparto en tres y ediciones certificadas)

Resumen para quien ejecute: Tasks 1–3 son reglas puras (la 1 y la 2 paralelizables); la 4 es la migración (sin aplicar); la 5 la infraestructura (entorno, Mercado Pago, bucket privado, firma del aviso); 6–9 preparan la venta (cobros, organización, autor, aprobación); 10–12 el circuito del dinero (reserva, pago, conciliación); 13 certificados (puede ir en paralelo desde la 5); 14 CLF (puede ir en paralelo desde la 5); 15 la página de compra y el pedido; 16 el panel de pedidos; 17 textos; 18 verificación, migración en producción y PR.

## Cobertura del spec

| Spec | Task |
|---|---|
| D1–D3 modos, dos llaves, configuración completa | 1, 5, 15 |
| D4 pruebas aparte (isTest, numeración, marca, borrar) | 2, 10, 13, 16 |
| D5 precio no público salvo compra habilitada | 15, 18 |
| D6–D7 fee 15 %, reparto sin valor por defecto, montos y redondeo, envío a la organización | 1, 7, 10, 11 |
| D8 aceptación del autor, versión del reparto | 1, 7, 8 |
| D9–D12 ofertas por formato, estados, comprable, precios | 1, 8, 9, 10 |
| D13–D14 Cobros (split-consent), quién cobra | 5, 6, 7, 11 |
| D15–D17 original, firma, bucket privado | 5, 8, 13 |
| D18–D20 firma Ed25519, código y verificación, certificado, etiqueta, XMP | 2, 13 |
| D21–D24 numeración, reserva 20 min, pago tardío, P/A | 2, 10, 12, 16 |
| D25–D28 pedido, entrega y producción, devoluciones, arrepentimiento, términos | 1, 15, 16 |
| D29–D32 cuatro caminos de conciliación, transiciones, aviso CLF, límites en CLF | 11, 12, 14 |
| D33 pruebas y concurrencia real | 1, 2, 10, 18 |
| D34 capacidades `sales` / `salesFulfill` | 3, 7, 9, 16 |
| D35 cambios mínimos en CLF | 14 |
| D36 sin dependencias externas nuevas; Brick por script | 5, 11 |
| Hueco de la etapa 7 (obras de concurso sin botón) | 15 |
| Migración a mano + checksum, antes del deploy | 4, 18 |
| Lista de control de filtraciones | 8, 13, 15, 16, 17, 18 |
