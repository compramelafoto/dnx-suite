# Testimonios y relación de calidad en Clickatón — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una encuesta de satisfacción post-evento que mide la calidad de cada edición de Clickatón y alimenta una sección de testimonios moderada en la home y en cada ficha de maratón.

**Architecture:** Tres tablas nuevas (`ClickatonSurveyResponse` privada, `ClickatonTestimonial` publicable, `ClickatonTestimonialInvite` para el correo) bajo `apps/clickaton/lib/testimonials/` con la separación dominio / aplicación / infraestructura que ya usan `gift-vouchers` y `photo-upload`. El dominio es puro y testeable con `tsx --test`; la infraestructura toca Prisma; las pantallas son Server Components con Server Actions.

**Tech Stack:** Next.js 16.2.1 (App Router, `--webpack`), React 19.2.4, Prisma vía `@repo/db`, `tsx --test` (runner de Node) para pruebas, `sendIdentityEmail` de `@repo/auth` + `EmailQueue` para correo, R2 vía `getWelcomeCardStorage()` para imágenes.

**Spec:** `docs/superpowers/specs/2026-09-22-clickaton-testimonios-y-calidad-design.md`

## Global Constraints

- **Idioma del producto:** todo el texto visible va en español rioplatense. Los identificadores, campos de Prisma y nombres de archivo van en inglés, como el resto del repositorio.
- **La crítica constructiva (`improvementNotes`) no se publica jamás.** Vive sólo en `ClickatonSurveyResponse` y ninguna consulta pública puede seleccionar esa tabla.
- **Estado inicial de todo testimonio: `PENDING`.** Nada llega a la home sin una acción explícita del admin.
- **El módulo nace apagado:** `ClickatonEdition.testimonialsEnabled` por defecto `false`.
- **No se agregan dependencias nuevas.** El lockfile es compartido por todas las apps del monorepo.
- **No se toca `lib/content/public-media-keys.ts`.** El namespace `profile` sigue fuera de la allowlist pública.
- **Clases de Tailwind:** usar sólo tokens que existan en `app/globals.css` / `styles`. `cn()` no hace tailwind-merge; una clase inventada se pinta transparente sin avisar.
- **Fechas:** para mostrar horas usar los helpers `lib/fecha-ar.ts` / `lib/hora-argentina.ts`, nunca `toLocaleString` a secas.
- **Límites de texto:** `quote` ≤ 400 caracteres, `highlightedExcerpt` ≤ 240, `improvementNotes` ≤ 1000.
- **Inscripciones `isOpsTest` y ediciones `isOpsFixture` nunca reciben correo ni aparecen en métricas públicas.**
- Cada módulo nuevo de pruebas se registra como script `test:<nombre>` en `apps/clickaton/package.json`.

---

### Task 1: Modelo de datos y migración SQL

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (enums nuevos junto al resto de enums `Clickaton*`; modelos nuevos después de `ClickatonHomeBannerSettings`; dos campos nuevos en `ClickatonEdition`)
- Create: `packages/db/prisma/migrations/20260922000000_clickaton_testimonials/migration.sql`

**Interfaces:**
- Consumes: nada.
- Produces: los modelos `ClickatonSurveyResponse`, `ClickatonTestimonial`, `ClickatonTestimonialInvite` y los enums `ClickatonTestimonialAuthorRole`, `ClickatonTestimonialStatus`, `ClickatonSurveyWouldReturn`, `ClickatonTestimonialInviteStatus` en el cliente de Prisma. Todas las tareas siguientes dependen de esto.

- [ ] **Step 1: Agregar los enums al esquema**

```prisma
enum ClickatonTestimonialAuthorRole {
  PARTICIPANT
  JUROR
  VENUE
}

enum ClickatonTestimonialStatus {
  PENDING
  PUBLISHED
  REJECTED
}

enum ClickatonSurveyWouldReturn {
  YES
  MAYBE
  NO
}

enum ClickatonTestimonialInviteStatus {
  PENDING
  SENT
  FAILED
  RESPONDED
}
```

- [ ] **Step 2: Agregar los dos campos a `ClickatonEdition`**

Junto a los demás interruptores de módulo, antes del bloque de relaciones:

```prisma
  /// Encuesta de satisfacción y testimonios (módulo nace apagado).
  testimonialsEnabled        Boolean                               @default(false)
  /// Días después de `endAt` en que sale la invitación a testimoniar.
  testimonialInviteDelayDays Int                                   @default(2)
```

Y en el bloque de relaciones:

```prisma
  surveyResponses     ClickatonSurveyResponse[]
  testimonials        ClickatonTestimonial[]
  testimonialInvites  ClickatonTestimonialInvite[]
```

- [ ] **Step 3: Agregar los tres modelos**

```prisma
/// Encuesta de satisfacción. PRIVADA: no existe ninguna ruta pública que la lea.
model ClickatonSurveyResponse {
  id                  String                         @id @default(cuid())
  editionId           String
  userId              Int
  authorRole          ClickatonTestimonialAuthorRole
  /// Origen de la identidad (soft refs; sólo una está poblada).
  registrationId      String?
  venueId             String?
  /// 0..10 — "¿Qué tan probable es que lo recomiendes?"
  npsScore            Int
  /// 1..5 cada una; null = "No aplica" y no promedia.
  scoreOrganization   Int?
  scorePrompts        Int?
  scoreVenue          Int?
  scoreKit            Int?
  scoreAccreditation  Int?
  scoreCommunication  Int?
  scoreValueForMoney  Int?
  wouldReturn         ClickatonSurveyWouldReturn?
  /// Crítica constructiva. NUNCA se publica ni se copia a ClickatonTestimonial.
  improvementNotes    String?
  submittedAt         DateTime                       @default(now())
  updatedAt           DateTime                       @updatedAt
  auditIp             String?
  auditUserAgent      String?
  edition             ClickatonEdition               @relation(fields: [editionId], references: [id], onDelete: Restrict)
  testimonial         ClickatonTestimonial?

  @@unique([editionId, userId])
  @@index([editionId, authorRole])
  @@index([editionId, npsScore])
}

/// El texto publicable y la identidad congelada del autor.
model ClickatonTestimonial {
  id                  String                         @id @default(cuid())
  surveyResponseId    String                         @unique
  editionId           String
  userId              Int
  authorRole          ClickatonTestimonialAuthorRole
  /// Lo que escribió el autor (≤400). No se reescribe.
  quote               String
  /// El recorte que elige el admin para la home (≤240).
  highlightedExcerpt  String?
  status              ClickatonTestimonialStatus     @default(PENDING)
  publicationConsent  Boolean                        @default(false)
  consentAcceptedAt   DateTime?
  /// Foto de la identidad al responder: cambiar el perfil no reescribe lo publicado.
  authorName          String
  authorPhotoAssetId  String?
  authorLinkUrl       String?
  displayOrder        Int                            @default(0)
  isFeatured          Boolean                        @default(false)
  publishedAt         DateTime?
  moderatedByUserId   Int?
  moderationNotes     String?
  createdAt           DateTime                       @default(now())
  updatedAt           DateTime                       @updatedAt
  surveyResponse      ClickatonSurveyResponse        @relation(fields: [surveyResponseId], references: [id], onDelete: Cascade)
  edition             ClickatonEdition               @relation(fields: [editionId], references: [id], onDelete: Restrict)

  @@index([editionId, status])
  @@index([status, displayOrder])
}

/// A quién se invitó a testimoniar. Hace medible la tasa de respuesta.
model ClickatonTestimonialInvite {
  id              String                           @id @default(cuid())
  editionId       String
  authorRole      ClickatonTestimonialAuthorRole
  email           String
  userId          Int?
  registrationId  String?
  venueId         String?
  status          ClickatonTestimonialInviteStatus @default(PENDING)
  sentAt          DateTime?
  respondedAt     DateTime?
  emailQueueId    Int?
  idempotencyKey  String                           @unique
  createdAt       DateTime                         @default(now())
  updatedAt       DateTime                         @updatedAt
  edition         ClickatonEdition                 @relation(fields: [editionId], references: [id], onDelete: Restrict)

  @@unique([editionId, email])
  @@index([editionId, status])
}
```

- [ ] **Step 4: Escribir el SQL de migración a mano**

El deploy de Clickatón no corre `prisma migrate deploy`. El archivo se escribe a mano y se aplica después contra la base.

```sql
-- CreateEnum
CREATE TYPE "ClickatonTestimonialAuthorRole" AS ENUM ('PARTICIPANT', 'JUROR', 'VENUE');
CREATE TYPE "ClickatonTestimonialStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED');
CREATE TYPE "ClickatonSurveyWouldReturn" AS ENUM ('YES', 'MAYBE', 'NO');
CREATE TYPE "ClickatonTestimonialInviteStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'RESPONDED');

-- AlterTable
ALTER TABLE "ClickatonEdition"
  ADD COLUMN "testimonialsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "testimonialInviteDelayDays" INTEGER NOT NULL DEFAULT 2;
```

Más las tres `CREATE TABLE` con sus índices, claves únicas y claves foráneas, en el mismo estilo que las migraciones vecinas de `packages/db/prisma/migrations/`.

- [ ] **Step 5: Generar el cliente y verificar**

Run: `pnpm --filter @repo/db exec prisma generate`
Expected: termina sin error y los tipos nuevos aparecen en el cliente.

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "Modelar encuesta, testimonio e invitación de Clickatón"
```

---

### Task 2: Dominio — definición de la encuesta y métricas

**Files:**
- Create: `apps/clickaton/lib/testimonials/domain/survey-definition.ts`
- Create: `apps/clickaton/lib/testimonials/domain/metrics.ts`
- Create: `apps/clickaton/lib/testimonials/domain/metrics.test.ts`
- Create: `apps/clickaton/lib/testimonials/domain/excerpt.ts`
- Create: `apps/clickaton/lib/testimonials/domain/excerpt.test.ts`
- Create: `apps/clickaton/lib/testimonials/domain/author-link.ts`
- Create: `apps/clickaton/lib/testimonials/domain/author-link.test.ts`
- Modify: `apps/clickaton/package.json` (script `test:testimonials-domain`)

**Interfaces:**
- Consumes: los enums de la Task 1.
- Produces:
  - `SURVEY_ASPECTS: readonly SurveyAspect[]` donde `SurveyAspect = { field: SurveyAspectField; label: string; help: string }` y `SurveyAspectField` es la unión de los siete nombres de columna.
  - `NPS_QUESTION`, `QUOTE_MAX_LENGTH = 400`, `EXCERPT_MAX_LENGTH = 240`, `IMPROVEMENT_MAX_LENGTH = 1000`.
  - `calculateNps(scores: number[]): NpsBreakdown` con `NpsBreakdown = { total: number; promoters: number; passives: number; detractors: number; score: number }`.
  - `averageAspect(values: (number | null)[]): { average: number | null; answered: number; notApplicable: number }`.
  - `wouldReturnRate(values: (ClickatonSurveyWouldReturn | null)[]): { yes: number; maybe: number; no: number; positiveRate: number }`.
  - `buildExcerpt(quote: string, max?: number): string`.
  - `normalizeAuthorLink(raw: string | null): string | null`.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
// metrics.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateNps, averageAspect, wouldReturnRate } from "./metrics.ts";

test("NPS: promotores menos detractores sobre el total", () => {
  // 9,10 promotores · 7,8 pasivos · 0..6 detractores
  const r = calculateNps([10, 9, 8, 7, 6, 0]);
  assert.equal(r.total, 6);
  assert.equal(r.promoters, 2);
  assert.equal(r.passives, 2);
  assert.equal(r.detractors, 2);
  assert.equal(r.score, 0);
});

test("NPS sin respuestas no divide por cero", () => {
  const r = calculateNps([]);
  assert.equal(r.total, 0);
  assert.equal(r.score, 0);
});

test("NPS redondea a entero", () => {
  const r = calculateNps([10, 10, 0]);
  assert.equal(r.score, 33);
});

test('el promedio ignora los "No aplica" y los cuenta aparte', () => {
  const r = averageAspect([5, 4, null, null, 3]);
  assert.equal(r.answered, 3);
  assert.equal(r.notApplicable, 2);
  assert.equal(r.average, 4);
});

test("un aspecto que nadie puntuó no tiene promedio", () => {
  const r = averageAspect([null, null]);
  assert.equal(r.average, null);
  assert.equal(r.answered, 0);
});

test("volvería a participar: sí y tal vez cuentan como positivo", () => {
  const r = wouldReturnRate(["YES", "YES", "MAYBE", "NO", null]);
  assert.equal(r.yes, 2);
  assert.equal(r.maybe, 1);
  assert.equal(r.no, 1);
  assert.equal(r.positiveRate, 75);
});
```

```ts
// excerpt.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildExcerpt } from "./excerpt.ts";

test("una cita corta se usa entera", () => {
  assert.equal(buildExcerpt("Fue una experiencia enorme."), "Fue una experiencia enorme.");
});

test("una cita larga se corta en el último espacio y agrega elipsis", () => {
  const long = "palabra ".repeat(60).trim();
  const out = buildExcerpt(long, 40);
  assert.ok(out.length <= 41);
  assert.ok(out.endsWith("…"));
  assert.ok(!out.includes("palabra…"[0] + "…")); // no corta a mitad de palabra
});

test("los espacios y saltos de línea repetidos se normalizan", () => {
  assert.equal(buildExcerpt("Hola   \n\n  mundo"), "Hola mundo");
});
```

```ts
// author-link.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeAuthorLink } from "./author-link.ts";

test("un usuario de Instagram se convierte en URL", () => {
  assert.equal(normalizeAuthorLink("@fulano"), "https://instagram.com/fulano");
});

test("una URL con http se acepta tal cual", () => {
  assert.equal(normalizeAuthorLink("https://misitio.com/foto"), "https://misitio.com/foto");
});

test("un dominio suelto recibe https", () => {
  assert.equal(normalizeAuthorLink("misitio.com"), "https://misitio.com");
});

test("javascript: se rechaza", () => {
  assert.equal(normalizeAuthorLink("javascript:alert(1)"), null);
});

test("vacío devuelve null", () => {
  assert.equal(normalizeAuthorLink("   "), null);
  assert.equal(normalizeAuthorLink(null), null);
});
```

- [ ] **Step 2: Correr las pruebas y verificar que fallan**

Run: `cd apps/clickaton && pnpm exec tsx --test lib/testimonials/domain/*.test.ts`
Expected: FAIL — los módulos no existen.

- [ ] **Step 3: Escribir la implementación mínima**

`survey-definition.ts` con los siete aspectos y sus etiquetas en español (Organización general, Consignas y desafío fotográfico, Sede y punto de encuentro, Kit y materiales, Acreditación, Comunicación antes y durante, Relación precio / valor), la pregunta de NPS y las tres constantes de longitud.

`metrics.ts` con las tres funciones puras. `calculateNps` clasifica 9-10 promotor, 7-8 pasivo, 0-6 detractor y devuelve `Math.round((promoters - detractors) / total * 100)`, con `score: 0` si `total === 0`.

`excerpt.ts` normaliza espacios con `replace(/\s+/g, " ")`, y si supera el máximo corta en el último espacio antes del límite y agrega `…`.

`author-link.ts` acepta `@usuario` (Instagram), URLs `http(s)` y dominios sueltos; rechaza cualquier otro esquema.

- [ ] **Step 4: Correr las pruebas y verificar que pasan**

Run: `cd apps/clickaton && pnpm exec tsx --test lib/testimonials/domain/*.test.ts`
Expected: PASS

- [ ] **Step 5: Registrar el script y commitear**

Agregar a `apps/clickaton/package.json`:
`"test:testimonials-domain": "tsx --test lib/testimonials/domain/*.test.ts"`

```bash
git add apps/clickaton/lib/testimonials/domain apps/clickaton/package.json
git commit -m "Calcular NPS, promedios y recortes de la encuesta de Clickatón"
```

---

### Task 3: Dominio — quién puede responder

**Files:**
- Create: `apps/clickaton/lib/testimonials/domain/eligibility.ts`
- Create: `apps/clickaton/lib/testimonials/domain/eligibility.test.ts`
- Create: `apps/clickaton/lib/testimonials/infrastructure/prisma-eligibility.ts`

**Interfaces:**
- Consumes: `ClickatonTestimonialAuthorRole` (Task 1).
- Produces:
  - `type EligibilityFacts = { confirmedRegistration: { id: string; firstName: string; lastName: string; profilePhotoAssetId: string | null; instagramUrl: string | null } | null; venue: { id: string; name: string } | null; juror: { name: string; photoAssetId: string | null } | null; emailVerified: boolean; matchedByEmailOnly: boolean }`
  - `type Eligibility = { eligible: true; role: ClickatonTestimonialAuthorRole; authorName: string; authorPhotoAssetId: string | null; suggestedLinkUrl: string | null; registrationId: string | null; venueId: string | null } | { eligible: false; reason: "NO_ROLE" | "EMAIL_NOT_VERIFIED" }`
  - `resolveEligibility(facts: EligibilityFacts): Eligibility` — pura.
  - `loadEligibilityFacts({ userId, email, editionId }): Promise<EligibilityFacts>` — consulta Prisma.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveEligibility } from "./eligibility.ts";

const sinNada = {
  confirmedRegistration: null,
  venue: null,
  juror: null,
  emailVerified: true,
  matchedByEmailOnly: false,
};

test("un participante confirmado puede testimoniar", () => {
  const r = resolveEligibility({
    ...sinNada,
    confirmedRegistration: {
      id: "reg1",
      firstName: "Ana",
      lastName: "Pérez",
      profilePhotoAssetId: "asset1",
      instagramUrl: "https://instagram.com/ana",
    },
  });
  assert.equal(r.eligible, true);
  assert.equal(r.role, "PARTICIPANT");
  assert.equal(r.authorName, "Ana Pérez");
  assert.equal(r.suggestedLinkUrl, "https://instagram.com/ana");
  assert.equal(r.registrationId, "reg1");
});

test("el contacto de una sede puede testimoniar", () => {
  const r = resolveEligibility({ ...sinNada, venue: { id: "v1", name: "Sede Córdoba" } });
  assert.equal(r.eligible, true);
  assert.equal(r.role, "VENUE");
  assert.equal(r.authorName, "Sede Córdoba");
});

test("un jurado puede testimoniar", () => {
  const r = resolveEligibility({
    ...sinNada,
    juror: { name: "Jurado Uno", photoAssetId: null },
  });
  assert.equal(r.eligible, true);
  assert.equal(r.role, "JUROR");
});

test("el participante gana sobre los otros roles", () => {
  const r = resolveEligibility({
    ...sinNada,
    confirmedRegistration: {
      id: "reg1",
      firstName: "Ana",
      lastName: "Pérez",
      profilePhotoAssetId: null,
      instagramUrl: null,
    },
    venue: { id: "v1", name: "Sede Córdoba" },
    juror: { name: "Jurado Uno", photoAssetId: null },
  });
  assert.equal(r.role, "PARTICIPANT");
});

test("sin ningún rol no puede responder", () => {
  const r = resolveEligibility(sinNada);
  assert.equal(r.eligible, false);
  assert.equal(r.reason, "NO_ROLE");
});

test("si el vínculo vino sólo por correo, el correo tiene que estar verificado", () => {
  const r = resolveEligibility({
    ...sinNada,
    emailVerified: false,
    matchedByEmailOnly: true,
    confirmedRegistration: {
      id: "reg1",
      firstName: "Ana",
      lastName: "Pérez",
      profilePhotoAssetId: null,
      instagramUrl: null,
    },
  });
  assert.equal(r.eligible, false);
  assert.equal(r.reason, "EMAIL_NOT_VERIFIED");
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd apps/clickaton && pnpm exec tsx --test lib/testimonials/domain/eligibility.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

`resolveEligibility` chequea primero `matchedByEmailOnly && !emailVerified` → `EMAIL_NOT_VERIFIED`; después participante, sede, jurado, en ese orden; si no hay ninguno, `NO_ROLE`.

`loadEligibilityFacts` consulta: `clickatonRegistration.findFirst` con `status: "CONFIRMED"`, `isOpsTest: false` y `OR: [{ userId }, { email: { equals: email, mode: "insensitive" } }]`; `clickatonVenue.findFirst` por `contactEmail` insensible y `isActive: true`; y el padrón de jurados con el cliente existente de `@repo/db` usando `ClickatonEdition.fotorankContestId`. Marca `matchedByEmailOnly` cuando el registro se encontró por correo y su `userId` es `null` o distinto.

- [ ] **Step 4: Correr y verificar que pasa**

Run: `cd apps/clickaton && pnpm exec tsx --test lib/testimonials/domain/eligibility.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/clickaton/lib/testimonials
git commit -m "Resolver quién puede dejar testimonio en una edición"
```

---

### Task 4: Aplicación — guardar la encuesta

**Files:**
- Create: `apps/clickaton/lib/testimonials/application/submit-survey.ts`
- Create: `apps/clickaton/lib/testimonials/application/submit-survey.test.ts`
- Create: `apps/clickaton/lib/testimonials/domain/repository.ts`
- Create: `apps/clickaton/lib/testimonials/infrastructure/in-memory-testimonial-repository.ts`
- Create: `apps/clickaton/lib/testimonials/infrastructure/prisma-testimonial-repository.ts`

**Interfaces:**
- Consumes: `resolveEligibility` (Task 3), constantes de longitud y `normalizeAuthorLink` (Task 2).
- Produces:
  - `type SubmitSurveyInput = { editionId: string; userId: number; eligibility: Eligibility & { eligible: true }; npsScore: number; aspects: Record<SurveyAspectField, number | null>; wouldReturn: "YES" | "MAYBE" | "NO" | null; improvementNotes: string | null; publicQuote: string | null; authorLinkRaw: string | null; publicationConsent: boolean; audit: { ip: string | null; userAgent: string | null } }`
  - `type SubmitSurveyResult = { ok: true; surveyResponseId: string; testimonialId: string | null } | { ok: false; error: "INVALID_NPS" | "INVALID_SCORE" | "QUOTE_TOO_LONG" | "NOTES_TOO_LONG" | "CONSENT_WITHOUT_QUOTE" }`
  - `submitSurvey(repo: TestimonialRepository, input: SubmitSurveyInput): Promise<SubmitSurveyResult>`

- [ ] **Step 1: Escribir las pruebas que fallan**

Casos, con el repositorio en memoria:

```ts
test("guarda la encuesta y no crea testimonio sin consentimiento", …)
  // publicationConsent: false, publicQuote con texto → testimonialId === null

test("con consentimiento y texto crea el testimonio en PENDING", …)
  // status === "PENDING", publishedAt === null

test("la crítica constructiva nunca llega al testimonio", …)
  // improvementNotes: "todo mal" → JSON.stringify(testimonio) no contiene "todo mal"

test("responder dos veces edita, no duplica", …)
  // submitSurvey dos veces → una sola fila para [editionId, userId]

test("editar un testimonio publicado lo devuelve a PENDING", …)

test("un NPS fuera de 0..10 se rechaza", …)     // error: "INVALID_NPS"
test("una nota fuera de 1..5 se rechaza", …)     // error: "INVALID_SCORE"
test("una cita de más de 400 se rechaza", …)     // error: "QUOTE_TOO_LONG"
test("consentir sin escribir nada se rechaza", …) // error: "CONSENT_WITHOUT_QUOTE"
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd apps/clickaton && pnpm exec tsx --test lib/testimonials/application/submit-survey.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar**

`repository.ts` define la interfaz `TestimonialRepository` con `findResponse`, `upsertResponse`, `upsertTestimonial`, `deleteTestimonial`, `markInviteResponded`. El repositorio en memoria la implementa con `Map`; el de Prisma, con una transacción.

`submitSurvey` valida en orden (NPS, notas, longitudes, consentimiento sin texto), normaliza el enlace, hace upsert de la respuesta, y después: si hay consentimiento y cita, upsert del testimonio con `status: "PENDING"`, `publishedAt: null` y la identidad tomada de `input.eligibility` — nunca del formulario; si no, borra el testimonio que hubiera.

- [ ] **Step 4: Correr y verificar que pasa**

Run: `cd apps/clickaton && pnpm exec tsx --test lib/testimonials/application/submit-survey.test.ts`
Expected: PASS

- [ ] **Step 5: Registrar el script y commitear**

`"test:testimonials": "tsx --test lib/testimonials/domain/*.test.ts lib/testimonials/application/*.test.ts lib/testimonials/ui/*.test.ts"`

```bash
git add apps/clickaton/lib/testimonials apps/clickaton/package.json
git commit -m "Guardar la encuesta sin mezclar la crítica privada con lo publicable"
```

---

### Task 5: El formulario público

**Files:**
- Create: `apps/clickaton/app/(public)/maratones/[slug]/testimonio/page.tsx`
- Create: `apps/clickaton/components/testimonials/TestimonialSurveyForm.tsx`
- Create: `apps/clickaton/lib/testimonials/actions/submit-survey-action.ts`
- Create: `apps/clickaton/lib/testimonials/ui/survey-copy.ts`

**Interfaces:**
- Consumes: `submitSurvey`, `loadEligibilityFacts`, `resolveEligibility`, `SURVEY_ASPECTS`.
- Produces: la ruta `/maratones/<slug>/testimonio`, usada por el correo de la Task 9.

- [ ] **Step 1: La página (Server Component)**

`export const dynamic = "force-dynamic"`. Busca la edición por `slug`; si no existe o `testimonialsEnabled === false`, `notFound()`. Sin sesión (`getClickatonAuthUser()`), redirige a `${CLICKATON_LOGIN_PATH}?next=/maratones/<slug>/testimonio`. Resuelve elegibilidad; si no es elegible, muestra el cartel correspondiente y no dibuja el formulario. Si ya respondió, carga los valores para editar.

- [ ] **Step 2: El formulario (Client Component)**

Bloques, en orden: NPS 0-10 (botones de radio), los siete aspectos de 1 a 5 con opción "No aplica", `publicQuote` (contador de 400, visible), `improvementNotes` con el cartel **"Esto no se publica nunca. Lo lee sólo el equipo."**, "¿Volverías a participar?", el enlace (prellenado con `suggestedLinkUrl`) y el consentimiento.

El nombre y la foto se muestran en una tarjeta de sólo lectura — "así te vas a ver si publicamos tu testimonio" — porque no son editables desde acá.

- [ ] **Step 3: La acción de servidor**

`"use server"`. Toma la sesión de nuevo (nunca confía en campos ocultos del formulario), vuelve a resolver elegibilidad, arma el `SubmitSurveyInput` y llama a `submitSurvey` con el repositorio de Prisma. Marca la invitación como `RESPONDED`. Devuelve estado de éxito o el mensaje de error en español.

- [ ] **Step 4: Verificar**

Run: `cd apps/clickaton && pnpm check-types`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add apps/clickaton/app apps/clickaton/components/testimonials apps/clickaton/lib/testimonials
git commit -m "Abrir el formulario de testimonio para quien participó"
```

---

### Task 6: La sección pública

**Files:**
- Create: `apps/clickaton/lib/testimonials/public/list-published.ts`
- Create: `apps/clickaton/lib/testimonials/public/list-published.test.ts`
- Create: `apps/clickaton/components/home/ParticipantVoices.tsx`
- Modify: `apps/clickaton/app/(public)/page.tsx` (entre `<Community />` y `<VenueProgramSection />`)
- Modify: `apps/clickaton/app/(public)/maratones/[slug]/page.tsx`

**Interfaces:**
- Consumes: `ClickatonTestimonial` (Task 1).
- Produces:
  - `type PublishedTestimonial = { id: string; excerpt: string; authorName: string; authorRoleLabel: string; editionName: string; photoUrl: string | null; linkUrl: string | null }`
  - `listPublishedTestimonials(opts?: { editionId?: string; limit?: number }): Promise<PublishedTestimonial[]>`
  - `MIN_TESTIMONIALS_TO_SHOW = 3` y `shouldRenderVoices(count: number): boolean`

- [ ] **Step 1: Escribir la prueba que falla**

```ts
test("con menos de tres publicados la sección no se dibuja", () => {
  assert.equal(shouldRenderVoices(0), false);
  assert.equal(shouldRenderVoices(2), false);
  assert.equal(shouldRenderVoices(3), true);
});

test("la etiqueta del rol se muestra en español", () => {
  assert.equal(authorRoleLabel("PARTICIPANT"), "Participante");
  assert.equal(authorRoleLabel("JUROR"), "Jurado");
  assert.equal(authorRoleLabel("VENUE"), "Sede");
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd apps/clickaton && pnpm exec tsx --test lib/testimonials/public/list-published.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar**

`listPublishedTestimonials` consulta `clickatonTestimonial` con `status: "PUBLISHED"`, `publicationConsent: true` y la edición no `isOpsFixture`, ordena por `isFeatured desc, displayOrder asc, publishedAt desc`, y arma el DTO: `excerpt` usa `highlightedExcerpt ?? buildExcerpt(quote)`, y `photoUrl` apunta a `/api/public/testimonios/<id>/foto` sólo si hay `authorPhotoAssetId`. **La consulta nunca incluye `surveyResponse`.**

`ParticipantVoices` recibe la lista ya armada. Título: **"Lo que dicen los participantes"**. Cada tarjeta: la cita entre comillas tipográficas, foto redonda (o iniciales), nombre, rol y edición. Si hay `linkUrl`, la tarjeta es un `<a>` con `target="_blank"` y `rel="noopener noreferrer nofollow"`.

- [ ] **Step 4: Correr y verificar que pasa**

Run: `cd apps/clickaton && pnpm exec tsx --test lib/testimonials/public/list-published.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/clickaton
git commit -m "Mostrar lo que dicen los participantes en el inicio y en cada maratón"
```

---

### Task 7: La foto del testimonio publicado

**Files:**
- Create: `apps/clickaton/app/api/public/testimonios/[testimonialId]/foto/route.ts`
- Create: `apps/clickaton/lib/testimonials/public/photo-access.ts`
- Create: `apps/clickaton/lib/testimonials/public/photo-access.test.ts`

**Interfaces:**
- Consumes: `getWelcomeCardStorage()` de `lib/welcome-card/storage`, `DnxMediaAsset`.
- Produces: `canServeTestimonialPhoto(t: { status: string; publicationConsent: boolean; authorPhotoAssetId: string | null }): boolean` y la ruta pública de la foto.

- [ ] **Step 1: Escribir la prueba que falla**

```ts
test("sólo un testimonio publicado y consentido entrega su foto", () => {
  const base = { status: "PUBLISHED", publicationConsent: true, authorPhotoAssetId: "a1" };
  assert.equal(canServeTestimonialPhoto(base), true);
  assert.equal(canServeTestimonialPhoto({ ...base, status: "PENDING" }), false);
  assert.equal(canServeTestimonialPhoto({ ...base, status: "REJECTED" }), false);
  assert.equal(canServeTestimonialPhoto({ ...base, publicationConsent: false }), false);
  assert.equal(canServeTestimonialPhoto({ ...base, authorPhotoAssetId: null }), false);
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd apps/clickaton && pnpm exec tsx --test lib/testimonials/public/photo-access.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar la ruta**

`runtime = "nodejs"`, `dynamic = "force-dynamic"`. Busca el testimonio; si `canServeTestimonialPhoto` da `false`, responde 404 (nunca 403: no se confirma que el recurso exista). Si da `true`, busca el `DnxMediaAsset`, lee los bytes con `getWelcomeCardStorage().get(asset.storageKey)` y los devuelve con `Content-Type` del `mimeType`, `X-Content-Type-Options: nosniff` y `Cache-Control: public, max-age=3600` — cacheo corto, para que despublicar tenga efecto pronto.

- [ ] **Step 4: Correr y verificar que pasa**

Run: `cd apps/clickaton && pnpm exec tsx --test lib/testimonials/public/photo-access.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/clickaton
git commit -m "Servir la foto sólo de un testimonio publicado y consentido"
```

---

### Task 8: El panel "Testimonios y calidad"

**Files:**
- Modify: `apps/clickaton/config/admin/navigation.ts`
- Create: `apps/clickaton/app/admin/(panel)/testimonios/page.tsx` (tablero)
- Create: `apps/clickaton/app/admin/(panel)/testimonios/respuestas/page.tsx` (bandeja)
- Create: `apps/clickaton/app/admin/(panel)/testimonios/respuestas/[responseId]/page.tsx` (ficha)
- Create: `apps/clickaton/lib/testimonials/admin/actions.ts`
- Create: `apps/clickaton/lib/testimonials/admin/load-dashboard.ts`
- Create: `apps/clickaton/lib/testimonials/ui/testimonial-status-presentation.ts`
- Create: `apps/clickaton/lib/testimonials/ui/testimonial-status-presentation.test.ts`

**Interfaces:**
- Consumes: `calculateNps`, `averageAspect`, `wouldReturnRate`, `SURVEY_ASPECTS`, `buildExcerpt`.
- Produces:
  - `adminRoutes.testimonials = "/admin/testimonios"` y su entrada en `adminNavigation` con la etiqueta **"Testimonios y calidad"**.
  - `presentTestimonialStatus(status, consent): { label: string; tone: "neutral" | "success" | "warning" | "danger" }`
  - Acciones `publishTestimonialAction`, `rejectTestimonialAction`, `unpublishTestimonialAction`, `saveExcerptAction`.
  - `loadTestimonialDashboard(editionId?): Promise<TestimonialDashboard>`

- [ ] **Step 1: Escribir la prueba de presentación que falla**

```ts
test("sin consentimiento se muestra como tal, no como pendiente", () => {
  assert.equal(presentTestimonialStatus("PENDING", false).label, "Sin autorización");
  assert.equal(presentTestimonialStatus("PENDING", true).label, "Pendiente de revisión");
  assert.equal(presentTestimonialStatus("PUBLISHED", true).label, "Publicado");
  assert.equal(presentTestimonialStatus("REJECTED", true).label, "Rechazado");
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd apps/clickaton && pnpm exec tsx --test lib/testimonials/ui/testimonial-status-presentation.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar el tablero**

`loadTestimonialDashboard` devuelve, por edición: `nps` (con promotores/pasivos/detractores), `aspects` (promedio, respondidas y "No aplica" por aspecto), `wouldReturn`, `responseRate` (`invites.length` contra `invites.filter(RESPONDED).length`), y los conteos por estado de testimonio. La página los dibuja con los componentes de tarjeta existentes del panel y una tabla comparativa entre ediciones.

- [ ] **Step 4: Implementar la bandeja y la ficha**

Bandeja: tabla con autor, rol, edición, NPS, estado y fecha; filtros por edición, rol y estado; buscador por nombre o texto.

Ficha: todas las respuestas, la crítica privada en un bloque marcado **"Privado — no se publica"**, el campo del fragmento destacado (prellenado con `buildExcerpt(quote)`) y los botones Publicar / Rechazar / Despublicar. Publicar exige `publicationConsent === true`; si no lo hay, el botón aparece deshabilitado con la razón escrita al lado, no simplemente apagado.

- [ ] **Step 5: Correr y verificar que pasa**

Run: `cd apps/clickaton && pnpm exec tsx --test lib/testimonials/ui/*.test.ts && pnpm check-types`
Expected: PASS y sin errores de tipos.

- [ ] **Step 6: Commit**

```bash
git add apps/clickaton
git commit -m "Moderar testimonios y medir la calidad de cada edición"
```

---

### Task 9: El correo post-evento y las invitaciones

**Files:**
- Create: `apps/clickaton/lib/testimonials/notifications/testimonial-invite-email.ts`
- Create: `apps/clickaton/lib/testimonials/application/invite-testimonials.ts`
- Create: `apps/clickaton/lib/testimonials/application/invite-testimonials.test.ts`
- Create: `apps/clickaton/app/api/cron/testimonial-invites/route.ts`
- Modify: `apps/clickaton/vercel.json`
- Modify: `apps/clickaton/app/admin/(panel)/testimonios/page.tsx` (botón de invitar)

**Interfaces:**
- Consumes: `enqueueAndSendIdempotentEmail` de `lib/registration/notifications/email-delivery`, `resolveGiftRecipient` como referencia del resguardo de destinatario.
- Produces:
  - `TESTIMONIAL_INVITE_TEMPLATE_KEY = "CLICKATON_TESTIMONIAL_INVITE"`, versión `"v1"`.
  - `testimonialInviteIdempotencyKey(inviteId: string): string`
  - `selectEditionsReadyForInvites(editions, now): Edition[]`
  - `inviteTestimonials({ editionId, onlyRegistrationId? }): Promise<{ created: number; sent: number; skipped: number }>`

- [ ] **Step 1: Escribir la prueba que falla**

```ts
test("una edición sin el módulo encendido no invita a nadie", …)
test("una edición que terminó hace menos días que el retraso todavía no invita", …)
  // endAt hace 1 día, testimonialInviteDelayDays 2 → no entra
test("una edición que terminó hace más días que el retraso entra", …)
test("una edición de prueba (isOpsFixture) nunca entra", …)
test("una edición sin endAt no entra", …)
test("la clave de idempotencia es estable por invitación", () => {
  assert.equal(
    testimonialInviteIdempotencyKey("inv1"),
    "inv1:CLICKATON_TESTIMONIAL_INVITE:v1",
  );
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd apps/clickaton && pnpm exec tsx --test lib/testimonials/application/invite-testimonials.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar**

`invite-testimonials.ts`: por edición, junta destinatarios — inscripciones `CONFIRMED` con `isOpsTest: false`, y sedes activas con `contactEmail` — crea las filas de `ClickatonTestimonialInvite` que falten (`@@unique([editionId, email])` evita duplicar) y encola el correo de cada una. Los jurados no entran acá: se invitan con el botón manual.

`testimonial-invite-email.ts`: asunto **"¿Cómo te fue en Clickatón?"**, cuerpo breve con el nombre de la edición, la promesa de dos minutos, el botón hacia `/maratones/<slug>/testimonio` y una línea diciendo que la crítica no se publica. Mismo resguardo de destinatario que `resolveGiftRecipient` para no escribirle a nadie desde staging.

La ruta de cron valida el secreto igual que los crons vecinos, recorre `selectEditionsReadyForInvites` y llama a `inviteTestimonials` por cada una.

- [ ] **Step 4: Registrar el cron**

En `apps/clickaton/vercel.json`:

```json
{ "path": "/api/cron/testimonial-invites", "schedule": "0 15 * * *" }
```

- [ ] **Step 5: Correr y verificar que pasa**

Run: `cd apps/clickaton && pnpm exec tsx --test lib/testimonials/application/invite-testimonials.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/clickaton
git commit -m "Invitar a testimoniar después de cada Clickatón"
```

---

### Task 10: Los interruptores en la edición y verificación final

**Files:**
- Modify: el formulario de edición del panel (`apps/clickaton/app/admin/(panel)/ediciones/...`) para exponer `testimonialsEnabled` y `testimonialInviteDelayDays`
- Modify: `apps/clickaton/package.json` (scripts de prueba ya agregados)

- [ ] **Step 1: Agregar los dos campos al formulario de la edición**

Un interruptor **"Encuesta y testimonios"** con la ayuda: *"Abre el formulario de opinión para quien participó y habilita la invitación por correo."* Y un número **"Días después del cierre para invitar"**, mínimo 0, máximo 60.

- [ ] **Step 2: Correr todas las pruebas del módulo**

Run: `cd apps/clickaton && pnpm test:testimonials && pnpm exec tsx --test lib/testimonials/public/*.test.ts`
Expected: PASS

- [ ] **Step 3: Chequear tipos**

Run: `cd apps/clickaton && pnpm check-types`
Expected: sin errores. El build de Clickatón chequea tipos e incluye los tests, así que un error acá frena el deploy.

- [ ] **Step 4: Lint**

Run: `cd apps/clickaton && pnpm lint`
Expected: 0 advertencias.

- [ ] **Step 5: Build**

Run: `pnpm --filter clickaton build`
Expected: build exitoso.

- [ ] **Step 6: Commit final y PR**

```bash
git add apps/clickaton
git commit -m "Exponer el interruptor de encuesta y testimonios en la edición"
```

---

## Pendiente de aplicar en la base (no es código)

El SQL de la Task 1 **hay que aplicarlo a mano** contra la base de Clickatón y
registrarlo en `_prisma_migrations` con el checksum correcto. Hasta que eso
ocurra, el código no se puede desplegar: el cliente de Prisma pide las columnas
nuevas de `ClickatonEdition` en cada lectura, así que sin la migración aplicada
**se cae toda lectura de ediciones**, no sólo lo nuevo.

Se informa como paso pendiente al entregar, con el SQL listo para copiar.
