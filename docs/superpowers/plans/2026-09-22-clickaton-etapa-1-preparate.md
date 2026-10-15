# Centro de Transmisión — Etapa 1: "Preparate para la Clickatón"

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada inscripto pueda comprobar, desde el mail y antes del evento, si su teléfono guarda la ubicación en las fotos y si tiene la hora bien — y que la organización sepa cuántos están listos.

**Architecture:** Un módulo de dominio puro decide el veredicto a partir de cuatro datos medidos (si hay coordenadas, la hora de captura, el ancho y el alto). El navegador lee el EXIF de una foto que el participante elige, **sin subirla**, y manda sólo esos cuatro datos a una server action que los evalúa contra el reloj del servidor y guarda una fila. La pantalla es pública y se entra con un token firmado que viaja en el enlace del mail.

**Tech Stack:** Next.js (App Router), TypeScript, Prisma, PostgreSQL (Neon), `exifr` (ya es dependencia, corre igual en el navegador), `node:test` con `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-09-21-clickaton-centro-de-transmision-design.md` — §6.2 (`ClickatonReadinessCheck`) y §8 etapa 1.

## Global Constraints

- **Idioma:** todo el texto de cara al usuario, los comentarios y los mensajes de commit van en español rioplatense.
- **La foto nunca se sube.** Ninguna tarea puede mandar bytes de imagen al servidor, ni guardar la foto, ni una miniatura. Al servidor viajan cuatro números y un booleano.
- **Se pide una foto sacada en el momento.** El chequeo del reloj compara la hora de captura contra la hora del **servidor**; comparar contra el reloj del navegador no detecta nada, porque es el mismo teléfono que escribió el EXIF.
- **No se reutiliza la cañería de envíos del concurso** (`lib/photo-upload/service.ts`): está atada a consignas, huellas de duplicados, miniaturas y trabajos. Fabricar envíos falsos está prohibido.
- **Tolerancia del reloj:** 5 minutos, tomada de `ClickatonEditionUploadConfig.captureClockToleranceMinutes` cuando exista, con 5 como valor por defecto.
- **Tamaño mínimo:** `minWidth`/`minHeight` de `ClickatonEditionUploadConfig` (800×600 por defecto), respetando la orientación (una foto vertical válida no puede fallar por comparar ancho contra alto).
- **El token del enlace tiene propósito propio** (`"readiness"`), distinto del de `"summary"`: un enlace filtrado de esta pantalla no debe abrir el resumen de la inscripción.
- **Aditivo:** ningún campo ni tabla existente cambia de significado.
- **Cinco bases Neon:** la migración se aplica a mano en las cinco y se registra en `_prisma_migrations` con el checksum de una base sana. **Ningún agente toca una base.**
- **Depende de la etapa 0:** esta rama sale de `docs/clickaton-panel-streaming` (PR #221). Su migración tampoco está aplicada, así que las dos migraciones se aplican juntas y en orden.
- **Una clase de color inexistente se pinta transparente sin avisar ni fallar.** Usar sólo las de `apps/clickaton/styles/tokens.css`.
- **Runner de tests:** `node:test` + `assert/strict` con `tsx --test`. No hay vitest ni jest.
- `npm run check-types` necesita `NODE_OPTIONS="--max-old-space-size=8192"` en este checkout o `tsc` aborta por memoria (preexistente).

---

## Estructura de archivos

**Módulo nuevo — `apps/clickaton/lib/readiness/`**

| Archivo | Responsabilidad |
|---|---|
| `domain/readiness.ts` | Reglas puras: de cuatro medidas a un veredicto. Sin Prisma, sin React, sin EXIF |
| `domain/readiness.test.ts` | Tests del dominio |
| `content/readiness-copy.ts` | Todo el texto de la pantalla, incluidas las instrucciones por sistema operativo |
| `actions/submit-readiness-check.ts` | Server action: valida el token, evalúa contra el reloj del servidor, guarda la fila |

**Componentes y página**

| Archivo | Responsabilidad |
|---|---|
| `apps/clickaton/components/readiness/ReadinessCheckCard.tsx` | El selector de foto, la lectura del EXIF en el navegador y el resultado |
| `apps/clickaton/components/readiness/CameraGpsInstructions.tsx` | Las instrucciones de iPhone y Android, con el sistema detectado preseleccionado |
| `apps/clickaton/components/readiness/LocationPermissionCard.tsx` | El pedido del permiso de ubicación del navegador, atado al consentimiento de la etapa 0 |
| `apps/clickaton/app/(public)/maratones/[slug]/preparate/[registrationId]/page.tsx` | La pantalla, abierta con el token del mail |

**Archivos existentes que se modifican**

| Archivo | Qué cambia |
|---|---|
| `packages/db/prisma/schema.prisma` | Modelo `ClickatonReadinessCheck` + relación en `ClickatonRegistration` y `ClickatonEdition` |
| `packages/db/prisma/migrations/20260923090000_clickaton_readiness_check/migration.sql` | La migración (archivo nuevo) |
| `apps/clickaton/lib/public-registration/domain/access-token.ts` | Agregar el propósito `"readiness"` |
| `apps/clickaton/lib/registration/notifications/participant-email.ts` | El enlace a "Preparate" en el mail de confirmación |
| `apps/clickaton/package.json` | Un script de test nuevo |
| `.github/workflows/chequeos.yml` | Correr ese test |

---

## Task 1: Las reglas del veredicto

**Files:**
- Create: `apps/clickaton/lib/readiness/domain/readiness.ts`
- Test: `apps/clickaton/lib/readiness/domain/readiness.test.ts`
- Modify: `apps/clickaton/package.json`

**Interfaces:**
- Produces:
  - `type ReadinessMeasurements = { hasGps: boolean; captureAtMs: number | null; width: number; height: number }`
  - `type ReadinessLimits = { toleranceMinutes: number; minWidth: number; minHeight: number }`
  - `type ReadinessResult = "READY" | "NO_GPS" | "CLOCK_OFF" | "TOO_SMALL" | "NO_CAPTURE_DATE" | "FAILED"`
  - `type ReadinessVerdict = { result: ReadinessResult; clockDeltaMinutes: number | null; problems: ReadinessResult[] }`
  - `evaluateReadiness(input: { measurements: ReadinessMeasurements; limits: ReadinessLimits; serverNowMs: number }): ReadinessVerdict`

**Por qué un módulo aparte y puro:** el mismo veredicto se muestra en el navegador y se guarda en la base. Si la regla vive en dos lados, un día la pantalla dice "listo" y la base guarda "sin GPS".

- [ ] **Step 1: Escribir el test que falla**

```ts
// apps/clickaton/lib/readiness/domain/readiness.test.ts
import assert from "node:assert/strict";
import test from "node:test";

import { evaluateReadiness } from "./readiness";

const AHORA = Date.parse("2026-10-05T15:00:00.000Z");
const LIMITES = { toleranceMinutes: 5, minWidth: 800, minHeight: 600 };

const OK = {
  hasGps: true,
  captureAtMs: AHORA - 60_000,
  width: 4032,
  height: 3024,
};

test("una foto recién sacada, con GPS y tamaño suficiente, está lista", () => {
  const v = evaluateReadiness({
    measurements: OK,
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(v.result, "READY");
  assert.deepEqual(v.problems, []);
  assert.equal(
    v.clockDeltaMinutes,
    -1,
    "la foto se sacó un minuto ANTES que el reloj del servidor: negativo",
  );
});

test("sin coordenadas el veredicto es NO_GPS", () => {
  const v = evaluateReadiness({
    measurements: { ...OK, hasGps: false },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(v.result, "NO_GPS");
});

test("el reloj adelantado más que la tolerancia da CLOCK_OFF", () => {
  const v = evaluateReadiness({
    measurements: { ...OK, captureAtMs: AHORA + 40 * 60_000 },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(v.result, "CLOCK_OFF");
  assert.equal(v.clockDeltaMinutes, 40);
});

test("el reloj atrasado más que la tolerancia también da CLOCK_OFF", () => {
  const v = evaluateReadiness({
    measurements: { ...OK, captureAtMs: AHORA - 40 * 60_000 },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(v.result, "CLOCK_OFF");
  assert.equal(v.clockDeltaMinutes, -40);
});

test("justo en el borde de la tolerancia todavía está listo", () => {
  const v = evaluateReadiness({
    measurements: { ...OK, captureAtMs: AHORA - 5 * 60_000 },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(v.result, "READY");
});

test("una foto vertical válida no falla por tamaño", () => {
  const v = evaluateReadiness({
    measurements: { ...OK, width: 3024, height: 4032 },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(v.result, "READY", "el lado largo va contra el mínimo mayor");
});

test("una foto chica de verdad da TOO_SMALL", () => {
  const v = evaluateReadiness({
    measurements: { ...OK, width: 640, height: 480 },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(v.result, "TOO_SMALL");
});

test("sin fecha de captura el veredicto es NO_CAPTURE_DATE", () => {
  const v = evaluateReadiness({
    measurements: { ...OK, captureAtMs: null },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(v.result, "NO_CAPTURE_DATE");
  assert.equal(v.clockDeltaMinutes, null);
});

test("cuando hay varios problemas, el resultado nombra el más importante y problems los lista todos", () => {
  const v = evaluateReadiness({
    measurements: { hasGps: false, captureAtMs: AHORA - 40 * 60_000, width: 640, height: 480 },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(v.result, "NO_GPS", "sin GPS no sirve para el mapa: manda ese");
  assert.deepEqual(
    [...v.problems].sort(),
    ["CLOCK_OFF", "NO_GPS", "TOO_SMALL"],
    "pero se informan los tres para que arregle todo de una",
  );
});

test("dimensiones imposibles dan FAILED", () => {
  const v = evaluateReadiness({
    measurements: { ...OK, width: 0, height: 0 },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(v.result, "FAILED");
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Agregar en `apps/clickaton/package.json`, junto a los demás `test:*`:

```json
"test:readiness": "tsx --test lib/readiness/domain/readiness.test.ts",
```

Desde `apps/clickaton`:

```bash
npm run test:readiness
```

Esperado: FALLA con `Cannot find module './readiness'`.

- [ ] **Step 3: Escribir el dominio**

```ts
// apps/clickaton/lib/readiness/domain/readiness.ts
/**
 * De cuatro medidas a un veredicto de "tu teléfono está listo".
 *
 * Puro a propósito: el mismo veredicto se dibuja en el navegador y se guarda
 * en la base. Si la regla viviera en los dos lados, un día la pantalla dice
 * "listo" y la fila guardada dice "sin GPS".
 *
 * El reloj se compara contra la hora del SERVIDOR. Comparar contra la hora
 * del navegador no detectaría nada: es el mismo teléfono que escribió el EXIF.
 */

export type ReadinessMeasurements = {
  /** Si el EXIF trae coordenadas. */
  hasGps: boolean;
  /** Hora de captura del EXIF en milisegundos, o null si el EXIF no la trae. */
  captureAtMs: number | null;
  width: number;
  height: number;
};

export type ReadinessLimits = {
  toleranceMinutes: number;
  minWidth: number;
  minHeight: number;
};

export type ReadinessResult =
  | "READY"
  | "NO_GPS"
  | "CLOCK_OFF"
  | "TOO_SMALL"
  | "NO_CAPTURE_DATE"
  | "FAILED";

export type ReadinessVerdict = {
  /** El problema más importante, o READY. */
  result: ReadinessResult;
  /** Positivo = el teléfono va adelantado. Null si no hubo fecha de captura. */
  clockDeltaMinutes: number | null;
  /** Todos los problemas encontrados, para poder arreglarlos de una vez. */
  problems: ReadinessResult[];
};

/** Orden de importancia: sin GPS no sirve para el mapa, que es el punto. */
const PRIORIDAD: ReadinessResult[] = [
  "FAILED",
  "NO_GPS",
  "NO_CAPTURE_DATE",
  "CLOCK_OFF",
  "TOO_SMALL",
];

export function evaluateReadiness(input: {
  measurements: ReadinessMeasurements;
  limits: ReadinessLimits;
  serverNowMs: number;
}): ReadinessVerdict {
  const { measurements: m, limits, serverNowMs } = input;
  const problems: ReadinessResult[] = [];

  // Una imagen que no se pudo medir no se puede juzgar por lo demás.
  if (!Number.isFinite(m.width) || !Number.isFinite(m.height) || m.width <= 0 || m.height <= 0) {
    return { result: "FAILED", clockDeltaMinutes: null, problems: ["FAILED"] };
  }

  if (!m.hasGps) problems.push("NO_GPS");

  let clockDeltaMinutes: number | null = null;
  if (m.captureAtMs === null) {
    problems.push("NO_CAPTURE_DATE");
  } else {
    clockDeltaMinutes = Math.round((m.captureAtMs - serverNowMs) / 60_000);
    if (Math.abs(clockDeltaMinutes) > limits.toleranceMinutes) {
      problems.push("CLOCK_OFF");
    }
  }

  // El lado largo va contra el mínimo mayor: una foto vertical válida no
  // puede fallar por comparar su ancho contra el mínimo de ancho.
  const lados = [m.width, m.height].sort((a, b) => b - a);
  const minimos = [limits.minWidth, limits.minHeight].sort((a, b) => b - a);
  if (lados[0] < minimos[0] || lados[1] < minimos[1]) {
    problems.push("TOO_SMALL");
  }

  const result =
    PRIORIDAD.find((p) => problems.includes(p)) ?? "READY";

  return { result, clockDeltaMinutes, problems };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
npm run test:readiness
```

Esperado: `# pass 10`, `# fail 0`, salida limpia.

- [ ] **Step 5: Agregar el test a CI**

En `.github/workflows/chequeos.yml`, junto a los pasos `test:location-consent` que ya están:

```yaml
      - name: Prueba técnica previa
        run: pnpm --filter clickaton test:readiness
```

- [ ] **Step 6: Commit**

```bash
git add apps/clickaton/lib/readiness apps/clickaton/package.json .github/workflows/chequeos.yml
git commit -m "Definir el veredicto de la prueba técnica previa

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: La tabla de la prueba

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260923090000_clickaton_readiness_check/migration.sql`

**Interfaces:**
- Produces: el modelo `ClickatonReadinessCheck` en el cliente de Prisma, que consumen las tareas 3 y 5.

- [ ] **Step 1: Agregar el modelo al schema**

Ubicarlo junto a los demás modelos de Clickatón, después de `ClickatonPhotoSubmissionAudit`:

```prisma
/// Prueba técnica previa al evento: el participante comprueba desde su
/// teléfono si sus fotos guardan la ubicación y si el reloj está bien.
/// La foto NUNCA se sube: acá sólo se guarda el veredicto.
model ClickatonReadinessCheck {
  id                 String                @id @default(cuid())
  editionId          String
  registrationId     String
  checkedAt          DateTime              @default(now())
  hasGps             Boolean
  /// Positivo = el teléfono va adelantado respecto del servidor.
  clockDeltaMinutes  Int?
  imageWidth         Int?
  imageHeight        Int?
  /// READY | NO_GPS | CLOCK_OFF | TOO_SMALL | NO_CAPTURE_DATE | FAILED
  result             String
  /// Todos los problemas encontrados, no sólo el principal.
  detail             Json?
  createdAt          DateTime              @default(now())

  edition      ClickatonEdition      @relation(fields: [editionId], references: [id], onDelete: Cascade)
  registration ClickatonRegistration @relation(fields: [registrationId], references: [id], onDelete: Cascade)

  @@index([editionId, result])
  @@index([registrationId, checkedAt])
}
```

Y agregar el lado inverso de las dos relaciones: `readinessChecks ClickatonReadinessCheck[]` dentro de `model ClickatonEdition` y dentro de `model ClickatonRegistration`, junto a las demás listas de relaciones de cada uno.

**Se guardan todos los intentos, no uno por inscripción.** Alguien que arregla su teléfono y vuelve a probar genera una fila nueva; la organización quiere ver que pasó de "sin GPS" a "listo", no sólo el último estado.

- [ ] **Step 2: Escribir la migración**

```sql
-- packages/db/prisma/migrations/20260923090000_clickaton_readiness_check/migration.sql
-- Centro de Transmisión, etapa 1: prueba técnica previa.
-- Aditiva: tabla nueva, ninguna tabla existente cambia.

CREATE TABLE IF NOT EXISTS "ClickatonReadinessCheck" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "hasGps" BOOLEAN NOT NULL,
  "clockDeltaMinutes" INTEGER,
  "imageWidth" INTEGER,
  "imageHeight" INTEGER,
  "result" TEXT NOT NULL,
  "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClickatonReadinessCheck_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClickatonReadinessCheck_editionId_result_idx"
  ON "ClickatonReadinessCheck" ("editionId", "result");

CREATE INDEX IF NOT EXISTS "ClickatonReadinessCheck_registrationId_checkedAt_idx"
  ON "ClickatonReadinessCheck" ("registrationId", "checkedAt");

DO $$
BEGIN
  ALTER TABLE "ClickatonReadinessCheck"
    ADD CONSTRAINT "ClickatonReadinessCheck_editionId_fkey"
    FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ClickatonReadinessCheck"
    ADD CONSTRAINT "ClickatonReadinessCheck_registrationId_fkey"
    FOREIGN KEY ("registrationId") REFERENCES "ClickatonRegistration"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

- [ ] **Step 3: Verificar que el cliente de Prisma compila**

```bash
cd packages/db && npx prisma generate
```

Esperado: `Generated Prisma Client`, sin errores de schema.

- [ ] **Step 4: NO aplicar la migración**

**No te conectes a ninguna base.** Las cinco bases Neon son de producción y su modificación requiere autorización de una persona. Además la migración de la etapa 0 todavía no está aplicada, así que las dos van juntas y en orden. Dejá constancia en el reporte de que este paso quedó deliberadamente sin ejecutar.

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260923090000_clickaton_readiness_check
git commit -m "Guardar el resultado de la prueba técnica previa

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: El enlace del mail y su token

**Files:**
- Modify: `apps/clickaton/lib/public-registration/domain/access-token.ts`
- Modify: `apps/clickaton/lib/registration/notifications/participant-email.ts`
- Test: `apps/clickaton/lib/public-registration/domain/access-token-readiness.test.ts`
- Modify: `apps/clickaton/package.json`

**Interfaces:**
- Consumes: `signRegistrationAccessToken` y `verifyRegistrationAccessToken`, que ya existen con un campo `purpose` cuyo único valor hoy es `"summary"`.
- Produces: el propósito `"readiness"` aceptado por ambas funciones, y la constante `readinessPath(editionSlug, registrationId, token)` exportada desde `apps/clickaton/lib/readiness/content/readiness-copy.ts` para que el mail y la página no escriban la ruta dos veces.

- [ ] **Step 1: Escribir el test que falla**

```ts
// apps/clickaton/lib/public-registration/domain/access-token-readiness.test.ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  signRegistrationAccessToken,
  verifyRegistrationAccessToken,
} from "./access-token";

const SECRETO = "secreto-de-prueba-para-los-tokens-de-acceso";
const BASE = {
  registrationId: "reg_1",
  editionSlug: "clickaton-2026",
};
const EN_UNA_HORA = Date.now() + 60 * 60_000;

test("un token de prueba técnica se verifica con su propio propósito", () => {
  const token = signRegistrationAccessToken(
    { ...BASE, expiresAtMs: EN_UNA_HORA, purpose: "readiness" },
    SECRETO,
  );
  const r = verifyRegistrationAccessToken(
    { ...BASE, token, purpose: "readiness" },
    SECRETO,
  );
  assert.equal(r.ok, true);
});

test("un token de resumen NO abre la prueba técnica", () => {
  const token = signRegistrationAccessToken(
    { ...BASE, expiresAtMs: EN_UNA_HORA, purpose: "summary" },
    SECRETO,
  );
  const r = verifyRegistrationAccessToken(
    { ...BASE, token, purpose: "readiness" },
    SECRETO,
  );
  assert.equal(r.ok, false, "un enlace filtrado de una pantalla no abre la otra");
});

test("un token de prueba técnica NO abre el resumen", () => {
  const token = signRegistrationAccessToken(
    { ...BASE, expiresAtMs: EN_UNA_HORA, purpose: "readiness" },
    SECRETO,
  );
  const r = verifyRegistrationAccessToken(
    { ...BASE, token, purpose: "summary" },
    SECRETO,
  );
  assert.equal(r.ok, false);
});

test("sin propósito explícito se sigue verificando como resumen", () => {
  const token = signRegistrationAccessToken(
    { ...BASE, expiresAtMs: EN_UNA_HORA },
    SECRETO,
  );
  const r = verifyRegistrationAccessToken({ ...BASE, token }, SECRETO);
  assert.equal(r.ok, true, "los enlaces ya emitidos no se invalidan");
});

test("un token vencido no sirve aunque el propósito coincida", () => {
  const token = signRegistrationAccessToken(
    { ...BASE, expiresAtMs: Date.now() - 1000, purpose: "readiness" },
    SECRETO,
  );
  const r = verifyRegistrationAccessToken(
    { ...BASE, token, purpose: "readiness" },
    SECRETO,
  );
  assert.equal(r.ok, false);
});
```

Agregar en `package.json`:

```json
"test:access-token-readiness": "tsx --test lib/public-registration/domain/access-token-readiness.test.ts",
```

Y el paso correspondiente en `.github/workflows/chequeos.yml`, junto al de la tarea 1.

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
npm run test:access-token-readiness
```

Esperado: FALLA — `purpose: "readiness"` no es un valor aceptado por el tipo, y `verifyRegistrationAccessToken` todavía no recibe `purpose`.

- [ ] **Step 3: Extender el propósito**

En `access-token.ts`:
- Definir `export type RegistrationAccessPurpose = "summary" | "readiness";`
- Cambiar `purpose?: "summary"` por `purpose?: RegistrationAccessPurpose` en la entrada de `signRegistrationAccessToken`.
- Agregar `purpose?: RegistrationAccessPurpose` a la entrada de `verifyRegistrationAccessToken`, con `"summary"` por defecto, y hacer que la verificación exija que el propósito del token coincida con el pedido.

El propósito ya viaja dentro del payload firmado (`v2|${purpose}|...`), así que no hay que cambiar el formato del token ni invalidar los emitidos. **Verificá que efectivamente la firma lo incluya antes de dar por hecho que basta con comparar.**

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
npm run test:access-token-readiness && npm run test:readiness
```

Esperado: 5/5 y 10/10, salida limpia.

- [ ] **Step 5: Exportar la ruta desde el módulo de texto**

En `apps/clickaton/lib/readiness/content/readiness-copy.ts` (el archivo se completa en la tarea 4; por ahora alcanza con esto):

```ts
/** Una sola fuente para la ruta: la usan el mail y la propia página. */
export function readinessPath(
  editionSlug: string,
  registrationId: string,
  token: string,
): string {
  return `/maratones/${editionSlug}/preparate/${registrationId}?t=${encodeURIComponent(token)}`;
}

/** Cuánto vive el enlace del mail. El evento es el 12/12/2026. */
export const READINESS_TOKEN_TTL_MS = 120 * 24 * 60 * 60 * 1000;
```

- [ ] **Step 6: Agregar el enlace al mail de confirmación**

En `apps/clickaton/lib/registration/notifications/participant-email.ts`, junto a donde ya se arman `summaryUrl` y el enlace de activación (alrededor de la línea 98), agregar el de la prueba técnica firmando un token **con propósito `"readiness"` y su propio vencimiento**, no reutilizando el del resumen.

En el cuerpo del mail de confirmación —y sólo en ése, no en los de reserva vencida ni en los de pago pendiente— agregar un párrafo corto con el enlace, en la misma forma que usan los párrafos vecinos (versión texto y versión HTML).

**El texto no se escribe acá suelto.** Agregalo en el paso 5, junto a `readinessPath`, como una constante exportada más:

```ts
/** El párrafo que va en el mail de confirmación. La tarea 4 completa el resto. */
export const readinessEmailParagraph =
  "Antes de la Clickatón conviene que revises una cosa: que tu teléfono guarde el lugar donde sacás cada foto. Te lleva un minuto y de eso depende el resumen de tu recorrido al final de la jornada.";
```

La tarea 4 lo va a mover dentro del objeto `readinessCopy` junto con el resto del texto; definirlo acá evita escribirlo dos veces y que las dos versiones digan cosas distintas.

- [ ] **Step 7: Verificar tipos y correr todo lo que toca**

```bash
NODE_OPTIONS="--max-old-space-size=8192" npm run check-types && npm run test:access-token-readiness && npm run test:readiness
```

Esperado: sin errores de tipos, los dos tests en verde.

- [ ] **Step 8: Commit**

```bash
git add apps/clickaton packages/db .github/workflows/chequeos.yml
git commit -m "Invitar a la prueba técnica desde el mail de confirmación

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: El texto y las instrucciones

**Files:**
- Modify: `apps/clickaton/lib/readiness/content/readiness-copy.ts` (creado en la tarea 3)
- Create: `apps/clickaton/components/readiness/CameraGpsInstructions.tsx`

**Interfaces:**
- Consumes: `ReadinessResult` (tarea 1).
- Produces:
  - `readinessCopy`: el texto de la pantalla, incluido el título, la explicación, el pedido de sacar la foto ahora, el texto del mail, y **un mensaje por cada `ReadinessResult`** con su título y su explicación de qué hacer.
  - `<CameraGpsInstructions />`: las instrucciones de iPhone y de Android, con pestañas, y la del sistema detectado preseleccionada.

**Por qué el texto va en su propio archivo:** lo consumen el mail, la pantalla y el componente de resultado. Escrito tres veces, diverge.

- [ ] **Step 1: Escribir el módulo de texto**

Completar `readiness-copy.ts` con un objeto `readinessCopy` que incluya, además de lo que ya tiene:

- `title`, `intro` (por qué conviene hacerlo, en una o dos oraciones, apoyándose en el resumen personal del final),
- `takePhotoNow`: la instrucción de sacar una foto **en el momento**, explicando que con una foto vieja el chequeo del reloj no dice nada,
- `emailParagraph`: el texto del mail — mové acá la constante `readinessEmailParagraph` que creó la tarea 3 y actualizá el import del mail,
- `results`: un registro con una entrada por cada valor de `ReadinessResult`, cada una con `title` y `whatToDo`.

Los seis resultados y lo que tiene que transmitir cada uno:

| Resultado | Qué decirle |
|---|---|
| `READY` | Está listo. Su teléfono guarda la ubicación y tiene la hora bien |
| `NO_GPS` | Sus fotos salen sin ubicación. Hay que encender el geoetiquetado — remitir a las instrucciones — y volver a probar |
| `CLOCK_OFF` | El reloj del teléfono está corrido. Decirle cuánto y que lo ponga en hora automática, porque la hora de captura decide si la foto es válida el día del evento |
| `TOO_SMALL` | La foto es más chica de lo que el concurso acepta. Revisar la calidad configurada en la cámara |
| `NO_CAPTURE_DATE` | La foto no trae hora de captura. Suele pasar con imágenes descargadas o reenviadas por mensajería: que saque una con la cámara |
| `FAILED` | No se pudo leer el archivo. Que pruebe con otra foto |

Escribilo en español rioplatense, en segunda persona, sin jerga técnica: quien lee no es programador. "Geoetiquetado" se explica la primera vez ("que tu teléfono guarde en cada foto el lugar donde la sacaste").

- [ ] **Step 2: Escribir las instrucciones por sistema**

`CameraGpsInstructions.tsx`: dos juegos de pasos, uno para iPhone y otro para Android, en pestañas. Detectar el sistema con `navigator.userAgent` sólo para **preseleccionar** la pestaña; las dos tienen que ser accesibles siempre, porque la detección falla y alguien puede estar leyendo desde la computadora para ayudar a otro.

Los pasos reales, en palabras de usuario y no de menú exacto (los menús cambian entre versiones, así que describí el destino y no la ruta literal):

- **iPhone:** Ajustes → Privacidad y seguridad → Localización → Cámara, y elegir "Al usar la app". Además, dentro de Ajustes → Cámara, que "Formatos" no esté en un modo que descarte los datos.
- **Android:** Ajustes de la app Cámara → Ubicación / Etiquetas de ubicación, y activarla. Y que la Cámara tenga permiso de ubicación en los ajustes del sistema.

Cerrá con una línea honesta: que los nombres exactos cambian según el modelo y la versión, y que lo que importa es que la cámara tenga permiso de ubicación.

Usá sólo clases de color que existan en `apps/clickaton/styles/tokens.css`.

- [ ] **Step 3: Verificar tipos y lint**

```bash
NODE_OPTIONS="--max-old-space-size=8192" npm run check-types && npm run lint
```

Esperado: sin errores de tipos. En lint, ninguna advertencia nueva en los archivos tocados — el proyecto ya arrastra 196 preexistentes en `scripts/`.

- [ ] **Step 4: Commit**

```bash
git add apps/clickaton/lib/readiness apps/clickaton/components/readiness
git commit -m "Escribir la guía para encender la ubicación de la cámara

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: La pantalla y la medición en el navegador

**Files:**
- Create: `apps/clickaton/lib/readiness/actions/submit-readiness-check.ts`
- Create: `apps/clickaton/components/readiness/ReadinessCheckCard.tsx`
- Create: `apps/clickaton/components/readiness/LocationPermissionCard.tsx`
- Create: `apps/clickaton/app/(public)/maratones/[slug]/preparate/[registrationId]/page.tsx`

**Interfaces:**
- Consumes: `evaluateReadiness`, `ReadinessMeasurements` (tarea 1); el modelo `ClickatonReadinessCheck` (tarea 2); `verifyRegistrationAccessToken` con propósito `"readiness"` y `readinessPath` (tarea 3); `readinessCopy` y `<CameraGpsInstructions />` (tarea 4).
- Produces: `submitReadinessCheckAction(formData: FormData)` → `{ ok: true; verdict: ReadinessVerdict } | { ok: false; message: string }`, que lee `registrationId`, `editionSlug`, `token`, `hasGps`, `captureAtMs`, `width`, `height`.

- [ ] **Step 1: Escribir la server action**

Qué hace, en orden:

1. Lee y valida las entradas del `FormData`. **Números que vienen del navegador: parsealos y rechazá lo que no sea finito.** Nada de `Number(x)` sin chequear.
2. Verifica el token con `verifyRegistrationAccessToken({ registrationId, editionSlug, token, purpose: "readiness" })`. Si falla, devuelve error y **no escribe nada**.
3. Carga la inscripción con su edición y la configuración de subida, para sacar `captureClockToleranceMinutes`, `minWidth` y `minHeight`. Si la inscripción no existe o no pertenece a esa edición, error.
4. Llama a `evaluateReadiness` con `serverNowMs: Date.now()`.
5. Guarda una fila en `ClickatonReadinessCheck` con el veredicto y `detail: { problems }`.
6. Devuelve el veredicto.

Lo que **no** hace: recibir bytes de imagen, guardar archivos, crear envíos, tocar `ClickatonPhotoSubmission`.

Sobre la confianza: los cuatro datos los manda el navegador y podrían falsearse. Es aceptable y hay que dejarlo escrito en un comentario del archivo: acá no hay adversario — el participante quiere saber la verdad sobre su propio teléfono, nada depende del resultado y no hay premio ni elegibilidad en juego. Lo que sí se valida es el token, porque sin eso cualquiera escribiría filas en la tabla de otro.

- [ ] **Step 2: Escribir el componente de medición**

`ReadinessCheckCard.tsx`, componente de cliente:

- Un `<input type="file" accept="image/*" capture="environment">`. El `capture` hace que en el teléfono se abra la cámara directamente, que es justo lo que queremos porque pedimos una foto del momento.
- Al elegir el archivo, leer el EXIF **en el navegador** con `exifr` (ya es dependencia). Importarlo de forma diferida (`await import("exifr")`) para no cargarlo en el paquete inicial de la página.
- Medir: si hay `latitude`/`longitude`, la fecha de captura (`DateTimeOriginal`), y el ancho y el alto. Para las dimensiones, si el EXIF no las trae, usar `createImageBitmap` sobre el archivo.
- Mandar sólo esos cuatro datos con la server action y mostrar el veredicto usando `readinessCopy.results[result]`.
- Si el resultado es `NO_GPS`, mostrar las instrucciones abiertas y un botón de "probar de nuevo".
- Estados visibles: sin empezar, midiendo, resultado, error. El de error tiene que distinguirse del de éxito y anunciarse con `role="status"` y `aria-live="polite"`.

**Ojo con la hora del EXIF:** `exifr` devuelve la fecha de captura como si fuera UTC cuando en realidad es hora local del teléfono. Este proyecto ya tiene ese problema resuelto para el servidor en `lib/photo-upload/exif-clock.ts` — **leelo y seguí el mismo criterio**, o el chequeo del reloj va a reportar tres horas de diferencia a todo el mundo en Argentina.

- [ ] **Step 3: Escribir el pedido del permiso de ubicación**

Esto es el punto 4 de la etapa 1 en el diseño y es lo que habilita las fichadas de la etapa 2: el permiso del navegador se pide **una sola vez**, acá, y el navegador lo recuerda para ese sitio en ese teléfono. Si no se pide ahora, el día del evento hay que interrumpir a cada participante con un cartel del navegador en medio de la maratón.

`LocationPermissionCard.tsx`, componente de cliente:

- Recibe por props si esa inscripción dio el consentimiento personal de ubicación (`locationConsentAt`, de la etapa 0).
- **Si no lo dio, no pide nada.** Muestra una línea explicando que primero hace falta autorizar el uso de la ubicación, con un enlace a Mi cuenta donde están las casillas. Pedirle el permiso del navegador a alguien que no consintió es pedirle un dato que no tenemos derecho a usar.
- Si lo dio, un botón que llama `navigator.geolocation.getCurrentPosition(...)` una sola vez.
- **La posición obtenida se descarta.** No se manda a ningún lado ni se guarda: lo único que buscamos es que quede concedido el permiso. Dejalo escrito en un comentario para que nadie lo "arregle" después mandándola.
- Estados: sin pedir, pidiendo, concedido, rechazado. Si el navegador lo rechaza, explicar que se puede volver a habilitar desde los ajustes del sitio, sin dramatizar: es opcional y su inscripción no depende de esto.
- Consultar `navigator.permissions.query({ name: "geolocation" })` cuando exista, para mostrar "ya está concedido" sin volver a pedirlo. Envolvelo en try/catch: no todos los navegadores lo soportan y en algunos lanza.

El texto sale de `readinessCopy`; agregá ahí las claves que necesites.

- [ ] **Step 4: Escribir la página**

`app/(public)/maratones/[slug]/preparate/[registrationId]/page.tsx`:

- Lee `slug`, `registrationId` y el token de `?t=`.
- Verifica el token con propósito `"readiness"`. Si no es válido o venció, muestra una pantalla amable explicando que el enlace venció y que pueden pedirlo de nuevo desde Mi cuenta — **no un 404 pelado**, porque el enlace llega por mail meses antes.
- Si es válido: título e introducción de `readinessCopy`, `<CameraGpsInstructions />`, `<ReadinessCheckCard />` y `<LocationPermissionCard />`.
- Para la última, carga de la inscripción el `locationConsentAt` de la etapa 0 y se lo pasa por props.
- Muestra el resultado de la última prueba de esa inscripción si ya hizo alguna.
- Sigue el armazón visual de las demás páginas públicas de maratón: mirá una vecina y copiá su estructura y sus clases.

- [ ] **Step 5: Verificar**

```bash
NODE_OPTIONS="--max-old-space-size=8192" npm run check-types && npm run lint
```

En este checkout **no hay `DATABASE_URL`**, así que `npm run dev` no levanta y no vas a poder probar la pantalla. No inventes que lo hiciste: dejá constancia en el reporte y compensá leyendo tu propio marcado contra las clases de una página vecina, y verificando que cada clase de color exista en `tokens.css`.

- [ ] **Step 6: Commit**

```bash
git add apps/clickaton
git commit -m "Comprobar desde el teléfono si las fotos guardan la ubicación

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Cuántos están listos

**Files:**
- Modify: `apps/clickaton/app/admin/(panel)/ediciones/[editionId]/page.tsx`

**Interfaces:**
- Consumes: el modelo `ClickatonReadinessCheck` (tarea 2), `ReadinessResult` y `readinessCopy` (tareas 1 y 4).

El criterio de "listo cuando" del diseño incluye que la organización vea cuántos inscriptos ya están listos. Sin esto no se sabe cuánta gente va a aparecer en el mapa el 12/12, que es justamente para lo que sirve esta etapa.

- [ ] **Step 1: Ubicar dónde va**

En `page.tsx` hay varias tarjetas con el patrón `<Card variant="outlined" className="space-y-4 p-5">` más un `<h2 className="text-lg font-semibold">` (por ejemplo la de "Vínculo con FotoRank", alrededor de la línea 162). Agregá una tarjeta nueva con esa misma forma, después de esa. **No inventes un estilo nuevo.**

- [ ] **Step 2: Mostrar el recuento**

Por edición, contando **la última prueba de cada inscripción** (no todas las filas, o alguien que probó cinco veces cuenta cinco):

- cuántos están listos,
- cuántos probaron y les falta algo, desglosado por resultado,
- cuántos **nunca probaron** — que es el número que más importa, porque es a quién hay que ir a buscar.

Un detalle que no se puede errar: una inscripción cuya última prueba dio `NO_GPS` **no** es "sin probar". Son dos grupos distintos y se resuelven distinto: al primero se le manda la instrucción, al segundo se le manda el enlace.

- [ ] **Step 3: Verificar**

```bash
NODE_OPTIONS="--max-old-space-size=8192" npm run check-types && npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add apps/clickaton
git commit -m "Ver cuántos inscriptos ya probaron su teléfono

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Verificación final de la etapa

- [ ] Los tests en verde:

```bash
npm run test:readiness && npm run test:access-token-readiness && npm run test:location-consent && npm run test:location-consent-funnel && npm run test:registration-clock
```

- [ ] `npm run check-types` sin errores y `npm run lint` sin advertencias nuevas.
- [ ] Ningún archivo de la etapa manda bytes de imagen al servidor. Comprobalo buscando en el diff: no puede aparecer `FormData` con un `File`, ni `arrayBuffer()` enviado, ni escrituras a R2.
- [ ] Un token de resumen no abre la pantalla de preparación, y viceversa.
- [ ] La pantalla de enlace vencido es amable y ofrece una salida.
- [ ] El recuento del panel distingue "probó y le falta algo" de "nunca probó".
- [ ] A quien no dio el consentimiento de ubicación no se le pide el permiso del navegador: se le ofrece el enlace para consentir.
- [ ] La posición obtenida al conceder el permiso no se manda ni se guarda en ningún lado.

---

## Lo que esta etapa deja pendiente

1. **Las dos migraciones sin aplicar**: la de la etapa 0 y la de ésta. Van juntas, en orden, a mano en las cinco bases Neon, antes de cualquier despliegue.
2. **Nadie vio la pantalla renderizada** ni probó la lectura de EXIF en un teléfono real. Esto último es lo único que no se puede sustituir por razonamiento: **hay que probarlo en un iPhone y en un Android de verdad**, porque el comportamiento de `capture="environment"` y el EXIF que entrega cada cámara varían.
3. **El aviso a los ya inscriptos.** El enlace va en el mail de confirmación de las inscripciones nuevas; a los que ya se inscribieron hay que mandarles un correo aparte. Conviene que ese mismo correo lleve también el pedido de consentimiento de la etapa 0, y no mandar dos.
4. **La foto de prueba no se guarda**, así que no hay forma de auditar un veredicto a posteriori. Es a propósito.
