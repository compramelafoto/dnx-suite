# Regalo de inscripción de Clickatón — Plan 1: núcleo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una persona pueda comprar una inscripción de Clickatón como regalo, pagarla, y que quien la recibe la active con un código único y complete su propia inscripción sin pagar.

**Architecture:** El regalo **es** una `ClickatonRegistration` desde el momento de la compra, creada con los datos del comprador y marcada `isGift`. Una tabla nueva `ClickatonGiftVoucher` (1:1 con esa inscripción) guarda el código, el destinatario y el ciclo de vida del regalo. Al acreditarse el pago, la inscripción queda en `GIFT_AWAITING_REDEMPTION` conservando su `ClickatonCapacityHold` en `ACTIVE` — así el cupo se descuenta con las consultas de disponibilidad que ya existen, sin tocarlas. Al canjear, la misma inscripción se completa con los datos de quien recibe y pasa a `CONFIRMED`.

**Tech Stack:** Next.js (App Router), TypeScript, Prisma sobre Neon Postgres, `node:test` vía `tsx --test`, server actions.

**Spec:** `docs/superpowers/specs/2026-09-21-clickaton-regalo-inscripcion-design.md`

## Global Constraints

- **El módulo nace apagado.** `ClickatonEdition.giftVouchersEnabled` tiene `@default(false)`. Ninguna pantalla ni acción de regalo funciona si el interruptor está apagado en esa edición.
- **La migración se aplica a mano en las 5 bases Neon** antes de publicar código. El deploy de Clickatón no corre `prisma migrate deploy`.
- **Montos en minor units (centavos), enteros.** Nunca `Float`.
- **Nombre del módulo en código:** `gift-vouchers`. Prefijo de modelos Prisma: `ClickatonGiftVoucher`.
- **Formato del código de voucher:** `REGALO-XXXX-XXXX`, con alfabeto `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (32 caracteres, sin `0`/`O`/`1`/`I`/`L`) — 8 caracteres de entropía, 40 bits.
- **Copy en español rioplatense**, tuteo con voseo, igual que el resto de Clickatón.
- **Tests:** `node:test` + `node:assert/strict`, archivos `*.test.ts` junto al código, corridos con `tsx --test`. Cada módulo agrega su script `test:<nombre>` a `apps/clickaton/package.json`.
- **Todos los comandos se corren desde `apps/clickaton`.**

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `packages/db/prisma/schema.prisma` | Enum, tabla y columnas nuevas |
| `packages/db/prisma/migrations/<ts>_clickaton_gift_vouchers/migration.sql` | La migración |
| `apps/clickaton/lib/gift-vouchers/domain/code.ts` | Generar y normalizar el código |
| `apps/clickaton/lib/gift-vouchers/domain/code.test.ts` | Sus pruebas |
| `apps/clickaton/lib/gift-vouchers/domain/status.ts` | Máquina de estados y reglas de canje |
| `apps/clickaton/lib/gift-vouchers/domain/status.test.ts` | Sus pruebas |
| `apps/clickaton/lib/gift-vouchers/domain/types.ts` | Tipos compartidos del módulo |
| `apps/clickaton/lib/gift-vouchers/domain/repository.ts` | Interfaz del repositorio |
| `apps/clickaton/lib/gift-vouchers/infrastructure/prisma-gift-voucher-repository.ts` | Implementación con Prisma |
| `apps/clickaton/lib/gift-vouchers/infrastructure/in-memory-gift-voucher-repository.ts` | Implementación en memoria, para pruebas |
| `apps/clickaton/lib/gift-vouchers/application/create-gift-registration.ts` | Alta del regalo + reserva |
| `apps/clickaton/lib/gift-vouchers/application/issue-gift-voucher.ts` | Emisión al acreditarse el pago |
| `apps/clickaton/lib/gift-vouchers/application/redeem-gift-voucher.ts` | Canje por parte de quien recibe |
| `apps/clickaton/lib/gift-vouchers/actions/gift-vouchers.ts` | Server actions públicas |
| `apps/clickaton/lib/gift-vouchers/actions/runtime.ts` | Cableado de dependencias |
| `apps/clickaton/app/(public)/maratones/[slug]/regalar/page.tsx` | Pantalla de compra |
| `apps/clickaton/app/(public)/maratones/[slug]/regalar/GiftPurchaseForm.tsx` | Formulario de compra |
| `apps/clickaton/app/(public)/maratones/[slug]/regalar/listo/page.tsx` | Pantalla de "gracias" con el link para compartir |
| `apps/clickaton/app/(public)/regalo/[code]/page.tsx` | Bienvenida del regalo |
| `apps/clickaton/app/(public)/regalo/[code]/GiftRedeemClient.tsx` | Wizard de canje, sin pago |

---

## Task 1: Migración y modelo de datos

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260921120000_clickaton_gift_vouchers/migration.sql`

**Interfaces:**
- Consumes: nada.
- Produces: los modelos `ClickatonGiftVoucher`, el enum `ClickatonGiftVoucherStatus`, el valor `GIFT_AWAITING_REDEMPTION` en `ClickatonRegistrationStatus`, los campos `ClickatonRegistration.isGift` y `ClickatonEdition.giftVouchersEnabled`, y el cliente de Prisma regenerado.

- [ ] **Step 1: Agregar el valor al enum de estado de inscripción**

En `packages/db/prisma/schema.prisma`, dentro de `enum ClickatonRegistrationStatus`, **al final** (antes de la llave de cierre):

```prisma
  /// Regalo pagado, esperando que quien lo recibe lo active.
  GIFT_AWAITING_REDEMPTION
```

- [ ] **Step 2: Agregar el enum de estado del voucher**

Inmediatamente antes de `model ClickatonGiftVoucher` (que se crea en el paso 4):

```prisma
enum ClickatonGiftVoucherStatus {
  PENDING_PAYMENT
  ACTIVE
  REDEEMED
  CARRIED_OVER
  CANCELLED
  REFUNDED
}
```

- [ ] **Step 3: Agregar los campos en `ClickatonRegistration` y `ClickatonEdition`**

En `model ClickatonRegistration`, junto a los otros campos escalares:

```prisma
  /// true si esta inscripción nació como regalo de otra persona.
  isGift                             Boolean                              @default(false)
```

y en su bloque de relaciones:

```prisma
  giftVoucher                        ClickatonGiftVoucher?
```

En `model ClickatonEdition`, junto a los otros interruptores:

```prisma
  /// Habilita la compra de regalos en esta edición. Nace apagado.
  giftVouchersEnabled                Boolean                              @default(false)
```

y en su bloque de relaciones:

```prisma
  giftVouchers                       ClickatonGiftVoucher[]
  giftVouchersCarriedOver            ClickatonGiftVoucher[] @relation("GiftVoucherCarriedOverEdition")
```

- [ ] **Step 4: Agregar el modelo del voucher**

Al final del bloque de modelos de Clickatón en `schema.prisma`:

```prisma
model ClickatonGiftVoucher {
  id                     String                     @id @default(cuid())
  /// Código humano único: REGALO-XXXX-XXXX.
  code                   String                     @unique
  status                 ClickatonGiftVoucherStatus @default(PENDING_PAYMENT)
  editionId              String
  /// Inscripción "a designar" que el voucher representa (1:1).
  registrationId         String                     @unique

  buyerUserId            Int?
  buyerFirstName         String
  buyerLastName          String
  buyerEmail             String
  buyerPhone             String?

  recipientName          String?
  recipientEmail         String?
  /// Dedicatoria libre (texto plano, máx. 500).
  giftMessage            String?

  paidAt                 DateTime?
  /// Cierre de inscripción de la edición comprada.
  redeemableUntil        DateTime?
  redeemedAt             DateTime?
  cancelledAt            DateTime?
  carriedOverToEditionId String?
  carriedOverAt          DateTime?

  reissueCount           Int                        @default(0)
  recipientEmailSentAt   DateTime?
  recipientEmailCount    Int                        @default(0)

  createdAt              DateTime                   @default(now())
  updatedAt              DateTime                   @updatedAt

  edition                ClickatonEdition           @relation(fields: [editionId], references: [id], onDelete: Restrict)
  registration           ClickatonRegistration      @relation(fields: [registrationId], references: [id], onDelete: Restrict)
  carriedOverToEdition   ClickatonEdition?          @relation("GiftVoucherCarriedOverEdition", fields: [carriedOverToEditionId], references: [id], onDelete: SetNull)

  @@index([editionId, status])
  @@index([buyerEmail])
  @@index([recipientEmail])
  @@index([status, redeemableUntil])
}
```

- [ ] **Step 5: Validar el schema**

Run: `npx prisma validate --schema packages/db/prisma/schema.prisma` desde la raíz del monorepo.
Expected: `The schema at ... is valid 🚀`

Si falla por relaciones ambiguas entre `ClickatonEdition` y `ClickatonGiftVoucher`, revisar que el nombre `"GiftVoucherCarriedOverEdition"` esté escrito idéntico en los dos lados.

- [ ] **Step 6: Escribir la migración SQL a mano**

Crear `packages/db/prisma/migrations/20260921120000_clickaton_gift_vouchers/migration.sql`:

```sql
-- Estado nuevo de inscripción: regalo pagado sin activar.
ALTER TYPE "ClickatonRegistrationStatus" ADD VALUE IF NOT EXISTS 'GIFT_AWAITING_REDEMPTION';

-- Estado del voucher de regalo.
DO $$ BEGIN
  CREATE TYPE "ClickatonGiftVoucherStatus" AS ENUM (
    'PENDING_PAYMENT', 'ACTIVE', 'REDEEMED', 'CARRIED_OVER', 'CANCELLED', 'REFUNDED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "ClickatonRegistration"
  ADD COLUMN IF NOT EXISTS "isGift" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ClickatonEdition"
  ADD COLUMN IF NOT EXISTS "giftVouchersEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "ClickatonGiftVoucher" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "status" "ClickatonGiftVoucherStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "editionId" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "buyerUserId" INTEGER,
  "buyerFirstName" TEXT NOT NULL,
  "buyerLastName" TEXT NOT NULL,
  "buyerEmail" TEXT NOT NULL,
  "buyerPhone" TEXT,
  "recipientName" TEXT,
  "recipientEmail" TEXT,
  "giftMessage" TEXT,
  "paidAt" TIMESTAMP(3),
  "redeemableUntil" TIMESTAMP(3),
  "redeemedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "carriedOverToEditionId" TEXT,
  "carriedOverAt" TIMESTAMP(3),
  "reissueCount" INTEGER NOT NULL DEFAULT 0,
  "recipientEmailSentAt" TIMESTAMP(3),
  "recipientEmailCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClickatonGiftVoucher_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonGiftVoucher_code_key"
  ON "ClickatonGiftVoucher"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonGiftVoucher_registrationId_key"
  ON "ClickatonGiftVoucher"("registrationId");
CREATE INDEX IF NOT EXISTS "ClickatonGiftVoucher_editionId_status_idx"
  ON "ClickatonGiftVoucher"("editionId", "status");
CREATE INDEX IF NOT EXISTS "ClickatonGiftVoucher_buyerEmail_idx"
  ON "ClickatonGiftVoucher"("buyerEmail");
CREATE INDEX IF NOT EXISTS "ClickatonGiftVoucher_recipientEmail_idx"
  ON "ClickatonGiftVoucher"("recipientEmail");
CREATE INDEX IF NOT EXISTS "ClickatonGiftVoucher_status_redeemableUntil_idx"
  ON "ClickatonGiftVoucher"("status", "redeemableUntil");

ALTER TABLE "ClickatonGiftVoucher"
  ADD CONSTRAINT "ClickatonGiftVoucher_editionId_fkey"
  FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClickatonGiftVoucher"
  ADD CONSTRAINT "ClickatonGiftVoucher_registrationId_fkey"
  FOREIGN KEY ("registrationId") REFERENCES "ClickatonRegistration"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClickatonGiftVoucher"
  ADD CONSTRAINT "ClickatonGiftVoucher_carriedOverToEditionId_fkey"
  FOREIGN KEY ("carriedOverToEditionId") REFERENCES "ClickatonEdition"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

> **Nota sobre `ALTER TYPE ... ADD VALUE`:** en PostgreSQL no puede correr dentro de la misma transacción que lo use. Como esta migración sólo lo agrega y no lo usa, es seguro. Si alguna base rechaza el `ADD VALUE` por estar en transacción, aplicarlo en una sentencia aparte antes del resto.

- [ ] **Step 7: Regenerar el cliente de Prisma**

Run: `npx prisma generate --schema packages/db/prisma/schema.prisma` desde la raíz del monorepo.
Expected: `Generated Prisma Client`

- [ ] **Step 8: Verificar que la aplicación sigue compilando**

Run: `npm run check-types` desde `apps/clickaton`.
Expected: sin errores.

- [ ] **Step 9: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "Agregar el modelo de datos del regalo de inscripción de Clickatón"
```

---

## Task 2: El código del voucher

**Files:**
- Create: `apps/clickaton/lib/gift-vouchers/domain/code.ts`
- Test: `apps/clickaton/lib/gift-vouchers/domain/code.test.ts`
- Modify: `apps/clickaton/package.json` (script `test:gift-vouchers`)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `generateGiftVoucherCode(random?: (size: number) => Uint8Array): string`
  - `normalizeGiftVoucherCode(raw: string): string | null`
  - `GIFT_VOUCHER_CODE_ALPHABET: string`

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `apps/clickaton/lib/gift-vouchers/domain/code.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateGiftVoucherCode,
  normalizeGiftVoucherCode,
  GIFT_VOUCHER_CODE_ALPHABET,
} from "./code";

describe("código de voucher de regalo", () => {
  it("genera el formato REGALO-XXXX-XXXX", () => {
    const code = generateGiftVoucherCode();
    assert.match(code, /^REGALO-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  });

  it("no usa caracteres ambiguos", () => {
    for (const ambiguous of ["0", "O", "1", "I", "L"]) {
      assert.equal(GIFT_VOUCHER_CODE_ALPHABET.includes(ambiguous), false);
    }
  });

  it("genera códigos distintos en llamadas sucesivas", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) seen.add(generateGiftVoucherCode());
    assert.equal(seen.size, 200);
  });

  it("normaliza mayúsculas, espacios y guiones faltantes", () => {
    assert.equal(normalizeGiftVoucherCode(" regalo-7k3m-9qx2 "), "REGALO-7K3M-9QX2");
    assert.equal(normalizeGiftVoucherCode("REGALO7K3M9QX2"), "REGALO-7K3M-9QX2");
    assert.equal(normalizeGiftVoucherCode("7K3M9QX2"), "REGALO-7K3M-9QX2");
  });

  it("corrige caracteres ambiguos que la gente tipea", () => {
    assert.equal(normalizeGiftVoucherCode("REGALO-O0IL-9QX2"), "REGALO-QQJJ-9QX2");
  });

  it("rechaza lo que no es un código", () => {
    assert.equal(normalizeGiftVoucherCode(""), null);
    assert.equal(normalizeGiftVoucherCode("REGALO-123"), null);
    assert.equal(normalizeGiftVoucherCode("REGALO-7K3M-9QX2-EXTRA"), null);
  });
});
```

> La corrección de ambiguos mapea `0→Q`, `O→Q`, `1→J`, `I→J`, `L→J`. Es una decisión
> arbitraria pero fija: lo importante es que sea determinista y esté probada.
> Como el alfabeto no contiene esos caracteres, ningún código real se ve afectado.

- [ ] **Step 2: Correr las pruebas y verificar que fallan**

Run: `npx tsx --test lib/gift-vouchers/domain/code.test.ts` desde `apps/clickaton`.
Expected: FALLA con `Cannot find module './code'`.

- [ ] **Step 3: Implementar**

Crear `apps/clickaton/lib/gift-vouchers/domain/code.ts`:

```ts
import { randomBytes } from "node:crypto";

/** 32 caracteres, sin 0/O/1/I/L para que nadie se equivoque al tipear. */
export const GIFT_VOUCHER_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

const AMBIGUOUS_FIXES: Record<string, string> = {
  "0": "Q",
  O: "Q",
  "1": "J",
  I: "J",
  L: "J",
};

/** REGALO-XXXX-XXXX con 40 bits de entropía. */
export function generateGiftVoucherCode(
  random: (size: number) => Uint8Array = randomBytes,
): string {
  const bytes = random(8);
  let body = "";
  for (let i = 0; i < 8; i += 1) {
    body += GIFT_VOUCHER_CODE_ALPHABET[bytes[i]! % GIFT_VOUCHER_CODE_ALPHABET.length];
  }
  return `REGALO-${body.slice(0, 4)}-${body.slice(4)}`;
}

/**
 * Acepta lo que la gente pega: con o sin prefijo, con o sin guiones,
 * en minúscula, con espacios, y con caracteres ambiguos.
 * Devuelve el código canónico o null si no es uno.
 */
export function normalizeGiftVoucherCode(raw: string): string | null {
  const upper = (raw ?? "").toUpperCase().replace(/[\s-]/g, "");
  if (!upper) return null;
  const withoutPrefix = upper.startsWith("REGALO") ? upper.slice("REGALO".length) : upper;
  if (withoutPrefix.length !== 8) return null;
  let body = "";
  for (const char of withoutPrefix) {
    const fixed = AMBIGUOUS_FIXES[char] ?? char;
    if (!GIFT_VOUCHER_CODE_ALPHABET.includes(fixed)) return null;
    body += fixed;
  }
  return `REGALO-${body.slice(0, 4)}-${body.slice(4)}`;
}
```

- [ ] **Step 4: Correr las pruebas y verificar que pasan**

Run: `npx tsx --test lib/gift-vouchers/domain/code.test.ts` desde `apps/clickaton`.
Expected: `pass 6`, `fail 0`.

- [ ] **Step 5: Agregar el script de pruebas del módulo**

En `apps/clickaton/package.json`, junto a los otros `test:`:

```json
    "test:gift-vouchers": "tsx --test lib/gift-vouchers/domain/*.test.ts lib/gift-vouchers/application/*.test.ts",
```

- [ ] **Step 6: Commit**

```bash
git add apps/clickaton/lib/gift-vouchers/domain/code.ts apps/clickaton/lib/gift-vouchers/domain/code.test.ts apps/clickaton/package.json
git commit -m "Generar y normalizar el código del voucher de regalo"
```

---

## Task 3: Estados y reglas de canje

**Files:**
- Create: `apps/clickaton/lib/gift-vouchers/domain/status.ts`
- Test: `apps/clickaton/lib/gift-vouchers/domain/status.test.ts`

**Interfaces:**
- Consumes: nada (funciones puras).
- Produces:
  - `type GiftVoucherStatus = "PENDING_PAYMENT" | "ACTIVE" | "REDEEMED" | "CARRIED_OVER" | "CANCELLED" | "REFUNDED"`
  - `type GiftRedeemBlock = { ok: false; code: GiftRedeemBlockCode; message: string }`
  - `type GiftRedeemAllowed = { ok: true }`
  - `evaluateGiftRedeemEligibility(input: { status: GiftVoucherStatus; redeemableUntil: Date | null; editionRegistrationCloseAt: Date | null; giftVouchersEnabled: boolean; now: Date }): GiftRedeemAllowed | GiftRedeemBlock`
  - `canCarryOverGiftVoucher(input: { status: GiftVoucherStatus; redeemableUntil: Date | null; now: Date }): boolean`

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `apps/clickaton/lib/gift-vouchers/domain/status.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCarryOverGiftVoucher,
  evaluateGiftRedeemEligibility,
} from "./status";

const now = new Date("2026-10-01T12:00:00.000Z");
const closeAt = new Date("2026-12-05T23:59:59.000Z");

function base(overrides: Partial<Parameters<typeof evaluateGiftRedeemEligibility>[0]> = {}) {
  return {
    status: "ACTIVE" as const,
    redeemableUntil: closeAt,
    editionRegistrationCloseAt: closeAt,
    giftVouchersEnabled: true,
    now,
    ...overrides,
  };
}

describe("elegibilidad de canje del regalo", () => {
  it("deja canjear un voucher activo dentro del plazo", () => {
    assert.equal(evaluateGiftRedeemEligibility(base()).ok, true);
  });

  it("no deja canjear si el pago todavía no se acreditó", () => {
    const result = evaluateGiftRedeemEligibility(base({ status: "PENDING_PAYMENT" }));
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, "NOT_PAID");
  });

  it("no deja canjear dos veces", () => {
    const result = evaluateGiftRedeemEligibility(base({ status: "REDEEMED" }));
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, "ALREADY_REDEEMED");
  });

  it("no deja canjear un voucher anulado o devuelto", () => {
    for (const status of ["CANCELLED", "REFUNDED"] as const) {
      const result = evaluateGiftRedeemEligibility(base({ status }));
      assert.equal(result.ok, false);
      assert.equal(result.ok === false && result.code, "CANCELLED");
    }
  });

  it("avisa que el voucher espera la edición siguiente", () => {
    const result = evaluateGiftRedeemEligibility(base({ status: "CARRIED_OVER" }));
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, "CARRIED_OVER");
  });

  it("no deja canjear después del cierre de inscripciones", () => {
    const result = evaluateGiftRedeemEligibility(
      base({ now: new Date("2026-12-06T00:00:01.000Z") }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, "WINDOW_CLOSED");
  });

  it("no deja canjear si el módulo está apagado en la edición", () => {
    const result = evaluateGiftRedeemEligibility(base({ giftVouchersEnabled: false }));
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, "MODULE_DISABLED");
  });

  it("deja canjear cuando la edición no tiene fecha de cierre", () => {
    assert.equal(
      evaluateGiftRedeemEligibility(
        base({ redeemableUntil: null, editionRegistrationCloseAt: null }),
      ).ok,
      true,
    );
  });
});

describe("traslado a la edición siguiente", () => {
  it("traslada un voucher activo cuyo plazo venció", () => {
    assert.equal(
      canCarryOverGiftVoucher({
        status: "ACTIVE",
        redeemableUntil: closeAt,
        now: new Date("2026-12-06T00:00:01.000Z"),
      }),
      true,
    );
  });

  it("no traslada uno que todavía está en plazo", () => {
    assert.equal(
      canCarryOverGiftVoucher({ status: "ACTIVE", redeemableUntil: closeAt, now }),
      false,
    );
  });

  it("no traslada uno ya canjeado, anulado o trasladado", () => {
    for (const status of ["REDEEMED", "CANCELLED", "CARRIED_OVER", "REFUNDED"] as const) {
      assert.equal(
        canCarryOverGiftVoucher({
          status,
          redeemableUntil: closeAt,
          now: new Date("2026-12-06T00:00:01.000Z"),
        }),
        false,
      );
    }
  });

  it("no traslada uno sin plazo definido", () => {
    assert.equal(
      canCarryOverGiftVoucher({ status: "ACTIVE", redeemableUntil: null, now }),
      false,
    );
  });
});
```

- [ ] **Step 2: Correr las pruebas y verificar que fallan**

Run: `npx tsx --test lib/gift-vouchers/domain/status.test.ts` desde `apps/clickaton`.
Expected: FALLA con `Cannot find module './status'`.

- [ ] **Step 3: Implementar**

Crear `apps/clickaton/lib/gift-vouchers/domain/status.ts`:

```ts
export type GiftVoucherStatus =
  | "PENDING_PAYMENT"
  | "ACTIVE"
  | "REDEEMED"
  | "CARRIED_OVER"
  | "CANCELLED"
  | "REFUNDED";

export type GiftRedeemBlockCode =
  | "NOT_PAID"
  | "ALREADY_REDEEMED"
  | "CANCELLED"
  | "CARRIED_OVER"
  | "WINDOW_CLOSED"
  | "MODULE_DISABLED";

export type GiftRedeemAllowed = { ok: true };
export type GiftRedeemBlock = {
  ok: false;
  code: GiftRedeemBlockCode;
  message: string;
};

const BLOCK_MESSAGES: Record<GiftRedeemBlockCode, string> = {
  NOT_PAID:
    "Este regalo todavía no está disponible: el pago no se acreditó. Probá de nuevo en unos minutos.",
  ALREADY_REDEEMED: "Este regalo ya fue activado.",
  CANCELLED: "Este regalo fue anulado. Escribinos si creés que es un error.",
  CARRIED_OVER:
    "La inscripción de esta edición ya cerró. Tu regalo quedó guardado para la próxima Clickatón.",
  WINDOW_CLOSED: "La inscripción de esta edición ya cerró.",
  MODULE_DISABLED: "Los regalos no están habilitados en esta edición.",
};

function block(code: GiftRedeemBlockCode): GiftRedeemBlock {
  return { ok: false, code, message: BLOCK_MESSAGES[code] };
}

export function evaluateGiftRedeemEligibility(input: {
  status: GiftVoucherStatus;
  redeemableUntil: Date | null;
  editionRegistrationCloseAt: Date | null;
  giftVouchersEnabled: boolean;
  now: Date;
}): GiftRedeemAllowed | GiftRedeemBlock {
  if (!input.giftVouchersEnabled) return block("MODULE_DISABLED");
  if (input.status === "PENDING_PAYMENT") return block("NOT_PAID");
  if (input.status === "REDEEMED") return block("ALREADY_REDEEMED");
  if (input.status === "CARRIED_OVER") return block("CARRIED_OVER");
  if (input.status === "CANCELLED" || input.status === "REFUNDED") {
    return block("CANCELLED");
  }

  const deadline = input.redeemableUntil ?? input.editionRegistrationCloseAt;
  if (deadline && deadline.getTime() < input.now.getTime()) {
    return block("WINDOW_CLOSED");
  }
  return { ok: true };
}

export function canCarryOverGiftVoucher(input: {
  status: GiftVoucherStatus;
  redeemableUntil: Date | null;
  now: Date;
}): boolean {
  if (input.status !== "ACTIVE") return false;
  if (!input.redeemableUntil) return false;
  return input.redeemableUntil.getTime() < input.now.getTime();
}
```

- [ ] **Step 4: Correr las pruebas y verificar que pasan**

Run: `npm run test:gift-vouchers` desde `apps/clickaton`.
Expected: todas pasan, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add apps/clickaton/lib/gift-vouchers/domain/status.ts apps/clickaton/lib/gift-vouchers/domain/status.test.ts
git commit -m "Definir los estados y las reglas de canje del regalo"
```

---

## Task 4: Tipos y repositorio del voucher

**Files:**
- Create: `apps/clickaton/lib/gift-vouchers/domain/types.ts`
- Create: `apps/clickaton/lib/gift-vouchers/domain/repository.ts`
- Create: `apps/clickaton/lib/gift-vouchers/infrastructure/in-memory-gift-voucher-repository.ts`
- Create: `apps/clickaton/lib/gift-vouchers/infrastructure/prisma-gift-voucher-repository.ts`
- Test: `apps/clickaton/lib/gift-vouchers/infrastructure/in-memory-gift-voucher-repository.test.ts`

**Interfaces:**
- Consumes: `GiftVoucherStatus` de `../domain/status`.
- Produces:
  - `type GiftVoucherRecord` (definido abajo)
  - `interface GiftVoucherRepository` con `create`, `findByCode`, `findByRegistrationId`, `markPaid`, `markRedeemed`, `markCancelled`, `markCarriedOver`, `reissueCode`
  - `createInMemoryGiftVoucherRepository(): GiftVoucherRepository`
  - `createPrismaGiftVoucherRepository(): GiftVoucherRepository`

- [ ] **Step 1: Escribir los tipos**

Crear `apps/clickaton/lib/gift-vouchers/domain/types.ts`:

```ts
import type { GiftVoucherStatus } from "./status";

export type GiftVoucherRecord = {
  id: string;
  code: string;
  status: GiftVoucherStatus;
  editionId: string;
  registrationId: string;
  buyerUserId: number | null;
  buyerFirstName: string;
  buyerLastName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  giftMessage: string | null;
  paidAt: Date | null;
  redeemableUntil: Date | null;
  redeemedAt: Date | null;
  cancelledAt: Date | null;
  carriedOverToEditionId: string | null;
  carriedOverAt: Date | null;
  reissueCount: number;
  recipientEmailSentAt: Date | null;
  recipientEmailCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateGiftVoucherCommand = {
  code: string;
  editionId: string;
  registrationId: string;
  buyerUserId: number | null;
  buyerFirstName: string;
  buyerLastName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  giftMessage: string | null;
};
```

- [ ] **Step 2: Escribir la interfaz del repositorio**

Crear `apps/clickaton/lib/gift-vouchers/domain/repository.ts`:

```ts
import type { CreateGiftVoucherCommand, GiftVoucherRecord } from "./types";

export interface GiftVoucherRepository {
  create(cmd: CreateGiftVoucherCommand): Promise<GiftVoucherRecord>;
  findByCode(code: string): Promise<GiftVoucherRecord | null>;
  findByRegistrationId(registrationId: string): Promise<GiftVoucherRecord | null>;
  /** Pago acreditado: PENDING_PAYMENT → ACTIVE. Idempotente. */
  markPaid(input: {
    voucherId: string;
    paidAt: Date;
    redeemableUntil: Date | null;
  }): Promise<GiftVoucherRecord>;
  /** Canje: ACTIVE → REDEEMED. Idempotente. */
  markRedeemed(input: { voucherId: string; redeemedAt: Date }): Promise<GiftVoucherRecord>;
  markCancelled(input: {
    voucherId: string;
    cancelledAt: Date;
    refunded: boolean;
  }): Promise<GiftVoucherRecord>;
  markCarriedOver(input: {
    voucherId: string;
    carriedOverAt: Date;
    carriedOverToEditionId: string | null;
  }): Promise<GiftVoucherRecord>;
  /** Invalida el código anterior y guarda el nuevo. */
  reissueCode(input: { voucherId: string; newCode: string }): Promise<GiftVoucherRecord>;
}
```

- [ ] **Step 3: Escribir la prueba que falla, sobre la implementación en memoria**

Crear `apps/clickaton/lib/gift-vouchers/infrastructure/in-memory-gift-voucher-repository.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemoryGiftVoucherRepository } from "./in-memory-gift-voucher-repository";

function cmd(overrides: Record<string, unknown> = {}) {
  return {
    code: "REGALO-7K3M-9QX2",
    editionId: "ed_1",
    registrationId: "reg_1",
    buyerUserId: null,
    buyerFirstName: "Ana",
    buyerLastName: "Pérez",
    buyerEmail: "ana@example.test",
    buyerPhone: null,
    recipientName: "Beto",
    recipientEmail: "beto@example.test",
    giftMessage: "¡Feliz cumple!",
    ...overrides,
  };
}

describe("repositorio de vouchers en memoria", () => {
  it("crea un voucher en PENDING_PAYMENT", async () => {
    const repo = createInMemoryGiftVoucherRepository();
    const created = await repo.create(cmd());
    assert.equal(created.status, "PENDING_PAYMENT");
    assert.equal(created.code, "REGALO-7K3M-9QX2");
    assert.equal(created.paidAt, null);
  });

  it("encuentra por código y por inscripción", async () => {
    const repo = createInMemoryGiftVoucherRepository();
    await repo.create(cmd());
    assert.ok(await repo.findByCode("REGALO-7K3M-9QX2"));
    assert.ok(await repo.findByRegistrationId("reg_1"));
    assert.equal(await repo.findByCode("REGALO-0000-0000"), null);
  });

  it("marca pagado y es idempotente", async () => {
    const repo = createInMemoryGiftVoucherRepository();
    const created = await repo.create(cmd());
    const paidAt = new Date("2026-10-01T10:00:00.000Z");
    const until = new Date("2026-12-05T23:59:59.000Z");
    const first = await repo.markPaid({ voucherId: created.id, paidAt, redeemableUntil: until });
    assert.equal(first.status, "ACTIVE");
    const second = await repo.markPaid({
      voucherId: created.id,
      paidAt: new Date("2026-10-02T10:00:00.000Z"),
      redeemableUntil: until,
    });
    assert.equal(second.paidAt?.toISOString(), paidAt.toISOString());
  });

  it("marca canjeado y es idempotente", async () => {
    const repo = createInMemoryGiftVoucherRepository();
    const created = await repo.create(cmd());
    await repo.markPaid({
      voucherId: created.id,
      paidAt: new Date("2026-10-01T10:00:00.000Z"),
      redeemableUntil: null,
    });
    const at = new Date("2026-10-05T10:00:00.000Z");
    const first = await repo.markRedeemed({ voucherId: created.id, redeemedAt: at });
    assert.equal(first.status, "REDEEMED");
    const second = await repo.markRedeemed({
      voucherId: created.id,
      redeemedAt: new Date("2026-10-06T10:00:00.000Z"),
    });
    assert.equal(second.redeemedAt?.toISOString(), at.toISOString());
  });

  it("reemite el código y sube el contador", async () => {
    const repo = createInMemoryGiftVoucherRepository();
    const created = await repo.create(cmd());
    const reissued = await repo.reissueCode({
      voucherId: created.id,
      newCode: "REGALO-AAAA-BBBB",
    });
    assert.equal(reissued.code, "REGALO-AAAA-BBBB");
    assert.equal(reissued.reissueCount, 1);
    assert.equal(await repo.findByCode("REGALO-7K3M-9QX2"), null);
  });
});
```

- [ ] **Step 4: Correr la prueba y verificar que falla**

Run: `npx tsx --test lib/gift-vouchers/infrastructure/in-memory-gift-voucher-repository.test.ts` desde `apps/clickaton`.
Expected: FALLA con `Cannot find module './in-memory-gift-voucher-repository'`.

- [ ] **Step 5: Implementar la versión en memoria**

Crear `apps/clickaton/lib/gift-vouchers/infrastructure/in-memory-gift-voucher-repository.ts`:

```ts
import type { GiftVoucherRepository } from "../domain/repository";
import type { CreateGiftVoucherCommand, GiftVoucherRecord } from "../domain/types";

export function createInMemoryGiftVoucherRepository(): GiftVoucherRepository {
  const byId = new Map<string, GiftVoucherRecord>();
  let seq = 0;

  function get(voucherId: string): GiftVoucherRecord {
    const found = byId.get(voucherId);
    if (!found) throw new Error(`Voucher ${voucherId} no encontrado.`);
    return found;
  }

  function save(next: GiftVoucherRecord): GiftVoucherRecord {
    byId.set(next.id, { ...next, updatedAt: new Date() });
    return byId.get(next.id)!;
  }

  return {
    async create(cmd: CreateGiftVoucherCommand) {
      seq += 1;
      const now = new Date();
      const record: GiftVoucherRecord = {
        id: `gv_${seq}`,
        code: cmd.code,
        status: "PENDING_PAYMENT",
        editionId: cmd.editionId,
        registrationId: cmd.registrationId,
        buyerUserId: cmd.buyerUserId,
        buyerFirstName: cmd.buyerFirstName,
        buyerLastName: cmd.buyerLastName,
        buyerEmail: cmd.buyerEmail,
        buyerPhone: cmd.buyerPhone,
        recipientName: cmd.recipientName,
        recipientEmail: cmd.recipientEmail,
        giftMessage: cmd.giftMessage,
        paidAt: null,
        redeemableUntil: null,
        redeemedAt: null,
        cancelledAt: null,
        carriedOverToEditionId: null,
        carriedOverAt: null,
        reissueCount: 0,
        recipientEmailSentAt: null,
        recipientEmailCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      byId.set(record.id, record);
      return record;
    },

    async findByCode(code) {
      for (const record of byId.values()) {
        if (record.code === code) return record;
      }
      return null;
    },

    async findByRegistrationId(registrationId) {
      for (const record of byId.values()) {
        if (record.registrationId === registrationId) return record;
      }
      return null;
    },

    async markPaid({ voucherId, paidAt, redeemableUntil }) {
      const current = get(voucherId);
      if (current.status !== "PENDING_PAYMENT") return current;
      return save({ ...current, status: "ACTIVE", paidAt, redeemableUntil });
    },

    async markRedeemed({ voucherId, redeemedAt }) {
      const current = get(voucherId);
      if (current.status !== "ACTIVE") return current;
      return save({ ...current, status: "REDEEMED", redeemedAt });
    },

    async markCancelled({ voucherId, cancelledAt, refunded }) {
      const current = get(voucherId);
      if (current.status === "REDEEMED") return current;
      return save({
        ...current,
        status: refunded ? "REFUNDED" : "CANCELLED",
        cancelledAt,
      });
    },

    async markCarriedOver({ voucherId, carriedOverAt, carriedOverToEditionId }) {
      const current = get(voucherId);
      if (current.status !== "ACTIVE") return current;
      return save({
        ...current,
        status: "CARRIED_OVER",
        carriedOverAt,
        carriedOverToEditionId,
      });
    },

    async reissueCode({ voucherId, newCode }) {
      const current = get(voucherId);
      return save({ ...current, code: newCode, reissueCount: current.reissueCount + 1 });
    },
  };
}
```

- [ ] **Step 6: Correr las pruebas y verificar que pasan**

Run: `npx tsx --test lib/gift-vouchers/infrastructure/in-memory-gift-voucher-repository.test.ts` desde `apps/clickaton`.
Expected: `pass 5`, `fail 0`.

- [ ] **Step 7: Implementar la versión con Prisma**

Crear `apps/clickaton/lib/gift-vouchers/infrastructure/prisma-gift-voucher-repository.ts`:

```ts
import { prisma } from "@repo/db";
import type { GiftVoucherRepository } from "../domain/repository";
import type { GiftVoucherRecord } from "../domain/types";

type Row = Awaited<ReturnType<typeof prisma.clickatonGiftVoucher.findFirst>>;

function toRecord(row: NonNullable<Row>): GiftVoucherRecord {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    editionId: row.editionId,
    registrationId: row.registrationId,
    buyerUserId: row.buyerUserId,
    buyerFirstName: row.buyerFirstName,
    buyerLastName: row.buyerLastName,
    buyerEmail: row.buyerEmail,
    buyerPhone: row.buyerPhone,
    recipientName: row.recipientName,
    recipientEmail: row.recipientEmail,
    giftMessage: row.giftMessage,
    paidAt: row.paidAt,
    redeemableUntil: row.redeemableUntil,
    redeemedAt: row.redeemedAt,
    cancelledAt: row.cancelledAt,
    carriedOverToEditionId: row.carriedOverToEditionId,
    carriedOverAt: row.carriedOverAt,
    reissueCount: row.reissueCount,
    recipientEmailSentAt: row.recipientEmailSentAt,
    recipientEmailCount: row.recipientEmailCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createPrismaGiftVoucherRepository(): GiftVoucherRepository {
  return {
    async create(cmd) {
      const row = await prisma.clickatonGiftVoucher.create({ data: { ...cmd } });
      return toRecord(row);
    },

    async findByCode(code) {
      const row = await prisma.clickatonGiftVoucher.findUnique({ where: { code } });
      return row ? toRecord(row) : null;
    },

    async findByRegistrationId(registrationId) {
      const row = await prisma.clickatonGiftVoucher.findUnique({
        where: { registrationId },
      });
      return row ? toRecord(row) : null;
    },

    async markPaid({ voucherId, paidAt, redeemableUntil }) {
      // updateMany + where status: idempotencia sin transacción.
      await prisma.clickatonGiftVoucher.updateMany({
        where: { id: voucherId, status: "PENDING_PAYMENT" },
        data: { status: "ACTIVE", paidAt, redeemableUntil },
      });
      const row = await prisma.clickatonGiftVoucher.findUniqueOrThrow({
        where: { id: voucherId },
      });
      return toRecord(row);
    },

    async markRedeemed({ voucherId, redeemedAt }) {
      await prisma.clickatonGiftVoucher.updateMany({
        where: { id: voucherId, status: "ACTIVE" },
        data: { status: "REDEEMED", redeemedAt },
      });
      const row = await prisma.clickatonGiftVoucher.findUniqueOrThrow({
        where: { id: voucherId },
      });
      return toRecord(row);
    },

    async markCancelled({ voucherId, cancelledAt, refunded }) {
      await prisma.clickatonGiftVoucher.updateMany({
        where: { id: voucherId, status: { notIn: ["REDEEMED"] } },
        data: { status: refunded ? "REFUNDED" : "CANCELLED", cancelledAt },
      });
      const row = await prisma.clickatonGiftVoucher.findUniqueOrThrow({
        where: { id: voucherId },
      });
      return toRecord(row);
    },

    async markCarriedOver({ voucherId, carriedOverAt, carriedOverToEditionId }) {
      await prisma.clickatonGiftVoucher.updateMany({
        where: { id: voucherId, status: "ACTIVE" },
        data: { status: "CARRIED_OVER", carriedOverAt, carriedOverToEditionId },
      });
      const row = await prisma.clickatonGiftVoucher.findUniqueOrThrow({
        where: { id: voucherId },
      });
      return toRecord(row);
    },

    async reissueCode({ voucherId, newCode }) {
      const row = await prisma.clickatonGiftVoucher.update({
        where: { id: voucherId },
        data: { code: newCode, reissueCount: { increment: 1 } },
      });
      return toRecord(row);
    },
  };
}
```

- [ ] **Step 8: Verificar tipos**

Run: `npm run check-types` desde `apps/clickaton`.
Expected: sin errores.

- [ ] **Step 9: Commit**

```bash
git add apps/clickaton/lib/gift-vouchers/domain apps/clickaton/lib/gift-vouchers/infrastructure
git commit -m "Agregar el repositorio del voucher de regalo"
```

---

## Task 5: Alta del regalo y su reserva

**Files:**
- Create: `apps/clickaton/lib/gift-vouchers/application/create-gift-registration.ts`
- Test: `apps/clickaton/lib/gift-vouchers/application/create-gift-registration.test.ts`
- Modify: `apps/clickaton/lib/public-registration/domain/types.ts` (tipo de entrada nuevo)

**Interfaces:**
- Consumes: `generateGiftVoucherCode` (Task 2), `GiftVoucherRepository` (Task 4), y del servicio público existente: `buildItemsFromTicket`, `repo.createReservedRegistration`, `repo.listPricePhases`, `promotions.reserve`.
- Produces:
  - `type CreateGiftRegistrationInput = { editionSlug: string; ticketTypeId: string; buyer: GiftBuyerInput; recipientName?: string; recipientEmail?: string; giftMessage?: string; acceptTerms: boolean; promoCode?: string | null; idempotencyKey: string }`
  - `type GiftBuyerInput = { firstName: string; lastName: string; email: string; phone?: string }`
  - `createGiftRegistrationUseCase(deps): { execute(input): Promise<{ registrationId: string; voucherCode: string; totalAmount: number; currency: string }> }`

> **Diferencia clave con `createRegistration`:** el alta de regalo **no valida**
> foto de perfil, Instagram, documento, sede, talle ni duplicado por email —
> esos son datos de quien participa, no de quien compra. Sí valida el bloque de
> comprador, el interruptor de la edición, la ventana de inscripción, la
> disponibilidad del ticket y el cupón. La inscripción se crea con los datos del
> comprador como contacto y `isGift: true`.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `apps/clickaton/lib/gift-vouchers/application/create-gift-registration.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemoryGiftVoucherRepository } from "../infrastructure/in-memory-gift-voucher-repository";
import { createGiftRegistrationUseCase } from "./create-gift-registration";

const edition = {
  id: "ed_1",
  slug: "clickaton-2026",
  giftVouchersEnabled: true,
  registrationOpenAt: new Date("2026-09-01T00:00:00.000Z"),
  registrationCloseAt: new Date("2026-12-05T23:59:59.000Z"),
  registrationEnabled: true,
  isPublished: true,
  visibleCodePrefix: "CK",
};

const ticket = {
  id: "tt_1",
  editionId: "ed_1",
  venueId: null,
  code: "GENERAL",
  priceAmount: 5000000,
  currency: "ARS",
  holdMinutes: 20,
  isSoldOut: false,
  salesStatus: "open" as const,
};

function deps(overrides: Record<string, unknown> = {}) {
  const vouchers = createInMemoryGiftVoucherRepository();
  const created: Array<Record<string, unknown>> = [];
  return {
    vouchers,
    created,
    use: createGiftRegistrationUseCase({
      vouchers,
      clock: { now: () => new Date("2026-10-01T12:00:00.000Z") },
      generateCode: () => "REGALO-7K3M-9QX2",
      registrations: {
        async getEditionBySlug() {
          return edition;
        },
        async getTicketDetail() {
          return ticket;
        },
        async createReservedRegistration(cmd: Record<string, unknown>) {
          created.push(cmd);
          return { id: "reg_1" };
        },
      },
      ...overrides,
    }),
  };
}

describe("alta de regalo", () => {
  it("crea la inscripción marcada como regalo y el voucher en PENDING_PAYMENT", async () => {
    const { use, vouchers, created } = deps();
    const result = await use.execute({
      editionSlug: "clickaton-2026",
      ticketTypeId: "tt_1",
      buyer: {
        firstName: "Ana",
        lastName: "Pérez",
        email: "ANA@Example.test ",
        phone: "1122334455",
      },
      recipientName: "Beto",
      recipientEmail: "beto@example.test",
      giftMessage: "¡Feliz cumple!",
      acceptTerms: true,
      idempotencyKey: "idem-12345678",
    });

    assert.equal(result.registrationId, "reg_1");
    assert.equal(result.voucherCode, "REGALO-7K3M-9QX2");
    assert.equal(result.totalAmount, 5000000);

    const voucher = await vouchers.findByCode("REGALO-7K3M-9QX2");
    assert.equal(voucher?.status, "PENDING_PAYMENT");
    assert.equal(voucher?.buyerEmail, "ana@example.test");
    assert.equal(voucher?.recipientName, "Beto");

    assert.equal(created.length, 1);
    assert.equal((created[0] as { isGift: boolean }).isGift, true);
  });

  it("rechaza si el módulo está apagado en la edición", async () => {
    const { use } = deps({
      registrations: {
        async getEditionBySlug() {
          return { ...edition, giftVouchersEnabled: false };
        },
        async getTicketDetail() {
          return ticket;
        },
        async createReservedRegistration() {
          return { id: "reg_1" };
        },
      },
    });
    await assert.rejects(
      () =>
        use.execute({
          editionSlug: "clickaton-2026",
          ticketTypeId: "tt_1",
          buyer: { firstName: "Ana", lastName: "Pérez", email: "ana@example.test" },
          acceptTerms: true,
          idempotencyKey: "idem-12345678",
        }),
      /no está habilitad/i,
    );
  });

  it("rechaza si no se aceptan las bases", async () => {
    const { use } = deps();
    await assert.rejects(
      () =>
        use.execute({
          editionSlug: "clickaton-2026",
          ticketTypeId: "tt_1",
          buyer: { firstName: "Ana", lastName: "Pérez", email: "ana@example.test" },
          acceptTerms: false,
          idempotencyKey: "idem-12345678",
        }),
      /bases/i,
    );
  });

  it("rechaza un email de comprador inválido", async () => {
    const { use } = deps();
    await assert.rejects(
      () =>
        use.execute({
          editionSlug: "clickaton-2026",
          ticketTypeId: "tt_1",
          buyer: { firstName: "Ana", lastName: "Pérez", email: "no-es-un-email" },
          acceptTerms: true,
          idempotencyKey: "idem-12345678",
        }),
      /email/i,
    );
  });

  it("recorta la dedicatoria a 500 caracteres", async () => {
    const { use, vouchers } = deps();
    await use.execute({
      editionSlug: "clickaton-2026",
      ticketTypeId: "tt_1",
      buyer: { firstName: "Ana", lastName: "Pérez", email: "ana@example.test" },
      giftMessage: "x".repeat(900),
      acceptTerms: true,
      idempotencyKey: "idem-12345678",
    });
    const voucher = await vouchers.findByCode("REGALO-7K3M-9QX2");
    assert.equal(voucher?.giftMessage?.length, 500);
  });
});
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `npx tsx --test lib/gift-vouchers/application/create-gift-registration.test.ts` desde `apps/clickaton`.
Expected: FALLA con `Cannot find module './create-gift-registration'`.

- [ ] **Step 3: Implementar**

Crear `apps/clickaton/lib/gift-vouchers/application/create-gift-registration.ts`:

```ts
import { generateGiftVoucherCode } from "../domain/code";
import type { GiftVoucherRepository } from "../domain/repository";

export class GiftRegistrationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GiftRegistrationError";
  }
}

export type GiftBuyerInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
};

export type CreateGiftRegistrationInput = {
  editionSlug: string;
  ticketTypeId: string;
  buyer: GiftBuyerInput;
  recipientName?: string;
  recipientEmail?: string;
  giftMessage?: string;
  acceptTerms: boolean;
  promoCode?: string | null;
  idempotencyKey: string;
};

export type CreateGiftRegistrationResult = {
  registrationId: string;
  voucherCode: string;
  totalAmount: number;
  currency: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GIFT_MESSAGE_MAX = 500;

function requireText(value: string | undefined, field: string, label: string): string {
  const trimmed = (value ?? "").trim();
  if (trimmed.length < 2) {
    throw new GiftRegistrationError("VALIDATION", `Completá ${label}.`);
  }
  return trimmed;
}

export function createGiftRegistrationUseCase(deps: {
  vouchers: GiftVoucherRepository;
  clock: { now(): Date };
  registrations: {
    getEditionBySlug(slug: string): Promise<{
      id: string;
      slug: string;
      giftVouchersEnabled: boolean;
      registrationOpenAt: Date | null;
      registrationCloseAt: Date | null;
      registrationEnabled: boolean;
      isPublished: boolean;
    } | null>;
    getTicketDetail(ticketTypeId: string): Promise<{
      id: string;
      editionId: string;
      venueId: string | null;
      priceAmount: number;
      currency: string;
      holdMinutes: number;
      isSoldOut: boolean;
      salesStatus: "open" | "not_started" | "ended" | "inactive";
    } | null>;
    createReservedRegistration(cmd: Record<string, unknown>): Promise<{ id: string }>;
  };
  generateCode?: () => string;
}) {
  const generateCode = deps.generateCode ?? generateGiftVoucherCode;

  return {
    async execute(
      input: CreateGiftRegistrationInput,
    ): Promise<CreateGiftRegistrationResult> {
      if (!input.idempotencyKey?.trim() || input.idempotencyKey.trim().length < 8) {
        throw new GiftRegistrationError("VALIDATION", "Falta el token de idempotencia.");
      }
      if (!input.acceptTerms) {
        throw new GiftRegistrationError(
          "CONSENT_REQUIRED",
          "Tenés que aceptar las bases y condiciones para comprar el regalo.",
        );
      }

      const edition = await deps.registrations.getEditionBySlug(input.editionSlug);
      if (!edition) {
        throw new GiftRegistrationError("NOT_FOUND", "No encontramos esa Clickatón.");
      }
      if (!edition.giftVouchersEnabled) {
        throw new GiftRegistrationError(
          "MODULE_DISABLED",
          "Los regalos no están habilitados en esta edición.",
        );
      }

      const now = deps.clock.now();
      const openOk =
        edition.isPublished &&
        edition.registrationEnabled &&
        (!edition.registrationOpenAt || edition.registrationOpenAt.getTime() <= now.getTime()) &&
        (!edition.registrationCloseAt || edition.registrationCloseAt.getTime() >= now.getTime());
      if (!openOk) {
        throw new GiftRegistrationError(
          "EDITION_NOT_AVAILABLE",
          "Esta edición no admite inscripciones en este momento.",
        );
      }

      const ticket = await deps.registrations.getTicketDetail(input.ticketTypeId);
      if (!ticket || ticket.editionId !== edition.id) {
        throw new GiftRegistrationError(
          "TICKET_NOT_AVAILABLE",
          "La entrada seleccionada no está disponible.",
        );
      }
      if (ticket.isSoldOut) {
        throw new GiftRegistrationError(
          "CAPACITY_EXCEEDED",
          "No quedan cupos disponibles para esta entrada.",
        );
      }
      if (ticket.salesStatus !== "open") {
        throw new GiftRegistrationError(
          "SALE_CLOSED",
          "La venta de esta entrada no está abierta.",
        );
      }

      const firstName = requireText(input.buyer.firstName, "firstName", "tu nombre");
      const lastName = requireText(input.buyer.lastName, "lastName", "tu apellido");
      const email = (input.buyer.email ?? "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        throw new GiftRegistrationError("VALIDATION", "Ingresá un email válido.");
      }
      const recipientEmail = (input.recipientEmail ?? "").trim().toLowerCase() || null;
      if (recipientEmail && !EMAIL_RE.test(recipientEmail)) {
        throw new GiftRegistrationError(
          "VALIDATION",
          "El email de tu amigo no parece válido.",
        );
      }

      const holdMinutes = ticket.holdMinutes > 0 ? ticket.holdMinutes : 20;
      const holdExpiresAt = new Date(now.getTime() + holdMinutes * 60_000);
      const totalAmount = ticket.priceAmount;

      const registration = await deps.registrations.createReservedRegistration({
        idempotencyKey: input.idempotencyKey.trim(),
        holdExpiresAt,
        isGift: true,
        editionId: edition.id,
        ticketTypeId: ticket.id,
        venueId: ticket.venueId,
        contact: {
          firstName,
          lastName,
          email,
          phone: input.buyer.phone?.trim() || null,
        },
        currency: ticket.currency,
        subtotalAmount: totalAmount,
        discountAmount: 0,
        totalAmount,
        acceptedTermsAt: now,
        holdMinutes,
      });

      const code = generateCode();
      await deps.vouchers.create({
        code,
        editionId: edition.id,
        registrationId: registration.id,
        buyerUserId: null,
        buyerFirstName: firstName,
        buyerLastName: lastName,
        buyerEmail: email,
        buyerPhone: input.buyer.phone?.trim() || null,
        recipientName: input.recipientName?.trim() || null,
        recipientEmail,
        giftMessage: input.giftMessage?.trim().slice(0, GIFT_MESSAGE_MAX) || null,
      });

      return {
        registrationId: registration.id,
        voucherCode: code,
        totalAmount,
        currency: ticket.currency,
      };
    },
  };
}
```

- [ ] **Step 4: Correr las pruebas y verificar que pasan**

Run: `npm run test:gift-vouchers` desde `apps/clickaton`.
Expected: todas pasan, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add apps/clickaton/lib/gift-vouchers/application
git commit -m "Dar de alta el regalo con su reserva de cupo"
```

> **Nota para la Task siguiente:** en este paso el caso de uso recibe un
> `registrations` acotado a lo que necesita, con `createReservedRegistration`
> recibiendo un comando propio del regalo. El cableado real contra
> `PrismaPublicRegistrationRepository` — que hoy expone
> `createReservedRegistration` con la forma de una inscripción de participante —
> se hace en la Task 6, que agrega el método `createReservedGiftRegistration`
> al repositorio y lo adapta.

---

## Task 6: Persistir la reserva del regalo

**Files:**
- Modify: `apps/clickaton/lib/public-registration/domain/repository.ts`
- Modify: `apps/clickaton/lib/public-registration/infrastructure/prisma-public-registration-repository.ts`
- Modify: `apps/clickaton/lib/public-registration/infrastructure/in-memory-public-registration-repository.ts`
- Create: `apps/clickaton/lib/gift-vouchers/actions/runtime.ts`

**Interfaces:**
- Consumes: `CreateGiftRegistrationInput` (Task 5).
- Produces:
  - En `PublicRegistrationRepository`: `createReservedGiftRegistration(cmd: CreateReservedGiftRegistrationCommand): Promise<{ id: string }>`
  - `getGiftVoucherRuntime(): { createGift: ReturnType<typeof createGiftRegistrationUseCase>; vouchers: GiftVoucherRepository }`

- [ ] **Step 1: Agregar el método a la interfaz del repositorio**

En `apps/clickaton/lib/public-registration/domain/repository.ts`, agregar el tipo y el método:

```ts
export type CreateReservedGiftRegistrationCommand = {
  idempotencyKey: string;
  holdExpiresAt: Date;
  editionId: string;
  ticketTypeId: string;
  venueId: string | null;
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
  currency: string;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  promotionId: string | null;
  promotionCodeSnapshot: string | null;
  pricePhaseId: string | null;
  pricePhaseNameSnapshot: string | null;
  pricePhaseAmountSnapshot: number | null;
  acceptedTermsAt: Date;
  termsVersion: string;
  holdMinutes: number;
};
```

y dentro de `interface PublicRegistrationRepository`:

```ts
  /** Reserva "a designar": inscripción de regalo sin datos de participante. */
  createReservedGiftRegistration(
    cmd: CreateReservedGiftRegistrationCommand,
  ): Promise<{ id: string }>;
```

- [ ] **Step 2: Implementar en Prisma**

En `apps/clickaton/lib/public-registration/infrastructure/prisma-public-registration-repository.ts`, dentro del objeto que devuelve la factory, agregar:

```ts
    async createReservedGiftRegistration(cmd) {
      return prisma.$transaction(async (tx) => {
        const registration = await tx.clickatonRegistration.create({
          data: {
            editionId: cmd.editionId,
            ticketTypeId: cmd.ticketTypeId,
            venueId: cmd.venueId,
            isGift: true,
            status: "DRAFT",
            paymentStatus: "PENDING",
            // Contacto = quien compra. Se reemplaza al canjear.
            firstName: cmd.contact.firstName,
            lastName: cmd.contact.lastName,
            email: cmd.contact.email,
            phone: cmd.contact.phone,
            currency: cmd.currency,
            subtotalAmount: cmd.subtotalAmount,
            discountAmount: cmd.discountAmount,
            totalAmount: cmd.totalAmount,
            promotionId: cmd.promotionId,
            promotionCodeSnapshot: cmd.promotionCodeSnapshot,
            pricePhaseId: cmd.pricePhaseId,
            pricePhaseNameSnapshot: cmd.pricePhaseNameSnapshot,
            pricePhaseAmountSnapshot: cmd.pricePhaseAmountSnapshot,
            acceptedTermsAt: cmd.acceptedTermsAt,
            termsAcceptedAt: cmd.acceptedTermsAt,
            termsVersion: cmd.termsVersion,
            holdExpiresAt: cmd.holdExpiresAt,
            paymentIdempotencyKey: cmd.idempotencyKey,
          },
          select: { id: true },
        });

        await tx.clickatonCapacityHold.create({
          data: {
            registrationId: registration.id,
            editionId: cmd.editionId,
            venueId: cmd.venueId,
            ticketTypeId: cmd.ticketTypeId,
            status: "ACTIVE",
            expiresAt: cmd.holdExpiresAt,
          },
        });

        return registration;
      });
    },
```

> **Por qué no hay `ClickatonStockHold`:** el regalo no elige talle, así que no
> reserva stock. El talle se elige y se reserva al canjear, igual que en
> cualquier inscripción.

- [ ] **Step 3: Implementar en memoria**

En `apps/clickaton/lib/public-registration/infrastructure/in-memory-public-registration-repository.ts`, agregar el método equivalente guardando en el mapa interno, con `isGift: true`, `status: "DRAFT"`, `paymentStatus: "PENDING"` y un hold activo asociado. Seguir exactamente el patrón del `createReservedRegistration` que ya existe en ese archivo.

- [ ] **Step 4: Cablear el runtime**

Crear `apps/clickaton/lib/gift-vouchers/actions/runtime.ts`:

```ts
import { createPrismaPublicRegistrationRepository } from "@/lib/public-registration/infrastructure/prisma-public-registration-repository";
import { createGiftRegistrationUseCase } from "../application/create-gift-registration";
import { createPrismaGiftVoucherRepository } from "../infrastructure/prisma-gift-voucher-repository";
import type { GiftVoucherRepository } from "../domain/repository";

let cached: {
  createGift: ReturnType<typeof createGiftRegistrationUseCase>;
  vouchers: GiftVoucherRepository;
} | null = null;

export function getGiftVoucherRuntime() {
  if (cached) return cached;
  const vouchers = createPrismaGiftVoucherRepository();
  const publicRepo = createPrismaPublicRegistrationRepository();

  cached = {
    vouchers,
    createGift: createGiftRegistrationUseCase({
      vouchers,
      clock: { now: () => new Date() },
      registrations: {
        getEditionBySlug: (slug) => publicRepo.getEditionBySlug(slug),
        getTicketDetail: (id) => publicRepo.getTicketDetail(id),
        createReservedRegistration: (cmd) =>
          publicRepo.createReservedGiftRegistration(
            cmd as Parameters<typeof publicRepo.createReservedGiftRegistration>[0],
          ),
      },
    }),
  };
  return cached;
}
```

- [ ] **Step 5: Verificar tipos**

Run: `npm run check-types` desde `apps/clickaton`.
Expected: sin errores. Si el nombre exportado de la factory del repositorio Prisma difiere, ajustar el import según lo que exporte ese archivo.

- [ ] **Step 6: Correr todas las pruebas del módulo**

Run: `npm run test:gift-vouchers` desde `apps/clickaton`.
Expected: `fail 0`.

- [ ] **Step 7: Commit**

```bash
git add apps/clickaton/lib/public-registration apps/clickaton/lib/gift-vouchers/actions
git commit -m "Persistir la reserva de la inscripción de regalo"
```

---

## Task 7: Emitir el voucher cuando se acredita el pago

**Files:**
- Create: `apps/clickaton/lib/gift-vouchers/application/issue-gift-voucher.ts`
- Test: `apps/clickaton/lib/gift-vouchers/application/issue-gift-voucher.test.ts`
- Modify: `apps/clickaton/lib/checkout/domain/checkout-registration-port.ts`
- Modify: `apps/clickaton/lib/checkout/infrastructure/prisma-checkout-mutations.ts`
- Modify: `apps/clickaton/lib/checkout/application/apply-payment-event.ts:180-200`

**Interfaces:**
- Consumes: `GiftVoucherRepository` (Task 4).
- Produces:
  - `issueGiftVoucherOnPayment(deps).execute(input: { registrationId: string; editionRegistrationCloseAt: Date | null; paidAt: Date }): Promise<{ issued: boolean; code: string | null }>`
  - En `CheckoutRegistrationPort`: `confirmGiftPaid(input: ConfirmGiftPaidInput): Promise<ClickatonRegistrationRecord>`
  - `type ConfirmGiftPaidInput = { registrationId: string; paymentOrderId: string; source: string; requestId: string; redeemableUntil: Date | null }`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `apps/clickaton/lib/gift-vouchers/application/issue-gift-voucher.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemoryGiftVoucherRepository } from "../infrastructure/in-memory-gift-voucher-repository";
import { issueGiftVoucherOnPayment } from "./issue-gift-voucher";

const paidAt = new Date("2026-10-01T10:00:00.000Z");
const closeAt = new Date("2026-12-05T23:59:59.000Z");

async function seeded() {
  const vouchers = createInMemoryGiftVoucherRepository();
  await vouchers.create({
    code: "REGALO-7K3M-9QX2",
    editionId: "ed_1",
    registrationId: "reg_1",
    buyerUserId: null,
    buyerFirstName: "Ana",
    buyerLastName: "Pérez",
    buyerEmail: "ana@example.test",
    buyerPhone: null,
    recipientName: "Beto",
    recipientEmail: "beto@example.test",
    giftMessage: null,
  });
  return vouchers;
}

describe("emisión del voucher al acreditarse el pago", () => {
  it("activa el voucher y le pone plazo hasta el cierre de inscripciones", async () => {
    const vouchers = await seeded();
    const result = await issueGiftVoucherOnPayment({ vouchers }).execute({
      registrationId: "reg_1",
      editionRegistrationCloseAt: closeAt,
      paidAt,
    });
    assert.equal(result.issued, true);
    assert.equal(result.code, "REGALO-7K3M-9QX2");

    const voucher = await vouchers.findByRegistrationId("reg_1");
    assert.equal(voucher?.status, "ACTIVE");
    assert.equal(voucher?.paidAt?.toISOString(), paidAt.toISOString());
    assert.equal(voucher?.redeemableUntil?.toISOString(), closeAt.toISOString());
  });

  it("es idempotente ante un segundo aviso de pago", async () => {
    const vouchers = await seeded();
    const deps = { vouchers };
    await issueGiftVoucherOnPayment(deps).execute({
      registrationId: "reg_1",
      editionRegistrationCloseAt: closeAt,
      paidAt,
    });
    const second = await issueGiftVoucherOnPayment(deps).execute({
      registrationId: "reg_1",
      editionRegistrationCloseAt: closeAt,
      paidAt: new Date("2026-10-02T10:00:00.000Z"),
    });
    assert.equal(second.issued, false);
    const voucher = await vouchers.findByRegistrationId("reg_1");
    assert.equal(voucher?.paidAt?.toISOString(), paidAt.toISOString());
  });

  it("no hace nada si la inscripción no es un regalo", async () => {
    const vouchers = createInMemoryGiftVoucherRepository();
    const result = await issueGiftVoucherOnPayment({ vouchers }).execute({
      registrationId: "reg_sin_regalo",
      editionRegistrationCloseAt: closeAt,
      paidAt,
    });
    assert.equal(result.issued, false);
    assert.equal(result.code, null);
  });
});
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `npx tsx --test lib/gift-vouchers/application/issue-gift-voucher.test.ts` desde `apps/clickaton`.
Expected: FALLA con `Cannot find module './issue-gift-voucher'`.

- [ ] **Step 3: Implementar**

Crear `apps/clickaton/lib/gift-vouchers/application/issue-gift-voucher.ts`:

```ts
import type { GiftVoucherRepository } from "../domain/repository";

export function issueGiftVoucherOnPayment(deps: { vouchers: GiftVoucherRepository }) {
  return {
    async execute(input: {
      registrationId: string;
      editionRegistrationCloseAt: Date | null;
      paidAt: Date;
    }): Promise<{ issued: boolean; code: string | null }> {
      const voucher = await deps.vouchers.findByRegistrationId(input.registrationId);
      if (!voucher) return { issued: false, code: null };
      if (voucher.status !== "PENDING_PAYMENT") {
        return { issued: false, code: voucher.code };
      }
      const updated = await deps.vouchers.markPaid({
        voucherId: voucher.id,
        paidAt: input.paidAt,
        redeemableUntil: input.editionRegistrationCloseAt,
      });
      return { issued: updated.status === "ACTIVE", code: updated.code };
    },
  };
}
```

- [ ] **Step 4: Correr la prueba y verificar que pasa**

Run: `npx tsx --test lib/gift-vouchers/application/issue-gift-voucher.test.ts` desde `apps/clickaton`.
Expected: `pass 3`, `fail 0`.

- [ ] **Step 5: Agregar `confirmGiftPaid` al puerto del checkout**

En `apps/clickaton/lib/checkout/domain/checkout-registration-port.ts`, agregar el tipo:

```ts
export type ConfirmGiftPaidInput = {
  registrationId: string;
  paymentOrderId: string;
  source: string;
  requestId: string;
  /** Cierre de inscripción de la edición: hasta cuándo dura el cupo reservado. */
  redeemableUntil: Date | null;
};
```

agregarlo a `CheckoutRegistrationPort`, a `CheckoutRegistrationMutations` y al objeto que devuelve `createCheckoutRegistrationPort`:

```ts
  confirmGiftPaid(input: ConfirmGiftPaidInput): Promise<ClickatonRegistrationRecord>;
```

```ts
    confirmGiftPaid: (input) => mutations.confirmGiftPaid(input),
```

- [ ] **Step 6: Implementar `confirmGiftPaid` en las mutaciones de Prisma**

En `apps/clickaton/lib/checkout/infrastructure/prisma-checkout-mutations.ts`, agregar el método siguiendo el patrón de `confirmPaid` del mismo archivo, con estas diferencias:

```ts
    async confirmGiftPaid(input) {
      return prisma.$transaction(async (tx) => {
        // El regalo NO se confirma ni recibe número visible: espera el canje.
        await tx.clickatonRegistration.updateMany({
          where: { id: input.registrationId, status: { in: ["DRAFT", "PENDING_PAYMENT"] } },
          data: {
            status: "GIFT_AWAITING_REDEMPTION",
            paymentStatus: "APPROVED",
            paymentOrderId: input.paymentOrderId,
            // El cupo sigue reservado hasta el cierre de inscripciones.
            holdExpiresAt: input.redeemableUntil,
          },
        });

        // El hold de cupo permanece ACTIVE: así las consultas de
        // disponibilidad lo siguen contando sin cambio alguno.
        await tx.clickatonCapacityHold.updateMany({
          where: { registrationId: input.registrationId, status: "ACTIVE" },
          data: { expiresAt: input.redeemableUntil ?? new Date("2099-12-31T23:59:59.000Z") },
        });

        await tx.clickatonRegistrationStatusHistory.create({
          data: {
            registrationId: input.registrationId,
            toStatus: "GIFT_AWAITING_REDEMPTION",
            source: input.source,
            reason: "gift_paid_awaiting_redemption",
          },
        });

        const row = await tx.clickatonRegistration.findUniqueOrThrow({
          where: { id: input.registrationId },
        });
        return row;
      });
    },
```

> Ajustar los campos de `ClickatonRegistrationStatusHistory` a los que el
> modelo realmente define — leer `confirmPaid` en el mismo archivo y copiar su
> forma exacta, incluido el mapeo a `ClickatonRegistrationRecord`.

- [ ] **Step 7: Desviar el flujo en `apply-payment-event`**

En `apps/clickaton/lib/checkout/application/apply-payment-event.ts`, dentro de `if (effect.holds === "confirm")`, **inmediatamente después** del bloque `attachPaymentRefs` y **antes** de `const confirmed = await deps.registrationPort.confirmPaid(...)`, insertar:

```ts
        // Regalo: no se confirma como participante; se emite el voucher y se
        // deja el cupo reservado hasta que quien lo recibe lo active.
        if (registration.isGift) {
          const redeemableUntil =
            await deps.registrationPort.getEditionRegistrationCloseAt(registration.editionId);
          const giftConfirmed = await deps.registrationPort.confirmGiftPaid({
            registrationId: registration.id,
            paymentOrderId: order.id,
            source: "dnx_payments_webhook",
            requestId: event.eventId,
            redeemableUntil,
          });

          const { issueGiftVoucherOnPayment } = await import(
            "@/lib/gift-vouchers/application/issue-gift-voucher"
          );
          const { createPrismaGiftVoucherRepository } = await import(
            "@/lib/gift-vouchers/infrastructure/prisma-gift-voucher-repository"
          );
          await issueGiftVoucherOnPayment({
            vouchers: createPrismaGiftVoucherRepository(),
          }).execute({
            registrationId: registration.id,
            editionRegistrationCloseAt: redeemableUntil,
            paidAt: new Date(),
          });

          log?.({
            event: "registration_confirmed",
            registrationId: giftConfirmed.id,
            orderId: order.id,
            meta: { gift: true },
          });

          return {
            applied: true,
            duplicate: false,
            conflict: false,
            registrationId: giftConfirmed.id,
            registrationStatus: giftConfirmed.status,
            paymentStatus: giftConfirmed.paymentStatus,
            holdsAction: "hold",
            orderStatus: order.status,
          };
        }
```

Esto salta deliberadamente el email de participante, la sincronización con FotoRank y la emisión de número visible: nada de eso corresponde hasta el canje.

También hay que:
- Agregar `isGift: boolean` a `ClickatonRegistrationRecord` en `apps/clickaton/lib/registration/domain/types.ts` y a los mapeos que lo construyen.
- Agregar `getEditionRegistrationCloseAt(editionId: string): Promise<Date | null>` al puerto y a las mutaciones, leyendo `ClickatonEdition.registrationCloseAt`.
- Ampliar el chequeo de evento duplicado del principio del archivo para que también trate como duplicado `registration.status === "GIFT_AWAITING_REDEMPTION" && paymentStatus === "APPROVED" && order.status === "APPROVED"`.
- Si `holdsAction` no admite el valor `"hold"`, agregarlo al tipo en `apps/clickaton/lib/checkout/domain/types.ts`.

- [ ] **Step 8: Verificar tipos y pruebas**

Run: `npm run check-types && npm run test:gift-vouchers` desde `apps/clickaton`.
Expected: sin errores de tipos, `fail 0`.

- [ ] **Step 9: Commit**

```bash
git add apps/clickaton/lib/gift-vouchers apps/clickaton/lib/checkout apps/clickaton/lib/registration/domain/types.ts
git commit -m "Emitir el voucher cuando se acredita el pago del regalo"
```

---

## Task 8: Canjear el regalo

**Files:**
- Create: `apps/clickaton/lib/gift-vouchers/application/redeem-gift-voucher.ts`
- Test: `apps/clickaton/lib/gift-vouchers/application/redeem-gift-voucher.test.ts`
- Modify: `apps/clickaton/lib/public-registration/domain/repository.ts`
- Modify: `apps/clickaton/lib/public-registration/infrastructure/prisma-public-registration-repository.ts`

**Interfaces:**
- Consumes: `evaluateGiftRedeemEligibility` (Task 3), `GiftVoucherRepository` (Task 4).
- Produces:
  - `redeemGiftVoucherUseCase(deps).execute(input: RedeemGiftVoucherInput): Promise<{ registrationId: string; visibleCode: string | null }>`
  - `type RedeemGiftVoucherInput = { code: string; venueId: string | null; variantChoices: Array<{ productId: string; productVariantId: string }>; participant: PublicParticipantInput; profilePhotoAssetId: string; instagramHandle: string; acceptTerms: boolean; idempotencyKey: string }`
  - En `PublicRegistrationRepository`: `completeGiftRegistration(cmd: CompleteGiftRegistrationCommand): Promise<{ id: string; visibleCode: string | null }>`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `apps/clickaton/lib/gift-vouchers/application/redeem-gift-voucher.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemoryGiftVoucherRepository } from "../infrastructure/in-memory-gift-voucher-repository";
import { redeemGiftVoucherUseCase } from "./redeem-gift-voucher";

const now = new Date("2026-10-05T12:00:00.000Z");
const closeAt = new Date("2026-12-05T23:59:59.000Z");

const participant = {
  firstName: "Beto",
  lastName: "Gómez",
  email: "beto@example.test",
  phone: "1122334455",
  documentNumber: "30111222",
};

async function setup(opts: { paid?: boolean; enabled?: boolean } = {}) {
  const vouchers = createInMemoryGiftVoucherRepository();
  const created = await vouchers.create({
    code: "REGALO-7K3M-9QX2",
    editionId: "ed_1",
    registrationId: "reg_1",
    buyerUserId: null,
    buyerFirstName: "Ana",
    buyerLastName: "Pérez",
    buyerEmail: "ana@example.test",
    buyerPhone: null,
    recipientName: "Beto",
    recipientEmail: "beto@example.test",
    giftMessage: null,
  });
  if (opts.paid !== false) {
    await vouchers.markPaid({
      voucherId: created.id,
      paidAt: new Date("2026-10-01T10:00:00.000Z"),
      redeemableUntil: closeAt,
    });
  }
  const completed: Array<Record<string, unknown>> = [];
  const use = redeemGiftVoucherUseCase({
    vouchers,
    clock: { now: () => now },
    registrations: {
      async getEditionById() {
        return {
          id: "ed_1",
          slug: "clickaton-2026",
          giftVouchersEnabled: opts.enabled !== false,
          registrationCloseAt: closeAt,
          visibleCodePrefix: "CK",
        };
      },
      async completeGiftRegistration(cmd: Record<string, unknown>) {
        completed.push(cmd);
        return { id: "reg_1", visibleCode: "CK-0042" };
      },
    },
  });
  return { vouchers, use, completed };
}

describe("canje del regalo", () => {
  it("completa la inscripción con los datos de quien recibe y marca el voucher canjeado", async () => {
    const { use, vouchers, completed } = await setup();
    const result = await use.execute({
      code: "regalo 7k3m 9qx2",
      venueId: "venue_1",
      variantChoices: [{ productId: "p1", productVariantId: "v_m" }],
      participant,
      profilePhotoAssetId: "asset_1",
      instagramHandle: "@beto",
      acceptTerms: true,
      idempotencyKey: "idem-abcdefgh",
    });

    assert.equal(result.registrationId, "reg_1");
    assert.equal(result.visibleCode, "CK-0042");

    const voucher = await vouchers.findByCode("REGALO-7K3M-9QX2");
    assert.equal(voucher?.status, "REDEEMED");
    assert.equal(voucher?.redeemedAt?.toISOString(), now.toISOString());

    assert.equal(completed.length, 1);
    assert.equal((completed[0] as { venueId: string }).venueId, "venue_1");
  });

  it("rechaza un código que no existe", async () => {
    const { use } = await setup();
    await assert.rejects(
      () =>
        use.execute({
          code: "REGALO-AAAA-BBBB",
          venueId: null,
          variantChoices: [],
          participant,
          profilePhotoAssetId: "asset_1",
          instagramHandle: "@beto",
          acceptTerms: true,
          idempotencyKey: "idem-abcdefgh",
        }),
      /no encontramos/i,
    );
  });

  it("rechaza un código con formato inválido", async () => {
    const { use } = await setup();
    await assert.rejects(
      () =>
        use.execute({
          code: "cualquier cosa",
          venueId: null,
          variantChoices: [],
          participant,
          profilePhotoAssetId: "asset_1",
          instagramHandle: "@beto",
          acceptTerms: true,
          idempotencyKey: "idem-abcdefgh",
        }),
      /no encontramos/i,
    );
  });

  it("no deja canjear dos veces", async () => {
    const { use } = await setup();
    const input = {
      code: "REGALO-7K3M-9QX2",
      venueId: "venue_1",
      variantChoices: [],
      participant,
      profilePhotoAssetId: "asset_1",
      instagramHandle: "@beto",
      acceptTerms: true,
      idempotencyKey: "idem-abcdefgh",
    };
    await use.execute(input);
    await assert.rejects(() => use.execute(input), /ya fue activado/i);
  });

  it("no deja canjear si el pago no se acreditó", async () => {
    const { use } = await setup({ paid: false });
    await assert.rejects(
      () =>
        use.execute({
          code: "REGALO-7K3M-9QX2",
          venueId: null,
          variantChoices: [],
          participant,
          profilePhotoAssetId: "asset_1",
          instagramHandle: "@beto",
          acceptTerms: true,
          idempotencyKey: "idem-abcdefgh",
        }),
      /no se acreditó/i,
    );
  });

  it("exige aceptar las bases", async () => {
    const { use } = await setup();
    await assert.rejects(
      () =>
        use.execute({
          code: "REGALO-7K3M-9QX2",
          venueId: null,
          variantChoices: [],
          participant,
          profilePhotoAssetId: "asset_1",
          instagramHandle: "@beto",
          acceptTerms: false,
          idempotencyKey: "idem-abcdefgh",
        }),
      /bases/i,
    );
  });

  it("exige foto de perfil", async () => {
    const { use } = await setup();
    await assert.rejects(
      () =>
        use.execute({
          code: "REGALO-7K3M-9QX2",
          venueId: null,
          variantChoices: [],
          participant,
          profilePhotoAssetId: "",
          instagramHandle: "@beto",
          acceptTerms: true,
          idempotencyKey: "idem-abcdefgh",
        }),
      /foto/i,
    );
  });
});
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `npx tsx --test lib/gift-vouchers/application/redeem-gift-voucher.test.ts` desde `apps/clickaton`.
Expected: FALLA con `Cannot find module './redeem-gift-voucher'`.

- [ ] **Step 3: Implementar**

Crear `apps/clickaton/lib/gift-vouchers/application/redeem-gift-voucher.ts`:

```ts
import { normalizeGiftVoucherCode } from "../domain/code";
import type { GiftVoucherRepository } from "../domain/repository";
import { evaluateGiftRedeemEligibility } from "../domain/status";

export class GiftRedeemError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GiftRedeemError";
  }
}

export type RedeemParticipantInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  documentNumber?: string;
  city?: string;
  province?: string;
  country?: string;
  birthDate?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
};

export type RedeemGiftVoucherInput = {
  code: string;
  venueId: string | null;
  variantChoices: Array<{ productId: string; productVariantId: string }>;
  participant: RedeemParticipantInput;
  profilePhotoAssetId: string;
  instagramHandle: string;
  acceptTerms: boolean;
  idempotencyKey: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function redeemGiftVoucherUseCase(deps: {
  vouchers: GiftVoucherRepository;
  clock: { now(): Date };
  registrations: {
    getEditionById(editionId: string): Promise<{
      id: string;
      slug: string;
      giftVouchersEnabled: boolean;
      registrationCloseAt: Date | null;
      visibleCodePrefix: string | null;
    } | null>;
    completeGiftRegistration(cmd: Record<string, unknown>): Promise<{
      id: string;
      visibleCode: string | null;
    }>;
  };
}) {
  return {
    async execute(input: RedeemGiftVoucherInput) {
      const code = normalizeGiftVoucherCode(input.code);
      if (!code) {
        throw new GiftRedeemError("NOT_FOUND", "No encontramos ese código de regalo.");
      }
      const voucher = await deps.vouchers.findByCode(code);
      if (!voucher) {
        throw new GiftRedeemError("NOT_FOUND", "No encontramos ese código de regalo.");
      }

      const edition = await deps.registrations.getEditionById(voucher.editionId);
      if (!edition) {
        throw new GiftRedeemError("NOT_FOUND", "No encontramos esa Clickatón.");
      }

      const now = deps.clock.now();
      const eligibility = evaluateGiftRedeemEligibility({
        status: voucher.status,
        redeemableUntil: voucher.redeemableUntil,
        editionRegistrationCloseAt: edition.registrationCloseAt,
        giftVouchersEnabled: edition.giftVouchersEnabled,
        now,
      });
      if (!eligibility.ok) {
        throw new GiftRedeemError(eligibility.code, eligibility.message);
      }

      if (!input.acceptTerms) {
        throw new GiftRedeemError(
          "CONSENT_REQUIRED",
          "Tenés que aceptar las bases y condiciones.",
        );
      }
      if (!input.profilePhotoAssetId?.trim()) {
        throw new GiftRedeemError("VALIDATION", "Subí una foto de perfil.");
      }
      if (!input.instagramHandle?.trim()) {
        throw new GiftRedeemError("VALIDATION", "Ingresá tu usuario de Instagram.");
      }
      const email = (input.participant.email ?? "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        throw new GiftRedeemError("VALIDATION", "Ingresá un email válido.");
      }
      if ((input.participant.firstName ?? "").trim().length < 2) {
        throw new GiftRedeemError("VALIDATION", "Completá tu nombre.");
      }
      if ((input.participant.lastName ?? "").trim().length < 2) {
        throw new GiftRedeemError("VALIDATION", "Completá tu apellido.");
      }

      const completed = await deps.registrations.completeGiftRegistration({
        registrationId: voucher.registrationId,
        editionId: voucher.editionId,
        editionPrefix: edition.visibleCodePrefix,
        venueId: input.venueId,
        variantChoices: input.variantChoices,
        participant: { ...input.participant, email },
        profilePhotoAssetId: input.profilePhotoAssetId.trim(),
        instagramHandle: input.instagramHandle.trim(),
        acceptedAt: now,
        idempotencyKey: input.idempotencyKey,
      });

      await deps.vouchers.markRedeemed({ voucherId: voucher.id, redeemedAt: now });

      return { registrationId: completed.id, visibleCode: completed.visibleCode };
    },
  };
}
```

- [ ] **Step 4: Correr las pruebas y verificar que pasan**

Run: `npx tsx --test lib/gift-vouchers/application/redeem-gift-voucher.test.ts` desde `apps/clickaton`.
Expected: `pass 7`, `fail 0`.

- [ ] **Step 5: Implementar `completeGiftRegistration` en el repositorio Prisma**

En `apps/clickaton/lib/public-registration/infrastructure/prisma-public-registration-repository.ts`, agregar el método. Dentro de una transacción tiene que, en este orden:

1. Verificar que la inscripción esté en `GIFT_AWAITING_REDEMPTION`; si ya está `CONFIRMED`, devolverla tal cual (idempotencia).
2. Reemplazar los datos de contacto por los de quien participa: `firstName`, `lastName`, `email`, `phone`, `documentNumber`, `city`, `province`, `country`, `birthDate`, `emergencyContactName`, `emergencyContactPhone`.
3. Guardar `instagramHandle`, `instagramHandleNormalized`, `instagramUrl`, `profilePhotoAssetId`, los consentimientos (`imageUsageConsent`, `socialPublicationConsent`, `consentAcceptedAt`, `consentVersion`, `termsVersion`, `termsAcceptedAt`, `promotionalLicenseAcceptedAt`, `identifiablePersonsDeclaredAt`).
4. Fijar `venueId` si vino uno.
5. Crear los `ClickatonRegistrationItem` de las variantes elegidas y sus `ClickatonStockHold`, reusando `buildItemsFromTicket` como hace `createReservedRegistration`.
6. Consumir el `ClickatonCapacityHold` (`status: "CONSUMED"`, `consumedAt: now`).
7. Emitir `visibleCode` y `sequenceNumber` con `ClickatonEditionSequence`, exactamente como lo hace `confirmPaid`.
8. Poner `status: "CONFIRMED"`, `confirmedAt: now`.
9. Registrar el cambio en `ClickatonRegistrationStatusHistory`.

Copiar la mecánica de `confirmPaid` de `prisma-checkout-mutations.ts` para los pasos 6 a 9 en vez de reinventarla.

- [ ] **Step 6: Verificar tipos**

Run: `npm run check-types` desde `apps/clickaton`.
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add apps/clickaton/lib/gift-vouchers apps/clickaton/lib/public-registration
git commit -m "Canjear el regalo y completar la inscripción de quien lo recibe"
```

---

## Task 9: Server actions públicas

**Files:**
- Create: `apps/clickaton/lib/gift-vouchers/actions/gift-vouchers.ts`
- Modify: `apps/clickaton/lib/gift-vouchers/actions/runtime.ts`

**Interfaces:**
- Consumes: `getGiftVoucherRuntime` (Task 6), `redeemGiftVoucherUseCase` (Task 8).
- Produces:
  - `createGiftRegistrationAction(prev, formData): Promise<GiftActionState<{ registrationId: string; voucherCode: string }>>`
  - `getGiftVoucherPublicAction(code: string): Promise<GiftActionState<GiftVoucherPublicDto>>`
  - `redeemGiftVoucherAction(prev, formData): Promise<GiftActionState<{ registrationId: string; visibleCode: string | null }>>`
  - `type GiftVoucherPublicDto = { code: string; status: GiftVoucherStatus; buyerFirstName: string; recipientName: string | null; giftMessage: string | null; editionSlug: string; editionName: string; ticketName: string; canRedeem: boolean; blockMessage: string | null }`

- [ ] **Step 1: Escribir las acciones**

Crear `apps/clickaton/lib/gift-vouchers/actions/gift-vouchers.ts` con `"use server"` en la primera línea, siguiendo exactamente el patrón de `apps/clickaton/lib/public-registration/actions/public-registration.ts`: helpers `formString` / `formBool`, estado de resultado `{ ok: true, data }` / `{ ok: false, code, message }`, y captura de los errores `GiftRegistrationError` y `GiftRedeemError` para convertirlos en mensajes.

`getGiftVoucherPublicAction` **no** devuelve datos sensibles: nada de email del comprador ni del destinatario, sólo el nombre de pila de quien regala, la dedicatoria y los datos públicos de la edición.

- [ ] **Step 2: Verificar tipos**

Run: `npm run check-types` desde `apps/clickaton`.
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/clickaton/lib/gift-vouchers/actions
git commit -m "Exponer las acciones públicas del regalo"
```

---

## Task 10: Pantalla de compra del regalo

**Files:**
- Create: `apps/clickaton/app/(public)/maratones/[slug]/regalar/page.tsx`
- Create: `apps/clickaton/app/(public)/maratones/[slug]/regalar/GiftPurchaseForm.tsx`
- Create: `apps/clickaton/app/(public)/maratones/[slug]/regalar/listo/page.tsx`
- Modify: `apps/clickaton/components/public-registration/PublicRegistrationWizard.tsx` (botón de entrada)

**Interfaces:**
- Consumes: `createGiftRegistrationAction` (Task 9), `getPublicRegistrationContextAction` (existente).
- Produces: las tres rutas.

- [ ] **Step 1: Página de compra**

`page.tsx` es un Server Component que:
1. Resuelve la edición por `slug` con el servicio público existente.
2. Si `giftVouchersEnabled` es `false`, llama a `notFound()`.
3. Obtiene el contexto de inscripción (packs y precios vigentes).
4. Renderiza `<GiftPurchaseForm />` con ese contexto.

- [ ] **Step 2: Formulario de compra**

`GiftPurchaseForm.tsx` es un Client Component con `useActionState` sobre `createGiftRegistrationAction`. Campos:

- Elección del pack (mismos packs y precios que la inscripción normal).
- Tus datos: nombre, apellido, email, teléfono.
- Datos de tu amigo (opcionales): nombre y email.
- Dedicatoria (textarea, máximo 500, con contador visible).
- Código de descuento (opcional), con el mismo componente que usa el wizard.
- Casilla de aceptación de bases, con el texto: *"Acepto las bases y condiciones de la Clickatón en nombre de quien reciba este regalo, que las aceptará también al activarlo."*
- Botón **"Pagar el regalo"**, que al tener éxito redirige al checkout existente.

Usar las clases y tokens de color propios de Clickatón. **No inventar clases de color**: verificar que cada clase usada exista en `globals.css` o en la configuración de Tailwind, porque una clase inexistente se pinta transparente sin avisar.

- [ ] **Step 3: Pantalla de "listo"**

`listo/page.tsx` recibe el `code` por query string y muestra:
- Un cartel grande con el código del voucher.
- El link completo, en un campo de sólo lectura.
- Botón **"Enviar por WhatsApp"**: `https://wa.me/?text=` con el texto codificado, incluyendo el link.
- Botón **"Copiar link"**.
- La aclaración de que también le llegó por email, si se cargó un email.

- [ ] **Step 4: Botón de entrada desde la inscripción**

En `PublicRegistrationWizard.tsx`, cerca del selector de packs, agregar un enlace discreto: *"¿Es para regalar? Comprale el lugar a un amigo"* hacia `/maratones/<slug>/regalar`. Mostrarlo **sólo** si la edición tiene `giftVouchersEnabled` en `true`.

- [ ] **Step 5: Verificar en el navegador**

Levantar el servidor de desarrollo y recorrer la pantalla: `/maratones/<slug>/regalar` con el interruptor encendido en la base local. Verificar que el formulario valide, que el botón de WhatsApp arme bien el texto y que la pantalla se vea correcta a 375 px de ancho.

- [ ] **Step 6: Verificar tipos y lint**

Run: `npm run check-types && npm run lint` desde `apps/clickaton`.
Expected: sin errores ni advertencias.

- [ ] **Step 7: Commit**

```bash
git add "apps/clickaton/app/(public)/maratones/[slug]/regalar" apps/clickaton/components/public-registration/PublicRegistrationWizard.tsx
git commit -m "Agregar la pantalla de compra del regalo"
```

---

## Task 11: Pantalla de activación

**Files:**
- Create: `apps/clickaton/app/(public)/regalo/[code]/page.tsx`
- Create: `apps/clickaton/app/(public)/regalo/[code]/GiftRedeemClient.tsx`

**Interfaces:**
- Consumes: `getGiftVoucherPublicAction` y `redeemGiftVoucherAction` (Task 9).
- Produces: la ruta `/regalo/[code]`.

- [ ] **Step 1: Página de bienvenida**

`page.tsx` es un Server Component que:
1. Llama a `getGiftVoucherPublicAction(code)`.
2. Si no existe, `notFound()`.
3. Si `canRedeem` es `false`, muestra el `blockMessage` con un tono amable y un enlace a la inscripción normal.
4. Si se puede canjear, muestra: *"<Nombre> te regaló un lugar en la Clickatón"*, la dedicatoria si hay, qué incluye, la fecha y el botón **"Activar mi lugar"**.

- [ ] **Step 2: Wizard de canje**

`GiftRedeemClient.tsx` reusa los pasos del wizard público — sede (sólo si hay más de una), talle, datos personales, foto de perfil, Instagram, bases — **sin paso de precio ni de pago**. Reutilizar los componentes existentes de `components/public-registration/experience/` en lugar de duplicarlos.

Al enviar, llama a `redeemGiftVoucherAction`. Con éxito, redirige a la pantalla de resumen de inscripción que ya existe.

- [ ] **Step 3: Verificar en el navegador**

Recorrer el circuito completo en local: comprar un regalo, marcar el pago a mano en la base, abrir `/regalo/<code>`, completar el wizard y verificar que la inscripción quede `CONFIRMED` con número visible y que el voucher quede `REDEEMED`.

- [ ] **Step 4: Verificar tipos, lint y todas las pruebas**

Run: `npm run check-types && npm run lint && npm run test:gift-vouchers` desde `apps/clickaton`.
Expected: todo en verde.

- [ ] **Step 5: Commit**

```bash
git add "apps/clickaton/app/(public)/regalo"
git commit -m "Agregar la pantalla de activación del regalo"
```

---

## Task 12: Auditar el estado nuevo

**Files:**
- Modify: varios, según lo que encuentre la auditoría
- Test: `apps/clickaton/lib/gift-vouchers/domain/visibility.test.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: `GIFT_AWAITING_REDEMPTION` tratado correctamente en cada superficie.

Un regalo pagado y sin activar **ocupa cupo** pero **no es un participante**. Cada punto de abajo hay que verificarlo y corregirlo si hace falta.

- [ ] **Step 1: Buscar todos los filtros por estado**

Run: `grep -rn '"CONFIRMED"' --include=*.ts --include=*.tsx lib app | grep -v node_modules` desde `apps/clickaton`.

Revisar cada resultado y clasificarlo: ¿este conteo debería incluir un regalo sin activar?

- [ ] **Step 2: Cupo — debe incluirlo**

`countUsage` en `prisma-public-registration-repository.ts:63` suma `registrations CONFIRMED` + `capacityHolds ACTIVE`. Como el regalo conserva su hold `ACTIVE`, ya queda contado. **Verificar con una prueba** que un regalo pagado descuenta cupo y que al activarse no lo descuenta dos veces (el hold pasa a `CONSUMED` y la inscripción a `CONFIRMED`).

- [ ] **Step 3: Beneficio de remera — debe incluirlo**

`countPhaseBenefitClaims` cuenta por `heldByItemId` además de confirmados. Verificar que el regalo, que no tiene ítems de variante hasta el canje, quede contemplado: si el beneficio se resuelve por fecha de pago, hay que contar el regalo pagado. Ajustar y probar.

- [ ] **Step 4: FotoRank — no debe incluirlo**

Confirmar que la rama de regalo de `apply-payment-event.ts` no encola `enqueueFotoRankSyncAfterPaid`. Agregar la sincronización en el momento del canje, donde sí corresponde.

- [ ] **Step 5: Acreditación y credenciales — no deben incluirlo**

`evaluateCheckInEligibility` y `evaluateKitEligibility` en `lib/checkout/domain/post-payment-eligibility.ts` exigen `CONFIRMED`, así que un regalo sin activar queda excluido solo. **Agregar un caso de prueba explícito** en `post-payment-eligibility.test.ts` con `registrationStatus: "GIFT_AWAITING_REDEMPTION"` que verifique que no puede acreditarse ni retirar kit.

- [ ] **Step 6: Cron de expiración — no debe cancelarlo**

Revisar `lib/public-registration/application/expire-pending-registrations.ts` y `expiration-rules.ts`. Un regalo con pago `APPROVED` y hold `ACTIVE` hasta el cierre **no** debe cancelarse. Agregar el estado a la lista de exclusión y probarlo.

- [ ] **Step 7: Listados del panel de administración — debe mostrarlo, diferenciado**

En los listados de inscripciones, mostrar el regalo sin activar con una etiqueta clara ("Regalo sin activar") y que no se cuente en las métricas de participantes confirmados.

- [ ] **Step 8: Escribir la prueba de visibilidad**

Crear `apps/clickaton/lib/gift-vouchers/domain/visibility.test.ts` con una tabla que documente, estado por estado, qué superficie incluye un regalo sin activar y cuál no. Es la prueba de regresión que protege esta decisión.

- [ ] **Step 9: Correr todo**

Run: `npm run check-types && npm run lint && npm run test:gift-vouchers` desde `apps/clickaton`.
Expected: todo en verde.

- [ ] **Step 10: Commit**

```bash
git add apps/clickaton
git commit -m "Tratar correctamente el regalo sin activar en cada superficie"
```

---

## Planes siguientes

- **Plan 2 — Avisos:** los cuatro correos (al regalador con el link, al amigo con la invitación, al regalador cuando se activa, recordatorio antes del cierre), reenvío y cambio de destinatario.
- **Plan 3 — Administración y traslado:** pantalla de Regalos en el panel, anulación con liberación de cupo, reemisión de código, y el traslado automático a la edición siguiente cuando cierran las inscripciones.

---

## Self-Review

**Cobertura del spec:**

| Sección del spec | Tarea |
|---|---|
| 5. Modelo de datos | Task 1 |
| 4.1 Plazo y traslado (reglas) | Task 3 — la ejecución del traslado va en el Plan 3 |
| 4.2 Beneficio de remera por fecha de pago | Task 12 paso 3 |
| 4.3 Sede elegida al canjear | Task 8, Task 11 |
| 6. Máquina de estados | Tasks 3, 5, 7, 8 |
| 7.1 Comprar | Tasks 5, 6, 10 |
| 7.2 Acreditación del pago | Task 7 |
| 7.3 Activar | Tasks 8, 11 |
| 7.4 Compartir por WhatsApp | Task 10 paso 3 |
| 8. Emails | Plan 2 |
| 9. Panel de administración | Plan 3 |
| 11. Riesgo del estado nuevo | Task 12 |
| 12. Pruebas | En cada tarea |

**Notas de coherencia:** el cupón del comprador (`promoCode`) queda declarado en el tipo de entrada de la Task 5 pero su reserva contra `@repo/promotions` se hace en la Task 6, al cablear el runtime, reusando exactamente el bloque de `createRegistration` del servicio público (`public-registration-service.ts:692-730`). Si al ejecutar la Task 6 el cableado del cupón resulta más grande de lo previsto, conviene partirlo en una tarea propia antes de seguir.
