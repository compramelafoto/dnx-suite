# Finanzas DNX — Etapa 1: carga de gastos con reparto

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el dueño pueda cargar mes a mes lo que gasta en cada servicio, repartido entre plataformas, y ver en qué se le va el dinero.

**Architecture:** Un paquete puro `@repo/finance-control` con todo el cálculo (conversión de moneda, reparto, resumen), sin Prisma ni React. Cinco tablas nuevas en la base de CompraMeLaFoto. Rutas de API bajo `/api/admin/finance-dnx/` y pantallas cliente en `/admin/finanzas-dnx`, siguiendo el patrón que ya usa `/admin/finanzas` (componente cliente + `fetch` a rutas de API; **esta app no usa server actions**).

**Tech Stack:** TypeScript, Node test runner vía `tsx --test`, Prisma 6, Next.js (App Router), React client components.

**Spec:** `docs/superpowers/specs/2026-09-11-finanzas-dnx-control-de-gastos-design.md`

## Global Constraints

- **La plata se guarda en `Decimal @db.Decimal(14, 2)`** (12,2 para importes de factura). **Prohibido el sufijo `Cents`**: la línea 1 de `packages/db/prisma/schema.prisma` advierte que en este esquema ese sufijo no es confiable. Dentro del paquete puro se trabaja en **unidades menores enteras** con el sufijo `Minor`.
- **`platformKey` es `String`, no enum de Prisma.** Las plataformas crecen y un enum nuevo obliga a tocar las cinco bases.
- **Las tablas se aplican sólo a la rama `production` del proyecto Neon `divine-hall-10689679`.** El deploy no corre `prisma migrate deploy`: la migración se aplica a mano y se registra en `_prisma_migrations` en la misma sesión.
- **Claves de plataforma válidas:** `clf`, `fotoffice`, `fotorank`, `clickaton`, `infospot`, `suite`.
- **El reparto de un gasto debe sumar exactamente 100%.**
- **`amountArs` se guarda calculado**, no se recalcula al leer: el dólar de enero no es el de septiembre.
- Autorización: las rutas nuevas viven bajo `/admin` y `/api/admin`, que ya exigen rol `ADMIN` o `SUPER_ADMIN` (`apps/compramelafoto/app/admin/layout.tsx`). **No se agrega un rol nuevo.**

---

## File Structure

**Paquete nuevo `packages/finance-control/`**

| Archivo | Responsabilidad |
|---|---|
| `src/money.ts` | Convertir un importe de factura a pesos reales (dólar + impuestos) |
| `src/allocation.ts` | Repartir un gasto entre plataformas sin perder ni un centavo |
| `src/rollup.ts` | Armar el resumen mensual: facturado, pagado, deuda y gasto por plataforma |
| `src/platforms.ts` | Catálogo de claves de plataforma válidas |
| `src/index.ts` | Superficie pública del paquete |

**App `apps/compramelafoto/`**

| Archivo | Responsabilidad |
|---|---|
| `app/api/admin/finance-dnx/vendors/route.ts` | Listar y crear proveedores |
| `app/api/admin/finance-dnx/vendors/[id]/route.ts` | Editar un proveedor y su reparto |
| `app/api/admin/finance-dnx/expenses/route.ts` | Listar y crear gastos de un mes |
| `app/api/admin/finance-dnx/expenses/copy-previous/route.ts` | Copiar el mes anterior |
| `app/api/admin/finance-dnx/summary/route.ts` | Resumen del mes |
| `app/admin/finanzas-dnx/page.tsx` | Pantalla de Resumen |
| `app/admin/finanzas-dnx/gastos/page.tsx` | Pantalla de Gastos |
| `app/admin/finanzas-dnx/proveedores/page.tsx` | Pantalla de Proveedores |

---

### Task 1: Paquete y conversión de moneda

**Files:**
- Create: `packages/finance-control/package.json`
- Create: `packages/finance-control/tsconfig.json`
- Create: `packages/finance-control/eslint.config.js`
- Create: `packages/finance-control/src/money.ts`
- Create: `packages/finance-control/src/index.ts`
- Test: `packages/finance-control/src/money.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `computeAmountArsMinor(input: ExpenseAmountInput): number` y el tipo `ExpenseAmountInput = { amountOriginalMinor: number; currency: "USD" | "ARS"; fxRate: number | null; taxPercent: number }`. Devuelve **unidades menores enteras de peso** (centavos de peso).

- [ ] **Step 1: Crear el esqueleto del paquete**

`packages/finance-control/package.json`:

```json
{
  "name": "@repo/finance-control",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Finanzas DNX — cálculo puro de gastos, reparto entre plataformas y resumen mensual.",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "check-types": "tsc --noEmit -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "lint": "eslint .",
    "test": "pnpm exec tsx --test \"src/**/*.test.ts\""
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/node": "^22.15.3",
    "eslint": "^9.39.1",
    "tsx": "^4.21.0",
    "typescript": "5.9.2"
  }
}
```

`packages/finance-control/tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": true,
    "declaration": true,
    "declarationMap": false,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

`packages/finance-control/eslint.config.js` — copiar tal cual de `packages/ops-daily-report/eslint.config.js`.

Crear `packages/finance-control/src/index.ts` vacío por ahora (una línea: `export {};`).

Luego, desde la raíz del monorepo: `pnpm install`.

- [ ] **Step 2: Escribir la prueba que falla**

`packages/finance-control/src/money.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { computeAmountArsMinor } from "./money";

test("una factura en pesos se toma tal cual", () => {
  const resultado = computeAmountArsMinor({
    amountOriginalMinor: 150_00,
    currency: "ARS",
    fxRate: null,
    taxPercent: 0,
  });

  assert.equal(resultado, 150_00);
});

test("una factura en dólares se multiplica por el dólar del mes", () => {
  const resultado = computeAmountArsMinor({
    amountOriginalMinor: 20_00,
    currency: "USD",
    fxRate: 1450,
    taxPercent: 0,
  });

  assert.equal(resultado, 29_000_00);
});

test("los impuestos se suman sobre el consumo en dólares", () => {
  const resultado = computeAmountArsMinor({
    amountOriginalMinor: 20_00,
    currency: "USD",
    fxRate: 1000,
    taxPercent: 30,
  });

  assert.equal(resultado, 26_000_00);
});

test("una factura en dólares sin tipo de cambio cargado es un error explícito", () => {
  assert.throws(
    () =>
      computeAmountArsMinor({
        amountOriginalMinor: 20_00,
        currency: "USD",
        fxRate: null,
        taxPercent: 0,
      }),
    /tipo de cambio/i,
  );
});

test("el resultado se redondea a centavos enteros", () => {
  const resultado = computeAmountArsMinor({
    amountOriginalMinor: 3_33,
    currency: "USD",
    fxRate: 1000.555,
    taxPercent: 21,
  });

  assert.equal(Number.isInteger(resultado), true);
});
```

- [ ] **Step 3: Correr la prueba y verificar que falla**

Run: `pnpm --filter @repo/finance-control test`
Expected: FAIL — `Cannot find module './money'`.

- [ ] **Step 4: Implementar lo mínimo**

`packages/finance-control/src/money.ts`:

```ts
/**
 * Conversión de un importe de factura a pesos reales.
 *
 * Todo se maneja en unidades menores enteras (centavos) para que no haya
 * arrastre de coma flotante. NO se usa el sufijo "Cents": en el esquema de la
 * base ese sufijo no es confiable y se presta a confusión.
 */

export type ExpenseCurrency = "USD" | "ARS";

export type ExpenseAmountInput = {
  /** Importe de la factura en unidades menores de SU moneda. */
  amountOriginalMinor: number;
  currency: ExpenseCurrency;
  /** Pesos por dólar del mes. Obligatorio si la moneda es USD. */
  fxRate: number | null;
  /** Impuestos sobre el consumo en dólares, en porcentaje. */
  taxPercent: number;
};

export function computeAmountArsMinor(input: ExpenseAmountInput): number {
  if (input.currency === "ARS") return Math.round(input.amountOriginalMinor);

  if (input.fxRate == null) {
    throw new Error(
      "Falta el tipo de cambio: una factura en dólares no se puede convertir a pesos sin él.",
    );
  }

  const conImpuestos = input.amountOriginalMinor * input.fxRate * (1 + input.taxPercent / 100);
  return Math.round(conImpuestos);
}
```

Y en `packages/finance-control/src/index.ts`:

```ts
export {
  computeAmountArsMinor,
  type ExpenseAmountInput,
  type ExpenseCurrency,
} from "./money";
```

- [ ] **Step 5: Correr la prueba y verificar que pasa**

Run: `pnpm --filter @repo/finance-control test`
Expected: PASS — 5 pruebas.

- [ ] **Step 6: Commit**

```bash
git add packages/finance-control pnpm-lock.yaml
git commit -m "Convertir importes de factura a pesos reales con dólar e impuestos"
```

---

### Task 2: Reparto entre plataformas sin perder centavos

**Files:**
- Create: `packages/finance-control/src/platforms.ts`
- Create: `packages/finance-control/src/allocation.ts`
- Modify: `packages/finance-control/src/index.ts`
- Test: `packages/finance-control/src/allocation.test.ts`

**Interfaces:**
- Consumes: nada de Task 1.
- Produces:
  - `PLATFORM_KEYS: readonly string[]` y `isPlatformKey(value: string): boolean` desde `platforms.ts`.
  - `splitAmountByAllocation(amountArsMinor: number, shares: AllocationShare[]): AllocatedAmount[]` desde `allocation.ts`, con `AllocationShare = { platformKey: string; sharePercent: number }` y `AllocatedAmount = { platformKey: string; sharePercent: number; amountArsMinor: number }`.
  - `assertSharesSumTo100(shares: AllocationShare[]): void`.

- [ ] **Step 1: Escribir la prueba que falla**

`packages/finance-control/src/allocation.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { assertSharesSumTo100, splitAmountByAllocation } from "./allocation";

test("un gasto de una sola plataforma se le asigna entero", () => {
  const partes = splitAmountByAllocation(100_00, [{ platformKey: "clf", sharePercent: 100 }]);

  assert.deepEqual(partes, [{ platformKey: "clf", sharePercent: 100, amountArsMinor: 100_00 }]);
});

test("las partes suman exactamente el total, sin centavos perdidos", () => {
  const partes = splitAmountByAllocation(100_00, [
    { platformKey: "clf", sharePercent: 33.33 },
    { platformKey: "fotoffice", sharePercent: 33.33 },
    { platformKey: "fotorank", sharePercent: 33.34 },
  ]);

  const suma = partes.reduce((total, parte) => total + parte.amountArsMinor, 0);
  assert.equal(suma, 100_00);
});

test("el centavo sobrante va a la plataforma con el resto más grande", () => {
  const partes = splitAmountByAllocation(10_01, [
    { platformKey: "clf", sharePercent: 50 },
    { platformKey: "suite", sharePercent: 50 },
  ]);

  const suma = partes.reduce((total, parte) => total + parte.amountArsMinor, 0);
  assert.equal(suma, 10_01);
  assert.equal(partes.length, 2);
});

test("un reparto que no suma 100 es un error explícito", () => {
  assert.throws(
    () =>
      assertSharesSumTo100([
        { platformKey: "clf", sharePercent: 50 },
        { platformKey: "fotoffice", sharePercent: 30 },
      ]),
    /100/,
  );
});

test("un reparto que suma 100 no da error", () => {
  assert.doesNotThrow(() =>
    assertSharesSumTo100([
      { platformKey: "clf", sharePercent: 50 },
      { platformKey: "fotoffice", sharePercent: 50 },
    ]),
  );
});
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `pnpm --filter @repo/finance-control test`
Expected: FAIL — `Cannot find module './allocation'`.

- [ ] **Step 3: Implementar lo mínimo**

`packages/finance-control/src/platforms.ts`:

```ts
/** Plataformas de la suite. `suite` es el gasto de estructura no atribuible. */
export const PLATFORM_KEYS = [
  "clf",
  "fotoffice",
  "fotorank",
  "clickaton",
  "infospot",
  "suite",
] as const;

export type PlatformKey = (typeof PLATFORM_KEYS)[number];

export function isPlatformKey(value: string): value is PlatformKey {
  return (PLATFORM_KEYS as readonly string[]).includes(value);
}
```

`packages/finance-control/src/allocation.ts`:

```ts
/**
 * Reparto de un gasto entre plataformas.
 *
 * Usa el método del resto mayor: reparte la parte entera de cada porcentaje y
 * después entrega los centavos sobrantes a quienes tengan el resto más grande.
 * Así la suma de las partes es SIEMPRE igual al total.
 */

export type AllocationShare = {
  platformKey: string;
  sharePercent: number;
};

export type AllocatedAmount = AllocationShare & {
  amountArsMinor: number;
};

/** Tolerancia para comparar porcentajes cargados a mano con dos decimales. */
const TOLERANCIA = 0.005;

export function assertSharesSumTo100(shares: AllocationShare[]): void {
  const suma = shares.reduce((total, parte) => total + parte.sharePercent, 0);
  if (Math.abs(suma - 100) > TOLERANCIA) {
    throw new Error(`El reparto suma ${suma}% y tiene que sumar exactamente 100%.`);
  }
}

export function splitAmountByAllocation(
  amountArsMinor: number,
  shares: AllocationShare[],
): AllocatedAmount[] {
  assertSharesSumTo100(shares);

  const exactos = shares.map((parte) => (amountArsMinor * parte.sharePercent) / 100);
  const pisos = exactos.map(Math.floor);
  const asignado = pisos.reduce((total, piso) => total + piso, 0);
  let sobrantes = Math.round(amountArsMinor - asignado);

  const porRestoDescendente = exactos
    .map((exacto, indice) => ({ indice, resto: exacto - Math.floor(exacto) }))
    .sort((a, b) => b.resto - a.resto);

  const montos = [...pisos];
  for (const { indice } of porRestoDescendente) {
    if (sobrantes <= 0) break;
    montos[indice] += 1;
    sobrantes -= 1;
  }

  return shares.map((parte, indice) => ({
    platformKey: parte.platformKey,
    sharePercent: parte.sharePercent,
    amountArsMinor: montos[indice],
  }));
}
```

Agregar a `packages/finance-control/src/index.ts`:

```ts
export { PLATFORM_KEYS, isPlatformKey, type PlatformKey } from "./platforms";
export {
  assertSharesSumTo100,
  splitAmountByAllocation,
  type AllocatedAmount,
  type AllocationShare,
} from "./allocation";
```

- [ ] **Step 4: Correr la prueba y verificar que pasa**

Run: `pnpm --filter @repo/finance-control test`
Expected: PASS — 10 pruebas (5 de Task 1 + 5 nuevas).

- [ ] **Step 5: Commit**

```bash
git add packages/finance-control
git commit -m "Repartir un gasto entre plataformas sin perder centavos"
```

---

### Task 3: Resumen mensual con facturado, pagado y deuda

**Files:**
- Create: `packages/finance-control/src/rollup.ts`
- Modify: `packages/finance-control/src/index.ts`
- Test: `packages/finance-control/src/rollup.test.ts`

**Interfaces:**
- Consumes: `AllocatedAmount` de Task 2.
- Produces: `buildMonthlySummary(entries: SummaryEntry[]): MonthlySummary` con:
  - `SummaryEntry = { vendorKey: string; amountArsMinor: number; status: ExpenseStatus; allocations: AllocatedAmount[] }`
  - `ExpenseStatus = "ESTIMADO" | "FACTURADO" | "PAGADO" | "RECHAZADO" | "IMPAGO" | "REEMBOLSADO"`
  - `MonthlySummary = { billedArsMinor: number; paidArsMinor: number; debtArsMinor: number; byPlatform: PlatformTotal[] }`
  - `PlatformTotal = { platformKey: string; directArsMinor: number; proratedArsMinor: number; totalArsMinor: number }`

- [ ] **Step 1: Escribir la prueba que falla**

`packages/finance-control/src/rollup.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { buildMonthlySummary } from "./rollup";

const gastoCompartido = {
  vendorKey: "vercel",
  amountArsMinor: 100_00,
  status: "PAGADO" as const,
  allocations: [
    { platformKey: "clf", sharePercent: 60, amountArsMinor: 60_00 },
    { platformKey: "fotoffice", sharePercent: 40, amountArsMinor: 40_00 },
  ],
};

const gastoDirecto = {
  vendorKey: "dominio-clf",
  amountArsMinor: 20_00,
  status: "PAGADO" as const,
  allocations: [{ platformKey: "clf", sharePercent: 100, amountArsMinor: 20_00 }],
};

test("lo facturado suma todos los gastos del mes", () => {
  const resumen = buildMonthlySummary([gastoCompartido, gastoDirecto]);

  assert.equal(resumen.billedArsMinor, 120_00);
});

test("una factura rechazada se cuenta como deuda, no como pagada", () => {
  const resumen = buildMonthlySummary([
    { ...gastoDirecto, status: "RECHAZADO" as const },
  ]);

  assert.equal(resumen.billedArsMinor, 20_00);
  assert.equal(resumen.paidArsMinor, 0);
  assert.equal(resumen.debtArsMinor, 20_00);
});

test("separa el gasto directo del prorrateado", () => {
  const resumen = buildMonthlySummary([gastoCompartido, gastoDirecto]);
  const clf = resumen.byPlatform.find((p) => p.platformKey === "clf");

  assert.equal(clf?.directArsMinor, 20_00);
  assert.equal(clf?.proratedArsMinor, 60_00);
  assert.equal(clf?.totalArsMinor, 80_00);
});

test("un mes sin gastos devuelve todo en cero y sin plataformas", () => {
  const resumen = buildMonthlySummary([]);

  assert.equal(resumen.billedArsMinor, 0);
  assert.equal(resumen.paidArsMinor, 0);
  assert.equal(resumen.debtArsMinor, 0);
  assert.deepEqual(resumen.byPlatform, []);
});
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `pnpm --filter @repo/finance-control test`
Expected: FAIL — `Cannot find module './rollup'`.

- [ ] **Step 3: Implementar lo mínimo**

`packages/finance-control/src/rollup.ts`:

```ts
import type { AllocatedAmount } from "./allocation";

/**
 * Estados de un gasto.
 *
 * Facturado NO es lo mismo que pagado: hay facturas emitidas que la tarjeta
 * rechazó y cobros que después se reembolsaron. Contar lo facturado como gasto
 * infla el número; contar sólo lo pagado esconde la deuda.
 */
export type ExpenseStatus =
  | "ESTIMADO"
  | "FACTURADO"
  | "PAGADO"
  | "RECHAZADO"
  | "IMPAGO"
  | "REEMBOLSADO";

export type SummaryEntry = {
  vendorKey: string;
  amountArsMinor: number;
  status: ExpenseStatus;
  allocations: AllocatedAmount[];
};

export type PlatformTotal = {
  platformKey: string;
  /** Gasto que es enteramente de esta plataforma (reparto del 100%). */
  directArsMinor: number;
  /** Parte que le toca de gastos compartidos. */
  proratedArsMinor: number;
  totalArsMinor: number;
};

export type MonthlySummary = {
  billedArsMinor: number;
  paidArsMinor: number;
  debtArsMinor: number;
  byPlatform: PlatformTotal[];
};

const ESTADOS_DE_DEUDA: ReadonlySet<ExpenseStatus> = new Set(["RECHAZADO", "IMPAGO"]);

export function buildMonthlySummary(entries: SummaryEntry[]): MonthlySummary {
  let billedArsMinor = 0;
  let paidArsMinor = 0;
  let debtArsMinor = 0;

  const porPlataforma = new Map<string, PlatformTotal>();

  for (const entry of entries) {
    billedArsMinor += entry.amountArsMinor;
    if (entry.status === "PAGADO") paidArsMinor += entry.amountArsMinor;
    if (ESTADOS_DE_DEUDA.has(entry.status)) debtArsMinor += entry.amountArsMinor;

    for (const parte of entry.allocations) {
      const actual = porPlataforma.get(parte.platformKey) ?? {
        platformKey: parte.platformKey,
        directArsMinor: 0,
        proratedArsMinor: 0,
        totalArsMinor: 0,
      };
      if (parte.sharePercent >= 100) actual.directArsMinor += parte.amountArsMinor;
      else actual.proratedArsMinor += parte.amountArsMinor;
      actual.totalArsMinor += parte.amountArsMinor;
      porPlataforma.set(parte.platformKey, actual);
    }
  }

  const byPlatform = [...porPlataforma.values()].sort(
    (a, b) => b.totalArsMinor - a.totalArsMinor,
  );

  return { billedArsMinor, paidArsMinor, debtArsMinor, byPlatform };
}
```

Agregar a `packages/finance-control/src/index.ts`:

```ts
export {
  buildMonthlySummary,
  type ExpenseStatus,
  type MonthlySummary,
  type PlatformTotal,
  type SummaryEntry,
} from "./rollup";
```

- [ ] **Step 4: Correr la prueba y verificar que pasa**

Run: `pnpm --filter @repo/finance-control test`
Expected: PASS — 14 pruebas.

- [ ] **Step 5: Verificar tipos del paquete**

Run: `pnpm --filter @repo/finance-control check-types`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add packages/finance-control
git commit -m "Armar el resumen mensual separando facturado, pagado y deuda"
```

---

### Task 4: Tablas en la base

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (agregar al final)
- Create: `packages/db/prisma/migrations/20260911_finanzas_dnx/migration.sql`

**Interfaces:**
- Consumes: las claves de plataforma de Task 2 (como texto, sin enum).
- Produces: los modelos Prisma `ExpenseVendor`, `VendorAllocation`, `ExpenseEntry`, `ExpenseEntryAllocation`, `FxRate`, que las Tasks 5 y 6 consultan.

- [ ] **Step 1: Agregar los modelos al esquema**

Al final de `packages/db/prisma/schema.prisma`:

```prisma
/// Finanzas DNX — control de gastos de la suite.
/// Tablas nuevas, no columnas: su ausencia en las otras bases Neon es inocua
/// porque ninguna otra app las consulta.
model ExpenseVendor {
  id              Int      @id @default(autoincrement())
  key             String   @unique
  name            String
  /// INFRA, IA, EMAIL, DOMINIO, PUBLICIDAD, LEGAL_CONTABLE, COBROS, OTRO
  category        String
  /// USD o ARS
  billingCurrency String
  /// MENSUAL, ANUAL, USO, UNICO
  billingCycle    String
  paymentMethod   String?
  active          Boolean  @default(true)
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  allocations VendorAllocation[]
  entries     ExpenseEntry[]

  @@index([active])
}

model VendorAllocation {
  id           Int     @id @default(autoincrement())
  vendorId     Int
  platformKey  String
  sharePercent Decimal @db.Decimal(5, 2)

  vendor ExpenseVendor @relation(fields: [vendorId], references: [id], onDelete: Cascade)

  @@unique([vendorId, platformKey])
}

model ExpenseEntry {
  id                 Int      @id @default(autoincrement())
  vendorId           Int
  periodYear         Int
  periodMonth        Int
  amountOriginal     Decimal  @db.Decimal(12, 2)
  /// USD o ARS
  currency           String
  fxRate             Decimal? @db.Decimal(12, 4)
  taxPercent         Decimal  @default(0) @db.Decimal(5, 2)
  /// Calculado y congelado: el dólar de enero no es el de septiembre.
  amountArs          Decimal  @db.Decimal(14, 2)
  amountRefunded     Decimal? @db.Decimal(12, 2)
  /// ESTIMADO, FACTURADO, PAGADO, RECHAZADO, IMPAGO, REEMBOLSADO
  status             String   @default("FACTURADO")
  /// MANUAL, IMPORTADO, API
  source             String   @default("MANUAL")
  invoiceUrl         String?
  notes              String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  vendor      ExpenseVendor            @relation(fields: [vendorId], references: [id])
  allocations ExpenseEntryAllocation[]

  @@unique([vendorId, periodYear, periodMonth])
  @@index([periodYear, periodMonth])
  @@index([status])
}

model ExpenseEntryAllocation {
  id           Int     @id @default(autoincrement())
  entryId      Int
  platformKey  String
  sharePercent Decimal @db.Decimal(5, 2)
  amountArs    Decimal @db.Decimal(14, 2)

  entry ExpenseEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)

  @@unique([entryId, platformKey])
  @@index([platformKey])
}

model FxRate {
  id          Int      @id @default(autoincrement())
  periodYear  Int
  periodMonth Int
  usdToArs    Decimal  @db.Decimal(12, 4)
  source      String
  notes       String?
  createdAt   DateTime @default(now())

  @@unique([periodYear, periodMonth])
}
```

- [ ] **Step 2: Generar el cliente y verificar que el esquema es válido**

Run: `pnpm --filter @repo/db exec prisma generate`
Expected: `Generated Prisma Client` sin errores.

- [ ] **Step 3: Generar el SQL de la migración**

Run desde `packages/db`:

```bash
pnpm exec prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20260911_finanzas_dnx/migration.sql
```

Revisar a ojo que el SQL sólo contenga `CREATE TABLE` de las cinco tablas nuevas y sus índices. **Si aparece cualquier `ALTER` o `DROP` sobre tablas existentes, detenerse y avisar**: significa que la base está desincronizada del esquema y eso se resuelve antes, no acá.

- [ ] **Step 4: Aplicar y registrar la migración en la rama `production`**

**Sólo** sobre el proyecto Neon `divine-hall-10689679`, rama `br-autumn-rain-ad18wq7y`. Aplicar el SQL y, en la misma sesión, registrar la fila en `_prisma_migrations` siguiendo el procedimiento ya documentado del repo. No dejar el SQL aplicado sin registrar.

- [ ] **Step 5: Verificar que las tablas existen**

Consultar la base de producción:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('ExpenseVendor','VendorAllocation','ExpenseEntry','ExpenseEntryAllocation','FxRate')
ORDER BY table_name;
```

Expected: las cinco filas.

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260911_finanzas_dnx
git commit -m "Crear las tablas de gastos, reparto y tipo de cambio de Finanzas DNX"
```

---

### Task 5: API de proveedores

**Files:**
- Create: `apps/compramelafoto/lib/finance-dnx/vendor-form.ts`
- Create: `apps/compramelafoto/app/api/admin/finance-dnx/vendors/route.ts`
- Create: `apps/compramelafoto/app/api/admin/finance-dnx/vendors/[id]/route.ts`
- Modify: `apps/compramelafoto/package.json` (agregar el script de prueba)
- Test: `apps/compramelafoto/lib/finance-dnx/vendor-form.test.ts`

**Interfaces:**
- Consumes: `assertSharesSumTo100` e `isPlatformKey` de Task 2; los modelos de Task 4.
- Produces: `parseVendorForm(raw: unknown): VendorFormResult` con `VendorFormResult = { ok: true; value: VendorForm } | { ok: false; error: string }`, usada por las dos rutas.

- [ ] **Step 1: Escribir la prueba que falla**

`apps/compramelafoto/lib/finance-dnx/vendor-form.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { parseVendorForm } from "./vendor-form";

const valido = {
  key: "vercel",
  name: "Vercel",
  category: "INFRA",
  billingCurrency: "USD",
  billingCycle: "MENSUAL",
  allocations: [
    { platformKey: "clf", sharePercent: 60 },
    { platformKey: "fotoffice", sharePercent: 40 },
  ],
};

test("acepta un proveedor bien cargado", () => {
  const resultado = parseVendorForm(valido);

  assert.equal(resultado.ok, true);
});

test("rechaza un reparto que no suma 100", () => {
  const resultado = parseVendorForm({
    ...valido,
    allocations: [{ platformKey: "clf", sharePercent: 60 }],
  });

  assert.equal(resultado.ok, false);
  assert.match(resultado.ok === false ? resultado.error : "", /100/);
});

test("rechaza una plataforma que no existe", () => {
  const resultado = parseVendorForm({
    ...valido,
    allocations: [{ platformKey: "inventada", sharePercent: 100 }],
  });

  assert.equal(resultado.ok, false);
  assert.match(resultado.ok === false ? resultado.error : "", /plataforma/i);
});

test("rechaza una moneda que no es USD ni ARS", () => {
  const resultado = parseVendorForm({ ...valido, billingCurrency: "EUR" });

  assert.equal(resultado.ok, false);
  assert.match(resultado.ok === false ? resultado.error : "", /moneda/i);
});

test("rechaza un proveedor sin nombre", () => {
  const resultado = parseVendorForm({ ...valido, name: "  " });

  assert.equal(resultado.ok, false);
  assert.match(resultado.ok === false ? resultado.error : "", /nombre/i);
});
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Agregar antes a `apps/compramelafoto/package.json`, en `scripts`:

```json
"test:finance-dnx": "../../packages/payments/node_modules/.bin/tsx --tsconfig ./tsconfig.test.json --test lib/finance-dnx/vendor-form.test.ts"
```

Run: `pnpm --filter compramelafoto test:finance-dnx`
Expected: FAIL — no encuentra `./vendor-form`.

- [ ] **Step 3: Implementar lo mínimo**

`apps/compramelafoto/lib/finance-dnx/vendor-form.ts`:

```ts
import { assertSharesSumTo100, isPlatformKey } from "@repo/finance-control";

export type VendorForm = {
  key: string;
  name: string;
  category: string;
  billingCurrency: "USD" | "ARS";
  billingCycle: string;
  paymentMethod: string | null;
  notes: string | null;
  allocations: Array<{ platformKey: string; sharePercent: number }>;
};

export type VendorFormResult =
  | { ok: true; value: VendorForm }
  | { ok: false; error: string };

const CATEGORIAS = new Set([
  "INFRA",
  "IA",
  "EMAIL",
  "DOMINIO",
  "PUBLICIDAD",
  "LEGAL_CONTABLE",
  "COBROS",
  "OTRO",
]);
const CICLOS = new Set(["MENSUAL", "ANUAL", "USO", "UNICO"]);

export function parseVendorForm(raw: unknown): VendorFormResult {
  const datos = raw as Partial<VendorForm> | null;
  if (!datos || typeof datos !== "object") {
    return { ok: false, error: "No llegaron datos del proveedor." };
  }

  const key = String(datos.key ?? "").trim();
  if (!key) return { ok: false, error: "Falta la clave del proveedor." };

  const name = String(datos.name ?? "").trim();
  if (!name) return { ok: false, error: "Falta el nombre del proveedor." };

  const category = String(datos.category ?? "");
  if (!CATEGORIAS.has(category)) {
    return { ok: false, error: `La categoría "${category}" no existe.` };
  }

  const billingCurrency = String(datos.billingCurrency ?? "");
  if (billingCurrency !== "USD" && billingCurrency !== "ARS") {
    return { ok: false, error: "La moneda tiene que ser USD o ARS." };
  }

  const billingCycle = String(datos.billingCycle ?? "");
  if (!CICLOS.has(billingCycle)) {
    return { ok: false, error: `El ciclo "${billingCycle}" no existe.` };
  }

  const allocations = Array.isArray(datos.allocations) ? datos.allocations : [];
  for (const parte of allocations) {
    if (!isPlatformKey(String(parte.platformKey))) {
      return { ok: false, error: `La plataforma "${parte.platformKey}" no existe.` };
    }
  }

  try {
    assertSharesSumTo100(allocations);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Reparto inválido." };
  }

  return {
    ok: true,
    value: {
      key,
      name,
      category,
      billingCurrency,
      billingCycle,
      paymentMethod: datos.paymentMethod ? String(datos.paymentMethod) : null,
      notes: datos.notes ? String(datos.notes) : null,
      allocations: allocations.map((parte) => ({
        platformKey: String(parte.platformKey),
        sharePercent: Number(parte.sharePercent),
      })),
    },
  };
}
```

- [ ] **Step 4: Correr la prueba y verificar que pasa**

Run: `pnpm --filter compramelafoto test:finance-dnx`
Expected: PASS — 5 pruebas.

- [ ] **Step 5: Escribir las rutas de API**

`apps/compramelafoto/app/api/admin/finance-dnx/vendors/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseVendorForm } from "@/lib/finance-dnx/vendor-form";

export const dynamic = "force-dynamic";

export async function GET() {
  const vendors = await prisma.expenseVendor.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { allocations: true },
  });
  return NextResponse.json({ vendors });
}

export async function POST(req: NextRequest) {
  const parsed = parseVendorForm(await req.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { allocations, ...vendor } = parsed.value;
  const created = await prisma.expenseVendor.create({
    data: { ...vendor, allocations: { create: allocations } },
    include: { allocations: true },
  });
  return NextResponse.json({ vendor: created }, { status: 201 });
}
```

`apps/compramelafoto/app/api/admin/finance-dnx/vendors/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseVendorForm } from "@/lib/finance-dnx/vendor-form";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vendorId = Number(id);
  if (!Number.isInteger(vendorId)) {
    return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  }

  const parsed = parseVendorForm(await req.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { allocations, ...vendor } = parsed.value;
  const updated = await prisma.$transaction(async (tx) => {
    await tx.vendorAllocation.deleteMany({ where: { vendorId } });
    return tx.expenseVendor.update({
      where: { id: vendorId },
      data: { ...vendor, allocations: { create: allocations } },
      include: { allocations: true },
    });
  });

  return NextResponse.json({ vendor: updated });
}
```

- [ ] **Step 6: Verificar tipos**

Run: `pnpm --filter compramelafoto check-types`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add apps/compramelafoto/lib/finance-dnx apps/compramelafoto/app/api/admin/finance-dnx apps/compramelafoto/package.json
git commit -m "Alta y edición de proveedores con su reparto por plataforma"
```

---

### Task 6: API de gastos y copiar del mes anterior

**Files:**
- Create: `apps/compramelafoto/lib/finance-dnx/expense-form.ts`
- Create: `apps/compramelafoto/app/api/admin/finance-dnx/expenses/route.ts`
- Create: `apps/compramelafoto/app/api/admin/finance-dnx/expenses/copy-previous/route.ts`
- Create: `apps/compramelafoto/app/api/admin/finance-dnx/fx/route.ts`
- Create: `apps/compramelafoto/app/api/admin/finance-dnx/summary/route.ts`
- Test: `apps/compramelafoto/lib/finance-dnx/expense-form.test.ts`

**Interfaces:**
- Consumes: `computeAmountArsMinor` (Task 1), `splitAmountByAllocation` (Task 2), `buildMonthlySummary` (Task 3), los modelos de Task 4.
- Produces: `parseExpenseForm(raw: unknown): ExpenseFormResult` y `previousPeriod(year: number, month: number): { year: number; month: number }`.

- [ ] **Step 1: Escribir la prueba que falla**

`apps/compramelafoto/lib/finance-dnx/expense-form.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { parseExpenseForm, previousPeriod } from "./expense-form";

const valido = {
  vendorId: 1,
  periodYear: 2026,
  periodMonth: 9,
  amountOriginal: 175.57,
  currency: "USD",
  fxRate: 1450,
  taxPercent: 30,
  status: "RECHAZADO",
};

test("acepta un gasto bien cargado y calcula los pesos", () => {
  const resultado = parseExpenseForm(valido);

  assert.equal(resultado.ok, true);
  if (resultado.ok) {
    assert.equal(resultado.value.amountArsMinor > 0, true);
  }
});

test("una factura en dólares sin tipo de cambio se rechaza con un mensaje claro", () => {
  const resultado = parseExpenseForm({ ...valido, fxRate: null });

  assert.equal(resultado.ok, false);
  assert.match(resultado.ok === false ? resultado.error : "", /tipo de cambio/i);
});

test("rechaza un mes fuera de rango", () => {
  const resultado = parseExpenseForm({ ...valido, periodMonth: 13 });

  assert.equal(resultado.ok, false);
  assert.match(resultado.ok === false ? resultado.error : "", /mes/i);
});

test("rechaza un estado que no existe", () => {
  const resultado = parseExpenseForm({ ...valido, status: "INVENTADO" });

  assert.equal(resultado.ok, false);
  assert.match(resultado.ok === false ? resultado.error : "", /estado/i);
});

test("el mes anterior a enero es diciembre del año pasado", () => {
  assert.deepEqual(previousPeriod(2026, 1), { year: 2025, month: 12 });
});

test("el mes anterior a septiembre es agosto del mismo año", () => {
  assert.deepEqual(previousPeriod(2026, 9), { year: 2026, month: 8 });
});
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `pnpm --filter compramelafoto test:finance-dnx`
Expected: FAIL — no encuentra `./expense-form`.

- [ ] **Step 3: Implementar lo mínimo**

`apps/compramelafoto/lib/finance-dnx/expense-form.ts`:

```ts
import { computeAmountArsMinor, type ExpenseStatus } from "@repo/finance-control";

export type ExpenseForm = {
  vendorId: number;
  periodYear: number;
  periodMonth: number;
  amountOriginalMinor: number;
  currency: "USD" | "ARS";
  fxRate: number | null;
  taxPercent: number;
  amountArsMinor: number;
  status: ExpenseStatus;
  notes: string | null;
};

export type ExpenseFormResult =
  | { ok: true; value: ExpenseForm }
  | { ok: false; error: string };

const ESTADOS = new Set<ExpenseStatus>([
  "ESTIMADO",
  "FACTURADO",
  "PAGADO",
  "RECHAZADO",
  "IMPAGO",
  "REEMBOLSADO",
]);

export function previousPeriod(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

export function parseExpenseForm(raw: unknown): ExpenseFormResult {
  const datos = raw as Record<string, unknown> | null;
  if (!datos || typeof datos !== "object") {
    return { ok: false, error: "No llegaron datos del gasto." };
  }

  const vendorId = Number(datos.vendorId);
  if (!Number.isInteger(vendorId)) {
    return { ok: false, error: "Falta el proveedor." };
  }

  const periodYear = Number(datos.periodYear);
  if (!Number.isInteger(periodYear) || periodYear < 2020 || periodYear > 2100) {
    return { ok: false, error: "El año no es válido." };
  }

  const periodMonth = Number(datos.periodMonth);
  if (!Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > 12) {
    return { ok: false, error: "El mes tiene que estar entre 1 y 12." };
  }

  const currency = String(datos.currency);
  if (currency !== "USD" && currency !== "ARS") {
    return { ok: false, error: "La moneda tiene que ser USD o ARS." };
  }

  const status = String(datos.status) as ExpenseStatus;
  if (!ESTADOS.has(status)) {
    return { ok: false, error: `El estado "${status}" no existe.` };
  }

  const amountOriginalMinor = Math.round(Number(datos.amountOriginal) * 100);
  if (!Number.isFinite(amountOriginalMinor)) {
    return { ok: false, error: "El importe no es un número." };
  }

  const fxRate = datos.fxRate == null ? null : Number(datos.fxRate);
  const taxPercent = Number(datos.taxPercent ?? 0);

  let amountArsMinor: number;
  try {
    amountArsMinor = computeAmountArsMinor({
      amountOriginalMinor,
      currency,
      fxRate,
      taxPercent,
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Importe inválido." };
  }

  return {
    ok: true,
    value: {
      vendorId,
      periodYear,
      periodMonth,
      amountOriginalMinor,
      currency,
      fxRate,
      taxPercent,
      amountArsMinor,
      status,
      notes: datos.notes ? String(datos.notes) : null,
    },
  };
}
```

- [ ] **Step 4: Correr la prueba y verificar que pasa**

Run: `pnpm --filter compramelafoto test:finance-dnx`
Expected: PASS — 11 pruebas (5 de Task 5 + 6 nuevas).

- [ ] **Step 5: Escribir las tres rutas de API**

`apps/compramelafoto/app/api/admin/finance-dnx/expenses/route.ts` — `GET` lista los gastos de un período (`?year=&month=`) con su proveedor y su reparto; `POST` crea uno usando `parseExpenseForm`, y guarda el reparto con `splitAmountByAllocation(value.amountArsMinor, vendor.allocations)` convirtiendo cada parte a pesos dividiendo por 100 al escribir el `Decimal`.

Ampliar primero el script de prueba en `apps/compramelafoto/package.json` para que incluya el archivo nuevo:

```json
"test:finance-dnx": "../../packages/payments/node_modules/.bin/tsx --tsconfig ./tsconfig.test.json --test lib/finance-dnx/vendor-form.test.ts lib/finance-dnx/expense-form.test.ts"
```

`apps/compramelafoto/app/api/admin/finance-dnx/expenses/copy-previous/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { previousPeriod } from "@/lib/finance-dnx/expense-form";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { year, month } = (await req.json()) as { year: number; month: number };
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Período inválido." }, { status: 400 });
  }

  const anterior = previousPeriod(year, month);

  const origen = await prisma.expenseEntry.findMany({
    where: {
      periodYear: anterior.year,
      periodMonth: anterior.month,
      vendor: { active: true },
    },
    include: { allocations: true },
  });

  const yaCargados = await prisma.expenseEntry.findMany({
    where: { periodYear: year, periodMonth: month },
    select: { vendorId: true },
  });
  const ocupados = new Set(yaCargados.map((entrada) => entrada.vendorId));

  // Se omiten los proveedores que ya tienen gasto en el mes destino: la
  // restricción única lo impediría igual, pero fallar a mitad dejaría la
  // copia incompleta y sin aviso.
  const aCopiar = origen.filter((entrada) => !ocupados.has(entrada.vendorId));

  const creados = await prisma.$transaction(
    aCopiar.map((entrada) =>
      prisma.expenseEntry.create({
        data: {
          vendorId: entrada.vendorId,
          periodYear: year,
          periodMonth: month,
          amountOriginal: entrada.amountOriginal,
          currency: entrada.currency,
          fxRate: entrada.fxRate,
          taxPercent: entrada.taxPercent,
          amountArs: entrada.amountArs,
          // Se copia como estimado: son los números del mes pasado hasta que
          // llegue la factura de verdad.
          status: "ESTIMADO",
          source: "MANUAL",
          allocations: {
            create: entrada.allocations.map((parte) => ({
              platformKey: parte.platformKey,
              sharePercent: parte.sharePercent,
              amountArs: parte.amountArs,
            })),
          },
        },
      }),
    ),
  );

  return NextResponse.json({
    copiados: creados.length,
    omitidos: origen.length - aCopiar.length,
  });
}
```

`apps/compramelafoto/app/api/admin/finance-dnx/fx/route.ts` — `GET` con `?year=&month=` devuelve `{ usdToArs }` del `FxRate` de ese período o `null` si no está cargado; `PUT` lo crea o actualiza. Es lo que alimenta el valor por defecto de la pantalla de Gastos.

`apps/compramelafoto/app/api/admin/finance-dnx/summary/route.ts` — `GET` con `?year=&month=` arma las `SummaryEntry` desde la base y devuelve `buildMonthlySummary(entries)`, más la lista de proveedores del mes anterior que todavía no tienen gasto cargado en el mes pedido (el aviso del spec).

- [ ] **Step 6: Verificar tipos**

Run: `pnpm --filter compramelafoto check-types`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add apps/compramelafoto/lib/finance-dnx apps/compramelafoto/app/api/admin/finance-dnx
git commit -m "Carga de gastos mensuales con copiar del mes anterior"
```

---

### Task 7: Pantallas

**Files:**
- Create: `apps/compramelafoto/app/admin/finanzas-dnx/page.tsx`
- Create: `apps/compramelafoto/app/admin/finanzas-dnx/gastos/page.tsx`
- Create: `apps/compramelafoto/app/admin/finanzas-dnx/proveedores/page.tsx`
- Modify: `apps/compramelafoto/components/admin/AdminLayout.tsx` (agregar el enlace del menú)

**Interfaces:**
- Consumes: las rutas de API de Tasks 5 y 6.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Escribir las tres pantallas**

Seguir el patrón de `apps/compramelafoto/app/admin/finanzas/page.tsx`: `"use client"`, `useState` + `useEffect`, `fetch` con `credentials: "include"` y `cache: "no-store"`, y los componentes `Card` y `Button` de `@/components/ui`. Reusar `formatARS` de `@/lib/admin/helpers` para mostrar los importes.

- **Resumen** (`page.tsx`): tarjetas con facturado, pagado, deuda y resultado del mes; selector de mes; aviso en rojo listando los proveedores del mes anterior que faltan cargar.
- **Gastos** (`gastos/page.tsx`): tabla del mes con proveedor, importe original, moneda, dólar, impuestos y costo real en pesos; botón "Copiar del mes anterior" que llama a `copy-previous` y recarga; formulario de alta. **El campo del dólar se propone solo** con el `FxRate` cargado para ese período (`GET /api/admin/finance-dnx/fx?year=&month=`), y queda editable: es el valor por defecto del spec, no una imposición.
- **Proveedores** (`proveedores/page.tsx`): alta y edición, con el reparto por plataforma y un contador visible de la suma que se pone en rojo si no da 100.

- [ ] **Step 2: Agregar el enlace en el menú del admin**

En `apps/compramelafoto/components/admin/AdminLayout.tsx`, agregar la entrada `Finanzas DNX` apuntando a `/admin/finanzas-dnx`, junto a la de `Finanzas` que ya existe.

- [ ] **Step 3: Verificar tipos y lint**

Run: `pnpm --filter compramelafoto check-types`
Expected: sin errores.

- [ ] **Step 4: Verificar en el navegador**

Levantar la app y recorrer: cargar un proveedor con reparto que no sume 100 (tiene que rechazarlo), corregirlo, cargar un gasto en dólares, ver el costo en pesos, y usar "Copiar del mes anterior".

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/app/admin/finanzas-dnx apps/compramelafoto/components/admin/AdminLayout.tsx
git commit -m "Pantallas de resumen, gastos y proveedores de Finanzas DNX"
```

---

## Qué queda para las etapas siguientes

- **Etapa 2:** cargar los datos reales de enero a septiembre 2026. Buena parte ya está relevada en el spec.
- **Etapa 3:** los cinco colectores de ingresos, el job diario de snapshot y el backfill.
- **Etapa 4:** la pantalla de comparativa por plataforma, la evolución mensual y el reparto medido de Neon.
