# Centro de Transmisión — Etapa 0: consentimientos de ubicación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que toda inscripción nueva de Clickatón registre tres consentimientos separados de ubicación, y que quien ya se inscribió pueda darlos o revocarlos desde Mi cuenta.

**Architecture:** Un módulo de dominio puro (`lib/broadcast-consent/domain`) decide qué fechas de consentimiento corresponden a partir de tres casillas y de la edad declarada. El funnel de inscripción existente lo consume en el borde de aplicación (`public-registration-service`), lo persiste por los dos repositorios (Prisma y en memoria) y lo expone en el wizard. Una server action separada permite dar o revocar después, desde Mi cuenta.

**Tech Stack:** Next.js (App Router), TypeScript, Prisma, PostgreSQL (Neon), `node:test` corrido con `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-09-21-clickaton-centro-de-transmision-design.md`

## Global Constraints

- **Idioma:** todo el texto de cara al usuario, los comentarios y los mensajes de commit van en español rioplatense.
- **Ninguna casilla viene marcada por defecto.** Ninguna de las tres es obligatoria para inscribirse.
- **La casilla 2 (mapa público) exige la casilla 1 y la declaración de mayoría de edad.** Si falta cualquiera de las dos, la casilla 2 no vale, aunque venga marcada en el formulario.
- **Un menor de edad nunca queda con `locationPublicConsentAt`.** Ni por el formulario, ni por Mi cuenta, ni por el panel de administración.
- **Versión del consentimiento:** `CLICKATON_LOCATION_CONSENT_VERSION = "CLICKATON_LOCATION_2026_09_v1"`. Es una versión **propia**, separada de `CLICKATON_TERMS_VERSION`. No se toca el texto de las bases vigentes ni se invalida ninguna aceptación anterior.
- **Aditivo:** ningún campo existente de `ClickatonRegistration` cambia de significado. Todos los campos nuevos son opcionales y su ausencia significa "no consintió".
- **Cinco bases Neon:** cada migración se aplica a mano en las cinco y se registra en `_prisma_migrations` con el checksum de una base sana.
- **Runner de tests:** `node:test` + `assert/strict`, corrido con `tsx --test`. No hay vitest ni jest en este proyecto.
- **Rama de trabajo:** `docs/clickaton-panel-streaming`, en el worktree `~/Desktop/PROGRAMACIONES/dnx-ck-streaming`.

---

## Estructura de archivos

**Módulo nuevo — `apps/clickaton/lib/broadcast-consent/`**

| Archivo | Responsabilidad |
|---|---|
| `content/location-consent-copy.ts` | El texto de las tres casillas y la constante de versión. Una sola fuente para el wizard, Mi cuenta y las bases |
| `domain/location-consent.ts` | Reglas puras: de tres casillas + edad a cuatro campos de base. Sin Prisma, sin React |
| `domain/location-consent.test.ts` | Tests del dominio |
| `actions/update-location-consent.ts` | Server action para dar o revocar desde Mi cuenta |

**Archivos existentes que se modifican**

| Archivo | Qué cambia |
|---|---|
| `packages/db/prisma/schema.prisma` | 5 campos nuevos en `ClickatonRegistration` |
| `packages/db/prisma/migrations/20260922090000_clickaton_consentimientos_ubicacion/migration.sql` | La migración (archivo nuevo) |
| `apps/clickaton/lib/registration/domain/commands.ts` | 4 campos nuevos en `CreateDraftRegistrationCommand` |
| `apps/clickaton/lib/public-registration/domain/types.ts` | 4 campos nuevos en `CreatePublicRegistrationInput` |
| `apps/clickaton/lib/public-registration/actions/public-registration.ts` | Leer las casillas del `FormData` |
| `apps/clickaton/lib/public-registration/application/public-registration-service.ts` | Llamar al dominio y pasar el resultado al comando |
| `apps/clickaton/lib/public-registration/infrastructure/prisma-public-registration-repository.ts` | Persistir los 4 campos |
| `apps/clickaton/lib/public-registration/infrastructure/in-memory-public-registration-repository.ts` | Persistir los 4 campos en memoria |
| `apps/clickaton/components/public-registration/PublicRegistrationWizard.tsx` | Las tres casillas en el paso de revisión |
| `apps/clickaton/app/(public)/mi-cuenta/inscripciones/[id]/page.tsx` | Montar el panel de consentimientos |
| `apps/clickaton/components/participant/LocationConsentPanel.tsx` | El panel (archivo nuevo) |
| `apps/clickaton/package.json` | Dos scripts de test nuevos |

---

## Task 1: El texto y las reglas del consentimiento

**Files:**
- Create: `apps/clickaton/lib/broadcast-consent/content/location-consent-copy.ts`
- Create: `apps/clickaton/lib/broadcast-consent/domain/location-consent.ts`
- Test: `apps/clickaton/lib/broadcast-consent/domain/location-consent.test.ts`
- Modify: `apps/clickaton/package.json` (agregar el script `test:location-consent`)

**Interfaces:**
- Consumes: `evaluateMinorGate` de `@/lib/rules-2026/minors` (ya existe; devuelve `{ ok: true, isMinor: false }` cuando `birthDate` es `null`).
- Produces:
  - `CLICKATON_LOCATION_CONSENT_VERSION: "CLICKATON_LOCATION_2026_09_v1"`
  - `locationConsentCopy: { personal: string; publicMap: string; interview: string; adultDeclaration: string; revokeNote: string }`
  - `type LocationConsentChoices = { personal: boolean; publicMap: boolean; interview: boolean; declaredAdult: boolean }`
  - `type LocationConsentFields = { locationConsentAt: Date | null; locationPublicConsentAt: Date | null; interviewConsentAt: Date | null; locationConsentVersion: string | null }`
  - `resolveLocationConsent(input: { choices: LocationConsentChoices; birthDate: Date | null; eventDate: Date; now: Date; previous?: LocationConsentFields }): LocationConsentFields`

- [ ] **Step 1: Escribir el archivo de texto**

Este archivo no tiene lógica: es la fuente única del texto legal y de la versión. Lo consumen el wizard, Mi cuenta y, más adelante, las bases de la 2ª edición.

```ts
// apps/clickaton/lib/broadcast-consent/content/location-consent-copy.ts
/**
 * Consentimientos de ubicación del Centro de Transmisión.
 *
 * Versión PROPIA, separada de las Bases: agregar geolocalización no reedita
 * las Bases vigentes ni invalida las aceptaciones anteriores. Cuando la 2ª
 * edición publique sus Bases, la cláusula informativa referencia esta versión.
 */

export const CLICKATON_LOCATION_CONSENT_VERSION =
  "CLICKATON_LOCATION_2026_09_v1" as const;

export const locationConsentCopy = {
  personal:
    "Quiero que la Clickatón use la ubicación de mis fotos para armarme mi recorrido y mis estadísticas personales.",
  publicMap:
    "Soy mayor de 18 años y acepto que mi nombre y mi posición aparezcan en el mapa del evento y en la transmisión en vivo.",
  interview:
    "Acepto que el equipo de transmisión me contacte por teléfono o WhatsApp durante el evento para una entrevista.",
  adultDeclaration:
    "Esta autorización sólo está disponible para participantes mayores de 18 años.",
  revokeNote:
    "Podés dar o quitar estos permisos cuando quieras desde Mi cuenta, antes, durante y después del evento.",
} as const;
```

- [ ] **Step 2: Escribir el test que falla**

Nueve casos. Cubren las tres casillas, la dependencia de la casilla 2, los menores por fecha de nacimiento, la revocación y la idempotencia de la fecha ya otorgada.

```ts
// apps/clickaton/lib/broadcast-consent/domain/location-consent.test.ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveLocationConsent,
  type LocationConsentChoices,
} from "./location-consent";
import { CLICKATON_LOCATION_CONSENT_VERSION } from "../content/location-consent-copy";

const AHORA = new Date("2026-10-01T12:00:00.000Z");
const ANTES = new Date("2026-09-25T10:00:00.000Z");
const EVENTO = new Date("2026-12-12T15:00:00.000Z");

const NINGUNA: LocationConsentChoices = {
  personal: false,
  publicMap: false,
  interview: false,
  declaredAdult: false,
};

const VACIO = {
  locationConsentAt: null,
  locationPublicConsentAt: null,
  interviewConsentAt: null,
  locationConsentVersion: null,
};

test("sin ninguna casilla marcada no guarda ningún consentimiento", () => {
  const r = resolveLocationConsent({
    choices: NINGUNA,
    birthDate: null,
    eventDate: EVENTO,
    now: AHORA,
  });
  assert.deepEqual(r, VACIO);
});

test("la casilla personal sola guarda fecha y versión", () => {
  const r = resolveLocationConsent({
    choices: { ...NINGUNA, personal: true },
    birthDate: null,
    eventDate: EVENTO,
    now: AHORA,
  });
  assert.deepEqual(r.locationConsentAt, AHORA);
  assert.equal(r.locationPublicConsentAt, null);
  assert.equal(r.interviewConsentAt, null);
  assert.equal(r.locationConsentVersion, CLICKATON_LOCATION_CONSENT_VERSION);
});

test("la casilla del mapa público no vale sin la personal", () => {
  const r = resolveLocationConsent({
    choices: { ...NINGUNA, publicMap: true, declaredAdult: true },
    birthDate: null,
    eventDate: EVENTO,
    now: AHORA,
  });
  assert.equal(r.locationPublicConsentAt, null);
});

test("la casilla del mapa público no vale sin declarar mayoría de edad", () => {
  const r = resolveLocationConsent({
    choices: { ...NINGUNA, personal: true, publicMap: true },
    birthDate: null,
    eventDate: EVENTO,
    now: AHORA,
  });
  assert.deepEqual(r.locationConsentAt, AHORA);
  assert.equal(r.locationPublicConsentAt, null);
});

test("con personal, mapa público y mayoría declarada guarda las dos fechas", () => {
  const r = resolveLocationConsent({
    choices: { ...NINGUNA, personal: true, publicMap: true, declaredAdult: true },
    birthDate: null,
    eventDate: EVENTO,
    now: AHORA,
  });
  assert.deepEqual(r.locationConsentAt, AHORA);
  assert.deepEqual(r.locationPublicConsentAt, AHORA);
});

test("un menor por fecha de nacimiento nunca entra al mapa público", () => {
  const r = resolveLocationConsent({
    choices: { ...NINGUNA, personal: true, publicMap: true, declaredAdult: true },
    birthDate: new Date("2012-01-01T00:00:00.000Z"),
    eventDate: EVENTO,
    now: AHORA,
  });
  assert.deepEqual(r.locationConsentAt, AHORA);
  assert.equal(r.locationPublicConsentAt, null);
});

test("la casilla de entrevista es independiente de las otras dos", () => {
  const r = resolveLocationConsent({
    choices: { ...NINGUNA, interview: true },
    birthDate: null,
    eventDate: EVENTO,
    now: AHORA,
  });
  assert.equal(r.locationConsentAt, null);
  assert.deepEqual(r.interviewConsentAt, AHORA);
  assert.equal(r.locationConsentVersion, CLICKATON_LOCATION_CONSENT_VERSION);
});

test("revocar la personal también revoca el mapa público", () => {
  const r = resolveLocationConsent({
    choices: { ...NINGUNA, publicMap: true, declaredAdult: true },
    birthDate: null,
    eventDate: EVENTO,
    now: AHORA,
    previous: {
      locationConsentAt: ANTES,
      locationPublicConsentAt: ANTES,
      interviewConsentAt: null,
      locationConsentVersion: CLICKATON_LOCATION_CONSENT_VERSION,
    },
  });
  assert.equal(r.locationConsentAt, null);
  assert.equal(r.locationPublicConsentAt, null);
});

test("un consentimiento ya otorgado conserva su fecha original", () => {
  const r = resolveLocationConsent({
    choices: { ...NINGUNA, personal: true, interview: true },
    birthDate: null,
    eventDate: EVENTO,
    now: AHORA,
    previous: {
      locationConsentAt: ANTES,
      locationPublicConsentAt: null,
      interviewConsentAt: null,
      locationConsentVersion: CLICKATON_LOCATION_CONSENT_VERSION,
    },
  });
  assert.deepEqual(r.locationConsentAt, ANTES, "no se pisa la fecha original");
  assert.deepEqual(r.interviewConsentAt, AHORA, "la nueva sí toma el ahora");
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Agregar primero el script en `apps/clickaton/package.json`, junto a los demás `test:*` (por ejemplo después de `"test:registration-clock"`):

```json
"test:location-consent": "tsx --test lib/broadcast-consent/domain/location-consent.test.ts",
```

Correr desde `apps/clickaton`:

```bash
npm run test:location-consent
```

Esperado: FALLA con `Cannot find module './location-consent'`.

- [ ] **Step 4: Escribir el dominio**

```ts
// apps/clickaton/lib/broadcast-consent/domain/location-consent.ts
/**
 * De tres casillas a cuatro campos de base.
 *
 * Reglas duras del diseño:
 * - La casilla del mapa público exige la personal y la mayoría de edad.
 * - Un menor nunca queda con locationPublicConsentAt, aunque marque todo.
 * - Un consentimiento ya otorgado conserva su fecha original: la fecha dice
 *   cuándo consintió, no cuándo se guardó por última vez.
 * - Desmarcar una casilla revoca (deja la fecha en null).
 */
import { evaluateMinorGate } from "@/lib/rules-2026/minors";

import { CLICKATON_LOCATION_CONSENT_VERSION } from "../content/location-consent-copy";

export type LocationConsentChoices = {
  /** Usar mi ubicación para mis estadísticas personales. */
  personal: boolean;
  /** Aparecer en el mapa público y en la transmisión. */
  publicMap: boolean;
  /** Que el equipo de transmisión me contacte. */
  interview: boolean;
  /** Declaración de mayoría de edad, incrustada en la casilla del mapa. */
  declaredAdult: boolean;
};

export type LocationConsentFields = {
  locationConsentAt: Date | null;
  locationPublicConsentAt: Date | null;
  interviewConsentAt: Date | null;
  locationConsentVersion: string | null;
};

export function resolveLocationConsent(input: {
  choices: LocationConsentChoices;
  birthDate: Date | null;
  eventDate: Date;
  now: Date;
  previous?: LocationConsentFields;
}): LocationConsentFields {
  const { choices, now, previous } = input;

  const gate = evaluateMinorGate({
    birthDate: input.birthDate,
    eventDate: input.eventDate,
  });
  const isMinor = gate.ok === false || gate.isMinor === true;

  const personal = choices.personal;
  const publicMap =
    choices.publicMap && personal && choices.declaredAdult && !isMinor;
  const interview = choices.interview;

  const keep = (granted: boolean, before: Date | null | undefined) =>
    granted ? (before ?? now) : null;

  const fields: LocationConsentFields = {
    locationConsentAt: keep(personal, previous?.locationConsentAt),
    locationPublicConsentAt: keep(publicMap, previous?.locationPublicConsentAt),
    interviewConsentAt: keep(interview, previous?.interviewConsentAt),
    locationConsentVersion: null,
  };

  const alguno =
    fields.locationConsentAt !== null ||
    fields.locationPublicConsentAt !== null ||
    fields.interviewConsentAt !== null;

  fields.locationConsentVersion = alguno
    ? CLICKATON_LOCATION_CONSENT_VERSION
    : null;

  return fields;
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

```bash
npm run test:location-consent
```

Esperado: `# pass 9`, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add apps/clickaton/lib/broadcast-consent apps/clickaton/package.json
git commit -m "Definir las reglas de los consentimientos de ubicación

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Los campos en la base

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelo `ClickatonRegistration`)
- Create: `packages/db/prisma/migrations/20260922090000_clickaton_consentimientos_ubicacion/migration.sql`

**Interfaces:**
- Produces: los campos `locationConsentAt`, `locationPublicConsentAt`, `interviewConsentAt`, `locationConsentVersion` y `locationConsentDeclaredAdult` en `ClickatonRegistration`, disponibles para el cliente de Prisma que consumen las tareas 3 y 5.

- [ ] **Step 1: Agregar los campos al schema**

En `packages/db/prisma/schema.prisma`, dentro de `model ClickatonRegistration`, inmediatamente después de la línea `consentVersion                     String?`:

```prisma
  /// Centro de Transmisión — consentimientos de ubicación (versión propia,
  /// separada de las Bases). Null = no consintió.
  locationConsentAt                  DateTime?
  locationPublicConsentAt            DateTime?
  interviewConsentAt                 DateTime?
  locationConsentVersion             String?
  /// Declaración de mayoría de edad incrustada en la casilla del mapa público.
  locationConsentDeclaredAdult       Boolean                              @default(false)
```

- [ ] **Step 2: Escribir la migración**

```sql
-- packages/db/prisma/migrations/20260922090000_clickaton_consentimientos_ubicacion/migration.sql
-- Centro de Transmisión, etapa 0: consentimientos de ubicación.
-- Aditivo y reversible: sin default en las fechas, null = no consintió.

ALTER TABLE "ClickatonRegistration"
  ADD COLUMN IF NOT EXISTS "locationConsentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "locationPublicConsentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "interviewConsentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "locationConsentVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "locationConsentDeclaredAdult" BOOLEAN NOT NULL DEFAULT false;

-- El panel del operador filtra por quién aceptó aparecer en el mapa.
CREATE INDEX IF NOT EXISTS "ClickatonRegistration_locationPublicConsentAt_idx"
  ON "ClickatonRegistration" ("locationPublicConsentAt");
```

- [ ] **Step 3: Verificar que el cliente de Prisma compila**

```bash
cd packages/db && npx prisma generate
```

Esperado: `Generated Prisma Client`, sin errores de schema.

- [ ] **Step 4: Aplicar el SQL en las cinco bases Neon**

El SQL es idempotente (`IF NOT EXISTS`), así que se puede repetir sin romper nada. Aplicarlo en cada una de las cinco bases y **después** registrar la migración en `_prisma_migrations` con el checksum de una base sana, o el historial queda desincronizado y el próximo deploy falla.

Esperado por base: `ALTER TABLE` y `CREATE INDEX` sin error, y una fila nueva en `_prisma_migrations` con `migration_name = '20260922090000_clickaton_consentimientos_ubicacion'` y `finished_at` no nulo.

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260922090000_clickaton_consentimientos_ubicacion
git commit -m "Guardar los consentimientos de ubicación en la inscripción

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Pasar el consentimiento por el funnel de inscripción

**Files:**
- Modify: `apps/clickaton/lib/registration/domain/commands.ts`
- Modify: `apps/clickaton/lib/public-registration/domain/types.ts`
- Modify: `apps/clickaton/lib/public-registration/actions/public-registration.ts`
- Modify: `apps/clickaton/lib/public-registration/application/public-registration-service.ts`
- Modify: `apps/clickaton/lib/public-registration/infrastructure/prisma-public-registration-repository.ts`
- Modify: `apps/clickaton/lib/public-registration/infrastructure/in-memory-public-registration-repository.ts`
- Test: `apps/clickaton/lib/public-registration/application/location-consent-funnel.test.ts`
- Modify: `apps/clickaton/package.json`

**Interfaces:**
- Consumes: `resolveLocationConsent`, `LocationConsentFields` (Task 1); los campos de base (Task 2).
- Produces: `CreatePublicRegistrationInput` acepta `locationConsent?: boolean`, `locationPublicConsent?: boolean`, `interviewConsent?: boolean`, `locationDeclaredAdult?: boolean`; y `CreateDraftRegistrationCommand` acepta `locationConsentAt`, `locationPublicConsentAt`, `interviewConsentAt`, `locationConsentVersion`, `locationConsentDeclaredAdult`.

- [ ] **Step 1: Escribir el test que falla**

Usa el repositorio en memoria que ya existe, igual que `registration-clock.test.ts`. Abrir ese archivo primero para copiar el armado del escenario (`createInMemoryPublicStore`, `seedPublicEdition`, `seedPublicTicket`, `createPublicRegistrationService`) y replicarlo acá con los mismos valores; las tres pruebas nuevas sólo cambian el input de consentimiento.

```ts
// apps/clickaton/lib/public-registration/application/location-consent-funnel.test.ts
import assert from "node:assert/strict";
import test from "node:test";

import { CLICKATON_LOCATION_CONSENT_VERSION } from "@/lib/broadcast-consent/content/location-consent-copy";

import {
  crearEscenario,
  inscribir,
} from "./location-consent-funnel.fixture";

test("una inscripción sin casillas de ubicación no guarda consentimiento", async () => {
  const esc = crearEscenario();
  const reg = await inscribir(esc, {});
  assert.equal(reg.locationConsentAt, null);
  assert.equal(reg.locationPublicConsentAt, null);
  assert.equal(reg.interviewConsentAt, null);
  assert.equal(reg.locationConsentVersion, null);
});

test("una inscripción con las tres casillas guarda las tres fechas y la versión", async () => {
  const esc = crearEscenario();
  const reg = await inscribir(esc, {
    locationConsent: true,
    locationPublicConsent: true,
    interviewConsent: true,
    locationDeclaredAdult: true,
  });
  assert.notEqual(reg.locationConsentAt, null);
  assert.notEqual(reg.locationPublicConsentAt, null);
  assert.notEqual(reg.interviewConsentAt, null);
  assert.equal(reg.locationConsentVersion, CLICKATON_LOCATION_CONSENT_VERSION);
});

test("el mapa público no se guarda si no se declaró mayoría de edad", async () => {
  const esc = crearEscenario();
  const reg = await inscribir(esc, {
    locationConsent: true,
    locationPublicConsent: true,
  });
  assert.notEqual(reg.locationConsentAt, null);
  assert.equal(reg.locationPublicConsentAt, null);
});
```

Y el armado compartido, en su propio archivo para que el test se lea:

```ts
// apps/clickaton/lib/public-registration/application/location-consent-funnel.fixture.ts
/**
 * Armado mínimo para probar el funnel contra el repositorio en memoria.
 * La edición se siembra con la ventana de inscripción abierta alrededor del
 * reloj fijo, para que createRegistration no rebote por ventana cerrada.
 */
import { fixedClock } from "@/lib/timeline/clock";

import {
  createInMemoryPublicRegistrationRepository,
  createInMemoryPublicStore,
  newIdempotencyKey,
  seedPublicEdition,
  seedPublicTicket,
  type InMemoryPublicStore,
} from "../infrastructure/in-memory-public-registration-repository";
import { createPublicRegistrationService } from "./public-registration-service";

const ABRE = new Date("2026-09-01T12:00:00.000Z");
const CIERRA = new Date("2026-12-01T23:59:00.000Z");
const AHORA = new Date("2026-10-01T12:00:00.000Z");

export type Escenario = {
  store: InMemoryPublicStore;
  service: ReturnType<typeof createPublicRegistrationService>;
  editionSlug: string;
  ticketTypeId: string;
};

export function crearEscenario(): Escenario {
  const store = createInMemoryPublicStore();
  seedPublicEdition(store, {
    id: "ed_consent",
    slug: "consentimientos-ubicacion",
    name: "Edición de prueba de consentimientos",
    shortDescription: "Prueba",
    status: "REGISTRATION_OPEN",
    isPublished: true,
    registrationEnabled: true,
    registrationOpenAt: ABRE,
    registrationCloseAt: CIERRA,
    startAt: new Date("2026-12-12T15:00:00.000Z"),
    endAt: new Date("2026-12-12T23:00:00.000Z"),
    timezone: "America/Argentina/Buenos_Aires",
    visibleCodePrefix: "CNS26",
  });
  seedPublicTicket(store, {
    id: "tt_general",
    editionId: "ed_consent",
    venueId: null,
    name: "General",
    description: null,
    code: "GEN",
    priceAmount: 1_500_000,
    currency: "ARS",
    capacity: 100,
    holdMinutes: 20,
    isActive: true,
    salesStartAt: ABRE,
    salesEndAt: CIERRA,
    products: [],
  });

  const clock = fixedClock(AHORA);
  return {
    store,
    service: createPublicRegistrationService({
      repo: createInMemoryPublicRegistrationRepository(store, { clock }),
      clock,
    }),
    editionSlug: "consentimientos-ubicacion",
    ticketTypeId: "tt_general",
  };
}

export async function inscribir(
  esc: Escenario,
  consent: {
    locationConsent?: boolean;
    locationPublicConsent?: boolean;
    interviewConsent?: boolean;
    locationDeclaredAdult?: boolean;
  },
) {
  const result = await esc.service.createRegistration({
    editionSlug: esc.editionSlug,
    venueId: null,
    ticketTypeId: esc.ticketTypeId,
    variantChoices: [],
    participant: {
      firstName: "Ana",
      lastName: "Pérez",
      email: `ana+${newIdempotencyKey()}@example.com`,
      city: "Santa Fe",
      province: "Santa Fe",
      country: "AR",
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: true,
    instagramHandle: "anaperez",
    profilePhotoAssetId: "asset-test",
    idempotencyKey: newIdempotencyKey(),
    ...consent,
  });
  const reg = esc.store.domain.registrations.get(result.registrationId);
  if (!reg) throw new Error("no se creó la inscripción");
  return reg;
}
```

> Dos detalles del armado: `crearEscenario` es síncrona, así que en el test va sin `await`; y el resultado de `createRegistration` tiene que exponer `registrationId` — si el nombre real difiere, mandan los tipos del servicio. La siembra sigue la misma forma que `lib/public-registration/application/registration-clock.test.ts`, que es el único otro test contra este repositorio en memoria.

- [ ] **Step 2: Correr el test y verificar que falla**

Agregar en `apps/clickaton/package.json`:

```json
"test:location-consent-funnel": "tsx --test lib/public-registration/application/location-consent-funnel.test.ts",
```

```bash
npm run test:location-consent-funnel
```

Esperado: FALLA. Primero por el `throw` del fixture; una vez completado, por `locationConsentAt` que no existe en la fila creada.

- [ ] **Step 3: Agregar los campos al comando**

En `apps/clickaton/lib/registration/domain/commands.ts`, después de la línea `consentVersion?: string | null;` (línea 35):

```ts
  /** Centro de Transmisión — consentimientos de ubicación. */
  locationConsentAt?: Date | null;
  locationPublicConsentAt?: Date | null;
  interviewConsentAt?: Date | null;
  locationConsentVersion?: string | null;
  locationConsentDeclaredAdult?: boolean;
```

- [ ] **Step 4: Agregar los campos al input público**

En `apps/clickaton/lib/public-registration/domain/types.ts`, dentro de `CreatePublicRegistrationInput`, después de `consentVersion?: string;`:

```ts
  /** Centro de Transmisión — las tres casillas del formulario. */
  locationConsent?: boolean;
  locationPublicConsent?: boolean;
  interviewConsent?: boolean;
  locationDeclaredAdult?: boolean;
```

- [ ] **Step 5: Leer las casillas del formulario**

En `apps/clickaton/lib/public-registration/actions/public-registration.ts`, junto a la línea `imageUsageConsent: formBool(formData, "imageUsageConsent"),`:

```ts
    locationConsent: formBool(formData, "locationConsent"),
    locationPublicConsent: formBool(formData, "locationPublicConsent"),
    interviewConsent: formBool(formData, "interviewConsent"),
    locationDeclaredAdult: formBool(formData, "locationDeclaredAdult"),
```

**Importante:** estas cuatro NO se derivan de `acceptTerms`, a diferencia de los consentimientos viejos. Son opt-in explícito. Si no vienen en el formulario, valen `false`.

- [ ] **Step 6: Resolver el consentimiento en el servicio**

En `apps/clickaton/lib/public-registration/application/public-registration-service.ts`, importar arriba:

```ts
import { resolveLocationConsent } from "@/lib/broadcast-consent/domain/location-consent";
```

Después del bloque de `promotionalLicenseConsent` (alrededor de la línea 561), agregar:

```ts
      // Centro de Transmisión: opt-in explícito, nunca derivado de acceptTerms.
      const locationConsent = resolveLocationConsent({
        choices: {
          personal: input.locationConsent === true,
          publicMap: input.locationPublicConsent === true,
          interview: input.interviewConsent === true,
          declaredAdult: input.locationDeclaredAdult === true,
        },
        birthDate: input.participant.birthDate
          ? new Date(input.participant.birthDate)
          : null,
        eventDate: edition.startAt ?? now,
        now,
      });
```

> La fecha del evento en `ClickatonEdition` se llama `startAt` y es opcional. Si en ese punto del servicio la edición no está en una variable llamada `edition`, usar la que tenga `startAt`. Con `birthDate` nulo el valor de `eventDate` no cambia el resultado.

Y en el objeto que se pasa a `createReservedRegistration`, junto a `consentVersion:` (alrededor de la línea 881):

```ts
          locationConsentAt: locationConsent.locationConsentAt,
          locationPublicConsentAt: locationConsent.locationPublicConsentAt,
          interviewConsentAt: locationConsent.interviewConsentAt,
          locationConsentVersion: locationConsent.locationConsentVersion,
          locationConsentDeclaredAdult: input.locationDeclaredAdult === true,
```

- [ ] **Step 7: Persistir en los dos repositorios**

En `apps/clickaton/lib/public-registration/infrastructure/prisma-public-registration-repository.ts`, en el `data` del `create` de la inscripción, junto a `consentVersion: input.cmd.consentVersion ?? null,` (alrededor de la línea 934):

```ts
              locationConsentAt: input.cmd.locationConsentAt ?? null,
              locationPublicConsentAt: input.cmd.locationPublicConsentAt ?? null,
              interviewConsentAt: input.cmd.interviewConsentAt ?? null,
              locationConsentVersion: input.cmd.locationConsentVersion ?? null,
              locationConsentDeclaredAdult:
                input.cmd.locationConsentDeclaredAdult ?? false,
```

Y en `in-memory-public-registration-repository.ts`, en el objeto que `createReservedRegistration` guarda en `store.domain.registrations`, las mismas cinco líneas con la misma forma. Buscar ahí dónde se copia `consentVersion` y agregarlas al lado.

- [ ] **Step 8: Correr el test y verificar que pasa**

```bash
npm run test:location-consent-funnel && npm run test:location-consent && npm run test:registration-clock
```

Esperado: los tres en verde. El tercero confirma que no se rompió el funnel existente.

- [ ] **Step 9: Verificar tipos**

```bash
npm run check-types
```

Esperado: sin errores.

- [ ] **Step 10: Commit**

```bash
git add apps/clickaton packages/db
git commit -m "Aceptar los consentimientos de ubicación al inscribirse

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Las tres casillas en el formulario

**Files:**
- Modify: `apps/clickaton/components/public-registration/PublicRegistrationWizard.tsx`

**Interfaces:**
- Consumes: `locationConsentCopy` (Task 1); los nombres de campo `locationConsent`, `locationPublicConsent`, `interviewConsent`, `locationDeclaredAdult` que lee la action (Task 3).

- [ ] **Step 1: Agregar el estado de las tres casillas**

Junto a los demás `useState` del wizard (buscar `const [acceptTerms`), agregar:

```tsx
  const [locationConsent, setLocationConsent] = useState(false);
  const [locationPublicConsent, setLocationPublicConsent] = useState(false);
  const [interviewConsent, setInterviewConsent] = useState(false);
```

Importar arriba:

```tsx
import { locationConsentCopy } from "@/lib/broadcast-consent/content/location-consent-copy";
```

- [ ] **Step 2: Enviar las casillas en el submit**

En la función `submit()`, **fuera** del `if (acceptTerms)` — estas no dependen de aceptar las bases:

```tsx
    if (locationConsent) fd.set("locationConsent", "true");
    if (locationPublicConsent) {
      fd.set("locationPublicConsent", "true");
      fd.set("locationDeclaredAdult", "true");
    }
    if (interviewConsent) fd.set("interviewConsent", "true");
```

La declaración de mayoría de edad viaja junto con la casilla del mapa porque el texto de esa casilla ya la incluye (`locationConsentCopy.publicMap`).

- [ ] **Step 3: Dibujar el bloque en el paso de revisión**

Debajo del bloque donde hoy se muestra la casilla de aceptar las bases, siguiendo el mismo marcado de esa casilla (copiar sus clases para que quede igual):

```tsx
        <div className="space-y-3 rounded-lg border border-ck-border p-4">
          <p className="text-sm font-semibold">
            Tu recorrido y la transmisión en vivo
          </p>
          <p className="text-sm text-ck-text-muted">
            Son opcionales y no afectan tu inscripción. {locationConsentCopy.revokeNote}
          </p>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={locationConsent}
              onChange={(e) => {
                setLocationConsent(e.target.checked);
                if (!e.target.checked) setLocationPublicConsent(false);
              }}
            />
            <span>{locationConsentCopy.personal}</span>
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={locationPublicConsent}
              disabled={!locationConsent}
              onChange={(e) => setLocationPublicConsent(e.target.checked)}
            />
            <span className={locationConsent ? undefined : "opacity-50"}>
              {locationConsentCopy.publicMap}
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={interviewConsent}
              onChange={(e) => setInterviewConsent(e.target.checked)}
            />
            <span>{locationConsentCopy.interview}</span>
          </label>
        </div>
```

Desmarcar la primera casilla apaga la segunda en pantalla, igual que el dominio la revoca en la base. La pantalla y las reglas dicen lo mismo.

- [ ] **Step 4: Verificar en el navegador**

```bash
npm run dev
```

Abrir el formulario público de inscripción, llegar al paso de revisión y confirmar: las tres casillas aparecen desmarcadas; la segunda está deshabilitada hasta marcar la primera; desmarcar la primera apaga la segunda; se puede inscribir sin marcar ninguna.

- [ ] **Step 5: Verificar tipos y lint**

```bash
npm run check-types && npm run lint
```

Esperado: sin errores ni warnings.

- [ ] **Step 6: Commit**

```bash
git add apps/clickaton/components/public-registration/PublicRegistrationWizard.tsx
git commit -m "Ofrecer los permisos de ubicación al inscribirse

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Dar y revocar desde Mi cuenta

Esta tarea es la que permite recuperar a los inscriptos que entraron **antes** de que las casillas existieran. Sin ella, la etapa 0 no cumple su propósito.

**Files:**
- Create: `apps/clickaton/lib/broadcast-consent/actions/update-location-consent.ts`
- Create: `apps/clickaton/components/participant/LocationConsentPanel.tsx`
- Modify: `apps/clickaton/app/(public)/mi-cuenta/inscripciones/[id]/page.tsx`

**Interfaces:**
- Consumes: `resolveLocationConsent`, `locationConsentCopy` (Task 1); los campos de base (Task 2).
- Produces: `updateLocationConsentAction(formData: FormData): Promise<{ ok: boolean; message?: string }>`, que lee `registrationId`, `locationConsent`, `locationPublicConsent`, `interviewConsent`, `locationDeclaredAdult`.

- [ ] **Step 1: Escribir la server action**

```ts
// apps/clickaton/lib/broadcast-consent/actions/update-location-consent.ts
"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@repo/db";

import { getClickatonAuthUser } from "@/lib/admin/auth";

import { resolveLocationConsent } from "../domain/location-consent";

/**
 * Da o revoca los consentimientos de ubicación de una inscripción propia.
 * La inscripción tiene que pertenecer a la sesión: acá no alcanza con conocer
 * el id.
 */
export async function updateLocationConsentAction(
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const registrationId = String(formData.get("registrationId") ?? "");
  if (!registrationId) {
    return { ok: false, message: "Falta la inscripción." };
  }

  const user = await getClickatonAuthUser();
  if (!user) return { ok: false, message: "Iniciá sesión para cambiar esto." };

  const actual = await prisma.clickatonRegistration.findUnique({
    where: { id: registrationId },
    select: {
      userId: true,
      email: true,
      birthDate: true,
      locationConsentAt: true,
      locationPublicConsentAt: true,
      interviewConsentAt: true,
      locationConsentVersion: true,
      edition: { select: { startAt: true } },
    },
  });
  if (!actual) return { ok: false, message: "No encontramos la inscripción." };

  // Misma regla de propiedad que la página de Mi cuenta: la sesión tiene que
  // ser del dueño. Conocer el id no alcanza.
  const owns =
    actual.userId === user.id ||
    actual.email.toLowerCase() === user.email.toLowerCase();
  if (!owns) {
    return { ok: false, message: "No podés modificar esta inscripción." };
  }

  const now = new Date();
  const fields = resolveLocationConsent({
    choices: {
      personal: formData.get("locationConsent") === "true",
      publicMap: formData.get("locationPublicConsent") === "true",
      interview: formData.get("interviewConsent") === "true",
      declaredAdult: formData.get("locationDeclaredAdult") === "true",
    },
    birthDate: actual.birthDate,
    eventDate: actual.edition?.startAt ?? now,
    now,
    previous: {
      locationConsentAt: actual.locationConsentAt,
      locationPublicConsentAt: actual.locationPublicConsentAt,
      interviewConsentAt: actual.interviewConsentAt,
      locationConsentVersion: actual.locationConsentVersion,
    },
  });

  await prisma.clickatonRegistration.update({
    where: { id: registrationId },
    data: {
      ...fields,
      locationConsentDeclaredAdult:
        formData.get("locationDeclaredAdult") === "true",
    },
  });

  revalidatePath(`/mi-cuenta/inscripciones/${registrationId}`);
  return { ok: true };
}
```

> La regla de propiedad es exactamente la que ya usa `app/(public)/mi-cuenta/inscripciones/[id]/page.tsx`: o coincide `userId`, o coincide el email de la sesión. **No se puede autorizar sólo por el id**: quien conozca un id ajeno no debe poder cambiarle los permisos a otra persona.

- [ ] **Step 2: Escribir el panel**

```tsx
// apps/clickaton/components/participant/LocationConsentPanel.tsx
"use client";

import { useState, useTransition } from "react";

import { updateLocationConsentAction } from "@/lib/broadcast-consent/actions/update-location-consent";
import { locationConsentCopy } from "@/lib/broadcast-consent/content/location-consent-copy";
import { Card } from "@/components/ui/Card";

export function LocationConsentPanel(props: {
  registrationId: string;
  locationConsentAt: Date | null;
  locationPublicConsentAt: Date | null;
  interviewConsentAt: Date | null;
}) {
  const [personal, setPersonal] = useState(props.locationConsentAt !== null);
  const [publicMap, setPublicMap] = useState(
    props.locationPublicConsentAt !== null,
  );
  const [interview, setInterview] = useState(props.interviewConsentAt !== null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function guardar() {
    const fd = new FormData();
    fd.set("registrationId", props.registrationId);
    if (personal) fd.set("locationConsent", "true");
    if (publicMap) {
      fd.set("locationPublicConsent", "true");
      fd.set("locationDeclaredAdult", "true");
    }
    if (interview) fd.set("interviewConsent", "true");
    startTransition(async () => {
      const r = await updateLocationConsentAction(fd);
      setMessage(r.ok ? "Guardado." : (r.message ?? "No se pudo guardar."));
    });
  }

  return (
    <Card variant="outlined" className="space-y-4 p-6">
      <h2 className="font-semibold">Tu recorrido y la transmisión en vivo</h2>
      <p className="text-sm text-ck-text-muted">
        {locationConsentCopy.revokeNote}
      </p>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={personal}
          onChange={(e) => {
            setPersonal(e.target.checked);
            if (!e.target.checked) setPublicMap(false);
          }}
        />
        <span>{locationConsentCopy.personal}</span>
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={publicMap}
          disabled={!personal}
          onChange={(e) => setPublicMap(e.target.checked)}
        />
        <span className={personal ? undefined : "opacity-50"}>
          {locationConsentCopy.publicMap}
        </span>
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={interview}
          onChange={(e) => setInterview(e.target.checked)}
        />
        <span>{locationConsentCopy.interview}</span>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={pending}
          className="rounded-md border border-ck-border px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
        {message ? (
          <span className="text-sm text-ck-text-muted">{message}</span>
        ) : null}
      </div>
    </Card>
  );
}
```

> Si `Card` se importa en esa carpeta desde otra ruta, usar la del archivo vecino. Las clases de color (`ck-border`, `ck-text-muted`) tienen que existir en el sistema de diseño de Clickatón: **una clase de color inexistente se pinta transparente sin avisar**. Verificar en pantalla, no sólo que compile.

- [ ] **Step 3: Montar el panel en Mi cuenta**

En `apps/clickaton/app/(public)/mi-cuenta/inscripciones/[id]/page.tsx`, importar el panel y montarlo inmediatamente **después** del `Card` de "Perfil" (el que hoy muestra Instagram y Autorizaciones, alrededor de la línea 281):

```tsx
      <LocationConsentPanel
        registrationId={registration.id}
        locationConsentAt={registration.locationConsentAt}
        locationPublicConsentAt={registration.locationPublicConsentAt}
        interviewConsentAt={registration.interviewConsentAt}
      />
```

Si la consulta de esa página usa un `select` explícito, agregar los tres campos ahí también, o llegan `undefined`.

- [ ] **Step 4: Probar el ciclo completo en el navegador**

```bash
npm run dev
```

Con una inscripción propia: marcar las tres casillas, guardar, recargar la página y confirmar que siguen marcadas. Después desmarcar la primera, guardar, recargar, y confirmar que la segunda también quedó apagada.

- [ ] **Step 5: Probar que no se puede tocar una inscripción ajena**

Entrar con una sesión y llamar a la action con el id de una inscripción de otra persona. Esperado: `{ ok: false }` y la base sin cambios. Es la verificación más importante de esta tarea.

- [ ] **Step 6: Verificar tipos y lint**

```bash
npm run check-types && npm run lint
```

- [ ] **Step 7: Commit**

```bash
git add apps/clickaton
git commit -m "Dar y revocar los permisos de ubicación desde Mi cuenta

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Verificación final de la etapa

- [ ] Los tres comandos de test en verde:

```bash
npm run test:location-consent && npm run test:location-consent-funnel && npm run test:registration-clock
```

- [ ] `npm run check-types` y `npm run lint` sin errores.
- [ ] Una inscripción nueva sin marcar nada queda con los cuatro campos en null.
- [ ] Una inscripción nueva con las tres casillas queda con las tres fechas y la versión `CLICKATON_LOCATION_2026_09_v1`.
- [ ] Un inscripto viejo puede dar los permisos desde Mi cuenta y revocarlos.
- [ ] Nadie puede cambiarle los permisos a otra persona.
- [ ] Las cinco bases Neon tienen las columnas y la fila en `_prisma_migrations`.

---

## Lo que esta etapa deja pendiente

1. **La cláusula de geolocalización en las Bases.** Las Bases vigentes son las de la 1ª edición (dicen "19 de septiembre de 2026, Rosario"). La 2ª edición necesita su propia versión igual, y ahí entra la cláusula informativa que referencia `CLICKATON_LOCATION_2026_09_v1`. **Requiere revisión humana antes de publicarse.**
2. **El aviso a los ya inscriptos.** El mail que invita a quienes se inscribieron antes a pasar por Mi cuenta. Conviene mandarlo junto con el de "Preparate" (etapa 1) y no dos veces.
3. **La fecha de nacimiento.** Mientras el formulario no la pida, la mayoría de edad es una declaración del participante. Si alguna edición futura admite menores, hay que pedir la fecha y esta etapa ya la respeta: `resolveLocationConsent` niega el mapa público en cuanto hay una fecha de nacimiento de menor.
