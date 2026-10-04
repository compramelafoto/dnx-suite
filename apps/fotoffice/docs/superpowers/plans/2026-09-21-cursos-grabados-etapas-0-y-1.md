# Cursos grabados — Etapas 0 y 1

> **Para quien lo ejecute:** usá `superpowers:executing-plans` o
> `superpowers:subagent-driven-development`. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Goal:** dejar el cobro de cursos igual que el de Reservas (la institución cobra, la plataforma
retiene su comisión) y que un curso pueda ser grabado, con sus clases y sus videos cargados.

**Architecture:** el cobro deja de usar un token de plataforma y pasa por
`resolveWorkspaceCollector`, con `marketplaceFeeMinor`, igual que `lib/bookings/checkout.ts`. El
curso gana una modalidad; cuando es `RECORDED` tiene `CourseLesson` en vez de `CourseInstance`, y
el video vive en Cloudflare Stream con firma obligatoria.

**Tech Stack:** Next 16 (App Router), Prisma sobre Postgres (Neon), vitest, Mercado Pago vía
`@repo/payments/mercado-pago`, Cloudflare Stream por API REST.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-09-21-cursos-grabados-design.md`

## Global Constraints

- Idioma de todo lo visible y de los comentarios: **español**. Los identificadores, en inglés,
  como el resto del repositorio.
- Comando de test: `pnpm --filter fotoffice test`. Un solo archivo:
  `pnpm --filter fotoffice test <ruta>`.
- Vitest sólo levanta `lib/**/*.test.ts` y `app/**/*.test.ts` (ver `vitest.config.ts`).
- **Nunca** subir archivos grandes a través de una route handler: las funciones de Vercel
  rechazan más de 4,5 MB con `413 FUNCTION_PAYLOAD_TOO_LARGE`.
- El esquema de Prisma es **uno solo para cinco bases Neon**. Toda migración se aplica a mano y
  se registra en `_prisma_migrations`; el despliegue no corre `prisma migrate deploy`.
- La comisión se guarda en **puntos básicos enteros** (500 = 5%), nunca en porcentaje decimal.
- Ninguna variable de entorno nueva puede romper lo que ya anda: si falta, la pantalla lo informa
  y el curso presencial sigue funcionando (criterio de `lib/payments/connect/config.ts`).

---

## Etapa 0 — Que el cobro funcione

Hoy el módulo no puede cobrar en producción: `lib/presential-courses/mercadopago.ts` lee
`MP_ACCESS_TOKEN`, que no existe en Vercel, y el webhook exige `MP_WEBHOOK_SECRET`, que tampoco.
Además la plata entraría a la cuenta de la plataforma. La salida no es renombrar variables: es
usar el camino que Reservas ya tiene probado.

### Task 1: Checkout de inscripción con la cuenta de la institución

**Files:**
- Create: `apps/fotoffice/lib/presential-courses/checkout.ts`
- Create: `apps/fotoffice/lib/presential-courses/checkout.test.ts`
- Reference: `apps/fotoffice/lib/bookings/checkout.ts` (el patrón a seguir, líneas 79-125)

**Interfaces:**
- Consumes: `resolveWorkspaceCollector(workspaceId)` de `@/lib/payments/connect/collector`;
  `getPlatformFeeBps(workspaceId, moduleKey)` de `@/lib/platform-fee/store`;
  `splitByPlatformFee(total, feeBps)` de `@/lib/platform-fee/fee`;
  `createMercadoPagoCheckoutProLiveAdapter({})` de `@repo/payments/mercado-pago`.
- Produces:
  - `courseExternalReference(enrollmentId: string): string` → `"fotoffice-curso:<id>"`
  - `parseCourseExternalReference(ref: string): string | null`
  - `createCourseEnrollmentCheckout(input: { enrollmentId: string; workspaceSlug: string; courseSlug: string }): Promise<{ ok: true; checkoutUrl: string } | { ok: false; error: string }>`

- [ ] **Step 1: Escribir el test que falla**

```ts
// apps/fotoffice/lib/presential-courses/checkout.test.ts
import { describe, expect, it } from "vitest";
import { courseExternalReference, parseCourseExternalReference } from "./checkout";

describe("referencia externa de la inscripción", () => {
  it("va y vuelve", () => {
    expect(parseCourseExternalReference(courseExternalReference("insc-1"))).toBe("insc-1");
  });

  it("ignora una referencia de otro módulo", () => {
    expect(parseCourseExternalReference("fotoffice-reserva:r-1")).toBeNull();
    expect(parseCourseExternalReference("cualquier-cosa")).toBeNull();
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/presential-courses/checkout.test.ts`
Expected: FAIL — `Failed to resolve import "./checkout"`.

- [ ] **Step 3: Escribir sólo la referencia externa**

```ts
// apps/fotoffice/lib/presential-courses/checkout.ts
const PREFIJO = "fotoffice-curso:";

export function courseExternalReference(enrollmentId: string): string {
  return `${PREFIJO}${enrollmentId}`;
}

export function parseCourseExternalReference(ref: string): string | null {
  if (!ref.startsWith(PREFIJO)) return null;
  const id = ref.slice(PREFIJO.length).trim();
  return id ? id : null;
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `pnpm --filter fotoffice test lib/presential-courses/checkout.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Escribir el test del reparto de la comisión**

El monto y la comisión que se congelan en la inscripción son lo que después cobra la plataforma.
El test verifica el cálculo sin tocar Mercado Pago ni la base:

```ts
import { Prisma } from "@repo/db";
import { splitByPlatformFee } from "@/lib/platform-fee/fee";

describe("cuánto retiene la plataforma", () => {
  it("con 5% sobre $100.000 retiene $5.000 y le quedan $95.000 a la institución", () => {
    const { fee, net } = splitByPlatformFee(new Prisma.Decimal("100000"), 500);
    expect(fee.toString()).toBe("5000");
    expect(net.toString()).toBe("95000");
  });

  it("el neto se obtiene restando, así la suma cierra contra el total", () => {
    const total = new Prisma.Decimal("99999.99");
    const { fee, net } = splitByPlatformFee(total, 725);
    expect(fee.plus(net).toString()).toBe(total.toString());
  });
});
```

- [ ] **Step 6: Correr los tests y verlos pasar**

Run: `pnpm --filter fotoffice test lib/presential-courses/checkout.test.ts`
Expected: PASS (4 tests). `splitByPlatformFee` ya existe: este test fija la expectativa para el
paso siguiente, que lo usa.

- [ ] **Step 7: Escribir `createCourseEnrollmentCheckout`**

```ts
import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";
import { splitByPlatformFee } from "@/lib/platform-fee/fee";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { computeAvailableSpots, getApprovedEnrollmentCountsByInstanceIds } from "./availability";
import { logCourseEvent } from "./log";

function aMinor(valor: Prisma.Decimal): number {
  return Number(valor.mul(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toString());
}

export async function createCourseEnrollmentCheckout(input: {
  enrollmentId: string;
  workspaceSlug: string;
  courseSlug: string;
}): Promise<{ ok: true; checkoutUrl: string } | { ok: false; error: string }> {
  const inscripcion = await prisma.courseEnrollment.findUnique({
    where: { id: input.enrollmentId },
    include: { course: true, courseInstance: true },
  });
  if (!inscripcion) return { ok: false, error: "Inscripción no encontrada." };
  if (inscripcion.paymentStatus !== "PENDING") {
    return { ok: false, error: "La inscripción no está pendiente de pago." };
  }
  if (inscripcion.course.status !== "PUBLISHED") {
    return { ok: false, error: "El curso no está publicado." };
  }

  // Cupo: sólo aplica cuando hay edición (un curso grabado no tiene).
  if (inscripcion.courseInstance) {
    const aprobadas = await getApprovedEnrollmentCountsByInstanceIds([inscripcion.courseInstance.id]);
    const libres = computeAvailableSpots(
      inscripcion.courseInstance.capacity,
      aprobadas.get(inscripcion.courseInstance.id) ?? 0,
    );
    if (libres <= 0) return { ok: false, error: "No hay cupos disponibles para esta edición." };
  }

  const collector = await resolveWorkspaceCollector(inscripcion.workspaceId);
  if (!collector.ok) {
    return { ok: false, error: "La institución todavía no conectó su cuenta de Mercado Pago." };
  }

  const feeBps = await getPlatformFeeBps(inscripcion.workspaceId, COURSES_SALES_MODULE_KEY);
  const { fee, net } = splitByPlatformFee(inscripcion.amountArs, feeBps);

  // La comisión se congela en la fila ANTES de abrir el pago: lo que se cobra es esto, y
  // dejar de recalcularla después es lo que evita que el número cambie tras el pago.
  await prisma.courseEnrollment.update({
    where: { id: inscripcion.id },
    data: {
      platformFeePercent: new Prisma.Decimal(feeBps).div(100),
      platformFeeArs: fee,
      netAmountArs: net,
    },
  });

  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  if (!base) return { ok: false, error: "APP_URL no está configurado." };
  const vuelta = `${base}/w/${input.workspaceSlug}/cursos/${input.courseSlug}/inscripcion`;

  try {
    const adapter = createMercadoPagoCheckoutProLiveAdapter({});
    const preferencia = await adapter.createPreference({
      amountMinor: aMinor(inscripcion.amountArs),
      currency: "ARS",
      description: `Inscripción: ${inscripcion.course.title}`,
      externalReference: courseExternalReference(inscripcion.id),
      idempotencyKey: randomUUID(),
      successUrl: `${vuelta}/success?enrollmentId=${inscripcion.id}`,
      pendingUrl: `${vuelta}/pending?enrollmentId=${inscripcion.id}`,
      failureUrl: `${vuelta}/failure?enrollmentId=${inscripcion.id}`,
      notificationUrl: `${base}/api/payments/mp/cursos-webhook`,
      accessTokenOverride: collector.collector.accessToken,
      marketplaceFeeMinor: aMinor(fee),
      itemId: `curso-${inscripcion.courseId}`,
      sourceApp: "FOTOFFICE",
      metadata: { enrollmentId: inscripcion.id, workspaceId: inscripcion.workspaceId },
      payerEmail: inscripcion.email,
    });

    await prisma.courseEnrollment.update({
      where: { id: inscripcion.id },
      data: { paymentRef: preferencia.providerPreferenceId },
    });
    logCourseEvent("checkout_abierto", { enrollmentId: inscripcion.id, feeBps });
    return { ok: true, checkoutUrl: preferencia.checkoutUrl };
  } catch (error) {
    console.error("[fotoffice][cursos] Mercado Pago rechazó la preferencia", {
      enrollmentId: inscripcion.id,
      detalle: sanitizeError(error),
    });
    return { ok: false, error: "No pudimos abrir el pago. Probá de nuevo en unos minutos." };
  }
}
```

- [ ] **Step 8: Correr toda la batería del módulo**

Run: `pnpm --filter fotoffice test lib/presential-courses`
Expected: PASS, sin romper los tests de correo que ya existen.

- [ ] **Step 9: Commit**

```bash
git add apps/fotoffice/lib/presential-courses/checkout.ts apps/fotoffice/lib/presential-courses/checkout.test.ts
git commit -m "Cobrar los cursos con la cuenta de la institución"
```

### Task 2: La ruta de pago usa el checkout nuevo y desaparece el token de plataforma

**Files:**
- Modify: `apps/fotoffice/app/api/payments/mercadopago/course-enrollment/create-preference/route.ts`
- Delete: `apps/fotoffice/lib/presential-courses/mercadopago.ts`
- Modify: `apps/fotoffice/components/presential-courses/course-enrollment-payment-button.tsx` (sólo
  si cambia la forma de la respuesta)

**Interfaces:**
- Consumes: `createCourseEnrollmentCheckout` de la Task 1.
- Produces: la ruta responde `{ checkoutUrl }` con 200, o `{ error }` con 400.

- [ ] **Step 1: Reescribir la ruta**

```ts
import { NextResponse } from "next/server";
import { createCourseEnrollmentCheckout } from "@/lib/presential-courses/checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    enrollmentId?: string;
    workspaceSlug?: string;
    courseSlug?: string;
  };
  const enrollmentId = body.enrollmentId?.trim();
  const workspaceSlug = body.workspaceSlug?.trim();
  const courseSlug = body.courseSlug?.trim();
  if (!enrollmentId || !workspaceSlug || !courseSlug) {
    return NextResponse.json({ error: "Faltan datos de la inscripción." }, { status: 400 });
  }

  const resultado = await createCourseEnrollmentCheckout({ enrollmentId, workspaceSlug, courseSlug });
  if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: 400 });
  return NextResponse.json({ checkoutUrl: resultado.checkoutUrl }, { status: 200 });
}
```

- [ ] **Step 2: Ajustar el botón para leer `checkoutUrl`**

En `course-enrollment-payment-button.tsx`, reemplazar la lectura de `initPoint`/`sandboxInitPoint`
por `checkoutUrl`:

```ts
const json = (await response.json().catch(() => ({}))) as { error?: string; checkoutUrl?: string };
if (!response.ok || !json.checkoutUrl) {
  throw new Error(json.error || "No se pudo iniciar el checkout.");
}
window.location.href = json.checkoutUrl;
```

- [ ] **Step 3: Borrar el cliente viejo**

```bash
git rm apps/fotoffice/lib/presential-courses/mercadopago.ts
```

- [ ] **Step 4: Verificar que no quedó ninguna referencia**

Run: `grep -rn "MP_ACCESS_TOKEN\|presential-courses/mercadopago" apps/fotoffice --include=*.ts --include=*.tsx`
Expected: sin resultados. Si aparece el webhook viejo, se resuelve en la Task 3.

- [ ] **Step 5: Commit**

```bash
git add -A apps/fotoffice
git commit -m "Retirar el token de plataforma del pago de cursos"
```

### Task 3: Webhook que le pregunta a Mercado Pago, y la comisión deja de recalcularse

**Files:**
- Create: `apps/fotoffice/app/api/payments/mp/cursos-webhook/route.ts`
- Delete: `apps/fotoffice/app/api/payments/mercadopago/webhook/route.ts`
- Modify: `apps/fotoffice/lib/presential-courses/enrollment-workflow.ts:43-70`
- Create: `apps/fotoffice/lib/presential-courses/enrollment-fee.test.ts`
- Reference: `apps/fotoffice/app/api/payments/mp/reservas-webhook/route.ts` (el patrón)

**Interfaces:**
- Consumes: `parseCourseExternalReference` (Task 1), `resolveWorkspaceCollector`.
- Produces: `approveCourseEnrollment` conserva su firma, pero **ya no lee**
  `courseSalesWorkspaceSettings.coursesFeePercent`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// apps/fotoffice/lib/presential-courses/enrollment-fee.test.ts
import { describe, expect, it } from "vitest";
import { Prisma } from "@repo/db";
import { recalcularReparto } from "./enrollment-workflow";

describe("la comisión no cambia después del pago", () => {
  it("usa el porcentaje congelado en la inscripción, no uno nuevo", () => {
    const r = recalcularReparto({
      montoCobrado: new Prisma.Decimal("100000"),
      feePercentCongelado: new Prisma.Decimal("5"),
    });
    expect(r.fee.toString()).toBe("5000");
    expect(r.net.toString()).toBe("95000");
  });

  it("si Mercado Pago acredita menos, se reparte ese monto con el mismo porcentaje", () => {
    const r = recalcularReparto({
      montoCobrado: new Prisma.Decimal("80000"),
      feePercentCongelado: new Prisma.Decimal("5"),
    });
    expect(r.fee.toString()).toBe("4000");
    expect(r.net.toString()).toBe("76000");
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/presential-courses/enrollment-fee.test.ts`
Expected: FAIL — `recalcularReparto` no existe.

- [ ] **Step 3: Implementarla y usarla en la aprobación**

En `enrollment-workflow.ts`, agregar la función exportada y **borrar** la consulta a
`courseSalesWorkspaceSettings`:

```ts
export function recalcularReparto(input: {
  montoCobrado: Prisma.Decimal;
  feePercentCongelado: Prisma.Decimal;
}): { fee: Prisma.Decimal; net: Prisma.Decimal } {
  const fee = input.montoCobrado
    .mul(input.feePercentCongelado)
    .div(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return { fee, net: input.montoCobrado.minus(fee).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP) };
}
```

Y en `approveCourseEnrollment`, reemplazar el bloque que lee `settings?.coursesFeePercent` por:

```ts
const amount = args.amountArs != null
  ? new Prisma.Decimal(args.amountArs.toFixed(2))
  : enrollment.amountArs;
const { fee, net } = recalcularReparto({
  montoCobrado: amount,
  feePercentCongelado: enrollment.platformFeePercent,
});
```

Quitar `platformFeePercent` del `data:` del `updateMany` — el porcentaje congelado no se toca.

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `pnpm --filter fotoffice test lib/presential-courses`
Expected: PASS.

- [ ] **Step 5: Escribir el webhook nuevo**

Copiar la estructura de `reservas-webhook/route.ts`: responde siempre 200, no confía en el cuerpo,
resuelve el token por los workspaces con inscripciones pendientes, le pregunta a Mercado Pago por
el pago y, si vino aprobado y la referencia externa es de un curso, llama a
`approveCourseEnrollment({ enrollmentId, paymentRef, amountArs })`. Si vino rechazado o cancelado,
marca la inscripción con `updateMany` filtrando por `paymentStatus: "PENDING"`.

- [ ] **Step 6: Borrar el webhook viejo**

```bash
git rm apps/fotoffice/app/api/payments/mercadopago/webhook/route.ts
```

- [ ] **Step 7: Verificar que no quedan variables fantasma**

Run: `grep -rn "MP_WEBHOOK_SECRET\|coursesFeePercent" apps/fotoffice --include=*.ts --include=*.tsx`
Expected: sólo el comentario de campo deprecado en el esquema de Prisma, fuera de esta app.

- [ ] **Step 8: Commit**

```bash
git add -A apps/fotoffice
git commit -m "Acreditar la inscripción preguntándole a Mercado Pago"
```

---

## Etapa 1 — Que un curso pueda ser grabado

### Task 4: Modalidad del curso y tabla de clases

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260921120000_cursos_grabados/migration.sql`
- Create: `apps/fotoffice/lib/presential-courses/delivery-mode.ts`
- Create: `apps/fotoffice/lib/presential-courses/delivery-mode.test.ts`

**Interfaces:**
- Produces:
  - `enum CourseDeliveryMode { PRESENCIAL, LIVE, RECORDED }`
  - `validarModalidad(input: { deliveryMode: CourseDeliveryMode; tieneEdicion: boolean }): { ok: true } | { ok: false; error: string }`

- [ ] **Step 1: Escribir el test que falla**

```ts
// apps/fotoffice/lib/presential-courses/delivery-mode.test.ts
import { describe, expect, it } from "vitest";
import { validarModalidad } from "./delivery-mode";

describe("qué puede colgar de cada modalidad", () => {
  it("un curso presencial necesita al menos una edición", () => {
    expect(validarModalidad({ deliveryMode: "PRESENCIAL", tieneEdicion: false })).toEqual({
      ok: false,
      error: "Un curso presencial necesita al menos una edición con fecha y lugar.",
    });
  });

  it("un curso grabado no admite ediciones", () => {
    expect(validarModalidad({ deliveryMode: "RECORDED", tieneEdicion: true })).toEqual({
      ok: false,
      error: "Un curso grabado no tiene ediciones: se organiza en clases.",
    });
  });

  it("presencial con edición y grabado sin ediciones son válidos", () => {
    expect(validarModalidad({ deliveryMode: "PRESENCIAL", tieneEdicion: true })).toEqual({ ok: true });
    expect(validarModalidad({ deliveryMode: "RECORDED", tieneEdicion: false })).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/presential-courses/delivery-mode.test.ts`
Expected: FAIL — no existe el módulo.

- [ ] **Step 3: Implementar la validación**

```ts
// apps/fotoffice/lib/presential-courses/delivery-mode.ts
export type CourseDeliveryMode = "PRESENCIAL" | "LIVE" | "RECORDED";

export function validarModalidad(input: {
  deliveryMode: CourseDeliveryMode;
  tieneEdicion: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (input.deliveryMode === "RECORDED" && input.tieneEdicion) {
    return { ok: false, error: "Un curso grabado no tiene ediciones: se organiza en clases." };
  }
  if (input.deliveryMode !== "RECORDED" && !input.tieneEdicion) {
    return {
      ok: false,
      error: "Un curso presencial necesita al menos una edición con fecha y lugar.",
    };
  }
  return { ok: true };
}
```

El mensaje del caso `LIVE` sin edición dice "presencial" a propósito: en pantalla ese curso
también carga encuentros con fecha, y el texto se ajusta cuando la etapa de cursos en vivo exista.

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `pnpm --filter fotoffice test lib/presential-courses/delivery-mode.test.ts`
Expected: PASS (4 assertions).

- [ ] **Step 5: Escribir el SQL de la migración**

```sql
-- packages/db/prisma/migrations/20260921120000_cursos_grabados/migration.sql
CREATE TYPE "CourseDeliveryMode" AS ENUM ('PRESENCIAL', 'LIVE', 'RECORDED');
CREATE TYPE "CourseLessonVideoStatus" AS ENUM ('PENDING', 'UPLOADING', 'PROCESSING', 'READY', 'ERROR');

ALTER TABLE "Course" ADD COLUMN "deliveryMode" "CourseDeliveryMode" NOT NULL DEFAULT 'PRESENCIAL';
ALTER TABLE "Course" ADD COLUMN "priceArs" DECIMAL(12,2);
ALTER TABLE "Course" ADD COLUMN "accessMonths" INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "Course" ADD COLUMN "completionPercent" INTEGER NOT NULL DEFAULT 80;

ALTER TABLE "CourseEnrollment" ALTER COLUMN "courseInstanceId" DROP NOT NULL;

CREATE TABLE "CourseLesson" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER,
    "videoProvider" TEXT NOT NULL DEFAULT 'cloudflare_stream',
    "videoUid" TEXT,
    "videoStatus" "CourseLessonVideoStatus" NOT NULL DEFAULT 'PENDING',
    "thumbnailUrl" TEXT,
    "isPreview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CourseLesson_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CourseLesson_courseId_sortOrder_idx" ON "CourseLesson"("courseId", "sortOrder");
CREATE UNIQUE INDEX "CourseLesson_videoUid_key" ON "CourseLesson"("videoUid");
ALTER TABLE "CourseLesson" ADD CONSTRAINT "CourseLesson_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CourseLessonAttachment" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseLessonAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CourseLessonAttachment_lessonId_idx" ON "CourseLessonAttachment"("lessonId");
ALTER TABLE "CourseLessonAttachment" ADD CONSTRAINT "CourseLessonAttachment_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 6: Reflejar lo mismo en `schema.prisma`**

Agregar los dos enums, los cuatro campos de `Course` (con `priceArs Decimal? @db.Decimal(12, 2)`),
poner `courseInstanceId String?` y su relación opcional en `CourseEnrollment`, y los modelos
`CourseLesson` y `CourseLessonAttachment` con las mismas columnas, índices y cascadas.

- [ ] **Step 7: Verificar que el esquema compila**

Run: `pnpm --filter @repo/db exec prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 8: Commit**

```bash
git add packages/db/prisma apps/fotoffice/lib/presential-courses/delivery-mode.ts apps/fotoffice/lib/presential-courses/delivery-mode.test.ts
git commit -m "Dar modalidad al curso y darle clases al grabado"
```

**Aplicación en las cinco bases:** no forma parte de esta tarea. Queda anotada como criterio del
tablero de estado de obra y se hace a mano, registrando el checksum.

### Task 5: Cliente de Cloudflare Stream

**Files:**
- Create: `apps/fotoffice/lib/courses-video/stream.ts`
- Create: `apps/fotoffice/lib/courses-video/stream.test.ts`
- Create: `apps/fotoffice/lib/courses-video/config.ts`
- Create: `apps/fotoffice/lib/courses-video/config.test.ts`

**Interfaces:**
- Produces:
  - `readStreamConfig(env?): { ok: true; config: StreamConfig } | { ok: false; missing: string[] }`
  - `createDirectUpload(input: { maxDurationSeconds: number }): Promise<{ uid: string; uploadUrl: string }>`
  - `getVideoStatus(uid: string): Promise<{ status: "PROCESSING" | "READY" | "ERROR"; durationSeconds: number | null; thumbnailUrl: string | null }>`
  - `signPlaybackToken(input: { uid: string; expiresInSeconds: number }): Promise<string>`

- [ ] **Step 1: Escribir el test de configuración**

```ts
// apps/fotoffice/lib/courses-video/config.test.ts
import { describe, expect, it } from "vitest";
import { readStreamConfig } from "./config";

describe("configuración de video", () => {
  it("dice exactamente qué falta, sin lanzar", () => {
    const r = readStreamConfig({});
    expect(r).toEqual({
      ok: false,
      missing: ["STREAM_ACCOUNT_ID", "STREAM_API_TOKEN", "STREAM_SIGNING_KEY_ID", "STREAM_SIGNING_KEY_PEM"],
    });
  });

  it("con las cuatro cargadas queda configurada", () => {
    const r = readStreamConfig({
      STREAM_ACCOUNT_ID: "cuenta",
      STREAM_API_TOKEN: "token",
      STREAM_SIGNING_KEY_ID: "clave",
      STREAM_SIGNING_KEY_PEM: "pem",
    });
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/courses-video/config.test.ts`
Expected: FAIL — no existe `./config`.

- [ ] **Step 3: Implementar la configuración**

Mismo criterio que `lib/payments/connect/config.ts`: junta los faltantes y los devuelve, nunca
lanza.

```ts
export type StreamConfig = {
  accountId: string;
  apiToken: string;
  signingKeyId: string;
  signingKeyPem: string;
};

const VARS = [
  "STREAM_ACCOUNT_ID",
  "STREAM_API_TOKEN",
  "STREAM_SIGNING_KEY_ID",
  "STREAM_SIGNING_KEY_PEM",
] as const;

export function readStreamConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): { ok: true; config: StreamConfig } | { ok: false; missing: string[] } {
  const missing = VARS.filter((v) => !env[v]?.trim());
  if (missing.length > 0) return { ok: false, missing: [...missing] };
  return {
    ok: true,
    config: {
      accountId: env.STREAM_ACCOUNT_ID!.trim(),
      apiToken: env.STREAM_API_TOKEN!.trim(),
      signingKeyId: env.STREAM_SIGNING_KEY_ID!.trim(),
      signingKeyPem: env.STREAM_SIGNING_KEY_PEM!.trim(),
    },
  };
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `pnpm --filter fotoffice test lib/courses-video/config.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Escribir el test del cliente con `fetch` simulado**

```ts
// apps/fotoffice/lib/courses-video/stream.test.ts
import { describe, expect, it, vi } from "vitest";
import { createDirectUpload, getVideoStatus } from "./stream";

const config = {
  accountId: "cuenta",
  apiToken: "token",
  signingKeyId: "clave",
  signingKeyPem: "pem",
};

describe("subida directa", () => {
  it("pide la URL de una sola vez y exige firma para reproducir", async () => {
    const fetchSimulado = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { uid: "video-1", uploadURL: "https://upload" } }),
    });
    const r = await createDirectUpload(
      { maxDurationSeconds: 7200 },
      { config, fetchImpl: fetchSimulado as unknown as typeof fetch },
    );
    expect(r).toEqual({ uid: "video-1", uploadUrl: "https://upload" });

    const [, init] = fetchSimulado.mock.calls[0];
    const cuerpo = JSON.parse(String(init.body));
    expect(cuerpo.requireSignedURLs).toBe(true);
    expect(cuerpo.allowedOrigins).toContain("fotoffice.com");
  });
});

describe("estado del video", () => {
  it("traduce el estado de Cloudflare al nuestro", async () => {
    const fetchSimulado = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          status: { state: "ready" },
          duration: 612.4,
          thumbnail: "https://thumb",
        },
      }),
    });
    const r = await getVideoStatus("video-1", {
      config,
      fetchImpl: fetchSimulado as unknown as typeof fetch,
    });
    expect(r).toEqual({ status: "READY", durationSeconds: 612, thumbnailUrl: "https://thumb" });
  });
});
```

- [ ] **Step 6: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/courses-video/stream.test.ts`
Expected: FAIL — no existe `./stream`.

- [ ] **Step 7: Implementar el cliente**

Las dependencias entran por parámetro (`config`, `fetchImpl`) para poder probarlo sin red. Los
valores por defecto salen de `readStreamConfig()` y de `globalThis.fetch`. `createDirectUpload`
hace `POST /client/v4/accounts/{accountId}/stream/direct_upload` con
`{ maxDurationSeconds, requireSignedURLs: true, allowedOrigins: ["fotoffice.com"] }`;
`getVideoStatus` hace `GET .../stream/{uid}` y traduce `ready`→`READY`, `error`→`ERROR` y
cualquier otro estado a `PROCESSING`, redondeando la duración hacia abajo.

- [ ] **Step 8: Correr los tests y verlos pasar**

Run: `pnpm --filter fotoffice test lib/courses-video`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
git add apps/fotoffice/lib/courses-video
git commit -m "Hablar con Cloudflare Stream para subir y consultar un video"
```

### Task 6: Acciones del panel para las clases

**Files:**
- Create: `apps/fotoffice/app/actions/course-lessons.ts`
- Create: `apps/fotoffice/app/actions/course-lessons.test.ts`
- Create: `apps/fotoffice/app/api/cursos/clases/upload-url/route.ts`

**Interfaces:**
- Consumes: `requireCoursesSalesContext()`, `createDirectUpload`, `getVideoStatus`,
  `validarModalidad`.
- Produces: `crearClase`, `actualizarClase`, `reordenarClases`, `borrarClase`,
  `refrescarEstadoDeVideo`, todas con el patrón `{ error: string | null; ok?: boolean }` que ya usa
  `presential-courses.ts`.

- [ ] **Step 1: Escribir el test del orden**

Reordenar es la única lógica con riesgo real: hay que garantizar que no queden dos clases con el
mismo número ni huecos.

```ts
// apps/fotoffice/app/actions/course-lessons.test.ts
import { describe, expect, it } from "vitest";
import { calcularNuevoOrden } from "./course-lessons";

describe("reordenar clases", () => {
  it("mover la tercera al primer lugar renumera sin huecos ni repetidos", () => {
    const r = calcularNuevoOrden(["a", "b", "c", "d"], "c", 0);
    expect(r).toEqual([
      { id: "c", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
      { id: "d", sortOrder: 3 },
    ]);
  });

  it("una clase que no está en la lista no cambia nada", () => {
    expect(calcularNuevoOrden(["a", "b"], "z", 0)).toEqual([
      { id: "a", sortOrder: 0 },
      { id: "b", sortOrder: 1 },
    ]);
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test app/actions/course-lessons.test.ts`
Expected: FAIL — no existe el módulo.

- [ ] **Step 3: Implementar `calcularNuevoOrden` y las acciones**

```ts
export function calcularNuevoOrden(
  idsActuales: string[],
  idMovido: string,
  destino: number,
): Array<{ id: string; sortOrder: number }> {
  const sinEl = idsActuales.filter((id) => id !== idMovido);
  if (sinEl.length === idsActuales.length) {
    return idsActuales.map((id, i) => ({ id, sortOrder: i }));
  }
  const posicion = Math.max(0, Math.min(destino, sinEl.length));
  sinEl.splice(posicion, 0, idMovido);
  return sinEl.map((id, i) => ({ id, sortOrder: i }));
}
```

Las acciones validan con zod (título 1..200, descripción hasta 5.000), verifican con
`assertWorkspaceCourse` que el curso sea del workspace —misma función que ya usa
`presential-courses.ts`— y escriben con `prisma.courseLesson`. `reordenarClases` aplica el
resultado en una transacción.

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `pnpm --filter fotoffice test app/actions/course-lessons.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: La ruta que entrega la URL de subida**

`POST /api/cursos/clases/upload-url` con `{ lessonId }`: exige sesión y módulo con
`requireCoursesSalesContext()`, verifica que la clase pertenezca al workspace, llama a
`createDirectUpload({ maxDurationSeconds: 4 * 60 * 60 })`, guarda el `uid` y deja la clase en
`UPLOADING`. Devuelve `{ uploadUrl }`. **El archivo no pasa por acá**: el navegador sube contra esa
URL.

Si `readStreamConfig()` devuelve `ok: false`, responde 503 con
`{ error: "La carga de video no está configurada.", missing }`.

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/app/actions/course-lessons.ts apps/fotoffice/app/actions/course-lessons.test.ts apps/fotoffice/app/api/cursos/clases/upload-url
git commit -m "Cargar, ordenar y borrar las clases de un curso grabado"
```

### Task 7: La sección Clases en el panel

**Files:**
- Create: `apps/fotoffice/components/presential-courses/course-lessons-section.tsx`
- Create: `apps/fotoffice/components/presential-courses/lesson-upload-field.tsx`
- Modify: `apps/fotoffice/app/(shell)/dashboard/courses/[courseId]/page.tsx`
- Modify: `apps/fotoffice/components/presential-courses/course-editor-form.tsx`

**Interfaces:**
- Consumes: las acciones de la Task 6.
- Produces: nada que consuman tareas posteriores.

- [ ] **Step 1: Selector de modalidad en el editor del curso**

En `course-editor-form.tsx`, agregar el campo Modalidad con las tres opciones — Presencial, En
vivo, Grabado — y mostrar precio, meses de acceso y porcentaje de finalización sólo cuando es
Grabado.

- [ ] **Step 2: La sección de clases**

En la página del curso, cuando `course.deliveryMode === "RECORDED"`, reemplazar la sección
"Ediciones" por "Clases": lista ordenable, título, duración, estado del video con su etiqueta
("Procesando…", "Lista", "Error"), y la marca de clase de muestra.

Seguir las clases de estilo del repositorio (`fo-card`, `fo-btn`, `fo-label`) y los grillados
`dnx-grid-N`, no los breakpoints de Tailwind: al lado de un menú lateral los breakpoints miden la
ventana, no la columna.

- [ ] **Step 3: El campo de subida**

Componente cliente: pide la URL a `/api/cursos/clases/upload-url`, sube con `XMLHttpRequest` para
poder mostrar el progreso, y al terminar llama a `refrescarEstadoDeVideo`. Mientras el estado sea
`PROCESSING`, vuelve a consultar cada 10 segundos.

- [ ] **Step 4: Verificación manual**

Run: `pnpm --filter fotoffice dev` y abrir `/dashboard/courses/<id>` con un curso en modalidad
Grabado. Con las variables de Stream sin cargar, la sección debe explicar qué falta y no romper.

- [ ] **Step 5: Correr toda la batería y el lint**

Run: `pnpm --filter fotoffice test && pnpm --filter fotoffice lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/components/presential-courses apps/fotoffice/app/\(shell\)/dashboard/courses
git commit -m "Mostrar las clases del curso grabado en el panel"
```

---

## Lo que queda para el plan siguiente

Etapas 2, 3 y 4 del spec: acceso del alumno con su enlace, reproductor firmado con marca de agua,
registro de avance, consultas por clase y certificado por porcentaje visto. Se planifican cuando
las etapas 0 y 1 estén andando, porque el reproductor depende de cómo haya quedado el acceso.
