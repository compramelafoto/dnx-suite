# Mercado de cursos — Etapas 2 a 5: reventa, venta del revendedor, split de Mercado Pago (apagado), Cobros e invitación a enseñar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** que cualquier negocio con el módulo de cursos pueda pedir revender un curso grabado de
otro (con su %, aprobación del dueño por encima del sugerido, pausa y fin), que el curso revendido
aparezca en su sitio y su portal con el descuento para sus socios, que la orden de Mercado Pago con
reparto quede programada detrás del interruptor apagado, que cada negocio vea sus Cobros, y que
alumnos, socios y visitantes reciban la invitación a enseñar.

**Architecture:** todo se apoya en el motor puro de la etapa 1 (`lib/course-marketplace/reparto.ts`,
`calcularReparto` con reventa `R` y descuento `D`). Las reglas nuevas también son puras y con test
(`reventa.ts`, `venta.ts`, `cobros.ts`, `invitacion-ensenar.ts`, y el armado de la orden en
`lib/payments/split-1n-cursos.ts`); las páginas y acciones sólo cargan datos y llaman a esas reglas.
Con el split apagado, todo curso revendido o con varios beneficiarios muestra "Disponible
próximamente" y no abre ningún pago; el camino con reparto (inscripción con `resaleAgreementId` y
reparto congelado en `CourseSaleShare`, orden de Mercado Pago validada) existe y queda detrás de
`cobroConRepartoHabilitado()`, que hoy devuelve `false`.

**Tech Stack:** Next 16 (App Router; `params` y `searchParams` son `Promise`), Prisma 6 sobre
Postgres (Neon), vitest, React 19 (`useActionState` en los formularios cliente), `@repo/payments`
(constructores y validador de Orders 1:N ya existentes), Resend vía `lib/communications/send-email`.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-05-mercado-de-cursos-design.md`
(secciones 3, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 6 —simulador al pedir una reventa—, 7 y etapas 2 a 5
de la sección 8). La etapa 1 está en producción; su plan es
`apps/fotoffice/docs/superpowers/plans/2026-10-05-mercado-de-cursos-etapa-1.md`.

## Global Constraints

- Trabajar **sólo** en el worktree `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite-wt-cursos-e2`,
  rama `feat/fotoffice-mercado-cursos-e2-5`. Nunca usar `git stash`. No tocar otras apps (sólo leer).
- Idioma de todo lo visible y de los comentarios: **español rioplatense con voseo** ("Quiero
  venderlo", "Tu parte", "podés"). Identificadores nuevos de `lib/course-marketplace`, en español.
- Antes de escribir código de Next, leé la guía pertinente en `node_modules/next/dist/docs/`.
  `params` y `searchParams` son `Promise`.
- **Ninguna dependencia nueva** (el lockfile es de toda la suite). `@repo/payments` ya está en
  `apps/fotoffice/package.json`.
- Plata en **centavos enteros** dentro de las reglas; porcentajes en **puntos básicos** (10000 = 100%).
  En la base, montos `Decimal(12,2)` como el resto del esquema.
- Fechas visibles en **hora argentina** (`fechaLegibleArgentina` de `lib/course-classroom/access-rules.ts`);
  montos en pesos.
- Tests: `pnpm --filter fotoffice test` (un archivo: `pnpm --filter fotoffice test <ruta>`). Vitest
  sólo levanta `lib/**/*.test.ts` y `app/**/*.test.ts`, en entorno node; los componentes no se testean.
- Typecheck: `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`.
  Puede morir por memoria y devolver 0: desconfiá si termina en segundos sin salida. Antes, el
  cliente de Prisma tiene que estar regenerado (Task 1), si no el typecheck miente.
- **Una sola migración nueva**, `packages/db/prisma/migrations/20261013120000_mercado_cursos_reventa/migration.sql`,
  escrita a mano, **sólo aditiva** (ningún `DROP`, `ALTER COLUMN` ni `RENAME`). **Ninguna tarea la
  aplica en ninguna base**: la aplica el controlador después, a mano. Hasta que esté aplicada, el
  código nuevo rompe toda consulta de `Course` (una columna sin aplicar rompe todo el modelo): no se
  despliega antes.
- **El split de Mercado Pago sigue apagado**: `FOTOFFICE_SPLIT_1N_ENABLED` en
  `lib/payments/split-1n.ts` queda en `false`. También vale el guard general
  `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED`. Los símbolos de Orders/Split (`buildMercadoPagoSplitOrderRequest`,
  `split_rules`, `receiver_type`, `DNX_MP_ORDERS_1N_*`, …) sólo pueden aparecer en archivos que
  estén **directamente** en `apps/fotoffice/lib/payments/` (el test del guard exime esa carpeta y
  nada más). `lib/presential-courses/checkout.ts` no puede contener la palabra `splits` ni `/v1/orders`.
- "Gratis para socios" sólo para el único beneficiario (ya en producción); el descuento de un
  revendedor tiene tope **en el servidor**: `0 ≤ D ≤ R < 100%`.
- Sin pasos de despliegue: el controlador despliega.

---

## Estructura de archivos

**Nuevos** (rutas relativas a `apps/fotoffice/` salvo que se diga otra cosa):

| Archivo | Responsabilidad |
|---|---|
| `packages/db/prisma/migrations/20261013120000_mercado_cursos_reventa/migration.sql` (raíz del repo) | Enum, tabla `CourseResaleAgreement`, columnas nuevas |
| `lib/course-marketplace/migracion-reventa.test.ts` | Barrera: la migración existe, es aditiva y coincide con el esquema |
| `lib/course-marketplace/reventa.ts` (+ test) | Reglas puras de la reventa: oferta, pedido, descuento, transiciones, simulación |
| `lib/course-marketplace/aviso-reventa.ts` (+ test) | Correos: pedido de reventa al dueño, respuesta al revendedor |
| `lib/course-marketplace/correos.ts` | Correos de dueños y admins de un negocio (movido desde `course-beneficiaries.ts`) |
| `app/actions/course-resale.ts` | Ofrecer, pedir, aprobar/rechazar/pausar/reanudar/terminar, cambiar descuento |
| `lib/course-marketplace/formato.ts` (+ test) | `pesos(centavos)` para las pantallas nuevas |
| `lib/course-marketplace/mercado.ts` | Carga del Mercado de cursos (servidor) |
| `lib/course-marketplace/acuerdos.ts` | Carga de los acuerdos de los dos lados (servidor) |
| `components/course-marketplace/pedir-reventa-form.tsx` | "Quiero venderlo" con la simulación en vivo |
| `components/course-marketplace/oferta-reventa-form.tsx` | "Ofrecer a otras instituciones" + % sugerido |
| `app/(shell)/dashboard/mercado-de-cursos/page.tsx` | El Mercado de cursos |
| `app/(shell)/dashboard/mercado-de-cursos/acuerdos/page.tsx` | Acuerdos: aprobar, pausar, terminar, descuento |
| `lib/course-marketplace/venta.ts` (+ test) | Decidir si se vende, montos con `R` y `D`, filas del reparto |
| `lib/course-marketplace/vitrina.ts` | Cursos revendidos en el sitio y el portal del revendedor (servidor) |
| `lib/payments/split-1n-cursos.ts` (+ test) | Orden de Mercado Pago con reparto para cursos (apagada) |
| `lib/course-marketplace/orden.ts` | Receptores y consentimientos desde la base; arma la orden de una inscripción |
| `lib/course-marketplace/cobros.ts` (+ test) | Resumen de Cobros |
| `app/(shell)/dashboard/cobros-de-cursos/page.tsx` | Pantalla Cobros |
| `lib/course-marketplace/invitacion-ensenar.ts` (+ test) | Textos y destino de "¿Querés enseñar?" |
| `components/course-marketplace/invitacion-a-ensenar.tsx` | La tarjeta "¿Querés enseñar?" |

**Modificados** (verificados en `origin/main` al escribir este plan):
`packages/db/prisma/schema.prisma`, `lib/course-marketplace/cargar.ts`,
`app/actions/course-beneficiaries.ts`, `lib/modules/submodules.ts` (+ test),
`app/(shell)/dashboard/courses/[courseId]/page.tsx`, `app/(shell)/dashboard/page.tsx`,
`lib/payments/split-1n.ts` (+ test), `app/w/[workspaceSlug]/cursos/page.tsx`,
`app/w/[workspaceSlug]/cursos/[courseSlug]/page.tsx`,
`app/w/[workspaceSlug]/cursos/[courseSlug]/muestra/[lessonId]/page.tsx`,
`components/presential-courses/recorded-course-section.tsx`,
`app/actions/public-course-enrollment.ts`, `lib/presential-courses/checkout.ts`,
`app/portal/cursos/page.tsx`, `components/portal/portal-home.tsx`,
`app/(shell)/dashboard/cursos-compartidos/page.tsx`,
`docs/payments/fotoffice-split-1n-disabled.md` (raíz del repo).

---

### Task 1: Esquema y migración de la reventa (etapa 2)

**Files:**
- Modify: `packages/db/prisma/schema.prisma` — `model Workspace` (≈ línea 7075, junto a
  `courseSaleShares`), `model Course` (≈ 9192, después de `freeForMembers` y de `beneficiaries`),
  `model CourseEnrollment` (≈ 9394, después de `discountArs`, `saleShares` y los `@@index`), enums
  (≈ 11166, después de `enum CourseSaleShareKind`).
- Create: `packages/db/prisma/migrations/20261013120000_mercado_cursos_reventa/migration.sql`
- Test: `apps/fotoffice/lib/course-marketplace/migracion-reventa.test.ts`

**Interfaces:**
- Produces (esquema, lo usan todas las tareas siguientes):
  - `enum CourseResaleAgreementStatus { PENDIENTE ACTIVO PAUSADO RECHAZADO TERMINADO }`
  - `model CourseResaleAgreement { id, courseId, resellerWorkspaceId, shareBps Int, memberDiscountBps Int @default(0), status @default(PENDIENTE), requestedByUserId Int?, approvedByUserId Int?, approvedAt DateTime?, pausedByWorkspaceId String?, endedAt DateTime?, createdAt, updatedAt }` con `@@unique([courseId, resellerWorkspaceId])`, `@@index([resellerWorkspaceId, status])`, `@@index([courseId, status])`; relaciones `course` (Cascade), `resellerWorkspace` (Cascade), `enrollments`.
  - `Course.offeredToResellers Boolean @default(false)`, `Course.suggestedResellerBps Int?`, `Course.resaleAgreements`.
  - `CourseEnrollment.resaleAgreementId String?` → `CourseResaleAgreement` con `onDelete: SetNull`, `@@index([resaleAgreementId])`.
  - `Workspace.courseResaleAgreements CourseResaleAgreement[]`.

- [ ] **Step 1: Escribir la barrera de la migración**

```ts
// apps/fotoffice/lib/course-marketplace/migracion-reventa.test.ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * La migración de la reventa se escribe a mano y la aplica el controlador después, también a
 * mano, en las bases. Esta barrera evita las dos cosas que más duelen: que no sea aditiva y que
 * no coincida con el esquema.
 */
const RAIZ = join(import.meta.dirname, "..", "..", "..", "..");
const MIGRACIONES = join(RAIZ, "packages", "db", "prisma", "migrations");
const CARPETA = "20261013120000_mercado_cursos_reventa";
const SQL = join(MIGRACIONES, CARPETA, "migration.sql");

describe("migración de la reventa de cursos", () => {
  it("existe y va después de la última que había en main", () => {
    expect(existsSync(SQL)).toBe(true);
    expect(CARPETA > "20261009120000_fotoffice_blog_banner_slot").toBe(true);
  });

  it("su marca de tiempo no la comparte ninguna otra carpeta", () => {
    const mismas = readdirSync(MIGRACIONES).filter((n) => n.startsWith("20261013120000_"));
    expect(mismas).toEqual([CARPETA]);
  });

  it("sólo agrega: nada de borrar, renombrar ni cambiar columnas", () => {
    const sql = readFileSync(SQL, "utf8");
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bRENAME\b/i);
    expect(sql).not.toMatch(/ALTER COLUMN/i);
  });

  it("crea el enum, la tabla, las columnas y las claves", () => {
    const sql = readFileSync(SQL, "utf8");
    expect(sql).toContain(`CREATE TYPE "CourseResaleAgreementStatus" AS ENUM ('PENDIENTE', 'ACTIVO', 'PAUSADO', 'RECHAZADO', 'TERMINADO');`);
    expect(sql).toContain(`CREATE TABLE "CourseResaleAgreement"`);
    expect(sql).toMatch(/"offeredToResellers" BOOLEAN NOT NULL DEFAULT false/);
    expect(sql).toMatch(/"suggestedResellerBps" INTEGER/);
    expect(sql).toMatch(/"resaleAgreementId" TEXT/);
    expect(sql).toContain(`CREATE UNIQUE INDEX "CourseResaleAgreement_courseId_resellerWorkspaceId_key"`);
    expect(sql).toMatch(/"CourseEnrollment_resaleAgreementId_fkey".*ON DELETE SET NULL/);
    expect(sql).toMatch(/"CourseResaleAgreement_courseId_fkey".*ON DELETE CASCADE/);
    expect(sql).toMatch(/"CourseResaleAgreement_resellerWorkspaceId_fkey".*ON DELETE CASCADE/);
  });

  it("el esquema declara lo mismo", () => {
    const esquema = readFileSync(join(RAIZ, "packages", "db", "prisma", "schema.prisma"), "utf8");
    expect(esquema).toMatch(/model CourseResaleAgreement \{/);
    expect(esquema).toMatch(/enum CourseResaleAgreementStatus \{/);
    expect(esquema).toMatch(/offeredToResellers\s+Boolean\s+@default\(false\)/);
    expect(esquema).toMatch(/suggestedResellerBps\s+Int\?/);
    expect(esquema).toMatch(/resaleAgreementId\s+String\?/);
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/course-marketplace/migracion-reventa.test.ts`
Expected: FAIL — `existsSync(SQL)` es `false`.

- [ ] **Step 3: El esquema**

Después de `enum CourseSaleShareKind { … }`:

```prisma
enum CourseResaleAgreementStatus {
  PENDIENTE
  ACTIVO
  PAUSADO
  RECHAZADO
  TERMINADO
}
```

Después de `model CourseSaleShare { … }`:

```prisma
/// Un negocio que vende el curso de otro (spec del mercado de cursos, sección 4.3).
///
/// `shareBps` sale de arriba de cada venta; el resto se reparte entre los beneficiarios. Hasta el
/// % sugerido del curso nace ACTIVO; por encima, PENDIENTE hasta que el dueño lo apruebe. Un
/// curso, un acuerdo por revendedor: pedir de nuevo después de un rechazo reabre la misma fila.
model CourseResaleAgreement {
  id                  String                      @id @default(cuid())
  courseId            String
  resellerWorkspaceId String
  /// Puntos básicos de cada venta para el revendedor: 0 < shareBps < 10000.
  shareBps            Int
  /// Descuento para los socios del revendedor, en puntos básicos: 0..shareBps.
  memberDiscountBps   Int                         @default(0)
  status              CourseResaleAgreementStatus @default(PENDIENTE)
  /// Quién pidió y quién aprobó (User.id). Sin relación a propósito: es un registro, no un permiso.
  requestedByUserId   Int?
  approvedByUserId    Int?
  approvedAt          DateTime?
  /// El negocio que lo pausó: sólo ése lo reanuda.
  pausedByWorkspaceId String?
  endedAt             DateTime?
  createdAt           DateTime                    @default(now())
  updatedAt           DateTime                    @updatedAt
  course              Course                      @relation(fields: [courseId], references: [id], onDelete: Cascade)
  resellerWorkspace   Workspace                   @relation(fields: [resellerWorkspaceId], references: [id], onDelete: Cascade)
  enrollments         CourseEnrollment[]

  @@unique([courseId, resellerWorkspaceId])
  @@index([resellerWorkspaceId, status])
  @@index([courseId, status])
}
```

En `model Course`, después de `freeForMembers`:

```prisma
  /// El dueño lo ofrece en el Mercado de cursos para que otros negocios lo revendan.
  offeredToResellers    Boolean            @default(false)
  /// % sugerido para revendedores, en puntos básicos. Hasta acá un pedido se aprueba solo.
  suggestedResellerBps  Int?
```

y en sus relaciones, después de `beneficiaries`: `resaleAgreements      CourseResaleAgreement[]`.

En `model CourseEnrollment`, después de `discountArs`:

```prisma
  /// El acuerdo por el que la vendió un revendedor. Null si la vendió el dueño.
  resaleAgreementId      String?
```

después de `saleShares`:
`resaleAgreement        CourseResaleAgreement?        @relation(fields: [resaleAgreementId], references: [id], onDelete: SetNull)`
y junto a los demás índices: `@@index([resaleAgreementId])`.

En `model Workspace`, después de `courseSaleShares`: `courseResaleAgreements      CourseResaleAgreement[]`.

- [ ] **Step 4: La migración, a mano**

```sql
-- packages/db/prisma/migrations/20261013120000_mercado_cursos_reventa/migration.sql
-- CreateEnum
CREATE TYPE "CourseResaleAgreementStatus" AS ENUM ('PENDIENTE', 'ACTIVO', 'PAUSADO', 'RECHAZADO', 'TERMINADO');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "offeredToResellers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suggestedResellerBps" INTEGER;

-- AlterTable
ALTER TABLE "CourseEnrollment" ADD COLUMN     "resaleAgreementId" TEXT;

-- CreateTable
CREATE TABLE "CourseResaleAgreement" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "resellerWorkspaceId" TEXT NOT NULL,
    "shareBps" INTEGER NOT NULL,
    "memberDiscountBps" INTEGER NOT NULL DEFAULT 0,
    "status" "CourseResaleAgreementStatus" NOT NULL DEFAULT 'PENDIENTE',
    "requestedByUserId" INTEGER,
    "approvedByUserId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "pausedByWorkspaceId" TEXT,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseResaleAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseEnrollment_resaleAgreementId_idx" ON "CourseEnrollment"("resaleAgreementId");

-- CreateIndex
CREATE INDEX "CourseResaleAgreement_resellerWorkspaceId_status_idx" ON "CourseResaleAgreement"("resellerWorkspaceId", "status");

-- CreateIndex
CREATE INDEX "CourseResaleAgreement_courseId_status_idx" ON "CourseResaleAgreement"("courseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CourseResaleAgreement_courseId_resellerWorkspaceId_key" ON "CourseResaleAgreement"("courseId", "resellerWorkspaceId");

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_resaleAgreementId_fkey" FOREIGN KEY ("resaleAgreementId") REFERENCES "CourseResaleAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseResaleAgreement" ADD CONSTRAINT "CourseResaleAgreement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseResaleAgreement" ADD CONSTRAINT "CourseResaleAgreement_resellerWorkspaceId_fkey" FOREIGN KEY ("resellerWorkspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 5: Validar, regenerar el cliente y comparar con lo que calcula Prisma (sin base)**

```bash
cd /Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite-wt-cursos-e2/packages/db
export DATABASE_URL=postgresql://x:x@localhost:5432/x DIRECT_URL=postgresql://x:x@localhost:5432/x
pnpm exec prisma validate
pnpm exec prisma generate
git show origin/main:packages/db/prisma/schema.prisma > "${TMPDIR:-/tmp}/schema-main.prisma"
pnpm exec prisma migrate diff --from-schema-datamodel "${TMPDIR:-/tmp}/schema-main.prisma" --to-schema-datamodel prisma/schema.prisma --script
```

Expected: `validate` y `generate` sin errores; el `diff` imprime **las mismas sentencias** que el
`migration.sql` (el orden puede variar). Si difiere en contenido (un nombre de índice, un tipo), se
corrige el `migration.sql` para que coincida, nunca al revés. Estos comandos **no se conectan** a
ninguna base; nada de `migrate dev`, `migrate deploy`, `db push` ni `migrate resolve`.

- [ ] **Step 6: Correr el test y verlo pasar**

Run: `pnpm --filter fotoffice test lib/course-marketplace/migracion-reventa.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20261013120000_mercado_cursos_reventa apps/fotoffice/lib/course-marketplace/migracion-reventa.test.ts
git commit -m "Mercado de cursos: acuerdos de reventa en el esquema y su migración (sin aplicar)"
```

---

### Task 2: Las reglas de la reventa

**Files:**
- Create: `lib/course-marketplace/reventa.ts`, `lib/course-marketplace/reventa.test.ts`

**Interfaces:**
- Consumes (`reparto.ts`, etapa 1): `BPS_TOTAL`, `MAX_RECEPTORES_SPLIT`, `calcularReparto`, `formatoPorcentaje`, `type BeneficiarioEntrada`.
- Produces:
  - `type EstadoReventa = "PENDIENTE" | "ACTIVO" | "PAUSADO" | "RECHAZADO" | "TERMINADO"`
  - `type LadoReventa = "DUENO" | "REVENDEDOR"`; `type AccionReventa = "APROBAR" | "RECHAZAR" | "PAUSAR" | "REANUDAR" | "TERMINAR"`
  - `ESTADOS_VIGENTES: readonly EstadoReventa[]` (= PENDIENTE, ACTIVO, PAUSADO); `ACCIONES_REVENTA: readonly AccionReventa[]`; `TOPE_SUGERIDO_BPS = 9000`
  - `porcentajeABps(texto: string | null | undefined): number | null`
  - `validarOferta(input: { ofrecido: boolean; sugeridoBps: number | null; grabadoConPrecio: boolean }): string[]`
  - `validarDescuentoDeSocios(descuentoBps: number, parteBps: number): string[]`
  - `estadoAlPedir(pedidoBps: number, sugeridoBps: number): "ACTIVO" | "PENDIENTE"`
  - `validarPedidoDeReventa(input: { pedidoBps: number | null; descuentoBps: number | null; ofrecido: boolean; sugeridoBps: number | null; esDueno: boolean; esBeneficiario: boolean; cantidadBeneficiarios: number; acuerdoVigente: boolean }): string[]`
  - `type CodigoReventa = "no-es-dueno" | "no-pendiente" | "no-activo" | "no-pausaste" | "ya-termino"`
  - `aplicarAccion(acuerdo: { status: EstadoReventa; pausadoPor: LadoReventa | null }, accion: AccionReventa, lado: LadoReventa): { ok: true; status: EstadoReventa; pausadoPor: LadoReventa | null } | { ok: false; codigo: CodigoReventa }`
  - `mensajeDeAcuerdos(codigo: string | undefined): string | null` — traduce el `?r=` de la página de acuerdos con un mapa fijo.
  - `simularReventa(input: { listaCentavos: number; comisionPlataformaBps: number; beneficiarios: BeneficiarioEntrada[]; pedidoBps: number; descuentoBps: number }): { ok: true; parteCentavos: number; pagaElAlumno: number; pagaElSocio: number } | { ok: false; errores: string[] }`

- [ ] **Step 1: Escribir el test**

```ts
// lib/course-marketplace/reventa.test.ts
import { describe, expect, it } from "vitest";
import {
  aplicarAccion,
  estadoAlPedir,
  mensajeDeAcuerdos,
  porcentajeABps,
  simularReventa,
  validarDescuentoDeSocios,
  validarOferta,
  validarPedidoDeReventa,
} from "./reventa";

const benef = [
  { id: "sfpr", nombre: "SFPR", bps: 3000, absorbeMp: false },
  { id: "prod", nombre: "Productora", bps: 2000, absorbeMp: false },
  { id: "doc", nombre: "Docente", bps: 5000, absorbeMp: true },
];

const pedidoBase = {
  pedidoBps: 2500,
  descuentoBps: 0,
  ofrecido: true,
  sugeridoBps: 2500,
  esDueno: false,
  esBeneficiario: false,
  cantidadBeneficiarios: 3,
  acuerdoVigente: false,
};

describe("porcentajes escritos a mano", () => {
  it("acepta coma, punto y el signo %", () => {
    expect(porcentajeABps("25")).toBe(2500);
    expect(porcentajeABps("12,5")).toBe(1250);
    expect(porcentajeABps("12.5 %")).toBe(1250);
  });
  it("vacío o basura es null", () => {
    expect(porcentajeABps("")).toBeNull();
    expect(porcentajeABps(undefined)).toBeNull();
    expect(porcentajeABps("mucho")).toBeNull();
  });
});

describe("ofrecer un curso a otras instituciones", () => {
  it("apagado no pide nada", () => {
    expect(validarOferta({ ofrecido: false, sugeridoBps: null, grabadoConPrecio: false })).toEqual([]);
  });
  it("encendido exige grabado con precio y un sugerido entre 0 y 90%", () => {
    expect(validarOferta({ ofrecido: true, sugeridoBps: 2500, grabadoConPrecio: true })).toEqual([]);
    expect(validarOferta({ ofrecido: true, sugeridoBps: 2500, grabadoConPrecio: false }).join()).toMatch(/grabados con precio/);
    expect(validarOferta({ ofrecido: true, sugeridoBps: null, grabadoConPrecio: true }).join()).toMatch(/sugerido/);
    expect(validarOferta({ ofrecido: true, sugeridoBps: 9500, grabadoConPrecio: true }).join()).toMatch(/90%/);
  });
});

describe("pedir una reventa", () => {
  it("hasta el sugerido queda activo al instante; por encima, pendiente", () => {
    expect(estadoAlPedir(2500, 2500)).toBe("ACTIVO");
    expect(estadoAlPedir(2000, 2500)).toBe("ACTIVO");
    expect(estadoAlPedir(2501, 2500)).toBe("PENDIENTE");
  });

  it("un pedido correcto no tiene errores", () => {
    expect(validarPedidoDeReventa(pedidoBase)).toEqual([]);
  });

  it("no se pide un curso que no se ofrece, el propio, uno donde ya sos beneficiario ni uno con acuerdo vigente", () => {
    expect(validarPedidoDeReventa({ ...pedidoBase, ofrecido: false }).join()).toMatch(/no se ofrece/);
    expect(validarPedidoDeReventa({ ...pedidoBase, esDueno: true }).join()).toMatch(/propio negocio/);
    expect(validarPedidoDeReventa({ ...pedidoBase, esBeneficiario: true }).join()).toMatch(/beneficiario/);
    expect(validarPedidoDeReventa({ ...pedidoBase, acuerdoVigente: true }).join()).toMatch(/Ya tenés un acuerdo/);
  });

  it("el % tiene que estar entre 0 y 100, sin incluirlos", () => {
    expect(validarPedidoDeReventa({ ...pedidoBase, pedidoBps: 0 }).join()).toMatch(/mayor que 0/);
    expect(validarPedidoDeReventa({ ...pedidoBase, pedidoBps: 10000 }).join()).toMatch(/menor que 100%/);
    expect(validarPedidoDeReventa({ ...pedidoBase, pedidoBps: null }).join()).toMatch(/mayor que 0/);
  });

  it("el descuento para socios no supera la parte del revendedor (regla del servidor)", () => {
    expect(validarPedidoDeReventa({ ...pedidoBase, descuentoBps: 2500 })).toEqual([]);
    expect(validarPedidoDeReventa({ ...pedidoBase, descuentoBps: 2600 }).join()).toMatch(/no puede superar 25%/);
    expect(validarDescuentoDeSocios(-1, 2500).join()).toMatch(/no es válido/);
  });

  it("no entra un revendedor si el curso ya llegó al máximo de cuentas de Mercado Pago", () => {
    expect(validarPedidoDeReventa({ ...pedidoBase, cantidadBeneficiarios: 10 })).toEqual([]);
    expect(validarPedidoDeReventa({ ...pedidoBase, cantidadBeneficiarios: 11 }).join()).toMatch(/máximo de cuentas/);
  });
});

describe("las transiciones de un acuerdo", () => {
  const pendiente = { status: "PENDIENTE" as const, pausadoPor: null };
  const activo = { status: "ACTIVO" as const, pausadoPor: null };

  it("sólo el dueño aprueba o rechaza, y sólo lo pendiente", () => {
    expect(aplicarAccion(pendiente, "APROBAR", "DUENO")).toEqual({ ok: true, status: "ACTIVO", pausadoPor: null });
    expect(aplicarAccion(pendiente, "RECHAZAR", "DUENO")).toEqual({ ok: true, status: "RECHAZADO", pausadoPor: null });
    expect(aplicarAccion(pendiente, "APROBAR", "REVENDEDOR")).toEqual({ ok: false, codigo: "no-es-dueno" });
    expect(aplicarAccion(activo, "APROBAR", "DUENO")).toEqual({ ok: false, codigo: "no-pendiente" });
  });

  it("cualquiera pausa lo activo; lo reanuda sólo quien lo pausó", () => {
    const pausado = aplicarAccion(activo, "PAUSAR", "REVENDEDOR");
    expect(pausado).toEqual({ ok: true, status: "PAUSADO", pausadoPor: "REVENDEDOR" });
    expect(aplicarAccion({ status: "PAUSADO", pausadoPor: "REVENDEDOR" }, "REANUDAR", "DUENO")).toEqual({ ok: false, codigo: "no-pausaste" });
    expect(aplicarAccion({ status: "PAUSADO", pausadoPor: "REVENDEDOR" }, "REANUDAR", "REVENDEDOR")).toEqual({ ok: true, status: "ACTIVO", pausadoPor: null });
    expect(aplicarAccion(pendiente, "PAUSAR", "DUENO")).toEqual({ ok: false, codigo: "no-activo" });
  });

  it("cualquiera termina lo vigente; lo terminado o rechazado no se vuelve a terminar", () => {
    expect(aplicarAccion(pendiente, "TERMINAR", "REVENDEDOR")).toEqual({ ok: true, status: "TERMINADO", pausadoPor: null });
    expect(aplicarAccion({ status: "PAUSADO", pausadoPor: "DUENO" }, "TERMINAR", "REVENDEDOR")).toEqual({ ok: true, status: "TERMINADO", pausadoPor: null });
    expect(aplicarAccion({ status: "TERMINADO", pausadoPor: null }, "TERMINAR", "DUENO")).toEqual({ ok: false, codigo: "ya-termino" });
    expect(aplicarAccion({ status: "RECHAZADO", pausadoPor: null }, "TERMINAR", "DUENO")).toEqual({ ok: false, codigo: "ya-termino" });
  });
});

describe("mensajes de la página de acuerdos", () => {
  it("traduce sólo códigos conocidos", () => {
    expect(mensajeDeAcuerdos("aprobado")).toMatch(/aprobaste/i);
    expect(mensajeDeAcuerdos("no-pausaste")).toMatch(/quien lo pausó/);
    expect(mensajeDeAcuerdos("<script>")).toBeNull();
    expect(mensajeDeAcuerdos(undefined)).toBeNull();
  });
});

describe("simular la reventa al pedirla (spec, sección 6)", () => {
  it("curso de $100.000 revendido al 25%: tu parte $25.000; tu socio con 25% paga $80.000", () => {
    const s = simularReventa({ listaCentavos: 10_000_000, comisionPlataformaBps: 500, beneficiarios: benef, pedidoBps: 2500, descuentoBps: 2500 });
    expect(s).toEqual({ ok: true, parteCentavos: 2_500_000, pagaElAlumno: 10_500_000, pagaElSocio: 8_000_000 });
  });

  it("devuelve los errores del motor", () => {
    const s = simularReventa({ listaCentavos: 10_000_000, comisionPlataformaBps: 500, beneficiarios: benef, pedidoBps: 2500, descuentoBps: 3000 });
    expect(s.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/course-marketplace/reventa.test.ts`
Expected: FAIL — `Failed to resolve import "./reventa"`.

- [ ] **Step 3: Implementar**

```ts
// lib/course-marketplace/reventa.ts
import { BPS_TOTAL, MAX_RECEPTORES_SPLIT, calcularReparto, formatoPorcentaje, type BeneficiarioEntrada } from "./reparto";

/**
 * Reglas de la reventa de un curso (spec del mercado de cursos, secciones 4.2 y 4.3). Puras: las
 * usan las acciones del servidor, los formularios del navegador y los tests.
 *
 * - El dueño ofrece el curso con un % sugerido. Un pedido hasta el sugerido queda ACTIVO al
 *   instante; por encima, PENDIENTE hasta que el dueño lo apruebe.
 * - El revendedor fija el descuento para sus socios, de 0 hasta su propio %: nunca toca la parte
 *   de los demás. Nunca llega a "gratis": su % es siempre menor que 100.
 * - Cualquiera de los dos pausa o termina; lo pausado lo reanuda quien lo pausó.
 */

export type EstadoReventa = "PENDIENTE" | "ACTIVO" | "PAUSADO" | "RECHAZADO" | "TERMINADO";
export type LadoReventa = "DUENO" | "REVENDEDOR";
export type AccionReventa = "APROBAR" | "RECHAZAR" | "PAUSAR" | "REANUDAR" | "TERMINAR";

/** Un acuerdo en estos estados impide pedir otro para el mismo curso. */
export const ESTADOS_VIGENTES: readonly EstadoReventa[] = ["PENDIENTE", "ACTIVO", "PAUSADO"];
export const ACCIONES_REVENTA: readonly AccionReventa[] = ["APROBAR", "RECHAZAR", "PAUSAR", "REANUDAR", "TERMINAR"];

/** El % sugerido más alto que puede fijar un dueño: algo tiene que quedar para los beneficiarios. */
export const TOPE_SUGERIDO_BPS = 9000;

/** "12,5" → 1250. Vacío o inválido → null. */
export function porcentajeABps(texto: string | null | undefined): number | null {
  const limpio = (texto ?? "").trim().replace("%", "").trim().replace(",", ".");
  if (!limpio) return null;
  const n = Number(limpio);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function validarOferta(input: { ofrecido: boolean; sugeridoBps: number | null; grabadoConPrecio: boolean }): string[] {
  if (!input.ofrecido) return [];
  const errores: string[] = [];
  if (!input.grabadoConPrecio) errores.push("Sólo se ofrecen a otras instituciones los cursos grabados con precio.");
  const s = input.sugeridoBps;
  if (s === null || !Number.isInteger(s) || s <= 0 || s > TOPE_SUGERIDO_BPS) {
    errores.push(`El % sugerido para revendedores tiene que ser mayor que 0 y de hasta ${formatoPorcentaje(TOPE_SUGERIDO_BPS)}.`);
  }
  return errores;
}

export function validarDescuentoDeSocios(descuentoBps: number, parteBps: number): string[] {
  if (!Number.isInteger(descuentoBps) || descuentoBps < 0) return ["El descuento no es válido."];
  if (descuentoBps > parteBps) {
    return [`El descuento para tus socios no puede superar ${formatoPorcentaje(parteBps)}: es tu parte.`];
  }
  return [];
}

export function estadoAlPedir(pedidoBps: number, sugeridoBps: number): "ACTIVO" | "PENDIENTE" {
  return pedidoBps <= sugeridoBps ? "ACTIVO" : "PENDIENTE";
}

export function validarPedidoDeReventa(input: {
  pedidoBps: number | null;
  descuentoBps: number | null;
  ofrecido: boolean;
  sugeridoBps: number | null;
  esDueno: boolean;
  esBeneficiario: boolean;
  cantidadBeneficiarios: number;
  acuerdoVigente: boolean;
}): string[] {
  if (!input.ofrecido || input.sugeridoBps === null) return ["Este curso no se ofrece a otras instituciones."];
  if (input.esDueno) return ["No podés revender un curso de tu propio negocio."];
  if (input.esBeneficiario) return ["Tu negocio ya es beneficiario de este curso: cobra su parte de cada venta."];
  if (input.acuerdoVigente) return ["Ya tenés un acuerdo para este curso. Lo ves en tus acuerdos."];
  const errores: string[] = [];
  const pedido = input.pedidoBps;
  if (pedido === null || !Number.isInteger(pedido) || pedido <= 0 || pedido >= BPS_TOTAL) {
    errores.push("Tu % tiene que ser mayor que 0 y menor que 100%.");
  } else {
    errores.push(...validarDescuentoDeSocios(input.descuentoBps ?? 0, pedido));
  }
  // Sin filas, el dueño es el único beneficiario: cuenta como uno.
  if (Math.max(1, input.cantidadBeneficiarios) + 1 > MAX_RECEPTORES_SPLIT) {
    errores.push("Este curso ya reparte entre el máximo de cuentas que admite Mercado Pago.");
  }
  return errores;
}

export type CodigoReventa = "no-es-dueno" | "no-pendiente" | "no-activo" | "no-pausaste" | "ya-termino";

export function aplicarAccion(
  acuerdo: { status: EstadoReventa; pausadoPor: LadoReventa | null },
  accion: AccionReventa,
  lado: LadoReventa,
): { ok: true; status: EstadoReventa; pausadoPor: LadoReventa | null } | { ok: false; codigo: CodigoReventa } {
  const { status } = acuerdo;
  switch (accion) {
    case "APROBAR":
    case "RECHAZAR":
      if (lado !== "DUENO") return { ok: false, codigo: "no-es-dueno" };
      if (status !== "PENDIENTE") return { ok: false, codigo: "no-pendiente" };
      return { ok: true, status: accion === "APROBAR" ? "ACTIVO" : "RECHAZADO", pausadoPor: null };
    case "PAUSAR":
      if (status !== "ACTIVO") return { ok: false, codigo: "no-activo" };
      return { ok: true, status: "PAUSADO", pausadoPor: lado };
    case "REANUDAR":
      if (status !== "PAUSADO" || acuerdo.pausadoPor !== lado) return { ok: false, codigo: "no-pausaste" };
      return { ok: true, status: "ACTIVO", pausadoPor: null };
    case "TERMINAR":
      if (!ESTADOS_VIGENTES.includes(status)) return { ok: false, codigo: "ya-termino" };
      return { ok: true, status: "TERMINADO", pausadoPor: null };
  }
}

/** Textos fijos para el `?r=` de la página de acuerdos: la URL nunca aporta texto. */
const MENSAJES_DE_ACUERDOS: Record<string, string> = {
  aprobado: "Aprobaste el pedido: el acuerdo quedó activo.",
  rechazado: "Rechazaste el pedido.",
  pausado: "Pausaste el acuerdo. Mientras esté pausado, el curso no se vende por ese canal.",
  reanudado: "Reanudaste el acuerdo.",
  terminado: "Terminaste el acuerdo. Quienes ya compraron conservan su acceso.",
  descuento: "Guardaste el descuento para tus socios. Vale para las ventas nuevas.",
  "descuento-invalido": "El descuento para tus socios no puede superar tu parte.",
  "sin-permiso": "Sólo el dueño o un administrador del negocio puede cambiar un acuerdo.",
  "no-encontrado": "Ese acuerdo ya no está disponible.",
  "no-es-dueno": "Sólo el dueño del curso puede aprobar o rechazar un pedido.",
  "no-pendiente": "Ese pedido ya no está pendiente.",
  "no-activo": "Sólo se puede pausar un acuerdo activo.",
  "no-pausaste": "Lo reanuda quien lo pausó.",
  "ya-termino": "Ese acuerdo ya terminó.",
};

export function mensajeDeAcuerdos(codigo: string | undefined): string | null {
  if (!codigo || !Object.hasOwn(MENSAJES_DE_ACUERDOS, codigo)) return null;
  return MENSAJES_DE_ACUERDOS[codigo];
}

/**
 * Lo que ve una institución al pedir una reventa, en modo lectura: su parte por venta y cuánto
 * pagaría un socio suyo con el descuento elegido. Mismo motor que después cobra.
 */
export function simularReventa(input: {
  listaCentavos: number;
  comisionPlataformaBps: number;
  beneficiarios: BeneficiarioEntrada[];
  pedidoBps: number;
  descuentoBps: number;
}): { ok: true; parteCentavos: number; pagaElAlumno: number; pagaElSocio: number } | { ok: false; errores: string[] } {
  const base = {
    listaCentavos: input.listaCentavos,
    comisionPlataformaBps: input.comisionPlataformaBps,
    beneficiarios: input.beneficiarios,
    reventa: { id: "revendedor", nombre: "Tu institución", bps: input.pedidoBps },
  };
  const publico = calcularReparto(base);
  if (!publico.ok) return publico;
  const socio = calcularReparto({ ...base, descuentoBps: input.descuentoBps });
  if (!socio.ok) return socio;
  const parte = publico.partes.find((p) => p.tipo === "REVENDEDOR")?.centavos ?? 0;
  return { ok: true, parteCentavos: parte, pagaElAlumno: publico.pagaElAlumno, pagaElSocio: socio.pagaElAlumno };
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `pnpm --filter fotoffice test lib/course-marketplace/reventa.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/course-marketplace/reventa.ts apps/fotoffice/lib/course-marketplace/reventa.test.ts
git commit -m "Mercado de cursos: reglas de la reventa (pedido, aprobación, pausa, descuento y simulación)"
```

---

### Task 3: Las acciones de la reventa y sus avisos

**Files:**
- Create: `lib/course-marketplace/aviso-reventa.ts`, `lib/course-marketplace/aviso-reventa.test.ts`
- Create: `lib/course-marketplace/correos.ts`
- Create: `app/actions/course-resale.ts`
- Modify: `app/actions/course-beneficiaries.ts` — borrar la función local `correosDeDuenos` (líneas
  23–30, "Correos de los dueños y administradores de un negocio") e importarla de
  `@/lib/course-marketplace/correos`. Nada más cambia en ese archivo.

**Interfaces:**
- Consumes: todo lo de `reventa.ts` (Task 2); `cargarDueno` de `@/lib/course-marketplace/cargar`; `formatoPorcentaje` (etapa 1); `requireCoursesSalesContext` de `@/lib/workspace`; `isFullAccessRole` de `@/lib/permissions/levels`; `sendTransactionalEmail` de `@/lib/communications/send-email`; `appUrl` de `@/lib/app-url`; `escaparHtml` de `@/lib/course-classroom/email`.
- Produces:
  - `correosDeDuenos(workspaceId: string): Promise<string[]>` (server-only)
  - `buildAvisoPedidoDeReventaEmail(input: { revendedor: string; curso: string; porcentaje: string; sugerido: string; enlace: string }): { subject: string; html: string; text: string }`
  - `buildAvisoRespuestaReventaEmail(input: { dueno: string; curso: string; aprobado: boolean; enlace: string }): { subject: string; html: string; text: string }`
  - `type EstadoFormulario = { error: string | null; ok: string | null }` (exportado como tipo desde `app/actions/course-resale.ts`)
  - server action `guardarOfertaAction(courseId: string, prev: EstadoFormulario, formData: FormData): Promise<EstadoFormulario>` — campos `ofrecido` (checkbox, `"on"`) y `sugerido` (texto, %).
  - server action `pedirReventaAction(courseId: string, prev: EstadoFormulario, formData: FormData): Promise<EstadoFormulario>` — campos `porcentaje`, `descuento`.
  - server action `cambiarEstadoDeReventaAction(agreementId: string, accion: AccionReventa): Promise<void>` — redirige a `/dashboard/mercado-de-cursos/acuerdos?r=<codigo>`.
  - server action `cambiarDescuentoDeReventaAction(agreementId: string, formData: FormData): Promise<void>` — campo `descuento`; redirige igual.

- [ ] **Step 1: Test de los avisos**

```ts
// lib/course-marketplace/aviso-reventa.test.ts
import { describe, expect, it } from "vitest";
import { buildAvisoPedidoDeReventaEmail, buildAvisoRespuestaReventaEmail } from "./aviso-reventa";

const enlace = "https://fotoffice.com/dashboard/mercado-de-cursos/acuerdos";

describe("aviso al dueño: alguien quiere vender tu curso", () => {
  const input = { revendedor: "Fotoclub <Norte>", curso: "Retrato", porcentaje: "30%", sugerido: "25%", enlace };

  it("dice quién, qué curso, cuánto pide, cuánto sugeriste y lleva el enlace", () => {
    const { subject, html, text } = buildAvisoPedidoDeReventaEmail(input);
    expect(subject).toBe("Fotoclub <Norte> quiere vender Retrato");
    expect(text).toContain("30%");
    expect(text).toContain("25%");
    expect(html).toContain(`href="${enlace}"`);
  });

  it("escapa lo que viene de afuera", () => {
    expect(buildAvisoPedidoDeReventaEmail(input).html).toContain("Fotoclub &lt;Norte&gt;");
  });
});

describe("aviso al revendedor: respuesta a tu pedido", () => {
  it("aprobado y rechazado dicen cosas distintas", () => {
    expect(buildAvisoRespuestaReventaEmail({ dueno: "SFPR", curso: "Retrato", aprobado: true, enlace }).subject).toBe("SFPR aprobó tu pedido para vender Retrato");
    expect(buildAvisoRespuestaReventaEmail({ dueno: "SFPR", curso: "Retrato", aprobado: false, enlace }).subject).toBe("SFPR rechazó tu pedido para vender Retrato");
  });
});
```

Run: `pnpm --filter fotoffice test lib/course-marketplace/aviso-reventa.test.ts` → FAIL (no existe).

- [ ] **Step 2: Implementar los avisos**

```ts
// lib/course-marketplace/aviso-reventa.ts
import { escaparHtml } from "@/lib/course-classroom/email";

type Correo = { subject: string; html: string; text: string };

/** Al dueño: un pedido por encima del % sugerido necesita su aprobación (spec, sección 4.3). */
export function buildAvisoPedidoDeReventaEmail(input: {
  revendedor: string;
  curso: string;
  porcentaje: string;
  sugerido: string;
  enlace: string;
}): Correo {
  const subject = `${input.revendedor} quiere vender ${input.curso}`;
  const html = `
<div>
  <p><strong>${escaparHtml(input.revendedor)}</strong> pidió vender tu curso <strong>${escaparHtml(input.curso)}</strong> quedándose con el <strong>${escaparHtml(input.porcentaje)}</strong> de cada venta.</p>
  <p>Vos sugeriste ${escaparHtml(input.sugerido)}: como lo supera, el acuerdo espera tu aprobación.</p>
  <p><a href="${escaparHtml(input.enlace)}">Ver el pedido</a></p>
</div>`.trim();
  const text = [
    `${input.revendedor} pidió vender tu curso ${input.curso} quedándose con el ${input.porcentaje} de cada venta.`,
    `Vos sugeriste ${input.sugerido}: como lo supera, el acuerdo espera tu aprobación.`,
    "",
    `Ver el pedido: ${input.enlace}`,
  ].join("\n");
  return { subject, html, text };
}

/** Al revendedor: el dueño respondió su pedido. */
export function buildAvisoRespuestaReventaEmail(input: { dueno: string; curso: string; aprobado: boolean; enlace: string }): Correo {
  const verbo = input.aprobado ? "aprobó" : "rechazó";
  const subject = `${input.dueno} ${verbo} tu pedido para vender ${input.curso}`;
  const detalle = input.aprobado
    ? "Ya podés venderlo: aparece en tu sitio y en el portal de tus socios."
    : "Podés volver a pedirlo con otro porcentaje.";
  const html = `
<div>
  <p><strong>${escaparHtml(input.dueno)}</strong> ${verbo} tu pedido para vender <strong>${escaparHtml(input.curso)}</strong>.</p>
  <p>${escaparHtml(detalle)}</p>
  <p><a href="${escaparHtml(input.enlace)}">Ver tus acuerdos</a></p>
</div>`.trim();
  const text = [`${input.dueno} ${verbo} tu pedido para vender ${input.curso}.`, detalle, "", `Ver tus acuerdos: ${input.enlace}`].join("\n");
  return { subject, html, text };
}
```

Run → PASS.

- [ ] **Step 3: Mover `correosDeDuenos`**

```ts
// lib/course-marketplace/correos.ts
import "server-only";
import { prisma } from "@repo/db";

/** Correos de los dueños y administradores de un negocio, para avisarles. */
export async function correosDeDuenos(workspaceId: string): Promise<string[]> {
  const filas = await prisma.workspaceMembership.findMany({
    where: { workspaceId, role: { in: ["WORKSPACE_OWNER", "WORKSPACE_ADMIN"] } },
    select: { user: { select: { email: true } } },
  });
  return filas.map((f) => f.user.email).filter(Boolean);
}
```

En `app/actions/course-beneficiaries.ts`: borrá la función local y agregá
`import { correosDeDuenos } from "@/lib/course-marketplace/correos";`.

- [ ] **Step 4: Las acciones**

```ts
// app/actions/course-resale.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, prisma } from "@repo/db";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { isFullAccessRole } from "@/lib/permissions/levels";
import { appUrl } from "@/lib/app-url";
import { sendTransactionalEmail } from "@/lib/communications/send-email";
import { cargarDueno } from "@/lib/course-marketplace/cargar";
import { correosDeDuenos } from "@/lib/course-marketplace/correos";
import { formatoPorcentaje } from "@/lib/course-marketplace/reparto";
import { buildAvisoPedidoDeReventaEmail, buildAvisoRespuestaReventaEmail } from "@/lib/course-marketplace/aviso-reventa";
import {
  ACCIONES_REVENTA,
  ESTADOS_VIGENTES,
  aplicarAccion,
  estadoAlPedir,
  porcentajeABps,
  validarDescuentoDeSocios,
  validarOferta,
  validarPedidoDeReventa,
  type AccionReventa,
  type LadoReventa,
} from "@/lib/course-marketplace/reventa";

export type EstadoFormulario = { error: string | null; ok: string | null };

const RUTA_ACUERDOS = "/dashboard/mercado-de-cursos/acuerdos";

const CODIGO_OK: Record<AccionReventa, string> = {
  APROBAR: "aprobado",
  RECHAZAR: "rechazado",
  PAUSAR: "pausado",
  REANUDAR: "reanudado",
  TERMINAR: "terminado",
};

/** Dueño o admin del negocio activo, con el módulo de cursos: un acuerdo compromete plata. */
async function gestion() {
  const { user, workspace } = await requireCoursesSalesContext("MANAGE");
  const membresia = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    select: { role: true },
  });
  return isFullAccessRole(membresia?.role) ? { user, workspace } : null;
}

/** Un correo que no sale no deshace nada: el pedido o la respuesta ya quedaron guardados. */
async function avisar(correos: string[], correo: { subject: string; html: string; text: string }, contexto: Record<string, string>) {
  for (const to of correos) {
    const r = await sendTransactionalEmail({ to, subject: correo.subject, html: correo.html, text: correo.text }).catch(
      (): { status: string } => ({ status: "INTERNAL_ERROR" }),
    );
    if (r.status !== "SENT") console.error("[fotoffice][mercado-cursos] no salió un aviso de reventa", { ...contexto, motivo: r.status });
  }
}

/** El dueño ofrece (o deja de ofrecer) un curso en el Mercado y fija el % sugerido. */
export async function guardarOfertaAction(courseId: string, _prev: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const ctx = await gestion();
  if (!ctx) return { error: "Sólo el dueño o un administrador del negocio puede ofrecer el curso.", ok: null };
  const curso = await prisma.course.findFirst({
    where: { id: courseId, workspaceId: ctx.workspace.id },
    select: { deliveryMode: true, priceArs: true },
  });
  if (!curso) return { error: "Curso no encontrado.", ok: null };
  const ofrecido = formData.get("ofrecido") === "on";
  const sugeridoBps = porcentajeABps(formData.get("sugerido")?.toString());
  const errores = validarOferta({
    ofrecido,
    sugeridoBps,
    grabadoConPrecio: curso.deliveryMode === "RECORDED" && Number(curso.priceArs ?? 0) > 0,
  });
  if (errores.length) return { error: errores.join(" "), ok: null };
  await prisma.course.update({
    where: { id: courseId },
    data: { offeredToResellers: ofrecido, ...(ofrecido && sugeridoBps !== null ? { suggestedResellerBps: sugeridoBps } : {}) },
  });
  revalidatePath(`/dashboard/courses/${courseId}`);
  revalidatePath("/dashboard/mercado-de-cursos");
  return {
    error: null,
    ok: ofrecido
      ? "Listo: el curso aparece en el Mercado de cursos."
      : "Listo: el curso ya no se ofrece a otras instituciones. Los acuerdos vigentes siguen.",
  };
}

/** "Quiero venderlo": la institución pide revender con su % y el descuento para sus socios. */
export async function pedirReventaAction(courseId: string, _prev: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const ctx = await gestion();
  if (!ctx) return { error: "Sólo el dueño o un administrador del negocio puede pedir una reventa.", ok: null };
  const curso = await prisma.course.findFirst({
    where: { id: courseId, status: "PUBLISHED", deliveryMode: "RECORDED" },
    select: {
      id: true,
      title: true,
      workspaceId: true,
      offeredToResellers: true,
      suggestedResellerBps: true,
      beneficiaries: { select: { workspaceId: true } },
      resaleAgreements: { where: { resellerWorkspaceId: ctx.workspace.id }, select: { id: true, status: true } },
    },
  });
  if (!curso) return { error: "Curso no encontrado.", ok: null };

  const pedidoBps = porcentajeABps(formData.get("porcentaje")?.toString());
  const descuentoBps = porcentajeABps(formData.get("descuento")?.toString()) ?? 0;
  const previo = curso.resaleAgreements[0] ?? null;
  const errores = validarPedidoDeReventa({
    pedidoBps,
    descuentoBps,
    ofrecido: curso.offeredToResellers,
    sugeridoBps: curso.suggestedResellerBps,
    esDueno: curso.workspaceId === ctx.workspace.id,
    esBeneficiario: curso.beneficiaries.some((b) => b.workspaceId === ctx.workspace.id),
    cantidadBeneficiarios: curso.beneficiaries.length,
    acuerdoVigente: previo !== null && ESTADOS_VIGENTES.includes(previo.status),
  });
  if (errores.length || pedidoBps === null || curso.suggestedResellerBps === null) {
    return { error: errores.join(" ") || "Pedido inválido.", ok: null };
  }

  const status = estadoAlPedir(pedidoBps, curso.suggestedResellerBps);
  const data = {
    shareBps: pedidoBps,
    memberDiscountBps: descuentoBps,
    status,
    requestedByUserId: ctx.user.id,
    approvedByUserId: null,
    approvedAt: status === "ACTIVO" ? new Date() : null,
    pausedByWorkspaceId: null,
    endedAt: null,
  };
  try {
    // Un acuerdo rechazado o terminado se reabre en la misma fila: un curso, un acuerdo por institución.
    if (previo) await prisma.courseResaleAgreement.update({ where: { id: previo.id }, data });
    else await prisma.courseResaleAgreement.create({ data: { courseId: curso.id, resellerWorkspaceId: ctx.workspace.id, ...data } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Ya tenés un acuerdo para este curso. Lo ves en tus acuerdos.", ok: null };
    }
    throw error;
  }

  if (status === "PENDIENTE") {
    try {
      const [revendedor, correos] = await Promise.all([cargarDueno(ctx.workspace.id), correosDeDuenos(curso.workspaceId)]);
      const correo = buildAvisoPedidoDeReventaEmail({
        revendedor: revendedor.nombre,
        curso: curso.title,
        porcentaje: formatoPorcentaje(pedidoBps),
        sugerido: formatoPorcentaje(curso.suggestedResellerBps),
        enlace: `${appUrl()}${RUTA_ACUERDOS}`,
      });
      await avisar(correos, correo, { courseId: curso.id });
    } catch {
      // Ídem: el pedido ya quedó guardado y el dueño lo ve en sus acuerdos.
    }
  }
  revalidatePath("/dashboard/mercado-de-cursos");
  revalidatePath(RUTA_ACUERDOS);
  return {
    error: null,
    ok:
      status === "ACTIVO"
        ? "Listo: ya podés venderlo. Aparece en tu sitio y en el portal de tus socios."
        : "Pedido enviado. Como supera el % sugerido, el dueño tiene que aprobarlo.",
  };
}

/** Aprobar, rechazar, pausar, reanudar o terminar un acuerdo, desde cualquiera de los dos lados. */
export async function cambiarEstadoDeReventaAction(agreementId: string, accion: AccionReventa): Promise<void> {
  // La acción viaja desde el navegador: se valida contra la lista cerrada.
  if (!ACCIONES_REVENTA.includes(accion)) redirect(`${RUTA_ACUERDOS}?r=no-encontrado`);
  const ctx = await gestion();
  if (!ctx) redirect(`${RUTA_ACUERDOS}?r=sin-permiso`);
  const acuerdo = await prisma.courseResaleAgreement.findUnique({
    where: { id: agreementId },
    select: {
      id: true,
      status: true,
      pausedByWorkspaceId: true,
      resellerWorkspaceId: true,
      course: { select: { id: true, title: true, workspaceId: true } },
    },
  });
  const lado: LadoReventa | null = !acuerdo
    ? null
    : acuerdo.course.workspaceId === ctx.workspace.id
      ? "DUENO"
      : acuerdo.resellerWorkspaceId === ctx.workspace.id
        ? "REVENDEDOR"
        : null;
  if (!acuerdo || !lado) redirect(`${RUTA_ACUERDOS}?r=no-encontrado`);

  const pausadoPor: LadoReventa | null =
    acuerdo.pausedByWorkspaceId === null ? null : acuerdo.pausedByWorkspaceId === acuerdo.course.workspaceId ? "DUENO" : "REVENDEDOR";
  const r = aplicarAccion({ status: acuerdo.status, pausadoPor }, accion, lado);
  if (!r.ok) redirect(`${RUTA_ACUERDOS}?r=${r.codigo}`);

  const ahora = new Date();
  // Atómico: sólo cambia si el estado sigue siendo el que se leyó (doble clic, los dos lados a la vez).
  const { count } = await prisma.courseResaleAgreement.updateMany({
    where: { id: acuerdo.id, status: acuerdo.status },
    data: {
      status: r.status,
      pausedByWorkspaceId: r.pausadoPor === null ? null : r.pausadoPor === "DUENO" ? acuerdo.course.workspaceId : acuerdo.resellerWorkspaceId,
      ...(accion === "APROBAR" ? { approvedAt: ahora, approvedByUserId: ctx.user.id } : {}),
      ...(r.status === "TERMINADO" || r.status === "RECHAZADO" ? { endedAt: ahora } : {}),
    },
  });
  if (count === 0) redirect(`${RUTA_ACUERDOS}?r=no-pendiente`);

  if (accion === "APROBAR" || accion === "RECHAZAR") {
    try {
      const [dueno, correos] = await Promise.all([cargarDueno(acuerdo.course.workspaceId), correosDeDuenos(acuerdo.resellerWorkspaceId)]);
      const correo = buildAvisoRespuestaReventaEmail({
        dueno: dueno.nombre,
        curso: acuerdo.course.title,
        aprobado: accion === "APROBAR",
        enlace: `${appUrl()}${RUTA_ACUERDOS}`,
      });
      await avisar(correos, correo, { agreementId: acuerdo.id });
    } catch {
      // La respuesta ya quedó guardada.
    }
  }
  revalidatePath(RUTA_ACUERDOS);
  revalidatePath("/dashboard/mercado-de-cursos");
  redirect(`${RUTA_ACUERDOS}?r=${CODIGO_OK[accion]}`);
}

/** El revendedor cambia el descuento para sus socios: de 0 hasta su %. Vale para las ventas nuevas. */
export async function cambiarDescuentoDeReventaAction(agreementId: string, formData: FormData): Promise<void> {
  const ctx = await gestion();
  if (!ctx) redirect(`${RUTA_ACUERDOS}?r=sin-permiso`);
  const acuerdo = await prisma.courseResaleAgreement.findFirst({
    where: { id: agreementId, resellerWorkspaceId: ctx.workspace.id },
    select: { id: true, shareBps: true, status: true },
  });
  if (!acuerdo || !ESTADOS_VIGENTES.includes(acuerdo.status)) redirect(`${RUTA_ACUERDOS}?r=no-encontrado`);
  const descuentoBps = porcentajeABps(formData.get("descuento")?.toString()) ?? 0;
  if (validarDescuentoDeSocios(descuentoBps, acuerdo.shareBps).length > 0) redirect(`${RUTA_ACUERDOS}?r=descuento-invalido`);
  await prisma.courseResaleAgreement.update({ where: { id: acuerdo.id }, data: { memberDiscountBps: descuentoBps } });
  revalidatePath(RUTA_ACUERDOS);
  redirect(`${RUTA_ACUERDOS}?r=descuento`);
}
```

Notas: `redirect` devuelve `never`, así que TypeScript estrecha `ctx` y `acuerdo` después de cada
`if (…) redirect(…)`. Si `ESTADOS_VIGENTES.includes(previo.status)` no compila porque el enum de
Prisma no es asignable a `EstadoReventa`, castealo con `previo.status as EstadoReventa` (son los
mismos cinco literales).

- [ ] **Step 5: Suite, tipos y commit**

Run: `pnpm --filter fotoffice test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: verde.

```bash
git add apps/fotoffice/lib/course-marketplace apps/fotoffice/app/actions/course-resale.ts apps/fotoffice/app/actions/course-beneficiaries.ts
git commit -m "Mercado de cursos: acciones para ofrecer, pedir y administrar reventas, con sus avisos"
```

---

### Task 4: La pantalla "Mercado de cursos" y "Quiero venderlo"

**Files:**
- Create: `lib/course-marketplace/formato.ts`, `lib/course-marketplace/formato.test.ts`
- Create: `lib/course-marketplace/mercado.ts`
- Create: `components/course-marketplace/pedir-reventa-form.tsx`
- Create: `app/(shell)/dashboard/mercado-de-cursos/page.tsx`
- Modify: `lib/course-marketplace/cargar.ts` — `async function nombresDeNegocios` (línea 6) pasa a `export async function nombresDeNegocios`. Nada más.
- Modify: `lib/modules/submodules.ts` — `const CURSOS` (línea 123): agregar la entrada del Mercado.
- Modify: `lib/modules/submodules.test.ts` — un caso nuevo dentro de `describe("submodulesFor", …)`.

**Interfaces:**
- Consumes: `simularReventa`, `porcentajeABps`, `type EstadoReventa` (Task 2); `pedirReventaAction`, `type EstadoFormulario` (Task 3); `beneficiariosParaMotor` (etapa 1); `getPlatformFeeBps`; `COURSES_SALES_MODULE_KEY`.
- Produces:
  - `pesos(centavos: number): string`
  - `type CursoEnMercado = { courseId: string; titulo: string; docente: string | null; dueno: { workspaceId: string; nombre: string }; listaCentavos: number; sugeridoBps: number; clases: number; muestraUrl: string | null; beneficiarios: BeneficiarioEntrada[]; miAcuerdo: { id: string; status: EstadoReventa; shareBps: number; memberDiscountBps: number } | null }`
  - `cargarMercado(workspaceId: string): Promise<{ comisionPlataformaBps: number; cursos: CursoEnMercado[] }>`
  - `PedirReventaForm(props: { courseId: string; listaCentavos: number; comisionPlataformaBps: number; beneficiarios: BeneficiarioEntrada[]; sugeridoBps: number })`
  - Ruta `/dashboard/mercado-de-cursos`.

- [ ] **Step 1: Tests que fallan (formato y menú)**

```ts
// lib/course-marketplace/formato.test.ts
import { describe, expect, it } from "vitest";
import { pesos } from "./formato";

describe("pesos", () => {
  it("de centavos a pesos argentinos sin decimales", () => {
    expect(pesos(10_500_000)).toMatch(/105\.000/);
    expect(pesos(10_500_000)).toContain("$");
  });
});
```

En `lib/modules/submodules.test.ts`, agregá el import
`import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";` y, dentro de
`describe("submodulesFor", …)`:

```ts
  it("Cursos: el Mercado de cursos está entre sus pantallas y tiene su archivo", () => {
    const hrefs = submodulesFor(COURSES_SALES_MODULE_KEY, GESTIONA, SOCIO).map((s) => s.href);
    expect(hrefs).toContain("/dashboard/mercado-de-cursos");
    expect(existsSync(pageDe("/dashboard/mercado-de-cursos")), "falta la pantalla del Mercado").toBe(true);
  });
```

Run: `pnpm --filter fotoffice test lib/course-marketplace/formato.test.ts lib/modules/submodules.test.ts`
Expected: FAIL (no existe `./formato`; el href no está).

- [ ] **Step 2: `formato.ts` y la entrada del menú**

```ts
// lib/course-marketplace/formato.ts
/** Centavos a pesos argentinos, sin decimales: "$ 105.000". */
export function pesos(centavos: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(centavos / 100);
}
```

En `lib/modules/submodules.ts`, dentro de `const CURSOS`, después de la entrada `/dashboard/courses`:

```ts
  {
    href: "/dashboard/mercado-de-cursos",
    label: "Mercado de cursos",
    icon: "Store",
    description: "Cursos de otros negocios que podés vender, y tus acuerdos de reventa.",
    requiresManage: false,
    activeMatch: "under",
  },
```

(`Store` ya está en `ICONOS` de `components/shell/nav-icons.ts`.)

- [ ] **Step 3: Exportar `nombresDeNegocios` y el cargador del Mercado**

En `lib/course-marketplace/cargar.ts`: `export async function nombresDeNegocios(…)`.

```ts
// lib/course-marketplace/mercado.ts
import "server-only";
import { prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { nombresDeNegocios } from "./cargar";
import { beneficiariosParaMotor } from "./beneficiarios";
import type { BeneficiarioEntrada } from "./reparto";
import type { EstadoReventa } from "./reventa";

export type CursoEnMercado = {
  courseId: string;
  titulo: string;
  docente: string | null;
  dueno: { workspaceId: string; nombre: string };
  listaCentavos: number;
  sugeridoBps: number;
  clases: number;
  muestraUrl: string | null;
  beneficiarios: BeneficiarioEntrada[];
  miAcuerdo: { id: string; status: EstadoReventa; shareBps: number; memberDiscountBps: number } | null;
};

/**
 * Los cursos que otros negocios ofrecen para revender (spec, sección 4.2): grabados, publicados,
 * con precio y con % sugerido. La comisión de la plataforma es la de quien mira, porque si lo
 * vende, la cobra su módulo de cursos.
 */
export async function cargarMercado(workspaceId: string): Promise<{ comisionPlataformaBps: number; cursos: CursoEnMercado[] }> {
  const [comisionPlataformaBps, filas] = await Promise.all([
    getPlatformFeeBps(workspaceId, COURSES_SALES_MODULE_KEY),
    prisma.course.findMany({
      where: {
        offeredToResellers: true,
        suggestedResellerBps: { not: null },
        status: "PUBLISHED",
        deliveryMode: "RECORDED",
        priceArs: { gt: 0 },
        workspaceId: { not: workspaceId },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        instructorName: true,
        priceArs: true,
        suggestedResellerBps: true,
        workspaceId: true,
        lessons: { where: { videoStatus: "READY" }, orderBy: { sortOrder: "asc" }, select: { id: true, isPreview: true } },
        beneficiaries: {
          orderBy: { createdAt: "asc" },
          select: { id: true, workspaceId: true, invitedEmail: true, shareBps: true, absorbsProcessorFee: true },
        },
        resaleAgreements: {
          where: { resellerWorkspaceId: workspaceId },
          select: { id: true, status: true, shareBps: true, memberDiscountBps: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  const ids = [
    ...new Set(filas.flatMap((f) => [f.workspaceId, ...f.beneficiaries.map((b) => b.workspaceId).filter((x): x is string => Boolean(x))])),
  ];
  const [nombres, marcas] = await Promise.all([
    nombresDeNegocios(ids),
    prisma.fotofficeWorkspaceBranding.findMany({
      where: { workspaceId: { in: filas.map((f) => f.workspaceId) } },
      select: { workspaceId: true, publicSlug: true },
    }),
  ]);
  const slugs = new Map(marcas.map((m) => [m.workspaceId, m.publicSlug]));
  const base = appUrl();

  return {
    comisionPlataformaBps,
    cursos: filas.map((f) => {
      const dueno = { workspaceId: f.workspaceId, nombre: nombres.get(f.workspaceId) ?? "Negocio" };
      const muestra = f.lessons.find((l) => l.isPreview);
      const slug = slugs.get(f.workspaceId);
      return {
        courseId: f.id,
        titulo: f.title,
        docente: f.instructorName,
        dueno,
        listaCentavos: Math.round(Number(f.priceArs ?? 0) * 100),
        sugeridoBps: f.suggestedResellerBps ?? 0,
        clases: f.lessons.length,
        // La muestra se ve en el sitio del dueño: los videos sólo se reproducen desde FOTOFFICE.
        muestraUrl: muestra && slug && base ? `${base}/w/${slug}/cursos/${f.slug}/muestra/${muestra.id}` : null,
        beneficiarios: beneficiariosParaMotor(
          dueno,
          f.beneficiaries.map((b) => ({
            ...b,
            nombre: b.workspaceId ? nombres.get(b.workspaceId) ?? "Negocio" : b.invitedEmail ?? "Invitado",
          })),
        ),
        miAcuerdo: f.resaleAgreements[0] ?? null,
      };
    }),
  };
}
```

- [ ] **Step 4: El formulario "Quiero venderlo"**

```tsx
// components/course-marketplace/pedir-reventa-form.tsx
"use client";

import { useActionState, useMemo, useState } from "react";
import { pedirReventaAction, type EstadoFormulario } from "@/app/actions/course-resale";
import { formatoPorcentaje, type BeneficiarioEntrada } from "@/lib/course-marketplace/reparto";
import { porcentajeABps, simularReventa } from "@/lib/course-marketplace/reventa";
import { pesos } from "@/lib/course-marketplace/formato";

const INICIAL: EstadoFormulario = { error: null, ok: null };

/**
 * "Quiero venderlo": la institución elige su % y el descuento para sus socios, y ve en vivo, con
 * el mismo motor que después cobra, cuánto se lleva por venta (spec, sección 6).
 */
export function PedirReventaForm({
  courseId,
  listaCentavos,
  comisionPlataformaBps,
  beneficiarios,
  sugeridoBps,
}: {
  courseId: string;
  listaCentavos: number;
  comisionPlataformaBps: number;
  beneficiarios: BeneficiarioEntrada[];
  sugeridoBps: number;
}) {
  const accionDelCurso = useMemo(() => pedirReventaAction.bind(null, courseId), [courseId]);
  const [estado, accion, enviando] = useActionState(accionDelCurso, INICIAL);
  const [porcentaje, setPorcentaje] = useState(String(sugeridoBps / 100).replace(".", ","));
  const [descuento, setDescuento] = useState("0");
  const pedidoBps = porcentajeABps(porcentaje) ?? 0;
  const descuentoBps = porcentajeABps(descuento) ?? 0;
  const sim = useMemo(
    () => simularReventa({ listaCentavos, comisionPlataformaBps, beneficiarios, pedidoBps, descuentoBps }),
    [listaCentavos, comisionPlataformaBps, beneficiarios, pedidoBps, descuentoBps],
  );

  if (estado.ok) {
    return (
      <p className="text-sm" role="status">
        {estado.ok}
      </p>
    );
  }

  return (
    <form action={accion} className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          Tu %{" "}
          <input name="porcentaje" value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} inputMode="decimal" className="fo-input inline-block w-20" />
        </label>
        <label className="text-sm">
          Descuento para tus socios (%){" "}
          <input name="descuento" value={descuento} onChange={(e) => setDescuento(e.target.value)} inputMode="decimal" className="fo-input inline-block w-20" />
        </label>
      </div>
      {sim.ok ? (
        <div className="space-y-1 text-sm">
          <p>
            Tu parte: <strong>{pesos(sim.parteCentavos)}</strong> por venta; podés darles a tus socios hasta {formatoPorcentaje(pedidoBps)} de descuento.
          </p>
          <p className="text-[var(--fo-muted)]">
            Paga el público {pesos(sim.pagaElAlumno)} · Paga tu socio {pesos(sim.pagaElSocio)}
          </p>
        </div>
      ) : (
        <ul className="list-disc pl-5 text-sm text-[var(--fo-danger)]">
          {sim.errores.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-[var(--fo-muted)]">
        {pedidoBps <= sugeridoBps
          ? "Hasta el % sugerido, el acuerdo queda activo al instante."
          : `Supera el ${formatoPorcentaje(sugeridoBps)} sugerido: el dueño tiene que aprobarlo.`}
      </p>
      {estado.error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {estado.error}
        </p>
      ) : null}
      <button type="submit" disabled={enviando} className="fo-btn fo-btn-primary text-sm">
        Quiero venderlo
      </button>
    </form>
  );
}
```

- [ ] **Step 5: La página**

```tsx
// app/(shell)/dashboard/mercado-de-cursos/page.tsx
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { cargarMercado } from "@/lib/course-marketplace/mercado";
import { formatoPorcentaje } from "@/lib/course-marketplace/reparto";
import { pesos } from "@/lib/course-marketplace/formato";
import { PedirReventaForm } from "@/components/course-marketplace/pedir-reventa-form";

export const dynamic = "force-dynamic";

const ESTADO_DE_MI_ACUERDO = {
  PENDIENTE: "Tu pedido espera la aprobación del dueño.",
  ACTIVO: "Lo estás vendiendo.",
  PAUSADO: "El acuerdo está pausado.",
  RECHAZADO: "El dueño rechazó tu pedido. Podés pedirlo de nuevo.",
  TERMINADO: "El acuerdo terminó. Podés pedirlo de nuevo.",
} as const;

export default async function MercadoDeCursosPage() {
  const { workspace } = await requireCoursesSalesContext("VIEW");
  const { comisionPlataformaBps, cursos } = await cargarMercado(workspace.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mercado de cursos"
        description="Cursos grabados de otros negocios que podés vender en tu sitio y en el portal de tus socios, quedándote con un porcentaje de cada venta."
        actions={
          <Link href="/dashboard/mercado-de-cursos/acuerdos" className="fo-btn fo-btn-secondary text-sm">
            Mis acuerdos
          </Link>
        }
      />
      {cursos.length === 0 ? (
        <p className="fo-card text-sm text-[var(--fo-muted)]">Todavía nadie ofrece cursos para revender.</p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {cursos.map((c) => {
            const puedePedir = !c.miAcuerdo || c.miAcuerdo.status === "RECHAZADO" || c.miAcuerdo.status === "TERMINADO";
            return (
              <li key={c.courseId} className="fo-card space-y-3">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold">{c.titulo}</h2>
                  <p className="text-sm text-[var(--fo-muted)]">
                    De {c.dueno.nombre}
                    {c.docente ? ` · Docente: ${c.docente}` : ""} · {c.clases} {c.clases === 1 ? "clase" : "clases"}
                  </p>
                  <p className="text-sm">
                    Precio de lista <strong>{pesos(c.listaCentavos)}</strong> · Sugerido para revendedores{" "}
                    <strong>{formatoPorcentaje(c.sugeridoBps)}</strong>
                  </p>
                  {c.muestraUrl ? (
                    <a href={c.muestraUrl} target="_blank" rel="noreferrer" className="text-sm text-[var(--fo-accent)] underline">
                      Ver la clase de muestra
                    </a>
                  ) : null}
                </div>
                {c.miAcuerdo ? <p className="text-sm font-medium">{ESTADO_DE_MI_ACUERDO[c.miAcuerdo.status]}</p> : null}
                {puedePedir ? (
                  <PedirReventaForm
                    courseId={c.courseId}
                    listaCentavos={c.listaCentavos}
                    comisionPlataformaBps={comisionPlataformaBps}
                    beneficiarios={c.beneficiarios}
                    sugeridoBps={c.sugeridoBps}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Suite, tipos y commit**

Run: `pnpm --filter fotoffice test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: verde (incluye el caso nuevo de `submodules.test.ts` y "cada ícono declarado existe").

```bash
git add apps/fotoffice/lib apps/fotoffice/components/course-marketplace/pedir-reventa-form.tsx "apps/fotoffice/app/(shell)/dashboard/mercado-de-cursos/page.tsx"
git commit -m "Mercado de cursos: la pantalla del Mercado y el pedido 'Quiero venderlo' con su simulación"
```

---

### Task 5: Acuerdos de los dos lados y la oferta en la ficha del curso

**Files:**
- Create: `lib/course-marketplace/acuerdos.ts`
- Create: `app/(shell)/dashboard/mercado-de-cursos/acuerdos/page.tsx`
- Create: `components/course-marketplace/oferta-reventa-form.tsx`
- Modify: `app/(shell)/dashboard/courses/[courseId]/page.tsx` — después del bloque
  `{grabado && dueno ? ( … "Beneficiarios y reparto" … ) : null}` (empieza en la línea 172),
  una sección nueva "Ofrecer a otras instituciones".
- Modify: `app/(shell)/dashboard/page.tsx` — junto al conteo de `invitacionesPendientes`
  (líneas 34–45) y su aviso (líneas 58–70): conteo y aviso de pedidos de reventa pendientes.
- Modify: `lib/modules/submodules.test.ts` — el caso del Mercado también exige
  `pageDe("/dashboard/mercado-de-cursos/acuerdos")`.

**Interfaces:**
- Consumes: `guardarOfertaAction`, `cambiarEstadoDeReventaAction`, `cambiarDescuentoDeReventaAction`, `type EstadoFormulario` (Task 3); `simularReventa`, `porcentajeABps`, `mensajeDeAcuerdos`, `ESTADOS_VIGENTES`, `type EstadoReventa` (Task 2); `nombresDeNegocios` (Task 4); `pesos` (Task 4); `beneficiariosParaMotor` (etapa 1).
- Produces:
  - `type AcuerdoVista = { id: string; status: EstadoReventa; shareBps: number; memberDiscountBps: number; curso: { id: string; titulo: string; listaCentavos: number }; otraParte: string; pausadoPorMi: boolean; desde: Date }`
  - `cargarAcuerdos(workspaceId: string): Promise<{ comoDueno: AcuerdoVista[]; comoRevendedor: AcuerdoVista[] }>`
  - `OfertaReventaForm(props: { courseId: string; ofrecido: boolean; sugeridoBps: number | null; listaCentavos: number; comisionPlataformaBps: number; beneficiarios: BeneficiarioEntrada[] })`
  - Ruta `/dashboard/mercado-de-cursos/acuerdos`.

- [ ] **Step 1: Test que falla**

En el caso "Cursos: el Mercado de cursos…" de `lib/modules/submodules.test.ts`, agregá:

```ts
    expect(existsSync(pageDe("/dashboard/mercado-de-cursos/acuerdos")), "falta la pantalla de acuerdos").toBe(true);
```

Run: `pnpm --filter fotoffice test lib/modules/submodules.test.ts` → FAIL.

- [ ] **Step 2: El cargador de acuerdos**

```ts
// lib/course-marketplace/acuerdos.ts
import "server-only";
import { prisma } from "@repo/db";
import { nombresDeNegocios } from "./cargar";
import type { EstadoReventa } from "./reventa";

export type AcuerdoVista = {
  id: string;
  status: EstadoReventa;
  shareBps: number;
  memberDiscountBps: number;
  curso: { id: string; titulo: string; listaCentavos: number };
  otraParte: string;
  pausadoPorMi: boolean;
  desde: Date;
};

const SELECT = {
  id: true,
  status: true,
  shareBps: true,
  memberDiscountBps: true,
  resellerWorkspaceId: true,
  pausedByWorkspaceId: true,
  createdAt: true,
  course: { select: { id: true, title: true, priceArs: true, workspaceId: true } },
} as const;

/** Los acuerdos de un negocio: sobre sus cursos (como dueño) y los que revende. */
export async function cargarAcuerdos(workspaceId: string): Promise<{ comoDueno: AcuerdoVista[]; comoRevendedor: AcuerdoVista[] }> {
  const [comoDueno, comoRevendedor] = await Promise.all([
    prisma.courseResaleAgreement.findMany({ where: { course: { workspaceId } }, select: SELECT, orderBy: { createdAt: "desc" } }),
    prisma.courseResaleAgreement.findMany({ where: { resellerWorkspaceId: workspaceId }, select: SELECT, orderBy: { createdAt: "desc" } }),
  ]);
  const nombres = await nombresDeNegocios([
    ...new Set([...comoDueno.map((a) => a.resellerWorkspaceId), ...comoRevendedor.map((a) => a.course.workspaceId)]),
  ]);
  const vista = (a: (typeof comoDueno)[number], otra: string): AcuerdoVista => ({
    id: a.id,
    status: a.status,
    shareBps: a.shareBps,
    memberDiscountBps: a.memberDiscountBps,
    curso: { id: a.course.id, titulo: a.course.title, listaCentavos: Math.round(Number(a.course.priceArs ?? 0) * 100) },
    otraParte: nombres.get(otra) ?? "Negocio",
    pausadoPorMi: a.pausedByWorkspaceId === workspaceId,
    desde: a.createdAt,
  });
  return {
    comoDueno: comoDueno.map((a) => vista(a, a.resellerWorkspaceId)),
    comoRevendedor: comoRevendedor.map((a) => vista(a, a.course.workspaceId)),
  };
}
```

- [ ] **Step 3: La página de acuerdos**

```tsx
// app/(shell)/dashboard/mercado-de-cursos/acuerdos/page.tsx
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { cargarAcuerdos, type AcuerdoVista } from "@/lib/course-marketplace/acuerdos";
import { ESTADOS_VIGENTES, mensajeDeAcuerdos } from "@/lib/course-marketplace/reventa";
import { formatoPorcentaje, BPS_TOTAL } from "@/lib/course-marketplace/reparto";
import { pesos } from "@/lib/course-marketplace/formato";
import { fechaLegibleArgentina } from "@/lib/course-classroom/access-rules";
import { cambiarDescuentoDeReventaAction, cambiarEstadoDeReventaAction } from "@/app/actions/course-resale";

export const dynamic = "force-dynamic";

const ESTADOS = { PENDIENTE: "Pendiente", ACTIVO: "Activo", PAUSADO: "Pausado", RECHAZADO: "Rechazado", TERMINADO: "Terminado" } as const;

function Boton({ id, accion, texto, primario = false }: { id: string; accion: "APROBAR" | "RECHAZAR" | "PAUSAR" | "REANUDAR" | "TERMINAR"; texto: string; primario?: boolean }) {
  return (
    <form action={cambiarEstadoDeReventaAction.bind(null, id, accion)}>
      <button type="submit" className={`fo-btn ${primario ? "fo-btn-primary" : "fo-btn-secondary"} text-sm`}>
        {texto}
      </button>
    </form>
  );
}

function Resumen({ a, rotulo }: { a: AcuerdoVista; rotulo: string }) {
  return (
    <div className="space-y-1">
      <p className="font-medium">{a.curso.titulo}</p>
      <p className="text-sm text-[var(--fo-muted)]">
        {rotulo} {a.otraParte} · {formatoPorcentaje(a.shareBps)} por venta ({pesos(Math.round((a.curso.listaCentavos * a.shareBps) / BPS_TOTAL))}) ·
        Descuento para socios {formatoPorcentaje(a.memberDiscountBps)} · {ESTADOS[a.status]} desde el {fechaLegibleArgentina(a.desde)}
      </p>
    </div>
  );
}

export default async function AcuerdosDeReventaPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { workspace } = await requireCoursesSalesContext("VIEW");
  const { r } = await searchParams;
  const mensaje = mensajeDeAcuerdos(r);
  const { comoDueno, comoRevendedor } = await cargarAcuerdos(workspace.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Acuerdos de reventa"
        description="Quién vende tus cursos y qué cursos de otros vendés vos. Cualquiera de los dos puede pausar o terminar un acuerdo; quienes ya compraron conservan su acceso."
        actions={
          <Link href="/dashboard/mercado-de-cursos" className="fo-btn fo-btn-secondary text-sm">
            Volver al Mercado
          </Link>
        }
      />
      {mensaje ? (
        <p className="fo-card text-sm" role="status">
          {mensaje}
        </p>
      ) : null}

      <section className="space-y-3" aria-label="Sobre tus cursos">
        <h2 className="text-lg font-semibold">Quién vende tus cursos</h2>
        {comoDueno.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Nadie pidió vender tus cursos todavía.</p>
        ) : (
          <ul className="space-y-3">
            {comoDueno.map((a) => (
              <li key={a.id} className="fo-card space-y-3">
                <Resumen a={a} rotulo="Lo vende" />
                <div className="flex flex-wrap gap-2">
                  {a.status === "PENDIENTE" ? (
                    <>
                      <Boton id={a.id} accion="APROBAR" texto="Aprobar" primario />
                      <Boton id={a.id} accion="RECHAZAR" texto="Rechazar" />
                    </>
                  ) : null}
                  {a.status === "ACTIVO" ? <Boton id={a.id} accion="PAUSAR" texto="Pausar" /> : null}
                  {a.status === "PAUSADO" && a.pausadoPorMi ? <Boton id={a.id} accion="REANUDAR" texto="Reanudar" /> : null}
                  {a.status === "ACTIVO" || a.status === "PAUSADO" ? <Boton id={a.id} accion="TERMINAR" texto="Terminar" /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-label="Cursos que revendés">
        <h2 className="text-lg font-semibold">Cursos que vendés</h2>
        {comoRevendedor.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">
            Todavía no vendés cursos de otros. Buscalos en el <Link href="/dashboard/mercado-de-cursos" className="underline">Mercado de cursos</Link>.
          </p>
        ) : (
          <ul className="space-y-3">
            {comoRevendedor.map((a) => (
              <li key={a.id} className="fo-card space-y-3">
                <Resumen a={a} rotulo="De" />
                {ESTADOS_VIGENTES.includes(a.status) ? (
                  <form action={cambiarDescuentoDeReventaAction.bind(null, a.id)} className="flex flex-wrap items-end gap-2">
                    <label className="text-sm">
                      Descuento para tus socios (%, hasta {formatoPorcentaje(a.shareBps)}){" "}
                      <input name="descuento" defaultValue={String(a.memberDiscountBps / 100).replace(".", ",")} inputMode="decimal" className="fo-input inline-block w-20" />
                    </label>
                    <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                      Guardar descuento
                    </button>
                  </form>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {a.status === "ACTIVO" ? <Boton id={a.id} accion="PAUSAR" texto="Pausar" /> : null}
                  {a.status === "PAUSADO" && a.pausadoPorMi ? <Boton id={a.id} accion="REANUDAR" texto="Reanudar" /> : null}
                  {ESTADOS_VIGENTES.includes(a.status) ? <Boton id={a.id} accion="TERMINAR" texto={a.status === "PENDIENTE" ? "Cancelar pedido" : "Terminar"} /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: El formulario de la oferta**

```tsx
// components/course-marketplace/oferta-reventa-form.tsx
"use client";

import { useActionState, useMemo, useState } from "react";
import { guardarOfertaAction, type EstadoFormulario } from "@/app/actions/course-resale";
import type { BeneficiarioEntrada } from "@/lib/course-marketplace/reparto";
import { porcentajeABps, simularReventa } from "@/lib/course-marketplace/reventa";
import { pesos } from "@/lib/course-marketplace/formato";

const INICIAL: EstadoFormulario = { error: null, ok: null };

/** "Ofrecer a otras instituciones" y el % sugerido, con lo que cobraría un revendedor por venta. */
export function OfertaReventaForm({
  courseId,
  ofrecido,
  sugeridoBps,
  listaCentavos,
  comisionPlataformaBps,
  beneficiarios,
}: {
  courseId: string;
  ofrecido: boolean;
  sugeridoBps: number | null;
  listaCentavos: number;
  comisionPlataformaBps: number;
  beneficiarios: BeneficiarioEntrada[];
}) {
  const accionDelCurso = useMemo(() => guardarOfertaAction.bind(null, courseId), [courseId]);
  const [estado, accion, enviando] = useActionState(accionDelCurso, INICIAL);
  const [sugerido, setSugerido] = useState(sugeridoBps === null ? "20" : String(sugeridoBps / 100).replace(".", ","));
  const bps = porcentajeABps(sugerido) ?? 0;
  const sim = useMemo(
    () => simularReventa({ listaCentavos, comisionPlataformaBps, beneficiarios, pedidoBps: bps, descuentoBps: 0 }),
    [listaCentavos, comisionPlataformaBps, beneficiarios, bps],
  );

  return (
    <form action={accion} className="fo-card space-y-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="ofrecido" defaultChecked={ofrecido} />
        Ofrecer a otras instituciones
      </label>
      <label className="text-sm">
        % sugerido para revendedores{" "}
        <input name="sugerido" value={sugerido} onChange={(e) => setSugerido(e.target.value)} inputMode="decimal" className="fo-input inline-block w-20" />
      </label>
      {sim.ok ? (
        <p className="text-sm text-[var(--fo-muted)]">
          Con ese %, quien lo revende cobra {pesos(sim.parteCentavos)} por venta y el resto se reparte entre los beneficiarios. Hasta ese %, los pedidos se aprueban solos; por encima, te llegan para aprobar.
        </p>
      ) : null}
      {estado.error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {estado.error}
        </p>
      ) : null}
      {estado.ok ? (
        <p className="text-sm" role="status">
          {estado.ok}
        </p>
      ) : null}
      <button type="submit" disabled={enviando} className="fo-btn fo-btn-primary text-sm">
        Guardar
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Montarlo en la ficha del curso**

En `app/(shell)/dashboard/courses/[courseId]/page.tsx`, imports nuevos:
`OfertaReventaForm` de `@/components/course-marketplace/oferta-reventa-form`,
`beneficiariosParaMotor` (sumarlo al import existente de `@/lib/course-marketplace/beneficiarios`).
Después de `const estado = …` (línea ≈ 74):

```tsx
  const pedidosPendientes = grabado
    ? await prisma.courseResaleAgreement.count({ where: { courseId: course.id, status: "PENDIENTE" } })
    : 0;
```

y después del bloque de "Beneficiarios y reparto":

```tsx
      {grabado && dueno && puedeEditarReparto && precioCentavos > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Ofrecer a otras instituciones</h2>
          <OfertaReventaForm
            courseId={course.id}
            ofrecido={course.offeredToResellers}
            sugeridoBps={course.suggestedResellerBps}
            listaCentavos={precioCentavos}
            comisionPlataformaBps={feeBps}
            beneficiarios={beneficiariosParaMotor(dueno, beneficiarios)}
          />
          {pedidosPendientes > 0 ? (
            <p className="text-sm">
              <Link href="/dashboard/mercado-de-cursos/acuerdos" className="text-[var(--fo-accent)] underline">
                {pedidosPendientes === 1 ? "Un pedido de reventa espera tu respuesta" : `${pedidosPendientes} pedidos de reventa esperan tu respuesta`}
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}
```

(`getCourseForEdit` hace `findFirst` sin `select`: ya trae las columnas nuevas.)

- [ ] **Step 6: El aviso en el tablero**

En `app/(shell)/dashboard/page.tsx`, después del `try` de `invitacionesPendientes`:

```ts
  let pedidosDeReventa = 0;
  if (workspace !== null) {
    try {
      pedidosDeReventa = await prisma.courseResaleAgreement.count({
        where: { status: "PENDIENTE", course: { workspaceId: workspace.id } },
      });
    } catch {
      console.error("[dashboard] no se pudieron contar los pedidos de reventa");
    }
  }
```

y después del aviso de invitaciones:

```tsx
      {pedidosDeReventa > 0 ? (
        <div className="fo-card" role="status">
          <p className="text-sm font-medium text-[var(--fo-text)]">
            {pedidosDeReventa === 1 ? "Una institución quiere vender uno de tus cursos" : `${pedidosDeReventa} pedidos para vender tus cursos`}
          </p>
          <p className="mt-2 text-sm">
            <Link href="/dashboard/mercado-de-cursos/acuerdos" className="text-[var(--fo-accent)] underline">
              Ver los pedidos
            </Link>
          </p>
        </div>
      ) : null}
```

- [ ] **Step 7: Suite, tipos y commit**

Run: `pnpm --filter fotoffice test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: verde. Si algún test del tablero simula `prisma`, agregá `courseResaleAgreement.count` devolviendo 0.

```bash
git add apps/fotoffice
git commit -m "Mercado de cursos: acuerdos de los dos lados, oferta en la ficha y aviso de pedidos"
```

---

### Task 6: Las reglas de la venta con reventa y descuento (etapa 3) y la llave del cobro con reparto

**Files:**
- Create: `lib/course-marketplace/venta.ts`, `lib/course-marketplace/venta.test.ts`
- Modify: `lib/payments/split-1n.ts` — agregar `cobroConRepartoHabilitado` al final (la constante
  `FOTOFFICE_SPLIT_1N_ENABLED` **no** cambia).
- Modify: `lib/payments/split-1n.test.ts` — un caso nuevo en el `describe` existente.

**Interfaces:**
- Consumes: `calcularReparto`, `type BeneficiarioEntrada`, `type ParteDelReparto` (etapa 1); `type EstadoDeVenta` (etapa 1, `beneficiarios.ts`); `isFotofficeSplit1nEnabled` (existente).
- Produces:
  - `cobroConRepartoHabilitado(env?: NodeJS.ProcessEnv): boolean` — `false` mientras `FOTOFFICE_SPLIT_1N_ENABLED` sea `false`; con el interruptor en `true`, además exige `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED` verdadero.
  - `type DecisionDeVenta = { tipo: "SIN_REPARTO" } | { tipo: "CON_REPARTO" } | { tipo: "PROXIMAMENTE"; motivo: string }`
  - `decidirVenta(input: { estado: EstadoDeVenta; revendido: boolean; splitHabilitado: boolean }): DecisionDeVenta`
  - `type MontosDeVenta = { ok: true; listPriceArs: string; discountArs: string; platformFeeArs: string; amountArs: string; netAmountArs: string; partes: ParteDelReparto[] } | { ok: false; error: string }` (misma forma que `montosDeCompraSinReparto`)
  - `montosDeVenta(input: { listaArs: string | number; comisionPlataformaBps: number; beneficiarios: BeneficiarioEntrada[]; vendedorWorkspaceId: string; reventa: { workspaceId: string; nombre: string; bps: number; descuentoSociosBps: number } | null; esSocioDelVendedor: boolean }): MontosDeVenta`
  - `filasDeReparto(partes: ParteDelReparto[]): Array<{ workspaceId: string | null; kind: ParteDelReparto["tipo"]; label: string; amountArs: string; absorbsProcessorFee: boolean }>`

- [ ] **Step 1: Escribir el test**

```ts
// lib/course-marketplace/venta.test.ts
import { describe, expect, it } from "vitest";
import { decidirVenta, filasDeReparto, montosDeVenta } from "./venta";

const benef = [
  { id: "ws-sfpr", nombre: "SFPR", bps: 3000, absorbeMp: false },
  { id: "ws-prod", nombre: "Productora", bps: 2000, absorbeMp: false },
  { id: "ws-doc", nombre: "Docente", bps: 5000, absorbeMp: true },
];
const club = { workspaceId: "ws-club", nombre: "Fotoclub Norte", bps: 2500, descuentoSociosBps: 2500 };

describe("decidir si un curso se vende", () => {
  const sinReparto = { tipo: "SIN_REPARTO" as const };
  const listo = { tipo: "CON_REPARTO" as const, listo: true, faltantes: [] };
  const falta = { tipo: "CON_REPARTO" as const, listo: false, faltantes: ["Productora todavía no aceptó."] };

  it("sin reparto y vendido por el dueño: se vende como hoy, con el split apagado o no", () => {
    expect(decidirVenta({ estado: sinReparto, revendido: false, splitHabilitado: false })).toEqual({ tipo: "SIN_REPARTO" });
  });

  it("con el split apagado, todo lo revendido o con varios beneficiarios es 'próximamente'", () => {
    expect(decidirVenta({ estado: sinReparto, revendido: true, splitHabilitado: false }).tipo).toBe("PROXIMAMENTE");
    expect(decidirVenta({ estado: listo, revendido: false, splitHabilitado: false }).tipo).toBe("PROXIMAMENTE");
  });

  it("con el split encendido, se vende con reparto si todo está listo", () => {
    expect(decidirVenta({ estado: listo, revendido: true, splitHabilitado: true })).toEqual({ tipo: "CON_REPARTO" });
    expect(decidirVenta({ estado: sinReparto, revendido: true, splitHabilitado: true })).toEqual({ tipo: "CON_REPARTO" });
    expect(decidirVenta({ estado: falta, revendido: false, splitHabilitado: true })).toEqual({ tipo: "PROXIMAMENTE", motivo: "Productora todavía no aceptó." });
  });
});

describe("los montos de una venta (spec, sección 2.2)", () => {
  it("revendido al 25%, venta al público", () => {
    const m = montosDeVenta({ listaArs: "100000", comisionPlataformaBps: 500, beneficiarios: benef, vendedorWorkspaceId: "ws-club", reventa: club, esSocioDelVendedor: false });
    expect(m).toMatchObject({ ok: true, listPriceArs: "100000.00", discountArs: "0.00", platformFeeArs: "5000.00", amountArs: "105000.00", netAmountArs: "25000.00" });
    expect(m.ok && m.partes.map((p) => [p.id, p.centavos])).toEqual([
      ["ws-club", 2_500_000],
      ["ws-sfpr", 2_250_000],
      ["ws-prod", 1_500_000],
      ["ws-doc", 3_750_000],
      ["plataforma", 500_000],
    ]);
  });

  it("el socio del revendedor recibe su descuento; los demás cobran igual", () => {
    const m = montosDeVenta({ listaArs: "100000", comisionPlataformaBps: 500, beneficiarios: benef, vendedorWorkspaceId: "ws-club", reventa: club, esSocioDelVendedor: true });
    expect(m).toMatchObject({ ok: true, discountArs: "25000.00", amountArs: "80000.00", netAmountArs: "0.00" });
    expect(m.ok && m.partes.find((p) => p.id === "ws-doc")?.centavos).toBe(3_750_000);
  });

  it("quien no es socio no recibe el descuento", () => {
    const m = montosDeVenta({ listaArs: "100000", comisionPlataformaBps: 500, beneficiarios: benef, vendedorWorkspaceId: "ws-club", reventa: club, esSocioDelVendedor: false });
    expect(m.ok && m.discountArs).toBe("0.00");
  });

  it("un descuento mayor que la parte del revendedor lo rechaza el motor", () => {
    const m = montosDeVenta({ listaArs: "100000", comisionPlataformaBps: 500, beneficiarios: benef, vendedorWorkspaceId: "ws-club", reventa: { ...club, descuentoSociosBps: 3000 }, esSocioDelVendedor: true });
    expect(m.ok).toBe(false);
  });

  it("sin reventa, con varios beneficiarios: vende uno de ellos y su neto es su parte", () => {
    const m = montosDeVenta({ listaArs: "100000", comisionPlataformaBps: 500, beneficiarios: benef, vendedorWorkspaceId: "ws-sfpr", reventa: null, esSocioDelVendedor: true });
    expect(m).toMatchObject({ ok: true, amountArs: "105000.00", netAmountArs: "30000.00" });
  });
});

describe("las filas del reparto congelado", () => {
  it("una por parte; la plataforma sin negocio", () => {
    const m = montosDeVenta({ listaArs: "1000", comisionPlataformaBps: 500, beneficiarios: benef, vendedorWorkspaceId: "ws-club", reventa: club, esSocioDelVendedor: false });
    if (!m.ok) throw new Error(m.error);
    const filas = filasDeReparto(m.partes);
    expect(filas[0]).toEqual({ workspaceId: "ws-club", kind: "REVENDEDOR", label: "Fotoclub Norte", amountArs: "250.00", absorbsProcessorFee: false });
    expect(filas.at(-1)).toEqual({ workspaceId: null, kind: "PLATAFORMA", label: "Plataforma", amountArs: "50.00", absorbsProcessorFee: false });
  });
});
```

Y en `lib/payments/split-1n.test.ts`, sumá `cobroConRepartoHabilitado` al import de `./split-1n` y,
dentro de `describe("FotOffice — Split de Pagos (1 a N) desactivado", …)`:

```ts
  it("la venta con reparto sigue apagada aunque el guard general de producción esté encendido", () => {
    expect(cobroConRepartoHabilitado({} as NodeJS.ProcessEnv)).toBe(false);
    expect(cobroConRepartoHabilitado({ DNX_MP_ORDERS_1N_PRODUCTION_ENABLED: "true" } as NodeJS.ProcessEnv)).toBe(false);
  });
```

- [ ] **Step 2: Correrlos y ver que fallan**

Run: `pnpm --filter fotoffice test lib/course-marketplace/venta.test.ts lib/payments/split-1n.test.ts`
Expected: FAIL (no existe `./venta`; `cobroConRepartoHabilitado` no está exportado).

- [ ] **Step 3: La llave, en el guard**

Al final de `lib/payments/split-1n.ts`:

```ts
/**
 * ¿Se puede vender un curso con reparto (split 1:N)? Dos llaves, las dos tienen que estar:
 * el interruptor de FOTOFFICE (constante, cambio de código revisado) y el guard general de
 * producción de la suite (`DNX_MP_ORDERS_1N_PRODUCTION_ENABLED`). Hoy: siempre false.
 */
export function cobroConRepartoHabilitado(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!isFotofficeSplit1nEnabled()) return false;
  const flag = (env.DNX_MP_ORDERS_1N_PRODUCTION_ENABLED ?? "").trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes" || flag === "on";
}
```

- [ ] **Step 4: `venta.ts`**

```ts
// lib/course-marketplace/venta.ts
import { calcularReparto, type BeneficiarioEntrada, type ParteDelReparto } from "./reparto";
import type { EstadoDeVenta } from "./beneficiarios";

/**
 * La venta de un curso grabado, con todo el motor: reventa (R) y descuento para socios (D).
 * Puro. Lo usan la página pública, la acción de compra, el portal y los tests.
 *
 * Con el split de Mercado Pago apagado sólo se vende lo que no tiene reparto y lo vende su dueño;
 * todo lo demás dice "Disponible próximamente" (spec, sección 5.1). Así nadie queda sin cobrar.
 */

export type DecisionDeVenta = { tipo: "SIN_REPARTO" } | { tipo: "CON_REPARTO" } | { tipo: "PROXIMAMENTE"; motivo: string };

export function decidirVenta(input: { estado: EstadoDeVenta; revendido: boolean; splitHabilitado: boolean }): DecisionDeVenta {
  if (!input.revendido && input.estado.tipo === "SIN_REPARTO") return { tipo: "SIN_REPARTO" };
  if (!input.splitHabilitado) {
    return { tipo: "PROXIMAMENTE", motivo: "El reparto automático de Mercado Pago todavía no está habilitado." };
  }
  if (input.estado.tipo === "CON_REPARTO" && !input.estado.listo) {
    return { tipo: "PROXIMAMENTE", motivo: input.estado.faltantes[0] ?? "Falta completar el reparto." };
  }
  return { tipo: "CON_REPARTO" };
}

export type MontosDeVenta =
  | { ok: true; listPriceArs: string; discountArs: string; platformFeeArs: string; amountArs: string; netAmountArs: string; partes: ParteDelReparto[] }
  | { ok: false; error: string };

function aTexto(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

/**
 * Montos de una venta. El descuento sólo vale si quien compra es socio activo de quien revende,
 * y sale sólo de la parte del revendedor (el motor lo topea). `netAmountArs` es lo que le toca a
 * quien vende: su parte del reparto.
 */
export function montosDeVenta(input: {
  listaArs: string | number;
  comisionPlataformaBps: number;
  beneficiarios: BeneficiarioEntrada[];
  vendedorWorkspaceId: string;
  reventa: { workspaceId: string; nombre: string; bps: number; descuentoSociosBps: number } | null;
  esSocioDelVendedor: boolean;
}): MontosDeVenta {
  const listaCentavos = Math.round(Number(input.listaArs) * 100);
  const descuentoBps = input.reventa && input.esSocioDelVendedor ? input.reventa.descuentoSociosBps : 0;
  const r = calcularReparto({
    listaCentavos,
    comisionPlataformaBps: input.comisionPlataformaBps,
    beneficiarios: input.beneficiarios,
    reventa: input.reventa ? { id: input.reventa.workspaceId, nombre: input.reventa.nombre, bps: input.reventa.bps } : null,
    descuentoBps,
    vendedorId: input.reventa ? null : input.vendedorWorkspaceId,
  });
  if (!r.ok) return { ok: false, error: r.errores[0] ?? "No se pudo calcular el precio." };
  const delVendedor = r.partes.find((p) => p.tipo !== "PLATAFORMA" && p.id === input.vendedorWorkspaceId)?.centavos ?? 0;
  return {
    ok: true,
    listPriceArs: aTexto(listaCentavos),
    discountArs: aTexto(r.descuento),
    platformFeeArs: aTexto(r.comisionPlataforma),
    amountArs: aTexto(r.pagaElAlumno),
    netAmountArs: aTexto(delVendedor),
    partes: r.partes,
  };
}

/** Las filas de `CourseSaleShare` de una venta: el reparto congelado (spec, sección 2.3). */
export function filasDeReparto(partes: ParteDelReparto[]) {
  return partes.map((p) => ({
    workspaceId: p.tipo === "PLATAFORMA" ? null : p.id,
    kind: p.tipo,
    label: p.nombre,
    amountArs: aTexto(p.centavos),
    absorbsProcessorFee: p.absorbeMp,
  }));
}
```

- [ ] **Step 5: Correr y ver pasar**

Run: `pnpm --filter fotoffice test lib/course-marketplace/venta.test.ts lib/payments/split-1n.test.ts`
Expected: PASS (el guard sigue con sus 5 casos originales verdes: `cobroConRepartoHabilitado` vive en
la carpeta exenta).

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/course-marketplace/venta.ts apps/fotoffice/lib/course-marketplace/venta.test.ts apps/fotoffice/lib/payments/split-1n.ts apps/fotoffice/lib/payments/split-1n.test.ts
git commit -m "Mercado de cursos: reglas de la venta con reventa y descuento, y la llave del cobro con reparto (apagada)"
```

---

### Task 7: El curso revendido en el sitio del revendedor y su compra

**Files:**
- Create: `lib/course-marketplace/vitrina.ts`
- Modify: `app/w/[workspaceSlug]/cursos/[courseSlug]/page.tsx` — `generateMetadata` (líneas 16–38)
  y la carga del curso + el bloque `if (esCursoGrabado) { … }` (líneas 58–104) y la llamada a
  `<RecordedCourseSection` (línea 143).
- Modify: `components/presential-courses/recorded-course-section.tsx` — props (líneas 21–48) y el
  bloque de precio (líneas 97–108).
- Modify: `app/w/[workspaceSlug]/cursos/page.tsx` — la lista (líneas 25–36 y el `map`).
- Modify: `app/w/[workspaceSlug]/cursos/[courseSlug]/muestra/[lessonId]/page.tsx` — el `where` de
  `courseLesson.findFirst` (líneas 35–49).
- Modify: `app/actions/public-course-enrollment.ts` — la carga del curso (líneas 61–72), el bloque
  "Curso grabado" (líneas 94–108) y el `create` (líneas 115–140).
- Modify: `lib/presential-courses/checkout.ts` — la condición del bloque `if (inscripcion.listPriceArs)`
  (líneas 101–107).

**Interfaces:**
- Consumes: `decidirVenta`, `montosDeVenta`, `filasDeReparto`, `type MontosDeVenta` (Task 6); `cobroConRepartoHabilitado` de `@/lib/payments/split-1n` (Task 6); `cargarBeneficiarios`, `cargarDueno` (etapa 1); `estadoDeVenta`, `beneficiariosParaMotor` (etapa 1); `montosDeCompraSinReparto` (etapa 1); `getAuthUser` de `@/lib/auth`.
- Produces (`vitrina.ts`, server-only):
  - `type AcuerdoDeVitrina = { id: string; courseId: string; shareBps: number; memberDiscountBps: number }`
  - `buscarAcuerdoDeVitrina(workspaceId: string, courseSlug: string): Promise<AcuerdoDeVitrina | null>` — sólo se usa si el negocio **no** tiene un curso propio con ese slug.
  - `cursosRevendidosDe(workspaceId: string)` — acuerdos ACTIVO con su curso publicado y grabado.
  - `esSocioActivoDe(workspaceId: string): Promise<boolean>` — según la sesión.
  - `RecordedCourseSection` suma props `precioSocios: { institucion: string; amountArs: string } | null` y `cursoDe: string | null`.

- [ ] **Step 1: `vitrina.ts`**

```ts
// lib/course-marketplace/vitrina.ts
import "server-only";
import { prisma } from "@repo/db";
import { getAuthUser } from "@/lib/auth";

/**
 * Los cursos de otros negocios en el sitio y el portal de quien los revende (spec, sección 4.3):
 * aparecen con su marca, igual que los propios. Sólo con un acuerdo ACTIVO y el curso publicado.
 */

export type AcuerdoDeVitrina = { id: string; courseId: string; shareBps: number; memberDiscountBps: number };

/**
 * El acuerdo por el que `workspaceId` muestra en `/cursos/{courseSlug}` un curso ajeno. Se busca
 * sólo si el negocio no tiene un curso propio con ese slug: el propio siempre gana. Entre dos
 * revendidos con el mismo slug, el acuerdo más viejo.
 */
export async function buscarAcuerdoDeVitrina(workspaceId: string, courseSlug: string): Promise<AcuerdoDeVitrina | null> {
  return prisma.courseResaleAgreement.findFirst({
    where: {
      resellerWorkspaceId: workspaceId,
      status: "ACTIVO",
      course: { slug: courseSlug, status: "PUBLISHED", deliveryMode: "RECORDED" },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, courseId: true, shareBps: true, memberDiscountBps: true },
  });
}

export async function cursosRevendidosDe(workspaceId: string) {
  return prisma.courseResaleAgreement.findMany({
    where: { resellerWorkspaceId: workspaceId, status: "ACTIVO", course: { status: "PUBLISHED", deliveryMode: "RECORDED" } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      shareBps: true,
      memberDiscountBps: true,
      course: {
        select: { id: true, slug: true, title: true, shortDescription: true, coverImageUrl: true, thumbnailImageUrl: true, priceArs: true, workspaceId: true },
      },
    },
  });
}

/**
 * ¿Quien está mirando es socio activo de este negocio? Sale de la sesión: el descuento nunca se
 * pide desde el navegador. Sin sesión (o en un dominio propio, donde la sesión de FOTOFFICE no
 * viaja), no es socio: paga el precio público.
 */
export async function esSocioActivoDe(workspaceId: string): Promise<boolean> {
  const user = await getAuthUser();
  if (!user) return false;
  const ficha = await prisma.member.findFirst({ where: { userId: user.id, workspaceId, status: "ACTIVE" }, select: { id: true } });
  return ficha !== null;
}
```

- [ ] **Step 2: La página pública del curso**

En `app/w/[workspaceSlug]/cursos/[courseSlug]/page.tsx`:

1. Arriba del archivo, sacá el `include` a una constante para que las dos consultas tengan el mismo tipo:

```ts
const INCLUDE_CURSO = {
  instances: { where: { status: "ACTIVE" as const }, orderBy: { startDateTime: "asc" as const } },
  lessons: {
    where: { videoStatus: "READY" as const },
    orderBy: { sortOrder: "asc" as const },
    select: { id: true, title: true, description: true, durationSeconds: true, isPreview: true },
  },
};
```

2. Reemplazá la consulta de `presentialCourse` por:

```ts
  let presentialCourse = await prisma.course.findFirst({
    where: { workspaceId: branding.workspaceId, slug: courseSlug, status: { in: ["PUBLISHED", "UPCOMING"] } },
    include: INCLUDE_CURSO,
  });
  // Sin curso propio con ese slug, puede ser uno ajeno que este negocio revende.
  const acuerdo = presentialCourse ? null : await buscarAcuerdoDeVitrina(branding.workspaceId, courseSlug);
  if (!presentialCourse && acuerdo) {
    presentialCourse = await prisma.course.findFirst({ where: { id: acuerdo.courseId }, include: INCLUDE_CURSO });
  }
  if (!presentialCourse) notFound();
  const revendido = acuerdo !== null;
```

3. Reemplazá el bloque `if (esCursoGrabado) { … }` por:

```ts
  let precioSocios: { institucion: string; amountArs: string } | null = null;
  let cursoDe: string | null = null;
  if (esCursoGrabado) {
    // La comisión de la plataforma es la del módulo de quien vende: este sitio.
    cargoServicioBps = await getPlatformFeeBps(branding.workspaceId, COURSES_SALES_MODULE_KEY);
    dueno = { workspaceId: branding.workspaceId, nombre: branding.commercialName };
    try {
      const duenoDelCurso = await cargarDueno(presentialCourse.workspaceId);
      const registrados = await cargarBeneficiarios(presentialCourse.id);
      const decision = decidirVenta({
        estado: estadoDeVenta(presentialCourse.workspaceId, registrados),
        revendido,
        splitHabilitado: cobroConRepartoHabilitado(),
      });
      aLaVenta = decision.tipo !== "PROXIMAMENTE";
      if (acuerdo) {
        cursoDe = duenoDelCurso.nombre;
        if (acuerdo.memberDiscountBps > 0 && presentialCourse.priceArs) {
          const m = montosDeVenta({
            listaArs: presentialCourse.priceArs.toString(),
            comisionPlataformaBps: cargoServicioBps,
            beneficiarios: beneficiariosParaMotor(duenoDelCurso, registrados),
            vendedorWorkspaceId: branding.workspaceId,
            reventa: { workspaceId: branding.workspaceId, nombre: branding.commercialName, bps: acuerdo.shareBps, descuentoSociosBps: acuerdo.memberDiscountBps },
            esSocioDelVendedor: true,
          });
          if (m.ok) precioSocios = { institucion: branding.commercialName, amountArs: m.amountArs };
        }
      }
    } catch (error) {
      console.error("[curso-publico] no se pudo cargar el reparto", error instanceof Error ? error.message : error);
      // Ante la duda, un curso revendido no se vende: nadie queda sin cobrar.
      aLaVenta = !revendido;
    }
  }
```

4. En `<RecordedCourseSection …>`: `gratisParaSocios={presentialCourse.freeForMembers && !revendido ? { institucion: branding.commercialName } : null}`
   (el "gratis" es de los socios del **dueño**, nunca del revendedor) y sumá
   `precioSocios={precioSocios}` y `cursoDe={cursoDe}`.

5. `generateMetadata`: si no hay curso propio, usá `buscarAcuerdoDeVitrina` y buscá el curso por
   `id` con el mismo `select` (`title`, `shortDescription`, `longDescription`).

Imports nuevos: `buscarAcuerdoDeVitrina` de `@/lib/course-marketplace/vitrina`; `decidirVenta`,
`montosDeVenta` de `@/lib/course-marketplace/venta`; `beneficiariosParaMotor` (sumarlo al import de
`beneficiarios`); `cobroConRepartoHabilitado` de `@/lib/payments/split-1n`.

- [ ] **Step 3: `RecordedCourseSection`**

Props nuevas (con su JSDoc):

```ts
  /** Precio para los socios de quien vende, cuando revende con descuento. */
  precioSocios: { institucion: string; amountArs: string } | null;
  /** Nombre del dueño cuando el curso es de otro negocio: "Un curso de …". */
  cursoDe: string | null;
```

Arriba de `<h2 …>Clases</h2>`: `{cursoDe ? <p className="text-xs text-[var(--fo-muted)]">Un curso de {cursoDe}</p> : null}`.
Después del bloque del precio:

```tsx
      {precioSocios && publicado ? (
        <p className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-accent)]/40 p-3 text-sm">
          <strong>Socios de {precioSocios.institucion}: {formatMoney(Number(precioSocios.amountArs), "ARS")}.</strong>{" "}
          <a href={`${appUrl}/login?next=/portal/cursos`} className="text-[var(--fo-accent)] underline">
            Entrá a tu portal
          </a>{" "}
          para comprarlo con tu descuento.
        </p>
      ) : null}
```

- [ ] **Step 4: La lista de cursos del sitio**

En `app/w/[workspaceSlug]/cursos/page.tsx`, después de cargar `courses`:

```ts
  const revendidos = await cursosRevendidosDe(branding.workspaceId);
  const slugsPropios = new Set(courses.map((c) => c.slug));
  // El propio gana si coincide el slug: el ajeno no se lista.
  const ajenos = revendidos.filter((a) => !slugsPropios.has(a.course.slug));
```

La condición de vacío pasa a `courses.length === 0 && ajenos.length === 0`. Después del `map` de
`courses`, dentro del mismo `<ul>`:

```tsx
          {ajenos.map((a) => (
            <li key={a.id} className="fo-card space-y-3">
              {a.course.thumbnailImageUrl || a.course.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.course.thumbnailImageUrl ?? a.course.coverImageUrl ?? ""} alt="" className="h-40 w-full object-cover rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)]" />
              ) : null}
              <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">Curso grabado</p>
              <h2 className="text-lg font-semibold">{a.course.title}</h2>
              {a.course.shortDescription ? <p className="text-sm text-[var(--fo-muted)] line-clamp-3">{a.course.shortDescription}</p> : null}
              {a.course.priceArs ? <p className="text-sm text-[var(--fo-muted)]">{formatMoney(a.course.priceArs, "ARS")}</p> : null}
              <Link href={`/w/${workspaceSlug}/cursos/${a.course.slug}`} className="fo-btn fo-btn-secondary text-sm w-fit">
                Ver curso
              </Link>
            </li>
          ))}
```

- [ ] **Step 5: La clase de muestra**

En `muestra/[lessonId]/page.tsx`, antes de buscar la lección:
`const acuerdo = await buscarAcuerdoDeVitrina(branding.workspaceId, courseSlug);` y el filtro
`course` pasa a:

```ts
      course: {
        slug: courseSlug,
        status: "PUBLISHED",
        deliveryMode: "RECORDED",
        OR: [{ workspaceId: branding.workspaceId }, ...(acuerdo ? [{ id: acuerdo.courseId }] : [])],
      },
```

- [ ] **Step 6: La compra**

En `app/actions/public-course-enrollment.ts`:

1. La carga del curso:

```ts
  let course = await prisma.course.findFirst({ /* where e include de siempre, sin cambios */ });
  const acuerdo = course ? null : await buscarAcuerdoDeVitrina(branding.workspaceId, courseSlug);
  if (!course && acuerdo) {
    course = await prisma.course.findFirst({
      where: { id: acuerdo.courseId, status: "PUBLISHED" },
      include: { instances: { where: { id: "" } } }, // un grabado no tiene ediciones
    });
  }
  if (!course) return { error: "Curso no disponible para inscripción." };
```

2. El bloque "Curso grabado" pasa a:

```ts
  let montos: MontosDeVenta | null = null;
  let conReparto = false;
  if (objetivo.courseInstanceId === null) {
    const registrados = await cargarBeneficiarios(course.id);
    const decision = decidirVenta({
      estado: estadoDeVenta(course.workspaceId, registrados),
      revendido: acuerdo !== null,
      splitHabilitado: cobroConRepartoHabilitado(),
    });
    if (decision.tipo === "PROXIMAMENTE") return { error: "Este curso todavía no está a la venta." };
    if (decision.tipo === "SIN_REPARTO") {
      montos = montosDeCompraSinReparto({
        listaArs: objetivo.monto.toString(),
        comisionPlataformaBps: feeBps,
        owner: await cargarDueno(course.workspaceId),
      });
    } else {
      // Con reparto: sólo llega acá con el split encendido. El descuento lo decide la sesión.
      const [duenoDelCurso, vendedor, esSocio] = await Promise.all([
        cargarDueno(course.workspaceId),
        cargarDueno(branding.workspaceId),
        esSocioActivoDe(branding.workspaceId),
      ]);
      montos = montosDeVenta({
        listaArs: objetivo.monto.toString(),
        comisionPlataformaBps: feeBps,
        beneficiarios: beneficiariosParaMotor(duenoDelCurso, registrados),
        vendedorWorkspaceId: branding.workspaceId,
        reventa: acuerdo
          ? { workspaceId: branding.workspaceId, nombre: vendedor.nombre, bps: acuerdo.shareBps, descuentoSociosBps: acuerdo.memberDiscountBps }
          : null,
        esSocioDelVendedor: esSocio,
      });
      conReparto = true;
    }
    if (!montos.ok) return { error: montos.error };
  }
```

3. El `create` va dentro de una transacción y, con reparto, congela las partes en el mismo momento:

```ts
  const enrollment = await prisma.$transaction(async (tx) => {
    const creada = await tx.courseEnrollment.create({
      data: {
        /* … todos los campos de siempre … */
        resaleAgreementId: conReparto && acuerdo ? acuerdo.id : null,
      },
      select: { id: true },
    });
    if (conReparto && montos?.ok) {
      await tx.courseSaleShare.createMany({
        data: filasDeReparto(montos.partes).map((f) => ({ ...f, enrollmentId: creada.id, amountArs: new Prisma.Decimal(f.amountArs) })),
      });
    }
    return creada;
  });
```

`workspaceId` de la inscripción sigue siendo `branding.workspaceId`: **quien vende** (spec, sección 7).

Imports nuevos: `buscarAcuerdoDeVitrina`, `esSocioActivoDe` de `@/lib/course-marketplace/vitrina`;
`decidirVenta`, `montosDeVenta`, `filasDeReparto`, `type MontosDeVenta` de `@/lib/course-marketplace/venta`;
`beneficiariosParaMotor` (sumarlo al import de `beneficiarios`); `cobroConRepartoHabilitado` de
`@/lib/payments/split-1n`.

- [ ] **Step 7: El checkout no cobra con Checkout Pro nada con reparto**

En `lib/presential-courses/checkout.ts`, la condición dentro de `if (inscripcion.listPriceArs) {`:

```ts
    // Con reparto (revendido o varios beneficiarios) no hay Checkout Pro: se cobra con una orden
    // que reparte sola (lib/payments/split-1n-cursos.ts), apagada hasta que Mercado Pago la habilite.
    const beneficiarios = await cargarBeneficiarios(inscripcion.courseId);
    if (inscripcion.resaleAgreementId || estadoDeVenta(inscripcion.course.workspaceId, beneficiarios).tipo !== "SIN_REPARTO") {
      return { ok: false, error: "Este curso todavía no está a la venta." };
    }
```

(No escribas la palabra `splits` ni `/v1/orders` en este archivo: el test del guard lo vigila.)

- [ ] **Step 8: Suite, tipos y commit**

Run: `pnpm --filter fotoffice test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: verde. Si un test de la acción de inscripción o del checkout simula `prisma`, agregá
`courseResaleAgreement.findFirst` devolviendo `null`, `$transaction` que ejecute el callback con
el mismo mock, y `getAuthUser` devolviendo `null`, sin cambiar lo que el test verifica.

```bash
git add apps/fotoffice
git commit -m "Mercado de cursos: el curso revendido en el sitio del revendedor, con precio para socios y 'Disponible próximamente'"
```

---

### Task 8: El curso revendido en el portal de los socios del revendedor

**Files:**
- Modify: `lib/course-marketplace/vitrina.ts` — agregar `cursosRevendidosParaSocios`.
- Modify: `app/portal/cursos/page.tsx` — la carga (líneas 26–41) y una sección nueva antes de
  `{gratis.length > 0 ? (` (línea 117).

**Interfaces:**
- Consumes: `cursosRevendidosDe` (Task 7); `montosDeVenta`, `decidirVenta` (Task 6); `cobroConRepartoHabilitado` (Task 6); `cargarBeneficiarios`, `cargarDueno`, `estadoDeVenta`, `beneficiariosParaMotor` (etapa 1); `getPlatformFeeBps`.
- Produces:
  - `type CursoRevendidoParaSocio = { courseId: string; titulo: string; descripcion: string | null; precioPublicoArs: string | null; precioSocioArs: string | null; aLaVenta: boolean; href: string | null }`
  - `cursosRevendidosParaSocios(workspaceId: string): Promise<CursoRevendidoParaSocio[]>`

- [ ] **Step 1: El cargador**

Agregá a `lib/course-marketplace/vitrina.ts` (con sus imports: `getPlatformFeeBps`,
`COURSES_SALES_MODULE_KEY`, `cargarBeneficiarios`, `cargarDueno` de `./cargar`,
`estadoDeVenta`, `beneficiariosParaMotor` de `./beneficiarios`, `decidirVenta`, `montosDeVenta`
de `./venta`, `cobroConRepartoHabilitado` de `@/lib/payments/split-1n`):

```ts
export type CursoRevendidoParaSocio = {
  courseId: string;
  titulo: string;
  descripcion: string | null;
  precioPublicoArs: string | null;
  precioSocioArs: string | null;
  aLaVenta: boolean;
  href: string | null;
};

/** Los cursos ajenos que la institución del socio revende, con el precio para socios. */
export async function cursosRevendidosParaSocios(workspaceId: string): Promise<CursoRevendidoParaSocio[]> {
  const [acuerdos, marca, feeBps] = await Promise.all([
    cursosRevendidosDe(workspaceId),
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { publicSlug: true, commercialName: true } }),
    getPlatformFeeBps(workspaceId, COURSES_SALES_MODULE_KEY),
  ]);
  const splitHabilitado = cobroConRepartoHabilitado();
  return Promise.all(
    acuerdos.map(async (a) => {
      const [dueno, registrados] = await Promise.all([cargarDueno(a.course.workspaceId), cargarBeneficiarios(a.course.id)]);
      const base = {
        listaArs: a.course.priceArs?.toString() ?? "0",
        comisionPlataformaBps: feeBps,
        beneficiarios: beneficiariosParaMotor(dueno, registrados),
        vendedorWorkspaceId: workspaceId,
        reventa: { workspaceId, nombre: marca?.commercialName ?? "", bps: a.shareBps, descuentoSociosBps: a.memberDiscountBps },
      };
      const publico = montosDeVenta({ ...base, esSocioDelVendedor: false });
      const socio = montosDeVenta({ ...base, esSocioDelVendedor: true });
      const decision = decidirVenta({ estado: estadoDeVenta(a.course.workspaceId, registrados), revendido: true, splitHabilitado });
      return {
        courseId: a.course.id,
        titulo: a.course.title,
        descripcion: a.course.shortDescription,
        precioPublicoArs: publico.ok ? publico.amountArs : null,
        precioSocioArs: socio.ok && a.memberDiscountBps > 0 ? socio.amountArs : null,
        aLaVenta: decision.tipo !== "PROXIMAMENTE",
        href: marca ? `/w/${marca.publicSlug}/cursos/${a.course.slug}` : null,
      };
    }),
  );
}
```

- [ ] **Step 2: La sección del portal**

En `app/portal/cursos/page.tsx`, después de `const gratis = …`:

```ts
  const yaTiene = new Set(grupos.flatMap((g) => g.cursos.map((c) => c.courseId)));
  const revendidos = socio ? (await cursosRevendidosParaSocios(socio.workspace.id)).filter((c) => !yaTiene.has(c.courseId)) : [];
```

(Confirmá en `lib/course-classroom/mis-cursos.ts` que `CursoDeMisCursos` tiene `courseId`; lo usa
el enlace a la clase de la misma página.)

Antes de `{gratis.length > 0 ? (`:

```tsx
      {revendidos.length > 0 && socio ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Más cursos de {socio.workspace.name}</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {revendidos.map((c) => (
              <li key={c.courseId} className="fo-card space-y-2">
                <p className="font-medium">{c.titulo}</p>
                {c.descripcion ? <p className="text-sm text-[var(--fo-muted)] line-clamp-2">{c.descripcion}</p> : null}
                {c.precioSocioArs ? (
                  <p className="text-sm">
                    Para vos: <strong>{formatMoney(Number(c.precioSocioArs), "ARS")}</strong>
                    {c.precioPublicoArs ? <span className="text-[var(--fo-muted)]"> (público {formatMoney(Number(c.precioPublicoArs), "ARS")})</span> : null}
                  </p>
                ) : c.precioPublicoArs ? (
                  <p className="text-sm">{formatMoney(Number(c.precioPublicoArs), "ARS")}</p>
                ) : null}
                {c.aLaVenta && c.href ? (
                  <Link href={c.href} className="fo-btn fo-btn-primary inline-flex text-sm">
                    Comprar
                  </Link>
                ) : (
                  <p className="text-sm font-medium">Disponible próximamente</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
```

Imports nuevos: `cursosRevendidosParaSocios` de `@/lib/course-marketplace/vitrina`; `formatMoney`
de `@/lib/format`.

- [ ] **Step 3: Suite, tipos y commit**

Run: `pnpm --filter fotoffice test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: verde.

```bash
git add apps/fotoffice/lib/course-marketplace/vitrina.ts apps/fotoffice/app/portal/cursos/page.tsx
git commit -m "Mercado de cursos: los cursos revendidos en el portal del socio, con su precio de socio"
```

---

### Task 9: La orden de Mercado Pago con reparto para cursos, detrás del guard (etapa 4)

**Files:**
- Create: `lib/payments/split-1n-cursos.ts`, `lib/payments/split-1n-cursos.test.ts`
  (**directamente** en `lib/payments/`: es la única carpeta donde el test del guard admite los
  símbolos de Orders/Split).
- Create: `lib/course-marketplace/orden.ts`
- Modify: `lib/course-marketplace/venta.ts` (+ test) — agregar `partesDesdeReparto`.
- Modify: `lib/payments/split-1n.ts` — sólo el comentario de cabecera (decisión actualizada). La
  constante queda en `false`.
- Modify: `lib/payments/split-1n.test.ts` — comentario de `FORBIDDEN_SPLIT_SYMBOLS` y un caso que
  verifica que la orden de cursos pasa por la llave.
- Modify: `docs/payments/fotoffice-split-1n-disabled.md` (raíz del repo) — encabezado, §3, §6 y una
  §7 nueva.

**Interfaces:**
- Consumes: `cobroConRepartoHabilitado` (Task 6); `type ParteDelReparto` (etapa 1); `normalizeConsentStatus` de `./connect/consent`; de `@repo/payments/mercado-pago`: `MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS`, `buildMercadoPagoSplitOrderRequest`, `buildOpaqueExternalReference`, `singleIntangibleItem`, `validateMercadoPagoSplitOrder`, `testActivePartnerConsent` (sólo test), `type PartnerConsentEvidence`; `money` de `@repo/payments/money`; `workspaceOrganizationRef` de `@/lib/payments/connect/constants`.
- Produces:
  - `type ReceptorDeSplit = { receiverId: string; consentimiento: PartnerConsentEvidence | null }`
  - `type PagoConTarjeta = { token: string; metodo: string; cuotas: number; deviceSessionId: string }`
  - `type EntradaOrdenDeCurso = { enrollmentId: string; tituloCurso: string; payerEmail: string; partes: ParteDelReparto[]; receptores: Map<string, ReceptorDeSplit>; plataforma: ReceptorDeSplit | null; pago: PagoConTarjeta; permitirFixturesDePrueba?: boolean }`
  - `type CodigoOrdenDeCurso = "SPLIT_APAGADO" | "SIN_DUENO" | "SIN_RECEPTOR" | "SIN_CONSENTIMIENTO" | "SIN_PLATAFORMA" | "DEMASIADOS_RECEPTORES" | "INVALIDA"`
  - `type ResultadoOrdenDeCurso = ({ ok: true; ownerReceiverId: string } & ReturnType<typeof buildMercadoPagoSplitOrderRequest>) | { ok: false; codigo: CodigoOrdenDeCurso; detalle: string }`
  - `evidenciaDeConsentimiento(fila: { providerReceiverId: string | null; status: string } | null): ReceptorDeSplit | null`
  - `armarOrdenDeCursoConReparto(e: EntradaOrdenDeCurso): ResultadoOrdenDeCurso` — puro, sin la llave (lo usan los tests).
  - `prepararOrdenDeCursoConReparto(e: EntradaOrdenDeCurso, env?: NodeJS.ProcessEnv): ResultadoOrdenDeCurso` — con la llave: hoy `SPLIT_APAGADO`.
  - `partesDesdeReparto(filas: Array<{ workspaceId: string | null; kind: "PLATAFORMA" | "REVENDEDOR" | "BENEFICIARIO"; label: string; amountArs: { toString(): string } | string; absorbsProcessorFee: boolean }>): ParteDelReparto[]`
  - `cargarReceptores(workspaceIds: string[]): Promise<Map<string, ReceptorDeSplit>>`, `cargarReceptorDePlataforma(): Promise<ReceptorDeSplit | null>`, `armarOrdenParaInscripcion(enrollmentId: string, pago: PagoConTarjeta): Promise<ResultadoOrdenDeCurso>` (server-only, `orden.ts`).

- [ ] **Step 1: Escribir el test de la orden**

```ts
// lib/payments/split-1n-cursos.test.ts
import { describe, expect, it } from "vitest";
import { testActivePartnerConsent } from "@repo/payments/mercado-pago";
import { calcularReparto } from "@/lib/course-marketplace/reparto";
import {
  armarOrdenDeCursoConReparto,
  evidenciaDeConsentimiento,
  prepararOrdenDeCursoConReparto,
  type EntradaOrdenDeCurso,
  type ReceptorDeSplit,
} from "./split-1n-cursos";

const UUID = {
  sfpr: "11111111-1111-4111-8111-111111111111",
  prod: "22222222-2222-4222-8222-222222222222",
  doc: "33333333-3333-4333-8333-333333333333",
  club: "44444444-4444-4444-8444-444444444444",
  plataforma: "55555555-5555-4555-8555-555555555555",
};

const benef = [
  { id: "ws-sfpr", nombre: "SFPR", bps: 3000, absorbeMp: false },
  { id: "ws-prod", nombre: "Productora", bps: 2000, absorbeMp: false },
  { id: "ws-doc", nombre: "Docente", bps: 5000, absorbeMp: true },
];

function partes(descuentoBps = 0) {
  const r = calcularReparto({
    listaCentavos: 10_000_000,
    comisionPlataformaBps: 500,
    beneficiarios: benef,
    reventa: { id: "ws-club", nombre: "Fotoclub", bps: 2500 },
    descuentoBps,
  });
  if (!r.ok) throw new Error(r.errores.join());
  return r.partes;
}

const receptor = (id: string): ReceptorDeSplit => ({ receiverId: id, consentimiento: testActivePartnerConsent(id) });

function entrada(cambios: Partial<EntradaOrdenDeCurso> = {}): EntradaOrdenDeCurso {
  return {
    enrollmentId: "insc123",
    tituloCurso: "Retrato",
    payerEmail: "alumna@example.com",
    partes: partes(),
    receptores: new Map([
      ["ws-sfpr", receptor(UUID.sfpr)],
      ["ws-prod", receptor(UUID.prod)],
      ["ws-doc", receptor(UUID.doc)],
      ["ws-club", receptor(UUID.club)],
    ]),
    plataforma: receptor(UUID.plataforma),
    pago: { token: "tok_prueba", metodo: "visa", cuotas: 1, deviceSessionId: "sesion-de-prueba-123" },
    permitirFixturesDePrueba: true,
    ...cambios,
  };
}

describe("orden de Mercado Pago con reparto para un curso (spec, sección 5.2)", () => {
  it("quien absorbe la comisión es el dueño de la orden; el resto, socios; montos fijos del motor", () => {
    const r = armarOrdenDeCursoConReparto(entrada());
    if (!r.ok) throw new Error(r.detalle);
    expect(r.ownerReceiverId).toBe(UUID.doc);
    expect(r.body.total_amount).toBe("105000.00");
    expect(r.body.config.split_rules.amount_type).toBe("fixed");
    expect(r.body.splits[0]).toMatchObject({ receiver_id: UUID.doc, receiver_type: "owner", amount: "37500.00" });
    const socio = (id: string) => r.body.splits.find((s) => s.receiver_id === id);
    expect(socio(UUID.club)).toMatchObject({ receiver_type: "partner", amount: "25000.00" });
    expect(socio(UUID.sfpr)).toMatchObject({ receiver_type: "partner", amount: "22500.00" });
    expect(socio(UUID.prod)).toMatchObject({ receiver_type: "partner", amount: "15000.00" });
    expect(socio(UUID.plataforma)).toMatchObject({ receiver_type: "partner", amount: "5000.00" });
    expect(r.headers["x-meli-session-id"]).toBe("sesion-de-prueba-123");
  });

  it("una parte en cero no viaja (el socio con todo el descuento del revendedor)", () => {
    const r = armarOrdenDeCursoConReparto(entrada({ partes: partes(2500) }));
    if (!r.ok) throw new Error(r.detalle);
    expect(r.body.total_amount).toBe("80000.00");
    expect(r.body.splits.some((s) => s.receiver_id === UUID.club)).toBe(false);
  });

  it("sin consentimiento ACTIVE de algún receptor, no se arma", () => {
    const receptores = entrada().receptores;
    receptores.set("ws-prod", { receiverId: UUID.prod, consentimiento: { ...testActivePartnerConsent(UUID.prod), status: "PENDING" } });
    expect(armarOrdenDeCursoConReparto(entrada({ receptores }))).toMatchObject({ ok: false, codigo: "SIN_CONSENTIMIENTO" });
    receptores.set("ws-prod", { receiverId: UUID.prod, consentimiento: null });
    expect(armarOrdenDeCursoConReparto(entrada({ receptores }))).toMatchObject({ ok: false, codigo: "SIN_CONSENTIMIENTO" });
  });

  it("el dueño de la orden también necesita su consentimiento", () => {
    const receptores = entrada().receptores;
    receptores.set("ws-doc", { receiverId: UUID.doc, consentimiento: null });
    expect(armarOrdenDeCursoConReparto(entrada({ receptores }))).toMatchObject({ ok: false, codigo: "SIN_CONSENTIMIENTO" });
  });

  it("sin cuenta de un beneficiario o de la plataforma, no se arma", () => {
    const receptores = entrada().receptores;
    receptores.delete("ws-sfpr");
    expect(armarOrdenDeCursoConReparto(entrada({ receptores }))).toMatchObject({ ok: false, codigo: "SIN_RECEPTOR" });
    expect(armarOrdenDeCursoConReparto(entrada({ plataforma: null }))).toMatchObject({ ok: false, codigo: "SIN_PLATAFORMA" });
  });

  it("un consentimiento de prueba no pasa sin el permiso explícito de los tests", () => {
    expect(armarOrdenDeCursoConReparto(entrada({ permitirFixturesDePrueba: false }))).toMatchObject({ ok: false, codigo: "INVALIDA" });
  });

  it("con la llave apagada no se arma nada, aunque el guard general esté encendido", () => {
    const env = { DNX_MP_ORDERS_1N_PRODUCTION_ENABLED: "true" } as NodeJS.ProcessEnv;
    expect(prepararOrdenDeCursoConReparto(entrada(), env)).toMatchObject({ ok: false, codigo: "SPLIT_APAGADO" });
  });
});

describe("consentimiento guardado → receptor", () => {
  it("sin fila o sin receptor, nada", () => {
    expect(evidenciaDeConsentimiento(null)).toBeNull();
    expect(evidenciaDeConsentimiento({ providerReceiverId: null, status: "ACTIVE" })).toBeNull();
  });

  it("normaliza el estado y nunca inventa ACTIVE", () => {
    expect(evidenciaDeConsentimiento({ providerReceiverId: UUID.sfpr, status: "active" })).toEqual({
      receiverId: UUID.sfpr,
      consentimiento: { receiverId: UUID.sfpr, status: "ACTIVE", provider: "mercadopago" },
    });
    expect(evidenciaDeConsentimiento({ providerReceiverId: UUID.sfpr, status: "LO_QUE_SEA" })?.consentimiento?.status).toBe("PENDING");
  });
});
```

En `lib/course-marketplace/venta.test.ts`, agregá:

```ts
describe("partes desde el reparto congelado", () => {
  it("vuelve a centavos y conserva quién es quién", () => {
    expect(
      partesDesdeReparto([
        { workspaceId: "ws-club", kind: "REVENDEDOR", label: "Fotoclub", amountArs: "25000.00", absorbsProcessorFee: false },
        { workspaceId: "ws-doc", kind: "BENEFICIARIO", label: "Docente", amountArs: "37500.00", absorbsProcessorFee: true },
        { workspaceId: null, kind: "PLATAFORMA", label: "Plataforma", amountArs: "5000.00", absorbsProcessorFee: false },
        { workspaceId: null, kind: "BENEFICIARIO", label: "Borrado", amountArs: "1.00", absorbsProcessorFee: false },
      ]),
    ).toEqual([
      { id: "ws-club", nombre: "Fotoclub", tipo: "REVENDEDOR", centavos: 2_500_000, absorbeMp: false },
      { id: "ws-doc", nombre: "Docente", tipo: "BENEFICIARIO", centavos: 3_750_000, absorbeMp: true },
      { id: "plataforma", nombre: "Plataforma", tipo: "PLATAFORMA", centavos: 500_000, absorbeMp: false },
      { id: "sin-negocio-3", nombre: "Borrado", tipo: "BENEFICIARIO", centavos: 100, absorbeMp: false },
    ]);
  });
});
```

(sumá `partesDesdeReparto` al import del archivo).

Y en `lib/payments/split-1n.test.ts`, dentro del `describe` existente:

```ts
  it("la orden de cursos con reparto pasa siempre por la llave del guard", () => {
    const fuente = readFileSync(path.join(__dirname, "split-1n-cursos.ts"), "utf8");
    expect(fuente).toContain("cobroConRepartoHabilitado(");
  });
```

- [ ] **Step 2: Correrlos y ver que fallan**

Run: `pnpm --filter fotoffice test lib/payments lib/course-marketplace/venta.test.ts`
Expected: FAIL (no existe `./split-1n-cursos`; `partesDesdeReparto` no existe).

- [ ] **Step 3: `split-1n-cursos.ts`**

```ts
// lib/payments/split-1n-cursos.ts
/**
 * La orden de Mercado Pago (Orders API, split 1:N) de una venta de curso con reparto
 * (spec del mercado de cursos, sección 5.2). APAGADA: `prepararOrdenDeCursoConReparto` pasa por
 * `cobroConRepartoHabilitado()`, que hoy devuelve false (ver split-1n.ts y
 * docs/payments/fotoffice-split-1n-disabled.md).
 *
 * Vive en lib/payments/ a propósito: es la única carpeta donde el test del guard admite los
 * símbolos de Orders/Split. Reusa los constructores y el validador de @repo/payments; no inventa
 * nada nuevo:
 * - Montos fijos (`amount_type = fixed`) calculados por el motor de reparto.
 * - Dueño de la orden (`owner`): el beneficiario que absorbe la comisión de Mercado Pago. MP la
 *   cobra sobre el dueño; A CONFIRMAR en la homologación.
 * - Socios (`partner`): el resto de los beneficiarios, el revendedor y la plataforma (su
 *   comisión), cada uno con su consentimiento ACTIVE real.
 * - Una parte en cero (por ejemplo, el revendedor que regaló toda su parte) no viaja.
 */
import { money } from "@repo/payments/money";
import {
  MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS,
  buildMercadoPagoSplitOrderRequest,
  buildOpaqueExternalReference,
  singleIntangibleItem,
  validateMercadoPagoSplitOrder,
  type PartnerConsentEvidence,
} from "@repo/payments/mercado-pago";
import type { ParteDelReparto } from "@/lib/course-marketplace/reparto";
import { normalizeConsentStatus } from "./connect/consent";
import { cobroConRepartoHabilitado } from "./split-1n";

export type ReceptorDeSplit = { receiverId: string; consentimiento: PartnerConsentEvidence | null };
export type PagoConTarjeta = { token: string; metodo: string; cuotas: number; deviceSessionId: string };

export type EntradaOrdenDeCurso = {
  enrollmentId: string;
  tituloCurso: string;
  payerEmail: string;
  partes: ParteDelReparto[];
  /** Por id de parte (el workspaceId de cada beneficiario y del revendedor). */
  receptores: Map<string, ReceptorDeSplit>;
  plataforma: ReceptorDeSplit | null;
  pago: PagoConTarjeta;
  /** Sólo tests: acepta consentimientos de prueba. Nunca en producción. */
  permitirFixturesDePrueba?: boolean;
};

export type CodigoOrdenDeCurso =
  | "SPLIT_APAGADO"
  | "SIN_DUENO"
  | "SIN_RECEPTOR"
  | "SIN_CONSENTIMIENTO"
  | "SIN_PLATAFORMA"
  | "DEMASIADOS_RECEPTORES"
  | "INVALIDA";

type OrdenConstruida = ReturnType<typeof buildMercadoPagoSplitOrderRequest>;
type Entradas = Parameters<typeof buildMercadoPagoSplitOrderRequest>[0]["entries"];

export type ResultadoOrdenDeCurso =
  | ({ ok: true; ownerReceiverId: string } & OrdenConstruida)
  | { ok: false; codigo: CodigoOrdenDeCurso; detalle: string };

/** Lo guardado en `DnxSplitConsent` → receptor con su evidencia. Un estado desconocido nunca es ACTIVE. */
export function evidenciaDeConsentimiento(fila: { providerReceiverId: string | null; status: string } | null): ReceptorDeSplit | null {
  if (!fila?.providerReceiverId) return null;
  const estado = normalizeConsentStatus(fila.status);
  return {
    receiverId: fila.providerReceiverId,
    consentimiento: estado === "NONE" ? null : { receiverId: fila.providerReceiverId, status: estado, provider: "mercadopago" },
  };
}

function consentimientoActivo(r: ReceptorDeSplit): boolean {
  return r.consentimiento?.status === "ACTIVE" && r.consentimiento.receiverId === r.receiverId;
}

export function armarOrdenDeCursoConReparto(e: EntradaOrdenDeCurso): ResultadoOrdenDeCurso {
  const dueno = e.partes.find((p) => p.tipo === "BENEFICIARIO" && p.absorbeMp);
  if (!dueno) return { ok: false, codigo: "SIN_DUENO", detalle: "Ninguna parte absorbe la comisión de Mercado Pago." };

  const entries: Entradas = [];
  const partnerReceiverIds = new Map<string, string>();
  const consentimientos = new Map<string, PartnerConsentEvidence>();
  let ownerReceiverId = "";

  for (const p of e.partes) {
    if (p !== dueno && p.centavos <= 0) continue;
    const receptor = p.tipo === "PLATAFORMA" ? e.plataforma : (e.receptores.get(p.id) ?? null);
    if (!receptor) {
      return {
        ok: false,
        codigo: p.tipo === "PLATAFORMA" ? "SIN_PLATAFORMA" : "SIN_RECEPTOR",
        detalle: `${p.nombre} no tiene una cuenta de Mercado Pago para el reparto.`,
      };
    }
    if (!consentimientoActivo(receptor)) {
      return { ok: false, codigo: "SIN_CONSENTIMIENTO", detalle: `${p.nombre} no tiene activo su consentimiento de Mercado Pago.` };
    }
    const amount = money("ARS", p.centavos);
    if (p === dueno) {
      ownerReceiverId = receptor.receiverId;
      entries.unshift({ receiverType: "owner", receiverId: receptor.receiverId, amount });
    } else {
      entries.push({ receiverType: "partner", receiverId: receptor.receiverId, consentStatus: "ACTIVE", amount });
      partnerReceiverIds.set(p.id, receptor.receiverId);
      consentimientos.set(p.id, receptor.consentimiento!);
    }
  }

  if (partnerReceiverIds.size > MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS) {
    return {
      ok: false,
      codigo: "DEMASIADOS_RECEPTORES",
      detalle: `Mercado Pago reparte entre el dueño de la orden y ${MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS} cuentas más como máximo.`,
    };
  }

  const total = money("ARS", e.partes.reduce((s, p) => s + p.centavos, 0));
  try {
    const externalReference = buildOpaqueExternalReference("fotoffice", "curso", e.enrollmentId);
    const items = [singleIntangibleItem({ title: e.tituloCurso, total })];
    const validada = validateMercadoPagoSplitOrder({
      externalReference,
      total,
      amountType: "fixed",
      entries,
      deviceSessionId: e.pago.deviceSessionId,
      payerEmail: e.payerEmail,
      statementDescriptor: "FOTOFFICE",
      items,
      partnerReceiverIds,
      partnerConsentsByRecipientId: consentimientos,
      ownerUserId: ownerReceiverId,
      allowTestFixtures: e.permitirFixturesDePrueba ?? false,
    });
    const construida = buildMercadoPagoSplitOrderRequest({
      externalReference: validada.externalReference,
      total,
      amountType: "fixed",
      entries,
      deviceSessionId: validada.deviceSessionId,
      payerEmail: validada.payerEmail,
      statementDescriptor: validada.statementDescriptor,
      items,
      paymentToken: e.pago.token,
      paymentMethodId: e.pago.metodo,
      installments: e.pago.cuotas,
    });
    return { ok: true, ownerReceiverId, ...construida };
  } catch (error) {
    return { ok: false, codigo: "INVALIDA", detalle: error instanceof Error ? error.message : String(error) };
  }
}

/** La única entrada que usa el resto de la app: primero la llave del guard, después la orden. */
export function prepararOrdenDeCursoConReparto(e: EntradaOrdenDeCurso, env: NodeJS.ProcessEnv = process.env): ResultadoOrdenDeCurso {
  if (!cobroConRepartoHabilitado(env)) {
    return { ok: false, codigo: "SPLIT_APAGADO", detalle: "El reparto automático de Mercado Pago está apagado para FOTOFFICE." };
  }
  return armarOrdenDeCursoConReparto(e);
}
```

Si `money` no acepta `number`, pasá `BigInt(p.centavos)`. Si el tipo de
`entries.unshift/push` choca con el de `Entradas` (`consentStatus` como literal), declaralo con
`as const` en ese campo.

- [ ] **Step 4: `partesDesdeReparto` en `venta.ts`**

```ts
/** Del reparto congelado (`CourseSaleShare`) de vuelta a partes del motor, para armar la orden. */
export function partesDesdeReparto(
  filas: Array<{ workspaceId: string | null; kind: ParteDelReparto["tipo"]; label: string; amountArs: { toString(): string } | string; absorbsProcessorFee: boolean }>,
): ParteDelReparto[] {
  return filas.map((f, i) => ({
    // Un negocio borrado (SetNull) no puede cobrar: queda sin receptor y la orden no se arma.
    id: f.kind === "PLATAFORMA" ? "plataforma" : (f.workspaceId ?? `sin-negocio-${i}`),
    nombre: f.label,
    tipo: f.kind,
    centavos: Math.round(Number(f.amountArs.toString()) * 100),
    absorbeMp: f.absorbsProcessorFee,
  }));
}
```

- [ ] **Step 5: `orden.ts` (servidor)**

```ts
// lib/course-marketplace/orden.ts
import "server-only";
import { prisma } from "@repo/db";
import { workspaceOrganizationRef } from "@/lib/payments/connect/constants";
import {
  evidenciaDeConsentimiento,
  prepararOrdenDeCursoConReparto,
  type PagoConTarjeta,
  type ReceptorDeSplit,
  type ResultadoOrdenDeCurso,
} from "@/lib/payments/split-1n-cursos";
import { cobroConRepartoHabilitado } from "@/lib/payments/split-1n";
import { partesDesdeReparto } from "./venta";

/**
 * Receptores y consentimientos de cada negocio, desde lo registrado en la base (mismo camino que
 * `getStoredSplitConsent` de lib/payments/connect/consent.ts). No consulta a Mercado Pago.
 */
export async function cargarReceptores(workspaceIds: string[]): Promise<Map<string, ReceptorDeSplit>> {
  const receptores = new Map<string, ReceptorDeSplit>();
  for (const workspaceId of [...new Set(workspaceIds)]) {
    const identidad = await prisma.dnxFinancialIdentity.findUnique({
      where: { organizationRef: workspaceOrganizationRef(workspaceId) },
      select: { id: true },
    });
    if (!identidad) continue;
    const cuenta = await prisma.dnxPaymentAccount.findFirst({
      where: { financialIdentityId: identidad.id, provider: "MERCADOPAGO", environment: "PROD" },
      select: { providerUserId: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!cuenta?.providerUserId) continue;
    const consentimiento = await prisma.dnxSplitConsent.findFirst({
      where: { provider: "MERCADOPAGO", environment: "PRODUCTION", providerReceiverId: cuenta.providerUserId },
      select: { providerReceiverId: true, status: true },
      orderBy: { updatedAt: "desc" },
    });
    const r = evidenciaDeConsentimiento(consentimiento ? { providerReceiverId: consentimiento.providerReceiverId, status: String(consentimiento.status) } : null);
    if (r) receptores.set(workspaceId, r);
  }
  return receptores;
}

/** El receptor de la comisión de la plataforma: `FOTOFFICE_CURSOS_PLATAFORMA_MP_RECEIVER_ID`. */
export async function cargarReceptorDePlataforma(): Promise<ReceptorDeSplit | null> {
  const receiverId = process.env.FOTOFFICE_CURSOS_PLATAFORMA_MP_RECEIVER_ID?.trim();
  if (!receiverId) return null;
  const consentimiento = await prisma.dnxSplitConsent.findFirst({
    where: { provider: "MERCADOPAGO", environment: "PRODUCTION", providerReceiverId: receiverId },
    select: { providerReceiverId: true, status: true },
  });
  return evidenciaDeConsentimiento(consentimiento ? { providerReceiverId: consentimiento.providerReceiverId, status: String(consentimiento.status) } : null);
}

/**
 * La orden de una inscripción con reparto, desde su reparto congelado. Hoy devuelve
 * SPLIT_APAGADO sin tocar la base. Falta, para cuando MP habilite el split: el Card Brick en la
 * página del curso (token y sesión del pagador), el POST con `MercadoPagoOrdersAdapter` y el
 * webhook de órdenes. Nada de eso se construye en este plan.
 */
export async function armarOrdenParaInscripcion(enrollmentId: string, pago: PagoConTarjeta): Promise<ResultadoOrdenDeCurso> {
  if (!cobroConRepartoHabilitado()) {
    return { ok: false, codigo: "SPLIT_APAGADO", detalle: "El reparto automático de Mercado Pago está apagado para FOTOFFICE." };
  }
  const inscripcion = await prisma.courseEnrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      email: true,
      paymentStatus: true,
      course: { select: { title: true } },
      saleShares: {
        orderBy: { createdAt: "asc" },
        select: { workspaceId: true, kind: true, label: true, amountArs: true, absorbsProcessorFee: true },
      },
    },
  });
  if (!inscripcion || inscripcion.paymentStatus !== "PENDING" || inscripcion.saleShares.length === 0) {
    return { ok: false, codigo: "INVALIDA", detalle: "La inscripción no está pendiente de pago o no tiene reparto." };
  }
  const partes = partesDesdeReparto(inscripcion.saleShares);
  const [receptores, plataforma] = await Promise.all([
    cargarReceptores(partes.filter((p) => p.tipo !== "PLATAFORMA").map((p) => p.id)),
    cargarReceptorDePlataforma(),
  ]);
  return prepararOrdenDeCursoConReparto({
    enrollmentId: inscripcion.id,
    tituloCurso: inscripcion.course.title,
    payerEmail: inscripcion.email,
    partes,
    receptores,
    plataforma,
    pago,
  });
}
```

(Confirmá que `workspaceOrganizationRef` se exporta de `lib/payments/connect/constants.ts`; lo
importa `consent.ts` desde `./constants`.)

- [ ] **Step 6: Actualizar la decisión (sin encender nada)**

En `lib/payments/split-1n.ts`, reemplazá el párrafo "Decisión (2026-08-26)…" y el de "Para
reactivar" del comentario de cabecera por:

```ts
 * Decisión (2026-08-26): FotOffice no tenía un caso productivo que requiriera repartir un cobro.
 * Actualización (2026-10-05): el mercado de cursos ES ese caso (cursos con varios beneficiarios o
 * revendidos). La orden se arma en `split-1n-cursos.ts` y queda APAGADA: este interruptor sigue
 * en false hasta que Mercado Pago habilite el split en producción para la aplicación de la suite.
 * Además vale el guard general `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED` (`cobroConRepartoHabilitado`).
 *
 * Para encender: poner `FOTOFFICE_SPLIT_1N_ENABLED = true` en un cambio de código revisado,
 * actualizar `split-1n.test.ts` y seguir docs/payments/fotoffice-split-1n-disabled.md §7.
```

En `lib/payments/split-1n.test.ts`, al final del comentario de `FORBIDDEN_SPLIT_SYMBOLS`, agregá:

```ts
 *
 * Desde el 2026-10-05 la orden de cursos con reparto vive en `lib/payments/split-1n-cursos.ts`:
 * esta carpeta es la única exenta, y la orden sólo se arma pasando por la llave del guard.
```

`FOTOFFICE_SPLIT_1N_ENABLED` y `FOTOFFICE_SPLIT_1N_STATUS` **no** cambian.

En `docs/payments/fotoffice-split-1n-disabled.md`:
- Encabezado: `**Estado:** \`DISABLED\` — caso productivo definido (mercado de cursos), esperando la habilitación de Mercado Pago`.
- §3: después de la lista de lo que hace fallar el test, agregar: "Excepción: los archivos que
  están directamente en `apps/fotoffice/lib/payments/` (el guard, su test y `split-1n-cursos.ts`)
  pueden nombrar esos símbolos."
- §6, punto 4: tachar "Agregar `@repo/payments` a las dependencias de la app" — ya está desde las
  cuotas de socios.
- Agregar al final:

```markdown
---

## 7. Actualización 2026-10-05: el mercado de cursos es el caso productivo

Spec: `apps/fotoffice/docs/superpowers/specs/2026-10-05-mercado-de-cursos-design.md` (sección 5).

**Qué está programado (apagado):**

| Pieza | Dónde |
| --- | --- |
| Llave: interruptor de FOTOFFICE **y** `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED` | `apps/fotoffice/lib/payments/split-1n.ts` → `cobroConRepartoHabilitado()` |
| Orden con montos fijos del motor: dueño = beneficiario que absorbe la comisión de MP; socios = demás beneficiarios, revendedor y plataforma | `apps/fotoffice/lib/payments/split-1n-cursos.ts` (usa `validateMercadoPagoSplitOrder` y `buildMercadoPagoSplitOrderRequest` de `@repo/payments`) |
| Consentimiento ACTIVE de cada receptor, desde `DnxSplitConsent` | `apps/fotoffice/lib/course-marketplace/orden.ts` |
| Reparto congelado por venta | `CourseSaleShare` |

**Mientras tanto:** los cursos con varios beneficiarios o revendidos se arman, se acuerdan y se
simulan, pero su página dice "Disponible próximamente" y el checkout no los cobra.

**Para encender, en este orden:**
1. Mercado Pago habilita el split en producción para la aplicación de la suite.
2. La homologación confirma que MP cobra su comisión sobre el dueño de la orden (si no, el motor
   descuenta una estimación de esa parte).
3. Configurar `FOTOFFICE_CURSOS_PLATAFORMA_MP_RECEIVER_ID` (el receptor de la comisión de la
   plataforma) con su consentimiento ACTIVE.
4. Construir el Card Brick en la página del curso, el POST con `MercadoPagoOrdersAdapter` y el
   webhook de órdenes (no están hechos).
5. `FOTOFFICE_SPLIT_1N_ENABLED = true` en un cambio revisado, con su test, y
   `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED=true`.
```

- [ ] **Step 7: Correr, tipos y commit**

Run: `pnpm --filter fotoffice test lib/payments lib/course-marketplace && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: PASS — en particular los dos barridos de símbolos de `split-1n.test.ts` siguen en `[]`
(`orden.ts` no nombra ningún símbolo prohibido).

```bash
git add apps/fotoffice/lib/payments apps/fotoffice/lib/course-marketplace/orden.ts apps/fotoffice/lib/course-marketplace/venta.ts apps/fotoffice/lib/course-marketplace/venta.test.ts docs/payments/fotoffice-split-1n-disabled.md
git commit -m "Mercado de cursos: orden de Mercado Pago con reparto programada y apagada; decisión del guard actualizada"
```

---

### Task 10: La pantalla Cobros

**Files:**
- Create: `lib/course-marketplace/cobros.ts`, `lib/course-marketplace/cobros.test.ts`
- Create: `app/(shell)/dashboard/cobros-de-cursos/page.tsx`
- Modify: `lib/modules/submodules.ts` — `const CURSOS`: entrada "Cobros".
- Modify: `lib/modules/submodules.test.ts` — caso de "Cobros".
- Modify: `app/(shell)/dashboard/cursos-compartidos/page.tsx` — un enlace a Cobros en el `<header>`.

**Interfaces:**
- Consumes: `requireDuenoOAdminDelNegocio` (etapa 1, `lib/course-marketplace/access.ts`); `pesos` (Task 4); `fechaLegibleArgentina`.
- Produces:
  - `type FilaCobro = { id: string; enrollmentId: string; kind: "PLATAFORMA" | "REVENDEDOR" | "BENEFICIARIO"; montoCentavos: number; pagaElAlumnoCentavos: number; curso: string; fecha: Date; estadoPago: string; vendioEsteNegocio: boolean }`
  - `type ResumenCobros = { cobradoCentavos: number; pendienteCentavos: number; ventasAprobadas: number; vendidoCentavos: number; porCurso: Array<{ curso: string; ventas: number; cobradoCentavos: number }> }`
  - `resumirCobros(filas: FilaCobro[]): ResumenCobros`
  - `ROTULO_DE_PARTE: Record<FilaCobro["kind"], string>`; `ESTADO_DE_PAGO: Record<string, string>`
  - Ruta `/dashboard/cobros-de-cursos`.

- [ ] **Step 1: Tests que fallan**

```ts
// lib/course-marketplace/cobros.test.ts
import { describe, expect, it } from "vitest";
import { resumirCobros, type FilaCobro } from "./cobros";

const fila = (p: Partial<FilaCobro>): FilaCobro => ({
  id: "s1",
  enrollmentId: "e1",
  kind: "BENEFICIARIO",
  montoCentavos: 10_000_000,
  pagaElAlumnoCentavos: 10_500_000,
  curso: "Retrato",
  fecha: new Date("2026-10-05T15:00:00Z"),
  estadoPago: "APPROVED",
  vendioEsteNegocio: true,
  ...p,
});

describe("resumen de Cobros", () => {
  it("suma lo cobrado y lo pendiente por separado", () => {
    const r = resumirCobros([fila({}), fila({ id: "s2", enrollmentId: "e2", estadoPago: "PENDING", montoCentavos: 500 })]);
    expect(r.cobradoCentavos).toBe(10_000_000);
    expect(r.pendienteCentavos).toBe(500);
    expect(r.ventasAprobadas).toBe(1);
  });

  it("lo vendido cuenta cada venta una vez y sólo las de este negocio", () => {
    const r = resumirCobros([
      fila({ id: "a", enrollmentId: "e1" }),
      fila({ id: "b", enrollmentId: "e1", kind: "REVENDEDOR", montoCentavos: 1 }),
      fila({ id: "c", enrollmentId: "e3", vendioEsteNegocio: false }),
    ]);
    expect(r.vendidoCentavos).toBe(10_500_000);
    expect(r.ventasAprobadas).toBe(2);
  });

  it("rechazados y cancelados no suman", () => {
    const r = resumirCobros([fila({ estadoPago: "REJECTED" }), fila({ id: "x", enrollmentId: "e9", estadoPago: "CANCELLED" })]);
    expect(r).toMatchObject({ cobradoCentavos: 0, pendienteCentavos: 0, ventasAprobadas: 0, vendidoCentavos: 0, porCurso: [] });
  });

  it("agrupa por curso, de mayor a menor", () => {
    const r = resumirCobros([
      fila({ id: "1", enrollmentId: "e1", curso: "Retrato", montoCentavos: 100 }),
      fila({ id: "2", enrollmentId: "e2", curso: "Paisaje", montoCentavos: 300 }),
      fila({ id: "3", enrollmentId: "e3", curso: "Retrato", montoCentavos: 100 }),
    ]);
    expect(r.porCurso).toEqual([
      { curso: "Paisaje", ventas: 1, cobradoCentavos: 300 },
      { curso: "Retrato", ventas: 2, cobradoCentavos: 200 },
    ]);
  });
});
```

En `lib/modules/submodules.test.ts`, dentro de `describe("submodulesFor", …)`:

```ts
  it("Cursos: Cobros está entre sus pantallas, pide gestionar y tiene su archivo", () => {
    const cobros = submodulesFor(COURSES_SALES_MODULE_KEY, GESTIONA, SOCIO).find((s) => s.href === "/dashboard/cobros-de-cursos");
    expect(cobros?.requiresManage).toBe(true);
    expect(existsSync(pageDe("/dashboard/cobros-de-cursos"))).toBe(true);
  });
```

Run: `pnpm --filter fotoffice test lib/course-marketplace/cobros.test.ts lib/modules/submodules.test.ts` → FAIL.

- [ ] **Step 2: `cobros.ts`**

```ts
// lib/course-marketplace/cobros.ts
/**
 * Cobros: lo que un negocio vendió y lo que le tocó de cada venta de cursos, desde el reparto
 * congelado (`CourseSaleShare`). Puro. Con el split apagado, cada venta la cobró quien vendió con
 * su Mercado Pago; esto es lo anotado, no un movimiento de plata.
 */

export type FilaCobro = {
  id: string;
  enrollmentId: string;
  kind: "PLATAFORMA" | "REVENDEDOR" | "BENEFICIARIO";
  montoCentavos: number;
  pagaElAlumnoCentavos: number;
  curso: string;
  fecha: Date;
  estadoPago: string;
  vendioEsteNegocio: boolean;
};

export type ResumenCobros = {
  cobradoCentavos: number;
  pendienteCentavos: number;
  ventasAprobadas: number;
  vendidoCentavos: number;
  porCurso: Array<{ curso: string; ventas: number; cobradoCentavos: number }>;
};

export const ROTULO_DE_PARTE: Record<FilaCobro["kind"], string> = {
  PLATAFORMA: "Plataforma",
  REVENDEDOR: "Como revendedor",
  BENEFICIARIO: "Como beneficiario",
};

export const ESTADO_DE_PAGO: Record<string, string> = {
  APPROVED: "Cobrado",
  PENDING: "Pendiente",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
};

export function resumirCobros(filas: FilaCobro[]): ResumenCobros {
  let cobradoCentavos = 0;
  let pendienteCentavos = 0;
  const aprobadas = new Set<string>();
  const vendidas = new Map<string, number>();
  const porCurso = new Map<string, { ventas: Set<string>; cobradoCentavos: number }>();

  for (const f of filas) {
    if (f.estadoPago === "PENDING") pendienteCentavos += f.montoCentavos;
    if (f.estadoPago !== "APPROVED") continue;
    cobradoCentavos += f.montoCentavos;
    aprobadas.add(f.enrollmentId);
    if (f.vendioEsteNegocio) vendidas.set(f.enrollmentId, f.pagaElAlumnoCentavos);
    const c = porCurso.get(f.curso) ?? { ventas: new Set<string>(), cobradoCentavos: 0 };
    c.ventas.add(f.enrollmentId);
    c.cobradoCentavos += f.montoCentavos;
    porCurso.set(f.curso, c);
  }

  return {
    cobradoCentavos,
    pendienteCentavos,
    ventasAprobadas: aprobadas.size,
    vendidoCentavos: [...vendidas.values()].reduce((s, v) => s + v, 0),
    porCurso: [...porCurso.entries()]
      .map(([curso, c]) => ({ curso, ventas: c.ventas.size, cobradoCentavos: c.cobradoCentavos }))
      .sort((a, b) => b.cobradoCentavos - a.cobradoCentavos),
  };
}
```

- [ ] **Step 3: Menú y página**

En `const CURSOS` de `lib/modules/submodules.ts`, después de la entrada del Mercado:

```ts
  {
    href: "/dashboard/cobros-de-cursos",
    label: "Cobros",
    icon: "Wallet",
    description: "Lo que vendiste y lo que te tocó de cada venta de cursos.",
    requiresManage: true,
    activeMatch: "under",
  },
```

```tsx
// app/(shell)/dashboard/cobros-de-cursos/page.tsx
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireDuenoOAdminDelNegocio } from "@/lib/course-marketplace/access";
import { ESTADO_DE_PAGO, ROTULO_DE_PARTE, resumirCobros, type FilaCobro } from "@/lib/course-marketplace/cobros";
import { pesos } from "@/lib/course-marketplace/formato";
import { fechaLegibleArgentina } from "@/lib/course-classroom/access-rules";

export const dynamic = "force-dynamic";

/**
 * No exige el módulo de cursos: un docente o una productora pueden cobrar su parte sin vender
 * cursos ellos mismos. Sí exige ser dueño o admin: es plata.
 */
export default async function CobrosDeCursosPage() {
  const { workspace } = await requireDuenoOAdminDelNegocio();
  const partes = await prisma.courseSaleShare.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      kind: true,
      amountArs: true,
      createdAt: true,
      enrollment: {
        select: { id: true, workspaceId: true, paymentStatus: true, amountArs: true, course: { select: { title: true } } },
      },
    },
  });
  const filas: FilaCobro[] = partes.map((p) => ({
    id: p.id,
    enrollmentId: p.enrollment.id,
    kind: p.kind,
    montoCentavos: Math.round(Number(p.amountArs) * 100),
    pagaElAlumnoCentavos: Math.round(Number(p.enrollment.amountArs) * 100),
    curso: p.enrollment.course.title,
    fecha: p.createdAt,
    estadoPago: p.enrollment.paymentStatus,
    vendioEsteNegocio: p.enrollment.workspaceId === workspace.id,
  }));
  const r = resumirCobros(filas);

  return (
    <div className="space-y-8">
      <PageHeader title="Cobros" description="Lo que vendiste y lo que te tocó de cada venta de cursos, a precio de lista y antes de la comisión de Mercado Pago." />
      <p className="fo-card text-sm text-[var(--fo-muted)]">
        Mientras el reparto automático de Mercado Pago esté apagado, cada venta la cobra quien vende, con su Mercado Pago, y la plataforma retiene su comisión.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="fo-card"><p className="text-xs text-[var(--fo-muted)]">Cobrado</p><p className="text-xl font-semibold">{pesos(r.cobradoCentavos)}</p></div>
        <div className="fo-card"><p className="text-xs text-[var(--fo-muted)]">Pendiente</p><p className="text-xl font-semibold">{pesos(r.pendienteCentavos)}</p></div>
        <div className="fo-card"><p className="text-xs text-[var(--fo-muted)]">Ventas cobradas</p><p className="text-xl font-semibold">{r.ventasAprobadas}</p></div>
        <div className="fo-card"><p className="text-xs text-[var(--fo-muted)]">Vendido por tu sitio</p><p className="text-xl font-semibold">{pesos(r.vendidoCentavos)}</p></div>
      </div>
      {r.porCurso.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Por curso</h2>
          <ul className="fo-card divide-y divide-[var(--fo-border)]">
            {r.porCurso.map((c) => (
              <li key={c.curso} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                <span>{c.curso} · {c.ventas} {c.ventas === 1 ? "venta" : "ventas"}</span>
                <span className="tabular-nums">{pesos(c.cobradoCentavos)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Detalle</h2>
        {filas.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no hay ventas de cursos.</p>
        ) : (
          <ul className="fo-card divide-y divide-[var(--fo-border)]">
            {filas.map((f) => (
              <li key={f.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                <span>
                  {fechaLegibleArgentina(f.fecha)} · {f.curso} · {ROTULO_DE_PARTE[f.kind]} · {ESTADO_DE_PAGO[f.estadoPago] ?? f.estadoPago}
                </span>
                <span className="tabular-nums">{pesos(f.montoCentavos)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

En `app/(shell)/dashboard/cursos-compartidos/page.tsx`, dentro del `<header>`, después del párrafo:

```tsx
        <p className="text-sm">
          <Link href="/dashboard/cobros-de-cursos" className="text-[var(--fo-accent)] underline">
            Ver tus cobros
          </Link>
        </p>
```

- [ ] **Step 4: Suite, tipos y commit**

Run: `pnpm --filter fotoffice test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: verde.

```bash
git add apps/fotoffice
git commit -m "Mercado de cursos: la pantalla Cobros con lo vendido y lo que tocó de cada venta"
```

---

### Task 11: "¿Querés enseñar?" (etapa 5)

**Files:**
- Create: `lib/course-marketplace/invitacion-ensenar.ts`, `lib/course-marketplace/invitacion-ensenar.test.ts`
- Create: `components/course-marketplace/invitacion-a-ensenar.tsx`
- Modify: `app/portal/cursos/page.tsx` — al final de la página (Mis cursos del alumno y del socio).
- Modify: `components/portal/portal-home.tsx` — el texto del pie, líneas 391–398 (`{!tieneNegocio ? ( <form action={createOwnBusinessAction} …`).
- Modify: `app/w/[workspaceSlug]/cursos/[courseSlug]/page.tsx` — al final del `<main>`.

**Interfaces:**
- Consumes: `createOwnBusinessAction` de `@/app/actions/profile-choice` (existente: crea el negocio sólo con un clic explícito y lleva a `/onboarding`); `listUserProfiles` de `@/lib/portal/profiles`.
- Produces:
  - `INVITACION_A_ENSENAR = { titulo, texto, boton, botonPublico, aclaracion }`
  - `enlaceParaEnsenarDesdeAfuera(appUrl: string): string`
  - `debeInvitarAEnsenar(input: { tieneNegocio: boolean }): boolean`
  - `InvitacionAEnsenar(props: { modo: "portal" } | { modo: "publico"; appUrl: string })`

- [ ] **Step 1: Test que falla**

```ts
// lib/course-marketplace/invitacion-ensenar.test.ts
import { describe, expect, it } from "vitest";
import { INVITACION_A_ENSENAR, debeInvitarAEnsenar, enlaceParaEnsenarDesdeAfuera } from "./invitacion-ensenar";

describe("¿Querés enseñar?", () => {
  it("el texto es el del spec (sección 3)", () => {
    expect(INVITACION_A_ENSENAR.titulo).toBe("¿Querés enseñar?");
    expect(INVITACION_A_ENSENAR.texto).toBe("Creá tu espacio, subí tus cursos y que las instituciones los vendan.");
  });

  it("sólo se invita a quien todavía no tiene negocio", () => {
    expect(debeInvitarAEnsenar({ tieneNegocio: false })).toBe(true);
    expect(debeInvitarAEnsenar({ tieneNegocio: true })).toBe(false);
  });

  it("desde la página pública lleva a registrarse, en el dominio de FOTOFFICE", () => {
    expect(enlaceParaEnsenarDesdeAfuera("https://fotoffice.com/")).toBe("https://fotoffice.com/login?next=%2Fbienvenida");
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implementar**

```ts
// lib/course-marketplace/invitacion-ensenar.ts
/**
 * La invitación a enseñar (spec, sección 3): en Mis cursos, en el portal del socio y en la página
 * pública de cada curso. Crear el negocio es siempre un botón explícito (`createOwnBusinessAction`);
 * desde afuera, primero se registra y la bienvenida le pregunta a qué vino.
 */
export const INVITACION_A_ENSENAR = {
  titulo: "¿Querés enseñar?",
  texto: "Creá tu espacio, subí tus cursos y que las instituciones los vendan.",
  boton: "Crear mi espacio",
  botonPublico: "Creá tu cuenta",
  aclaracion: "Crea un espacio nuevo con vos como responsable. Tu ficha y tus cursos siguen igual.",
} as const;

export function debeInvitarAEnsenar(input: { tieneNegocio: boolean }): boolean {
  return !input.tieneNegocio;
}

export function enlaceParaEnsenarDesdeAfuera(appUrl: string): string {
  return `${appUrl.replace(/\/+$/, "")}/login?next=${encodeURIComponent("/bienvenida")}`;
}
```

```tsx
// components/course-marketplace/invitacion-a-ensenar.tsx
import { createOwnBusinessAction } from "@/app/actions/profile-choice";
import { INVITACION_A_ENSENAR as T, enlaceParaEnsenarDesdeAfuera } from "@/lib/course-marketplace/invitacion-ensenar";

/** La tarjeta "¿Querés enseñar?". En el portal crea el negocio con un clic; en lo público, lleva a registrarse. */
export function InvitacionAEnsenar(props: { modo: "portal" } | { modo: "publico"; appUrl: string }) {
  return (
    <aside className="fo-card space-y-2">
      <p className="font-semibold">{T.titulo}</p>
      <p className="text-sm text-[var(--fo-muted)]">{T.texto}</p>
      {props.modo === "portal" ? (
        <>
          <form action={createOwnBusinessAction}>
            <button type="submit" className="fo-btn fo-btn-secondary text-sm">
              {T.boton}
            </button>
          </form>
          <p className="text-xs text-[var(--fo-muted)]">{T.aclaracion}</p>
        </>
      ) : (
        <a href={enlaceParaEnsenarDesdeAfuera(props.appUrl)} className="fo-btn fo-btn-secondary inline-flex text-sm">
          {T.botonPublico}
        </a>
      )}
    </aside>
  );
}
```

- [ ] **Step 3: Montarla**

1. `app/portal/cursos/page.tsx`: después de cargar `socio`,
   `const tieneNegocio = (await listUserProfiles(user.id)).some((p) => p.kind === "TEAM");`
   y, como último hijo del `<div className="space-y-6">`:
   `{debeInvitarAEnsenar({ tieneNegocio }) ? <InvitacionAEnsenar modo="portal" /> : null}`.
2. `components/portal/portal-home.tsx`, el texto del `<form action={createOwnBusinessAction}>` del pie pasa a:
   `` {`¿Tenés tu propio estudio o querés enseñar? Creá tu espacio en FotoOffice para administrar tu negocio o subir tus cursos y que las instituciones los vendan, aparte de tu ficha de ${v.singular}.`}{" "} ``
   (el botón "Crear mi negocio" y la condición `!tieneNegocio` no cambian).
3. `app/w/[workspaceSlug]/cursos/[courseSlug]/page.tsx`: como último hijo de `<main>`:
   `{appUrl ? <InvitacionAEnsenar modo="publico" appUrl={appUrl} /> : null}`.

La barrera `lib/entrada/sin-institucion-fantasma.test.ts` sigue verde: nadie nuevo llama a
`createFotofficeWorkspaceForUser`; sólo se usa la acción existente.

- [ ] **Step 4: Suite, tipos y commit**

Run: `pnpm --filter fotoffice test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: verde.

```bash
git add apps/fotoffice
git commit -m "Mercado de cursos: la invitación '¿Querés enseñar?' en Mis cursos, el portal y la página pública"
```

---

### Task 12: Verificación completa

**Files:** ninguno nuevo (sólo arreglos si algo falla).

- [ ] **Step 1: Cliente de Prisma al día**

```bash
cd /Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite-wt-cursos-e2/packages/db
DATABASE_URL=postgresql://x:x@localhost:5432/x DIRECT_URL=postgresql://x:x@localhost:5432/x pnpm exec prisma generate
```

- [ ] **Step 2: Toda la suite**

Run: `pnpm --filter fotoffice test`
Expected: todos verdes, incluidos `split-1n.test.ts` (interruptor en `false`, barridos de símbolos
vacíos), `migracion-reventa.test.ts`, `submodules.test.ts` y `sin-institucion-fantasma.test.ts`.

- [ ] **Step 3: Tipos**

Run: `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: sin errores. Si termina en segundos sin salida, repetilo: puede haber muerto por memoria.

- [ ] **Step 4: Barridos finales**

```bash
cd /Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite-wt-cursos-e2
grep -n "FOTOFFICE_SPLIT_1N_ENABLED = " apps/fotoffice/lib/payments/split-1n.ts   # debe decir: false as const
grep -rn "split_rules\|receiver_type\|buildMercadoPagoSplitOrderRequest\|DNX_MP_ORDERS_1N_" apps/fotoffice/app apps/fotoffice/components apps/fotoffice/lib --include='*.ts' --include='*.tsx' | grep -v "apps/fotoffice/lib/payments/[^/]*$"   # debe salir vacío
grep -n "DROP\|RENAME\|ALTER COLUMN" packages/db/prisma/migrations/20261013120000_mercado_cursos_reventa/migration.sql   # debe salir vacío
git diff --stat origin/main -- apps | grep -v "apps/fotoffice" # debe salir vacío: no se tocaron otras apps
```

- [ ] **Step 5: Commit (sólo si hubo arreglos)**

```bash
git add apps/fotoffice packages/db docs/payments
git commit -m "Mercado de cursos: ajustes de la verificación final"
```

---

## Fuera de este plan

- Aplicar la migración en las bases (lo hace el controlador, a mano, antes de fusionar).
- Card Brick en la página del curso, POST de la orden con `MercadoPagoOrdersAdapter`, webhook de
  órdenes y devoluciones: se construyen cuando Mercado Pago habilite el split (doc del guard, §7).
- Descuento para socios en cursos propios sin reventa (hoy sólo "gratis para socios").
- Precios distintos por revendedor, cupones, liquidaciones manuales, facturación ARCA (spec §10).
