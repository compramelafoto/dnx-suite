# Mercado de cursos — Etapa 1: beneficiarios, motor de reparto, simulador y 5% encima

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el dueño de un curso grabado arme la lista de beneficiarios con sus porcentajes, vea
en vivo cómo se reparte cada venta, que cada beneficiario acepte desde su panel, y que el 5% de la
plataforma se cobre encima del precio de lista.

**Architecture:** un motor de reparto puro (`lib/course-marketplace/reparto.ts`) hace todas las
cuentas en centavos y lo usan el simulador del navegador, el cobro y los tests. Los beneficiarios
son negocios de FOTOFFICE (`CourseBeneficiary`). Con el split de Mercado Pago apagado, sólo se
venden los cursos sin reparto (un solo beneficiario que es el dueño); los demás dicen "Disponible
próximamente". Cada venta congela su reparto en `CourseSaleShare`.

**Tech Stack:** Next 16 (App Router, `params` como `Promise`), Prisma sobre Postgres (Neon),
vitest, React (componentes cliente para el editor y el simulador), Resend vía
`lib/communications/send-email`.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-05-mercado-de-cursos-design.md`
(secciones 1, 2, 3, 4.1, 4.4, 5.1, 5.4, 6 y 7; etapa 1 de la sección 8).

## Global Constraints

- Idioma de todo lo visible y de los comentarios: **español**. Identificadores en español o inglés
  según el archivo (los nuevos de `lib/course-marketplace`, en español).
- Antes de escribir código de Next, leé la guía en `node_modules/next/dist/docs/`. `params` y
  `searchParams` son `Promise`.
- Tests: `pnpm --filter fotoffice test` (un archivo: `pnpm --filter fotoffice test <ruta>`). Vitest
  sólo levanta `lib/**/*.test.ts` y `app/**/*.test.ts`.
- Typecheck: `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`.
  Puede morir por memoria y devolver 0: desconfiá si termina en segundos sin salida.
- **Ninguna dependencia nueva** (el lockfile es de toda la suite).
- Plata en **centavos enteros** dentro del motor; porcentajes en **puntos básicos** (10000 = 100%).
  En la base, montos en `Decimal(12,2)` como el resto del esquema.
- Fechas visibles en hora argentina; montos en pesos.
- **El split de Mercado Pago no se toca en esta etapa**: `lib/payments/split-1n.ts` sigue igual.
- **Un socio y un alumno ven lo mismo que hoy**: nada de esta etapa toca el portal salvo la regla de
  "gratis para socios".
- Migración nueva **sin aplicar** en ninguna base hasta la Task 7 (con aprobación de Daniel).
- Trabajar en el worktree `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite-wt-cursos-e2`, en
  una rama `feat/fotoffice-mercado-cursos-e1` creada desde `origin/main` (el diseño está en
  `docs/fotoffice-mercado-de-cursos`; traer el archivo del spec y de este plan a la rama nueva).

---

## Estructura de archivos

**Nuevos** (rutas relativas a `apps/fotoffice/`):

| Archivo | Responsabilidad |
|---|---|
| `lib/course-marketplace/reparto.ts` (+ test) | El motor: cuánto le toca a cada uno en una venta |
| `lib/course-marketplace/comision-mp.ts` (+ test) | Estimación de la comisión de Mercado Pago para el simulador |
| `lib/course-marketplace/escenarios.ts` (+ test) | Los tres escenarios del simulador, con neto después de MP |
| `lib/course-marketplace/beneficiarios.ts` (+ test) | Reglas: validar la lista, si el curso se vende sin reparto, qué falta |
| `lib/course-marketplace/compra.ts` (+ test) | Montos de una compra de curso grabado con el 5% encima |
| `lib/course-marketplace/aviso-beneficiario.ts` (+ test) | El correo "te sumaron como beneficiario" |
| `lib/course-marketplace/cargar.ts` | Cargar beneficiarios de un curso con nombre y si tienen Mercado Pago conectado (servidor) |
| `lib/course-marketplace/access.ts` | Guarda: dueño o admin del negocio activo (para responder invitaciones) |
| `app/actions/course-beneficiaries.ts` | Guardar la lista, buscar negocios, responder invitaciones |
| `components/course-marketplace/simulador-reparto.tsx` | El simulador "Cómo se reparte" |
| `components/course-marketplace/beneficiarios-editor.tsx` | Editor de la lista, con el simulador en vivo |
| `app/(shell)/dashboard/cursos-compartidos/page.tsx` | Invitaciones y cursos donde el negocio es beneficiario |
| `packages/db/prisma/migrations/20261008120000_mercado_cursos_beneficiarios/migration.sql` | Tablas y columnas nuevas |

**Modificados:** `packages/db/prisma/schema.prisma`, `app/actions/public-course-enrollment.ts`,
`lib/presential-courses/checkout.ts`, `lib/presential-courses/enrollment-workflow.ts`,
`app/actions/presential-courses.ts`, `lib/course-classroom/beneficio.ts`,
`app/(shell)/dashboard/courses/[courseId]/page.tsx`, `app/(shell)/dashboard/page.tsx`,
`components/presential-courses/recorded-course-section.tsx`,
`app/w/[workspaceSlug]/cursos/[courseSlug]/page.tsx`.

---

### Task 1: El motor de reparto y la estimación de Mercado Pago

**Files:**
- Create: `lib/course-marketplace/reparto.ts`, `lib/course-marketplace/reparto.test.ts`
- Create: `lib/course-marketplace/comision-mp.ts`, `lib/course-marketplace/comision-mp.test.ts`

**Interfaces:**
- Produces (`reparto.ts`):
  - `BPS_TOTAL = 10000`, `MAX_RECEPTORES_SPLIT = 11` (dueño de la orden + 10 socios de Mercado Pago)
  - `type BeneficiarioEntrada = { id: string; nombre: string; bps: number; absorbeMp: boolean }`
  - `type ParteDelReparto = { id: string; nombre: string; tipo: "PLATAFORMA" | "REVENDEDOR" | "BENEFICIARIO"; centavos: number; absorbeMp: boolean }`
  - `type EntradaReparto = { listaCentavos: number; comisionPlataformaBps: number; beneficiarios: BeneficiarioEntrada[]; reventa?: { id: string; nombre: string; bps: number } | null; descuentoBps?: number; vendedorId?: string | null }`
  - `type ResultadoReparto = { ok: true; pagaElAlumno: number; comisionPlataforma: number; descuento: number; partes: ParteDelReparto[] } | { ok: false; errores: string[] }`
  - `topeDeDescuentoBps(e: Pick<EntradaReparto, "beneficiarios" | "reventa" | "vendedorId">): number`
  - `calcularReparto(e: EntradaReparto): ResultadoReparto`
  - `formatoPorcentaje(bps: number): string` → `"30%"`, `"12,5%"`
- Produces (`comision-mp.ts`):
  - `TASA_MP_ESTIMADA_BPS = 761`
  - `estimarComisionMp(cobradoCentavos: number, tasaBps?: number): number`

- [ ] **Step 1: Escribir el test del motor**

```ts
// lib/course-marketplace/reparto.test.ts
import { describe, expect, it } from "vitest";
import { calcularReparto, formatoPorcentaje, topeDeDescuentoBps, type BeneficiarioEntrada } from "./reparto";

const L = 10_000_000; // $100.000 en centavos
const benef: BeneficiarioEntrada[] = [
  { id: "sfpr", nombre: "SFPR", bps: 3000, absorbeMp: false },
  { id: "prod", nombre: "Productora", bps: 2000, absorbeMp: false },
  { id: "doc", nombre: "Docente", bps: 5000, absorbeMp: true },
];

function monto(r: ReturnType<typeof calcularReparto>, id: string) {
  if (!r.ok) throw new Error(r.errores.join(" / "));
  return r.partes.find((p) => p.id === id)?.centavos;
}

function sumaCierra(r: ReturnType<typeof calcularReparto>) {
  if (!r.ok) throw new Error(r.errores.join(" / "));
  return r.partes.reduce((s, p) => s + p.centavos, 0) === r.pagaElAlumno;
}

describe("el reparto de una venta", () => {
  it("venta al público: el 5% va encima y cada uno cobra su porcentaje de la lista", () => {
    const r = calcularReparto({ listaCentavos: L, comisionPlataformaBps: 500, beneficiarios: benef, vendedorId: "sfpr" });
    expect(r.ok && r.pagaElAlumno).toBe(10_500_000);
    expect(monto(r, "plataforma")).toBe(500_000);
    expect(monto(r, "sfpr")).toBe(3_000_000);
    expect(monto(r, "prod")).toBe(2_000_000);
    expect(monto(r, "doc")).toBe(5_000_000);
    expect(sumaCierra(r)).toBe(true);
  });

  it("el que vende regala su parte: sólo él deja de cobrar, el 5% sigue sobre la lista", () => {
    const r = calcularReparto({ listaCentavos: L, comisionPlataformaBps: 500, beneficiarios: benef, vendedorId: "sfpr", descuentoBps: 3000 });
    expect(r.ok && r.pagaElAlumno).toBe(7_500_000);
    expect(r.ok && r.descuento).toBe(3_000_000);
    expect(monto(r, "sfpr")).toBe(0);
    expect(monto(r, "prod")).toBe(2_000_000);
    expect(monto(r, "doc")).toBe(5_000_000);
    expect(sumaCierra(r)).toBe(true);
  });

  it("reventa: el % del revendedor sale de arriba y el resto se reparte en proporción", () => {
    const r = calcularReparto({
      listaCentavos: L,
      comisionPlataformaBps: 500,
      beneficiarios: benef,
      reventa: { id: "club", nombre: "Fotoclub", bps: 2500 },
    });
    expect(monto(r, "club")).toBe(2_500_000);
    expect(monto(r, "sfpr")).toBe(2_250_000);
    expect(monto(r, "prod")).toBe(1_500_000);
    expect(monto(r, "doc")).toBe(3_750_000);
    expect(sumaCierra(r)).toBe(true);
  });

  it("reventa con descuento: el descuento sale sólo del revendedor", () => {
    const r = calcularReparto({
      listaCentavos: L,
      comisionPlataformaBps: 500,
      beneficiarios: benef,
      reventa: { id: "club", nombre: "Fotoclub", bps: 2500 },
      descuentoBps: 2500,
    });
    expect(r.ok && r.pagaElAlumno).toBe(8_000_000);
    expect(monto(r, "club")).toBe(0);
    expect(monto(r, "doc")).toBe(3_750_000);
    expect(sumaCierra(r)).toBe(true);
  });

  it("un solo beneficiario cobra toda la lista", () => {
    const r = calcularReparto({
      listaCentavos: L,
      comisionPlataformaBps: 500,
      beneficiarios: [{ id: "maxi", nombre: "Maxi", bps: 10000, absorbeMp: true }],
      vendedorId: "maxi",
    });
    expect(monto(r, "maxi")).toBe(L);
    expect(sumaCierra(r)).toBe(true);
  });

  it("los centavos que sobran por redondeo van a quien absorbe Mercado Pago", () => {
    const r = calcularReparto({
      listaCentavos: 10_001,
      comisionPlataformaBps: 500,
      beneficiarios: [
        { id: "a", nombre: "A", bps: 3333, absorbeMp: false },
        { id: "b", nombre: "B", bps: 3333, absorbeMp: false },
        { id: "c", nombre: "C", bps: 3334, absorbeMp: true },
      ],
      vendedorId: "a",
    });
    expect(monto(r, "a")).toBe(3333);
    expect(monto(r, "b")).toBe(3333);
    expect(monto(r, "c")).toBe(3335);
    expect(sumaCierra(r)).toBe(true);
  });

  it("la suma cierra siempre, con precios y porcentajes incómodos", () => {
    for (const lista of [1, 99, 12_345, 9_999_999, 123_456_789]) {
      for (const desc of [0, 1, 777, 3000]) {
        const r = calcularReparto({ listaCentavos: lista, comisionPlataformaBps: 500, beneficiarios: benef, vendedorId: "sfpr", descuentoBps: desc });
        expect(sumaCierra(r)).toBe(true);
        const rv = calcularReparto({ listaCentavos: lista, comisionPlataformaBps: 500, beneficiarios: benef, reventa: { id: "x", nombre: "X", bps: 3100 }, descuentoBps: desc });
        expect(sumaCierra(rv)).toBe(true);
      }
    }
  });

  it("ninguna parte queda negativa", () => {
    const r = calcularReparto({ listaCentavos: 99, comisionPlataformaBps: 500, beneficiarios: benef, vendedorId: "sfpr", descuentoBps: 3000 });
    expect(r.ok && r.partes.every((p) => p.centavos >= 0)).toBe(true);
  });
});

describe("lo que el motor rechaza", () => {
  const base = { listaCentavos: L, comisionPlataformaBps: 500, vendedorId: "sfpr" };

  it("porcentajes que no suman 100%", () => {
    const r = calcularReparto({ ...base, beneficiarios: benef.map((b) => (b.id === "doc" ? { ...b, bps: 4500 } : b)) });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errores.join()).toMatch(/suman 95%/);
  });

  it("nadie o dos que absorben Mercado Pago", () => {
    expect(calcularReparto({ ...base, beneficiarios: benef.map((b) => ({ ...b, absorbeMp: false })) }).ok).toBe(false);
    expect(calcularReparto({ ...base, beneficiarios: benef.map((b) => ({ ...b, absorbeMp: true })) }).ok).toBe(false);
  });

  it("un descuento mayor que la parte de quien vende", () => {
    const r = calcularReparto({ ...base, beneficiarios: benef, descuentoBps: 3500 });
    expect(!r.ok && r.errores.join()).toMatch(/no puede superar 30%/);
  });

  it("precio cero o negativo", () => {
    expect(calcularReparto({ ...base, beneficiarios: benef, listaCentavos: 0 }).ok).toBe(false);
  });

  it("más receptores de los que acepta Mercado Pago", () => {
    const muchos = Array.from({ length: 12 }, (_, i) => ({ id: `b${i}`, nombre: `B${i}`, bps: i === 0 ? 10000 - 11 * 800 : 800, absorbeMp: i === 0 }));
    expect(calcularReparto({ ...base, beneficiarios: muchos, vendedorId: "b0" }).ok).toBe(false);
  });
});

describe("ayudantes", () => {
  it("tope del descuento: con reventa es su %, sin reventa la parte de quien vende", () => {
    expect(topeDeDescuentoBps({ beneficiarios: benef, reventa: { id: "x", nombre: "X", bps: 2500 } })).toBe(2500);
    expect(topeDeDescuentoBps({ beneficiarios: benef, vendedorId: "sfpr" })).toBe(3000);
    expect(topeDeDescuentoBps({ beneficiarios: benef, vendedorId: "nadie" })).toBe(0);
  });

  it("formato del porcentaje", () => {
    expect(formatoPorcentaje(3000)).toBe("30%");
    expect(formatoPorcentaje(1250)).toBe("12,5%");
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/course-marketplace/reparto.test.ts`
Expected: FAIL — `Failed to resolve import "./reparto"`.

- [ ] **Step 3: Implementar el motor**

```ts
// lib/course-marketplace/reparto.ts
/**
 * Cuánto le toca a cada uno en una venta de un curso. Puro: sin base, sin red.
 *
 * Lo usan el simulador (en el navegador), el cobro y los tests: lo que ve el dueño mientras carga
 * el precio es exactamente lo que después se cobra (spec del mercado de cursos, sección 2).
 *
 * Reglas:
 * - El 5% de la plataforma se calcula sobre el precio de LISTA y se cobra encima al comprador.
 * - Con reventa, el % del revendedor sale de arriba y el resto se reparte entre los beneficiarios.
 * - El descuento sale sólo de la parte de quien vende (el revendedor, o el beneficiario que vende)
 *   y nunca la supera.
 * - Los centavos que sobran por redondeo van a quien absorbe la comisión de Mercado Pago.
 * - La comisión de Mercado Pago no la calcula el motor: la descuenta MP al acreditar.
 */

export const BPS_TOTAL = 10000;
/** El dueño de la orden de Mercado Pago más hasta 10 socios del split. */
export const MAX_RECEPTORES_SPLIT = 11;

export type BeneficiarioEntrada = { id: string; nombre: string; bps: number; absorbeMp: boolean };

export type ParteDelReparto = {
  id: string;
  nombre: string;
  tipo: "PLATAFORMA" | "REVENDEDOR" | "BENEFICIARIO";
  centavos: number;
  absorbeMp: boolean;
};

export type EntradaReparto = {
  listaCentavos: number;
  comisionPlataformaBps: number;
  beneficiarios: BeneficiarioEntrada[];
  reventa?: { id: string; nombre: string; bps: number } | null;
  descuentoBps?: number;
  /** Sin reventa: el beneficiario que vende, de cuya parte sale el descuento. */
  vendedorId?: string | null;
};

export type ResultadoReparto =
  | { ok: true; pagaElAlumno: number; comisionPlataforma: number; descuento: number; partes: ParteDelReparto[] }
  | { ok: false; errores: string[] };

export function formatoPorcentaje(bps: number): string {
  const valor = bps / 100;
  return `${Number.isInteger(valor) ? valor : valor.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`;
}

function porcion(centavos: number, bps: number): number {
  return Math.round((centavos * bps) / BPS_TOTAL);
}

export function topeDeDescuentoBps(e: Pick<EntradaReparto, "beneficiarios" | "reventa" | "vendedorId">): number {
  if (e.reventa) return e.reventa.bps;
  return e.beneficiarios.find((b) => b.id === e.vendedorId)?.bps ?? 0;
}

function validar(e: EntradaReparto): string[] {
  const errores: string[] = [];
  if (!Number.isInteger(e.listaCentavos) || e.listaCentavos <= 0) {
    errores.push("El precio de lista tiene que ser mayor que cero.");
  }
  if (!Number.isInteger(e.comisionPlataformaBps) || e.comisionPlataformaBps < 0 || e.comisionPlataformaBps > BPS_TOTAL) {
    errores.push("La comisión de la plataforma no es válida.");
  }
  if (e.beneficiarios.length === 0) {
    errores.push("Tiene que haber al menos un beneficiario.");
  } else if (e.beneficiarios.some((b) => !Number.isInteger(b.bps) || b.bps <= 0)) {
    errores.push("Cada beneficiario tiene que tener un porcentaje mayor que cero.");
  } else {
    const suma = e.beneficiarios.reduce((s, b) => s + b.bps, 0);
    if (suma !== BPS_TOTAL) errores.push(`Los porcentajes suman ${formatoPorcentaje(suma)}: tienen que sumar 100%.`);
  }
  if (e.beneficiarios.length > 0 && e.beneficiarios.filter((b) => b.absorbeMp).length !== 1) {
    errores.push("Un beneficiario, y sólo uno, tiene que absorber la comisión de Mercado Pago.");
  }
  if (e.beneficiarios.length + (e.reventa ? 1 : 0) > MAX_RECEPTORES_SPLIT) {
    errores.push(`Mercado Pago reparte entre ${MAX_RECEPTORES_SPLIT} cuentas como máximo, contando al revendedor.`);
  }
  if (e.reventa && (!Number.isInteger(e.reventa.bps) || e.reventa.bps <= 0 || e.reventa.bps >= BPS_TOTAL)) {
    errores.push("El porcentaje del revendedor no es válido.");
  }
  const descuentoBps = e.descuentoBps ?? 0;
  if (!Number.isInteger(descuentoBps) || descuentoBps < 0) {
    errores.push("El descuento no es válido.");
  } else {
    const tope = topeDeDescuentoBps(e);
    if (descuentoBps > tope) {
      errores.push(`El descuento no puede superar ${formatoPorcentaje(tope)}: es la parte de quien vende.`);
    }
  }
  return errores;
}

export function calcularReparto(e: EntradaReparto): ResultadoReparto {
  const errores = validar(e);
  if (errores.length > 0) return { ok: false, errores };

  const lista = e.listaCentavos;
  const comisionPlataforma = porcion(lista, e.comisionPlataformaBps);
  const descuentoPedido = porcion(lista, e.descuentoBps ?? 0);

  let aRepartir = lista;
  let revendedor: ParteDelReparto | null = null;
  if (e.reventa) {
    const parte = porcion(lista, e.reventa.bps);
    aRepartir = lista - parte;
    revendedor = { id: e.reventa.id, nombre: e.reventa.nombre, tipo: "REVENDEDOR", centavos: parte, absorbeMp: false };
  }

  const beneficiarios: ParteDelReparto[] = e.beneficiarios.map((b) => ({
    id: b.id,
    nombre: b.nombre,
    tipo: "BENEFICIARIO",
    centavos: Math.floor((aRepartir * b.bps) / BPS_TOTAL),
    absorbeMp: b.absorbeMp,
  }));
  const sobrante = aRepartir - beneficiarios.reduce((s, p) => s + p.centavos, 0);
  beneficiarios.find((p) => p.absorbeMp)!.centavos += sobrante;

  // El descuento sale sólo de quien vende y nunca la supera (los redondeos no la dejan negativa).
  const deQuien = revendedor ?? beneficiarios.find((p) => p.id === e.vendedorId) ?? null;
  const descuento = deQuien ? Math.min(descuentoPedido, deQuien.centavos) : 0;
  if (deQuien) deQuien.centavos -= descuento;

  const partes: ParteDelReparto[] = [
    ...(revendedor ? [revendedor] : []),
    ...beneficiarios,
    { id: "plataforma", nombre: "Plataforma", tipo: "PLATAFORMA", centavos: comisionPlataforma, absorbeMp: false },
  ];
  return { ok: true, pagaElAlumno: lista - descuento + comisionPlataforma, comisionPlataforma, descuento, partes };
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `pnpm --filter fotoffice test lib/course-marketplace/reparto.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 5: Test y código de la estimación de Mercado Pago**

```ts
// lib/course-marketplace/comision-mp.test.ts
import { describe, expect, it } from "vitest";
import { estimarComisionMp, TASA_MP_ESTIMADA_BPS } from "./comision-mp";

describe("estimación de la comisión de Mercado Pago", () => {
  it("se calcula sobre lo que paga el alumno, con la tasa por defecto", () => {
    expect(TASA_MP_ESTIMADA_BPS).toBe(761);
    expect(estimarComisionMp(10_500_000)).toBe(799_050);
  });

  it("acepta otra tasa", () => {
    expect(estimarComisionMp(10_000, 500)).toBe(500);
  });
});
```

```ts
// lib/course-marketplace/comision-mp.ts
/**
 * Estimación de la comisión de Mercado Pago, sólo para mostrar en el simulador.
 *
 * La comisión real la descuenta Mercado Pago al acreditar; esta tasa es la de Checkout,
 * acreditación inmediata, en Argentina: 6,29% + IVA = 7,61%. Revisarla contra la tabla vigente
 * de Mercado Pago cuando cambie. La pantalla siempre la presenta como estimada.
 */
export const TASA_MP_ESTIMADA_BPS = 761;

export function estimarComisionMp(cobradoCentavos: number, tasaBps: number = TASA_MP_ESTIMADA_BPS): number {
  return Math.round((cobradoCentavos * tasaBps) / 10000);
}
```

Run: `pnpm --filter fotoffice test lib/course-marketplace` → PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/course-marketplace
git commit -m "Mercado de cursos: el motor de reparto y la estimación de Mercado Pago"
```

---

### Task 2: Datos y reglas de los beneficiarios

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20261008120000_mercado_cursos_beneficiarios/migration.sql`
- Create: `lib/course-marketplace/beneficiarios.ts`, `lib/course-marketplace/beneficiarios.test.ts`

**Interfaces:**
- Consumes: `BeneficiarioEntrada`, `BPS_TOTAL`, `MAX_RECEPTORES_SPLIT`, `formatoPorcentaje` (Task 1).
- Produces (esquema):
  - `enum CourseBeneficiaryRole { DOCENTE PRODUCTOR INSTITUCION OTRO }`
  - `enum CourseBeneficiaryStatus { INVITADO ACEPTADO RECHAZADO }`
  - `enum CourseSaleShareKind { PLATAFORMA REVENDEDOR BENEFICIARIO }`
  - `CourseBeneficiary { id, courseId, workspaceId String?, invitedEmail String?, role, shareBps Int, absorbsProcessorFee Boolean, status, respondedAt DateTime?, createdAt, updatedAt }` con `@@unique([courseId, workspaceId])`, `@@index([workspaceId, status])`, `@@index([invitedEmail])`.
  - `CourseSaleShare { id, enrollmentId, workspaceId String?, kind CourseSaleShareKind, label String, amountArs Decimal(12,2), absorbsProcessorFee Boolean, createdAt }` con `@@index([enrollmentId])`, `@@index([workspaceId])`.
  - `CourseEnrollment.listPriceArs Decimal(12,2)?` y `CourseEnrollment.discountArs Decimal(12,2)?`.
- Produces (`beneficiarios.ts`):
  - `type BeneficiarioRegistrado = { id: string; workspaceId: string | null; invitedEmail: string | null; nombre: string; role: "DOCENTE" | "PRODUCTOR" | "INSTITUCION" | "OTRO"; shareBps: number; absorbsProcessorFee: boolean; status: "INVITADO" | "ACEPTADO" | "RECHAZADO"; mpConectado: boolean }`
  - `type FilaBeneficiario = { id?: string; workspaceId: string | null; invitedEmail: string | null; role: BeneficiarioRegistrado["role"]; shareBps: number; absorbsProcessorFee: boolean }`
  - `validarFilas(filas: FilaBeneficiario[]): string[]` — errores; vacía = válida.
  - `beneficiariosParaMotor(owner: { workspaceId: string; nombre: string }, registrados: Array<Pick<BeneficiarioRegistrado, "id" | "workspaceId" | "nombre" | "shareBps" | "absorbsProcessorFee">>): BeneficiarioEntrada[]` — sin filas, el dueño al 100%.
  - `esSinReparto(ownerWorkspaceId: string, registrados: Array<Pick<BeneficiarioRegistrado, "workspaceId" | "shareBps">>): boolean`
  - `type EstadoDeVenta = { tipo: "SIN_REPARTO" } | { tipo: "CON_REPARTO"; listo: boolean; faltantes: string[] }`
  - `estadoDeVenta(ownerWorkspaceId: string, registrados: BeneficiarioRegistrado[]): EstadoDeVenta`

- [ ] **Step 1: El esquema**

Junto a los demás enums de cursos:

```prisma
enum CourseBeneficiaryRole {
  DOCENTE
  PRODUCTOR
  INSTITUCION
  OTRO
}

enum CourseBeneficiaryStatus {
  INVITADO
  ACEPTADO
  RECHAZADO
}

enum CourseSaleShareKind {
  PLATAFORMA
  REVENDEDOR
  BENEFICIARIO
}
```

Después de `model CourseLessonProgress`:

```prisma
/// Quién cobra una parte de cada venta de un curso (spec del mercado de cursos, sección 4.1).
///
/// Es un negocio de FOTOFFICE (`workspaceId`), o un correo invitado que todavía no tiene negocio:
/// al aceptar se completa `workspaceId`. Sin filas, el dueño del curso cobra el 100%.
model CourseBeneficiary {
  id                  String                  @id @default(cuid())
  courseId            String
  workspaceId         String?
  invitedEmail        String?
  role                CourseBeneficiaryRole
  /// Puntos básicos: 10000 = 100%. La lista de un curso suma 10000.
  shareBps            Int
  /// Absorbe la comisión de Mercado Pago. Uno solo por curso.
  absorbsProcessorFee Boolean                 @default(false)
  status              CourseBeneficiaryStatus @default(INVITADO)
  respondedAt         DateTime?
  createdAt           DateTime                @default(now())
  updatedAt           DateTime                @updatedAt
  course              Course                  @relation(fields: [courseId], references: [id], onDelete: Cascade)
  workspace           Workspace?              @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([courseId, workspaceId])
  @@index([workspaceId, status])
  @@index([invitedEmail])
}

/// El reparto congelado de una venta: una fila por parte, con el monto en pesos. Si después
/// cambian los porcentajes, lo ya vendido no cambia (spec, sección 2.3).
model CourseSaleShare {
  id                  String              @id @default(cuid())
  enrollmentId        String
  workspaceId         String?
  kind                CourseSaleShareKind
  /// Nombre del negocio al momento de la venta, para mostrarlo aunque después cambie.
  label               String
  amountArs           Decimal             @db.Decimal(12, 2)
  absorbsProcessorFee Boolean             @default(false)
  createdAt           DateTime            @default(now())
  enrollment          CourseEnrollment    @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  workspace           Workspace?          @relation(fields: [workspaceId], references: [id], onDelete: SetNull)

  @@index([enrollmentId])
  @@index([workspaceId])
}
```

Relaciones inversas: en `Course` → `beneficiaries CourseBeneficiary[]`; en `CourseEnrollment` →
`saleShares CourseSaleShare[]`; en `Workspace` → `courseBeneficiaries CourseBeneficiary[]` y
`courseSaleShares CourseSaleShare[]`.

En `CourseEnrollment`, junto a `amountArs`:

```prisma
  /// Precio de lista al momento de la compra. Si no es null, el 5% de la plataforma se cobró
  /// ENCIMA (cursos grabados desde el mercado de cursos): `amountArs` = lista − descuento + 5%.
  listPriceArs           Decimal?                      @db.Decimal(12, 2)
  discountArs            Decimal?                      @db.Decimal(12, 2)
```

- [ ] **Step 2: Validar, generar y armar la migración**

Desde `packages/db` (con `DATABASE_URL`/`DIRECT_URL` falsas si las pide; no se conecta):

```bash
pnpm exec prisma validate && pnpm exec prisma generate
git show origin/main:packages/db/prisma/schema.prisma > /private/tmp/claude-501/schema-main.prisma
pnpm exec prisma migrate diff --from-schema-datamodel /private/tmp/claude-501/schema-main.prisma --to-schema-datamodel prisma/schema.prisma --script
```

Guardá la salida en `prisma/migrations/20261008120000_mercado_cursos_beneficiarios/migration.sql`.
Tiene que tener **sólo**: los 3 enums nuevos, las tablas `CourseBeneficiary` y `CourseSaleShare`
con sus índices y claves foráneas, y las dos columnas nuevas de `CourseEnrollment`. Ningún `DROP`.
Si la última migración de `origin/main` es posterior a `20261008120000`, renombrá la carpeta a una
fecha posterior. **No la apliques en ninguna base.**

- [ ] **Step 3: Test de las reglas**

```ts
// lib/course-marketplace/beneficiarios.test.ts
import { describe, expect, it } from "vitest";
import {
  beneficiariosParaMotor,
  esSinReparto,
  estadoDeVenta,
  validarFilas,
  type BeneficiarioRegistrado,
  type FilaBeneficiario,
} from "./beneficiarios";

const owner = { workspaceId: "ws-sfpr", nombre: "SFPR" };

function reg(p: Partial<BeneficiarioRegistrado> & { id: string }): BeneficiarioRegistrado {
  return {
    workspaceId: `ws-${p.id}`,
    invitedEmail: null,
    nombre: p.id,
    role: "OTRO",
    shareBps: 5000,
    absorbsProcessorFee: false,
    status: "ACEPTADO",
    mpConectado: true,
    ...p,
  };
}

describe("validar la lista que arma el dueño", () => {
  const fila = (p: Partial<FilaBeneficiario>): FilaBeneficiario => ({
    workspaceId: "ws-a",
    invitedEmail: null,
    role: "DOCENTE",
    shareBps: 10000,
    absorbsProcessorFee: true,
    ...p,
  });

  it("una lista correcta no tiene errores", () => {
    expect(validarFilas([fila({ shareBps: 7000 }), fila({ workspaceId: "ws-b", role: "PRODUCTOR", shareBps: 3000, absorbsProcessorFee: false })])).toEqual([]);
  });

  it("cada fila es un negocio o un correo, no las dos cosas ni ninguna", () => {
    expect(validarFilas([fila({ workspaceId: null })]).join()).toMatch(/negocio o un correo/);
    expect(validarFilas([fila({ invitedEmail: "a@b.com" })]).join()).toMatch(/negocio o un correo/);
  });

  it("un correo inválido", () => {
    expect(validarFilas([fila({ workspaceId: null, invitedEmail: "no-es" })]).join()).toMatch(/correo/);
  });

  it("el mismo negocio o el mismo correo dos veces", () => {
    expect(validarFilas([fila({ shareBps: 5000 }), fila({ shareBps: 5000, absorbsProcessorFee: false })]).join()).toMatch(/repetido/);
  });

  it("suma distinta de 100% y absorbe MP", () => {
    expect(validarFilas([fila({ shareBps: 9000 })]).join()).toMatch(/suman 90%/);
    expect(validarFilas([fila({ absorbsProcessorFee: false })]).join()).toMatch(/absorber/);
  });

  it("más de 11 beneficiarios", () => {
    const filas = Array.from({ length: 12 }, (_, i) => fila({ workspaceId: `ws-${i}`, shareBps: i === 0 ? 10000 - 11 * 800 : 800, absorbsProcessorFee: i === 0 }));
    expect(validarFilas(filas).join()).toMatch(/como máximo/);
  });
});

describe("si un curso se vende sin reparto", () => {
  it("sin filas: el dueño al 100%", () => {
    expect(esSinReparto("ws-sfpr", [])).toBe(true);
    expect(beneficiariosParaMotor(owner, [])).toEqual([{ id: "ws-sfpr", nombre: "SFPR", bps: 10000, absorbeMp: true }]);
  });

  it("una sola fila que es el dueño al 100%", () => {
    expect(esSinReparto("ws-sfpr", [{ workspaceId: "ws-sfpr", shareBps: 10000 }])).toBe(true);
  });

  it("cualquier otro caso tiene reparto", () => {
    expect(esSinReparto("ws-sfpr", [{ workspaceId: "ws-maxi", shareBps: 10000 }])).toBe(false);
    expect(esSinReparto("ws-sfpr", [{ workspaceId: "ws-sfpr", shareBps: 3000 }, { workspaceId: "ws-maxi", shareBps: 7000 }])).toBe(false);
  });
});

describe("qué falta para vender con reparto", () => {
  it("sin reparto se vende hoy", () => {
    expect(estadoDeVenta("ws-sfpr", [])).toEqual({ tipo: "SIN_REPARTO" });
  });

  it("todo aceptado y conectado: listo", () => {
    const lista = [reg({ id: "a", absorbsProcessorFee: true }), reg({ id: "b" })];
    expect(estadoDeVenta("ws-sfpr", lista)).toEqual({ tipo: "CON_REPARTO", listo: true, faltantes: [] });
  });

  it("dice quién falta y por qué", () => {
    const lista = [
      reg({ id: "a", absorbsProcessorFee: true, status: "INVITADO" }),
      reg({ id: "b", mpConectado: false }),
      reg({ id: "c", status: "RECHAZADO", shareBps: 0 }),
    ];
    const e = estadoDeVenta("ws-sfpr", lista);
    expect(e.tipo === "CON_REPARTO" && e.listo).toBe(false);
    const texto = e.tipo === "CON_REPARTO" ? e.faltantes.join(" | ") : "";
    expect(texto).toMatch(/a todavía no aceptó/);
    expect(texto).toMatch(/b no conectó Mercado Pago/);
    expect(texto).toMatch(/c rechazó/);
  });
});
```

Run: `pnpm --filter fotoffice test lib/course-marketplace/beneficiarios.test.ts` → FAIL (no existe).

- [ ] **Step 4: Implementar las reglas**

```ts
// lib/course-marketplace/beneficiarios.ts
import { BPS_TOTAL, MAX_RECEPTORES_SPLIT, formatoPorcentaje, type BeneficiarioEntrada } from "./reparto";

/**
 * Reglas de los beneficiarios de un curso. Puras.
 *
 * Un curso sin filas, o con una sola que es su dueño al 100%, es "sin reparto": se vende como hoy,
 * sin split. Cualquier otro caso necesita el split de Mercado Pago (apagado hasta que MP lo
 * habilite) y que todos hayan aceptado y conectado su Mercado Pago.
 */

export type RolBeneficiario = "DOCENTE" | "PRODUCTOR" | "INSTITUCION" | "OTRO";

export type BeneficiarioRegistrado = {
  id: string;
  workspaceId: string | null;
  invitedEmail: string | null;
  nombre: string;
  role: RolBeneficiario;
  shareBps: number;
  absorbsProcessorFee: boolean;
  status: "INVITADO" | "ACEPTADO" | "RECHAZADO";
  mpConectado: boolean;
};

export type FilaBeneficiario = {
  id?: string;
  workspaceId: string | null;
  invitedEmail: string | null;
  role: RolBeneficiario;
  shareBps: number;
  absorbsProcessorFee: boolean;
};

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarFilas(filas: FilaBeneficiario[]): string[] {
  const errores: string[] = [];
  if (filas.length === 0) return ["Tiene que haber al menos un beneficiario."];
  if (filas.length > MAX_RECEPTORES_SPLIT) {
    errores.push(`Un curso puede tener ${MAX_RECEPTORES_SPLIT} beneficiarios como máximo.`);
  }
  const vistos = new Set<string>();
  for (const f of filas) {
    const tieneNegocio = Boolean(f.workspaceId);
    const tieneCorreo = Boolean(f.invitedEmail?.trim());
    if (tieneNegocio === tieneCorreo) {
      errores.push("Cada beneficiario es un negocio de FOTOFFICE o un correo invitado, uno de los dos.");
      continue;
    }
    if (tieneCorreo && !CORREO.test(f.invitedEmail!.trim())) {
      errores.push(`"${f.invitedEmail}" no parece un correo.`);
    }
    const clave = tieneNegocio ? `ws:${f.workspaceId}` : `mail:${f.invitedEmail!.trim().toLowerCase()}`;
    if (vistos.has(clave)) errores.push("Hay un beneficiario repetido.");
    vistos.add(clave);
    if (!Number.isInteger(f.shareBps) || f.shareBps <= 0) {
      errores.push("Cada beneficiario tiene que tener un porcentaje mayor que cero.");
    }
  }
  const suma = filas.reduce((s, f) => s + f.shareBps, 0);
  if (suma !== BPS_TOTAL) errores.push(`Los porcentajes suman ${formatoPorcentaje(suma)}: tienen que sumar 100%.`);
  if (filas.filter((f) => f.absorbsProcessorFee).length !== 1) {
    errores.push("Un beneficiario, y sólo uno, tiene que absorber la comisión de Mercado Pago.");
  }
  return [...new Set(errores)];
}

export function esSinReparto(
  ownerWorkspaceId: string,
  registrados: Array<Pick<BeneficiarioRegistrado, "workspaceId" | "shareBps">>,
): boolean {
  if (registrados.length === 0) return true;
  return registrados.length === 1 && registrados[0].workspaceId === ownerWorkspaceId && registrados[0].shareBps === BPS_TOTAL;
}

export function beneficiariosParaMotor(
  owner: { workspaceId: string; nombre: string },
  registrados: Array<Pick<BeneficiarioRegistrado, "id" | "workspaceId" | "nombre" | "shareBps" | "absorbsProcessorFee">>,
): BeneficiarioEntrada[] {
  if (registrados.length === 0) {
    return [{ id: owner.workspaceId, nombre: owner.nombre, bps: BPS_TOTAL, absorbeMp: true }];
  }
  return registrados.map((r) => ({
    id: r.workspaceId ?? r.id,
    nombre: r.nombre,
    bps: r.shareBps,
    absorbeMp: r.absorbsProcessorFee,
  }));
}

export type EstadoDeVenta = { tipo: "SIN_REPARTO" } | { tipo: "CON_REPARTO"; listo: boolean; faltantes: string[] };

export function estadoDeVenta(ownerWorkspaceId: string, registrados: BeneficiarioRegistrado[]): EstadoDeVenta {
  if (esSinReparto(ownerWorkspaceId, registrados)) return { tipo: "SIN_REPARTO" };
  const faltantes: string[] = [];
  for (const r of registrados) {
    if (r.status === "RECHAZADO") faltantes.push(`${r.nombre} rechazó ser beneficiario.`);
    else if (r.status === "INVITADO") faltantes.push(`${r.nombre} todavía no aceptó.`);
    else if (!r.mpConectado) faltantes.push(`${r.nombre} no conectó Mercado Pago.`);
  }
  faltantes.push(...validarFilas(registrados).filter((e) => !e.includes("negocio o un correo")));
  return { tipo: "CON_REPARTO", listo: faltantes.length === 0, faltantes };
}
```

Run: `pnpm --filter fotoffice test lib/course-marketplace` → PASS. Después
`NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit` → sin errores.

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma apps/fotoffice/lib/course-marketplace
git commit -m "Mercado de cursos: beneficiarios en la base y sus reglas"
```

---

### Task 3: El 5% encima en los cursos grabados y el reparto congelado

**Files:**
- Create: `lib/course-marketplace/compra.ts`, `lib/course-marketplace/compra.test.ts`
- Create: `lib/course-marketplace/cargar.ts`
- Modify: `app/actions/public-course-enrollment.ts`, `lib/presential-courses/checkout.ts`,
  `lib/presential-courses/enrollment-workflow.ts` (+ su test si existe)

**Interfaces:**
- Consumes: `calcularReparto` (Task 1); `beneficiariosParaMotor`, `estadoDeVenta`, `type BeneficiarioRegistrado` (Task 2).
- Produces (`compra.ts`):
  - `montosDeCompraSinReparto(input: { listaArs: string | number; comisionPlataformaBps: number; owner: { workspaceId: string; nombre: string } }): { ok: true; listPriceArs: string; discountArs: string; platformFeeArs: string; amountArs: string; netAmountArs: string; partes: ParteDelReparto[] } | { ok: false; error: string }` — montos como texto con 2 decimales, listos para `Prisma.Decimal`.
- Produces (`cargar.ts`, servidor):
  - `cargarBeneficiarios(courseId: string): Promise<BeneficiarioRegistrado[]>` — con `nombre` (marca comercial del negocio, o el correo invitado) y `mpConectado` (de `resolveWorkspaceCollector`).
  - `cargarDueno(workspaceId: string): Promise<{ workspaceId: string; nombre: string }>`
- `recalcularReparto` (en `enrollment-workflow.ts`) suma la opción `comisionFijaArs?: Prisma.Decimal`: si viene, `fee` es ese valor y `net = montoCobrado − fee`.

- [ ] **Step 1: Test de los montos**

```ts
// lib/course-marketplace/compra.test.ts
import { describe, expect, it } from "vitest";
import { montosDeCompraSinReparto } from "./compra";

const owner = { workspaceId: "ws-maxi", nombre: "Maxi Oviedo" };

describe("montos de una compra de curso grabado", () => {
  it("el 5% va encima: lista $100.000 → paga $105.000, neto $100.000", () => {
    const r = montosDeCompraSinReparto({ listaArs: "100000", comisionPlataformaBps: 500, owner });
    expect(r).toMatchObject({
      ok: true,
      listPriceArs: "100000.00",
      discountArs: "0.00",
      platformFeeArs: "5000.00",
      amountArs: "105000.00",
      netAmountArs: "100000.00",
    });
  });

  it("con centavos", () => {
    const r = montosDeCompraSinReparto({ listaArs: "45000.50", comisionPlataformaBps: 500, owner });
    expect(r).toMatchObject({ ok: true, platformFeeArs: "2250.03", amountArs: "47250.53" });
  });

  it("devuelve las partes congelables", () => {
    const r = montosDeCompraSinReparto({ listaArs: 1000, comisionPlataformaBps: 500, owner });
    expect(r.ok && r.partes.map((p) => [p.id, p.tipo, p.centavos])).toEqual([
      ["ws-maxi", "BENEFICIARIO", 100_000],
      ["plataforma", "PLATAFORMA", 5_000],
    ]);
  });

  it("sin precio no hay compra", () => {
    expect(montosDeCompraSinReparto({ listaArs: "0", comisionPlataformaBps: 500, owner }).ok).toBe(false);
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implementar `compra.ts`**

```ts
// lib/course-marketplace/compra.ts
import { calcularReparto, type ParteDelReparto } from "./reparto";
import { beneficiariosParaMotor } from "./beneficiarios";

/**
 * Los montos de comprar un curso grabado SIN reparto (un solo beneficiario que es el dueño),
 * con el 5% de la plataforma encima del precio de lista (spec, sección 5.4).
 */

function aTexto(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

export function montosDeCompraSinReparto(input: {
  listaArs: string | number;
  comisionPlataformaBps: number;
  owner: { workspaceId: string; nombre: string };
}):
  | { ok: true; listPriceArs: string; discountArs: string; platformFeeArs: string; amountArs: string; netAmountArs: string; partes: ParteDelReparto[] }
  | { ok: false; error: string } {
  const listaCentavos = Math.round(Number(input.listaArs) * 100);
  const r = calcularReparto({
    listaCentavos,
    comisionPlataformaBps: input.comisionPlataformaBps,
    beneficiarios: beneficiariosParaMotor(input.owner, []),
    vendedorId: input.owner.workspaceId,
  });
  if (!r.ok) return { ok: false, error: r.errores[0] ?? "No se pudo calcular el precio." };
  return {
    ok: true,
    listPriceArs: aTexto(listaCentavos),
    discountArs: aTexto(r.descuento),
    platformFeeArs: aTexto(r.comisionPlataforma),
    amountArs: aTexto(r.pagaElAlumno),
    netAmountArs: aTexto(r.pagaElAlumno - r.comisionPlataforma),
    partes: r.partes,
  };
}
```

Run → PASS (4 tests).

- [ ] **Step 3: `cargar.ts`**

```ts
// lib/course-marketplace/cargar.ts
import "server-only";
import { prisma } from "@repo/db";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import type { BeneficiarioRegistrado } from "./beneficiarios";

async function nombresDeNegocios(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const [marcas, workspaces] = await Promise.all([
    prisma.fotofficeWorkspaceBranding.findMany({ where: { workspaceId: { in: ids } }, select: { workspaceId: true, commercialName: true } }),
    prisma.workspace.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
  ]);
  const m = new Map(workspaces.map((w) => [w.id, w.name]));
  for (const b of marcas) if (b.commercialName?.trim()) m.set(b.workspaceId, b.commercialName.trim());
  return m;
}

export async function cargarDueno(workspaceId: string): Promise<{ workspaceId: string; nombre: string }> {
  const nombres = await nombresDeNegocios([workspaceId]);
  return { workspaceId, nombre: nombres.get(workspaceId) ?? "El dueño" };
}

export async function cargarBeneficiarios(courseId: string): Promise<BeneficiarioRegistrado[]> {
  const filas = await prisma.courseBeneficiary.findMany({
    where: { courseId },
    orderBy: { createdAt: "asc" },
  });
  const ids = filas.map((f) => f.workspaceId).filter((x): x is string => Boolean(x));
  const nombres = await nombresDeNegocios(ids);
  const conectados = new Map(
    await Promise.all(ids.map(async (id) => [id, (await resolveWorkspaceCollector(id)).ok] as const)),
  );
  return filas.map((f) => ({
    id: f.id,
    workspaceId: f.workspaceId,
    invitedEmail: f.invitedEmail,
    nombre: f.workspaceId ? nombres.get(f.workspaceId) ?? "Negocio" : f.invitedEmail ?? "Invitado",
    role: f.role,
    shareBps: f.shareBps,
    absorbsProcessorFee: f.absorbsProcessorFee,
    status: f.status,
    mpConectado: f.workspaceId ? conectados.get(f.workspaceId) === true : false,
  }));
}
```

Confirmá que `resolveWorkspaceCollector(workspaceId)` devuelve `{ ok: boolean, ... }` mirando
`lib/payments/connect/collector.ts`; si la forma es otra, adaptá sólo esa línea.

- [ ] **Step 4: La acción pública de inscripción**

En `app/actions/public-course-enrollment.ts`, en el camino de un curso **grabado** (cuando
`objetivo.courseInstanceId` es `null`), antes de calcular `feeBps` y los montos:

```ts
  if (objetivo.courseInstanceId === null) {
    const beneficiarios = await cargarBeneficiarios(course.id);
    if (estadoDeVenta(course.workspaceId, beneficiarios).tipo !== "SIN_REPARTO") {
      return { error: "Este curso todavía no está a la venta." };
    }
  }
```

Para el grabado, reemplazá el cálculo `splitByPlatformFee(amount, feeBps)` por:

```ts
  const montos =
    objetivo.courseInstanceId === null
      ? montosDeCompraSinReparto({
          listaArs: objetivo.monto.toString(),
          comisionPlataformaBps: feeBps,
          owner: await cargarDueno(course.workspaceId),
        })
      : null;
  if (montos && !montos.ok) return { error: montos.error };
```

y en el `create`, cuando `montos` existe: `amountArs: new Prisma.Decimal(montos.amountArs)`,
`platformFeeArs: new Prisma.Decimal(montos.platformFeeArs)`,
`netAmountArs: new Prisma.Decimal(montos.netAmountArs)`,
`listPriceArs: new Prisma.Decimal(montos.listPriceArs)`,
`discountArs: new Prisma.Decimal(montos.discountArs)`. El presencial sigue exactamente igual
(`splitByPlatformFee` sobre el precio de la edición, `listPriceArs` null).

Imports: `cargarBeneficiarios`, `cargarDueno` de `@/lib/course-marketplace/cargar`; `estadoDeVenta`
de `@/lib/course-marketplace/beneficiarios`; `montosDeCompraSinReparto` de `@/lib/course-marketplace/compra`.

- [ ] **Step 5: El checkout**

En `lib/presential-courses/checkout.ts`, después de resolver el `collector` y `feeBps`, reemplazá
el bloque que calcula `{ fee, net }` y actualiza la inscripción por:

```ts
  let fee: Prisma.Decimal;
  let monto: Prisma.Decimal;
  if (inscripcion.listPriceArs) {
    // Curso grabado: el 5% va ENCIMA de la lista. Se vuelve a comprobar que siga sin reparto:
    // con el split apagado, un curso con varios beneficiarios no se cobra.
    const beneficiarios = await cargarBeneficiarios(inscripcion.courseId);
    if (estadoDeVenta(inscripcion.course.workspaceId, beneficiarios).tipo !== "SIN_REPARTO") {
      return { ok: false, error: "Este curso todavía no está a la venta." };
    }
    const dueno = await cargarDueno(inscripcion.course.workspaceId);
    const montos = montosDeCompraSinReparto({
      listaArs: inscripcion.listPriceArs.toString(),
      comisionPlataformaBps: feeBps,
      owner: dueno,
    });
    if (!montos.ok) return { ok: false, error: montos.error };
    fee = new Prisma.Decimal(montos.platformFeeArs);
    monto = new Prisma.Decimal(montos.amountArs);
    await prisma.$transaction([
      prisma.courseEnrollment.update({
        where: { id: inscripcion.id },
        data: {
          amountArs: monto,
          platformFeePercent: new Prisma.Decimal(feeBps).div(100),
          platformFeeArs: fee,
          netAmountArs: new Prisma.Decimal(montos.netAmountArs),
        },
      }),
      prisma.courseSaleShare.deleteMany({ where: { enrollmentId: inscripcion.id } }),
      prisma.courseSaleShare.createMany({
        data: montos.partes.map((p) => ({
          enrollmentId: inscripcion.id,
          workspaceId: p.tipo === "PLATAFORMA" ? null : p.id,
          kind: p.tipo,
          label: p.nombre,
          amountArs: new Prisma.Decimal((p.centavos / 100).toFixed(2)),
          absorbsProcessorFee: p.absorbeMp,
        })),
      }),
    ]);
  } else {
    const reparto = splitByPlatformFee(inscripcion.amountArs, feeBps);
    fee = reparto.fee;
    monto = inscripcion.amountArs;
    await prisma.courseEnrollment.update({
      where: { id: inscripcion.id },
      data: {
        platformFeePercent: new Prisma.Decimal(feeBps).div(100),
        platformFeeArs: reparto.fee,
        netAmountArs: reparto.net,
      },
    });
  }
```

Y en `createPreference`: `amountMinor: aMinor(monto)` y `marketplaceFeeMinor: aMinor(fee)`.

- [ ] **Step 6: La aprobación respeta la comisión fija**

En `lib/presential-courses/enrollment-workflow.ts`:
- `recalcularReparto` suma `comisionFijaArs?: Prisma.Decimal` a su entrada. Si viene:
  `fee = comisionFijaArs` y `net = montoCobrado − fee` (2 decimales, `ROUND_HALF_UP`).
- En `approveCourseEnrollment`, pasale `comisionFijaArs: enrollment.listPriceArs ? enrollment.platformFeeArs : undefined`.

Test (en el test existente de `recalcularReparto`, o uno nuevo `lib/presential-courses/recalcular-reparto.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { Prisma } from "@repo/db";
import { recalcularReparto } from "./enrollment-workflow";

describe("reparto al aprobar un curso grabado con el 5% encima", () => {
  it("la comisión queda fija y el neto es lo cobrado menos esa comisión", () => {
    const r = recalcularReparto({
      montoCobrado: new Prisma.Decimal("105000"),
      feePercentCongelado: new Prisma.Decimal("5"),
      comisionFijaArs: new Prisma.Decimal("5000"),
    });
    expect(r.fee.toString()).toBe("5000");
    expect(r.net.toString()).toBe("100000");
  });

  it("sin comisión fija, sigue como antes", () => {
    const r = recalcularReparto({ montoCobrado: new Prisma.Decimal("100000"), feePercentCongelado: new Prisma.Decimal("5") });
    expect(r.fee.toString()).toBe("5000");
  });
});
```

Si `enrollment-workflow.ts` importa `server-only` u otras cosas que impidan el test, simulalas con
`vi.mock` como hacen los tests vecinos de esa carpeta.

- [ ] **Step 7: Suite, tipos y commit**

Run: `pnpm --filter fotoffice test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: verde. Si algún test existente de inscripción o checkout simula `prisma` y ahora falla
por `courseBeneficiary` o `courseSaleShare`, agregá esos mocks (devolviendo `[]`) sin cambiar lo
que el test verifica.

```bash
git add apps/fotoffice
git commit -m "Cursos grabados: el 5% de la plataforma se cobra encima y cada venta congela su reparto"
```

---

### Task 4: El dueño arma la lista de beneficiarios

**Files:**
- Create: `lib/course-marketplace/aviso-beneficiario.ts`, `lib/course-marketplace/aviso-beneficiario.test.ts`
- Create: `app/actions/course-beneficiaries.ts`
- Modify: `app/actions/presential-courses.ts` (regla de "gratis para socios")
- Modify: `lib/course-classroom/beneficio.ts` (+ su test)

**Interfaces:**
- Consumes: `validarFilas`, `esSinReparto`, `type FilaBeneficiario` (Task 2); `cargarBeneficiarios`, `cargarDueno` (Task 3); `requireCoursesSalesContext` de `@/lib/workspace`; `sendTransactionalEmail` de `@/lib/communications/send-email`; `appUrl()` de `@/lib/app-url`; `escaparHtml` de `@/lib/course-classroom/email`.
- Produces:
  - `buildAvisoBeneficiarioEmail(input: { dueno: string; curso: string; porcentaje: string; rol: string; enlace: string }): { subject: string; html: string; text: string }`
  - server action `guardarBeneficiariosAction(courseId: string, filas: FilaBeneficiario[]): Promise<{ ok: true; aviso?: string } | { ok: false; errores: string[] }>`
  - server action `buscarNegociosAction(texto: string): Promise<Array<{ workspaceId: string; nombre: string; slug: string }>>`
  - `puedeAnotarseGratis` suma `curso.unicoBeneficiario: boolean`; si es `false`, devuelve `{ ok: false, codigo: "no-gratis", ... }`.

- [ ] **Step 1: Test y código del aviso por correo**

```ts
// lib/course-marketplace/aviso-beneficiario.test.ts
import { describe, expect, it } from "vitest";
import { buildAvisoBeneficiarioEmail } from "./aviso-beneficiario";

describe("aviso: te sumaron como beneficiario", () => {
  const input = { dueno: "SFPR <b>", curso: "Retrato", porcentaje: "50%", rol: "Docente", enlace: "https://fotoffice.com/dashboard/cursos-compartidos" };

  it("dice quién, qué curso, cuánto y lleva el enlace", () => {
    const { subject, html, text } = buildAvisoBeneficiarioEmail(input);
    expect(subject).toBe("Te sumaron como beneficiario de Retrato");
    expect(text).toContain("50%");
    expect(text).toContain("Docente");
    expect(html).toContain('href="https://fotoffice.com/dashboard/cursos-compartidos"');
  });

  it("escapa lo que viene de afuera", () => {
    expect(buildAvisoBeneficiarioEmail(input).html).toContain("SFPR &lt;b&gt;");
  });
});
```

```ts
// lib/course-marketplace/aviso-beneficiario.ts
import { escaparHtml } from "@/lib/course-classroom/email";

export function buildAvisoBeneficiarioEmail(input: {
  dueno: string;
  curso: string;
  porcentaje: string;
  rol: string;
  enlace: string;
}): { subject: string; html: string; text: string } {
  const subject = `Te sumaron como beneficiario de ${input.curso}`;
  const html = `
<div>
  <p><strong>${escaparHtml(input.dueno)}</strong> te sumó como beneficiario del curso <strong>${escaparHtml(input.curso)}</strong>.</p>
  <p>Tu parte: <strong>${escaparHtml(input.porcentaje)}</strong> de cada venta, como ${escaparHtml(input.rol)}.</p>
  <p>Entrá a FOTOFFICE para ver cómo se reparte cada venta y aceptar o rechazar:</p>
  <p><a href="${escaparHtml(input.enlace)}">Ver la invitación</a></p>
</div>`.trim();
  const text = [
    `${input.dueno} te sumó como beneficiario del curso ${input.curso}.`,
    `Tu parte: ${input.porcentaje} de cada venta, como ${input.rol}.`,
    "",
    `Ver la invitación: ${input.enlace}`,
  ].join("\n");
  return { subject, html, text };
}
```

Run: `pnpm --filter fotoffice test lib/course-marketplace/aviso-beneficiario.test.ts` → PASS.

- [ ] **Step 2: Las acciones del dueño**

```ts
// app/actions/course-beneficiaries.ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { appUrl } from "@/lib/app-url";
import { sendTransactionalEmail } from "@/lib/communications/send-email";
import { esSinReparto, validarFilas, type FilaBeneficiario } from "@/lib/course-marketplace/beneficiarios";
import { formatoPorcentaje } from "@/lib/course-marketplace/reparto";
import { buildAvisoBeneficiarioEmail } from "@/lib/course-marketplace/aviso-beneficiario";
import { cargarDueno } from "@/lib/course-marketplace/cargar";

const ROLES: Record<FilaBeneficiario["role"], string> = {
  DOCENTE: "Docente",
  PRODUCTOR: "Productor",
  INSTITUCION: "Institución",
  OTRO: "Otro",
};

/** Correos de los dueños de un negocio, para avisarles. */
async function correosDeDuenos(workspaceId: string): Promise<string[]> {
  const filas = await prisma.workspaceMembership.findMany({
    where: { workspaceId, role: { in: ["WORKSPACE_OWNER", "WORKSPACE_ADMIN"] } },
    select: { user: { select: { email: true } } },
  });
  return filas.map((f) => f.user.email).filter(Boolean);
}

/**
 * Guarda la lista completa de beneficiarios de un curso (reemplaza la anterior).
 *
 * - El dueño queda ACEPTADO solo. Los demás nuevos quedan INVITADOS y reciben un correo.
 * - Si a un beneficiario que ya había aceptado le cambian el % o el rol, vuelve a INVITADO:
 *   tiene que aceptar las condiciones nuevas.
 * - Si el curso deja de ser "sin reparto" y tenía "gratis para socios", se apaga: regalarlo
 *   dejaría sin cobrar a los demás (spec, sección 4.4).
 */
export async function guardarBeneficiariosAction(
  courseId: string,
  filas: FilaBeneficiario[],
): Promise<{ ok: true; aviso?: string } | { ok: false; errores: string[] }> {
  const { workspace } = await requireCoursesSalesContext("MANAGE");
  const curso = await prisma.course.findFirst({
    where: { id: courseId, workspaceId: workspace.id },
    select: { id: true, title: true, workspaceId: true, freeForMembers: true },
  });
  if (!curso) return { ok: false, errores: ["Curso no encontrado."] };

  const limpias = filas.map((f) => ({
    ...f,
    invitedEmail: f.invitedEmail?.trim().toLowerCase() || null,
    workspaceId: f.workspaceId || null,
  }));
  const errores = validarFilas(limpias);
  if (errores.length) return { ok: false, errores };

  const existentes = await prisma.courseBeneficiary.findMany({ where: { courseId } });
  const porId = new Map(existentes.map((e) => [e.id, e]));
  const avisar: Array<{ correos: string[]; porcentaje: string; rol: string }> = [];

  await prisma.$transaction(async (tx) => {
    const conservados = new Set(limpias.map((f) => f.id).filter(Boolean));
    await tx.courseBeneficiary.deleteMany({ where: { courseId, id: { notIn: [...conservados] as string[] } } });
    for (const f of limpias) {
      const previo = f.id ? porId.get(f.id) : undefined;
      const esDueno = f.workspaceId === curso.workspaceId;
      const cambiaron =
        !previo || previo.shareBps !== f.shareBps || previo.role !== f.role || previo.workspaceId !== f.workspaceId || previo.invitedEmail !== f.invitedEmail;
      const status = esDueno ? "ACEPTADO" : cambiaron ? "INVITADO" : previo!.status;
      const data = {
        workspaceId: f.workspaceId,
        invitedEmail: f.invitedEmail,
        role: f.role,
        shareBps: f.shareBps,
        absorbsProcessorFee: f.absorbsProcessorFee,
        status,
        respondedAt: status === "INVITADO" ? null : previo?.respondedAt ?? new Date(),
      } as const;
      if (previo) await tx.courseBeneficiary.update({ where: { id: previo.id }, data });
      else await tx.courseBeneficiary.create({ data: { courseId, ...data } });
      if (!esDueno && cambiaron) {
        avisar.push({
          correos: f.workspaceId ? await correosDeDuenos(f.workspaceId) : [f.invitedEmail!],
          porcentaje: formatoPorcentaje(f.shareBps),
          rol: ROLES[f.role],
        });
      }
    }
  });

  let aviso: string | undefined;
  if (curso.freeForMembers && !esSinReparto(curso.workspaceId, limpias)) {
    await prisma.course.update({ where: { id: courseId }, data: { freeForMembers: false } });
    aviso = "Se apagó \"Gratis para socios\": con varios beneficiarios, regalarlo dejaría sin cobrar a los demás.";
  }

  const dueno = await cargarDueno(curso.workspaceId);
  const enlace = `${appUrl()}/dashboard/cursos-compartidos`;
  for (const a of avisar) {
    const correo = buildAvisoBeneficiarioEmail({ dueno: dueno.nombre, curso: curso.title, porcentaje: a.porcentaje, rol: a.rol, enlace });
    for (const to of a.correos) {
      // Un correo que no sale no deshace lo guardado: la invitación igual aparece en el panel.
      await sendTransactionalEmail({ to, subject: correo.subject, html: correo.html, text: correo.text }).catch(() => null);
    }
  }

  revalidatePath(`/dashboard/courses/${courseId}`);
  return { ok: true, aviso };
}

/** Busca negocios de FOTOFFICE por nombre o dirección pública, para sumarlos como beneficiarios. */
export async function buscarNegociosAction(texto: string): Promise<Array<{ workspaceId: string; nombre: string; slug: string }>> {
  await requireCoursesSalesContext("MANAGE");
  const q = texto.trim();
  if (q.length < 2) return [];
  const filas = await prisma.fotofficeWorkspaceBranding.findMany({
    where: {
      OR: [
        { commercialName: { contains: q, mode: "insensitive" } },
        { publicSlug: { contains: q.toLowerCase() } },
      ],
    },
    select: { workspaceId: true, commercialName: true, publicSlug: true },
    take: 8,
    orderBy: { commercialName: "asc" },
  });
  return filas.map((f) => ({ workspaceId: f.workspaceId, nombre: f.commercialName, slug: f.publicSlug }));
}
```

- [ ] **Step 3: "Gratis para socios" sólo sin reparto**

En `app/actions/presential-courses.ts`, en la acción que **actualiza** un curso, antes de guardar:
si `freeForMembers` viene en `true`, cargá `prisma.courseBeneficiary.findMany({ where: { courseId: id }, select: { workspaceId: true, shareBps: true } })`
y, si `!esSinReparto(<workspaceId del curso>, filas)`, devolvé
`{ error: "\"Gratis para socios\" sólo se puede activar si tu negocio es el único beneficiario del curso." }`.

En `lib/course-classroom/beneficio.ts`:
- `puedeAnotarseGratis`: el tipo de `curso` suma `unicoBeneficiario: boolean`; después del chequeo
  de `freeForMembers`, `if (!input.curso.unicoBeneficiario) return { ok: false, codigo: "no-gratis", motivo: MENSAJES_DE_BENEFICIO["no-gratis"] };`
- `anotarseGratis`: al cargar el curso, cargá también sus beneficiarios
  (`beneficiaries: { select: { workspaceId: true, shareBps: true } }`) y pasá
  `unicoBeneficiario: esSinReparto(curso.workspaceId, curso.beneficiaries)`.
- `cursosGratisParaSocio`: no muestres cursos con beneficiarios ajenos; agregá al `where`
  `beneficiaries: { every: { workspaceId } }` (sin filas también cumple).
- En `beneficio.test.ts`, agregá `unicoBeneficiario: true` a los cursos de los casos existentes y
  un caso nuevo: con `unicoBeneficiario: false` → `codigo: "no-gratis"`.

- [ ] **Step 4: Suite, tipos y commit**

Run: `pnpm --filter fotoffice test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: verde.

```bash
git add apps/fotoffice
git commit -m "Mercado de cursos: el dueño arma los beneficiarios y 'gratis para socios' exige ser el único"
```

---

### Task 5: El simulador y el editor en la ficha del curso

**Files:**
- Create: `lib/course-marketplace/escenarios.ts`, `lib/course-marketplace/escenarios.test.ts`
- Create: `components/course-marketplace/simulador-reparto.tsx`
- Create: `components/course-marketplace/beneficiarios-editor.tsx`
- Modify: `app/(shell)/dashboard/courses/[courseId]/page.tsx`

**Interfaces:**
- Consumes: `calcularReparto`, `topeDeDescuentoBps`, `formatoPorcentaje`, `type BeneficiarioEntrada` (Task 1); `estimarComisionMp` (Task 1); `guardarBeneficiariosAction`, `buscarNegociosAction` (Task 4); `cargarBeneficiarios`, `cargarDueno` (Task 3); `estadoDeVenta`, `beneficiariosParaMotor`, `type FilaBeneficiario`, `type BeneficiarioRegistrado` (Task 2); `getPlatformFeeBps` de `@/lib/platform-fee/store`.
- Produces:
  - `type FilaEscenario = { id: string; nombre: string; tipo: "PLATAFORMA" | "REVENDEDOR" | "BENEFICIARIO"; bruto: number; mp: number; neto: number }`
  - `type Escenario = { clave: "directa" | "reventa" | "socio"; titulo: string; ok: true; pagaElAlumno: number; filas: FilaEscenario[] } | { clave: ...; titulo: string; ok: false; errores: string[] }`
  - `armarEscenarios(input: { listaCentavos: number; comisionPlataformaBps: number; beneficiarios: BeneficiarioEntrada[]; vendedorId: string; reventaBps: number; tasaMpBps?: number }): Escenario[]`
  - `SimuladorReparto(props: { listaCentavos: number; comisionPlataformaBps: number; beneficiarios: BeneficiarioEntrada[]; vendedorId: string; destacarId?: string; reventaInicialBps?: number })`
  - `BeneficiariosEditor(props: { courseId: string; dueno: { workspaceId: string; nombre: string }; listaCentavos: number; comisionPlataformaBps: number; iniciales: BeneficiarioRegistrado[] })`

- [ ] **Step 1: Test de los escenarios**

```ts
// lib/course-marketplace/escenarios.test.ts
import { describe, expect, it } from "vitest";
import { armarEscenarios } from "./escenarios";

const beneficiarios = [
  { id: "sfpr", nombre: "SFPR", bps: 3000, absorbeMp: false },
  { id: "doc", nombre: "Docente", bps: 7000, absorbeMp: true },
];

describe("los tres escenarios del simulador", () => {
  const e = armarEscenarios({ listaCentavos: 10_000_000, comisionPlataformaBps: 500, beneficiarios, vendedorId: "sfpr", reventaBps: 2500, tasaMpBps: 761 });

  it("son venta directa, revendido y socio con descuento máximo", () => {
    expect(e.map((x) => x.clave)).toEqual(["directa", "reventa", "socio"]);
  });

  it("la comisión estimada de MP se resta sólo a quien la absorbe", () => {
    const directa = e[0];
    if (!directa.ok) throw new Error();
    const doc = directa.filas.find((f) => f.id === "doc")!;
    expect(doc.bruto).toBe(7_000_000);
    expect(doc.mp).toBe(799_050); // 7,61% de $105.000
    expect(doc.neto).toBe(7_000_000 - 799_050);
    expect(directa.filas.find((f) => f.id === "sfpr")!.mp).toBe(0);
  });

  it("el socio paga la lista menos la parte del que vende, más el 5%", () => {
    const socio = e[2];
    expect(socio.ok && socio.pagaElAlumno).toBe(7_500_000);
  });

  it("un error del motor se muestra en cada escenario", () => {
    const malos = armarEscenarios({ listaCentavos: 0, comisionPlataformaBps: 500, beneficiarios, vendedorId: "sfpr", reventaBps: 2500 });
    expect(malos.every((x) => !x.ok)).toBe(true);
  });
});
```

Run → FAIL.

- [ ] **Step 2: `escenarios.ts`**

```ts
// lib/course-marketplace/escenarios.ts
import { calcularReparto, topeDeDescuentoBps, formatoPorcentaje, type BeneficiarioEntrada } from "./reparto";
import { estimarComisionMp, TASA_MP_ESTIMADA_BPS } from "./comision-mp";

export type FilaEscenario = {
  id: string;
  nombre: string;
  tipo: "PLATAFORMA" | "REVENDEDOR" | "BENEFICIARIO";
  bruto: number;
  mp: number;
  neto: number;
};

type Clave = "directa" | "reventa" | "socio";

export type Escenario =
  | { clave: Clave; titulo: string; ok: true; pagaElAlumno: number; filas: FilaEscenario[] }
  | { clave: Clave; titulo: string; ok: false; errores: string[] };

/** Los tres escenarios del simulador (spec, sección 6). Puro: lo usa el navegador. */
export function armarEscenarios(input: {
  listaCentavos: number;
  comisionPlataformaBps: number;
  beneficiarios: BeneficiarioEntrada[];
  vendedorId: string;
  reventaBps: number;
  tasaMpBps?: number;
}): Escenario[] {
  const tasa = input.tasaMpBps ?? TASA_MP_ESTIMADA_BPS;
  const base = { listaCentavos: input.listaCentavos, comisionPlataformaBps: input.comisionPlataformaBps, beneficiarios: input.beneficiarios };
  const tope = topeDeDescuentoBps({ beneficiarios: input.beneficiarios, vendedorId: input.vendedorId });
  const casos: Array<{ clave: Clave; titulo: string; entrada: Parameters<typeof calcularReparto>[0] }> = [
    { clave: "directa", titulo: "Venta directa", entrada: { ...base, vendedorId: input.vendedorId } },
    {
      clave: "reventa",
      titulo: `Revendido al ${formatoPorcentaje(input.reventaBps)}`,
      entrada: { ...base, reventa: { id: "revendedor", nombre: "Revendedor", bps: input.reventaBps } },
    },
    {
      clave: "socio",
      titulo: `Socio con ${formatoPorcentaje(tope)} de descuento`,
      entrada: { ...base, vendedorId: input.vendedorId, descuentoBps: tope },
    },
  ];
  return casos.map(({ clave, titulo, entrada }) => {
    const r = calcularReparto(entrada);
    if (!r.ok) return { clave, titulo, ok: false, errores: r.errores };
    const mp = estimarComisionMp(r.pagaElAlumno, tasa);
    return {
      clave,
      titulo,
      ok: true,
      pagaElAlumno: r.pagaElAlumno,
      filas: r.partes.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        tipo: p.tipo,
        bruto: p.centavos,
        mp: p.absorbeMp ? mp : 0,
        neto: p.centavos - (p.absorbeMp ? mp : 0),
      })),
    };
  });
}
```

Run → PASS.

- [ ] **Step 3: El componente del simulador**

```tsx
// components/course-marketplace/simulador-reparto.tsx
"use client";

import { useMemo, useState } from "react";
import { armarEscenarios } from "@/lib/course-marketplace/escenarios";
import type { BeneficiarioEntrada } from "@/lib/course-marketplace/reparto";

const COLORES = ["#2563eb", "#16a34a", "#d97706", "#9333ea", "#dc2626", "#0891b2", "#4b5563"];

function pesos(centavos: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(centavos / 100);
}

/**
 * "Cómo se reparte": tres escenarios con el mismo motor que después cobra. Lo único estimado
 * es la comisión de Mercado Pago, y lo dice.
 */
export function SimuladorReparto({
  listaCentavos,
  comisionPlataformaBps,
  beneficiarios,
  vendedorId,
  destacarId,
  reventaInicialBps = 2500,
}: {
  listaCentavos: number;
  comisionPlataformaBps: number;
  beneficiarios: BeneficiarioEntrada[];
  vendedorId: string;
  destacarId?: string;
  reventaInicialBps?: number;
}) {
  const [reventaBps, setReventaBps] = useState(reventaInicialBps);
  const escenarios = useMemo(
    () => armarEscenarios({ listaCentavos, comisionPlataformaBps, beneficiarios, vendedorId, reventaBps }),
    [listaCentavos, comisionPlataformaBps, beneficiarios, vendedorId, reventaBps],
  );

  return (
    <section className="fo-card space-y-4" aria-label="Cómo se reparte">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-base font-semibold">Cómo se reparte cada venta</h3>
        <label className="text-sm">
          % para un revendedor (simulación){" "}
          <input
            type="number"
            min={1}
            max={90}
            value={reventaBps / 100}
            onChange={(e) => setReventaBps(Math.round(Number(e.target.value || 0) * 100))}
            className="fo-input inline-block w-20"
          />
        </label>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {escenarios.map((esc) => (
          <article key={esc.clave} className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3">
            <p className="text-sm font-semibold">{esc.titulo}</p>
            {!esc.ok ? (
              <ul className="list-disc pl-5 text-sm text-[var(--fo-danger)]">
                {esc.errores.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : (
              <>
                <p className="text-sm">
                  Paga el alumno: <strong>{pesos(esc.pagaElAlumno)}</strong>
                </p>
                <div className="flex h-3 overflow-hidden rounded-full" aria-hidden>
                  {esc.filas.map((f, i) => (
                    <div key={f.id} style={{ width: `${(f.bruto / esc.pagaElAlumno) * 100}%`, background: COLORES[i % COLORES.length] }} />
                  ))}
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {esc.filas.map((f, i) => (
                      <tr key={f.id} className={f.id === destacarId ? "font-semibold" : undefined}>
                        <td className="py-0.5">
                          <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: COLORES[i % COLORES.length] }} />
                          {f.nombre}
                        </td>
                        <td className="py-0.5 text-right tabular-nums">
                          {f.mp > 0 ? (
                            <span title={`${pesos(f.bruto)} menos ${pesos(f.mp)} estimados de Mercado Pago`}>{pesos(f.neto)}*</span>
                          ) : (
                            pesos(f.neto)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </article>
        ))}
      </div>
      <p className="text-xs text-[var(--fo-muted)]">
        * Neto después de la comisión de Mercado Pago, <strong>estimada</strong>: Mercado Pago la descuenta al acreditar.
      </p>
    </section>
  );
}
```

- [ ] **Step 4: El editor de beneficiarios**

`components/course-marketplace/beneficiarios-editor.tsx` (cliente). Requisitos, con las clases
`fo-card`, `fo-input`, `fo-btn` del resto del panel:
- Estado: la lista de filas (arranca de `iniciales`; si está vacía, una fila con el dueño al 100%,
  rol `INSTITUCION` o `DOCENTE`, absorbe MP).
- Por fila: nombre (o correo), rol (select de los 4 roles), % (número con hasta 2 decimales, se
  guarda en puntos básicos: `Math.round(valor * 100)`), radio "absorbe MP" (uno solo en la lista),
  estado (Invitado / Aceptado / Rechazado, sólo lectura) y "Quitar".
- "Agregar beneficiario": un campo que, con 2 o más letras, llama a `buscarNegociosAction` y
  muestra hasta 8 resultados; elegir uno agrega la fila con su `workspaceId`. Debajo, "o invitar por
  correo" con un campo de correo que agrega una fila con `invitedEmail`.
- Total en vivo ("Suman 95%: faltan 5") y los errores de `validarFilas` mientras se edita.
- Debajo, el `SimuladorReparto` con `beneficiarios` derivados del estado actual
  (`id = workspaceId ?? invitedEmail`, `bps = shareBps`, `absorbeMp`), `vendedorId = dueno.workspaceId`
  y `destacarId = dueno.workspaceId`. Se actualiza a cada cambio.
- "Guardar": llama a `guardarBeneficiariosAction(courseId, filas)`. Muestra los errores que
  devuelva, o "Guardado", más el `aviso` si vino.
- Texto fijo arriba: "Con el reparto automático de Mercado Pago todavía apagado, un curso con
  varios beneficiarios se puede armar y simular, pero en la página de venta dice 'Disponible
  próximamente'."

- [ ] **Step 5: Montarlo en la ficha del curso**

En `app/(shell)/dashboard/courses/[courseId]/page.tsx`, sólo si `grabado`:

```tsx
  const [beneficiarios, dueno, feeBps] = grabado
    ? await Promise.all([
        cargarBeneficiarios(course.id),
        cargarDueno(course.workspaceId),
        getPlatformFeeBps(course.workspaceId, COURSES_SALES_MODULE_KEY),
      ])
    : [[], null, 500];
  const estado = dueno ? estadoDeVenta(dueno.workspaceId, beneficiarios) : null;
```

y, después de la sección de clases:

```tsx
      {grabado && dueno ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Beneficiarios y reparto</h2>
          {estado?.tipo === "CON_REPARTO" ? (
            <div className="fo-card text-sm">
              <p className="font-medium">
                {estado.listo
                  ? "Todos aceptaron. Se va a poder vender cuando Mercado Pago habilite el reparto automático."
                  : "Para vender con reparto falta:"}
              </p>
              {!estado.listo ? (
                <ul className="list-disc pl-5">
                  {estado.faltantes.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <BeneficiariosEditor
            courseId={course.id}
            dueno={dueno}
            listaCentavos={Math.round(Number(course.priceArs ?? 0) * 100)}
            comisionPlataformaBps={feeBps}
            iniciales={beneficiarios}
          />
        </section>
      ) : null}
```

Confirmá antes que `getCourseForEdit` devuelve `workspaceId` y `priceArs`; si no, agregalos a su
`select`.

- [ ] **Step 6: Suite, tipos y commit**

Run: `pnpm --filter fotoffice test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: verde.

```bash
git add apps/fotoffice
git commit -m "Mercado de cursos: el editor de beneficiarios con el simulador de reparto en vivo"
```

---

### Task 6: El beneficiario acepta desde su panel

**Files:**
- Create: `lib/course-marketplace/access.ts`
- Modify: `app/actions/course-beneficiaries.ts` (acción de responder)
- Create: `app/(shell)/dashboard/cursos-compartidos/page.tsx`
- Modify: `app/(shell)/dashboard/page.tsx` (aviso de invitaciones pendientes)

**Interfaces:**
- Consumes: `requireActiveWorkspace` de `@/lib/workspace`; `isFullAccessRole` de `@/lib/permissions/levels`; `SimuladorReparto` (Task 5); `cargarBeneficiarios`, `cargarDueno` (Task 3); `beneficiariosParaMotor` (Task 2); `getPlatformFeeBps`.
- Produces:
  - `requireDuenoOAdminDelNegocio(): Promise<{ user: AuthUser; workspace: ActiveWorkspace }>` — redirige a `/dashboard` si no es dueño o admin.
  - `invitacionesPendientesWhere(workspaceId: string, email: string)` — el filtro Prisma de las invitaciones de ese negocio (por `workspaceId`, o por correo invitado sin negocio).
  - server action `responderInvitacionAction(beneficiaryId: string, acepta: boolean): Promise<void>` (redirige a `/dashboard/cursos-compartidos?r=<codigo>`).

- [ ] **Step 1: La guarda**

```ts
// lib/course-marketplace/access.ts
import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireActiveWorkspace } from "@/lib/workspace";
import { isFullAccessRole } from "@/lib/permissions/levels";

/**
 * Sólo el dueño o un admin del negocio acepta ser beneficiario: es un compromiso de cobro.
 * No exige el módulo de cursos: un docente puede no venderlos él mismo.
 */
export async function requireDuenoOAdminDelNegocio() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/dashboard");
  const membresia = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    select: { role: true },
  });
  if (!isFullAccessRole(membresia?.role)) redirect("/dashboard");
  return { user, workspace };
}

/** Las invitaciones de un negocio: a su nombre, o a un correo suyo que todavía no tenía negocio. */
export function invitacionesPendientesWhere(workspaceId: string, email: string) {
  return {
    status: "INVITADO" as const,
    OR: [{ workspaceId }, { workspaceId: null, invitedEmail: email.trim().toLowerCase() }],
  };
}
```

- [ ] **Step 2: La acción de responder**

Agregá a `app/actions/course-beneficiaries.ts`:

```ts
export async function responderInvitacionAction(beneficiaryId: string, acepta: boolean): Promise<void> {
  const { user, workspace } = await requireDuenoOAdminDelNegocio();
  const fila = await prisma.courseBeneficiary.findFirst({
    where: { id: beneficiaryId, ...invitacionesPendientesWhere(workspace.id, user.email) },
    select: { id: true, courseId: true, workspaceId: true },
  });
  if (!fila) redirect("/dashboard/cursos-compartidos?r=no-encontrada");
  try {
    await prisma.courseBeneficiary.update({
      where: { id: fila.id },
      data: {
        status: acepta ? "ACEPTADO" : "RECHAZADO",
        respondedAt: new Date(),
        // Una invitación por correo pasa a ser de este negocio al responder.
        workspaceId: fila.workspaceId ?? workspace.id,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/dashboard/cursos-compartidos?r=ya-sos-beneficiario");
    }
    throw error;
  }
  revalidatePath(`/dashboard/courses/${fila.courseId}`);
  redirect(`/dashboard/cursos-compartidos?r=${acepta ? "aceptada" : "rechazada"}`);
}
```

Imports nuevos: `redirect` de `next/navigation`, `Prisma` de `@repo/db`,
`requireDuenoOAdminDelNegocio`, `invitacionesPendientesWhere` de `@/lib/course-marketplace/access`.
El `?r=` lleva sólo esos códigos fijos; la página los traduce con un mapa fijo y no muestra nada si
no conoce el código.

- [ ] **Step 3: La página**

`app/(shell)/dashboard/cursos-compartidos/page.tsx` (servidor):
- `requireDuenoOAdminDelNegocio()`; lee `searchParams.r` y lo traduce con un mapa fijo:
  `aceptada` → "Aceptaste. Vas a cobrar tu parte de cada venta.", `rechazada` → "Rechazaste la
  invitación.", `no-encontrada` → "Esa invitación ya no está disponible.", `ya-sos-beneficiario` →
  "Tu negocio ya es beneficiario de ese curso."
- **Invitaciones pendientes**: `prisma.courseBeneficiary.findMany({ where: invitacionesPendientesWhere(...), include: { course: { select: { id: true, title: true, workspaceId: true, priceArs: true } } } })`.
  Por cada una: título del curso, quién lo ofrece (`cargarDueno(course.workspaceId)`), rol, % y si
  absorbe la comisión de MP; el `SimuladorReparto` en modo lectura con todos los beneficiarios del
  curso (`cargarBeneficiarios` + `beneficiariosParaMotor`), `vendedorId` = el dueño,
  `destacarId` = el `workspaceId` de esta fila (o el correo, si es por correo), y la frase "Por cada
  venta de $X a precio de lista recibís $Y" (el bruto de su fila en la venta directa); dos
  formularios con `responderInvitacionAction.bind(null, fila.id, true|false)`: **Aceptar** y
  **Rechazar**.
- Si no conectó Mercado Pago: aviso "Para cobrar tu parte vas a tener que conectar Mercado Pago" con
  el enlace a la pantalla de conexión de cobros que ya existe en el panel (buscala por `resolveWorkspaceCollector`
  / "Conectar Mercado Pago" en `app/(shell)` y usá su ruta).
- **Cursos donde sos beneficiario**: los `ACEPTADO` de este negocio (excluyendo los cursos propios),
  con título, dueño y %.

- [ ] **Step 4: El aviso en el tablero**

En `app/(shell)/dashboard/page.tsx`, si hay `workspace`, contá
`prisma.courseBeneficiary.count({ where: invitacionesPendientesWhere(workspace.id, user.email) })`.
Si es mayor que cero, mostrá arriba un `fo-card`: "Te sumaron como beneficiario de N curso(s)" con
el enlace "Ver invitaciones" a `/dashboard/cursos-compartidos`.

- [ ] **Step 5: Suite, tipos y commit**

Run: `pnpm --filter fotoffice test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: verde. Si algún test del tablero simula `prisma`, agregá `courseBeneficiary.count`
devolviendo 0.

```bash
git add apps/fotoffice
git commit -m "Mercado de cursos: el beneficiario ve la invitación con el reparto y acepta desde su panel"
```

---

### Task 7: La página de venta y el despliegue

**Files:**
- Modify: `components/presential-courses/recorded-course-section.tsx`
- Modify: `app/w/[workspaceSlug]/cursos/[courseSlug]/page.tsx`

- [ ] **Step 1: Precio con el 5% y "Disponible próximamente"**

En la página pública del curso, para un grabado: cargá `cargarBeneficiarios(course.id)`,
`estadoDeVenta(course.workspaceId, ...)` y `getPlatformFeeBps(course.workspaceId, COURSES_SALES_MODULE_KEY)`,
y pasale a `RecordedCourseSection` dos props nuevas:
- `cargoServicioBps: number` — muestra el precio como
  "**$100.000** + $5.000 de cargo por servicio = **$105.000**" (calculado con
  `montosDeCompraSinReparto`, sin repetir la cuenta).
- `aLaVenta: boolean` — `estado.tipo === "SIN_REPARTO"`. Si es `false`, en lugar del formulario de
  compra muestra "Disponible próximamente" y no ofrece comprar.

- [ ] **Step 2: Build completo**

Run: `pnpm --filter fotoffice build` → sin errores.

- [ ] **Step 3: Despliegue (cada paso con aprobación de Daniel)**

1. PR de `feat/fotoffice-mercado-cursos-e1` contra `main`.
2. Migración `20261008120000_mercado_cursos_beneficiarios`:
   - ensayo en una rama copia de la base de FOTOFFICE (crear, aplicar, verificar, borrar);
   - aplicar en las 5 bases con el SQL más su fila en `_prisma_migrations`, como la migración de
     cursos del 2026-10-05 (el script `migraciones-cinco-bases.mts` se frena por checksums viejos);
   - verificar en cada una.
3. Fusionar el PR **después** de la migración.
4. Prueba: en un curso grabado de prueba, armar 3 beneficiarios (uno por correo), ver el simulador,
   aceptar desde otro negocio, comprobar que la página pública dice "Disponible próximamente"; y
   en un curso sin reparto, que el precio muestre el 5% encima y Mercado Pago cobre $105.000.

---

## Fuera de esta etapa

El mercado de cursos y los acuerdos de reventa (etapa 2), la venta del revendedor con descuento
(etapa 3), el split de Mercado Pago y la pantalla Cobros (etapa 4), y la invitación a enseñar
(etapa 5).
