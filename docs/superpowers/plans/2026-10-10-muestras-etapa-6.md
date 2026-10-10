# Muestras Fotográficas — Etapa 6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que quien organiza una muestra presencial pueda **juntar las obras de sus expositores por un enlace** (cada obra: foto principal que se cuelga + fotos adicionales, con todos los datos para ficha, catálogo y plano; aprobación por obra) y **cuidar la sorpresa**: elegir, por punto de entrada (publicación online, perfil del artista, QR de la sala), qué se ve de las obras expuestas; online se presenta a los artistas con su biografía y sus obras no expuestas, y el QR de la ficha da un **pase de sala** de 8 horas que muestra todo.

**Architecture:** Igual que las etapas 1 a 5: reglas puras en `packages/muestras` con vitest (visibilidad, sorteo determinista, expositores, pase de sala) y la app como capa delgada sobre `@repo/db`. Una sola regla de visibilidad (`parseVisibility` + `visibleWorks`/`workAccess`/`profileWorksInActivity`) alimenta todo lo público, que sigue siendo ISR. Lo aprobado de los expositores se copia a `CulturalActivityWork` (todo lo construido sigue funcionando sin cambios) y la obra del expositor guarda `activityWorkId` sin FK (como la convocatoria). El pase de sala es una cookie HMAC por muestra, emitida sólo por `/q/s/<código>`; la vista de sala es una ruta aparte, dinámica y privada, con imágenes por proxy. Migración escrita a mano: una columna JSON en `CulturalActivity` y seis tablas nuevas.

**Tech Stack:** Next.js 16.2.1 (App Router, `params` como Promise, `cookies()` asíncrono, `--webpack`), React 19.2.4, Prisma 6 (`@repo/db`), Tailwind 4, `sharp 0.34.5`, `pdf-lib 1.17.1`, `qrcode ^1.5.4`, `@aws-sdk/client-s3`, `node:crypto`, vitest 3. **Sin dependencias nuevas.**

**Spec:** `docs/superpowers/specs/2026-10-10-muestras-etapa-6-design.md` (decisiones D1–D33). Diseño general: `docs/superpowers/specs/2026-10-08-muestras-fotograficas-design.md`. Etapa anterior: `docs/superpowers/plans/2026-10-10-muestras-etapa-5.md`.

## Global Constraints

- Todo texto visible y todo comentario en **español rioplatense con voseo**, claro y sin "próximamente"; identificadores en inglés dentro de `packages/muestras`, en español en la app.
- Estados, modos y presets como **texto** (`String`/JSON), nunca enum de Prisma. Ids de usuario `Int` **sin relación Prisma a `User`**. Ids `cuid()`.
- Fechas en **hora argentina** con `dates.ts` (`toArDay`, `dayEndAr`, `formatArDay`…). La fecha límite del enlace es el **fin del día argentino** (`dayEndAr`).
- **Sin dependencias nuevas** ni versiones fuera del lockfile. Después de cualquier `pnpm install`, `git diff pnpm-lock.yaml` vacío; si se mueve, frenar y avisar.
- Chequeos de tipos y build con `NODE_OPTIONS=--max-old-space-size=8192` y mirar que realmente terminaron.
- Diseño: tokens de `apps/muestras/app/globals.css`, `.mf-titulo`, líneas finas, botones finos (`h-11 border border-[var(--mf-ink)] px-5`), `rounded-[2px]`. Clases repetidas en `components/expositores/estilos.ts` y `components/visibilidad/estilos.ts` (pueden reexportar `components/montaje/estilos.ts`).
- **Autorización del lado del servidor en cada página, acción y ruta.** Cada `page.tsx` del panel llama `requireUsuario(<su propia ruta>)`; cada acción vuelve a leer la sesión y el permiso **en la base**: `rolEnMuestra` + `puede(usuario, "exhibitors" | "visibility", rol)` o `dondePuede(...)` para la organización; la fila `CulturalExhibitor` propia (`userId = usuario.id`, `status = "ACTIVE"`) para el expositor. Toda negativa del panel es `notFound()`. Ninguna comprobación nueva usa `proposedByUserId` directamente.
- **Ninguna página pública lee cookies** (siguen siendo ISR con `revalidate = 300`). Sólo la vista de sala (`/m/[slug]/sala/**`) y `/q` tocan la cookie del pase.
- **Ninguna URL del bucket de una obra oculta** puede llegar a HTML, a la carga de un componente cliente, a metadatos ni a piezas públicas. Los tests de las Tasks 5 y 12 lo verifican buscando la URL en lo que se renderiza.
- **Correo apagado en producción**: nada de esta etapa manda correos; todo se ve en pantalla.
- En páginas públicas **no** aparecen palabras de revisión ni aprobación.
- Puerto de desarrollo **3014**. Probar con `next dev` (las vistas previas de Vercel no sirven).
- Trabajar en el worktree `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-muestras-6`, rama `feat/muestras-etapa-6` (sale de `feat/muestras-etapa-5`, que sale de `feat/muestras-etapa-4`; ninguna fusionada). **Antes de la Task 14, rebasar sobre `origin/main`** si las anteriores ya se fusionaron.
- La migración **no se aplica sola**: la aplica **a mano en producción el controlador**, con la autorización de Daniel, **después** de las de las etapas 4 y 5 y **antes** de publicar el código, y la registra en `_prisma_migrations` con el SHA-256 del archivo (Task 14). La columna nueva de `CulturalActivity` sin aplicar rompe **todo** el sitio.

## Mapa de archivos

```
packages/muestras/src/
  visibility.ts (+ visibility.test.ts)       — ajuste, presets, parse, sorteo, sala, resumen, portada
  gallery.ts, work-access.ts, profile.ts (+ tests) — leen `visibility`
  exhibitors.ts (+ exhibitors.test.ts)       — enlace, alta, datos de obra y adicionales, estados, textos, copia a la muestra
  room.ts (+ room.test.ts)                   — código de sala, pase (sin firma), vigencia, entrada de compra
  team.ts (+ team.test.ts)                   — capacidades `exhibitors`, `visibility`
  stats.ts (+ stats.test.ts)                 — QR tipo `s`
  social.ts (+ social.test.ts)               — "Obra destacada" con obras visibles online
  panel.ts (+ panel.test.ts)                 — sección "Donde expongo"
  index.ts                                   — reexporta visibility, exhibitors, room
packages/db/prisma/schema.prisma             — `CulturalActivity.visibility`; 6 modelos nuevos; relación en PhotographerProfile
packages/db/prisma/migrations/20261031120000_muestras_etapa_6_expositores/migration.sql
apps/muestras/
  lib/actividades/consultas.ts               — buscarPorSlug con artistas y adicionales
  lib/actividades/acciones.ts (+ .test.ts)   — obras de expositores en el editor (D9), galleryMode con ajuste (D16)
  lib/actividades/textos.ts (+ .test.ts)     — copia de vuelta a la obra del expositor
  lib/actividades/mapear.ts (+ .test.ts)     — galleryMode sólo sin ajuste
  lib/perfiles/consultas.ts                  — visibility y adicionales en el perfil público
  lib/visibilidad/acciones.ts (+ .test.ts), consultas.ts
  lib/expositores/enlace.ts (+ .test.ts)     — crear, guardar, renovar, cerrar el enlace
  lib/expositores/alta.ts (+ .test.ts)       — sumarme como expositor (con perfil)
  lib/expositores/obras.ts (+ .test.ts)      — el expositor: guardar, borrar, enviar, retirar
  lib/expositores/revision.ts (+ .test.ts)   — la organización: aprobar, pedir cambios, corregir, sacar
  lib/expositores/consultas.ts, mapear.ts (+ .test.ts)
  lib/sala/llave.ts (+ .test.ts)             — llave por muestra, firmar y leer el pase
  lib/sala/codigos.ts (+ .test.ts)           — códigos de sala (asegurar, cambiar)
  lib/sala/consultas.ts (+ .test.ts)         — qué ve el pase
  lib/sala/acciones.ts (+ .test.ts)          — cortar accesos, cambiar códigos
  lib/estadisticas/qr.ts (+ qr-ruta.test.ts) — destino `s`
  lib/fichas/texto.ts, cargar.ts (+ tests)   — `/q/s/<código>`, medidas y edición
  lib/piezas/catalogo.ts, cargar.ts (+ tests) — datos del expositor en el catálogo
  lib/redes/cargar.ts (+ ruta.test.ts)       — "Obra destacada" respeta la sorpresa
  lib/limite.ts (+ .test.ts)                 — frenos nuevos
  app/q/[tipo]/[id]/route.ts                 — `s`: cuenta, pase, redirige
  app/m/[slug]/page.tsx                      — galería con la sorpresa; "Artistas"
  app/m/[slug]/o/[workId]/page.tsx           — sin cambios de lógica (la regla cambió)
  app/m/[slug]/sala/page.tsx, sala/o/[workId]/page.tsx, sala/img/[id]/route.ts
  app/fotografos/[slug]/page.tsx             — "Otras obras"
  app/expositores/[token]/page.tsx
  app/panel/expositor/page.tsx, app/panel/expositor/[id]/page.tsx
  app/panel/muestras/[id]/expositores/page.tsx, app/panel/muestras/[id]/visibilidad/page.tsx
  app/panel/muestras/[id]/page.tsx, app/panel/muestras/page.tsx — enlaces y contador "para revisar"
  app/privacidad/page.tsx
  components/ficha/{galeria.tsx, artistas.tsx}
  components/sala/{obra-de-sala.tsx, entrada-de-compra.tsx}
  components/expositores/{alta-expositor.tsx, obras-expositor.tsx, obra-expositor.tsx, enlace-expositores.tsx, revision-expositores.tsx, estilos.ts}
  components/visibilidad/{ajuste-visibilidad.tsx, estilos.ts}
  components/formulario/{formulario-actividad.tsx, obras.tsx} — galleryMode → enlace a Visibilidad; obras de expositor bloqueadas
  components/montaje/editor-montaje.tsx      — propone la medida con marco del expositor
docs/operations/muestras-puesta-en-marcha.md — sección "Etapa 6"
```

Orden: 1 → 2 → 3 → 4 (schema) → 5 → … → 14. Las Tasks 1–3 son independientes entre sí (reglas puras). Desde la Task 5 todo usa el cliente Prisma nuevo (Task 4). 5 → 6 (visibilidad pública y su panel); 7 → 8 → 9 → 10 (expositores); 11 depende de 10 (datos del expositor) y de 12 sólo en el QR (`/q/s` existe desde la 12: hacer la 12 antes de la 11 o dejar la 11 para el final); 13 depende de 5. Los tests de la app mockean `@repo/db`, `@/lib/usuario`, `next/cache`, `next/headers` y R2 con el mismo patrón que `lib/montaje/acciones.test.ts` y `lib/estadisticas/qr-ruta.test.ts`.

---

### Task 1: Reglas de visibilidad — ajuste, presets, sorteo y punto de entrada

**Files:**
- Create: `packages/muestras/src/visibility.ts`, `packages/muestras/src/visibility.test.ts`
- Modify: `packages/muestras/src/gallery.ts` (+ `gallery.test.ts`), `packages/muestras/src/work-access.ts` (+ `work-access.test.ts`), `packages/muestras/src/profile.ts` (+ `profile.test.ts`), `packages/muestras/src/team.ts` (+ `team.test.ts`), `packages/muestras/src/index.ts`

**Interfaces:**
- Consumes: `stableHash` (`curation.ts`), `toArDay`, `temporalStatus` (`dates.ts`), `MAX_HIGHLIGHTS` (`constants.ts`).
- Produces (`visibility.ts`):
  - `ONLINE_EXHIBITED = ["ALL","HIGHLIGHTS","RANDOM","NONE"]`, `RANDOM_ROTATIONS = ["FIXED","DAILY"]`, `PROFILE_EXHIBITED = ["LIKE_ONLINE","NONE"]`, `ROOM_EXHIBITED = ["SCANNED","ARTIST","ALL"]`, `VISIBILITY_PRESETS = ["PREVIEW","SURPRISE","HIGHLIGHTS","OPEN","CUSTOM"]` y sus tipos; `VISIBILITY_PRESET_LABELS`, `VISIBILITY_PRESET_DESCRIPTIONS`, `ONLINE_EXHIBITED_LABELS`, `ROOM_EXHIBITED_LABELS`.
  - `type Visibility = { v: 1; preset; online: { exhibited; randomCount; rotation; seed; artists; otherWorks }; profile: { exhibited; otherWorks }; room: { exhibited; otherWorks; otherExhibitions; buy }; revealAfterClose: boolean }`.
  - `RANDOM_COUNT_RANGE = [1, 12]`, `DEFAULT_RANDOM_COUNT = 3`.
  - `visibilityFromPreset(preset, seed): Visibility`; `presetOf(v): VisibilityPreset` (`CUSTOM` si no coincide con ninguno).
  - `parseVisibility(json: unknown, galleryMode: string): Visibility` (vacío o roto → legado, D16).
  - `onlineExhibitedWorks(v, a, works, now): { works; isPartial; hiddenCount }`.
  - `roomExhibitedWorks(v, works, scannedIds): W[]` (`W` con `authorProfileId`, `authorName`).
  - `visibilitySummary(v): { online: string; profile: string; room: string; afterClose: string }`.
  - `coverIsHiddenWork(coverUrl, works, shownIds): boolean`.
  - `gallery.ts`: `visibleWorks(a: { galleryMode; visibility?; startsAt; endsAt }, works, now)` = `onlineExhibitedWorks(parseVisibility(a.visibility, a.galleryMode), …)` (misma salida `{ works, isPartial }` y suma `hiddenCount`).
  - `work-access.ts`, `profile.ts`: el tipo de la muestra suma `visibility?: unknown`; `profileWorksInActivity` mira `profile.exhibited`.
  - `team.ts`: `CAPABILITIES` suma `"exhibitors"` y `"visibility"`; `CO_ORGANIZER` las tiene; `TEXT_EDITOR` no.

- [ ] **Step 1: Escribir los tests que fallan**

`packages/muestras/src/visibility.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  coverIsHiddenWork, onlineExhibitedWorks, parseVisibility, presetOf, roomExhibitedWorks,
  visibilityFromPreset, visibilitySummary, type Visibility,
} from "./visibility";

const abierta = { startsAt: new Date("2026-11-01T03:00:00Z"), endsAt: new Date("2026-11-30T02:59:59.999Z") };
const durante = new Date("2026-11-10T15:00:00Z");
const despues = new Date("2026-12-05T15:00:00Z");
const obras = Array.from({ length: 20 }, (_, i) => ({ id: `w${i}`, isHighlight: i < 2, sortOrder: i }));
const ids = (ws: { id: string }[]) => ws.map((w) => w.id);

describe("ajuste guardado o de legado", () => {
  it("vacío: como hasta hoy según galleryMode", () => {
    expect(parseVisibility(null, "HIGHLIGHTS_UNTIL_CLOSED").online.exhibited).toBe("HIGHLIGHTS");
    expect(parseVisibility(null, "FULL").online.exhibited).toBe("ALL");
    expect(presetOf(parseVisibility(null, "FULL"))).toBe("OPEN");
    expect(parseVisibility(null, "FULL").room.exhibited).toBe("ARTIST");
  });
  it("roto o con valores desconocidos: completa con lo seguro", () => {
    const v = parseVisibility({ v: 1, online: { exhibited: "TODO", randomCount: 999 }, room: "x" }, "HIGHLIGHTS_UNTIL_CLOSED");
    expect(v.online.exhibited).toBe("HIGHLIGHTS");
    expect(v.online.randomCount).toBe(12);
    expect(v.room.exhibited).toBe("ARTIST");
    expect(v.revealAfterClose).toBe(true);
  });
  it("lo guardado se respeta", () => {
    const g = visibilityFromPreset("SURPRISE", "semilla");
    expect(parseVisibility(JSON.parse(JSON.stringify(g)), "FULL")).toEqual(g);
  });
});

describe("presets", () => {
  it("Adelanto: 3 al azar fijas, artistas y otras obras, QR del artista, se revela al cerrar", () => {
    const v = visibilityFromPreset("PREVIEW", "s");
    expect(v.online).toMatchObject({ exhibited: "RANDOM", randomCount: 3, rotation: "FIXED", artists: true, otherWorks: true });
    expect(v.profile).toEqual({ exhibited: "LIKE_ONLINE", otherWorks: true });
    expect(v.room).toEqual({ exhibited: "ARTIST", otherWorks: true, otherExhibitions: true, buy: true });
    expect(v.revealAfterClose).toBe(true);
  });
  it("tocar una opción lo vuelve personalizado", () => {
    const v = visibilityFromPreset("PREVIEW", "s");
    expect(presetOf(v)).toBe("PREVIEW");
    expect(presetOf({ ...v, online: { ...v.online, randomCount: 5 } })).toBe("CUSTOM");
  });
});

describe("obras expuestas online", () => {
  const con = (p: Partial<Visibility["online"]>, extra: Partial<Visibility> = {}) => {
    const b = visibilityFromPreset("PREVIEW", "semilla-1");
    return { ...b, ...extra, online: { ...b.online, ...p } };
  };
  it("todas, ninguna, destacadas", () => {
    expect(onlineExhibitedWorks(con({ exhibited: "ALL" }), abierta, obras, durante).works).toHaveLength(20);
    expect(onlineExhibitedWorks(con({ exhibited: "NONE" }), abierta, obras, durante)).toMatchObject({ works: [], isPartial: true, hiddenCount: 20 });
    expect(ids(onlineExhibitedWorks(con({ exhibited: "HIGHLIGHTS" }), abierta, obras, durante).works)).toEqual(["w0", "w1"]);
  });
  it("al azar fijo: N obras, siempre las mismas, en el orden de la galería", () => {
    const v = con({ exhibited: "RANDOM", randomCount: 3, rotation: "FIXED" });
    const a = onlineExhibitedWorks(v, abierta, obras, durante);
    const b = onlineExhibitedWorks(v, abierta, [...obras].reverse(), new Date("2026-11-20T15:00:00Z"));
    expect(a.works).toHaveLength(3);
    expect(ids(a.works)).toEqual(ids(b.works));
    expect(a.works.map((w) => w.sortOrder)).toEqual([...a.works.map((w) => w.sortOrder)].sort((x, y) => x - y));
  });
  it("otra semilla, otro sorteo (con 20 obras casi seguro)", () => {
    const a = onlineExhibitedWorks(con({ exhibited: "RANDOM", seed: "uno" }), abierta, obras, durante);
    const b = onlineExhibitedWorks(con({ exhibited: "RANDOM", seed: "dos" }), abierta, obras, durante);
    expect(ids(a.works)).not.toEqual(ids(b.works));
  });
  it("cada día: cambia de un día argentino a otro y no dentro del mismo día", () => {
    const v = con({ exhibited: "RANDOM", rotation: "DAILY" });
    const manana = onlineExhibitedWorks(v, abierta, obras, new Date("2026-11-10T12:00:00Z"));
    const noche = onlineExhibitedWorks(v, abierta, obras, new Date("2026-11-11T02:30:00Z")); // 23:30 del 10 en Argentina
    expect(ids(manana.works)).toEqual(ids(noche.works));
    const dias = new Set(Array.from({ length: 10 }, (_, i) =>
      ids(onlineExhibitedWorks(v, abierta, obras, new Date(Date.UTC(2026, 10, 10 + i, 15))).works).join()));
    expect(dias.size).toBeGreaterThan(1);
  });
  it("menos obras que N: todas, sin 'parcial'", () => {
    expect(onlineExhibitedWorks(con({ exhibited: "RANDOM", randomCount: 5 }), abierta, obras.slice(0, 4), durante)).toMatchObject({ isPartial: false, hiddenCount: 0 });
  });
  it("después del cierre: todo, salvo que se mantenga la reserva", () => {
    expect(onlineExhibitedWorks(con({ exhibited: "NONE" }), abierta, obras, despues).works).toHaveLength(20);
    expect(onlineExhibitedWorks(con({ exhibited: "NONE" }, { revealAfterClose: false }), abierta, obras, despues).works).toHaveLength(0);
  });
});

describe("QR de la sala", () => {
  const ws = [
    { id: "a1", isHighlight: false, sortOrder: 0, authorProfileId: "pA", authorName: "Ana" },
    { id: "a2", isHighlight: false, sortOrder: 1, authorProfileId: "pA", authorName: "Ana" },
    { id: "b1", isHighlight: false, sortOrder: 2, authorProfileId: null, authorName: "Beto" },
    { id: "b2", isHighlight: false, sortOrder: 3, authorProfileId: null, authorName: " beto " },
    { id: "c1", isHighlight: false, sortOrder: 4, authorProfileId: "pC", authorName: "Ceci" },
  ];
  const sala = (exhibited: Visibility["room"]["exhibited"]) => {
    const b = visibilityFromPreset("PREVIEW", "s");
    return { ...b, room: { ...b.room, exhibited } };
  };
  it("la escaneada, las del mismo artista (por perfil o por nombre), toda la muestra", () => {
    expect(ids(roomExhibitedWorks(sala("SCANNED"), ws, ["a1"]))).toEqual(["a1"]);
    expect(ids(roomExhibitedWorks(sala("ARTIST"), ws, ["a1"]))).toEqual(["a1", "a2"]);
    expect(ids(roomExhibitedWorks(sala("ARTIST"), ws, ["b1"]))).toEqual(["b1", "b2"]);
    expect(ids(roomExhibitedWorks(sala("ALL"), ws, ["c1"]))).toHaveLength(5);
  });
  it("un id escaneado que ya no está en la muestra no abre nada", () => {
    expect(roomExhibitedWorks(sala("ALL"), ws, ["zz"])).toEqual([]);
  });
});

describe("textos y portada", () => {
  it("resumen de qué ve cada uno", () => {
    const r = visibilitySummary(visibilityFromPreset("PREVIEW", "s"));
    expect(r.online).toBe("La publicación online muestra 3 obras de la sala elegidas al azar (siempre las mismas), los artistas con su biografía y sus otras obras.");
    expect(r.room).toBe("Quien escanea el QR de una ficha ve esa obra y las demás del mismo artista, sus otras obras, las otras muestras donde expuso y la opción de compra.");
  });
  it("portada que es una obra reservada", () => {
    expect(coverIsHiddenWork("https://r2/x.webp", [{ id: "w1", imageUrl: "https://r2/x.webp" }], new Set())).toBe(true);
    expect(coverIsHiddenWork("https://r2/x.webp", [{ id: "w1", imageUrl: "https://r2/x.webp" }], new Set(["w1"]))).toBe(false);
    expect(coverIsHiddenWork(null, [], new Set())).toBe(false);
  });
});
```

Sumar a `gallery.test.ts`, `work-access.test.ts` y `profile.test.ts` un caso con `visibility: visibilityFromPreset("SURPRISE", "s")` (galería vacía mientras está abierta; `workAccess` → `"TEASER"`; `profileWorksInActivity` → `visible: []`, `hiddenCount` = las del perfil) y uno con `profile.exhibited = "NONE"` y online `ALL` (perfil sin expuestas, galería completa). Los tests existentes siguen pasando sin `visibility` (legado).

Sumar a `team.test.ts`: `exhibitors` y `visibility` para dueño y coorganización, no para textos; `rolesWith("exhibitors")` → `["OWNER", "CO_ORGANIZER"]`. Ajustar el test "coorganización: todo menos…" (las nuevas sí las tiene).

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter @repo/muestras test -- visibility gallery work-access profile team`
Expected: FAIL (`visibility.ts` no existe).

- [ ] **Step 3: Implementar**

`packages/muestras/src/visibility.ts` (esqueleto; los textos exactos son los de los tests):
```ts
import { MAX_HIGHLIGHTS } from "./constants";
import { stableHash } from "./curation";
import { temporalStatus, toArDay } from "./dates";
import { sameName } from "./profile";

/**
 * La sorpresa de la muestra (etapa 6). Qué se ve de las obras **expuestas** según por dónde entra
 * cada persona. Es la única regla que interpreta `CulturalActivity.visibility`: galería, página de
 * obra, perfil, piezas para redes y vista de sala la llaman y nunca deciden por su cuenta.
 */
export const ONLINE_EXHIBITED = ["ALL", "HIGHLIGHTS", "RANDOM", "NONE"] as const;
export const RANDOM_ROTATIONS = ["FIXED", "DAILY"] as const;
export const PROFILE_EXHIBITED = ["LIKE_ONLINE", "NONE"] as const;
export const ROOM_EXHIBITED = ["SCANNED", "ARTIST", "ALL"] as const;
export const VISIBILITY_PRESETS = ["PREVIEW", "SURPRISE", "HIGHLIGHTS", "OPEN", "CUSTOM"] as const;
// …tipos derivados, `is…` y etiquetas:
export const VISIBILITY_PRESET_LABELS = {
  PREVIEW: "Adelanto", SURPRISE: "Sorpresa total", HIGHLIGHTS: "Destacadas", OPEN: "Todo a la vista", CUSTOM: "Personalizado",
} as const;
export const VISIBILITY_PRESET_DESCRIPTIONS = {
  PREVIEW: "Online se ven unas pocas obras de la sala elegidas al azar. Los artistas se presentan con su biografía y sus otras obras.",
  SURPRISE: "Online no se ve ninguna obra de la sala: sólo los artistas y sus otras obras. Todo se descubre en la sala.",
  HIGHLIGHTS: "Online se ven las obras que marques como destacadas, hasta que cierra la muestra.",
  OPEN: "Online se ven todas las obras de la sala.",
  CUSTOM: "Elegís cada opción.",
} as const;

export const RANDOM_COUNT_RANGE = [1, MAX_HIGHLIGHTS] as const;
export const DEFAULT_RANDOM_COUNT = 3;

const SALA = { exhibited: "ARTIST", otherWorks: true, otherExhibitions: true, buy: true } as const;
const PERFIL = { exhibited: "LIKE_ONLINE", otherWorks: true } as const;

export function visibilityFromPreset(preset: Exclude<VisibilityPreset, "CUSTOM">, seed: string): Visibility {
  const exhibited = ({ PREVIEW: "RANDOM", SURPRISE: "NONE", HIGHLIGHTS: "HIGHLIGHTS", OPEN: "ALL" } as const)[preset];
  return {
    v: 1, preset,
    online: { exhibited, randomCount: DEFAULT_RANDOM_COUNT, rotation: "FIXED", seed, artists: true, otherWorks: true },
    profile: { ...PERFIL }, room: { ...SALA }, revealAfterClose: true,
  };
}

/** El preset que coincide con todas las opciones (sin mirar la semilla), o `CUSTOM`. */
export function presetOf(v: Visibility): VisibilityPreset { /* compara contra los 4 presets con la misma semilla */ }

/** Siempre devuelve un ajuste completo. Vacío → legado (spec D16): como hasta la etapa 5. */
export function parseVisibility(json: unknown, galleryMode: string): Visibility {
  const legado = visibilityFromPreset(galleryMode === "FULL" ? "OPEN" : "HIGHLIGHTS", "legado");
  if (!json || typeof json !== "object") return legado;
  // Campo por campo con `is…` y rangos (randomCount se recorta a 1–12; seed: texto 1–64 o "legado").
  // Un bloque que no es objeto se reemplaza por el del legado; `preset` se recalcula con `presetOf`.
}

/** Orden del sorteo: estable para la misma semilla (y el mismo día, si rota). */
function sorteo<W extends { id: string }>(works: readonly W[], seed: string, day: string | null): W[] {
  const clave = (id: string) => stableHash(`muestras-sorpresa:v1:${seed}:${day ?? ""}:${id}`);
  return [...works].sort((a, b) => (clave(a.id) < clave(b.id) ? -1 : clave(a.id) > clave(b.id) ? 1 : 0));
}

export function onlineExhibitedWorks<W extends { id: string; isHighlight: boolean; sortOrder: number }>(
  v: Visibility, a: { startsAt: Date; endsAt: Date }, works: readonly W[], now: Date,
): { works: W[]; isPartial: boolean; hiddenCount: number } {
  const ordered = [...works].sort((x, y) => x.sortOrder - y.sortOrder);
  const todo = { works: ordered, isPartial: false, hiddenCount: 0 };
  if (temporalStatus(a, now) === "CLOSED" && v.revealAfterClose) return todo;
  let shown: W[];
  switch (v.online.exhibited) {
    case "ALL": return todo;
    case "NONE": shown = []; break;
    case "HIGHLIGHTS": {
      const h = ordered.filter((w) => w.isHighlight);
      shown = (h.length > 0 ? h : ordered).slice(0, MAX_HIGHLIGHTS);
      break;
    }
    case "RANDOM": {
      const elegidas = new Set(sorteo(ordered, v.online.seed, v.online.rotation === "DAILY" ? toArDay(now) : null).slice(0, v.online.randomCount).map((w) => w.id));
      shown = ordered.filter((w) => elegidas.has(w.id));
      break;
    }
  }
  return { works: shown, isPartial: shown.length < ordered.length, hiddenCount: ordered.length - shown.length };
}

export function roomExhibitedWorks<W extends { id: string; sortOrder: number; authorProfileId: string | null; authorName: string }>(
  v: Visibility, works: readonly W[], scannedIds: readonly string[],
): W[] {
  const ordered = [...works].sort((x, y) => x.sortOrder - y.sortOrder);
  const escaneadas = ordered.filter((w) => scannedIds.includes(w.id));
  if (escaneadas.length === 0) return [];
  if (v.room.exhibited === "ALL") return ordered;
  if (v.room.exhibited === "SCANNED") return escaneadas;
  const mismoArtista = (w: W) => escaneadas.some((e) =>
    (e.authorProfileId && e.authorProfileId === w.authorProfileId) || (!e.authorProfileId && !w.authorProfileId && sameName(e.authorName, w.authorName)));
  return ordered.filter(mismoArtista);
}

export function coverIsHiddenWork(cover: string | null, works: readonly { id: string; imageUrl: string }[], shownIds: ReadonlySet<string>): boolean {
  return !!cover && works.some((w) => w.imageUrl === cover && !shownIds.has(w.id));
}
```
`visibilitySummary` arma las cuatro frases a partir de las opciones (online: "todas las obras de la sala" / "las destacadas" / "N obras de la sala elegidas al azar (siempre las mismas | cambian cada día)" / "ninguna obra de la sala"; más ", los artistas con su biografía" y " y sus otras obras" según corresponda; perfil; sala; "Cuando cierra, se ve todo." o "Cuando cierra, la reserva sigue.").

`gallery.ts`:
```ts
import { onlineExhibitedWorks, parseVisibility } from "./visibility";

/**
 * Qué obras expuestas ve el público online. Desde la etapa 6 lo decide el ajuste de sorpresa de
 * la muestra (`visibility`); sin ajuste, como siempre: las destacadas hasta el cierre, o todas.
 */
export function visibleWorks<W extends { id: string; isHighlight: boolean; sortOrder: number }>(
  a: { galleryMode: string; visibility?: unknown; startsAt: Date; endsAt: Date }, works: W[], now: Date,
) {
  return onlineExhibitedWorks(parseVisibility(a.visibility ?? null, a.galleryMode), a, works, now);
}
```
(Ojo con el ciclo de imports `visibility.ts` → `profile.ts` → `gallery.ts` → `visibility.ts`: si aparece, mover `sameName`/`normalizeName` a un archivo `names.ts` reexportado por `profile.ts`.)

`profile.ts`, `profileWorksInActivity`: si `parseVisibility(a.visibility, a.galleryMode).profile.exhibited === "NONE"`, `visible = []`; si no, como hoy con `visibleWorks`. `work-access.ts`: sólo el tipo `Gallery` suma `visibility?: unknown`.

`team.ts`: `CAPABILITIES` suma `"exhibitors", "visibility"` (al final); `CO_ORGANIZER` las suma; la descripción de la coorganización suma "junta las obras de los expositores y decide qué se ve online".

`index.ts`: `export * from "./visibility";`.

- [ ] **Step 4: Correr**

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter @repo/muestras lint`
Expected: todo en verde.

- [ ] **Step 5: Commit**

```bash
git add packages/muestras
git commit -m "Muestras: regla única de visibilidad por punto de entrada (online, perfil, sala) con presets y sorteo fijo o diario"
```

**Acceptance:** sin `visibility`, `visibleWorks` devuelve lo mismo que antes para todos los tests existentes; con "Sorpresa total", galería, página de obra y perfil coinciden en no mostrar ninguna expuesta mientras la muestra está abierta.

---

### Task 2: Reglas de expositores — enlace, alta, datos de la obra, estados y copia a la muestra

**Files:**
- Create: `packages/muestras/src/exhibitors.ts`, `packages/muestras/src/exhibitors.test.ts`
- Modify: `packages/muestras/src/panel.ts` (+ `panel.test.ts`), `packages/muestras/src/index.ts`

**Interfaces:**
- Consumes: `temporalStatus`, `dayEndAr` (`dates.ts`), `MAX_WORKS`, `formatCm` y `HANGING_LIMITS.frame` (5–300 cm, `hanging.ts`).
- Produces:
  - Constantes: `EXHIBITOR_LIMITS = { worksPerExhibitor: [1, 20], photosPerWork: [0, 10], exhibitors: [1, 100] }`, `EXHIBITOR_DEFAULTS = { worksPerExhibitor: 3, photosPerWork: 3, exhibitors: 30 }`, `EXHIBITOR_TEXT_LIMITS = { displayName: 120, title: 160, technique: 160, statement: 800, hangingNotes: 300, caption: 300, instructions: 1500, reviewNote: 600 }`, `SIZE_RANGE_CM = [5, 300]`, `EDITION_SIZE_MAX = 999`, `PRICE_MAX_ARS = 100_000_000`.
  - `EDITIONS = ["UNIQUE","LIMITED","OPEN","NA"]`, `EDITION_LABELS`; `EXHIBITOR_WORK_STATUSES = ["DRAFT","SUBMITTED","CHANGES_REQUESTED","APPROVED","REMOVED"]`, `EXHIBITOR_WORK_STATUS_LABELS` (para quien expone) y `EXHIBITOR_WORK_STATUS_LABELS_ORGANIZER`.
  - `exhibitorLinkState(link, activity, now): "OPEN" | "CLOSED" | "EXPIRED" | "UNAVAILABLE"`.
  - `exhibitorJoinProblems(p): string[]` (enlace abierto, cupo de expositores, nombre, derechos, ya sumado).
  - `type ExhibitorWorkInput`; `exhibitorWorkProblems(w, { forSubmit }): string[]` (D5); `exhibitorPhotoProblems(p): string[]`; `exhibitorCountProblems({ works, photosPerWork, limits })`.
  - `exhibitorWorkTransition(action, status, ctx): { ok: true; next } | { ok: false; reason }` con acciones `submit`, `withdraw`, `approve`, `requestChanges`, `remove`, `edit`.
  - `editionText(w)`, `sizeText(w)` ("40 × 60 cm"), `frameText(w)`, `priceText(n)` ("$ 120.000"), `fichaDetail(w)` ("2024. Giclée sobre papel algodón. 40 × 60 cm. Edición 2/10").
  - `toActivityWork(ew, exhibitor, sortOrder)` → los campos de `CulturalActivityWork` (D8).
  - `pendingReviewCount(rows)`.
  - `panel.ts`: `PanelSectionKey` suma `"expositor"`; sección `s("expositor", "Donde expongo", "/panel/expositor", "CUENTA")` después de "Mis envíos".

- [ ] **Step 1: Escribir los tests que fallan**

`packages/muestras/src/exhibitors.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  editionText, exhibitorJoinProblems, exhibitorLinkState, exhibitorPhotoProblems, exhibitorWorkProblems,
  exhibitorWorkTransition, fichaDetail, priceText, sizeText, toActivityWork,
} from "./exhibitors";

const muestra = { type: "MUESTRA", reviewStatus: "DRAFT", isCancelled: false,
  startsAt: new Date("2026-11-01T03:00:00Z"), endsAt: new Date("2026-11-30T02:59:59.999Z") };
const enlace = { status: "OPEN", closesAt: null as Date | null };
const hoy = new Date("2026-10-20T15:00:00Z");

describe("estado del enlace", () => {
  it("abierto en borrador, revisión, publicada y despublicada", () => {
    for (const reviewStatus of ["DRAFT", "REJECTED", "IN_REVIEW", "APPROVED", "UNPUBLISHED"]) {
      expect(exhibitorLinkState(enlace, { ...muestra, reviewStatus }, hoy), reviewStatus).toBe("OPEN");
    }
  });
  it("cerrado a mano, vencido, cancelada, terminada o no es muestra", () => {
    expect(exhibitorLinkState({ ...enlace, status: "CLOSED" }, muestra, hoy)).toBe("CLOSED");
    expect(exhibitorLinkState({ ...enlace, closesAt: new Date("2026-10-19T02:59:59.999Z") }, muestra, hoy)).toBe("EXPIRED");
    expect(exhibitorLinkState(enlace, { ...muestra, isCancelled: true }, hoy)).toBe("UNAVAILABLE");
    expect(exhibitorLinkState(enlace, muestra, new Date("2026-12-01T15:00:00Z"))).toBe("UNAVAILABLE");
    expect(exhibitorLinkState(enlace, { ...muestra, type: "CHARLA" }, hoy)).toBe("UNAVAILABLE");
    expect(exhibitorLinkState(null, muestra, hoy)).toBe("UNAVAILABLE");
  });
});

describe("sumarse", () => {
  const base = { state: "OPEN" as const, exhibitors: 3, maxExhibitors: 30, displayName: "Ana Pérez", rightsAccepted: true, already: false };
  it("todo bien", () => expect(exhibitorJoinProblems(base)).toEqual([]));
  it("motivos", () => {
    expect(exhibitorJoinProblems({ ...base, state: "CLOSED" })).toEqual(["Este enlace ya no recibe expositores. Escribile a quien organiza."]);
    expect(exhibitorJoinProblems({ ...base, exhibitors: 30 })).toEqual(["Ya se sumaron todas las personas que esta muestra espera. Escribile a quien organiza."]);
    expect(exhibitorJoinProblems({ ...base, displayName: " " })).toEqual(["Escribí cómo firmás tus obras."]);
    expect(exhibitorJoinProblems({ ...base, rightsAccepted: false })).toEqual(["Para sumarte tenés que confirmar que sos autor/a y aceptar cómo se muestran tus obras."]);
    expect(exhibitorJoinProblems({ ...base, already: true })).toEqual([]); // vuelve a su página, no es error
  });
});

describe("datos de la obra expuesta", () => {
  const ok = {
    imageUrl: "https://r2/muestras/7/a.webp", title: "Río quieto", year: 2024, technique: "Giclée sobre papel algodón",
    imageWidthCm: 40, imageHeightCm: 60, frameWidthCm: 50, frameHeightCm: 70,
    edition: "LIMITED", editionNumber: 2, editionSize: 10, statement: null, forSale: true, priceArs: 120000, hangingNotes: null,
  };
  it("completa para enviar", () => expect(exhibitorWorkProblems(ok, { forSubmit: true })).toEqual([]));
  it("un borrador se guarda incompleto, pero no se envía", () => {
    const vacia = { ...ok, imageUrl: null, title: "", year: null, technique: null, imageWidthCm: null, imageHeightCm: null, frameWidthCm: null, frameHeightCm: null, edition: null, forSale: false, priceArs: null };
    expect(exhibitorWorkProblems(vacia, { forSubmit: false })).toEqual([]);
    expect(exhibitorWorkProblems(vacia, { forSubmit: true })).toEqual([
      "Subí la foto de la obra.", "Escribí el título.", "Indicá el año.", "Indicá la técnica y el soporte.",
      "Indicá la medida de la imagen (ancho y alto en cm).", "Indicá la medida con marco (ancho y alto en cm).", "Indicá la edición.",
    ]);
  });
  it("medidas, marco, edición y precio", () => {
    expect(exhibitorWorkProblems({ ...ok, imageWidthCm: 400 }, { forSubmit: true })).toEqual(["Las medidas van entre 5 y 300 cm por lado."]);
    expect(exhibitorWorkProblems({ ...ok, frameWidthCm: 30 }, { forSubmit: true })).toEqual(["La medida con marco no puede ser menor que la de la imagen."]);
    expect(exhibitorWorkProblems({ ...ok, editionNumber: 11 }, { forSubmit: true })).toEqual(["En una edición limitada, el número de la copia va de 1 al total."]);
    expect(exhibitorWorkProblems({ ...ok, priceArs: null }, { forSubmit: true })).toEqual(["Si la querés vender, indicá el precio en pesos."]);
    expect(exhibitorWorkProblems({ ...ok, year: 1800 }, { forSubmit: false })).toEqual(["Revisá el año."]);
  });
  it("foto adicional: el título es obligatorio", () => {
    expect(exhibitorPhotoProblems({ imageUrl: "https://r2/x.webp", title: "", caption: null })).toEqual(["Cada foto adicional necesita un título."]);
  });
});

describe("estados", () => {
  it("el recorrido normal", () => {
    expect(exhibitorWorkTransition("submit", "DRAFT", { linkOpen: true, complete: true })).toEqual({ ok: true, next: "SUBMITTED" });
    expect(exhibitorWorkTransition("withdraw", "SUBMITTED", {})).toEqual({ ok: true, next: "DRAFT" });
    expect(exhibitorWorkTransition("requestChanges", "SUBMITTED", {})).toEqual({ ok: true, next: "CHANGES_REQUESTED" });
    expect(exhibitorWorkTransition("submit", "CHANGES_REQUESTED", { linkOpen: false, complete: true })).toEqual({ ok: true, next: "SUBMITTED" });
    expect(exhibitorWorkTransition("approve", "SUBMITTED", {})).toEqual({ ok: true, next: "APPROVED" });
    expect(exhibitorWorkTransition("requestChanges", "APPROVED", {})).toEqual({ ok: true, next: "CHANGES_REQUESTED" });
    expect(exhibitorWorkTransition("remove", "APPROVED", {})).toEqual({ ok: true, next: "REMOVED" });
  });
  it("lo que no se puede", () => {
    expect(exhibitorWorkTransition("submit", "DRAFT", { linkOpen: false, complete: true })).toMatchObject({ ok: false, reason: "El enlace de expositores está cerrado: ya no se reciben obras nuevas." });
    expect(exhibitorWorkTransition("submit", "DRAFT", { linkOpen: true, complete: false })).toMatchObject({ ok: false });
    expect(exhibitorWorkTransition("edit", "APPROVED", {})).toMatchObject({ ok: false, reason: "La obra ya está en la muestra. Si hay que cambiar algo, pedíselo a quien organiza." });
    expect(exhibitorWorkTransition("edit", "SUBMITTED", {})).toMatchObject({ ok: false });
    expect(exhibitorWorkTransition("approve", "DRAFT", {})).toMatchObject({ ok: false });
  });
});

describe("textos y copia a la muestra", () => {
  const w = { title: "Río quieto", year: 2024, technique: "Giclée", imageWidthCm: 40, imageHeightCm: 60.5, edition: "LIMITED", editionNumber: 2, editionSize: 10, imageUrl: "u" };
  it("edición, medidas, precio y ficha", () => {
    expect(editionText(w)).toBe("Edición 2/10");
    expect(editionText({ ...w, edition: "UNIQUE" })).toBe("Pieza única");
    expect(editionText({ ...w, edition: "NA" })).toBeNull();
    expect(sizeText(w)).toBe("40 × 60,5 cm");
    expect(priceText(120000)).toBe("$ 120.000");
    expect(fichaDetail(w)).toBe("2024. Giclée. 40 × 60,5 cm. Edición 2/10");
  });
  it("lo que se copia a CulturalActivityWork", () => {
    expect(toActivityWork(w, { userId: 7, profileId: "p7", displayName: "Ana Pérez" }, 12)).toEqual({
      imageUrl: "u", title: "Río quieto", authorName: "Ana Pérez", authorUserId: 7, authorProfileId: "p7",
      year: 2024, technique: "Giclée", isHighlight: false, sortOrder: 12,
    });
  });
});
```
Sumar a `panel.test.ts`: la sección "Donde expongo" existe, está lista y va en "Tu cuenta".

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter @repo/muestras test -- exhibitors panel`
Expected: FAIL.

- [ ] **Step 3: Implementar `exhibitors.ts`**

Reglas a respetar (además de los tests):
- `exhibitorLinkState`: `UNAVAILABLE` si no hay enlace, no es `MUESTRA`, está cancelada o `temporalStatus(a, now) === "CLOSED"`; `CLOSED` si `status !== "OPEN"`; `EXPIRED` si `closesAt && now > closesAt`; si no, `OPEN`.
- `exhibitorWorkProblems`: con `forSubmit: false` sólo valida lo que **está** cargado (rangos, largos, edición coherente, precio entero positivo ≤ `PRICE_MAX_ARS`); con `forSubmit: true` además exige lo obligatorio de D5, en el orden de los tests. Medidas: número finito, redondeado a un decimal antes de comparar. Edición `LIMITED` exige número y total (1 ≤ n ≤ total ≤ 999); en otras ediciones se ignoran número y total (el mapeo los guarda en `null`).
- `exhibitorWorkTransition` (`ctx = { linkOpen?, complete?, activityEditable? }`): `submit` desde `DRAFT` (pide `linkOpen` y `complete`) o `CHANGES_REQUESTED` (pide `complete`); `withdraw` sólo desde `SUBMITTED`; `edit` sólo en `DRAFT` o `CHANGES_REQUESTED`; `approve` desde `SUBMITTED` (y `activityEditable !== false`, motivo "La muestra está en revisión: esperá a que se revise para sumar obras."); `requestChanges` desde `SUBMITTED` o `APPROVED`; `remove` desde `SUBMITTED`, `CHANGES_REQUESTED` o `APPROVED`.
- `toActivityWork(ew, ex, sortOrder)`: exactamente los campos del test (`isHighlight: false`). `authorName` = `ex.displayName.trim()`.
- `priceText`: separador de miles con punto, sin decimales (`Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 })` con "$ " adelante).

- [ ] **Step 4: Correr**

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter @repo/muestras lint`
Expected: todo en verde.

- [ ] **Step 5: Commit**

```bash
git add packages/muestras
git commit -m "Muestras: reglas de expositores — enlace, alta, datos de la obra para ficha y montaje, estados y copia a la muestra"
```

**Acceptance:** el texto de cada problema es el que ve la persona (voseo, sin jerga); `toActivityWork` no copia nada que `CulturalActivityWork` no tenga.

---

### Task 3: Reglas del pase de sala, QR `s`, entrada de compra y "Obra destacada"

**Files:**
- Create: `packages/muestras/src/room.ts`, `packages/muestras/src/room.test.ts`
- Modify: `packages/muestras/src/stats.ts` (+ `stats.test.ts`), `packages/muestras/src/social.ts` (+ `social.test.ts`), `packages/muestras/src/index.ts`

**Interfaces:**
- Produces (`room.ts`):
  - `ROOM_CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"` (31 símbolos, sin 0/1/i/l/o), `ROOM_CODE_LENGTH = 12`, `isRoomCode(s)`, `roomCodeFrom(bytes: Uint8Array)` (la app le pasa `randomBytes(12)`; cada byte módulo 31 — el sesgo es despreciable para 60 bits, se documenta).
  - `ROOM_PASS_HOURS = 8`, `ROOM_PASS_MAX_WORKS = 40`, `ROOM_PASS_COOKIE_PREFIX = "mf_sala_"`, `roomPassCookieName(activityId)`.
  - `type RoomPass = { v: 1; a: string; exp: number; w: string[] }`; `encodeRoomPass(p): string` (base64url de JSON), `decodeRoomPass(s): RoomPass | null` (forma estricta), `mergeRoomPass(prev, { activityId, workId, now }): RoomPass` (agrega el id sin repetir, deja los últimos 40, renueva `exp`), `roomPassValid(p, activityId, now): boolean`.
  - `BUY_ENTRY_STATES = ["NONE","ASK"]`; `buyEntry({ roomBuy, forSale, priceArs }): { state: "NONE" } | { state: "ASK"; priceText: string }`.
  - `stats.ts`: `QR_KINDS = ["o","m","l","s"]`; `metricForQrKind("s") = "SCAN"`.
  - `social.ts`: `availableSocialVariants(a, now)` recibe además `onlineWorkCount` (las visibles online según la Task 1); `WORK` sólo si `> 0`.

- [ ] **Step 1: Escribir los tests que fallan**

`packages/muestras/src/room.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buyEntry, decodeRoomPass, encodeRoomPass, isRoomCode, mergeRoomPass, roomCodeFrom, roomPassCookieName, roomPassValid, ROOM_PASS_HOURS } from "./room";

const ahora = new Date("2026-11-10T20:00:00Z");

describe("código de sala", () => {
  it("12 símbolos del alfabeto, sin ambiguos", () => {
    const c = roomCodeFrom(new Uint8Array([0, 1, 2, 30, 31, 62, 100, 200, 255, 7, 8, 9]));
    expect(c).toHaveLength(12);
    expect(isRoomCode(c)).toBe(true);
    expect(isRoomCode("abc")).toBe(false);
    expect(isRoomCode("0123456789ab")).toBe(false);
    expect(isRoomCode("clx9a8b7c6d5e4f3g2h1i0j9")).toBe(false); // un id de obra no es un código
  });
});

describe("pase de sala", () => {
  it("se arma, se lee y vence a las 8 horas", () => {
    const p = mergeRoomPass(null, { activityId: "a1", workId: "w1", now: ahora });
    expect(p).toEqual({ v: 1, a: "a1", exp: ahora.getTime() + ROOM_PASS_HOURS * 3600_000, w: ["w1"] });
    expect(decodeRoomPass(encodeRoomPass(p))).toEqual(p);
    expect(roomPassValid(p, "a1", ahora)).toBe(true);
    expect(roomPassValid(p, "a2", ahora)).toBe(false);
    expect(roomPassValid(p, "a1", new Date(p.exp + 1))).toBe(false);
  });
  it("cada escaneo suma la obra y renueva; uno de otra muestra empieza de cero", () => {
    const p1 = mergeRoomPass(null, { activityId: "a1", workId: "w1", now: ahora });
    const luego = new Date(ahora.getTime() + 3600_000);
    const p2 = mergeRoomPass(p1, { activityId: "a1", workId: "w2", now: luego });
    expect(p2.w).toEqual(["w1", "w2"]);
    expect(p2.exp).toBe(luego.getTime() + ROOM_PASS_HOURS * 3600_000);
    expect(mergeRoomPass(p2, { activityId: "a1", workId: "w1", now: luego }).w).toEqual(["w2", "w1"]);
    expect(mergeRoomPass(p2, { activityId: "b9", workId: "x", now: luego }).w).toEqual(["x"]);
  });
  it("tope de 40 obras: quedan las últimas", () => {
    let p = null;
    for (let i = 0; i < 45; i++) p = mergeRoomPass(p, { activityId: "a1", workId: `w${i}`, now: ahora });
    expect(p!.w).toHaveLength(40);
    expect(p!.w[0]).toBe("w5");
  });
  it("basura no se lee", () => {
    for (const s of ["", "x", encodeRoomPass({ v: 2 } as never), Buffer.from('{"v":1,"a":"a","exp":"1","w":[]}').toString("base64url")]) {
      expect(decodeRoomPass(s), s).toBeNull();
    }
  });
  it("nombre de la cookie", () => expect(roomPassCookieName("ck1")).toBe("mf_sala_ck1"));
});

describe("entrada de compra", () => {
  it("sólo con la opción de sala y la obra a la venta con precio", () => {
    expect(buyEntry({ roomBuy: true, forSale: true, priceArs: 120000 })).toEqual({ state: "ASK", priceText: "$ 120.000" });
    expect(buyEntry({ roomBuy: false, forSale: true, priceArs: 120000 })).toEqual({ state: "NONE" });
    expect(buyEntry({ roomBuy: true, forSale: false, priceArs: null })).toEqual({ state: "NONE" });
  });
});
```
Sumar a `stats.test.ts`: `isQrKind("s")`, `metricForQrKind("s") === "SCAN"`, `scanPath("s", "abc")`. Sumar a `social.test.ts`: con `onlineWorkCount: 0` no hay `WORK` aunque la muestra tenga obras.

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter @repo/muestras test -- room stats social`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`room.ts` con lo de "Interfaces" (`priceText` se importa de `exhibitors.ts`). `encodeRoomPass`/`decodeRoomPass` usan `btoa`/`atob` con reemplazo base64url (no `Buffer`: las reglas del paquete no dependen de Node; Node 24 tiene `atob`/`btoa`), con `try/catch` alrededor de `JSON.parse`. Validar `v === 1`, `a` con `^[A-Za-z0-9_-]{1,64}$`, `exp` entero, `w` arreglo de ≤ 40 ids con la misma forma. `stats.ts` y `social.ts` como dicen las interfaces (el llamado en `lib/redes` se actualiza en la Task 13; mientras tanto la app pasa `onlineWorkCount: works.length` para compilar).

- [ ] **Step 4: Correr**

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter @repo/muestras lint && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types`
Expected: todo en verde.

- [ ] **Step 5: Commit**

```bash
git add packages/muestras apps/muestras
git commit -m "Muestras: reglas del pase de sala (código, cookie sin firma, vigencia de 8 horas), QR de sala y entrada de compra"
```

**Acceptance:** un id de obra nunca pasa `isRoomCode`; el pase no guarda nada que identifique a la persona.

---

### Task 4: Columna de visibilidad y tablas de expositores y sala (migración escrita a mano, sin aplicar)

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20261031120000_muestras_etapa_6_expositores/migration.sql`

**Interfaces:**
- Produces: `CulturalActivity.visibility` (`Json?`), `.exhibitorLink`, `.exhibitors`, `.exhibitorWorks`, `.roomCodes`, `.roomKey`; `PhotographerProfile.exhibitors`; `prisma.culturalExhibitorLink` (únicos `activityId`, `token`), `prisma.culturalExhibitor` (único `activityId_userId`), `prisma.culturalExhibitorWork`, `prisma.culturalExhibitorPhoto`, `prisma.culturalActivityRoomCode` (PK `code`, único `activityId_workId`), `prisma.culturalActivityRoomKey` (PK `activityId`).

- [ ] **Step 1: Confirmar el nombre de la migración**

Run: `git fetch origin && git ls-tree --name-only origin/main packages/db/prisma/migrations/ | tail -4 && ls packages/db/prisma/migrations | tail -3`
Expected: la última de esta rama es `20261030120000_muestras_etapa_5_difusion`; en `origin/main` no hay nada posterior a `20261030…`. Si apareció una más nueva, usar un timestamp posterior y reemplazar el nombre en todo este plan.

- [ ] **Step 2: Cambiar el schema (sin `prisma format`: reformatea todo el archivo)**

En `model CulturalActivity`, debajo de `lastEditedPart String?`:
```prisma

  /// Sorpresa de la muestra (etapa 6): qué se ve de las obras expuestas según por dónde entra cada
  /// persona. Vacío = como hasta la etapa 5 (según `galleryMode`). Se lee sólo con `parseVisibility`.
  visibility Json?
```
y debajo de `rsvps CulturalActivityRsvp[]`:
```prisma

  /// Enlace de expositores (etapa 6). A lo sumo uno.
  exhibitorLink  CulturalExhibitorLink?
  exhibitors     CulturalExhibitor[]
  exhibitorWorks CulturalExhibitorWork[]
  /// Códigos impresos en las fichas que dan el pase de sala, y la llave que firma los pases.
  roomCodes      CulturalActivityRoomCode[]
  roomKey        CulturalActivityRoomKey?
```
En `model PhotographerProfile`, debajo de `works CulturalActivityWork[]`:
```prisma
  /// Participaciones como expositor (Muestras, etapa 6).
  exhibitors CulturalExhibitor[]
```
Al final del archivo:
```prisma
/// Enlace único por el que los expositores de una muestra se suman y cargan sus obras (Muestras,
/// etapa 6). El token se guarda tal cual: es un enlace para copiar muchas veces y no da permisos
/// sobre la muestra (cada obra se aprueba).
model CulturalExhibitorLink {
  id         String           @id @default(cuid())
  activityId String           @unique
  activity   CulturalActivity @relation(fields: [activityId], references: [id], onDelete: Cascade)

  token                String    @unique
  /// OPEN | CLOSED
  status               String    @default("OPEN")
  /// Fin del día argentino de la fecha límite. Vacío = sin fecha límite.
  closesAt             DateTime?
  maxWorksPerExhibitor Int       @default(3)
  maxPhotosPerWork     Int       @default(3)
  maxExhibitors        Int       @default(30)
  instructions         String?
  createdByUserId      Int
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  rotatedAt            DateTime?
}

/// Una persona que expone en una muestra (etapa 6). Sin relación a `User` a propósito.
model CulturalExhibitor {
  id         String               @id @default(cuid())
  activityId String
  activity   CulturalActivity     @relation(fields: [activityId], references: [id], onDelete: Cascade)
  userId     Int
  profileId  String?
  profile    PhotographerProfile? @relation(fields: [profileId], references: [id], onDelete: SetNull)

  /// Cómo firma sus obras.
  displayName      String
  /// ACTIVE | REMOVED
  status           String    @default("ACTIVE")
  rightsAcceptedAt DateTime
  joinedAt         DateTime  @default(now())
  removedAt        DateTime?
  removedByUserId  Int?

  works CulturalExhibitorWork[]

  @@unique([activityId, userId])
  @@index([userId, status])
  @@index([profileId])
}

/// Una obra que se cuelga: la foto principal y los datos para ficha, catálogo y plano. Lo aprobado
/// se copia a `CulturalActivityWork`; `activityWorkId` sin FK, porque el editor de la muestra
/// reescribe sus obras (mismo criterio que `CulturalCallWork`).
model CulturalExhibitorWork {
  id          String            @id @default(cuid())
  exhibitorId String
  exhibitor   CulturalExhibitor @relation(fields: [exhibitorId], references: [id], onDelete: Cascade)
  activityId  String
  activity    CulturalActivity  @relation(fields: [activityId], references: [id], onDelete: Cascade)

  /// DRAFT | SUBMITTED | CHANGES_REQUESTED | APPROVED | REMOVED
  status        String  @default("DRAFT")
  imageUrl      String?
  title         String  @default("")
  year          Int?
  technique     String?
  imageWidthCm  Float?
  imageHeightCm Float?
  frameWidthCm  Float?
  frameHeightCm Float?
  /// UNIQUE | LIMITED | OPEN | NA
  edition       String?
  editionNumber Int?
  editionSize   Int?
  statement     String?
  forSale       Boolean @default(false)
  /// Pesos argentinos, sin centavos. Se muestra sólo en la vista de sala (etapa 6).
  priceArs      Int?
  /// Sólo para la organización.
  hangingNotes  String?
  sortOrder     Int     @default(0)

  reviewNote       String?
  activityWorkId   String?
  submittedAt      DateTime?
  reviewedAt       DateTime?
  reviewedByUserId Int?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  photos CulturalExhibitorPhoto[]

  @@index([exhibitorId, sortOrder])
  @@index([activityId, status])
  @@index([activityWorkId])
}

/// Foto adicional de una obra (otras de la serie, del proceso). Nunca se cuelga en la sala.
model CulturalExhibitorPhoto {
  id     String                @id @default(cuid())
  workId String
  work   CulturalExhibitorWork @relation(fields: [workId], references: [id], onDelete: Cascade)

  imageUrl  String
  title     String
  year      Int?
  technique String?
  caption   String?
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())

  @@index([workId, sortOrder])
}

/// Código impreso en el QR de la ficha de una obra (`/q/s/<code>`): lo único que da pase de sala.
/// `workId` sin FK (el editor reescribe las obras conservando el id).
model CulturalActivityRoomCode {
  code       String           @id
  activityId String
  activity   CulturalActivity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  workId     String
  createdAt  DateTime         @default(now())

  @@unique([activityId, workId])
}

/// Llave con la que se firman los pases de sala de una muestra. Rotarla corta todos los pases.
/// Nunca se incluye en una consulta pública.
model CulturalActivityRoomKey {
  activityId String           @id
  activity   CulturalActivity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  secret     String
  createdAt  DateTime         @default(now())
  rotatedAt  DateTime?
}
```

- [ ] **Step 3: Escribir la migración**

`packages/db/prisma/migrations/20261031120000_muestras_etapa_6_expositores/migration.sql`:
```sql
-- Muestras Fotográficas · Etapa 6: expositores por enlace y sorpresa de la muestra.
-- Aditiva: suma una columna optativa a CulturalActivity (Postgres no reescribe la tabla) y crea
-- seis tablas nuevas. No toca filas existentes.
-- NO SE APLICA SOLA: la aplica a mano el controlador (autorizado por Daniel) en la base de
-- FOTOFFICE/FotoRank (Neon `divine-hall-10689679`, rama `development`), DESPUÉS de las etapas 4
-- (20261029120000_muestras_etapa_4_sala) y 5 (20261030120000_muestras_etapa_5_difusion), y la
-- registra en `_prisma_migrations` con el SHA-256 de este archivo. Va ANTES de publicar el código:
-- sin la columna nueva, toda consulta de CulturalActivity falla y se cae todo el sitio de Muestras.

-- AlterTable
ALTER TABLE "CulturalActivity" ADD COLUMN     "visibility" JSONB;

-- CreateTable
CREATE TABLE "CulturalExhibitorLink" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closesAt" TIMESTAMP(3),
    "maxWorksPerExhibitor" INTEGER NOT NULL DEFAULT 3,
    "maxPhotosPerWork" INTEGER NOT NULL DEFAULT 3,
    "maxExhibitors" INTEGER NOT NULL DEFAULT 30,
    "instructions" TEXT,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rotatedAt" TIMESTAMP(3),

    CONSTRAINT "CulturalExhibitorLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalExhibitor" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "profileId" TEXT,
    "displayName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "rightsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "removedByUserId" INTEGER,

    CONSTRAINT "CulturalExhibitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalExhibitorWork" (
    "id" TEXT NOT NULL,
    "exhibitorId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "imageUrl" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "year" INTEGER,
    "technique" TEXT,
    "imageWidthCm" DOUBLE PRECISION,
    "imageHeightCm" DOUBLE PRECISION,
    "frameWidthCm" DOUBLE PRECISION,
    "frameHeightCm" DOUBLE PRECISION,
    "edition" TEXT,
    "editionNumber" INTEGER,
    "editionSize" INTEGER,
    "statement" TEXT,
    "forSale" BOOLEAN NOT NULL DEFAULT false,
    "priceArs" INTEGER,
    "hangingNotes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "reviewNote" TEXT,
    "activityWorkId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalExhibitorWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalExhibitorPhoto" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "technique" TEXT,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CulturalExhibitorPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalActivityRoomCode" (
    "code" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CulturalActivityRoomCode_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "CulturalActivityRoomKey" (
    "activityId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),

    CONSTRAINT "CulturalActivityRoomKey_pkey" PRIMARY KEY ("activityId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CulturalExhibitorLink_activityId_key" ON "CulturalExhibitorLink"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalExhibitorLink_token_key" ON "CulturalExhibitorLink"("token");

-- CreateIndex
CREATE INDEX "CulturalExhibitor_userId_status_idx" ON "CulturalExhibitor"("userId", "status");

-- CreateIndex
CREATE INDEX "CulturalExhibitor_profileId_idx" ON "CulturalExhibitor"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalExhibitor_activityId_userId_key" ON "CulturalExhibitor"("activityId", "userId");

-- CreateIndex
CREATE INDEX "CulturalExhibitorWork_exhibitorId_sortOrder_idx" ON "CulturalExhibitorWork"("exhibitorId", "sortOrder");

-- CreateIndex
CREATE INDEX "CulturalExhibitorWork_activityId_status_idx" ON "CulturalExhibitorWork"("activityId", "status");

-- CreateIndex
CREATE INDEX "CulturalExhibitorWork_activityWorkId_idx" ON "CulturalExhibitorWork"("activityWorkId");

-- CreateIndex
CREATE INDEX "CulturalExhibitorPhoto_workId_sortOrder_idx" ON "CulturalExhibitorPhoto"("workId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalActivityRoomCode_activityId_workId_key" ON "CulturalActivityRoomCode"("activityId", "workId");

-- AddForeignKey
ALTER TABLE "CulturalExhibitorLink" ADD CONSTRAINT "CulturalExhibitorLink_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalExhibitor" ADD CONSTRAINT "CulturalExhibitor_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalExhibitor" ADD CONSTRAINT "CulturalExhibitor_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PhotographerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalExhibitorWork" ADD CONSTRAINT "CulturalExhibitorWork_exhibitorId_fkey" FOREIGN KEY ("exhibitorId") REFERENCES "CulturalExhibitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalExhibitorWork" ADD CONSTRAINT "CulturalExhibitorWork_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalExhibitorPhoto" ADD CONSTRAINT "CulturalExhibitorPhoto_workId_fkey" FOREIGN KEY ("workId") REFERENCES "CulturalExhibitorWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalActivityRoomCode" ADD CONSTRAINT "CulturalActivityRoomCode_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalActivityRoomKey" ADD CONSTRAINT "CulturalActivityRoomKey_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Comparar con lo que generaría Prisma y regenerar el cliente**

Run: `cd packages/db && git show HEAD:packages/db/prisma/schema.prisma > /tmp/schema-antes.prisma && pnpm prisma migrate diff --from-schema-datamodel /tmp/schema-antes.prisma --to-schema-datamodel prisma/schema.prisma --script > /tmp/etapa6.sql && diff <(grep -v '^--' /tmp/etapa6.sql | sed '/^$/d') <(grep -v '^--' prisma/migrations/20261031120000_muestras_etapa_6_expositores/migration.sql | sed '/^$/d') && pnpm prisma validate && pnpm prisma generate`
Expected: `diff` sin diferencias (salvo el orden de sentencias equivalentes: si sólo cambia el orden, adoptar el de Prisma); `validate` y `generate` sin errores. **No** correr `migrate dev` ni tocar ninguna base.

- [ ] **Step 5: Typecheck de las apps que comparten el schema**

Run: `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice typecheck`
Expected: en verde (nadie más usa estos modelos).

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20261031120000_muestras_etapa_6_expositores
git commit -m "Muestras: columna de visibilidad y tablas de expositores, fotos adicionales y pase de sala (migración a mano, sin aplicar)"
```

**Acceptance:** la migración sólo agrega (ningún `DROP`, `ALTER COLUMN` ni `UPDATE`); la SQL coincide con `migrate diff`.

---

### Task 5: Lo público respeta la sorpresa — galería, página de obra, perfil y "Artistas"

**Files:**
- Modify: `apps/muestras/lib/actividades/consultas.ts`, `apps/muestras/lib/perfiles/consultas.ts`, `apps/muestras/app/m/[slug]/page.tsx`, `apps/muestras/app/m/[slug]/o/[workId]/page.tsx`, `apps/muestras/app/fotografos/[slug]/page.tsx`, `apps/muestras/components/ficha/galeria.tsx`
- Create: `apps/muestras/components/ficha/artistas.tsx`, `apps/muestras/lib/actividades/artistas.ts` (+ `artistas.test.ts`), `apps/muestras/lib/actividades/publicas.test.ts`

**Interfaces:**
- Consumes: `visibleWorks`, `workAccess`, `profileWorksInActivity`, `parseVisibility` (Task 1).
- Produces:
  - `buscarPorSlug(slug)`: igual que hoy (incluye `visibility` porque trae todas las columnas) y suma `exhibitors: { where: { status: "ACTIVE" }, select: { profileId, displayName, profile: { select: { slug, displayName, bio, city, province, avatarUrl } }, works: { where: { status: "APPROVED" }, select: { photos: { orderBy: { sortOrder: "asc" }, select: { id, imageUrl, title, year, technique, caption } } } } } }`.
  - `artistasDeMuestra(a, v): Artista[]` (puro, en `lib/actividades/artistas.ts`): `{ key, nombre, perfil: { slug, bio, ciudad, avatarUrl } | null, otrasObras: Foto[] }` — expositores con al menos una obra en `a.works` (por `authorProfileId` o `authorUserId`), más los perfiles de las obras que no son de expositores (sin `otrasObras`); `otrasObras` vacío si `!v.online.otherWorks`; `[]` si `!v.online.artists`. Orden: el de la primera obra de cada artista en la galería.
  - `buscarPerfilPublico(slug)`: el `select` de cada muestra suma `visibility: true` y, por muestra, las fotos adicionales de este perfil: `exhibitorWorks: { where: { status: "APPROVED", exhibitor: { profileId: perfil.id, status: "ACTIVE" } }, select: { photos: … } }`.

- [ ] **Step 1: Tests que fallan**

`apps/muestras/lib/actividades/artistas.test.ts`: un expositor con dos obras aprobadas y dos adicionales, otro sin perfil, una obra de convocatoria con perfil; casos: con "Adelanto" salen los tres en el orden de la galería y el primero con sus dos adicionales; con `online.otherWorks = false`, sin adicionales; con `online.artists = false`, `[]`; un expositor sin obras en la muestra (todavía sin aprobar) no sale; **ningún** `imageUrl` de `a.works` aparece en el resultado (`JSON.stringify(resultado)` no contiene ninguna).

`apps/muestras/lib/actividades/publicas.test.ts` (prueba de filtración): mockear `@repo/db` con una muestra abierta, "Sorpresa total", 3 obras con `imageUrl` `https://r2.test/muestras/7/oculta-<n>.webp` y un expositor con una adicional `…/adicional-1.webp`; llamar al componente de servidor `Ficha` de `app/m/[slug]/page.tsx` (devuelve el árbol de elementos, con las props que viajarían a los componentes cliente) y serializarlo, más `generateMetadata`. No se usa `renderToString`: no resuelve componentes asíncronos anidados, y lo que importa es qué props llegan a cada componente:
```ts
const arbol = (el: unknown) => JSON.stringify(el, (_k, v) => (typeof v === "function" ? undefined : v));
const html = arbol(await Ficha({ params: Promise.resolve({ slug: "m" }) }));
for (let n = 1; n <= 3; n++) expect(html).not.toContain(`oculta-${n}.webp`);
expect(html).toContain("adicional-1.webp");
expect(html).toContain("Artistas");
const meta = await generateMetadata({ params: Promise.resolve({ slug: "m" }) });
expect(JSON.stringify(meta)).not.toContain("oculta-");
```
Lo mismo para `PaginaDeObra` (oculta → sin `oculta-1.webp`, con el aviso "Esta obra se ve en la sala", `robots.index === false`) y `PerfilPublico` (sin `oculta-`, con "Otras obras"). Y con "Adelanto" y semilla fija: aparecen exactamente las 3 que da `visibleWorks` (calculadas en el test con la misma regla).

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- artistas publicas`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- `app/m/[slug]/page.tsx`: `visibleWorks(a, a.works, ahora)` ya mira el ajuste (no cambia la llamada). Debajo del texto curatorial y antes de la galería, `<Artistas artistas={artistasDeMuestra(a, parseVisibility(a.visibility, a.galleryMode))} />` (sólo `MUESTRA`). Si la galería queda vacía mientras está abierta y la muestra tiene obras, en su lugar un bloque de texto: "Las obras se descubren en la sala. Acá podés conocer a los artistas." (sin galería). Al componente cliente `Galeria` viaja exactamente lo de hoy.
- `components/ficha/galeria.tsx`: la bajada usa `parcial` y suma un caso para el sorteo: si `parcial`, "Algunas de las obras que vas a ver en la sala. Las demás se descubren allá." (sin prometer que quedan online si `revealAfterClose` es falso: el componente recibe `seRevela: boolean`).
- `components/ficha/artistas.tsx` (servidor): grilla de tarjetas (foto redonda, nombre con enlace a `/fotografos/<slug>` si hay perfil, ciudad, biografía cortada a 280 caracteres en el límite de palabra + "Ver perfil"); "Otras obras de <nombre>" como miniaturas que abren el visor existente (un componente cliente chico `OtrasObras` que reutiliza `components/visor/visor.tsx` y recibe **sólo** `{ id, imageUrl, title, year, technique, caption }` de las adicionales).
- `app/m/[slug]/o/[workId]/page.tsx`: sin cambios de lógica (la regla ya mira el ajuste); el texto del aviso pasa a depender de `revealAfterClose`: "Esta obra se ve en la sala." + (si se revela) " Cuando la muestra cierra, queda online en el archivo de la muestra."
- `app/fotografos/[slug]/page.tsx`: por muestra, después de las expuestas, si `parseVisibility(m.visibility, m.galleryMode).profile.otherWorks` y hay adicionales: subtítulo "Otras obras" y miniaturas (mismo componente `OtrasObras`). El texto "Y N obras más para ver en la sala" no cambia.
- `lib/perfiles/consultas.ts`: los `select` como dice Interfaces (sin `priceArs`, `hangingNotes` ni `statement` de las obras expuestas: nada de eso es público).

- [ ] **Step 4: Correr**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: todo en verde.

- [ ] **Step 5: Probar en local**

Con `pnpm --filter muestras dev` y una muestra de prueba publicada con `visibility` cargada a mano en la base **de prueba** (nunca en producción): ver la galería con "Sorpresa total", "Adelanto" y "Todo a la vista"; abrir el código fuente de la página (Ver código fuente) y buscar el nombre de archivo de una obra oculta: no aparece.

- [ ] **Step 6: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: la publicación online respeta la sorpresa y presenta a los artistas con su biografía y sus otras obras"
```

**Acceptance:** con "Sorpresa total" ninguna URL de obra expuesta aparece en `/m/<slug>`, `/m/<slug>/o/<id>` ni `/fotografos/<slug>` (tests); las muestras sin ajuste se ven exactamente como antes.

---

### Task 6: Panel "Visibilidad" — presets, personalizado, volver a sortear y aviso de portada

**Files:**
- Create: `apps/muestras/lib/visibilidad/acciones.ts` (+ `acciones.test.ts`), `apps/muestras/lib/visibilidad/consultas.ts`, `apps/muestras/lib/visibilidad/mapear.ts` (+ `mapear.test.ts`), `apps/muestras/app/panel/muestras/[id]/visibilidad/page.tsx`, `apps/muestras/components/visibilidad/{ajuste-visibilidad.tsx, estilos.ts}`
- Modify: `apps/muestras/lib/limite.ts` (+ `.test.ts`), `apps/muestras/lib/actividades/mapear.ts` (+ `.test.ts`), `apps/muestras/lib/actividades/acciones.ts` (+ `.test.ts`), `apps/muestras/components/formulario/formulario-actividad.tsx`, `apps/muestras/app/panel/muestras/[id]/page.tsx`

**Interfaces:**
- Consumes: `visibilityFromPreset`, `presetOf`, `parseVisibility`, `visibilitySummary`, `coverIsHiddenWork`, `visibleWorks` (Task 1); `rolEnMuestra`, `puede`, `dondePuede` (etapa 5).
- Produces:
  - `visibilidadDesdeFormData(fd, actual: Visibility): Visibility` (puro): `preset` elegido → `visibilityFromPreset(preset, actual.seed)`; `CUSTOM` → cada campo del formulario con sus rangos.
  - `guardarVisibilidad(fd): Promise<ResultadoAccion>` (`visibility`): lee `activityId`, valida con `rolEnMuestra` + `puede(..., "visibility", rol)`, frena `guardarVisibilidad` 60/h; si la semilla actual es `"legado"` o el modo pasa a `RANDOM` sin semilla, crea una con `randomBytes(12).toString("base64url")`; guarda `visibility` y, para que el legado quede coherente, `galleryMode = online.exhibited === "ALL" ? "FULL" : "HIGHLIGHTS_UNTIL_CLOSED"`; `datosDeCambio(usuario.id, "FICHA")`; revalida `/m/<slug>` (layout), `/fotografos` (layout) y `/`.
  - `volverASortear(activityId)`: semilla nueva; mismo permiso y freno.
  - `cargarVisibilidad(id, usuario)` (`consultas.ts`): la muestra con `dondePuede(usuario, "visibility")`, sus obras (`id`, `title`, `authorName`, `imageUrl`, `isHighlight`, `sortOrder`), `coverImageUrl`, `startsAt`, `endsAt`, `galleryMode`, `visibility`, `slug`.
  - `lib/limite.ts`: `guardarVisibilidad` 60/h por persona.

- [ ] **Step 1: Tests que fallan**

`lib/visibilidad/mapear.test.ts`: elegir "Sorpresa total" conserva la semilla; "Personalizado" con `randomCount=20` queda en 12, `rotation=OTRA` queda en `FIXED`, casillas ausentes = `false`.

`lib/visibilidad/acciones.test.ts` (mismo patrón de mocks que `lib/montaje/acciones.test.ts`): sin sesión → "Tenés que ingresar."; rol de textos → "No podés cambiar la visibilidad de esta muestra." y **no** escribe; coorganización → escribe `visibility` y `galleryMode`; semilla `"legado"` → se reemplaza por una de 16 caracteres; `volverASortear` cambia la semilla y nada más; se llamó `revalidatePath("/m/<slug>", "layout")`.

`lib/actividades/acciones.test.ts`: con `visibility` cargada, `guardarBorrador` **no** cambia `galleryMode` aunque el formulario lo mande (D16); sin ajuste, como hoy.

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- visibilidad actividades`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- Página `/panel/muestras/[id]/visibilidad` (`requireUsuario`, `cargarVisibilidad` o `notFound()`):
  - Título "Qué se ve de la muestra" y bajada: "La muestra se ve en la sala. Acá elegís qué se adelanta online y qué ve quien escanea el QR de una ficha."
  - Cuatro presets como opciones grandes (radio) con su descripción (`VISIBILITY_PRESET_DESCRIPTIONS`) y "Personalizado" que despliega tres bloques con títulos en castellano: **"En la publicación online"** (obras de la sala: todas / las destacadas / algunas al azar [cuántas, "siempre las mismas" o "cambian cada día" con el aviso de D15] / ninguna; "Mostrar a los artistas con su biografía"; "Mostrar sus otras obras (las que no se cuelgan)"), **"En el perfil de cada artista"** (obras de la sala: como en la publicación online / ninguna; otras obras), **"Al escanear el QR de una ficha en la sala"** (esa obra / esa obra y las demás del mismo artista / toda la muestra; otras obras; otras muestras donde expuso; opción de compra), **"Cuando cierra la muestra"** (mostrar todo / mantener la reserva).
  - Debajo, **"Así se ve hoy"**: las cuatro frases de `visibilitySummary` y la lista de obras de la sala con una marca "Se ve online" / "Se descubre en la sala" (calculada con `visibleWorks` sobre el ajuste **guardado**). Botón "Volver a sortear" si el modo es al azar.
  - Aviso si `coverIsHiddenWork(...)`: "La portada de la muestra es una de las obras que reservás para la sala: se ve en el listado y al compartir el enlace. Cambiala en la ficha si querés que sea sorpresa."
  - Aviso fijo: "El pase de sala necesita las fichas con el QR nuevo. Si imprimiste fichas antes, volvé a bajarlas desde Montaje e impresión."
  - Enlaces "Ver la publicación online" y "Ver como en la sala" (`/m/<slug>/sala`; anda para el equipo, Task 12).
- `formulario-actividad.tsx`: si la muestra tiene `visibility`, en lugar de la casilla `galleryMode` un texto con enlace: "Qué obras se ven online lo elegís en Visibilidad." `mapear.ts`/`acciones.ts`: si `actual.visibility != null`, `datos.galleryMode = actual.galleryMode`.
- `app/panel/muestras/[id]/page.tsx`: enlace "Visibilidad" (si `puede(…, "visibility", rol)`), con el nombre del preset al lado.

- [ ] **Step 4: Correr y probar**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: en verde. En local: cambiar entre presets y ver la página pública después de guardar (la revalidación es inmediata).

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: panel de Visibilidad con presets, personalizado, volver a sortear y aviso de portada"
```

**Acceptance:** el rol de textos no ve el enlace ni puede guardar (test); guardar un preset y volver a abrir la página lo muestra elegido; "Personalizado" conserva cada opción.

---

### Task 7: Enlace de expositores para la organización

**Files:**
- Create: `apps/muestras/lib/expositores/enlace.ts` (+ `enlace.test.ts`), `apps/muestras/lib/expositores/consultas.ts`, `apps/muestras/app/panel/muestras/[id]/expositores/page.tsx`, `apps/muestras/components/expositores/{enlace-expositores.tsx, estilos.ts}`
- Modify: `apps/muestras/lib/limite.ts` (+ `.test.ts`), `apps/muestras/app/panel/muestras/[id]/page.tsx`

**Interfaces:**
- Consumes: `exhibitorLinkState`, `EXHIBITOR_LIMITS`, `EXHIBITOR_DEFAULTS`, `EXHIBITOR_TEXT_LIMITS` (Task 2); `visibilityFromPreset` (Task 1); `nuevoTokenDeInvitacion`/`esTokenConForma` (`lib/curaduria/token.ts`: se usa el `token`, no el `hash`); `CopiarEnlace` (`components/enlace/copiar-enlace.tsx`); `dayEndAr`.
- Produces:
  - `crearEnlaceExpositores(activityId)`: `exhibitors`; sólo tipo `MUESTRA`, no cancelada ni cerrada; crea la fila con token nuevo y los valores por defecto; **si la muestra no tiene `visibility`, guarda "Adelanto"** con semilla nueva y devuelve el aviso "Elegimos 'Adelanto': online se ven 3 obras al azar y los artistas con su biografía. Podés cambiarlo en Visibilidad." (D16). Si ya existe, no hace nada.
  - `guardarEnlaceExpositores(fd)`: topes (con rangos), fecha límite (`AAAA-MM-DD` → `dayEndAr`; vacía = sin límite; no antes de hoy ni después del cierre), instrucciones (≤ 1500).
  - `renovarEnlaceExpositores(activityId)`: token nuevo + `rotatedAt`; devuelve el aviso "El enlace anterior dejó de andar. Mandá el nuevo a quienes todavía no se sumaron."
  - `cambiarEstadoEnlace(activityId, "OPEN" | "CLOSED")`.
  - `enlaceDeExpositores(activityId, usuario)` (`consultas.ts`, `dondePuede(usuario, "exhibitors")`): el enlace, su estado (`exhibitorLinkState`), la URL completa (`APP_URL` + `/expositores/<token>`), cuántos expositores.
  - `lib/limite.ts`: `enlaceExpositores` 30/h por persona.

- [ ] **Step 1: Tests que fallan**

`lib/expositores/enlace.test.ts`: sin permiso (`TEXT_EDITOR`) → no crea; crea con token de 43 caracteres y valores por defecto; la primera vez guarda `visibility` "Adelanto" sólo si estaba vacía; segunda llamada no duplica (único por `activityId`: el `upsert`/`create` con `P2002` se trata como "ya existe"); `guardarEnlaceExpositores` recorta topes fuera de rango con un error claro ("Las obras por expositor van de 1 a 20."), rechaza fecha límite después del cierre ("La fecha límite tiene que ser antes de que cierre la muestra."); `renovar` cambia el token; muestra cancelada → "La muestra está cancelada."

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- expositores/enlace`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- Página `/panel/muestras/[id]/expositores` (`requireUsuario`; `notFound()` sin `exhibitors`). Parte de arriba, **"Enlace para expositores"**: sin enlace, texto "Mandá un enlace a las personas que elegiste para exponer: se suman con su cuenta de Google, completan su perfil y cargan sus obras. Vos aprobás cada obra antes de que entre a la muestra." y botón "Generar el enlace". Con enlace: el enlace con `CopiarEnlace` y el texto "Mandalo por WhatsApp o por mail.", estado ("Abierto" / "Cerrado" / "Venció la fecha límite"), formulario de topes, fecha límite e instrucciones ("Por ejemplo: 'Hasta 3 obras de la serie Río. Las copias se entregan enmarcadas el 30 de octubre en la sede'"), botones "Cerrar el enlace"/"Volver a abrirlo" y "Generar un enlace nuevo" (con confirmación). La parte de abajo (expositores y obras) llega en la Task 10.
- `app/panel/muestras/[id]/page.tsx`: enlace "Expositores" (si `exhibitors`), con el contador de obras para revisar (Task 10 lo llena; aquí `0`).

- [ ] **Step 4: Correr**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: en verde.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: enlace de expositores para la organización — generar, copiar, topes, fecha límite, cerrar y renovar"
```

**Acceptance:** el enlace se puede copiar todas las veces que haga falta; renovar corta el anterior; el rol de textos recibe 404.

---

### Task 8: Sumarse como expositor (entrada pública, Google y perfil)

**Files:**
- Create: `apps/muestras/app/expositores/[token]/page.tsx`, `apps/muestras/lib/expositores/alta.ts` (+ `alta.test.ts`), `apps/muestras/components/expositores/alta-expositor.tsx`
- Modify: `apps/muestras/lib/expositores/consultas.ts`, `apps/muestras/lib/perfiles/acciones.ts` (extraer `crearOActualizarPerfil(tx?, userId, datos)` reutilizable, sin cambiar `guardarPerfil`), `apps/muestras/lib/limite.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: `exhibitorLinkState`, `exhibitorJoinProblems` (Task 2); `perfilDesdeFormData`, `LARGOS_PERFIL` (`lib/perfiles/mapear.ts`); `esTokenConForma`; `requireUsuario`, `getUsuario`.
- Produces:
  - `enlacePorToken(token)` (`consultas.ts`): `null` si `!esTokenConForma(token)`; si no, el enlace con su muestra (`id`, `slug`, `title`, `type`, `reviewStatus`, `isCancelled`, `startsAt`, `endsAt`, `venueName`, `city`, `coverImageUrl`, `organizersText`) y la cantidad de expositores activos. **Nunca** el `token` de vuelta hacia componentes cliente.
  - `sumarmeComoExpositor(fd)`: sesión; `token` → enlace; `exhibitorJoinProblems`; si ya es expositor (`ACTIVE`) → `{ ok: true, id }` (va a su página); si fue `REMOVED` → "Quien organiza te sacó de esta muestra. Escribile si fue un error."; crea o actualiza el perfil propio (si no tiene: nombre, biografía, ciudad, provincia, Instagram, foto; si tiene: sólo completa la biografía si estaba vacía y la mandó) y la fila `CulturalExhibitor` en una transacción; frena `sumarseExpositor` 20/h; devuelve `{ ok: true, id: exhibitorId }`.
  - `lib/limite.ts`: `sumarseExpositor` 20/h por persona; `paginaExpositores` 60/10 min por IP.

- [ ] **Step 1: Tests que fallan**

`lib/expositores/alta.test.ts`: token con mala forma → "Este enlace no existe." sin consultar la base; enlace cerrado → mensaje de Task 2; sin perfil → crea perfil con slug libre (`freeProfileSlug`) y la fila; con perfil → no lo pisa (sólo la biografía vacía); ya sumado → devuelve su id sin crear otra fila; sacado → mensaje; cupo lleno → mensaje; sin aceptar derechos → mensaje; nombre con más de 120 caracteres → recortado.

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- expositores/alta`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- `app/expositores/[token]/page.tsx`: `dynamic = "force-dynamic"`; metadatos `robots: { index: false, follow: false }`, `referrer: "no-referrer"`; freno `paginaExpositores` por IP (pasado el tope, el mismo 404). Enlace inexistente o `UNAVAILABLE` → `notFound()`. `CLOSED`/`EXPIRED` → la página con "Este enlace ya no recibe expositores. Si ya te sumaste, entrá a 'Donde expongo' en tu panel." Abierto:
  - Arriba: portada (si es web), "Te invitan a exponer en", título, organiza, fechas, sede; instrucciones de quien organiza; "Podés cargar hasta N obras. Por cada una, una foto principal (la que se cuelga en la sala) y hasta M fotos adicionales."; fecha límite si hay.
  - Sin sesión: botón "Ingresá con Google para sumarte" → `/login?next=/expositores/<token>` (el `next` ya pasa por `lib/ruta-segura.ts`; verificar que `/expositores/…` está permitido y sumarlo si hace falta, con test).
  - Con sesión y ya expositor: "Ya estás en esta muestra" + botón "Ir a mis obras" (`/panel/expositor/<id>`).
  - Con sesión: `AltaExpositor` (cliente) con "Cómo firmás tus obras" (prellenado con el nombre del perfil o de la cuenta), el bloque del perfil (si no tiene: nombre público, biografía —"Contá quién sos y qué fotografiás. Es lo que va a leer el público de la muestra."—, ciudad, provincia, Instagram, foto con `subir-imagen.ts` uso `avatar`; si tiene: "Tu perfil: <nombre>" con enlace a editarlo y, si no tiene biografía, el campo biografía), la casilla de derechos con el texto de D3 y "Sumarme a la muestra".
- `lib/perfiles/acciones.ts`: extraer la escritura a una función interna que reciba `tx`, sin cambiar el comportamiento ni los tests de `guardarPerfil`.

- [ ] **Step 4: Correr**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: en verde.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: entrada pública para expositores — ingresar con Google, completar el perfil y sumarse a la muestra"
```

**Acceptance:** la página del enlace es `noindex` y no deja ver nada de otras personas; sumarse dos veces no duplica; sin sesión no se escribe nada.

---

### Task 9: "Donde expongo" — el expositor carga sus obras y sus fotos adicionales

**Files:**
- Create: `apps/muestras/lib/expositores/obras.ts` (+ `obras.test.ts`), `apps/muestras/lib/expositores/mapear.ts` (+ `mapear.test.ts`), `apps/muestras/app/panel/expositor/page.tsx`, `apps/muestras/app/panel/expositor/[id]/page.tsx`, `apps/muestras/components/expositores/{obras-expositor.tsx, obra-expositor.tsx}`
- Modify: `apps/muestras/lib/expositores/consultas.ts`, `apps/muestras/lib/limite.ts` (+ `.test.ts`), `apps/muestras/components/panel/barra-lateral.tsx` (si lista secciones a mano)

**Interfaces:**
- Consumes: `exhibitorWorkProblems`, `exhibitorPhotoProblems`, `exhibitorWorkTransition`, `exhibitorLinkState`, `EXHIBITOR_WORK_STATUS_LABELS`, `editionText`, `sizeText` (Task 2); `esImagenDeUsuario` (`lib/envios/mapear.ts`) y `baseImagenesPublicas`; `subirImagen` (`components/formulario/subir-imagen.ts`, uso `obra`).
- Produces:
  - `misParticipaciones(usuario)` (`consultas.ts`): mis filas `CulturalExhibitor` (`ACTIVE` y `REMOVED`) con la muestra (`title`, `slug`, `startsAt`, `endsAt`, `reviewStatus`, `isCancelled`), el enlace (estado y topes) y la cantidad de obras por estado.
  - `miParticipacion(id, usuario)`: la fila **propia** (`where: { id, userId: usuario.id }`) con sus obras (todos los campos) y fotos, ordenadas.
  - `obraDesdeFormData(fd, base, userId)` (`mapear.ts`, puro): todos los campos de D5 con recortes y números; la foto principal y las adicionales sólo si `esImagenDeUsuario`; devuelve `{ obra, fotos, descartadas }`.
  - Acciones (todas leen la fila propia `ACTIVE` y la muestra en la base; nunca confían en el `activityId` del formulario):
    - `guardarObraDeExpositor(fd)`: crea o actualiza **una** obra (si trae `id`, tiene que ser de esta participación y `exhibitorWorkTransition("edit", status)` ok); tope de obras por expositor (contando las no `REMOVED`) y de fotos por obra; las fotos adicionales se reemplazan enteras (`deleteMany` + `createMany` dentro de la transacción); valida con `forSubmit: false`; frena `guardarObraExpositor` 300/h.
    - `borrarObraDeExpositor(workId)`: sólo `DRAFT` (y `CHANGES_REQUESTED` sin `activityWorkId`).
    - `enviarObraDeExpositor(workId)`: `exhibitorWorkTransition("submit", …, { linkOpen: exhibitorLinkState(...) === "OPEN", complete: exhibitorWorkProblems(w, { forSubmit: true }).length === 0 })`; además exige biografía en el perfil ("Antes de enviar, completá tu biografía: es lo que el público lee de vos."); `submittedAt = now`; frena `enviarObraExpositor` 60/h. Devuelve los problemas tal cual (lista) si falta algo.
    - `retirarObraDeExpositor(workId)`: `SUBMITTED` → `DRAFT`.
  - `lib/limite.ts`: `guardarObraExpositor` 300/h, `enviarObraExpositor` 60/h.

- [ ] **Step 1: Tests que fallan**

`lib/expositores/mapear.test.ts`: la foto de otra persona (`muestras/8/…` siendo yo 7) se descarta y cuenta en `descartadas`; números con coma ("40,5") se leen como 40.5; precio con puntos ("120.000") → 120000; edición no limitada → `editionNumber`/`editionSize` `null`; textos recortados a sus largos.

`lib/expositores/obras.test.ts`: (a) la obra de **otra** participación (otro `exhibitorId`) → "La obra no existe." y no escribe; (b) editar una `APPROVED` → mensaje de Task 2; (c) pasar el tope de obras → "Podés cargar hasta 3 obras."; (d) pasar el tope de fotos → "Cada obra puede tener hasta 3 fotos adicionales."; (e) enviar incompleta → lista de problemas; (f) enviar con el enlace cerrado una `DRAFT` → mensaje; una `CHANGES_REQUESTED` → sí; (g) enviar sin biografía → mensaje; (h) un expositor `REMOVED` no puede guardar ni enviar ("Quien organiza te sacó de esta muestra."); (i) muestra cancelada → "La muestra está cancelada."; (j) guardar reemplaza las fotos adicionales en la misma transacción.

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- expositores/mapear expositores/obras`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- `/panel/expositor` (`requireUsuario("/panel/expositor")`): "Donde expongo"; una fila por muestra (título, fechas, "3 obras: 1 en la muestra, 1 enviada, 1 con cambios pedidos"), enlace a cada una. Vacío: "Todavía no expusiste por acá. Cuando una organización te mande su enlace, vas a ver la muestra en esta lista."
- `/panel/expositor/[id]` (`requireUsuario`; `miParticipacion` o `notFound()`): cabecera con la muestra y el estado del enlace; "Tus obras (2 de 3)"; por obra, `ObraExpositor` (cliente): estado con su etiqueta, la nota de cambios destacada si hay ("Quien organiza te pidió: …"), formulario (foto principal con vista previa y "Cambiar foto"; título; año; técnica y soporte; medida de la imagen; medida con marco; edición con número y total si es limitada; texto de la obra; "La quiero vender" + precio; notas para el montaje con la aclaración "Sólo las ve quien organiza"), **fotos adicionales** ("Otras fotos de esta obra: de la serie, del proceso. No se cuelgan; el público las puede ver online para conocerte.") con título, año, técnica y texto breve cada una, ordenables con flechas; botones "Guardar", "Enviar a la organización" (habilitado si está completa; si no, lista lo que falta), "Retirar el envío", "Borrar". Las obras `APPROVED` se ven en modo lectura con "Ya está en la muestra". Botón "Agregar otra obra" mientras no se llegue al tope. Subidas por `/api/imagenes` (el navegador achica antes, como hoy).
- Enlace al perfil propio ("Tu perfil público: lo que el público ve de vos") con aviso si falta la biografía.

- [ ] **Step 4: Correr**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: en verde.

- [ ] **Step 5: Probar en local**

Con dos cuentas (A organiza, E expone): A genera el enlace; E lo abre en una ventana privada, entra con Google, se suma, carga una obra completa con dos adicionales y la envía; intenta una cuarta obra con el tope en 3; recarga y ve todo guardado. A 375 px, sin scroll horizontal.

- [ ] **Step 6: Commit**

```bash
git add apps/muestras packages/muestras
git commit -m "Muestras: 'Donde expongo' — el expositor carga cada obra con su foto principal, sus datos y sus fotos adicionales, y la envía"
```

**Acceptance:** ninguna consulta del expositor puede devolver datos de otra participación (todas filtran por `userId`); una obra incompleta no se envía.

---

### Task 10: Revisión de la organización y convivencia con el editor de la muestra

**Files:**
- Create: `apps/muestras/lib/expositores/revision.ts` (+ `revision.test.ts`), `apps/muestras/components/expositores/revision-expositores.tsx`
- Modify: `apps/muestras/lib/expositores/consultas.ts`, `apps/muestras/app/panel/muestras/[id]/expositores/page.tsx`, `apps/muestras/app/panel/muestras/[id]/page.tsx`, `apps/muestras/app/panel/muestras/page.tsx`, `apps/muestras/lib/actividades/acciones.ts` (+ `.test.ts`), `apps/muestras/lib/actividades/textos.ts` (+ `.test.ts`), `apps/muestras/lib/actividades/consultas.ts`, `apps/muestras/components/formulario/obras.tsx`, `apps/muestras/lib/limite.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: `exhibitorWorkTransition`, `toActivityWork`, `pendingReviewCount`, `EXHIBITOR_WORK_STATUS_LABELS_ORGANIZER` (Task 2); `canEdit`, `MAX_WORKS`, `OBRA_QUITADA_DE_LA_GALERIA`; `rolEnMuestra`, `puede`; `datosDeCambio`.
- Produces:
  - `expositoresDeMuestra(activityId, usuario)` (`consultas.ts`, `exhibitors`): expositores (activos y sacados) con perfil (nombre, slug, biografía corta), y sus obras con todos los campos y fotos.
  - `pendientesPorMuestra(ids: string[])`: `{ [activityId]: número de obras SUBMITTED }` (un `groupBy`), para "Mis muestras" y la página de la muestra.
  - `aprobarObraDeExpositor(workId)`: en una transacción: `SELECT … FROM "CulturalActivity" WHERE id = $1 FOR UPDATE`; permiso (`exhibitors`) y `canEdit` con el rol (si no: "La muestra está en revisión: esperá a que se revise para sumar obras."); `exhibitorWorkTransition("approve")`; si no tiene `activityWorkId`: cuenta las obras de la muestra (`< MAX_WORKS`, si no "La muestra ya tiene 40 obras: sacá alguna antes de sumar otra."), crea la `CulturalActivityWork` con `toActivityWork(..., max(sortOrder) + 1)` y guarda su id; si ya tenía (vuelve a aprobar después de cambios): `updateMany({ where: { id: activityWorkId, activityId } })` con imagen, título, año y técnica (si esa fila ya no existe, crea una nueva); `status = APPROVED`, `reviewNote = null`, `reviewedAt`, `reviewedByUserId`; `datosDeCambio(usuario.id, "FICHA")`. Revalida la muestra y `/fotografos`.
  - `pedirCambiosObraDeExpositor(workId, nota)`: nota obligatoria (≤ 600); `SUBMITTED`/`APPROVED` → `CHANGES_REQUESTED`; una aprobada **sigue en la muestra**.
  - `corregirObraDeExpositor(fd)`: quien organiza corrige datos de texto y medidas (no la foto) de una obra en cualquier estado salvo `REMOVED`; si está aprobada, copia título, año y técnica a la `CulturalActivityWork`.
  - `sacarObraDeExpositor(workId)`: `REMOVED`; borra la `CulturalActivityWork` vinculada (`deleteMany({ where: { id: activityWorkId, activityId } })`), `activityWorkId = null`, nota "La organización la sacó de la muestra."
  - `sacarExpositor(exhibitorId)`: `REMOVED` + todas sus obras como en `sacarObraDeExpositor` (con confirmación en la interfaz).
  - `lib/limite.ts`: `revisarExpositores` 600/10 min por persona.
  - **Editor de la muestra (D9)**, en `guardarBorrador`: leer en la transacción `culturalExhibitorWork.findMany({ where: { activityId: id, activityWorkId: { not: null } }, select: { id, activityWorkId } })`; en `obrasParaGuardar`, para una obra conservada cuyo id está en ese mapa, **forzar** `imageUrl`, `authorName`, `authorProfileId` y `authorUserId` a los de la base (`previas` suma `imageUrl` y `authorName`); después de escribir, copiar título, año y técnica de vuelta a cada obra del expositor (`updateMany` por `id`); para cada `plan.removedIds` que sea de un expositor: `status = "REMOVED"`, `activityWorkId = null`, `reviewNote = "La organización la sacó de la muestra."`.
  - `guardarTextos` (`lib/actividades/textos.ts`): después del `updateMany` de cada obra, `culturalExhibitorWork.updateMany({ where: { activityWorkId: obra.id, activityId }, data: { title, year, technique } })`.
  - `buscarParaEditar`: suma el conjunto de ids de obras que vienen de expositores (`exhibitorWorkIds: string[]`) para que `obras.tsx` muestre la imagen y el autor como "Lo carga quien expone" (sin botón para cambiarlos).

- [ ] **Step 1: Tests que fallan**

`lib/expositores/revision.test.ts`: (a) rol de textos → no aprueba; (b) muestra en revisión → mensaje y no escribe; (c) aprueba: crea la `CulturalActivityWork` con `toActivityWork`, al final del orden, y guarda `activityWorkId`; (d) con 40 obras → mensaje; (e) volver a aprobar actualiza por id y no crea otra; (f) pedir cambios sin nota → "Escribí qué hay que cambiar."; con nota a una aprobada → sigue la `CulturalActivityWork`; (g) sacar borra la `CulturalActivityWork` **sólo** con `activityId` de esta muestra; (h) sacar al expositor saca todas sus obras; (i) cada acción vuelve a leer el rol (un integrante revocado entre medio no puede).

`lib/actividades/acciones.test.ts`: el formulario intenta cambiar la imagen y el autor de una obra de expositor → quedan los de la base; cambia el título → se copia a la obra del expositor; quita una obra de expositor → la obra del expositor queda `REMOVED`. `lib/actividades/textos.test.ts`: el título editado se copia a la obra del expositor.

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- expositores/revision actividades`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- Parte de abajo de `/panel/muestras/[id]/expositores`: **"Para revisar (N)"** primero (obras `SUBMITTED`), después cada expositor con su foto, nombre (enlace a su perfil), "Se sumó el …", sus obras: miniatura grande de la foto principal (la organización ve la URL: es su muestra), datos completos (`fichaDetail`, statement, precio si está a la venta, notas para el montaje), fotos adicionales en fila; botones "Aprobar" / "Pedir cambios" (abre un campo con la nota) / "Corregir datos" / "Sacar de la muestra" (confirmación: "La obra deja de estar en la muestra, en las fichas y en el plano."). Arriba, el resumen: "12 expositores · 30 obras en la muestra · 4 para revisar · 2 con cambios pedidos". Pie: "Sacar a esta persona de la muestra".
- `app/panel/muestras/page.tsx` y `[id]/page.tsx`: contador "N obras para revisar" junto al enlace "Expositores" (con `pendientesPorMuestra`).

- [ ] **Step 4: Correr y probar**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: en verde. En local: A aprueba la obra de E → aparece en la galería según la visibilidad, en "Montaje e impresión" y en el plano; A pide cambios → E la ve con la nota, corrige y reenvía; A cambia el título en la ficha → E ve el título nuevo.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: la organización aprueba, pide cambios, corrige o saca obras de expositores; el editor de la muestra respeta su imagen y autoría"
```

**Acceptance:** lo aprobado aparece en todo lo existente sin cambiar esas piezas; el editor de la muestra nunca pisa la imagen ni el autor de una obra de expositor (test).

---

### Task 11: Fichas, catálogo y plano con los datos del expositor y el QR de sala

**Files:**
- Create: `apps/muestras/lib/sala/codigos.ts` (+ `codigos.test.ts`)
- Modify: `apps/muestras/lib/fichas/texto.ts` (+ `texto.test.ts`), `apps/muestras/lib/fichas/cargar.ts` (+ `cargar.test.ts`), `apps/muestras/lib/fichas/pdf.ts` (+ `pdf.test.ts`), `apps/muestras/lib/piezas/cargar.ts`, `apps/muestras/lib/piezas/catalogo.ts` (+ `catalogo.test.ts`), `apps/muestras/lib/montaje/consultas.ts`, `apps/muestras/components/montaje/editor-montaje.tsx`

**Interfaces:**
- Consumes: `roomCodeFrom`, `isRoomCode` (Task 3); `scanUrl(base, "s", code)`; `fichaDetail`, `editionText`, `sizeText` (Task 2).
- Produces:
  - `asegurarCodigosDeSala(activityId, workIds): Promise<Map<workId, code>>` (`lib/sala/codigos.ts`, `server-only`): lee los existentes; para los que faltan, `createMany({ data, skipDuplicates: true })` con `roomCodeFrom(randomBytes(12))`; si un código choca (PK), reintenta hasta 3 veces; vuelve a leer y devuelve el mapa completo.
  - `datosDeFicha(a, o, baseUrl, extra?: { codigo?: string; detalle?: string })`: el QR usa `/q/s/<código>` si hay código (si no, `/q/o/<id>` como antes); `detalle` = `fichaDetail` del expositor si la obra viene de uno (año, técnica, medidas, edición), si no el de hoy.
  - `cargarFichas`/`cargar` de piezas: suman por obra los datos del expositor (`culturalExhibitorWork.findMany({ where: { activityId, activityWorkId: { in: ids } } })`).
  - Catálogo: la página de cada obra suma medidas, edición y el texto de la obra (si hay) debajo de año y técnica (sin precio).
  - Editor del plano: al colgar una obra que viene de un expositor, propone `frameWidthCm`/`frameHeightCm` del expositor (editable); `cargarMontaje` las trae.

- [ ] **Step 1: Tests que fallan**

`lib/sala/codigos.test.ts`: crea sólo los que faltan; con un choque de PK simulado reintenta; devuelve el mismo código en la segunda llamada (estable para reimprimir). `lib/fichas/texto.test.ts`: con código → `https://muestrasfotograficas.com/q/s/<código>`; sin código → `/q/o/<id>`; con datos de expositor → detalle "2024. Giclée. 40 × 60 cm. Edición 2/10". `lib/piezas/catalogo.test.ts`: la página de una obra de expositor lleva medidas y edición, y nunca el precio.

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- sala/codigos fichas catalogo`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Las fichas (`/api/fichas/[id]`) llaman `asegurarCodigosDeSala` antes de armar el PDF (sólo con la muestra publicada, como ya exige el QR). El PDF de la ficha suma una línea de detalle si entra (mismo recorte de líneas que hoy). Sin cambios de permisos (`pieces`).

- [ ] **Step 4: Correr**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: en verde.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: fichas con el QR de sala y los datos del expositor; catálogo con medidas y edición; el plano propone la medida del marco"
```

**Acceptance:** bajar dos veces las fichas da los mismos QR; ningún PDF lleva el precio.

---

### Task 12: Pase de sala — `/q/s`, vista de sala, imágenes por proxy y entrada de compra

**Files:**
- Create: `apps/muestras/lib/sala/llave.ts` (+ `llave.test.ts`), `apps/muestras/lib/sala/consultas.ts` (+ `consultas.test.ts`), `apps/muestras/lib/sala/acciones.ts` (+ `acciones.test.ts`), `apps/muestras/app/m/[slug]/sala/page.tsx`, `apps/muestras/app/m/[slug]/sala/o/[workId]/page.tsx`, `apps/muestras/app/m/[slug]/sala/img/[id]/route.ts`, `apps/muestras/lib/sala/img-ruta.test.ts`, `apps/muestras/components/sala/{obra-de-sala.tsx, entrada-de-compra.tsx}`
- Modify: `apps/muestras/lib/estadisticas/qr.ts`, `apps/muestras/app/q/[tipo]/[id]/route.ts` (+ `lib/estadisticas/qr-ruta.test.ts`), `apps/muestras/lib/limite.ts` (+ `.test.ts`), `apps/muestras/app/panel/muestras/[id]/visibilidad/page.tsx`

**Interfaces:**
- Consumes: `mergeRoomPass`, `encodeRoomPass`, `decodeRoomPass`, `roomPassValid`, `roomPassCookieName`, `ROOM_PASS_HOURS`, `isRoomCode`, `buyEntry` (Task 3); `parseVisibility`, `roomExhibitedWorks`, `visibleWorks` (Task 1); `leerDeR2`; `esDelEquipo`; `buscarPerfilPublico`.
- Produces:
  - `lib/sala/llave.ts` (`server-only`): `llaveDeMuestra(activityId)` (lee o crea con `randomBytes(32).toString("hex")`; `upsert` con `update: {}`), `firmarPase(pase, llave): string` (`<payload>.<hmac base64url>`), `leerPase(valor, llave): RoomPass | null` (`timingSafeEqual`, largo fijo), `rotarLlave(activityId)`.
  - `lib/estadisticas/qr.ts`: `destinoDelQr("s", code)`: `isRoomCode` → `culturalActivityRoomCode.findUnique` → la obra existe en esa muestra (`culturalActivityWork.findFirst({ where: { id: workId, activityId } })`) y la muestra publicada → `{ path: "/m/<slug>/sala/o/<workId>", activityId, workId, metric: "SCAN", pase: true }`.
  - `/q/[tipo]/[id]`: si `destino.pase`, lee la cookie `mf_sala_<activityId>` del pedido, la valida con la llave, `mergeRoomPass`, firma y responde el 302 con `Set-Cookie: mf_sala_<id>=<valor>; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Lax` (sin `Secure` sólo si `NODE_ENV !== "production"`, para `next dev` en http). `HEAD` redirige sin cookie y sin contar.
  - `paseDeSala(slug)` (`lib/sala/consultas.ts`): `cookies()` + muestra publicada por slug (`select` mínimo: `id`, `slug`, `title`, `galleryMode`, `visibility`, `startsAt`, `endsAt`, `isCancelled`, `venueName`, `city`) + llave → `{ actividad, pase: RoomPass | null, equipo: boolean }` (`equipo` = `esDelEquipo(id)`; el equipo ve como si hubiera escaneado todo).
  - `vistaDeSala(actividad, pase, workId?)`: obras expuestas permitidas (`roomExhibitedWorks` sobre `pase.w`, o todas si `equipo`), unidas a las visibles online; la obra pedida (si no está permitida → `null`); su expositor (perfil completo, obra del expositor con medidas, edición, statement, `forSale`, `priceArs`), sus otras obras permitidas, sus adicionales (`room.otherWorks`), sus otras muestras publicadas (`room.otherExhibitions`, desde `buscarPerfilPublico` con lo que cada una muestra online) y `buyEntry`. **Todas** las imágenes como `/m/<slug>/sala/img/<id>` (nunca `imageUrl`).
  - `imagenDeSalaPermitida(slug, id)`: la URL de R2 si el `id` es una obra expuesta permitida por el pase o una adicional de una obra aprobada de esta muestra con `room.otherWorks`; si no, `null`.
  - `cortarAccesosDeSala(activityId)` (`visibility`): `rotarLlave`; `cambiarCodigosDeSala(activityId)` (`visibility`): `deleteMany` de los códigos de la muestra; aviso "Los QR impresos dejaron de dar acceso. Volvé a bajar e imprimir las fichas."
  - `lib/limite.ts`: `vistaSala` 300/10 min e `imagenSala` 600/10 min por IP.

- [ ] **Step 1: Tests que fallan**

`lib/sala/llave.test.ts`: firmar y leer; una firma cambiada en un carácter → `null`; otra llave → `null`; valor sin punto o gigante → `null` sin excepción.

`lib/estadisticas/qr-ruta.test.ts` (sumar): `/q/s/<código válido>` → 302 a `/m/<slug>/sala/o/<obra>`, `Cache-Control: private, no-store`, `Set-Cookie` con `mf_sala_<id>`, `HttpOnly`, `SameSite=Lax`, `Max-Age=28800`, y cuenta un `SCAN`; con cookie previa válida, la nueva lleva las dos obras; `/q/s/<código inexistente>` → `/` sin cookie; **`/q/o/<obra>` no pone cookie** (D22); un código de una muestra despublicada → `/`.

`lib/sala/consultas.test.ts`: sin pase → la página redirige a `/m/<slug>/o/<obra>`; pase de otra muestra → igual; pase vencido → igual; pase con `a1` y ajuste "ARTIST" → ve `a1` y `a2`, no `c1`; pedir `c1` → redirige; equipo sin pase → ve todo; **ninguna** `imageUrl` del bucket aparece en lo que devuelve `vistaDeSala` (`JSON.stringify` sin `r2.test`); `buyEntry` sólo con `room.buy`.

`lib/sala/img-ruta.test.ts` (patrón de `lib/curaduria/imagen-ruta.test.ts`): sin pase → 404 `no-store`; con pase y obra permitida → 200 con los bytes, `Cache-Control: private, max-age=600`, `Referrer-Policy: no-referrer`, `nosniff`, `Content-Disposition: inline`; tipo `image/svg+xml` → 404; obra no permitida → 404; adicional con `room.otherWorks = false` → 404.

`lib/sala/acciones.test.ts`: textos y coorganización según capacidades; rotar cambia el `secret`; cambiar códigos borra sólo los de esa muestra.

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- sala qr-ruta`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- `app/m/[slug]/sala/o/[workId]/page.tsx`: `export const dynamic = "force-dynamic"`; metadatos `robots: { index: false, follow: false }`, `referrer: "no-referrer"`, título "<obra> · en la sala" (sin `openGraph` con imagen); freno `vistaSala` por IP; `paseDeSala` + `vistaDeSala`; si no hay vista → `redirect(workPath(slug, workId))`. Encabezados: el `Cache-Control` privado lo pone Next en páginas dinámicas que leen cookies; verificar en el build que la ruta figura como dinámica (`ƒ`).
  Contenido (`ObraDeSala`): la obra grande (img por proxy), título, autor, `fichaDetail`, texto de la obra; **"Sobre <artista>"** con foto, biografía completa, ciudad, web e Instagram y "Ver perfil"; **"Otras obras de <artista> en esta muestra"** (las permitidas, cada una enlaza a su vista de sala); **"Otras fotos de <artista>"** (adicionales, visor); **"También expuso en"** (otras muestras con enlace a su página pública); `EntradaDeCompra`; la baliza `ContarVisita` con `actividad` y `obra`; "Ver toda la muestra" → `/m/<slug>` (la pública) y "Lo que escaneaste" → `/m/<slug>/sala`.
- `components/sala/entrada-de-compra.tsx`: `NONE` → nada; `ASK` → "A la venta · $ 120.000" y "Para comprarla, consultá a la organización en la sala." (comentario: la etapa de Ventas suma el estado `BUY` con el pago por DNX Payments).
- `app/m/[slug]/sala/page.tsx`: lo escaneado (miniaturas por proxy) y cuánto dura el pase ("Tu acceso de sala vale hasta las 23:40."); sin pase → `redirect("/m/<slug>")`.
- `app/m/[slug]/sala/img/[id]/route.ts`: `runtime = "nodejs"`, `dynamic = "force-dynamic"`, freno `imagenSala`; `imagenDeSalaPermitida` → `leerDeR2` → mismos controles de tipo y encabezados que `app/api/curaduria/obras/[id]/imagen/route.ts`.
- `/panel/muestras/[id]/visibilidad`: suma "Cortar los accesos de sala" ("Los pases vigentes dejan de valer. Quien vuelva a escanear una ficha recibe uno nuevo.") y "Cambiar los códigos de sala" (con confirmación y el aviso de reimprimir).

- [ ] **Step 4: Correr**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: en verde.

- [ ] **Step 5: Probar en local**

Con una muestra de prueba publicada con "Sorpresa total": bajar las fichas, escanear un QR con el teléfono (o abrir `http://localhost:3014/q/s/<código>`): se ve la obra, el artista, sus otras obras y la compra. Copiar la dirección `/m/<slug>/sala/o/<id>` a una ventana privada: lleva a la página pública con el aviso sin imagen. Abrir la imagen de la vista de sala en otra pestaña privada: 404. "Cortar los accesos de sala" y recargar en el teléfono: vuelve a la versión pública.

- [ ] **Step 6: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: pase de sala — el QR de la ficha muestra la obra, el artista, sus otras obras y la compra durante 8 horas; un enlace compartido respeta la sorpresa"
```

**Acceptance:** un enlace de la vista de sala sin la cookie nunca muestra una obra oculta; `/q/o/<id>` no da pase; ninguna URL del bucket aparece en la vista de sala (tests).

---

### Task 13: Difusión respeta la sorpresa, privacidad y panel

**Files:**
- Modify: `apps/muestras/lib/redes/cargar.ts`, `apps/muestras/app/api/redes/[id]/route.ts` (+ `lib/redes/ruta.test.ts`), `apps/muestras/components/difusion/piezas-redes.tsx`, `apps/muestras/app/panel/difusion/[id]/page.tsx`, `apps/muestras/app/privacidad/page.tsx`, `apps/muestras/lib/panel/en-preparacion.test.ts` (sin cambios de contenido; correrlo), `apps/muestras/app/panel/page.tsx`

**Interfaces:**
- Consumes: `visibleWorks` (Task 1), `availableSocialVariants(..., onlineWorkCount)` (Task 3).
- Produces:
  - `cargarMuestraParaRedes`/`cargarMuestraParaDifusion`: el `select` suma `galleryMode`, `visibility`; la lista de obras que se ofrece y la que acepta la ruta es `visibleWorks(a, a.works, ahora).works`.
  - `/api/redes/[id]?variante=obra&obra=<id>`: una obra no visible online hoy → 404 en texto (igual que una obra de otra muestra).

- [ ] **Step 1: Tests que fallan**

`lib/redes/ruta.test.ts` (sumar): con "Sorpresa total", `variante=obra` → 404 y la página de difusión no ofrece la variante (texto "Con 'Sorpresa total' no se difunden obras de la sala: usá 'Inaugura' o 'Invitación'."); con "Adelanto", sólo las 3 sorteadas; una oculta pedida a mano por id → 404.

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- redes`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- Lo de Interfaces. En `piezas-redes.tsx`, el selector de obra lista sólo las visibles; con "cada día", aclarar: "Hoy se ven online estas obras. Mañana pueden ser otras."
- `/privacidad`: dos párrafos. **Pase de sala**: "Cuando escaneás el QR de una ficha en la sala, tu teléfono guarda por 8 horas una cookie que sólo dice qué obras escaneaste en esa muestra y hasta cuándo vale. No te identifica, no la usamos para contar visitas y no la compartimos." **Expositores**: "Si exponés en una muestra, tu perfil (nombre, biografía, foto, ciudad y enlaces) y las fotos que cargues se muestran según lo que elija quien organiza. Las notas para el montaje y el precio de tus obras sólo los ve la organización (el precio también quien escanea el QR de la obra en la sala, si la organización lo permite)."
- `app/panel/page.tsx` (inicio): si la persona expone en alguna muestra, tarjeta "Donde expongo" con las obras con cambios pedidos; si organiza muestras con obras para revisar, tarjeta con el total.

- [ ] **Step 4: Correr**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: en verde (incluido `en-preparacion.test.ts`: "Donde expongo" nace lista).

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: las piezas para redes respetan la sorpresa; privacidad del pase de sala y de los expositores; avisos en el inicio del panel"
```

**Acceptance:** ninguna pieza para redes puede armarse con una obra oculta online.

---

### Task 14: Verificación final, migración en producción, guía y PR

**Files:**
- Modify: `docs/operations/muestras-puesta-en-marcha.md` (sección "Etapa 6")

- [ ] **Step 1: Rebasar y todos los chequeos**

Si las etapas 4 y 5 ya están en `origin/main`: `git fetch origin && git rebase origin/main` (resolver sólo conflictos de esta etapa). Después:

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter @repo/muestras lint && pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice typecheck && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras build`
Expected: todo en verde. Mirar que el build realmente terminó (tabla de rutas con `/expositores/[token]`, `/panel/expositor`, `/panel/expositor/[id]`, `/panel/muestras/[id]/expositores`, `/panel/muestras/[id]/visibilidad`, `/m/[slug]/sala`, `/m/[slug]/sala/o/[workId]` y `/m/[slug]/sala/img/[id]` como **dinámicas** (`ƒ`), y `/m/[slug]`, `/m/[slug]/o/[workId]`, `/fotografos/[slug]` **sin** pasar a dinámicas (siguen con revalidación)). `git diff origin/main -- pnpm-lock.yaml` vacío. `grep -rn "cookies()" apps/muestras/app/m apps/muestras/app/fotografos | grep -v "/sala/"` sin resultados.

- [ ] **Step 2: Aplicar la migración en producción — la hace el controlador (autorizado por Daniel)**

Daniel tiene que autorizar esta migración. Qué hace: suma **una** columna optativa a `CulturalActivity` (sin reescribir la tabla) y crea seis tablas vacías; no modifica ni borra datos. **Requisito: las de las etapas 4 y 5 ya aplicadas** (`select migration_name from "_prisma_migrations" where migration_name like '%muestras_etapa_4%' or migration_name like '%muestras_etapa_5%';` → dos filas). Va **antes** de publicar el código: sin la columna, todo el sitio de Muestras deja de andar. Si algo sale mal (y sólo si el código nuevo **no** está publicado):
```sql
drop table "CulturalExhibitorPhoto", "CulturalExhibitorWork", "CulturalExhibitor", "CulturalExhibitorLink", "CulturalActivityRoomCode", "CulturalActivityRoomKey";
alter table "CulturalActivity" drop column "visibility";
```

1. Correr el contenido de `packages/db/prisma/migrations/20261031120000_muestras_etapa_6_expositores/migration.sql` en la rama `development` (`br-old-rain-adwthzng`) del proyecto `divine-hall-10689679` (Neon MCP `run_sql_transaction`, una sentencia por elemento, sin los comentarios).
2. Verificar:
```sql
select table_name from information_schema.tables
where table_name in ('CulturalExhibitorLink','CulturalExhibitor','CulturalExhibitorWork','CulturalExhibitorPhoto','CulturalActivityRoomCode','CulturalActivityRoomKey') order by table_name;
select column_name, data_type, is_nullable from information_schema.columns
where table_name = 'CulturalActivity' and column_name = 'visibility';
select count(*) from "CulturalActivity" where "visibility" is not null;
select conname from pg_constraint where conname like 'CulturalExhibitor%fkey' or conname like 'CulturalActivityRoom%fkey' order by conname;
```
Expected: las seis tablas; `visibility | jsonb | YES`; `0` (ninguna muestra cambia: todas siguen como antes, D16); siete claves foráneas.
3. Probar los tipos que manda la app, en una transacción que se deshace:
```sql
begin;
insert into "CulturalActivityRoomKey" ("activityId", "secret") select id, repeat('a', 64) from "CulturalActivity" limit 1;
select pg_typeof("secret"), pg_typeof("createdAt") from "CulturalActivityRoomKey" limit 1;
rollback;
```
Expected: `text | timestamp without time zone`.
4. Registrar con el checksum del archivo:

Run: `shasum -a 256 packages/db/prisma/migrations/20261031120000_muestras_etapa_6_expositores/migration.sql`
```sql
insert into "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
values (gen_random_uuid()::text, '<sha256 del paso anterior>', now(), '20261031120000_muestras_etapa_6_expositores', null, null, now(), 1);
```
5. Confirmar: `select migration_name, checksum from "_prisma_migrations" where migration_name = '20261031120000_muestras_etapa_6_expositores';` → una fila con el mismo checksum.

- [ ] **Step 3: Recorrido completo en local contra la base ya migrada**

Con `pnpm --filter muestras dev`, correo apagado, cuentas A (dueña), B (coorganización), C (textos), E1 y E2 (expositores) y una muestra de prueba publicada:
1. A genera el enlace (se guarda "Adelanto"); E1 y E2 se suman desde ventanas privadas, cargan obras con adicionales y las envían; una queda incompleta y no se envía.
2. B aprueba dos, pide cambios en otra; E1 corrige y reenvía; B aprueba. C no ve "Expositores" ni "Visibilidad" (404 por dirección) y edita un título que se ve también en "Donde expongo" de E1.
3. Página pública: "Adelanto" muestra 3 obras y los artistas con sus adicionales; "Sorpresa total" ninguna; "Ver código fuente" no contiene el nombre de archivo de ninguna obra oculta; `/fotografos/<E1>` igual.
4. Fichas: bajar, escanear con el teléfono, ver la vista de sala completa con la compra; compartir la dirección por WhatsApp a otro teléfono: versión pública. Imagen de sala en una ventana privada: 404.
5. "Cortar los accesos de sala" → el teléfono vuelve a la versión pública hasta que escanea de nuevo.
6. Difusión: "Obra destacada" sólo con las visibles.
7. Estadísticas: el escaneo por `/q/s` suma en la obra.
8. A 375 px: `/expositores/<token>`, `/panel/expositor/<id>`, `/panel/muestras/<id>/expositores`, `/panel/muestras/<id>/visibilidad`, `/m/<slug>` con "Artistas" y la vista de sala, sin scroll horizontal.
9. Una muestra vieja sin ajuste se ve exactamente igual que antes.

- [ ] **Step 4: Guía de puesta en marcha**

Agregar al final de `docs/operations/muestras-puesta-en-marcha.md`:
```markdown
## Etapa 6 (expositores por enlace y sorpresa de la muestra)

1. Verificar que las migraciones de las etapas 4 y 5 están aplicadas. — Controlador.
2. Aplicar la migración `20261031120000_muestras_etapa_6_expositores` y registrarla con su SHA-256 (plan de la etapa 6, Task 14 Step 2). — Controlador, autorizado por Daniel. **Antes** del deploy: sin la columna `visibility` se cae todo el sitio de Muestras.
3. Fusionar el PR: Vercel publica `apps/muestras`. No hay variables de entorno nuevas (la llave del pase de sala vive en la base, una por muestra).
4. Apenas se publica, con una muestra de prueba: generar el enlace de expositores, sumarse desde otra cuenta, aprobar una obra, bajar las fichas y escanear un QR con el teléfono: tiene que abrir la vista de sala. Compartir esa dirección a otro teléfono: tiene que mostrar la versión pública.
5. Avisar a quienes organizan que **para el pase de sala hay que imprimir las fichas nuevas** (las anteriores llevan a la versión pública). — Daniel.
6. Con el correo apagado, quien organiza manda el enlace de expositores por WhatsApp o mail, y cada expositor ve en "Donde expongo" si le pidieron cambios. — Daniel.
```

- [ ] **Step 5: Commit y PR**

```bash
git add docs/operations/muestras-puesta-en-marcha.md
git commit -m "Guía de puesta en marcha de la Etapa 6 de Muestras"
git push -u origin feat/muestras-etapa-6
gh pr create --base main --title "Muestras Fotográficas — Etapa 6: expositores por enlace y sorpresa de la muestra" --body "<resumen en español: enlace de expositores (alta con Google y perfil, obras con foto principal y adicionales, datos para ficha y montaje, aprobación por obra); visibilidad por punto de entrada con presets (online, perfil, QR) y sorteo fijo; artistas con biografía y obras no expuestas online; pase de sala de 8 horas por cookie firmada desde /q/s/<código>, vista de sala dinámica con imágenes por proxy y entrada de compra; qué no se filtra y cómo se probó; la migración ya aplicada (requiere las de las etapas 4 y 5); que hay que reimprimir fichas; las preguntas abiertas para Daniel; checklist del Step 3>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```
(Si la etapa 5 todavía no se fusionó, abrir el PR con `--base feat/muestras-etapa-5` y decirlo en la descripción.)

---

## Etapa 6 (expositores por enlace y sorpresa)

Resumen para quien ejecute: Tasks 1–3 son reglas puras (paralelizables); la 4 es la migración (sin aplicar); 5–6 visibilidad pública y su panel; 7–10 expositores (enlace, alta, carga, revisión y editor); 11 fichas, catálogo y plano; 12 pase de sala; 13 difusión, privacidad y panel; 14 verificación, migración en producción y PR. La 12 puede ir antes de la 11 (la 11 imprime el QR que la 12 resuelve; hasta que la 12 esté, `/q/s` lleva a la portada).

## Cobertura del spec

| Spec | Task |
|---|---|
| D1 enlace único reutilizable, token guardado tal cual, renovar, cerrar | 4, 7 |
| D2 aprobación por obra, sin aceptar a la persona | 2, 10 |
| D3 alta con Google, perfil, derechos | 8 |
| D4 obra = principal + adicionales | 2, 4, 9 |
| D5 datos obligatorios y optativos | 2, 9 |
| D6 topes; 40 por muestra al aprobar | 2, 7, 9, 10 |
| D7 estados de la obra del expositor | 2, 9, 10 |
| D8 copia a `CulturalActivityWork`, `activityWorkId` sin FK, `FOR UPDATE`, `canEdit` | 2, 10 |
| D9 convivencia con el editor y el rol de textos | 10 |
| D10 en qué estados anda el enlace | 2, 7, 8 |
| D11 capacidad `exhibitors`; el expositor no es del equipo | 1, 7–10 |
| D12 sin correo, contadores en pantalla | 9, 10, 13 |
| D13 ajuste en JSON, `parseVisibility` | 1, 4 |
| D14 presets y personalizado | 1, 6 |
| D15 sorteo fijo o diario, determinista | 1, 6 |
| D16 legado sin ajuste; "Adelanto" al generar el enlace; `galleryMode` | 1, 6, 7 |
| D17 una sola regla para lo público | 1, 5, 13 |
| D18 sección "Artistas" | 5 |
| D19 perfil público con "Otras obras" | 1, 5 |
| D20 después del cierre | 1, 5 |
| D21 capacidad `visibility`, aviso de portada | 1, 6 |
| D22 pase sólo desde código de sala; `/q/o` sin pase | 3, 11, 12 |
| D23 cookie HMAC, llave por muestra, 8 horas | 3, 4, 12 |
| D24 vista de sala dinámica; sin pase → pública | 12 |
| D25 imágenes por proxy | 12 |
| D26 cortar accesos, cambiar códigos | 12 |
| D27 entrada de compra | 3, 12 |
| D28 escaneos de `/q/s` | 3, 12 |
| D29 panel: Expositores, Visibilidad, Donde expongo | 2, 6, 7, 9, 10 |
| D30 fichas, catálogo y plano con datos del expositor | 11 |
| D31 piezas para redes | 3, 13 |
| D32 convocatoria convive | 10 (sin cambios en la convocatoria) |
| D33 sin dependencias nuevas | todas |
| Migración a mano + checksum, después de las etapas 4 y 5 y antes del deploy | 4, 14 |
| Lista de control de filtraciones | 5, 12, 13, 14 |
