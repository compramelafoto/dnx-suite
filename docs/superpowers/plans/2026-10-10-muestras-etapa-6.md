# Muestras Fotográficas — Etapa 6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que quien organiza una muestra presencial pueda **juntar las obras de sus expositores por un enlace** (cada obra con la foto que se cuelga y todos los datos para ficha, catálogo y plano; aprobación por obra), **sin tope de 40 obras**, y **cuidar la sorpresa**: elegir, por punto de entrada (publicación online, perfil del artista, QR de la sala), qué se ve de las obras expuestas —todas, ninguna, destacadas o N al azar, fijas o distintas para cada visitante—; online se presenta a los artistas con su biografía y su **portfolio** (fotos que no se exponen), y el QR de la ficha da un **pase de sala** de 8 horas que muestra todo, con el botón **"Adquirir obra"**.

**Architecture:** Igual que las etapas 1 a 5: reglas puras en `packages/muestras` con vitest (visibilidad, sorteo determinista y por visita, expositores, portfolio, pase de sala, tandas de PDF) y la app como capa delgada sobre `@repo/db`. Una sola regla de visibilidad (`parseVisibility` + `visibleWorks`/`workAccess`/`profileWorksInActivity`) alimenta todo lo público, que sigue siendo ISR; el modo "para cada visitante" carga la galería desde una ruta dinámica que elige N en el servidor. Lo aprobado de los expositores se copia a `CulturalActivityWork` y la obra del expositor guarda `activityWorkId` sin FK (como la convocatoria). El portfolio cuelga de `PhotographerProfile`. El pase de sala es una cookie HMAC por muestra, emitida sólo por `/q/s/<código>`; la vista de sala es una ruta aparte, dinámica y privada, con imágenes por proxy. Migración escrita a mano: una columna JSON en `CulturalActivity` y seis tablas nuevas.

**Tech Stack:** Next.js 16.2.1 (App Router, `params` como Promise, `cookies()` asíncrono, `--webpack`), React 19.2.4, Prisma 6 (`@repo/db`), Tailwind 4, `sharp 0.34.5`, `pdf-lib 1.17.1`, `qrcode ^1.5.4`, `@aws-sdk/client-s3`, `node:crypto`, vitest 3. **Sin dependencias nuevas.**

**Spec:** `docs/superpowers/specs/2026-10-10-muestras-etapa-6-design.md` (decisiones D1–D41). Diseño general: `docs/superpowers/specs/2026-10-08-muestras-fotograficas-design.md`. Etapa anterior: `docs/superpowers/plans/2026-10-10-muestras-etapa-5.md`.

## Global Constraints

- Todo texto visible y todo comentario en **español rioplatense con voseo**, claro y sin "próximamente"; identificadores en inglés dentro de `packages/muestras`, en español en la app.
- Estados, modos y presets como **texto** (`String`/JSON), nunca enum de Prisma. Ids de usuario `Int` **sin relación Prisma a `User`**. Ids `cuid()`.
- Fechas en **hora argentina** con `dates.ts` (`toArDay`, `dayEndAr`, `formatArDay`…). La fecha límite del enlace es el **fin del día argentino** (`dayEndAr`).
- **Sin dependencias nuevas** ni versiones fuera del lockfile. Después de cualquier `pnpm install`, `git diff pnpm-lock.yaml` vacío; si se mueve, frenar y avisar.
- Chequeos de tipos y build con `NODE_OPTIONS=--max-old-space-size=8192` y mirar que realmente terminaron.
- Diseño: tokens de `apps/muestras/app/globals.css`, `.mf-titulo`, líneas finas, botones finos (`h-11 border border-[var(--mf-ink)] px-5`), `rounded-[2px]`. Clases repetidas en `components/expositores/estilos.ts`, `components/visibilidad/estilos.ts` y `components/perfil/estilos.ts` (pueden reexportar `components/montaje/estilos.ts`).
- **Autorización del lado del servidor en cada página, acción y ruta.** Cada `page.tsx` del panel llama `requireUsuario(<su propia ruta>)`; cada acción vuelve a leer la sesión y el permiso **en la base**: `rolEnMuestra` + `puede(usuario, "exhibitors" | "visibility", rol)` o `dondePuede(...)` para la organización; la fila `CulturalExhibitor` propia (`userId = usuario.id`, `status = "ACTIVE"`) para el expositor; el perfil propio (`PhotographerProfile.userId = usuario.id`) para el portfolio. Toda negativa del panel es `notFound()`. Ninguna comprobación nueva usa `proposedByUserId` directamente.
- **Ninguna página pública lee cookies** (siguen siendo ISR con `revalidate = 300`). Sólo la vista de sala (`/m/[slug]/sala/**`) y `/q` tocan la cookie del pase; sólo `/api/m/[slug]/anticipo` sortea por pedido.
- **Ninguna URL del bucket de una obra oculta** puede llegar a HTML, a las props de un componente cliente, a metadatos ni a piezas públicas. Los tests de las Tasks 6 y 14 lo verifican.
- **El precio de una obra nunca se muestra en público ni en piezas** en esta etapa (sólo lo ve la organización).
- **Correo apagado en producción**: nada de esta etapa manda correos; todo se ve en pantalla.
- En páginas públicas **no** aparecen palabras de revisión ni aprobación.
- Puerto de desarrollo **3014**. Probar con `next dev` (las vistas previas de Vercel no sirven).
- Trabajar en el worktree `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-muestras-6`, rama `feat/muestras-etapa-6` (sale de `feat/muestras-etapa-5`, que sale de `feat/muestras-etapa-4`; ninguna fusionada). **Antes de la Task 15, rebasar sobre `origin/main`** si las anteriores ya se fusionaron.
- La migración **no se aplica sola**: la aplica **a mano en producción el controlador**, con la autorización de Daniel, **después** de las de las etapas 4 y 5 y **antes** de publicar el código, y la registra en `_prisma_migrations` con el SHA-256 del archivo (Task 15). La columna nueva de `CulturalActivity` sin aplicar rompe **todo** el sitio.

## Mapa de archivos

```
packages/muestras/src/
  visibility.ts (+ visibility.test.ts)       — ajuste, presets, parse, sorteo fijo/diario, por visita, sala, resumen, portada
  gallery.ts, work-access.ts, profile.ts (+ tests) — leen `visibility`
  exhibitors.ts (+ exhibitors.test.ts)       — enlace, alta, datos de obra, estados, textos, copia a la muestra
  portfolio.ts (+ portfolio.test.ts)         — tope, validación, vista previa
  room.ts (+ room.test.ts)                   — código de sala, pase (sin firma), vigencia, estado de venta
  constants.ts, validation.ts, curation.ts (+ tests) — MAX_WORKS = 300
  print.ts (+ print.test.ts)                 — tandas de marcos, tamaño de imagen del catálogo
  team.ts, stats.ts, social.ts, panel.ts (+ tests)
  index.ts                                   — reexporta visibility, exhibitors, portfolio, room
packages/db/prisma/schema.prisma             — `CulturalActivity.visibility`; 6 modelos nuevos
packages/db/prisma/migrations/20261031120000_muestras_etapa_6_expositores/migration.sql
apps/muestras/
  lib/actividades/{consultas.ts, acciones.ts, textos.ts, mapear.ts, artistas.ts} (+ tests)
  lib/seleccion/acciones.ts, lib/portada/funciones.ts, lib/limite.ts (+ tests) — sin "40"
  lib/piezas/{opciones.ts, armar.ts, catalogo.ts, cargar.ts} (+ tests), app/api/piezas/[id]/[pieza]/route.ts
  lib/perfiles/{consultas.ts, acciones.ts}, lib/portfolio/{acciones.ts, consultas.ts, mapear.ts} (+ tests)
  lib/visibilidad/{acciones.ts, consultas.ts, mapear.ts} (+ tests)
  lib/anticipo/elegir.ts (+ tests), app/api/m/[slug]/anticipo/route.ts
  lib/expositores/{enlace.ts, alta.ts, obras.ts, revision.ts, consultas.ts, mapear.ts} (+ tests)
  lib/sala/{llave.ts, codigos.ts, consultas.ts, acciones.ts} (+ tests)
  lib/estadisticas/qr.ts, lib/fichas/{texto.ts, cargar.ts, pdf.ts}, lib/redes/cargar.ts (+ tests)
  app/q/[tipo]/[id]/route.ts
  app/m/[slug]/page.tsx, app/m/[slug]/o/[workId]/page.tsx, app/fotografos/[slug]/page.tsx
  app/m/[slug]/sala/page.tsx, sala/o/[workId]/page.tsx, sala/o/[workId]/adquirir/page.tsx, sala/img/[id]/route.ts
  app/expositores/[token]/page.tsx
  app/panel/expositor/page.tsx, app/panel/expositor/[id]/page.tsx, app/panel/perfil/page.tsx
  app/panel/muestras/[id]/expositores/page.tsx, app/panel/muestras/[id]/visibilidad/page.tsx
  app/panel/muestras/[id]/page.tsx, app/panel/muestras/page.tsx, app/panel/montaje/[id]/page.tsx, app/panel/page.tsx
  app/privacidad/page.tsx
  components/ficha/{galeria.tsx, galeria-rotativa.tsx, artistas.tsx, fotos-portfolio.tsx}
  components/sala/{obra-de-sala.tsx, boton-adquirir.tsx}
  components/perfil/{portfolio.tsx, estilos.ts}
  components/expositores/{alta-expositor.tsx, obras-expositor.tsx, obra-expositor.tsx, enlace-expositores.tsx, revision-expositores.tsx, estilos.ts}
  components/visibilidad/{ajuste-visibilidad.tsx, estilos.ts}
  components/formulario/{formulario-actividad.tsx, obras.tsx}
  components/montaje/{descargar-marcos.tsx, editor-montaje.tsx}
docs/operations/muestras-puesta-en-marcha.md — sección "Etapa 6"
```

Orden: 1 → 2 → 3 → 4 (schema) → 5 → … → 15. Las Tasks 1–3 son independientes entre sí (reglas puras). Desde la Task 4 todo usa el cliente Prisma nuevo. La 5 (sin tope de 40) va primero porque toca validaciones que usan las demás. 6 → 7 (visibilidad pública y su panel); la 6 funciona con el portfolio vacío, así que la 8 puede ir antes o después; 9 → 10 → 11 → 12 (expositores); 13 (fichas) y 14 (pase) después de la 12, en cualquier orden (hasta la 14, `/q/s` lleva a la portada). Los tests de la app mockean `@repo/db`, `@/lib/usuario`, `next/cache`, `next/headers` y R2 con el mismo patrón que `lib/montaje/acciones.test.ts` y `lib/estadisticas/qr-ruta.test.ts`.

---

### Task 1: Reglas de visibilidad — ajuste, presets, sorteo fijo o por visitante y punto de entrada

**Files:**
- Create: `packages/muestras/src/visibility.ts`, `packages/muestras/src/visibility.test.ts`
- Modify: `packages/muestras/src/gallery.ts` (+ `gallery.test.ts`), `packages/muestras/src/work-access.ts` (+ `work-access.test.ts`), `packages/muestras/src/profile.ts` (+ `profile.test.ts`), `packages/muestras/src/team.ts` (+ `team.test.ts`), `packages/muestras/src/index.ts`

**Interfaces:**
- Consumes: `stableHash` (`curation.ts`), `toArDay`, `temporalStatus` (`dates.ts`), `MAX_HIGHLIGHTS` (`constants.ts`), `sameName` (`profile.ts`; si aparece un ciclo de imports, moverla a `names.ts` y reexportarla desde `profile.ts`).
- Produces (`visibility.ts`):
  - `ONLINE_EXHIBITED = ["ALL","HIGHLIGHTS","RANDOM","NONE"]`, `RANDOM_ROTATIONS = ["FIXED","DAILY","PER_VISIT"]`, `PROFILE_EXHIBITED = ["LIKE_ONLINE","NONE"]`, `ROOM_EXHIBITED = ["SCANNED","ARTIST","ALL"]`, `VISIBILITY_PRESETS = ["PREVIEW","SURPRISE","HIGHLIGHTS","OPEN","CUSTOM"]` y sus tipos; `VISIBILITY_PRESET_LABELS`, `VISIBILITY_PRESET_DESCRIPTIONS`, `ONLINE_EXHIBITED_LABELS`, `RANDOM_ROTATION_LABELS` ("Siempre las mismas", "Cambian cada día", "Cambian para cada visitante"), `ROOM_EXHIBITED_LABELS`.
  - `type Visibility = { v: 1; preset; online: { exhibited; randomCount; rotation; seed; artists }; profile: { exhibited }; room: { exhibited; portfolio; otherExhibitions; buy }; revealAfterClose: boolean }`.
  - `DEFAULT_RANDOM_COUNT = 3`; `randomCount` entero ≥ 1, sin tope propio (si es ≥ que las obras, se ven todas).
  - `visibilityFromPreset(preset, seed)`, `presetOf(v)`, `parseVisibility(json, galleryMode)`.
  - `onlineExhibitedWorks(v, a, works, now): { mode: "STATIC"; works; isPartial; hiddenCount } | { mode: "PER_VISIT"; count; total }` — en `PER_VISIT` (muestra no revelada) **no devuelve obras**: quien arma la página no tiene nada que mandar al navegador.
  - `pickPerVisit(works, n, randomInt: (max: number) => number)` (Fisher–Yates parcial con el azar que pasa la app; devuelve en el orden de la galería).
  - `roomExhibitedWorks(v, works, scannedIds)`, `visibilitySummary(v)`, `coverIsHiddenWork(cover, works, shownIds)`.
  - `gallery.ts`: `visibleWorks(a: { galleryMode; visibility?; startsAt; endsAt }, works, now): { works; isPartial; hiddenCount; perVisit: null | { count; total } }`.
  - `work-access.ts`: en `PER_VISIT` no revelada, toda obra expuesta es `TEASER`.
  - `profile.ts`: `profileWorksInActivity` mira `profile.exhibited`; en `PER_VISIT`, `visible = []`.
  - `team.ts`: `CAPABILITIES` suma `"exhibitors"`, `"visibility"`; `CO_ORGANIZER` las tiene; `TEXT_EDITOR` no.

- [ ] **Step 1: Escribir los tests que fallan**

`packages/muestras/src/visibility.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  coverIsHiddenWork, onlineExhibitedWorks, parseVisibility, pickPerVisit, presetOf, roomExhibitedWorks,
  visibilityFromPreset, visibilitySummary, type Visibility,
} from "./visibility";

const abierta = { startsAt: new Date("2026-11-01T03:00:00Z"), endsAt: new Date("2026-11-30T02:59:59.999Z") };
const durante = new Date("2026-11-10T15:00:00Z");
const despues = new Date("2026-12-05T15:00:00Z");
const obras = Array.from({ length: 20 }, (_, i) => ({ id: `w${i}`, isHighlight: i < 2, sortOrder: i }));
const ids = (ws: { id: string }[]) => ws.map((w) => w.id);
const estaticas = (r: ReturnType<typeof onlineExhibitedWorks>) => {
  if (r.mode !== "STATIC") throw new Error("esperaba STATIC");
  return r;
};

describe("ajuste guardado o de legado", () => {
  it("vacío: como hasta hoy según galleryMode", () => {
    expect(parseVisibility(null, "HIGHLIGHTS_UNTIL_CLOSED").online.exhibited).toBe("HIGHLIGHTS");
    expect(parseVisibility(null, "FULL").online.exhibited).toBe("ALL");
    expect(presetOf(parseVisibility(null, "FULL"))).toBe("OPEN");
  });
  it("roto o con valores desconocidos: completa con lo seguro", () => {
    const v = parseVisibility({ v: 1, online: { exhibited: "TODO", randomCount: -3, rotation: "X" }, room: "x" }, "HIGHLIGHTS_UNTIL_CLOSED");
    expect(v.online.exhibited).toBe("HIGHLIGHTS");
    expect(v.online.randomCount).toBe(3);
    expect(v.online.rotation).toBe("FIXED");
    expect(v.room.exhibited).toBe("ARTIST");
    expect(v.revealAfterClose).toBe(true);
  });
  it("lo guardado se respeta (también una cantidad grande y por visitante)", () => {
    const b = visibilityFromPreset("PREVIEW", "s");
    const g: Visibility = { ...b, preset: "CUSTOM", online: { ...b.online, randomCount: 80, rotation: "PER_VISIT" } };
    expect(parseVisibility(JSON.parse(JSON.stringify(g)), "FULL")).toEqual(g);
  });
});

describe("presets", () => {
  it("Adelanto (la sugerencia): 3 al azar, siempre las mismas", () => {
    const v = visibilityFromPreset("PREVIEW", "s");
    expect(v.online).toMatchObject({ exhibited: "RANDOM", randomCount: 3, rotation: "FIXED", artists: true });
    expect(v.profile).toEqual({ exhibited: "LIKE_ONLINE" });
    expect(v.room).toEqual({ exhibited: "ARTIST", portfolio: true, otherExhibitions: true, buy: true });
  });
  it("tocar una opción lo vuelve personalizado", () => {
    const v = visibilityFromPreset("PREVIEW", "s");
    expect(presetOf(v)).toBe("PREVIEW");
    expect(presetOf({ ...v, online: { ...v.online, rotation: "PER_VISIT" } })).toBe("CUSTOM");
  });
});

describe("obras expuestas online", () => {
  const con = (p: Partial<Visibility["online"]>, extra: Partial<Visibility> = {}) => {
    const b = visibilityFromPreset("PREVIEW", "semilla-1");
    return { ...b, ...extra, online: { ...b.online, ...p } };
  };
  it("todas, ninguna, destacadas", () => {
    expect(estaticas(onlineExhibitedWorks(con({ exhibited: "ALL" }), abierta, obras, durante)).works).toHaveLength(20);
    expect(onlineExhibitedWorks(con({ exhibited: "NONE" }), abierta, obras, durante)).toMatchObject({ mode: "STATIC", works: [], hiddenCount: 20 });
    expect(ids(estaticas(onlineExhibitedWorks(con({ exhibited: "HIGHLIGHTS" }), abierta, obras, durante)).works)).toEqual(["w0", "w1"]);
  });
  it("siempre las mismas: N obras, iguales en otro momento y con otro orden de entrada", () => {
    const v = con({ exhibited: "RANDOM", randomCount: 3, rotation: "FIXED" });
    const a = estaticas(onlineExhibitedWorks(v, abierta, obras, durante));
    const b = estaticas(onlineExhibitedWorks(v, abierta, [...obras].reverse(), new Date("2026-11-20T15:00:00Z")));
    expect(a.works).toHaveLength(3);
    expect(ids(a.works)).toEqual(ids(b.works));
  });
  it("otra semilla, otro sorteo", () => {
    const a = estaticas(onlineExhibitedWorks(con({ exhibited: "RANDOM", seed: "uno" }), abierta, obras, durante));
    const b = estaticas(onlineExhibitedWorks(con({ exhibited: "RANDOM", seed: "dos" }), abierta, obras, durante));
    expect(ids(a.works)).not.toEqual(ids(b.works));
  });
  it("cada día: igual dentro del día argentino, cambia entre días", () => {
    const v = con({ exhibited: "RANDOM", rotation: "DAILY" });
    const manana = estaticas(onlineExhibitedWorks(v, abierta, obras, new Date("2026-11-10T12:00:00Z")));
    const noche = estaticas(onlineExhibitedWorks(v, abierta, obras, new Date("2026-11-11T02:30:00Z")));
    expect(ids(manana.works)).toEqual(ids(noche.works));
    const dias = new Set(Array.from({ length: 10 }, (_, i) =>
      ids(estaticas(onlineExhibitedWorks(v, abierta, obras, new Date(Date.UTC(2026, 10, 10 + i, 15)))).works).join()));
    expect(dias.size).toBeGreaterThan(1);
  });
  it("para cada visitante: no devuelve obras, sólo cuántas", () => {
    const r = onlineExhibitedWorks(con({ exhibited: "RANDOM", rotation: "PER_VISIT", randomCount: 5 }), abierta, obras, durante);
    expect(r).toEqual({ mode: "PER_VISIT", count: 5, total: 20 });
  });
  it("una cantidad mayor que las obras es 'todas'", () => {
    expect(onlineExhibitedWorks(con({ exhibited: "RANDOM", randomCount: 50, rotation: "PER_VISIT" }), abierta, obras, durante)).toMatchObject({ mode: "STATIC", isPartial: false });
  });
  it("después del cierre: todo, salvo que se mantenga la reserva", () => {
    expect(estaticas(onlineExhibitedWorks(con({ exhibited: "RANDOM", rotation: "PER_VISIT" }), abierta, obras, despues)).works).toHaveLength(20);
    expect(estaticas(onlineExhibitedWorks(con({ exhibited: "NONE" }, { revealAfterClose: false }), abierta, obras, despues)).works).toHaveLength(0);
  });
});

describe("elegir para cada visitante", () => {
  it("N distintas, en el orden de la galería, con el azar que pasa la app", () => {
    let k = 0;
    const secuencia = [7, 0, 12, 3, 3, 1];
    const r = pickPerVisit(obras, 4, (max) => secuencia[k++]! % max);
    expect(r).toHaveLength(4);
    expect(new Set(ids(r)).size).toBe(4);
    expect(r.map((w) => w.sortOrder)).toEqual([...r.map((w) => w.sortOrder)].sort((x, y) => x - y));
  });
  it("con el azar real, a la larga salen todas (lo que avisa el panel)", () => {
    const vistas = new Set<string>();
    for (let i = 0; i < 200; i++) for (const w of pickPerVisit(obras, 3, (m) => Math.floor(Math.random() * m))) vistas.add(w.id);
    expect(vistas.size).toBe(20);
  });
});

describe("QR de la sala", () => {
  const ws = [
    { id: "a1", sortOrder: 0, authorProfileId: "pA", authorName: "Ana" },
    { id: "a2", sortOrder: 1, authorProfileId: "pA", authorName: "Ana" },
    { id: "b1", sortOrder: 2, authorProfileId: null, authorName: "Beto" },
    { id: "b2", sortOrder: 3, authorProfileId: null, authorName: " beto " },
    { id: "c1", sortOrder: 4, authorProfileId: "pC", authorName: "Ceci" },
  ];
  const sala = (exhibited: Visibility["room"]["exhibited"]) => {
    const b = visibilityFromPreset("PREVIEW", "s");
    return { ...b, room: { ...b.room, exhibited } };
  };
  it("la escaneada, las del mismo artista (por perfil o por nombre), toda la muestra", () => {
    expect(ids(roomExhibitedWorks(sala("SCANNED"), ws, ["a1"]))).toEqual(["a1"]);
    expect(ids(roomExhibitedWorks(sala("ARTIST"), ws, ["a1"]))).toEqual(["a1", "a2"]);
    expect(ids(roomExhibitedWorks(sala("ARTIST"), ws, ["b1"]))).toEqual(["b1", "b2"]);
    expect(roomExhibitedWorks(sala("ALL"), ws, ["c1"])).toHaveLength(5);
  });
  it("un id escaneado que ya no está en la muestra no abre nada", () => {
    expect(roomExhibitedWorks(sala("ALL"), ws, ["zz"])).toEqual([]);
  });
});

describe("textos y portada", () => {
  it("resumen de qué ve cada uno", () => {
    const v = visibilityFromPreset("PREVIEW", "s");
    expect(visibilitySummary(v).online).toBe("La publicación online muestra 3 obras de la sala elegidas al azar (siempre las mismas) y presenta a los artistas con su biografía y su portfolio.");
    expect(visibilitySummary({ ...v, online: { ...v.online, rotation: "PER_VISIT" } }).online)
      .toBe("La publicación online muestra 3 obras de la sala elegidas al azar, distintas para cada visitante, y presenta a los artistas con su biografía y su portfolio.");
    expect(visibilitySummary(v).room).toBe("Quien escanea el QR de una ficha ve esa obra y las demás del mismo artista, su portfolio, las otras muestras donde expuso y el botón para adquirir la obra.");
  });
  it("portada que es una obra reservada", () => {
    expect(coverIsHiddenWork("https://r2/x.webp", [{ id: "w1", imageUrl: "https://r2/x.webp" }], new Set())).toBe(true);
    expect(coverIsHiddenWork("https://r2/x.webp", [{ id: "w1", imageUrl: "https://r2/x.webp" }], new Set(["w1"]))).toBe(false);
  });
});
```

Sumar a `gallery.test.ts`, `work-access.test.ts` y `profile.test.ts`: con "Sorpresa total" (galería vacía, `TEASER`, perfil sin obras); con `PER_VISIT` (`visibleWorks` → `works: []`, `perVisit: { count, total }`; `workAccess` → `TEASER`; perfil sin obras); con `profile.exhibited = "NONE"` y online `ALL` (perfil sin expuestas, galería completa). Los tests existentes siguen pasando sin `visibility`.

Sumar a `team.test.ts`: `exhibitors` y `visibility` para dueño y coorganización, no para textos (ajustar el test "coorganización: todo menos…").

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
 * cada persona. Es la única regla que interpreta `CulturalActivity.visibility`.
 */
export const ONLINE_EXHIBITED = ["ALL", "HIGHLIGHTS", "RANDOM", "NONE"] as const;
export const RANDOM_ROTATIONS = ["FIXED", "DAILY", "PER_VISIT"] as const;
// …PROFILE_EXHIBITED, ROOM_EXHIBITED, VISIBILITY_PRESETS, tipos, `is…` y etiquetas:
export const VISIBILITY_PRESET_DESCRIPTIONS = {
  PREVIEW: "Online se ven unas pocas obras de la sala elegidas al azar. Los artistas se presentan con su biografía y su portfolio.",
  SURPRISE: "Online no se ve ninguna obra de la sala: sólo los artistas y su portfolio. Todo se descubre en la sala.",
  HIGHLIGHTS: "Online se ven las obras que marques como destacadas, hasta que cierra la muestra.",
  OPEN: "Online se ven todas las obras de la sala.",
  CUSTOM: "Elegís cada opción.",
} as const;
export const DEFAULT_RANDOM_COUNT = 3;

export function visibilityFromPreset(preset: Exclude<VisibilityPreset, "CUSTOM">, seed: string): Visibility {
  const exhibited = ({ PREVIEW: "RANDOM", SURPRISE: "NONE", HIGHLIGHTS: "HIGHLIGHTS", OPEN: "ALL" } as const)[preset];
  return {
    v: 1, preset,
    online: { exhibited, randomCount: DEFAULT_RANDOM_COUNT, rotation: "FIXED", seed, artists: true },
    profile: { exhibited: "LIKE_ONLINE" },
    room: { exhibited: "ARTIST", portfolio: true, otherExhibitions: true, buy: true },
    revealAfterClose: true,
  };
}

/** Siempre devuelve un ajuste completo. Vacío → legado (spec D24). */
export function parseVisibility(json: unknown, galleryMode: string): Visibility {
  /* campo por campo con `is…`; randomCount entero ≥ 1 (si no, 3); seed texto 1–64 (si no, "legado");
     un bloque que no es objeto se reemplaza por el del legado; `preset` se recalcula con `presetOf`. */
}

function sorteo<W extends { id: string }>(works: readonly W[], seed: string, day: string | null): W[] {
  const clave = (id: string) => stableHash(`muestras-sorpresa:v1:${seed}:${day ?? ""}:${id}`);
  return [...works].sort((a, b) => (clave(a.id) < clave(b.id) ? -1 : clave(a.id) > clave(b.id) ? 1 : 0));
}

export function onlineExhibitedWorks<W extends { id: string; isHighlight: boolean; sortOrder: number }>(
  v: Visibility, a: { startsAt: Date; endsAt: Date }, works: readonly W[], now: Date,
) {
  const ordered = [...works].sort((x, y) => x.sortOrder - y.sortOrder);
  const todo = { mode: "STATIC" as const, works: ordered, isPartial: false, hiddenCount: 0 };
  if (temporalStatus(a, now) === "CLOSED" && v.revealAfterClose) return todo;
  const estatico = (shown: W[]) =>
    ({ mode: "STATIC" as const, works: shown, isPartial: shown.length < ordered.length, hiddenCount: ordered.length - shown.length });
  switch (v.online.exhibited) {
    case "ALL": return todo;
    case "NONE": return estatico([]);
    case "HIGHLIGHTS": {
      const h = ordered.filter((w) => w.isHighlight);
      return estatico((h.length > 0 ? h : ordered).slice(0, MAX_HIGHLIGHTS));
    }
    case "RANDOM": {
      if (v.online.randomCount >= ordered.length) return todo;
      if (v.online.rotation === "PER_VISIT") return { mode: "PER_VISIT" as const, count: v.online.randomCount, total: ordered.length };
      const dia = v.online.rotation === "DAILY" ? toArDay(now) : null;
      const elegidas = new Set(sorteo(ordered, v.online.seed, dia).slice(0, v.online.randomCount).map((w) => w.id));
      return estatico(ordered.filter((w) => elegidas.has(w.id)));
    }
  }
}

/** N obras distintas con el azar que pasa la app (`crypto.randomInt`), en el orden de la galería. */
export function pickPerVisit<W extends { sortOrder: number }>(works: readonly W[], n: number, randomInt: (max: number) => number): W[] {
  const pool = [...works];
  const k = Math.min(n, pool.length);
  for (let i = 0; i < k; i++) {
    const j = i + randomInt(pool.length - i);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, k).sort((x, y) => x.sortOrder - y.sortOrder);
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
```
`gallery.ts`:
```ts
/**
 * Qué obras expuestas ve el público online. Desde la etapa 6 lo decide el ajuste de sorpresa
 * (`visibility`). En "para cada visitante" no devuelve obras: las trae `/api/m/<slug>/anticipo`.
 */
export function visibleWorks<W extends { id: string; isHighlight: boolean; sortOrder: number }>(
  a: { galleryMode: string; visibility?: unknown; startsAt: Date; endsAt: Date }, works: W[], now: Date,
) {
  const r = onlineExhibitedWorks(parseVisibility(a.visibility ?? null, a.galleryMode), a, works, now);
  if (r.mode === "PER_VISIT") return { works: [] as W[], isPartial: true, hiddenCount: r.total, perVisit: { count: r.count, total: r.total } };
  return { works: r.works, isPartial: r.isPartial, hiddenCount: r.hiddenCount, perVisit: null };
}
```
`profile.ts`, `work-access.ts`, `team.ts` e `index.ts` como dicen las interfaces.

- [ ] **Step 4: Correr**

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter @repo/muestras lint`
Expected: todo en verde.

- [ ] **Step 5: Commit**

```bash
git add packages/muestras
git commit -m "Muestras: regla única de visibilidad por punto de entrada, con sorteo fijo, diario o distinto para cada visitante"
```

**Acceptance:** sin `visibility`, `visibleWorks` devuelve lo mismo que antes; en `PER_VISIT` la regla nunca devuelve obras a quien arma la página.

---

### Task 2: Reglas de expositores y del portfolio

**Files:**
- Create: `packages/muestras/src/exhibitors.ts` (+ `exhibitors.test.ts`), `packages/muestras/src/portfolio.ts` (+ `portfolio.test.ts`)
- Modify: `packages/muestras/src/panel.ts` (+ `panel.test.ts`), `packages/muestras/src/index.ts`

**Interfaces:**
- Consumes: `temporalStatus`, `dayEndAr` (`dates.ts`), `formatCm` y `HANGING_LIMITS.frame` (5–300 cm, `hanging.ts`).
- Produces (`exhibitors.ts`):
  - `EXHIBITOR_LIMITS = { worksPerExhibitor: [1, 300], exhibitors: [1, 300] }`, `SUGGESTED_WORKS_PER_EXHIBITOR = 3`, `EXHIBITOR_TEXT_LIMITS = { displayName: 120, title: 160, technique: 160, statement: 800, hangingNotes: 300, instructions: 1500, reviewNote: 600 }`, `EDITION_SIZE_MAX = 999`, `PRICE_MAX_ARS = 100_000_000`.
  - `EDITIONS`, `EDITION_LABELS`; `EXHIBITOR_WORK_STATUSES`, `EXHIBITOR_WORK_STATUS_LABELS` (para quien expone), `EXHIBITOR_WORK_STATUS_LABELS_ORGANIZER`.
  - `exhibitorLinkState(link, activity, now)`; `exhibitorJoinProblems(p)` (`maxExhibitors: number | null`); `exhibitorCountProblem({ current, max: number | null })`; `exhibitorWorkProblems(w, { forSubmit })`; `exhibitorWorkTransition(action, status, ctx)`; `editionText`, `sizeText`, `fichaDetail`; `toActivityWork(ew, exhibitor, sortOrder)`; `pendingReviewCount(rows)`.
- Produces (`portfolio.ts`): `PORTFOLIO_MAX_PHOTOS = 60`, `PORTFOLIO_PREVIEW = 8`, `PORTFOLIO_TEXT_LIMITS = { title: 160, technique: 160, caption: 300 }`, `portfolioPhotoProblems(p: { imageUrl; title; year; exhibitedUrls: ReadonlySet<string>; count; isNew })`, `portfolioPreview(photos)`.
- `panel.ts`: sección `s("expositor", "Donde expongo", "/panel/expositor", "CUENTA")` después de "Mis envíos".

- [ ] **Step 1: Escribir los tests que fallan**

`packages/muestras/src/exhibitors.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  editionText, exhibitorCountProblem, exhibitorJoinProblems, exhibitorLinkState, exhibitorWorkProblems,
  exhibitorWorkTransition, fichaDetail, sizeText, toActivityWork,
} from "./exhibitors";

const muestra = { type: "MUESTRA", reviewStatus: "DRAFT", isCancelled: false,
  startsAt: new Date("2026-11-01T03:00:00Z"), endsAt: new Date("2026-11-30T02:59:59.999Z") };
const enlace = { status: "OPEN", closesAt: null as Date | null };
const hoy = new Date("2026-10-20T15:00:00Z");

describe("estado del enlace", () => {
  it("abierto en borrador, rechazada, revisión, publicada y despublicada", () => {
    for (const reviewStatus of ["DRAFT", "REJECTED", "IN_REVIEW", "APPROVED", "UNPUBLISHED"]) {
      expect(exhibitorLinkState(enlace, { ...muestra, reviewStatus }, hoy), reviewStatus).toBe("OPEN");
    }
  });
  it("cerrado, vencido, cancelada, terminada o no es muestra", () => {
    expect(exhibitorLinkState({ ...enlace, status: "CLOSED" }, muestra, hoy)).toBe("CLOSED");
    expect(exhibitorLinkState({ ...enlace, closesAt: new Date("2026-10-19T02:59:59.999Z") }, muestra, hoy)).toBe("EXPIRED");
    expect(exhibitorLinkState(enlace, { ...muestra, isCancelled: true }, hoy)).toBe("UNAVAILABLE");
    expect(exhibitorLinkState(enlace, muestra, new Date("2026-12-01T15:00:00Z"))).toBe("UNAVAILABLE");
    expect(exhibitorLinkState(enlace, { ...muestra, type: "CHARLA" }, hoy)).toBe("UNAVAILABLE");
    expect(exhibitorLinkState(null, muestra, hoy)).toBe("UNAVAILABLE");
  });
});

describe("sumarse", () => {
  const base = { state: "OPEN" as const, exhibitors: 3, maxExhibitors: null as number | null, displayName: "Ana Pérez", rightsAccepted: true };
  it("sin tope de expositores, todo bien", () => expect(exhibitorJoinProblems({ ...base, exhibitors: 250 })).toEqual([]));
  it("motivos", () => {
    expect(exhibitorJoinProblems({ ...base, state: "CLOSED" })).toEqual(["Este enlace ya no recibe expositores. Escribile a quien organiza."]);
    expect(exhibitorJoinProblems({ ...base, maxExhibitors: 3 })).toEqual(["Ya se sumaron todas las personas que esta muestra espera. Escribile a quien organiza."]);
    expect(exhibitorJoinProblems({ ...base, displayName: " " })).toEqual(["Escribí cómo firmás tus obras."]);
    expect(exhibitorJoinProblems({ ...base, rightsAccepted: false })).toEqual(["Para sumarte tenés que confirmar que sos autor/a y aceptar cómo se muestran tus obras."]);
  });
});

describe("cuántas obras", () => {
  it("tope optativo por expositor", () => {
    expect(exhibitorCountProblem({ current: 10, max: null })).toBeNull();
    expect(exhibitorCountProblem({ current: 3, max: 3 })).toBe("Podés cargar hasta 3 obras en esta muestra.");
    expect(exhibitorCountProblem({ current: 0, max: 1 })).toBeNull();
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
    expect(exhibitorWorkTransition("edit", "APPROVED", {})).toMatchObject({ ok: false, reason: "La obra ya está en la muestra. Si hay que cambiar algo, pedíselo a quien organiza." });
    expect(exhibitorWorkTransition("approve", "SUBMITTED", { activityEditable: false })).toMatchObject({ ok: false, reason: "La muestra está en revisión: esperá a que se revise para sumar obras." });
    expect(exhibitorWorkTransition("approve", "DRAFT", {})).toMatchObject({ ok: false });
  });
});

describe("textos y copia a la muestra", () => {
  const w = { title: "Río quieto", year: 2024, technique: "Giclée", imageWidthCm: 40, imageHeightCm: 60.5, edition: "LIMITED", editionNumber: 2, editionSize: 10, imageUrl: "u" };
  it("edición, medidas y ficha", () => {
    expect(editionText(w)).toBe("Edición 2/10");
    expect(editionText({ ...w, edition: "UNIQUE" })).toBe("Pieza única");
    expect(editionText({ ...w, edition: "NA" })).toBeNull();
    expect(sizeText(w)).toBe("40 × 60,5 cm");
    expect(fichaDetail(w)).toBe("2024. Giclée. 40 × 60,5 cm. Edición 2/10");
  });
  it("lo que se copia a CulturalActivityWork (nunca el precio)", () => {
    expect(toActivityWork({ ...w, priceArs: 9 }, { userId: 7, profileId: "p7", displayName: "Ana Pérez" }, 12)).toEqual({
      imageUrl: "u", title: "Río quieto", authorName: "Ana Pérez", authorUserId: 7, authorProfileId: "p7",
      year: 2024, technique: "Giclée", isHighlight: false, sortOrder: 12,
    });
  });
});
```

`packages/muestras/src/portfolio.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { portfolioPhotoProblems, portfolioPreview } from "./portfolio";

const base = { imageUrl: "https://r2/muestras/7/p.webp", title: "Niebla", year: 2023, exhibitedUrls: new Set<string>(), count: 0, isNew: true };

describe("foto del portfolio", () => {
  it("todo bien", () => expect(portfolioPhotoProblems(base)).toEqual([]));
  it("título obligatorio, año razonable, tope de 60 al sumar", () => {
    expect(portfolioPhotoProblems({ ...base, title: " " })).toEqual(["Cada foto del portfolio necesita un título."]);
    expect(portfolioPhotoProblems({ ...base, year: 1700 })).toEqual(["Revisá el año."]);
    expect(portfolioPhotoProblems({ ...base, count: 60 })).toEqual(["El portfolio admite hasta 60 fotos."]);
    expect(portfolioPhotoProblems({ ...base, count: 60, isNew: false })).toEqual([]);
  });
  it("una obra expuesta no puede ir al portfolio", () => {
    expect(portfolioPhotoProblems({ ...base, exhibitedUrls: new Set([base.imageUrl]) }))
      .toEqual(["Esa foto es una obra que expusiste o vas a exponer: no la sumes al portfolio, así sigue siendo sorpresa en la sala."]);
  });
  it("vista previa: las primeras 8 en orden", () => {
    const fotos = Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, sortOrder: 9 - i }));
    expect(portfolioPreview(fotos).map((f) => f.id)).toEqual(["f9", "f8", "f7", "f6", "f5", "f4", "f3", "f2"]);
  });
});
```
Sumar a `panel.test.ts`: "Donde expongo" lista, en "Tu cuenta".

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter @repo/muestras test -- exhibitors portfolio panel`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Reglas además de los tests:
- `exhibitorLinkState`: `UNAVAILABLE` sin enlace, si no es `MUESTRA`, cancelada o `temporalStatus(a, now) === "CLOSED"`; `CLOSED` si `status !== "OPEN"`; `EXPIRED` si `closesAt && now > closesAt`; si no, `OPEN`.
- `exhibitorWorkProblems`: con `forSubmit: false` sólo valida lo cargado; con `forSubmit: true` exige lo obligatorio en el orden de los tests. Medidas redondeadas a un decimal. Edición `LIMITED` exige 1 ≤ n ≤ total ≤ 999; en las otras se ignoran (el mapeo guarda `null`). Precio entero positivo ≤ `PRICE_MAX_ARS`.
- `exhibitorWorkTransition` (`ctx = { linkOpen?, complete?, activityEditable? }`): `submit` desde `DRAFT` (pide `linkOpen` y `complete`) o `CHANGES_REQUESTED` (pide `complete`); `withdraw` desde `SUBMITTED`; `edit` en `DRAFT` o `CHANGES_REQUESTED`; `approve` desde `SUBMITTED` (y `activityEditable !== false`); `requestChanges` desde `SUBMITTED` o `APPROVED`; `remove` desde `SUBMITTED`, `CHANGES_REQUESTED` o `APPROVED`.
- **No** hay función que formatee el precio para el público en esta etapa (D33).

- [ ] **Step 4: Correr**

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter @repo/muestras lint`
Expected: todo en verde.

- [ ] **Step 5: Commit**

```bash
git add packages/muestras
git commit -m "Muestras: reglas de expositores (enlace, alta, datos de la obra, estados, copia a la muestra) y del portfolio del artista"
```

**Acceptance:** los textos de los problemas son los que ve la persona; ninguna regla produce texto con el precio.

---

### Task 3: Reglas del pase de sala, QR `s`, estado de venta y "Obra destacada"

**Files:**
- Create: `packages/muestras/src/room.ts`, `packages/muestras/src/room.test.ts`
- Modify: `packages/muestras/src/stats.ts` (+ `stats.test.ts`), `packages/muestras/src/social.ts` (+ `social.test.ts`), `packages/muestras/src/index.ts`

**Interfaces:**
- Produces (`room.ts`):
  - `ROOM_CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"` (31 símbolos), `ROOM_CODE_LENGTH = 12`, `isRoomCode(s)`, `roomCodeFrom(bytes: Uint8Array)` (cada byte módulo 31; sesgo despreciable para ≈ 60 bits, documentado).
  - `ROOM_PASS_HOURS = 8`, `ROOM_PASS_MAX_WORKS = 60`, `roomPassCookieName(activityId)` (`mf_sala_<id>`).
  - `type RoomPass = { v: 1; a: string; exp: number; w: string[] }`; `encodeRoomPass`, `decodeRoomPass` (con `btoa`/`atob` y reemplazo base64url, no `Buffer`; `try/catch` en `JSON.parse`; forma estricta), `mergeRoomPass(prev, { activityId, workId, now })`, `roomPassValid(p, activityId, now)`.
  - `SALES_ENABLED = false`; `showBuyButton({ roomBuy, forSale })`; `saleState({ salesEnabled, forSale }): "UNAVAILABLE" | "NOT_FOR_SALE"` (la etapa de Ventas suma `"AVAILABLE"`); `SALE_UNAVAILABLE_TEXT = "La venta de esta obra todavía no está disponible."`, `SALE_ASK_TEXT = "Si te interesa, consultá a la organización en la sala."`.
  - `stats.ts`: `QR_KINDS = ["o","m","l","s"]`; `metricForQrKind("s") = "SCAN"`.
  - `social.ts`: `availableSocialVariants(a, now, onlineWorkCount)`; `WORK` sólo si `> 0`.

- [ ] **Step 1: Escribir los tests que fallan**

`packages/muestras/src/room.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  ROOM_PASS_HOURS, decodeRoomPass, encodeRoomPass, isRoomCode, mergeRoomPass, roomCodeFrom, roomPassCookieName,
  roomPassValid, saleState, showBuyButton,
} from "./room";

const ahora = new Date("2026-11-10T20:00:00Z");

describe("código de sala", () => {
  it("12 símbolos del alfabeto, sin ambiguos", () => {
    const c = roomCodeFrom(new Uint8Array([0, 1, 2, 30, 31, 62, 100, 200, 255, 7, 8, 9]));
    expect(c).toHaveLength(12);
    expect(isRoomCode(c)).toBe(true);
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
    expect(mergeRoomPass(p2, { activityId: "b9", workId: "x", now: luego }).w).toEqual(["x"]);
  });
  it("tope de 60 obras: quedan las últimas", () => {
    let p = null;
    for (let i = 0; i < 65; i++) p = mergeRoomPass(p, { activityId: "a1", workId: `w${i}`, now: ahora });
    expect(p!.w).toHaveLength(60);
    expect(p!.w[0]).toBe("w5");
  });
  it("basura no se lee", () => {
    for (const s of ["", "x", encodeRoomPass({ v: 2 } as never)]) expect(decodeRoomPass(s), s).toBeNull();
  });
  it("nombre de la cookie", () => expect(roomPassCookieName("ck1")).toBe("mf_sala_ck1"));
});

describe("adquirir obra", () => {
  it("el botón aparece con la opción de sala y la obra a la venta", () => {
    expect(showBuyButton({ roomBuy: true, forSale: true })).toBe(true);
    expect(showBuyButton({ roomBuy: false, forSale: true })).toBe(false);
    expect(showBuyButton({ roomBuy: true, forSale: false })).toBe(false);
  });
  it("mientras no hay venta, la página dice que no está disponible", () => {
    expect(saleState({ salesEnabled: false, forSale: true })).toBe("UNAVAILABLE");
    expect(saleState({ salesEnabled: false, forSale: false })).toBe("NOT_FOR_SALE");
  });
});
```
Sumar a `stats.test.ts` el QR `s`; a `social.test.ts` que con `onlineWorkCount: 0` no hay `WORK`.

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter @repo/muestras test -- room stats social`
Expected: FAIL.

- [ ] **Step 3: Implementar** lo de Interfaces. En `lib/redes`, hasta la Task 6, pasar `onlineWorkCount: works.length` para que compile.

- [ ] **Step 4: Correr**

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter @repo/muestras lint && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types`
Expected: todo en verde.

- [ ] **Step 5: Commit**

```bash
git add packages/muestras apps/muestras
git commit -m "Muestras: reglas del pase de sala (código, cookie, 8 horas), QR de sala y estado de la venta"
```

**Acceptance:** un id de obra nunca pasa `isRoomCode`; ninguna regla devuelve el precio para mostrar.

---

### Task 4: Columna de visibilidad y tablas de expositores, portfolio y sala (migración escrita a mano, sin aplicar)

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20261031120000_muestras_etapa_6_expositores/migration.sql`

**Interfaces:**
- Produces: `CulturalActivity.visibility` (`Json?`), `.exhibitorLink`, `.exhibitors`, `.exhibitorWorks`, `.roomCodes`, `.roomKey`; `PhotographerProfile.exhibitors`, `.portfolio`; `prisma.culturalExhibitorLink`, `prisma.culturalExhibitor` (único `activityId_userId`), `prisma.culturalExhibitorWork`, `prisma.photographerPortfolioPhoto`, `prisma.culturalActivityRoomCode` (único `activityId_workId`), `prisma.culturalActivityRoomKey`.

- [ ] **Step 1: Confirmar el nombre de la migración**

Run: `git fetch origin && git ls-tree --name-only origin/main packages/db/prisma/migrations/ | tail -4 && ls packages/db/prisma/migrations | tail -3`
Expected: la última de esta rama es `20261030120000_muestras_etapa_5_difusion`; en `origin/main` nada posterior a `20261030…`. Si apareció una más nueva, usar un timestamp posterior y reemplazar el nombre en todo este plan.

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
  /// Participaciones como expositor y portfolio (Muestras, etapa 6).
  exhibitors CulturalExhibitor[]
  portfolio  PhotographerPortfolioPhoto[]
```
Al final del archivo:
```prisma
/// Enlace único por el que los expositores de una muestra se suman y cargan sus obras (Muestras,
/// etapa 6). El token se guarda tal cual: se copia muchas veces y no da permisos sobre la muestra.
model CulturalExhibitorLink {
  id         String           @id @default(cuid())
  activityId String           @unique
  activity   CulturalActivity @relation(fields: [activityId], references: [id], onDelete: Cascade)

  token                String    @unique
  /// OPEN | CLOSED
  status               String    @default("OPEN")
  /// Fin del día argentino de la fecha límite. Vacío = sin fecha límite.
  closesAt             DateTime?
  /// Vacío = sin tope (lo decide quien organiza).
  maxWorksPerExhibitor Int?
  maxExhibitors        Int?
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

/// Una obra que se cuelga, con los datos para ficha, catálogo y plano. Lo aprobado se copia a
/// `CulturalActivityWork`; `activityWorkId` sin FK (el editor de la muestra reescribe sus obras).
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
  /// Pesos, sin centavos. Sólo lo ve la organización hasta que exista la venta.
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

  @@index([exhibitorId, sortOrder])
  @@index([activityId, status])
  @@index([activityWorkId])
}

/// Portfolio del artista (etapa 6): fotos que no se exponen, para todas sus muestras.
model PhotographerPortfolioPhoto {
  id        String              @id @default(cuid())
  profileId String
  profile   PhotographerProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  imageUrl  String
  title     String
  year      Int?
  technique String?
  caption   String?
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([profileId, sortOrder])
}

/// Código impreso en el QR de la ficha (`/q/s/<code>`): lo único que da pase de sala.
/// `workId` sin FK (el editor reescribe las obras conservando el id).
model CulturalActivityRoomCode {
  code       String           @id
  activityId String
  activity   CulturalActivity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  workId     String
  createdAt  DateTime         @default(now())

  @@unique([activityId, workId])
}

/// Llave con la que se firman los pases de sala de una muestra. Nunca en una consulta pública.
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
-- Muestras Fotográficas · Etapa 6: expositores por enlace, portfolio del artista y sorpresa de la muestra.
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
    "maxWorksPerExhibitor" INTEGER,
    "maxExhibitors" INTEGER,
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
CREATE TABLE "PhotographerPortfolioPhoto" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "technique" TEXT,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotographerPortfolioPhoto_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "PhotographerPortfolioPhoto_profileId_sortOrder_idx" ON "PhotographerPortfolioPhoto"("profileId", "sortOrder");

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
ALTER TABLE "PhotographerPortfolioPhoto" ADD CONSTRAINT "PhotographerPortfolioPhoto_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PhotographerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalActivityRoomCode" ADD CONSTRAINT "CulturalActivityRoomCode_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalActivityRoomKey" ADD CONSTRAINT "CulturalActivityRoomKey_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Comparar con lo que generaría Prisma y regenerar el cliente**

Run: `cd packages/db && git show HEAD:packages/db/prisma/schema.prisma > /tmp/schema-antes.prisma && pnpm prisma migrate diff --from-schema-datamodel /tmp/schema-antes.prisma --to-schema-datamodel prisma/schema.prisma --script > /tmp/etapa6.sql && diff <(grep -v '^--' /tmp/etapa6.sql | sed '/^$/d') <(grep -v '^--' prisma/migrations/20261031120000_muestras_etapa_6_expositores/migration.sql | sed '/^$/d') && pnpm prisma validate && pnpm prisma generate`
Expected: `diff` sin diferencias (si sólo cambia el orden de sentencias equivalentes, adoptar el de Prisma); `validate` y `generate` sin errores. **No** correr `migrate dev` ni tocar ninguna base.

- [ ] **Step 5: Typecheck de las apps que comparten el schema**

Run: `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice typecheck`
Expected: en verde.

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20261031120000_muestras_etapa_6_expositores
git commit -m "Muestras: columna de visibilidad y tablas de expositores, portfolio y pase de sala (migración a mano, sin aplicar)"
```

**Acceptance:** la migración sólo agrega (ningún `DROP`, `ALTER COLUMN` ni `UPDATE`); la SQL coincide con `migrate diff`.

---

### Task 5: Sin tope de 40 obras — tope técnico de 300, marcos por tandas y catálogo liviano

**Files:**
- Modify: `packages/muestras/src/constants.ts`, `packages/muestras/src/validation.ts` (+ `validation.test.ts`), `packages/muestras/src/curation.ts` (+ `curation.test.ts`), `packages/muestras/src/print.ts` (+ `print.test.ts`), `apps/muestras/lib/seleccion/acciones.ts` (+ `.test.ts`), `apps/muestras/lib/portada/funciones.ts` (+ su test), `apps/muestras/lib/limite.ts` (+ `.test.ts`), `apps/muestras/lib/piezas/opciones.ts` (+ `opciones.test.ts`), `apps/muestras/lib/piezas/armar.ts` (+ `armar.test.ts`), `apps/muestras/app/api/piezas/[id]/[pieza]/route.ts` (+ `lib/piezas/ruta.test.ts`), `apps/muestras/components/montaje/descargar-marcos.tsx`, `apps/muestras/components/formulario/obras.tsx`, `apps/muestras/app/panel/montaje/[id]/page.tsx`

**Interfaces:**
- Produces:
  - `constants.ts`: `MAX_WORKS = 300` con el comentario "Tope técnico (spec D17), no de diseño: lo fija el armado de PDF (una foto por vez, ≈ 0,3–0,5 s cada una) y lo que un teléfono maneja en la galería y el editor. Cuántas obras tiene una muestra lo decide quien organiza." `MAX_HIGHLIGHTS = 12` se mantiene (comentario: sólo para el modo "Las destacadas", D19).
  - `print.ts`: `FRAME_BATCH_SIZE = 40`, `frameBatches(total): { n; from; to }[]` (1-based), `catalogImageSize(count): 1400 | 1000 | 800` (≤ 60 → 1400; ≤ 150 → 1000; más → 800).
  - `opciones.ts`: la pieza `marcos` suma `tanda: number | null` (`?tanda=2`). Con foto, sin `obra` ni `tanda` y más de 40 obras, la ruta responde 404 en texto "Con más de 40 obras, bajá los marcos por tandas." (el panel nunca lo ofrece así).
  - `armar.ts`: marcos con `tanda` toman `works.slice((n - 1) * 40, n * 40)`; catálogo con `imagenParaPdf(w.imageUrl, catalogImageSize(a.works.length), 80)`; los comentarios "40 fotos" pasan a "una foto por vez".
  - `route.ts`: `export const maxDuration = 300;` con comentario (catálogo de 300 obras ≈ 2 min; requiere el plan Pro de Vercel).
  - `limite.ts`: `fichas` 100 → **400** cada 10 min; comentarios sin "40".
  - Textos: `validation.ts`, `curation.ts` (`selectionRoom`, `editorGalleryPlan`) y `seleccion/acciones.ts` usan `MAX_WORKS` (el texto fijo "La muestra admite hasta 40 obras" pasa a `${MAX_WORKS}`); `portada/funciones.ts`: "Hasta 40 obras…" → "Todas las obras que entren en tu sala, con título, autor, año y técnica, en el orden que elijas y con destacadas."; `obras.tsx`: el contador muestra "N obras, M/12 destacadas" (sin "/40") y avisa recién al acercarse a 300.
  - `/panel/montaje/[id]`: el aviso de D37 ("El pase de sala necesita las fichas con el QR nuevo. Si imprimiste fichas antes, volvé a bajarlas.") encima de las fichas.

- [ ] **Step 1: Tests que fallan**

`print.test.ts`:
```ts
describe("tandas de marcos y tamaño del catálogo", () => {
  it("de a 40", () => {
    expect(frameBatches(0)).toEqual([]);
    expect(frameBatches(40)).toEqual([{ n: 1, from: 1, to: 40 }]);
    expect(frameBatches(95)).toEqual([{ n: 1, from: 1, to: 40 }, { n: 2, from: 41, to: 80 }, { n: 3, from: 81, to: 95 }]);
  });
  it("imágenes más chicas cuanto más obras", () => {
    expect(catalogImageSize(60)).toBe(1400);
    expect(catalogImageSize(61)).toBe(1000);
    expect(catalogImageSize(151)).toBe(800);
  });
});
```
`validation.test.ts`: 300 obras pasan, 301 no ("La galería admite hasta 300 obras."). `curation.test.ts`: `selectionRoom(250, 40)` → 10. `opciones.test.ts`: `?tanda=2` se lee; `tanda=0`/`abc` → `null`. `armar.test.ts`: con 95 obras y `tanda: 3` arma 15 marcos; el catálogo pide imágenes de 1000 px con 100 obras (espiar `imagenParaPdf`). `ruta.test.ts`: marcos con foto sin `obra` ni `tanda` y 41 obras → 404 con el texto. `lib/seleccion/acciones.test.ts`: el mensaje de tope dice 300.

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter @repo/muestras test -- print validation curation && pnpm --filter muestras test -- piezas seleccion portada`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Lo de Interfaces. En `descargar-marcos.tsx`: con foto, "todas" y más de 40 obras, en lugar de un enlace muestra la lista de tandas ("Marcos 1 a 40", "41 a 80"…) con `frameBatches`.

Verificar que no quede ningún "40" que hable de obras: `grep -rnE "\b40\b" apps/muestras/lib apps/muestras/app apps/muestras/components packages/muestras/src | grep -v "\.test\." | grep -vE "z-40|w-40|h-40|opacity-40|\[40, 40\]|\{1,40\}|8,40|40x50|30x40|40 \* e|ancho: 40|frameWidthCm \?\? 40"` sólo muestra `FRAME_BATCH_SIZE`.

- [ ] **Step 4: Correr**

Run: `pnpm --filter @repo/muestras test && pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: en verde.

- [ ] **Step 5: Probar en local**

En una muestra de prueba (base de prueba, nunca producción) con 100 obras cargadas por un script de seed local: bajar el catálogo A5 (medir el tiempo; va a R2 si pasa de 4 MB) y la tanda 3 de marcos; abrir los dos PDF.

- [ ] **Step 6: Commit**

```bash
git add packages/muestras apps/muestras
git commit -m "Muestras: sin tope de 40 obras — tope técnico de 300, marcos por tandas de 40, catálogo con imágenes según la cantidad y más tiempo para las piezas"
```

**Acceptance:** ninguna pantalla ni mensaje dice "40 obras"; un PDF de marcos con foto nunca tiene más de 40 obras.

---

### Task 6: Lo público respeta la sorpresa — galería (fija o para cada visitante), página de obra, perfil, "Artistas" y difusión

**Files:**
- Create: `apps/muestras/lib/actividades/artistas.ts` (+ `artistas.test.ts`), `apps/muestras/lib/actividades/publicas.test.ts`, `apps/muestras/lib/anticipo/elegir.ts` (+ `elegir.test.ts`), `apps/muestras/app/api/m/[slug]/anticipo/route.ts` (+ `lib/anticipo/ruta.test.ts`), `apps/muestras/components/ficha/{artistas.tsx, galeria-rotativa.tsx, fotos-portfolio.tsx}`
- Modify: `apps/muestras/lib/actividades/consultas.ts`, `apps/muestras/lib/perfiles/consultas.ts`, `apps/muestras/app/m/[slug]/page.tsx`, `apps/muestras/app/m/[slug]/o/[workId]/page.tsx`, `apps/muestras/app/fotografos/[slug]/page.tsx`, `apps/muestras/components/ficha/galeria.tsx`, `apps/muestras/lib/redes/cargar.ts`, `apps/muestras/app/api/redes/[id]/route.ts` (+ `lib/redes/ruta.test.ts`), `apps/muestras/components/difusion/piezas-redes.tsx`, `apps/muestras/lib/limite.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: `visibleWorks`, `workAccess`, `profileWorksInActivity`, `parseVisibility`, `pickPerVisit` (Task 1); `portfolioPreview` (Task 2).
- Produces:
  - `buscarPorSlug(slug)`: igual que hoy (trae `visibility`); cada `authorProfile` suma `id`, `bio`, `city`, `province`, `avatarUrl` y `portfolio: { orderBy: { sortOrder: "asc" }, take: 8, select: { id, imageUrl, title, year, technique, caption } }`.
  - `artistasDeMuestra(a, v)` (puro): `{ key, nombre, perfil: { slug, bio, ciudad, avatarUrl } | null, portfolio: Foto[] }`, uno por autor de las obras expuestas (por perfil, o por nombre si no tiene), en el orden de su primera obra; `[]` si `!v.online.artists`. **Nunca** incluye `imageUrl` de obras expuestas.
  - `obrasDelAnticipo(slug, randomInt)` (`lib/anticipo/elegir.ts`, `server-only`): la muestra publicada; si el ajuste no da `perVisit` hoy → `null`; si no, `pickPerVisit(works, count, randomInt)` mapeadas a `{ id, imageUrl, title, authorName, year, technique }`.
  - `GET /api/m/[slug]/anticipo`: `runtime = "nodejs"`, `dynamic = "force-dynamic"`; freno por IP `anticipo` 60/10 min (pasado el tope, devuelve la última respuesta de esa huella guardada en memoria, o `{ obras: [] }`); `obrasDelAnticipo(slug, crypto.randomInt)`; `null` → 404 `{ obras: [] }`; respuesta `{ obras }` con `Cache-Control: private, no-store` y `X-Robots-Tag: noindex`.
  - `lib/limite.ts`: `anticipo` 60/10 min por IP.
  - `buscarPerfilPublico(slug)`: cada muestra suma `visibility: true`; el perfil suma `portfolio` completo (ordenado).
  - Redes: `cargarMuestraParaRedes`/`cargarMuestraParaDifusion` suman `galleryMode`, `visibility`; las obras ofrecidas y aceptadas son `visibleWorks(...).works`, o **todas las expuestas** si `perVisit` (D23/D39).

- [ ] **Step 1: Tests que fallan**

`lib/actividades/artistas.test.ts`: tres autores (dos con perfil y portfolio, uno sin perfil) → salen en orden, con sus 8 primeras fotos; `artists = false` → `[]`; `JSON.stringify` del resultado no contiene ninguna `imageUrl` de `a.works`.

`lib/actividades/publicas.test.ts` (prueba de filtración; el componente de servidor devuelve el árbol con las props de los componentes cliente, que se serializa; no se usa `renderToString` porque no resuelve componentes asíncronos anidados):
```ts
const arbol = (el: unknown) => JSON.stringify(el, (_k, v) => (typeof v === "function" ? undefined : v));
// Muestra abierta, 3 obras con imageUrl ".../oculta-<n>.webp" y un autor con portfolio ".../portfolio-1.webp".
for (const ajuste of [visibilityFromPreset("SURPRISE", "s"), porVisitante]) {
  db.culturalActivity.findFirst.mockResolvedValue({ ...muestra, visibility: ajuste });
  const html = arbol(await Ficha({ params: Promise.resolve({ slug: "m" }) }));
  for (let n = 1; n <= 3; n++) expect(html).not.toContain(`oculta-${n}.webp`);
  expect(html).toContain("portfolio-1.webp");
  expect(arbol(await generateMetadata({ params: Promise.resolve({ slug: "m" }) }))).not.toContain("oculta-");
}
```
Con `PER_VISIT` además: el árbol contiene `GaleriaRotativa` con `slug` y `cantidad` y ninguna obra. Lo mismo para `PaginaDeObra` (aviso "Esta obra se ve en la sala", `robots.index === false`) y `PerfilPublico` (sin `oculta-`, con "Portfolio"). Con "Adelanto" y semilla fija aparecen exactamente las 3 de `visibleWorks`.

`lib/anticipo/elegir.test.ts`: con un `randomInt` fijo devuelve las N esperadas y sólo esos campos (sin `authorUserId`, `authorProfileId`, `sortOrder`); muestra no publicada o ajuste fijo → `null`; muestra cerrada con `revealAfterClose` → `null`.

`lib/anticipo/ruta.test.ts`: 200 con `{ obras }` de largo N y `Cache-Control: private, no-store`; dos pedidos con distinto `randomInt` dan obras distintas; pasado el freno, la misma respuesta que la última vez para esa IP; slug inexistente → 404.

`lib/redes/ruta.test.ts`: "Sorpresa total" → `variante=obra` 404 y la variante no se ofrece ("Con 'Sorpresa total' no se difunden obras de la sala: usá 'Inaugura' o 'Invitación'."); "Adelanto" → sólo las 3; `PER_VISIT` → cualquier expuesta; una oculta pedida a mano por id → 404.

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- artistas publicas anticipo redes`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- `app/m/[slug]/page.tsx`: `const g = visibleWorks(a, a.works, ahora)`. Si `g.perVisit`: `<GaleriaRotativa slug={a.slug} cantidad={g.perVisit.count} />` (componente cliente que al montarse hace `fetch("/api/m/<slug>/anticipo", { cache: "no-store" })`, muestra un esqueleto de `cantidad` cuadros mientras carga y después la grilla con el visor **sin** enlace a la página de la obra; título "Anticipo de la muestra"; bajada "Cada vez que entrás ves otras obras de las que están en la sala."). Si no, `Galeria` como hoy con `g.works`. Si no se ve ninguna y hay obras: "Las obras se descubren en la sala. Acá podés conocer a los artistas." Debajo, `<Artistas artistas={artistasDeMuestra(a, v)} />`.
- `components/ficha/galeria.tsx`: bajada según el caso (parcial → "Algunas de las obras que vas a ver en la sala. Las demás se descubren allá."; recibe `seRevela` para no prometer el archivo si la reserva sigue) y prop `enlazar` (en la rotativa, `false`).
- `components/ficha/artistas.tsx` (servidor): tarjeta por artista (foto, nombre con enlace al perfil, ciudad, biografía cortada a 280 caracteres + "Ver perfil") y `FotosPortfolio` (cliente, reutiliza `components/visor/visor.tsx`; recibe sólo `{ id, imageUrl, title, year, technique, caption }`) con "Ver portfolio" si tiene más de 8.
- `app/m/[slug]/o/[workId]/page.tsx`: sin cambios de lógica; el aviso suma " Cuando la muestra cierra, queda online en el archivo de la muestra." sólo si `revealAfterClose`.
- `app/fotografos/[slug]/page.tsx`: sección **"Portfolio"** (todas sus fotos, visor) arriba de "Expuso en"; en cada muestra, las expuestas según la regla (el texto "Y N obras más para ver en la sala" no cambia).
- Redes y difusión según Interfaces; en `piezas-redes.tsx`, con "cambian cada día": "Hoy se ven online estas obras. Mañana pueden ser otras."; con `PER_VISIT`: "Online cada visitante ve otras obras: podés difundir cualquiera."

- [ ] **Step 4: Correr**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: en verde.

- [ ] **Step 5: Probar en local**

Con una muestra de prueba con `visibility` cargada a mano en la base de prueba: "Sorpresa total", "Adelanto", "Todo a la vista" y `PER_VISIT` con 3. En `PER_VISIT`, recargar varias veces (cambian las obras) y mirar "Ver código fuente": no hay ninguna URL de obra (llegan por la red, de a 3). En los otros modos, la URL de una obra oculta no aparece.

- [ ] **Step 6: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: la publicación online respeta la sorpresa (fija o distinta para cada visitante) y presenta a los artistas con su biografía y su portfolio"
```

**Acceptance:** con "Sorpresa total" o `PER_VISIT` ninguna URL de obra expuesta aparece en `/m/<slug>`, `/m/<slug>/o/<id>` ni `/fotografos/<slug>`; el anticipo nunca devuelve más de N; las muestras sin ajuste se ven igual que antes.

---

### Task 7: Panel "Visibilidad" — presets, personalizado, rotación, volver a sortear y avisos

**Files:**
- Create: `apps/muestras/lib/visibilidad/{acciones.ts, consultas.ts, mapear.ts}` (+ `acciones.test.ts`, `mapear.test.ts`), `apps/muestras/app/panel/muestras/[id]/visibilidad/page.tsx`, `apps/muestras/components/visibilidad/{ajuste-visibilidad.tsx, estilos.ts}`
- Modify: `apps/muestras/lib/limite.ts` (+ `.test.ts`), `apps/muestras/lib/actividades/mapear.ts` (+ `.test.ts`), `apps/muestras/lib/actividades/acciones.ts` (+ `.test.ts`), `apps/muestras/components/formulario/formulario-actividad.tsx`, `apps/muestras/app/panel/muestras/[id]/page.tsx`

**Interfaces:**
- Consumes: `visibilityFromPreset`, `presetOf`, `parseVisibility`, `visibilitySummary`, `coverIsHiddenWork`, `visibleWorks`, `RANDOM_ROTATION_LABELS` (Task 1); `rolEnMuestra`, `puede`, `dondePuede`; `datosDeCambio`.
- Produces:
  - `visibilidadDesdeFormData(fd, actual): Visibility` (puro). `randomCount`: entero ≥ 1 (sin tope).
  - `guardarVisibilidad(fd)` (`visibility`, freno `guardarVisibilidad` 60/h): semilla nueva (`randomBytes(12).toString("base64url")`) si la actual es `"legado"`; guarda `visibility` y un `galleryMode` coherente (`ALL` → `FULL`; si no, `HIGHLIGHTS_UNTIL_CLOSED`); `datosDeCambio(usuario.id, "FICHA")`; revalida `/m/<slug>` (layout), `/fotografos` (layout) y `/`.
  - `volverASortear(activityId)`: semilla nueva y nada más.
  - `cargarVisibilidad(id, usuario)`.
  - `AjusteVisibilidad` (componente cliente reutilizable, con prop `sugerencia`; lo usa también la Task 9).

- [ ] **Step 1: Tests que fallan**

`mapear.test.ts`: elegir un preset conserva la semilla; "Personalizado" con `rotation=PER_VISIT` y `randomCount=25` se respeta; `randomCount=0` o `abc` → 3; casillas ausentes = `false`.
`acciones.test.ts`: sin sesión → "Tenés que ingresar."; rol de textos → "No podés cambiar la visibilidad de esta muestra." sin escribir; coorganización escribe `visibility` y `galleryMode`; semilla `"legado"` reemplazada; `volverASortear` cambia sólo la semilla; se llamó `revalidatePath("/m/<slug>", "layout")`.
`lib/actividades/acciones.test.ts`: con `visibility` cargada, `guardarBorrador` no cambia `galleryMode` aunque el formulario lo mande; sin ajuste, como hoy.

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- visibilidad actividades`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- Página `/panel/muestras/[id]/visibilidad` (`requireUsuario`; `notFound()` sin `visibility`):
  - "Qué se ve de la muestra" + "La muestra se ve en la sala. Acá elegís qué se adelanta online y qué ve quien escanea el QR de una ficha."
  - Presets (radio grande con su descripción) y "Personalizado" con cuatro bloques: **"En la publicación online"** (obras de la sala: todas / las destacadas / algunas al azar —cuántas; "Siempre las mismas", "Cambian cada día", "Cambian para cada visitante"— / ninguna; "Presentar a los artistas con su biografía y su portfolio"), **"En el perfil de cada artista"** (como en la publicación online / ninguna), **"Al escanear el QR de una ficha en la sala"** (esa obra / esa obra y las del mismo artista / toda la muestra; portfolio; otras muestras; botón "Adquirir obra"), **"Cuando cierra la muestra"** (mostrar todo / mantener la reserva).
  - Avisos según la elección: "Cambian cada día" → "Quien vuelve seguido termina viendo más obras."; **"Cambian para cada visitante"** → "Cada visitante ve otras N obras. Quien entre varias veces (o use un programa) va a terminar viendo todas: si querés que la sala sea sorpresa, elegí 'Siempre las mismas' o 'Ninguna'."
  - **"Así se ve hoy"**: las frases de `visibilitySummary` y la lista de obras con "Se ve online" / "Se descubre en la sala" (en `PER_VISIT`: "Online se ven N al azar de estas T, distintas para cada visitante"). "Volver a sortear" en "siempre las mismas" y "cada día".
  - Aviso de portada (`coverIsHiddenWork`): "La portada de la muestra es una de las obras que reservás para la sala: se ve en el listado y al compartir el enlace. Cambiala en la ficha si querés que sea sorpresa."
  - Aviso fijo de fichas (D37).
  - Enlaces "Ver la publicación online" y "Ver como en la sala" (`/m/<slug>/sala`; anda para el equipo, Task 14).
- `formulario-actividad.tsx`: si la muestra tiene `visibility`, en lugar de la casilla `galleryMode`: "Qué obras se ven online lo elegís en Visibilidad." (enlace). `mapear.ts`/`acciones.ts`: si `actual.visibility != null`, se conserva `actual.galleryMode`.
- `app/panel/muestras/[id]/page.tsx`: enlace "Visibilidad" (si `puede(…, "visibility", rol)`) con el nombre del preset.

- [ ] **Step 4: Correr**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: en verde.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: panel de Visibilidad con presets, personalizado, obras fijas o distintas para cada visitante y avisos"
```

**Acceptance:** el rol de textos no ve el enlace ni puede guardar; elegir "Cambian para cada visitante" muestra el aviso antes de guardar.

---

### Task 8: Portfolio del artista

**Files:**
- Create: `apps/muestras/lib/portfolio/{acciones.ts, consultas.ts, mapear.ts}` (+ `acciones.test.ts`, `mapear.test.ts`), `apps/muestras/components/perfil/{portfolio.tsx, estilos.ts}`
- Modify: `apps/muestras/app/panel/perfil/page.tsx`, `apps/muestras/lib/limite.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: `portfolioPhotoProblems`, `PORTFOLIO_MAX_PHOTOS`, `PORTFOLIO_TEXT_LIMITS` (Task 2); `esImagenDeUsuario` (`lib/envios/mapear.ts`), `baseImagenesPublicas`; `buscarPerfilPropio`.
- Produces:
  - `fotoDePortfolioDesdeFormData(fd, base, userId)` (puro): imagen sólo si `esImagenDeUsuario`; textos recortados; año válido o `null`.
  - `guardarFotoDePortfolio(fd)`: sesión; perfil propio (`userId = usuario.id`; el super admin puede pasar `profileId`); `exhibitedUrls` = `imageUrl` de `CulturalExhibitorWork` del usuario + `CulturalActivityWork` con `authorUserId = usuario.id` o `authorProfileId = perfil.id`; `portfolioPhotoProblems`; crea o actualiza (si trae `id`, tiene que ser de este perfil); al crear, `sortOrder = max + 1`; freno `guardarPortfolio` 300/h; revalida `/fotografos/<slug>` y `/m` (layout).
  - `borrarFotoDePortfolio(id)`, `ordenarPortfolio(ids)` (sólo ids de este perfil; reescribe `sortOrder` en una transacción).
  - `portfolioPropio(usuario)`.
  - `lib/limite.ts`: `guardarPortfolio` 300/h por persona.

- [ ] **Step 1: Tests que fallan**

`acciones.test.ts`: sin perfil → "Primero creá tu perfil de fotógrafo."; foto de otra persona → "Subí la foto desde acá."; la URL de una obra expuesta propia → el mensaje de D15; el tope de 60 al crear; editar una foto de otro perfil → "La foto no existe."; `ordenarPortfolio` ignora ids ajenos; revalida el perfil.

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- portfolio`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`/panel/perfil`: debajo del formulario del perfil, sección **"Portfolio"** (`id="portfolio"`): "Fotos tuyas que no se exponen: el público las ve en tu perfil y, si la organización lo elige, en las muestras donde expongas. No subas acá las obras que vas a colgar: son la sorpresa de la sala." Grilla con cada foto (título, año, técnica, texto breve), "Agregar foto" (subida por `/api/imagenes`, uso `obra`), editar, borrar, mover con flechas; contador "12 de 60". Sin perfil: "Creá tu perfil para armar tu portfolio."

- [ ] **Step 4: Correr**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: en verde.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: portfolio del artista en su perfil — fotos que no se exponen, con sus datos, para todas sus muestras"
```

**Acceptance:** nadie más que la dueña del perfil (o el super admin) toca su portfolio; una obra expuesta no entra al portfolio con la misma URL.

---

### Task 9: Enlace de expositores para la organización (con la elección de visibilidad)

**Files:**
- Create: `apps/muestras/lib/expositores/enlace.ts` (+ `enlace.test.ts`), `apps/muestras/lib/expositores/consultas.ts`, `apps/muestras/app/panel/muestras/[id]/expositores/page.tsx`, `apps/muestras/components/expositores/{enlace-expositores.tsx, estilos.ts}`
- Modify: `apps/muestras/lib/limite.ts` (+ `.test.ts`), `apps/muestras/app/panel/muestras/[id]/page.tsx`

**Interfaces:**
- Consumes: `exhibitorLinkState`, `EXHIBITOR_LIMITS`, `SUGGESTED_WORKS_PER_EXHIBITOR`, `EXHIBITOR_TEXT_LIMITS` (Task 2); `visibilidadDesdeFormData`, `AjusteVisibilidad` (Task 7); `nuevoTokenDeInvitacion`/`esTokenConForma` (`lib/curaduria/token.ts`: se usa el `token`, no el `hash`); `CopiarEnlace`; `dayEndAr`.
- Produces:
  - `crearEnlaceExpositores(fd)`: `exhibitors`; sólo `MUESTRA`, no cancelada ni cerrada. **Si la muestra no tiene `visibility`**, el formulario trae el bloque de visibilidad y es **obligatorio** confirmarlo (`visibilidadConfirmada=1`; si falta: "Elegí qué se ve online antes de generar el enlace."); para guardarla también pide `visibility`. Crea el enlace con token nuevo, `maxWorksPerExhibitor` (sugerido 3; vacío = sin tope) y `maxExhibitors` vacío. Si ya existe, no hace nada.
  - `guardarEnlaceExpositores(fd)`: topes optativos (vacío = sin tope; si hay, en rango: "Las obras por expositor van de 1 a 300."), fecha límite (no antes de hoy ni después del cierre: "La fecha límite tiene que ser antes de que cierre la muestra."), instrucciones (≤ 1500).
  - `renovarEnlaceExpositores(activityId)` (aviso "El enlace anterior dejó de andar. Mandá el nuevo a quienes todavía no se sumaron."), `cambiarEstadoEnlace(activityId, "OPEN" | "CLOSED")`.
  - `enlaceDeExpositores(activityId, usuario)` (`dondePuede(usuario, "exhibitors")`): enlace, estado, URL completa (`APP_URL` + `/expositores/<token>`), cuántos expositores.
  - `lib/limite.ts`: `enlaceExpositores` 30/h por persona.

- [ ] **Step 1: Tests que fallan**

`enlace.test.ts`: textos → no crea; sin `visibility` y sin confirmar → mensaje y no crea; con la sugerencia confirmada → guarda "Adelanto" (3, siempre las mismas) y el enlace; con otra elección (`PER_VISIT`, 5) → guarda esa; con `visibility` ya cargada no la pide ni la toca; segunda llamada no duplica (P2002 = "ya existe"); topes vacíos → `null`; tope 400 → mensaje; fecha después del cierre → mensaje; `renovar` cambia el token; cancelada → "La muestra está cancelada."

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- expositores/enlace`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Página `/panel/muestras/[id]/expositores` (`requireUsuario`; `notFound()` sin `exhibitors`). Sin enlace: "Mandá un enlace a las personas que elegiste para exponer: se suman con su cuenta de Google, completan su perfil y cargan sus obras. Vos aprobás cada obra antes de que entre a la muestra." Si la muestra no tiene ajuste: **"Antes, elegí qué se ve online"** con `AjusteVisibilidad` y la sugerencia marcada ("Te sugerimos 'Adelanto': 3 obras al azar, siempre las mismas. Podés cambiarlo cuando quieras en Visibilidad."); "Obras por expositor" con 3 sugerido y la opción "Sin tope"; "Generar el enlace". Con enlace: el enlace con `CopiarEnlace` ("Mandalo por WhatsApp o por mail."), estado, topes ("sin tope" si están vacíos), fecha límite, instrucciones ("Por ejemplo: 'Las copias se entregan enmarcadas el 30 de octubre en la sede'"), "Cerrar el enlace"/"Volver a abrirlo", "Generar un enlace nuevo" (confirmación). La parte de expositores llega en la Task 12. `app/panel/muestras/[id]/page.tsx`: enlace "Expositores" con contador (Task 12 lo llena).

- [ ] **Step 4: Correr**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: en verde.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: enlace de expositores — generar (eligiendo antes qué se ve online), copiar, topes optativos, fecha límite, cerrar y renovar"
```

**Acceptance:** no se genera el enlace de una muestra sin ajuste sin que quien organiza confirme una opción; el rol de textos recibe 404.

---

### Task 10: Sumarse como expositor (entrada pública, Google y perfil)

**Files:**
- Create: `apps/muestras/app/expositores/[token]/page.tsx`, `apps/muestras/lib/expositores/alta.ts` (+ `alta.test.ts`), `apps/muestras/components/expositores/alta-expositor.tsx`
- Modify: `apps/muestras/lib/expositores/consultas.ts`, `apps/muestras/lib/perfiles/acciones.ts` (extraer `crearOActualizarPerfil(tx, userId, datos)` sin cambiar `guardarPerfil` ni sus tests), `apps/muestras/lib/ruta-segura.ts` (+ `.test.ts`, si `/expositores/…` no está permitido como `next`), `apps/muestras/lib/limite.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: `exhibitorLinkState`, `exhibitorJoinProblems` (Task 2); `perfilDesdeFormData`, `LARGOS_PERFIL`, `freeProfileSlug`; `esTokenConForma`; `requireUsuario`, `getUsuario`.
- Produces:
  - `enlacePorToken(token)`: `null` si `!esTokenConForma(token)`; si no, el enlace con su muestra y la cantidad de expositores activos. Nunca el `token` hacia componentes cliente.
  - `sumarmeComoExpositor(fd)`: sesión; enlace; `exhibitorJoinProblems`; ya `ACTIVE` → `{ ok: true, id }`; `REMOVED` → "Quien organiza te sacó de esta muestra. Escribile si fue un error."; crea o completa el perfil propio (si tiene, sólo completa la biografía vacía) y la fila, en una transacción; freno `sumarseExpositor` 20/h.
  - `lib/limite.ts`: `sumarseExpositor` 20/h; `paginaExpositores` 60/10 min por IP.

- [ ] **Step 1: Tests que fallan**

`alta.test.ts`: token con mala forma → "Este enlace no existe." sin consultar la base; enlace cerrado → mensaje; sin perfil → crea perfil con slug libre y la fila; con perfil → no lo pisa; ya sumado → su id sin otra fila; sacado → mensaje; cupo lleno (`maxExhibitors`) → mensaje; sin tope → entra el número 250; sin derechos → mensaje; nombre de más de 120 caracteres → recortado.

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- expositores/alta ruta-segura`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`app/expositores/[token]/page.tsx`: `dynamic = "force-dynamic"`; `robots: { index: false, follow: false }`, `referrer: "no-referrer"`; freno por IP (pasado el tope, el mismo 404). Inexistente o `UNAVAILABLE` → `notFound()`. `CLOSED`/`EXPIRED` → "Este enlace ya no recibe expositores. Si ya te sumaste, entrá a 'Donde expongo' en tu panel." Abierto: portada, "Te invitan a exponer en", título, organiza, fechas, sede, instrucciones, "Podés cargar hasta N obras." (sólo si hay tope), fecha límite. Sin sesión: "Ingresá con Google para sumarte" (`/login?next=/expositores/<token>`). Ya expositor: "Ya estás en esta muestra" + "Ir a mis obras". Con sesión: `AltaExpositor` con "Cómo firmás tus obras", el perfil (crear con nombre, biografía —"Contá quién sos y qué fotografiás. Es lo que va a leer el público de la muestra."—, ciudad, provincia, Instagram y foto; o completar la biografía), la casilla de derechos (D3) y "Sumarme a la muestra".

- [ ] **Step 4: Correr**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: en verde.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: entrada pública para expositores — ingresar con Google, completar el perfil y sumarse a la muestra"
```

**Acceptance:** la página del enlace es `noindex`; sumarse dos veces no duplica; sin sesión no se escribe nada.

---

### Task 11: "Donde expongo" — el expositor carga sus obras

**Files:**
- Create: `apps/muestras/lib/expositores/obras.ts` (+ `obras.test.ts`), `apps/muestras/lib/expositores/mapear.ts` (+ `mapear.test.ts`), `apps/muestras/app/panel/expositor/page.tsx`, `apps/muestras/app/panel/expositor/[id]/page.tsx`, `apps/muestras/components/expositores/{obras-expositor.tsx, obra-expositor.tsx}`
- Modify: `apps/muestras/lib/expositores/consultas.ts`, `apps/muestras/lib/limite.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: `exhibitorWorkProblems`, `exhibitorCountProblem`, `exhibitorWorkTransition`, `exhibitorLinkState`, `EXHIBITOR_WORK_STATUS_LABELS` (Task 2); `esImagenDeUsuario`; `components/formulario/subir-imagen.ts`.
- Produces:
  - `misParticipaciones(usuario)`, `miParticipacion(id, usuario)` (siempre `where: { id, userId: usuario.id }`).
  - `obraDesdeFormData(fd, base, userId)` (puro): campos de D5; la foto sólo si `esImagenDeUsuario`.
  - `guardarObraDeExpositor(fd)` (crea o actualiza una obra propia en `DRAFT`/`CHANGES_REQUESTED`; tope optativo con `exhibitorCountProblem` contando las no `REMOVED`; `forSubmit: false`; freno `guardarObraExpositor` 300/h), `borrarObraDeExpositor` (sólo `DRAFT`, o `CHANGES_REQUESTED` sin `activityWorkId`), `enviarObraDeExpositor` (transición `submit` con `linkOpen` y `complete`; exige biografía: "Antes de enviar, completá tu biografía: es lo que el público lee de vos."; freno 60/h), `retirarObraDeExpositor`.
  - `lib/limite.ts`: `guardarObraExpositor` 300/h, `enviarObraExpositor` 60/h.

- [ ] **Step 1: Tests que fallan**

`mapear.test.ts`: foto ajena descartada; "40,5" → 40.5; "120.000" → 120000; edición no limitada → número y total `null`; recortes.
`obras.test.ts`: obra de otra participación → "La obra no existe." sin escribir; editar una `APPROVED` → mensaje; tope optativo alcanzado → mensaje, sin tope → entra; enviar incompleta → lista; enlace cerrado con `DRAFT` → mensaje y con `CHANGES_REQUESTED` → sí; sin biografía → mensaje; expositor `REMOVED` → "Quien organiza te sacó de esta muestra."; muestra cancelada → "La muestra está cancelada."

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- expositores/mapear expositores/obras`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- `/panel/expositor` (`requireUsuario("/panel/expositor")`): "Donde expongo"; una fila por muestra ("3 obras: 1 en la muestra, 1 enviada, 1 con cambios pedidos"). Vacío: "Todavía no expusiste por acá. Cuando una organización te mande su enlace, vas a ver la muestra en esta lista."
- `/panel/expositor/[id]` (`requireUsuario`; `miParticipacion` o `notFound()`): cabecera de la muestra y estado del enlace; "Tus obras" ("2 de 3" si hay tope); por obra, `ObraExpositor` con estado, nota de cambios destacada ("Quien organiza te pidió: …"), formulario (foto que se cuelga con vista previa; título; año; técnica y soporte; medida de la imagen; medida con marco; edición con número y total si es limitada; texto de la obra; "La quiero vender" + precio con "El precio sólo lo ve quien organiza. Se va a usar cuando la venta esté disponible."; notas para el montaje "Sólo las ve quien organiza"), "Guardar", "Enviar a la organización" (si falta algo, lista qué), "Retirar el envío", "Borrar". Aprobadas en lectura ("Ya está en la muestra"). "Agregar otra obra" mientras no haya tope o no se llegue. Atajo **"Tu portfolio"** → `/panel/perfil#portfolio` con "Sumá fotos que no se exponen para que el público te conozca."

- [ ] **Step 4: Correr**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: en verde.

- [ ] **Step 5: Probar en local**

A organiza, E expone: A genera el enlace; E se suma en una ventana privada, carga una obra completa, suma dos fotos a su portfolio y envía. A 375 px sin scroll horizontal.

- [ ] **Step 6: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: 'Donde expongo' — el expositor carga cada obra con la foto que se cuelga y todos sus datos, y la envía"
```

**Acceptance:** ninguna consulta del expositor devuelve datos de otra participación; una obra incompleta no se envía.

---

### Task 12: Revisión de la organización y convivencia con el editor de la muestra

**Files:**
- Create: `apps/muestras/lib/expositores/revision.ts` (+ `revision.test.ts`), `apps/muestras/components/expositores/revision-expositores.tsx`
- Modify: `apps/muestras/lib/expositores/consultas.ts`, `apps/muestras/app/panel/muestras/[id]/expositores/page.tsx`, `apps/muestras/app/panel/muestras/[id]/page.tsx`, `apps/muestras/app/panel/muestras/page.tsx`, `apps/muestras/app/panel/page.tsx`, `apps/muestras/lib/actividades/acciones.ts` (+ `.test.ts`), `apps/muestras/lib/actividades/textos.ts` (+ `.test.ts`), `apps/muestras/lib/actividades/consultas.ts`, `apps/muestras/components/formulario/obras.tsx`, `apps/muestras/lib/limite.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: `exhibitorWorkTransition`, `toActivityWork`, `pendingReviewCount`, `fichaDetail` (Task 2); `canEdit`, `MAX_WORKS` (300); `rolEnMuestra`, `puede`; `datosDeCambio`.
- Produces:
  - `expositoresDeMuestra(activityId, usuario)` (`exhibitors`): expositores (activos y sacados) con perfil y cantidad de fotos de portfolio, y sus obras con todos los campos. `pendientesPorMuestra(ids)` (un `groupBy`).
  - `aprobarObraDeExpositor(workId)`: transacción con `SELECT … FROM "CulturalActivity" WHERE id = $1 FOR UPDATE`; permiso y `canEdit` con el rol; transición; sin `activityWorkId`: cuenta las obras (`< MAX_WORKS`, si no "La muestra llegó al máximo técnico de 300 obras."), crea la `CulturalActivityWork` con `toActivityWork(..., max(sortOrder) + 1)` y guarda su id; con `activityWorkId`: `updateMany({ where: { id, activityId } })` con imagen, título, año y técnica (si ya no existe, crea otra); `APPROVED`, `reviewNote = null`, `reviewedAt`, `reviewedByUserId`; revalida la muestra y `/fotografos`.
  - `pedirCambiosObraDeExpositor(workId, nota)` (nota obligatoria ≤ 600; una aprobada sigue en la muestra), `corregirObraDeExpositor(fd)` (texto y medidas, no la foto; si está aprobada, copia título, año y técnica), `sacarObraDeExpositor(workId)` (`REMOVED`, borra la `CulturalActivityWork` con `deleteMany({ where: { id: activityWorkId, activityId } })`, nota "La organización la sacó de la muestra."), `sacarExpositor(exhibitorId)`.
  - `lib/limite.ts`: `revisarExpositores` 600/10 min.
  - **Editor (D9)**: en `guardarBorrador`, leer en la transacción las obras de expositor con `activityWorkId`; en `obrasParaGuardar`, para esas obras **forzar** `imageUrl`, `authorName`, `authorProfileId` y `authorUserId` de la base (`previas` suma `imageUrl` y `authorName`); después de escribir, copiar título, año y técnica de vuelta (`updateMany` por id); para cada `plan.removedIds` de un expositor: `REMOVED`, `activityWorkId = null`, la nota. `guardarTextos` también copia. `buscarParaEditar` suma `exhibitorWorkIds` para que `obras.tsx` muestre imagen y autor como "Lo carga quien expone".

- [ ] **Step 1: Tests que fallan**

`revision.test.ts`: textos no aprueba; muestra en revisión → mensaje sin escribir; aprobar crea la obra al final y guarda `activityWorkId`; con 300 obras → mensaje; volver a aprobar actualiza por id y no crea otra; pedir cambios sin nota → "Escribí qué hay que cambiar."; con nota a una aprobada → la `CulturalActivityWork` sigue; sacar borra la `CulturalActivityWork` sólo con `activityId` de esta muestra; sacar al expositor saca todas sus obras; cada acción relee el rol (un integrante revocado entre medio no puede).
`lib/actividades/acciones.test.ts`: el formulario intenta cambiar imagen y autor de una obra de expositor → quedan los de la base; cambia el título → se copia; quita una obra de expositor → `REMOVED`. `textos.test.ts`: el título editado se copia.

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- expositores/revision actividades`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Parte de abajo de `/panel/muestras/[id]/expositores`: **"Para revisar (N)"** primero; después cada expositor (foto, nombre con enlace al perfil, "Se sumó el …", "Portfolio: 12 fotos") con sus obras: la foto grande (la organización ve la URL: es su muestra), `fichaDetail`, texto, **"A la venta" y el precio** (la organización sí lo ve), notas para el montaje; "Aprobar" / "Pedir cambios" (campo con la nota) / "Corregir datos" / "Sacar de la muestra" (confirmación: "La obra deja de estar en la muestra, en las fichas y en el plano."). Resumen arriba: "12 expositores · 30 obras en la muestra · 4 para revisar · 2 con cambios pedidos". Pie: "Sacar a esta persona de la muestra". Contadores en "Mis muestras", en la página de la muestra y en el inicio del panel (allí también la tarjeta "Donde expongo" con las obras con cambios pedidos para quien expone).

- [ ] **Step 4: Correr y probar**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: en verde. En local: aprobar → aparece en la galería según la visibilidad, en Montaje y en el plano; pedir cambios → E corrige y reenvía; cambiar el título en la ficha → E lo ve.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: la organización aprueba, pide cambios, corrige o saca obras de expositores; el editor respeta su imagen y autoría"
```

**Acceptance:** lo aprobado aparece en todo lo existente sin cambiar esas piezas; el editor nunca pisa la imagen ni el autor de una obra de expositor.

---

### Task 13: Fichas, catálogo y plano con los datos del expositor y el QR de sala

**Files:**
- Create: `apps/muestras/lib/sala/codigos.ts` (+ `codigos.test.ts`)
- Modify: `apps/muestras/lib/fichas/{texto.ts, cargar.ts, pdf.ts}` (+ tests), `apps/muestras/lib/piezas/{cargar.ts, catalogo.ts, textos.ts}` (+ tests), `apps/muestras/lib/montaje/consultas.ts`, `apps/muestras/components/montaje/editor-montaje.tsx`

**Interfaces:**
- Consumes: `roomCodeFrom`, `isRoomCode` (Task 3); `scanUrl(base, "s", code)`; `fichaDetail` (Task 2).
- Produces:
  - `asegurarCodigosDeSala(activityId, workIds): Promise<Map<string, string>>` (`server-only`): crea los que faltan con `createMany({ skipDuplicates: true })` y `roomCodeFrom(randomBytes(12))`; si choca una PK, reintenta hasta 3 veces; devuelve el mapa completo (estable para reimprimir).
  - `datosDeFicha(a, o, baseUrl, extra?: { codigo?; detalle? })`: QR `/q/s/<código>` si hay código (si no, `/q/o/<id>`); detalle del expositor si corresponde.
  - Fichas y piezas cargan los datos del expositor por `activityWorkId`. Catálogo: medidas, edición y texto de la obra; **nunca** el precio. Editor del plano: al colgar una obra de expositor, propone su medida con marco (editable).

- [ ] **Step 1: Tests que fallan**

`codigos.test.ts`: crea sólo los que faltan; reintenta ante choque; misma respuesta en la segunda llamada. `fichas/texto.test.ts`: con código → `…/q/s/<código>`; sin código → `/q/o/<id>`; detalle "2024. Giclée. 40 × 60 cm. Edición 2/10". `catalogo.test.ts`: medidas y edición sí; el texto armado no contiene el precio.

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- sala/codigos fichas catalogo`
Expected: FAIL.

- [ ] **Step 3: Implementar.** Las fichas llaman `asegurarCodigosDeSala` antes de armar el PDF, sólo con la muestra publicada (como ya exige el QR). El PDF de la ficha suma la línea de detalle si entra. Sin cambios de permisos (`pieces`).

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

### Task 14: Pase de sala — `/q/s`, vista de sala, imágenes por proxy, "Adquirir obra" y privacidad

**Files:**
- Create: `apps/muestras/lib/sala/{llave.ts, consultas.ts, acciones.ts}` (+ tests), `apps/muestras/app/m/[slug]/sala/page.tsx`, `apps/muestras/app/m/[slug]/sala/o/[workId]/page.tsx`, `apps/muestras/app/m/[slug]/sala/o/[workId]/adquirir/page.tsx`, `apps/muestras/app/m/[slug]/sala/img/[id]/route.ts`, `apps/muestras/lib/sala/img-ruta.test.ts`, `apps/muestras/lib/sala/adquirir.test.ts`, `apps/muestras/components/sala/{obra-de-sala.tsx, boton-adquirir.tsx}`
- Modify: `apps/muestras/lib/estadisticas/qr.ts`, `apps/muestras/app/q/[tipo]/[id]/route.ts` (+ `lib/estadisticas/qr-ruta.test.ts`), `apps/muestras/lib/limite.ts` (+ `.test.ts`), `apps/muestras/app/panel/muestras/[id]/visibilidad/page.tsx`, `apps/muestras/app/privacidad/page.tsx`

**Interfaces:**
- Consumes: `mergeRoomPass`, `encodeRoomPass`, `decodeRoomPass`, `roomPassValid`, `roomPassCookieName`, `isRoomCode`, `showBuyButton`, `saleState`, `SALES_ENABLED`, `SALE_UNAVAILABLE_TEXT`, `SALE_ASK_TEXT` (Task 3); `parseVisibility`, `roomExhibitedWorks`, `visibleWorks` (Task 1); `leerDeR2`; `esDelEquipo`; `buscarPerfilPublico`.
- Produces:
  - `lib/sala/llave.ts`: `llaveDeMuestra(activityId)` (lee o crea con `randomBytes(32).toString("hex")`; `upsert` con `update: {}`), `firmarPase(pase, llave)` (`<payload>.<hmac base64url>`), `leerPase(valor, llave)` (`timingSafeEqual`, largo fijo, nunca lanza), `rotarLlave(activityId)`.
  - `destinoDelQr("s", code)` → `{ path: "/m/<slug>/sala/o/<workId>", activityId, workId, metric: "SCAN", pase: true }` si el código existe, la obra está en la muestra y está publicada.
  - `/q/[tipo]/[id]`: con `destino.pase`, lee la cookie, la valida, `mergeRoomPass`, firma y responde 302 con `Set-Cookie: mf_sala_<id>=<valor>; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Lax` (sin `Secure` sólo fuera de producción, para `next dev` en http). `HEAD`: sin cookie ni conteo.
  - `paseDeSala(slug)` (`cookies()` + muestra publicada con `select` mínimo + llave → `{ actividad, pase, equipo }`; `equipo` = `esDelEquipo(id)`, que ve como si hubiera escaneado todo).
  - `vistaDeSala(actividad, pase, workId?)`: obras permitidas por `roomExhibitedWorks` unidas a las visibles online; la pedida (si no está permitida → `null`); el artista con biografía completa; sus otras obras permitidas; su portfolio si `room.portfolio`; sus otras muestras publicadas si `room.otherExhibitions`; `mostrarAdquirir = showBuyButton({ roomBuy: v.room.buy, forSale })`; **todas** las imágenes de obras como `/m/<slug>/sala/img/<id>`; **sin** `priceArs`.
  - `imagenDeSalaPermitida(slug, id)`.
  - `cortarAccesosDeSala(activityId)`, `cambiarCodigosDeSala(activityId)` (`visibility`; el segundo avisa "Los QR impresos dejaron de dar acceso. Volvé a bajar e imprimir las fichas.").
  - `lib/limite.ts`: `vistaSala` 300/10 min e `imagenSala` 600/10 min por IP.

- [ ] **Step 1: Tests que fallan**

`llave.test.ts`: firmar y leer; un carácter cambiado, otra llave o basura → `null` sin excepción.
`qr-ruta.test.ts` (sumar): `/q/s/<código>` → 302 a la vista de sala, `Cache-Control: private, no-store`, `Set-Cookie` con `mf_sala_<id>`, `HttpOnly`, `SameSite=Lax`, `Max-Age=28800`, y cuenta un `SCAN`; con cookie previa válida, la nueva lleva las dos obras; código inexistente → `/` sin cookie; **`/q/o/<obra>` no pone cookie**; muestra despublicada → `/`.
`consultas.test.ts`: sin pase, pase de otra muestra o vencido → redirige a la pública; pase con `a1` y "ARTIST" → `a1` y `a2`, no `c1`; pedir `c1` → redirige; equipo sin pase → todo; `JSON.stringify` de `vistaDeSala` sin URL del bucket de obras y **sin `priceArs`**; `mostrarAdquirir` sólo con `room.buy` y `forSale`.
`img-ruta.test.ts` (patrón de `lib/curaduria/imagen-ruta.test.ts`): sin pase → 404 `no-store`; con pase y obra permitida → 200 con `private, max-age=600`, `Referrer-Policy: no-referrer`, `nosniff`, `Content-Disposition: inline`; tipo `image/svg+xml` → 404; no permitida → 404.
`adquirir.test.ts`: con pase y obra a la venta → el árbol contiene `SALE_UNAVAILABLE_TEXT` y `SALE_ASK_TEXT` y **no** el precio; sin pase → redirige a la página pública; obra no marcada para vender → `notFound()`.
`acciones.test.ts`: capacidades; rotar cambia el `secret`; cambiar códigos borra sólo los de esa muestra.

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- sala qr-ruta`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- `sala/o/[workId]/page.tsx`: `dynamic = "force-dynamic"`; `robots: { index: false, follow: false }`, `referrer: "no-referrer"`; título "<obra> · en la sala" sin `openGraph` con imagen; freno `vistaSala`; sin vista → `redirect(workPath(slug, workId))`. `ObraDeSala`: la obra grande (proxy), título, autor, `fichaDetail`, texto de la obra; `BotonAdquirir` ("Adquirir obra" → `./adquirir`) si `mostrarAdquirir`; "Sobre <artista>" (foto, biografía completa, ciudad, web, Instagram, "Ver perfil"); "Otras obras de <artista> en esta muestra" (cada una enlaza a su vista de sala); "Portfolio de <artista>" (visor); "También expuso en"; baliza `ContarVisita` con `actividad` y `obra`; "Ver toda la muestra" (`/m/<slug>`) y "Lo que escaneaste" (`/m/<slug>/sala`).
- `sala/o/[workId]/adquirir/page.tsx`: dinámica, `noindex`; misma validación del pase; título y autor; `saleState({ salesEnabled: SALES_ENABLED, forSale })`: `UNAVAILABLE` → "La venta de esta obra todavía no está disponible." + "Si te interesa, consultá a la organización en la sala." + "Volver a la obra"; `NOT_FOR_SALE` → `notFound()`. Comentario: la etapa de Ventas suma `AVAILABLE` con el precio y la compra por DNX Payments en esta misma página.
- `sala/page.tsx`: lo escaneado (miniaturas por proxy) y hasta qué hora vale ("Tu acceso de sala vale hasta las 23:40."); sin pase → `redirect("/m/<slug>")`.
- `sala/img/[id]/route.ts`: `runtime = "nodejs"`, `dynamic = "force-dynamic"`, freno `imagenSala`; `imagenDeSalaPermitida` → `leerDeR2` → mismos controles de tipo y encabezados que `app/api/curaduria/obras/[id]/imagen/route.ts`.
- Visibilidad: "Cortar los accesos de sala" ("Los pases vigentes dejan de valer. Quien vuelva a escanear una ficha recibe uno nuevo.") y "Cambiar los códigos de sala" (confirmación).
- `/privacidad`: **pase de sala** ("Cuando escaneás el QR de una ficha en la sala, tu teléfono guarda por 8 horas una cookie que sólo dice qué obras escaneaste en esa muestra y hasta cuándo vale. No te identifica y no la usamos para contar visitas.") y **expositores y portfolio** ("Si exponés, tu perfil y tu portfolio son públicos; las fotos de tus obras se muestran según lo que elija quien organiza. Las notas para el montaje y el precio sólo los ve la organización.").

- [ ] **Step 4: Correr**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: en verde.

- [ ] **Step 5: Probar en local**

Con "Sorpresa total": bajar las fichas, escanear un QR con el teléfono (o abrir `http://localhost:3014/q/s/<código>`): obra, artista, portfolio, "Adquirir obra" → "La venta de esta obra todavía no está disponible", sin precio. Copiar la dirección a una ventana privada → versión pública con el aviso sin imagen. Imagen de sala en ventana privada → 404. "Cortar los accesos de sala" y recargar en el teléfono → versión pública.

- [ ] **Step 6: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: pase de sala de 8 horas — el QR de la ficha muestra la obra, el artista, su portfolio y 'Adquirir obra'; un enlace compartido respeta la sorpresa"
```

**Acceptance:** sin la cookie nunca se ve una obra oculta; `/q/o/<id>` no da pase; ni URL del bucket ni precio en la vista de sala.

---

### Task 15: Verificación final, migración en producción, guía y PR

**Files:**
- Modify: `docs/operations/muestras-puesta-en-marcha.md` (sección "Etapa 6")

- [ ] **Step 1: Rebasar y todos los chequeos**

Si las etapas 4 y 5 ya están en `origin/main`: `git fetch origin && git rebase origin/main` (resolver sólo conflictos de esta etapa). Después:

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter @repo/muestras lint && pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice typecheck && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras build`
Expected: todo en verde. En la tabla de rutas del build: `/expositores/[token]`, `/panel/expositor`, `/panel/expositor/[id]`, `/panel/muestras/[id]/expositores`, `/panel/muestras/[id]/visibilidad`, `/api/m/[slug]/anticipo`, `/m/[slug]/sala`, `/m/[slug]/sala/o/[workId]`, `/m/[slug]/sala/o/[workId]/adquirir` y `/m/[slug]/sala/img/[id]` como **dinámicas** (`ƒ`); `/m/[slug]`, `/m/[slug]/o/[workId]` y `/fotografos/[slug]` **siguen con revalidación**. `git diff origin/main -- pnpm-lock.yaml` vacío. `grep -rn "cookies()" apps/muestras/app/m apps/muestras/app/fotografos | grep -v "/sala/"` vacío. `grep -rn "priceArs" apps/muestras/app/m apps/muestras/app/fotografos apps/muestras/components/ficha apps/muestras/components/sala apps/muestras/lib/sala apps/muestras/lib/anticipo | grep -v "\.test\."` vacío.

- [ ] **Step 2: Aplicar la migración en producción — la hace el controlador (autorizado por Daniel)**

Daniel tiene que autorizarla. Qué hace: suma **una** columna optativa a `CulturalActivity` (sin reescribir la tabla) y crea seis tablas vacías; no modifica ni borra datos. **Requisito: las de las etapas 4 y 5 ya aplicadas** (`select migration_name from "_prisma_migrations" where migration_name like '%muestras_etapa_4%' or migration_name like '%muestras_etapa_5%';` → dos filas). Va **antes** de publicar el código: sin la columna, todo el sitio de Muestras deja de andar. Si algo sale mal (y sólo si el código nuevo **no** está publicado):
```sql
drop table "CulturalExhibitorWork", "CulturalExhibitor", "CulturalExhibitorLink", "PhotographerPortfolioPhoto", "CulturalActivityRoomCode", "CulturalActivityRoomKey";
alter table "CulturalActivity" drop column "visibility";
```

1. Correr `packages/db/prisma/migrations/20261031120000_muestras_etapa_6_expositores/migration.sql` en la rama `development` (`br-old-rain-adwthzng`) del proyecto `divine-hall-10689679` (Neon MCP `run_sql_transaction`, una sentencia por elemento, sin comentarios).
2. Verificar:
```sql
select table_name from information_schema.tables
where table_name in ('CulturalExhibitorLink','CulturalExhibitor','CulturalExhibitorWork','PhotographerPortfolioPhoto','CulturalActivityRoomCode','CulturalActivityRoomKey') order by table_name;
select column_name, data_type, is_nullable from information_schema.columns
where table_name = 'CulturalActivity' and column_name = 'visibility';
select count(*) from "CulturalActivity" where "visibility" is not null;
select conname from pg_constraint
where conname like 'CulturalExhibitor%fkey' or conname like 'CulturalActivityRoom%fkey' or conname like 'PhotographerPortfolioPhoto%fkey' order by conname;
```
Expected: las seis tablas; `visibility | jsonb | YES`; `0` (ninguna muestra cambia: todas siguen como antes, D24); ocho claves foráneas.
3. Probar los tipos que manda la app, en una transacción que se deshace:
```sql
begin;
insert into "CulturalActivityRoomKey" ("activityId", "secret") select id, repeat('a', 64) from "CulturalActivity" limit 1;
select pg_typeof("secret"), pg_typeof("createdAt") from "CulturalActivityRoomKey" limit 1;
rollback;
```
Expected: `text | timestamp without time zone`.
4. Registrar con el checksum:

Run: `shasum -a 256 packages/db/prisma/migrations/20261031120000_muestras_etapa_6_expositores/migration.sql`
```sql
insert into "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
values (gen_random_uuid()::text, '<sha256 del paso anterior>', now(), '20261031120000_muestras_etapa_6_expositores', null, null, now(), 1);
```
5. Confirmar: `select migration_name, checksum from "_prisma_migrations" where migration_name = '20261031120000_muestras_etapa_6_expositores';` → una fila con el mismo checksum.

- [ ] **Step 3: Recorrido completo en local contra la base ya migrada**

Con `pnpm --filter muestras dev`, correo apagado, cuentas A (dueña), B (coorganización), C (textos), E1 y E2 (expositores):
1. A genera el enlace: se le pide elegir la visibilidad (acepta la sugerencia). E1 y E2 se suman, cargan obras y portfolio y envían; una incompleta no se envía; una foto de portfolio igual a su obra se rechaza.
2. B aprueba dos, pide cambios en otra; E1 corrige y reenvía; B aprueba. C no ve "Expositores" ni "Visibilidad" (404 por dirección) y edita un título que E1 ve en "Donde expongo".
3. Página pública con "Adelanto", "Sorpresa total" y "Cambian para cada visitante": el código fuente no tiene URL de obras ocultas; en el modo por visitante cambian al recargar y el panel avisó.
4. Fichas → escanear con el teléfono → vista de sala → "Adquirir obra" → "La venta de esta obra todavía no está disponible", sin precio. Compartir la dirección a otro teléfono → versión pública. Imagen de sala sin pase → 404.
5. "Cortar los accesos de sala" → el teléfono vuelve a la versión pública hasta que escanea de nuevo.
6. Difusión: "Obra destacada" según el modo.
7. Estadísticas: el escaneo por `/q/s` suma en la obra.
8. Una muestra de prueba con 100 obras: catálogo (tiempo) y marcos por tandas.
9. A 375 px: `/expositores/<token>`, `/panel/expositor/<id>`, `/panel/perfil` (portfolio), `/panel/muestras/<id>/expositores`, `/panel/muestras/<id>/visibilidad`, `/m/<slug>` con "Artistas" y la vista de sala, sin scroll horizontal.
10. Una muestra vieja sin ajuste se ve exactamente igual que antes.

- [ ] **Step 4: Guía de puesta en marcha**

Agregar al final de `docs/operations/muestras-puesta-en-marcha.md`:
```markdown
## Etapa 6 (expositores por enlace, portfolio y sorpresa de la muestra)

1. Verificar que las migraciones de las etapas 4 y 5 están aplicadas. — Controlador.
2. Aplicar la migración `20261031120000_muestras_etapa_6_expositores` y registrarla con su SHA-256 (plan de la etapa 6, Task 15 Step 2). — Controlador, autorizado por Daniel. **Antes** del deploy: sin la columna `visibility` se cae todo el sitio de Muestras.
3. Confirmar que el proyecto de Vercel de Muestras admite funciones de 300 s (`/api/piezas`). Si no, avisar antes de fusionar: hay que bajar el tope técnico de obras. — Daniel o controlador.
4. Fusionar el PR. No hay variables de entorno nuevas (la llave del pase de sala vive en la base, una por muestra).
5. Apenas se publica, con una muestra de prueba: generar el enlace, sumarse desde otra cuenta, aprobar una obra, bajar las fichas y escanear un QR: tiene que abrir la vista de sala; compartida a otro teléfono, la versión pública.
6. Avisar a quienes organizan que para el pase de sala hay que imprimir las fichas nuevas (el aviso está en Visibilidad y en Montaje e impresión). — Daniel.
```

- [ ] **Step 5: Commit y PR**

```bash
git add docs/operations/muestras-puesta-en-marcha.md
git commit -m "Guía de puesta en marcha de la Etapa 6 de Muestras"
git push -u origin feat/muestras-etapa-6
gh pr create --base main --title "Muestras Fotográficas — Etapa 6: expositores por enlace y sorpresa de la muestra" --body "<resumen en español: enlace de expositores con alta por Google y perfil, obras con todos los datos para ficha y montaje, aprobación por obra; portfolio del artista; sin tope de 40 (tope técnico 300, marcos por tandas); visibilidad por punto de entrada con presets, obras fijas o distintas para cada visitante; artistas con biografía y portfolio online; pase de sala de 8 horas desde /q/s/<código> con vista de sala, imágenes por proxy y 'Adquirir obra' (venta todavía no disponible, sin precio); qué no se filtra y cómo se probó; migración ya aplicada (requiere las de las etapas 4 y 5); reimprimir fichas; checklist del Step 3>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```
(Si la etapa 5 todavía no se fusionó, abrir el PR con `--base feat/muestras-etapa-5` y decirlo en la descripción.)

---

## Etapa 6 (expositores por enlace y sorpresa)

Resumen para quien ejecute: Tasks 1–3 son reglas puras (paralelizables); la 4 es la migración (sin aplicar); la 5 saca el tope de 40; 6–7 visibilidad pública (incluido el anticipo por visitante) y su panel; 8 portfolio; 9–12 expositores (enlace, alta, carga, revisión y editor); 13 fichas, catálogo y plano; 14 pase de sala, "Adquirir obra" y privacidad; 15 verificación, migración en producción y PR.

## Cobertura del spec

| Spec | Task |
|---|---|
| D1 enlace único reutilizable, renovar, cerrar | 4, 9 |
| D2 aprobación por obra | 2, 12 |
| D3 alta con Google, perfil, derechos | 10 |
| D4 obra = foto que se cuelga + datos | 2, 4, 11 |
| D5 datos obligatorios y optativos; precio sólo para la organización | 2, 11, 12 |
| D6 topes optativos del enlace | 2, 9, 10, 11 |
| D7 estados | 2, 11, 12 |
| D8 copia a `CulturalActivityWork`, `FOR UPDATE`, `canEdit` | 2, 12 |
| D9 convivencia con el editor y el rol de textos | 12 |
| D10 en qué estados anda el enlace | 2, 9, 10 |
| D11 capacidad `exhibitors`; el expositor no es del equipo | 1, 9–12 |
| D12 sin correo | 11, 12 |
| D13–D16 portfolio del artista | 2, 4, 6, 8, 14 |
| D17 `MAX_WORKS` = 300 técnico | 5 |
| D18 marcos por tandas, catálogo liviano, `maxDuration` | 5 |
| D19 12 destacadas | 1, 5 |
| D20 ajuste JSON | 1, 4 |
| D21 presets | 1, 7 |
| D22 al azar fijo o diario | 1, 7 |
| D23 al azar para cada visitante, ruta del anticipo | 1, 6, 7 |
| D24 sin ajuste impuesto; elección al generar el enlace; `galleryMode` | 1, 7, 9 |
| D25 una sola regla para lo público | 1, 6 |
| D26 "Artistas" | 6 |
| D27 después del cierre | 1, 6 |
| D28 capacidad `visibility`, aviso de portada | 1, 7 |
| D29 código de sala; `/q/o` sin pase | 3, 13, 14 |
| D30 cookie HMAC, 8 horas | 3, 4, 14 |
| D31 vista de sala | 14 |
| D32 imágenes por proxy | 14 |
| D33 "Adquirir obra" y página de venta sin precio | 3, 14 |
| D34 cortar accesos, cambiar códigos | 14 |
| D35 escaneos de `/q/s` | 3, 14 |
| D36 panel | 2, 7, 8, 9, 11, 12 |
| D37 aviso de reimprimir en Visibilidad y Montaje | 5, 7 |
| D38 fichas, catálogo y plano | 13 |
| D39 piezas para redes | 3, 6 |
| D40 convocatoria convive | 12 (sin cambios en la convocatoria) |
| D41 sin dependencias nuevas | todas |
| Migración a mano + checksum, después de las etapas 4 y 5 y antes del deploy | 4, 15 |
| Lista de control de filtraciones | 6, 14, 15 |
