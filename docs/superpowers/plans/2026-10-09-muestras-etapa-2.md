# Muestras Fotográficas — Etapa 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sumar a `muestrasfotograficas.com` un panel lateral para toda persona con sesión (con todas las funcionalidades a la vista), la página pública de cada obra, las fichas de sala con QR en PDF y el perfil público del fotógrafo con "Fotógrafos que expusieron".

**Architecture:** Igual que la etapa 1: reglas puras en `packages/muestras` (secciones del panel, visibilidad de una obra, slugs y vínculos de perfil) testeadas con vitest; la app `apps/muestras` es una capa delgada sobre `@repo/db`. El panel vive en `app/panel/…` debajo del encabezado público; las URLs viejas redirigen desde `next.config.ts`. Las fichas se arman en un route handler con `pdf-lib` y `qrcode` (QR vectorial). Una tabla nueva `PhotographerProfile` y una columna `CulturalActivityWork.authorProfileId`, con migración escrita a mano.

**Tech Stack:** Next.js 16.2.1 (App Router, `params` como Promise, `--webpack`), React 19.2.4, Prisma (`@repo/db`), Tailwind 4, sharp 0.34, pdf-lib 1.17.1, qrcode 1.5.4, vitest 3.

**Spec:** `docs/superpowers/specs/2026-10-09-muestras-etapa-2-design.md` (decisiones D1–D16). Diseño general: `docs/superpowers/specs/2026-10-08-muestras-fotograficas-design.md`.

## Global Constraints

- Todo texto visible y todo comentario en **español rioplatense**; identificadores en inglés dentro de `packages/muestras`, en español en la app (como en la etapa 1).
- Estados y tipos como **texto** (`String`), nunca enum de Prisma. Ids de usuario `Int` **sin relación Prisma a `User`**.
- Fechas en **hora argentina (UTC−3)** con las funciones de `@repo/muestras` (`formatArDay`, `temporalStatus`, `dayStartAr`…). Nunca `toLocaleDateString` sin zona.
- Imágenes en el bucket R2 de FOTOFFICE bajo **`muestras/<userId>/`**, achicadas a WebP 82. Sólo se aceptan URLs propias (`esImagenPropia`).
- **Dependencias nuevas sólo con versiones del lockfile:** `pdf-lib ^1.17.1` (resuelve 1.17.1), `qrcode ^1.5.4`, `@types/qrcode ^1.5.6`. Después de `pnpm install`, `git diff pnpm-lock.yaml` sólo puede tocar el importer `apps/muestras`; si se mueve otra cosa, frenar y avisar.
- Chequeos de tipos y build con `NODE_OPTIONS=--max-old-space-size=8192` (si no, el proceso muere por memoria y a veces devuelve éxito igual).
- Diseño: tokens de `apps/muestras/app/globals.css` (`--mf-bg`, `--mf-ink`, `--mf-muted`, `--mf-line`, `--mf-surface`, `--mf-teal`, `--mf-spot`, `--mf-alerta`), títulos con `.mf-titulo`, contenedor `.mf-marco`, separaciones con líneas finas (`border-[var(--mf-line)]`), botones "finos" (`h-11 border border-[var(--mf-ink)] px-5`), esquinas `rounded-[2px]`. Nada de cajas de color.
- **Autorización del lado del servidor en cada página, acción y ruta.** El layout del panel no cuenta como control: cada `page.tsx` del panel llama `requireUsuario`/`requireSuperAdmin`, cada server action vuelve a leer la sesión.
- En páginas públicas **no** aparecen palabras de revisión ni aprobación ("aprobada", "en revisión", "revisamos").
- Visibilidad de obras: **una sola regla** (`visibleWorks` → `workAccess` / `profileWorksInActivity`). Ninguna página pública muestra la imagen de una obra que la galería todavía reserva para la visita.
- Puerto de desarrollo **3014**. Probar con `next dev` (las vistas previas de Vercel no sirven).
- Trabajar en el worktree `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-muestras`, rama `feat/muestras-etapa-2`.
- La migración **no se aplica sola**: se corre a mano en producción **con permiso explícito de Daniel**, se registra en `_prisma_migrations` con el SHA-256 del archivo, y **antes** de publicar el código (una columna que falte rompe todas las consultas de obras).

## Mapa de archivos

```
packages/muestras/src/
  panel.ts (+ panel.test.ts)               — secciones por rol, sección activa, resumen por estado
  work-access.ts (+ .test.ts)              — obra completa / sólo ficha / no existe; URL pública
  profile.ts (+ .test.ts)                  — slug del perfil, Instagram, web, nombres, vínculo por defecto, obras de un perfil
  index.ts                                 — reexporta los tres
packages/db/prisma/schema.prisma           — PhotographerProfile + CulturalActivityWork.authorProfileId
packages/db/prisma/migrations/20261027120000_muestras_etapa_2_perfiles/migration.sql
apps/muestras/
  package.json                             — pdf-lib, qrcode, @types/qrcode
  next.config.ts                           — redirects de las URLs viejas
  app/panel/layout.tsx                     — barra lateral + contenido
  app/panel/page.tsx                       — Inicio
  app/panel/[seccion]/page.tsx             — "En preparación"
  app/panel/muestras/page.tsx              — (movido de app/mis-muestras/page.tsx)
  app/panel/muestras/[id]/page.tsx         — (movido de app/mis-muestras/[id]/page.tsx) + fichas
  app/panel/proponer/page.tsx              — (movido de app/proponer/page.tsx)
  app/panel/revision/page.tsx              — (movido de app/admin/page.tsx)
  app/panel/perfil/page.tsx                — Mi perfil de fotógrafo
  app/panel/montaje/page.tsx               — Montaje e impresión (fichas)
  app/api/fichas/[id]/route.ts             — PDF de fichas
  app/m/[slug]/o/[workId]/page.tsx         — página de la obra
  app/fotografos/page.tsx, app/fotografos/[slug]/page.tsx
  components/panel/barra-lateral.tsx, components/panel/descargar-fichas.tsx
  components/perfil/formulario-perfil.tsx, components/perfil/obras-vinculadas.tsx
  components/formulario/vincular-perfil.tsx
  components/encabezado/encabezado.tsx, components/pie/pie.tsx, components/ficha/galeria.tsx,
  components/formulario/obras.tsx, components/formulario/formulario-actividad.tsx,
  components/formulario/subir-imagen.ts    — modificados
  lib/panel/en-preparacion.ts (+ .test.ts)
  lib/perfiles/consultas.ts, lib/perfiles/mapear.ts (+ .test.ts), lib/perfiles/acciones.ts (+ .test.ts)
  lib/fichas/texto.ts (+ .test.ts), lib/fichas/qr.ts (+ .test.ts), lib/fichas/pdf.ts (+ .test.ts),
  lib/fichas/cargar.ts (+ .test.ts)
  lib/actividades/{consultas,mapear,acciones}.ts, lib/imagenes/procesar.ts, lib/limite.ts,
  lib/usuario.ts, lib/correos/enviar.ts, app/login/page.tsx,
  app/api/auth/google/callback/route.ts, app/api/imagenes/route.ts, app/m/[slug]/page.tsx — modificados
```

Orden: 1 → 2 → 3 (schema) → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11. Las tareas 6 a 10 usan el cliente Prisma con el modelo nuevo (Task 3).

---

### Task 1: Reglas del panel (secciones por rol y resumen por estado)

**Files:**
- Create: `packages/muestras/src/panel.ts`
- Modify: `packages/muestras/src/index.ts`
- Test: `packages/muestras/src/panel.test.ts`

**Interfaces:**
- Consumes: `REVIEW_STATUSES`, `ReviewStatus` (etapa 1, `constants.ts`).
- Produces:
  - `PANEL_GROUPS = ["CUENTA","ORGANIZAR","ADMIN"]`, `PanelGroup`, `PANEL_GROUP_LABELS`
  - `PanelSectionKey = "inicio"|"muestras"|"proponer"|"perfil"|"convocatorias"|"curaduria"|"montaje"|"ventas"|"estadisticas"|"revision"`
  - `PanelSection = { key; label; href; group; ready: boolean; superAdminOnly: boolean }`, `PANEL_SECTIONS`
  - `panelSections(actor: { isSuperAdmin: boolean }): PanelSection[]`
  - `PanelSectionGroup = { group: PanelGroup; label: string; sections: PanelSection[] }`, `groupedPanelSections(actor): PanelSectionGroup[]`
  - `upcomingSection(key: string): PanelSection | null` (sólo las `ready: false`)
  - `activeSectionKey(pathname: string): PanelSectionKey | null`
  - `countByStatus(rows: ReadonlyArray<{ reviewStatus: string }>): Record<ReviewStatus, number>`

- [ ] **Step 1: Escribir el test que falla**

`packages/muestras/src/panel.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  PANEL_SECTIONS, activeSectionKey, countByStatus, groupedPanelSections, panelSections, upcomingSection,
} from "./panel";

describe("secciones del panel", () => {
  it("una persona común ve todo menos Revisión", () => {
    expect(panelSections({ isSuperAdmin: false }).map((s) => s.key)).toEqual([
      "inicio", "muestras", "proponer", "perfil", "convocatorias", "curaduria", "montaje", "ventas", "estadisticas",
    ]);
  });
  it("el super admin ve también Revisión", () => {
    expect(panelSections({ isSuperAdmin: true }).map((s) => s.key)).toContain("revision");
  });
  it("agrupa en el orden de la barra y omite los grupos vacíos", () => {
    expect(groupedPanelSections({ isSuperAdmin: false }).map((g) => g.label)).toEqual(["Tu cuenta", "Para organizar"]);
    expect(groupedPanelSections({ isSuperAdmin: true }).map((g) => g.label)).toEqual(["Tu cuenta", "Para organizar", "Administración"]);
  });
  it("están todas las funcionalidades del organizador, construidas o no", () => {
    expect(PANEL_SECTIONS.filter((s) => s.group === "ORGANIZAR").map((s) => s.label)).toEqual([
      "Convocatorias", "Curaduría", "Montaje e impresión", "Ventas", "Estadísticas",
    ]);
  });
  it("cada sección tiene un href único bajo /panel", () => {
    const hrefs = PANEL_SECTIONS.map((s) => s.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.every((h) => h === "/panel" || h.startsWith("/panel/"))).toBe(true);
  });
  it("upcomingSection devuelve sólo las que están en preparación", () => {
    expect(upcomingSection("ventas")?.label).toBe("Ventas");
    expect(upcomingSection("montaje")).toBeNull();
    expect(upcomingSection("revision")).toBeNull();
    expect(upcomingSection("cualquiera")).toBeNull();
  });
});

describe("sección activa", () => {
  it("/panel es Inicio, con o sin barra final", () => {
    expect(activeSectionKey("/panel")).toBe("inicio");
    expect(activeSectionKey("/panel/")).toBe("inicio");
  });
  it("una subruta marca su sección", () => expect(activeSectionKey("/panel/muestras/abc")).toBe("muestras"));
  it("no confunde prefijos", () => expect(activeSectionKey("/panel/muestrasx")).toBeNull());
  it("fuera del panel no hay sección activa", () => expect(activeSectionKey("/m/una-muestra")).toBeNull());
});

describe("resumen por estado", () => {
  it("cuenta cada estado y arranca todos en cero", () => {
    const r = countByStatus([{ reviewStatus: "DRAFT" }, { reviewStatus: "APPROVED" }, { reviewStatus: "APPROVED" }, { reviewStatus: "RARO" }]);
    expect(r).toEqual({ DRAFT: 1, IN_REVIEW: 0, APPROVED: 2, REJECTED: 0, UNPUBLISHED: 0 });
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter @repo/muestras test`
Expected: FAIL — `Failed to resolve import "./panel"`.

- [ ] **Step 3: Implementar**

`packages/muestras/src/panel.ts`:
```ts
import { REVIEW_STATUSES, type ReviewStatus } from "./constants";

/**
 * Las secciones del panel de cada persona con sesión.
 *
 * Daniel pidió que todas las funcionalidades estén a la vista, construidas o no: las que todavía
 * no existen (`ready: false`) abren una página que explica qué van a hacer.
 */
export const PANEL_GROUPS = ["CUENTA", "ORGANIZAR", "ADMIN"] as const;
export type PanelGroup = (typeof PANEL_GROUPS)[number];

export const PANEL_GROUP_LABELS: Record<PanelGroup, string> = {
  CUENTA: "Tu cuenta",
  ORGANIZAR: "Para organizar",
  ADMIN: "Administración",
};

export type PanelSectionKey =
  | "inicio" | "muestras" | "proponer" | "perfil"
  | "convocatorias" | "curaduria" | "montaje" | "ventas" | "estadisticas"
  | "revision";

export type PanelSection = {
  key: PanelSectionKey;
  label: string;
  href: string;
  group: PanelGroup;
  ready: boolean;
  superAdminOnly: boolean;
};

const s = (key: PanelSectionKey, label: string, href: string, group: PanelGroup, ready = true, superAdminOnly = false): PanelSection =>
  ({ key, label, href, group, ready, superAdminOnly });

export const PANEL_SECTIONS: readonly PanelSection[] = [
  s("inicio", "Inicio", "/panel", "CUENTA"),
  s("muestras", "Mis muestras", "/panel/muestras", "CUENTA"),
  s("proponer", "Proponer muestra", "/panel/proponer", "CUENTA"),
  s("perfil", "Mi perfil de fotógrafo", "/panel/perfil", "CUENTA"),
  s("convocatorias", "Convocatorias", "/panel/convocatorias", "ORGANIZAR", false),
  s("curaduria", "Curaduría", "/panel/curaduria", "ORGANIZAR", false),
  s("montaje", "Montaje e impresión", "/panel/montaje", "ORGANIZAR"),
  s("ventas", "Ventas", "/panel/ventas", "ORGANIZAR", false),
  s("estadisticas", "Estadísticas", "/panel/estadisticas", "ORGANIZAR", false),
  s("revision", "Revisión", "/panel/revision", "ADMIN", true, true),
];

export function panelSections(actor: { isSuperAdmin: boolean }): PanelSection[] {
  return PANEL_SECTIONS.filter((x) => !x.superAdminOnly || actor.isSuperAdmin);
}

export type PanelSectionGroup = { group: PanelGroup; label: string; sections: PanelSection[] };

export function groupedPanelSections(actor: { isSuperAdmin: boolean }): PanelSectionGroup[] {
  const visibles = panelSections(actor);
  return PANEL_GROUPS
    .map((group) => ({ group, label: PANEL_GROUP_LABELS[group], sections: visibles.filter((x) => x.group === group) }))
    .filter((g) => g.sections.length > 0);
}

/** La sección "en preparación" que corresponde a `/panel/<key>`; cualquier otra cosa es 404. */
export function upcomingSection(key: string): PanelSection | null {
  return PANEL_SECTIONS.find((x) => x.key === key && !x.ready) ?? null;
}

export function activeSectionKey(pathname: string): PanelSectionKey | null {
  const limpio = pathname.replace(/\/+$/, "") || "/";
  if (limpio === "/panel") return "inicio";
  const hallada = PANEL_SECTIONS.find((x) => x.href !== "/panel" && (limpio === x.href || limpio.startsWith(`${x.href}/`)));
  return hallada?.key ?? null;
}

/** Cuántas actividades hay en cada estado. Un estado desconocido no se cuenta. */
export function countByStatus(rows: ReadonlyArray<{ reviewStatus: string }>): Record<ReviewStatus, number> {
  const cuenta = Object.fromEntries(REVIEW_STATUSES.map((st) => [st, 0])) as Record<ReviewStatus, number>;
  for (const r of rows) {
    if ((REVIEW_STATUSES as readonly string[]).includes(r.reviewStatus)) cuenta[r.reviewStatus as ReviewStatus] += 1;
  }
  return cuenta;
}
```

Agregar al final de `packages/muestras/src/index.ts`:
```ts
export * from "./panel";
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types`
Expected: PASS (los tests nuevos y los de la etapa 1), sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add packages/muestras/src/panel.ts packages/muestras/src/panel.test.ts packages/muestras/src/index.ts
git commit -m "Reglas del panel de Muestras: secciones por rol y resumen por estado"
```

---

### Task 2: Reglas de la obra pública y del perfil del fotógrafo

**Files:**
- Create: `packages/muestras/src/work-access.ts`, `packages/muestras/src/profile.ts`
- Modify: `packages/muestras/src/index.ts`
- Test: `packages/muestras/src/work-access.test.ts`, `packages/muestras/src/profile.test.ts`

**Interfaces:**
- Consumes: `visibleWorks` (etapa 1, `gallery.ts`), `GalleryMode`.
- Produces (`work-access.ts`):
  - `WorkAccess = "FULL" | "TEASER"`
  - `workAccess(a: { galleryMode; startsAt; endsAt }, works: W[], workId: string, now: Date): WorkAccess | null` con `W extends { id: string; isHighlight: boolean; sortOrder: number }`
  - `workPath(slug, workId): string` → `/m/<slug>/o/<workId>`; `workUrl(baseUrl, slug, workId): string`
  - `neighborWorks(visible: W[], workId): { prev: W | null; next: W | null }`
- Produces (`profile.ts`):
  - `PROFILE_SLUG_MIN = 3`, `PROFILE_SLUG_MAX = 40`, `RESERVED_PROFILE_SLUGS`
  - `normalizeProfileSlug(raw): string`, `profileSlugBase(displayName): string`, `profileSlugProblem(slug): string | null`, `freeProfileSlug(base, taken: ReadonlySet<string>): string`
  - `normalizeInstagram(raw): string | null`, `normalizeWebsite(raw): string | null`
  - `normalizeName(s): string`, `sameName(a, b): boolean`
  - `resolveAuthorProfileId(work: { isNew: boolean; authorName: string; requestedProfileId: string | null }, existingIds: ReadonlySet<string>, own: { id: string; displayName: string } | null): string | null`
  - `profileWorksInActivity(a, works: W[], profileId, now): { visible: W[]; hiddenCount: number }` con `W extends { id; isHighlight; sortOrder; authorProfileId: string | null }`

- [ ] **Step 1: Escribir los tests que fallan**

`packages/muestras/src/work-access.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { dayEndAr, dayStartAr } from "./dates";
import { neighborWorks, workAccess, workPath, workUrl } from "./work-access";

const a = { galleryMode: "HIGHLIGHTS_UNTIL_CLOSED", startsAt: dayStartAr("2026-11-05"), endsAt: dayEndAr("2026-11-20") };
const obras = [
  { id: "w1", isHighlight: true, sortOrder: 0 },
  { id: "w2", isHighlight: false, sortOrder: 1 },
];
const antes = new Date("2026-11-01T15:00:00Z");
const abierta = new Date("2026-11-10T15:00:00Z");
const cerrada = new Date("2026-11-25T15:00:00Z");

describe("acceso a una obra", () => {
  it("una destacada se ve completa mientras la muestra está abierta", () => expect(workAccess(a, obras, "w1", abierta)).toBe("FULL"));
  it("una no destacada queda sólo como ficha mientras está abierta", () => expect(workAccess(a, obras, "w2", abierta)).toBe("TEASER"));
  it("y también antes de abrir", () => expect(workAccess(a, obras, "w2", antes)).toBe("TEASER"));
  it("al cerrar se ven todas", () => expect(workAccess(a, obras, "w2", cerrada)).toBe("FULL"));
  it("en modo completa se ven todas desde el principio", () => {
    expect(workAccess({ ...a, galleryMode: "FULL" }, obras, "w2", antes)).toBe("FULL");
  });
  it("sin destacadas se ven las primeras 12, igual que en la galería", () => {
    const muchas = Array.from({ length: 14 }, (_, i) => ({ id: `w${i}`, isHighlight: false, sortOrder: i }));
    expect(workAccess(a, muchas, "w11", abierta)).toBe("FULL");
    expect(workAccess(a, muchas, "w12", abierta)).toBe("TEASER");
  });
  it("una obra que no es de esta muestra no existe", () => expect(workAccess(a, obras, "otra", cerrada)).toBeNull());
});

describe("dirección de la obra", () => {
  it("arma la ruta y la URL sin barras dobles", () => {
    expect(workPath("miradas-abc123", "clx9")).toBe("/m/miradas-abc123/o/clx9");
    expect(workUrl("https://muestrasfotograficas.com/", "miradas-abc123", "clx9")).toBe("https://muestrasfotograficas.com/m/miradas-abc123/o/clx9");
  });
});

describe("anterior y siguiente", () => {
  const v = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("en el medio tiene las dos", () => expect(neighborWorks(v, "b")).toEqual({ prev: { id: "a" }, next: { id: "c" } }));
  it("en los bordes, una sola", () => {
    expect(neighborWorks(v, "a")).toEqual({ prev: null, next: { id: "b" } });
    expect(neighborWorks(v, "c")).toEqual({ prev: { id: "b" }, next: null });
  });
  it("si la obra no está entre las visibles, ninguna", () => expect(neighborWorks(v, "z")).toEqual({ prev: null, next: null }));
});
```

`packages/muestras/src/profile.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { dayEndAr, dayStartAr } from "./dates";
import {
  freeProfileSlug, normalizeInstagram, normalizeProfileSlug, normalizeWebsite, profileSlugBase, profileSlugProblem,
  profileWorksInActivity, resolveAuthorProfileId, sameName,
} from "./profile";

describe("slug del perfil", () => {
  it("sale del nombre, sin acentos", () => expect(profileSlugBase("José María Pérez")).toBe("jose-maria-perez"));
  it("un nombre muy corto se completa", () => expect(profileSlugBase("Al")).toBe("al-foto"));
  it("un nombre sin letras usables da uno genérico", () => expect(profileSlugBase("¡¡¡")).toBe("fotografo"));
  it("una palabra reservada se completa", () => expect(profileSlugBase("Panel")).toBe("panel-foto"));
  it("se corta en 40 sin guion final", () => {
    const s = profileSlugBase("Ana ".repeat(20));
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith("-")).toBe(false);
  });
  it("normaliza lo que escribe la persona", () => expect(normalizeProfileSlug("  Ana Pérez ")).toBe("ana-perez"));
  it("explica qué está mal", () => {
    expect(profileSlugProblem("ab")).toMatch(/entre 3 y 40/);
    expect(profileSlugProblem("ana--perez")).toMatch(/letras sin acentos/);
    expect(profileSlugProblem("panel")).toMatch(/reservada/);
    expect(profileSlugProblem("ana-perez")).toBeNull();
  });
  it("busca el primero libre", () => {
    expect(freeProfileSlug("ana", new Set())).toBe("ana");
    expect(freeProfileSlug("ana", new Set(["ana", "ana-2"]))).toBe("ana-3");
    const largo = "a".repeat(40);
    expect(freeProfileSlug(largo, new Set([largo]))).toBe(`${"a".repeat(38)}-2`);
  });
});

describe("enlaces del perfil", () => {
  it("Instagram acepta @usuario y la URL del perfil", () => {
    expect(normalizeInstagram("@Ana.Perez")).toBe("ana.perez");
    expect(normalizeInstagram("https://www.instagram.com/ana_perez/?hl=es")).toBe("ana_perez");
    expect(normalizeInstagram("con espacio")).toBeNull();
    expect(normalizeInstagram("  ")).toBeNull();
  });
  it("el sitio web se completa con https y descarta lo que no es web", () => {
    expect(normalizeWebsite("ejemplo.com")).toBe("https://ejemplo.com/");
    expect(normalizeWebsite("http://ejemplo.com/obra")).toBe("http://ejemplo.com/obra");
    expect(normalizeWebsite("javascript:alert(1)")).toBeNull();
    expect(normalizeWebsite("ftp://ejemplo.com")).toBeNull();
    expect(normalizeWebsite("localhost")).toBeNull();
  });
});

describe("vínculo de una obra con un perfil", () => {
  const propio = { id: "p-ana", displayName: "Ana Pérez" };
  it("compara nombres sin mayúsculas, acentos ni espacios de más", () => {
    expect(sameName("  ANA   perez", "Ana Pérez")).toBe(true);
    expect(sameName("", "")).toBe(false);
  });
  it("respeta un perfil pedido que existe", () => {
    expect(resolveAuthorProfileId({ isNew: false, authorName: "x", requestedProfileId: "p-otro" }, new Set(["p-otro"]), propio)).toBe("p-otro");
  });
  it("descarta un perfil pedido que no existe", () => {
    expect(resolveAuthorProfileId({ isNew: true, authorName: "Ana Pérez", requestedProfileId: "p-falso" }, new Set(), propio)).toBeNull();
  });
  it("una obra nueva con el nombre del perfil propio se vincula sola", () => {
    expect(resolveAuthorProfileId({ isNew: true, authorName: "ana perez", requestedProfileId: null }, new Set(), propio)).toBe("p-ana");
  });
  it("una obra que ya existía no se vuelve a vincular sola (respeta un desvínculo)", () => {
    expect(resolveAuthorProfileId({ isNew: false, authorName: "Ana Pérez", requestedProfileId: null }, new Set(), propio)).toBeNull();
  });
  it("otro nombre queda como texto libre", () => {
    expect(resolveAuthorProfileId({ isNew: true, authorName: "Luis Gómez", requestedProfileId: null }, new Set(), propio)).toBeNull();
  });
});

describe("obras de un perfil en una muestra", () => {
  const a = { galleryMode: "HIGHLIGHTS_UNTIL_CLOSED", startsAt: dayStartAr("2026-11-05"), endsAt: dayEndAr("2026-11-20") };
  const obras = [
    { id: "w1", isHighlight: true, sortOrder: 0, authorProfileId: "p" },
    { id: "w2", isHighlight: false, sortOrder: 1, authorProfileId: "p" },
    { id: "w3", isHighlight: true, sortOrder: 2, authorProfileId: "otro" },
  ];
  it("abierta: muestra sólo lo que la galería deja ver y cuenta el resto", () => {
    const r = profileWorksInActivity(a, obras, "p", new Date("2026-11-10T15:00:00Z"));
    expect(r.visible.map((w) => w.id)).toEqual(["w1"]);
    expect(r.hiddenCount).toBe(1);
  });
  it("cerrada: todas las suyas", () => {
    const r = profileWorksInActivity(a, obras, "p", new Date("2026-11-25T15:00:00Z"));
    expect(r.visible.map((w) => w.id)).toEqual(["w1", "w2"]);
    expect(r.hiddenCount).toBe(0);
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter @repo/muestras test`
Expected: FAIL — no se resuelven `./work-access` ni `./profile`.

- [ ] **Step 3: Implementar**

`packages/muestras/src/work-access.ts`:
```ts
import type { GalleryMode } from "./constants";
import { visibleWorks } from "./gallery";

/**
 * Qué se ve de una obra en su página pública.
 *
 * `FULL`: la imagen y los datos. `TEASER`: sólo los datos, sin la imagen, porque la galería
 * todavía la reserva para la visita. No es un 404 a propósito: el QR de la ficha de sala lleva
 * acá y se escanea durante la muestra, frente a la obra. La regla es la misma de la galería
 * (`visibleWorks`), así que galería, página de obra y perfil nunca se contradicen.
 */
export type WorkAccess = "FULL" | "TEASER";

type Gallery = { galleryMode: GalleryMode | string; startsAt: Date; endsAt: Date };

export function workAccess<W extends { id: string; isHighlight: boolean; sortOrder: number }>(
  a: Gallery,
  works: W[],
  workId: string,
  now: Date,
): WorkAccess | null {
  if (!works.some((w) => w.id === workId)) return null;
  return visibleWorks(a, works, now).works.some((w) => w.id === workId) ? "FULL" : "TEASER";
}

export function workPath(slug: string, workId: string): string {
  return `/m/${encodeURIComponent(slug)}/o/${encodeURIComponent(workId)}`;
}

export function workUrl(baseUrl: string, slug: string, workId: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${workPath(slug, workId)}`;
}

/** Anterior y siguiente entre las obras que se ven completas, para recorrer sin volver a la ficha. */
export function neighborWorks<W extends { id: string }>(visible: W[], workId: string): { prev: W | null; next: W | null } {
  const i = visible.findIndex((w) => w.id === workId);
  if (i < 0) return { prev: null, next: null };
  return { prev: visible[i - 1] ?? null, next: visible[i + 1] ?? null };
}
```

`packages/muestras/src/profile.ts`:
```ts
import type { GalleryMode } from "./constants";
import { visibleWorks } from "./gallery";

/** Reglas del perfil público del fotógrafo (`/fotografos/<slug>`). */
export const PROFILE_SLUG_MIN = 3;
export const PROFILE_SLUG_MAX = 40;
/** Direcciones que podrían chocar con rutas propias, hoy o más adelante. */
export const RESERVED_PROFILE_SLUGS = ["nuevo", "editar", "panel", "admin", "buscar", "todos", "perfil"] as const;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isReserved = (s: string) => (RESERVED_PROFILE_SLUGS as readonly string[]).includes(s);

function toSlug(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
const cut = (s: string, max: number) => s.slice(0, max).replace(/-+$/g, "");

/** Lo que escribió la persona en "Dirección de tu perfil", llevado a forma de slug. */
export function normalizeProfileSlug(raw: string): string {
  return cut(toSlug(raw), PROFILE_SLUG_MAX);
}

/** El slug que se propone a partir del nombre. Siempre pasa `profileSlugProblem`. */
export function profileSlugBase(displayName: string): string {
  let s = normalizeProfileSlug(displayName);
  if (s.length < PROFILE_SLUG_MIN) s = s ? `${s}-foto` : "fotografo";
  if (isReserved(s)) s = `${s}-foto`;
  return s;
}

/** Qué tiene de malo un slug, en palabras de la persona; `null` si está bien. */
export function profileSlugProblem(slug: string): string | null {
  if (slug.length < PROFILE_SLUG_MIN || slug.length > PROFILE_SLUG_MAX) {
    return `La dirección tiene que tener entre ${PROFILE_SLUG_MIN} y ${PROFILE_SLUG_MAX} caracteres.`;
  }
  if (!SLUG_RE.test(slug)) return "Usá sólo letras sin acentos, números y guiones simples.";
  if (isReserved(slug)) return "Esa dirección está reservada. Elegí otra.";
  return null;
}

/** El primero libre entre `base`, `base-2`, `base-3`… sin pasarse del largo máximo. */
export function freeProfileSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const suffix = `-${n}`;
    const candidate = `${cut(base, PROFILE_SLUG_MAX - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("No hay una dirección libre para este nombre.");
}

/** "@usuario" o la URL del perfil → "usuario". `null` si no parece un usuario de Instagram. */
export function normalizeInstagram(raw: string): string | null {
  const s = raw.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").split(/[/?#]/)[0] ?? "";
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s.toLowerCase() : null;
}

/** Una dirección web http(s) con dominio. Sin esquema se asume https. */
export function normalizeWebsite(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function normalizeName(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function sameName(a: string, b: string): boolean {
  const x = normalizeName(a);
  return x !== "" && x === normalizeName(b);
}

/**
 * A qué perfil queda vinculada una obra al guardar.
 *
 * - Un perfil pedido se respeta sólo si existe.
 * - Una obra **nueva** cuyo autor se llama igual que el perfil de quien propuso la muestra se
 *   vincula sola (el caso común: el fotógrafo carga su propia muestra).
 * - Una obra que ya existía y quedó sin perfil no se vuelve a vincular: alguien la desvinculó.
 */
export function resolveAuthorProfileId(
  work: { isNew: boolean; authorName: string; requestedProfileId: string | null },
  existingIds: ReadonlySet<string>,
  own: { id: string; displayName: string } | null,
): string | null {
  if (work.requestedProfileId) return existingIds.has(work.requestedProfileId) ? work.requestedProfileId : null;
  if (work.isNew && own && sameName(work.authorName, own.displayName)) return own.id;
  return null;
}

/**
 * Las obras de un perfil dentro de una muestra, separadas en las que se pueden mostrar y las
 * que la galería todavía reserva para la visita (sólo se cuentan).
 */
export function profileWorksInActivity<
  W extends { id: string; isHighlight: boolean; sortOrder: number; authorProfileId: string | null },
>(
  a: { galleryMode: GalleryMode | string; startsAt: Date; endsAt: Date },
  works: W[],
  profileId: string,
  now: Date,
): { visible: W[]; hiddenCount: number } {
  const mine = works.filter((w) => w.authorProfileId === profileId).sort((x, y) => x.sortOrder - y.sortOrder);
  const shown = new Set(visibleWorks(a, works, now).works.map((w) => w.id));
  const visible = mine.filter((w) => shown.has(w.id));
  return { visible, hiddenCount: mine.length - visible.length };
}
```

Agregar al final de `packages/muestras/src/index.ts`:
```ts
export * from "./work-access";
export * from "./profile";
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter @repo/muestras lint`
Expected: PASS y sin errores.

- [ ] **Step 5: Commit**

```bash
git add packages/muestras/src
git commit -m "Reglas de la página de cada obra y del perfil del fotógrafo"
```

---

### Task 3: Tabla de perfiles y vínculo de la obra (migración escrita a mano)

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelo `CulturalActivityWork` y modelo nuevo al final)
- Create: `packages/db/prisma/migrations/20261027120000_muestras_etapa_2_perfiles/migration.sql`

**Interfaces:**
- Produces: `prisma.photographerProfile` (campos abajo); `CulturalActivityWork.authorProfileId: string | null` y relación `authorProfile`; `PhotographerProfile.works`.

- [ ] **Step 1: Confirmar el nombre de la migración**

Run: `git fetch origin && git ls-tree --name-only origin/main packages/db/prisma/migrations/ | tail -3`
Expected: la última carpeta es `20261026120000_fotoffice_etapa_4_agenda`. Si apareció una más nueva, usar un timestamp posterior a ella y reemplazar el nombre en todo este plan.

- [ ] **Step 2: Cambiar el schema**

En `model CulturalActivityWork`, debajo de `authorUserId Int?`, agregar:
```prisma
  /// Perfil público del autor (etapa 2). `authorName` queda siempre como respaldo en texto.
  authorProfileId String?
  authorProfile   PhotographerProfile? @relation(fields: [authorProfileId], references: [id], onDelete: SetNull)
```
y junto al índice existente:
```prisma
  @@index([authorProfileId])
```

Al final del archivo:
```prisma
/// Perfil público de un fotógrafo en Muestras Fotográficas (`/fotografos/<slug>`).
///
/// Cada cuenta tiene a lo sumo uno (`userId` único). `userId` es opcional y sin relación a
/// `User` a propósito: más adelante el organizador va a poder crear el perfil de un autor sin
/// cuenta, que el autor reclama al entrar. Mismas convenciones que `CulturalActivity`.
model PhotographerProfile {
  id          String  @id @default(cuid())
  userId      Int?    @unique
  slug        String  @unique
  displayName String
  bio         String?
  city        String?
  province    String?
  /// URL http(s) completa.
  website     String?
  /// Usuario de Instagram sin "@".
  instagram   String?
  avatarUrl   String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  works CulturalActivityWork[]

  @@index([displayName])
}
```

- [ ] **Step 3: Validar y generar el cliente**

Run: `pnpm --filter @repo/db exec prisma validate && pnpm --filter @repo/db exec prisma generate`
Expected: `The schema at ... is valid` y el cliente generado.

- [ ] **Step 4: Escribir la migración**

`packages/db/prisma/migrations/20261027120000_muestras_etapa_2_perfiles/migration.sql`:
```sql
-- Muestras Fotográficas · Etapa 2: perfil público del fotógrafo y vínculo de cada obra.
-- Aditiva: crea la tabla `PhotographerProfile` y agrega una columna opcional a
-- `CulturalActivityWork`. No borra ni actualiza filas.
-- NO SE APLICA SOLA: se corre a mano en la base de FOTOFFICE/FotoRank (Neon
-- `divine-hall-10689679`, rama `development`) con permiso de Daniel, y se registra en
-- `_prisma_migrations` con el SHA-256 de este archivo. Va ANTES de publicar el código.

-- CreateTable
CREATE TABLE "PhotographerProfile" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "city" TEXT,
    "province" TEXT,
    "website" TEXT,
    "instagram" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotographerProfile_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CulturalActivityWork" ADD COLUMN "authorProfileId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PhotographerProfile_userId_key" ON "PhotographerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PhotographerProfile_slug_key" ON "PhotographerProfile"("slug");

-- CreateIndex
CREATE INDEX "PhotographerProfile_displayName_idx" ON "PhotographerProfile"("displayName");

-- CreateIndex
CREATE INDEX "CulturalActivityWork_authorProfileId_idx" ON "CulturalActivityWork"("authorProfileId");

-- AddForeignKey
ALTER TABLE "CulturalActivityWork" ADD CONSTRAINT "CulturalActivityWork_authorProfileId_fkey" FOREIGN KEY ("authorProfileId") REFERENCES "PhotographerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

Compararlo con lo que genera Prisma:

Run: `git show origin/main:packages/db/prisma/schema.prisma > /tmp/schema-antes.prisma && pnpm --filter @repo/db exec prisma migrate diff --from-schema-datamodel /tmp/schema-antes.prisma --to-schema-datamodel prisma/schema.prisma --script`
Expected: las mismas sentencias (el orden puede variar). Si aparece cualquier otra cosa (un `DROP`, otra tabla), frenar y avisar.

- [ ] **Step 5: Comprobar que el resto de la suite compila**

Run: `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice typecheck`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20261027120000_muestras_etapa_2_perfiles
git commit -m "Tabla de perfiles de fotógrafo y vínculo de cada obra (sin aplicar)"
```

(La aplicación en producción está en la Task 11, con permiso.)

---
### Task 4: El panel: layout, barra lateral, Inicio y "En preparación"

**Files:**
- Create: `apps/muestras/app/panel/layout.tsx`, `apps/muestras/app/panel/page.tsx`, `apps/muestras/app/panel/[seccion]/page.tsx`
- Create: `apps/muestras/components/panel/barra-lateral.tsx`
- Create: `apps/muestras/lib/panel/en-preparacion.ts`, `apps/muestras/lib/perfiles/consultas.ts`
- Modify: `apps/muestras/lib/actividades/consultas.ts` (agregar `contarParaRevisar`), `apps/muestras/components/encabezado/encabezado.tsx`
- Test: `apps/muestras/lib/panel/en-preparacion.test.ts`

**Interfaces:**
- Consumes: `groupedPanelSections`, `activeSectionKey`, `upcomingSection`, `countByStatus`, `PANEL_SECTIONS`, `PanelSectionGroup`, `PanelSectionKey` (Task 1); `listarMias` (etapa 1); `prisma.photographerProfile` (Task 3).
- Produces: `EN_PREPARACION: Partial<Record<PanelSectionKey, TextoEnPreparacion>>`, `MONTAJE_EN_PREPARACION: string[]`; `buscarPerfilPropio(userId: number)`; `contarParaRevisar(): Promise<number>`; componente `BarraLateral({ grupos, nombre })`.

- [ ] **Step 1: Escribir el test que falla**

`apps/muestras/lib/panel/en-preparacion.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { PANEL_SECTIONS } from "@repo/muestras";
import { EN_PREPARACION, MONTAJE_EN_PREPARACION } from "./en-preparacion";

describe("páginas en preparación", () => {
  it("cada sección no construida tiene su explicación", () => {
    for (const s of PANEL_SECTIONS.filter((x) => !x.ready)) {
      const t = EN_PREPARACION[s.key];
      expect(t, s.key).toBeDefined();
      expect(t!.puntos.length).toBeGreaterThan(1);
    }
  });
  it("no explica como futuro algo que ya está construido", () => {
    for (const s of PANEL_SECTIONS.filter((x) => x.ready)) expect(EN_PREPARACION[s.key]).toBeUndefined();
  });
  it("Montaje lista lo que todavía falta", () => expect(MONTAJE_EN_PREPARACION.length).toBeGreaterThan(0));
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter muestras test`
Expected: FAIL — `Failed to resolve import "./en-preparacion"`.

- [ ] **Step 3: Textos de las secciones en preparación**

`apps/muestras/lib/panel/en-preparacion.ts`:
```ts
import type { PanelSectionKey } from "@repo/muestras";

/**
 * Lo que va a hacer cada sección del panel que todavía no está construida. Daniel quiere que
 * todas las funcionalidades estén a la vista: en vez de esconderlas, la página explica qué traen.
 */
export type TextoEnPreparacion = { titulo: string; bajada: string; puntos: string[] };

export const EN_PREPARACION: Partial<Record<PanelSectionKey, TextoEnPreparacion>> = {
  convocatorias: {
    titulo: "Convocatorias",
    bajada: "Abrí una convocatoria online y recibí las obras de los fotógrafos en un solo lugar.",
    puntos: [
      "Bases, fechas y cantidad de obras por autor, en una página pública para difundir.",
      "Los fotógrafos envían sus obras con título, año y técnica, desde el teléfono o la computadora.",
      "Ves todo lo recibido en orden y les avisás por mail a los participantes.",
      "Con las elegidas armás la muestra sin volver a cargar nada.",
    ],
  },
  curaduria: {
    titulo: "Curaduría",
    bajada: "La selección online, privada y anónima.",
    puntos: [
      "El equipo curatorial ve las obras sin el nombre del autor.",
      "Cada curador puntúa y comenta; las obras se filtran por puntaje.",
      "Rondas de selección hasta llegar a la lista final.",
      "Los nombres aparecen recién cuando la selección está cerrada.",
    ],
  },
  ventas: {
    titulo: "Ventas",
    bajada: "Vendé copias impresas y archivos digitales de las obras de tu muestra.",
    puntos: [
      "Precios y medidas por muestra.",
      "Cobro con Mercado Pago, repartido entre organizador, fotógrafo y plataforma.",
      "Cada autor acepta la venta y el reparto con un clic.",
      "Seguimiento de cada impresión hasta la entrega.",
      "Ediciones limitadas y numeradas, con certificado y QR de autenticidad.",
    ],
  },
  estadisticas: {
    titulo: "Estadísticas",
    bajada: "Cuánta gente ve tu muestra, escanea los QR de la sala y compra.",
    puntos: [
      "Visitas a la ficha de la muestra y a cada obra.",
      "Escaneos de los QR de las fichas de sala, obra por obra.",
      "Ventas por obra y por autor.",
      "Libro de visitas digital con los comentarios del público.",
    ],
  },
};

/** Lo que Montaje e impresión todavía no tiene (las fichas con QR ya están). */
export const MONTAJE_EN_PREPARACION: string[] = [
  "Marcos y remarcos con plantilla, con título y autor.",
  "Cartel con el texto curatorial y catálogo de la muestra en PDF.",
  "Plano y lista de montaje: qué obra va en cada pared, con medidas.",
];
```

- [ ] **Step 4: Consultas que usa el Inicio**

`apps/muestras/lib/perfiles/consultas.ts`:
```ts
import "server-only";
import { prisma } from "@repo/db";

/** El perfil de fotógrafo de una cuenta, o null si todavía no lo creó. */
export function buscarPerfilPropio(userId: number) {
  return prisma.photographerProfile.findUnique({ where: { userId } });
}
```

Al final de `apps/muestras/lib/actividades/consultas.ts`:
```ts
export function contarParaRevisar() {
  return prisma.culturalActivity.count({ where: { reviewStatus: "IN_REVIEW" } });
}
```

- [ ] **Step 5: Barra lateral**

`apps/muestras/components/panel/barra-lateral.tsx`:
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { activeSectionKey, type PanelSectionGroup } from "@repo/muestras";

/**
 * La barra del panel. En pantalla ancha queda fija al costado; en el teléfono es una franja con
 * la sección actual y un botón "Menú" que abre un cajón desde la izquierda (Escape lo cierra).
 */
export function BarraLateral({ grupos, nombre }: { grupos: PanelSectionGroup[]; nombre: string }) {
  const activa = activeSectionKey(usePathname());
  const [abierta, setAbierta] = useState(false);
  const actual = grupos.flatMap((g) => g.sections).find((s) => s.key === activa);

  useEffect(() => {
    if (!abierta) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierta(false); };
    window.addEventListener("keydown", alTeclear);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = "";
    };
  }, [abierta]);

  const lista = (
    <nav aria-label="Panel" className="space-y-7">
      {grupos.map((g) => (
        <div key={g.group}>
          <p className="mb-2 text-[13px] text-[var(--mf-muted)]">{g.label}</p>
          <ul className="space-y-0.5">
            {g.sections.map((s) => {
              const esActiva = s.key === activa;
              return (
                <li key={s.key}>
                  <Link
                    href={s.href}
                    aria-current={esActiva ? "page" : undefined}
                    onClick={() => setAbierta(false)}
                    className={`-ml-3 block border-l-2 py-1.5 pl-3 text-[15px] ${esActiva ? "border-[var(--mf-ink)] font-medium" : "border-transparent text-[var(--mf-muted)] hover:text-[var(--mf-ink)]"}`}
                  >
                    {s.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <div className="flex items-center justify-between border-b border-[var(--mf-line)] py-3 lg:hidden">
        <span className="text-sm text-[var(--mf-muted)]">{actual?.label ?? "Mi panel"}</span>
        <button
          type="button"
          aria-expanded={abierta}
          aria-controls="panel-cajon"
          onClick={() => setAbierta(true)}
          className="inline-flex h-10 items-center border border-[var(--mf-ink)] px-4 text-sm"
        >
          Menú
        </button>
      </div>
      {abierta ? (
        <div id="panel-cajon" role="dialog" aria-modal="true" aria-label="Menú del panel" className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Cerrar el menú" className="absolute inset-0 bg-black/30" onClick={() => setAbierta(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(20rem,85vw)] overflow-y-auto bg-[var(--mf-bg)] p-6 shadow-xl">
            <div className="mb-8 flex items-center justify-between">
              <span className="mf-titulo text-2xl">Mi panel</span>
              <button type="button" autoFocus onClick={() => setAbierta(false)} className="text-sm underline underline-offset-4">Cerrar</button>
            </div>
            {lista}
          </div>
        </div>
      ) : null}
      <aside className="hidden lg:block">
        <div className="sticky top-16 space-y-8 pt-10">
          <p className="truncate text-sm"><span className="text-[var(--mf-muted)]">Hola,</span> {nombre}</p>
          {lista}
        </div>
      </aside>
    </>
  );
}
```

- [ ] **Step 6: Layout del panel**

`apps/muestras/app/panel/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { groupedPanelSections } from "@repo/muestras";
import { BarraLateral } from "@/components/panel/barra-lateral";
import { getUsuario } from "@/lib/usuario";

export const metadata: Metadata = { robots: { index: false } };

/**
 * El panel queda debajo del encabezado público (el layout raíz lo pinta). Sin sesión no se
 * dibuja la barra: cada página llama `requireUsuario` con su propia ruta, así el ingreso vuelve
 * exactamente a donde la persona quería ir. El layout no es un control de acceso.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuario();
  if (!usuario) return <>{children}</>;
  const grupos = groupedPanelSections({ isSuperAdmin: usuario.esSuperAdmin });
  return (
    <div className="mf-marco grid gap-x-12 pb-20 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <BarraLateral grupos={grupos} nombre={usuario.name ?? usuario.email} />
      <div className="min-w-0 pt-6 lg:pt-10">{children}</div>
    </div>
  );
}
```

- [ ] **Step 7: Inicio del panel**

`apps/muestras/app/panel/page.tsx`:
```tsx
import Link from "next/link";
import { REVIEW_STATUSES, REVIEW_STATUS_LABELS, countByStatus } from "@repo/muestras";
import { contarParaRevisar, listarMias } from "@/lib/actividades/consultas";
import { buscarPerfilPropio } from "@/lib/perfiles/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi panel" };

const accion = "inline-flex h-11 items-center border border-[var(--mf-ink)] px-5 text-[15px] transition-colors hover:bg-[var(--mf-ink)] hover:text-white";

export default async function InicioPanel() {
  const usuario = await requireUsuario("/panel");
  const [mias, perfil, paraRevisar] = await Promise.all([
    listarMias(usuario.id),
    buscarPerfilPropio(usuario.id),
    usuario.esSuperAdmin ? contarParaRevisar() : Promise.resolve(0),
  ]);
  const cuenta = countByStatus(mias);
  const nombre = usuario.name?.split(" ")[0];

  return (
    <main className="space-y-14">
      <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Hola{nombre ? `, ${nombre}` : ""}</h1>

      {paraRevisar > 0 ? (
        <p className="border-l-2 border-[var(--mf-spot)] pl-4 text-lg">
          <Link href="/panel/revision" className="underline underline-offset-[6px]">
            {paraRevisar === 1 ? "Hay 1 propuesta para revisar" : `Hay ${paraRevisar} propuestas para revisar`}
          </Link>
        </p>
      ) : null}

      <section aria-labelledby="t-mias">
        <h2 id="t-mias" className="text-sm text-[var(--mf-muted)]">Tus muestras y actividades</h2>
        {mias.length === 0 ? (
          <p className="mt-3 text-lg">Todavía no propusiste ninguna.</p>
        ) : (
          <>
            <dl className="mt-4 grid grid-cols-2 border-t border-[var(--mf-line)] sm:grid-cols-5">
              {REVIEW_STATUSES.map((st) => (
                <div key={st} className="border-b border-[var(--mf-line)] py-4 pr-4">
                  <dt className="text-[13px] text-[var(--mf-muted)]">{REVIEW_STATUS_LABELS[st]}</dt>
                  <dd className="mf-titulo mt-1 text-3xl tabular-nums">{cuenta[st]}</dd>
                </div>
              ))}
            </dl>
            <Link href="/panel/muestras" className="mt-4 inline-block underline underline-offset-[6px]">Ver todas</Link>
          </>
        )}
      </section>

      <section aria-labelledby="t-accesos" className="space-y-4">
        <h2 id="t-accesos" className="text-sm text-[var(--mf-muted)]">Accesos rápidos</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/panel/proponer" className={accion}>Proponer una muestra</Link>
          <Link href="/panel/perfil" className={accion}>{perfil ? "Editar mi perfil" : "Crear mi perfil de fotógrafo"}</Link>
          {cuenta.APPROVED > 0 ? <Link href="/panel/montaje" className={accion}>Fichas de sala con QR</Link> : null}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 8: Página "En preparación"**

`apps/muestras/app/panel/[seccion]/page.tsx`:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { upcomingSection } from "@repo/muestras";
import { EN_PREPARACION } from "@/lib/panel/en-preparacion";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ seccion: string }> };

/** Las rutas estáticas del panel (muestras, perfil, montaje…) tienen prioridad sobre esta. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = upcomingSection((await params).seccion);
  return s ? { title: s.label } : {};
}

export default async function EnPreparacion({ params }: Props) {
  const s = upcomingSection((await params).seccion);
  const texto = s ? EN_PREPARACION[s.key] : undefined;
  if (!s || !texto) notFound();
  await requireUsuario(s.href);
  return (
    <main className="max-w-2xl space-y-8">
      <header className="space-y-4">
        <p className="text-sm text-[var(--mf-muted)]">En preparación</p>
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">{texto.titulo}</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">{texto.bajada}</p>
      </header>
      <ul className="border-t border-[var(--mf-line)]">
        {texto.puntos.map((p) => <li key={p} className="border-b border-[var(--mf-line)] py-3 text-[15px]">{p}</li>)}
      </ul>
      <p className="text-[15px] text-[var(--mf-muted)]">
        Mientras tanto podés <Link href="/panel/proponer" className="text-[var(--mf-ink)] underline underline-offset-[6px]">proponer tu muestra</Link> y cargar sus obras.
      </p>
    </main>
  );
}
```

- [ ] **Step 9: "Mi panel" en el encabezado**

En `apps/muestras/components/encabezado/encabezado.tsx`, reemplazar:
```tsx
            <Link href="/mis-muestras" className={enlace}>Mis muestras</Link>
            {usuario.esSuperAdmin ? <Link href="/admin" className={enlace}>Revisión</Link> : null}
```
por:
```tsx
            <Link href="/panel" className={enlace}>Mi panel</Link>
```
y actualizar el comentario de la función: "es el precio de mostrar "Mi panel" y "Salir" a quien entró".

- [ ] **Step 10: Correr tests y tipos**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: PASS, sin errores.

- [ ] **Step 11: Probar en local**

Run: `pnpm --filter muestras dev` y en el navegador, con sesión: `/panel` muestra el saludo, los contadores y los accesos; la barra marca "Inicio"; `/panel/ventas` muestra "En preparación"; `/panel/cualquiera` da 404; en 375 px de ancho, "Menú" abre el cajón, Escape y "Cerrar" lo cierran y tocar un enlace navega y lo cierra. Sin sesión, `/panel/ventas` manda a `/login?next=%2Fpanel%2Fventas`.

- [ ] **Step 12: Commit**

```bash
git add apps/muestras
git commit -m "Panel de Muestras: barra lateral, inicio y secciones en preparación"
```

---

### Task 5: Mover Mis muestras, Proponer y Revisión al panel (con redirecciones)

**Files:**
- Move: `app/mis-muestras/page.tsx` → `app/panel/muestras/page.tsx`; `app/mis-muestras/[id]/page.tsx` → `app/panel/muestras/[id]/page.tsx`; `app/proponer/page.tsx` → `app/panel/proponer/page.tsx`; `app/admin/page.tsx` → `app/panel/revision/page.tsx` (todos bajo `apps/muestras/`)
- Modify: `apps/muestras/next.config.ts`, `lib/usuario.ts`, `app/login/page.tsx`, `app/api/auth/google/callback/route.ts`, `lib/actividades/acciones.ts` (`refrescar`), `components/formulario/formulario-actividad.tsx`, `lib/correos/enviar.ts`

**Interfaces:**
- Produces: rutas `/panel/muestras`, `/panel/muestras/[id]`, `/panel/proponer`, `/panel/revision`; redirecciones 308 de `/mis-muestras`, `/mis-muestras/:id`, `/admin` y 307 de `/proponer`.

- [ ] **Step 1: Mover los archivos**

```bash
cd apps/muestras
mkdir -p app/panel/muestras/[id] app/panel/proponer app/panel/revision
git mv app/mis-muestras/page.tsx app/panel/muestras/page.tsx
git mv "app/mis-muestras/[id]/page.tsx" "app/panel/muestras/[id]/page.tsx"
git mv app/proponer/page.tsx app/panel/proponer/page.tsx
git mv app/admin/page.tsx app/panel/revision/page.tsx
```

- [ ] **Step 2: Ajustar las páginas movidas**

El panel ya pone el contenedor (`mf-marco`) y el margen: se sacan `mx-auto`, `p-4 sm:p-8` de cada `<main>`.

`app/panel/muestras/page.tsx`:
- `requireUsuario("/mis-muestras")` → `requireUsuario("/panel/muestras")`
- `<main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">` → `<main className="max-w-3xl space-y-6">`
- `<Link href="/proponer" …>Proponer otra</Link>` → `href="/panel/proponer"`
- `href={`/mis-muestras/${m.id}`}` → `href={`/panel/muestras/${m.id}`}`

`app/panel/muestras/[id]/page.tsx`:
- `requireUsuario(`/mis-muestras/${id}`)` → `requireUsuario(`/panel/muestras/${id}`)`
- `<main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">` → `<main className="max-w-3xl space-y-6">`
- `<Link href="/mis-muestras" …>Volver a mis muestras</Link>` → `href="/panel/muestras"`

`app/panel/proponer/page.tsx`:
- `requireUsuario("/proponer")` → `requireUsuario("/panel/proponer")`
- `<main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">` → `<main className="max-w-3xl space-y-6">`

`app/panel/revision/page.tsx`:
- `<main className="mx-auto max-w-5xl space-y-8 p-4 sm:p-8">` → `<main className="max-w-5xl space-y-8">`
- `href={`/mis-muestras/${f.id}`}` → `href={`/panel/muestras/${f.id}`}`

- [ ] **Step 3: Redirecciones de las URLs viejas**

En `apps/muestras/next.config.ts`, dentro de `nextConfig` (después de `transpilePackages`):
```ts
  // Las URLs de la etapa 1 siguen andando: hay enlaces en correos ya enviados y en favoritos.
  // `/proponer` es temporal (307): es el enlace de difusión y mañana puede ser una página pública.
  async redirects() {
    return [
      { source: "/mis-muestras", destination: "/panel/muestras", permanent: true },
      { source: "/mis-muestras/:id", destination: "/panel/muestras/:id", permanent: true },
      { source: "/admin", destination: "/panel/revision", permanent: true },
      { source: "/proponer", destination: "/panel/proponer", permanent: false },
    ];
  },
```

- [ ] **Step 4: Rutas internas que apuntaban a lo viejo**

`lib/usuario.ts`, en `requireSuperAdmin`:
```ts
export async function requireSuperAdmin(): Promise<Usuario> {
  const u = await requireUsuario("/panel/revision");
  if (!u.esSuperAdmin) redirect("/panel");
  return u;
}
```

`app/login/page.tsx`: `redirect(rutaInternaSegura(next) ?? "/mis-muestras")` → `redirect(rutaInternaSegura(next) ?? "/panel")`.

`app/api/auth/google/callback/route.ts`: `rutaInternaSegura(transito.next) ?? "/mis-muestras"` → `rutaInternaSegura(transito.next) ?? "/panel"`.

`lib/actividades/acciones.ts`, función `refrescar`:
```ts
function refrescar(slug?: string) {
  revalidatePath("/");
  revalidatePath("/panel", "layout");
  // La ficha y las páginas de sus obras (`/m/<slug>/o/<id>`).
  if (slug) revalidatePath(`/m/${slug}`, "layout");
  revalidatePath("/fotografos", "layout");
}
```

`components/formulario/formulario-actividad.tsx`:
- `router.replace(`/mis-muestras/${r.id}?faltan=…`)` → `router.replace(`/panel/muestras/${r.id}?faltan=${encodeURIComponent(e.errores.join("|"))}`)`
- `router.push(enviar ? "/mis-muestras?enviada=1" : `/mis-muestras/${r.id}`)` → `router.push(enviar ? "/panel/muestras?enviada=1" : `/panel/muestras/${r.id}`)`

`lib/correos/enviar.ts`: `url: `${APP_URL}/admin`` → `url: `${APP_URL}/panel/revision``, y `url: `${APP_URL}/mis-muestras`` → `url: `${APP_URL}/panel/muestras``.

- [ ] **Step 5: Comprobar que no quedó nada apuntando a lo viejo**

Run: `grep -rnE '"/mis-muestras|`/mis-muestras|"/admin"|`/admin|/proponer"' apps/muestras/app apps/muestras/components apps/muestras/lib`
Expected: sólo los enlaces públicos a `/proponer` (portada, banner, encabezado), que siguen andando por la redirección, y las rutas nuevas `/panel/proponer`. Ninguna otra coincidencia.

- [ ] **Step 6: Tests, tipos y prueba local**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types`
Expected: PASS.

Con `pnpm --filter muestras dev`:
Run: `for p in /mis-muestras /mis-muestras/abc /admin /proponer; do curl -s -o /dev/null -w "$p %{http_code} %{redirect_url}\n" http://localhost:3014$p; done`
Expected: `308 …/panel/muestras`, `308 …/panel/muestras/abc`, `308 …/panel/revision`, `307 …/panel/proponer`.
En el navegador: proponer → guardar → queda en `/panel/muestras/<id>`; enviar → `/panel/muestras?enviada=1`; como super admin, "Revisión" en la barra lista las pendientes.

- [ ] **Step 7: Commit**

```bash
git add -A apps/muestras
git commit -m "Mis muestras, Proponer y Revisión pasan al panel; las URLs viejas redirigen"
```

---

### Task 6: Página pública de cada obra

**Files:**
- Create: `apps/muestras/app/m/[slug]/o/[workId]/page.tsx`
- Modify: `apps/muestras/lib/actividades/consultas.ts` (`buscarPorSlug` con `cache` y el perfil del autor), `apps/muestras/components/ficha/galeria.tsx`, `apps/muestras/app/m/[slug]/page.tsx`

**Interfaces:**
- Consumes: `workAccess`, `workPath`, `neighborWorks`, `visibleWorks`, `formatArDay` (`@repo/muestras`); relación `authorProfile` (Task 3).
- Produces: ruta `/m/[slug]/o/[workId]`; `Galeria({ obras, parcial, slug })`.

- [ ] **Step 1: La ficha trae el perfil de cada autor y no se consulta dos veces**

En `apps/muestras/lib/actividades/consultas.ts`, agregar `import { cache } from "react";` y reemplazar `buscarPorSlug`:
```ts
/** Publicada, con sus obras y el perfil de cada autor. `cache`: metadatos y página la piden juntos. */
export const buscarPorSlug = cache((slug: string) =>
  prisma.culturalActivity.findFirst({
    where: { slug, reviewStatus: "APPROVED" },
    include: {
      works: {
        orderBy: { sortOrder: "asc" },
        include: { authorProfile: { select: { slug: true, displayName: true } } },
      },
    },
  }),
);
```

- [ ] **Step 2: La página de la obra**

`apps/muestras/app/m/[slug]/o/[workId]/page.tsx`:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatArDay, neighborWorks, visibleWorks, workAccess, workPath } from "@repo/muestras";
import { EstadoActividad } from "@/components/ficha/estado";
import { buscarPorSlug } from "@/lib/actividades/consultas";
import { esUrlWeb } from "@/lib/url";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string; workId: string }> };

async function cargar(slug: string, workId: string, ahora: Date) {
  const a = await buscarPorSlug(slug);
  if (!a || a.type !== "MUESTRA") return null;
  const obra = a.works.find((w) => w.id === workId);
  const acceso = workAccess(a, a.works, workId, ahora);
  if (!obra || !acceso) return null;
  return { a, obra, conFoto: acceso === "FULL" && esUrlWeb(obra.imageUrl) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, workId } = await params;
  const r = await cargar(slug, workId, new Date());
  if (!r) return {};
  const titulo = `${r.obra.title}, de ${r.obra.authorName || "autor sin indicar"}`;
  const descripcion = `Obra de la muestra "${r.a.title}".`;
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: workPath(r.a.slug, r.obra.id) },
    // Sin la foto (la galería la reserva para la visita) no tiene sentido indexarla.
    robots: r.conFoto ? undefined : { index: false },
    openGraph: { title: titulo, description: descripcion, images: r.conFoto ? [r.obra.imageUrl] : [] },
  };
}

export default async function PaginaDeObra({ params }: Props) {
  const { slug, workId } = await params;
  const ahora = new Date();
  const r = await cargar(slug, workId, ahora);
  if (!r) notFound();
  const { a, obra, conFoto } = r;
  const autor = obra.authorName || "Autor sin indicar";
  const datos = [obra.year ? String(obra.year) : null, obra.technique].filter(Boolean).join(". ");
  const { prev, next } = conFoto ? neighborWorks(visibleWorks(a, a.works, ahora).works, obra.id) : { prev: null, next: null };
  const lugar = a.isVirtualOnly ? "Virtual" : [a.venueName, a.city].filter(Boolean).join(", ");

  return (
    <main className="mf-marco space-y-8 py-8 sm:py-12">
      <Link href={`/m/${a.slug}`} className="text-sm text-[var(--mf-muted)] underline underline-offset-[6px] hover:text-[var(--mf-ink)]">
        Volver a la muestra
      </Link>

      {conFoto ? (
        <figure className="bg-[var(--mf-surface)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={obra.imageUrl} alt={`${obra.title}, de ${autor}`} className="mx-auto max-h-[80vh] w-auto object-contain" />
        </figure>
      ) : (
        <div className="flex min-h-[40vh] items-center justify-center bg-[var(--mf-surface)] p-8 text-center">
          <p className="max-w-[36ch] text-lg leading-snug">Esta obra se ve en la sala. La galería completa se publica cuando la muestra cierra.</p>
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-12">
        <header className="space-y-3 md:col-span-7">
          <h1 className="mf-titulo text-[clamp(2rem,5vw,3.25rem)]">{obra.title}</h1>
          <p className="text-lg">
            {obra.authorProfile ? (
              <Link href={`/fotografos/${obra.authorProfile.slug}`} className="underline underline-offset-[6px]">{autor}</Link>
            ) : autor}
          </p>
          {datos ? <p className="text-[var(--mf-muted)]">{datos}</p> : null}
        </header>
        <aside className="space-y-2 border-t border-[var(--mf-line)] pt-4 text-[15px] md:col-span-5 md:border-t-0 md:pt-0">
          <p className="text-sm text-[var(--mf-muted)]">Forma parte de la muestra</p>
          <p><Link href={`/m/${a.slug}`} className="font-medium underline underline-offset-[6px]">{a.title}</Link></p>
          <p className="text-[var(--mf-muted)]">{formatArDay(a.startsAt)} al {formatArDay(a.endsAt)}{lugar ? `. ${lugar}` : ""}</p>
          <EstadoActividad startsAt={a.startsAt} endsAt={a.endsAt} isCancelled={a.isCancelled} ahora={ahora} />
          {obra.authorProfile ? (
            <p className="pt-3">
              <Link href={`/fotografos/${obra.authorProfile.slug}`} className="underline underline-offset-[6px]">Más obras de {obra.authorProfile.displayName}</Link>
            </p>
          ) : null}
        </aside>
      </div>

      {prev || next ? (
        <nav aria-label="Otras obras de la muestra" className="flex justify-between gap-6 border-t border-[var(--mf-line)] pt-4 text-[15px]">
          {prev ? <Link href={workPath(a.slug, prev.id)} className="underline-offset-[6px] hover:underline">← {prev.title}</Link> : <span />}
          {next ? <Link href={workPath(a.slug, next.id)} className="text-right underline-offset-[6px] hover:underline">{next.title} →</Link> : null}
        </nav>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 3: De la galería a la página de cada obra**

`apps/muestras/components/ficha/galeria.tsx`:
- Importar `import Link from "next/link";` y `import { workPath } from "@repo/muestras";`.
- Firma: `export function Galeria({ obras, parcial, slug }: { obras: Obra[]; parcial: boolean; slug: string })`.
- En el `pie` del `Visor`, al final del fragmento:
```tsx
              {" "}<Link href={workPath(slug, actual.id)} className="ml-2 text-white underline underline-offset-4">Ver la obra</Link>
```

`apps/muestras/app/m/[slug]/page.tsx`: `<Galeria obras={works} parcial={isPartial} />` → `<Galeria obras={works} parcial={isPartial} slug={a.slug} />`.

- [ ] **Step 4: Tipos y prueba local**

Run: `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: sin errores.

Con `next dev` y una muestra publicada abierta en modo "destacadas" (cargarla en local o usar una de producción en la base local): la página de una destacada muestra la foto, anterior/siguiente y el enlace a la muestra; la de una no destacada muestra el texto "Esta obra se ve en la sala…", sin `<img>` y con `<meta name="robots" content="noindex">` (ver con `curl -s localhost:3014/m/<slug>/o/<id> | grep robots`); un id inventado da 404; una muestra despublicada da 404.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Página pública de cada obra, con la regla de visibilidad de la galería"
```

---
### Task 7: Mi perfil de fotógrafo (datos, avatar, obras vinculadas)

**Files:**
- Modify: `apps/muestras/lib/imagenes/procesar.ts`, `apps/muestras/app/api/imagenes/route.ts`, `apps/muestras/components/formulario/subir-imagen.ts`, `apps/muestras/lib/limite.ts`, `apps/muestras/lib/perfiles/consultas.ts`
- Create: `apps/muestras/lib/perfiles/mapear.ts`, `apps/muestras/lib/perfiles/acciones.ts`
- Create: `apps/muestras/app/panel/perfil/page.tsx`, `apps/muestras/components/perfil/formulario-perfil.tsx`, `apps/muestras/components/perfil/obras-vinculadas.tsx`
- Test: `apps/muestras/lib/imagenes/procesar.test.ts` (agregar caso), `apps/muestras/lib/perfiles/mapear.test.ts`, `apps/muestras/lib/perfiles/acciones.test.ts`

**Interfaces:**
- Consumes: `normalizeProfileSlug`, `profileSlugProblem`, `profileSlugBase`, `freeProfileSlug`, `normalizeWebsite`, `normalizeInstagram` (Task 2); `esImagenPropia`, `baseImagenesPublicas` (etapa 1, `lib/actividades/mapear.ts`); `buscarPerfilPropio` (Task 4).
- Produces:
  - `UsoImagen = "obra" | "portada" | "avatar"`; `subirImagen(file, uso: UsoImagen)`
  - `LIMITES.guardarPerfil`, `LIMITES.buscarPerfiles`
  - `PerfilForm`, `LARGOS_PERFIL`, `perfilDesdeFormData(fd, { baseImagenes? }): { ok: true; perfil: PerfilForm } | { ok: false; errores: string[] }`
  - Server actions: `guardarPerfil(fd): Promise<{ ok: true; slug: string } | { ok: false; errores: string[] }>`, `desvincularObra(workId: string): Promise<{ ok: boolean }>`, `buscarPerfiles(q: string): Promise<PerfilEncontrado[]>` con `PerfilEncontrado = { id; displayName; slug; city: string | null }`
  - `obrasVinculadas(profileId: string)` (consulta)

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `apps/muestras/lib/imagenes/procesar.test.ts`, dentro del `describe`:
```ts
  it("el avatar sale cuadrado de 800 px, recortado al centro", async () => {
    const r = await procesarImagen(await jpeg(1600, 900), "avatar");
    expect([r.width, r.height]).toEqual([800, 800]);
  });
```

`apps/muestras/lib/perfiles/mapear.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { perfilDesdeFormData } from "./mapear";

const BASE = "https://pub-test.r2.dev";
function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}
const leer = (o: Record<string, string>) => perfilDesdeFormData(fd(o), { baseImagenes: BASE });

describe("perfilDesdeFormData", () => {
  it("normaliza slug, web e Instagram y vacía lo opcional", () => {
    const r = leer({ displayName: " Ana Pérez ", slug: "Ana Pérez", website: "ana.com", instagram: "@Ana.Foto", bio: " ", avatarUrl: `${BASE}/muestras/7/a.webp` });
    expect(r).toEqual({ ok: true, perfil: {
      displayName: "Ana Pérez", slug: "ana-perez", bio: null, city: null, province: null,
      website: "https://ana.com/", instagram: "ana.foto", avatarUrl: `${BASE}/muestras/7/a.webp`,
    } });
  });
  it("sin slug escrito queda vacío (lo arma la acción)", () => {
    const r = leer({ displayName: "Ana" });
    expect(r.ok && r.perfil.slug).toBe("");
  });
  it("junta todos los errores en palabras de la persona", () => {
    const r = leer({ displayName: "", slug: "ab", website: "javascript:alert(1)", instagram: "no vale" });
    expect(r).toEqual({ ok: false, errores: [
      "Poné tu nombre como querés que aparezca.",
      "La dirección tiene que tener entre 3 y 40 caracteres.",
      "La dirección del sitio web no es válida.",
      "El usuario de Instagram no es válido.",
    ] });
  });
  it("un avatar que no subimos nosotros se descarta", () => {
    const r = leer({ displayName: "Ana", avatarUrl: "https://malo.com/espia.png" });
    expect(r.ok && r.perfil.avatarUrl).toBeNull();
  });
});
```

`apps/muestras/lib/perfiles/acciones.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  photographerProfile: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  culturalActivityWork: { updateMany: vi.fn() },
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));

vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
const { buscarPerfiles, desvincularObra, guardarPerfil } = await import("./acciones");
const { resetRateLimit } = await import("@/lib/limite");

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: "Ana" };
  db.photographerProfile.findUnique.mockResolvedValue(null);
  db.photographerProfile.findMany.mockResolvedValue([]);
  db.photographerProfile.create.mockResolvedValue({});
  db.photographerProfile.update.mockResolvedValue({});
});

describe("guardarPerfil", () => {
  it("sin sesión no escribe", async () => {
    usuarioActual.valor = null;
    expect((await guardarPerfil(fd({ displayName: "Ana" }))).ok).toBe(false);
    expect(db.photographerProfile.create).not.toHaveBeenCalled();
  });
  it("crea el perfil propio con el primer slug libre", async () => {
    db.photographerProfile.findMany.mockResolvedValue([{ slug: "ana-perez" }]);
    const r = await guardarPerfil(fd({ displayName: "Ana Pérez" }));
    expect(r).toEqual({ ok: true, slug: "ana-perez-2" });
    expect(db.photographerProfile.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 7, slug: "ana-perez-2", displayName: "Ana Pérez" }) });
  });
  it("no deja tomar el slug de otro perfil", async () => {
    db.photographerProfile.findUnique.mockImplementation(async ({ where }: { where: { userId?: number; slug?: string } }) =>
      where.slug === "ocupado" ? { id: "otro" } : null);
    const r = await guardarPerfil(fd({ displayName: "Ana", slug: "ocupado" }));
    expect(r).toEqual({ ok: false, errores: ["Esa dirección ya la usa otro perfil. Elegí otra."] });
  });
  it("actualiza el propio sin tocar el userId", async () => {
    db.photographerProfile.findUnique.mockImplementation(async ({ where }: { where: { userId?: number } }) =>
      where.userId === 7 ? { id: "p7", slug: "ana" } : null);
    const r = await guardarPerfil(fd({ displayName: "Ana P." }));
    expect(r).toEqual({ ok: true, slug: "ana" });
    expect(db.photographerProfile.update).toHaveBeenCalledWith({ where: { id: "p7" }, data: expect.not.objectContaining({ userId: expect.anything() }) });
  });
  it("si el índice único frena una carrera, lo explica", async () => {
    db.photographerProfile.create.mockRejectedValue(Object.assign(new Error("único"), { code: "P2002" }));
    const r = await guardarPerfil(fd({ displayName: "Ana" }));
    expect(r).toEqual({ ok: false, errores: ["Esa dirección ya la usa otro perfil. Elegí otra."] });
  });
});

describe("desvincularObra", () => {
  it("sólo toca obras vinculadas al perfil propio", async () => {
    db.photographerProfile.findUnique.mockResolvedValue({ id: "p7", slug: "ana" });
    db.culturalActivityWork.updateMany.mockResolvedValue({ count: 1 });
    expect(await desvincularObra("w1")).toEqual({ ok: true });
    expect(db.culturalActivityWork.updateMany).toHaveBeenCalledWith({ where: { id: "w1", authorProfileId: "p7" }, data: { authorProfileId: null } });
  });
  it("sin perfil propio no hace nada", async () => {
    expect(await desvincularObra("w1")).toEqual({ ok: false });
    expect(db.culturalActivityWork.updateMany).not.toHaveBeenCalled();
  });
});

describe("buscarPerfiles", () => {
  it("pide sesión y al menos dos letras", async () => {
    expect(await buscarPerfiles("a")).toEqual([]);
    usuarioActual.valor = null;
    expect(await buscarPerfiles("ana")).toEqual([]);
    expect(db.photographerProfile.findMany).not.toHaveBeenCalled();
  });
  it("busca por nombre sin distinguir mayúsculas, hasta 8", async () => {
    await buscarPerfiles("  ana ");
    expect(db.photographerProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { displayName: { contains: "ana", mode: "insensitive" } }, take: 8,
    }));
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test`
Expected: FAIL — falta `./mapear`/`./acciones` en `lib/perfiles` y el uso `avatar`.

- [ ] **Step 3: Avatar en el procesado y la subida**

`apps/muestras/lib/imagenes/procesar.ts`:
- `const LADO_MAYOR = { obra: 2000, portada: 1600, avatar: 800 } as const;`
- En `procesarImagen`, reemplazar la línea del `.resize(...)` por:
```ts
      // El avatar se ve siempre en un círculo: sale cuadrado, recortado al centro.
      .resize(uso === "avatar"
        ? { width: lado, height: lado, fit: "cover", position: "centre" }
        : { width: lado, height: lado, fit: "inside", withoutEnlargement: true })
```

`apps/muestras/app/api/imagenes/route.ts`, reemplazar la línea de `uso`:
```ts
  const pedido = form.get("uso");
  const uso: UsoImagen = pedido === "portada" || pedido === "avatar" ? pedido : "obra";
```

`apps/muestras/components/formulario/subir-imagen.ts`, reemplazar `subirImagen`:
```ts
const LADO_EN_NAVEGADOR = { obra: 2000, portada: 1600, avatar: 1200 } as const;

export async function subirImagen(file: File, uso: keyof typeof LADO_EN_NAVEGADOR): Promise<string> {
  const blob = await achicarEnNavegador(file, LADO_EN_NAVEGADOR[uso]);
  const fd = new FormData();
  fd.set("file", new File([blob], "imagen.jpg", { type: "image/jpeg" }));
  fd.set("uso", uso);
  const res = await fetch("/api/imagenes", { method: "POST", body: fd });
  const json = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error ?? "No pudimos subir la imagen.");
  return json.url;
}
```

- [ ] **Step 4: Topes nuevos**

En `apps/muestras/lib/limite.ts`, dentro de `LIMITES`:
```ts
  guardarPerfil: { limit: 30, windowMs: 60 * 60_000 },
  buscarPerfiles: { limit: 60, windowMs: 60_000 },
```

- [ ] **Step 5: Leer el formulario del perfil**

`apps/muestras/lib/perfiles/mapear.ts`:
```ts
import { normalizeInstagram, normalizeProfileSlug, normalizeWebsite, profileSlugProblem } from "@repo/muestras";
import { baseImagenesPublicas, esImagenPropia } from "@/lib/actividades/mapear";

export const LARGOS_PERFIL = { displayName: 120, bio: 3000, city: 120, province: 120, website: 300, instagram: 80 } as const;

export type PerfilForm = {
  displayName: string;
  /** Vacío = que la acción lo arme del nombre (o conserve el que tenía). */
  slug: string;
  bio: string | null;
  city: string | null;
  province: string | null;
  website: string | null;
  instagram: string | null;
  avatarUrl: string | null;
};

export function perfilDesdeFormData(
  fd: FormData,
  opciones: { baseImagenes?: string | null } = {},
): { ok: true; perfil: PerfilForm } | { ok: false; errores: string[] } {
  const base = "baseImagenes" in opciones ? opciones.baseImagenes ?? null : baseImagenesPublicas();
  const t = (k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max).trim();
  const errores: string[] = [];

  const displayName = t("displayName", LARGOS_PERFIL.displayName);
  if (!displayName) errores.push("Poné tu nombre como querés que aparezca.");

  const slugEscrito = t("slug", 200);
  const slug = slugEscrito ? normalizeProfileSlug(slugEscrito) : "";
  if (slugEscrito) {
    const problema = profileSlugProblem(slug);
    if (problema) errores.push(problema);
  }

  const webEscrita = t("website", LARGOS_PERFIL.website);
  const website = webEscrita ? normalizeWebsite(webEscrita) : null;
  if (webEscrita && !website) errores.push("La dirección del sitio web no es válida.");

  const igEscrito = t("instagram", LARGOS_PERFIL.instagram);
  const instagram = igEscrito ? normalizeInstagram(igEscrito) : null;
  if (igEscrito && !instagram) errores.push("El usuario de Instagram no es válido.");

  if (errores.length) return { ok: false, errores };
  const avatar = t("avatarUrl", 1000);
  return {
    ok: true,
    perfil: {
      displayName,
      slug,
      bio: t("bio", LARGOS_PERFIL.bio) || null,
      city: t("city", LARGOS_PERFIL.city) || null,
      province: t("province", LARGOS_PERFIL.province) || null,
      website,
      instagram,
      avatarUrl: avatar && esImagenPropia(avatar, base) ? avatar : null,
    },
  };
}
```

- [ ] **Step 6: Acciones del perfil**

`apps/muestras/lib/perfiles/acciones.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { freeProfileSlug, profileSlugBase } from "@repo/muestras";
import { frenarPorUsuario } from "@/lib/limite";
import { getUsuario } from "@/lib/usuario";
import { perfilDesdeFormData } from "./mapear";

export type ResultadoPerfil = { ok: true; slug: string } | { ok: false; errores: string[] };
export type PerfilEncontrado = { id: string; displayName: string; slug: string; city: string | null };

const SLUG_OCUPADO: ResultadoPerfil = { ok: false, errores: ["Esa dirección ya la usa otro perfil. Elegí otra."] };

/** Prisma avisa con P2002 cuando un índice único frena la escritura. */
function esChoqueUnico(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";
}

function refrescarPerfiles(...slugs: string[]) {
  revalidatePath("/fotografos");
  for (const s of slugs) revalidatePath(`/fotografos/${s}`);
  revalidatePath("/m/[slug]/o/[workId]", "page");
  revalidatePath("/panel", "layout");
}

/** Crea o actualiza el perfil propio. Cada cuenta tiene uno solo. */
export async function guardarPerfil(fd: FormData): Promise<ResultadoPerfil> {
  const usuario = await getUsuario();
  if (!usuario) return { ok: false, errores: ["Tenés que ingresar."] };
  if (!frenarPorUsuario("guardarPerfil", usuario.id).allowed) {
    return { ok: false, errores: ["Guardaste muchas veces seguidas. Esperá un rato y probá de nuevo."] };
  }
  const leido = perfilDesdeFormData(fd);
  if (!leido.ok) return leido;
  const p = leido.perfil;

  const actual = await prisma.photographerProfile.findUnique({ where: { userId: usuario.id }, select: { id: true, slug: true } });

  let slug: string;
  if (p.slug) {
    if (p.slug !== actual?.slug) {
      const otro = await prisma.photographerProfile.findUnique({ where: { slug: p.slug }, select: { id: true } });
      if (otro && otro.id !== actual?.id) return SLUG_OCUPADO;
    }
    slug = p.slug;
  } else if (actual) {
    slug = actual.slug;
  } else {
    const base = profileSlugBase(p.displayName);
    const parecidos = await prisma.photographerProfile.findMany({ where: { slug: { startsWith: base.slice(0, 30) } }, select: { slug: true } });
    slug = freeProfileSlug(base, new Set(parecidos.map((x) => x.slug)));
  }

  const datos = {
    slug, displayName: p.displayName, bio: p.bio, city: p.city, province: p.province,
    website: p.website, instagram: p.instagram, avatarUrl: p.avatarUrl,
  };
  try {
    if (actual) await prisma.photographerProfile.update({ where: { id: actual.id }, data: datos });
    else await prisma.photographerProfile.create({ data: { ...datos, userId: usuario.id } });
  } catch (err) {
    // Dos guardados a la vez, o alguien tomó la dirección en el medio: lo frena el índice único.
    if (esChoqueUnico(err)) return SLUG_OCUPADO;
    throw err;
  }
  refrescarPerfiles(slug, ...(actual && actual.slug !== slug ? [actual.slug] : []));
  return { ok: true, slug };
}

/** "No es mía": quita una obra del perfil propio. La última palabra la tiene el dueño del perfil. */
export async function desvincularObra(workId: string): Promise<{ ok: boolean }> {
  if (typeof workId !== "string") return { ok: false };
  const usuario = await getUsuario();
  if (!usuario) return { ok: false };
  const perfil = await prisma.photographerProfile.findUnique({ where: { userId: usuario.id }, select: { id: true, slug: true } });
  if (!perfil) return { ok: false };
  const { count } = await prisma.culturalActivityWork.updateMany({
    where: { id: workId, authorProfileId: perfil.id },
    data: { authorProfileId: null },
  });
  if (count > 0) refrescarPerfiles(perfil.slug);
  return { ok: count > 0 };
}

/** Para vincular una obra a un perfil desde el editor. Con sesión, dos letras como mínimo y freno. */
export async function buscarPerfiles(q: string): Promise<PerfilEncontrado[]> {
  if (typeof q !== "string") return [];
  const texto = q.trim().slice(0, 80);
  if (texto.length < 2) return [];
  const usuario = await getUsuario();
  if (!usuario) return [];
  if (!frenarPorUsuario("buscarPerfiles", usuario.id).allowed) return [];
  return prisma.photographerProfile.findMany({
    where: { displayName: { contains: texto, mode: "insensitive" } },
    select: { id: true, displayName: true, slug: true, city: true },
    orderBy: { displayName: "asc" },
    take: 8,
  });
}
```

- [ ] **Step 7: Consulta de obras vinculadas**

Al final de `apps/muestras/lib/perfiles/consultas.ts`:
```ts
/** Las obras vinculadas a un perfil, con su muestra, para "Mi perfil". */
export function obrasVinculadas(profileId: string) {
  return prisma.culturalActivityWork.findMany({
    where: { authorProfileId: profileId },
    select: { id: true, title: true, imageUrl: true, activity: { select: { title: true, slug: true, reviewStatus: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
```

- [ ] **Step 8: Formulario del perfil**

`apps/muestras/components/perfil/formulario-perfil.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { subirImagen } from "@/components/formulario/subir-imagen";
import { guardarPerfil } from "@/lib/perfiles/acciones";

export type PerfilInicial = {
  displayName: string; slug: string; bio: string; city: string; province: string;
  website: string; instagram: string; avatarUrl: string | null;
};

const campo = "w-full rounded-[2px] border border-[var(--mf-line)] bg-white px-3 py-2";

export function FormularioPerfil({ inicial, esNuevo }: { inicial: PerfilInicial; esNuevo: boolean }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [errores, setErrores] = useState<string[]>([]);
  const [guardado, setGuardado] = useState(false);
  const [avatar, setAvatar] = useState(inicial.avatarUrl);
  const [subiendo, setSubiendo] = useState(false);

  async function cambiarAvatar(file: File | undefined) {
    if (!file) return;
    setSubiendo(true);
    setErrores([]);
    try {
      setAvatar(await subirImagen(file, "avatar"));
    } catch (e) {
      setErrores([e instanceof Error ? e.message : "No pudimos subir la foto."]);
    } finally {
      setSubiendo(false);
    }
  }

  function enviar(form: HTMLFormElement) {
    const fd = new FormData(form);
    fd.set("avatarUrl", avatar ?? "");
    setGuardado(false);
    start(async () => {
      const r = await guardarPerfil(fd);
      if (!r.ok) return setErrores(r.errores);
      setErrores([]);
      setGuardado(true);
      router.refresh();
    });
  }

  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); enviar(e.currentTarget); }}>
      <div className="flex items-center gap-5">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="size-24 rounded-full object-cover" />
        ) : (
          <span aria-hidden className="size-24 rounded-full bg-[var(--mf-surface)]" />
        )}
        <label className="cursor-pointer underline underline-offset-4">
          {subiendo ? "Subiendo…" : avatar ? "Cambiar foto" : "Subir foto"}
          <input type="file" accept="image/*" className="sr-only" disabled={subiendo} onChange={(e) => cambiarAvatar(e.target.files?.[0])} />
        </label>
        {avatar ? <button type="button" className="text-sm text-[var(--mf-muted)] underline" onClick={() => setAvatar(null)}>Quitar</button> : null}
      </div>
      <label className="block space-y-1">
        <span>Nombre como querés que aparezca</span>
        <input name="displayName" required defaultValue={inicial.displayName} className={campo} />
      </label>
      <label className="block space-y-1">
        <span>Dirección de tu perfil</span>
        <span className="flex items-center gap-2">
          <span className="shrink-0 text-sm text-[var(--mf-muted)]">muestrasfotograficas.com/fotografos/</span>
          <input name="slug" defaultValue={inicial.slug} placeholder={esNuevo ? "se arma con tu nombre" : undefined} className={campo} />
        </span>
      </label>
      <label className="block space-y-1">
        <span>Sobre vos</span>
        <textarea name="bio" rows={6} defaultValue={inicial.bio} className={campo} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1"><span>Ciudad</span><input name="city" defaultValue={inicial.city} className={campo} /></label>
        <label className="block space-y-1"><span>Provincia</span><input name="province" defaultValue={inicial.province} className={campo} /></label>
        <label className="block space-y-1"><span>Sitio web</span><input name="website" defaultValue={inicial.website} placeholder="tusitio.com" className={campo} /></label>
        <label className="block space-y-1"><span>Instagram</span><input name="instagram" defaultValue={inicial.instagram} placeholder="@usuario" className={campo} /></label>
      </div>
      {errores.length ? (
        <ul role="alert" className="rounded-[2px] bg-red-50 p-3 text-sm text-red-800">{errores.map((e) => <li key={e}>{e}</li>)}</ul>
      ) : null}
      {guardado ? <p role="status" className="text-sm text-[var(--mf-teal)]">Guardado.</p> : null}
      <button type="submit" disabled={pendiente || subiendo} className="inline-flex h-11 items-center bg-[var(--mf-ink)] px-5 text-white disabled:opacity-50">
        {pendiente ? "Guardando…" : esNuevo ? "Crear mi perfil" : "Guardar"}
      </button>
    </form>
  );
}
```

- [ ] **Step 9: Obras vinculadas con "No es mía"**

`apps/muestras/components/perfil/obras-vinculadas.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { desvincularObra } from "@/lib/perfiles/acciones";

export type ObraVinculada = { id: string; title: string; imageUrl: string; muestra: string; muestraSlug: string; publicada: boolean };

export function ObrasVinculadas({ obras }: { obras: ObraVinculada[] }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  return (
    <section aria-labelledby="t-vinculadas" className="space-y-4">
      <h2 id="t-vinculadas" className="text-sm text-[var(--mf-muted)]">Obras vinculadas a tu perfil</h2>
      {obras.length === 0 ? (
        <p className="text-[15px] text-[var(--mf-muted)]">Todavía no hay obras vinculadas. Cuando cargues una muestra con obras tuyas, o un organizador te vincule, aparecen acá.</p>
      ) : (
        <ul className="divide-y divide-[var(--mf-line)] border-y border-[var(--mf-line)]">
          {obras.map((o) => (
            <li key={o.id} className="flex items-center gap-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.imageUrl} alt="" className="size-16 bg-[var(--mf-surface)] object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{o.title}</p>
                <p className="text-sm text-[var(--mf-muted)]">
                  {o.publicada ? <Link href={`/m/${o.muestraSlug}`} className="underline underline-offset-4">{o.muestra}</Link> : `${o.muestra} (todavía no publicada)`}
                </p>
              </div>
              <button
                type="button"
                disabled={pendiente}
                className="text-sm underline underline-offset-4 disabled:opacity-50"
                onClick={() => {
                  if (!window.confirm(`¿Quitar "${o.title}" de tu perfil?`)) return;
                  start(async () => { await desvincularObra(o.id); router.refresh(); });
                }}
              >
                No es mía
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 10: Página "Mi perfil"**

`apps/muestras/app/panel/perfil/page.tsx`:
```tsx
import Link from "next/link";
import { FormularioPerfil } from "@/components/perfil/formulario-perfil";
import { ObrasVinculadas } from "@/components/perfil/obras-vinculadas";
import { buscarPerfilPropio, obrasVinculadas } from "@/lib/perfiles/consultas";
import { esUrlWeb } from "@/lib/url";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi perfil de fotógrafo" };

export default async function MiPerfil() {
  const usuario = await requireUsuario("/panel/perfil");
  const perfil = await buscarPerfilPropio(usuario.id);
  const obras = perfil ? await obrasVinculadas(perfil.id) : [];
  const publicado = obras.some((o) => o.activity.reviewStatus === "APPROVED");
  return (
    <main className="max-w-3xl space-y-12">
      <header className="space-y-3">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Mi perfil de fotógrafo</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">Tu página pública: tus datos y las obras tuyas que se expusieron en Muestras Fotográficas.</p>
        {perfil && publicado ? (
          <Link href={`/fotografos/${perfil.slug}`} className="inline-block underline underline-offset-[6px]">Ver mi perfil público</Link>
        ) : perfil ? (
          <p className="text-[15px] text-[var(--mf-muted)]">Tu perfil se publica cuando tengas una obra en una muestra publicada.</p>
        ) : null}
      </header>
      <FormularioPerfil
        esNuevo={!perfil}
        inicial={{
          displayName: perfil?.displayName ?? usuario.name ?? "",
          slug: perfil?.slug ?? "",
          bio: perfil?.bio ?? "",
          city: perfil?.city ?? "",
          province: perfil?.province ?? "",
          website: perfil?.website ?? "",
          instagram: perfil?.instagram ? `@${perfil.instagram}` : "",
          avatarUrl: perfil?.avatarUrl ?? null,
        }}
      />
      {perfil ? (
        <ObrasVinculadas
          obras={obras.filter((o) => esUrlWeb(o.imageUrl)).map((o) => ({
            id: o.id, title: o.title, imageUrl: o.imageUrl, muestra: o.activity.title,
            muestraSlug: o.activity.slug, publicada: o.activity.reviewStatus === "APPROVED",
          }))}
        />
      ) : null}
    </main>
  );
}
```

- [ ] **Step 11: Tests, tipos y prueba local**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: PASS.

Con `next dev` (y la migración aplicada en la base que use el `.env` local; si apunta a producción, **no** aplicar sin permiso: probar después de la Task 11 Step 2): crear el perfil sin escribir dirección → queda `nombre-apellido`; subir avatar → se ve redondo; poner una dirección reservada (`panel`) → error en palabras; `@Usuario` → se guarda `usuario`.

- [ ] **Step 12: Commit**

```bash
git add apps/muestras
git commit -m "Mi perfil de fotógrafo: datos, foto, dirección propia y obras vinculadas"
```

---

### Task 8: Vincular obras a perfiles en el editor (e ids de obra estables)

**Files:**
- Modify: `apps/muestras/lib/actividades/mapear.ts` (`ObraForm`, `obras()`), `apps/muestras/lib/actividades/acciones.ts` (`guardarBorrador`), `apps/muestras/lib/actividades/consultas.ts` (`buscarPropia`), `apps/muestras/components/formulario/obras.tsx`, `apps/muestras/components/formulario/formulario-actividad.tsx`
- Create: `apps/muestras/components/formulario/vincular-perfil.tsx`
- Test: `apps/muestras/lib/actividades/mapear.test.ts`, `apps/muestras/lib/actividades/acciones.test.ts`

**Interfaces:**
- Consumes: `resolveAuthorProfileId` (Task 2); `buscarPerfiles`, `PerfilEncontrado` (Task 7).
- Produces: `ObraForm.authorProfileId: string | null`, `ObraForm.authorProfileName?: string | null` (sólo para la pantalla; el servidor lo ignora); `VincularPerfil({ nombre, onVincular })`.

**Por qué los ids estables:** hoy `guardarBorrador` borra y vuelve a crear las obras en cada guardado, así que cada obra cambia de id. Con la etapa 2 el id está en la URL de la obra y en el QR impreso: una edición después de imprimir rompería todas las fichas. Desde ahora se conserva el id de cada obra que ya era de la muestra.

- [ ] **Step 1: Escribir los tests que fallan**

En `apps/muestras/lib/actividades/mapear.test.ts`, agregar:
```ts
describe("perfil del autor en cada obra", () => {
  it("acepta un id de perfil con forma de id y descarta lo demás", () => {
    const f = fichaDesdeFormData(fd({
      ...base,
      works: JSON.stringify([
        { imageUrl: `${BASE}/muestras/7/1.webp`, title: "Uno", authorProfileId: "cm1abcdefghijklmnop" },
        { imageUrl: `${BASE}/muestras/7/2.webp`, title: "Dos", authorProfileId: "'; drop table" },
        { imageUrl: `${BASE}/muestras/7/3.webp`, title: "Tres" },
      ]),
    }));
    expect(f.works.map((w) => w.authorProfileId)).toEqual(["cm1abcdefghijklmnop", null, null]);
  });
});
```

En `apps/muestras/lib/actividades/acciones.test.ts`:
- En `db` (dentro de `vi.hoisted`), agregar `photographerProfile: { findUnique: vi.fn(), findMany: vi.fn() },`.
- En el `beforeEach` general, agregar:
```ts
  db.photographerProfile.findUnique.mockResolvedValue(null);
  db.photographerProfile.findMany.mockResolvedValue([]);
```
- Al final del archivo:
```ts
describe("obras: ids estables y perfil del autor", () => {
  const BASE = "https://pub-test.r2.dev";
  const obra = (extra: Record<string, unknown> = {}) => ({
    imageUrl: `${BASE}/muestras/7/1.webp`, title: "Uno", authorName: "Ana Pérez", year: null, technique: null, isHighlight: false, ...extra,
  });
  function fd(o: Record<string, string>) {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  }
  const guardadas = () => db.culturalActivityWork.createMany.mock.calls[0]![0].data as Array<Record<string, unknown>>;

  beforeEach(() => {
    usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: null };
    db.culturalActivity.findUnique.mockResolvedValue({ ...fila, works: [{ id: "w-vieja" }] });
  });

  it("conserva el id de las obras que ya eran de la muestra (el QR impreso sigue andando)", async () => {
    await guardarBorrador(fd({ id: "a1", title: "Charla", works: JSON.stringify([obra({ id: "w-vieja" }), obra({ id: "w-ajena" }), obra({ id: "w-vieja" })]) }));
    expect(guardadas().map((o) => o.id)).toEqual(["w-vieja", undefined, undefined]);
  });
  it("vincula sola una obra nueva cuyo autor coincide con el perfil de quien propuso", async () => {
    db.photographerProfile.findUnique.mockResolvedValue({ id: "perfil-ana", displayName: "ana perez" });
    await guardarBorrador(fd({ id: "a1", title: "Charla", works: JSON.stringify([obra()]) }));
    expect(guardadas()[0]!.authorProfileId).toBe("perfil-ana");
  });
  it("descarta un perfil pedido que no existe", async () => {
    await guardarBorrador(fd({ id: "a1", title: "Charla", works: JSON.stringify([obra({ authorProfileId: "cperfilinexistente01" })]) }));
    expect(guardadas()[0]!.authorProfileId).toBeNull();
  });
  it("si edita el super admin, el perfil por defecto es el de quien propuso", async () => {
    usuarioActual.valor = { id: 1, esSuperAdmin: true, email: "d@x", name: "Daniel" };
    await guardarBorrador(fd({ id: "a1", title: "Charla", works: JSON.stringify([obra()]) }));
    expect(db.photographerProfile.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 7 } }));
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test`
Expected: FAIL — `authorProfileId` no existe en `ObraForm`, `createMany` recibe obras sin `id`.

- [ ] **Step 3: Leer el perfil pedido en cada obra**

En `apps/muestras/lib/actividades/mapear.ts`:
- En `ObraForm`, agregar:
```ts
  /** Perfil público del autor; el servidor verifica que exista. */
  authorProfileId: string | null;
  /** Sólo para mostrar en el editor; el servidor no lo lee. */
  authorProfileName?: string | null;
```
- En `obras()`, dentro del objeto que devuelve el `flatMap`, agregar:
```ts
        authorProfileId: typeof r.authorProfileId === "string" && /^[a-z0-9]{8,40}$/i.test(r.authorProfileId) ? r.authorProfileId : null,
```

- [ ] **Step 4: Guardar con ids estables y el perfil resuelto**

En `apps/muestras/lib/actividades/acciones.ts`:
- Agregar `resolveAuthorProfileId` a la importación de `@repo/muestras` y `type FichaForm` a la de `./mapear`.
- Antes de `guardarBorrador`, agregar:
```ts
/**
 * Las obras tal como se escriben.
 *
 * - Cada obra que ya era de esta muestra conserva su id: está en la URL de su página y en el QR
 *   de la ficha impresa. Un id ajeno o repetido se descarta y la obra se crea como nueva.
 * - El perfil del autor se resuelve con `resolveAuthorProfileId`, usando el perfil de quien
 *   propuso la muestra (no el de quien edita: puede ser el super admin).
 */
async function obrasParaGuardar(works: FichaForm["works"], idsPropios: ReadonlySet<string>, duenoId: number) {
  const perfilPropio = await prisma.photographerProfile.findUnique({ where: { userId: duenoId }, select: { id: true, displayName: true } });
  const pedidos = [...new Set(works.map((w) => w.authorProfileId).filter((x): x is string => !!x))];
  const existentes = new Set(
    pedidos.length
      ? (await prisma.photographerProfile.findMany({ where: { id: { in: pedidos } }, select: { id: true } })).map((p) => p.id)
      : [],
  );
  const usados = new Set<string>();
  return works.map((w, i) => {
    const conserva = !!w.id && idsPropios.has(w.id) && !usados.has(w.id);
    if (conserva) usados.add(w.id!);
    return {
      ...(conserva ? { id: w.id } : {}),
      imageUrl: w.imageUrl, title: w.title, authorName: w.authorName, year: w.year,
      technique: w.technique, isHighlight: w.isHighlight, sortOrder: i,
      authorProfileId: resolveAuthorProfileId(
        { isNew: !conserva, authorName: w.authorName, requestedProfileId: w.authorProfileId },
        existentes,
        perfilPropio,
      ),
    };
  });
}
```
- Reemplazar `guardarBorrador` entero por:
```ts
/** Crea o actualiza la ficha y reemplaza su galería. No cambia el estado de revisión. */
export async function guardarBorrador(fd: FormData): Promise<ResultadoAccion> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const f = fichaDesdeFormData(fd);
  if (!f.title) return { ok: false, errores: ["Poné al menos un título para guardar."] };
  if (f.works.length > MAX_WORKS) return { ok: false, errores: [`La galería admite hasta ${MAX_WORKS} obras.`] };
  if (f.works.filter((w) => w.isHighlight).length > MAX_HIGHLIGHTS) {
    return { ok: false, errores: [`Podés destacar hasta ${MAX_HIGHLIGHTS} obras.`] };
  }
  const datos: ReturnType<typeof datosParaGuardar> = datosParaGuardar(f);

  if (!f.id) {
    // Sólo se cuenta la creación: editar un borrador propio no tiene tope.
    if (!frenarPorUsuario("crearBorrador", usuario.id).allowed) {
      return { ok: false, errores: ["Creaste muchas actividades seguidas. Esperá un rato y probá de nuevo."] };
    }
    const obras = await obrasParaGuardar(f.works, new Set(), usuario.id);
    const creada = await prisma.culturalActivity.create({
      data: { ...datos, slug: newSlug(f.title), proposedByUserId: usuario.id, works: { create: obras } },
      select: { id: true },
    });
    refrescar();
    return { ok: true, id: creada.id };
  }

  const actual = await prisma.culturalActivity.findUnique({ where: { id: f.id }, include: { works: { select: { id: true } } } });
  if (!actual) return NO_EXISTE;
  const actor = { userId: usuario.id, isSuperAdmin: usuario.esSuperAdmin };
  if (!canEdit({ ...actual, reviewStatus: actual.reviewStatus as ReviewStatus }, actor)) {
    return { ok: false, errores: ["No podés editar esta actividad ahora."] };
  }
  // Una ficha ya enviada o publicada no puede quedar incompleta por una edición.
  if (actual.reviewStatus !== "DRAFT" && actual.reviewStatus !== "REJECTED") {
    const faltan = missingForSubmission({
      type: f.type, title: f.title, description: f.description, coverImageUrl: f.coverImageUrl,
      organizersText: f.organizersText, startDay: f.startDay, endDay: f.endDay,
      scheduleText: f.scheduleText, isVirtualOnly: f.isVirtualOnly, address: f.address,
      latitude: f.latitude, longitude: f.longitude, rightsConfirmed: f.rightsConfirmed,
      worksCount: f.works.length, highlightsCount: f.works.filter((w) => w.isHighlight).length,
    });
    if (faltan.length) return { ok: false, errores: faltan };
  }
  // Se conserva la primera confirmación de derechos.
  if (datos.rightsConfirmedAt && actual.rightsConfirmedAt) datos.rightsConfirmedAt = actual.rightsConfirmedAt;
  const obras = await obrasParaGuardar(f.works, new Set(actual.works.map((w) => w.id)), actual.proposedByUserId);
  await prisma.$transaction([
    prisma.culturalActivity.update({ where: { id: f.id }, data: datos }),
    prisma.culturalActivityWork.deleteMany({ where: { activityId: f.id } }),
    prisma.culturalActivityWork.createMany({ data: obras.map((o) => ({ ...o, activityId: f.id! })) }),
  ]);
  refrescar(actual.slug);
  return { ok: true, id: f.id };
}
```

- [ ] **Step 5: El editor trae el nombre del perfil vinculado**

En `apps/muestras/lib/actividades/consultas.ts`, en `buscarPropia`, cambiar el `include`:
```ts
    include: { works: { orderBy: { sortOrder: "asc" }, include: { authorProfile: { select: { displayName: true } } } } },
```

En `apps/muestras/components/formulario/formulario-actividad.tsx`, el estado inicial de obras:
```tsx
  const [obras, setObras] = useState<ObraForm[]>(
    (inicial?.works ?? []).map((w) => ({
      id: w.id, imageUrl: w.imageUrl, title: w.title, authorName: w.authorName, year: w.year, technique: w.technique,
      isHighlight: w.isHighlight, authorProfileId: w.authorProfileId, authorProfileName: w.authorProfile?.displayName ?? null,
    })),
  );
```

- [ ] **Step 6: Buscador de perfiles**

`apps/muestras/components/formulario/vincular-perfil.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { buscarPerfiles, type PerfilEncontrado } from "@/lib/perfiles/acciones";

/**
 * Vincular el autor de una obra a un perfil existente, buscándolo por nombre. Si no aparece,
 * la obra queda con el nombre en texto libre, como siempre.
 */
export function VincularPerfil({ nombre, onVincular }: {
  nombre: string | null;
  onVincular: (p: { id: string; displayName: string } | null) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<PerfilEncontrado[] | null>(null);

  useEffect(() => {
    if (!abierto || q.trim().length < 2) return;
    let vigente = true;
    const t = setTimeout(() => {
      buscarPerfiles(q).then((r) => { if (vigente) setResultados(r); }).catch(() => { if (vigente) setResultados([]); });
    }, 300);
    return () => { vigente = false; clearTimeout(t); };
  }, [q, abierto]);

  if (nombre) {
    return (
      <p className="text-xs text-[var(--mf-muted)]">
        Perfil: <strong className="font-medium text-[var(--mf-ink)]">{nombre}</strong>{" "}
        <button type="button" className="underline" onClick={() => onVincular(null)}>Desvincular</button>
      </p>
    );
  }
  if (!abierto) {
    return <button type="button" className="text-xs text-[var(--mf-muted)] underline" onClick={() => setAbierto(true)}>Vincular a un perfil</button>;
  }
  const buscando = q.trim().length >= 2;
  return (
    <div className="space-y-1 text-xs">
      <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setResultados(null); }} placeholder="Buscar fotógrafo por nombre" className="w-full border-b" />
      {buscando && resultados === null ? <p className="text-[var(--mf-muted)]">Buscando…</p> : null}
      {buscando && resultados?.length === 0 ? <p className="text-[var(--mf-muted)]">Sin resultados. Queda con el nombre como texto.</p> : null}
      {buscando && resultados?.length ? (
        <ul className="space-y-0.5">
          {resultados.map((p) => (
            <li key={p.id}>
              <button type="button" className="underline" onClick={() => { onVincular({ id: p.id, displayName: p.displayName }); setAbierto(false); setQ(""); }}>
                {p.displayName}{p.city ? `, ${p.city}` : ""}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" className="underline" onClick={() => { setAbierto(false); setQ(""); }}>Cancelar</button>
    </div>
  );
}
```

En `apps/muestras/components/formulario/obras.tsx`:
- `import { VincularPerfil } from "./vincular-perfil";`
- En `agregar`, la obra nueva: `nuevas.push({ imageUrl: url, title: f.name.replace(/\.[^.]+$/, ""), authorName: "", year: null, technique: null, isHighlight: false, authorProfileId: null, authorProfileName: null });`
- Debajo del `<input … placeholder="Autor" />`:
```tsx
              <VincularPerfil
                nombre={o.authorProfileName ?? null}
                onVincular={(p) => cambiar(i, { authorProfileId: p?.id ?? null, authorProfileName: p?.displayName ?? null })}
              />
```
- Debajo del contador de obras, una línea de ayuda:
```tsx
      <p className="text-sm text-[var(--mf-muted)]">Si el autor sos vos y tenés perfil de fotógrafo con el mismo nombre, las obras nuevas se vinculan solas al guardar.</p>
```

- [ ] **Step 7: Correr y ver que pasa**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: PASS (los tests viejos de `guardarBorrador` siguen pasando: `fila.works` es `[]`).

- [ ] **Step 8: Probar en local**

Con `next dev`: editar una muestra, anotar el id de una obra (desde su página `/m/<slug>/o/<id>`), cambiar su título y guardar → la misma URL sigue andando. Agregar una obra con el autor igual al nombre del perfil propio → al guardar aparece "Perfil: …". "Vincular a un perfil" busca y vincula; "Desvincular" lo saca y al guardar no se vuelve a vincular sola.

- [ ] **Step 9: Commit**

```bash
git add apps/muestras
git commit -m "Obras con id estable y vinculadas al perfil de su autor"
```

---
### Task 9: Perfiles públicos y "Fotógrafos que expusieron"

**Files:**
- Modify: `apps/muestras/lib/perfiles/consultas.ts` (agregar `listarFotografos`, `buscarPerfilPublico`), `apps/muestras/components/encabezado/encabezado.tsx`, `apps/muestras/components/pie/pie.tsx`
- Create: `apps/muestras/app/fotografos/page.tsx`, `apps/muestras/app/fotografos/[slug]/page.tsx`

**Interfaces:**
- Consumes: `profileWorksInActivity`, `workPath`, `formatArDay` (`@repo/muestras`).
- Produces: `listarFotografos()`, `buscarPerfilPublico(slug): Promise<{ perfil; muestras } | null>` (null también si no tiene obras en una muestra publicada); rutas `/fotografos` y `/fotografos/[slug]`.

**Regla (spec D16):** un perfil se ve en público sólo si tiene al menos una obra en una muestra publicada. Así ninguna página pública muestra contenido que no pasó por una muestra revisada.

- [ ] **Step 1: Consultas públicas**

En `apps/muestras/lib/perfiles/consultas.ts`, agregar `import { cache } from "react";` y al final:
```ts
const PUBLICADA = { reviewStatus: "APPROVED", type: "MUESTRA" } as const;

/** Perfiles con al menos una obra en una muestra publicada, para "Fotógrafos que expusieron". */
export function listarFotografos() {
  return prisma.photographerProfile.findMany({
    where: { works: { some: { activity: PUBLICADA } } },
    select: {
      slug: true, displayName: true, city: true, province: true, avatarUrl: true,
      works: { where: { activity: PUBLICADA }, select: { activityId: true } },
    },
    orderBy: { displayName: "asc" },
    take: 1000,
  });
}

/**
 * Un perfil con sus muestras publicadas y **todas** las obras de cada una: la regla de qué se ve
 * (`profileWorksInActivity`) necesita la muestra completa. `null` si no existe o si todavía no
 * tiene obras en una muestra publicada. `cache`: metadatos y página la piden juntos.
 */
export const buscarPerfilPublico = cache(async (slug: string) => {
  const perfil = await prisma.photographerProfile.findUnique({
    where: { slug },
    select: { id: true, slug: true, displayName: true, bio: true, city: true, province: true, website: true, instagram: true, avatarUrl: true },
  });
  if (!perfil) return null;
  const muestras = await prisma.culturalActivity.findMany({
    where: { ...PUBLICADA, works: { some: { authorProfileId: perfil.id } } },
    select: {
      id: true, slug: true, title: true, startsAt: true, endsAt: true, galleryMode: true, venueName: true, city: true,
      works: { select: { id: true, title: true, imageUrl: true, isHighlight: true, sortOrder: true, authorProfileId: true } },
    },
    orderBy: { startsAt: "desc" },
    take: 100,
  });
  if (muestras.length === 0) return null;
  return { perfil, muestras };
});
```

- [ ] **Step 2: Página del perfil**

`apps/muestras/app/fotografos/[slug]/page.tsx`:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatArDay, profileWorksInActivity, workPath } from "@repo/muestras";
import { buscarPerfilPublico } from "@/lib/perfiles/consultas";
import { esUrlWeb } from "@/lib/url";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await buscarPerfilPublico((await params).slug);
  if (!r) return {};
  const { perfil } = r;
  const descripcion = perfil.bio?.slice(0, 160) || `Obras de ${perfil.displayName} en Muestras Fotográficas.`;
  return {
    title: perfil.displayName,
    description: descripcion,
    openGraph: { title: perfil.displayName, description: descripcion, type: "profile", images: esUrlWeb(perfil.avatarUrl) ? [perfil.avatarUrl] : [] },
  };
}

export default async function PerfilPublico({ params }: Props) {
  const r = await buscarPerfilPublico((await params).slug);
  if (!r) notFound();
  const { perfil, muestras } = r;
  const ahora = new Date();
  const lugar = [perfil.city, perfil.province].filter(Boolean).join(", ");

  return (
    <main className="mf-marco space-y-16 py-10 sm:py-16">
      <header className="grid gap-8 md:grid-cols-12">
        <div className="flex items-center gap-6 md:col-span-7">
          {esUrlWeb(perfil.avatarUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={perfil.avatarUrl} alt="" className="size-24 shrink-0 rounded-full object-cover sm:size-32" />
          ) : null}
          <div>
            <h1 className="mf-titulo text-[clamp(2.2rem,5vw,3.5rem)]">{perfil.displayName}</h1>
            {lugar ? <p className="mt-2 text-[var(--mf-muted)]">{lugar}</p> : null}
          </div>
        </div>
        <div className="space-y-4 md:col-span-5">
          {perfil.bio ? <p className="whitespace-pre-line leading-relaxed">{perfil.bio}</p> : null}
          <p className="flex flex-wrap gap-x-5 text-[15px]">
            {esUrlWeb(perfil.website) ? <a href={perfil.website} target="_blank" rel="noreferrer nofollow" className="underline underline-offset-[6px]">Sitio web</a> : null}
            {perfil.instagram ? <a href={`https://www.instagram.com/${perfil.instagram}/`} target="_blank" rel="noreferrer nofollow" className="underline underline-offset-[6px]">Instagram</a> : null}
          </p>
        </div>
      </header>

      <section aria-labelledby="t-expuso" className="space-y-10">
        <h2 id="t-expuso" className="text-sm text-[var(--mf-muted)]">Expuso en</h2>
        {muestras.map((m) => {
          const { visible, hiddenCount } = profileWorksInActivity(m, m.works, perfil.id, ahora);
          const fotos = visible.filter((w) => esUrlWeb(w.imageUrl));
          return (
            <article key={m.id} className="border-t border-[var(--mf-line)] pt-6">
              <h3 className="mf-titulo text-[clamp(1.4rem,2.4vw,1.9rem)]">
                <Link href={`/m/${m.slug}`} className="underline-offset-[5px] hover:underline">{m.title}</Link>
              </h3>
              <p className="mt-1 text-[15px] text-[var(--mf-muted)]">
                {formatArDay(m.startsAt)} al {formatArDay(m.endsAt)}{m.venueName ? `. ${m.venueName}` : ""}{m.city ? `, ${m.city}` : ""}
              </p>
              {fotos.length ? (
                <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
                  {fotos.map((w) => (
                    <li key={w.id}>
                      <Link href={workPath(m.slug, w.id)} className="group block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={w.imageUrl} alt={w.title} loading="lazy" className="aspect-[4/5] w-full bg-[var(--mf-surface)] object-cover transition-opacity duration-300 group-hover:opacity-85" />
                        <span className="mt-2 block text-sm font-medium">{w.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              {hiddenCount > 0 ? (
                <p className="mt-4 text-[15px] text-[var(--mf-muted)]">
                  {fotos.length ? (hiddenCount === 1 ? "Y 1 obra más" : `Y ${hiddenCount} obras más`) : (hiddenCount === 1 ? "1 obra" : `${hiddenCount} obras`)} para ver en la sala.
                </p>
              ) : null}
            </article>
          );
        })}
      </section>
    </main>
  );
}
```

- [ ] **Step 3: "Fotógrafos que expusieron"**

`apps/muestras/app/fotografos/page.tsx`:
```tsx
import Link from "next/link";
import { listarFotografos } from "@/lib/perfiles/consultas";
import { esUrlWeb } from "@/lib/url";

export const revalidate = 300;
export const metadata = {
  title: "Fotógrafos que expusieron",
  description: "Autores con obras en muestras fotográficas de todo el país.",
};

export default async function Fotografos() {
  const perfiles = await listarFotografos();
  return (
    <main className="mf-marco py-10 sm:py-16">
      <h1 className="mf-titulo max-w-[16ch] text-[clamp(2.2rem,5vw,3.5rem)]">Fotógrafos que expusieron</h1>
      <p className="mt-4 max-w-[52ch] text-lg leading-snug text-[var(--mf-muted)]">Autores con obras en muestras de todo el país.</p>
      {perfiles.length === 0 ? (
        <p className="mt-10 border-t border-[var(--mf-line)] pt-8 text-lg">Todavía no hay perfiles publicados.</p>
      ) : (
        <ul className="mt-10 grid border-t border-[var(--mf-line)] sm:grid-cols-2 lg:grid-cols-3">
          {perfiles.map((p) => {
            const n = new Set(p.works.map((w) => w.activityId)).size;
            return (
              <li key={p.slug} className="border-b border-[var(--mf-line)]">
                <Link href={`/fotografos/${p.slug}`} className="group flex items-center gap-4 py-5 pr-4">
                  {esUrlWeb(p.avatarUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatarUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span aria-hidden className="size-14 shrink-0 rounded-full bg-[var(--mf-surface)]" />
                  )}
                  <span className="min-w-0">
                    <span className="mf-titulo block text-xl underline-offset-[5px] group-hover:underline">{p.displayName}</span>
                    <span className="text-[13px] text-[var(--mf-muted)]">{[p.city, n === 1 ? "1 muestra" : `${n} muestras`].filter(Boolean).join(". ")}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Enlaces en el encabezado y el pie**

`apps/muestras/components/encabezado/encabezado.tsx`, antes del enlace a `/proponer`:
```tsx
        {/* En el teléfono no entra: queda en el pie. */}
        <Link href="/fotografos" className={`${enlace} max-sm:hidden`}>Fotógrafos</Link>
```

`apps/muestras/components/pie/pie.tsx`, primer enlace dentro del `<nav>` (y cambiar `aria-label="Legales"` por `aria-label="Más"`):
```tsx
          <Link href="/fotografos" className={enlace}>Fotógrafos</Link>
```

- [ ] **Step 5: Tipos y prueba local**

Run: `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: sin errores.

Con `next dev`: un perfil con obras en una muestra publicada aparece en `/fotografos` y su página lista la muestra con las obras visibles; con la muestra abierta en modo "destacadas", una obra no destacada no aparece como imagen y se lee "Y 1 obra más para ver en la sala"; un perfil sin obras publicadas da 404; en la página de una obra vinculada, el autor enlaza al perfil.

- [ ] **Step 6: Commit**

```bash
git add apps/muestras
git commit -m "Perfiles públicos de fotógrafos y la página de quienes expusieron"
```

---

### Task 10: Fichas de sala con QR en PDF

**Files:**
- Modify: `apps/muestras/package.json` (+ `pnpm-lock.yaml`), `apps/muestras/lib/limite.ts`, `apps/muestras/lib/actividades/consultas.ts` (agregar `listarPublicadasMias`), `apps/muestras/app/panel/muestras/[id]/page.tsx`
- Create: `apps/muestras/lib/fichas/texto.ts`, `apps/muestras/lib/fichas/qr.ts`, `apps/muestras/lib/fichas/pdf.ts`, `apps/muestras/lib/fichas/cargar.ts`
- Create: `apps/muestras/app/api/fichas/[id]/route.ts`, `apps/muestras/app/panel/montaje/page.tsx`, `apps/muestras/components/panel/descargar-fichas.tsx`
- Test: `apps/muestras/lib/fichas/texto.test.ts`, `apps/muestras/lib/fichas/qr.test.ts`, `apps/muestras/lib/fichas/pdf.test.ts`, `apps/muestras/lib/fichas/cargar.test.ts`

**Interfaces:**
- Consumes: `workUrl` (Task 2); `MONTAJE_EN_PREPARACION` (Task 4).
- Produces:
  - `FichaDeObra = { muestra: string; titulo: string; autor: string; detalle: string | null; url: string }`
  - `paraWinAnsi(s): string`, `cortarEnLineas(texto, anchoMax, medir, maxLineas): string[]`, `datosDeFicha(a: { title; slug }, o: { id; title; authorName; year; technique }, baseUrl): FichaDeObra`
  - `matrizDelQr(url): boolean[][]`
  - `TAMANOS`, `TamanoFicha = "A6" | "A5"`, `esTamanoFicha(v)`, `MM`, `pdfDeFichas(fichas, tamano): Promise<Uint8Array>`
  - `baseUrlPublica(): string`, `cargarFichas(id, usuario, obraId): Promise<{ nombre: string; fichas: FichaDeObra[] } | null>`
  - `GET /api/fichas/[id]?tamano=A6|A5&obra=<workId>`
  - `listarPublicadasMias(userId)`, `DescargarFichas({ id, obras })`

- [ ] **Step 1: Dependencias (versiones del lockfile)**

En `apps/muestras/package.json`, en `dependencies`: `"pdf-lib": "^1.17.1"` y `"qrcode": "^1.5.4"`; en `devDependencies`: `"@types/qrcode": "^1.5.6"`.

Run: `pnpm install && git diff --stat pnpm-lock.yaml && git diff pnpm-lock.yaml | grep '^[-+]' | grep -v 'apps/muestras' | head -40`
Expected: las líneas cambiadas son sólo las tres dependencias nuevas del importer `apps/muestras` (`pdf-lib`, `qrcode`, `@types/qrcode`), con las versiones que ya estaban (`1.17.1`, `1.5.4`, `1.5.6`); ningún paquete nuevo en `packages:`. Si cambia otra cosa, frenar y avisar.

- [ ] **Step 2: Escribir los tests que fallan**

`apps/muestras/lib/fichas/texto.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { cortarEnLineas, datosDeFicha, paraWinAnsi } from "./texto";

describe("paraWinAnsi", () => {
  it("deja intacto el castellano", () => expect(paraWinAnsi("¿Ñandú? «Señal» — “sí”…")).toBe("¿Ñandú? «Señal» — “sí”…"));
  it("saca diacríticos que la fuente no tiene y pone ? a lo demás", () => {
    expect(paraWinAnsi("Łódź")).toBe("?ódz");
    expect(paraWinAnsi("Cámara 📷")).toBe("Cámara ?");
  });
  it("los saltos de línea pasan a espacios", () => expect(paraWinAnsi("uno\ndos")).toBe("uno dos"));
});

describe("cortarEnLineas", () => {
  const medir = (s: string) => s.length;
  it("corta por palabras", () => expect(cortarEnLineas("el río a la siesta", 8, medir, 5)).toEqual(["el río a", "la", "siesta"]));
  it("corta una palabra más larga que la línea", () => expect(cortarEnLineas("abcdefghij", 4, medir, 5)).toEqual(["abcd", "efgh", "ij"]));
  it("con más líneas que el tope, termina en puntos suspensivos", () => {
    expect(cortarEnLineas("uno dos tres cuatro cinco", 7, medir, 2)).toEqual(["uno dos", "tres…"]);
  });
  it("texto vacío, ninguna línea", () => expect(cortarEnLineas("   ", 10, medir, 2)).toEqual([]));
});

describe("datosDeFicha", () => {
  it("arma los textos y la URL de la obra", () => {
    const f = datosDeFicha(
      { title: "Miradas del litoral", slug: "miradas-abc123" },
      { id: "w1", title: "El río", authorName: "Ana Pérez", year: 2025, technique: "Copia pigmentaria" },
      "https://muestrasfotograficas.com",
    );
    expect(f).toEqual({
      muestra: "Miradas del litoral", titulo: "El río", autor: "Ana Pérez", detalle: "2025. Copia pigmentaria",
      url: "https://muestrasfotograficas.com/m/miradas-abc123/o/w1",
    });
  });
  it("sin autor ni datos", () => {
    const f = datosDeFicha({ title: "M", slug: "m" }, { id: "w", title: "T", authorName: " ", year: null, technique: null }, "https://x.com");
    expect([f.autor, f.detalle]).toEqual(["Autor sin indicar", null]);
  });
});
```

`apps/muestras/lib/fichas/qr.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { matrizDelQr } from "./qr";

describe("matrizDelQr", () => {
  it("devuelve una matriz cuadrada con el patrón de esquina", () => {
    const m = matrizDelQr("https://muestrasfotograficas.com/m/miradas-abc123/o/cm1abcdefghijklmnopqrstuv");
    expect(m.length).toBeGreaterThanOrEqual(21);
    expect(m.every((fila) => fila.length === m.length)).toBe(true);
    // El cuadrado de posición de arriba a la izquierda: borde negro de 7 módulos.
    expect(m[0]!.slice(0, 7).every(Boolean)).toBe(true);
  });
  it("sin dirección no hay QR", () => expect(() => matrizDelQr(" ")).toThrow("sin dirección"));
});
```

`apps/muestras/lib/fichas/pdf.test.ts`:
```ts
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { MM, pdfDeFichas } from "./pdf";

const ficha = {
  muestra: "Miradas del litoral", titulo: "El río a la siesta", autor: "Ana Pérez",
  detalle: "2025. Copia pigmentaria", url: "https://muestrasfotograficas.com/m/miradas-abc123/o/w1",
};
const medidas = async (bytes: Uint8Array) => {
  const doc = await PDFDocument.load(bytes);
  const { width, height } = doc.getPage(0).getSize();
  return { paginas: doc.getPageCount(), ancho: Math.round(width / MM), alto: Math.round(height / MM) };
};

describe("pdfDeFichas", () => {
  it("una página A6 por obra", async () => {
    expect(await medidas(await pdfDeFichas([ficha, { ...ficha, titulo: "Otra" }], "A6"))).toEqual({ paginas: 2, ancho: 105, alto: 148 });
  });
  it("A5", async () => {
    expect(await medidas(await pdfDeFichas([ficha], "A5"))).toEqual({ paginas: 1, ancho: 148, alto: 210 });
  });
  it("aguanta textos largos y caracteres que la fuente no tiene", async () => {
    const raro = { ...ficha, titulo: "Un título larguísimo ".repeat(12), autor: "Łukasz 📷" };
    await expect(pdfDeFichas([raro], "A6")).resolves.toBeInstanceOf(Uint8Array);
  });
  it("sin obras no hay PDF", async () => {
    await expect(pdfDeFichas([], "A6")).rejects.toThrow("No hay obras");
  });
});
```

`apps/muestras/lib/fichas/cargar.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ culturalActivity: { findFirst: vi.fn() } }));
vi.mock("@repo/db", () => ({ prisma: db }));

process.env.APP_URL = "https://muestrasfotograficas.com/";
const { cargarFichas } = await import("./cargar");

const muestra = {
  slug: "miradas-abc123", title: "Miradas",
  works: [
    { id: "w1", title: "Uno", authorName: "Ana", year: null, technique: null, sortOrder: 0 },
    { id: "w2", title: "Dos", authorName: "Luis", year: 2024, technique: null, sortOrder: 1 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  db.culturalActivity.findFirst.mockResolvedValue(muestra);
});

describe("cargarFichas", () => {
  it("sólo busca entre las publicadas propias", async () => {
    await cargarFichas("a1", { id: 7, esSuperAdmin: false }, null);
    expect(db.culturalActivity.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "a1", reviewStatus: "APPROVED", type: "MUESTRA", proposedByUserId: 7 },
    }));
  });
  it("el super admin no filtra por dueño", async () => {
    await cargarFichas("a1", { id: 1, esSuperAdmin: true }, null);
    expect(db.culturalActivity.findFirst.mock.calls[0]![0].where).not.toHaveProperty("proposedByUserId");
  });
  it("todas, con la URL pública de cada obra", async () => {
    const r = await cargarFichas("a1", { id: 7, esSuperAdmin: false }, null);
    expect(r?.nombre).toBe("fichas-miradas-abc123");
    expect(r?.fichas.map((f) => f.url)).toEqual([
      "https://muestrasfotograficas.com/m/miradas-abc123/o/w1",
      "https://muestrasfotograficas.com/m/miradas-abc123/o/w2",
    ]);
  });
  it("una sola obra lleva su número en el nombre", async () => {
    const r = await cargarFichas("a1", { id: 7, esSuperAdmin: false }, "w2");
    expect(r?.nombre).toBe("ficha-miradas-abc123-2");
    expect(r?.fichas).toHaveLength(1);
  });
  it("una obra de otra muestra, o una muestra ajena, no da nada", async () => {
    expect(await cargarFichas("a1", { id: 7, esSuperAdmin: false }, "w9")).toBeNull();
    db.culturalActivity.findFirst.mockResolvedValue(null);
    expect(await cargarFichas("a1", { id: 8, esSuperAdmin: false }, null)).toBeNull();
  });
});
```

- [ ] **Step 3: Correr y ver que fallan**

Run: `pnpm --filter muestras test`
Expected: FAIL — no existen los módulos de `lib/fichas`.

- [ ] **Step 4: Textos de la ficha**

`apps/muestras/lib/fichas/texto.ts`:
```ts
import { workUrl } from "@repo/muestras";

/** Lo que va impreso en la ficha de una obra. */
export type FichaDeObra = { muestra: string; titulo: string; autor: string; detalle: string | null; url: string };

/**
 * Las fuentes estándar del PDF (Helvetica) sólo saben escribir WinAnsi: el castellano entra
 * entero, pero una "Ł" o un emoji hacen fallar a pdf-lib. Se les sacan los diacríticos que no
 * existen ("ź" → "z") y lo que igual no entra sale como "?". Mejor una ficha con un "?" que
 * ninguna ficha.
 */
const EXTRAS_WINANSI = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const entra = (c: string) => {
  const cp = c.codePointAt(0)!;
  return (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || EXTRAS_WINANSI.includes(c);
};

export function paraWinAnsi(s: string): string {
  return Array.from(s.normalize("NFC"))
    .map((c) => {
      if (/\s/.test(c)) return " ";
      if (entra(c)) return c;
      const base = c.normalize("NFD").replace(/\p{Diacritic}/gu, "");
      return base && Array.from(base).every(entra) ? base : "?";
    })
    .join("");
}

/** Corta un texto en líneas que entran en `anchoMax`; si sobran líneas, la última termina en "…". */
export function cortarEnLineas(texto: string, anchoMax: number, medir: (s: string) => number, maxLineas: number): string[] {
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of texto.trim().split(/\s+/).filter(Boolean)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (medir(prueba) <= anchoMax) {
      actual = prueba;
      continue;
    }
    if (actual) lineas.push(actual);
    actual = palabra;
    // Una palabra sola más ancha que la línea se corta por letras.
    while (medir(actual) > anchoMax && actual.length > 1) {
      let i = actual.length - 1;
      while (i > 1 && medir(actual.slice(0, i)) > anchoMax) i--;
      lineas.push(actual.slice(0, i));
      actual = actual.slice(i);
    }
  }
  if (actual) lineas.push(actual);
  if (lineas.length <= maxLineas) return lineas;
  const recortadas = lineas.slice(0, maxLineas);
  let ultima = recortadas[maxLineas - 1]!;
  while (ultima.length > 1 && medir(`${ultima}…`) > anchoMax) ultima = ultima.slice(0, -1).trimEnd();
  recortadas[maxLineas - 1] = `${ultima}…`;
  return recortadas;
}

export function datosDeFicha(
  a: { title: string; slug: string },
  o: { id: string; title: string; authorName: string; year: number | null; technique: string | null },
  baseUrl: string,
): FichaDeObra {
  const detalle = [o.year ? String(o.year) : null, o.technique?.trim() || null].filter(Boolean).join(". ");
  return {
    muestra: a.title,
    titulo: o.title,
    autor: o.authorName.trim() || "Autor sin indicar",
    detalle: detalle || null,
    url: workUrl(baseUrl, a.slug, o.id),
  };
}
```

- [ ] **Step 5: El QR**

`apps/muestras/lib/fichas/qr.ts`:
```ts
import QRCode from "qrcode";

/**
 * La matriz de módulos del QR (`true` = negro), para dibujarlo como vectores en el PDF: se
 * imprime nítido a cualquier tamaño. Corrección M: aguanta una ficha algo rayada o sucia.
 */
export function matrizDelQr(url: string): boolean[][] {
  if (!url.trim()) throw new Error("No se puede armar un QR sin dirección.");
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const datos = qr.modules.data;
  return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => Boolean(datos[y * n + x])));
}
```

- [ ] **Step 6: El PDF**

`apps/muestras/lib/fichas/pdf.ts`:
```ts
import { PDFDocument, StandardFonts, rgb, type Color, type PDFFont, type PDFPage } from "pdf-lib";
import { matrizDelQr } from "./qr";
import { cortarEnLineas, paraWinAnsi, type FichaDeObra } from "./texto";

/** Puntos PDF por milímetro. */
export const MM = 72 / 25.4;

/**
 * Medidas de cada tamaño (milímetros para el papel, puntos para la letra). Una ficha por página
 * y al tamaño final: cualquier imprenta la imprime y corta sin armar pliegos. Fondo blanco, así
 * que no hace falta sangrado.
 */
export const TAMANOS = {
  A6: { ancho: 105, alto: 148, margen: 9, qr: 32, muestra: 8, titulo: 16, autor: 11, detalle: 9 },
  A5: { ancho: 148, alto: 210, margen: 13, qr: 44, muestra: 10, titulo: 22, autor: 15, detalle: 12 },
} as const;
export type TamanoFicha = keyof typeof TAMANOS;
type Medidas = (typeof TAMANOS)[TamanoFicha];

export function esTamanoFicha(v: unknown): v is TamanoFicha {
  return v === "A6" || v === "A5";
}

// Los colores del sitio: tinta, grafito y línea.
const TINTA = rgb(0x1c / 255, 0x2b / 255, 0x35 / 255);
const GRIS = rgb(0x5b / 255, 0x66 / 255, 0x70 / 255);
const LINEA = rgb(0xe4 / 255, 0xe7 / 255, 0xe9 / 255);
const NEGRO = rgb(0, 0, 0);

type Fuentes = { normal: PDFFont; negrita: PDFFont };

export async function pdfDeFichas(fichas: FichaDeObra[], tamano: TamanoFicha): Promise<Uint8Array> {
  if (fichas.length === 0) throw new Error("No hay obras para imprimir.");
  const t = TAMANOS[tamano];
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Fichas de sala: ${paraWinAnsi(fichas[0]!.muestra)}`);
  pdf.setCreator("Muestras Fotográficas");
  pdf.setProducer("Muestras Fotográficas");
  const fuentes: Fuentes = {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    negrita: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  for (const f of fichas) dibujarFicha(pdf.addPage([t.ancho * MM, t.alto * MM]), f, t, fuentes);
  return pdf.save();
}

/** Escribe un bloque de texto desde `y` hacia abajo y devuelve dónde terminó. */
function bloque(
  p: PDFPage,
  texto: string,
  o: { x: number; y: number; ancho: number; size: number; font: PDFFont; color: Color; maxLineas: number; interlinea?: number },
): number {
  const lineas = cortarEnLineas(paraWinAnsi(texto), o.ancho, (s) => o.font.widthOfTextAtSize(s, o.size), o.maxLineas);
  let y = o.y;
  for (const l of lineas) {
    y -= o.size * (o.interlinea ?? 1.2);
    p.drawText(l, { x: o.x, y, size: o.size, font: o.font, color: o.color });
  }
  return y;
}

function dibujarFicha(p: PDFPage, f: FichaDeObra, t: Medidas, { normal, negrita }: Fuentes) {
  const ancho = t.ancho * MM;
  const alto = t.alto * MM;
  const m = t.margen * MM;
  const util = ancho - 2 * m;

  // Arriba, la muestra: chica, en gris, con una línea fina debajo.
  let y = bloque(p, f.muestra, { x: m, y: alto - m, ancho: util, size: t.muestra, font: normal, color: GRIS, maxLineas: 2 });
  y -= t.muestra * 0.9;
  p.drawLine({ start: { x: m, y }, end: { x: ancho - m, y }, thickness: 0.5, color: LINEA });
  y -= t.titulo * 0.6;
  // El título manda: negrita y grande, hasta tres líneas.
  y = bloque(p, f.titulo, { x: m, y, ancho: util, size: t.titulo, font: negrita, color: TINTA, maxLineas: 3, interlinea: 1.1 });
  y -= t.autor * 0.5;
  y = bloque(p, f.autor, { x: m, y, ancho: util, size: t.autor, font: normal, color: TINTA, maxLineas: 2 });
  if (f.detalle) {
    y -= t.detalle * 0.3;
    bloque(p, f.detalle, { x: m, y, ancho: util, size: t.detalle, font: normal, color: GRIS, maxLineas: 2 });
  }

  // Abajo a la izquierda el QR; a su derecha, la invitación.
  const lado = t.qr * MM;
  dibujarQr(p, matrizDelQr(f.url), m, m, lado);
  const xTexto = m + lado + 4 * MM;
  const anchoTexto = ancho - m - xTexto;
  const yInvitacion = bloque(p, "Escaneá para ver la obra y a su autor", {
    x: xTexto, y: m + lado, ancho: anchoTexto, size: t.detalle, font: normal, color: TINTA, maxLineas: 3,
  });
  bloque(p, "muestrasfotograficas.com", {
    x: xTexto, y: yInvitacion - t.detalle * 0.4, ancho: anchoTexto, size: t.detalle * 0.85, font: normal, color: GRIS, maxLineas: 2,
  });
}

/** El QR como cuadraditos vectoriales. La matriz se lee de arriba abajo y el PDF mide desde abajo. */
function dibujarQr(p: PDFPage, modulos: boolean[][], x: number, y: number, lado: number) {
  const n = modulos.length;
  const mod = lado / n;
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      if (!modulos[f]![c]) continue;
      p.drawRectangle({ x: x + c * mod, y: y + (n - 1 - f) * mod, width: mod, height: mod, color: NEGRO });
    }
  }
}
```

- [ ] **Step 7: Cargar las fichas con permiso**

`apps/muestras/lib/fichas/cargar.ts`:
```ts
import "server-only";
import { prisma } from "@repo/db";
import type { Usuario } from "@/lib/usuario";
import { datosDeFicha, type FichaDeObra } from "./texto";

/** La dirección pública del sitio, la que va en el QR. En local apunta a `localhost`. */
export function baseUrlPublica(): string {
  return (process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://muestrasfotograficas.com").replace(/\/+$/, "");
}

/**
 * Las fichas de una muestra **publicada** de la persona (cualquiera, si es super admin): una
 * ficha con QR a una página que no existe no sirve. `null` = no corresponde (no existe, no es
 * suya, no está publicada, no es una muestra, o la obra pedida no es de esta muestra).
 */
export async function cargarFichas(
  id: string,
  usuario: Pick<Usuario, "id" | "esSuperAdmin">,
  obraId: string | null,
): Promise<{ nombre: string; fichas: FichaDeObra[] } | null> {
  const a = await prisma.culturalActivity.findFirst({
    where: { id, reviewStatus: "APPROVED", type: "MUESTRA", ...(usuario.esSuperAdmin ? {} : { proposedByUserId: usuario.id }) },
    select: {
      slug: true, title: true,
      works: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, authorName: true, year: true, technique: true, sortOrder: true } },
    },
  });
  if (!a) return null;
  const obras = obraId ? a.works.filter((w) => w.id === obraId) : a.works;
  if (obras.length === 0) return null;
  const base = baseUrlPublica();
  return {
    nombre: obraId ? `ficha-${a.slug}-${obras[0]!.sortOrder + 1}` : `fichas-${a.slug}`,
    fichas: obras.map((o) => datosDeFicha(a, o, base)),
  };
}
```

- [ ] **Step 8: La ruta del PDF**

En `apps/muestras/lib/limite.ts`, dentro de `LIMITES`:
```ts
  fichas: { limit: 30, windowMs: 10 * 60_000 },
```

`apps/muestras/app/api/fichas/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { cargarFichas } from "@/lib/fichas/cargar";
import { esTamanoFicha, pdfDeFichas } from "@/lib/fichas/pdf";
import { frenarPorUsuario } from "@/lib/limite";
import { getUsuario } from "@/lib/usuario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PDF de fichas de sala: todas (`?tamano=A6`) o una (`&obra=<id>`). Sólo dueño o super admin. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuario();
  if (!usuario) return NextResponse.json({ error: "Tenés que ingresar." }, { status: 401 });
  if (!frenarPorUsuario("fichas", usuario.id).allowed) {
    return NextResponse.json({ error: "Pediste muchas fichas seguidas. Esperá unos minutos." }, { status: 429 });
  }
  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  const pedido = sp.get("tamano");
  const tamano = esTamanoFicha(pedido) ? pedido : "A6";
  const datos = await cargarFichas(id, usuario, sp.get("obra"));
  if (!datos) return NextResponse.json({ error: "No encontramos esa muestra publicada entre las tuyas." }, { status: 404 });
  try {
    const pdf = await pdfDeFichas(datos.fichas, tamano);
    // El slug sólo tiene a-z, 0-9 y guiones: va seguro en la cabecera.
    return new Response(pdf as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${datos.nombre}-${tamano}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/fichas:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "No pudimos armar el PDF. Probá de nuevo." }, { status: 500 });
  }
}
```

- [ ] **Step 9: Botones de descarga, Montaje e impresión, y dentro de cada muestra**

`apps/muestras/components/panel/descargar-fichas.tsx`:
```tsx
const enlace = "underline underline-offset-[6px]";
const url = (id: string, tamano: "A6" | "A5", obra?: string) =>
  `/api/fichas/${encodeURIComponent(id)}?tamano=${tamano}${obra ? `&obra=${encodeURIComponent(obra)}` : ""}`;

/** Enlaces de descarga del PDF de fichas: todas juntas o una por obra, en A6 o A5. */
export function DescargarFichas({ id, obras }: { id: string; obras: { id: string; title: string }[] }) {
  if (obras.length === 0) return <p className="text-[15px] text-[var(--mf-muted)]">Esta muestra no tiene obras cargadas.</p>;
  return (
    <div className="space-y-2 text-[15px]">
      <p>
        Todas las fichas ({obras.length}): <a href={url(id, "A6")} className={enlace}>A6</a> · <a href={url(id, "A5")} className={enlace}>A5</a>
      </p>
      <details>
        <summary className="cursor-pointer text-[var(--mf-muted)]">Una por obra</summary>
        <ul className="mt-2 space-y-1">
          {obras.map((o) => (
            <li key={o.id}>
              {o.title}: <a href={url(id, "A6", o.id)} className={enlace}>A6</a> · <a href={url(id, "A5", o.id)} className={enlace}>A5</a>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
```

Al final de `apps/muestras/lib/actividades/consultas.ts`:
```ts
/** Muestras publicadas propias, con sus obras, para "Montaje e impresión". */
export function listarPublicadasMias(userId: number) {
  return prisma.culturalActivity.findMany({
    where: { proposedByUserId: userId, reviewStatus: "APPROVED", type: "MUESTRA" },
    select: { id: true, slug: true, title: true, startsAt: true, endsAt: true, works: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true } } },
    orderBy: { startsAt: "desc" },
  });
}
```

`apps/muestras/app/panel/montaje/page.tsx`:
```tsx
import Link from "next/link";
import { formatArDay } from "@repo/muestras";
import { DescargarFichas } from "@/components/panel/descargar-fichas";
import { listarPublicadasMias } from "@/lib/actividades/consultas";
import { MONTAJE_EN_PREPARACION } from "@/lib/panel/en-preparacion";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Montaje e impresión" };

export default async function Montaje() {
  const usuario = await requireUsuario("/panel/montaje");
  const muestras = await listarPublicadasMias(usuario.id);
  return (
    <main className="max-w-3xl space-y-12">
      <header className="space-y-3">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Montaje e impresión</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">
          Fichas de sala con código QR, listas para imprimir: título, autor, año y técnica de cada obra. El QR lleva a la página de la obra.
        </p>
      </header>
      {muestras.length === 0 ? (
        <p className="border-t border-[var(--mf-line)] pt-6 text-lg">
          Cuando tengas una muestra publicada, acá vas a poder bajar sus fichas. <Link href="/panel/proponer" className="underline underline-offset-[6px]">Proponer una muestra</Link>
        </p>
      ) : (
        <ul className="border-t border-[var(--mf-line)]">
          {muestras.map((m) => (
            <li key={m.id} className="space-y-3 border-b border-[var(--mf-line)] py-6">
              <div>
                <h2 className="mf-titulo text-[1.6rem]"><Link href={`/panel/muestras/${m.id}`} className="underline-offset-[5px] hover:underline">{m.title}</Link></h2>
                <p className="text-sm text-[var(--mf-muted)]">{formatArDay(m.startsAt)} al {formatArDay(m.endsAt)}</p>
              </div>
              <DescargarFichas id={m.id} obras={m.works} />
            </li>
          ))}
        </ul>
      )}
      <section aria-labelledby="t-proximo" className="space-y-3">
        <h2 id="t-proximo" className="text-sm text-[var(--mf-muted)]">También en preparación</h2>
        <ul className="border-t border-[var(--mf-line)]">
          {MONTAJE_EN_PREPARACION.map((p) => <li key={p} className="border-b border-[var(--mf-line)] py-3 text-[15px]">{p}</li>)}
        </ul>
      </section>
    </main>
  );
}
```

En `apps/muestras/app/panel/muestras/[id]/page.tsx`:
- `import { DescargarFichas } from "@/components/panel/descargar-fichas";`
- Dentro del bloque `estado === "APPROVED"`, después de `<BotonesPublicada … />`:
```tsx
          {a.type === "MUESTRA" ? (
            <section className="space-y-2 border-t border-[var(--mf-line)] pt-4">
              <h2 className="text-sm text-[var(--mf-muted)]">Fichas de sala con QR</h2>
              <DescargarFichas id={a.id} obras={a.works} />
            </section>
          ) : null}
```

- [ ] **Step 10: Correr y ver que pasa**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: PASS.

- [ ] **Step 11: Probar en local, impreso**

Con `next dev`: desde `/panel/montaje` bajar "Todas las fichas" A6 y A5 de una muestra publicada propia; abrir el PDF: una página por obra, al tamaño correcto, títulos largos con "…", QR abajo a la izquierda. Escanear el QR con el teléfono desde la pantalla (con `APP_URL=http://<ip-local>:3014` si se quiere abrir en el teléfono). Con otra cuenta, `curl -s -o /dev/null -w "%{http_code}" -b <cookie> localhost:3014/api/fichas/<id>` → `404`; sin sesión → `401`. **Imprimir una ficha A6 real y escanearla** antes de dar por buena la medida del QR.

- [ ] **Step 12: Commit**

```bash
git add apps/muestras pnpm-lock.yaml
git commit -m "Fichas de sala con QR en PDF, desde Montaje e impresión y desde cada muestra"
```

---

### Task 11: Verificación final, migración en producción (con permiso) y PR

**Files:**
- Modify: `docs/operations/muestras-puesta-en-marcha.md` (sección "Etapa 2")

- [ ] **Step 1: Todos los chequeos**

Run: `pnpm --filter @repo/muestras test && pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice typecheck && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras build`
Expected: todo en verde. Mirar que el build realmente terminó ("Compiled successfully" y la tabla de rutas con `/panel`, `/m/[slug]/o/[workId]`, `/fotografos/[slug]`, `/api/fichas/[id]`): si murió por memoria puede devolver éxito igual.

- [ ] **Step 2: Aplicar la migración en producción — SÓLO con permiso explícito de Daniel**

Pedir permiso así: "Voy a crear una tabla nueva (perfiles de fotógrafo) y agregar una columna opcional a las obras de Muestras, en la base de FOTOFFICE/FotoRank. No modifica ni borra datos. Si algo sale mal, se borran la columna y la tabla. Tiene que ir antes de publicar el código, porque el código nuevo pide esa columna."

Con el sí:
1. Correr el contenido de `packages/db/prisma/migrations/20261027120000_muestras_etapa_2_perfiles/migration.sql` en la rama `development` (`br-old-rain-adwthzng`) del proyecto `divine-hall-10689679` (Neon MCP `run_sql_transaction`, una sentencia por elemento).
2. Verificar:
```sql
select
  (select count(*) from information_schema.tables where table_name = 'PhotographerProfile') as tabla,
  (select count(*) from information_schema.columns where table_name = 'CulturalActivityWork' and column_name = 'authorProfileId') as columna;
```
Expected: `tabla = 1`, `columna = 1`.
3. Registrar con el checksum del archivo:

Run: `shasum -a 256 packages/db/prisma/migrations/20261027120000_muestras_etapa_2_perfiles/migration.sql`
```sql
insert into "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
values (gen_random_uuid()::text, '<sha256 del paso anterior>', now(), '20261027120000_muestras_etapa_2_perfiles', null, null, now(), 1);
```
4. Confirmar: `select migration_name, checksum from "_prisma_migrations" where migration_name = '20261027120000_muestras_etapa_2_perfiles';` → una fila con el mismo checksum.

- [ ] **Step 3: Recorrido completo en local contra la base ya migrada**

Con `pnpm --filter muestras dev`, en el navegador:
1. Sin sesión: encabezado con "Fotógrafos", "Proponé tu muestra", "Ingresar"; `/mis-muestras` lleva al login y después a `/panel/muestras`.
2. Con sesión común: "Mi panel" → Inicio con contadores; la barra muestra Tu cuenta y Para organizar (sin Revisión); Convocatorias, Curaduría, Ventas y Estadísticas abren "En preparación".
3. Crear el perfil; proponer una muestra con dos obras, una con el autor igual al nombre del perfil → se vincula sola.
4. Como super admin: aprobarla desde `/panel/revision`.
5. Página de la obra destacada (con foto) y de la no destacada (sólo ficha) mientras está abierta; ambas enlazan a la muestra y al perfil.
6. `/fotografos` lista el perfil; su página muestra la destacada y "Y 1 obra más para ver en la sala".
7. Editar la muestra publicada y guardar: la URL de cada obra no cambia.
8. Bajar las fichas A6 y A5 y escanear un QR.
9. "No es mía" en Mi perfil quita la obra del perfil público.
10. Repetir 2, 5 y 6 a 375 px de ancho (cajón del panel, sin scroll horizontal).

- [ ] **Step 4: Guía de puesta en marcha**

Agregar al final de `docs/operations/muestras-puesta-en-marcha.md`:
```markdown
## Etapa 2 (panel, obras, fichas con QR, perfiles)

1. Aplicar la migración `20261027120000_muestras_etapa_2_perfiles` y registrarla con su SHA-256 (plan de la etapa 2, Task 11 Step 2). — Claude con permiso. **Antes** del deploy.
2. Fusionar el PR: Vercel publica `apps/muestras` (y recompila las apps que dependen de `packages/db`).
3. Verificar en producción: `/panel`, `/fotografos`, la página de una obra y la descarga de fichas de una muestra publicada.
4. Imprimir una ficha A6 de prueba y escanearla antes de mandar fichas a imprenta. — Daniel.
```

- [ ] **Step 5: Commit y PR**

```bash
git add docs/operations/muestras-puesta-en-marcha.md
git commit -m "Guía de puesta en marcha de la Etapa 2 de Muestras"
git push -u origin feat/muestras-etapa-2
gh pr create --title "Muestras Fotográficas — Etapa 2: panel, obras, fichas con QR y perfiles" --body "<resumen en español: qué cambia para quien usa el sitio, la migración ya aplicada (o pendiente), checklist del Step 3>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Cobertura del spec

| Spec | Task |
|---|---|
| D1 panel en `app/panel`, encabezado arriba | 4 |
| D2 barra con tres grupos, cajón en el teléfono | 1, 4 |
| D3 secciones "En preparación" | 1, 4 |
| D4 redirecciones de URLs viejas | 5 |
| D5 "Mi panel" y "Fotógrafos" en el encabezado | 4, 9 |
| D6, D7 página de obra: completa / sólo ficha, misma regla que la galería | 2, 6 |
| D8, D9 fichas PDF A6/A5 con QR vectorial, sólo dueño y publicada | 10 |
| D10 tabla de perfiles, uno por cuenta | 3, 7 |
| D11 vínculo obra ↔ perfil, por defecto el propio | 2, 8 |
| D12 "No es mía" | 7 |
| D13 avatar | 7 |
| D14 índice y perfil sin adelantar fotos | 2, 9 |
| D15 ids de obra estables | 8 |
| D16 perfil público sólo con obra publicada | 9 |
| Migración a mano + checksum, antes del deploy | 3, 11 |
