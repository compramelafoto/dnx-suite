# El sitio público de FOTOFFICE — Etapa 1: que el sitio se vea

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un visitante entre a `/w/[slug]` y vea el sitio que el dueño publicó, con encabezado, menú y pie, y que las páginas de módulos (cursos, reservas, asociarse) se vean dentro de ese mismo sitio en vez de sueltas.

**Architecture:** Un layout público en `app/w/[workspaceSlug]/layout.tsx` resuelve una sola vez por request branding + versión publicada + presets + módulos habilitados, y envuelve **todas** las páginas de `/w/[slug]` con encabezado, menú y pie. La página de inicio pasa a renderizar la versión publicada con el `WebsitePageRenderer` que ya existe. Toda la lógica decidible vive en funciones puras de `lib/website/` con tests; los componentes y las rutas quedan finos.

**Tech Stack:** Next.js 16.2.1 (App Router), React 19, Prisma (`@repo/db`), Vitest (`environment: node`), Tailwind.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-09-20-sitio-publico-website-design.md`

## Global Constraints

- **Vocabulario de cara al usuario:** un **módulo** se habilita, una **página** se lista, una **sección** se muestra. En el código la sección se sigue llamando `block` (`WebsiteBlock`, `WEBSITE_BLOCK_REGISTRY`). Nunca escribir "bloque" en texto visible.
- **Respondé siempre en español** en comentarios, mensajes de commit y texto de pantalla. Identificadores, rutas y nombres de archivo en inglés, como ya está el repo.
- **Cero migraciones de Prisma en esta etapa.** Si una tarea parece necesitar una, está mal planteada: pará y avisá.
- **Nunca agregar dependencias nuevas.** El lockfile es compartido por las 7 apps del monorepo.
- **Next.js 16.2.1 no es el Next que conocés.** `params` es una `Promise` y hay que await-earla. Antes de escribir una ruta, layout o archivo de metadata nuevo, leé la guía en `node_modules/next/dist/docs/01-app/`.
- **Los tests corren en `environment: node`** y sólo levantan `lib/**/*.test.ts` y `app/**/*.test.ts`. No hay render de componentes ni base de datos en los tests: toda la lógica que valga la pena probar tiene que ser una función pura en `lib/`.
- **El sitio público nunca pide sesión.** `requireWebsiteContext()` es del panel y redirige a `/dashboard`: no se usa en ninguna ruta bajo `/w/`.
- **Comando de tests:** `pnpm test` desde `apps/fotoffice`. Uno solo: `pnpm test -- lib/website/archivo.test.ts`.
- **Baseline al empezar:** 252 archivos, 3063 pruebas, 0 fallos.

---

## Alcance de esta etapa

**Entra:** el armazón (encabezado con menú en celular, pie de página nuevo), servir el Inicio publicado, las páginas de módulos integradas al armazón y verificando su módulo, y el 404 del sitio.

**No entra, y tiene su propio plan:** varias páginas y menú editable (etapa 2); las diez secciones nuevas y las diez plantillas (etapa 3); SEO, sitemap y robots (etapa 3).

**Ajuste al spec detectado al planificar:** el spec habla de `sitemap.xml` y `robots.txt` por workspace usando las convenciones de Next. No se puede: la guía de `robots.md` dice que la convención sólo funciona en la **raíz** de `app`, y un `sitemap.ts` dentro de un segmento dinámico no está soportado como tal. Van como Route Handlers explícitos (`app/w/[workspaceSlug]/sitemap.xml/route.ts`). Queda anotado para la etapa 3; no se implementa acá.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/website/design-presets.ts` *(modificar)* | Sumar `footerPreset` al juego de presets y su variable CSS |
| `lib/website/site-nav.ts` *(crear)* | Puro: armar el menú público a partir de páginas y módulos habilitados |
| `lib/website/site-nav.test.ts` *(crear)* | Tests del anterior |
| `lib/website/public-modules.ts` *(crear)* | Puro: qué módulos tienen página pública, con su ruta y su etiqueta |
| `lib/website/public-modules.test.ts` *(crear)* | Tests del anterior |
| `lib/website/public-site.ts` *(crear)* | Server: carga branding + versión publicada + presets + módulos, en una sola pasada |
| `components/website/render/website-footer-view.tsx` *(crear)* | El pie, con sus tres variantes |
| `components/website/render/website-header-view.tsx` *(modificar)* | Menú desplegable en celular y estado activo |
| `components/website/render/public-site-shell.tsx` *(crear)* | Envuelve children con encabezado, pie y las variables CSS del sitio |
| `app/w/[workspaceSlug]/layout.tsx` *(crear)* | El armazón: resuelve el sitio y lo pasa al shell |
| `app/w/[workspaceSlug]/page.tsx` *(modificar)* | Servir el Inicio publicado, con la landing actual como respaldo |
| `app/w/[workspaceSlug]/not-found.tsx` *(crear)* | El 404 con el aspecto del sitio |
| `app/w/[workspaceSlug]/cursos/page.tsx` *(modificar)* | Sacarle su cabecera propia y verificar su módulo |
| `app/w/[workspaceSlug]/asociarse/page.tsx` *(modificar)* | Idem |
| `app/w/[workspaceSlug]/reservas/page.tsx` *(modificar)* | Sacarle su cabecera propia (su módulo ya lo verifica) |

---

## Task 1: El pie de página entra a los presets de diseño

**Files:**
- Modify: `lib/website/design-presets.ts`
- Test: `lib/website/design-presets.test.ts` *(ya existe, se le agregan casos)*

**Interfaces:**
- Consumes: nada.
- Produces: `FOOTER_PRESETS`, `type FooterPresetId = "simple" | "columns" | "full"`, y el campo `footerPreset: FooterPresetId` dentro de `WebsiteDesignPresets`, con default `"simple"`. `getFooterPreset(id)` devuelve la definición, cayendo a la primera si el id no existe.

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `lib/website/design-presets.test.ts`:

```ts
describe("footerPreset", () => {
  it("un objeto vacío cae al pie 'simple'", () => {
    expect(parseWebsiteDesignPresets({}).footerPreset).toBe("simple");
  });

  it("un footerPreset inválido cae al default en vez de romper", () => {
    expect(parseWebsiteDesignPresets({ footerPreset: "neon" }).footerPreset).toBe("simple");
  });

  it("un footerPreset válido se conserva", () => {
    expect(parseWebsiteDesignPresets({ footerPreset: "columns" }).footerPreset).toBe("columns");
  });

  it("getFooterPreset devuelve la definición pedida", () => {
    expect(getFooterPreset("full").id).toBe("full");
  });

  it("getFooterPreset cae a la primera definición si el id no existe", () => {
    expect(getFooterPreset("no-existe" as FooterPresetId).id).toBe("simple");
  });
});
```

Y agregar `getFooterPreset` y `type FooterPresetId` al `import` que ese archivo ya tiene de `./design-presets`.

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test -- lib/website/design-presets.test.ts`
Expected: FAIL — `getFooterPreset is not a function`.

- [ ] **Step 3: Implementar**

En `lib/website/design-presets.ts`, después de `ANIMATION_PRESETS`:

```ts
/** Variantes del pie del sitio. `simple` es el default: es el único que se ve bien sin ningún
 * dato de contacto cargado, y un workspace recién creado no tiene ninguno. */
export const FOOTER_PRESETS = [
  { id: "simple", label: "Simple", description: "Nombre, año y enlaces legales." },
  { id: "columns", label: "Columnas", description: "Menú, contacto y redes en columnas." },
  { id: "full", label: "Completo", description: "Lo anterior, más el logo y la nota legal." },
] as const;
export type FooterPresetId = (typeof FOOTER_PRESETS)[number]["id"];
```

Debajo, junto a los demás `const ... _IDS`:

```ts
const FOOTER_IDS = FOOTER_PRESETS.map((p) => p.id) as [FooterPresetId, ...FooterPresetId[]];
```

En `DEFAULT_DESIGN_PRESETS`, agregar `footerPreset: "simple",`.

En `websiteDesignPresetsSchema`, agregar:

```ts
  footerPreset: z.enum(FOOTER_IDS).catch(DEFAULT_DESIGN_PRESETS.footerPreset),
```

En el tipo `WebsiteDesignPresets`, agregar `footerPreset: FooterPresetId;`.

Y junto a los demás getters:

```ts
export function getFooterPreset(id: FooterPresetId) {
  return FOOTER_PRESETS.find((p) => p.id === id) ?? FOOTER_PRESETS[0];
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `pnpm test -- lib/website/design-presets.test.ts`
Expected: PASS.

- [ ] **Step 5: Correr la suite entera**

Run: `pnpm test`
Expected: 3063 pruebas o más, 0 fallos. Si alguna rompe, es porque construía un `WebsiteDesignPresets` a mano sin el campo nuevo: agregale `footerPreset: "simple"`.

- [ ] **Step 6: Commitear**

```bash
git add lib/website/design-presets.ts lib/website/design-presets.test.ts
git commit -m "Sumar el pie de página a los presets de diseño del sitio"
```

---

## Task 2: Qué módulos tienen página pública

**Files:**
- Create: `lib/website/public-modules.ts`
- Test: `lib/website/public-modules.test.ts`

**Interfaces:**
- Consumes: las constantes de módulo que ya existen (`COURSES_SALES_MODULE_KEY`, `BOOKINGS_MODULE_KEY`, `MEMBERS_MODULE_KEY`).
- Produces:
  - `type PublicModulePage = { moduleKey: string; segment: string; label: string; order: number }`
  - `PUBLIC_MODULE_PAGES: readonly PublicModulePage[]`
  - `publicModulePagesFor(enabledModuleKeys: ReadonlySet<string>): PublicModulePage[]` — sólo las habilitadas, ordenadas por `order`.
  - `SITE_RESERVED_SEGMENTS: readonly string[]` — los segmentos que una página del dueño no puede usar. Se deriva de `PUBLIC_MODULE_PAGES` más los fijos del sitio; **no se escribe a mano**.
  - `isSiteSegmentReserved(segment: string): boolean` — insensible a mayúsculas y a espacios al borde.

**Por qué este archivo:** el menú, el 404 y (en la etapa 2) la validación al crear una página necesitan la misma lista. Si vive en tres lados, se desincroniza apenas se agregue un módulo.

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/website/public-modules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import {
  PUBLIC_MODULE_PAGES,
  SITE_RESERVED_SEGMENTS,
  isSiteSegmentReserved,
  publicModulePagesFor,
} from "./public-modules";

describe("publicModulePagesFor", () => {
  it("sin ningún módulo habilitado no devuelve ninguna página", () => {
    expect(publicModulePagesFor(new Set())).toEqual([]);
  });

  it("devuelve sólo las páginas de los módulos habilitados", () => {
    const paginas = publicModulePagesFor(new Set([BOOKINGS_MODULE_KEY]));
    expect(paginas.map((p) => p.segment)).toEqual(["reservas"]);
  });

  it("las devuelve ordenadas por 'order', no por el orden del Set", () => {
    const paginas = publicModulePagesFor(
      new Set([MEMBERS_MODULE_KEY, COURSES_SALES_MODULE_KEY, BOOKINGS_MODULE_KEY]),
    );
    const orders = paginas.map((p) => p.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it("un módulo habilitado que no tiene página pública no aporta nada", () => {
    expect(publicModulePagesFor(new Set(["evaluaciones"]))).toEqual([]);
  });
});

describe("SITE_RESERVED_SEGMENTS", () => {
  it("incluye el segmento de cada página de módulo — se deriva, no se escribe a mano", () => {
    for (const pagina of PUBLIC_MODULE_PAGES) {
      expect(SITE_RESERVED_SEGMENTS).toContain(pagina.segment);
    }
  });

  it("no tiene segmentos repetidos", () => {
    expect(new Set(SITE_RESERVED_SEGMENTS).size).toBe(SITE_RESERVED_SEGMENTS.length);
  });
});

describe("isSiteSegmentReserved", () => {
  it("reconoce un segmento de módulo", () => {
    expect(isSiteSegmentReserved("cursos")).toBe(true);
  });

  it("no distingue mayúsculas ni espacios al borde", () => {
    expect(isSiteSegmentReserved("  Cursos ")).toBe(true);
  });

  it("deja pasar un nombre libre", () => {
    expect(isSiteSegmentReserved("nosotros")).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test -- lib/website/public-modules.test.ts`
Expected: FAIL — no existe `./public-modules`.

- [ ] **Step 3: Implementar**

Crear `lib/website/public-modules.ts`:

```ts
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";

/**
 * Las páginas públicas que aporta cada módulo al sitio: qué segmento ocupan bajo
 * `/w/[slug]/`, cómo se llaman en el menú y en qué orden van.
 *
 * Es la ÚNICA fuente de verdad de esa correspondencia. La consumen el menú público, el
 * armazón y la lista de segmentos reservados — si viviera en tres lados, agregar un módulo
 * nuevo obligaría a acordarse de los tres.
 *
 * Agregar un módulo con página pública es agregar una entrada acá y crear su carpeta en
 * `app/w/[workspaceSlug]/<segment>/`.
 */
export type PublicModulePage = {
  /** Mismo valor que `WorkspaceFeatureModule.moduleKey`. */
  moduleKey: string;
  /** Segmento bajo `/w/[slug]/`. Es también su entrada en el menú. */
  segment: string;
  /** Etiqueta visible. Ojo: el vocabulario por workspace todavía no se aplica acá. */
  label: string;
  order: number;
};

export const PUBLIC_MODULE_PAGES: readonly PublicModulePage[] = [
  { moduleKey: COURSES_SALES_MODULE_KEY, segment: "cursos", label: "Cursos", order: 10 },
  { moduleKey: BOOKINGS_MODULE_KEY, segment: "reservas", label: "Reservas", order: 20 },
  { moduleKey: MEMBERS_MODULE_KEY, segment: "asociarse", label: "Asociarse", order: 30 },
] as const;

/** Las páginas de los módulos habilitados, en su orden de presentación. */
export function publicModulePagesFor(enabledModuleKeys: ReadonlySet<string>): PublicModulePage[] {
  return PUBLIC_MODULE_PAGES.filter((p) => enabledModuleKeys.has(p.moduleKey))
    .slice()
    .sort((a, b) => a.order - b.order);
}

/**
 * Segmentos que una página del dueño no puede ocupar, porque ya los usa el sitio. Los de
 * módulos se derivan de `PUBLIC_MODULE_PAGES`; los fijos son rutas propias del sitio que no
 * pertenecen a ningún módulo.
 *
 * No se usa todavía: lo consume la validación al crear una página, en la etapa 2. Se define
 * acá, junto a su fuente, para que nazca derivado y no escrito a mano.
 */
const SEGMENTOS_FIJOS = ["xv", "sitemap.xml", "robots.txt"] as const;

export const SITE_RESERVED_SEGMENTS: readonly string[] = [
  ...new Set([...PUBLIC_MODULE_PAGES.map((p) => p.segment), ...SEGMENTOS_FIJOS]),
];

export function isSiteSegmentReserved(segment: string): boolean {
  return SITE_RESERVED_SEGMENTS.includes(segment.trim().toLowerCase());
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `pnpm test -- lib/website/public-modules.test.ts`
Expected: PASS, 9 pruebas.

- [ ] **Step 5: Commitear**

```bash
git add lib/website/public-modules.ts lib/website/public-modules.test.ts
git commit -m "Declarar qué módulos aportan una página al sitio público"
```

---

## Task 3: El menú del sitio

**Files:**
- Create: `lib/website/site-nav.ts`
- Test: `lib/website/site-nav.test.ts`

**Interfaces:**
- Consumes: `publicModulePagesFor` (Task 2); `deriveHomeNavItems` y `type WebsiteNavItem` de `./navigation` (ya existen).
- Produces:
  - `type SiteNavItem = { id: string; label: string; href: string; current: boolean; children: SiteNavItem[] }`
  - `buildSiteNav(input: { workspaceSlug: string; homeBlocks: WebsiteBlock[]; enabledModuleKeys: ReadonlySet<string>; currentPath: string; hasPublishedSite: boolean }): SiteNavItem[]`

**Reglas que fija esta tarea:**
1. "Inicio" siempre es el primer ítem y apunta a `/w/[slug]`.
2. Las secciones de la portada cuelgan de Inicio como submenú, reusando `deriveHomeNavItems`, y sólo si hay sitio publicado.
3. Después van las páginas de los módulos habilitados, en su orden.
4. `current` marca el ítem de la página en la que estás. Un padre queda `current` si lo está alguno de sus hijos.

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/website/site-nav.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { createEmptyBlock, updateHeroSlide, type HeroBlock, type WebsiteBlock } from "./blocks";
import { buildSiteNav } from "./site-nav";

function heroConTitulo(titulo: string): WebsiteBlock {
  const hero = createEmptyBlock("HERO", 0) as HeroBlock;
  return { ...hero, config: updateHeroSlide(hero.config, hero.config.slides[0].id, { title: titulo }) };
}

const base = {
  workspaceSlug: "mi-estudio",
  homeBlocks: [] as WebsiteBlock[],
  enabledModuleKeys: new Set<string>(),
  currentPath: "/w/mi-estudio",
  hasPublishedSite: true,
};

describe("buildSiteNav", () => {
  it("sin módulos ni secciones, el menú es sólo Inicio", () => {
    const nav = buildSiteNav(base);
    expect(nav).toHaveLength(1);
    expect(nav[0]).toMatchObject({ id: "home", label: "Inicio", href: "/w/mi-estudio", current: true });
    expect(nav[0].children).toEqual([]);
  });

  it("las secciones de la portada cuelgan de Inicio como submenú", () => {
    const nav = buildSiteNav({ ...base, homeBlocks: [heroConTitulo("Sobre nosotros")] });
    expect(nav[0].children).toHaveLength(1);
    expect(nav[0].children[0]).toMatchObject({
      label: "Sobre nosotros",
      href: "/w/mi-estudio#sobre-nosotros",
    });
  });

  it("sin sitio publicado, Inicio no tiene submenú aunque haya secciones en el borrador", () => {
    const nav = buildSiteNav({
      ...base,
      homeBlocks: [heroConTitulo("Sobre nosotros")],
      hasPublishedSite: false,
    });
    expect(nav[0].children).toEqual([]);
  });

  it("un módulo habilitado agrega su página al menú", () => {
    const nav = buildSiteNav({ ...base, enabledModuleKeys: new Set([BOOKINGS_MODULE_KEY]) });
    expect(nav.map((i) => i.label)).toEqual(["Inicio", "Reservas"]);
    expect(nav[1].href).toBe("/w/mi-estudio/reservas");
  });

  it("un módulo NO habilitado no aparece en el menú", () => {
    const nav = buildSiteNav({ ...base, enabledModuleKeys: new Set([BOOKINGS_MODULE_KEY]) });
    expect(nav.map((i) => i.label)).not.toContain("Cursos");
  });

  it("marca como actual la página de módulo en la que estás, y desmarca Inicio", () => {
    const nav = buildSiteNav({
      ...base,
      enabledModuleKeys: new Set([COURSES_SALES_MODULE_KEY]),
      currentPath: "/w/mi-estudio/cursos",
    });
    expect(nav[0].current).toBe(false);
    expect(nav[1]).toMatchObject({ label: "Cursos", current: true });
  });

  it("una ruta más profunda marca igual a su página de módulo", () => {
    const nav = buildSiteNav({
      ...base,
      enabledModuleKeys: new Set([COURSES_SALES_MODULE_KEY]),
      currentPath: "/w/mi-estudio/cursos/taller-de-retrato",
    });
    expect(nav[1].current).toBe(true);
  });

  it("una barra final no cambia qué ítem está marcado", () => {
    const nav = buildSiteNav({
      ...base,
      enabledModuleKeys: new Set([COURSES_SALES_MODULE_KEY]),
      currentPath: "/w/mi-estudio/cursos/",
    });
    expect(nav[1].current).toBe(true);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test -- lib/website/site-nav.test.ts`
Expected: FAIL — no existe `./site-nav`.

- [ ] **Step 3: Implementar**

Crear `lib/website/site-nav.ts`:

```ts
import type { WebsiteBlock } from "./blocks";
import { deriveHomeNavItems } from "./navigation";
import { publicModulePagesFor } from "./public-modules";

/**
 * El menú del sitio público. Se arma solo: Inicio, las secciones de la portada como submenú, y
 * una entrada por módulo habilitado con página pública.
 *
 * Es una función pura a propósito: el layout le pasa lo que ya resolvió (secciones publicadas,
 * módulos habilitados, ruta actual) y acá no se consulta nada. Así se puede probar entera sin
 * base de datos ni request, que es lo único que los tests de esta app saben hacer.
 *
 * `navJson` — el menú corregido a mano por el dueño — todavía no se lee: es la etapa 2. Cuando
 * llegue, se aplica ENCIMA de lo que devuelve esta función, nunca en lugar de.
 */
export type SiteNavItem = {
  id: string;
  label: string;
  href: string;
  /** La página que el visitante está mirando. Un padre lo hereda de sus hijos. */
  current: boolean;
  children: SiteNavItem[];
};

/** Sin la barra final, para que `/cursos` y `/cursos/` sean la misma ruta. */
function normalizar(path: string): string {
  const limpio = path.replace(/\/+$/, "");
  return limpio === "" ? "/" : limpio;
}

export function buildSiteNav(input: {
  workspaceSlug: string;
  homeBlocks: WebsiteBlock[];
  enabledModuleKeys: ReadonlySet<string>;
  currentPath: string;
  /** Sin versión publicada no hay secciones que anclar: Inicio va sin submenú. */
  hasPublishedSite: boolean;
}): SiteNavItem[] {
  const base = `/w/${input.workspaceSlug}`;
  const actual = normalizar(input.currentPath);

  // Las anclas de la portada sólo tienen sentido estando en la portada: desde otra página,
  // `#seccion` no llevaría a ningún lado. Por eso el href lleva siempre la ruta completa.
  const secciones: SiteNavItem[] = input.hasPublishedSite
    ? deriveHomeNavItems(input.homeBlocks)
        .filter((item) => item.anchor !== null)
        .map((item) => ({
          id: item.id,
          label: item.label,
          href: `${base}#${item.anchor}`,
          current: false,
          children: [],
        }))
    : [];

  const inicio: SiteNavItem = {
    id: "home",
    label: "Inicio",
    href: base,
    current: actual === normalizar(base),
    children: secciones,
  };

  const paginasDeModulo: SiteNavItem[] = publicModulePagesFor(input.enabledModuleKeys).map((pagina) => {
    const href = `${base}/${pagina.segment}`;
    // Una ruta más profunda (el detalle de un curso) marca igual a su página de módulo.
    const esActual = actual === normalizar(href) || actual.startsWith(`${normalizar(href)}/`);
    return { id: pagina.moduleKey, label: pagina.label, href, current: esActual, children: [] };
  });

  return [inicio, ...paginasDeModulo];
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `pnpm test -- lib/website/site-nav.test.ts`
Expected: PASS, 8 pruebas.

- [ ] **Step 5: Commitear**

```bash
git add lib/website/site-nav.ts lib/website/site-nav.test.ts
git commit -m "Armar el menú del sitio con las páginas de los módulos habilitados"
```

---

## Task 4: Cargar el sitio público de un workspace

**Files:**
- Create: `lib/website/public-site.ts`
- Test: `lib/website/public-site.test.ts`

**Interfaces:**
- Consumes: `parseWebsiteSections`, `parseWebsiteDesignPresets`, `resolveWebsiteColors` de `./branding-defaults`, `getEnabledModuleKeysForWorkspace` de `@/lib/modules/gating`, `WEBSITE_MODULE_KEY`.
- Produces:
  - `type PublicSite = { workspaceId: string; workspaceSlug: string; commercialName: string; logoUrl: string | null; faviconUrl: string | null; colors: WebsiteColors; designPresets: WebsiteDesignPresets; homeBlocks: WebsiteBlock[]; hasPublishedSite: boolean; enabledModuleKeys: Set<string>; contact: PublicSiteContact }`
  - `type PublicSiteContact = { email: string | null; phone: string | null; whatsapp: string | null; instagram: string | null; city: string | null; province: string | null; legalNote: string | null }`
  - `loadPublicSite(workspaceSlug: string): Promise<PublicSite | null>` — `null` si no existe el workspace.
  - `pickPublishedHomeBlocks(args: { websiteModuleEnabled: boolean; publishedSectionsJson: unknown }): { homeBlocks: WebsiteBlock[]; hasPublishedSite: boolean }` — **pura y testeada**: decide qué se muestra según la tabla del spec.

**Por qué se parte así:** `loadPublicSite` toca Prisma y no se puede probar con esta configuración de tests. La decisión que importa —qué ve el visitante en cada combinación de módulo habilitado y versión publicada— se aísla en `pickPublishedHomeBlocks`, que sí es pura.

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/website/public-site.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createEmptyBlock } from "./blocks";
import { pickPublishedHomeBlocks } from "./public-site";

const seccionesPublicadas = { pages: { home: [createEmptyBlock("TEXT", 0)] } };

describe("pickPublishedHomeBlocks", () => {
  it("módulo habilitado y versión publicada: se muestran sus secciones", () => {
    const r = pickPublishedHomeBlocks({
      websiteModuleEnabled: true,
      publishedSectionsJson: seccionesPublicadas,
    });
    expect(r.hasPublishedSite).toBe(true);
    expect(r.homeBlocks).toHaveLength(1);
  });

  it("módulo habilitado y sin publicar nunca: no hay sitio", () => {
    const r = pickPublishedHomeBlocks({ websiteModuleEnabled: true, publishedSectionsJson: null });
    expect(r.hasPublishedSite).toBe(false);
    expect(r.homeBlocks).toEqual([]);
  });

  it("módulo NO habilitado: no hay sitio aunque exista una versión publicada", () => {
    const r = pickPublishedHomeBlocks({
      websiteModuleEnabled: false,
      publishedSectionsJson: seccionesPublicadas,
    });
    expect(r.hasPublishedSite).toBe(false);
    expect(r.homeBlocks).toEqual([]);
  });

  it("módulo habilitado con una versión publicada vacía: hay sitio, sin secciones", () => {
    const r = pickPublishedHomeBlocks({
      websiteModuleEnabled: true,
      publishedSectionsJson: { pages: { home: [] } },
    });
    expect(r.hasPublishedSite).toBe(true);
    expect(r.homeBlocks).toEqual([]);
  });

  it("un sectionsJson corrupto no rompe: hay sitio y se muestra vacío", () => {
    const r = pickPublishedHomeBlocks({
      websiteModuleEnabled: true,
      publishedSectionsJson: "esto no es un sitio",
    });
    expect(r.hasPublishedSite).toBe(true);
    expect(r.homeBlocks).toEqual([]);
  });

  it("una sección inválida se descarta y las válidas se conservan", () => {
    const r = pickPublishedHomeBlocks({
      websiteModuleEnabled: true,
      publishedSectionsJson: {
        pages: { home: [{ type: "NO_EXISTE", id: "x" }, createEmptyBlock("TEXT", 1)] },
      },
    });
    expect(r.homeBlocks).toHaveLength(1);
    expect(r.homeBlocks[0].type).toBe("TEXT");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test -- lib/website/public-site.test.ts`
Expected: FAIL — no existe `./public-site`.

- [ ] **Step 3: Implementar la parte pura**

Crear `lib/website/public-site.ts` con esto primero (la función pura, sin nada de Prisma todavía):

```ts
import { parseWebsiteSections, type WebsiteBlock } from "./blocks";

/**
 * Qué ve el visitante en la portada, según la tabla de la sección 4 del spec. Es la única
 * decisión de esta carpeta que puede romper lo que hoy funciona, así que vive separada de la
 * consulta para poder probarla entera.
 *
 * Regla: sin módulo habilitado, o sin versión publicada, NO hay sitio — la portada cae a la
 * landing de presupuesto de siempre, que es lo que hay hoy en producción.
 */
export function pickPublishedHomeBlocks(args: {
  websiteModuleEnabled: boolean;
  publishedSectionsJson: unknown;
}): { homeBlocks: WebsiteBlock[]; hasPublishedSite: boolean } {
  if (!args.websiteModuleEnabled || args.publishedSectionsJson == null) {
    return { homeBlocks: [], hasPublishedSite: false };
  }
  // parseWebsiteSections es tolerante: un JSON corrupto devuelve `{ pages: { home: [] } }` y una
  // sección inválida se descarta sola. Un sitio publicado con contenido roto se ve vacío, nunca
  // tira la página.
  const sections = parseWebsiteSections(args.publishedSectionsJson);
  return { homeBlocks: sections.pages.home ?? [], hasPublishedSite: true };
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `pnpm test -- lib/website/public-site.test.ts`
Expected: PASS, 6 pruebas.

- [ ] **Step 5: Agregar la carga desde la base**

En el mismo archivo, arriba del todo agregar los imports:

```ts
import { prisma } from "@repo/db";
import { resolveWebsiteColors, type WebsiteColors } from "./branding-defaults";
import { parseWebsiteDesignPresets, type WebsiteDesignPresets } from "./design-presets";
import { WEBSITE_MODULE_KEY } from "./constants";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
```

Y al final:

```ts
export type PublicSiteContact = {
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  city: string | null;
  province: string | null;
  /** Texto plano institucional para el pie. NUNCA es HTML: se escapa al renderizar. */
  legalNote: string | null;
};

export type PublicSite = {
  workspaceId: string;
  workspaceSlug: string;
  commercialName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  colors: WebsiteColors;
  designPresets: WebsiteDesignPresets;
  homeBlocks: WebsiteBlock[];
  hasPublishedSite: boolean;
  enabledModuleKeys: Set<string>;
  contact: PublicSiteContact;
};

/**
 * Todo lo que el armazón público necesita, en una sola pasada. Lo llama el layout de
 * `/w/[workspaceSlug]`, así cada página no vuelve a resolver lo mismo.
 *
 * PÚBLICA de verdad: no pide sesión ni usa `requireWebsiteContext` (eso es del panel y
 * redirige a /dashboard). Devuelve `null` si el slug no existe — quien llama hace notFound().
 *
 * Privacidad: el `select` es explícito y acotado. Nunca devolver el branding entero ni nada
 * de otro módulo: lo que salga de acá termina en el HTML que ve cualquiera.
 */
export async function loadPublicSite(workspaceSlug: string): Promise<PublicSite | null> {
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: {
      workspaceId: true,
      commercialName: true,
      logoUrl: true,
      faviconUrl: true,
      primaryColor: true,
      secondaryColor: true,
      backgroundColor: true,
      textColor: true,
      accentColor: true,
      contactEmail: true,
      phone: true,
      whatsapp: true,
      instagram: true,
      city: true,
      province: true,
      emailSignatureNote: true,
    },
  });
  if (!branding) return null;

  const [enabledModuleKeys, website] = await Promise.all([
    getEnabledModuleKeysForWorkspace(branding.workspaceId),
    prisma.fotofficeWorkspaceWebsite.findUnique({
      where: { workspaceId: branding.workspaceId },
      select: {
        publishedVersion: { select: { sectionsJson: true, designPresetsJson: true } },
      },
    }),
  ]);

  const websiteModuleEnabled = enabledModuleKeys.has(WEBSITE_MODULE_KEY);
  const { homeBlocks, hasPublishedSite } = pickPublishedHomeBlocks({
    websiteModuleEnabled,
    publishedSectionsJson: website?.publishedVersion?.sectionsJson ?? null,
  });

  return {
    workspaceId: branding.workspaceId,
    workspaceSlug,
    commercialName: branding.commercialName,
    logoUrl: branding.logoUrl,
    faviconUrl: branding.faviconUrl,
    colors: resolveWebsiteColors(branding),
    // El diseño se congela por versión: se lee el de la versión publicada, no el del borrador.
    designPresets: parseWebsiteDesignPresets(website?.publishedVersion?.designPresetsJson ?? null),
    homeBlocks,
    hasPublishedSite,
    enabledModuleKeys,
    contact: {
      email: branding.contactEmail,
      phone: branding.phone,
      whatsapp: branding.whatsapp,
      instagram: branding.instagram,
      city: branding.city,
      province: branding.province,
      legalNote: branding.emailSignatureNote,
    },
  };
}
```

`resolveWebsiteColors` ya existe en `lib/website/branding-defaults.ts` con esta firma, verificada al escribir el plan:

```ts
export function resolveWebsiteColors(branding: {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  accentColor?: string | null;
} | null): WebsiteColors
```

El objeto del `select` de arriba la satisface tal cual. No la modifiques.

- [ ] **Step 6: Verificar que compila y que la suite sigue verde**

Run: `pnpm test`
Expected: 0 fallos.

Run: `pnpm lint`
Expected: sin errores en los archivos nuevos.

- [ ] **Step 7: Commitear**

```bash
git add lib/website/public-site.ts lib/website/public-site.test.ts
git commit -m "Cargar de una sola vez todo lo que el sitio público necesita"
```

---

## Task 5: El pie de página

**Files:**
- Create: `components/website/render/website-footer-view.tsx`

**Interfaces:**
- Consumes: `PublicSiteContact` (Task 4), `WebsiteDesignPresets` con su campo `footerPreset` (Task 1), `SiteNavItem` (Task 3). Lee `designPresets.footerPreset` directo; no necesita `getFooterPreset`, que es para la pantalla de Diseño del panel (etapa 3).
- Produces: `WebsiteFooterView({ commercialName, logoUrl, contact, navItems, designPresets })`.

**Sin test:** es presentación pura y los tests de esta app no renderizan componentes. Se verifica en el navegador en la Task 9.

- [ ] **Step 1: Implementar**

Crear `components/website/render/website-footer-view.tsx`:

```tsx
import type { PublicSiteContact } from "@/lib/website/public-site";
import type { WebsiteDesignPresets } from "@/lib/website/design-presets";
import type { SiteNavItem } from "@/lib/website/site-nav";

/**
 * El pie del sitio. Como el encabezado, NO es una sección: vive en el diseño global, no en
 * `sectionsJson`. Sus datos salen todos de `FotofficeWorkspaceBranding`, que es la misma fuente
 * que firma los correos — una sola fuente de verdad entre el sitio y los mails.
 *
 * `legalNote` es TEXTO PLANO por contrato del modelo: se renderiza como texto, nunca con
 * dangerouslySetInnerHTML.
 */
export function WebsiteFooterView({
  commercialName,
  logoUrl,
  contact,
  navItems,
  designPresets,
}: {
  commercialName: string;
  logoUrl: string | null;
  contact: PublicSiteContact;
  navItems: SiteNavItem[];
  designPresets: WebsiteDesignPresets;
}) {
  const preset = designPresets.footerPreset;
  const conColumnas = preset === "columns" || preset === "full";
  const completo = preset === "full";
  const anio = new Date().getFullYear();

  const lugar = [contact.city, contact.province].filter(Boolean).join(", ");
  const tieneContacto = Boolean(contact.email || contact.phone || contact.whatsapp || lugar);

  return (
    <footer
      style={{
        backgroundColor: "var(--wsite-bg)",
        color: "var(--wsite-text)",
        borderTop: "1px solid rgba(127,127,127,0.2)",
        fontFamily: "var(--wsite-body-font)",
      }}
    >
      <div className="mx-auto max-w-6xl px-6 py-10">
        {conColumnas ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-3">
              {completo && logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- el logo vive en R2
                <img src={logoUrl} alt="" style={{ height: "var(--wsite-logo-size, 40px)", width: "auto" }} />
              ) : null}
              <p className="text-base font-semibold" style={{ fontFamily: "var(--wsite-heading-font)" }}>
                {commercialName}
              </p>
              {lugar ? <p className="text-sm opacity-70">{lugar}</p> : null}
            </div>

            {navItems.length > 1 ? (
              <nav className="space-y-2" aria-label="Pie del sitio">
                {navItems.map((item) => (
                  <a key={item.id} href={item.href} className="block text-sm opacity-80 hover:opacity-100">
                    {item.label}
                  </a>
                ))}
              </nav>
            ) : null}

            {tieneContacto ? (
              <div className="space-y-2 text-sm">
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className="block opacity-80 hover:opacity-100">
                    {contact.email}
                  </a>
                ) : null}
                {contact.phone ? (
                  <a href={`tel:${contact.phone}`} className="block opacity-80 hover:opacity-100">
                    {contact.phone}
                  </a>
                ) : null}
                {contact.whatsapp ? (
                  <a
                    href={`https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block opacity-80 hover:opacity-100"
                  >
                    WhatsApp
                  </a>
                ) : null}
                {contact.instagram ? (
                  <a
                    href={`https://instagram.com/${contact.instagram.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block opacity-80 hover:opacity-100"
                  >
                    Instagram
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {completo && contact.legalNote ? (
          <p className="mt-8 whitespace-pre-line text-xs leading-relaxed opacity-60">{contact.legalNote}</p>
        ) : null}

        <div
          className={`flex flex-wrap items-center justify-between gap-3 text-xs opacity-60 ${
            conColumnas ? "mt-8 border-t pt-6" : ""
          }`}
          style={conColumnas ? { borderColor: "rgba(127,127,127,0.2)" } : undefined}
        >
          <span>
            © {anio} {commercialName}
          </span>
          <span className="flex gap-4">
            <a href="/terminos" className="hover:opacity-100">
              Términos
            </a>
            <a href="/privacidad" className="hover:opacity-100">
              Privacidad
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `pnpm lint`
Expected: sin errores.

- [ ] **Step 3: Commitear**

```bash
git add components/website/render/website-footer-view.tsx
git commit -m "Dar al sitio su pie de página, con sus tres variantes"
```

---

## Task 6: El encabezado, usable desde un celular

**Files:**
- Modify: `components/website/render/website-header-view.tsx`

**Interfaces:**
- Consumes: `SiteNavItem` (Task 3).
- Produces: el mismo `WebsiteHeaderView`, pero aceptando `navItems: SiteNavItem[]` en vez de `WebsiteNavItem[]`, con menú desplegable en celular y marca de página actual.

**Cuidado:** este componente hoy lo usan `app/(shell)/website/preview/page.tsx` y `components/website/builder/live-preview.tsx`, que le pasan `WebsiteNavItem[]` (con `anchor`). Hay que actualizar a esos dos llamadores para que armen `SiteNavItem[]`, o la app no compila.

- [ ] **Step 1: Ver quién lo usa hoy**

Run: `grep -rn "WebsiteHeaderView" --include="*.tsx" app components`
Expected: el propio archivo más dos llamadores. Anotalos: hay que tocarlos en el Step 3.

- [ ] **Step 2: Reescribir el componente**

Reemplazar la firma y el cuerpo de `WebsiteHeaderView`. El desplegable en celular se hace **sin JavaScript**, con `<details>`: el componente sigue siendo de servidor y no hace falta `"use client"` ni estado.

```tsx
import type { WebsiteDesignPresets } from "@/lib/website/design-presets";
import type { SiteNavItem } from "@/lib/website/site-nav";

/**
 * Header real del sitio. NO es una sección: vive en Diseño global, no en `sectionsJson`. Los
 * presets sólo cambian layout vía clases — nunca CSS libre.
 *
 * El menú de celular es un `<details>` nativo, no un componente con estado: así el header sigue
 * siendo un Server Component y no arrastra JavaScript al sitio público de nadie.
 *
 * El botón "Iniciar sesión" apunta siempre a `/login` — nunca a una URL que el usuario escriba:
 * evita convertirlo sin querer en un vector de phishing.
 */
export function WebsiteHeaderView({
  logoUrl,
  workspaceName,
  navItems,
  designPresets,
  homeHref,
}: {
  logoUrl: string | null;
  workspaceName: string;
  navItems: SiteNavItem[];
  designPresets: WebsiteDesignPresets;
  /** A dónde lleva el logo. En la vista previa del panel no hay sitio público al que ir. */
  homeHref: string;
}) {
  const preset = designPresets.headerPreset;
  const overlay = preset === "transparent-hero";
  const floating = preset === "floating";
  const centered = preset === "centered";
  const minimal = preset === "minimal";

  const colorTexto = overlay ? "#ffffff" : "var(--wsite-text)";
  const itemsVisibles = minimal ? navItems.slice(0, 1) : navItems;

  const logo = (
    <a href={homeHref} className="flex shrink-0 items-center gap-2" style={{ color: colorTexto }}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- el logo vive en R2
        <img src={logoUrl} alt={workspaceName} style={{ height: "var(--wsite-logo-size, 40px)", width: "auto" }} />
      ) : (
        <span className="text-lg font-bold" style={{ fontFamily: "var(--wsite-heading-font)" }}>
          {workspaceName}
        </span>
      )}
    </a>
  );

  const enlace = (item: SiteNavItem) => (
    <a
      key={item.id}
      href={item.href}
      aria-current={item.current ? "page" : undefined}
      className="transition-opacity hover:opacity-70"
      style={{ color: colorTexto, opacity: item.current ? 1 : 0.75, fontWeight: item.current ? 600 : 400 }}
    >
      {item.label}
    </a>
  );

  // En pantalla grande: los ítems en fila. Los submenús de Inicio no se despliegan acá —
  // son anclas de la portada y aparecen sólo en el menú de celular, donde hay lugar.
  const navEscritorio = (
    <nav className={`hidden items-center gap-6 text-sm md:flex ${centered ? "flex-wrap justify-center" : ""}`}>
      {itemsVisibles.map(enlace)}
    </nav>
  );

  const botonLogin = designPresets.showLoginButton ? (
    <a
      href="/login"
      className="shrink-0 text-sm"
      style={{
        backgroundColor: "var(--wsite-accent)",
        color: "#ffffff",
        borderRadius: "var(--wsite-button-radius)",
        paddingInline: "var(--wsite-button-padding-x)",
        paddingBlock: "var(--wsite-button-padding-y)",
        fontWeight: "var(--wsite-button-weight)",
      }}
    >
      {designPresets.loginButtonLabel || "Iniciar sesión"}
    </a>
  ) : null;

  const navCelular = (
    <details className="md:hidden">
      <summary
        className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg"
        aria-label="Abrir el menú"
        style={{ color: colorTexto }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </summary>
      <nav
        className="absolute inset-x-0 z-20 flex flex-col gap-1 border-t p-4 text-sm shadow-lg"
        style={{ backgroundColor: "var(--wsite-bg)", borderColor: "rgba(127,127,127,0.2)" }}
      >
        {navItems.map((item) => (
          <div key={item.id} className="flex flex-col">
            <a
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className="py-2"
              style={{ color: "var(--wsite-text)", fontWeight: item.current ? 600 : 400 }}
            >
              {item.label}
            </a>
            {item.children.map((hijo) => (
              <a key={hijo.id} href={hijo.href} className="py-1.5 pl-4 text-sm opacity-70" style={{ color: "var(--wsite-text)" }}>
                {hijo.label}
              </a>
            ))}
          </div>
        ))}
      </nav>
    </details>
  );

  const wrapperClass = overlay ? "absolute inset-x-0 top-0 z-10" : floating ? "relative mx-4 mt-4 rounded-2xl shadow-md" : "relative";
  const wrapperStyle = overlay
    ? undefined
    : { backgroundColor: "var(--wsite-bg)", borderBottom: floating ? undefined : "1px solid rgba(127,127,127,0.15)" };

  return (
    <header className={wrapperClass} style={wrapperStyle}>
      <div className={`mx-auto flex max-w-6xl items-center gap-4 px-6 py-4 ${centered ? "flex-col text-center" : "justify-between"}`}>
        {logo}
        <div className={`flex items-center gap-4 ${centered ? "flex-col" : ""}`}>
          {navEscritorio}
          {botonLogin}
          {navCelular}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Arreglar los dos llamadores del panel**

En `app/(shell)/website/preview/page.tsx` y `components/website/builder/live-preview.tsx`, donde hoy construyen `navItems` con `deriveHomeNavItems(...)`, mapear al tipo nuevo. En ambos, la vista previa es del borrador y no hay sitio público al que ir, así que `homeHref="#"`:

```tsx
const navItems: SiteNavItem[] = deriveHomeNavItems(blocks).map((item) => ({
  id: item.id,
  label: item.label,
  href: item.anchor ? `#${item.anchor}` : "#",
  current: false,
  children: [],
}));
```

Y pasar `homeHref="#"` a `<WebsiteHeaderView .../>`. Importar `type SiteNavItem` de `@/lib/website/site-nav`.

- [ ] **Step 4: Verificar que compila y que la suite sigue verde**

Run: `pnpm lint`
Expected: sin errores.

Run: `pnpm test`
Expected: 0 fallos.

- [ ] **Step 5: Commitear**

```bash
git add components/website/render/website-header-view.tsx "app/(shell)/website/preview/page.tsx" components/website/builder/live-preview.tsx
git commit -m "Que el menú del sitio se pueda usar desde un celular"
```

---

## Task 7: El armazón público

**Files:**
- Create: `components/website/render/public-site-shell.tsx`
- Create: `app/w/[workspaceSlug]/layout.tsx`

**Interfaces:**
- Consumes: `loadPublicSite` (Task 4), `buildSiteNav` (Task 3), `WebsiteHeaderView` (Task 6), `WebsiteFooterView` (Task 5), `websiteDesignCssVars`.
- Produces: `PublicSiteShell({ site, currentPath, children })` y el layout que lo usa.

- [ ] **Step 1: Leer la guía de layouts antes de escribir**

Run: `sed -n 1,90p node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md`
Confirmá que `params` es una `Promise` y que hay que await-earla. No escribas el layout sin haber leído esto.

- [ ] **Step 2: Escribir el shell**

Crear `components/website/render/public-site-shell.tsx`:

```tsx
import type { CSSProperties, ReactNode } from "react";
import { websiteDesignCssVars } from "@/lib/website/design-presets";
import { buildSiteNav } from "@/lib/website/site-nav";
import type { PublicSite } from "@/lib/website/public-site";
import { WebsiteHeaderView } from "./website-header-view";
import { WebsiteFooterView } from "./website-footer-view";

/**
 * El armazón que envuelve TODAS las páginas de `/w/[slug]` — la portada del sitio y las
 * páginas de los módulos por igual. Es lo que hace que dejen de ser páginas sueltas.
 *
 * Define acá las variables CSS del sitio (`--wsite-*`) para que valgan también dentro de las
 * páginas de módulos, que están escritas con los tokens del panel (`--fo-*`) y no las conocen.
 * Por eso el `<main>` no fuerza fondo ni color: cada página sigue pintándose como sabe, y lo
 * que se unifica es el marco.
 */
export function PublicSiteShell({
  site,
  currentPath,
  children,
}: {
  site: PublicSite;
  currentPath: string;
  children: ReactNode;
}) {
  const navItems = buildSiteNav({
    workspaceSlug: site.workspaceSlug,
    homeBlocks: site.homeBlocks,
    enabledModuleKeys: site.enabledModuleKeys,
    currentPath,
    hasPublishedSite: site.hasPublishedSite,
  });

  const themeVars = {
    "--wsite-primary": site.colors.primaryColor,
    "--wsite-secondary": site.colors.secondaryColor,
    "--wsite-bg": site.colors.backgroundColor,
    "--wsite-text": site.colors.textColor,
    "--wsite-accent": site.colors.accentColor,
    ...websiteDesignCssVars(site.designPresets),
  } as CSSProperties;

  return (
    <div style={{ ...themeVars, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <WebsiteHeaderView
        logoUrl={site.logoUrl}
        workspaceName={site.commercialName}
        navItems={navItems}
        designPresets={site.designPresets}
        homeHref={`/w/${site.workspaceSlug}`}
      />
      <main style={{ flex: 1 }}>{children}</main>
      <WebsiteFooterView
        commercialName={site.commercialName}
        logoUrl={site.logoUrl}
        contact={site.contact}
        navItems={navItems}
        designPresets={site.designPresets}
      />
    </div>
  );
}
```

- [ ] **Step 3: Escribir el layout**

Crear `app/w/[workspaceSlug]/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { loadPublicSite } from "@/lib/website/public-site";
import { PublicSiteShell } from "@/components/website/render/public-site-shell";

type Props = { children: ReactNode; params: Promise<{ workspaceSlug: string }> };

/**
 * El armazón de todo lo público de un workspace. Resuelve el sitio UNA vez por request y se lo
 * presta a todas las páginas de abajo, así ninguna vuelve a consultar branding ni módulos.
 *
 * Nunca pide sesión: `requireWebsiteContext` es del panel y redirige a /dashboard.
 *
 * Si el módulo Sitio web está apagado o nunca se publicó, el armazón igual se dibuja — con el
 * menú de los módulos que sí estén habilitados. Lo que cambia en ese caso es la portada, no el
 * marco: una institución que sólo vende cursos sigue teniendo su /w/slug/cursos con cara de
 * sitio (ver la tabla de la sección 4 del spec).
 */
export default async function PublicWorkspaceLayout({ children, params }: Props) {
  const { workspaceSlug } = await params;
  const site = await loadPublicSite(workspaceSlug);
  if (!site) notFound();

  // El menú necesita saber en qué página estás. Un layout no recibe la ruta, así que se lee de
  // la cabecera que Next agrega en cada request.
  const h = await headers();
  const currentPath = h.get("x-invoke-path") ?? h.get("x-pathname") ?? `/w/${workspaceSlug}`;

  return (
    <PublicSiteShell site={site} currentPath={currentPath}>
      {children}
    </PublicSiteShell>
  );
}
```

**Verificá la cabecera antes de darlo por bueno.** `x-invoke-path` no está garantizada en Next 16. En el Step 4 se comprueba en el navegador: si el ítem actual nunca se marca, la cabecera no llega, y entonces hay que resolverlo con un componente de cliente que lea `usePathname()` y reciba los `navItems` ya armados. No inventes un middleware nuevo para esto.

- [ ] **Step 4: Verificar en el navegador**

Levantá el servidor con la herramienta de preview (nunca con Bash) usando `.claude/launch.json`; si no existe, creala con `{"name":"fotoffice","runtimeExecutable":"pnpm","runtimeArgs":["dev"],"port":3010}`.

Abrí `/w/<un-slug-real>/reservas` y comprobá:
1. Aparecen encabezado y pie alrededor del contenido.
2. El menú lista sólo los módulos habilitados de ese workspace.
3. En ancho de teléfono (`resize_window` con preset `mobile`) el menú es un desplegable y se abre.
4. "Reservas" figura marcado como página actual. **Si no se marca, la cabecera no llegó**: aplicá el camino alternativo del Step 3.

Mirá también la consola y los registros del servidor: no debe haber errores.

- [ ] **Step 5: Commitear**

```bash
git add components/website/render/public-site-shell.tsx "app/w/[workspaceSlug]/layout.tsx"
git commit -m "Envolver todo lo público del workspace con un solo armazón"
```

---

## Task 8: Servir el Inicio publicado

**Files:**
- Modify: `app/w/[workspaceSlug]/page.tsx`

**Interfaces:**
- Consumes: `loadPublicSite` (Task 4), `WebsitePageRenderer` (ya existe).
- Produces: la portada del sitio publicado; y la landing de presupuesto de siempre cuando no hay sitio.

**Esta es la tarea que cierra el criterio más importante del tablero.** Hoy publicar no cambia nada para el visitante.

- [ ] **Step 1: Reescribir la página**

La landing actual (logo, formulario de presupuesto, botones) **no se borra**: se mueve tal cual a un componente y se usa como respaldo. El encabezado y los botones de la landing sí se sacan, porque ahora los pone el armazón.

Crear `app/w/[workspaceSlug]/presupuesto-landing.tsx` con el `<main>` de la página actual (el formulario), recibiendo `workspaceSlug`, `commercialName` y `form` por props. **Copiá el JSX existente; no lo reescribas de memoria.**

Y dejar `app/w/[workspaceSlug]/page.tsx` así:

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { loadPublicSite } from "@/lib/website/public-site";
import { WebsitePageRenderer } from "@/components/website/render/website-page-renderer";
import { PresupuestoLanding } from "./presupuesto-landing";

type Props = { params: Promise<{ workspaceSlug: string }> };

/**
 * La portada de la institución.
 *
 * Con sitio publicado, es el sitio que el dueño armó. Sin sitio publicado — porque el módulo
 * está apagado o porque nunca publicó — sigue siendo la landing de presupuesto de siempre, que
 * es lo que hay hoy en producción y lo que la gente ya comparte por WhatsApp. Ese respaldo es
 * deliberado: publicar el sitio nuevo no puede dejar sin puerta a quien todavía no lo armó.
 */
export default async function PublicWorkspaceHomePage({ params }: Props) {
  const { workspaceSlug } = await params;
  const site = await loadPublicSite(workspaceSlug);
  if (!site) notFound();

  if (site.hasPublishedSite) {
    return (
      <WebsitePageRenderer blocks={site.homeBlocks} colors={site.colors} designPresets={site.designPresets} />
    );
  }

  const form = await prisma.serviceLeadForm.findFirst({
    where: { workspaceId: site.workspaceId, slug: "general", isActive: true },
    select: { id: true, slug: true, title: true, description: true, configJson: true },
  });

  return <PresupuestoLanding workspaceSlug={workspaceSlug} commercialName={site.commercialName} form={form} />;
}
```

- [ ] **Step 2: Verificar los dos caminos en el navegador**

Con el servidor levantado:

1. **Con sitio publicado** — la SFPR tiene uno desde el 28/08. Abrí su `/w/<slug>` y confirmá que se ven sus secciones, no el formulario. Sacá una captura.
2. **Sin sitio publicado** — abrí el `/w/<slug>` de un workspace que no publicó y confirmá que sigue apareciendo el formulario de presupuesto, ahora con encabezado y pie alrededor.

Si no sabés qué slugs usar, buscalos en la base por MCP con `branch_id` explícito. No inventes slugs.

- [ ] **Step 3: Correr la suite**

Run: `pnpm test`
Expected: 0 fallos.

- [ ] **Step 4: Commitear**

```bash
git add "app/w/[workspaceSlug]/page.tsx" "app/w/[workspaceSlug]/presupuesto-landing.tsx"
git commit -m "Que el visitante vea por fin el sitio que la institución publicó"
```

---

## Task 9: Las páginas de módulos, adentro del sitio

**Files:**
- Modify: `app/w/[workspaceSlug]/cursos/page.tsx`
- Modify: `app/w/[workspaceSlug]/asociarse/page.tsx`
- Modify: `app/w/[workspaceSlug]/reservas/page.tsx`

**Interfaces:**
- Consumes: `isModuleEnabledForWorkspace`, las constantes de módulo.
- Produces: las tres páginas sin cabecera propia y las tres verificando su módulo.

**Dos defectos que esta tarea corrige**, encontrados al planificar: `cursos` y `asociarse` **no verifican que su módulo esté habilitado**. Con la dirección exacta se entra aunque esté apagado. `reservas` sí lo hace, y es el modelo a copiar.

- [ ] **Step 1: Confirmar el defecto antes de tocar nada**

Run: `grep -n "isModuleEnabledForWorkspace" "app/w/[workspaceSlug]/cursos/page.tsx" "app/w/[workspaceSlug]/asociarse/page.tsx" "app/w/[workspaceSlug]/reservas/page.tsx"`
Expected: sólo `reservas` aparece. Si las tres aparecen, alguien ya lo arregló: saltá la parte del gating y hacé sólo la del encabezado.

- [ ] **Step 2: Agregar la verificación de módulo a cursos**

En `app/w/[workspaceSlug]/cursos/page.tsx`, justo después de `if (!branding) notFound();`:

```tsx
  // Sin el módulo habilitado esta página no existe — antes se entraba igual con la dirección
  // exacta. Mismo criterio que /reservas.
  if (!(await isModuleEnabledForWorkspace(branding.workspaceId, COURSES_SALES_MODULE_KEY))) notFound();
```

Con sus imports:

```tsx
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
```

- [ ] **Step 3: Lo mismo en asociarse, con `MEMBERS_MODULE_KEY`**

```tsx
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
```

```tsx
  if (!(await isModuleEnabledForWorkspace(branding.workspaceId, MEMBERS_MODULE_KEY))) notFound();
```

- [ ] **Step 4: Sacarles la cabecera propia a las tres**

En cada una, el `<div className="min-h-screen bg-[var(--fo-bg)] ...">` exterior y el `<header>` con el nombre de la institución ya los pone el armazón. Quitalos y dejá que la página empiece por su `<main>` o su contenido. Conservá el `<h1>` de la página ("Cursos", "Reservas", "Asociarse") — eso es el título de la página, no la cabecera del sitio.

Ojo: no borres la clase de ancho máximo ni el padding del contenido. Lo único que se va es el envoltorio de pantalla completa y el bloque de marca duplicado.

- [ ] **Step 5: Verificar en el navegador**

1. `/w/<slug>/cursos` con el módulo habilitado: se ve dentro del sitio, con un solo encabezado (no dos) y con pie.
2. El mismo con el módulo apagado: devuelve 404.
3. Idem `/asociarse` y `/reservas`.

Para apagar un módulo, usá la pantalla de administración de módulos; no toques la base a mano.

- [ ] **Step 6: Correr la suite**

Run: `pnpm test`
Expected: 0 fallos.

- [ ] **Step 7: Commitear**

```bash
git add "app/w/[workspaceSlug]/cursos/page.tsx" "app/w/[workspaceSlug]/asociarse/page.tsx" "app/w/[workspaceSlug]/reservas/page.tsx"
git commit -m "Meter las páginas de los módulos adentro del sitio, y cerrarlas si el módulo está apagado"
```

---

## Task 10: El 404 del sitio

**Files:**
- Create: `app/w/[workspaceSlug]/not-found.tsx`

**Interfaces:**
- Consumes: nada. Es deliberadamente independiente.
- Produces: la pantalla que se ve cuando una página de `/w/[slug]` llama a `notFound()`.

- [ ] **Step 1: Leer la guía antes de escribir**

Run: `sed -n 1,50p node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md`

Lo que importa: `not-found.tsx` se dibuja dentro del layout de su segmento, y **no recibe `params`**.

- [ ] **Step 2: Escribir el 404**

Crear `app/w/[workspaceSlug]/not-found.tsx`:

```tsx
/**
 * El 404 de lo público de un workspace. Next lo dibuja DENTRO del layout de este segmento, así
 * que hereda el encabezado, el pie y los colores del sitio sin hacer nada.
 *
 * No recibe `params`, así que no puede armar un enlace a `/w/<slug>`: por eso el botón de
 * volver usa el historial del navegador y no una dirección construida a mano.
 *
 * Ojo: cuando el layout mismo hace notFound() (slug inexistente) no hay sitio que heredar y
 * esta pantalla se ve con los colores por defecto. Es correcto: ese workspace no existe.
 */
export default function PublicWorkspaceNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center" style={{ color: "var(--wsite-text)" }}>
      <p className="text-sm font-semibold uppercase tracking-widest opacity-60">Error 404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--wsite-heading-font)" }}>
        Esta página no existe
      </h1>
      <p className="mt-4 leading-relaxed opacity-70">
        Puede que el enlace esté mal escrito, o que la página ya no esté disponible.
      </p>
      <a
        href="/"
        className="mt-8 inline-block text-sm"
        style={{
          backgroundColor: "var(--wsite-accent)",
          color: "#ffffff",
          borderRadius: "var(--wsite-button-radius)",
          paddingInline: "var(--wsite-button-padding-x)",
          paddingBlock: "var(--wsite-button-padding-y)",
          fontWeight: "var(--wsite-button-weight)",
        }}
      >
        Ir al inicio
      </a>
    </div>
  );
}
```

- [ ] **Step 3: Verificar en el navegador**

1. `/w/<slug>/no-existe-esta-pagina` → se ve el 404 con encabezado y pie del sitio.
2. `/w/slug-que-no-existe` → se ve el 404 sin el armazón (el layout no pudo resolver el sitio). No debe ser una pantalla rota ni un error del servidor.
3. Capturá las dos.

- [ ] **Step 4: Commitear**

```bash
git add "app/w/[workspaceSlug]/not-found.tsx"
git commit -m "Dar al sitio su propia pantalla de página no encontrada"
```

---

## Cierre de la etapa

- [ ] **Correr la suite completa**

Run: `pnpm test`
Expected: 3063 pruebas o más (las de esta etapa suman ~28), 0 fallos.

Run: `pnpm lint`
Expected: sin errores.

- [ ] **Recorrer el sitio en el navegador y capturar**

Con el servidor levantado, y en ancho de escritorio y de teléfono:
Inicio con sitio publicado · Inicio sin sitio publicado · una página de módulo · el menú de celular abierto · el 404.

**No declares la etapa terminada sin haber visto esas cinco pantallas andando.** El criterio del tablero dice "probado", y probado significa mirado.

- [ ] **Actualizar el tablero de avance**

En `docs/estado-de-obra/fotoffice/sitio-web.json`, pasar a `probado` los criterios que quedaron demostrados, con su evidencia — la evidencia es obligatoria y tiene que decir qué se miró:

- "Un visitante entra a la dirección de la institución y ve el sitio publicado"
- "El sitio tiene su pie de página con el contacto y las redes de la institución"
- "El menú del sitio se puede usar desde un celular"
- "Las páginas de cursos, reservas y asociarse se ven adentro del sitio, con su mismo encabezado y su menú"
- "El menú muestra sólo los módulos que la institución tiene habilitados"

Cada uno con `implementado: { pr: <número>, fecha: "2026-09-21" }`.

Después: `node ../../scripts/estado-de-obra.mjs` desde `apps/fotoffice`, o `pnpm estado` desde la raíz.

**Antes de regenerar `tablero.html`, mirá si hay cambios sin commitear en `docs/estado-de-obra/` de otra sesión**: regenerarlo desde una copia incompleta borra auditorías ajenas. Ya pasó una vez.

- [ ] **Abrir el PR**

Con el resumen de lo que se hizo y las capturas de las cinco pantallas.
