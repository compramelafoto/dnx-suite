# Mapa de inventario de DNX Partners — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Desvío aplicado en la Task 1:** el espacio del portal es un banner, no una
> placa modal. FotoOffice está excluido de activaciones destacadas. Ver el spec.

**Goal:** Que el código pueda responder "¿qué espacios publicitarios puede ofrecer este vendedor?", con el dueño, la audiencia, si está montado y si se paga o se canjea.

**Architecture:** El catálogo técnico `AD_PLACEMENT_CATALOG` (`packages/partners/src/campaigns.ts`) sigue siendo la única lista de espacios y suma los cinco de FotoOffice. Un archivo nuevo, `packages/partners/src/inventory.ts`, lo decora con cuatro columnas comerciales tomadas de una tabla de consulta tipada como `Record<DnxPartnerAdPlacementKey, …>`, lo que hace que agregar un espacio sin decidir quién lo vende no compile. Sobre eso se apoya una sola función, `listSellableSpaces`.

**Tech Stack:** TypeScript, `node:test` vía `tsx --test`, monorepo pnpm.

**Spec:** `docs/superpowers/specs/2026-08-27-mapa-inventario-partners-design.md`

## Global Constraints

- **Sin base de datos.** Ninguna tarea importa `prisma` ni `@repo/db`. No se agregan tablas ni migraciones.
- **Sin tocar el esquema Prisma.** Los cinco espacios de FotoOffice usan valores de `DnxPartnerPlacement` que ya existen.
- **Idioma:** comentarios y textos en español rioplatense. Las claves de espacio, los nombres de tipos y las funciones quedan en inglés, como el resto del paquete.
- **Tests:** `node:test` con `import assert from "node:assert/strict"` e `import { describe, it } from "node:test"`. Todo archivo nuevo de test se agrega a la lista explícita del script `test` en `packages/partners/package.json`.
- **Las 191 pruebas actuales de `@repo/partners` deben seguir pasando** después de cada commit.
- **Rama:** `feat/partners-inventory-map`, worktree `dnx-suite-wt-inventario`.
- **No se toca el generador de propuestas.** Vive en otra rama.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `packages/partners/src/campaigns.ts` | Catálogo técnico. Se le suman las 5 claves de FotoOffice y sus entradas |
| `packages/partners/src/inventory.ts` | **Nuevo.** Columnas comerciales y `listSellableSpaces` |
| `packages/partners/src/partners-inventory.test.ts` | **Nuevo.** Pruebas del mapa |
| `packages/partners/src/partners-campaigns.test.ts` | Se le suma un bloque para FotoOffice |
| `packages/partners/src/index.ts` | Exporta lo nuevo |
| `packages/partners/package.json` | Suma el test nuevo a la lista |
| `docs/partners/inventario.md` | **Nuevo.** La tabla completa, legible |

---

### Task 1: Los cinco espacios de FotoOffice en el catálogo técnico

**Files:**
- Modify: `packages/partners/src/campaigns.ts`
- Test: `packages/partners/src/partners-campaigns.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: `FOTOFFICE_AD_PLACEMENT_KEYS`, tipo `FotofficeAdPlacementKey`, y cinco entradas nuevas en `AD_PLACEMENT_CATALOG`. El tipo `DnxPartnerAdPlacementKey` pasa a incluir las claves de FotoOffice.

- [ ] **Step 1: Escribir la prueba que falla**

Agregar al final de `packages/partners/src/partners-campaigns.test.ts`:

```ts
describe("espacios de FotoOffice en el catálogo", () => {
  it("declara las cinco claves del workspace", () => {
    assert.deepEqual([...FOTOFFICE_AD_PLACEMENT_KEYS], [
      "FOTOFFICE_PORTAL_BANNER",
      "FOTOFFICE_BENEFITS_MARQUEE",
      "FOTOFFICE_BENEFIT_CARD",
      "FOTOFFICE_RAFFLE_SPONSOR",
      "FOTOFFICE_PUBLIC_MARQUEE",
    ]);
  });

  it("cada clave tiene su entrada en el catálogo, bajo FOTO_OFFICE", () => {
    for (const key of FOTOFFICE_AD_PLACEMENT_KEYS) {
      const entry = AD_PLACEMENT_CATALOG.find((e) => e.placementKey === key);
      assert.ok(entry, `falta la entrada de ${key}`);
      assert.equal(entry.application, "FOTO_OFFICE");
    }
  });

  it("ninguno viene encendido por defecto", () => {
    for (const key of FOTOFFICE_AD_PLACEMENT_KEYS) {
      const entry = AD_PLACEMENT_CATALOG.find((e) => e.placementKey === key);
      assert.equal(entry?.isActiveDefault, false);
    }
  });

  it("el catálogo pasa a tener veintiocho espacios", () => {
    assert.equal(AD_PLACEMENT_CATALOG.length, 28);
  });
});
```

Agregar `FOTOFFICE_AD_PLACEMENT_KEYS` al `import` que el archivo ya hace de `./campaigns`. Si el archivo todavía no importa `AD_PLACEMENT_CATALOG`, sumarlo también.

- [ ] **Step 2: Correr la prueba para verificar que falla**

Run: `cd packages/partners && pnpm exec tsx --test src/partners-campaigns.test.ts`
Expected: FAIL — `FOTOFFICE_AD_PLACEMENT_KEYS` no existe.

- [ ] **Step 3: Escribir la implementación mínima**

En `packages/partners/src/campaigns.ts`, después de `FOTORANK_AD_PLACEMENT_KEYS`:

```ts
/** Superficies FotoOffice (declaradas; el subproyecto 2 del portal las monta). */
export const FOTOFFICE_AD_PLACEMENT_KEYS = [
  "FOTOFFICE_PORTAL_BANNER",
  "FOTOFFICE_BENEFITS_MARQUEE",
  "FOTOFFICE_BENEFIT_CARD",
  "FOTOFFICE_RAFFLE_SPONSOR",
  "FOTOFFICE_PUBLIC_MARQUEE",
] as const;
```

Agregar el alias de tipo junto a los otros cuatro:

```ts
export type FotofficeAdPlacementKey = (typeof FOTOFFICE_AD_PLACEMENT_KEYS)[number];
```

y sumarlo a la unión:

```ts
export type DnxPartnerAdPlacementKey =
  | InfospotAdPlacementKey
  | ClfAdPlacementKey
  | ClickatonAdPlacementKey
  | FotorankAdPlacementKey
  | FotofficeAdPlacementKey;
```

Agregar las cinco entradas al final de `AD_PLACEMENT_CATALOG`:

```ts
  {
    application: "FOTO_OFFICE",
    placementKey: "FOTOFFICE_PORTAL_BANNER",
    name: "Activación destacada (portal del socio)",
    description: "Placa al entrar al portal. Declarada: el portal todavía no la monta.",
    allowedFormats: ["WELCOME_INTERSTITIAL", "STORY_VERTICAL", "SQUARE"],
    deviceSupport: "ALL",
    maxItems: 1,
    rotationMode: "STATIC",
    trackingPlacement: "WELCOME",
    isActiveDefault: false,
  },
  {
    application: "FOTO_OFFICE",
    placementKey: "FOTOFFICE_BENEFITS_MARQUEE",
    name: "Franja de logos (beneficios)",
    description: "Aliados que dan beneficios a los socios. Espacio de canje, no de venta.",
    allowedFormats: ["LOGO", "LOGO_MARQUEE"],
    deviceSupport: "ALL",
    maxItems: 12,
    rotationMode: "MARQUEE",
    trackingPlacement: "LOGO_MARQUEE",
    isActiveDefault: false,
  },
  {
    application: "FOTO_OFFICE",
    placementKey: "FOTOFFICE_BENEFIT_CARD",
    name: "Ficha del beneficio",
    description: "Logo, descuento y cómo se usa, dentro del listado de beneficios.",
    allowedFormats: ["CARD_PROMO", "LOGO", "SQUARE"],
    deviceSupport: "ALL",
    maxItems: 1,
    rotationMode: "STATIC",
    trackingPlacement: "BENEFIT",
    isActiveDefault: false,
  },
  {
    application: "FOTO_OFFICE",
    placementKey: "FOTOFFICE_RAFFLE_SPONSOR",
    name: "Auspicio del sorteo mensual",
    description: "Quien pone el premio o paga el auspicio. Admite las dos vías.",
    allowedFormats: ["LOGO", "CARD_PROMO", "SQUARE"],
    deviceSupport: "ALL",
    maxItems: 3,
    rotationMode: "STATIC",
    trackingPlacement: "SPONSOR_SECTION",
    isActiveDefault: false,
  },
  {
    application: "FOTO_OFFICE",
    placementKey: "FOTOFFICE_PUBLIC_MARQUEE",
    name: "Franja de logos (sitio público)",
    description: "Portada pública del workspace. La ve cualquiera, no solo los socios.",
    allowedFormats: ["LOGO", "LOGO_MARQUEE"],
    deviceSupport: "ALL",
    maxItems: 12,
    rotationMode: "MARQUEE",
    trackingPlacement: "LOGO_MARQUEE",
    isActiveDefault: false,
  },
```

- [ ] **Step 4: Correr las pruebas del paquete completo**

Run: `cd packages/partners && pnpm test`
Expected: PASS — las 191 anteriores más las 4 nuevas. Si alguna prueba vieja falla porque fijaba el largo del catálogo en 23, actualizar ese número a 28 y **no** tocar nada más.

- [ ] **Step 5: Verificar tipos**

Run: `cd packages/partners && pnpm exec tsc --noEmit -p tsconfig.json`
Expected: sin errores. Si algún `switch` exhaustivo sobre `DnxPartnerAdPlacementKey` deja de compilar, agregarle los casos de FotoOffice devolviendo el mismo valor que usan los espacios equivalentes de otras aplicaciones.

- [ ] **Step 6: Commit**

```bash
git add packages/partners/src/campaigns.ts packages/partners/src/partners-campaigns.test.ts
git commit -m "feat(partners): declare the five FotoOffice ad placements"
```

---

### Task 2: El mapa comercial y `listSellableSpaces`

**Files:**
- Create: `packages/partners/src/inventory.ts`
- Create: `packages/partners/src/partners-inventory.test.ts`
- Modify: `packages/partners/src/index.ts`
- Modify: `packages/partners/package.json`

**Interfaces:**
- Consumes: `AD_PLACEMENT_CATALOG`, `AdPlacementCatalogEntry`, `DnxPartnerAdPlacementKey` de `./campaigns`; `DnxPartnerApplication` y `DnxPartnerAudienceType` de `./types`
- Produces: `DNX_INVENTORY_OWNERS`, `DnxInventoryOwner`, `DNX_INVENTORY_ACCESS_MODES`, `DnxInventoryAccess`, `DnxInventorySpace`, `DNX_INVENTORY`, `SellerScope`, `listSellableSpaces(seller: SellerScope): readonly DnxInventorySpace[]`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `packages/partners/src/partners-inventory.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AD_PLACEMENT_CATALOG } from "./campaigns";
import { DNX_INVENTORY, listSellableSpaces } from "./inventory";

describe("mapa de inventario", () => {
  it("cubre exactamente el catálogo técnico, sin sobrantes ni faltantes", () => {
    const catalogo = AD_PLACEMENT_CATALOG.map((e) => e.placementKey).sort();
    const mapa = DNX_INVENTORY.map((e) => e.placementKey).sort();
    assert.deepEqual(mapa, catalogo);
  });

  it("cada espacio declara dueño, audiencia, montaje y acceso", () => {
    for (const espacio of DNX_INVENTORY) {
      assert.ok(["PLATFORM", "ORGANIZER", "WORKSPACE"].includes(espacio.owner));
      assert.ok(["SALE", "EXCHANGE", "BOTH"].includes(espacio.access));
      assert.equal(typeof espacio.mounted, "boolean");
      assert.ok(espacio.audience.length > 0);
    }
  });

  it("hay doce espacios montados y dieciséis sin montar", () => {
    const montados = DNX_INVENTORY.filter((e) => e.mounted);
    assert.equal(montados.length, 12);
    assert.equal(DNX_INVENTORY.length - montados.length, 16);
  });

  it("el concurso de FotoRank es del organizador y la portada de la plataforma", () => {
    const buscar = (k: string) => DNX_INVENTORY.find((e) => e.placementKey === k);
    assert.equal(buscar("FOTORANK_CONTEST_WELCOME")?.owner, "ORGANIZER");
    assert.equal(buscar("FOTORANK_HOME_WELCOME")?.owner, "PLATFORM");
  });

  it("el orden es estable: por aplicación y después por clave", () => {
    const dos = [DNX_INVENTORY, DNX_INVENTORY].map((l) => l.map((e) => e.placementKey));
    assert.deepEqual(dos[0], dos[1]);
    const claves = DNX_INVENTORY.map((e) => `${e.application}|${e.placementKey}`);
    assert.deepEqual(claves, [...claves].sort());
  });
});

describe("listSellableSpaces", () => {
  it("un organizador de FotoRank ve su concurso y no la portada", () => {
    const espacios = listSellableSpaces({ owner: "ORGANIZER", application: "FOTO_RANK" });
    const claves = espacios.map((e) => e.placementKey);
    assert.deepEqual(claves, ["FOTORANK_CONTEST_WELCOME"]);
  });

  it("DNX ve toda la red montada y nada de otros dueños", () => {
    const espacios = listSellableSpaces({ owner: "PLATFORM" });
    assert.ok(espacios.length >= 11);
    assert.ok(espacios.every((e) => e.owner === "PLATFORM"));
    assert.ok(espacios.every((e) => e.mounted));
  });

  it("un workspace no ve nada montado todavía, pero sí lo declarado", () => {
    assert.deepEqual(listSellableSpaces({ owner: "WORKSPACE" }), []);
    const declarados = listSellableSpaces({ owner: "WORKSPACE", includeUnmounted: true });
    assert.equal(declarados.length, 5);
    assert.ok(declarados.every((e) => e.application === "FOTO_OFFICE"));
  });

  it("pedir canje trae los de canje y los de ambas vías", () => {
    const canje = listSellableSpaces({
      owner: "WORKSPACE",
      access: "EXCHANGE",
      includeUnmounted: true,
    }).map((e) => e.placementKey);
    assert.deepEqual(canje.sort(), [
      "FOTOFFICE_BENEFITS_MARQUEE",
      "FOTOFFICE_BENEFIT_CARD",
      "FOTOFFICE_RAFFLE_SPONSOR",
    ].sort());
  });

  it("pedir venta trae los de venta y los de ambas vías", () => {
    const venta = listSellableSpaces({
      owner: "WORKSPACE",
      access: "SALE",
      includeUnmounted: true,
    }).map((e) => e.placementKey);
    assert.deepEqual(venta.sort(), [
      "FOTOFFICE_PORTAL_BANNER",
      "FOTOFFICE_PUBLIC_MARQUEE",
      "FOTOFFICE_RAFFLE_SPONSOR",
    ].sort());
  });

  it("filtrar por aplicación no cruza plataformas", () => {
    const espacios = listSellableSpaces({ owner: "PLATFORM", application: "INFO_SPOT" });
    assert.ok(espacios.every((e) => e.application === "INFO_SPOT"));
  });
});
```

- [ ] **Step 2: Correr la prueba para verificar que falla**

Run: `cd packages/partners && pnpm exec tsx --test src/partners-inventory.test.ts`
Expected: FAIL — `Cannot find module './inventory'`

- [ ] **Step 3: Escribir la implementación**

Crear `packages/partners/src/inventory.ts`:

```ts
/**
 * Mapa comercial del inventario publicitario.
 *
 * `campaigns.ts` dice cómo se dibuja cada espacio. Este archivo dice quién puede
 * venderlo, quién lo ve, si el código lo renderiza hoy y si se paga o se canjea.
 *
 * No copia la lista de espacios: la deriva de `AD_PLACEMENT_CATALOG`. La tabla de
 * abajo está tipada como `Record<DnxPartnerAdPlacementKey, …>`, así que agregar un
 * espacio al catálogo sin decidir quién lo vende no compila.
 */
import {
  AD_PLACEMENT_CATALOG,
  type AdPlacementCatalogEntry,
  type DnxPartnerAdPlacementKey,
} from "./campaigns";
import type { DnxPartnerApplication, DnxPartnerAudienceType } from "./types";

/** Quién tiene derecho a vender un espacio. */
export const DNX_INVENTORY_OWNERS = ["PLATFORM", "ORGANIZER", "WORKSPACE"] as const;
export type DnxInventoryOwner = (typeof DNX_INVENTORY_OWNERS)[number];

/**
 * Cómo accede un partner al espacio.
 * `SALE`: paga. `EXCHANGE`: da beneficios a los socios en vez de plata.
 * `BOTH`: admite cualquiera de las dos.
 */
export const DNX_INVENTORY_ACCESS_MODES = ["SALE", "EXCHANGE", "BOTH"] as const;
export type DnxInventoryAccess = (typeof DNX_INVENTORY_ACCESS_MODES)[number];

type CommercialRow = {
  owner: DnxInventoryOwner;
  audience: DnxPartnerAudienceType;
  /** true solo si hay código que lo renderiza hoy. Auditado el 2026-08-27. */
  mounted: boolean;
  access: DnxInventoryAccess;
};

const PLATFORM_PUBLIC: CommercialRow = {
  owner: "PLATFORM",
  audience: "ALL_USERS",
  mounted: true,
  access: "SALE",
};

const COMMERCIAL_ROWS: Record<DnxPartnerAdPlacementKey, CommercialRow> = {
  // InfoSpot — es un medio: todo es de la plataforma.
  INFOSPOT_HOME_WELCOME: PLATFORM_PUBLIC,
  INFOSPOT_HOME_TOP: PLATFORM_PUBLIC,
  INFOSPOT_HOME_INLINE: PLATFORM_PUBLIC,
  INFOSPOT_HOME_MARQUEE: PLATFORM_PUBLIC,
  INFOSPOT_ARTICLE_TOP: { ...PLATFORM_PUBLIC, mounted: false },
  INFOSPOT_ARTICLE_INLINE: { ...PLATFORM_PUBLIC, mounted: false },
  INFOSPOT_ARTICLE_BOTTOM: { ...PLATFORM_PUBLIC, mounted: false },
  INFOSPOT_GALLERY_INLINE: { ...PLATFORM_PUBLIC, mounted: false },
  INFOSPOT_FLOATING: { ...PLATFORM_PUBLIC, mounted: false },
  INFOSPOT_EVENT_PAGE: {
    ...PLATFORM_PUBLIC,
    audience: "EVENT_PARTICIPANTS",
    mounted: false,
  },

  // Clickatón — el equipo organiza sus propias maratones.
  CLICKATON_HOME_WELCOME: PLATFORM_PUBLIC,
  CLICKATON_EVENT_WELCOME: { ...PLATFORM_PUBLIC, audience: "EVENT_PARTICIPANTS" },

  // FotoRank — la portada es de la plataforma; el concurso, del organizador.
  FOTORANK_HOME_WELCOME: PLATFORM_PUBLIC,
  FOTORANK_CONTEST_WELCOME: {
    owner: "ORGANIZER",
    audience: "EVENT_PARTICIPANTS",
    mounted: true,
    access: "SALE",
  },

  // ComprameLaFoto — hoy no hay vendedor intermedio.
  CLF_HOME_WELCOME: PLATFORM_PUBLIC,
  CLF_HOME_PROMO: PLATFORM_PUBLIC,
  CLF_LOGO_MARQUEE: PLATFORM_PUBLIC,
  CLF_ALBUM_WELCOME: { ...PLATFORM_PUBLIC, audience: "EVENT_PARTICIPANTS" },
  CLF_GALLERY_TOP: {
    ...PLATFORM_PUBLIC,
    audience: "EVENT_PARTICIPANTS",
    mounted: false,
  },
  CLF_GALLERY_INLINE: {
    ...PLATFORM_PUBLIC,
    audience: "EVENT_PARTICIPANTS",
    mounted: false,
  },
  CLF_PHOTO_DETAIL_BELOW: {
    ...PLATFORM_PUBLIC,
    audience: "EVENT_PARTICIPANTS",
    mounted: false,
  },
  CLF_EVENT_PAGE: {
    ...PLATFORM_PUBLIC,
    audience: "EVENT_PARTICIPANTS",
    mounted: false,
  },
  CLF_CHECKOUT_SUPPORTING: {
    ...PLATFORM_PUBLIC,
    audience: "PRODUCT_PURCHASERS",
    mounted: false,
  },

  // FotoOffice — la institución consigue sus propios sponsors. Nada montado.
  FOTOFFICE_PORTAL_BANNER: {
    owner: "WORKSPACE",
    audience: "MEMBERSHIP_HOLDERS",
    mounted: false,
    access: "SALE",
  },
  FOTOFFICE_BENEFITS_MARQUEE: {
    owner: "WORKSPACE",
    audience: "MEMBERSHIP_HOLDERS",
    mounted: false,
    access: "EXCHANGE",
  },
  FOTOFFICE_BENEFIT_CARD: {
    owner: "WORKSPACE",
    audience: "MEMBERSHIP_HOLDERS",
    mounted: false,
    access: "EXCHANGE",
  },
  FOTOFFICE_RAFFLE_SPONSOR: {
    owner: "WORKSPACE",
    audience: "MEMBERSHIP_HOLDERS",
    mounted: false,
    access: "BOTH",
  },
  FOTOFFICE_PUBLIC_MARQUEE: {
    owner: "WORKSPACE",
    audience: "ALL_USERS",
    mounted: false,
    access: "SALE",
  },
};

export type DnxInventorySpace = AdPlacementCatalogEntry & CommercialRow;

/** Orden estable: por aplicación y después por clave. */
export const DNX_INVENTORY: readonly DnxInventorySpace[] = AD_PLACEMENT_CATALOG.map(
  (entry) => ({ ...entry, ...COMMERCIAL_ROWS[entry.placementKey] }),
).sort((a, b) => {
  // Comparación cruda, no `localeCompare`: el orden tiene que ser idéntico al de
  // `Array.prototype.sort` por defecto, que es contra lo que compara la prueba.
  const ka = `${a.application}|${a.placementKey}`;
  const kb = `${b.application}|${b.placementKey}`;
  if (ka < kb) return -1;
  if (ka > kb) return 1;
  return 0;
});

export type SellerScope = {
  owner: DnxInventoryOwner;
  /** Limita a una aplicación. Sin esto, devuelve todas las del dueño. */
  application?: DnxPartnerApplication;
  /** Vía de acceso buscada. Los espacios `BOTH` entran siempre. */
  access?: DnxInventoryAccess;
  /** Incluir lo declarado pero todavía no montado. Por defecto, no. */
  includeUnmounted?: boolean;
};

/**
 * Los espacios que ese vendedor puede ofrecer.
 *
 * Sin `includeUnmounted`, lo no montado queda afuera: es lo que impide
 * prometerle a una marca un lugar donde su logo nunca aparecería.
 */
export function listSellableSpaces(seller: SellerScope): readonly DnxInventorySpace[] {
  return DNX_INVENTORY.filter((space) => {
    if (space.owner !== seller.owner) return false;
    if (seller.application && space.application !== seller.application) return false;
    if (!seller.includeUnmounted && !space.mounted) return false;
    if (seller.access && seller.access !== "BOTH") {
      if (space.access !== seller.access && space.access !== "BOTH") return false;
    }
    return true;
  });
}
```

- [ ] **Step 4: Correr la prueba nueva**

Run: `cd packages/partners && pnpm exec tsx --test src/partners-inventory.test.ts`
Expected: PASS, 11 pruebas.

- [ ] **Step 5: Exportar desde el índice**

Agregar al final de `packages/partners/src/index.ts`:

```ts
export {
  DNX_INVENTORY,
  DNX_INVENTORY_OWNERS,
  DNX_INVENTORY_ACCESS_MODES,
  listSellableSpaces,
} from "./inventory";
export type {
  DnxInventoryOwner,
  DnxInventoryAccess,
  DnxInventorySpace,
  SellerScope,
} from "./inventory";
```

Y sumar `FOTOFFICE_AD_PLACEMENT_KEYS` al bloque que ya exporta las otras cuatro listas de claves desde `./campaigns`.

- [ ] **Step 6: Sumar el test a la lista del paquete**

En `packages/partners/package.json`, agregar `src/partners-inventory.test.ts` al final de la lista de archivos del script `test`.

- [ ] **Step 7: Correr todo y verificar tipos**

Run: `cd packages/partners && pnpm test && pnpm exec tsc --noEmit -p tsconfig.json`
Expected: PASS — 195 anteriores más 11 nuevas, sin errores de tipos.

- [ ] **Step 8: Commit**

```bash
git add packages/partners/src/inventory.ts packages/partners/src/partners-inventory.test.ts packages/partners/src/index.ts packages/partners/package.json
git commit -m "feat(partners): map who may sell each ad space"
```

---

### Task 3: La foto del inventario, legible

**Files:**
- Create: `docs/partners/inventario.md`

**Interfaces:**
- Consumes: `DNX_INVENTORY` de la Task 2
- Produces: nada de código

- [ ] **Step 1: Generar la tabla desde el código, no a mano**

Run desde `packages/partners`:

```bash
pnpm exec tsx -e '
import { DNX_INVENTORY } from "./src/inventory";
const f = (b: boolean) => (b ? "Montado" : "Declarado");
for (const e of DNX_INVENTORY) {
  console.log(`| \`${e.placementKey}\` | ${e.name} | ${e.owner} | ${e.audience} | ${e.access} | ${f(e.mounted)} |`);
}'
```

Copiar la salida al documento. Generarla en vez de escribirla evita que la tabla mienta.

- [ ] **Step 2: Escribir el documento**

Crear `docs/partners/inventario.md` con esta estructura:

```markdown
# Inventario publicitario de DNX Partners

Qué espacios existen, quién puede venderlos, quién los ve y cuáles están
realmente montados. Generado desde `packages/partners/src/inventory.ts`.

## Cómo leerlo

| Columna | Qué dice |
|---|---|
| Dueño | `PLATFORM` (DNX), `ORGANIZER` (el del concurso), `WORKSPACE` (la institución) |
| Audiencia | Quién lo ve |
| Acceso | `SALE` se paga · `EXCHANGE` se canjea por beneficios a los socios · `BOTH` las dos |
| Estado | `Montado` = hay código que lo dibuja · `Declarado` = todavía no existe |

## Los espacios

| Clave | Nombre | Dueño | Audiencia | Acceso | Estado |
|---|---|---|---|---|---|
<!-- salida del Step 1 -->

## Los declarados y no montados

Once espacios del catálogo no tienen una sola referencia en el código que los
renderice, y los cinco de FotoOffice todavía no existen. No se borran: varios son
intención real de producto. Quedan marcados para que el generador de propuestas
no los ofrezca.

## Diseño

`docs/superpowers/specs/2026-08-27-mapa-inventario-partners-design.md`
```

- [ ] **Step 3: Verificar que la cuenta del documento coincide con el código**

Run: `cd packages/partners && pnpm exec tsx -e 'import { DNX_INVENTORY } from "./src/inventory"; console.log(DNX_INVENTORY.length, DNX_INVENTORY.filter((e) => e.mounted).length);'`
Expected: `28 12`. Los renglones de la tabla del documento tienen que ser 28.

- [ ] **Step 4: Commit**

```bash
git add docs/partners/inventario.md
git commit -m "docs(partners): publish the ad inventory map"
```

---

## Verificación final

- [ ] `cd packages/partners && pnpm test` — todas pasan
- [ ] `cd packages/partners && pnpm exec tsc --noEmit -p tsconfig.json` — sin errores
- [ ] `pnpm --filter @repo/partners lint` — sin errores
- [ ] `git log --oneline` muestra los tres commits
