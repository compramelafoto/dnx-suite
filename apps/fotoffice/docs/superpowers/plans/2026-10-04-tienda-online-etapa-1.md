# Tienda online — Etapa 1 (tienda base) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una institución de FOTOFFICE venda por internet, desde su sitio, los mismos productos
del mostrador (con talles, galería y retiro en sede), cobrando con su Mercado Pago, con un solo
stock y cada venta online convertida en una `Sale` que entra sola a Caja.

**Architecture:** Módulo nuevo `store` apoyado en Ventas (`lib/sales`). Tablas nuevas para ficha
online, galería, variantes, pedidos y configuración; dos columnas nulas (`variantId`) en
`SaleItem` y `StockMovement`. Lógica pura en `lib/store/*` (probada sola), escrituras en
transacciones que reutilizan `recordSale`/`voidSale`, cobro con el mismo circuito que reservas
(Checkout Pro con token de la institución + `marketplace_fee`, webhook propio con prefijo
`store:`), cron de vencimiento + conciliación. Vitrina pública bajo `app/w/[workspaceSlug]/tienda`.

**Tech Stack:** Next.js (App Router, versión del repo: leer `node_modules/next/dist/docs/` antes de
escribir rutas), Prisma 6 (`@repo/db`), Vitest, `@repo/payments/mercado-pago`, Resend vía
`lib/communications/send-and-log.ts`.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-04-tienda-online-etapa-1-design.md`

## Global Constraints

- Idioma: todo texto visible y todos los comentarios en español rioplatense, mismo tono que `lib/sales`.
- Plata: en el código, centavos enteros (`number`, sufijo `Minor`); en la base, `Decimal(12,2)` (sufijo `Ars`). Conversión SÓLO con `decimalArsToMinor` / `minorToDecimalString` de `lib/membership/money.ts`.
- Nunca un `catch` de P2002 dentro de una transacción interactiva: usar `createMany({ skipDuplicates: true })` y releer (ver comentario en `lib/sales/record-sale.ts`).
- Toda consulta lleva `workspaceId` en el `where`. Un id de otro workspace se trata como inexistente.
- Antes de tocar tablas de un módulo opcional (Caja, Clientes), preguntar `isModuleEnabledForWorkspace` (ver `lib/bookings/cash-deposit.ts`).
- Webhooks y crons responden siempre 200 al proveedor (salvo 401 de autorización del cron) y no confían en el cuerpo del aviso.
- Logs sin datos personales completos (nada de email/teléfono en `console.*`).
- Migración: `packages/db/prisma/migrations/20261004200000_store_base/migration.sql`, sólo `CREATE TABLE`, `CREATE INDEX`, `ADD COLUMN ... NULL`. Se aplica a mano en producción ANTES del deploy (fuera de este plan; lo hace quien fusiona).
- Llave del módulo: `"store"`. Prefijo de referencia externa: `"store:"`. Prefijo de pedido público: `"ped_"`. Reserva: 15 minutos. Máximo 3 pedidos pendientes por email.
- Pruebas: `pnpm --filter fotoffice exec vitest run <ruta>` desde la raíz del worktree. Al final de cada tarea, toda la suite de FOTOFFICE en verde.
- Commits: uno por tarea como mínimo, mensaje en español, terminando con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## Mapa de archivos

**Nuevos (`apps/fotoffice/`)**

| Archivo | Responsabilidad |
|---|---|
| `lib/store/constants.ts` | Llaves, prefijos, TTL, estados y sus etiquetas |
| `lib/store/transitions.ts` | Qué cambio de estado de pedido es válido (puro) |
| `lib/store/availability.ts` | Disponible = stock − reservado; precio efectivo de variante (puro) |
| `lib/store/external-reference.ts` | `store:<id>` ida y vuelta (puro) |
| `lib/store/access-token.ts` | `ped_` + token, hash y verificación (puro, `node:crypto`) |
| `lib/store/listing-form.ts` | Parseo/validación del formulario de ficha online (puro) |
| `lib/store/variant-form.ts` | Parseo/validación de variantes (puro) |
| `lib/store/settings-form.ts` | Parseo/validación de la configuración de tienda (puro) |
| `lib/store/cart/*` | Carrito portado de Clickatón (puro + localStorage) |
| `lib/store/checkout-input.ts` | Validación del formulario de checkout (puro) |
| `lib/store/stock-lock.ts` | Bloqueo de filas + cálculo de reservado dentro de tx |
| `lib/store/repository.ts` | Lecturas: vitrina, ficha, pedidos, configuración |
| `lib/store/create-order.ts` | Crear pedido con reserva (tx) |
| `lib/store/payment.ts` | Preferencia de Mercado Pago |
| `lib/store/credit-payment.ts` | Acreditación idempotente (tx) |
| `lib/store/expire.ts` | Vencimiento + conciliación |
| `lib/store/order-admin.ts` | Cambios de estado desde el panel, anulación |
| `lib/store/emails.ts` | Textos y envío de correos |
| `lib/store/access.ts` | Permisos del panel |
| `app/api/payments/mp/tienda-webhook/route.ts` | Webhook |
| `app/api/cron/tienda/route.ts` | Cron cada 15 min |
| `app/(shell)/ventas/tienda/**` | Panel de pedidos y configuración |
| `app/w/[workspaceSlug]/tienda/**` | Vitrina, ficha, carrito, checkout, pedido, arrepentimiento |
| `components/store/**` | Componentes públicos de la tienda |

**Modificados**

| Archivo | Cambio |
|---|---|
| `packages/db/prisma/schema.prisma` | Modelos nuevos + `variantId` |
| `lib/sales/ticket.ts` | `TicketLine.variantId: string \| null` |
| `lib/sales/record-sale.ts` | Descontar stock por variante |
| `lib/sales/void-sale.ts` | Devolver stock por variante |
| `lib/sales/checkout.ts` | Renglón crudo con `variantId` |
| `lib/sales/repository.ts` | Variantes en búsqueda por código y en la ficha |
| `app/(shell)/ventas/pos.tsx`, `actions.ts` | Elegir talle en el mostrador; ocultar "sólo online" |
| `app/(shell)/ventas/catalogo/[productId]/page.tsx` | Secciones Dónde se vende / Tienda online / Fotos / Talles |
| `lib/modules/registry.ts` (+test), `lib/modules/submodules.ts` | Módulo `store` |
| `lib/permissions/actions.ts` (+test) | `store.configure` |
| `lib/website/public-modules.ts` | Página `tienda` |
| `lib/images/r2-key-policy.ts` | Prefijos de galería y tabla de talles |
| `vercel.json` | Cron `/api/cron/tienda` |

---

### Task 1: Esquema y migración

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (al final, después de `SaleItem`; relaciones inversas en `Workspace`, `Product`, `Client`)
- Create: `packages/db/prisma/migrations/20261004200000_store_base/migration.sql`

**Interfaces:**
- Produces: modelos `ProductStoreListing`, `ProductImage`, `ProductVariant`, `StoreSettings`, `StoreOrder`, `StoreOrderItem`, `StoreOrderEvent`; enum `StoreOrderStatus`; columnas `SaleItem.variantId`, `StockMovement.variantId`.

- [ ] **Step 1: Agregar los modelos** (copiar tal cual)

```prisma
/// Ficha online de un producto. Sin fila = se vende sólo en mostrador (el comportamiento de
/// siempre). Tabla aparte y no columnas en `Product` para no tocar las filas existentes.
model ProductStoreListing {
  id                String   @id @default(cuid())
  workspaceId       String
  productId         String   @unique
  sellOnline        Boolean  @default(false)
  sellAtCounter     Boolean  @default(true)
  slug              String
  onlineTitle       String?
  onlineDescription String?
  sizeChartImageUrl String?
  weightGrams       Int?
  lengthCm          Int?
  widthCm           Int?
  heightCm          Int?
  maxPerOrder       Int?
  sortOrder         Int      @default(0)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  product   Product   @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, slug])
  @@index([workspaceId, sellOnline])
}

/// Galería del producto. La de menor `sortOrder` es la principal en la tienda.
model ProductImage {
  id          String   @id @default(cuid())
  workspaceId String
  productId   String
  url         String
  alt         String?
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId, sortOrder])
}

/// Talle (o variante) de un producto. Si un producto tiene variantes activas, su stock vive
/// acá y `Product.stockQty` es la suma, mantenida en la misma transacción.
model ProductVariant {
  id          String   @id @default(cuid())
  workspaceId String
  productId   String
  name        String
  sku         String?
  barcode     String?
  /// null = hereda `Product.priceArs`.
  priceArs    Decimal? @db.Decimal(12, 2)
  stockQty    Int      @default(0)
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  product        Product          @relation(fields: [productId], references: [id], onDelete: Cascade)
  saleItems      SaleItem[]
  stockMovements StockMovement[]
  orderItems     StoreOrderItem[]

  @@unique([workspaceId, sku])
  @@unique([workspaceId, barcode])
  @@index([productId, sortOrder])
}

model StoreSettings {
  id                 String   @id @default(cuid())
  workspaceId        String   @unique
  isOpen             Boolean  @default(false)
  pickupAddress      String?
  pickupHours        String?
  pickupInstructions String?
  returnsPolicy      String?
  notifyEmail        String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}

enum StoreOrderStatus {
  PENDING_PAYMENT
  PAID
  READY
  DELIVERED
  CANCELLED
  EXPIRED
  PAID_NO_STOCK
}

model StoreOrder {
  id                   String           @id @default(cuid())
  workspaceId          String
  publicId             String           @unique
  orderNumber          Int
  accessTokenHash      String
  status               StoreOrderStatus @default(PENDING_PAYMENT)
  buyerName            String
  buyerEmail           String
  buyerPhone           String?
  clientId             String?
  memberId             String?
  deliveryMethod       String           @default("PICKUP")
  subtotalArs          Decimal          @db.Decimal(12, 2)
  shippingArs          Decimal          @default(0) @db.Decimal(12, 2)
  totalArs             Decimal          @db.Decimal(12, 2)
  feeBps               Int              @default(0)
  feeArs               Decimal          @default(0) @db.Decimal(12, 2)
  holdExpiresAt        DateTime?
  mpPreferenceId       String?
  mpPaymentId          String?          @unique
  paidAt               DateTime?
  readyAt              DateTime?
  deliveredAt          DateTime?
  cancelledAt          DateTime?
  saleId               String?          @unique
  legalAcceptedAt      DateTime
  legalVersion         String
  clientIdempotencyKey String
  internalNote         String?
  createdAt            DateTime         @default(now())
  updatedAt            DateTime         @updatedAt

  workspace Workspace          @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  client    Client?            @relation(fields: [clientId], references: [id], onDelete: SetNull)
  items     StoreOrderItem[]
  events    StoreOrderEvent[]

  @@unique([workspaceId, orderNumber])
  @@unique([workspaceId, clientIdempotencyKey])
  @@index([workspaceId, status, createdAt])
  @@index([status, holdExpiresAt])
  @@index([workspaceId, buyerEmail, status])
}

model StoreOrderItem {
  id           String  @id @default(cuid())
  orderId      String
  productId    String?
  variantId    String?
  productName  String
  variantName  String?
  productSlug  String
  imageUrl     String?
  qty          Int
  unitPriceArs Decimal @db.Decimal(12, 2)
  lineTotalArs Decimal @db.Decimal(12, 2)

  order   StoreOrder      @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product Product?        @relation(fields: [productId], references: [id], onDelete: SetNull)
  variant ProductVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)

  @@index([orderId])
  @@index([productId])
  @@index([variantId])
}

model StoreOrderEvent {
  id          String            @id @default(cuid())
  orderId     String
  fromStatus  StoreOrderStatus?
  toStatus    StoreOrderStatus
  actorUserId Int?
  note        String?
  createdAt   DateTime          @default(now())

  order StoreOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId, createdAt])
}
```

En `SaleItem` y `StockMovement` agregar:

```prisma
  /// Talle vendido / movido. Nulo en productos sin variantes y en todo lo anterior a la tienda.
  variantId String?
  variant   ProductVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)
  @@index([variantId])
```

Relaciones inversas: en `Product` → `storeListing ProductStoreListing?`, `images ProductImage[]`, `variants ProductVariant[]`, `storeOrderItems StoreOrderItem[]`; en `Workspace` → `productStoreListings ProductStoreListing[]`, `storeSettings StoreSettings?`, `storeOrders StoreOrder[]`; en `Client` → `storeOrders StoreOrder[]`.

- [ ] **Step 2: Validar y generar el cliente**

Run: `pnpm --filter @repo/db exec prisma validate && pnpm --filter @repo/db exec prisma generate`
Expected: "is valid" y cliente generado.

- [ ] **Step 3: Escribir la migración con diff contra el esquema de `origin/main`**

```bash
git show origin/main:packages/db/prisma/schema.prisma > /tmp/schema-base.prisma
pnpm --filter @repo/db exec prisma migrate diff \
  --from-schema-datamodel /tmp/schema-base.prisma \
  --to-schema-datamodel prisma/schema.prisma --script \
  > packages/db/prisma/migrations/20261004200000_store_base/migration.sql
```

Revisar a mano: debe contener SÓLO `CREATE TYPE "StoreOrderStatus"`, `CREATE TABLE` de las 7 tablas, `ALTER TABLE "SaleItem" ADD COLUMN "variantId" TEXT`, ídem `StockMovement`, índices y FKs. Si aparece cualquier `DROP` o `ALTER` de otra tabla, es deriva previa del esquema: borrar esas líneas.

- [ ] **Step 4: Commit** — `git commit -m "Tienda: esquema y migración de la etapa 1"`

---

### Task 2: Reglas puras de la tienda

**Files:**
- Create: `lib/store/constants.ts`, `lib/store/transitions.ts`, `lib/store/availability.ts`, `lib/store/external-reference.ts`, `lib/store/access-token.ts`
- Test: `lib/store/transitions.test.ts`, `lib/store/availability.test.ts`, `lib/store/external-reference.test.ts`, `lib/store/access-token.test.ts`

**Interfaces:**
- Produces:
  - `STORE_MODULE_KEY = "store"`, `STORE_EXTERNAL_REFERENCE_PREFIX = "store:"`, `STORE_HOLD_MINUTES = 15`, `STORE_MAX_PENDING_PER_EMAIL = 3`, `STORE_LEGAL_VERSION = "2026-10-04"`, `STORE_ORDER_STATUS_LABELS: Record<StoreOrderStatus, string>`, `STORE_CONFIGURE_ACTION = "store.configure"` (este último se define en `lib/permissions/actions.ts`, Task 6; acá NO).
  - `canTransition(from: StoreOrderStatus, to: StoreOrderStatus, actor: "system" | "staff"): boolean`
  - `effectiveUnitPriceMinor(productPriceMinor: number, variantPriceMinor: number | null): number`
  - `availableQty(input: { stockQty: number; tracksStock: boolean; reservedQty: number }): number | null` (null = ilimitado)
  - `storeExternalReference(orderId: string): string`, `parseStoreExternalReference(raw: unknown): string | null`
  - `newPublicId(): string` (`ped_` + 12 chars base32 minúscula), `newAccessToken(): string` (32 bytes base64url), `hashAccessToken(token: string): string` (sha256 hex), `accessTokenMatches(token: string, hash: string): boolean` (`timingSafeEqual`).

- [ ] **Step 1: Pruebas que fallan**

```ts
// lib/store/transitions.test.ts
import { describe, expect, it } from "vitest";
import { canTransition } from "./transitions";

describe("canTransition", () => {
  it.each([
    ["PENDING_PAYMENT", "PAID", "system", true],
    ["PENDING_PAYMENT", "EXPIRED", "system", true],
    ["PENDING_PAYMENT", "CANCELLED", "staff", true],
    ["EXPIRED", "PAID", "system", true],          // pago tardío con stock
    ["EXPIRED", "PAID_NO_STOCK", "system", true], // pago tardío sin stock
    ["CANCELLED", "PAID_NO_STOCK", "system", true],
    ["PAID", "READY", "staff", true],
    ["READY", "DELIVERED", "staff", true],
    ["PAID", "DELIVERED", "staff", true],         // entregado en el acto
    ["PAID", "CANCELLED", "staff", true],         // anula y devuelve
    ["READY", "CANCELLED", "staff", true],
    ["PAID_NO_STOCK", "PAID", "staff", true],     // repuso stock
    ["PAID_NO_STOCK", "CANCELLED", "staff", true],// devolvió la plata
    ["DELIVERED", "CANCELLED", "staff", false],
    ["PAID", "PENDING_PAYMENT", "staff", false],
    ["PENDING_PAYMENT", "PAID", "staff", false],  // sólo el cobro marca pagado
    ["EXPIRED", "PAID", "staff", false],
  ] as const)("%s → %s (%s) = %s", (from, to, actor, esperado) => {
    expect(canTransition(from, to, actor)).toBe(esperado);
  });
});
```

```ts
// lib/store/availability.test.ts
import { describe, expect, it } from "vitest";
import { availableQty, effectiveUnitPriceMinor } from "./availability";

describe("availableQty", () => {
  it("resta lo reservado", () => expect(availableQty({ stockQty: 5, tracksStock: true, reservedQty: 2 })).toBe(3));
  it("nunca da negativo aunque el mostrador haya dejado el stock en rojo", () =>
    expect(availableQty({ stockQty: -2, tracksStock: true, reservedQty: 1 })).toBe(0));
  it("sin control de stock es ilimitado", () =>
    expect(availableQty({ stockQty: 0, tracksStock: false, reservedQty: 9 })).toBeNull());
});

describe("effectiveUnitPriceMinor", () => {
  it("hereda el del producto", () => expect(effectiveUnitPriceMinor(1000, null)).toBe(1000));
  it("la variante manda si tiene precio", () => expect(effectiveUnitPriceMinor(1000, 1500)).toBe(1500));
  it("un precio de variante en cero es válido", () => expect(effectiveUnitPriceMinor(1000, 0)).toBe(0));
});
```

```ts
// lib/store/external-reference.test.ts
import { describe, expect, it } from "vitest";
import { parseStoreExternalReference, storeExternalReference } from "./external-reference";

describe("referencia externa", () => {
  it("ida y vuelta", () => expect(parseStoreExternalReference(storeExternalReference("abc"))).toBe("abc"));
  it.each([null, undefined, 42, "", "abc", "booking:abc", "store:", "store:   "])(
    "rechaza %p", (raw) => expect(parseStoreExternalReference(raw)).toBeNull());
});
```

```ts
// lib/store/access-token.test.ts
import { describe, expect, it } from "vitest";
import { accessTokenMatches, hashAccessToken, newAccessToken, newPublicId } from "./access-token";

describe("token de acceso", () => {
  it("el público empieza con ped_ y no se repite", () => {
    const a = newPublicId(); const b = newPublicId();
    expect(a).toMatch(/^ped_[a-z2-7]{12}$/); expect(a).not.toBe(b);
  });
  it("verifica el token correcto y rechaza otro", () => {
    const t = newAccessToken(); const h = hashAccessToken(t);
    expect(accessTokenMatches(t, h)).toBe(true);
    expect(accessTokenMatches(newAccessToken(), h)).toBe(false);
    expect(accessTokenMatches("", h)).toBe(false);
  });
});
```

- [ ] **Step 2: Correr** — `pnpm --filter fotoffice exec vitest run lib/store` → FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar**

```ts
// lib/store/transitions.ts
import type { StoreOrderStatus } from "@repo/db";

/**
 * Qué cambio de estado de pedido vale y quién lo puede hacer. Módulo PURO.
 *
 * "system" es el cobro y el cron; "staff" es alguien del panel. Marcar pagado es SÓLO del
 * sistema: un pedido no se da por cobrado porque alguien lo diga, sino porque Mercado Pago lo
 * confirmó. La única excepción es `PAID_NO_STOCK → PAID`, que no cambia la plata (ya entró):
 * sólo dice que se repuso el stock.
 */
const SISTEMA: Record<StoreOrderStatus, readonly StoreOrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "PAID_NO_STOCK", "EXPIRED"],
  EXPIRED: ["PAID", "PAID_NO_STOCK"],
  CANCELLED: ["PAID_NO_STOCK"],
  PAID: [],
  READY: [],
  DELIVERED: [],
  PAID_NO_STOCK: [],
};
const PERSONAL: Record<StoreOrderStatus, readonly StoreOrderStatus[]> = {
  PENDING_PAYMENT: ["CANCELLED"],
  PAID: ["READY", "DELIVERED", "CANCELLED"],
  READY: ["DELIVERED", "CANCELLED"],
  PAID_NO_STOCK: ["PAID", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function canTransition(
  from: StoreOrderStatus,
  to: StoreOrderStatus,
  actor: "system" | "staff",
): boolean {
  return (actor === "system" ? SISTEMA : PERSONAL)[from].includes(to);
}
```

```ts
// lib/store/availability.ts
/** Cuánto se puede vender online. Módulo PURO. `null` = sin límite (no controla stock). */
export function availableQty(input: { stockQty: number; tracksStock: boolean; reservedQty: number }): number | null {
  if (!input.tracksStock) return null;
  return Math.max(0, input.stockQty - input.reservedQty);
}

/** El precio de la variante manda cuando existe; si no, el del producto. */
export function effectiveUnitPriceMinor(productPriceMinor: number, variantPriceMinor: number | null): number {
  return variantPriceMinor ?? productPriceMinor;
}
```

```ts
// lib/store/external-reference.ts
import { STORE_EXTERNAL_REFERENCE_PREFIX } from "./constants";

export function storeExternalReference(orderId: string): string {
  return `${STORE_EXTERNAL_REFERENCE_PREFIX}${orderId}`;
}

/** El id de pedido que viaja en un aviso de Mercado Pago, o null si el pago es de otra cosa. */
export function parseStoreExternalReference(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith(STORE_EXTERNAL_REFERENCE_PREFIX)) return null;
  const id = raw.slice(STORE_EXTERNAL_REFERENCE_PREFIX.length).trim();
  return id.length > 0 ? id : null;
}
```

```ts
// lib/store/access-token.ts
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

export function newPublicId(): string {
  const bytes = randomBytes(12);
  return "ped_" + Array.from(bytes, (b) => BASE32[b % 32]).join("");
}
export function newAccessToken(): string {
  return randomBytes(32).toString("base64url");
}
export function hashAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
export function accessTokenMatches(token: string, hash: string): boolean {
  if (!token) return false;
  const a = Buffer.from(hashAccessToken(token), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
```

```ts
// lib/store/constants.ts
import type { StoreOrderStatus } from "@repo/db";

export const STORE_MODULE_KEY = "store";
export const STORE_EXTERNAL_REFERENCE_PREFIX = "store:";
export const STORE_HOLD_MINUTES = 15;
export const STORE_MAX_PENDING_PER_EMAIL = 3;
/** Cambia cuando cambian los términos que acepta el comprador. */
export const STORE_LEGAL_VERSION = "2026-10-04";
/** Segmento de la tienda bajo `/w/[slug]/`. Es un compromiso público: no cambia. */
export const STORE_PUBLIC_SEGMENT = "tienda";

export const STORE_ORDER_STATUS_LABELS: Record<StoreOrderStatus, string> = {
  PENDING_PAYMENT: "Esperando el pago",
  PAID: "Pagado — a preparar",
  READY: "Listo para retirar",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  EXPIRED: "Vencido sin pago",
  PAID_NO_STOCK: "Pagado sin stock — resolver",
};

export const DEFAULT_RETURNS_POLICY =
  "Podés arrepentirte de la compra dentro de los 10 días corridos desde que retirás el producto, sin dar explicaciones, usando el botón de arrepentimiento. El producto tiene que estar sin uso y en su empaque. Te devolvemos el dinero por el mismo medio de pago.";
```

- [ ] **Step 4: Correr** → PASS. **Step 5: Commit** — `"Tienda: reglas puras (estados, disponibilidad, referencia, token)"`

---

### Task 3: Variantes en Ventas (mostrador, stock y anulación)

**Files:**
- Modify: `lib/sales/ticket.ts`, `lib/sales/checkout.ts`, `lib/sales/record-sale.ts`, `lib/sales/void-sale.ts`, `lib/sales/repository.ts`, `app/(shell)/ventas/actions.ts`, `app/(shell)/ventas/pos.tsx`, `app/(shell)/ventas/stock-form.tsx` (+ acción de stock)
- Create: `lib/store/variant-form.ts` + test, `lib/sales/variant-stock.ts` + test
- Test: ampliar `lib/sales/record-sale.test.ts`, `lib/sales/void-sale.test.ts`, `lib/sales/checkout.test.ts`

**Interfaces:**
- Produces:
  - `TicketLine.variantId: string | null` (todas las construcciones existentes pasan `null`).
  - `RawCheckoutLine.variantId?: string | null`.
  - `applyStockMovement(tx, { workspaceId, productId, variantId: string | null, qty: number, reason: StockReason, sourceModule: string | null, sourceRef: string | null, note: string | null, unitCostArs: string | null, createdByUserId: number | null }): Promise<void>` en `lib/sales/variant-stock.ts`: crea el `StockMovement` con `variantId`, y si hay variante incrementa `ProductVariant.stockQty` **y** `Product.stockQty` por la misma cantidad; si no, sólo `Product.stockQty`. Única función que mueve stock a partir de ahora: `record-sale`, `void-sale` y las acciones de entrada/ajuste la usan.
  - `findProductByCode` devuelve también `{ variant: { id, name, priceMinor } | null }` cuando el código coincide con `ProductVariant.barcode`/`sku`, y `variants: { id; name; priceMinor; stockQty }[]` para productos con variantes.
  - `parseVariantsForm(fd: FormData): { ok: true; variants: VariantInput[] } | { ok: false; error: string }` con `VariantInput = { id: string | null; name: string; sku: string | null; barcode: string | null; priceMinor: number | null; isActive: boolean; sortOrder: number }`. Reglas: nombre obligatorio y único (sin distinguir mayúsculas) dentro del producto; máximo 30 variantes; precio vacío = null; precio negativo = error.

- [ ] **Step 1: Pruebas que fallan**
  - `variant-form.test.ts`: nombres repetidos ("M" y "m") → error "Hay dos talles con el mismo nombre."; precio vacío → `null`; "-1" → error; 31 filas → error; orden respeta el del formulario.
  - `record-sale.test.ts` (seguir el doble de `tx` que ya usa ese archivo): una línea con `variantId: "v1"` crea `StockMovement` con `variantId: "v1"`, `qty: -2`, decrementa `productVariant.stockQty` y `product.stockQty` en 2; una línea sin variante sigue igual que antes (prueba existente intacta).
  - `void-sale.test.ts`: anular una venta cuyo `SaleItem` tiene `variantId` devuelve stock a esa variante.
  - `checkout.test.ts`: `buildTicketLines` propaga `variantId` y usa el precio de la variante cuando viene en `CheckoutProductInfo.variantPriceMinor`.
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar** `variant-stock.ts`, reemplazar en `descontarStock` (`record-sale.ts`) el `stockMovement.create` + `product.update` por `applyStockMovement` (manteniendo la regla: vender nunca se bloquea), lo mismo en `void-sale.ts` y en las acciones de entrada/ajuste de `actions.ts`. Agregar `variantId` en `saleItem.createMany`.
- [ ] **Step 4: Mostrador** (`pos.tsx`): si el producto encontrado tiene `variants.length > 0` y el código no identificó una variante, abrir un selector de talle (botones con nombre, precio y stock) antes de agregar el renglón; la descripción del renglón queda `"<nombre> — <talle>"`. Los productos con ficha `sellAtCounter = false` no aparecen en la búsqueda del mostrador (filtro en `findProductByCode` y en el listado del POS: `OR: [{ storeListing: null }, { storeListing: { sellAtCounter: true } }]`). La pantalla de stock pide talle para entradas/ajustes de productos con variantes.
- [ ] **Step 5: Correr toda la suite** → PASS. **Commit** — `"Ventas: talles (variantes) en mostrador, stock y anulación"`

---

### Task 4: Ficha online, galería y talles en el catálogo

**Files:**
- Create: `lib/store/listing-form.ts` + test, `lib/store/slug.ts` + test, `app/(shell)/ventas/catalogo/[productId]/store-sections.tsx`, `app/(shell)/ventas/catalogo/[productId]/store-actions.ts`
- Modify: `app/(shell)/ventas/catalogo/[productId]/page.tsx`, `lib/images/r2-key-policy.ts` (+test), `lib/sales/repository.ts` (`getProduct` incluye `storeListing`, `images`, `variants`)

**Interfaces:**
- Consumes: `parseVariantsForm` (Task 3), `requireSalesAdmin` (`lib/sales/access.ts`).
- Produces:
  - `slugify(name: string): string` (minúsculas, sin acentos, guiones, máx 80) y `uniqueSlug(base: string, taken: ReadonlySet<string>): string` (`remera`, `remera-2`, …).
  - `parseListingForm(fd): { ok: true; values: ListingValues } | { ok: false; error: string }` con `ListingValues = { sellOnline: boolean; sellAtCounter: boolean; slug: string; onlineTitle: string | null; onlineDescription: string | null; weightGrams: number | null; lengthCm: number | null; widthCm: number | null; heightCm: number | null; maxPerOrder: number | null }`. Regla: al menos un canal; enteros positivos o vacío; `onlineDescription` ≤ 5000.
  - Server actions (todas con `requireSalesAdmin`, `revalidatePath`): `saveListingAction(productId, fd)`, `saveVariantsAction(productId, fd)` (crea/actualiza/desactiva; nunca borra una variante con ventas o movimientos: la desactiva), `addProductImageAction(productId, url)`, `removeProductImageAction(imageId)`, `reorderProductImagesAction(productId, ids[])`, `setSizeChartAction(productId, url | null)`.
  - `r2-key-policy.ts`: prefijos `productGallery: "fotoffice/product-gallery"` y `sizeChart: "fotoffice/size-charts"`; subir con el mismo componente que hoy usa la foto de producto (`productPhoto`).
- [ ] **Step 1: Pruebas** — `slug.test.ts` ("Remera Oficial SFPR" → `remera-oficial-sfpr`; "Ñandú" → `nandu`; colisión → `-2`, `-3`); `listing-form.test.ts` (sin canales → "Elegí al menos un lugar donde se vende."; peso "abc" → error; vacío → null).
- [ ] **Step 2-3: Implementar** las funciones puras y las acciones. Al guardar una ficha por primera vez, `slug` por omisión = `uniqueSlug(slugify(product.name), slugsDelWorkspace)`. Al guardar variantes por primera vez sobre un producto con stock y sin variantes, se crea la primera variante con todo el stock existente vía `applyStockMovement` (AJUSTE −stock al producto y +stock a la variante), para que la suma siga cuadrando.
- [ ] **Step 4: UI** — en la ficha, cuatro tarjetas `fo-card` bajo la existente: **Dónde se vende** (dos checkboxes), **Tienda online** (slug con vista previa de la URL pública, título, descripción, peso y medidas, tope por compra), **Fotos** (grilla ordenable con subir/quitar), **Talles** (tabla editable: nombre, SKU, código, precio opcional "igual al producto", stock sólo lectura con enlace a Stock, activo; más la imagen de tabla de talles). Las secciones Tienda/Fotos/Talles muestran un aviso si el módulo `store` está apagado, pero se pueden cargar igual.
- [ ] **Step 5: Suite en verde + Commit** — `"Catálogo: ficha online, galería y talles"`

---

### Task 5: Carrito portado de Clickatón y validación de checkout

**Files:**
- Create: `lib/store/cart/{types,constants,line-key,quantities,reducer,schema,storage,totals,index}.ts` + `cart.test.ts`, `lib/store/checkout-input.ts` + test
- Origen: `apps/clickaton/lib/public-store/cart/*` (leerlos completos antes de portar)

**Interfaces:**
- Produces:
  - `CartLine = { productId: string; variantId: string | null; slug: string; name: string; variantName: string | null; imageUrl: string | null; unitPriceMinor: number; qty: number }`; `CartState = { version: 1; lines: CartLine[] }`.
  - `cartReducer(state, action)` con acciones `add | setQty | remove | clear | replaceLines`; `lineKey(l) = productId + ":" + (variantId ?? "-")`; `cartTotals(state) → { itemsCount, subtotalMinor }`.
  - `loadCart(workspaceSlug)` / `saveCart(workspaceSlug, state)` con clave `fotoffice-store-cart:v1:<workspaceSlug>`; leer con try/catch y schema (zod, ya en el repo) y devolver vacío si algo falla.
  - `parseCheckoutInput(raw: unknown): { ok: true; value: CheckoutInput } | { ok: false; errors: Record<string, string> }` con `CheckoutInput = { buyerName: string; buyerEmail: string; buyerPhone: string | null; acceptsTerms: true; clientIdempotencyKey: string; lines: { productId: string; variantId: string | null; qty: number }[] }`. Reglas: nombre ≥ 2; email válido y en minúscula; teléfono opcional 6–20 dígitos; aceptar términos obligatorio; 1–30 líneas; qty 1–99; `clientIdempotencyKey` 16–64 chars.
- [ ] **Step 1:** portar las pruebas de `apps/clickaton/lib/public-store/cart/cart.test.ts` adaptadas a los nombres de arriba (sin conceptos de edición), más pruebas de `checkout-input`.
- [ ] **Step 2-4:** implementar, correr, verde. **Commit** — `"Tienda: carrito y validación del checkout"`

---

### Task 6: Módulo `store`, permisos, configuración y página pública registrada

**Files:**
- Modify: `lib/modules/registry.ts` (+test: la lista AVAILABLE suma `store`), `lib/modules/submodules.ts` (submenú de Ventas: "Pedidos online" → `/ventas/tienda`, "Tienda" → `/ventas/tienda/configuracion`, sólo si `store` encendido), `lib/permissions/actions.ts` (+test), `lib/website/public-modules.ts` (+test si existe), `lib/landing/catalogo.ts` (ficha "Tienda online", cuadro `"13"`; correr un lugar `EN_CONSTRUCCION` y `lib/landing/tipos.ts` igual que se hizo con Ventas)
- Create: `lib/store/access.ts`, `lib/store/settings-form.ts` + test, `app/(shell)/ventas/tienda/configuracion/{page.tsx,actions.ts,settings-form.tsx}`

**Interfaces:**
- Produces:
  - Registro: `{ key: "store", name: "Tienda online", status: "AVAILABLE", category: "GENERAL", requires: ["sales", "website"] }` (usar los campos que el registro tenga realmente; si no hay `requires`, documentarlo en la descripción y verificar la dependencia en `requireStoreConfigurer`).
  - `STORE_CONFIGURE_ACTION = "store.configure"` en `MODULE_ACTIONS[store]` con label "Configurar la tienda", description "Abrir o cerrar la tienda, retiro, políticas y avisos.".
  - `requireStoreOperator()` (nivel MANAGE en `store`, redirige a `/dashboard`) y `requireStoreConfigurer()` (MANAGE + acción; redirige a `/ventas/tienda`), mismo patrón que `lib/cash/access.ts`. Ambos devuelven `{ user, workspace, canConfigure }`.
  - `PUBLIC_MODULE_PAGES` + `{ moduleKey: STORE_MODULE_KEY, segment: "tienda", label: "Tienda", order: 35 }`. El menú público sólo la muestra si además `StoreSettings.isOpen` (ver dónde `buildSiteNav` filtra por módulos y agregar esa condición con una lectura de `storeSettings`).
  - `parseSettingsForm(fd)` → `{ isOpen, pickupAddress, pickupHours, pickupInstructions, returnsPolicy, notifyEmail }`; abrir exige dirección de retiro y email de avisos válido.
  - `saveStoreSettingsAction(fd)`: si `isOpen` pasa a true, verificar `resolveWorkspaceCollector(workspaceId).ok`; si no, error "Para abrir la tienda primero conectá Mercado Pago en Configuración → Cobros.".
- [ ] Pruebas: registro, acciones, settings-form (abrir sin dirección → error; política vacía → `null` y la página pública usa `DEFAULT_RETURNS_POLICY`).
- [ ] Implementar, suite en verde, **Commit** — `"Tienda: módulo, permisos y configuración"`

---

### Task 7: Vitrina, ficha y carrito públicos

**Files:**
- Create: `lib/store/repository.ts` (+test de las funciones puras de armado si hay), `app/w/[workspaceSlug]/tienda/{page.tsx,[productSlug]/page.tsx,carrito/page.tsx,layout.tsx}`, `components/store/{product-card.tsx,product-grid.tsx,product-gallery.tsx,variant-picker.tsx,size-chart-dialog.tsx,add-to-cart.tsx,cart-provider.tsx,cart-view.tsx,cart-badge.tsx,price.tsx}`
- Antes de escribir rutas: leer `node_modules/next/dist/docs/` (App Router: `params` como Promise, metadata) y copiar la forma de `app/w/[workspaceSlug]/reservas/page.tsx` y `socios/[portfolioSlug]/page.tsx`.

**Interfaces:**
- Consumes: `availableQty`, `effectiveUnitPriceMinor` (Task 2), carrito (Task 5).
- Produces (`lib/store/repository.ts`):
  - `loadOpenStore(workspaceSlug): Promise<{ workspace: { id; slug; name }; settings: StoreSettingsRow } | null>` — null si el módulo está apagado o `isOpen` es false (la página responde `notFound()`).
  - `reservedQtyByKey(workspaceId, db = prisma): Promise<Map<string, number>>` — suma `qty` de `StoreOrderItem` de pedidos `PENDING_PAYMENT` con `holdExpiresAt > now()`, clave `lineKey`.
  - `listStoreProducts(workspaceId, { categoryId? }): Promise<StoreProductCard[]>` con `StoreProductCard = { productId; slug; title; imageUrl: string | null; fromPriceMinor: number; soldOut: boolean; categoryName: string | null }` — sólo `isActive`, `sellOnline`; orden `sortOrder`, luego nombre.
  - `getStoreProduct(workspaceId, slug): Promise<StoreProductDetail | null>` con galería, descripción, `sizeChartImageUrl`, `maxPerOrder` y `variants: { id; name; priceMinor; available: number | null }[]` (o `available` del producto si no tiene variantes).
  - `validateCartLines(workspaceId, lines): Promise<{ lines: ValidatedLine[]; problems: { key: string; message: string }[] }>` — revalida precio, existencia, canal y disponibilidad (sin bloquear); la usa el carrito y el checkout.
- UI: estética del sitio público existente (tokens `--site-*` del layout de `/w`). Vitrina en grilla responsiva con filtro de categorías; ficha con galería, selector de talle (deshabilita los agotados), botón "Ver tabla de talles", cantidad acotada a disponible/`maxPerOrder`, "Agregar al carrito"; ícono de carrito con contador en el encabezado de la tienda; carrito con edición de cantidades, avisos de `problems`, total y "Finalizar compra". JSON-LD `Product` en la ficha (portar `apps/clickaton/lib/public-store/product-json-ld.ts`).
- [ ] Pruebas puras donde haya lógica (armado de `StoreProductCard`, `fromPriceMinor` = mínimo entre variantes activas); verificación manual con `next dev --webpack` en el worktree contra una base de prueba.
- [ ] **Commit** — `"Tienda: vitrina, ficha y carrito públicos"`

---

### Task 8: Crear pedido con reserva y abrir el pago

**Files:**
- Create: `lib/store/stock-lock.ts`, `lib/store/create-order.ts` (+test), `lib/store/payment.ts` (+test de la parte pura), `app/w/[workspaceSlug]/tienda/checkout/{page.tsx,actions.ts,checkout-form.tsx}`

**Interfaces:**
- Consumes: `parseCheckoutInput` (Task 5), `validateCartLines`, `reservedQtyByKey` (Task 7), token (Task 2).
- Produces:
  - `lockStockRows(tx, { productIds: string[]; variantIds: string[] }): Promise<void>` — `SELECT id FROM "Product" WHERE id = ANY($1) FOR UPDATE` y lo mismo en `ProductVariant`, siempre en orden de id (evita interbloqueos). Usar `tx.$queryRaw` con `Prisma.sql` y arrays de texto (`::text[]`).
  - `createStoreOrder(input: { workspaceId; memberId: string | null; checkout: CheckoutInput; now?: Date }): Promise<{ ok: true; orderId; publicId; accessToken } | { ok: false; error: string; problems?: { key; message }[] }>`:
    1. Si existe pedido con `(workspaceId, clientIdempotencyKey)` → devolverlo (con token nuevo y `accessTokenHash` actualizado si sigue `PENDING_PAYMENT`; si ya no está pendiente, error "Ese pedido ya se procesó.").
    2. Contar pendientes vigentes del email ≥ 3 → error "Tenés varios pedidos esperando el pago. Terminá uno o esperá unos minutos.".
    3. `prisma.$transaction(async tx => …, { isolationLevel: "ReadCommitted" })`: `lockStockRows`, recalcular reservado dentro de tx (`reservedQtyByKey(workspaceId, tx)`), verificar cada línea con `availableQty` (insuficiente → abortar con `problems`), número de pedido con `createMany skipDuplicates` + relectura (mismo patrón que `recordSale`), crear `StoreOrder` (`holdExpiresAt = now + 15 min`, `legalAcceptedAt = now`, `legalVersion = STORE_LEGAL_VERSION`, montos congelados) + `StoreOrderItem` + `StoreOrderEvent(null → PENDING_PAYMENT)`.
  - `startStoreCheckout({ workspaceId; orderId; returnPath }): Promise<{ ok: true; checkoutUrl } | { ok: false; error }>` — copia de `startBookingCheckout` (`lib/bookings/checkout.ts`) con: `getPlatformFeeBps(workspaceId, STORE_MODULE_KEY)`, `feeForBooking` para el reparto (mismo criterio: comisión propia + deuda), congela `feeBps/feeArs`, `externalReference: storeExternalReference(id)`, `notificationUrl: ${base}/api/payments/mp/tienda-webhook`, `description: "Compra en <institución> — pedido #<n>"`, `itemId: "pedido-" + id`, `metadata: { storeOrderId, workspaceId }`.
  - Server action `placeOrderAction(workspaceSlug, raw)`: `loadOpenStore` → `parseCheckoutInput` → si hay sesión de socio, `memberId` → `createStoreOrder` → setea cookie httpOnly `fo_ped_<publicId>=<token>` (30 días, path `/w/<slug>/tienda`) → `startStoreCheckout` → `redirect(checkoutUrl)`.
- Pruebas (`create-order.test.ts`, con el doble de `tx` del estilo de `record-sale.test.ts`): disponible 1 y se piden 2 → error con `problems`; idempotencia devuelve el mismo `orderId`; cuarto pendiente del mismo email → error; montos con variante de precio propio. **Prueba de concurrencia real** (marcada `describe.skipIf(!process.env.STORE_DB_TEST_URL)`): dos `createStoreOrder` simultáneos por la última unidad contra una rama Neon de prueba → exactamente uno `ok`.
- UI: formulario con nombre, email, teléfono, bloque "Retiro en <dirección> — <horarios>", casilla "Acepto los términos y la política de cambios y devoluciones" con enlace, resumen del carrito revalidado, botón "Pagar con Mercado Pago". El `clientIdempotencyKey` se genera una vez por carrito (`crypto.randomUUID()`) y se guarda junto al carrito.
- [ ] **Commit** — `"Tienda: pedido con reserva de stock y pago con Mercado Pago"`

---

### Task 9: Acreditación, webhook, página del pedido y cron

**Files:**
- Create: `lib/store/credit-payment.ts` (+test), `lib/store/expire.ts` (+test), `app/api/payments/mp/tienda-webhook/route.ts`, `app/api/cron/tienda/route.ts`, `app/w/[workspaceSlug]/tienda/pedido/[publicId]/page.tsx`
- Modify: `vercel.json` (`{ "path": "/api/cron/tienda", "schedule": "*/15 * * * *" }`)

**Interfaces:**
- Produces:
  - `creditStorePayment({ orderId; providerPaymentId; paidAt?: Date }): Promise<{ applied: boolean; status: StoreOrderStatus | null; motivo?: string }>` — idempotente:
    - `PAID | READY | DELIVERED | PAID_NO_STOCK` con el mismo `mpPaymentId` → `{ applied: false, motivo: "aviso repetido" }`.
    - `PENDING_PAYMENT | EXPIRED | CANCELLED`: en `$transaction`: `lockStockRows`; reservado calculado **excluyendo este pedido**; si alcanza para todas las líneas (y el estado no es `CANCELLED`) → `PAID`, `paidAt`, `mpPaymentId`, `holdExpiresAt: null`; `recordSale(tx, { workspaceId, createdByUserId: null, occurredAt: paidAt, paymentMethod: "MERCADO_PAGO", discountMinor: 0, note: "Pedido online #<n>", client: { mode: "new", firstName: buyerName, lastName: null, phone, email }, lines })` con `lines` armadas desde `StoreOrderItem` (`description = productName + (variantName ? " — " + variantName : "")`, `unitCostMinor` del producto actual, `variantId`); guardar `saleId` y `clientId` de la venta; asiento de deuda con `recordDischarge` igual que `creditBookingPayment`. Si no alcanza o estaba `CANCELLED` → `PAID_NO_STOCK` sin `Sale` (la plata está, el stock no).
    - Siempre `StoreOrderEvent`. Después de la tx (fuera): correo al comprador (`PAID`) o a la institución (`PAID_NO_STOCK` y pedido nuevo), con `lib/store/emails.ts` (Task 10; hasta entonces, una función vacía exportada desde `emails.ts` con la firma final).
  - Webhook: copia estructural de `reservas-webhook/route.ts`: ya acreditado por `mpPaymentId` → 200; candidatos = workspaces con pedidos `PENDING_PAYMENT` o `EXPIRED` de las últimas 48 h (`distinct workspaceId`, máx 20); por cada uno `resolveWorkspaceCollector` → `getPayment`; `parseStoreExternalReference` (si es null → "no es de la tienda"); verificar que el pedido sea de ese workspace; sólo `approved` acredita.
  - `reconcilePendingOrders({ now?: Date; limit?: number = 100 }): Promise<{ checked; credited; expired }>` en `expire.ts`: pedidos `PENDING_PAYMENT` con `holdExpiresAt < now`; por pedido, buscar el pago en Mercado Pago por referencia externa (`adapter.searchPayments`/el método que exponga el adaptador; si no existe búsqueda por referencia, usar el `mpPaymentId` cuando lo haya y si no expirar); aprobado → `creditStorePayment`; si no → `EXPIRED` con evento. Además: pedidos `EXPIRED` de las últimas 48 h sin `mpPaymentId` se re-consultan una vez por corrida (pago tardío que el aviso no trajo).
  - Cron: patrón exacto de `reservas-vencimientos/route.ts` llamando `reconcilePendingOrders`.
  - Página del pedido: acceso por cookie `fo_ped_<publicId>` o `?t=<token>` (si viene por query y es válido, setear la cookie y redirigir sin `?t`). Muestra número, estado legible, renglones, total, datos de retiro, y según `?pago=`: "Estamos confirmando tu pago…" (si sigue pendiente, consulta una vez a Mercado Pago con el `mpPaymentId` del query `payment_id` si viene, vía `creditStorePayment` tras verificar `approved`). Si el pedido está `PENDING_PAYMENT` vigente, botón "Volver a pagar" (`startStoreCheckout`). Vacía el carrito del navegador cuando el pedido está pagado.
- Pruebas (`credit-payment.test.ts`): pendiente con stock → `PAID` + `recordSale` llamado una vez con `paymentMethod: "MERCADO_PAGO"`; repetido → no vuelve a llamar; vencido con stock → `PAID`; vencido sin stock → `PAID_NO_STOCK` y sin `recordSale`; cancelado → `PAID_NO_STOCK`. `expire.test.ts`: vencido sin pago → `EXPIRED`; vencido con pago aprobado → acredita.
- Invariante (en `lib/store/invariants.test.ts`, leyendo fuentes como `lib/workspace-role-consistency.test.ts`): ningún archivo de `lib/store` hace `sale.create`/`sale.createMany`; el webhook de la tienda no menciona `membershipPayment` ni `booking`.
- [ ] **Commit** — `"Tienda: acreditación, webhook, página del pedido y conciliación"`

---

### Task 10: Panel de pedidos y correos

**Files:**
- Create: `lib/store/order-admin.ts` (+test), `lib/store/emails.ts` (+test de textos), `app/(shell)/ventas/tienda/{page.tsx,[orderId]/page.tsx,[orderId]/actions.ts,[orderId]/order-actions.tsx}`

**Interfaces:**
- Produces:
  - `changeOrderStatus({ workspaceId; orderId; to: StoreOrderStatus; userId: number; note: string | null }): Promise<{ ok: true } | { ok: false; error: string }>` — valida `canTransition(from, to, "staff")`; `READY` setea `readyAt` y manda "listo para retirar"; `DELIVERED` setea `deliveredAt`; `CANCELLED` desde `PAID`/`READY` exige nota y llama `voidSale(tx, { workspaceId, saleId, reason: "Pedido online #<n> cancelado: " + nota, userId })` (si falla, aborta); desde `PENDING_PAYMENT` sólo libera (estado); `PAID_NO_STOCK → PAID` corre la misma rama de creación de venta que `creditStorePayment` (extraer `finalizePaidOrder(tx, order, paidAt)` compartida en `credit-payment.ts` y usarla en ambos) y falla con "Todavía no hay stock suficiente." si no alcanza. Siempre `StoreOrderEvent` con `actorUserId`.
  - `emails.ts`: `sendOrderPaidEmail(order)`, `sendOrderReadyEmail(order)`, `sendNewOrderNotice(order)`, `sendPaidNoStockAlert(order)` — cada una arma `{ subject, html, text }` con funciones puras `renderOrderPaid(data)` etc. (probadas: contienen número de pedido, total formateado con `formatMinorArs`, dirección de retiro y el enlace `appUrl()/w/<slug>/tienda/pedido/<publicId>?t=<token>` — por eso el token se pasa como argumento en el momento de crear el pedido y en el correo de pagado se usa un token nuevo regenerado en ese momento) y envían con `sendAndLogEmail({ to, templateKey: "store.order_paid" | "store.order_ready" | "store.new_order" | "store.paid_no_stock", body })`. Los fallos de envío no rompen nada (ya lo garantiza `sendAndLogEmail`).
- UI: lista con pestañas por estado (Por preparar = PAID, Listos, Entregados, Esperando pago, Problemas = PAID_NO_STOCK con contador rojo, Todos), columnas número, fecha (hora argentina), comprador, total, estado. Detalle con renglones, comprador (enlace a la ficha de cliente si hay `clientId`), venta asociada (enlace a historial), historial de eventos y botones según `canTransition`. Permiso: `requireStoreOperator`.
- [ ] **Commit** — `"Tienda: panel de pedidos y correos"`

---

### Task 11: Arrepentimiento, términos y cierre

**Files:**
- Create: `app/w/[workspaceSlug]/tienda/arrepentimiento/{page.tsx,actions.ts}`, `app/w/[workspaceSlug]/tienda/terminos/page.tsx`, `lib/store/regret.ts` (+test)
- Modify: pie de la tienda (`app/w/[workspaceSlug]/tienda/layout.tsx`) con enlaces visibles "Botón de arrepentimiento" y "Términos y devoluciones"

**Interfaces:**
- Produces:
  - Formulario de arrepentimiento: número de pedido + email. `submitRegret({ workspaceId; orderNumber; email; reason? })`: si el pedido existe y el email coincide (sin revelar cuál falla: mismo mensaje en ambos casos), registra `StoreOrderEvent` con nota "Arrepentimiento solicitado" (sin cambiar estado), manda aviso a `notifyEmail` y responde con un código de trámite = `publicId` en mayúsculas. Sin sesión. Límite simple: 5 intentos por IP cada 15 min (en memoria, como Clickatón).
  - Términos: datos de la institución (nombre, dirección de retiro), `returnsPolicy ?? DEFAULT_RETURNS_POLICY`, medios de pago, versión `STORE_LEGAL_VERSION`.
- [ ] Pruebas de `regret.ts` (email distinto → mismo mensaje genérico; pedido de otro workspace → mismo mensaje).
- [ ] **Verificación final:** `pnpm --filter fotoffice exec vitest run` (todo verde) y `pnpm --filter fotoffice build` (tipos + compilación). Recorrido manual con `next dev --webpack`: crear producto con 3 talles y 2 fotos → abrir tienda → comprar con el proveedor de prueba → ver pedido pagado en el panel, venta en Historial y movimiento en Caja → marcar listo → entregado.
- [ ] **Commit** — `"Tienda: botón de arrepentimiento y términos"`; abrir PR contra `main` con la lista de pasos para aplicar la migración antes del deploy.
