# Comisión de plataforma — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la comisión que cobra la plataforma se configure por workspace y por módulo, la edite únicamente el super admin, valga 5% por defecto, y quede explicada en cada pantalla donde alguien fija un precio.

**Architecture:** Una tabla `WorkspaceModuleFee` con una fila por par (workspace, módulo) y una única función que resuelve el número con fallback al 5%. La aritmética vive en un módulo puro sin acceso a base, probado exhaustivamente, porque un error ahí es plata mal cobrada. El fee deja de leerse desde `CourseSalesWorkspaceSettings.coursesFeePercent`, que queda deprecado.

**Tech Stack:** Next.js 15 (App Router, Server Actions), Prisma, PostgreSQL (Neon), Vitest, `Prisma.Decimal` para dinero.

**Spec:** `docs/superpowers/specs/2026-08-24-fotoffice-alta-socios-cobros-design.md` (§5.2)

## Global Constraints

- **Comisión por defecto: 5%**, expresada como `500` puntos básicos (bps). Nunca como `0.05` ni como `5` sin unidad.
- **Unidad de almacenamiento: puntos básicos, enteros.** Se muestra como porcentaje.
- **Nunca coma flotante para dinero.** Se usa `Prisma.Decimal`, como ya hace `apps/fotoffice/app/actions/public-course-enrollment.ts`.
- **Invariante inviolable:** `fee + net === total`, exactamente, siempre. El neto se calcula restando, nunca multiplicando.
- **Redondeo:** `ROUND_HALF_UP` a 2 decimales, igual que el código existente.
- **Solo el super admin edita.** Guard: `isFotofficePlatformAdmin(user.id)` de `@/lib/platform-admin`.
- **Rango válido:** 0 a 10000 bps (0% a 100%). El 0% debe funcionar.
- Tests: Vitest, archivo `*.test.ts` al lado del fuente. Correr con `npx vitest run <ruta>` desde `apps/fotoffice`.
- Comentarios y textos de interfaz **en español**.

---

## File Structure

**Nuevos:**

| Archivo | Responsabilidad |
|---|---|
| `apps/fotoffice/lib/platform-fee/fee.ts` | Aritmética pura: resolver bps, partir un monto. Sin Prisma client, sin I/O |
| `apps/fotoffice/lib/platform-fee/fee.test.ts` | Tests de la aritmética |
| `apps/fotoffice/lib/platform-fee/store.ts` | Lectura de la comisión desde la base, con fallback |
| `apps/fotoffice/lib/platform-fee/store.test.ts` | Tests de la lectura |
| `apps/fotoffice/app/actions/platform-fee-admin.ts` | Server action de edición (solo super admin) |
| `apps/fotoffice/app/actions/platform-fee-admin.test.ts` | Tests de la acción |
| `apps/fotoffice/components/platform-fee/module-fee-field.tsx` | Campo de edición en el panel de super admin |
| `apps/fotoffice/components/platform-fee/fee-breakdown.tsx` | Desglose de transparencia para pantallas de precio |
| `apps/fotoffice/components/platform-fee/fee-breakdown.test.tsx` | Tests del desglose |
| `packages/db/prisma/migrations/20260824120000_workspace_module_fee/migration.sql` | Tabla nueva |

**Modificados:**

| Archivo | Cambio |
|---|---|
| `packages/db/prisma/schema.prisma` | Modelo `WorkspaceModuleFee`; deprecar `coursesFeePercent` |
| `apps/fotoffice/app/actions/public-course-enrollment.ts:82-89` | Leer del resolver nuevo |
| `apps/fotoffice/app/actions/settings.ts:9-66` | Quitar `coursesFeePercent` |
| `apps/fotoffice/app/(shell)/courses/settings/page.tsx` | Mostrar el fee sin poder editarlo |
| `apps/fotoffice/app/(shell)/admin/workspaces/[id]/page.tsx:70-100` | Campo de comisión por módulo |

**Por qué esta división:** la aritmética se separa de la lectura porque es la parte que más tests necesita y no debe requerir base de datos para probarse. El componente de desglose vive aparte porque lo van a consumir varias pantallas de precio —cursos hoy, cuotas mañana— y la spec exige que el texto sea idéntico en todas.

---

## Task 1: Aritmética de la comisión

**Files:**
- Create: `apps/fotoffice/lib/platform-fee/fee.ts`
- Test: `apps/fotoffice/lib/platform-fee/fee.test.ts`

**Interfaces:**
- Consumes: `Prisma` de `@repo/db`
- Produces:
  - `DEFAULT_PLATFORM_FEE_BPS: 500`
  - `MAX_PLATFORM_FEE_BPS: 10000`
  - `resolvePlatformFeeBps(configured?: number | null): number`
  - `isValidFeeBps(value: unknown): value is number`
  - `formatFeeBpsAsPercent(bps: number): string`
  - `type FeeSplit = { total: Prisma.Decimal; fee: Prisma.Decimal; net: Prisma.Decimal; feeBps: number }`
  - `splitByPlatformFee(total: Prisma.Decimal, feeBps: number): FeeSplit`

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/fotoffice/lib/platform-fee/fee.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Prisma } from "@repo/db";
import {
  DEFAULT_PLATFORM_FEE_BPS,
  MAX_PLATFORM_FEE_BPS,
  formatFeeBpsAsPercent,
  isValidFeeBps,
  resolvePlatformFeeBps,
  splitByPlatformFee,
} from "./fee";

const money = (v: string) => new Prisma.Decimal(v);

describe("resolvePlatformFeeBps", () => {
  it("sin configuración devuelve el 5% por defecto", () => {
    expect(DEFAULT_PLATFORM_FEE_BPS).toBe(500);
    expect(resolvePlatformFeeBps(null)).toBe(500);
    expect(resolvePlatformFeeBps(undefined)).toBe(500);
  });

  it("respeta el valor configurado", () => {
    expect(resolvePlatformFeeBps(1200)).toBe(1200);
  });

  /** Comisión cero es un valor legítimo, no "sin configurar". */
  it("cero es un valor válido y no cae al default", () => {
    expect(resolvePlatformFeeBps(0)).toBe(0);
  });

  it("un valor fuera de rango cae al default en vez de propagar basura", () => {
    expect(resolvePlatformFeeBps(-1)).toBe(500);
    expect(resolvePlatformFeeBps(10001)).toBe(500);
    expect(resolvePlatformFeeBps(1.5)).toBe(500);
    expect(resolvePlatformFeeBps(Number.NaN)).toBe(500);
  });
});

describe("isValidFeeBps", () => {
  it.each([
    [0, true],
    [500, true],
    [MAX_PLATFORM_FEE_BPS, true],
    [-1, false],
    [10001, false],
    [1.5, false],
    ["500", false],
    [null, false],
  ])("%s -> %s", (value, expected) => {
    expect(isValidFeeBps(value)).toBe(expected);
  });
});

describe("formatFeeBpsAsPercent", () => {
  it.each([
    [500, "5%"],
    [0, "0%"],
    [1050, "10,5%"],
    [10000, "100%"],
  ])("%s bps -> %s", (bps, expected) => {
    expect(formatFeeBpsAsPercent(bps)).toBe(expected);
  });
});

describe("splitByPlatformFee", () => {
  it("parte 10.000 al 5% en 500 de fee y 9.500 neto", () => {
    const r = splitByPlatformFee(money("10000"), 500);
    expect(r.fee.toFixed(2)).toBe("500.00");
    expect(r.net.toFixed(2)).toBe("9500.00");
    expect(r.feeBps).toBe(500);
  });

  it("con comisión cero el neto es el total", () => {
    const r = splitByPlatformFee(money("10000"), 0);
    expect(r.fee.toFixed(2)).toBe("0.00");
    expect(r.net.toFixed(2)).toBe("10000.00");
  });

  /**
   * El invariante que no se puede romper: lo que paga el socio es exactamente
   * lo que se reparte. Si fee + net no da total, alguien pierde o gana plata.
   */
  it.each(["0", "0.01", "1", "33.33", "10000", "12345.67", "999999.99"])(
    "fee + net === total para %s en varios porcentajes",
    (amount) => {
      for (const bps of [0, 1, 250, 500, 1234, 9999, 10000]) {
        const r = splitByPlatformFee(money(amount), bps);
        expect(r.fee.plus(r.net).toFixed(2)).toBe(money(amount).toFixed(2));
      }
    },
  );

  it("redondea el fee a 2 decimales con ROUND_HALF_UP", () => {
    // 33.33 * 5% = 1.6665 -> 1.67
    const r = splitByPlatformFee(money("33.33"), 500);
    expect(r.fee.toFixed(2)).toBe("1.67");
    expect(r.net.toFixed(2)).toBe("31.66");
  });

  it("nunca produce un neto negativo", () => {
    const r = splitByPlatformFee(money("10"), 10000);
    expect(r.fee.toFixed(2)).toBe("10.00");
    expect(r.net.toFixed(2)).toBe("0.00");
  });

  it("un bps inválido cae al default en vez de calcular cualquier cosa", () => {
    const r = splitByPlatformFee(money("10000"), -5);
    expect(r.feeBps).toBe(500);
    expect(r.fee.toFixed(2)).toBe("500.00");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
cd apps/fotoffice && npx vitest run lib/platform-fee/fee.test.ts
```

Esperado: FAIL — `Cannot find module './fee'`.

- [ ] **Step 3: Implementar**

Crear `apps/fotoffice/lib/platform-fee/fee.ts`:

```ts
import { Prisma } from "@repo/db";

/**
 * Comisión de la plataforma, en puntos básicos (bps): 500 = 5%.
 *
 * Se guardan enteros y no porcentajes decimales por la misma razón por la que el dinero
 * no se guarda en coma flotante: 5,25% es 525, un entero exacto, y no 5.25 con su cola
 * binaria. `@repo/payments` ya usa esta convención (`commissionOverrideBps`).
 */
export const DEFAULT_PLATFORM_FEE_BPS = 500;
export const MAX_PLATFORM_FEE_BPS = 10000;

/** Un bps válido es entero y está entre 0 y 10000 inclusive. El 0 es legítimo. */
export function isValidFeeBps(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_PLATFORM_FEE_BPS
  );
}

/**
 * Resuelve la comisión efectiva.
 *
 * Un valor fuera de rango cae al default en lugar de propagarse: una comisión corrupta
 * en la base no puede traducirse en un cobro corrupto. `0` NO es "sin configurar" —
 * es una comisión de cero, y se respeta.
 */
export function resolvePlatformFeeBps(configured?: number | null): number {
  return isValidFeeBps(configured) ? configured : DEFAULT_PLATFORM_FEE_BPS;
}

/** "5%", "10,5%" — coma decimal, que es lo que se usa en español. */
export function formatFeeBpsAsPercent(bps: number): string {
  const percent = new Prisma.Decimal(bps).div(100);
  const text = percent.toDecimalPlaces(2).toString();
  return `${text.replace(".", ",")}%`;
}

export type FeeSplit = {
  total: Prisma.Decimal;
  fee: Prisma.Decimal;
  net: Prisma.Decimal;
  feeBps: number;
};

/**
 * Parte un monto en comisión y neto.
 *
 * El fee se descuenta del total: quien paga abona `total`, no `total + fee`.
 *
 * El neto se calcula **restando**, nunca multiplicando por el complemento. Multiplicar
 * dos veces y redondear dos veces produce sumas que no cierran contra el total, y eso
 * es plata que aparece o desaparece.
 */
export function splitByPlatformFee(total: Prisma.Decimal, feeBps: number): FeeSplit {
  const bps = resolvePlatformFeeBps(feeBps);
  const fee = total
    .mul(bps)
    .div(MAX_PLATFORM_FEE_BPS)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return { total, fee, net: total.minus(fee), feeBps: bps };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
cd apps/fotoffice && npx vitest run lib/platform-fee/fee.test.ts
```

Esperado: PASS, todos los casos.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/platform-fee/fee.ts apps/fotoffice/lib/platform-fee/fee.test.ts
git commit -m "feat(fotoffice): platform fee arithmetic in basis points"
```

---

## Task 2: Tabla de comisión por workspace y módulo

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260824120000_workspace_module_fee/migration.sql`
- Create: `apps/fotoffice/lib/platform-fee/store.ts`
- Test: `apps/fotoffice/lib/platform-fee/store.test.ts`

**Interfaces:**
- Consumes: `resolvePlatformFeeBps` de Task 1; `prisma` de `@repo/db`
- Produces:
  - `getPlatformFeeBps(workspaceId: string, moduleKey: string): Promise<number>`
  - `getPlatformFeeBpsByModule(workspaceId: string, moduleKeys: string[]): Promise<Map<string, number>>`

- [ ] **Step 1: Agregar el modelo al schema**

En `packages/db/prisma/schema.prisma`, agregar:

```prisma
/// Comisión que retiene la plataforma, por Workspace y por módulo.
/// Sin fila para un par (workspace, módulo) rige el default de 5% — ver
/// `DEFAULT_PLATFORM_FEE_BPS` en apps/fotoffice/lib/platform-fee/fee.ts.
/// Solo la edita SUPER_ADMIN: el dueño del workspace la ve, no la cambia.
model WorkspaceModuleFee {
  id          String   @id @default(cuid())
  workspaceId String
  /// Misma clave que `WorkspaceFeatureModule.moduleKey` y el registry de módulos.
  moduleKey   String
  /// Puntos básicos: 500 = 5%. Entero, nunca porcentaje decimal.
  feeBps      Int
  /// Quién la fijó por última vez. Para poder explicar un cobro meses después.
  updatedByUserId Int?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, moduleKey])
  @@index([workspaceId])
}
```

En el modelo `Workspace`, agregar la relación inversa:

```prisma
  moduleFees WorkspaceModuleFee[]
```

En `CourseSalesWorkspaceSettings`, marcar el campo viejo como deprecado (no se borra en esta etapa: es un campo de dinero, y dejarlo muerto no cuesta nada mientras se verifica la migración):

```prisma
  /// DEPRECADO — ya no se lee. La comisión vive en `WorkspaceModuleFee`.
  /// Se conserva la columna hasta verificar la migración en producción.
  coursesFeePercent  Decimal   @default(10) @db.Decimal(5, 2)
```

- [ ] **Step 2: Generar la migración**

```bash
cd packages/db && npx prisma migrate dev --name workspace_module_fee --create-only
```

Verificar que el SQL generado crea la tabla y el índice único, y **no** contiene ningún `DROP`.

- [ ] **Step 3: Escribir el test que falla**

Crear `apps/fotoffice/lib/platform-fee/store.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, findManyMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return {
    ...actual,
    prisma: {
      workspaceModuleFee: { findUnique: findUniqueMock, findMany: findManyMock },
    },
  };
});

const { getPlatformFeeBps, getPlatformFeeBpsByModule } = await import("./store");

beforeEach(() => {
  findUniqueMock.mockReset();
  findManyMock.mockReset();
});

describe("getPlatformFeeBps", () => {
  it("sin fila devuelve el 5% por defecto", async () => {
    findUniqueMock.mockResolvedValue(null);
    await expect(getPlatformFeeBps("ws-1", "courses-sales")).resolves.toBe(500);
  });

  it("con fila devuelve el valor configurado", async () => {
    findUniqueMock.mockResolvedValue({ feeBps: 1200 });
    await expect(getPlatformFeeBps("ws-1", "courses-sales")).resolves.toBe(1200);
  });

  it("respeta una comisión de cero", async () => {
    findUniqueMock.mockResolvedValue({ feeBps: 0 });
    await expect(getPlatformFeeBps("ws-1", "courses-sales")).resolves.toBe(0);
  });

  it("un valor corrupto en la base cae al default", async () => {
    findUniqueMock.mockResolvedValue({ feeBps: -3 });
    await expect(getPlatformFeeBps("ws-1", "courses-sales")).resolves.toBe(500);
  });

  /**
   * Si la base no responde, cobrar con el default es preferible a romper el checkout:
   * el peor caso es una comisión de 5% en vez de la pactada, no una venta perdida.
   */
  it("si la consulta falla devuelve el default en vez de propagar el error", async () => {
    findUniqueMock.mockRejectedValue(new Error("db caida"));
    await expect(getPlatformFeeBps("ws-1", "courses-sales")).resolves.toBe(500);
  });

  it("busca por la clave compuesta correcta", async () => {
    findUniqueMock.mockResolvedValue(null);
    await getPlatformFeeBps("ws-9", "members");
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { workspaceId_moduleKey: { workspaceId: "ws-9", moduleKey: "members" } },
      select: { feeBps: true },
    });
  });
});

describe("getPlatformFeeBpsByModule", () => {
  it("completa con el default los módulos sin fila", async () => {
    findManyMock.mockResolvedValue([{ moduleKey: "courses-sales", feeBps: 700 }]);
    const map = await getPlatformFeeBpsByModule("ws-1", ["courses-sales", "members"]);
    expect(map.get("courses-sales")).toBe(700);
    expect(map.get("members")).toBe(500);
  });

  it("con lista vacía no consulta la base", async () => {
    const map = await getPlatformFeeBpsByModule("ws-1", []);
    expect(map.size).toBe(0);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Correr el test y verificar que falla**

```bash
cd apps/fotoffice && npx vitest run lib/platform-fee/store.test.ts
```

Esperado: FAIL — `Cannot find module './store'`.

- [ ] **Step 5: Implementar**

Crear `apps/fotoffice/lib/platform-fee/store.ts`:

```ts
import { prisma } from "@repo/db";
import { DEFAULT_PLATFORM_FEE_BPS, resolvePlatformFeeBps } from "./fee";

/**
 * Comisión efectiva de un módulo en un workspace.
 *
 * Punto único de resolución: ningún módulo consulta la tabla por su cuenta, para que no
 * puedan divergir los criterios de fallback.
 *
 * Si la base falla se devuelve el default en vez de propagar el error: el peor caso es
 * cobrar 5% en lugar de lo pactado; propagar sería romper el checkout entero.
 */
export async function getPlatformFeeBps(workspaceId: string, moduleKey: string): Promise<number> {
  try {
    const row = await prisma.workspaceModuleFee.findUnique({
      where: { workspaceId_moduleKey: { workspaceId, moduleKey } },
      select: { feeBps: true },
    });
    return resolvePlatformFeeBps(row?.feeBps);
  } catch {
    return DEFAULT_PLATFORM_FEE_BPS;
  }
}

/** Versión en lote para pantallas que listan varios módulos. Completa los faltantes con el default. */
export async function getPlatformFeeBpsByModule(
  workspaceId: string,
  moduleKeys: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (moduleKeys.length === 0) return result;

  let rows: Array<{ moduleKey: string; feeBps: number }> = [];
  try {
    rows = await prisma.workspaceModuleFee.findMany({
      where: { workspaceId, moduleKey: { in: moduleKeys } },
      select: { moduleKey: true, feeBps: true },
    });
  } catch {
    rows = [];
  }

  const configured = new Map(rows.map((r) => [r.moduleKey, r.feeBps]));
  for (const key of moduleKeys) {
    result.set(key, resolvePlatformFeeBps(configured.get(key)));
  }
  return result;
}
```

- [ ] **Step 6: Correr el test y verificar que pasa**

```bash
cd apps/fotoffice && npx vitest run lib/platform-fee/store.test.ts
```

Esperado: PASS.

- [ ] **Step 7: Aplicar la migración y regenerar el cliente**

```bash
cd packages/db && npx prisma migrate dev && npx prisma generate
```

- [ ] **Step 8: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations apps/fotoffice/lib/platform-fee/store.ts apps/fotoffice/lib/platform-fee/store.test.ts
git commit -m "feat(db): per-workspace per-module platform fee table"
```

---

## Task 3: El cobro de cursos usa el resolver nuevo

**Files:**
- Modify: `apps/fotoffice/app/actions/public-course-enrollment.ts:82-89`
- Test: `apps/fotoffice/app/actions/public-course-enrollment.test.ts` (agregar casos; si no existe, crearlo)

**Interfaces:**
- Consumes: `getPlatformFeeBps` (Task 2), `splitByPlatformFee` (Task 1), `COURSES_SALES_MODULE_KEY` de `@/lib/courses-sales/constants`
- Produces: nada nuevo. `CourseEnrollment` sigue guardando `platformFeePercent`, `platformFeeArs` y `netAmountArs` con los mismos nombres.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `apps/fotoffice/app/actions/public-course-enrollment.test.ts`:

```ts
describe("comisión de la inscripción", () => {
  it("usa la comisión del módulo de cursos, no coursesFeePercent", async () => {
    getPlatformFeeBpsMock.mockResolvedValue(700);
    await createEnrollment({ priceArs: "10000" });

    const data = enrollmentCreateMock.mock.calls[0]?.[0]?.data;
    expect(data.platformFeeArs.toFixed(2)).toBe("700.00");
    expect(data.netAmountArs.toFixed(2)).toBe("9300.00");
    expect(data.platformFeePercent.toFixed(2)).toBe("7.00");
    expect(getPlatformFeeBpsMock).toHaveBeenCalledWith(expect.any(String), "courses-sales");
  });

  it("sin configuración cobra el 5% por defecto", async () => {
    getPlatformFeeBpsMock.mockResolvedValue(500);
    await createEnrollment({ priceArs: "10000" });

    const data = enrollmentCreateMock.mock.calls[0]?.[0]?.data;
    expect(data.platformFeeArs.toFixed(2)).toBe("500.00");
    expect(data.netAmountArs.toFixed(2)).toBe("9500.00");
  });

  it("con comisión cero el neto es el precio completo", async () => {
    getPlatformFeeBpsMock.mockResolvedValue(0);
    await createEnrollment({ priceArs: "10000" });

    const data = enrollmentCreateMock.mock.calls[0]?.[0]?.data;
    expect(data.platformFeeArs.toFixed(2)).toBe("0.00");
    expect(data.netAmountArs.toFixed(2)).toBe("10000.00");
  });

  it("fee + neto siempre da el precio", async () => {
    getPlatformFeeBpsMock.mockResolvedValue(333);
    await createEnrollment({ priceArs: "12345.67" });

    const data = enrollmentCreateMock.mock.calls[0]?.[0]?.data;
    expect(data.platformFeeArs.plus(data.netAmountArs).toFixed(2)).toBe("12345.67");
  });
});
```

Con este mock arriba del archivo:

```ts
const { getPlatformFeeBpsMock } = vi.hoisted(() => ({ getPlatformFeeBpsMock: vi.fn() }));
vi.mock("@/lib/platform-fee/store", () => ({ getPlatformFeeBps: getPlatformFeeBpsMock }));
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
cd apps/fotoffice && npx vitest run app/actions/public-course-enrollment.test.ts
```

Esperado: FAIL — sigue leyendo `coursesFeePercent`, `getPlatformFeeBpsMock` nunca se llama.

- [ ] **Step 3: Implementar**

En `apps/fotoffice/app/actions/public-course-enrollment.ts`, reemplazar el bloque de las líneas 82-89:

```ts
  const settings = await prisma.courseSalesWorkspaceSettings.findUnique({
    where: { workspaceId: branding.workspaceId },
    select: { coursesFeePercent: true },
  });
  const feePercent = settings?.coursesFeePercent ?? new Prisma.Decimal(10);
  const amount = instance.priceArs;
  const fee = amount.mul(feePercent).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const net = amount.minus(fee).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
```

por:

```ts
  // La comisión sale de WorkspaceModuleFee (default 5%), no de coursesFeePercent, que
  // el dueño del workspace podía editar y quedó deprecado.
  const feeBps = await getPlatformFeeBps(branding.workspaceId, COURSES_SALES_MODULE_KEY);
  const amount = instance.priceArs;
  const { fee, net } = splitByPlatformFee(amount, feeBps);
  const feePercent = new Prisma.Decimal(feeBps).div(100);
```

Y agregar los imports:

```ts
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { splitByPlatformFee } from "@/lib/platform-fee/fee";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
cd apps/fotoffice && npx vitest run app/actions/public-course-enrollment.test.ts
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/app/actions/public-course-enrollment.ts apps/fotoffice/app/actions/public-course-enrollment.test.ts
git commit -m "feat(fotoffice): course enrollment reads platform fee from module config"
```

---

## Task 4: El dueño del workspace deja de editar la comisión

**Files:**
- Modify: `apps/fotoffice/app/actions/settings.ts:9-66`
- Modify: `apps/fotoffice/app/(shell)/courses/settings/page.tsx`
- Test: `apps/fotoffice/app/actions/settings.test.ts`

**Interfaces:**
- Consumes: `getPlatformFeeBps` (Task 2), `formatFeeBpsAsPercent` (Task 1)
- Produces: `updateCoursesSalesSettingsAction` con la misma firma; deja de aceptar `coursesFeePercent`.

- [ ] **Step 1: Escribir el test que falla**

El archivo `apps/fotoffice/app/actions/settings.test.ts` ya existe y define sus propios
helpers: el mock del upsert se llama **`courseSettingsUpsertMock`** y el constructor de
formularios **`buildFormData`** (que incluye `coursesFeePercent: "12"` en su base). Usar
esos nombres, no inventar otros.

Primero, **quitar `coursesFeePercent: "12"` de la base de `buildFormData`** (línea 38), ya
que el campo deja de existir.

Después, reemplazar el test `"guarda defaultCurrency/enrollmentCtaLabel/coursesFeePercent en
CourseSalesWorkspaceSettings"` por estos dos:

```ts
it("guarda defaultCurrency y enrollmentCtaLabel", async () => {
  await updateCoursesSalesSettingsAction(undefined, buildFormData({
    defaultCurrency: "ARS",
    enrollmentCtaLabel: "Anotate",
  }));

  const call = courseSettingsUpsertMock.mock.calls[0]?.[0];
  expect(call.update).toEqual({ defaultCurrency: "ARS", enrollmentCtaLabel: "Anotate" });
});

/**
 * La comisión es de la plataforma, no del cliente. Aunque el formulario mande el campo
 * —a mano, con curl, o por un formulario viejo cacheado— la acción no lo escribe.
 */
it("ignora coursesFeePercent aunque venga en el formulario", async () => {
  await updateCoursesSalesSettingsAction(undefined, buildFormData({
    coursesFeePercent: "0",
  }));

  const call = courseSettingsUpsertMock.mock.calls[0]?.[0];
  expect(call.update).not.toHaveProperty("coursesFeePercent");
  expect(call.create).not.toHaveProperty("coursesFeePercent");
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
cd apps/fotoffice && npx vitest run app/actions/settings.test.ts
```

Esperado: FAIL — `update` todavía incluye `coursesFeePercent`.

- [ ] **Step 3: Implementar**

En `apps/fotoffice/app/actions/settings.ts`:

Quitar `coursesFeePercent` del esquema (línea 12):

```ts
const coursesSettingsSchema = z.object({
  defaultCurrency: z.string().min(1).max(8),
  enrollmentCtaLabel: z.string().max(120).optional().nullable(),
});
```

Quitarlo del `raw` (línea 44) y del `upsert` (líneas 58 y 64). Y cambiar el mensaje del guard, que ya no habla de fee:

```ts
  if (!canManageFee) {
    return { error: "Solo owner/admin del workspace puede editar la configuración de cursos." };
  }
```

Renombrar la variable `canManageFee` a `canManageSettings` para que el nombre diga la verdad.

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
cd apps/fotoffice && npx vitest run app/actions/settings.test.ts
```

Esperado: PASS.

- [ ] **Step 5: Mostrar la comisión sin poder editarla**

En `apps/fotoffice/app/(shell)/courses/settings/page.tsx`, reemplazar el input de `coursesFeePercent` por un bloque de solo lectura:

```tsx
<div className="fo-card space-y-1 p-4">
  <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">
    Comisión de la plataforma
  </p>
  <p className="text-lg font-semibold">{formatFeeBpsAsPercent(feeBps)}</p>
  <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
    Se descuenta del total de cada inscripción. La define DNX; si necesitás revisarla,
    escribinos.
  </p>
</div>
```

Cargando el valor en el server component:

```ts
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { formatFeeBpsAsPercent } from "@/lib/platform-fee/fee";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";

const feeBps = await getPlatformFeeBps(workspace.id, COURSES_SALES_MODULE_KEY);
```

- [ ] **Step 6: Verificar que compila**

```bash
cd apps/fotoffice && npx tsc --noEmit
```

Esperado: sin errores nuevos. *(Nota: el repo tiene un error preexistente en `lib/images/isolation`; ignorarlo.)*

- [ ] **Step 7: Commit**

```bash
git add apps/fotoffice/app/actions/settings.ts apps/fotoffice/app/actions/settings.test.ts "apps/fotoffice/app/(shell)/courses/settings/page.tsx"
git commit -m "fix(fotoffice): workspace owner can no longer edit the platform fee"
```

---

## Task 5: El super admin edita la comisión por módulo

**Files:**
- Create: `apps/fotoffice/app/actions/platform-fee-admin.ts`
- Test: `apps/fotoffice/app/actions/platform-fee-admin.test.ts`
- Create: `apps/fotoffice/components/platform-fee/module-fee-field.tsx`
- Modify: `apps/fotoffice/app/(shell)/admin/workspaces/[id]/page.tsx:70-100`

**Interfaces:**
- Consumes: `isFotofficePlatformAdmin` de `@/lib/platform-admin`, `listAvailableModuleKeys` de `@/lib/modules/registry`, `isValidFeeBps` y `formatFeeBpsAsPercent` (Task 1), `getPlatformFeeBpsByModule` (Task 2)
- Produces:
  - `type PlatformFeeState = { error: string | null; ok: string | null }`
  - `setModuleFeeAction(prev: PlatformFeeState | undefined, formData: FormData): Promise<PlatformFeeState>`
  - Campos del formulario: `workspaceId`, `moduleKey`, `feePercent`
  - `<WorkspaceModuleFeeField workspaceId moduleKey feeBps />`

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/fotoffice/app/actions/platform-fee-admin.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAuthMock, isPlatformAdminMock, upsertMock, revalidateMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  isPlatformAdminMock: vi.fn(),
  upsertMock: vi.fn(),
  revalidateMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidateMock }));
vi.mock("@/lib/auth", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/platform-admin", () => ({ isFotofficePlatformAdmin: isPlatformAdminMock }));
vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return { ...actual, prisma: { workspaceModuleFee: { upsert: upsertMock } } };
});

const { setModuleFeeAction } = await import("./platform-fee-admin");

function formOf(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  requireAuthMock.mockReset().mockResolvedValue({ id: 1 });
  isPlatformAdminMock.mockReset().mockResolvedValue(true);
  upsertMock.mockReset().mockResolvedValue({});
  revalidateMock.mockReset();
});

describe("setModuleFeeAction", () => {
  it("guarda 7,5% como 750 puntos básicos", async () => {
    const r = await setModuleFeeAction(undefined, formOf({
      workspaceId: "ws-1", moduleKey: "courses-sales", feePercent: "7,5",
    }));

    expect(r.error).toBeNull();
    expect(upsertMock.mock.calls[0]?.[0]).toMatchObject({
      where: { workspaceId_moduleKey: { workspaceId: "ws-1", moduleKey: "courses-sales" } },
      update: { feeBps: 750, updatedByUserId: 1 },
      create: { workspaceId: "ws-1", moduleKey: "courses-sales", feeBps: 750, updatedByUserId: 1 },
    });
  });

  it("acepta punto además de coma", async () => {
    await setModuleFeeAction(undefined, formOf({
      workspaceId: "ws-1", moduleKey: "courses-sales", feePercent: "7.5",
    }));
    expect(upsertMock.mock.calls[0]?.[0].update.feeBps).toBe(750);
  });

  it("acepta comisión cero", async () => {
    await setModuleFeeAction(undefined, formOf({
      workspaceId: "ws-1", moduleKey: "courses-sales", feePercent: "0",
    }));
    expect(upsertMock.mock.calls[0]?.[0].update.feeBps).toBe(0);
  });

  /** El guard es el punto de todo el cambio: sin esto el cliente vuelve a poder tocarlo. */
  it("rechaza a quien no es super admin y no escribe nada", async () => {
    isPlatformAdminMock.mockResolvedValue(false);
    const r = await setModuleFeeAction(undefined, formOf({
      workspaceId: "ws-1", moduleKey: "courses-sales", feePercent: "0",
    }));

    expect(r.error).toBe("Solo SUPER_ADMIN puede editar la comisión de la plataforma.");
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it.each([
    ["negativa", "-1"],
    ["mayor a 100", "101"],
    ["no numérica", "abc"],
    ["vacía", ""],
    ["con más de 2 decimales", "5,123"],
  ])("rechaza una comisión %s", async (_label, feePercent) => {
    const r = await setModuleFeeAction(undefined, formOf({
      workspaceId: "ws-1", moduleKey: "courses-sales", feePercent,
    }));
    expect(r.error).not.toBeNull();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rechaza un módulo que no está en el registry", async () => {
    const r = await setModuleFeeAction(undefined, formOf({
      workspaceId: "ws-1", moduleKey: "modulo-inventado", feePercent: "5",
    }));
    expect(r.error).toBe("Módulo inválido.");
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
cd apps/fotoffice && npx vitest run app/actions/platform-fee-admin.test.ts
```

Esperado: FAIL — `Cannot find module './platform-fee-admin'`.

- [ ] **Step 3: Implementar la acción**

Crear `apps/fotoffice/app/actions/platform-fee-admin.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { isFotofficePlatformAdmin } from "@/lib/platform-admin";
import { listAvailableModuleKeys } from "@/lib/modules/registry";
import { isValidFeeBps, MAX_PLATFORM_FEE_BPS } from "@/lib/platform-fee/fee";

export type PlatformFeeState = { error: string | null; ok: string | null };

/** Whitelist derivada del registry, igual que en toggleWorkspaceModuleAction. */
const ALLOWED_MODULE_KEYS = new Set(listAvailableModuleKeys());

/**
 * Convierte "7,5" o "7.5" a 750 puntos básicos.
 * Devuelve null si no es un porcentaje válido con hasta 2 decimales.
 */
function parsePercentToBps(raw: string): number | null {
  const text = raw.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return null;
  const bps = Math.round(Number(text) * 100);
  return isValidFeeBps(bps) ? bps : null;
}

/**
 * Fija la comisión de la plataforma para un módulo de un workspace.
 *
 * Solo SUPER_ADMIN: la comisión es de DNX, no del cliente. El dueño del workspace la ve
 * en su configuración pero no puede tocarla — ver `updateCoursesSalesSettingsAction`.
 */
export async function setModuleFeeAction(
  _prev: PlatformFeeState | undefined,
  formData: FormData,
): Promise<PlatformFeeState> {
  const user = await requireAuth();
  if (!(await isFotofficePlatformAdmin(user.id))) {
    return { error: "Solo SUPER_ADMIN puede editar la comisión de la plataforma.", ok: null };
  }

  const workspaceId = formData.get("workspaceId")?.toString()?.trim();
  const moduleKey = formData.get("moduleKey")?.toString()?.trim();
  if (!workspaceId) return { error: "Workspace inválido.", ok: null };
  if (!moduleKey || !ALLOWED_MODULE_KEYS.has(moduleKey)) {
    return { error: "Módulo inválido.", ok: null };
  }

  const bps = parsePercentToBps(formData.get("feePercent")?.toString() ?? "");
  if (bps === null) {
    return {
      error: `Comisión inválida. Usá un número entre 0 y ${MAX_PLATFORM_FEE_BPS / 100}, con hasta 2 decimales.`,
      ok: null,
    };
  }

  await prisma.workspaceModuleFee.upsert({
    where: { workspaceId_moduleKey: { workspaceId, moduleKey } },
    update: { feeBps: bps, updatedByUserId: user.id },
    create: { workspaceId, moduleKey, feeBps: bps, updatedByUserId: user.id },
  });

  revalidatePath(`/admin/workspaces/${workspaceId}`);
  return { error: null, ok: "Comisión actualizada." };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
cd apps/fotoffice && npx vitest run app/actions/platform-fee-admin.test.ts
```

Esperado: PASS.

- [ ] **Step 5: Crear el campo de edición**

Crear `apps/fotoffice/components/platform-fee/module-fee-field.tsx`, siguiendo el patrón de `components/workspace-module-toggle.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { setModuleFeeAction, type PlatformFeeState } from "@/app/actions/platform-fee-admin";

const initial: PlatformFeeState = { error: null, ok: null };

export function WorkspaceModuleFeeField({
  workspaceId,
  moduleKey,
  feeBps,
}: {
  workspaceId: string;
  moduleKey: string;
  feeBps: number;
}) {
  const [state, action, pending] = useActionState(setModuleFeeAction, initial);
  const defaultPercent = (feeBps / 100).toString().replace(".", ",");

  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="moduleKey" value={moduleKey} />
      <label className="flex items-center gap-2">
        <span className="text-xs text-[var(--fo-muted)]">Comisión</span>
        <input
          type="text"
          name="feePercent"
          defaultValue={defaultPercent}
          inputMode="decimal"
          className="fo-input w-20 text-sm"
          aria-label={`Comisión de la plataforma para ${moduleKey}`}
        />
        <span className="text-xs text-[var(--fo-muted)]">%</span>
        <button type="submit" disabled={pending} className="fo-btn text-xs min-h-9 px-3">
          {pending ? "…" : "Guardar"}
        </button>
      </label>
      {state.error ? (
        <span className="block text-xs text-[var(--fo-danger)]">{state.error}</span>
      ) : null}
      {state.ok ? <span className="block text-xs text-[var(--fo-success)]">{state.ok}</span> : null}
    </form>
  );
}
```

- [ ] **Step 6: Mostrarlo en la ficha del workspace**

En `apps/fotoffice/app/(shell)/admin/workspaces/[id]/page.tsx`, cargar las comisiones junto a los módulos habilitados:

```ts
import { getPlatformFeeBpsByModule } from "@/lib/platform-fee/store";
import { WorkspaceModuleFeeField } from "@/components/platform-fee/module-fee-field";

const feeByModule = await getPlatformFeeBpsByModule(
  id,
  availableModules.map((m) => m.key),
);
```

Y dentro de la tarjeta de cada módulo, después del bloque del toggle:

```tsx
<div className="pt-2 border-t border-[var(--fo-border)]">
  <WorkspaceModuleFeeField
    workspaceId={workspace.id}
    moduleKey={m.key}
    feeBps={feeByModule.get(m.key) ?? 500}
  />
</div>
```

- [ ] **Step 7: Verificar que compila**

```bash
cd apps/fotoffice && npx tsc --noEmit
```

Esperado: sin errores nuevos.

- [ ] **Step 8: Commit**

```bash
git add apps/fotoffice/app/actions/platform-fee-admin.ts apps/fotoffice/app/actions/platform-fee-admin.test.ts apps/fotoffice/components/platform-fee/module-fee-field.tsx "apps/fotoffice/app/(shell)/admin/workspaces/[id]/page.tsx"
git commit -m "feat(fotoffice): super admin sets platform fee per workspace and module"
```

---

## Task 6: Desglose de transparencia en las pantallas de precio

**Files:**
- Create: `apps/fotoffice/components/platform-fee/fee-breakdown.tsx`
- Test: `apps/fotoffice/components/platform-fee/fee-breakdown.test.tsx`
- Modify: `apps/fotoffice/app/(shell)/courses/settings/page.tsx` (usarlo donde se fija el precio de un curso)

**Interfaces:**
- Consumes: `splitByPlatformFee`, `formatFeeBpsAsPercent` (Task 1)
- Produces: `<PlatformFeeBreakdown amountArs={string | number} feeBps={number} />`

La spec (§5.2) exige que este texto sea **idéntico en toda pantalla donde se configure un precio**. Por eso vive en un componente único y no se reescribe en cada formulario.

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/fotoffice/components/platform-fee/fee-breakdown.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlatformFeeBreakdown } from "./fee-breakdown";

describe("PlatformFeeBreakdown", () => {
  it("muestra el fee y el neto aproximado", () => {
    render(<PlatformFeeBreakdown amountArs="10000" feeBps={500} />);
    expect(screen.getByText(/5%/)).toBeTruthy();
    expect(screen.getByText(/500,00/)).toBeTruthy();
    expect(screen.getByText(/9\.500,00/)).toBeTruthy();
  });

  /**
   * "Aproximadamente" y la advertencia no son adorno: impuestos y comisión de MercadoPago
   * dependen de la condición fiscal de cada institución. Prometer un neto exacto sería
   * mentirle al dueño del workspace.
   */
  it("aclara que el neto es aproximado y que faltan impuestos y MercadoPago", () => {
    render(<PlatformFeeBreakdown amountArs="10000" feeBps={500} />);
    expect(screen.getByText(/aproximadamente/i)).toBeTruthy();
    expect(screen.getByText(/impuestos/i)).toBeTruthy();
    expect(screen.getByText(/MercadoPago/i)).toBeTruthy();
  });

  it("con importe vacío o cero no muestra nada", () => {
    const { container } = render(<PlatformFeeBreakdown amountArs="" feeBps={500} />);
    expect(container.textContent).toBe("");
  });

  it("con comisión cero dice que no se descuenta comisión", () => {
    render(<PlatformFeeBreakdown amountArs="10000" feeBps={0} />);
    expect(screen.getByText(/sin comisión/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
cd apps/fotoffice && npx vitest run components/platform-fee/fee-breakdown.test.tsx
```

Esperado: FAIL — `Cannot find module './fee-breakdown'`.

- [ ] **Step 3: Implementar**

Crear `apps/fotoffice/components/platform-fee/fee-breakdown.tsx`:

```tsx
import { Prisma } from "@repo/db";
import { formatFeeBpsAsPercent, splitByPlatformFee } from "@/lib/platform-fee/fee";

const arsFormatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatArs(value: Prisma.Decimal): string {
  return arsFormatter.format(Number(value.toFixed(2)));
}

/**
 * Desglose de lo que se lleva la plataforma sobre un precio que el dueño está escribiendo.
 *
 * Fuente única del texto: la spec exige que sea idéntico en toda pantalla donde se
 * configure un precio, para que no haya una que lo muestre y otra que se lo olvide.
 */
export function PlatformFeeBreakdown({
  amountArs,
  feeBps,
}: {
  amountArs: string | number;
  feeBps: number;
}) {
  let total: Prisma.Decimal;
  try {
    total = new Prisma.Decimal(String(amountArs).trim().replace(",", "."));
  } catch {
    return null;
  }
  if (!total.isFinite() || total.lte(0)) return null;

  const { fee, net } = splitByPlatformFee(total, feeBps);

  if (fee.isZero()) {
    return (
      <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
        Sin comisión de plataforma. Recibís aproximadamente <strong>${formatArs(net)}</strong>,
        antes de impuestos y de la comisión de MercadoPago.
      </p>
    );
  }

  return (
    <div className="text-xs text-[var(--fo-muted)] leading-relaxed space-y-0.5">
      <p>
        Fee de plataforma ({formatFeeBpsAsPercent(feeBps)}): <strong>${formatArs(fee)}</strong>
      </p>
      <p>
        Recibís aproximadamente <strong>${formatArs(net)}</strong>.
      </p>
      <p>
        ⚠️ Ese monto es antes de impuestos y de la comisión de MercadoPago, que se descuentan
        aparte.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
cd apps/fotoffice && npx vitest run components/platform-fee/fee-breakdown.test.tsx
```

Esperado: PASS.

*Si `@testing-library/react` no está instalado en la app, instalarlo como devDependency antes de correr: `pnpm --filter fotoffice add -D @testing-library/react @testing-library/jest-dom`.*

- [ ] **Step 5: Usarlo donde se fija el precio de un curso**

El input de precio vive en `apps/fotoffice/components/presential-courses/course-instance-form.tsx:52`:

```tsx
<input id="priceArs" name="priceArs" type="number" min={0} step="0.01" className="fo-input" required />
```

Convertir ese formulario en cliente (si no lo es ya), sostener el valor en estado y
mostrar el desglose debajo del input:

```tsx
"use client";
import { useState } from "react";
import { PlatformFeeBreakdown } from "@/components/platform-fee/fee-breakdown";

// dentro del componente, que ahora recibe feeBps por props:
const [priceArs, setPriceArs] = useState("");

<input
  id="priceArs"
  name="priceArs"
  type="number"
  min={0}
  step="0.01"
  className="fo-input"
  required
  value={priceArs}
  onChange={(e) => setPriceArs(e.target.value)}
/>
<PlatformFeeBreakdown amountArs={priceArs} feeBps={feeBps} />
```

`feeBps` lo calcula el server component que renderiza este formulario, con
`getPlatformFeeBps(workspaceId, COURSES_SALES_MODULE_KEY)`, y se lo pasa por props.

Hacer lo mismo en `course-instance-edit-form.tsx`, que tiene el mismo input.

**Nota:** `PlatformFeeBreakdown` importa `Prisma` de `@repo/db` para la aritmética. Si eso
resulta pesado o incompatible en el bundle de cliente, mover el cálculo a una función que
reciba números y devuelva strings ya formateados, manteniendo el texto en el mismo
componente — lo que la spec exige es que **el texto** sea único, no la aritmética.

- [ ] **Step 6: Verificar la suite completa y el build**

```bash
cd apps/fotoffice && npx vitest run && npx tsc --noEmit
cd ../.. && pnpm --filter fotoffice build
```

Esperado: todos los tests en verde, sin errores de tipos nuevos, build exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/fotoffice/components/platform-fee/ "apps/fotoffice/app/(shell)/courses"
git commit -m "feat(fotoffice): platform fee breakdown on price screens"
```

---

## Verificación final

- [ ] `cd apps/fotoffice && npx vitest run` — toda la suite en verde
- [ ] `npx tsc --noEmit` — sin errores nuevos respecto de la base
- [ ] `pnpm --filter fotoffice build` — exit 0
- [ ] `pnpm lint` — sin problemas nuevos respecto de la base (hay 7 preexistentes en archivos ajenos)
- [ ] Verificar a mano: entrar como super admin a `/admin/workspaces/<id>`, cambiar la comisión de un módulo, y comprobar que se guarda
- [ ] Verificar a mano: entrar como dueño de workspace a `/courses/settings` y comprobar que la comisión se ve pero **no se puede editar**

## Seguimiento posterior

Una vez verificado en producción, **borrar la columna `coursesFeePercent`** de `CourseSalesWorkspaceSettings` en una migración aparte. Se dejó viva a propósito: es un campo de dinero, y borrar una columna no tiene vuelta atrás. Ya no la lee ni la escribe nadie.
