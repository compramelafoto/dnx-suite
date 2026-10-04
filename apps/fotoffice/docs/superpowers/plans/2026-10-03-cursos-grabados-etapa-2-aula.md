# Cursos grabados — Etapa 2: el aula del alumno

> **Para quien lo ejecute:** REQUIRED SUB-SKILL: usá `superpowers:subagent-driven-development`
> (recomendado) o `superpowers:executing-plans`. Los pasos usan casillas (`- [ ]`) para
> seguimiento.

**Goal:** que un alumno pague un curso grabado, reciba por correo el enlace a su aula, mire las
clases con el video protegido y marca de agua, y que su avance quede registrado.

**Architecture:** al aprobarse el pago de una inscripción sin edición, se crea un `CourseAccess`
con un token (crudo una sola vez, en el correo; en la base sólo su SHA-256, igual que la
invitación del socio). El aula vive en `/aula/[token]`, siempre en el dominio de FOTOFFICE. Cada
vez que se abre una clase, el servidor firma un permiso de reproducción de 2 horas para ese
video (JWT RS256 con `node:crypto`, sin dependencias nuevas). El reproductor de Cloudflare Stream
va en un iframe con una marca de agua encima, e informa el avance cada 15 segundos a una ruta que
nunca suma más de lo que pudo pasar en tiempo real.

**Tech Stack:** Next 16 (App Router, `params` como `Promise`), Prisma sobre Postgres (Neon),
vitest, Cloudflare Stream (iframe + SDK del reproductor), Resend vía
`lib/communications/send-email`.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-09-21-cursos-grabados-design.md`
(secciones 4, 5, 7 y la fila "2" de la sección 13). Plan anterior, ya en `main`:
`apps/fotoffice/docs/superpowers/plans/2026-09-21-cursos-grabados-etapas-0-y-1.md`.

## Global Constraints

- Idioma de todo lo visible y de los comentarios: **español**. Los identificadores, en inglés o
  español, según el archivo que se toque (los de `lib/courses-video` y `lib/presential-courses`
  mezclan; seguí el estilo del archivo).
- Antes de escribir código de Next, leé la guía que corresponda en `node_modules/next/dist/docs/`
  (lo exige `apps/fotoffice/AGENTS.md`). En esta versión `params` y `searchParams` son `Promise`.
- Comando de test: `pnpm --filter fotoffice test`. Un solo archivo:
  `pnpm --filter fotoffice test <ruta>`. Vitest sólo levanta `lib/**/*.test.ts` y
  `app/**/*.test.ts`.
- **Ninguna dependencia nueva.** El lockfile es compartido por toda la suite y una dependencia
  nueva ya rompió otras apps. La firma JWT se hace con `node:crypto`.
- Fechas visibles para el alumno: **hora argentina** (`timeZone: "America/Argentina/Buenos_Aires"`)
  y montos en **pesos**.
- El esquema de Prisma es uno solo para cinco bases Neon y el despliegue **no** corre
  `prisma migrate deploy`: la migración se aplica con `packages/db/scripts/migraciones-cinco-bases.mts`.
- Ninguna variable nueva puede romper lo que anda: si faltan las `STREAM_*`, la clase dice
  "El video no está disponible en este momento" y el resto del aula sigue funcionando.
- La marca de agua **disuade, no impide** (spec, sección 4). No escribir en ninguna pantalla que
  el video "no se puede copiar".
- Trabajar en un worktree propio (las sesiones comparten el índice de git del repo). En un
  worktree, el servidor de desarrollo se levanta con `next dev --webpack`.

---

## Hallazgo que cambia el orden

**Hoy un curso grabado no se puede comprar.** `app/actions/public-course-enrollment.ts` exige
`courseInstanceId` (`z.string().min(1)`) y toma el precio de la edición; la página pública
`app/w/[workspaceSlug]/cursos/[courseSlug]/page.tsx` sólo lista ediciones. El cobro de la etapa 0
y el `approveCourseEnrollment` sin edición existen, pero nadie puede llegar hasta ahí. Por eso la
Task 5 va antes de otorgar el acceso.

Además, `approveCourseEnrollment` aprueba un grabado **sin mandar nada** (registra
`aprobada_sin_aviso_por_ser_grabado`). La Task 6 reemplaza ese hueco.

## Decisiones de este plan (no están en la spec)

| Decisión | Por qué |
|---|---|
| El aula vive siempre en el dominio de FOTOFFICE (`APP_URL`), nunca en el dominio propio de la institución | Los videos se crean con `allowedOrigins: ["fotoffice.com"]`. En `sfpr.com.ar` el reproductor se negaría |
| Un token por acceso: el enlace abre **ese** curso. "Mis cursos" con varios cursos queda para cuando exista el alumno como persona | Sin cuenta, juntar cursos por correo dejaría que un enlace filtrado muestre todos los cursos de esa persona |
| "¿Perdiste el enlace?" en `/aula/recuperar`: genera un enlace nuevo y lo manda al correo de la inscripción | Sin contraseña, perder el correo es perder el curso pagado. El enlace viejo deja de servir |
| Pantalla completa propia (del contenedor) y sin picture-in-picture | La pantalla completa del iframe y el PiP dejan la marca de agua afuera |
| Registro de reproducciones = un evento de log con el origen hasheado | La spec pide registrar; el aviso de cuenta compartida necesita una tabla y una pantalla que no son de esta etapa |
| Los materiales de la clase no entran | El panel todavía no permite subirlos (`app/actions/course-lessons.ts` no los toca). Subida y descarga van juntas en otra etapa |
| Si la institución apaga el módulo, el alumno conserva el aula | Ya pagó |

## Estructura de archivos

**Nuevos:**

| Archivo | Responsabilidad |
|---|---|
| `packages/db/prisma/migrations/20261004120000_cursos_aula_alumno/migration.sql` | `CourseAccess` y `CourseLessonProgress` |
| `apps/fotoffice/lib/course-classroom/access-rules.ts` (+ test) | Vencimiento, estado del acceso, número de inscripción, fecha argentina |
| `apps/fotoffice/lib/course-classroom/progress-rules.ts` (+ test) | Cuánto suma cada reporte de avance y cuándo una clase está completa |
| `apps/fotoffice/lib/course-classroom/aula.ts` (+ test) | Arma la lista de clases con su estado, el porcentaje y desde dónde retomar |
| `apps/fotoffice/lib/course-classroom/report-schema.ts` (+ test) | Valida el cuerpo del reporte de avance |
| `apps/fotoffice/lib/course-classroom/watermark.ts` (+ test) | Texto y posición de la marca de agua |
| `apps/fotoffice/lib/course-classroom/email.ts` (+ test) | Correo con el enlace al aula |
| `apps/fotoffice/lib/course-classroom/grant.ts` (+ test) | Crear el acceso y avisar; reenviar el enlace |
| `apps/fotoffice/lib/course-classroom/lookup.ts` | Buscar el acceso por token (sólo servidor) |
| `apps/fotoffice/lib/presential-courses/enrollment-target.ts` (+ test) | Qué edición y qué precio corresponden a una inscripción, según la modalidad |
| `apps/fotoffice/components/presential-courses/recorded-course-section.tsx` | La parte de venta de un curso grabado en la página pública |
| `apps/fotoffice/components/course-classroom/lesson-player.tsx` | Reproductor con marca de agua y reporte de avance |
| `apps/fotoffice/app/aula/[token]/page.tsx` | Lista de clases y avance |
| `apps/fotoffice/app/aula/[token]/clase/[lessonId]/page.tsx` | La clase: video y descripción |
| `apps/fotoffice/app/aula/recuperar/page.tsx` + `form.tsx` | Pedir el enlace de nuevo |
| `apps/fotoffice/app/actions/course-classroom.ts` | Acción del formulario de recuperar |
| `apps/fotoffice/app/api/aula/[token]/avance/route.ts` | Recibe los reportes de avance |
| `apps/fotoffice/app/w/[workspaceSlug]/cursos/[courseSlug]/muestra/[lessonId]/page.tsx` | Clase de muestra gratuita |

**Modificados:** `packages/db/prisma/schema.prisma`, `lib/courses-video/stream.ts` (+ test),
`app/actions/public-course-enrollment.ts`, `components/presential-courses/public-course-enrollment-form.tsx`,
`app/w/[workspaceSlug]/cursos/[courseSlug]/page.tsx`, `lib/presential-courses/enrollment-workflow.ts`,
`app/w/[workspaceSlug]/cursos/[courseSlug]/inscripcion/success/page.tsx`,
`lib/entrada/institution-shortcut.ts`.

Todas las rutas de `apps/fotoffice/...` de aquí en adelante se escriben relativas a `apps/fotoffice/`.

---

### Task 1: Modelo de datos — acceso y avance

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelos `Workspace`, `Course` ~línea 9044,
  `CourseLesson` ~9085, `CourseEnrollment` ~9141)
- Create: `packages/db/prisma/migrations/20261004120000_cursos_aula_alumno/migration.sql`

**Interfaces:**
- Produces: modelos Prisma `CourseAccess` y `CourseLessonProgress` con exactamente estos campos
  (las tareas siguientes los usan por nombre): `CourseAccess { id, workspaceId, courseId,
  enrollmentId (único), grantedAt, expiresAt, tokenHash (único), revokedAt?, createdAt, updatedAt }`
  y `CourseLessonProgress { id, accessId, lessonId, secondsWatched, lastPositionSeconds,
  lastReportAt?, completedAt?, createdAt, updatedAt }` con único compuesto `accessId_lessonId`.
  Relaciones inversas: `CourseEnrollment.access`, `Course.accesses`, `CourseLesson.progress`,
  `Workspace.courseAccesses`, `CourseAccess.progress`.

- [ ] **Step 1: Agregar los dos modelos después de `CourseLessonAttachment`**

```prisma
/// Quién compró un curso grabado y hasta cuándo puede verlo.
///
/// El enlace del aula es la única credencial del alumno: no tiene cuenta ni contraseña. Por eso
/// en la base queda sólo el SHA-256 del token (`tokenHash`); el crudo viaja una sola vez, en el
/// correo. Mismo patrón que la invitación del socio.
model CourseAccess {
  id           String                 @id @default(cuid())
  workspaceId  String
  courseId     String
  /// Una inscripción pagada da un solo acceso. El único evita duplicarlo si el aviso de Mercado
  /// Pago y la vuelta del checkout llegan a la vez.
  enrollmentId String                 @unique
  grantedAt    DateTime               @default(now())
  expiresAt    DateTime
  tokenHash    String                 @unique
  revokedAt    DateTime?
  createdAt    DateTime               @default(now())
  updatedAt    DateTime               @updatedAt
  workspace    Workspace              @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  course       Course                 @relation(fields: [courseId], references: [id], onDelete: Cascade)
  enrollment   CourseEnrollment       @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  progress     CourseLessonProgress[]

  @@index([workspaceId, courseId])
}

/// Cuánto vio un alumno de una clase.
///
/// `secondsWatched` es tiempo **mirado**, no la posición: arrastrar la barra al final no suma.
/// La regla vive en `lib/course-classroom/progress-rules.ts`, con test.
model CourseLessonProgress {
  id                  String       @id @default(cuid())
  accessId            String
  lessonId            String
  secondsWatched      Int          @default(0)
  /// Para retomar donde quedó.
  lastPositionSeconds Int          @default(0)
  /// Cuándo llegó el último reporte. Con esto el servidor sabe cuánto pudo mirar de verdad.
  lastReportAt        DateTime?
  completedAt         DateTime?
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt
  access              CourseAccess @relation(fields: [accessId], references: [id], onDelete: Cascade)
  lesson              CourseLesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@unique([accessId, lessonId])
  @@index([lessonId])
}
```

- [ ] **Step 2: Agregar las relaciones inversas**

En `model Workspace`, junto a `courseEnrollments CourseEnrollment[]`:

```prisma
  courseAccesses              CourseAccess[]
```

En `model Course`, debajo de `enrollments CourseEnrollment[]`:

```prisma
  accesses              CourseAccess[]
```

En `model CourseLesson`, debajo de `attachments CourseLessonAttachment[]`:

```prisma
  progress        CourseLessonProgress[]
```

En `model CourseEnrollment`, debajo de `courseInstance CourseInstance? ...`:

```prisma
  access                 CourseAccess?
```

- [ ] **Step 3: Validar el esquema y regenerar el cliente**

Run (desde `packages/db`): `pnpm exec prisma validate && pnpm exec prisma format && pnpm exec prisma generate`
Expected: `The schema at prisma/schema.prisma is valid` y el cliente generado sin errores.

- [ ] **Step 4: Generar el SQL contra el esquema anterior, no desde cero**

Las migraciones del repo no se reproducen desde una base vacía; el SQL se arma comparando con el
esquema de `origin/main`:

```bash
git show origin/main:packages/db/prisma/schema.prisma > /tmp/schema-anterior.prisma
pnpm exec prisma migrate diff --from-schema-datamodel /tmp/schema-anterior.prisma --to-schema-datamodel prisma/schema.prisma --script
```

Expected: el SQL debe ser **exactamente** este (si aparece algo más, alguien tocó el esquema en
otra rama: no lo incluyas y avisá):

```sql
-- CreateTable
CREATE TABLE "CourseAccess" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseLessonProgress" (
    "id" TEXT NOT NULL,
    "accessId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "secondsWatched" INTEGER NOT NULL DEFAULT 0,
    "lastPositionSeconds" INTEGER NOT NULL DEFAULT 0,
    "lastReportAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseLessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseAccess_enrollmentId_key" ON "CourseAccess"("enrollmentId");
CREATE UNIQUE INDEX "CourseAccess_tokenHash_key" ON "CourseAccess"("tokenHash");
CREATE INDEX "CourseAccess_workspaceId_courseId_idx" ON "CourseAccess"("workspaceId", "courseId");
CREATE UNIQUE INDEX "CourseLessonProgress_accessId_lessonId_key" ON "CourseLessonProgress"("accessId", "lessonId");
CREATE INDEX "CourseLessonProgress_lessonId_idx" ON "CourseLessonProgress"("lessonId");

-- AddForeignKey
ALTER TABLE "CourseAccess" ADD CONSTRAINT "CourseAccess_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseAccess" ADD CONSTRAINT "CourseAccess_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseAccess" ADD CONSTRAINT "CourseAccess_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CourseEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseLessonProgress" ADD CONSTRAINT "CourseLessonProgress_accessId_fkey" FOREIGN KEY ("accessId") REFERENCES "CourseAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseLessonProgress" ADD CONSTRAINT "CourseLessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Guardalo en `packages/db/prisma/migrations/20261004120000_cursos_aula_alumno/migration.sql`.
**No** la apliques todavía: se aplica en la Task 12, en las cinco bases a la vez.

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20261004120000_cursos_aula_alumno
git commit -m "Cursos grabados: tablas de acceso al aula y avance por clase"
```

---

### Task 2: Reglas del acceso

**Files:**
- Create: `lib/course-classroom/access-rules.ts`
- Test: `lib/course-classroom/access-rules.test.ts`

**Interfaces:**
- Produces:
  - `calcularVencimiento(desde: Date, meses: number): Date`
  - `type EstadoAcceso = "VIGENTE" | "VENCIDO" | "REVOCADO"`
  - `estadoDelAcceso(acceso: { expiresAt: Date; revokedAt: Date | null }, ahora: Date): EstadoAcceso`
  - `numeroDeInscripcion(enrollmentId: string): string`
  - `fechaLegibleArgentina(fecha: Date): string`

- [ ] **Step 1: Escribir el test que falla**

```ts
// lib/course-classroom/access-rules.test.ts
import { describe, expect, it } from "vitest";
import {
  calcularVencimiento,
  estadoDelAcceso,
  fechaLegibleArgentina,
  numeroDeInscripcion,
} from "./access-rules";

describe("vencimiento del acceso", () => {
  it("doce meses desde la compra", () => {
    const desde = new Date(Date.UTC(2026, 9, 3, 15));
    expect(calcularVencimiento(desde, 12).toISOString()).toBe("2027-10-03T15:00:00.000Z");
  });

  it("un 31 más un mes cae en el último día del mes siguiente, no en marzo", () => {
    const desde = new Date(Date.UTC(2026, 0, 31, 10));
    expect(calcularVencimiento(desde, 1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
  });

  it("un valor absurdo de meses no deja un acceso que vence al comprarlo", () => {
    const desde = new Date(Date.UTC(2026, 9, 3));
    expect(calcularVencimiento(desde, 0).toISOString()).toBe("2026-11-03T00:00:00.000Z");
  });
});

describe("estado del acceso", () => {
  const vence = new Date(Date.UTC(2027, 9, 3));

  it("vigente antes del vencimiento", () => {
    expect(estadoDelAcceso({ expiresAt: vence, revokedAt: null }, new Date(Date.UTC(2027, 9, 2)))).toBe("VIGENTE");
  });

  it("vencido desde el instante del vencimiento", () => {
    expect(estadoDelAcceso({ expiresAt: vence, revokedAt: null }, vence)).toBe("VENCIDO");
  });

  it("revocado gana aunque no haya vencido", () => {
    expect(
      estadoDelAcceso({ expiresAt: vence, revokedAt: new Date(Date.UTC(2026, 9, 5)) }, new Date(Date.UTC(2026, 9, 6))),
    ).toBe("REVOCADO");
  });
});

describe("número de inscripción para la marca de agua", () => {
  it("los últimos seis caracteres, en mayúsculas", () => {
    expect(numeroDeInscripcion("cmg1abcdefxyz123")).toBe("XYZ123");
  });
});

describe("fecha para el alumno", () => {
  it("en hora argentina: las 2 de la mañana UTC del 4 son todavía el 3", () => {
    expect(fechaLegibleArgentina(new Date(Date.UTC(2027, 9, 4, 2)))).toBe("3 de octubre de 2027");
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/course-classroom/access-rules.test.ts`
Expected: FAIL — `Failed to resolve import "./access-rules"`.

- [ ] **Step 3: Implementar**

```ts
// lib/course-classroom/access-rules.ts
/**
 * Reglas del acceso de un alumno a un curso grabado. Puras: sin base ni red.
 */

/**
 * Suma meses de calendario. Si el día no existe en el mes de destino (31 de enero + 1 mes),
 * cae en el último día de ese mes en vez de desbordar a marzo.
 *
 * Menos de un mes no tiene sentido: un acceso que vence al comprarlo es plata cobrada por nada.
 */
export function calcularVencimiento(desde: Date, meses: number): Date {
  const cantidad = Math.max(1, Math.floor(meses));
  const resultado = new Date(desde.getTime());
  const dia = resultado.getUTCDate();
  resultado.setUTCDate(1);
  resultado.setUTCMonth(resultado.getUTCMonth() + cantidad);
  const ultimoDia = new Date(
    Date.UTC(resultado.getUTCFullYear(), resultado.getUTCMonth() + 1, 0),
  ).getUTCDate();
  resultado.setUTCDate(Math.min(dia, ultimoDia));
  return resultado;
}

export type EstadoAcceso = "VIGENTE" | "VENCIDO" | "REVOCADO";

export function estadoDelAcceso(
  acceso: { expiresAt: Date; revokedAt: Date | null },
  ahora: Date,
): EstadoAcceso {
  if (acceso.revokedAt) return "REVOCADO";
  return ahora.getTime() < acceso.expiresAt.getTime() ? "VIGENTE" : "VENCIDO";
}

/** Corto para que entre en la marca de agua, y suficiente para encontrar la inscripción. */
export function numeroDeInscripcion(enrollmentId: string): string {
  return enrollmentId.slice(-6).toUpperCase();
}

const FECHA_ARGENTINA = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "long",
  timeZone: "America/Argentina/Buenos_Aires",
});

export function fechaLegibleArgentina(fecha: Date): string {
  return FECHA_ARGENTINA.format(fecha);
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `pnpm --filter fotoffice test lib/course-classroom/access-rules.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/course-classroom/access-rules.ts lib/course-classroom/access-rules.test.ts
git commit -m "Cursos grabados: reglas de vencimiento y estado del acceso"
```

---

### Task 3: Reglas del avance y armado del aula

**Files:**
- Create: `lib/course-classroom/progress-rules.ts`, `lib/course-classroom/aula.ts`
- Test: `lib/course-classroom/progress-rules.test.ts`, `lib/course-classroom/aula.test.ts`

**Interfaces:**
- Produces (`progress-rules.ts`):
  - `INTERVALO_REPORTE_SEGUNDOS = 15`, `UMBRAL_CLASE_COMPLETA = 0.9`
  - `type AvanceGuardado = { secondsWatched: number; lastPositionSeconds: number; lastReportAt: Date | null; completedAt: Date | null }`
  - `type ReporteDeAvance = { positionSeconds: number; watchedSinceLastReport: number }`
  - `aplicarReporte(input: { previo: AvanceGuardado | null; reporte: ReporteDeAvance; ahora: Date; duracionSegundos: number | null }): AvanceGuardado`
- Produces (`aula.ts`):
  - `type ClaseDelAula = { id: string; title: string; durationSeconds: number | null; completada: boolean; retomarDesde: number }`
  - `armarAula(lecciones: Array<{ id: string; title: string; durationSeconds: number | null; videoStatus: string; sortOrder: number }>, avances: Array<{ lessonId: string; completedAt: Date | null; lastPositionSeconds: number }>): { clases: ClaseDelAula[]; porcentaje: number }`
  - `posicionParaRetomar(posicion: number, duracion: number | null): number`
  - `duracionLegible(segundos: number | null): string`

- [ ] **Step 1: Escribir el test del avance**

```ts
// lib/course-classroom/progress-rules.test.ts
import { describe, expect, it } from "vitest";
import { aplicarReporte, type AvanceGuardado } from "./progress-rules";

const t0 = new Date(Date.UTC(2026, 9, 3, 12, 0, 0));
const mas = (segundos: number) => new Date(t0.getTime() + segundos * 1000);

describe("cuánto suma un reporte", () => {
  it("el primer reporte suma lo mirado", () => {
    const r = aplicarReporte({
      previo: null,
      reporte: { positionSeconds: 15, watchedSinceLastReport: 15 },
      ahora: t0,
      duracionSegundos: 600,
    });
    expect(r.secondsWatched).toBe(15);
    expect(r.lastPositionSeconds).toBe(15);
    expect(r.lastReportAt).toEqual(t0);
    expect(r.completedAt).toBeNull();
  });

  it("arrastrar la barra al final no marca la clase como vista", () => {
    const r = aplicarReporte({
      previo: null,
      reporte: { positionSeconds: 600, watchedSinceLastReport: 600 },
      ahora: t0,
      duracionSegundos: 600,
    });
    expect(r.secondsWatched).toBe(20); // intervalo + tolerancia, nunca más
    expect(r.completedAt).toBeNull();
  });

  it("dos reportes seguidos no suman más que el tiempo real que pasó entre ellos", () => {
    const previo: AvanceGuardado = {
      secondsWatched: 100,
      lastPositionSeconds: 100,
      lastReportAt: t0,
      completedAt: null,
    };
    const r = aplicarReporte({
      previo,
      reporte: { positionSeconds: 115, watchedSinceLastReport: 15 },
      ahora: mas(1),
      duracionSegundos: 600,
    });
    expect(r.secondsWatched).toBe(106); // 1 segundo real + 5 de tolerancia
  });

  it("valores negativos o rotos no restan ni rompen", () => {
    const r = aplicarReporte({
      previo: null,
      reporte: { positionSeconds: -4, watchedSinceLastReport: Number.NaN },
      ahora: t0,
      duracionSegundos: 600,
    });
    expect(r.secondsWatched).toBe(0);
    expect(r.lastPositionSeconds).toBe(0);
  });

  it("se completa al 90% de la duración", () => {
    const previo: AvanceGuardado = {
      secondsWatched: 530,
      lastPositionSeconds: 530,
      lastReportAt: t0,
      completedAt: null,
    };
    const r = aplicarReporte({
      previo,
      reporte: { positionSeconds: 545, watchedSinceLastReport: 15 },
      ahora: mas(15),
      duracionSegundos: 600,
    });
    expect(r.secondsWatched).toBe(545);
    expect(r.completedAt).toEqual(mas(15));
  });

  it("una clase completa no se descompleta", () => {
    const previo: AvanceGuardado = {
      secondsWatched: 600,
      lastPositionSeconds: 10,
      lastReportAt: t0,
      completedAt: t0,
    };
    const r = aplicarReporte({
      previo,
      reporte: { positionSeconds: 25, watchedSinceLastReport: 15 },
      ahora: mas(15),
      duracionSegundos: 600,
    });
    expect(r.completedAt).toEqual(t0);
    expect(r.secondsWatched).toBe(600); // tope en la duración
  });

  it("sin duración conocida suma pero no completa", () => {
    const r = aplicarReporte({
      previo: null,
      reporte: { positionSeconds: 15, watchedSinceLastReport: 15 },
      ahora: t0,
      duracionSegundos: null,
    });
    expect(r.secondsWatched).toBe(15);
    expect(r.completedAt).toBeNull();
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/course-classroom/progress-rules.test.ts`
Expected: FAIL — `Failed to resolve import "./progress-rules"`.

- [ ] **Step 3: Implementar el avance**

```ts
// lib/course-classroom/progress-rules.ts
/**
 * Cuánto vio un alumno de una clase.
 *
 * El reproductor informa cada `INTERVALO_REPORTE_SEGUNDOS` cuánto miró desde el reporte
 * anterior. El servidor **no le cree de más**: nunca suma más que el intervalo más una
 * tolerancia, ni más que el tiempo real que pasó desde el último reporte. Así arrastrar la
 * barra hasta el final, o mandar reportes a mano, no marca una clase como vista.
 */

export const INTERVALO_REPORTE_SEGUNDOS = 15;
/** Margen para la red y para el reloj del navegador. */
const TOLERANCIA_SEGUNDOS = 5;
/** Una clase está vista al 90% de su duración: nadie mira los créditos. */
export const UMBRAL_CLASE_COMPLETA = 0.9;

export type AvanceGuardado = {
  secondsWatched: number;
  lastPositionSeconds: number;
  lastReportAt: Date | null;
  completedAt: Date | null;
};

export type ReporteDeAvance = {
  positionSeconds: number;
  watchedSinceLastReport: number;
};

function numeroSano(valor: number): number {
  return Number.isFinite(valor) && valor > 0 ? valor : 0;
}

export function aplicarReporte(input: {
  previo: AvanceGuardado | null;
  reporte: ReporteDeAvance;
  ahora: Date;
  duracionSegundos: number | null;
}): AvanceGuardado {
  const previo: AvanceGuardado = input.previo ?? {
    secondsWatched: 0,
    lastPositionSeconds: 0,
    lastReportAt: null,
    completedAt: null,
  };
  const tope = INTERVALO_REPORTE_SEGUNDOS + TOLERANCIA_SEGUNDOS;
  const transcurrido = previo.lastReportAt
    ? Math.max(0, (input.ahora.getTime() - previo.lastReportAt.getTime()) / 1000)
    : tope;

  const suma = Math.floor(
    Math.min(numeroSano(input.reporte.watchedSinceLastReport), tope, transcurrido + TOLERANCIA_SEGUNDOS),
  );

  const duracion = input.duracionSegundos && input.duracionSegundos > 0 ? input.duracionSegundos : null;
  const visto = duracion
    ? Math.min(previo.secondsWatched + suma, duracion)
    : previo.secondsWatched + suma;
  const posicion = Math.floor(
    Math.min(numeroSano(input.reporte.positionSeconds), duracion ?? Number.MAX_SAFE_INTEGER),
  );

  const recienCompleta =
    duracion !== null && visto >= Math.ceil(duracion * UMBRAL_CLASE_COMPLETA) ? input.ahora : null;

  return {
    secondsWatched: visto,
    lastPositionSeconds: posicion,
    lastReportAt: input.ahora,
    completedAt: previo.completedAt ?? recienCompleta,
  };
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `pnpm --filter fotoffice test lib/course-classroom/progress-rules.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Escribir el test del aula**

```ts
// lib/course-classroom/aula.test.ts
import { describe, expect, it } from "vitest";
import { armarAula, duracionLegible, posicionParaRetomar } from "./aula";

const lecciones = [
  { id: "c2", title: "Luz", durationSeconds: 600, videoStatus: "READY", sortOrder: 2 },
  { id: "c1", title: "Cámara", durationSeconds: 300, videoStatus: "READY", sortOrder: 1 },
  { id: "c3", title: "Edición", durationSeconds: null, videoStatus: "PROCESSING", sortOrder: 3 },
];

describe("armar el aula", () => {
  it("sólo muestra las clases listas, en orden", () => {
    const { clases } = armarAula(lecciones, []);
    expect(clases.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("el porcentaje cuenta clases completas sobre clases listas", () => {
    const { porcentaje, clases } = armarAula(lecciones, [
      { lessonId: "c1", completedAt: new Date(), lastPositionSeconds: 300 },
    ]);
    expect(porcentaje).toBe(50);
    expect(clases[0].completada).toBe(true);
    expect(clases[1].completada).toBe(false);
  });

  it("sin clases listas el avance es cero, no una división por cero", () => {
    expect(armarAula([], []).porcentaje).toBe(0);
  });

  it("guarda desde dónde retomar cada clase", () => {
    const { clases } = armarAula(lecciones, [
      { lessonId: "c2", completedAt: null, lastPositionSeconds: 140 },
    ]);
    expect(clases[1].retomarDesde).toBe(140);
  });
});

describe("desde dónde retomar", () => {
  it("donde quedó", () => {
    expect(posicionParaRetomar(140, 600)).toBe(140);
  });

  it("si quedó en los últimos 10 segundos, vuelve al principio", () => {
    expect(posicionParaRetomar(595, 600)).toBe(0);
  });
});

describe("duración para mostrar", () => {
  it("minutos", () => {
    expect(duracionLegible(720)).toBe("12 min");
  });

  it("horas y minutos", () => {
    expect(duracionLegible(3900)).toBe("1 h 05 min");
  });

  it("sin dato", () => {
    expect(duracionLegible(null)).toBe("");
  });
});
```

- [ ] **Step 6: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/course-classroom/aula.test.ts`
Expected: FAIL — `Failed to resolve import "./aula"`.

- [ ] **Step 7: Implementar**

```ts
// lib/course-classroom/aula.ts
/**
 * Lo que ve el alumno al entrar: sus clases, cuáles vio y cuánto le falta. Puro.
 *
 * Sólo cuentan las clases con el video listo: una clase procesándose no se puede ver, y
 * contarla dejaría al alumno sin poder llegar nunca al 100%.
 */

export type ClaseDelAula = {
  id: string;
  title: string;
  durationSeconds: number | null;
  completada: boolean;
  retomarDesde: number;
};

/** Si quedó en los últimos segundos, retomar ahí sería mostrarle los créditos. */
export function posicionParaRetomar(posicion: number, duracion: number | null): number {
  if (!duracion || posicion <= 0) return 0;
  return posicion >= duracion - 10 ? 0 : Math.floor(posicion);
}

export function armarAula(
  lecciones: Array<{
    id: string;
    title: string;
    durationSeconds: number | null;
    videoStatus: string;
    sortOrder: number;
  }>,
  avances: Array<{ lessonId: string; completedAt: Date | null; lastPositionSeconds: number }>,
): { clases: ClaseDelAula[]; porcentaje: number } {
  const porClase = new Map(avances.map((a) => [a.lessonId, a]));
  const clases = lecciones
    .filter((l) => l.videoStatus === "READY")
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l) => {
      const avance = porClase.get(l.id);
      return {
        id: l.id,
        title: l.title,
        durationSeconds: l.durationSeconds,
        completada: Boolean(avance?.completedAt),
        retomarDesde: posicionParaRetomar(avance?.lastPositionSeconds ?? 0, l.durationSeconds),
      };
    });
  const completas = clases.filter((c) => c.completada).length;
  const porcentaje = clases.length === 0 ? 0 : Math.floor((completas * 100) / clases.length);
  return { clases, porcentaje };
}

export function duracionLegible(segundos: number | null): string {
  if (!segundos || segundos <= 0) return "";
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `${horas} h ${String(minutos % 60).padStart(2, "0")} min`;
}
```

- [ ] **Step 8: Correr los dos tests y verlos pasar**

Run: `pnpm --filter fotoffice test lib/course-classroom`
Expected: PASS (todos los de `access-rules`, `progress-rules` y `aula`).

- [ ] **Step 9: Commit**

```bash
git add lib/course-classroom/progress-rules.ts lib/course-classroom/progress-rules.test.ts lib/course-classroom/aula.ts lib/course-classroom/aula.test.ts
git commit -m "Cursos grabados: el avance no suma saltos de la barra, y el aula sabe cuánto falta"
```

---

### Task 4: Firmar el permiso de reproducción

**Files:**
- Modify: `lib/courses-video/stream.ts`
- Test: `lib/courses-video/stream.test.ts`

**Interfaces:**
- Consumes: `StreamConfig` y `resolverConfig` (ya existen en `stream.ts`).
- Produces:
  - `DURACION_PERMISO_SEGUNDOS = 7200`
  - `signPlaybackToken(input: { videoUid: string; ttlSeconds: number; ahora?: Date }, deps?: Deps): string` — lanza `StreamError` si falta configuración.
  - `playbackIframeUrl(token: string, opciones?: { startSeconds?: number }): string`

Cloudflare Stream acepta un JWT RS256 firmado con una clave propia (`POST /stream/keys` devuelve
`id` y `pem`; el `pem` viene **codificado en base64**). El encabezado lleva `kid`; el cuerpo,
`sub` (el uid del video), `kid` y `exp`. Se firma con `node:crypto`: nada de librerías nuevas.

- [ ] **Step 1: Agregar el test que falla al final de `stream.test.ts`**

Los dos `import` van arriba del archivo, junto a los que ya hay; el `describe`, al final.

```ts
import { createVerify, generateKeyPairSync } from "node:crypto";
import { playbackIframeUrl, signPlaybackToken } from "./stream";

describe("permiso de reproducción", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const configFirma = { ...config, signingKeyId: "clave-firma", signingKeyPem: pem };
  const ahora = new Date(Date.UTC(2026, 9, 3, 12));

  function partes(token: string) {
    const [h, p, f] = token.split(".");
    return {
      header: JSON.parse(Buffer.from(h, "base64url").toString()),
      payload: JSON.parse(Buffer.from(p, "base64url").toString()),
      firmado: `${h}.${p}`,
      firma: Buffer.from(f, "base64url"),
    };
  }

  it("firma un token para un solo video, que vence", () => {
    const token = signPlaybackToken(
      { videoUid: "video-1", ttlSeconds: 7200, ahora },
      { config: configFirma },
    );
    const { header, payload, firmado, firma } = partes(token);
    expect(header).toEqual({ alg: "RS256", kid: "clave-firma" });
    expect(payload.sub).toBe("video-1");
    expect(payload.kid).toBe("clave-firma");
    expect(payload.exp).toBe(Math.floor(ahora.getTime() / 1000) + 7200);
    expect(createVerify("RSA-SHA256").update(firmado).verify(publicKey, firma)).toBe(true);
  });

  it("acepta la clave tal como la entrega Cloudflare, en base64", () => {
    const enBase64 = Buffer.from(pem).toString("base64");
    const token = signPlaybackToken(
      { videoUid: "video-1", ttlSeconds: 60, ahora },
      { config: { ...configFirma, signingKeyPem: enBase64 } },
    );
    const { firmado, firma } = partes(token);
    expect(createVerify("RSA-SHA256").update(firmado).verify(publicKey, firma)).toBe(true);
  });

  it("sin configuración lanza StreamError, sin datos de la clave en el mensaje", () => {
    const previo = process.env.STREAM_SIGNING_KEY_PEM;
    delete process.env.STREAM_SIGNING_KEY_PEM;
    try {
      expect(() => signPlaybackToken({ videoUid: "v", ttlSeconds: 60 })).toThrow(StreamError);
    } finally {
      if (previo !== undefined) process.env.STREAM_SIGNING_KEY_PEM = previo;
    }
  });

  it("la dirección del reproductor lleva el token y desde dónde arrancar", () => {
    expect(playbackIframeUrl("tok")).toBe("https://iframe.videodelivery.net/tok");
    expect(playbackIframeUrl("tok", { startSeconds: 140.7 })).toBe(
      "https://iframe.videodelivery.net/tok?startTime=140s",
    );
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/courses-video/stream.test.ts`
Expected: FAIL — `signPlaybackToken is not a function` (o error de import).

- [ ] **Step 3: Implementar en `stream.ts`**

Agregar arriba: `import { createSign } from "node:crypto";`. Al final del archivo:

```ts
/** Lo que dura un permiso. Alcanza para mirar una clase larga sin que se corte. */
export const DURACION_PERMISO_SEGUNDOS = 2 * 60 * 60;

/** Cloudflare entrega la clave PEM codificada en base64. Se aceptan las dos formas. */
function pemLegible(pem: string): string {
  return pem.includes("BEGIN") ? pem : Buffer.from(pem, "base64").toString("utf8");
}

function base64url(valor: string | Buffer): string {
  return Buffer.from(valor).toString("base64url");
}

/**
 * El permiso para reproducir **un** video durante un rato.
 *
 * Es un JWT RS256 firmado con la clave de firma de Stream. Sin él el video no se ve en ningún
 * lado: los videos se crean con `requireSignedURLs`. El servidor lo firma sólo después de
 * comprobar que el alumno tiene un acceso vigente a ese curso.
 *
 * No hace pedidos a Cloudflare: la firma es local, así que abrir una clase no suma latencia.
 */
export function signPlaybackToken(
  input: { videoUid: string; ttlSeconds: number; ahora?: Date },
  deps: Deps = {},
): string {
  const config = resolverConfig(deps);
  const ahora = Math.floor((input.ahora ?? new Date()).getTime() / 1000);
  const header = { alg: "RS256", kid: config.signingKeyId };
  const payload = {
    sub: input.videoUid,
    kid: config.signingKeyId,
    exp: ahora + input.ttlSeconds,
    // Un minuto de margen por si el reloj de Cloudflare va apenas atrás del nuestro.
    nbf: ahora - 60,
  };
  const firmado = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const firma = createSign("RSA-SHA256").update(firmado).sign(pemLegible(config.signingKeyPem));
  return `${firmado}.${base64url(firma)}`;
}

/**
 * La dirección del reproductor de Stream para un token.
 *
 * `iframe.videodelivery.net` no necesita el código de cliente de la cuenta, que sería una
 * quinta variable de entorno.
 */
export function playbackIframeUrl(token: string, opciones: { startSeconds?: number } = {}): string {
  const url = new URL(`https://iframe.videodelivery.net/${token}`);
  if (opciones.startSeconds && opciones.startSeconds > 0) {
    url.searchParams.set("startTime", `${Math.floor(opciones.startSeconds)}s`);
  }
  return url.toString();
}
```

Actualizar también el comentario del encabezado del archivo: "Tres operaciones" pasa a ser
"pedir una URL de subida, preguntar cómo viene el procesado y firmar el permiso de reproducción".

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `pnpm --filter fotoffice test lib/courses-video/stream.test.ts`
Expected: PASS (los tests anteriores más los 4 nuevos).

- [ ] **Step 5: Commit**

```bash
git add lib/courses-video/stream.ts lib/courses-video/stream.test.ts
git commit -m "Cursos grabados: firmar el permiso de reproducción de cada clase"
```

---

### Task 5: Poder comprar un curso grabado

**Files:**
- Create: `lib/presential-courses/enrollment-target.ts`
- Test: `lib/presential-courses/enrollment-target.test.ts`
- Create: `components/presential-courses/recorded-course-section.tsx`
- Modify: `app/actions/public-course-enrollment.ts`
- Modify: `components/presential-courses/public-course-enrollment-form.tsx`
- Modify: `app/w/[workspaceSlug]/cursos/[courseSlug]/page.tsx`

**Interfaces:**
- Consumes: `validarModalidad`, `esGrabado`, `type CourseDeliveryMode` de `@/lib/presential-courses/delivery-mode`; `duracionLegible` de `@/lib/course-classroom/aula` (Task 3).
- Produces:
  - `resolverObjetivoDeInscripcion(input: { deliveryMode: CourseDeliveryMode; precioDelCurso: Prisma.Decimal | null; instancia: { id: string; status: string; priceArs: Prisma.Decimal } | null; cuposLibres: number | null }): { ok: true; courseInstanceId: string | null; monto: Prisma.Decimal } | { ok: false; error: string }`
  - `PublicCourseEnrollmentForm` acepta `instanceOptions` opcional (vacío = curso sin ediciones).
  - `RecordedCourseSection({ workspaceSlug, courseSlug, appUrl, precioArs, publicado, clases })` donde `clases: Array<{ id: string; title: string; description: string | null; durationSeconds: number | null; isPreview: boolean }>`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// lib/presential-courses/enrollment-target.test.ts
import { describe, expect, it } from "vitest";
import { Prisma } from "@repo/db";
import { resolverObjetivoDeInscripcion } from "./enrollment-target";

const d = (v: string) => new Prisma.Decimal(v);

describe("a qué se inscribe y cuánto paga", () => {
  it("un grabado se compra sin edición, al precio del curso", () => {
    const r = resolverObjetivoDeInscripcion({
      deliveryMode: "RECORDED",
      precioDelCurso: d("45000"),
      instancia: null,
      cuposLibres: null,
    });
    expect(r).toEqual({ ok: true, courseInstanceId: null, monto: d("45000") });
  });

  it("un grabado sin precio no se puede comprar", () => {
    const r = resolverObjetivoDeInscripcion({
      deliveryMode: "RECORDED",
      precioDelCurso: null,
      instancia: null,
      cuposLibres: null,
    });
    expect(r.ok).toBe(false);
  });

  it("un grabado con precio cero tampoco: sería regalar un curso pago por error", () => {
    const r = resolverObjetivoDeInscripcion({
      deliveryMode: "RECORDED",
      precioDelCurso: d("0"),
      instancia: null,
      cuposLibres: null,
    });
    expect(r.ok).toBe(false);
  });

  it("a un grabado no se le puede colar una edición", () => {
    const r = resolverObjetivoDeInscripcion({
      deliveryMode: "RECORDED",
      precioDelCurso: d("45000"),
      instancia: { id: "e1", status: "ACTIVE", priceArs: d("10") },
      cuposLibres: 3,
    });
    expect(r).toEqual({ ok: false, error: "Un curso grabado no tiene ediciones: se organiza en clases." });
  });

  it("un presencial sigue exigiendo edición activa con cupo, al precio de la edición", () => {
    const instancia = { id: "e1", status: "ACTIVE", priceArs: d("30000") };
    expect(
      resolverObjetivoDeInscripcion({ deliveryMode: "PRESENCIAL", precioDelCurso: null, instancia, cuposLibres: 2 }),
    ).toEqual({ ok: true, courseInstanceId: "e1", monto: d("30000") });
    expect(
      resolverObjetivoDeInscripcion({ deliveryMode: "PRESENCIAL", precioDelCurso: null, instancia, cuposLibres: 0 }).ok,
    ).toBe(false);
    expect(
      resolverObjetivoDeInscripcion({
        deliveryMode: "PRESENCIAL",
        precioDelCurso: null,
        instancia: { ...instancia, status: "CANCELLED" },
        cuposLibres: 2,
      }).ok,
    ).toBe(false);
    expect(
      resolverObjetivoDeInscripcion({ deliveryMode: "PRESENCIAL", precioDelCurso: null, instancia: null, cuposLibres: null }).ok,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/presential-courses/enrollment-target.test.ts`
Expected: FAIL — `Failed to resolve import "./enrollment-target"`.

- [ ] **Step 3: Implementar**

```ts
// lib/presential-courses/enrollment-target.ts
import type { Prisma } from "@repo/db";
import { esGrabado, validarModalidad, type CourseDeliveryMode } from "./delivery-mode";

/**
 * A qué se inscribe alguien y cuánto paga.
 *
 * Un presencial se compra por edición (fecha, lugar, cupo y precio propios). Un grabado no
 * tiene ediciones: se compra el curso, al precio del curso, sin cupo. Hasta el 2026-10-03 la
 * acción pública exigía edición siempre, y un curso grabado no se podía comprar.
 */
export function resolverObjetivoDeInscripcion(input: {
  deliveryMode: CourseDeliveryMode;
  precioDelCurso: Prisma.Decimal | null;
  instancia: { id: string; status: string; priceArs: Prisma.Decimal } | null;
  cuposLibres: number | null;
}):
  | { ok: true; courseInstanceId: string | null; monto: Prisma.Decimal }
  | { ok: false; error: string } {
  const modalidad = validarModalidad({
    deliveryMode: input.deliveryMode,
    tieneEdicion: input.instancia !== null,
  });
  if (!modalidad.ok) return modalidad;

  if (esGrabado(input.deliveryMode)) {
    if (!input.precioDelCurso || input.precioDelCurso.lte(0)) {
      return { ok: false, error: "Este curso todavía no tiene precio." };
    }
    return { ok: true, courseInstanceId: null, monto: input.precioDelCurso };
  }

  const instancia = input.instancia!;
  if (instancia.status !== "ACTIVE") {
    return { ok: false, error: "La edición no está disponible para inscripción." };
  }
  if ((input.cuposLibres ?? 0) <= 0) {
    return { ok: false, error: "No hay cupos disponibles para esta edición." };
  }
  return { ok: true, courseInstanceId: instancia.id, monto: instancia.priceArs };
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `pnpm --filter fotoffice test lib/presential-courses/enrollment-target.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Usarlo en la acción pública**

En `app/actions/public-course-enrollment.ts`:

1. En el esquema, `courseInstanceId: z.string().min(1),` pasa a
   `courseInstanceId: z.string().min(1).optional(),`
2. En el `safeParse`, `courseInstanceId: formData.get("courseInstanceId")?.toString()?.trim() ?? "",`
   pasa a `courseInstanceId: emptyToNull(formData.get("courseInstanceId")?.toString()) ?? undefined,`
3. Reemplazar desde `const course = await prisma.course.findFirst({` hasta la línea
   `const feePercent = new Prisma.Decimal(feeBps).div(100);` inclusive, por:

```ts
  const course = await prisma.course.findFirst({
    where: {
      workspaceId: branding.workspaceId,
      slug: courseSlug,
      status: "PUBLISHED",
    },
    include: {
      instances: parsed.data.courseInstanceId
        ? { where: { id: parsed.data.courseInstanceId } }
        : { where: { id: "" } }, // sin edición elegida: no trae ninguna
    },
  });
  if (!course) return { error: "Curso no disponible para inscripción." };
  const instance = course.instances[0] ?? null;
  if (parsed.data.courseInstanceId && !instance) {
    return { error: "La edición seleccionada no es válida." };
  }

  let cuposLibres: number | null = null;
  if (instance) {
    const counts = await getApprovedEnrollmentCountsByInstanceIds([instance.id]);
    cuposLibres = computeAvailableSpots(instance.capacity, counts.get(instance.id) ?? 0);
  }

  const objetivo = resolverObjetivoDeInscripcion({
    deliveryMode: course.deliveryMode,
    precioDelCurso: course.priceArs,
    instancia: instance,
    cuposLibres,
  });
  if (!objetivo.ok) return { error: objetivo.error };

  // La comisión sale de WorkspaceModuleFee (default 5%), no de coursesFeePercent, que el
  // dueño del workspace podía editar y quedó deprecado.
  const feeBps = await getPlatformFeeBps(branding.workspaceId, COURSES_SALES_MODULE_KEY);
  const amount = objetivo.monto;
  const { fee, net } = splitByPlatformFee(amount, feeBps);
  const feePercent = new Prisma.Decimal(feeBps).div(100);
```

4. En `prisma.courseEnrollment.create`, `courseInstanceId: instance.id,` pasa a
   `courseInstanceId: objetivo.courseInstanceId,`
5. Agregar el import: `import { resolverObjetivoDeInscripcion } from "@/lib/presential-courses/enrollment-target";`

- [ ] **Step 6: El formulario acepta un curso sin ediciones**

En `components/presential-courses/public-course-enrollment-form.tsx`:

- En la firma, `instanceOptions,` pasa a `instanceOptions = [],` y el tipo
  `instanceOptions: InstanceOption[];` pasa a `instanceOptions?: InstanceOption[];`.
- Reemplazar el bloque `{singleInstance ? ( ... ) : ( ... )}` del principio del `<form>` por:

```tsx
      {instanceOptions.length === 0 ? null : singleInstance ? (
        <input type="hidden" name="courseInstanceId" value={defaultInstanceId ?? singleInstance.id} />
      ) : (
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="instance">
            Edición presencial
          </label>
          <select id="instance" name="courseInstanceId" className="fo-input" required defaultValue={defaultInstanceId ?? ""}>
            <option value="">Seleccioná una edición</option>
            {instanceOptions.map((instance) => (
              <option key={instance.id} value={instance.id} disabled={instance.disabled}>
                {instance.label} · ${instance.priceArs} · {instance.soldOut ? "Sin cupos disponibles" : `${instance.availableSpots} cupos`}
              </option>
            ))}
          </select>
        </div>
      )}
```

(Es el mismo bloque de antes con `instanceOptions.length === 0 ? null :` adelante.)

- [ ] **Step 7: La sección de venta del curso grabado**

```tsx
// components/presential-courses/recorded-course-section.tsx
import { formatMoney } from "@/lib/format";
import { duracionLegible } from "@/lib/course-classroom/aula";
import { PublicCourseEnrollmentForm } from "@/components/presential-courses/public-course-enrollment-form";

type Clase = {
  id: string;
  title: string;
  description: string | null;
  durationSeconds: number | null;
  isPreview: boolean;
};

/**
 * La parte de venta de un curso grabado: qué clases trae, cuánto cuesta y el formulario.
 *
 * La muestra gratuita abre en el dominio de FOTOFFICE (`appUrl`) y no en el de la institución:
 * los videos sólo se reproducen desde fotoffice.com.
 */
export function RecordedCourseSection({
  workspaceSlug,
  courseSlug,
  appUrl,
  precioArs,
  publicado,
  clases,
}: {
  workspaceSlug: string;
  courseSlug: string;
  appUrl: string;
  precioArs: string | null;
  publicado: boolean;
  clases: Clase[];
}) {
  const total = clases.reduce((s, c) => s + (c.durationSeconds ?? 0), 0);
  return (
    <section className="fo-card space-y-4">
      <h2 className="text-xl font-semibold">Clases</h2>
      <p className="text-sm text-[var(--fo-muted)]">
        {clases.length} {clases.length === 1 ? "clase" : "clases"}
        {total > 0 ? ` · ${duracionLegible(total)} en total` : ""} · Lo mirás a tu ritmo, durante 12 meses.
      </p>
      <ol className="space-y-2">
        {clases.map((clase, i) => (
          <li
            key={clase.id}
            className="flex items-start justify-between gap-3 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3"
          >
            <div className="min-w-0">
              <p className="font-medium">
                {i + 1}. {clase.title}
              </p>
              {clase.description ? (
                <p className="text-sm text-[var(--fo-muted)] line-clamp-2">{clase.description}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-right text-sm text-[var(--fo-muted)]">
              <p>{duracionLegible(clase.durationSeconds)}</p>
              {clase.isPreview && appUrl ? (
                <a
                  href={`${appUrl}/w/${workspaceSlug}/cursos/${courseSlug}/muestra/${clase.id}`}
                  className="text-[var(--fo-accent)] underline"
                >
                  Ver gratis
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {precioArs ? (
        <p className="text-lg font-semibold">{formatMoney(Number(precioArs), "ARS")}</p>
      ) : null}
      {publicado && precioArs ? (
        <details className="pt-2">
          <summary className="cursor-pointer text-sm text-[var(--fo-accent)]">Comprar el curso</summary>
          <div className="pt-3">
            <PublicCourseEnrollmentForm workspaceSlug={workspaceSlug} courseSlug={courseSlug} />
          </div>
        </details>
      ) : null}
    </section>
  );
}
```

Antes de escribirlo, abrí `lib/format.ts` y confirmá que `formatMoney` acepta un `number`
(la página ya lo llama con `minPrice`, que es número). Si la firma es otra, adaptá la llamada.

- [ ] **Step 8: La página pública muestra la variante grabada**

En `app/w/[workspaceSlug]/cursos/[courseSlug]/page.tsx`:

1. En el `include` de `presentialCourse`, agregar al lado de `instances`:

```ts
      lessons: {
        where: { videoStatus: "READY" },
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true, description: true, durationSeconds: true, isPreview: true },
      },
```

2. Debajo de `if (!presentialCourse) notFound();` agregar:

```ts
  const esCursoGrabado = presentialCourse.deliveryMode === "RECORDED";
  const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
```

3. La etiqueta `{presentialCourse.status === "UPCOMING" ? "Próximamente" : "Cursos presenciales"}`
   pasa a `{presentialCourse.status === "UPCOMING" ? "Próximamente" : esCursoGrabado ? "Curso grabado" : "Cursos presenciales"}`.
4. Envolver la sección `Ediciones activas` (el `<section className="fo-card space-y-4">` que
   empieza con `<h2 ...>Ediciones activas</h2>`) y la sección final `Inscripción` en
   `{esCursoGrabado ? null : ( ... )}`, y antes de la de ediciones agregar:

```tsx
      {esCursoGrabado ? (
        <RecordedCourseSection
          workspaceSlug={workspaceSlug}
          courseSlug={courseSlug}
          appUrl={appUrl}
          precioArs={presentialCourse.priceArs?.toString() ?? null}
          publicado={presentialCourse.status === "PUBLISHED"}
          clases={presentialCourse.lessons}
        />
      ) : null}
```

5. Import: `import { RecordedCourseSection } from "@/components/presential-courses/recorded-course-section";`

- [ ] **Step 9: Tipos y tests**

Run: `pnpm --filter fotoffice test && pnpm --filter fotoffice exec tsc --noEmit`
Expected: tests en verde y `tsc` sin errores. **Ojo:** `tsc` puede morir por memoria y devolver
éxito igual; si termina sin imprimir nada en menos de unos segundos o con `Killed`, correlo con
`NODE_OPTIONS=--max-old-space-size=8192`. Si el cliente de Prisma local está viejo, los tipos
mienten: corré `pnpm --filter @repo/db exec prisma generate` antes.

- [ ] **Step 10: Comprobar a mano**

Run: `pnpm --filter fotoffice exec next dev --webpack -p 3010` (en el worktree).
Con un curso grabado de prueba en la base local (precio cargado, una clase `READY`), abrir
`http://localhost:3010/w/<slug>/cursos/<curso>`: se ven las clases, el precio y "Comprar el
curso"; al completar el formulario redirige a la pantalla de pago pendiente. Un curso presencial
se sigue viendo igual que antes.

- [ ] **Step 11: Commit**

```bash
git add lib/presential-courses/enrollment-target.ts lib/presential-courses/enrollment-target.test.ts components/presential-courses/recorded-course-section.tsx components/presential-courses/public-course-enrollment-form.tsx app/actions/public-course-enrollment.ts "app/w/[workspaceSlug]/cursos/[courseSlug]/page.tsx"
git commit -m "Cursos grabados: que se puedan comprar desde la página pública"
```

---

### Task 6: Otorgar el acceso y mandar el enlace al aprobarse el pago

**Files:**
- Create: `lib/course-classroom/email.ts`, `lib/course-classroom/grant.ts`
- Test: `lib/course-classroom/email.test.ts`, `lib/course-classroom/grant.test.ts`
- Modify: `lib/presential-courses/enrollment-workflow.ts` (bloque `if (!instancia) { ... }`, ~líneas 176-183)
- Modify: `app/w/[workspaceSlug]/cursos/[courseSlug]/inscripcion/success/page.tsx`

**Interfaces:**
- Consumes: `generateInvitationToken`, `hashInvitationToken` de `@/lib/members/invitation-tokens`; `calcularVencimiento`, `fechaLegibleArgentina` (Task 2); `sendTransactionalEmail` de `@/lib/communications/send-email`; `loadWorkspaceSignature` de `@/lib/communications/load-workspace-signature`; `logCourseEvent` de `@/lib/presential-courses/log`.
- Produces:
  - `enlaceDelAula(base: string, token: string): string` → `"<base>/aula/<token>"`
  - `escaparHtml(texto: string): string`
  - `buildClassroomAccessEmailBody(input: { studentName: string; courseTitle: string; enlace: string; expiresAt: Date }, signature: RenderedEmailSignature | null): { html: string; text: string }`
  - `sendClassroomAccessEmail(input: { to: string; studentName: string; courseTitle: string; enlace: string; expiresAt: Date; signature?: RenderedEmailSignature | null }): Promise<{ sent: true } | { sent: false; reason: string }>`
  - `otorgarAccesoAlAula(enrollmentId: string, ahora?: Date): Promise<OtorgarResultado>`
  - `type OtorgarResultado = { ok: true; creado: true; token: string; expiresAt: Date } | { ok: true; creado: false } | { ok: false; reason: "inscripcion_no_encontrada" | "inscripcion_no_aprobada" | "no_es_grabado" }`
  - `avisarAccesoAlAula(input: { enrollmentId: string; workspaceId: string; to: string; studentName: string; courseTitle: string }, deps?: AvisoDeps): Promise<{ avisado: boolean; motivo?: string }>`
  - `type AvisoDeps = { otorgar: (enrollmentId: string) => Promise<OtorgarResultado>; enviar: typeof sendClassroomAccessEmail; cargarFirma: (workspaceId: string) => Promise<RenderedEmailSignature | null>; base: string }`

- [ ] **Step 1: Escribir el test del correo**

```ts
// lib/course-classroom/email.test.ts
import { describe, expect, it } from "vitest";
import { buildClassroomAccessEmailBody, enlaceDelAula, escaparHtml } from "./email";

const input = {
  studentName: "Ana <b>Pérez</b>",
  courseTitle: "Retrato con luz natural",
  enlace: "https://fotoffice.com/aula/abc123",
  expiresAt: new Date(Date.UTC(2027, 9, 4, 2)),
};
const firma = { html: "<p>Firma SFPR</p>", text: "Firma SFPR" };

describe("correo con el enlace al aula", () => {
  it("arma el enlace sin barras dobles", () => {
    expect(enlaceDelAula("https://fotoffice.com/", "tok")).toBe("https://fotoffice.com/aula/tok");
  });

  it("lleva el enlace en las dos variantes", () => {
    const { html, text } = buildClassroomAccessEmailBody(input, null);
    expect(html).toContain('href="https://fotoffice.com/aula/abc123"');
    expect(text).toContain("https://fotoffice.com/aula/abc123");
  });

  it("escapa el nombre que escribió el alumno: el formulario es público", () => {
    const { html } = buildClassroomAccessEmailBody(input, null);
    expect(html).not.toContain("<b>Pérez</b>");
    expect(html).toContain("Ana &lt;b&gt;Pérez&lt;/b&gt;");
  });

  it("dice hasta cuándo, en fecha argentina", () => {
    const { text } = buildClassroomAccessEmailBody(input, null);
    expect(text).toContain("3 de octubre de 2027");
  });

  it("la firma entra una sola vez en cada variante", () => {
    const { html, text } = buildClassroomAccessEmailBody(input, firma);
    expect(html.split("Firma SFPR").length - 1).toBe(1);
    expect(text.split("Firma SFPR").length - 1).toBe(1);
  });

  it("escaparHtml cubre comillas", () => {
    expect(escaparHtml(`"a" & 'b'`)).toBe("&quot;a&quot; &amp; &#39;b&#39;");
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/course-classroom/email.test.ts`
Expected: FAIL — `Failed to resolve import "./email"`.

- [ ] **Step 3: Implementar el correo**

```ts
// lib/course-classroom/email.ts
import type { RenderedEmailSignature } from "@repo/communications/signature";
import { sendTransactionalEmail } from "@/lib/communications/send-email";
import { fechaLegibleArgentina } from "./access-rules";

/**
 * El correo que le da al alumno la entrada a su aula.
 *
 * Es la **única** vez que viaja el token crudo: en la base queda sólo su hash. Si el correo
 * se pierde, el alumno pide uno nuevo en /aula/recuperar.
 */

export function enlaceDelAula(base: string, token: string): string {
  return `${base.replace(/\/+$/, "")}/aula/${token}`;
}

/** El nombre lo escribe cualquiera en un formulario público: no puede llegar como HTML. */
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type CuerpoInput = {
  studentName: string;
  courseTitle: string;
  enlace: string;
  expiresAt: Date;
};

export function buildClassroomAccessEmailBody(
  input: CuerpoInput,
  signature: RenderedEmailSignature | null,
): { html: string; text: string } {
  const vence = fechaLegibleArgentina(input.expiresAt);
  const nombre = escaparHtml(input.studentName);
  const curso = escaparHtml(input.courseTitle);
  const enlace = escaparHtml(input.enlace);
  const signatureHtml = signature
    ? `\n  <div id="fo-signature" style="margin-top:16px;">${signature.html}</div>`
    : "";

  const html = `
<div>
  <p>Hola ${nombre},</p>
  <p>Tu pago fue aprobado. Ya podés entrar a <strong>${curso}</strong>.</p>
  <p><a href="${enlace}">Entrar al aula</a></p>
  <p>Ese enlace es personal: es tu llave del curso. No lo compartas.</p>
  <p>Tenés acceso hasta el ${vence}.</p>
  <p>Gracias por elegirnos.</p>${signatureHtml}
</div>
`.trim();

  const text = [
    `Hola ${input.studentName},`,
    "",
    `Tu pago fue aprobado. Ya podés entrar a ${input.courseTitle}.`,
    "",
    `Entrar al aula: ${input.enlace}`,
    "",
    "Ese enlace es personal: es tu llave del curso. No lo compartas.",
    `Tenés acceso hasta el ${vence}.`,
    "",
    "Gracias por elegirnos.",
    ...(signature ? ["", signature.text] : []),
  ].join("\n");

  return { html, text };
}

export async function sendClassroomAccessEmail(
  input: CuerpoInput & { to: string; signature?: RenderedEmailSignature | null },
): Promise<{ sent: true } | { sent: false; reason: string }> {
  const { html, text } = buildClassroomAccessEmailBody(input, input.signature ?? null);
  const outcome = await sendTransactionalEmail({
    to: input.to,
    subject: `Tu acceso a ${input.courseTitle}`,
    html,
    text,
  });
  if (outcome.status === "SENT") return { sent: true };
  return { sent: false, reason: outcome.detail };
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `pnpm --filter fotoffice test lib/course-classroom/email.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Escribir el test del aviso**

```ts
// lib/course-classroom/grant.test.ts
import { describe, expect, it, vi } from "vitest";
import { avisarAccesoAlAula, type AvisoDeps } from "./grant";

const input = {
  enrollmentId: "insc-1",
  workspaceId: "ws-1",
  to: "ana@example.com",
  studentName: "Ana",
  courseTitle: "Retrato",
};
const vence = new Date(Date.UTC(2027, 9, 3));

function deps(parcial: Partial<AvisoDeps> = {}): AvisoDeps {
  return {
    otorgar: vi.fn().mockResolvedValue({ ok: true, creado: true, token: "tok-crudo", expiresAt: vence }),
    enviar: vi.fn().mockResolvedValue({ sent: true }),
    cargarFirma: vi.fn().mockResolvedValue(null),
    base: "https://fotoffice.com",
    ...parcial,
  };
}

describe("avisar el acceso al aula", () => {
  it("al crear el acceso manda un correo con el enlace", async () => {
    const d = deps();
    const r = await avisarAccesoAlAula(input, d);
    expect(r).toEqual({ avisado: true });
    expect(d.enviar).toHaveBeenCalledTimes(1);
    expect(d.enviar).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ana@example.com",
        enlace: "https://fotoffice.com/aula/tok-crudo",
        expiresAt: vence,
      }),
    );
  });

  it("si el acceso ya existía no manda nada: el aviso repetido de Mercado Pago no duplica correos", async () => {
    const d = deps({ otorgar: vi.fn().mockResolvedValue({ ok: true, creado: false }) });
    const r = await avisarAccesoAlAula(input, d);
    expect(r.avisado).toBe(false);
    expect(d.enviar).not.toHaveBeenCalled();
  });

  it("sin dirección de la aplicación no manda un enlace roto", async () => {
    const d = deps({ base: "" });
    const r = await avisarAccesoAlAula(input, d);
    expect(r).toEqual({ avisado: false, motivo: "sin_app_url" });
    expect(d.enviar).not.toHaveBeenCalled();
  });

  it("si el correo falla no lanza: el pago ya está aprobado", async () => {
    const d = deps({ enviar: vi.fn().mockResolvedValue({ sent: false, reason: "rechazado" }) });
    await expect(avisarAccesoAlAula(input, d)).resolves.toEqual({ avisado: false, motivo: "rechazado" });
  });

  it("si otorgar explota tampoco lanza", async () => {
    const d = deps({ otorgar: vi.fn().mockRejectedValue(new Error("base caída")) });
    await expect(avisarAccesoAlAula(input, d)).resolves.toEqual({ avisado: false, motivo: "error" });
  });
});
```

- [ ] **Step 6: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/course-classroom/grant.test.ts`
Expected: FAIL — `Failed to resolve import "./grant"`.

- [ ] **Step 7: Implementar `grant.ts`**

```ts
// lib/course-classroom/grant.ts
import "server-only";
import { Prisma, prisma } from "@repo/db";
import type { RenderedEmailSignature } from "@repo/communications/signature";
import { generateInvitationToken, hashInvitationToken } from "@/lib/members/invitation-tokens";
import { loadWorkspaceSignature } from "@/lib/communications/load-workspace-signature";
import { logCourseEvent } from "@/lib/presential-courses/log";
import { calcularVencimiento } from "./access-rules";
import { enlaceDelAula, sendClassroomAccessEmail } from "./email";

export type OtorgarResultado =
  | { ok: true; creado: true; token: string; expiresAt: Date }
  | { ok: true; creado: false }
  | { ok: false; reason: "inscripcion_no_encontrada" | "inscripcion_no_aprobada" | "no_es_grabado" };

/**
 * Crea el acceso al aula de una inscripción pagada a un curso grabado.
 *
 * Idempotente: si el acceso ya existe —o lo crea otro pedido al mismo tiempo, por el índice
 * único de `enrollmentId`— devuelve `creado: false` y **no** genera token nuevo. El token crudo
 * sólo sale de acá cuando se crea, para ir al correo.
 */
export async function otorgarAccesoAlAula(
  enrollmentId: string,
  ahora: Date = new Date(),
): Promise<OtorgarResultado> {
  const inscripcion = await prisma.courseEnrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      workspaceId: true,
      courseId: true,
      paymentStatus: true,
      course: { select: { deliveryMode: true, accessMonths: true } },
      access: { select: { id: true } },
    },
  });
  if (!inscripcion) return { ok: false, reason: "inscripcion_no_encontrada" };
  if (inscripcion.paymentStatus !== "APPROVED") return { ok: false, reason: "inscripcion_no_aprobada" };
  if (inscripcion.course.deliveryMode !== "RECORDED") return { ok: false, reason: "no_es_grabado" };
  if (inscripcion.access) return { ok: true, creado: false };

  const token = generateInvitationToken();
  const expiresAt = calcularVencimiento(ahora, inscripcion.course.accessMonths);
  try {
    await prisma.courseAccess.create({
      data: {
        workspaceId: inscripcion.workspaceId,
        courseId: inscripcion.courseId,
        enrollmentId: inscripcion.id,
        grantedAt: ahora,
        expiresAt,
        tokenHash: hashInvitationToken(token),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: true, creado: false };
    }
    throw error;
  }
  return { ok: true, creado: true, token, expiresAt };
}

export type AvisoDeps = {
  otorgar: (enrollmentId: string) => Promise<OtorgarResultado>;
  enviar: typeof sendClassroomAccessEmail;
  cargarFirma: (workspaceId: string) => Promise<RenderedEmailSignature | null>;
  base: string;
};

function depsPorDefecto(): AvisoDeps {
  return {
    otorgar: (id) => otorgarAccesoAlAula(id),
    enviar: sendClassroomAccessEmail,
    cargarFirma: loadWorkspaceSignature,
    base: (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim(),
  };
}

/**
 * Da el acceso y avisa por correo. **Nunca lanza**: se llama después de aprobar un pago, y un
 * correo que falla no puede deshacer ni trabar esa aprobación. El resultado queda en el log.
 */
export async function avisarAccesoAlAula(
  input: { enrollmentId: string; workspaceId: string; to: string; studentName: string; courseTitle: string },
  deps: AvisoDeps = depsPorDefecto(),
): Promise<{ avisado: boolean; motivo?: string }> {
  try {
    if (!deps.base) {
      logCourseEvent("aula_sin_aviso", { enrollmentId: input.enrollmentId, motivo: "sin_app_url" });
      return { avisado: false, motivo: "sin_app_url" };
    }
    const acceso = await deps.otorgar(input.enrollmentId);
    if (!acceso.ok || !acceso.creado) {
      const motivo = acceso.ok ? "ya_existia" : acceso.reason;
      logCourseEvent("aula_sin_aviso", { enrollmentId: input.enrollmentId, motivo });
      return { avisado: false, motivo };
    }
    const firma = await deps.cargarFirma(input.workspaceId);
    const envio = await deps.enviar({
      to: input.to,
      studentName: input.studentName,
      courseTitle: input.courseTitle,
      enlace: enlaceDelAula(deps.base, acceso.token),
      expiresAt: acceso.expiresAt,
      signature: firma,
    });
    if (!envio.sent) {
      logCourseEvent("aula_correo_no_enviado", { enrollmentId: input.enrollmentId, motivo: envio.reason });
      return { avisado: false, motivo: envio.reason };
    }
    logCourseEvent("aula_acceso_avisado", { enrollmentId: input.enrollmentId, workspaceId: input.workspaceId });
    return { avisado: true };
  } catch (error) {
    console.error("[fotoffice][cursos] no se pudo dar el acceso al aula", {
      enrollmentId: input.enrollmentId,
      error,
    });
    return { avisado: false, motivo: "error" };
  }
}
```

- [ ] **Step 8: Correr los tests y verlos pasar**

Run: `pnpm --filter fotoffice test lib/course-classroom/grant.test.ts lib/course-classroom/email.test.ts`
Expected: PASS (5 + 6 tests).

- [ ] **Step 9: Conectarlo a la aprobación del pago**

En `lib/presential-courses/enrollment-workflow.ts`, reemplazar el bloque:

```ts
  if (!instancia) {
    logCourseEvent("aprobada_sin_aviso_por_ser_grabado", {
      enrollmentId: enrollment.id,
      workspaceId: enrollment.workspaceId,
      courseId: enrollment.courseId,
    });
    return { ok: true, alreadyApproved: false as const };
  }
```

por:

```ts
  if (!instancia) {
    await avisarAccesoAlAula({
      enrollmentId: enrollment.id,
      workspaceId: enrollment.workspaceId,
      to: enrollment.email,
      studentName: enrollment.name,
      courseTitle: enrollment.course.title,
    });
    return { ok: true, alreadyApproved: false as const };
  }
```

y el comentario de arriba ("El aviso del curso grabado es otro ... se escribe en la etapa del
alumno") pasa a: "El curso grabado no tiene edición: su aviso lleva el enlace al aula y lo arma
`lib/course-classroom/grant.ts`."

Import: `import { avisarAccesoAlAula } from "@/lib/course-classroom/grant";`

Run: `pnpm --filter fotoffice test lib/presential-courses`
Expected: PASS. Si `enrollment-email-end-to-end.test.ts` simula Prisma y ahora falla porque
`grant.ts` se importa, simulá el módulo con `vi.mock("@/lib/course-classroom/grant", () => ({ avisarAccesoAlAula: vi.fn() }))` en ese test, no cambies el comportamiento.

- [ ] **Step 10: La pantalla de pago aprobado lo cuenta**

En `app/w/[workspaceSlug]/cursos/[courseSlug]/inscripcion/success/page.tsx`, después de
`<p className="text-sm text-[var(--fo-muted)]">{statusMessage}</p>` agregar:

```tsx
        {approved && enrollment.course.deliveryMode === "RECORDED" ? (
          <div className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-4">
            <h2 className="font-semibold">Tu aula</h2>
            <p className="text-sm text-[var(--fo-muted)]">
              Te mandamos a <strong className="text-[var(--fo-text)]">{enrollment.email}</strong> el
              enlace para entrar. Si no lo ves, revisá el correo no deseado.
            </p>
            <Link href="/aula/recuperar" className="text-sm text-[var(--fo-accent)] underline">
              No me llegó el correo
            </Link>
          </div>
        ) : null}
```

El enlace **no** se muestra en pantalla: el token crudo no se guarda, y esta página la puede
abrir cualquiera que tenga el `enrollmentId` de la URL de vuelta.

- [ ] **Step 11: Commit**

```bash
git add lib/course-classroom/email.ts lib/course-classroom/email.test.ts lib/course-classroom/grant.ts lib/course-classroom/grant.test.ts lib/presential-courses/enrollment-workflow.ts "app/w/[workspaceSlug]/cursos/[courseSlug]/inscripcion/success/page.tsx"
git commit -m "Cursos grabados: al aprobarse el pago, el alumno recibe el enlace a su aula"
```

---

### Task 7: El aula — lista de clases y avance

**Files:**
- Create: `lib/course-classroom/lookup.ts`
- Create: `app/aula/[token]/page.tsx`
- Modify: `lib/entrada/institution-shortcut.ts` (agregar `"aula"` a `RESERVED_SLUGS`)
- Test: `lib/entrada/institution-shortcut.test.ts` (ya existe; es el que obliga a reservar)

**Interfaces:**
- Consumes: `hashInvitationToken`; `estadoDelAcceso`, `fechaLegibleArgentina` (Task 2); `armarAula`, `duracionLegible` (Task 3).
- Produces: `buscarAccesoPorToken(token: string)` → el `CourseAccess` con `enrollment { id, name, dni, email }`, `course { id, title, slug, completionPercent, workspace { id }, lessons[{ id, title, description, durationSeconds, videoStatus, videoUid, sortOrder }] }` y `progress[{ lessonId, completedAt, lastPositionSeconds }]`, o `null`.

- [ ] **Step 1: Correr el test de nombres reservados con la carpeta nueva y ver que falla**

Crear `app/aula/[token]/page.tsx` con un contenido mínimo (`export default function P() { return null; }`).

Run: `pnpm --filter fotoffice test lib/entrada/institution-shortcut.test.ts`
Expected: FAIL — el test recorre `app/` y avisa que `aula` no está reservado (sin esto,
`/aula` redirigiría a `/w/aula`, como si fuera una institución).

- [ ] **Step 2: Reservar `aula`**

En `lib/entrada/institution-shortcut.ts`, dentro de `RESERVED_SLUGS`, en orden alfabético bajo
"Rutas reales de la aplicación", agregar `"aula",` (entre `"admin"` y `"c"`, respetando lo que
haya en el medio).

Run: `pnpm --filter fotoffice test lib/entrada/institution-shortcut.test.ts`
Expected: PASS.

- [ ] **Step 3: Buscar el acceso por token**

```ts
// lib/course-classroom/lookup.ts
import "server-only";
import { prisma } from "@repo/db";
import { hashInvitationToken } from "@/lib/members/invitation-tokens";

/**
 * El acceso que corresponde al enlace del aula, o null.
 *
 * Se busca por el hash: el token crudo nunca toca la base. Un token con forma imposible ni
 * siquiera consulta.
 */
export async function buscarAccesoPorToken(token: string) {
  if (!token || token.length < 20 || token.length > 100) return null;
  return prisma.courseAccess.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    include: {
      enrollment: { select: { id: true, name: true, dni: true, email: true } },
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
          completionPercent: true,
          workspace: { select: { id: true } },
          lessons: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              title: true,
              description: true,
              durationSeconds: true,
              videoStatus: true,
              videoUid: true,
              sortOrder: true,
            },
          },
        },
      },
      progress: { select: { lessonId: true, completedAt: true, lastPositionSeconds: true } },
    },
  });
}

export type AccesoDelAula = NonNullable<Awaited<ReturnType<typeof buscarAccesoPorToken>>>;
```

- [ ] **Step 4: La página del aula**

```tsx
// app/aula/[token]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { buscarAccesoPorToken } from "@/lib/course-classroom/lookup";
import { estadoDelAcceso, fechaLegibleArgentina } from "@/lib/course-classroom/access-rules";
import { armarAula, duracionLegible } from "@/lib/course-classroom/aula";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mi aula",
  // El enlace es una credencial: no se indexa, y a otros sitios sólo viaja el origen, nunca la
  // dirección con el token.
  robots: { index: false, follow: false },
  referrer: "strict-origin",
};

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <div className="fo-card space-y-3 p-6 text-center">
        <p className="text-base font-semibold">{titulo}</p>
        <p className="text-sm text-[var(--fo-muted)] leading-relaxed">{texto}</p>
        <Link href="/aula/recuperar" className="text-sm text-[var(--fo-accent)] underline">
          Pedir un enlace nuevo
        </Link>
      </div>
    </main>
  );
}

export default async function AulaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const acceso = await buscarAccesoPorToken(token);

  // El mismo mensaje para un enlace inventado y para uno reemplazado: distinguirlos le diría a
  // quien prueba al azar cuándo acertó.
  if (!acceso) {
    return <Aviso titulo="Este enlace no funciona" texto="Puede que hayas pedido uno nuevo, o que esté incompleto." />;
  }
  const estado = estadoDelAcceso(acceso, new Date());
  if (estado === "VENCIDO") {
    return (
      <Aviso
        titulo="Tu acceso venció"
        texto={`Tu acceso a ${acceso.course.title} terminó el ${fechaLegibleArgentina(acceso.expiresAt)}.`}
      />
    );
  }
  if (estado === "REVOCADO") {
    return <Aviso titulo="Este enlace no funciona" texto="Puede que hayas pedido uno nuevo, o que esté incompleto." />;
  }

  const { clases, porcentaje } = armarAula(acceso.course.lessons, acceso.progress);
  const siguiente = clases.find((c) => !c.completada) ?? clases[0];

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 md:px-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--fo-accent)]">Mi aula</p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{acceso.course.title}</h1>
        <p className="text-sm text-[var(--fo-muted)]">
          Hola {acceso.enrollment.name}. Tenés acceso hasta el {fechaLegibleArgentina(acceso.expiresAt)}.
        </p>
      </header>

      <section className="fo-card space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="font-medium">Tu avance</p>
          <p className="text-sm text-[var(--fo-muted)]">{porcentaje}%</p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--fo-border)]" aria-hidden>
          <div className="h-full bg-[var(--fo-accent)]" style={{ width: `${porcentaje}%` }} />
        </div>
        {siguiente ? (
          <Link href={`/aula/${token}/clase/${siguiente.id}`} className="fo-btn fo-btn-primary mt-2 inline-flex text-sm">
            {porcentaje === 0 ? "Empezar" : "Seguir mirando"}
          </Link>
        ) : null}
      </section>

      <section className="fo-card space-y-3">
        <h2 className="text-lg font-semibold">Clases</h2>
        {clases.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no hay clases listas para ver.</p>
        ) : (
          <ol className="space-y-2">
            {clases.map((clase, i) => (
              <li key={clase.id}>
                <Link
                  href={`/aula/${token}/clase/${clase.id}`}
                  className="flex items-center justify-between gap-3 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3 hover:border-[var(--fo-accent)]"
                >
                  <span className="min-w-0">
                    <span aria-label={clase.completada ? "Vista" : "Sin ver"}>{clase.completada ? "✓ " : ""}</span>
                    {i + 1}. {clase.title}
                  </span>
                  <span className="shrink-0 text-sm text-[var(--fo-muted)]">{duracionLegible(clase.durationSeconds)}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
```

Antes de escribirlo, confirmá en `node_modules/next/dist/docs/` que `Metadata` acepta
`referrer` en esta versión.

- [ ] **Step 5: Tipos y tests**

Run: `pnpm --filter fotoffice test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: verde y sin errores de tipos.

- [ ] **Step 6: Commit**

```bash
git add lib/course-classroom/lookup.ts "app/aula/[token]/page.tsx" lib/entrada/institution-shortcut.ts
git commit -m "Cursos grabados: el aula del alumno, con sus clases y su avance"
```

---

### Task 8: Recibir el avance

**Files:**
- Create: `lib/course-classroom/report-schema.ts`
- Test: `lib/course-classroom/report-schema.test.ts`
- Create: `app/api/aula/[token]/avance/route.ts`

**Interfaces:**
- Consumes: `aplicarReporte` (Task 3), `buscarAccesoPorToken` (Task 7), `estadoDelAcceso` (Task 2).
- Produces:
  - `leerReporte(cuerpo: unknown): { ok: true; reporte: { lessonId: string; positionSeconds: number; watchedSinceLastReport: number } } | { ok: false }`
  - `POST /api/aula/<token>/avance` con cuerpo JSON `{ lessonId, positionSeconds, watchedSinceLastReport }` → `200 { ok: true, completada: boolean }`, `400`, `403` o `404`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// lib/course-classroom/report-schema.test.ts
import { describe, expect, it } from "vitest";
import { leerReporte } from "./report-schema";

describe("leer el reporte de avance", () => {
  it("acepta un reporte bien formado", () => {
    expect(leerReporte({ lessonId: "c1", positionSeconds: 30.5, watchedSinceLastReport: 15 })).toEqual({
      ok: true,
      reporte: { lessonId: "c1", positionSeconds: 30.5, watchedSinceLastReport: 15 },
    });
  });

  it("rechaza lo que no es un reporte", () => {
    expect(leerReporte(null).ok).toBe(false);
    expect(leerReporte({ lessonId: "", positionSeconds: 1, watchedSinceLastReport: 1 }).ok).toBe(false);
    expect(leerReporte({ lessonId: "c1", positionSeconds: "30", watchedSinceLastReport: 1 }).ok).toBe(false);
    expect(leerReporte({ lessonId: "c1", positionSeconds: -1, watchedSinceLastReport: 1 }).ok).toBe(false);
    expect(leerReporte({ lessonId: "c1", positionSeconds: 1, watchedSinceLastReport: 99999 }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/course-classroom/report-schema.test.ts`
Expected: FAIL — `Failed to resolve import "./report-schema"`.

- [ ] **Step 3: Implementar**

```ts
// lib/course-classroom/report-schema.ts
import { z } from "zod";

const esquema = z.object({
  lessonId: z.string().min(1).max(40),
  positionSeconds: z.number().finite().min(0).max(24 * 60 * 60),
  watchedSinceLastReport: z.number().finite().min(0).max(60 * 60),
});

/** El cuerpo llega del navegador: se valida forma y rango antes de mirarlo. */
export function leerReporte(
  cuerpo: unknown,
):
  | { ok: true; reporte: { lessonId: string; positionSeconds: number; watchedSinceLastReport: number } }
  | { ok: false } {
  const r = esquema.safeParse(cuerpo);
  return r.success ? { ok: true, reporte: r.data } : { ok: false };
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `pnpm --filter fotoffice test lib/course-classroom/report-schema.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: La ruta**

```ts
// app/api/aula/[token]/avance/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { buscarAccesoPorToken } from "@/lib/course-classroom/lookup";
import { estadoDelAcceso } from "@/lib/course-classroom/access-rules";
import { aplicarReporte } from "@/lib/course-classroom/progress-rules";
import { leerReporte } from "@/lib/course-classroom/report-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lo que el reproductor informa cada 15 segundos.
 *
 * Toda la desconfianza está en `aplicarReporte`: acá sólo se comprueba que el enlace sea
 * vigente y que la clase sea de ese curso.
 */
export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const leido = leerReporte(await request.json().catch(() => null));
  if (!leido.ok) return NextResponse.json({ ok: false }, { status: 400 });

  const acceso = await buscarAccesoPorToken(token);
  if (!acceso || estadoDelAcceso(acceso, new Date()) !== "VIGENTE") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const clase = acceso.course.lessons.find(
    (l) => l.id === leido.reporte.lessonId && l.videoStatus === "READY",
  );
  if (!clase) return NextResponse.json({ ok: false }, { status: 404 });

  const clave = { accessId_lessonId: { accessId: acceso.id, lessonId: clase.id } };
  const previo = await prisma.courseLessonProgress.findUnique({ where: clave });
  const nuevo = aplicarReporte({
    previo,
    reporte: leido.reporte,
    ahora: new Date(),
    duracionSegundos: clase.durationSeconds,
  });
  await prisma.courseLessonProgress.upsert({
    where: clave,
    create: { accessId: acceso.id, lessonId: clase.id, ...nuevo },
    update: nuevo,
  });
  return NextResponse.json({ ok: true, completada: nuevo.completedAt !== null });
}
```

Confirmá en `node_modules/next/dist/docs/` la forma del segundo argumento de una route handler
en esta versión (si existe un tipo `RouteContext`, usalo).

- [ ] **Step 6: Tipos**

Run: `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add lib/course-classroom/report-schema.ts lib/course-classroom/report-schema.test.ts "app/api/aula/[token]/avance/route.ts"
git commit -m "Cursos grabados: recibir el avance del reproductor"
```

---

### Task 9: La clase — reproductor protegido con marca de agua

**Files:**
- Create: `lib/course-classroom/watermark.ts`
- Test: `lib/course-classroom/watermark.test.ts`
- Create: `components/course-classroom/lesson-player.tsx`
- Create: `app/aula/[token]/clase/[lessonId]/page.tsx`

**Interfaces:**
- Consumes: `signPlaybackToken`, `playbackIframeUrl`, `DURACION_PERMISO_SEGUNDOS`, `StreamError` (Task 4); `buscarAccesoPorToken` (Task 7); `armarAula` (Task 3); `estadoDelAcceso`, `numeroDeInscripcion` (Task 2); `INTERVALO_REPORTE_SEGUNDOS` (Task 3); `clientIp` de `@/lib/geocode/rate-limit`; `logCourseEvent`.
- Produces:
  - `SEGUNDOS_POR_POSICION = 25`
  - `textoDeMarca(input: { nombre: string; dni: string; numero: string }): string`
  - `posicionDeMarca(paso: number): { top: number; left: number }` (porcentajes)
  - `LessonPlayer({ iframeUrl, marca, reporte }: { iframeUrl: string; marca: string | null; reporte: { url: string; lessonId: string } | null })`

- [ ] **Step 1: Escribir el test de la marca de agua**

```ts
// lib/course-classroom/watermark.test.ts
import { describe, expect, it } from "vitest";
import { posicionDeMarca, textoDeMarca } from "./watermark";

describe("marca de agua", () => {
  it("lleva nombre, documento y número de inscripción", () => {
    expect(textoDeMarca({ nombre: "Ana Pérez", dni: "30123456", numero: "XYZ123" })).toBe(
      "Ana Pérez · DNI 30123456 · #XYZ123",
    );
  });

  it("cambia de lugar en cada paso", () => {
    for (let paso = 0; paso < 20; paso++) {
      expect(posicionDeMarca(paso)).not.toEqual(posicionDeMarca(paso + 1));
    }
  });

  it("nunca se sale de la imagen", () => {
    for (let paso = 0; paso < 50; paso++) {
      const { top, left } = posicionDeMarca(paso);
      expect(top).toBeGreaterThanOrEqual(5);
      expect(top).toBeLessThanOrEqual(85);
      expect(left).toBeGreaterThanOrEqual(5);
      expect(left).toBeLessThanOrEqual(60);
    }
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/course-classroom/watermark.test.ts`
Expected: FAIL — `Failed to resolve import "./watermark"`.

- [ ] **Step 3: Implementar**

```ts
// lib/course-classroom/watermark.ts
/**
 * La marca de agua sobre el video.
 *
 * **Disuade, no impide** (spec, sección 4): alguien con conocimientos la quita desde el
 * navegador. Contra el caso real —filmar la pantalla y pasar el archivo— sirve, porque la copia
 * lleva escrito quién la filtró. Cambia de lugar para que no se pueda tapar con un recorte fijo.
 */

export const SEGUNDOS_POR_POSICION = 25;

export function textoDeMarca(input: { nombre: string; dni: string; numero: string }): string {
  return `${input.nombre} · DNI ${input.dni} · #${input.numero}`;
}

/** Seis lugares repartidos por la imagen; el orden salta para que no sea una vuelta previsible. */
const POSICIONES = [
  { top: 8, left: 6 },
  { top: 78, left: 55 },
  { top: 40, left: 30 },
  { top: 12, left: 52 },
  { top: 82, left: 8 },
  { top: 55, left: 58 },
];
const ORDEN = [0, 3, 1, 5, 2, 4];

export function posicionDeMarca(paso: number): { top: number; left: number } {
  const i = ((Math.floor(paso) % ORDEN.length) + ORDEN.length) % ORDEN.length;
  return POSICIONES[ORDEN[i]];
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `pnpm --filter fotoffice test lib/course-classroom/watermark.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: El reproductor**

El SDK del reproductor de Stream (`https://embed.cloudflarestream.com/embed/sdk.latest.js`)
expone `window.Stream(iframe)`, con `currentTime`, `paused` y eventos `timeupdate`, `pause`,
`ended`. Se carga con `next/script`; no es una dependencia del lockfile.

```tsx
// components/course-classroom/lesson-player.tsx
"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { INTERVALO_REPORTE_SEGUNDOS } from "@/lib/course-classroom/progress-rules";
import { posicionDeMarca, SEGUNDOS_POR_POSICION } from "@/lib/course-classroom/watermark";

type StreamPlayer = {
  currentTime: number;
  paused: boolean;
  addEventListener: (evento: string, fn: () => void) => void;
  removeEventListener: (evento: string, fn: () => void) => void;
};

declare global {
  interface Window {
    Stream?: (iframe: HTMLIFrameElement) => StreamPlayer;
  }
}

/**
 * El video de una clase.
 *
 * - La marca de agua va **encima** del iframe, en un contenedor propio. Por eso la pantalla
 *   completa es la del contenedor (botón propio) y el iframe no la permite, ni tampoco
 *   picture-in-picture: las dos dejarían la marca afuera.
 * - El avance cuenta sólo la reproducción normal: un salto de la barra no suma. Igual el
 *   servidor desconfía (ver `progress-rules.ts`).
 * - `reporte` en null = clase de muestra: no se informa nada.
 */
export function LessonPlayer({
  iframeUrl,
  marca,
  reporte,
}: {
  iframeUrl: string;
  marca: string | null;
  reporte: { url: string; lessonId: string } | null;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const jugador = useRef<StreamPlayer | null>(null);
  const ultimoTiempo = useRef<number | null>(null);
  const acumulado = useRef(0);
  const [sdkListo, setSdkListo] = useState(false);
  const [paso, setPaso] = useState(0);

  useEffect(() => {
    if (!marca) return;
    const id = setInterval(() => setPaso((p) => p + 1), SEGUNDOS_POR_POSICION * 1000);
    return () => clearInterval(id);
  }, [marca]);

  const enviar = useCallback(() => {
    if (!reporte || !jugador.current) return;
    const visto = Math.floor(acumulado.current);
    if (visto <= 0) return;
    acumulado.current -= visto;
    void fetch(reporte.url, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lessonId: reporte.lessonId,
        positionSeconds: Math.floor(jugador.current.currentTime),
        watchedSinceLastReport: visto,
      }),
    }).catch(() => {});
  }, [reporte]);

  useEffect(() => {
    if (!sdkListo || !iframe.current || !window.Stream) return;
    const p = window.Stream(iframe.current);
    jugador.current = p;

    const alAvanzar = () => {
      const t = p.currentTime;
      const previo = ultimoTiempo.current;
      ultimoTiempo.current = t;
      if (previo === null || p.paused) return;
      const delta = t - previo;
      if (delta > 0 && delta < 2) acumulado.current += delta;
    };
    const alFrenar = () => enviar();
    const alOcultar = () => {
      if (document.visibilityState === "hidden") enviar();
    };

    p.addEventListener("timeupdate", alAvanzar);
    p.addEventListener("pause", alFrenar);
    p.addEventListener("ended", alFrenar);
    document.addEventListener("visibilitychange", alOcultar);
    const intervalo = setInterval(enviar, INTERVALO_REPORTE_SEGUNDOS * 1000);

    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alOcultar);
      p.removeEventListener("timeupdate", alAvanzar);
      p.removeEventListener("pause", alFrenar);
      p.removeEventListener("ended", alFrenar);
      enviar();
    };
  }, [sdkListo, enviar]);

  const { top, left } = posicionDeMarca(paso);

  return (
    <div className="space-y-2">
      <Script
        src="https://embed.cloudflarestream.com/embed/sdk.latest.js"
        onLoad={() => setSdkListo(true)}
        onReady={() => setSdkListo(true)}
      />
      <div
        ref={contenedor}
        className="relative w-full overflow-hidden rounded-[var(--fo-radius)] bg-black"
        style={{ aspectRatio: "16 / 9" }}
      >
        <iframe
          ref={iframe}
          src={iframeUrl}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; gyroscope; autoplay; encrypted-media"
          title="Video de la clase"
        />
        {marca ? (
          <div
            aria-hidden
            className="pointer-events-none absolute select-none whitespace-nowrap text-xs font-medium text-white/40 transition-all duration-700 md:text-sm"
            style={{ top: `${top}%`, left: `${left}%`, textShadow: "0 0 2px rgba(0,0,0,.6)" }}
          >
            {marca}
          </div>
        ) : null}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          className="fo-btn fo-btn-secondary text-sm"
          onClick={() => void contenedor.current?.requestFullscreen?.()}
        >
          Pantalla completa
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: La página de la clase**

```tsx
// app/aula/[token]/clase/[lessonId]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { buscarAccesoPorToken } from "@/lib/course-classroom/lookup";
import { estadoDelAcceso, numeroDeInscripcion } from "@/lib/course-classroom/access-rules";
import { armarAula } from "@/lib/course-classroom/aula";
import { textoDeMarca } from "@/lib/course-classroom/watermark";
import {
  DURACION_PERMISO_SEGUNDOS,
  playbackIframeUrl,
  signPlaybackToken,
  StreamError,
} from "@/lib/courses-video/stream";
import { clientIp } from "@/lib/geocode/rate-limit";
import { logCourseEvent } from "@/lib/presential-courses/log";
import { LessonPlayer } from "@/components/course-classroom/lesson-player";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clase",
  robots: { index: false, follow: false },
  referrer: "strict-origin",
};

export default async function ClasePage({
  params,
}: {
  params: Promise<{ token: string; lessonId: string }>;
}) {
  const { token, lessonId } = await params;
  const acceso = await buscarAccesoPorToken(token);
  const volver = (
    <Link href={`/aula/${token}`} className="text-sm text-[var(--fo-accent)] underline">
      Volver al aula
    </Link>
  );

  if (!acceso || estadoDelAcceso(acceso, new Date()) !== "VIGENTE") {
    return (
      <main className="mx-auto max-w-md px-5 py-12 text-center space-y-3">
        <p className="font-semibold">No podés ver esta clase con este enlace.</p>
        {volver}
      </main>
    );
  }

  const { clases } = armarAula(acceso.course.lessons, acceso.progress);
  const indice = clases.findIndex((c) => c.id === lessonId);
  const leccion = acceso.course.lessons.find((l) => l.id === lessonId);
  if (indice === -1 || !leccion?.videoUid) {
    return (
      <main className="mx-auto max-w-md px-5 py-12 text-center space-y-3">
        <p className="font-semibold">Esta clase no está disponible.</p>
        {volver}
      </main>
    );
  }
  const clase = clases[indice];
  const anterior = clases[indice - 1];
  const siguiente = clases[indice + 1];

  let iframeUrl: string | null = null;
  try {
    iframeUrl = playbackIframeUrl(
      signPlaybackToken({ videoUid: leccion.videoUid, ttlSeconds: DURACION_PERMISO_SEGUNDOS }),
      { startSeconds: clase.retomarDesde },
    );
  } catch (error) {
    if (!(error instanceof StreamError)) throw error;
    console.error("[fotoffice][cursos] no se pudo firmar la reproducción", { lessonId, motivo: error.message });
  }

  // Registro de reproducciones (spec, sección 4, capa 4). El origen va hasheado: sirve para ver
  // un mismo acceso desde muchos lugares a la vez sin guardar direcciones IP.
  const origen = createHash("sha256").update(clientIp(new Headers(await headers()))).digest("hex").slice(0, 12);
  logCourseEvent("aula_reproduccion_autorizada", {
    accessId: acceso.id,
    lessonId,
    origen,
    firmada: iframeUrl !== null,
  });

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-8 md:px-8">
      <div className="flex items-center justify-between gap-3">
        {volver}
        <p className="text-sm text-[var(--fo-muted)]">
          Clase {indice + 1} de {clases.length}
        </p>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{clase.title}</h1>

      {iframeUrl ? (
        <LessonPlayer
          iframeUrl={iframeUrl}
          marca={textoDeMarca({
            nombre: acceso.enrollment.name,
            dni: acceso.enrollment.dni,
            numero: numeroDeInscripcion(acceso.enrollment.id),
          })}
          reporte={{ url: `/api/aula/${token}/avance`, lessonId }}
        />
      ) : (
        <div className="fo-card text-sm text-[var(--fo-muted)]">El video no está disponible en este momento.</div>
      )}

      {leccion.description ? (
        <section className="fo-card">
          <p className="whitespace-pre-line text-sm leading-relaxed">{leccion.description}</p>
        </section>
      ) : null}

      <nav className="flex justify-between gap-3">
        {anterior ? (
          <Link href={`/aula/${token}/clase/${anterior.id}`} className="fo-btn fo-btn-secondary text-sm">
            ← {anterior.title}
          </Link>
        ) : (
          <span />
        )}
        {siguiente ? (
          <Link href={`/aula/${token}/clase/${siguiente.id}`} className="fo-btn fo-btn-primary text-sm">
            {siguiente.title} →
          </Link>
        ) : null}
      </nav>
    </main>
  );
}
```

- [ ] **Step 7: Tipos y tests**

Run: `pnpm --filter fotoffice test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: verde y sin errores.

- [ ] **Step 8: Comprobar a mano lo que se puede en local**

En local el video **no va a reproducir**: los videos sólo admiten `fotoffice.com` como origen.
Sí se comprueba: con un acceso de prueba creado a mano en la base local (token conocido, hash
con `hashInvitationToken`), `/aula/<token>` lista las clases; `/aula/<token>/clase/<id>` muestra
el título, la marca de agua sobre el recuadro negro y, sin `STREAM_*`, el aviso "El video no está
disponible en este momento" sin romper la página. Un token inventado muestra "Este enlace no
funciona".

- [ ] **Step 9: Commit**

```bash
git add lib/course-classroom/watermark.ts lib/course-classroom/watermark.test.ts components/course-classroom/lesson-player.tsx "app/aula/[token]/clase/[lessonId]/page.tsx"
git commit -m "Cursos grabados: la clase con el video protegido y la marca de agua"
```

---

### Task 10: La clase de muestra gratuita

**Files:**
- Create: `app/w/[workspaceSlug]/cursos/[courseSlug]/muestra/[lessonId]/page.tsx`

**Interfaces:**
- Consumes: `signPlaybackToken`, `playbackIframeUrl`, `DURACION_PERMISO_SEGUNDOS`, `StreamError` (Task 4); `LessonPlayer` (Task 9) con `marca={null}` y `reporte={null}`; `COURSES_SALES_MODULE_KEY` de `@/lib/courses-sales/constants`.

- [ ] **Step 1: La página**

```tsx
// app/w/[workspaceSlug]/cursos/[courseSlug]/muestra/[lessonId]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import {
  DURACION_PERMISO_SEGUNDOS,
  playbackIframeUrl,
  signPlaybackToken,
  StreamError,
} from "@/lib/courses-video/stream";
import { LessonPlayer } from "@/components/course-classroom/lesson-player";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string; courseSlug: string; lessonId: string }> };

/**
 * Una clase marcada como muestra: se ve sin pagar. Sin marca de agua (no hay alumno que
 * identificar) y sin avance. Sólo clases `isPreview` de cursos grabados publicados.
 */
export default async function MuestraPage({ params }: Props) {
  const { workspaceSlug, courseSlug, lessonId } = await params;
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true },
  });
  if (!branding) notFound();

  const mod = await prisma.workspaceFeatureModule.findUnique({
    where: { workspaceId_moduleKey: { workspaceId: branding.workspaceId, moduleKey: COURSES_SALES_MODULE_KEY } },
  });
  if (!mod?.enabled) notFound();

  const leccion = await prisma.courseLesson.findFirst({
    where: {
      id: lessonId,
      isPreview: true,
      videoStatus: "READY",
      videoUid: { not: null },
      course: {
        workspaceId: branding.workspaceId,
        slug: courseSlug,
        status: "PUBLISHED",
        deliveryMode: "RECORDED",
      },
    },
    select: { title: true, description: true, videoUid: true, course: { select: { title: true } } },
  });
  if (!leccion?.videoUid) notFound();

  let iframeUrl: string | null = null;
  try {
    iframeUrl = playbackIframeUrl(
      signPlaybackToken({ videoUid: leccion.videoUid, ttlSeconds: DURACION_PERMISO_SEGUNDOS }),
    );
  } catch (error) {
    if (!(error instanceof StreamError)) throw error;
  }

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-8 md:px-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--fo-accent)]">
        Clase de muestra · {leccion.course.title}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">{leccion.title}</h1>
      {iframeUrl ? (
        <LessonPlayer iframeUrl={iframeUrl} marca={null} reporte={null} />
      ) : (
        <div className="fo-card text-sm text-[var(--fo-muted)]">El video no está disponible en este momento.</div>
      )}
      {leccion.description ? (
        <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--fo-muted)]">{leccion.description}</p>
      ) : null}
      <Link href={`/w/${workspaceSlug}/cursos/${courseSlug}`} className="fo-btn fo-btn-primary text-sm">
        Ver el curso completo
      </Link>
    </main>
  );
}
```

- [ ] **Step 2: Tipos**

Run: `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "app/w/[workspaceSlug]/cursos/[courseSlug]/muestra"
git commit -m "Cursos grabados: la clase de muestra se ve sin pagar"
```

---

### Task 11: "¿Perdiste el enlace?"

**Files:**
- Modify: `lib/course-classroom/grant.ts` (agregar `reenviarEnlaces`)
- Test: `lib/course-classroom/grant.test.ts` (agregar casos)
- Create: `app/actions/course-classroom.ts`
- Create: `app/aula/recuperar/page.tsx`, `app/aula/recuperar/form.tsx`

**Interfaces:**
- Consumes: `generateInvitationToken`, `hashInvitationToken`; `enlaceDelAula`, `sendClassroomAccessEmail` (Task 6); `loadWorkspaceSignature`.
- Produces:
  - `type ReenvioDeps = { buscar: (email: string, ahora: Date) => Promise<Array<{ id: string; workspaceId: string; expiresAt: Date; to: string; studentName: string; courseTitle: string }>>; guardarHash: (accessId: string, tokenHash: string) => Promise<void>; enviar: typeof sendClassroomAccessEmail; cargarFirma: (workspaceId: string) => Promise<RenderedEmailSignature | null>; base: string; generarToken: () => string }`
  - `reenviarEnlaces(email: string, deps?: ReenvioDeps, ahora?: Date): Promise<{ enviados: number }>`
  - `pedirEnlaceDelAula(_prev: { mensaje: string | null }, formData: FormData): Promise<{ mensaje: string }>` (server action)

- [ ] **Step 1: Agregar los tests que fallan a `grant.test.ts`**

```ts
import { hashInvitationToken } from "@/lib/members/invitation-tokens";
import { reenviarEnlaces, type ReenvioDeps } from "./grant";

describe("reenviar el enlace del aula", () => {
  const ahora = new Date(Date.UTC(2026, 9, 3));
  const acceso = (id: string) => ({
    id,
    workspaceId: "ws-1",
    expiresAt: new Date(Date.UTC(2027, 9, 3)),
    to: "ana@example.com",
    studentName: "Ana",
    courseTitle: `Curso ${id}`,
  });

  function depsReenvio(parcial: Partial<ReenvioDeps> = {}): ReenvioDeps {
    let n = 0;
    return {
      buscar: vi.fn().mockResolvedValue([acceso("a1"), acceso("a2")]),
      guardarHash: vi.fn().mockResolvedValue(undefined),
      enviar: vi.fn().mockResolvedValue({ sent: true }),
      cargarFirma: vi.fn().mockResolvedValue(null),
      base: "https://fotoffice.com",
      generarToken: () => `tok-${++n}`,
      ...parcial,
    };
  }

  it("un enlace nuevo por cada curso vigente, y el viejo deja de servir", async () => {
    const d = depsReenvio();
    const r = await reenviarEnlaces(" Ana@Example.com ", d, ahora);
    expect(r).toEqual({ enviados: 2 });
    expect(d.buscar).toHaveBeenCalledWith("ana@example.com", ahora);
    expect(d.guardarHash).toHaveBeenCalledWith("a1", hashInvitationToken("tok-1"));
    expect(d.guardarHash).toHaveBeenCalledWith("a2", hashInvitationToken("tok-2"));
    expect(d.enviar).toHaveBeenCalledWith(
      expect.objectContaining({ enlace: "https://fotoffice.com/aula/tok-1", courseTitle: "Curso a1" }),
    );
  });

  it("sin cursos para ese correo no hace nada", async () => {
    const d = depsReenvio({ buscar: vi.fn().mockResolvedValue([]) });
    expect(await reenviarEnlaces("nadie@example.com", d, ahora)).toEqual({ enviados: 0 });
    expect(d.enviar).not.toHaveBeenCalled();
  });

  it("un correo que no parece correo ni consulta", async () => {
    const d = depsReenvio();
    expect(await reenviarEnlaces("hola", d, ahora)).toEqual({ enviados: 0 });
    expect(d.buscar).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/course-classroom/grant.test.ts`
Expected: FAIL — `reenviarEnlaces is not a function`.

- [ ] **Step 3: Implementar en `grant.ts`**

```ts
export type ReenvioDeps = {
  buscar: (
    email: string,
    ahora: Date,
  ) => Promise<
    Array<{ id: string; workspaceId: string; expiresAt: Date; to: string; studentName: string; courseTitle: string }>
  >;
  guardarHash: (accessId: string, tokenHash: string) => Promise<void>;
  enviar: typeof sendClassroomAccessEmail;
  cargarFirma: (workspaceId: string) => Promise<RenderedEmailSignature | null>;
  base: string;
  generarToken: () => string;
};

function depsReenvioPorDefecto(): ReenvioDeps {
  return {
    buscar: async (email, ahora) => {
      const accesos = await prisma.courseAccess.findMany({
        where: {
          revokedAt: null,
          expiresAt: { gt: ahora },
          enrollment: { email: { equals: email, mode: "insensitive" } },
        },
        select: {
          id: true,
          workspaceId: true,
          expiresAt: true,
          enrollment: { select: { email: true, name: true } },
          course: { select: { title: true } },
        },
      });
      return accesos.map((a) => ({
        id: a.id,
        workspaceId: a.workspaceId,
        expiresAt: a.expiresAt,
        to: a.enrollment.email,
        studentName: a.enrollment.name,
        courseTitle: a.course.title,
      }));
    },
    guardarHash: async (accessId, tokenHash) => {
      await prisma.courseAccess.update({ where: { id: accessId }, data: { tokenHash } });
    },
    enviar: sendClassroomAccessEmail,
    cargarFirma: loadWorkspaceSignature,
    base: (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim(),
    generarToken: generateInvitationToken,
  };
}

/**
 * Manda un enlace nuevo por cada curso vigente de ese correo.
 *
 * El enlace viejo deja de funcionar: en la base sólo hay un hash por acceso. El correo va
 * **siempre a la dirección de la inscripción**, nunca a otra, así que pedirlo por otro no le da
 * nada a quien lo pide. El resultado no se muestra: la pantalla dice lo mismo haya o no cursos.
 */
export async function reenviarEnlaces(
  email: string,
  deps: ReenvioDeps = depsReenvioPorDefecto(),
  ahora: Date = new Date(),
): Promise<{ enviados: number }> {
  const normalizado = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizado) || !deps.base) return { enviados: 0 };

  const accesos = await deps.buscar(normalizado, ahora);
  let enviados = 0;
  for (const acceso of accesos) {
    const token = deps.generarToken();
    await deps.guardarHash(acceso.id, hashInvitationToken(token));
    const envio = await deps.enviar({
      to: acceso.to,
      studentName: acceso.studentName,
      courseTitle: acceso.courseTitle,
      enlace: enlaceDelAula(deps.base, token),
      expiresAt: acceso.expiresAt,
      signature: await deps.cargarFirma(acceso.workspaceId),
    });
    if (envio.sent) enviados++;
    else logCourseEvent("aula_reenvio_no_enviado", { accessId: acceso.id, motivo: envio.reason });
  }
  return { enviados };
}
```

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `pnpm --filter fotoffice test lib/course-classroom/grant.test.ts`
Expected: PASS (5 + 3 tests).

- [ ] **Step 5: La acción y la pantalla**

```ts
// app/actions/course-classroom.ts
"use server";

import { reenviarEnlaces } from "@/lib/course-classroom/grant";

const MENSAJE =
  "Si ese correo tiene cursos vigentes, te mandamos un enlace nuevo. El anterior deja de funcionar.";

/** Siempre el mismo mensaje: no le dice a nadie si un correo compró algo o no. */
export async function pedirEnlaceDelAula(
  _prev: { mensaje: string | null },
  formData: FormData,
): Promise<{ mensaje: string }> {
  const email = formData.get("email")?.toString() ?? "";
  try {
    await reenviarEnlaces(email);
  } catch (error) {
    console.error("[fotoffice][cursos] falló el reenvío del enlace del aula", { error });
  }
  return { mensaje: MENSAJE };
}
```

```tsx
// app/aula/recuperar/form.tsx
"use client";

import { useActionState } from "react";
import { pedirEnlaceDelAula } from "@/app/actions/course-classroom";

export function RecuperarForm() {
  const [estado, accion, enviando] = useActionState(pedirEnlaceDelAula, { mensaje: null });
  return (
    <form action={accion} className="space-y-3">
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="email">
          El correo con el que compraste
        </label>
        <input id="email" name="email" type="email" required className="fo-input" />
      </div>
      <button type="submit" disabled={enviando} className="fo-btn fo-btn-primary text-sm">
        {enviando ? "Enviando…" : "Mandarme el enlace"}
      </button>
      {estado.mensaje ? <p className="text-sm text-[var(--fo-muted)]">{estado.mensaje}</p> : null}
    </form>
  );
}
```

```tsx
// app/aula/recuperar/page.tsx
import type { Metadata } from "next";
import { RecuperarForm } from "./form";

export const metadata: Metadata = {
  title: "Recuperar mi aula",
  robots: { index: false, follow: false },
};

export default function RecuperarAulaPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <div className="fo-card space-y-4 p-6">
        <h1 className="text-lg font-semibold">¿Perdiste el enlace de tu aula?</h1>
        <p className="text-sm text-[var(--fo-muted)]">
          Escribí el correo con el que compraste el curso y te mandamos uno nuevo.
        </p>
        <RecuperarForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Tipos y tests**

Run: `pnpm --filter fotoffice test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: verde y sin errores.

- [ ] **Step 7: Commit**

```bash
git add lib/course-classroom/grant.ts lib/course-classroom/grant.test.ts app/actions/course-classroom.ts app/aula/recuperar
git commit -m "Cursos grabados: el alumno puede pedir el enlace del aula de nuevo"
```

---

### Task 12: Despliegue y prueba real

Nada de esta tarea se hace sin que Daniel lo apruebe en el momento: aplica una migración en las
bases de producción, carga claves en Vercel y hace un cobro real.

**Files:**
- Modify: `docs/fotoffice/ESTADO-ACTUAL.md` (bloque de Cursos)
- Modify: `docs/estado-de-obra/fotoffice/cursos-grabados.json`, si el PR 300 ya está en `main`

- [ ] **Step 1: Build completo en el worktree**

Run: `pnpm --filter fotoffice build`
Expected: termina sin errores (el build de FOTOFFICE chequea tipos y tests).

- [ ] **Step 2: Abrir el PR, revisarlo y fusionarlo**

La implementación va en su propia rama (por ejemplo `feat/fotoffice-cursos-aula`, en un worktree nuevo desde `origin/main`), no en la rama de este plan.

```bash
git push -u origin feat/fotoffice-cursos-aula
gh pr create --title "Cursos grabados etapa 2: el aula del alumno" --body-file <archivo fuera del repo>
```

El cuerpo cuenta qué entra, qué queda afuera (sección de abajo) y los pasos 3-7 como lista de
verificación.

- [ ] **Step 3: Aplicar la migración en las cinco bases, antes del despliegue**

Desde `packages/db`, con el JSON de bases fuera del repo:

```bash
pnpm exec tsx scripts/migraciones-cinco-bases.mts --bases ~/neon-bases.json
pnpm exec tsx scripts/migraciones-cinco-bases.mts --bases ~/neon-bases.json --aplicar --solo 20261004120000_cursos_aula_alumno
```

Expected: el primer comando lista `20261004120000_cursos_aula_alumno` como pendiente en las
cinco; el segundo la aplica y la registra en `_prisma_migrations` en cada una. Una columna o
tabla que falta en una sola base rompe todo el modelo en esa app.

- [ ] **Step 4: Cargar las cuatro `STREAM_*` en Vercel producción**

La clave de firma se crea una sola vez (la respuesta trae `id` y `pem`; el `pem` va tal cual,
en base64):

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$STREAM_ACCOUNT_ID/stream/keys" -H "Authorization: Bearer $STREAM_API_TOKEN"
```

Variables: `STREAM_ACCOUNT_ID` (= `R2_ACCOUNT_ID`), `STREAM_API_TOKEN` (permiso Stream:Edit),
`STREAM_SIGNING_KEY_ID`, `STREAM_SIGNING_KEY_PEM`. Marcarlas como sensibles. Redesplegar.

- [ ] **Step 5: Confirmar el dominio desde el que se reproduce**

`APP_URL` de producción tiene que ser exactamente el origen permitido (`https://fotoffice.com`).
Si el sitio se sirve también como `www.fotoffice.com`, agregarlo a `ORIGENES_PERMITIDOS` en
`lib/courses-video/stream.ts` **y** actualizar los videos ya creados
(`POST /stream/<uid>` con `allowedOrigins`), porque el valor se fija al crear cada video.

- [ ] **Step 6: Prueba de punta a punta (criterio de la etapa 2 en la spec)**

1. En una institución de prueba con Mercado Pago conectado: un curso grabado publicado, precio
   bajo, una clase de muestra y una clase normal, las dos en "Lista". Verificar antes el
   preflight CORS de la subida directa (riesgo de la spec, sección 12).
2. Daniel compra el curso con un pago real.
3. Llega el correo "Tu acceso a …" con el enlace. Comprobar en Resend que salió.
4. El enlace abre el aula; la clase reproduce, con la marca de agua moviéndose.
5. Mirar dos minutos y consultar la base: `CourseLessonProgress` tiene `secondsWatched`
   cercano a 120 (no 0, no la duración entera).
6. Copiar el `src` del iframe y pegarlo en otra pestaña. **Anotar lo que pasa, sin maquillar.**
   El criterio de la spec es que no reproduzca. Si reproduce dentro de las 2 horas del permiso,
   es un hallazgo: se documenta y se decide aparte (acortar el permiso, reglas de acceso de
   Stream), no se da la etapa por cerrada.
7. Pedir un enlace nuevo en `/aula/recuperar`: llega, y el enlace viejo ya muestra "Este enlace
   no funciona".
8. La clase de muestra se ve sin comprar, desde la página pública.

- [ ] **Step 7: Dejar escrito el estado**

En `docs/fotoffice/ESTADO-ACTUAL.md`, bloque de Cursos: etapa 2 en producción, con la fecha, el
resultado de cada punto del paso 6 y lo que quedó afuera. Commit y PR aparte si el anterior ya
está fusionado.

---

## Fuera de este plan

| Qué | Por qué no ahora |
|---|---|
| "Mis cursos" con todos los cursos de una persona | Necesita el alumno como persona (cuenta o identidad), que todavía no existe |
| Materiales de la clase | El panel no permite subirlos; subida y descarga van juntas |
| Aviso de cuenta compartida | Esta etapa sólo registra (evento con origen hasheado). Avisar necesita tabla y pantalla |
| Pantalla de inscriptos y avance en el panel del fotógrafo | Ninguna pantalla del panel lee `CourseEnrollment` hoy; es su propia etapa |
| Consultas por clase | Etapa 3 |
| Certificado por porcentaje visto | Etapa 4 (`Course.completionPercent` ya existe; el avance de esta etapa es su insumo) |
| Reproducir en el dominio propio de la institución | Exige agregar cada dominio a `allowedOrigins` de cada video |
| Unificar `CourseSales*` con `Course` | Decisión pendiente de Daniel, anotada en la auditoría del 21/09 |
