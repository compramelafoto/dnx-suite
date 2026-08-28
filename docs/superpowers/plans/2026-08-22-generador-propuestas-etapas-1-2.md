# Generador de propuestas — etapas 1 y 2 · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un vendedor suba el logo de un cliente en `/propuesta` y obtenga, sin base de datos, las nueve piezas publicitarias en pantalla y un PDF descargable.

**Architecture:** La lógica pura (catálogo de piezas, medición de contraste, decisión de placa, plan de propuesta) vive en `@repo/partners` y se prueba sin base de datos. La app Clickatón aporta la pantalla en React, una ruta que compone las imágenes con `sharp` y otra que arma el PDF con `pdf-lib`. La vista previa se dibuja en el navegador; el PDF en el servidor.

**Tech Stack:** TypeScript, Next 16.2.1 (App Router), React 19.2.4, `sharp` 0.34.5, `pdf-lib` 1.17.1, tests con `node:test` vía `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-08-22-generador-propuestas-sponsors-design.md`

## Global Constraints

- **Alcance de este plan:** solo etapas 1 y 2 del spec. No hay tabla nueva, no hay persistencia, no hay alta de sponsor, no hay búsqueda de duplicados. Esas son las etapas 3 a 5 y van en otro plan.
- **Idioma:** todo texto visible al usuario en español rioplatense. Comentarios de código en español.
- **Tests:** `node:test` con `import assert from "node:assert/strict"` e `import { describe, it } from "node:test"`. Cada archivo nuevo de test se agrega a la lista explícita del script `test` en `packages/partners/package.json`.
- **Las 220 pruebas existentes de `@repo/partners` deben seguir pasando** después de cada commit.
- **No hay `zod` en Clickatón.** La validación se escribe a mano, como el resto del repositorio.
- **Sin base de datos:** ninguna tarea de este plan importa `prisma` ni `@repo/db`.
- **Rama:** `feat/partners-demo-comercial-e2`, worktree `dnx-suite-wt-etapa10-marquee`.
- **La ruta `/propuesta` responde 404 cuando `NODE_ENV === "production"`** hasta que el spec diga lo contrario.
- **Nueve piezas:** 4 placas de bienvenida, 2 banners, 3 franjas de logos. Cada una en desktop (1440×900) y mobile (390×844).

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `packages/partners/src/proposal-pieces.ts` | Catálogo de las 9 piezas: qué es cada una, en qué plataforma, qué medidas |
| `packages/partners/src/proposal-contrast.ts` | Mide el brillo de un logo y decide si necesita placa clara u oscura |
| `packages/partners/src/proposal-plan.ts` | Arma la lista de líneas de una propuesta a partir de la marca |
| `packages/partners/src/proposal-pieces.test.ts` | Pruebas del catálogo |
| `packages/partners/src/proposal-contrast.test.ts` | Pruebas de contraste |
| `packages/partners/src/proposal-plan.test.ts` | Pruebas del armado |
| `apps/clickaton/lib/propuesta/compose.ts` | Compone logo + fondo con `sharp` |
| `apps/clickaton/lib/propuesta/pdf.ts` | Arma el documento con `pdf-lib` |
| `apps/clickaton/app/(public)/propuesta/page.tsx` | Pantalla partida |
| `apps/clickaton/app/(public)/propuesta/ProposalStudio.tsx` | Cliente: formulario y vista previa |
| `apps/clickaton/app/api/propuesta/pieza/route.ts` | Devuelve una pieza compuesta como PNG |
| `apps/clickaton/app/api/propuesta/pdf/route.ts` | Devuelve el PDF |
| `apps/clickaton/public/propuesta/backgrounds/*.jpg` | Los 4 fondos de las páginas públicas |

---

### Task 1: Catálogo de piezas

**Files:**
- Create: `packages/partners/src/proposal-pieces.ts`
- Create: `packages/partners/src/proposal-pieces.test.ts`
- Modify: `packages/partners/package.json` (agregar el test a la lista)
- Modify: `packages/partners/src/index.ts` (exportar)

**Interfaces:**
- Consumes: nada
- Produces: `PROPOSAL_PIECES: readonly ProposalPiece[]`, tipo `ProposalPiece`, función `getProposalPiece(id: string): ProposalPiece | undefined`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `packages/partners/src/proposal-pieces.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROPOSAL_PIECES,
  getProposalPiece,
  type ProposalPiece,
} from "./proposal-pieces";

describe("catálogo de piezas de propuesta", () => {
  it("tiene exactamente nueve piezas", () => {
    assert.equal(PROPOSAL_PIECES.length, 9);
  });

  it("cubre las tres familias en la proporción esperada", () => {
    const cuenta = (kind: ProposalPiece["kind"]) =>
      PROPOSAL_PIECES.filter((p) => p.kind === kind).length;
    assert.equal(cuenta("WELCOME"), 4);
    assert.equal(cuenta("BANNER"), 2);
    assert.equal(cuenta("MARQUEE"), 3);
  });

  it("no repite identificadores", () => {
    const ids = PROPOSAL_PIECES.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("cada pieza declara un placement montado", () => {
    const montados = new Set([
      "CLICKATON_EVENT_WELCOME",
      "CLICKATON_HOME_MARQUEE",
      "CLICKATON_EVENT_MARQUEE",
      "FOTORANK_CONTEST_WELCOME",
      "INFOSPOT_HOME_WELCOME",
      "INFOSPOT_HOME_TOP",
      "INFOSPOT_HOME_INLINE",
      "INFOSPOT_HOME_MARQUEE",
      "CLF_ALBUM_WELCOME",
      "CLF_HOME_PROMO",
      "CLF_LOGO_MARQUEE",
    ]);
    for (const p of PROPOSAL_PIECES) {
      assert.ok(
        montados.has(p.placementKey),
        `${p.id} apunta a ${p.placementKey}, que no está montado`,
      );
    }
  });

  it("cada pieza nombra un fondo y una plataforma", () => {
    for (const p of PROPOSAL_PIECES) {
      assert.match(p.background, /^bg-(clickaton|fotorank|infospot|clf)\.jpg$/);
      assert.ok(p.platformLabel.length > 0);
    }
  });

  it("getProposalPiece encuentra por id y devuelve undefined si no existe", () => {
    assert.equal(getProposalPiece("infospot-welcome")?.kind, "WELCOME");
    assert.equal(getProposalPiece("no-existe"), undefined);
  });
});
```

- [ ] **Step 2: Correr la prueba para verificar que falla**

Run: `cd packages/partners && pnpm exec tsx --test src/proposal-pieces.test.ts`
Expected: FAIL — `Cannot find module './proposal-pieces'`

- [ ] **Step 3: Escribir la implementación mínima**

Crear `packages/partners/src/proposal-pieces.ts`:

```ts
/**
 * Catálogo de piezas que se muestran en una propuesta comercial.
 *
 * Cada pieza corresponde a un placement realmente montado hoy. El fondo es una
 * captura de la página pública, servida desde `public/propuesta/backgrounds/`.
 */

export type ProposalPieceKind = "WELCOME" | "BANNER" | "MARQUEE";

export type ProposalPiece = {
  /** Identificador estable, usado en URLs y nombres de archivo. */
  id: string;
  kind: ProposalPieceKind;
  /** Placement del catálogo de DNX Partners al que corresponde. */
  placementKey: string;
  /** Nombre de la plataforma, para mostrar. */
  platformLabel: string;
  /** Nombre de la pieza, para mostrar. */
  label: string;
  /** Dónde aparece, en una frase. */
  location: string;
  /** Archivo de fondo en `public/propuesta/backgrounds/`. */
  background: string;
  /** Orden de aparición en la vista previa y en el PDF. */
  sortOrder: number;
};

export const PROPOSAL_PIECES: readonly ProposalPiece[] = [
  {
    id: "infospot-welcome",
    kind: "WELCOME",
    placementKey: "INFOSPOT_HOME_WELCOME",
    platformLabel: "InfoSpot",
    label: "Placa de bienvenida",
    location: "Al entrar a la portada, una vez cada 24 horas por visitante.",
    background: "bg-infospot.jpg",
    sortOrder: 10,
  },
  {
    id: "clickaton-welcome",
    kind: "WELCOME",
    placementKey: "CLICKATON_EVENT_WELCOME",
    platformLabel: "Clickatón",
    label: "Placa de bienvenida",
    location: "Al entrar a la página de una maratón.",
    background: "bg-clickaton.jpg",
    sortOrder: 20,
  },
  {
    id: "fotorank-welcome",
    kind: "WELCOME",
    placementKey: "FOTORANK_CONTEST_WELCOME",
    platformLabel: "FotoRank",
    label: "Placa de bienvenida",
    location: "Al entrar a la página de un concurso.",
    background: "bg-fotorank.jpg",
    sortOrder: 30,
  },
  {
    id: "clf-welcome",
    kind: "WELCOME",
    placementKey: "CLF_ALBUM_WELCOME",
    platformLabel: "ComprameLaFoto",
    label: "Placa de bienvenida",
    location: "Al entrar a un álbum público de fotos.",
    background: "bg-clf.jpg",
    sortOrder: 40,
  },
  {
    id: "infospot-banner",
    kind: "BANNER",
    placementKey: "INFOSPOT_HOME_TOP",
    platformLabel: "InfoSpot",
    label: "Banner horizontal",
    location: "En la portada, debajo de las noticias principales.",
    background: "bg-infospot.jpg",
    sortOrder: 50,
  },
  {
    id: "clf-banner",
    kind: "BANNER",
    placementKey: "CLF_HOME_PROMO",
    platformLabel: "ComprameLaFoto",
    label: "Banner horizontal",
    location: "En la portada, debajo del buscador.",
    background: "bg-clf.jpg",
    sortOrder: 60,
  },
  {
    id: "infospot-marquee",
    kind: "MARQUEE",
    placementKey: "INFOSPOT_HOME_MARQUEE",
    platformLabel: "InfoSpot",
    label: "Franja de logos",
    location: "Bloque «Nos acompañan», al pie de la portada.",
    background: "bg-infospot.jpg",
    sortOrder: 70,
  },
  {
    id: "clickaton-marquee",
    kind: "MARQUEE",
    placementKey: "CLICKATON_HOME_MARQUEE",
    platformLabel: "Clickatón",
    label: "Franja de logos",
    location: "Al pie de la portada y de cada maratón.",
    background: "bg-clickaton.jpg",
    sortOrder: 80,
  },
  {
    id: "clf-marquee",
    kind: "MARQUEE",
    placementKey: "CLF_LOGO_MARQUEE",
    platformLabel: "ComprameLaFoto",
    label: "Franja de logos",
    location: "Al pie de la portada.",
    background: "bg-clf.jpg",
    sortOrder: 90,
  },
];

export function getProposalPiece(id: string): ProposalPiece | undefined {
  return PROPOSAL_PIECES.find((p) => p.id === id);
}
```

- [ ] **Step 4: Agregar el test al script y exportar**

En `packages/partners/package.json`, agregar ` src/proposal-pieces.test.ts` al final de la lista del script `test` (antes de la comilla de cierre).

Al final de `packages/partners/src/index.ts`:

```ts
export { PROPOSAL_PIECES, getProposalPiece } from "./proposal-pieces";
export type { ProposalPiece, ProposalPieceKind } from "./proposal-pieces";
```

- [ ] **Step 5: Correr la prueba para verificar que pasa**

Run: `pnpm --filter @repo/partners test`
Expected: PASS — los 220 tests previos más los 6 nuevos

- [ ] **Step 6: Commit**

```bash
git add packages/partners/src/proposal-pieces.ts \
        packages/partners/src/proposal-pieces.test.ts \
        packages/partners/src/index.ts \
        packages/partners/package.json
git commit -m "feat(partners): add proposal piece catalog

Nueve piezas —cuatro placas, dos banners y tres franjas— cada una atada a
un placement montado y al fondo de su página pública."
```

---

### Task 2: Medición de contraste y decisión de placa

**Files:**
- Create: `packages/partners/src/proposal-contrast.ts`
- Create: `packages/partners/src/proposal-contrast.test.ts`
- Modify: `packages/partners/package.json`
- Modify: `packages/partners/src/index.ts`

**Interfaces:**
- Consumes: nada
- Produces: `resolvePlateTreatment(input: LogoLuminanceInput): PlateTreatment`, tipos `LogoLuminanceInput` y `PlateTreatment`

**Contexto:** al generar las capturas descubrimos que los logos de clientes suelen venir diseñados para un solo fondo — DVV es blanco sobre transparente y desaparece sobre fondo claro. Esta función decide qué placa ponerle detrás para que se lea siempre.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `packages/partners/src/proposal-contrast.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePlateTreatment } from "./proposal-contrast";

describe("decisión de placa según el logo", () => {
  it("logo claro sobre transparente va en placa oscura", () => {
    // DVV: casi blanco. Sobre fondo claro desaparece.
    const r = resolvePlateTreatment({ meanLuminance: 0.92, hasAlpha: true });
    assert.equal(r.plate, "DARK");
  });

  it("logo oscuro sobre transparente va en placa clara", () => {
    const r = resolvePlateTreatment({ meanLuminance: 0.14, hasAlpha: true });
    assert.equal(r.plate, "LIGHT");
  });

  it("logo de luminancia media va en placa clara por defecto", () => {
    const r = resolvePlateTreatment({ meanLuminance: 0.5, hasAlpha: true });
    assert.equal(r.plate, "LIGHT");
  });

  it("logo sin transparencia trae su propio fondo y no lleva placa", () => {
    const r = resolvePlateTreatment({ meanLuminance: 0.3, hasAlpha: false });
    assert.equal(r.plate, "NONE");
  });

  it("explica el motivo en español", () => {
    const r = resolvePlateTreatment({ meanLuminance: 0.92, hasAlpha: true });
    assert.match(r.reason, /claro/i);
  });

  it("rechaza luminancia fuera de rango", () => {
    assert.throws(() => resolvePlateTreatment({ meanLuminance: 1.4, hasAlpha: true }));
    assert.throws(() => resolvePlateTreatment({ meanLuminance: -0.1, hasAlpha: true }));
  });
});
```

- [ ] **Step 2: Correr la prueba para verificar que falla**

Run: `cd packages/partners && pnpm exec tsx --test src/proposal-contrast.test.ts`
Expected: FAIL — `Cannot find module './proposal-contrast'`

- [ ] **Step 3: Escribir la implementación mínima**

Crear `packages/partners/src/proposal-contrast.ts`:

```ts
/**
 * Decide qué placa poner detrás del logo de un anunciante.
 *
 * Los logos suelen venir diseñados para un solo fondo: uno blanco sobre
 * transparente desaparece en una superficie clara. La placa uniforme resuelve
 * eso y es el patrón habitual de los muros de logos.
 */

import { PartnersDomainError } from "./types";

export type LogoLuminanceInput = {
  /** Luminancia media de los píxeles visibles, de 0 (negro) a 1 (blanco). */
  meanLuminance: number;
  /** Si el archivo tiene canal alfa. Sin él, el logo trae su propio fondo. */
  hasAlpha: boolean;
};

export type PlateKind = "LIGHT" | "DARK" | "NONE";

export type PlateTreatment = {
  plate: PlateKind;
  /** Motivo legible, para mostrar en la interfaz. */
  reason: string;
};

/** Por encima de esto el logo se considera claro y necesita fondo oscuro. */
const LIGHT_LOGO_THRESHOLD = 0.62;

export function resolvePlateTreatment(
  input: LogoLuminanceInput,
): PlateTreatment {
  const { meanLuminance, hasAlpha } = input;

  if (!Number.isFinite(meanLuminance) || meanLuminance < 0 || meanLuminance > 1) {
    throw new PartnersDomainError(
      "VALIDATION",
      "La luminancia debe estar entre 0 y 1.",
    );
  }

  if (!hasAlpha) {
    return {
      plate: "NONE",
      reason: "El logo trae su propio fondo, así que se usa tal cual.",
    };
  }

  if (meanLuminance > LIGHT_LOGO_THRESHOLD) {
    return {
      plate: "DARK",
      reason: "El logo es claro y se perdería sobre fondo blanco.",
    };
  }

  return {
    plate: "LIGHT",
    reason: "El logo es oscuro y se lee bien sobre fondo claro.",
  };
}
```

- [ ] **Step 4: Agregar el test al script y exportar**

En `packages/partners/package.json`, agregar ` src/proposal-contrast.test.ts` a la lista del script `test`.

En `packages/partners/src/index.ts`:

```ts
export { resolvePlateTreatment } from "./proposal-contrast";
export type { LogoLuminanceInput, PlateKind, PlateTreatment } from "./proposal-contrast";
```

- [ ] **Step 5: Correr la prueba para verificar que pasa**

Run: `pnpm --filter @repo/partners test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/partners/src/proposal-contrast.ts \
        packages/partners/src/proposal-contrast.test.ts \
        packages/partners/src/index.ts \
        packages/partners/package.json
git commit -m "feat(partners): decide logo plate from luminance

Un logo claro sobre transparente desaparece en fondo blanco. Esta función
mide su luminancia media y elige placa clara, oscura o ninguna."
```

---

### Task 3: Armado del plan de propuesta

**Files:**
- Create: `packages/partners/src/proposal-plan.ts`
- Create: `packages/partners/src/proposal-plan.test.ts`
- Modify: `packages/partners/package.json`
- Modify: `packages/partners/src/index.ts`

**Interfaces:**
- Consumes: `PROPOSAL_PIECES` y `ProposalPiece` de Task 1; `PlateTreatment` de Task 2
- Produces: `buildProposalPlan(input: ProposalPlanInput): ProposalPlan`, tipos `ProposalPlanInput`, `ProposalPlan`, `ProposalLine`

**Contexto:** las líneas se modelan con `quantity`, `unitPriceMinor` y `selection` desde ahora, aunque esta etapa no use precios. Es lo que permite que el presupuestador futuro llene las columnas sin migrar datos.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `packages/partners/src/proposal-plan.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildProposalPlan } from "./proposal-plan";

const marca = {
  brandName: "Óptica Demostración",
  industry: "Salud visual",
  plate: { plate: "LIGHT" as const, reason: "El logo es oscuro." },
};

describe("armado del plan de propuesta", () => {
  it("genera una línea por cada pieza del catálogo", () => {
    const plan = buildProposalPlan(marca);
    assert.equal(plan.lines.length, 9);
  });

  it("todas las líneas nacen incluidas, con cantidad uno y sin precio", () => {
    const plan = buildProposalPlan(marca);
    for (const line of plan.lines) {
      assert.equal(line.selection, "INCLUDED");
      assert.equal(line.quantity, 1);
      assert.equal(line.unitPriceMinor, null);
      assert.equal(line.currency, null);
      assert.equal(line.kind, "DIGITAL_PLACEMENT");
    }
  });

  it("ordena las líneas por el orden del catálogo", () => {
    const plan = buildProposalPlan(marca);
    const orders = plan.lines.map((l) => l.sortOrder);
    assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
  });

  it("la etiqueta combina pieza y plataforma", () => {
    const plan = buildProposalPlan(marca);
    const primera = plan.lines[0];
    assert.equal(primera.label, "Placa de bienvenida · InfoSpot");
  });

  it("conserva la marca y el tratamiento de placa", () => {
    const plan = buildProposalPlan(marca);
    assert.equal(plan.brandName, "Óptica Demostración");
    assert.equal(plan.plate.plate, "LIGHT");
  });

  it("recorta espacios del nombre y rechaza el vacío", () => {
    assert.equal(buildProposalPlan({ ...marca, brandName: "  Acme  " }).brandName, "Acme");
    assert.throws(() => buildProposalPlan({ ...marca, brandName: "   " }));
  });

  it("permite excluir piezas por id", () => {
    const plan = buildProposalPlan({ ...marca, excludePieceIds: ["clf-banner"] });
    assert.equal(plan.lines.length, 8);
    assert.ok(!plan.lines.some((l) => l.pieceId === "clf-banner"));
  });
});
```

- [ ] **Step 2: Correr la prueba para verificar que falla**

Run: `cd packages/partners && pnpm exec tsx --test src/proposal-plan.test.ts`
Expected: FAIL — `Cannot find module './proposal-plan'`

- [ ] **Step 3: Escribir la implementación mínima**

Crear `packages/partners/src/proposal-plan.ts`:

```ts
/**
 * Arma la lista de líneas de una propuesta comercial.
 *
 * Las líneas llevan `quantity`, `unitPriceMinor`, `currency` y `selection`
 * desde el primer día aunque esta etapa no use precios: es lo que permite que
 * el configurador de patrocinios los complete después sin migrar datos.
 */

import { PROPOSAL_PIECES } from "./proposal-pieces";
import type { PlateTreatment } from "./proposal-contrast";
import { PartnersDomainError } from "./types";

export type ProposalLineKind =
  | "DIGITAL_PLACEMENT"
  | "PHYSICAL"
  | "MERCHANDISING"
  | "MENTION";

export type ProposalLineSelection = "INCLUDED" | "OPTIONAL" | "EXCLUDED";

export type ProposalLine = {
  pieceId: string;
  kind: ProposalLineKind;
  placementKey: string;
  label: string;
  location: string;
  background: string;
  quantity: number;
  /** Nulo en esta etapa. Lo completa el presupuestador. */
  unitPriceMinor: number | null;
  currency: string | null;
  selection: ProposalLineSelection;
  sortOrder: number;
};

export type ProposalPlanInput = {
  brandName: string;
  industry?: string | null;
  plate: PlateTreatment;
  /** Piezas que no van en esta propuesta. */
  excludePieceIds?: readonly string[];
};

export type ProposalPlan = {
  brandName: string;
  industry: string | null;
  plate: PlateTreatment;
  lines: ProposalLine[];
};

export function buildProposalPlan(input: ProposalPlanInput): ProposalPlan {
  const brandName = input.brandName.trim();
  if (!brandName) {
    throw new PartnersDomainError(
      "VALIDATION",
      "Falta el nombre de la marca.",
    );
  }

  const excluded = new Set(input.excludePieceIds ?? []);
  const lines = PROPOSAL_PIECES.filter((p) => !excluded.has(p.id))
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p): ProposalLine => ({
      pieceId: p.id,
      kind: "DIGITAL_PLACEMENT",
      placementKey: p.placementKey,
      label: `${p.label} · ${p.platformLabel}`,
      location: p.location,
      background: p.background,
      quantity: 1,
      unitPriceMinor: null,
      currency: null,
      selection: "INCLUDED",
      sortOrder: p.sortOrder,
    }));

  return {
    brandName,
    industry: input.industry?.trim() || null,
    plate: input.plate,
    lines,
  };
}
```

- [ ] **Step 4: Agregar el test al script y exportar**

En `packages/partners/package.json`, agregar ` src/proposal-plan.test.ts` a la lista del script `test`.

En `packages/partners/src/index.ts`:

```ts
export { buildProposalPlan } from "./proposal-plan";
export type {
  ProposalLine,
  ProposalLineKind,
  ProposalLineSelection,
  ProposalPlan,
  ProposalPlanInput,
} from "./proposal-plan";
```

- [ ] **Step 5: Correr la prueba para verificar que pasa**

Run: `pnpm --filter @repo/partners test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/partners/src/proposal-plan.ts \
        packages/partners/src/proposal-plan.test.ts \
        packages/partners/src/index.ts \
        packages/partners/package.json
git commit -m "feat(partners): build proposal line plan

Una línea por pieza, con cantidad, precio y selección desde el día uno
para que el presupuestador futuro no obligue a migrar datos."
```

---

### Task 4: Fondos y dependencia de PDF

**Files:**
- Create: `apps/clickaton/public/propuesta/backgrounds/bg-clickaton.jpg`
- Create: `apps/clickaton/public/propuesta/backgrounds/bg-fotorank.jpg`
- Create: `apps/clickaton/public/propuesta/backgrounds/bg-infospot.jpg`
- Create: `apps/clickaton/public/propuesta/backgrounds/bg-clf.jpg`
- Modify: `apps/clickaton/package.json`

**Interfaces:**
- Consumes: nada
- Produces: los cuatro fondos servidos en `/propuesta/backgrounds/<archivo>`; `pdf-lib` disponible en Clickatón

**Contexto:** los fondos ya existen en el harness de validación visual. Son capturas de las páginas públicas reales. `pdf-lib` está en FotoRank y ComprameLaFoto pero no en Clickatón.

- [ ] **Step 1: Copiar los fondos**

```bash
mkdir -p apps/clickaton/public/propuesta/backgrounds
cp docs/partners/visual-validation/harness/public/backgrounds/*.jpg \
   apps/clickaton/public/propuesta/backgrounds/
ls -la apps/clickaton/public/propuesta/backgrounds/
```

Expected: cuatro archivos `bg-clickaton.jpg`, `bg-fotorank.jpg`, `bg-infospot.jpg`, `bg-clf.jpg`

- [ ] **Step 2: Agregar pdf-lib a Clickatón**

```bash
pnpm --filter clickaton add pdf-lib@^1.17.1
```

- [ ] **Step 3: Verificar que la instalación no rompió nada**

Run: `pnpm --filter clickaton check-types`
Expected: `✓ Types generated successfully`, sin errores de tsc

- [ ] **Step 4: Verificar que los fondos no quedaron ignorados**

Run: `git check-ignore -q apps/clickaton/public/propuesta/backgrounds/bg-clf.jpg && echo IGNORADO || echo OK`
Expected: `OK`

Si dice `IGNORADO`, la regla `apps/*/public/partners-demo/` del `.gitignore` no debería alcanzar a esta ruta; revisar que no haya otra regla más amplia.

- [ ] **Step 5: Commit**

```bash
git add apps/clickaton/public/propuesta/backgrounds/ \
        apps/clickaton/package.json pnpm-lock.yaml
git commit -m "chore(clickaton): add proposal backgrounds and pdf-lib

Los cuatro fondos son capturas de las páginas públicas, las mismas que usa
el harness de validación visual."
```

---

### Task 5: Composición de piezas con sharp

**Files:**
- Create: `apps/clickaton/lib/propuesta/compose.ts`
- Create: `apps/clickaton/lib/propuesta/compose.test.ts`

**Interfaces:**
- Consumes: `getProposalPiece` de Task 1, `resolvePlateTreatment` de Task 2, los fondos de Task 4
- Produces: `composePiece(input: ComposePieceInput): Promise<Buffer>`, `measureLogo(buffer: Buffer): Promise<LogoLuminanceInput>`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `apps/clickaton/lib/propuesta/compose.test.ts`:

```ts
/**
 * Ejecutar: pnpm --filter clickaton exec tsx lib/propuesta/compose.test.ts
 */
import assert from "node:assert/strict";
import sharp from "sharp";
import { composePiece, measureLogo } from "./compose";

/** Logo sintético: cuadrado de color sólido con alfa. */
async function logoDePrueba(rgb: { r: number; g: number; b: number }) {
  return sharp({
    create: {
      width: 400,
      height: 200,
      channels: 4,
      background: { ...rgb, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

async function main() {
  // measureLogo
  const claro = await measureLogo(await logoDePrueba({ r: 245, g: 245, b: 245 }));
  assert.ok(claro.meanLuminance > 0.9, "un logo casi blanco debe medir alto");
  assert.equal(claro.hasAlpha, true);

  const oscuro = await measureLogo(await logoDePrueba({ r: 20, g: 20, b: 20 }));
  assert.ok(oscuro.meanLuminance < 0.15, "un logo casi negro debe medir bajo");

  // composePiece devuelve un PNG del tamaño pedido
  const png = await composePiece({
    pieceId: "infospot-welcome",
    logo: await logoDePrueba({ r: 30, g: 30, b: 30 }),
    brandName: "Marca de prueba",
    viewport: "desktop",
  });
  const meta = await sharp(png).metadata();
  assert.equal(meta.format, "png");
  assert.equal(meta.width, 1440);
  assert.equal(meta.height, 900);

  const mobile = await composePiece({
    pieceId: "infospot-welcome",
    logo: await logoDePrueba({ r: 30, g: 30, b: 30 }),
    brandName: "Marca de prueba",
    viewport: "mobile",
  });
  const metaMobile = await sharp(mobile).metadata();
  assert.equal(metaMobile.width, 390);
  assert.equal(metaMobile.height, 844);

  // pieza inexistente
  await assert.rejects(
    composePiece({
      pieceId: "no-existe",
      logo: await logoDePrueba({ r: 30, g: 30, b: 30 }),
      brandName: "X",
      viewport: "desktop",
    }),
    /no existe/i,
  );

  console.log("compose: ok");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Correr la prueba para verificar que falla**

Run: `pnpm --filter clickaton exec tsx lib/propuesta/compose.test.ts`
Expected: FAIL — `Cannot find module './compose'`

- [ ] **Step 3: Escribir la implementación mínima**

Crear `apps/clickaton/lib/propuesta/compose.ts`:

```ts
/**
 * Compone una pieza de propuesta: el logo del anunciante sobre el fondo de la
 * página pública que corresponde.
 *
 * Server-only: usa `sharp` y lee del sistema de archivos.
 */
import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  getProposalPiece,
  resolvePlateTreatment,
  type LogoLuminanceInput,
} from "@repo/partners";

export type ProposalViewport = "desktop" | "mobile";

export type ComposePieceInput = {
  pieceId: string;
  logo: Buffer;
  brandName: string;
  viewport: ProposalViewport;
};

const VIEWPORTS: Record<ProposalViewport, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

/** Placa uniforme donde se apoya el logo. */
const PLATE = { width: 520, height: 260, radius: 22, padX: 54, padY: 46 };

const PLATE_FILL = {
  LIGHT: { r: 255, g: 255, b: 255, alpha: 1 },
  DARK: { r: 32, g: 36, b: 38, alpha: 1 },
} as const;

function backgroundsDir(): string {
  return path.join(process.cwd(), "public", "propuesta", "backgrounds");
}

/**
 * Mide la luminancia media de los píxeles visibles del logo.
 * Los píxeles transparentes no cuentan: si contaran, cualquier logo con mucho
 * espacio vacío mediría igual.
 */
export async function measureLogo(buffer: Buffer): Promise<LogoLuminanceInput> {
  const img = sharp(buffer);
  const meta = await img.metadata();
  const hasAlpha = Boolean(meta.hasAlpha);

  const { data, info } = await img
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let suma = 0;
  let visibles = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const alpha = data[i + 3] ?? 255;
    if (alpha < 16) continue;
    // Luminancia perceptual (Rec. 709)
    const lum =
      (0.2126 * (data[i] ?? 0) +
        0.7152 * (data[i + 1] ?? 0) +
        0.0722 * (data[i + 2] ?? 0)) /
      255;
    suma += lum;
    visibles++;
  }

  return {
    meanLuminance: visibles === 0 ? 0.5 : suma / visibles,
    hasAlpha,
  };
}

/** SVG de un rectángulo redondeado, para usar como placa. */
function plateSvg(fill: { r: number; g: number; b: number }): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PLATE.width}" height="${PLATE.height}">` +
      `<rect width="${PLATE.width}" height="${PLATE.height}" rx="${PLATE.radius}" ` +
      `fill="rgb(${fill.r},${fill.g},${fill.b})"/></svg>`,
  );
}

/** Logo centrado sobre su placa, listo para superponer. */
async function buildPlatedLogo(logo: Buffer): Promise<Buffer> {
  const medida = await measureLogo(logo);
  const tratamiento = resolvePlateTreatment(medida);

  const encajado = await sharp(logo)
    .trim()
    .resize({
      width: PLATE.width - PLATE.padX * 2,
      height: PLATE.height - PLATE.padY * 2,
      fit: "inside",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  if (tratamiento.plate === "NONE") return encajado;

  const fill = PLATE_FILL[tratamiento.plate];
  return sharp(plateSvg(fill))
    .composite([{ input: encajado, gravity: "center" }])
    .png()
    .toBuffer();
}

export async function composePiece(input: ComposePieceInput): Promise<Buffer> {
  const piece = getProposalPiece(input.pieceId);
  if (!piece) {
    throw new Error(`La pieza "${input.pieceId}" no existe en el catálogo.`);
  }

  const { width, height } = VIEWPORTS[input.viewport];
  const fondo = await readFile(path.join(backgroundsDir(), piece.background));

  const base = sharp(fondo).resize(width, height, {
    fit: "cover",
    position: "center",
  });

  // Velo oscuro para que la pieza destaque sobre el contenido de la página.
  const velo = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect width="${width}" height="${height}" fill="rgba(8,11,13,0.72)"/></svg>`,
  );

  const plated = await buildPlatedLogo(input.logo);
  const anchoLogo = Math.round(width * (input.viewport === "mobile" ? 0.62 : 0.3));
  const logoEscalado = await sharp(plated)
    .resize({ width: anchoLogo, fit: "inside" })
    .png()
    .toBuffer();

  return base
    .composite([
      { input: velo, top: 0, left: 0 },
      { input: logoEscalado, gravity: "center" },
    ])
    .png()
    .toBuffer();
}
```

- [ ] **Step 4: Correr la prueba para verificar que pasa**

Run: `pnpm --filter clickaton exec tsx lib/propuesta/compose.test.ts`
Expected: `compose: ok`

- [ ] **Step 5: Verificar tipos**

Run: `pnpm --filter clickaton check-types`
Expected: sin errores

- [ ] **Step 6: Commit**

```bash
git add apps/clickaton/lib/propuesta/
git commit -m "feat(clickaton): compose proposal pieces with sharp

Mide la luminancia de los píxeles visibles del logo —ignorando los
transparentes— para elegir la placa, y lo compone sobre el fondo de la
página pública en desktop y mobile."
```

---

### Task 6: Ruta que devuelve una pieza compuesta

**Files:**
- Create: `apps/clickaton/app/api/propuesta/pieza/route.ts`

**Interfaces:**
- Consumes: `composePiece` de Task 5
- Produces: `POST /api/propuesta/pieza` con `multipart/form-data` (`logo`, `pieceId`, `brandName`, `viewport`) → PNG

- [ ] **Step 1: Escribir la implementación**

Crear `apps/clickaton/app/api/propuesta/pieza/route.ts`:

```ts
import { NextResponse } from "next/server";
import { composePiece, type ProposalViewport } from "@/lib/propuesta/compose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tope de subida: un logo razonable no pasa de esto. */
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

const TIPOS_PERMITIDOS = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

/**
 * Compone una pieza con el logo que manda el vendedor.
 * No guarda nada: recibe, compone y devuelve.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "No disponible" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "No se pudo leer el formulario." }, { status: 400 });
  }

  const archivo = form.get("logo");
  const pieceId = String(form.get("pieceId") ?? "").trim();
  const brandName = String(form.get("brandName") ?? "").trim();
  const viewport = String(form.get("viewport") ?? "desktop") as ProposalViewport;

  if (!(archivo instanceof File)) {
    return NextResponse.json({ error: "Falta el logo." }, { status: 400 });
  }
  if (archivo.size > MAX_LOGO_BYTES) {
    return NextResponse.json(
      { error: "El logo pesa más de 5 MB. Probá con uno más liviano." },
      { status: 413 },
    );
  }
  if (!TIPOS_PERMITIDOS.has(archivo.type)) {
    return NextResponse.json(
      { error: "Formato no admitido. Usá PNG, JPG, WEBP o SVG." },
      { status: 415 },
    );
  }
  if (!pieceId) {
    return NextResponse.json({ error: "Falta indicar la pieza." }, { status: 400 });
  }
  if (viewport !== "desktop" && viewport !== "mobile") {
    return NextResponse.json({ error: "Vista inválida." }, { status: 400 });
  }

  try {
    const png = await composePiece({
      pieceId,
      logo: Buffer.from(await archivo.arrayBuffer()),
      brandName,
      viewport,
    });
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "content-type": "image/png",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("[propuesta.pieza]", err);
    return NextResponse.json(
      { error: "No se pudo generar la pieza. Probá con otro archivo." },
      { status: 422 },
    );
  }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `pnpm --filter clickaton check-types`
Expected: sin errores

- [ ] **Step 3: Probar la ruta a mano**

```bash
pnpm --filter clickaton dev &
sleep 12
curl -s -o /tmp/pieza.png -w "%{http_code} %{content_type}\n" \
  -F "logo=@docs/partners/demo-comercial/assets/infospot.png" \
  -F "pieceId=infospot-welcome" \
  -F "brandName=Prueba" \
  -F "viewport=desktop" \
  http://localhost:3005/api/propuesta/pieza
file /tmp/pieza.png
```

Expected: `200 image/png` y `PNG image data, 1440 x 900`

- [ ] **Step 4: Probar los rechazos**

```bash
curl -s -o /dev/null -w "sin logo: %{http_code}\n" \
  -F "pieceId=infospot-welcome" http://localhost:3005/api/propuesta/pieza
curl -s -o /dev/null -w "pieza inexistente: %{http_code}\n" \
  -F "logo=@docs/partners/demo-comercial/assets/infospot.png" \
  -F "pieceId=no-existe" http://localhost:3005/api/propuesta/pieza
```

Expected: `sin logo: 400`, `pieza inexistente: 422`

Detener el servidor: `pkill -f "next dev.*3005"`

- [ ] **Step 5: Commit**

```bash
git add apps/clickaton/app/api/propuesta/
git commit -m "feat(clickaton): add proposal piece endpoint

Recibe el logo, compone la pieza y la devuelve. No guarda nada y responde
404 en producción."
```

---

### Task 7: Pantalla de la propuesta

**Files:**
- Create: `apps/clickaton/app/(public)/propuesta/page.tsx`
- Create: `apps/clickaton/app/(public)/propuesta/ProposalStudio.tsx`

**Interfaces:**
- Consumes: `PROPOSAL_PIECES` de Task 1, la ruta de Task 6
- Produces: la pantalla en `/propuesta`

- [ ] **Step 1: Escribir la página servidor**

Crear `apps/clickaton/app/(public)/propuesta/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PROPOSAL_PIECES } from "@repo/partners";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { ProposalStudio } from "./ProposalStudio";

export const metadata: Metadata = {
  title: "Armar una propuesta · DNX Partners",
  description: "Mostrale a una marca cómo se vería su publicidad en las plataformas DNX.",
  robots: { index: false, follow: false },
};

export default function ProposalPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <Section aria-labelledby="propuesta-title">
      <Container>
        <SectionHeader
          eyebrow="DNX Partners"
          title="Armá una propuesta en un minuto"
          description="Subí el logo del cliente y mirá cómo se vería su marca en las pantallas reales de las cuatro plataformas."
          titleId="propuesta-title"
        />
        <ProposalStudio
          pieces={PROPOSAL_PIECES.map((p) => ({
            id: p.id,
            label: p.label,
            platformLabel: p.platformLabel,
            location: p.location,
          }))}
        />
      </Container>
    </Section>
  );
}
```

- [ ] **Step 2: Escribir el componente cliente**

Crear `apps/clickaton/app/(public)/propuesta/ProposalStudio.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

type PieceSummary = {
  id: string;
  label: string;
  platformLabel: string;
  location: string;
};

type Props = { pieces: PieceSummary[] };

type Viewport = "desktop" | "mobile";

/**
 * Estudio de propuesta: a la izquierda se carga, a la derecha se ve.
 *
 * Cada pieza se pide al servidor cuando hace falta y se guarda en memoria, así
 * cambiar de pieza o de vista no vuelve a componer lo mismo.
 */
export function ProposalStudio({ pieces }: Props) {
  const [logo, setLogo] = useState<File | null>(null);
  const [brandName, setBrandName] = useState("");
  const [industry, setIndustry] = useState("");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [activePiece, setActivePiece] = useState(pieces[0]?.id ?? "");
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlsRef = useRef<string[]>([]);
  const fieldId = useId();

  // Liberar las URLs temporales al desmontar, para no perder memoria.
  useEffect(() => {
    const urls = urlsRef.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  // Cambiar de logo invalida todo lo compuesto antes.
  useEffect(() => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
    setPreviews({});
  }, [logo]);

  const cacheKey = `${activePiece}:${viewport}`;

  const fetchPiece = useCallback(async () => {
    if (!logo || !activePiece) return;
    if (previews[cacheKey]) return;

    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("logo", logo);
      form.set("pieceId", activePiece);
      form.set("brandName", brandName);
      form.set("viewport", viewport);

      const res = await fetch("/api/propuesta/pieza", { method: "POST", body: form });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo generar la vista previa.");
      }
      const url = URL.createObjectURL(await res.blob());
      urlsRef.current.push(url);
      setPreviews((prev) => ({ ...prev, [cacheKey]: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal.");
    } finally {
      setLoading(false);
    }
  }, [logo, activePiece, viewport, brandName, cacheKey, previews]);

  useEffect(() => {
    void fetchPiece();
  }, [fetchPiece]);

  const preview = previews[cacheKey];
  const piece = pieces.find((p) => p.id === activePiece);

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[340px_1fr]">
      {/* ---- columna de carga ---- */}
      <div className="flex flex-col gap-5">
        <Field
          id={`${fieldId}-logo`}
          label="Logo del cliente"
          hint="PNG, JPG, WEBP o SVG. Hasta 5 MB."
        >
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
            className="ck-body-sm w-full"
          />
        </Field>

        <Field id={`${fieldId}-marca`} label="Nombre de la marca" required>
          <Input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
          />
        </Field>

        <Field id={`${fieldId}-rubro`} label="Rubro">
          <Input
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="Gastronomía, indumentaria…"
          />
        </Field>

        <div className="flex flex-col gap-2">
          <span className="ck-label">Pieza</span>
          <ul className="flex flex-col gap-1">
            {pieces.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setActivePiece(p.id)}
                  aria-pressed={p.id === activePiece}
                  className={
                    p.id === activePiece
                      ? "w-full rounded bg-ck-surface-strong px-3 py-2 text-left ck-body-sm"
                      : "w-full rounded px-3 py-2 text-left ck-body-sm text-ck-text-muted"
                  }
                >
                  {p.label} · {p.platformLabel}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ---- columna de vista previa ---- */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="ck-label">Vista previa</span>
          <div className="ml-auto flex gap-1">
            {(["desktop", "mobile"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setViewport(v)}
                aria-pressed={v === viewport}
                className={
                  v === viewport
                    ? "rounded bg-ck-surface-strong px-3 py-1 ck-body-sm"
                    : "rounded px-3 py-1 ck-body-sm text-ck-text-muted"
                }
              >
                {v === "desktop" ? "Escritorio" : "Celular"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-[320px] items-center justify-center rounded border border-ck-border bg-ck-surface-base/40 p-4">
          {!logo ? (
            <p className="ck-body-sm text-ck-text-muted">
              Subí un logo para ver la vista previa.
            </p>
          ) : error ? (
            <p className="ck-body-sm text-ck-text-muted">{error}</p>
          ) : loading && !preview ? (
            <p className="ck-body-sm text-ck-text-muted">Generando…</p>
          ) : preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={`Vista previa: ${piece?.label} en ${piece?.platformLabel}`}
              className="max-h-[560px] w-auto max-w-full object-contain"
            />
          ) : null}
        </div>

        {piece ? (
          <p className="ck-body-sm text-ck-text-secondary">
            <strong>{piece.label} · {piece.platformLabel}.</strong> {piece.location}
          </p>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos**

Run: `pnpm --filter clickaton check-types`
Expected: sin errores

- [ ] **Step 4: Probar la pantalla a mano**

```bash
pnpm --filter clickaton dev
```

Abrir `http://localhost:3005/propuesta` y comprobar:

1. Sin logo, dice «Subí un logo para ver la vista previa».
2. Al subir `docs/partners/demo-comercial/assets/infospot.png`, aparece la placa compuesta.
3. Cambiar entre las nueve piezas de la lista muestra fondos distintos.
4. Cambiar entre Escritorio y Celular cambia la proporción.
5. Volver a una pieza ya vista **no** vuelve a mostrar «Generando…» — está en memoria.

- [ ] **Step 5: Commit**

```bash
git add "apps/clickaton/app/(public)/propuesta/"
git commit -m "feat(clickaton): add proposal studio screen

Pantalla partida: a la izquierda se carga el logo y los datos, a la
derecha se ve la pieza. Cada combinación de pieza y vista se guarda en
memoria para no recomponer lo mismo."
```

---

### Task 8: Armado del PDF

**Files:**
- Create: `apps/clickaton/lib/propuesta/pdf.ts`
- Create: `apps/clickaton/lib/propuesta/pdf.test.ts`

**Interfaces:**
- Consumes: `buildProposalPlan` de Task 3, `composePiece` de Task 5
- Produces: `buildProposalPdf(input: BuildProposalPdfInput): Promise<Uint8Array>`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `apps/clickaton/lib/propuesta/pdf.test.ts`:

```ts
/**
 * Ejecutar: pnpm --filter clickaton exec tsx lib/propuesta/pdf.test.ts
 */
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { buildProposalPdf } from "./pdf";

async function logoDePrueba() {
  return sharp({
    create: { width: 400, height: 200, channels: 4, background: { r: 30, g: 30, b: 30, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

async function main() {
  const bytes = await buildProposalPdf({
    brandName: "Marca de prueba",
    industry: "Gastronomía",
    logo: await logoDePrueba(),
  });

  const doc = await PDFDocument.load(bytes);
  // portada + presentación + 9 piezas + resumen + contratapa
  assert.equal(doc.getPageCount(), 13);

  const first = doc.getPage(0);
  assert.ok(first.getWidth() > first.getHeight(), "la portada es apaisada");

  // con menos piezas, menos páginas
  const recortado = await buildProposalPdf({
    brandName: "Marca de prueba",
    logo: await logoDePrueba(),
    excludePieceIds: ["clf-banner", "clf-marquee"],
  });
  const doc2 = await PDFDocument.load(recortado);
  assert.equal(doc2.getPageCount(), 11);

  await assert.rejects(
    buildProposalPdf({ brandName: "  ", logo: await logoDePrueba() }),
    /nombre de la marca/i,
  );

  console.log("pdf: ok");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Correr la prueba para verificar que falla**

Run: `pnpm --filter clickaton exec tsx lib/propuesta/pdf.test.ts`
Expected: FAIL — `Cannot find module './pdf'`

- [ ] **Step 3: Escribir la implementación mínima**

Crear `apps/clickaton/lib/propuesta/pdf.ts`:

```ts
/**
 * Arma el PDF de la propuesta comercial.
 *
 * El documento se construye recorriendo las líneas del plan: la cantidad de
 * páginas depende de cuántas piezas incluya la propuesta, no de un maquetado
 * fijo. Es lo que permitirá agregar ítems físicos y precios sin rehacerlo.
 */
import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { buildProposalPlan, resolvePlateTreatment } from "@repo/partners";
import { composePiece, measureLogo } from "./compose";

export type BuildProposalPdfInput = {
  brandName: string;
  industry?: string | null;
  logo: Buffer;
  excludePieceIds?: readonly string[];
};

/** A4 apaisado, en puntos. */
const PAGE = { width: 842, height: 595 };
const MARGIN = 48;

const INK = rgb(0.08, 0.09, 0.1);
const MUTED = rgb(0.42, 0.45, 0.47);
const ACCENT = rgb(0.78, 0.06, 0.42);

export async function buildProposalPdf(
  input: BuildProposalPdfInput,
): Promise<Uint8Array> {
  const medida = await measureLogo(input.logo);
  const plan = buildProposalPlan({
    brandName: input.brandName,
    industry: input.industry,
    plate: resolvePlateTreatment(medida),
    excludePieceIds: input.excludePieceIds,
  });

  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  // ---- portada ----
  const portada = doc.addPage([PAGE.width, PAGE.height]);
  portada.drawText("Propuesta comercial", {
    x: MARGIN,
    y: PAGE.height - MARGIN - 40,
    size: 34,
    font: bold,
    color: INK,
  });
  portada.drawText(plan.brandName, {
    x: MARGIN,
    y: PAGE.height - MARGIN - 92,
    size: 46,
    font: bold,
    color: ACCENT,
  });
  if (plan.industry) {
    portada.drawText(plan.industry, {
      x: MARGIN,
      y: PAGE.height - MARGIN - 128,
      size: 16,
      font: regular,
      color: MUTED,
    });
  }
  portada.drawText("DNX Partners", {
    x: MARGIN,
    y: MARGIN,
    size: 13,
    font: bold,
    color: INK,
  });

  // ---- presentación ----
  const intro = doc.addPage([PAGE.width, PAGE.height]);
  intro.drawText("Dónde va a aparecer tu marca", {
    x: MARGIN,
    y: PAGE.height - MARGIN - 30,
    size: 26,
    font: bold,
    color: INK,
  });
  const plataformas = [
    "Clickatón — maratones fotográficas",
    "FotoRank — concursos de fotografía",
    "InfoSpot — cobertura editorial de eventos",
    "ComprameLaFoto — venta de fotografía de eventos",
  ];
  plataformas.forEach((linea, i) => {
    intro.drawText(linea, {
      x: MARGIN,
      y: PAGE.height - MARGIN - 90 - i * 30,
      size: 15,
      font: regular,
      color: MUTED,
    });
  });

  // ---- una página por línea incluida ----
  for (const line of plan.lines) {
    if (line.selection === "EXCLUDED") continue;

    const page = doc.addPage([PAGE.width, PAGE.height]);
    page.drawText(line.label, {
      x: MARGIN,
      y: PAGE.height - MARGIN - 20,
      size: 22,
      font: bold,
      color: INK,
    });
    page.drawText(line.location, {
      x: MARGIN,
      y: PAGE.height - MARGIN - 44,
      size: 12,
      font: regular,
      color: MUTED,
    });

    const png = await composePiece({
      pieceId: line.pieceId,
      logo: input.logo,
      brandName: plan.brandName,
      viewport: "desktop",
    });
    const imagen = await doc.embedPng(png);

    const maxW = PAGE.width - MARGIN * 2;
    const maxH = PAGE.height - MARGIN * 2 - 90;
    const escala = Math.min(maxW / imagen.width, maxH / imagen.height);
    const w = imagen.width * escala;
    const h = imagen.height * escala;

    page.drawImage(imagen, {
      x: (PAGE.width - w) / 2,
      y: MARGIN + 20,
      width: w,
      height: h,
    });
  }

  // ---- resumen ----
  const resumen = doc.addPage([PAGE.width, PAGE.height]);
  resumen.drawText("Qué tenés que entregar", {
    x: MARGIN,
    y: PAGE.height - MARGIN - 30,
    size: 26,
    font: bold,
    color: INK,
  });
  const requisitos = [
    "Logo en PNG o SVG con fondo transparente, ancho mínimo 600 px.",
    "Enlace de destino: sitio web, Instagram o WhatsApp.",
    "Opcional: pieza gráfica cuadrada de 1080 × 1080 px.",
  ];
  requisitos.forEach((linea, i) => {
    resumen.drawText(linea, {
      x: MARGIN,
      y: PAGE.height - MARGIN - 90 - i * 28,
      size: 14,
      font: regular,
      color: MUTED,
    });
  });

  // ---- contratapa ----
  const cierre = doc.addPage([PAGE.width, PAGE.height]);
  cierre.drawText("¿Charlamos?", {
    x: MARGIN,
    y: PAGE.height / 2,
    size: 34,
    font: bold,
    color: INK,
  });
  cierre.drawText("DNX Partners", {
    x: MARGIN,
    y: MARGIN,
    size: 13,
    font: bold,
    color: MUTED,
  });

  return doc.save();
}
```

- [ ] **Step 4: Correr la prueba para verificar que pasa**

Run: `pnpm --filter clickaton exec tsx lib/propuesta/pdf.test.ts`
Expected: `pdf: ok`

- [ ] **Step 5: Verificar tipos**

Run: `pnpm --filter clickaton check-types`
Expected: sin errores

- [ ] **Step 6: Commit**

```bash
git add apps/clickaton/lib/propuesta/pdf.ts apps/clickaton/lib/propuesta/pdf.test.ts
git commit -m "feat(clickaton): build proposal PDF with pdf-lib

El documento se arma recorriendo las líneas del plan, así que la cantidad
de páginas depende de las piezas incluidas y no de un maquetado fijo."
```

---

### Task 9: Ruta de descarga y botón

**Files:**
- Create: `apps/clickaton/app/api/propuesta/pdf/route.ts`
- Modify: `apps/clickaton/app/(public)/propuesta/ProposalStudio.tsx`

**Interfaces:**
- Consumes: `buildProposalPdf` de Task 8
- Produces: `POST /api/propuesta/pdf` → `application/pdf`

- [ ] **Step 1: Escribir la ruta**

Crear `apps/clickaton/app/api/propuesta/pdf/route.ts`:

```ts
import { NextResponse } from "next/server";
import { buildProposalPdf } from "@/lib/propuesta/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const TIPOS_PERMITIDOS = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

/** Nombre de archivo seguro, derivado de la marca. */
function nombreArchivo(brandName: string): string {
  const base = brandName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `propuesta-${base || "dnx-partners"}.pdf`;
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "No disponible" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "No se pudo leer el formulario." }, { status: 400 });
  }

  const archivo = form.get("logo");
  const brandName = String(form.get("brandName") ?? "").trim();
  const industry = String(form.get("industry") ?? "").trim();

  if (!(archivo instanceof File)) {
    return NextResponse.json({ error: "Falta el logo." }, { status: 400 });
  }
  if (archivo.size > MAX_LOGO_BYTES) {
    return NextResponse.json({ error: "El logo pesa más de 5 MB." }, { status: 413 });
  }
  if (!TIPOS_PERMITIDOS.has(archivo.type)) {
    return NextResponse.json(
      { error: "Formato no admitido. Usá PNG, JPG, WEBP o SVG." },
      { status: 415 },
    );
  }
  if (!brandName) {
    return NextResponse.json({ error: "Falta el nombre de la marca." }, { status: 400 });
  }

  try {
    const bytes = await buildProposalPdf({
      brandName,
      industry: industry || null,
      logo: Buffer.from(await archivo.arrayBuffer()),
    });
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${nombreArchivo(brandName)}"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("[propuesta.pdf]", err);
    return NextResponse.json(
      { error: "No se pudo generar el PDF. Probá de nuevo." },
      { status: 422 },
    );
  }
}
```

- [ ] **Step 2: Agregar el botón a la pantalla**

En `apps/clickaton/app/(public)/propuesta/ProposalStudio.tsx`, agregar el estado después de `const [error, setError] = useState<string | null>(null);`:

```tsx
  const [downloading, setDownloading] = useState(false);
```

Agregar esta función después de `fetchPiece`:

```tsx
  const downloadPdf = useCallback(async () => {
    if (!logo || !brandName.trim()) {
      setError("Cargá el logo y el nombre de la marca antes de descargar.");
      return;
    }
    setDownloading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("logo", logo);
      form.set("brandName", brandName);
      form.set("industry", industry);

      const res = await fetch("/api/propuesta/pdf", { method: "POST", body: form });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo generar el PDF.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `propuesta-${brandName.trim().toLowerCase().replace(/\s+/g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal.");
    } finally {
      setDownloading(false);
    }
  }, [logo, brandName, industry]);
```

Agregar el botón al final de la columna de carga, después del bloque `<div className="flex flex-col gap-2">` de la lista de piezas y antes de su `</div>` de cierre de columna:

```tsx
        <Button
          type="button"
          size="lg"
          loading={downloading}
          onClick={() => void downloadPdf()}
          disabled={!logo || !brandName.trim() || downloading}
        >
          {downloading ? "Armando el PDF…" : "Descargar PDF"}
        </Button>
```

- [ ] **Step 3: Verificar tipos**

Run: `pnpm --filter clickaton check-types`
Expected: sin errores

- [ ] **Step 4: Probar la descarga a mano**

```bash
pnpm --filter clickaton dev &
sleep 12
curl -s -o /tmp/propuesta.pdf -w "%{http_code} %{content_type}\n" \
  -F "logo=@docs/partners/demo-comercial/assets/infospot.png" \
  -F "brandName=Marca de prueba" \
  -F "industry=Gastronomia" \
  http://localhost:3005/api/propuesta/pdf
file /tmp/propuesta.pdf
```

Expected: `200 application/pdf` y `PDF document`

Después abrir `http://localhost:3005/propuesta`, subir un logo, escribir un nombre y comprobar que el botón descarga el archivo. Sin nombre, el botón está deshabilitado.

Detener el servidor: `pkill -f "next dev.*3005"`

- [ ] **Step 5: Commit**

```bash
git add apps/clickaton/app/api/propuesta/pdf/ \
        "apps/clickaton/app/(public)/propuesta/ProposalStudio.tsx"
git commit -m "feat(clickaton): add proposal PDF download

El botón queda deshabilitado hasta que haya logo y nombre de marca. El
archivo se nombra a partir de la marca, sin acentos ni espacios."
```

---

### Task 10: Cierre — verificación completa y documentación

**Files:**
- Create: `docs/partners/propuestas/README.md`

**Interfaces:**
- Consumes: todo lo anterior
- Produces: documentación de uso

- [ ] **Step 1: Correr todas las pruebas**

```bash
pnpm --filter @repo/partners test
pnpm --filter clickaton exec tsx lib/propuesta/compose.test.ts
pnpm --filter clickaton exec tsx lib/propuesta/pdf.test.ts
pnpm --filter clickaton check-types
```

Expected: `@repo/partners` pasa con 220 + los nuevos; los dos scripts imprimen `ok`; tipos sin errores.

- [ ] **Step 2: Escribir la documentación**

Crear `docs/partners/propuestas/README.md`:

```markdown
# Generador de propuestas — etapas 1 y 2

Pantalla en `/propuesta` (Clickatón, puerto 3005) donde un vendedor sube el logo
de un cliente y obtiene las nueve piezas publicitarias y un PDF descargable.

**No usa base de datos.** Nada se guarda: se sube, se compone y se devuelve.

## Cómo se usa

```bash
pnpm --filter clickaton dev
# abrir http://localhost:3005/propuesta
```

1. Subir el logo del cliente (PNG, JPG, WEBP o SVG, hasta 5 MB).
2. Escribir el nombre de la marca y el rubro.
3. Recorrer las nueve piezas y alternar entre escritorio y celular.
4. Descargar el PDF.

En producción la pantalla y las dos rutas responden 404.

## Cómo está armado

| Capa | Dónde | Qué hace |
|---|---|---|
| Catálogo de piezas | `packages/partners/src/proposal-pieces.ts` | Las nueve piezas y su fondo |
| Decisión de placa | `packages/partners/src/proposal-contrast.ts` | Mide el logo y elige placa clara u oscura |
| Plan de líneas | `packages/partners/src/proposal-plan.ts` | Arma la lista de la propuesta |
| Composición | `apps/clickaton/lib/propuesta/compose.ts` | Superpone logo y fondo con sharp |
| PDF | `apps/clickaton/lib/propuesta/pdf.ts` | Arma el documento con pdf-lib |
| Pantalla | `apps/clickaton/app/(public)/propuesta/` | Formulario y vista previa |

## Por qué el logo va sobre una placa

Los logos suelen venir diseñados para un solo fondo. Uno blanco sobre
transparente desaparece en una superficie clara. `resolvePlateTreatment` mide la
luminancia media de los píxeles visibles —ignorando los transparentes— y elige
placa clara, oscura o ninguna.

## Qué falta

Etapas 3 a 5 del spec: guardar la propuesta con su código, búsqueda de sponsors
existentes, alta y actualización de imágenes. Ver
`docs/superpowers/specs/2026-08-22-generador-propuestas-sponsors-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/partners/propuestas/
git commit -m "docs(partners): document proposal generator stages 1-2"
```

- [ ] **Step 4: Publicar la rama**

```bash
git push
```

Expected: la rama `feat/partners-demo-comercial-e2` queda sincronizada con `origin`.

---

## Qué queda fuera de este plan

Del spec, las etapas 3 a 5:

- **Persistencia:** tablas `DnxPartnerProposal` y `DnxPartnerProposalItem`, código recuperable, vencimiento a 30 días y limpieza diaria.
- **Capa autenticada:** búsqueda de sponsors con detección de duplicados, alta como `PROSPECT` con assets en `PENDING`, actualización de imágenes.
- **Listado y control:** panel de propuestas generadas y conversión.

**Límite de uso:** el spec pide un tope por navegador y por hora para el link
público. No entra en este plan porque la pantalla y sus dos rutas responden 404
en producción: sin exposición pública no hay abuso posible. El límite se agrega
en la etapa 3, junto con la persistencia y la apertura del link.

También queda pendiente la prueba de comparación entre la vista previa y el PDF
que menciona el spec como mitigación del riesgo de divergencia: mientras ambas
salidas se generen con `composePiece`, la divergencia no puede ocurrir. Se vuelve
necesaria si alguna vez la vista previa pasa a dibujarse en el navegador sin
pedirle la imagen al servidor.
