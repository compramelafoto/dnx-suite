# Diplomas de participación de Clickatón — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el admin, desde la edición de una maratón, genere con un botón los diplomas de participación de los acreditados, los vea, los descargue (uno, varios o todos en ZIP) y se los envíe por correo.

**Architecture:** El diploma es un tercer tipo de pieza (`DIPLOMA`) del subsistema `participant-cards` de Clickatón, que ya dibuja, guarda en R2 y entrega placas en producción. Se reusan el motor de render, el asset store, el bloqueo de concurrencia y el cron. Lo propio del diploma vive en `apps/clickaton/lib/diplomas/`: elegibilidad por acreditación, plantilla obligatoria, código y token de verificación, PDF y correo.

**Tech Stack:** Next.js (App Router) · TypeScript · Prisma/PostgreSQL (Neon) · R2 (S3 API) · `@repo/template-engine` + `@repo/template-engine-renderer` · `qrcode@^1.5.4` y `pdf-lib@^1.17.1` (ya instalados en `apps/clickaton`) · tests con `node:test` vía `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-09-21-clickaton-diplomas-participacion-design.md`

## Global Constraints

- **La plantilla es obligatoria.** Sin `ClickatonCardTemplateAssignment` habilitada para `(editionId, DIPLOMA)` no se emite ningún diploma. Prohibido caer a un preset de código: es la condición que puso el dueño del producto.
- **Elegible = acreditado.** Inscripción con al menos un `ClickatonCheckIn` con `reversedAt IS NULL` en esa edición. No se mira el estado de pago.
- **Código y token estables.** Se generan una vez por inscripción y no cambian al rehacer el diseño. Sólo una revocación explícita los invalida.
- **Sin dependencias nuevas.** `qrcode` y `pdf-lib` ya están en `apps/clickaton/package.json`. Para `packages/template-engine-renderer` se agrega `qrcode` en la **misma versión** (`^1.5.4`): el lockfile es compartido por siete apps.
- **Nada de generar lotes en la petición web.** El botón encola; el cron procesa de a 25.
- **Migraciones a mano.** Clickatón no corre `prisma migrate deploy` en el deploy. El SQL se aplica base por base y se registra en `_prisma_migrations`. Preguntarle a cada base si tiene las tablas; no asumir una cantidad.
- **Textos de cara al usuario en español rioplatense**, sin jerga técnica.
- **Comandos de prueba:** `pnpm --filter clickaton test:clickaton-diplomas` y `pnpm --filter clickaton test:clickaton-participant-cards`.
- **Para probar en local:** el CSP de Clickatón necesita `unsafe-eval` en desarrollo o ninguna página responde en `next dev`.

## Estructura de archivos

**Nuevos, en `apps/clickaton/lib/diplomas/`** (un archivo, una responsabilidad):

| Archivo | Responsabilidad |
|---|---|
| `diploma-types.ts` | Tipos y códigos de error del módulo. |
| `diploma-eligibility.ts` | Quién tiene derecho al diploma (acreditación vigente). |
| `diploma-template.ts` | Resolver la plantilla de la edición **sin** respaldo de preset. |
| `diploma-code.ts` | Código legible y token de verificación. |
| `diploma-service.ts` | Emitir un diploma: render, R2, fila de emisión. |
| `diploma-batch.ts` | Encolar el lote de una edición y procesar los pendientes. |
| `diploma-pdf.ts` | Envolver el PNG en un PDF A4 horizontal. |
| `diploma-email.ts` | Encolar y registrar el correo. |
| `diploma-verification.ts` | Datos de la página pública de verificación. |
| `index.ts` | Exportaciones públicas del módulo. |
| `__tests__/*.test.ts` | Tests de cada pieza. |

**Modificados:** `lib/participant-cards/participant-card-r2-keys.ts`, `participant-card-types.ts`, `participant-card-template-source.ts`, `app/admin/(panel)/ediciones/[editionId]/placas/page.tsx`, `packages/db/prisma/schema.prisma`, `packages/template-engine/src/plugins/clickaton/clickaton-variable-definitions.ts` y `clickaton-example-data.ts`, `packages/template-engine-renderer/src/preview-renderer.ts`.

**Nuevas pantallas y rutas:** `app/admin/(panel)/ediciones/[editionId]/diplomas/`, `app/api/admin/editions/[editionId]/diplomas/`, `app/api/cron/diplomas/route.ts`, `app/(public)/diplomas/verificar/[token]/page.tsx`.

---

# FASE 1 — Pieza, plantilla y panel

Al terminar la fase 1 los 29 diplomas de la 1ª edición se pueden generar y descargar.

### Task 1: Tercer tipo de pieza y una ruta de archivo por tipo

Hoy `buildParticipantCardStorageKey` manda a la carpeta `welcome` **todo** lo que no sea `member`. Con un tercer tipo, el diploma pisaría el archivo de la bienvenida.

**Files:**
- Modify: `apps/clickaton/lib/participant-cards/participant-card-types.ts:1`
- Modify: `apps/clickaton/lib/participant-cards/participant-card-r2-keys.ts:13-31`
- Test: `apps/clickaton/lib/participant-cards/__tests__/participant-card-storage.test.ts`

**Interfaces:**
- Produces: `ClickatonParticipantCardType = "welcome" | "member" | "diploma"`; `buildParticipantCardStorageKey(input)` con la misma firma, que ahora lanza `Error("UNKNOWN_CARD_TYPE")` ante un tipo desconocido.

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `describe("buildParticipantCardStorageKey", ...)`:

```typescript
  it("da una carpeta distinta a cada tipo de pieza", () => {
    const base = {
      editionId: "ed_1",
      registrationId: "reg_1",
      templateVersion: 1,
      renderHash: "hash1",
    };
    const welcome = buildParticipantCardStorageKey({ ...base, cardType: "welcome" });
    const member = buildParticipantCardStorageKey({ ...base, cardType: "member" });
    const diploma = buildParticipantCardStorageKey({ ...base, cardType: "diploma" });

    assert.ok(welcome.includes("/welcome/"));
    assert.ok(member.includes("/member/"));
    assert.ok(diploma.includes("/diploma/"));
    assert.equal(new Set([welcome, member, diploma]).size, 3);
  });

  it("rechaza un tipo de pieza desconocido", () => {
    assert.throws(
      () =>
        buildParticipantCardStorageKey({
          editionId: "ed_1",
          registrationId: "reg_1",
          templateVersion: 1,
          renderHash: "hash1",
          cardType: "certificado" as never,
        }),
      /UNKNOWN_CARD_TYPE/
    );
  });
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `pnpm --filter clickaton test:clickaton-participant-cards:storage`
Expected: FAIL — el diploma cae en `/welcome/` y el tipo desconocido no lanza.

- [ ] **Step 3: Implementar**

En `participant-card-types.ts` línea 1:

```typescript
export type ClickatonParticipantCardType = "welcome" | "member" | "diploma";
```

En `participant-card-r2-keys.ts`, reemplazar el cálculo de `cardSegment` y la extensión fija:

```typescript
const CARD_SEGMENT_BY_TYPE: Record<string, string> = {
  WELCOME: "welcome",
  MEMBER: "member",
  DIPLOMA: "diploma",
};

function resolveCardSegment(cardType: string): string {
  const segment = CARD_SEGMENT_BY_TYPE[cardType.toUpperCase()];
  if (!segment) throw new Error(`UNKNOWN_CARD_TYPE: ${cardType}`);
  return segment;
}

export function buildParticipantCardStorageKey(input: {
  editionId: string;
  registrationId: string;
  cardType: ClickatonParticipantCardType | "WELCOME" | "MEMBER" | "DIPLOMA";
  templateVersion: number;
  renderHash: string;
  /** `png` por defecto; `pdf` para el diploma imprimible. */
  extension?: "png" | "pdf";
}): string {
  const cardSegment = resolveCardSegment(String(input.cardType));
  const edition = sanitizeSegment(input.editionId);
  const registration = sanitizeSegment(input.registrationId);
  const version = Math.max(1, Math.floor(input.templateVersion));
  const hash = sanitizeSegment(input.renderHash);
  const prefix = getParticipantCardKeyPrefix();
  const ext = input.extension ?? "png";
  return `${prefix}/edition-${edition}/registration-${registration}/${cardSegment}/v${version}/${hash}.${ext}`;
}
```

Los tipos que también nombran las piezas (`GenerateClickatonParticipantCardInput.cardType`, `ParticipantCardRegistrationSnapshot`) aceptan además `"DIPLOMA"`.

- [ ] **Step 4: Correr los tests**

Run: `pnpm --filter clickaton test:clickaton-participant-cards`
Expected: PASS. Si `participant-card-presets.ts` deja de compilar por el tipo nuevo (el preset sólo conoce dos piezas), hacer que `getClickatonParticipantCardPreset` lance `Error("NO_PRESET_FOR_DIPLOMA")` para `diploma` — es exactamente lo que queremos: el diploma no tiene diseño de fábrica.

- [ ] **Step 5: Verificar tipos**

Run: `pnpm --filter clickaton check-types`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add apps/clickaton/lib/participant-cards
git commit -m "feat(clickaton): tercer tipo de pieza y una carpeta por tipo en R2"
```

---

### Task 2: Migración de base

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (enum `ClickatonParticipantCardType`:11512, enum `DnxMediaAssetKind`:11446, model `ClickatonParticipantCard`:12854)
- Create: `packages/db/prisma/migrations/20260921120000_clickaton_diplomas/migration.sql`

**Interfaces:**
- Produces: modelo Prisma `ClickatonDiplomaIssue` y los campos `pdfAssetId` / `pdfStorageKey` en `ClickatonParticipantCard`.

- [ ] **Step 1: Escribir el SQL**

`packages/db/prisma/migrations/20260921120000_clickaton_diplomas/migration.sql`:

```sql
-- Cada ALTER TYPE va solo: PostgreSQL no permite usar un valor de enum
-- recién agregado dentro de la misma transacción.
ALTER TYPE "ClickatonParticipantCardType" ADD VALUE IF NOT EXISTS 'DIPLOMA';
ALTER TYPE "DnxMediaAssetKind" ADD VALUE IF NOT EXISTS 'PARTICIPANT_CARD_PDF';

ALTER TABLE "ClickatonParticipantCard"
  ADD COLUMN IF NOT EXISTS "pdfAssetId" TEXT,
  ADD COLUMN IF NOT EXISTS "pdfStorageKey" TEXT;

CREATE TABLE IF NOT EXISTS "ClickatonDiplomaIssue" (
  "id" TEXT NOT NULL,
  "cardId" TEXT,
  "registrationId" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "diplomaCode" TEXT NOT NULL,
  "verificationToken" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokedReason" TEXT,
  "emailStatus" TEXT NOT NULL DEFAULT 'NOT_SENT',
  "emailSentAt" TIMESTAMP(3),
  "emailLastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClickatonDiplomaIssue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonDiplomaIssue_verificationToken_key"
  ON "ClickatonDiplomaIssue" ("verificationToken");
CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonDiplomaIssue_diplomaCode_key"
  ON "ClickatonDiplomaIssue" ("diplomaCode");
-- Un solo diploma vigente por inscripción; los revocados quedan como historia.
CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonDiplomaIssue_registration_active_key"
  ON "ClickatonDiplomaIssue" ("registrationId") WHERE "revokedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "ClickatonDiplomaIssue_edition_idx"
  ON "ClickatonDiplomaIssue" ("editionId", "emailStatus");

ALTER TABLE "ClickatonDiplomaIssue"
  ADD CONSTRAINT "ClickatonDiplomaIssue_registrationId_fkey"
  FOREIGN KEY ("registrationId") REFERENCES "ClickatonRegistration"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClickatonDiplomaIssue"
  ADD CONSTRAINT "ClickatonDiplomaIssue_editionId_fkey"
  FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 2: Actualizar el schema de Prisma**

En `enum ClickatonParticipantCardType` agregar `DIPLOMA`. En `enum DnxMediaAssetKind` agregar `PARTICIPANT_CARD_PDF`. En `model ClickatonParticipantCard` agregar:

```prisma
  pdfAssetId        String?
  pdfStorageKey     String?
  diplomaIssues     ClickatonDiplomaIssue[]
```

Y el modelo nuevo:

```prisma
/// Diploma de participación emitido. Código y token estables por inscripción.
model ClickatonDiplomaIssue {
  id                String    @id @default(cuid())
  cardId            String?
  registrationId    String
  editionId         String
  diplomaCode       String    @unique
  verificationToken String    @unique
  issuedAt          DateTime  @default(now())
  revokedAt         DateTime?
  revokedReason     String?
  emailStatus       String    @default("NOT_SENT")
  emailSentAt       DateTime?
  emailLastError    String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  card         ClickatonParticipantCard? @relation(fields: [cardId], references: [id], onDelete: SetNull)
  registration ClickatonRegistration     @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  edition      ClickatonEdition          @relation(fields: [editionId], references: [id], onDelete: Restrict)

  @@index([editionId, emailStatus])
}
```

Agregar `diplomaIssues ClickatonDiplomaIssue[]` en `ClickatonRegistration` y en `ClickatonEdition`.

- [ ] **Step 3: Generar el cliente y verificar que compila**

Run: `pnpm --filter @repo/db exec prisma generate && pnpm --filter clickaton check-types`
Expected: sin errores.

- [ ] **Step 4: Aplicar el SQL base por base**

Para **cada** base Neon, primero preguntar si tiene la tabla:

```sql
SELECT to_regclass('"ClickatonParticipantCard"') AS tiene_placas;
```

Donde devuelva no nulo, aplicar el SQL del paso 1 (los dos `ALTER TYPE` en llamadas separadas) y registrar la migración en `_prisma_migrations` con el checksum tomado de una base donde ya quedó aplicada. Anotar en el commit en qué bases se aplicó.

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma
git commit -m "feat(db): diplomas de Clickaton (enum DIPLOMA, PDF y tabla de emision)"
```

---

### Task 3: Elegibilidad por acreditación

**Files:**
- Create: `apps/clickaton/lib/diplomas/diploma-types.ts`
- Create: `apps/clickaton/lib/diplomas/diploma-eligibility.ts`
- Create: `apps/clickaton/lib/diplomas/__tests__/diploma-eligibility.test.ts`
- Modify: `apps/clickaton/package.json` (script de tests)

**Interfaces:**
- Produces:
  - `type DiplomaErrorCode = "DIPLOMA_TEMPLATE_MISSING" | "DIPLOMA_TEMPLATE_INVALID" | "DIPLOMA_TEMPLATE_UNAVAILABLE" | "DIPLOMA_NOT_ACCREDITED" | "DIPLOMA_PHOTO_REQUIRED"`
  - `type DiplomaCandidate = { registrationId: string; firstName: string; lastName: string; visibleCode: string | null; email: string; accreditedAt: Date }`
  - `isAccredited(checkIns: Array<{ reversedAt: Date | null }>): boolean`
  - `selectDiplomaCandidates(rows: DiplomaCandidateRow[]): DiplomaCandidate[]`

- [ ] **Step 1: Escribir los tests que fallan**

`apps/clickaton/lib/diplomas/__tests__/diploma-eligibility.test.ts`:

```typescript
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAccredited, selectDiplomaCandidates } from "@/lib/diplomas/diploma-eligibility";

const row = (over: Partial<Parameters<typeof selectDiplomaCandidates>[0][number]> = {}) => ({
  id: "reg_1",
  firstName: "Ana",
  lastName: "Pérez",
  email: "ana@example.test",
  visibleCode: "CK1-0042",
  checkIns: [{ checkedInAt: new Date("2026-09-19T19:30:00Z"), reversedAt: null }],
  ...over,
});

describe("isAccredited", () => {
  it("es cierto con un check-in vigente", () => {
    assert.equal(isAccredited([{ reversedAt: null }]), true);
  });

  it("es falso sin check-ins", () => {
    assert.equal(isAccredited([]), false);
  });

  it("es falso si el único check-in fue revertido", () => {
    assert.equal(isAccredited([{ reversedAt: new Date() }]), false);
  });

  it("es cierto si hay uno revertido y otro vigente", () => {
    assert.equal(
      isAccredited([{ reversedAt: new Date() }, { reversedAt: null }]),
      true
    );
  });
});

describe("selectDiplomaCandidates", () => {
  it("deja pasar al acreditado", () => {
    const out = selectDiplomaCandidates([row()]);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.registrationId, "reg_1");
    assert.equal(out[0]?.accreditedAt.toISOString(), "2026-09-19T19:30:00.000Z");
  });

  it("descarta al no acreditado y al revertido", () => {
    const out = selectDiplomaCandidates([
      row({ id: "reg_2", checkIns: [] }),
      row({ id: "reg_3", checkIns: [{ checkedInAt: new Date(), reversedAt: new Date() }] }),
    ]);
    assert.equal(out.length, 0);
  });

  it("un participante con dos check-ins da un solo candidato", () => {
    const out = selectDiplomaCandidates([
      row({
        checkIns: [
          { checkedInAt: new Date("2026-09-19T19:30:00Z"), reversedAt: null },
          { checkedInAt: new Date("2026-09-19T20:00:00Z"), reversedAt: null },
        ],
      }),
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.accreditedAt.toISOString(), "2026-09-19T19:30:00.000Z");
  });

  it("no mira el estado de pago", () => {
    const out = selectDiplomaCandidates([row({ paymentStatus: "PENDING" } as never)]);
    assert.equal(out.length, 1);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Agregar a `apps/clickaton/package.json`, junto a los otros scripts de test:

```json
    "test:clickaton-diplomas": "tsx --test lib/diplomas/__tests__/*.test.ts",
```

Run: `pnpm --filter clickaton test:clickaton-diplomas`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar**

`apps/clickaton/lib/diplomas/diploma-types.ts`:

```typescript
/** Motivos por los que un diploma no se puede emitir. Se muestran en el panel. */
export type DiplomaErrorCode =
  | "DIPLOMA_TEMPLATE_MISSING"
  | "DIPLOMA_TEMPLATE_INVALID"
  | "DIPLOMA_TEMPLATE_UNAVAILABLE"
  | "DIPLOMA_NOT_ACCREDITED"
  | "DIPLOMA_PHOTO_REQUIRED";

export const DIPLOMA_ERROR_MESSAGES: Record<DiplomaErrorCode, string> = {
  DIPLOMA_TEMPLATE_MISSING:
    "Esta edición todavía no tiene plantilla de diploma. Asignala en Placas.",
  DIPLOMA_TEMPLATE_INVALID:
    "La plantilla del diploma tiene bloques o datos que el motor no sabe dibujar.",
  DIPLOMA_TEMPLATE_UNAVAILABLE:
    "La plantilla del diploma dejó de estar disponible durante la generación.",
  DIPLOMA_NOT_ACCREDITED:
    "Este participante no tiene acreditación vigente en la edición.",
  DIPLOMA_PHOTO_REQUIRED:
    "La plantilla usa la foto del participante y esta inscripción no tiene foto.",
};

export type DiplomaCandidate = {
  registrationId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  visibleCode: string | null;
  email: string;
  accreditedAt: Date;
};
```

`apps/clickaton/lib/diplomas/diploma-eligibility.ts`:

```typescript
import type { DiplomaCandidate } from "./diploma-types";

export type DiplomaCandidateRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  visibleCode: string | null;
  checkIns: Array<{ checkedInAt: Date; reversedAt: Date | null }>;
};

/** Acreditado = al menos un check-in que nadie revirtió. */
export function isAccredited(checkIns: Array<{ reversedAt: Date | null }>): boolean {
  return checkIns.some((c) => c.reversedAt === null);
}

/**
 * Candidatos a diploma de una edición. Un participante con varios check-ins
 * vigentes produce un solo candidato, fechado en el primero.
 */
export function selectDiplomaCandidates(rows: DiplomaCandidateRow[]): DiplomaCandidate[] {
  const candidates: DiplomaCandidate[] = [];
  for (const row of rows) {
    const vigentes = row.checkIns
      .filter((c) => c.reversedAt === null)
      .sort((a, b) => a.checkedInAt.getTime() - b.checkedInAt.getTime());
    const primero = vigentes[0];
    if (!primero) continue;
    candidates.push({
      registrationId: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      fullName: `${row.firstName} ${row.lastName}`.trim(),
      visibleCode: row.visibleCode,
      email: row.email,
      accreditedAt: primero.checkedInAt,
    });
  }
  return candidates;
}

/** Lectura de candidatos de una edición. La consulta vive acá y no en la pantalla. */
export const DIPLOMA_CANDIDATE_QUERY = {
  select: {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    visibleCode: true,
    checkIns: {
      where: { reversedAt: null },
      select: { checkedInAt: true, reversedAt: true },
      orderBy: { checkedInAt: "asc" },
    },
  },
} as const;
```

- [ ] **Step 4: Correr los tests**

Run: `pnpm --filter clickaton test:clickaton-diplomas`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/clickaton/lib/diplomas apps/clickaton/package.json
git commit -m "feat(clickaton): elegibilidad de diploma por acreditacion vigente"
```

---

### Task 4: Plantilla obligatoria, sin respaldo de preset

**Files:**
- Create: `apps/clickaton/lib/diplomas/diploma-template.ts`
- Create: `apps/clickaton/lib/diplomas/__tests__/diploma-template.test.ts`
- Modify: `apps/clickaton/lib/participant-cards/participant-card-template-source.ts:31-38` (agregar `"QR"` a `SUPPORTED_BLOCK_TYPES`)

**Interfaces:**
- Consumes: `DiplomaErrorCode` (Task 3); `validateClickatonCardTemplate(payload)` y `templateV2ToCardPreset(...)` de `participant-card-template-source.ts`.
- Produces: `resolveDiplomaTemplate(input, deps?): Promise<DiplomaTemplateResult>` con
  `DiplomaTemplateResult = { ok: true; preset: ClickatonCardPreset; source: { templateId: string; templateName: string; versionId: string; versionNumber: number; revision: number }; usesParticipantPhoto: boolean } | { ok: false; code: DiplomaErrorCode; issues: string[] }`.

- [ ] **Step 1: Escribir los tests que fallan**

`apps/clickaton/lib/diplomas/__tests__/diploma-template.test.ts`:

```typescript
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveDiplomaTemplate } from "@/lib/diplomas/diploma-template";

const payloadValido = {
  canvas: { width: 1754, height: 1240 },
  blocks: [
    { id: "b1", type: "BACKGROUND", config: { backgroundColor: "#ffffff" }, layout: {} },
    {
      id: "b2",
      type: "VARIABLE_TEXT",
      config: { variablePath: "participant.fullName" },
      layout: {},
    },
  ],
};

describe("resolveDiplomaTemplate", () => {
  it("falla sin plantilla asignada y no devuelve preset", async () => {
    const out = await resolveDiplomaTemplate(
      { editionId: "ed_1" },
      { loadAssignment: async () => null, loadTemplate: async () => null }
    );
    assert.equal(out.ok, false);
    assert.equal(out.ok === false && out.code, "DIPLOMA_TEMPLATE_MISSING");
    assert.ok(!("preset" in out));
  });

  it("falla si la asignación está deshabilitada", async () => {
    const out = await resolveDiplomaTemplate(
      { editionId: "ed_1" },
      {
        loadAssignment: async () => ({ templateId: "t1", versionId: null, enabled: false }),
        loadTemplate: async () => null,
      }
    );
    assert.equal(out.ok === false && out.code, "DIPLOMA_TEMPLATE_MISSING");
  });

  it("falla si la plantilla ya no existe", async () => {
    const out = await resolveDiplomaTemplate(
      { editionId: "ed_1" },
      {
        loadAssignment: async () => ({ templateId: "t1", versionId: null, enabled: true }),
        loadTemplate: async () => null,
      }
    );
    assert.equal(out.ok === false && out.code, "DIPLOMA_TEMPLATE_UNAVAILABLE");
  });

  it("falla y lista los problemas si la plantilla es inválida", async () => {
    const out = await resolveDiplomaTemplate(
      { editionId: "ed_1" },
      {
        loadAssignment: async () => ({ templateId: "t1", versionId: null, enabled: true }),
        loadTemplate: async () => ({
          template: { id: "t1", name: "Diploma" },
          version: { id: "v1", versionNumber: 1, revision: 1 },
          payload: { canvas: { width: 0, height: 0 }, blocks: [] },
        }),
      }
    );
    assert.equal(out.ok === false && out.code, "DIPLOMA_TEMPLATE_INVALID");
    assert.ok(out.ok === false && out.issues.length > 0);
  });

  it("acepta una plantilla válida y dice si usa la foto", async () => {
    const out = await resolveDiplomaTemplate(
      { editionId: "ed_1" },
      {
        loadAssignment: async () => ({ templateId: "t1", versionId: null, enabled: true }),
        loadTemplate: async () => ({
          template: { id: "t1", name: "Diploma 1ª edición" },
          version: { id: "v1", versionNumber: 2, revision: 3 },
          payload: payloadValido,
        }),
      }
    );
    assert.equal(out.ok, true);
    assert.equal(out.ok === true && out.source.templateName, "Diploma 1ª edición");
    assert.equal(out.ok === true && out.usesParticipantPhoto, false);
  });

  it("detecta que la plantilla usa la foto del participante", async () => {
    const conFoto = {
      ...payloadValido,
      blocks: [
        ...payloadValido.blocks,
        { id: "b3", type: "PHOTO", config: { variablePath: "participant.photoUrl" }, layout: {} },
      ],
    };
    const out = await resolveDiplomaTemplate(
      { editionId: "ed_1" },
      {
        loadAssignment: async () => ({ templateId: "t1", versionId: null, enabled: true }),
        loadTemplate: async () => ({
          template: { id: "t1", name: "Con foto" },
          version: { id: "v1", versionNumber: 1, revision: 1 },
          payload: conFoto,
        }),
      }
    );
    assert.equal(out.ok === true && out.usesParticipantPhoto, true);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter clickaton test:clickaton-diplomas`
Expected: FAIL — `resolveDiplomaTemplate` no existe.

- [ ] **Step 3: Implementar**

`apps/clickaton/lib/diplomas/diploma-template.ts`:

```typescript
import {
  loadTemplateV2LegacyPayload,
  type TemplateV2LoadResult,
} from "@repo/db/template-v2-repository";
import { prisma } from "@/lib/admin/db";
import {
  templateV2ToCardPreset,
  validateClickatonCardTemplate,
} from "@/lib/participant-cards/participant-card-template-source";
import type { ClickatonCardPreset } from "@/lib/participant-cards/participant-card-presets";
import type { DiplomaErrorCode } from "./diploma-types";

export type DiplomaTemplateAssignment = {
  templateId: string;
  versionId: string | null;
  enabled: boolean;
};

export type DiplomaTemplateDeps = {
  loadAssignment?: (input: { editionId: string }) => Promise<DiplomaTemplateAssignment | null>;
  loadTemplate?: (input: {
    templateId: string;
    versionId: string | null;
  }) => Promise<TemplateV2LoadResult | null>;
};

export type DiplomaTemplateResult =
  | {
      ok: true;
      preset: ClickatonCardPreset;
      source: {
        templateId: string;
        templateName: string;
        versionId: string;
        versionNumber: number;
        revision: number;
      };
      usesParticipantPhoto: boolean;
    }
  | { ok: false; code: DiplomaErrorCode; issues: string[] };

const PHOTO_VARIABLE_PATHS = ["participant.photoUrl", "participant.photo"];

function usesPhoto(payload: { blocks?: Array<{ type: string; config?: unknown }> }): boolean {
  for (const block of payload.blocks ?? []) {
    if (block.type !== "PHOTO" && block.type !== "IMAGE") continue;
    const cfg = (block.config ?? {}) as Record<string, unknown>;
    const path = typeof cfg.variablePath === "string" ? cfg.variablePath : "";
    if (PHOTO_VARIABLE_PATHS.includes(path)) return true;
  }
  return false;
}

async function defaultLoadAssignment(input: {
  editionId: string;
}): Promise<DiplomaTemplateAssignment | null> {
  const row = await prisma.clickatonCardTemplateAssignment.findUnique({
    where: { editionId_cardType: { editionId: input.editionId, cardType: "DIPLOMA" } },
    select: { templateId: true, versionId: true, enabled: true },
  });
  return row ?? null;
}

/**
 * Resuelve la plantilla del diploma de una edición.
 *
 * A diferencia de las placas, acá **no hay diseño de fábrica**: si falta la
 * plantilla, está deshabilitada, desapareció o es inválida, no se emite nada.
 * Es una decisión de producto: el diploma de cada maratón es el que diseñó su
 * dueño, nunca uno genérico.
 */
export async function resolveDiplomaTemplate(
  input: { editionId: string },
  deps: DiplomaTemplateDeps = {}
): Promise<DiplomaTemplateResult> {
  const loadAssignment = deps.loadAssignment ?? defaultLoadAssignment;
  const loadTemplate =
    deps.loadTemplate ??
    ((args: { templateId: string; versionId: string | null }) =>
      loadTemplateV2LegacyPayload(args));

  const assignment = await loadAssignment({ editionId: input.editionId });
  if (!assignment || !assignment.enabled) {
    return { ok: false, code: "DIPLOMA_TEMPLATE_MISSING", issues: [] };
  }

  let loaded: TemplateV2LoadResult | null;
  try {
    loaded = await loadTemplate({
      templateId: assignment.templateId,
      versionId: assignment.versionId,
    });
  } catch (err) {
    return {
      ok: false,
      code: "DIPLOMA_TEMPLATE_UNAVAILABLE",
      issues: [err instanceof Error ? err.message : "error desconocido"],
    };
  }
  if (!loaded) {
    return { ok: false, code: "DIPLOMA_TEMPLATE_UNAVAILABLE", issues: [] };
  }

  const issues = validateClickatonCardTemplate(loaded.payload);
  if (issues.length > 0) {
    return {
      ok: false,
      code: "DIPLOMA_TEMPLATE_INVALID",
      issues: issues.map((i) => i.message),
    };
  }

  return {
    ok: true,
    preset: templateV2ToCardPreset("diploma", loaded.payload),
    source: {
      templateId: loaded.template.id,
      templateName: loaded.template.name,
      versionId: loaded.version.id,
      versionNumber: loaded.version.versionNumber,
      revision: loaded.version.revision,
    },
    usesParticipantPhoto: usesPhoto(loaded.payload),
  };
}
```

Si la firma de `templateV2ToCardPreset` no acepta el tipo de pieza como primer argumento, adaptarla en `participant-card-template-source.ts` para recibirlo y no asumir `welcome`.

Agregar `"QR"` a `SUPPORTED_BLOCK_TYPES` en `participant-card-template-source.ts` (el dibujo llega en la Task 9; hasta entonces un QR en la plantilla se dibuja como recuadro vacío, no rompe).

- [ ] **Step 4: Correr los tests**

Run: `pnpm --filter clickaton test:clickaton-diplomas`
Expected: PASS (15 tests en total con los de elegibilidad).

- [ ] **Step 5: Verificar tipos**

Run: `pnpm --filter clickaton check-types`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add apps/clickaton/lib
git commit -m "feat(clickaton): la plantilla del diploma es obligatoria, sin diseno de fabrica"
```

---

### Task 5: Código y token de verificación

**Files:**
- Create: `apps/clickaton/lib/diplomas/diploma-code.ts`
- Create: `apps/clickaton/lib/diplomas/__tests__/diploma-code.test.ts`

**Interfaces:**
- Produces: `buildDiplomaCode(input: { visibleCode: string | null; registrationId: string; editionSlug: string }): string` y `generateVerificationToken(): string`.

> **Corrección sobre el diseño original:** el plan pedía un "número de edición" que **no existe** en la base (`ClickatonEdition` no tiene ese campo y `ClickatonEditionSequence.lastValue` es el contador de inscripciones). El código del diploma se arma con el código visible de la inscripción, que ya lleva el prefijo de su edición.

- [ ] **Step 1: Escribir los tests que fallan**

```typescript
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDiplomaCode, generateVerificationToken } from "@/lib/diplomas/diploma-code";

describe("buildDiplomaCode", () => {
  it("usa el código visible del participante cuando existe", () => {
    assert.equal(
      buildDiplomaCode({
        visibleCode: "CK1-0042",
        registrationId: "reg_x",
        editionSlug: "dia-del-fotografo-2026",
      }),
      "DIP-CK1-0042"
    );
  });

  it("cae al slug de la edición y al final del id si no hay código visible", () => {
    const code = buildDiplomaCode({
      visibleCode: null,
      registrationId: "cms78cthj0000xpc4841bihf4",
      editionSlug: "dia-del-fotografo-2026",
    });
    assert.match(code, /^DIP-DIADELF-[A-Z0-9]{6}$/);
  });

  it("no depende de un número de edición inexistente", () => {
    const a = buildDiplomaCode({ visibleCode: "CK1-0001", registrationId: "r1", editionSlug: "a" });
    const b = buildDiplomaCode({ visibleCode: "CK2-0001", registrationId: "r2", editionSlug: "b" });
    assert.notEqual(a, b);
  });
});

describe("generateVerificationToken", () => {
  it("es largo, aleatorio y seguro para una URL", () => {
    const a = generateVerificationToken();
    const b = generateVerificationToken();
    assert.notEqual(a, b);
    assert.ok(a.length >= 24);
    assert.match(a, /^[A-Za-z0-9_-]+$/);
  });

  it("no contiene el número de inscripción", () => {
    const token = generateVerificationToken();
    assert.ok(!token.includes("0042"));
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter clickaton test:clickaton-diplomas`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

```typescript
import { randomBytes } from "node:crypto";

/**
 * Código legible del diploma. Estable: se calcula una vez y se guarda.
 * El código visible de la inscripción ya lleva el prefijo de su edición
 * (`CK1-0042`), así que alcanza para identificar de qué maratón salió.
 */
export function buildDiplomaCode(input: {
  visibleCode: string | null;
  registrationId: string;
  editionSlug: string;
}): string {
  const visible = input.visibleCode?.trim();
  if (visible) return `DIP-${visible}`;
  const tag =
    input.editionSlug.replace(/[^a-zA-Z0-9]/g, "").slice(0, 7).toUpperCase() || "EDICION";
  const tail = input.registrationId.slice(-6).toUpperCase().replace(/[^A-Z0-9]/g, "0");
  return `DIP-${tag}-${tail}`;
}

/** Token de verificación: aleatorio, no derivable del número de inscripción. */
export function generateVerificationToken(): string {
  return randomBytes(24).toString("base64url");
}
```

- [ ] **Step 4: Correr los tests**

Run: `pnpm --filter clickaton test:clickaton-diplomas`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/clickaton/lib/diplomas
git commit -m "feat(clickaton): codigo y token de verificacion del diploma"
```

---

### Task 6: Emitir un diploma

El servicio de piezas resuelve la plantilla por dentro y cae al preset. El diploma necesita su propia resolución. Se abre un punto de inyección en el servicio existente y se escribe el emisor del diploma encima.

**Files:**
- Modify: `apps/clickaton/lib/participant-cards/participant-card-service.ts` (agregar `resolveTemplate` opcional a las dependencias)
- Create: `apps/clickaton/lib/diplomas/diploma-service.ts`
- Create: `apps/clickaton/lib/diplomas/__tests__/diploma-service.test.ts`

**Interfaces:**
- Consumes: `resolveDiplomaTemplate` (Task 4), `buildDiplomaCode` / `generateVerificationToken` (Task 5), `selectDiplomaCandidates` (Task 3), `buildParticipantCardStorageKey` (Task 1).
- Produces:
  `issueDiploma(input: { registrationId: string; actor: ParticipantCardActor }, deps?: DiplomaServiceDeps): Promise<IssueDiplomaResult>` con
  `IssueDiplomaResult = { ok: true; diplomaId: string; diplomaCode: string; verificationToken: string; cardId: string; storageKey: string; reused: boolean } | { ok: false; code: DiplomaErrorCode; issues: string[] }`.

- [ ] **Step 1: Escribir los tests que fallan**

`apps/clickaton/lib/diplomas/__tests__/diploma-service.test.ts` — con dependencias inyectadas, sin base ni R2:

```typescript
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { issueDiploma } from "@/lib/diplomas/diploma-service";

const deps = (over: Record<string, unknown> = {}) => ({
  loadRegistration: async () => ({
    id: "reg_1",
    editionId: "ed_1",
    firstName: "Ana",
    lastName: "Pérez",
    email: "ana@example.test",
    visibleCode: "CK1-0042",
    profilePhotoAssetId: null,
    checkIns: [{ checkedInAt: new Date("2026-09-19T19:30:00Z"), reversedAt: null }],
    edition: { name: "1ª Edición", slug: "dia-del-fotografo-2026" },
  }),
  resolveTemplate: async () => ({
    ok: true as const,
    preset: { id: "tpl", width: 1754, height: 1240 },
    source: {
      templateId: "t1",
      templateName: "Diploma",
      versionId: "v1",
      versionNumber: 1,
      revision: 1,
    },
    usesParticipantPhoto: false,
  }),
  renderPng: async () => ({ png: Buffer.from("png"), width: 1754, height: 1240, durationMs: 10 }),
  saveToStorage: async () => ({ storageKey: "k1", publicUrl: null }),
  upsertCard: async () => ({ id: "card_1" }),
  findExistingIssue: async () => null,
  createIssue: async (data: Record<string, unknown>) => ({ id: "dip_1", ...data }),
  updateIssue: async (data: Record<string, unknown>) => ({ id: "dip_1", ...data }),
  ...over,
});

describe("issueDiploma", () => {
  it("emite el diploma de un acreditado", async () => {
    const out = await issueDiploma({ registrationId: "reg_1", actor: { kind: "admin" } }, deps());
    assert.equal(out.ok, true);
    assert.equal(out.ok === true && out.diplomaCode, "DIP-CK1-0042");
    assert.ok(out.ok === true && out.verificationToken.length >= 24);
  });

  it("no emite si el participante no está acreditado", async () => {
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        loadRegistration: async () => ({
          id: "reg_1",
          editionId: "ed_1",
          firstName: "Ana",
          lastName: "Pérez",
          email: "ana@example.test",
          visibleCode: "CK1-0042",
          profilePhotoAssetId: null,
          checkIns: [],
          edition: { name: "1ª Edición", slug: "dia-del-fotografo-2026" },
        }),
      })
    );
    assert.equal(out.ok === false && out.code, "DIPLOMA_NOT_ACCREDITED");
  });

  it("no emite sin plantilla y no dibuja nada", async () => {
    let dibujos = 0;
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        resolveTemplate: async () => ({
          ok: false as const,
          code: "DIPLOMA_TEMPLATE_MISSING" as const,
          issues: [],
        }),
        renderPng: async () => {
          dibujos += 1;
          return { png: Buffer.from("x"), width: 1, height: 1, durationMs: 1 };
        },
      })
    );
    assert.equal(out.ok === false && out.code, "DIPLOMA_TEMPLATE_MISSING");
    assert.equal(dibujos, 0);
  });

  it("exige foto sólo si la plantilla la usa", async () => {
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        resolveTemplate: async () => ({
          ok: true as const,
          preset: { id: "tpl", width: 1754, height: 1240 },
          source: {
            templateId: "t1",
            templateName: "Con foto",
            versionId: "v1",
            versionNumber: 1,
            revision: 1,
          },
          usesParticipantPhoto: true,
        }),
      })
    );
    assert.equal(out.ok === false && out.code, "DIPLOMA_PHOTO_REQUIRED");
  });

  it("al rehacer conserva código y token", async () => {
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        findExistingIssue: async () => ({
          id: "dip_previo",
          diplomaCode: "DIP-CK1-0042",
          verificationToken: "token-viejo-que-no-cambia-xx",
          revokedAt: null,
        }),
      })
    );
    assert.equal(out.ok === true && out.diplomaId, "dip_previo");
    assert.equal(out.ok === true && out.verificationToken, "token-viejo-que-no-cambia-xx");
    assert.equal(out.ok === true && out.reused, true);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter clickaton test:clickaton-diplomas`
Expected: FAIL — `issueDiploma` no existe.

- [ ] **Step 3: Abrir el punto de inyección en el servicio de piezas**

En `participant-card-service.ts`, donde hoy se llama a `resolveParticipantCardTemplate(...)`, aceptar una dependencia opcional y usarla si viene:

```typescript
export type GenerateParticipantCardDeps = {
  /** Permite que el diploma imponga su propia resolución, sin preset de respaldo. */
  resolveTemplate?: (input: {
    cardType: ClickatonParticipantCardType;
    editionId: string | null;
  }) => Promise<ResolvedParticipantCardTemplate>;
};
```

El camino de `welcome` y `member` no cambia: sin la dependencia, sigue usando `resolveParticipantCardTemplate`.

- [ ] **Step 4: Implementar el emisor**

`apps/clickaton/lib/diplomas/diploma-service.ts`: orquesta en este orden y corta ante el primer problema.

1. `loadRegistration` (inscripción con `checkIns` y edición).
2. `isAccredited(...)` → si no, `{ ok: false, code: "DIPLOMA_NOT_ACCREDITED" }`.
3. `resolveTemplate({ editionId })` → si `ok === false`, devolver ese mismo código **sin dibujar nada**.
4. Si `usesParticipantPhoto` y no hay `profilePhotoAssetId` → `{ ok: false, code: "DIPLOMA_PHOTO_REQUIRED" }`.
5. `findExistingIssue({ registrationId })`: si hay uno vigente, se reusan `diplomaCode` y `verificationToken` (`reused: true`); si no, `buildDiplomaCode(...)` y `generateVerificationToken()`.
6. `renderPng(...)` con el preset de la plantilla y los datos del participante (incluidas las variables de diploma de la Task 11).
7. `saveToStorage(...)` con `buildParticipantCardStorageKey({ ..., cardType: "diploma" })`.
8. `upsertCard(...)` y `createIssue` / `updateIssue` apuntando `cardId` a la pieza vigente.

La implementación real usa Prisma y el asset store; en los tests todo eso entra por `deps`.

- [ ] **Step 5: Correr los tests**

Run: `pnpm --filter clickaton test:clickaton-diplomas && pnpm --filter clickaton test:clickaton-participant-cards`
Expected: PASS en ambos — las placas no cambiaron de comportamiento.

- [ ] **Step 6: Commit**

```bash
git add apps/clickaton/lib
git commit -m "feat(clickaton): emision de un diploma de participacion"
```

---

### Task 7: Lote por edición y cron

**Files:**
- Create: `apps/clickaton/lib/diplomas/diploma-batch.ts`
- Create: `apps/clickaton/lib/diplomas/__tests__/diploma-batch.test.ts`
- Create: `apps/clickaton/app/api/cron/diplomas/route.ts`
- Modify: `apps/clickaton/vercel.json` (agregar el cron cada 5 minutos)

**Interfaces:**
- Consumes: `issueDiploma` (Task 6), `selectDiplomaCandidates` (Task 3).
- Produces:
  `enqueueEditionDiplomas(editionId, deps?): Promise<{ queued: number; alreadyIssued: number; notEligible: number }>`
  `processDueDiplomas(limit?: number, deps?): Promise<{ scanned: number; issued: number; failed: number }>`

- [ ] **Step 1: Escribir los tests que fallan**

```typescript
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enqueueEditionDiplomas, processDueDiplomas } from "@/lib/diplomas/diploma-batch";

describe("enqueueEditionDiplomas", () => {
  it("encola sólo a los acreditados sin diploma", async () => {
    const encolados: string[] = [];
    const out = await enqueueEditionDiplomas("ed_1", {
      loadCandidates: async () => [
        { registrationId: "reg_1", fullName: "Ana", accreditedAt: new Date() },
        { registrationId: "reg_2", fullName: "Beto", accreditedAt: new Date() },
      ],
      loadIssuedRegistrationIds: async () => new Set(["reg_2"]),
      enqueue: async (id: string) => {
        encolados.push(id);
      },
    });
    assert.deepEqual(encolados, ["reg_1"]);
    assert.equal(out.queued, 1);
    assert.equal(out.alreadyIssued, 1);
  });

  it("apretar el botón dos veces no duplica nada", async () => {
    const encolados: string[] = [];
    const deps = {
      loadCandidates: async () => [
        { registrationId: "reg_1", fullName: "Ana", accreditedAt: new Date() },
      ],
      loadIssuedRegistrationIds: async () => new Set(encolados),
      enqueue: async (id: string) => {
        encolados.push(id);
      },
    };
    await enqueueEditionDiplomas("ed_1", deps);
    const segunda = await enqueueEditionDiplomas("ed_1", deps);
    assert.equal(encolados.length, 1);
    assert.equal(segunda.queued, 0);
  });
});

describe("processDueDiplomas", () => {
  it("emite los pendientes y cuenta los fallos sin cortar el lote", async () => {
    const out = await processDueDiplomas(25, {
      loadPending: async () => [{ registrationId: "reg_1" }, { registrationId: "reg_2" }],
      issue: async ({ registrationId }: { registrationId: string }) =>
        registrationId === "reg_1"
          ? { ok: true as const, diplomaId: "d1", diplomaCode: "c", verificationToken: "t", cardId: "c1", storageKey: "k", reused: false }
          : { ok: false as const, code: "DIPLOMA_TEMPLATE_INVALID" as const, issues: ["x"] },
    });
    assert.equal(out.issued, 1);
    assert.equal(out.failed, 1);
    assert.equal(out.scanned, 2);
  });

  it("no procesa más que el límite pedido", async () => {
    let pedidos = 0;
    await processDueDiplomas(1, {
      loadPending: async (limit: number) => {
        pedidos = limit;
        return [];
      },
      issue: async () => ({ ok: false as const, code: "DIPLOMA_NOT_ACCREDITED" as const, issues: [] }),
    });
    assert.equal(pedidos, 1);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter clickaton test:clickaton-diplomas`
Expected: FAIL.

- [ ] **Step 3: Implementar el lote**

`diploma-batch.ts`: `enqueueEditionDiplomas` lee candidatos con `DIPLOMA_CANDIDATE_QUERY`, descarta los que ya tienen diploma vigente y crea la pieza en estado `GENERATING` para el resto. `processDueDiplomas` toma hasta `limit` piezas `GENERATING` de tipo `DIPLOMA` con el lock vencido y llama a `issueDiploma` una por una, contando resultados. Un fallo nunca corta el lote.

- [ ] **Step 4: Ruta del cron**

`app/api/cron/diplomas/route.ts`, calcada de `app/api/cron/participant-cards/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { processDueDiplomas } from "@/lib/diplomas/diploma-batch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret =
    process.env.CRON_SECRET?.trim() || process.env.CLICKATON_CRON_SECRET?.trim();
  const authorized =
    (Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`) ||
    (process.env.VERCEL === "1" && request.headers.get("x-vercel-cron") === "1");
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const limitParam = new URL(request.url).searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 25;
  const result = await processDueDiplomas(Number.isFinite(limit) ? limit : 25);
  return NextResponse.json({ ok: true, ...result });
}
```

- [ ] **Step 5: Correr los tests y verificar tipos**

Run: `pnpm --filter clickaton test:clickaton-diplomas && pnpm --filter clickaton check-types`
Expected: PASS y sin errores de tipos.

- [ ] **Step 6: Commit**

```bash
git add apps/clickaton
git commit -m "feat(clickaton): lote de diplomas por edicion y cron de procesamiento"
```

---

### Task 8: Panel — tercera pieza y pantalla de Diplomas

**Files:**
- Modify: `apps/clickaton/app/admin/(panel)/ediciones/[editionId]/placas/page.tsx:29-40` (constante `CARDS`)
- Create: `apps/clickaton/app/admin/(panel)/ediciones/[editionId]/diplomas/page.tsx`
- Create: `apps/clickaton/app/admin/(panel)/ediciones/[editionId]/diplomas/DiplomasPanelClient.tsx`
- Create: `apps/clickaton/lib/admin/editions/diploma-actions.ts`
- Modify: `apps/clickaton/config/admin/navigation.ts` (entrada de menú)

**Interfaces:**
- Consumes: `enqueueEditionDiplomas` (Task 7), `resolveDiplomaTemplate` (Task 4), `DIPLOMA_ERROR_MESSAGES` (Task 3).
- Produces: `generateEditionDiplomasAction(formData)` y `regenerateDiplomaAction(formData)`, ambas server actions protegidas con `requireClickatonAdmin`.

- [ ] **Step 1: Agregar la tercera pieza en Placas**

En `CARDS`:

```typescript
  {
    key: "diploma" as const,
    dbType: "DIPLOMA" as const,
    title: "Diploma de participación",
    description:
      "Se genera a pedido, para los que se acreditaron. Sin plantilla asignada no se emite ninguno.",
  },
```

- [ ] **Step 2: Escribir la pantalla de Diplomas**

`diplomas/page.tsx` (server component):

```tsx
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import { getEditionById } from "@/lib/admin/editions/queries";
import { DIPLOMA_CANDIDATE_QUERY, selectDiplomaCandidates } from "@/lib/diplomas/diploma-eligibility";
import { resolveDiplomaTemplate } from "@/lib/diplomas/diploma-template";
import { DIPLOMA_ERROR_MESSAGES } from "@/lib/diplomas/diploma-types";
import { DiplomasPanelClient } from "./DiplomasPanelClient";

type Props = { params: Promise<{ editionId: string }> };

export default async function EditionDiplomasPage({ params }: Props) {
  await requireClickatonAdmin();
  const { editionId } = await params;

  const edition = await getEditionById(editionId);
  if (!edition.ok || !edition.data) notFound();

  const [template, rows, issues] = await Promise.all([
    resolveDiplomaTemplate({ editionId }),
    prisma.clickatonRegistration.findMany({
      where: { editionId, status: { not: "DRAFT" } },
      ...DIPLOMA_CANDIDATE_QUERY,
    }),
    prisma.clickatonDiplomaIssue.findMany({
      where: { editionId, revokedAt: null },
      select: {
        id: true,
        registrationId: true,
        diplomaCode: true,
        emailStatus: true,
        card: { select: { status: true, storageKey: true, errorCode: true } },
      },
    }),
  ]);

  const candidates = selectDiplomaCandidates(rows);
  const porInscripcion = new Map(issues.map((i) => [i.registrationId, i]));

  return (
    <>
      <AdminPageHeader
        title="Diplomas de participación"
        description={`${candidates.length} acreditados · ${issues.length} diplomas emitidos`}
      />
      {!template.ok ? (
        <Card>
          <p>{DIPLOMA_ERROR_MESSAGES[template.code]}</p>
          {template.issues.length > 0 ? (
            <ul>
              {template.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
          <a href={`/admin/ediciones/${editionId}/placas`}>Ir a Placas para asignar la plantilla</a>
        </Card>
      ) : null}
      <DiplomasPanelClient
        editionId={editionId}
        templateName={template.ok ? template.source.templateName : null}
        rows={candidates.map((c) => ({
          registrationId: c.registrationId,
          fullName: c.fullName,
          visibleCode: c.visibleCode,
          accreditedAtIso: c.accreditedAt.toISOString(),
          issue: porInscripcion.get(c.registrationId) ?? null,
        }))}
      />
    </>
  );
}
```

`DiplomasPanelClient.tsx` (client component): tabla con casillas de selección, miniatura, estado en castellano, y los botones **Ver un ejemplo**, **Generar los diplomas**, **Descargar seleccionados** y **Descargar todos**. Con `templateName === null` los botones de generar y de ejemplo van deshabilitados. El de generar confirma diciendo cuántos va a emitir.

- [ ] **Step 2b: Endpoint del ejemplo**

`app/api/admin/editions/[editionId]/diplomas/preview/route.ts`: toma el primer acreditado de la edición, llama a `issueDiploma` con `mode: "preview"` (no persiste ni crea fila de emisión) y devuelve el PNG con `Content-Type: image/png` y `Cache-Control: private, no-store`. Es lo que mira el admin antes de largar el lote.

- [ ] **Step 3: Verificar en el navegador**

Run: `pnpm --filter clickaton dev` y abrir `/admin/ediciones/cms78cthj0000xpc4841bihf4/diplomas`.
Expected: sin plantilla asignada, la pantalla explica qué falta y el botón está apagado; con plantilla asignada, muestra 29 acreditados y 0 diplomas.

- [ ] **Step 4: Verificar tipos y lint**

Run: `pnpm --filter clickaton check-types && pnpm --filter clickaton lint`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add apps/clickaton/app apps/clickaton/lib apps/clickaton/config
git commit -m "feat(clickaton): pantalla de diplomas en la edicion"
```

---

### Task 9: Descarga en ZIP (reusando la que ya existe)

> **Corrección sobre el plan original:** el plan mandaba crear `diploma-zip.ts` y una ruta nueva. No hace falta: `app/api/admin/ediciones/[editionId]/placas/descargar/route.ts` **ya baja en ZIP todas las piezas listas de una edición**, en streaming con `archiver`, con nombres sin repetir (`nombreDeArchivoDePlaca` y `nombresSinRepetir` en `lib/participant-cards/participant-card-descarga-masiva.ts`, que desde la Task 1 ya conoce el diploma) y con la autorización resuelta. Esta tarea sólo le agrega el filtro por tipo de pieza y por selección, y la enlaza desde la pantalla de diplomas. Duplicar ese camino sería mantener dos.

**Files:**
- Modify: `apps/clickaton/app/api/admin/ediciones/[editionId]/placas/descargar/route.ts`
- Modify: `apps/clickaton/lib/participant-cards/__tests__/participant-card-descarga-masiva.test.ts`
- Modify: `apps/clickaton/app/admin/(panel)/ediciones/[editionId]/diplomas/DiplomasPanelClient.tsx` (enlaces de descarga)

**Interfaces:**
- Produces: `GET .../placas/descargar?cardType=diploma` (sólo diplomas) y `&ids=reg_1,reg_2` (sólo esas inscripciones). Sin parámetros se comporta exactamente como hoy: todas las piezas listas de la edición.
- Produces: `filtrarPiezasParaDescarga(piezas, { cardType, registrationIds })` en `participant-card-descarga-masiva.ts`.

- [ ] **Step 1: Escribir los tests que fallan**

En `participant-card-descarga-masiva.test.ts`:

```typescript
import { filtrarPiezasParaDescarga } from "@/lib/participant-cards/participant-card-descarga-masiva";

const piezas = [
  { registrationId: "r1", cardType: "welcome" as const },
  { registrationId: "r1", cardType: "diploma" as const },
  { registrationId: "r2", cardType: "diploma" as const },
];

describe("filtrarPiezasParaDescarga", () => {
  it("sin filtros devuelve todo, como hasta ahora", () => {
    assert.equal(filtrarPiezasParaDescarga(piezas, {}).length, 3);
  });

  it("filtra por tipo de pieza", () => {
    const out = filtrarPiezasParaDescarga(piezas, { cardType: "diploma" });
    assert.equal(out.length, 2);
    assert.ok(out.every((p) => p.cardType === "diploma"));
  });

  it("filtra por las inscripciones elegidas", () => {
    const out = filtrarPiezasParaDescarga(piezas, {
      cardType: "diploma",
      registrationIds: ["r2"],
    });
    assert.deepEqual(out.map((p) => p.registrationId), ["r2"]);
  });

  it("una lista de inscripciones vacía no significa 'todas'", () => {
    assert.equal(filtrarPiezasParaDescarga(piezas, { registrationIds: [] }).length, 0);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter clickaton test:clickaton-participant-cards`
Expected: FAIL — `filtrarPiezasParaDescarga` no existe.

- [ ] **Step 3: Implementar**

```typescript
export function filtrarPiezasParaDescarga<T extends { registrationId: string; cardType: ClickatonParticipantCardType }>(
  piezas: readonly T[],
  filtros: { cardType?: ClickatonParticipantCardType; registrationIds?: readonly string[] }
): T[] {
  const elegidas = filtros.registrationIds ? new Set(filtros.registrationIds) : null;
  return piezas.filter((p) => {
    if (filtros.cardType && p.cardType !== filtros.cardType) return false;
    if (elegidas && !elegidas.has(p.registrationId)) return false;
    return true;
  });
}
```

En la ruta, leer `cardType` e `ids` de la query (`ids` separados por coma), validar `cardType` con `normalizeParticipantCardType` y aplicar el filtro sobre las piezas ya cargadas. El nombre del archivo comprimido pasa a decir de qué se trata: `diplomas-<slug de la edición>.zip` cuando se filtra por diploma, y el actual cuando no.

- [ ] **Step 4: Correr los tests**

Run: `pnpm --filter clickaton test:clickaton-participant-cards`
Expected: PASS, incluidos los que ya existían para esta ruta.

- [ ] **Step 5: Probar la descarga real**

Con la app en `dev` y al menos un diploma generado, bajar el ZIP desde la pantalla de diplomas y abrirlo.
Expected: trae sólo diplomas, con nombres legibles, y la descarga de placas de siempre sigue funcionando igual.

- [ ] **Step 6: Commit**

```bash
git add apps/clickaton
git commit -m "feat(clickaton): filtrar la descarga en ZIP por tipo de pieza y seleccion"
```

---

# FASE 2 — PDF, QR y verificación

### Task 10: El motor aprende a dibujar el bloque QR

El tipo de bloque `QR` está declarado en `packages/template-engine/src/schema/blocks.ts:15` y el plugin de FotoRank ya lo usa, pero `html-builder.ts` lo ignora (cae en `default: return ""`). Se resuelve materializando los QR a imagen **antes** de construir el HTML, para que el constructor siga siendo sincrónico.

**Files:**
- Create: `packages/template-engine-renderer/src/qr-materializer.ts`
- Create: `packages/template-engine-renderer/src/qr-materializer.test.ts`
- Modify: `packages/template-engine-renderer/src/preview-renderer.ts:57-62`
- Modify: `apps/clickaton/lib/participant-cards/participant-card-render-provider.ts` (materializar antes de enviar al provider)
- Modify: `apps/clickaton/lib/participant-cards/__tests__/participant-card-remote-render.test.ts`
- Modify: `packages/template-engine-renderer/package.json` (dependencia `"qrcode": "^1.5.4"`, la misma versión que usan las apps)

**Interfaces:**
- Produces: `materializeQrBlocks(document: ResolvedTemplateDocument): Promise<ResolvedTemplateDocument>` — reemplaza cada bloque `QR` por uno `IMAGE` cuyo `config.src` es un `data:image/png;base64,` (formato ya permitido por `asset-resolver.ts:7`).

- [ ] **Step 1: Escribir los tests que fallan**

```typescript
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { materializeQrBlocks } from "./qr-materializer";

const doc = (blocks: unknown[]) =>
  ({ width: 1754, height: 1240, blocks }) as never;

describe("materializeQrBlocks", () => {
  it("convierte un bloque QR en una imagen con data URI", async () => {
    const out = await materializeQrBlocks(
      doc([
        {
          id: "q1",
          type: "QR",
          layout: { x: 0, y: 0, width: 200, height: 200 },
          config: { value: "https://maratonfotografica.com/diplomas/verificar/abc" },
        },
      ])
    );
    assert.equal(out.blocks[0]?.type, "IMAGE");
    assert.match(
      String((out.blocks[0]?.config as { src: string }).src),
      /^data:image\/png;base64,/
    );
  });

  it("deja los demás bloques intactos", async () => {
    const out = await materializeQrBlocks(
      doc([{ id: "t1", type: "TEXT", layout: {}, config: { content: "hola" } }])
    );
    assert.equal(out.blocks[0]?.type, "TEXT");
  });

  it("descarta el QR sin valor en vez de romper el render", async () => {
    const out = await materializeQrBlocks(
      doc([{ id: "q1", type: "QR", layout: {}, config: { value: "" } }])
    );
    assert.equal(out.blocks.length, 0);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter @repo/template-engine-renderer exec tsx --test src/qr-materializer.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```typescript
import QRCode from "qrcode";
import type { ResolvedTemplateDocument } from "@repo/template-engine";

/**
 * Convierte los bloques QR en imágenes antes de armar el HTML.
 * El constructor de HTML es sincrónico y generar un QR no lo es, así que la
 * conversión ocurre acá. Un QR sin valor se descarta: vale más un diploma sin
 * QR que un render caído.
 */
export async function materializeQrBlocks(
  document: ResolvedTemplateDocument
): Promise<ResolvedTemplateDocument> {
  if (!document.blocks.some((b) => b.type === "QR")) return document;

  const blocks: ResolvedTemplateDocument["blocks"] = [];
  for (const block of document.blocks) {
    if (block.type !== "QR") {
      blocks.push(block);
      continue;
    }
    const cfg = (block.config ?? {}) as Record<string, unknown>;
    const value = typeof cfg.value === "string" ? cfg.value.trim() : "";
    if (!value) continue;
    const png = await QRCode.toBuffer(value, {
      type: "png",
      margin: 1,
      width: 600,
      errorCorrectionLevel: "M",
    });
    blocks.push({
      ...block,
      type: "IMAGE",
      config: { ...cfg, src: `data:image/png;base64,${png.toString("base64")}`, fit: "contain" },
    } as (typeof blocks)[number]);
  }
  return { ...document, blocks };
}
```

En `preview-renderer.ts`, antes de `buildTemplatePreviewHtml`:

```typescript
  const withQr = await materializeQrBlocks(document);
  const built = buildTemplatePreviewHtml(withQr, {
    pageIndex: options?.pageIndex ?? 0,
  });
```

**Y además, del lado de Clickatón** — esto es lo que hace que el QR funcione en producción: en `apps/clickaton/lib/participant-cards/participant-card-render-provider.ts`, materializar los QR **antes** de elegir provider, para que el documento que viaja al servicio de render remoto ya lleve la imagen:

```typescript
import { materializeQrBlocks } from "@repo/template-engine-renderer";

// en el punto donde hoy se llama a provider.render({ document }):
const document = await materializeQrBlocks(input.document);
const rendered = await provider.render({ document });
```

Motivo: en producción el dibujo ocurre en un servicio remoto y el documento
viaja serializado (`buildRemoteTemplateRenderBody`). Si el QR se materializara
sólo dentro del paquete, dependería de qué versión esté desplegada allá.
Materializar antes lo vuelve independiente del provider. Es idempotente: un
bloque ya convertido en `IMAGE` no vuelve a entrar.

Agregar un test en `apps/clickaton/lib/participant-cards/__tests__/participant-card-remote-render.test.ts`:

```typescript
it("el documento que viaja al render remoto ya trae el QR como imagen", async () => {
  const enviado = await capturarDocumentoEnviado({
    blocks: [{ id: "q1", type: "QR", layout: {}, config: { value: "https://x.test/v/abc" } }],
  });
  assert.ok(!enviado.blocks.some((b) => b.type === "QR"));
  assert.match(String(enviado.blocks[0].config.src), /^data:image\/png;base64,/);
});
```

Agregar el test al script `test` del paquete:

```json
    "test": "tsx --test src/render-limits.test.ts src/html-builder.test.ts src/remote-image.test.ts src/sponsor-card.test.ts src/qr-materializer.test.ts",
```

- [ ] **Step 4: Correr los tests del paquete y de las apps que lo usan**

Run: `pnpm --filter @repo/template-engine-renderer test && pnpm --filter clickaton test:clickaton-participant-cards`
Expected: PASS. Las placas no cambian: sin bloques QR, `materializeQrBlocks` devuelve el mismo documento.

- [ ] **Step 5: Verificar que el lockfile no se movió de más**

Run: `git diff --stat pnpm-lock.yaml`
Expected: sólo la entrada de `@repo/template-engine-renderer`; `qrcode@1.5.4` ya estaba en el árbol.

- [ ] **Step 6: Commit**

```bash
git add packages/template-engine-renderer pnpm-lock.yaml
git commit -m "feat(template-engine): dibujar el bloque QR materializandolo a imagen"
```

---

### Task 11: Las cuatro variables de diploma

**Files:**
- Modify: `packages/template-engine/src/plugins/clickaton/clickaton-variable-definitions.ts`
- Modify: `packages/template-engine/src/plugins/clickaton/clickaton-example-data.ts`
- Modify: `packages/template-engine/src/plugins/clickaton/clickaton-plugin.test.ts`

**Interfaces:**
- Produces: las variables `diploma.issuedAtFormatted`, `diploma.accreditedAtFormatted`, `diploma.code` y `diploma.verificationUrl` (esta última con `valueType: "qrUrl"`).

- [ ] **Step 1: Escribir el test que falla**

En `clickaton-plugin.test.ts`:

```typescript
describe("variables de diploma", () => {
  it("expone las cuatro variables del diploma", () => {
    const paths = new Set(CLICKATON_TEMPLATE_VARIABLE_DEFINITIONS.map((d) => d.path));
    assert.ok(paths.has("diploma.code"));
    assert.ok(paths.has("diploma.issuedAtFormatted"));
    assert.ok(paths.has("diploma.accreditedAtFormatted"));
    assert.ok(paths.has("diploma.verificationUrl"));
  });

  it("la URL de verificación es de tipo QR", () => {
    const def = CLICKATON_TEMPLATE_VARIABLE_DEFINITIONS.find(
      (d) => d.path === "diploma.verificationUrl"
    );
    assert.equal(def?.valueType, "qrUrl");
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter @repo/template-engine test`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Al final de `CLICKATON_TEMPLATE_VARIABLE_DEFINITIONS`:

```typescript
  // —— Diploma ——
  {
    path: "diploma.code",
    label: "Diploma - Código",
    valueType: "text",
    example: "DIP-CK1-0042",
    aliases: ["codigodiploma"],
    formatters: ["none"],
    usableIn: ["TEXT"],
    defaultFallback: "",
    group: "diploma",
    groupLabel: "CLICKATÓN — DIPLOMA",
  },
  {
    path: "diploma.issuedAtFormatted",
    label: "Diploma - Fecha de emisión",
    valueType: "text",
    example: "22 de septiembre de 2026",
    formatters: [...TEXT_FMT],
    usableIn: ["TEXT"],
    defaultFallback: "",
    group: "diploma",
    groupLabel: "CLICKATÓN — DIPLOMA",
  },
  {
    path: "diploma.accreditedAtFormatted",
    label: "Diploma - Fecha de acreditación",
    valueType: "text",
    example: "19 de septiembre de 2026, 16:30",
    formatters: [...TEXT_FMT],
    usableIn: ["TEXT"],
    defaultFallback: "",
    group: "diploma",
    groupLabel: "CLICKATÓN — DIPLOMA",
  },
  {
    path: "diploma.verificationUrl",
    label: "Diploma - URL de verificación",
    description:
      "La dirección que confirma que el diploma es auténtico. Es lo que va en el QR.",
    valueType: "qrUrl",
    example: "https://maratonfotografica.com/diplomas/verificar/AB12CD34",
    aliases: ["qr", "verificador"],
    formatters: ["none"],
    usableIn: ["TEXT"],
    defaultFallback: null,
    group: "diploma",
    groupLabel: "CLICKATÓN — DIPLOMA",
  },
```

Agregar los mismos cuatro valores al bloque `diploma` de `clickaton-example-data.ts`, para que el diseñador muestre datos de muestra.

Y en `diploma-service.ts` (Task 6), completar esas cuatro variables al armar los datos del render: fecha de emisión (hoy), fecha de acreditación (del check-in, en la zona horaria de la edición), código y `${origen público}/diplomas/verificar/${verificationToken}`.

- [ ] **Step 4: Correr los tests**

Run: `pnpm --filter @repo/template-engine test && pnpm --filter clickaton test:clickaton-diplomas`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/template-engine apps/clickaton/lib/diplomas
git commit -m "feat(template-engine): variables de diploma para Clickaton"
```

---

### Task 12: PDF A4 horizontal

**Files:**
- Create: `apps/clickaton/lib/diplomas/diploma-pdf.ts`
- Create: `apps/clickaton/lib/diplomas/__tests__/diploma-pdf.test.ts`
- Modify: `apps/clickaton/lib/diplomas/diploma-service.ts` (guardar también el PDF)

**Interfaces:**
- Produces: `buildDiplomaPdf(png: Buffer): Promise<Buffer>` — una hoja A4 apaisada (842×595 pt) con el PNG centrado y ajustado sin recorte.

- [ ] **Step 1: Escribir los tests que fallan**

```typescript
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import { buildDiplomaPdf } from "@/lib/diplomas/diploma-pdf";
import { PNG_1754x1240_FIXTURE } from "@/lib/diplomas/__tests__/fixtures";

describe("buildDiplomaPdf", () => {
  it("devuelve un PDF de una hoja A4 apaisada", async () => {
    const pdf = await buildDiplomaPdf(PNG_1754x1240_FIXTURE);
    const doc = await PDFDocument.load(pdf);
    assert.equal(doc.getPageCount(), 1);
    const { width, height } = doc.getPage(0).getSize();
    assert.equal(Math.round(width), 842);
    assert.equal(Math.round(height), 595);
  });

  it("entra completo, sin recorte", async () => {
    const pdf = await buildDiplomaPdf(PNG_1754x1240_FIXTURE);
    const doc = await PDFDocument.load(pdf);
    const { width, height } = doc.getPage(0).getSize();
    // El dibujo se ajusta al lado más chico: nunca se pasa de la hoja.
    assert.ok(width >= 842 - 1 && height >= 595 - 1);
  });
});
```

`fixtures.ts` exporta un PNG mínimo válido de 1754×1240 generado con `qrcode` o un buffer PNG fijo en base64.

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter clickaton test:clickaton-diplomas`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```typescript
import { PDFDocument } from "pdf-lib";

const A4_LANDSCAPE: [number, number] = [841.89, 595.28];

/** Envuelve el PNG del diploma en una hoja A4 apaisada, centrado y sin recorte. */
export async function buildDiplomaPdf(png: Buffer): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage(A4_LANDSCAPE);
  const image = await doc.embedPng(png);
  const escala = Math.min(
    A4_LANDSCAPE[0] / image.width,
    A4_LANDSCAPE[1] / image.height
  );
  const width = image.width * escala;
  const height = image.height * escala;
  page.drawImage(image, {
    x: (A4_LANDSCAPE[0] - width) / 2,
    y: (A4_LANDSCAPE[1] - height) / 2,
    width,
    height,
  });
  return Buffer.from(await doc.save());
}
```

En `diploma-service.ts`, después de guardar el PNG: generar el PDF, subirlo con `buildParticipantCardStorageKey({ ..., extension: "pdf" })`, persistirlo como `DnxMediaAsset` de tipo `PARTICIPANT_CARD_PDF` y guardar `pdfAssetId` / `pdfStorageKey` en la pieza.

- [ ] **Step 4: Correr los tests**

Run: `pnpm --filter clickaton test:clickaton-diplomas`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/clickaton/lib/diplomas
git commit -m "feat(clickaton): PDF A4 del diploma"
```

---

### Task 13: Página pública de verificación

**Files:**
- Create: `apps/clickaton/lib/diplomas/diploma-verification.ts`
- Create: `apps/clickaton/lib/diplomas/__tests__/diploma-verification.test.ts`
- Create: `apps/clickaton/app/(public)/diplomas/verificar/[token]/page.tsx`

**Interfaces:**
- Produces: `resolveDiplomaVerification(token, deps?): Promise<DiplomaVerificationView>` con
  `DiplomaVerificationView = { state: "VALID"; participantName: string; editionName: string; eventDateLabel: string; issuedAtLabel: string; diplomaCode: string } | { state: "REVOKED"; participantName: string; diplomaCode: string } | { state: "NOT_FOUND" }`.

- [ ] **Step 1: Escribir los tests que fallan**

```typescript
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveDiplomaVerification } from "@/lib/diplomas/diploma-verification";

const issue = {
  diplomaCode: "DIP-CK1-0042",
  issuedAt: new Date("2026-09-22T12:00:00Z"),
  revokedAt: null as Date | null,
  registration: { firstName: "Ana", lastName: "Pérez" },
  edition: { name: "1ª Edición", startAt: new Date("2026-09-19T19:00:00Z") },
};

describe("resolveDiplomaVerification", () => {
  it("muestra el diploma válido", async () => {
    const out = await resolveDiplomaVerification("tok", { loadIssue: async () => issue });
    assert.equal(out.state, "VALID");
    assert.equal(out.state === "VALID" && out.participantName, "Ana Pérez");
  });

  it("dice que no existe con un token desconocido", async () => {
    const out = await resolveDiplomaVerification("nope", { loadIssue: async () => null });
    assert.equal(out.state, "NOT_FOUND");
  });

  it("muestra el estado revocado", async () => {
    const out = await resolveDiplomaVerification("tok", {
      loadIssue: async () => ({ ...issue, revokedAt: new Date("2026-09-23T00:00:00Z") }),
    });
    assert.equal(out.state, "REVOKED");
  });

  it("no expone datos de contacto", async () => {
    const out = await resolveDiplomaVerification("tok", { loadIssue: async () => issue });
    assert.ok(!JSON.stringify(out).includes("@"));
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter clickaton test:clickaton-diplomas`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`diploma-verification.ts` con la lógica de estados y el formato de fechas en es-AR. La página es un server component que llama a esa función y renderiza los tres estados, con `robots: { index: false, follow: false }` y sin sesión.

- [ ] **Step 4: Correr los tests y probar la página**

Run: `pnpm --filter clickaton test:clickaton-diplomas`
Expected: PASS. Con la app en `dev`, abrir `/diplomas/verificar/<token de un diploma real>` y ver los datos; con un token inventado, el mensaje de que no existe.

- [ ] **Step 5: Commit**

```bash
git add apps/clickaton
git commit -m "feat(clickaton): verificacion publica del diploma"
```

---

---

### Task 13b: Mi cuenta entrega el diploma

**Files:**
- Modify: `apps/clickaton/app/api/account/registrations/[registrationId]/cards/[cardType]/route.ts`
- Modify: `apps/clickaton/app/api/account/registrations/[registrationId]/cards/[cardType]/status/route.ts`
- Modify: `apps/clickaton/app/(public)/mi-cuenta/inscripciones/[id]/page.tsx`
- Modify: `apps/clickaton/lib/participant-cards/__tests__/participant-card-routes.contract.test.ts`

**Interfaces:**
- Produces: `GET /api/account/registrations/<id>/cards/diploma` devuelve el PNG, y con `?format=pdf` el PDF.

- [ ] **Step 1: Escribir el test de contrato que falla**

En `participant-card-routes.contract.test.ts`:

```typescript
describe("ruta de pieza del participante — diploma", () => {
  it("acepta el tipo diploma", () => {
    assert.equal(isSupportedCardTypeParam("diploma"), true);
  });

  it("acepta el formato pdf sólo para el diploma", () => {
    assert.equal(resolveCardFormat({ cardType: "diploma", format: "pdf" }), "pdf");
    assert.equal(resolveCardFormat({ cardType: "welcome", format: "pdf" }), "png");
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter clickaton test:clickaton-participant-cards`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Ampliar la validación del parámetro de tipo para aceptar `diploma`, y agregar `resolveCardFormat` que devuelve `pdf` únicamente cuando el tipo es `diploma` y el parámetro lo pide. La ruta lee `pdfStorageKey` en ese caso y responde con `application/pdf`. La autorización no cambia: el participante sólo ve lo suyo.

En la pantalla de la inscripción, mostrar el diploma cuando existe, con los dos botones de descarga y una línea que diga desde qué maratón se emitió.

- [ ] **Step 4: Correr los tests**

Run: `pnpm --filter clickaton test:clickaton-participant-cards`
Expected: PASS.

- [ ] **Step 5: Probarlo como participante**

Con la app en `dev`, entrar a Mi cuenta con un participante que tenga diploma y bajar el PNG y el PDF.
Expected: los dos archivos abren correctamente.

- [ ] **Step 6: Commit**

```bash
git add apps/clickaton
git commit -m "feat(clickaton): el participante descarga su diploma desde Mi cuenta"
```

# FASE 3 — Correo

### Task 14: Envío del diploma por correo

**Files:**
- Create: `apps/clickaton/lib/diplomas/diploma-email.ts`
- Create: `apps/clickaton/lib/diplomas/__tests__/diploma-email.test.ts`
- Create: `apps/clickaton/app/api/admin/editions/[editionId]/diplomas/email/route.ts`
- Modify: `apps/clickaton/lib/diplomas/diploma-batch.ts` (procesar los correos encolados)

**Interfaces:**
- Consumes: `sendParticipantFunnelEmail` de `lib/registration/notifications/participant-email.ts` como referencia de formato y de resolución de destinatario.
- Produces: `enqueueEditionDiplomaEmails(editionId, deps?): Promise<{ queued: number; withoutEmail: number; alreadySent: number }>` y `buildDiplomaEmail(input): { subject: string; text: string; html: string }`.

- [ ] **Step 1: Escribir los tests que fallan**

```typescript
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDiplomaEmail, enqueueEditionDiplomaEmails } from "@/lib/diplomas/diploma-email";

describe("buildDiplomaEmail", () => {
  it("nombra al participante y a la edición", () => {
    const mail = buildDiplomaEmail({
      participantName: "Ana",
      editionName: "1ª Edición",
      accountUrl: "https://maratonfotografica.com/mi-cuenta/inscripciones/reg_1",
      diplomaImageUrl: "https://cdn.example/diploma.png",
    });
    assert.ok(mail.subject.includes("diploma"));
    assert.ok(mail.html.includes("Ana"));
    assert.ok(mail.html.includes("1ª Edición"));
    assert.ok(mail.html.includes("mi-cuenta/inscripciones/reg_1"));
  });

  it("el texto plano también lleva el enlace", () => {
    const mail = buildDiplomaEmail({
      participantName: "Ana",
      editionName: "1ª Edición",
      accountUrl: "https://maratonfotografica.com/mi-cuenta/inscripciones/reg_1",
      diplomaImageUrl: "https://cdn.example/diploma.png",
    });
    assert.ok(mail.text.includes("https://maratonfotografica.com/mi-cuenta/inscripciones/reg_1"));
  });
});

describe("enqueueEditionDiplomaEmails", () => {
  it("encola sólo a los que tienen diploma y dirección", async () => {
    const encolados: string[] = [];
    const out = await enqueueEditionDiplomaEmails("ed_1", {
      loadIssued: async () => [
        { id: "d1", registrationId: "r1", email: "ana@example.test", emailStatus: "NOT_SENT" },
        { id: "d2", registrationId: "r2", email: "", emailStatus: "NOT_SENT" },
        { id: "d3", registrationId: "r3", email: "beto@example.test", emailStatus: "SENT" },
      ],
      enqueue: async (id: string) => {
        encolados.push(id);
      },
      markNoEmail: async () => {},
    });
    assert.deepEqual(encolados, ["d1"]);
    assert.equal(out.withoutEmail, 1);
    assert.equal(out.alreadySent, 1);
  });

  it("dos clics no reenvían", async () => {
    const enviados = new Set<string>();
    const deps = {
      loadIssued: async () => [
        {
          id: "d1",
          registrationId: "r1",
          email: "ana@example.test",
          emailStatus: enviados.has("d1") ? "QUEUED" : "NOT_SENT",
        },
      ],
      enqueue: async (id: string) => {
        enviados.add(id);
      },
      markNoEmail: async () => {},
    };
    await enqueueEditionDiplomaEmails("ed_1", deps);
    const segunda = await enqueueEditionDiplomaEmails("ed_1", deps);
    assert.equal(segunda.queued, 0);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter clickaton test:clickaton-diplomas`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`enqueueEditionDiplomaEmails` crea un `ClickatonIntegrationOutboxEvent` con `idempotencyKey: diploma_email:<diplomaId>` y deja el diploma en `emailStatus: "QUEUED"`; los que no tienen dirección quedan en `NO_EMAIL`. El procesador del outbox arma el correo con `buildDiplomaEmail`, lo manda y anota `SENT` con la fecha, o `BOUNCED` con el error.

- [ ] **Step 4: Correr los tests**

Run: `pnpm --filter clickaton test:clickaton-diplomas`
Expected: PASS.

- [ ] **Step 5: Prueba de entrega antes de mandar a todos**

Emitir tres diplomas de prueba dirigidos a tres direcciones propias, **una de ellas de Gmail**, y enviarlos.
Expected: llegan los tres. **Si el de Gmail no llega, la fase 3 se detiene acá** y los diplomas se reparten con el ZIP de la fase 1. No mandar los 29 hasta que Gmail reciba.

- [ ] **Step 6: Commit**

```bash
git add apps/clickaton
git commit -m "feat(clickaton): envio del diploma por correo con registro por participante"
```

---

## Verificación final

- [ ] `pnpm --filter clickaton test:clickaton-diplomas`
- [ ] `pnpm --filter clickaton test:clickaton-participant-cards`
- [ ] `pnpm --filter @repo/template-engine test`
- [ ] `pnpm --filter @repo/template-engine-renderer test`
- [ ] `pnpm --filter clickaton check-types`
- [ ] `pnpm --filter clickaton lint`
- [ ] `pnpm --filter clickaton build`
- [ ] En la edición real: plantilla asignada, ejemplo visto, 29 diplomas generados, ZIP descargado y abierto, un QR escaneado con el teléfono que abre la página de verificación.
