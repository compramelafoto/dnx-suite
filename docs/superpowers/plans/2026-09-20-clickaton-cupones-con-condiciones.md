# Cupones con condiciones de elegibilidad — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un cupón de Clickatón pueda restringirse a quienes participaron de una edición anterior, configurable desde el panel y sin migración de base de datos.

**Architecture:** El motor compartido `@repo/promotions` sigue siendo una función pura: lee la condición desde `metadata` del cupón y recibe la elegibilidad **ya resuelta**, igual que hoy recibe los contadores de uso. El adaptador de Clickatón es quien consulta la base. La validación real vive en el camino de reserva (backend); la verificación previa del formulario sólo la espeja.

**Tech Stack:** TypeScript, Next.js (App Router), Prisma, pnpm workspaces, tests con `node:test` vía `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-09-20-clickaton-2da-edicion-inscripciones-design.md`

## Global Constraints

- **Cero migraciones de base de datos.** La condición vive en `DnxPromotion.metadata`, que ya es `Json`. Si una tarea parece necesitar una columna nueva, está mal planteada: parar y avisar.
- **Cambio aditivo.** Un cupón sin `metadata.eligibility` debe comportarse exactamente igual que hoy. Las otras cuatro plataformas que consumen `@repo/promotions` (CompraMeLaFoto, FotoRank, FOTOFFICE, InfoSpot) no cambian.
- **Sin dependencias nuevas.** El lockfile es compartido por todo el monorepo; agregar un paquete puede romper el build de otras apps.
- **Fail-closed.** Si un cupón tiene condición y el llamador no resolvió la elegibilidad, el cupón se rechaza. Un olvido debe dejar el cupón inutilizable, nunca abierto a todos.
- **Montos en minor units** (centavos), enteros. Nunca `Float`.
- **Textos de cara al público en español rioplatense**, tuteo con voseo ("Probá", "Completá").
- Los comentarios y nombres de tests siguen el idioma del archivo que se está tocando (el motor está comentado en español).

---

### Task 1: El motor entiende condiciones de elegibilidad

**Files:**
- Modify: `packages/promotions/src/types.ts`
- Create: `packages/promotions/src/eligibility.ts`
- Modify: `packages/promotions/src/engine.ts`
- Modify: `packages/promotions/src/index.ts`
- Test: `packages/promotions/src/promotions.test.ts` (agregar al final)

**Interfaces:**
- Consumes: nada (primera tarea).
- Produces:
  - `type PromotionEligibilityRule = { kind: "PARTICIPATED_IN_EDITION"; editionIds: string[]; requireCheckIn: boolean }`
  - `type PromotionEligibilityResolution = { isEligible: boolean }`
  - `function readEligibilityRule(metadata: Record<string, unknown> | null): PromotionEligibilityRule | null`
  - `PreviewPromotionInput` gana el campo opcional `eligibility?: PromotionEligibilityResolution | null`
  - `PromotionRejectionCode` gana el valor `"NOT_ELIGIBLE"`

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `packages/promotions/src/promotions.test.ts`:

```typescript
describe("readEligibilityRule", () => {
  it("devuelve null cuando no hay metadata", () => {
    assert.equal(readEligibilityRule(null), null);
  });
  it("devuelve null cuando metadata no tiene eligibility", () => {
    assert.equal(readEligibilityRule({ otraCosa: 1 }), null);
  });
  it("lee una regla válida", () => {
    const rule = readEligibilityRule({
      eligibility: {
        kind: "PARTICIPATED_IN_EDITION",
        editionIds: ["ed1"],
        requireCheckIn: true,
      },
    });
    assert.deepEqual(rule, {
      kind: "PARTICIPATED_IN_EDITION",
      editionIds: ["ed1"],
      requireCheckIn: true,
    });
  });
  it("requireCheckIn es false por defecto", () => {
    const rule = readEligibilityRule({
      eligibility: { kind: "PARTICIPATED_IN_EDITION", editionIds: ["ed1"] },
    });
    assert.equal(rule?.requireCheckIn, false);
  });
  it("ignora una regla malformada en vez de romper", () => {
    assert.equal(readEligibilityRule({ eligibility: { kind: "OTRA_COSA" } }), null);
    assert.equal(readEligibilityRule({ eligibility: { kind: "PARTICIPATED_IN_EDITION" } }), null);
    assert.equal(
      readEligibilityRule({ eligibility: { kind: "PARTICIPATED_IN_EDITION", editionIds: [] } }),
      null,
    );
    assert.equal(readEligibilityRule({ eligibility: "texto" }), null);
  });
});

describe("previewPromotion — elegibilidad", () => {
  const conCondicion = promo({
    id: "p-elig",
    code: "VOLVI50",
    discountType: "PERCENTAGE",
    discountValue: 50,
    metadata: {
      eligibility: {
        kind: "PARTICIPATED_IN_EDITION",
        editionIds: ["ed0"],
        requireCheckIn: true,
      },
    },
  });

  it("acepta cuando la persona es elegible", () => {
    const res = previewPromotion({
      promotion: conCondicion,
      usage: usageZero,
      originalAmount: 3_000_000,
      currency: "ARS",
      platform: "CLICKATON",
      editionId: "ed1",
      eligibility: { isEligible: true },
    });
    assert.equal(res.ok, true);
    if (res.ok) assert.equal(res.quote.discountAmount, 1_500_000);
  });

  it("rechaza cuando la persona no es elegible", () => {
    const res = previewPromotion({
      promotion: conCondicion,
      usage: usageZero,
      originalAmount: 3_000_000,
      currency: "ARS",
      platform: "CLICKATON",
      editionId: "ed1",
      eligibility: { isEligible: false },
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "NOT_ELIGIBLE");
  });

  it("rechaza cuando la elegibilidad no fue resuelta (fail-closed)", () => {
    const res = previewPromotion({
      promotion: conCondicion,
      usage: usageZero,
      originalAmount: 3_000_000,
      currency: "ARS",
      platform: "CLICKATON",
      editionId: "ed1",
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "NOT_ELIGIBLE");
  });

  it("un cupón sin condición no se ve afectado", () => {
    const sinCondicion = promo({
      id: "p-libre",
      code: "ABIERTO10",
      discountType: "PERCENTAGE",
      discountValue: 10,
    });
    const res = previewPromotion({
      promotion: sinCondicion,
      usage: usageZero,
      originalAmount: 3_000_000,
      currency: "ARS",
      platform: "CLICKATON",
      editionId: "ed1",
    });
    assert.equal(res.ok, true);
  });
});
```

Y agregar `readEligibilityRule` al import del archivo de tests:

```typescript
import { readEligibilityRule } from "./eligibility";
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
pnpm --filter @repo/promotions test
```

Esperado: FAIL — `Cannot find module './eligibility'`.

- [ ] **Step 3: Crear el lector de reglas**

Crear `packages/promotions/src/eligibility.ts`:

```typescript
import type { PromotionEligibilityRule } from "./types";

/**
 * Lee la condición de elegibilidad guardada en `DnxPromotion.metadata`.
 *
 * Devuelve null cuando no hay condición o cuando está malformada: un cupón con
 * metadata rota se trata como cupón abierto, no como cupón roto. La protección
 * contra el olvido del llamador vive en el motor (fail-closed), no acá.
 */
export function readEligibilityRule(
  metadata: Record<string, unknown> | null,
): PromotionEligibilityRule | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = (metadata as { eligibility?: unknown }).eligibility;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const candidate = raw as {
    kind?: unknown;
    editionIds?: unknown;
    requireCheckIn?: unknown;
  };
  if (candidate.kind !== "PARTICIPATED_IN_EDITION") return null;
  if (!Array.isArray(candidate.editionIds)) return null;

  const editionIds = candidate.editionIds.filter(
    (id): id is string => typeof id === "string" && id.trim().length > 0,
  );
  if (editionIds.length === 0) return null;

  return {
    kind: "PARTICIPATED_IN_EDITION",
    editionIds,
    requireCheckIn: candidate.requireCheckIn === true,
  };
}
```

- [ ] **Step 4: Agregar los tipos**

En `packages/promotions/src/types.ts`, agregar después del bloque de `PROMOTION_REDEMPTION_STATUSES`:

```typescript
export const PROMOTION_ELIGIBILITY_KINDS = ["PARTICIPATED_IN_EDITION"] as const;
export type PromotionEligibilityKind = (typeof PROMOTION_ELIGIBILITY_KINDS)[number];

/** Condición opcional guardada en `DnxPromotion.metadata.eligibility`. */
export type PromotionEligibilityRule = {
  kind: PromotionEligibilityKind;
  /** Ediciones cuya participación habilita el cupón. Al menos una. */
  editionIds: string[];
  /** true = además hay que haberse acreditado el día del evento. */
  requireCheckIn: boolean;
};

/**
 * Elegibilidad ya resuelta por el adaptador de la plataforma.
 * El motor es puro: no consulta la base.
 */
export type PromotionEligibilityResolution = {
  isEligible: boolean;
};
```

En el mismo archivo, agregar el campo a `PreviewPromotionInput` (después de `userId`):

```typescript
  /**
   * Resultado de evaluar `metadata.eligibility`. Obligatorio cuando el cupón
   * tiene condición: si falta, el motor rechaza (fail-closed).
   */
  eligibility?: PromotionEligibilityResolution | null;
```

Y agregar `"NOT_ELIGIBLE"` a la unión `PromotionRejectionCode`, después de `"EDITION_MISMATCH"`:

```typescript
  | "NOT_ELIGIBLE"
```

- [ ] **Step 5: Aplicar la regla en el motor**

En `packages/promotions/src/engine.ts`, agregar el import:

```typescript
import { readEligibilityRule } from "./eligibility";
```

E insertar el bloque justo después del control de `EDITION_MISMATCH` y antes del de `minimumPurchaseAmount`:

```typescript
  const eligibilityRule = readEligibilityRule(promo.metadata);
  if (eligibilityRule && input.eligibility?.isEligible !== true) {
    return reject(
      "NOT_ELIGIBLE",
      "Este código es exclusivo para quienes participaron de una edición anterior.",
    );
  }
```

- [ ] **Step 6: Exportar lo nuevo**

En `packages/promotions/src/index.ts`, agregar a la lista de tipos exportados:

```typescript
  PromotionEligibilityKind,
  PromotionEligibilityRule,
  PromotionEligibilityResolution,
```

a la lista de constantes exportadas desde `./types`:

```typescript
  PROMOTION_ELIGIBILITY_KINDS,
```

y una línea nueva de export:

```typescript
export { readEligibilityRule } from "./eligibility";
```

- [ ] **Step 7: Correr los tests y verificar que pasan**

```bash
pnpm --filter @repo/promotions test
pnpm --filter @repo/promotions check-types
```

Esperado: todos los tests en verde (los viejos incluidos) y sin errores de tipos.

- [ ] **Step 8: Commit**

```bash
git add packages/promotions/src
git commit -m "Permitir condiciones de elegibilidad en los cupones DNX

El motor lee metadata.eligibility y recibe la elegibilidad ya resuelta,
manteniéndose puro. Si un cupón tiene condición y nadie la resolvió, se
rechaza: un olvido deja el cupón inutilizable, nunca abierto a todos.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: El adaptador de Clickatón resuelve la elegibilidad

**Files:**
- Create: `apps/clickaton/lib/promotions/eligibility-where.ts`
- Create: `apps/clickaton/lib/promotions/eligibility-where.test.ts`
- Modify: `apps/clickaton/lib/promotions/prisma-promotions-adapter.ts`
- Modify: `apps/clickaton/package.json` (script de test)

**Interfaces:**
- Consumes: `readEligibilityRule`, `PromotionEligibilityRule`, `PromotionEligibilityResolution` de Task 1.
- Produces:
  - `function buildEligibilityWhere(rule: PromotionEligibilityRule, identity: { email: string | null; userId: number | null }): Prisma.ClickatonRegistrationWhereInput | null` — `null` significa "no hay forma de identificar a esta persona", que el llamador traduce a no elegible.
  - `previewClickatonPromotion` y `reserveClickatonPromotion` ganan el parámetro opcional `email?: string | null`.

La consulta se extrae a su propio archivo porque así se puede testear sin base de datos: se verifica la forma del `where`, que es donde están los errores caros (olvidar `isOpsTest`, olvidar `CONFIRMED`).

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/clickaton/lib/promotions/eligibility-where.test.ts`:

```typescript
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEligibilityWhere } from "./eligibility-where";

const regla = {
  kind: "PARTICIPATED_IN_EDITION" as const,
  editionIds: ["ed0"],
  requireCheckIn: false,
};

describe("buildEligibilityWhere", () => {
  it("sin email ni cuenta no hay forma de identificar a la persona", () => {
    assert.equal(buildEligibilityWhere(regla, { email: null, userId: null }), null);
  });

  it("busca sólo inscripciones confirmadas y no de prueba", () => {
    const where = buildEligibilityWhere(regla, { email: "a@b.com", userId: null });
    assert.deepEqual(where?.editionId, { in: ["ed0"] });
    assert.equal(where?.status, "CONFIRMED");
    assert.equal(where?.isOpsTest, false);
  });

  it("normaliza el email a minúsculas y sin espacios", () => {
    const where = buildEligibilityWhere(regla, { email: "  Ana@Correo.COM ", userId: null });
    assert.deepEqual(where?.OR, [{ email: "ana@correo.com" }]);
  });

  it("acepta email o cuenta indistintamente", () => {
    const where = buildEligibilityWhere(regla, { email: "a@b.com", userId: 7 });
    assert.deepEqual(where?.OR, [{ email: "a@b.com" }, { userId: 7 }]);
  });

  it("no exige acreditación por defecto", () => {
    const where = buildEligibilityWhere(regla, { email: "a@b.com", userId: null });
    assert.equal(where?.checkIns, undefined);
  });

  it("exige acreditación cuando la regla lo pide", () => {
    const where = buildEligibilityWhere(
      { ...regla, requireCheckIn: true },
      { email: "a@b.com", userId: null },
    );
    assert.deepEqual(where?.checkIns, { some: {} });
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
cd apps/clickaton && pnpm exec tsx --test lib/promotions/eligibility-where.test.ts
```

Esperado: FAIL — no existe `./eligibility-where`.

- [ ] **Step 3: Escribir la construcción del filtro**

Crear `apps/clickaton/lib/promotions/eligibility-where.ts`:

```typescript
import type { Prisma } from "@repo/db";
import type { PromotionEligibilityRule } from "@repo/promotions";

export type EligibilityIdentity = {
  email: string | null;
  userId: number | null;
};

/**
 * Arma el filtro que responde: ¿esta persona participó de alguna de estas ediciones?
 *
 * Devuelve null cuando no hay ningún dato con el cual identificarla; el llamador
 * lo traduce a "no elegible" sin consultar la base.
 */
export function buildEligibilityWhere(
  rule: PromotionEligibilityRule,
  identity: EligibilityIdentity,
): Prisma.ClickatonRegistrationWhereInput | null {
  const or: Prisma.ClickatonRegistrationWhereInput[] = [];

  const email = identity.email?.trim().toLowerCase();
  if (email) or.push({ email });
  if (identity.userId != null) or.push({ userId: identity.userId });
  if (or.length === 0) return null;

  return {
    editionId: { in: rule.editionIds },
    status: "CONFIRMED",
    isOpsTest: false,
    OR: or,
    ...(rule.requireCheckIn ? { checkIns: { some: {} } } : {}),
  };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
cd apps/clickaton && pnpm exec tsx --test lib/promotions/eligibility-where.test.ts
```

Esperado: 6 tests en verde.

- [ ] **Step 5: Registrar el script de test**

En `apps/clickaton/package.json`, agregar junto a los otros `test:*`:

```json
    "test:promotions-eligibility": "tsx --test lib/promotions/eligibility-where.test.ts",
```

- [ ] **Step 6: Conectar el adaptador**

En `apps/clickaton/lib/promotions/prisma-promotions-adapter.ts`:

Agregar a los imports de `@repo/promotions`:

```typescript
  readEligibilityRule,
  type PromotionEligibilityResolution,
```

Agregar el import del filtro:

```typescript
import { buildEligibilityWhere, type EligibilityIdentity } from "./eligibility-where";
```

Agregar la función que resuelve, debajo de `usageCounters`:

```typescript
/**
 * Resuelve la condición del cupón contra las inscripciones de ediciones anteriores.
 * Devuelve null cuando el cupón no tiene condición (el motor no la va a mirar).
 */
async function resolveEligibility(
  promotion: PromotionRecord,
  identity: EligibilityIdentity,
): Promise<PromotionEligibilityResolution | null> {
  const rule = readEligibilityRule(promotion.metadata);
  if (!rule) return null;

  const where = buildEligibilityWhere(rule, identity);
  if (!where) return { isEligible: false };

  const found = await prisma.clickatonRegistration.findFirst({
    where,
    select: { id: true },
  });
  return { isEligible: found != null };
}
```

En `previewClickatonPromotion`, agregar `email?: string | null;` a la firma del input y, después de calcular `usage`, resolver y pasar la elegibilidad:

```typescript
  const usage = await usageCounters(promotion.id, input.userId);
  const eligibility = await resolveEligibility(promotion, {
    email: input.email ?? null,
    userId: input.userId ?? null,
  });
  return previewPromotion({
    promotion,
    usage,
    originalAmount: input.originalAmount,
    currency: input.currency,
    platform: CLICKATON_PROMOTION_PLATFORM,
    editionId: input.editionId,
    userId: input.userId,
    eligibility,
    now: input.now,
  });
```

En `reserveClickatonPromotion`, agregar `email?: string | null;` a la firma del input y hacer lo mismo antes de `buildRedeemCommand`:

```typescript
  const usage = await usageCounters(promotion.id, input.userId);
  const eligibility = await resolveEligibility(promotion, {
    email: input.email ?? null,
    userId: input.userId ?? null,
  });
  const built = buildRedeemCommand({
    promotion,
    usage,
    originalAmount: input.originalAmount,
    currency: input.currency,
    platform: CLICKATON_PROMOTION_PLATFORM,
    editionId: input.editionId,
    userId: input.userId,
    eligibility,
    orderId: input.orderId,
    registrationId: input.registrationId ?? null,
    idempotencyKey: input.idempotencyKey,
    now: input.now,
  });
```

> **Ojo con la rama de idempotencia:** `reserveClickatonPromotion` empieza devolviendo la redención existente cuando la `idempotencyKey` ya está usada, antes de validar nada. Eso es correcto y **no hay que tocarlo**: si la reserva ya existe, la elegibilidad ya se validó cuando se creó.

- [ ] **Step 7: Verificar tipos**

```bash
cd apps/clickaton && pnpm check-types
```

Esperado: sin errores.

- [ ] **Step 8: Commit**

```bash
git add apps/clickaton/lib/promotions apps/clickaton/package.json
git commit -m "Resolver la elegibilidad de un cupón en Clickatón

El filtro se extrae a su propio archivo para poder testear la forma de la
consulta sin base de datos: olvidar isOpsTest o el estado CONFIRMED es el
error caro acá.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: La reserva real pasa el email (cierre del agujero)

Esta es la tarea que hace que la condición sirva de verdad. La verificación previa del formulario es cortesía; quien decide es el camino de reserva. Sin esta tarea, alguien puede saltear la pantalla y mandar el código directo.

**Files:**
- Modify: `apps/clickaton/lib/public-registration/application/public-registration-service.ts:238-260` (el tipo `PromotionsPort`) y `:687-700` (la llamada a `reserve`)
- Modify: `apps/clickaton/lib/public-registration/actions/runtime.ts`

**Interfaces:**
- Consumes: `reserveClickatonPromotion` con `email` de Task 2.
- Produces: `PromotionsPort.reserve` acepta `email: string | null`.

- [ ] **Step 1: Leer el estado actual**

```bash
cd apps/clickaton && sed -n '238,262p' lib/public-registration/application/public-registration-service.ts
grep -n "reserve" lib/public-registration/actions/runtime.ts
```

Anotar la firma exacta de `reserve` dentro de `PromotionsPort` y cómo `runtime.ts` la cablea con el adaptador.

- [ ] **Step 2: Agregar el email al puerto**

En `public-registration-service.ts`, dentro del tipo `PromotionsPort`, agregar `email: string | null;` al objeto que recibe `reserve`, junto a `userId`.

Si `runtime.ts` pasa el adaptador con spread o referencia directa, no hace falta cambiarlo; si lo envuelve con una función, agregar ahí también el campo.

- [ ] **Step 3: Pasar el email en la llamada**

En `public-registration-service.ts`, en la llamada a `promotions.reserve` (alrededor de la línea 688), agregar el email. La variable ya existe unas líneas más arriba:

```typescript
        const reserved = await promotions.reserve({
          code: rawPromo,
          originalAmount: chargeAmount,
          currency: ticket.currency,
          editionId: edition.id,
          userId,
          email,
          orderId: promoIdempotencyKey,
          idempotencyKey: promoIdempotencyKey,
          now,
        });
```

> `email` ya está normalizado en esa función: `const email = normalizeEmail(input.participant.email);`. Usar esa variable, no `input.participant.email` crudo.

- [ ] **Step 4: Mejorar el mensaje de rechazo**

Buscar el bloque `if (!reserved.ok)` inmediatamente posterior. Hoy lanza `PublicRegistrationError` con `"EDITION_NOT_AVAILABLE"`. Dejar el código de error como está (cambiarlo puede romper el manejo en la pantalla), pero asegurarse de que el mensaje que llega al participante sea el del motor (`reserved.message`) y no uno genérico.

- [ ] **Step 5: Verificar tipos y correr los selfchecks del camino de inscripción**

```bash
cd apps/clickaton && pnpm check-types
pnpm selfcheck:public-registration-reservation
pnpm selfcheck:public-registration-hardening
pnpm selfcheck:guest-registration-identity
```

Esperado: sin errores de tipos y los tres selfchecks en verde. Si alguno falla, **leer el error antes de tocar nada**: probablemente haya un doble de prueba del puerto `PromotionsPort` que también necesita el campo nuevo.

- [ ] **Step 6: Commit**

```bash
git add apps/clickaton/lib/public-registration
git commit -m "Validar la condición del cupón al reservar, no sólo al previsualizar

Sin el email en el camino de reserva, la condición se puede saltear mandando
el código directo sin pasar por la pantalla.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: La verificación previa deja de mentir

**Files:**
- Modify: `apps/clickaton/lib/public-registration/actions/preview-promotion.ts`

**Interfaces:**
- Consumes: `previewClickatonPromotion` con `email` de Task 2.
- Produces: `previewPublicPromotionAction` acepta `email?: string` en su input.

Hoy esta acción no pasa ni el `userId` ni el email, así que el límite por persona y la condición nunca se controlan en la pantalla: dice "aplicado" y el backend después rechaza.

- [ ] **Step 1: Agregar el email al input de la acción**

En `preview-promotion.ts`, la firma pasa a ser:

```typescript
export async function previewPublicPromotionAction(input: {
  editionSlug: string;
  ticketTypeId: string;
  promoCode: string;
  email?: string;
}): Promise<PreviewPromotionActionResult> {
```

- [ ] **Step 2: Resolver la identidad y pasarla al adaptador**

Reemplazar la llamada a `previewClickatonPromotion` por:

```typescript
    const email = input.email?.trim().toLowerCase() || null;
    let userId: number | null = null;
    if (email) {
      const identity = await repo.resolveIdentityCandidate(email);
      userId = identity.userId;
    }

    const preview = await previewClickatonPromotion({
      code: input.promoCode,
      originalAmount,
      currency: ticket.currency,
      editionId: edition.id,
      email,
      userId,
    });
```

`repo` ya está creado unas líneas más arriba en esta misma función.

- [ ] **Step 3: Verificar tipos**

```bash
cd apps/clickaton && pnpm check-types
```

- [ ] **Step 4: Commit**

```bash
git add apps/clickaton/lib/public-registration/actions/preview-promotion.ts
git commit -m "Validar el cupón con el email en la verificación previa

Antes decía 'código aplicado' sobre códigos que el backend iba a rechazar,
porque la verificación previa no miraba quién era la persona.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: El asistente manda el email y avisa si falta

**Files:**
- Modify: `apps/clickaton/components/public-registration/PublicRegistrationWizard.tsx` (función `applyPromoCode`, alrededor de la línea 413)

**Interfaces:**
- Consumes: `previewPublicPromotionAction` con `email` de Task 4.
- Produces: nada que otra tarea consuma.

El campo de cupón vive en el paso `participant`, después del campo de email, y se repite en `review`. El estado `email` ya existe en el componente (línea 135).

- [ ] **Step 1: Mandar el email y guardar contra el email vacío**

En `applyPromoCode`, reemplazar el cuerpo entre la validación del código y la llamada a la acción:

```typescript
  async function applyPromoCode() {
    if (!selectedTicket || !canUsePromo) return;
    const code = promoCodeInput.trim();
    if (code.length < 2) {
      setPromoError("Ingresá un código válido.");
      return;
    }
    const emailForPromo = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForPromo)) {
      setPromoError("Completá tu email para validar este código.");
      return;
    }
    setPromoPending(true);
    setPromoError(null);
    try {
      const result = await previewPublicPromotionAction({
        editionSlug: context.edition.slug,
        ticketTypeId: selectedTicket.id,
        promoCode: code,
        email: emailForPromo,
      });
      // …el resto queda igual
```

- [ ] **Step 2: Verificar tipos y lint**

```bash
cd apps/clickaton && pnpm check-types && pnpm lint
```

- [ ] **Step 3: Probar a mano el recorrido**

Levantar el servidor y recorrer el asistente. **No usar un preview de Vercel**: piden login y una rama sin cambios propios ni se construye.

```bash
cd apps/clickaton && pnpm dev
```

Verificar tres cosas en `/inscripcion/<slug de una edición de prueba>`:
1. Aplicar un cupón con el email vacío → dice "Completá tu email para validar este código" y no llama al servidor.
2. Aplicar un cupón con condición usando un email que **no** participó → lo rechaza con el mensaje de exclusividad.
3. Aplicar un cupón sin condición → sigue funcionando como siempre.

- [ ] **Step 4: Commit**

```bash
git add apps/clickaton/components/public-registration/PublicRegistrationWizard.tsx
git commit -m "Validar el cupón con el email cargado en el asistente

Si el email todavía está vacío, el asistente lo pide en vez de consultar al
servidor con las manos vacías.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Configurar la condición desde el panel

**Files:**
- Modify: `apps/clickaton/lib/admin/promotions/mutations.ts`
- Modify: `apps/clickaton/app/admin/(panel)/promociones/page.tsx`

**Interfaces:**
- Consumes: la forma de `metadata.eligibility` definida en Task 1.
- Produces: nada que otra tarea consuma.

- [ ] **Step 1: Construir la condición desde el formulario**

En `mutations.ts`, dentro de `createPromotionFormAction`, después del bloque que resuelve `perUserUsageLimit` y **antes** del `if (Object.keys(errors).length …)`:

```typescript
  // Condición de elegibilidad (opcional). Se guarda en metadata: no hay columna.
  const eligibilityKind = (formData.get("eligibilityKind")?.toString() ?? "").trim();
  const eligibilityEditionId = (formData.get("eligibilityEditionId")?.toString() ?? "").trim();
  const eligibilityRequireCheckIn =
    formData.get("eligibilityRequireCheckIn") === "on" ||
    formData.get("eligibilityRequireCheckIn") === "true";

  let metadata: { eligibility: Record<string, unknown> } | undefined;
  if (eligibilityKind === "PARTICIPATED_IN_EDITION") {
    if (!eligibilityEditionId) {
      errors.eligibilityEditionId = "Elegí la edición en la que tienen que haber participado.";
    } else {
      metadata = {
        eligibility: {
          kind: "PARTICIPATED_IN_EDITION",
          editionIds: [eligibilityEditionId],
          requireCheckIn: eligibilityRequireCheckIn,
        },
      };
    }
  }
```

Y agregar el campo al `prisma.dnxPromotion.create`, después de `editionId`:

```typescript
        ...(metadata ? { metadata } : {}),
```

- [ ] **Step 2: Agregar los campos al formulario**

En `app/admin/(panel)/promociones/page.tsx`, después del `<Field id="editionId" …>` que ya existe:

```tsx
          <Field
            id="eligibilityKind"
            label="¿Quién puede usarlo?"
            hint="Restringe el cupón a participantes de una edición anterior"
          >
            <Select name="eligibilityKind" defaultValue="" className="min-h-11">
              <option value="">Cualquiera</option>
              <option value="PARTICIPATED_IN_EDITION">
                Sólo quienes participaron de…
              </option>
            </Select>
          </Field>
          <Field id="eligibilityEditionId" label="…de esta edición">
            <Select name="eligibilityEditionId" defaultValue="" className="min-h-11">
              <option value="">—</option>
              {editionOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex min-h-11 items-center gap-2 text-sm text-ck-text md:col-span-2">
            <input
              type="checkbox"
              name="eligibilityRequireCheckIn"
              className="size-4 rounded border-ck-border"
            />
            Sólo quienes además se acreditaron el día del evento
          </label>
```

- [ ] **Step 3: Mostrar la condición en la lista**

En la misma pantalla, donde se arma la fila de cada cupón (cerca de la línea 200, donde hoy se muestra `promo.editionId ?? "—"`), agregar un dato más. Importar el lector:

```typescript
import { readEligibilityRule } from "@repo/promotions";
```

Y agregar a la lista de datos de la fila:

```tsx
                      {
                        label: "Condición",
                        value: (() => {
                          const rule = readEligibilityRule(
                            promo.metadata as Record<string, unknown> | null,
                          );
                          if (!rule) return "Abierto";
                          const nombres = rule.editionIds
                            .map((id) => editionNameById.get(id) ?? "otra edición")
                            .join(", ");
                          return rule.requireCheckIn
                            ? `Acreditados en ${nombres}`
                            : `Inscriptos en ${nombres}`;
                        })(),
                      },
```

> Verificar la forma exacta de la estructura de datos de la fila antes de pegar esto: puede ser un arreglo de `{ label, value }` o JSX suelto. Adaptar el formato al que ya usa el archivo.

- [ ] **Step 4: Verificar tipos y lint**

```bash
cd apps/clickaton && pnpm check-types && pnpm lint
```

- [ ] **Step 5: Probar a mano**

Con `pnpm dev`, entrar a `/admin/promociones` y:
1. Crear un cupón con "Cualquiera" → la lista dice "Abierto" y el cupón funciona como siempre.
2. Crear un cupón con condición sobre la 1ª edición y acreditación exigida → la lista dice "Acreditados en …".
3. Elegir la condición sin elegir edición → muestra el error del paso 1, no crea el cupón.

- [ ] **Step 6: Commit**

```bash
git add apps/clickaton/lib/admin/promotions/mutations.ts "apps/clickaton/app/admin/(panel)/promociones/page.tsx"
git commit -m "Configurar la condición del cupón desde el panel

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Verificación final y rama lista

**Files:** ninguno nuevo.

- [ ] **Step 1: Correr toda la verificación**

```bash
cd /Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/.claude/worktrees/clickaton-2da-edicion
pnpm --filter @repo/promotions test
pnpm --filter @repo/promotions check-types
cd apps/clickaton
pnpm test:promotions-eligibility
pnpm selfcheck:public-registration-reservation
pnpm selfcheck:public-registration-hardening
pnpm selfcheck:guest-registration-identity
pnpm check-types
pnpm lint
```

**Pegar la salida real.** No declarar nada en verde sin haber visto el resultado del comando.

- [ ] **Step 2: Verificar que las otras plataformas no se rompieron**

`@repo/promotions` lo consumen cinco aplicaciones. Verificar tipos en las que lo usan:

```bash
cd /Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite
grep -rl "@repo/promotions" --include="package.json" apps/
```

Y correr `pnpm check-types` en cada una que aparezca.

- [ ] **Step 3: Abrir el pull request**

```bash
git push -u origin worktree-clickaton-2da-edicion
gh pr create --title "Cupones con condiciones de elegibilidad para Clickatón" --body "$(cat <<'EOF'
Un cupón de Clickatón puede restringirse a quienes participaron de una edición
anterior. Sirve para la venta anticipada de la 2ª edición (19/12): un código
público que sólo funciona para los 29 acreditados de la 1ª, así que si circula
por WhatsApp no le sirve a nadie más.

## Cómo está hecho

La condición se guarda en `DnxPromotion.metadata`, que ya es `Json`: **no hay
migración de base de datos** y no hay que tocar las 5 bases Neon.

El motor compartido `@repo/promotions` sigue siendo puro — lee la regla y recibe
la elegibilidad ya resuelta, igual que hoy recibe los contadores de uso. Quien
consulta la base es el adaptador de Clickatón.

Es **fail-closed**: si un cupón tiene condición y el llamador no la resolvió, el
cupón se rechaza. Un olvido lo deja inutilizable, nunca abierto a todos.

## Compatibilidad

Un cupón sin condición se comporta exactamente igual que antes. Las otras cuatro
plataformas que usan `@repo/promotions` no cambian.

## Además

- La verificación previa del formulario deja de decir "código aplicado" sobre
  códigos que el backend iba a rechazar: antes no miraba quién era la persona.
- La condición también se valida al reservar, no sólo al previsualizar. Sin eso
  se podía saltear mandando el código sin pasar por la pantalla.

## Antes de usarlo en producción

Hay 5 cupones con `editionId = null` que valen para **todas** las ediciones,
incluida la nueva. El crítico es `CLICFREE` (100%, sin límite, vigente hasta el
02/10). Hay que desactivarlos desde el panel antes de crear la 2ª edición.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Después de fusionar: la configuración (no es código)

Estos pasos se hacen desde el panel y la base, no desde el repositorio. **El primero es urgente y conviene hacerlo antes que nada**, incluso antes de terminar la implementación.

1. **Desactivar los cupones sueltos.** Cinco cupones tienen `editionId = null` y por lo tanto valen para todas las ediciones, incluida la nueva. El crítico es `CLICFREE` (100% de descuento, sin límite de usos, vigente hasta el 02/10). Desactivarlos o atarlos a la 1ª edición desde `/admin/promociones`.
2. **Arreglar el aviso de pago de Mercado Pago** (`MERCADOPAGO_WEBHOOK_SECRET` + reconciliación contra el proveedor) antes de abrir la venta.
3. **Crear la edición del 19/12** con sus cuatro fases de precio y la sede de Rosario.
4. **Crear `VOLVI50` y `VOLVI35`** con la condición sobre la 1ª edición (`cms78cthj0000xpc4841bihf4`), acreditación exigida, 1 uso por persona y atados a la edición nueva.
5. **Abrir la inscripción con las dos fechas**: la ventana de la edición y la fase de precio vigente.
6. **Avisar a los 29 acreditados** de la 1ª edición.
7. **Antes de sumar una segunda sede**, recorrer el asistente completo con dos sedes cargadas. El paso "elegí tu sede" existe en el código y nunca se ejecutó en producción: se trata como código nuevo. La venta anticipada no lo necesita, porque arranca sólo con Rosario.
