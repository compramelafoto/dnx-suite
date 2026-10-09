# Muestras Fotográficas — Etapa 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el organizador tenga todo lo que necesita **en la sala**: marcos, cartel con el texto curatorial, catálogo y plano de montaje en PDF; estadísticas de visitas y escaneos de QR; y un libro de visitas digital al que el público llega escaneando un afiche.

**Architecture:** Igual que las etapas 1 a 3: las reglas (medidas y diagramación de las piezas, plano de montaje, métricas, gráfico, libro de visitas) son funciones puras en `packages/muestras` con vitest; la app es una capa delgada sobre `@repo/db`. Los PDF se arman en el servidor con `pdf-lib` (como las fichas) y, si pesan más de 4 MB, se suben a R2 y se redirige. Los QR pasan por `/q/<tipo>/<id>`, que cuenta y redirige. Las visitas se cuentan con una baliza del navegador en contadores diarios agregados, sin datos personales. Migración escrita a mano: cuatro columnas en `CulturalActivity` y dos tablas nuevas.

**Tech Stack:** Next.js 16.2.1 (App Router, `params` como Promise, `--webpack`), React 19.2.4, Prisma 6 (`@repo/db`), Tailwind 4, `pdf-lib 1.17.1`, `qrcode ^1.5.4`, `sharp 0.34`, `@aws-sdk/client-s3` (ya en la app), vitest 3. **Sin dependencias nuevas.**

**Spec:** `docs/superpowers/specs/2026-10-09-muestras-etapa-4-design.md` (decisiones D1–D22). Diseño general: `docs/superpowers/specs/2026-10-08-muestras-fotograficas-design.md`.

## Global Constraints

- Todo texto visible y todo comentario en **español rioplatense con voseo**, claro y sin "próximamente"; identificadores en inglés dentro de `packages/muestras`, en español en la app.
- Estados y modos como **texto** (`String`), nunca enum de Prisma. Ids de usuario `Int` **sin relación Prisma a `User`**. Ids `cuid()`.
- Fechas en **hora argentina (UTC−3)** con `dayStartAr`, `dayEndAr`, `toArDay`, `formatArDay` (y los nuevos `formatArDayLong`, `dateRangeText`, `addArDays`) de `@repo/muestras`. Nunca `toLocaleDateString` sin zona. El día de los contadores es **texto `AAAA-MM-DD`**.
- **Sin dependencias nuevas** ni versiones fuera del lockfile. Después de cualquier `pnpm install`, `git diff pnpm-lock.yaml` tiene que estar vacío; si se mueve, frenar y avisar.
- Chequeos de tipos y build con `NODE_OPTIONS=--max-old-space-size=8192` (si no, el proceso muere por memoria y a veces devuelve éxito igual). Mirar que el build realmente terminó.
- Diseño: tokens de `apps/muestras/app/globals.css` (`--mf-bg`, `--mf-ink`, `--mf-muted`, `--mf-line`, `--mf-surface`, `--mf-teal`, `--mf-spot`, `--mf-alerta`), `.mf-titulo`, `.mf-marco`, líneas finas, botones finos (`h-11 border border-[var(--mf-ink)] px-5`), esquinas `rounded-[2px]`. Nada de cajas de color. Las clases repetidas del panel van en `components/montaje/estilos.ts`.
- PDF: `pdf-lib` con Helvetica y todo texto pasado por `paraWinAnsi`; QR vectorial (`dibujarQr`); colores `TINTA`, `GRIS`, `LINEA`, `NEGRO` de `lib/piezas/dibujo.ts`; fecha del documento fija (la `updatedAt` de la muestra) para que el mismo contenido dé los mismos bytes.
- **Autorización del lado del servidor en cada página, acción y ruta.** Cada `page.tsx` del panel llama `requireUsuario(<su propia ruta>)`; cada server action vuelve a leer la sesión y verifica que sea el dueño (`proposedByUserId`) o super admin. Toda negativa del panel es `notFound()`.
- **Privacidad:** ninguna tabla guarda IP, user-agent, cookie ni usuario de quien visita o comenta. La IP se usa sólo en memoria y convertida con `huellaDeIp`.
- En páginas públicas **no** aparecen palabras de revisión ni aprobación.
- Puerto de desarrollo **3014**. Probar con `next dev` (las vistas previas de Vercel no sirven).
- Trabajar en el worktree `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-muestras`, rama `feat/muestras-etapa-4` (sale de `origin/main` con las etapas 1 a 3).
- La migración **no se aplica sola**: la aplica **a mano en producción el controlador**, con la autorización de Daniel, la registra en `_prisma_migrations` con el SHA-256 del archivo, y **antes** de publicar el código (Task 14). Una columna de `CulturalActivity` sin aplicar rompe **todo** el sitio.

## Mapa de archivos

```
packages/muestras/src/
  print.ts (+ print.test.ts)               — medidas, orientación, diagramación del marco, ppp, catálogo, índice de autores
  dates.ts (+ dates.test.ts)               — formatArDayLong, dateRangeText, addArDays
  hanging.ts (+ hanging.test.ts)           — plano de montaje: lectura, problemas, posiciones, avisos
  stats.ts (+ stats.test.ts)               — métricas, robots, QR con conteo, ventana, series, totales, gráfico
  guestbook.ts (+ guestbook.test.ts)       — libro de visitas: modos, estados, entrada, problemas, cuándo recibe
  panel.ts (+ panel.test.ts)               — Estadísticas lista
  index.ts                                 — reexporta print, hanging, stats, guestbook
packages/db/prisma/schema.prisma           — columnas en CulturalActivity; CulturalActivityDailyStat; CulturalActivityGuestbookEntry
packages/db/prisma/migrations/20261029120000_muestras_etapa_4_sala/migration.sql
apps/muestras/
  lib/limite.ts (+ .test.ts)               — huella de IP, frenos nuevos, freno por muestra
  lib/imagenes/r2.ts (+ .test.ts)          — leerBytesDeR2, subirPdfAR2
  lib/piezas/dibujo.ts                     — lo común de los PDF (sale de lib/fichas/pdf.ts)
  lib/piezas/imagen.ts (+ .test.ts)        — foto del bucket → JPEG para el PDF
  lib/piezas/entregar.ts (+ .test.ts)      — PDF directo o 303 a R2
  lib/piezas/textos.ts (+ .test.ts)        — datos de cartel, catálogo, afiche y montaje
  lib/piezas/marco.ts, cartel.ts (+ .test.ts)
  lib/piezas/catalogo.ts, afiche-libro.ts (+ .test.ts)
  lib/piezas/montaje.ts (+ .test.ts)
  lib/piezas/opciones.ts (+ .test.ts), cargar.ts, armar.ts (+ .test.ts)
  lib/fichas/pdf.ts, lib/fichas/texto.ts   — usan dibujo.ts; el QR pasa a /q/o/<id>
  lib/actividades/mapear.ts (+ .test.ts)   — texto curatorial y créditos
  lib/actividades/consultas.ts             — listarMuestrasParaMontaje
  lib/estadisticas/contar.ts (+ .test.ts), qr.ts (+ .test.ts), consultas.ts, resumen.ts (+ .test.ts)
  lib/montaje/acciones.ts (+ .test.ts), consultas.ts
  lib/libro/acciones.ts (+ .test.ts), consultas.ts
  lib/panel/en-preparacion.ts (+ .test.ts) — sin Estadísticas ni MONTAJE_EN_PREPARACION
  app/q/[tipo]/[id]/route.ts (+ lib/estadisticas/qr-ruta.test.ts)
  app/api/visitas/route.ts (+ lib/estadisticas/visitas-ruta.test.ts)
  app/api/piezas/[id]/[pieza]/route.ts (+ lib/piezas/ruta.test.ts)
  app/m/[slug]/page.tsx                    — texto curatorial, últimos comentarios, baliza
  app/m/[slug]/o/[workId]/page.tsx         — baliza
  app/m/[slug]/libro/page.tsx
  app/panel/montaje/page.tsx, app/panel/montaje/[id]/page.tsx
  app/panel/estadisticas/page.tsx, [id]/page.tsx, [id]/libro/page.tsx
  app/panel/muestras/[id]/page.tsx         — enlaces a Montaje y Estadísticas
  app/privacidad/page.tsx                  — visitas y libro de visitas
  components/formulario/formulario-actividad.tsx — campos de texto curatorial y curaduría
  components/estadisticas/{contar-visita.tsx, grafico-diario.tsx}
  components/montaje/{estilos.ts, descargar-marcos.tsx, descargas.tsx, editor-montaje.tsx}
  components/libro/{formulario-libro.tsx, ultimos-comentarios.tsx, moderar-libro.tsx}
docs/operations/muestras-puesta-en-marcha.md — sección "Etapa 4"
```

Orden: 1 → 2 → 3 → 4 (schema) → 5 → … → 14. Las Tasks 1–3 son independientes entre sí; desde la Task 5 todo usa el cliente Prisma con los campos y modelos nuevos (Task 4). Los tests de la app mockean `@repo/db`, `@/lib/usuario`, `next/cache`, `next/headers` y R2 con el mismo patrón que `lib/actividades/acciones.test.ts` y `lib/fichas/ruta.test.ts`.

---
### Task 1: Reglas de impresión y fechas largas

**Files:**
- Create: `packages/muestras/src/print.ts`
- Modify: `packages/muestras/src/dates.ts`, `packages/muestras/src/index.ts`
- Test: `packages/muestras/src/print.test.ts`, `packages/muestras/src/dates.test.ts`

**Interfaces:**
- Consumes: `toArDay`, `dayStartAr` (`dates.ts`), `normalizeName` (`profile.ts`).
- Produces:
  - `dates.ts`: `formatArDayLong(d): string` ("5 de noviembre de 2026"), `dateRangeText(startsAt, endsAt): string`, `addArDays(day, n): string`
  - `print.ts`: `SizeMm`, `PixelSize`, `Box`; `FRAME_SIZES`, `FrameSize`, `isFrameSize`; `POSTER_SIZES`, `PosterSize`, `isPosterSize`; `CATALOG_SIZES`, `CatalogSize`, `isCatalogSize`; `GUESTBOOK_POSTER_SIZES`, `GuestbookPosterSize`, `isGuestbookPosterSize`; `ORIENTATIONS`, `Orientation`, `ORIENTATION_LABELS`, `isOrientation`; `resolveOrientation`, `orientedPage`, `fitInside`; `FRAME_MARGIN_RATIO`, `FRAME_BOTTOM_FACTOR`, `FrameLayout`, `frameLayout(size, orientation, image)`; `printPpi`, `PrintQuality`, `printQuality`, `QUALITY_LABELS`, `WEB_IMAGE_LONG_SIDE`, `TYPICAL_IMAGE`, `expectedQuality(size)`; `largestThatFits(sizes, fits)`; `CatalogPlan`, `catalogPlan(curatorialPages, works, indexPages)`; `AuthorIndexEntry`, `authorIndex(entries)`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `packages/muestras/src/dates.test.ts`:
```ts
import { addArDays, dateRangeText, formatArDayLong } from "./dates";

describe("fechas largas", () => {
  const d = (day: string) => dayStartAr(day);
  it("día largo en hora argentina", () => {
    expect(formatArDayLong(d("2026-11-05"))).toBe("5 de noviembre de 2026");
    // 02:30 UTC del 6 todavía es el 5 en Argentina.
    expect(formatArDayLong(new Date("2026-11-06T02:30:00Z"))).toBe("5 de noviembre de 2026");
  });
  it("rangos según mes y año", () => {
    expect(dateRangeText(d("2026-11-05"), dayEndAr("2026-11-05"))).toBe("5 de noviembre de 2026");
    expect(dateRangeText(d("2026-11-05"), dayEndAr("2026-11-20"))).toBe("Del 5 al 20 de noviembre de 2026");
    expect(dateRangeText(d("2026-11-05"), dayEndAr("2026-12-20"))).toBe("Del 5 de noviembre al 20 de diciembre de 2026");
    expect(dateRangeText(d("2026-12-20"), dayEndAr("2027-01-10"))).toBe("Del 20 de diciembre de 2026 al 10 de enero de 2027");
  });
  it("sumar días cruza meses y años", () => {
    expect(addArDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addArDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
```
(Si `dayStartAr`/`dayEndAr`/`describe` ya están importados arriba en ese archivo, no duplicar los imports: sumar sólo los nombres nuevos.)

`packages/muestras/src/print.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  FRAME_SIZES, TYPICAL_IMAGE, authorIndex, catalogPlan, expectedQuality, fitInside, frameLayout, isFrameSize,
  isOrientation, largestThatFits, printPpi, printQuality, resolveOrientation,
} from "./print";

describe("orientación", () => {
  it("automática según la foto; cuadrada o sin dato, vertical", () => {
    expect(resolveOrientation("AUTO", { width: 3000, height: 2000 })).toBe("LANDSCAPE");
    expect(resolveOrientation("AUTO", { width: 2000, height: 3000 })).toBe("PORTRAIT");
    expect(resolveOrientation("AUTO", { width: 2000, height: 2000 })).toBe("PORTRAIT");
    expect(resolveOrientation("AUTO", null)).toBe("PORTRAIT");
    expect(resolveOrientation("PORTRAIT", { width: 3000, height: 2000 })).toBe("PORTRAIT");
  });
  it("valida medidas y orientaciones", () => {
    expect(isFrameSize("40x50")).toBe(true);
    expect(isFrameSize("toString")).toBe(false);
    expect(isOrientation("LANDSCAPE")).toBe(true);
    expect(isOrientation("x")).toBe(false);
  });
});

describe("fitInside", () => {
  it("entra entera, sin recorte, centrada", () => {
    const r = fitInside({ x: 10, y: 20, width: 100, height: 100 }, { width: 200, height: 100 });
    expect(r).toEqual({ x: 10, y: 45, width: 100, height: 50 });
  });
});

describe("frameLayout", () => {
  it("A4 con foto horizontal: página apaisada, margen del 12 % y abajo más ancho", () => {
    const l = frameLayout("A4", "AUTO", { width: 2000, height: 1333 });
    expect(l.orientation).toBe("LANDSCAPE");
    expect(l.page).toEqual({ width: 297, height: 210 });
    expect(l.margin).toBeCloseTo(25.2, 5);
    expect(l.window.y).toBeCloseTo(25.2 * 1.6, 5);
    expect(l.window.x).toBeCloseTo(25.2, 5);
  });
  it("la foto queda dentro de la ventana, con su proporción, centrada en horizontal", () => {
    const l = frameLayout("40x50", "PORTRAIT", { width: 2000, height: 1333 });
    expect(l.image.width / l.image.height).toBeCloseTo(2000 / 1333, 5);
    expect(l.image.x).toBeGreaterThanOrEqual(l.window.x - 1e-9);
    expect(l.image.x + l.image.width).toBeLessThanOrEqual(l.window.x + l.window.width + 1e-9);
    expect(l.image.y).toBeGreaterThanOrEqual(l.window.y - 1e-9);
    expect(l.image.x - l.window.x).toBeCloseTo(l.window.x + l.window.width - (l.image.x + l.image.width), 5);
  });
  it("el pie va debajo de la foto y la letra crece con el papel", () => {
    const chico = frameLayout("A4", "PORTRAIT", null);
    const grande = frameLayout("50x70", "PORTRAIT", null);
    expect(chico.captionTop).toBeLessThan(chico.image.y);
    expect(grande.titleSizePt).toBeGreaterThan(chico.titleSizePt);
    expect(grande.titleSizePt).toBeLessThanOrEqual(28);
    expect(chico.authorSizePt).toBeLessThan(chico.titleSizePt);
  });
  it("sin dato de la foto, la ventana entera", () => {
    const l = frameLayout("A3", "PORTRAIT", null);
    expect(l.image).toEqual(l.window);
    expect(l.page).toEqual({ width: FRAME_SIZES.A3.width, height: FRAME_SIZES.A3.height });
  });
});

describe("calidad de impresión", () => {
  it("puntos por pulgada de la foto en la caja", () => {
    expect(printPpi({ width: 2000, height: 1000 }, { x: 0, y: 0, width: 254, height: 127 })).toBe(200);
  });
  it("umbrales 200 y 120", () => {
    expect(printQuality(200)).toBe("GOOD");
    expect(printQuality(199)).toBe("FAIR");
    expect(printQuality(120)).toBe("FAIR");
    expect(printQuality(119)).toBe("LOW");
  });
  it("con las fotos web de 2000 px: A4 buena, hasta 40×50 aceptable, 50×70 blanda", () => {
    expect(TYPICAL_IMAGE).toEqual({ width: 2000, height: 1333 });
    expect(expectedQuality("A4")).toBe("GOOD");
    expect(expectedQuality("A3")).toBe("FAIR");
    expect(expectedQuality("30x40")).toBe("FAIR");
    expect(expectedQuality("40x50")).toBe("FAIR");
    expect(expectedQuality("50x70")).toBe("LOW");
  });
});

describe("largestThatFits", () => {
  it("el más grande que entra; si ninguno, el más chico", () => {
    expect(largestThatFits([16, 14, 12, 10], (s) => s <= 13)).toBe(12);
    expect(largestThatFits([16, 14, 12, 10], () => false)).toBe(10);
  });
});

describe("catálogo", () => {
  it("portada, texto, obras, índice y cierre", () => {
    expect(catalogPlan(2, 3, 1)).toEqual({
      coverPage: 1, curatorialFirstPage: 2, firstWorkPage: 4, indexFirstPage: 7, closingPage: 8, totalPages: 8,
    });
  });
  it("sin texto curatorial las obras empiezan en la 2", () => {
    expect(catalogPlan(0, 1, 1)).toEqual({
      coverPage: 1, curatorialFirstPage: null, firstWorkPage: 2, indexFirstPage: 3, closingPage: 4, totalPages: 4,
    });
  });
  it("índice de autores: alfabético, junta mayúsculas y acentos, sin autor al final", () => {
    expect(authorIndex([
      { authorName: "Zoe Ruiz", page: 2 },
      { authorName: "ana pérez", page: 3 },
      { authorName: "Ana Perez", page: 5 },
      { authorName: " ", page: 6 },
      { authorName: "Álvaro Gil", page: 4 },
    ])).toEqual([
      { author: "Álvaro Gil", pages: [4] },
      { author: "ana pérez", pages: [3, 5] },
      { author: "Zoe Ruiz", pages: [2] },
      { author: "Autor sin indicar", pages: [6] },
    ]);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter @repo/muestras test`
Expected: FAIL — `Failed to resolve import "./print"` y `formatArDayLong is not a function`.

- [ ] **Step 3: Implementar las fechas**

Agregar al final de `packages/muestras/src/dates.ts`:
```ts
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

function partesAr(d: Date): { y: number; m: number; d: number } {
  const [y, m, dd] = toArDay(d).split("-").map(Number) as [number, number, number];
  return { y, m, d: dd };
}

/** "5 de noviembre de 2026", en hora argentina. Para carteles y catálogos. */
export function formatArDayLong(d: Date): string {
  const p = partesAr(d);
  return `${p.d} de ${MESES[p.m - 1]} de ${p.y}`;
}

/** "Del 5 al 20 de noviembre de 2026", sin repetir mes ni año cuando coinciden. */
export function dateRangeText(startsAt: Date, endsAt: Date): string {
  if (toArDay(startsAt) === toArDay(endsAt)) return formatArDayLong(startsAt);
  const a = partesAr(startsAt);
  const b = partesAr(endsAt);
  if (a.y === b.y && a.m === b.m) return `Del ${a.d} al ${b.d} de ${MESES[b.m - 1]} de ${b.y}`;
  if (a.y === b.y) return `Del ${a.d} de ${MESES[a.m - 1]} al ${b.d} de ${MESES[b.m - 1]} de ${b.y}`;
  return `Del ${formatArDayLong(startsAt)} al ${formatArDayLong(endsAt)}`;
}

/** Suma (o resta) días a un día "AAAA-MM-DD". */
export function addArDays(day: string, n: number): string {
  return toArDay(new Date(dayStartAr(day).getTime() + n * DAY_MS));
}
```

- [ ] **Step 4: Implementar `print.ts`**

`packages/muestras/src/print.ts`:
```ts
import { normalizeName } from "./profile";

/**
 * Piezas para imprimir (etapa 4): medidas y diagramación, sin dibujar nada. Todo en milímetros
 * con el origen abajo a la izquierda (como el PDF); las letras, en puntos.
 */
export type SizeMm = { width: number; height: number };
export type PixelSize = { width: number; height: number };
export type Box = { x: number; y: number; width: number; height: number };
type SizeDef = SizeMm & { label: string };

const has = (o: object, v: unknown) => typeof v === "string" && Object.prototype.hasOwnProperty.call(o, v);

export const FRAME_SIZES = {
  A4: { width: 210, height: 297, label: "A4 (21 × 29,7 cm)" },
  A3: { width: 297, height: 420, label: "A3 (29,7 × 42 cm)" },
  "30x40": { width: 300, height: 400, label: "30 × 40 cm" },
  "40x50": { width: 400, height: 500, label: "40 × 50 cm" },
  "50x70": { width: 500, height: 700, label: "50 × 70 cm" },
} as const satisfies Record<string, SizeDef>;
export type FrameSize = keyof typeof FRAME_SIZES;
export const isFrameSize = (v: unknown): v is FrameSize => has(FRAME_SIZES, v);

export const POSTER_SIZES = {
  A3: { width: 297, height: 420, label: "A3 (29,7 × 42 cm)" },
  A2: { width: 420, height: 594, label: "A2 (42 × 59,4 cm)" },
  "50x70": { width: 500, height: 700, label: "50 × 70 cm" },
} as const satisfies Record<string, SizeDef>;
export type PosterSize = keyof typeof POSTER_SIZES;
export const isPosterSize = (v: unknown): v is PosterSize => has(POSTER_SIZES, v);

export const CATALOG_SIZES = {
  A5: { width: 148, height: 210, label: "A5 (14,8 × 21 cm)" },
  A4: { width: 210, height: 297, label: "A4 (21 × 29,7 cm)" },
} as const satisfies Record<string, SizeDef>;
export type CatalogSize = keyof typeof CATALOG_SIZES;
export const isCatalogSize = (v: unknown): v is CatalogSize => has(CATALOG_SIZES, v);

export const GUESTBOOK_POSTER_SIZES = {
  A4: { width: 210, height: 297, label: "A4 (21 × 29,7 cm)" },
  A3: { width: 297, height: 420, label: "A3 (29,7 × 42 cm)" },
} as const satisfies Record<string, SizeDef>;
export type GuestbookPosterSize = keyof typeof GUESTBOOK_POSTER_SIZES;
export const isGuestbookPosterSize = (v: unknown): v is GuestbookPosterSize => has(GUESTBOOK_POSTER_SIZES, v);

export const ORIENTATIONS = ["AUTO", "PORTRAIT", "LANDSCAPE"] as const;
export type Orientation = (typeof ORIENTATIONS)[number];
export const ORIENTATION_LABELS: Record<Orientation, string> = {
  AUTO: "Según la foto",
  PORTRAIT: "Vertical",
  LANDSCAPE: "Horizontal",
};
export const isOrientation = (v: unknown): v is Orientation => (ORIENTATIONS as readonly unknown[]).includes(v);

/** Automática: horizontal sólo si la foto es más ancha que alta. Cuadrada o sin dato, vertical. */
export function resolveOrientation(o: Orientation, image: PixelSize | null): "PORTRAIT" | "LANDSCAPE" {
  if (o !== "AUTO") return o;
  return image && image.width > image.height ? "LANDSCAPE" : "PORTRAIT";
}

export function orientedPage(size: SizeMm, o: "PORTRAIT" | "LANDSCAPE"): SizeMm {
  const corto = Math.min(size.width, size.height);
  const largo = Math.max(size.width, size.height);
  return o === "LANDSCAPE" ? { width: largo, height: corto } : { width: corto, height: largo };
}

/** La imagen entera dentro de la caja (nunca se recorta una obra), centrada. */
export function fitInside(box: Box, img: PixelSize): Box {
  const scale = Math.min(box.width / img.width, box.height / img.height);
  const width = img.width * scale;
  const height = img.height * scale;
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
}

/** Margen del remarco respecto del lado corto del papel (arriba y a los costados). */
export const FRAME_MARGIN_RATIO = 0.12;
/** El margen de abajo es más ancho: ahí van título y autor, y compensa el peso visual. */
export const FRAME_BOTTOM_FACTOR = 1.6;

export type FrameLayout = {
  page: SizeMm;
  orientation: "PORTRAIT" | "LANDSCAPE";
  margin: number;
  /** Lo que queda adentro de los márgenes. */
  window: Box;
  /** Donde va la foto (o la ventana marcada, en "sólo el remarco"). */
  image: Box;
  /** Altura (mm) desde donde empieza a bajar el pie con título y autor. */
  captionTop: number;
  titleSizePt: number;
  authorSizePt: number;
};

export function frameLayout(size: FrameSize, orientation: Orientation, image: PixelSize | null): FrameLayout {
  const valida = image && image.width > 0 && image.height > 0 ? image : null;
  const o = resolveOrientation(orientation, valida);
  const page = orientedPage(FRAME_SIZES[size], o);
  const corto = Math.min(page.width, page.height);
  const margin = corto * FRAME_MARGIN_RATIO;
  const abajo = margin * FRAME_BOTTOM_FACTOR;
  const window: Box = { x: margin, y: abajo, width: page.width - 2 * margin, height: page.height - margin - abajo };
  const img = valida ? fitInside(window, valida) : window;
  // 13 pt en A4, proporcional al papel, entre 11 y 28.
  const titleSizePt = Math.min(28, Math.max(11, (corto / 210) * 13));
  return {
    page, orientation: o, margin, window, image: img,
    captionTop: img.y - margin * 0.25,
    titleSizePt, authorSizePt: titleSizePt * 0.75,
  };
}

/** Puntos por pulgada con que sale la foto en la caja (el menor de los dos lados). */
export function printPpi(img: PixelSize, box: Box): number {
  return Math.floor(Math.min(img.width / (box.width / 25.4), img.height / (box.height / 25.4)));
}

export type PrintQuality = "GOOD" | "FAIR" | "LOW";
export const QUALITY_LABELS: Record<PrintQuality, string> = {
  GOOD: "buena calidad",
  FAIR: "calidad aceptable",
  LOW: "se va a ver blanda",
};
export function printQuality(ppi: number): PrintQuality {
  if (ppi >= 200) return "GOOD";
  if (ppi >= 120) return "FAIR";
  return "LOW";
}

/**
 * Lado mayor de las fotos de obra que guardamos (`LADO_MAYOR.obra` en
 * `apps/muestras/lib/imagenes/procesar.ts`). Los originales en alta llegan con Ventas.
 */
export const WEB_IMAGE_LONG_SIDE = 2000;
/** Una foto 3:2 (la de casi toda cámara) del tamaño que guardamos. */
export const TYPICAL_IMAGE: PixelSize = { width: WEB_IMAGE_LONG_SIDE, height: 1333 };

/** La calidad que se puede esperar en cada medida con las fotos que guardamos. */
export function expectedQuality(size: FrameSize): PrintQuality {
  const l = frameLayout(size, "AUTO", TYPICAL_IMAGE);
  return printQuality(printPpi(TYPICAL_IMAGE, l.image));
}

/** El primero de `sizes` (de mayor a menor) para el que `fits` da true; si ninguno, el último. */
export function largestThatFits(sizes: readonly number[], fits: (size: number) => boolean): number {
  for (const s of sizes) if (fits(s)) return s;
  return sizes[sizes.length - 1]!;
}

export type CatalogPlan = {
  coverPage: 1;
  curatorialFirstPage: number | null;
  firstWorkPage: number;
  indexFirstPage: number;
  closingPage: number;
  totalPages: number;
};

/** Portada, texto curatorial (N páginas), una por obra, índice (M páginas) y cierre con QR. */
export function catalogPlan(curatorialPages: number, works: number, indexPages: number): CatalogPlan {
  const firstWorkPage = 2 + curatorialPages;
  const indexFirstPage = firstWorkPage + works;
  const closingPage = indexFirstPage + Math.max(1, indexPages);
  return {
    coverPage: 1,
    curatorialFirstPage: curatorialPages > 0 ? 2 : null,
    firstWorkPage, indexFirstPage, closingPage, totalPages: closingPage,
  };
}

export type AuthorIndexEntry = { author: string; pages: number[] };
export const NO_AUTHOR = "Autor sin indicar";

/**
 * Índice alfabético de autores con sus páginas. "Ana Pérez" y "ana perez" son la misma persona
 * (se muestra la primera forma que aparece). Las obras sin autor van al final.
 */
export function authorIndex(entries: ReadonlyArray<{ authorName: string; page: number }>): AuthorIndexEntry[] {
  const grupos = new Map<string, AuthorIndexEntry>();
  const sinAutor: number[] = [];
  for (const e of entries) {
    const clave = normalizeName(e.authorName);
    if (!clave) {
      sinAutor.push(e.page);
      continue;
    }
    const g = grupos.get(clave);
    if (g) g.pages.push(e.page);
    else grupos.set(clave, { author: e.authorName.trim(), pages: [e.page] });
  }
  const orden = [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b, "es", { sensitivity: "base" })).map(([, g]) => g);
  for (const g of orden) g.pages.sort((a, b) => a - b);
  return sinAutor.length ? [...orden, { author: NO_AUTHOR, pages: sinAutor.sort((a, b) => a - b) }] : orden;
}
```

Agregar a `packages/muestras/src/index.ts`:
```ts
export * from "./print";
```

- [ ] **Step 5: Correr y ver que pasa**

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter @repo/muestras lint`
Expected: PASS. Si `expectedQuality("40x50")` diera `LOW`, revisar `frameLayout` (el cálculo esperado es ≈125 ppp), no el umbral.

- [ ] **Step 6: Commit**

```bash
git add packages/muestras/src/print.ts packages/muestras/src/print.test.ts packages/muestras/src/dates.ts packages/muestras/src/dates.test.ts packages/muestras/src/index.ts
git commit -m "Reglas de impresión de Muestras: medidas, remarco, calidad, catálogo y fechas largas"
```

**Acceptance:** las medidas y la diagramación del marco están probadas en las cinco medidas; la calidad esperada coincide con la tabla de D2; el índice de autores junta variantes de un mismo nombre.

---
### Task 2: Reglas del plano de montaje

**Files:**
- Create: `packages/muestras/src/hanging.ts`
- Modify: `packages/muestras/src/index.ts`
- Test: `packages/muestras/src/hanging.test.ts`

**Interfaces:**
- Produces: `DEFAULT_CENTER_HEIGHT_CM = 150`, `DEFAULT_WALL_HEIGHT_CM = 280`, `MIN_GAP_CM = 5`, `HANGING_LIMITS`; tipos `HangingItem`, `HangingWall`, `HangingPlan`, `HangingPosition`, `WallLayout`; `emptyHangingPlan()`, `parseHangingPlan(raw, workIds): { plan; droppedItems }`, `hangingPlanProblems(plan): string[]`, `hangingLayout(wall, centerHeightCm): WallLayout`, `unassignedWorks(plan, works)`, `formatCm(n)`, `newWallId(random?)`

- [ ] **Step 1: Escribir el test que falla**

`packages/muestras/src/hanging.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  emptyHangingPlan, formatCm, hangingLayout, hangingPlanProblems, parseHangingPlan, unassignedWorks, type HangingWall,
} from "./hanging";

const pared = (items: [number, number][], widthCm = 400, heightCm: number | null = null): HangingWall => ({
  id: "p1", name: "Norte", widthCm, heightCm,
  items: items.map(([w, h], i) => ({ workId: `w${i + 1}`, frameWidthCm: w, frameHeightCm: h })),
});

describe("parseHangingPlan", () => {
  it("lee un plano válido y descarta obras que ya no están o repetidas", () => {
    const { plan, droppedItems } = parseHangingPlan({
      version: 1, centerHeightCm: "145,5",
      walls: [
        { id: "a", name: "  Norte  ", widthCm: 640, heightCm: 300, items: [
          { workId: "w1", frameWidthCm: 40, frameHeightCm: "50" },
          { workId: "borrada", frameWidthCm: 40, frameHeightCm: 50 },
        ] },
        { id: "a", name: "Sur", widthCm: 300, items: [{ workId: "w1", frameWidthCm: 30, frameHeightCm: 40 }, { workId: "w2", frameWidthCm: 30, frameHeightCm: 40 }] },
      ],
    }, ["w1", "w2"]);
    expect(droppedItems).toBe(2);
    expect(plan.centerHeightCm).toBe(145.5);
    expect(plan.walls.map((w) => [w.id, w.name, w.widthCm, w.heightCm, w.items.map((i) => i.workId)])).toEqual([
      ["a", "Norte", 640, 300, ["w1"]],
      ["a-2", "Sur", 300, null, ["w2"]],
    ]);
  });
  it("cualquier cosa rara da un plano vacío", () => {
    expect(parseHangingPlan(null, []).plan).toEqual(emptyHangingPlan());
    expect(parseHangingPlan("x", []).plan).toEqual(emptyHangingPlan());
    expect(parseHangingPlan({ walls: [1, null, "x"] }, []).plan.walls).toEqual([]);
  });
  it("tope de 30 paredes", () => {
    const walls = Array.from({ length: 35 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, widthCm: 100, items: [] }));
    expect(parseHangingPlan({ walls }, []).plan.walls).toHaveLength(30);
  });
});

describe("hangingPlanProblems", () => {
  it("un plano correcto no tiene problemas", () => {
    expect(hangingPlanProblems({ version: 1, centerHeightCm: 150, walls: [pared([[40, 50]])] })).toEqual([]);
  });
  it("explica cada problema", () => {
    expect(hangingPlanProblems({
      version: 1, centerHeightCm: 90,
      walls: [{ ...pared([[0, 50]], 10, 100), name: "" }],
    })).toEqual([
      "La línea de centro tiene que estar entre 100 y 200 cm del piso.",
      "La pared 1 necesita un nombre.",
      "El ancho de \"Pared 1\" tiene que estar entre 30 y 5000 cm.",
      "El alto de \"Pared 1\" tiene que estar entre 150 y 1500 cm.",
      "Revisá la medida del marco n.º 1 de \"Pared 1\": entre 5 y 300 cm por lado.",
    ]);
  });
});

describe("hangingLayout", () => {
  it("espacio parejo entre obras y bordes, centro a 150 cm", () => {
    const l = hangingLayout(pared([[80, 100], [80, 100], [80, 100]]), 150);
    expect(l.fits).toBe(true);
    expect(l.gapCm).toBe(40);
    expect(l.positions.map((p) => [p.number, p.leftCm, p.centerFromLeftCm, p.bottomCm, p.topCm])).toEqual([
      [1, 40, 80, 100, 200], [2, 160, 200, 100, 200], [3, 280, 320, 100, 200],
    ]);
    expect(l.warnings).toEqual([]);
  });
  it("avisa si no entran", () => {
    const l = hangingLayout(pared([[150, 100], [150, 100], [150, 100]]), 150);
    expect(l.fits).toBe(false);
    expect(l.gapCm).toBe(0);
    expect(l.warnings).toEqual(["No entran: los marcos suman 450 cm y la pared mide 400 cm."]);
  });
  it("avisa si quedan muy juntas", () => {
    expect(hangingLayout(pared([[95, 50], [95, 50], [95, 50]], 300), 150).warnings).toEqual(["Quedan muy juntas: 3,8 cm entre obras."]);
  });
  it("avisa si llega al piso o pasa el alto de la pared", () => {
    expect(hangingLayout(pared([[50, 220]]), 100).warnings).toEqual(["La obra n.º 1 llega al piso: subí la línea de centro o achicá el marco."]);
    expect(hangingLayout(pared([[50, 220]], 400, 250), 150).warnings).toEqual(["La obra n.º 1 pasa el alto de la pared."]);
  });
  it("una pared vacía no tiene posiciones ni avisos", () => {
    expect(hangingLayout(pared([]), 150)).toEqual({ positions: [], gapCm: 400, framesCm: 0, fits: true, warnings: [] });
  });
});

describe("utilidades", () => {
  it("obras sin pared, en su orden", () => {
    const plan = { version: 1 as const, centerHeightCm: 150, walls: [pared([[40, 50]])] };
    expect(unassignedWorks(plan, [{ id: "w1" }, { id: "w2" }, { id: "w3" }]).map((w) => w.id)).toEqual(["w2", "w3"]);
  });
  it("centímetros con coma decimal", () => {
    expect(formatCm(150)).toBe("150");
    expect(formatCm(152.5)).toBe("152,5");
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter @repo/muestras test`
Expected: FAIL — `Failed to resolve import "./hanging"`.

- [ ] **Step 3: Implementar**

`packages/muestras/src/hanging.ts`:
```ts
/**
 * Plano de montaje (etapa 4): paredes con sus obras en orden y la medida de cada marco.
 *
 * Se guarda entero como JSON en `CulturalActivity.hangingPlan` (decisión D8): el editor de la
 * muestra borra y vuelve a crear las obras en cada guardado, así que no hay FK posible. Por eso
 * esta lectura es tolerante: lo que no se entiende se descarta y las obras que ya no están en la
 * muestra se cuentan en `droppedItems`.
 */
export const DEFAULT_CENTER_HEIGHT_CM = 150;
export const DEFAULT_WALL_HEIGHT_CM = 280;
export const MIN_GAP_CM = 5;

export const HANGING_LIMITS = {
  walls: 30,
  wallName: 60,
  wallWidth: [30, 5000],
  wallHeight: [150, 1500],
  frame: [5, 300],
  center: [100, 200],
} as const;

export type HangingItem = { workId: string; frameWidthCm: number; frameHeightCm: number };
export type HangingWall = { id: string; name: string; widthCm: number; heightCm: number | null; items: HangingItem[] };
export type HangingPlan = { version: 1; centerHeightCm: number; walls: HangingWall[] };

export const emptyHangingPlan = (): HangingPlan => ({ version: 1, centerHeightCm: DEFAULT_CENTER_HEIGHT_CM, walls: [] });

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Un número de centímetros, aceptando "152,5". `null` si no es un número. */
function cm(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.trim().replace(",", ".")) : Number.NaN;
  return Number.isFinite(n) ? r1(n) : null;
}

const objeto = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const WALL_ID = /^[A-Za-z0-9-]{1,40}$/;

export function parseHangingPlan(raw: unknown, workIds: Iterable<string>): { plan: HangingPlan; droppedItems: number } {
  const validas = new Set(workIds);
  const r = objeto(raw);
  const usadas = new Set<string>();
  const ids = new Set<string>();
  let droppedItems = 0;
  const walls: HangingWall[] = [];
  const crudas = Array.isArray(r?.walls) ? (r.walls as unknown[]) : [];
  crudas.slice(0, HANGING_LIMITS.walls).forEach((w0, i) => {
    const w = objeto(w0);
    if (!w) return;
    let id = typeof w.id === "string" && WALL_ID.test(w.id) ? w.id : `pared-${i + 1}`;
    if (ids.has(id)) id = `${id}-${i + 1}`.slice(-40);
    ids.add(id);
    const items: HangingItem[] = [];
    for (const it0 of Array.isArray(w.items) ? (w.items as unknown[]) : []) {
      const it = objeto(it0);
      const workId = typeof it?.workId === "string" ? it.workId : "";
      if (!it || !validas.has(workId) || usadas.has(workId)) {
        droppedItems += 1;
        continue;
      }
      usadas.add(workId);
      items.push({ workId, frameWidthCm: cm(it.frameWidthCm) ?? 0, frameHeightCm: cm(it.frameHeightCm) ?? 0 });
    }
    const alto = cm(w.heightCm);
    walls.push({
      id,
      name: typeof w.name === "string" ? w.name.replace(/\s+/g, " ").trim().slice(0, HANGING_LIMITS.wallName) : "",
      widthCm: cm(w.widthCm) ?? 0,
      heightCm: alto && alto > 0 ? alto : null,
      items,
    });
  });
  return { plan: { version: 1, centerHeightCm: cm(r?.centerHeightCm) ?? DEFAULT_CENTER_HEIGHT_CM, walls }, droppedItems };
}

const fuera = (n: number, [a, b]: readonly [number, number]) => !(n >= a && n <= b);

/** Lo que hay que corregir antes de guardar. Lista vacía = se puede guardar. */
export function hangingPlanProblems(plan: HangingPlan): string[] {
  const L = HANGING_LIMITS;
  const out: string[] = [];
  if (fuera(plan.centerHeightCm, L.center)) out.push(`La línea de centro tiene que estar entre ${L.center[0]} y ${L.center[1]} cm del piso.`);
  if (plan.walls.length > L.walls) out.push(`Podés cargar hasta ${L.walls} paredes.`);
  plan.walls.forEach((w, i) => {
    const nombre = w.name || `Pared ${i + 1}`;
    if (!w.name) out.push(`La pared ${i + 1} necesita un nombre.`);
    if (fuera(w.widthCm, L.wallWidth)) out.push(`El ancho de "${nombre}" tiene que estar entre ${L.wallWidth[0]} y ${L.wallWidth[1]} cm.`);
    if (w.heightCm != null && fuera(w.heightCm, L.wallHeight)) {
      out.push(`El alto de "${nombre}" tiene que estar entre ${L.wallHeight[0]} y ${L.wallHeight[1]} cm.`);
    }
    w.items.forEach((it, k) => {
      if (fuera(it.frameWidthCm, L.frame) || fuera(it.frameHeightCm, L.frame)) {
        out.push(`Revisá la medida del marco n.º ${k + 1} de "${nombre}": entre ${L.frame[0]} y ${L.frame[1]} cm por lado.`);
      }
    });
  });
  return out;
}

export type HangingPosition = {
  workId: string;
  /** Número de la obra en la pared, de izquierda a derecha, desde 1. */
  number: number;
  /** Del borde izquierdo de la pared al borde izquierdo del marco. */
  leftCm: number;
  /** Del borde izquierdo de la pared al centro del marco: lo que se mide para colgar. */
  centerFromLeftCm: number;
  bottomCm: number;
  topCm: number;
  widthCm: number;
  heightCm: number;
};
export type WallLayout = { positions: HangingPosition[]; gapCm: number; framesCm: number; fits: boolean; warnings: string[] };

/** "150" o "152,5". */
export function formatCm(n: number): string {
  return Number.isInteger(n) ? String(n) : r1(n).toFixed(1).replace(".", ",");
}

/**
 * Posición de cada marco: centros a `centerHeightCm` del piso y el mismo espacio entre obras y
 * contra los bordes: (ancho − suma de marcos) / (obras + 1). Si no entran, se dibujan pegadas
 * desde el borde izquierdo (el plano muestra cuánto se pasan).
 */
export function hangingLayout(wall: HangingWall, centerHeightCm: number): WallLayout {
  const n = wall.items.length;
  const framesCm = r1(wall.items.reduce((s, it) => s + it.frameWidthCm, 0));
  const fits = framesCm <= wall.widthCm;
  const gap = n === 0 ? wall.widthCm : fits ? (wall.widthCm - framesCm) / (n + 1) : 0;
  const warnings: string[] = [];
  if (!fits) warnings.push(`No entran: los marcos suman ${formatCm(framesCm)} cm y la pared mide ${formatCm(wall.widthCm)} cm.`);
  else if (n > 0 && gap < MIN_GAP_CM) warnings.push(`Quedan muy juntas: ${formatCm(r1(gap))} cm entre obras.`);
  let x = gap;
  const positions = wall.items.map((it, i): HangingPosition => {
    const left = x;
    x += it.frameWidthCm + gap;
    const bottom = centerHeightCm - it.frameHeightCm / 2;
    const top = centerHeightCm + it.frameHeightCm / 2;
    if (bottom < 0) warnings.push(`La obra n.º ${i + 1} llega al piso: subí la línea de centro o achicá el marco.`);
    if (wall.heightCm != null && top > wall.heightCm) warnings.push(`La obra n.º ${i + 1} pasa el alto de la pared.`);
    return {
      workId: it.workId, number: i + 1,
      leftCm: r1(left), centerFromLeftCm: r1(left + it.frameWidthCm / 2),
      bottomCm: r1(bottom), topCm: r1(top),
      widthCm: it.frameWidthCm, heightCm: it.frameHeightCm,
    };
  });
  return { positions, gapCm: r1(gap), framesCm, fits, warnings };
}

/** Las obras de la muestra que todavía no están en ninguna pared, en su orden. */
export function unassignedWorks<W extends { id: string }>(plan: HangingPlan, works: readonly W[]): W[] {
  const asignadas = new Set(plan.walls.flatMap((w) => w.items.map((i) => i.workId)));
  return works.filter((w) => !asignadas.has(w.id));
}

/** Id corto para una pared nueva (lo arma el editor en el navegador). */
export function newWallId(random: () => number = Math.random): string {
  return `p-${Math.floor(random() * 36 ** 6).toString(36).padStart(6, "0")}`;
}
```

Agregar a `packages/muestras/src/index.ts`:
```ts
export * from "./hanging";
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter @repo/muestras lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/muestras/src/hanging.ts packages/muestras/src/hanging.test.ts packages/muestras/src/index.ts
git commit -m "Reglas del plano de montaje de Muestras: paredes, espaciado parejo y avisos"
```

**Acceptance:** espaciado, línea de centro y los cuatro avisos de D9 probados; un plano con obras borradas o datos raros se lee sin romper.

---
### Task 3: Reglas de estadísticas y del libro de visitas

**Files:**
- Create: `packages/muestras/src/stats.ts`, `packages/muestras/src/guestbook.ts`
- Modify: `packages/muestras/src/index.ts`
- Test: `packages/muestras/src/stats.test.ts`, `packages/muestras/src/guestbook.test.ts`

**Interfaces:**
- Consumes: `toArDay`, `addArDays` (Task 1), `workPath` (`work-access.ts`).
- Produces:
  - `stats.ts`: `STAT_METRICS`, `StatMetric`, `isStatMetric`, `ACTIVITY_LEVEL = ""`; `isBotUserAgent(ua)`, `isPrefetch(headers)`; `QR_KINDS`, `QrKind`, `isQrKind`, `metricForQrKind`, `scanPath(kind, id)`, `scanUrl(base, kind, id)`; `statsWindow(a, now, days = 60)`, `dayRange(from, to)`; `StatRow`; `dailySeries(rows, from, to, pick)`; `StatTotals`, `statTotals(rows)`; `perWorkTotals(rows, works)`; `barChart(series, { width, height, gap })`
  - `guestbook.ts`: `GUESTBOOK_MODES`, `GuestbookMode`, `GUESTBOOK_MODE_LABELS`, `isGuestbookMode`; `GUESTBOOK_ENTRY_STATUSES`, `GuestbookEntryStatus`, `GUESTBOOK_ENTRY_STATUS_LABELS`; `GUESTBOOK_LIMITS`, `GUESTBOOK_DAYS_AFTER_CLOSE = 15`, `GUESTBOOK_MIN_MS = 3000`; `GuestbookInput`, `guestbookInput(raw)`, `hasLinkOrEmail(s)`, `guestbookProblems(i)`, `isTooFast(startedAt, now)`; `GuestbookState`, `guestbookState(a, now)`; `initialEntryStatus(mode)`; `ModerationAction`, `isModerationAction`, `nextEntryStatus(action)`; `guestbookSignature({ name, city })`

- [ ] **Step 1: Escribir los tests que fallan**

`packages/muestras/src/stats.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { dayEndAr, dayStartAr } from "./dates";
import {
  barChart, dailySeries, dayRange, isBotUserAgent, isPrefetch, metricForQrKind, perWorkTotals, scanPath, scanUrl,
  statTotals, statsWindow, type StatRow,
} from "./stats";

const h = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null });

describe("robots y precargas", () => {
  it("un navegador común no es robot", () => {
    expect(isBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toBe(false);
    expect(isBotUserAgent("Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36")).toBe(false);
  });
  it("robots, vistas previas y clientes de consola sí", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "facebookexternalhit/1.1", "WhatsApp/2.24.1 A", "TelegramBot (like TwitterBot)", "Slackbot-LinkExpanding 1.0",
      "curl/8.4.0", "python-requests/2.31", "Mozilla/5.0 HeadlessChrome/120", "", null,
    ]) expect(isBotUserAgent(ua), String(ua)).toBe(true);
  });
  it("precargas del navegador o de Next", () => {
    expect(isPrefetch(h({ "sec-purpose": "prefetch;prerender" }))).toBe(true);
    expect(isPrefetch(h({ purpose: "prefetch" }))).toBe(true);
    expect(isPrefetch(h({ "next-router-prefetch": "1" }))).toBe(true);
    expect(isPrefetch(h({}))).toBe(false);
  });
});

describe("QR con conteo", () => {
  it("direcciones cortas por tipo", () => {
    expect(scanPath("o", "ckobra1")).toBe("/q/o/ckobra1");
    expect(scanUrl("https://muestrasfotograficas.com/", "l", "ckm")).toBe("https://muestrasfotograficas.com/q/l/ckm");
  });
  it("qué métrica suma cada tipo", () => {
    expect(metricForQrKind("o")).toBe("SCAN");
    expect(metricForQrKind("m")).toBe("SCAN");
    expect(metricForQrKind("l")).toBe("GUESTBOOK_SCAN");
  });
});

describe("ventana del gráfico", () => {
  const a = { startsAt: dayStartAr("2026-11-01"), endsAt: dayEndAr("2026-11-30") };
  it("60 días que terminan hoy", () => {
    expect(statsWindow(a, new Date("2026-11-15T15:00:00Z"))).toEqual({ from: "2026-09-17", to: "2026-11-15" });
  });
  it("una muestra que cerró hace mucho termina 30 días después del cierre", () => {
    expect(statsWindow(a, new Date("2027-05-01T15:00:00Z"))).toEqual({ from: "2026-11-01", to: "2026-12-30" });
  });
  it("rango de días inclusive", () => {
    expect(dayRange("2026-12-30", "2027-01-02")).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });
});

const filas: StatRow[] = [
  { workId: "", day: "2026-11-02", metric: "VIEW", count: 10 },
  { workId: "w1", day: "2026-11-02", metric: "VIEW", count: 4 },
  { workId: "w1", day: "2026-11-02", metric: "SCAN", count: 3 },
  { workId: "w2", day: "2026-11-03", metric: "SCAN", count: 2 },
  { workId: "", day: "2026-11-03", metric: "SCAN", count: 1 },
  { workId: "", day: "2026-11-03", metric: "GUESTBOOK_SCAN", count: 5 },
  { workId: "borrada", day: "2026-11-03", metric: "VIEW", count: 7 },
];

describe("series y totales", () => {
  it("una serie por día, con ceros donde no hubo nada", () => {
    expect(dailySeries(filas, "2026-11-01", "2026-11-03", (r) => r.metric === "VIEW")).toEqual([
      { day: "2026-11-01", count: 0 }, { day: "2026-11-02", count: 14 }, { day: "2026-11-03", count: 7 },
    ]);
  });
  it("totales por tipo", () => {
    expect(statTotals(filas)).toEqual({ activityViews: 10, workViews: 11, workScans: 5, activityScans: 1, guestbookScans: 5 });
  });
  it("por obra en el orden de la muestra, y lo de obras quitadas aparte", () => {
    expect(perWorkTotals(filas, [{ id: "w2", title: "Dos" }, { id: "w1", title: "Uno" }])).toEqual({
      works: [{ id: "w2", title: "Dos", views: 0, scans: 2 }, { id: "w1", title: "Uno", views: 4, scans: 3 }],
      removed: { views: 7, scans: 0 },
    });
  });
});

describe("barChart", () => {
  it("barras proporcionales al máximo, desde abajo", () => {
    const c = barChart([{ day: "a", count: 0 }, { day: "b", count: 5 }, { day: "c", count: 10 }], { width: 32, height: 100, gap: 1 });
    expect(c.max).toBe(10);
    expect(c.bars.map((b) => [b.x, b.width, b.y, b.height])).toEqual([[0, 10, 100, 0], [11, 10, 50, 50], [22, 10, 0, 100]]);
  });
  it("sin datos no divide por cero", () => {
    expect(barChart([{ day: "a", count: 0 }], { width: 10, height: 10 }).max).toBe(0);
  });
});
```

`packages/muestras/src/guestbook.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { dayEndAr, dayStartAr } from "./dates";
import {
  guestbookInput, guestbookProblems, guestbookSignature, guestbookState, hasLinkOrEmail, initialEntryStatus, isTooFast,
  nextEntryStatus,
} from "./guestbook";

describe("entrada del libro", () => {
  it("limpia espacios, invisibles y saltos de más", () => {
    expect(guestbookInput({ name: "  Ana​  ", city: "", comment: " Hermosa\r\n\r\n\r\n\r\nmuestra  ", })).toEqual({
      name: "Ana", city: null, comment: "Hermosa\n\nmuestra",
    });
    expect(guestbookInput({})).toEqual({ name: null, city: null, comment: "" });
  });
  it("problemas: vacío, largo, enlaces y correos", () => {
    expect(guestbookProblems({ name: null, city: null, comment: "" })).toEqual(["Escribí un comentario."]);
    expect(guestbookProblems({ name: "x".repeat(61), city: null, comment: "a".repeat(501) })).toEqual([
      "El comentario puede tener hasta 500 caracteres.", "El nombre puede tener hasta 60 caracteres.",
    ]);
    expect(guestbookProblems({ name: null, city: null, comment: "Mirá www.algo.com" })).toEqual([
      "Los comentarios no pueden llevar enlaces ni direcciones de correo.",
    ]);
    expect(guestbookProblems({ name: "Ana", city: "Rosario", comment: "Me encantó. Vuelvo el sábado." })).toEqual([]);
  });
  it("detecta enlaces y correos sin confundir puntos comunes", () => {
    expect(hasLinkOrEmail("https://x.y")).toBe(true);
    expect(hasLinkOrEmail("escribime a ana@gmail.com")).toBe(true);
    expect(hasLinkOrEmail("compren en spam.ru")).toBe(true);
    expect(hasLinkOrEmail("Qué foto.Arriba la luz")).toBe(false);
    expect(hasLinkOrEmail("Gracias. Felicitaciones")).toBe(false);
  });
  it("demasiado rápido para una persona", () => {
    expect(isTooFast(1000, 2000)).toBe(true);
    expect(isTooFast(1000, 4500)).toBe(false);
    expect(isTooFast(null, 4500)).toBe(true);
    expect(isTooFast(Number.NaN, 4500)).toBe(true);
  });
});

describe("cuándo recibe", () => {
  const base = { reviewStatus: "APPROVED", type: "MUESTRA", isCancelled: false, guestbookMode: "PUBLISH", endsAt: dayEndAr("2026-11-30") };
  const durante = dayStartAr("2026-11-10");
  it("abierto durante la muestra y hasta 15 días después", () => {
    expect(guestbookState(base, durante)).toBe("OPEN");
    expect(guestbookState(base, new Date(dayEndAr("2026-12-15").getTime() - 1))).toBe("OPEN");
    expect(guestbookState(base, dayStartAr("2026-12-16"))).toBe("ENDED");
  });
  it("cerrado por el organizador o cancelada", () => {
    expect(guestbookState({ ...base, guestbookMode: "OFF" }, durante)).toBe("OFF");
    expect(guestbookState({ ...base, isCancelled: true }, durante)).toBe("OFF");
  });
  it("no existe si no está publicada o no es una muestra", () => {
    expect(guestbookState({ ...base, reviewStatus: "UNPUBLISHED" }, durante)).toBe("UNAVAILABLE");
    expect(guestbookState({ ...base, type: "CHARLA" }, durante)).toBe("UNAVAILABLE");
  });
});

describe("moderación y firma", () => {
  it("estado inicial según el modo", () => {
    expect(initialEntryStatus("PUBLISH")).toBe("PUBLISHED");
    expect(initialEntryStatus("REVIEW")).toBe("PENDING");
    expect(initialEntryStatus("raro")).toBe("PUBLISHED");
  });
  it("publicar, ocultar, borrar", () => {
    expect(nextEntryStatus("publish")).toBe("PUBLISHED");
    expect(nextEntryStatus("hide")).toBe("HIDDEN");
    expect(nextEntryStatus("delete")).toBeNull();
  });
  it("firma con lo que haya", () => {
    expect(guestbookSignature({ name: "Ana", city: "Rosario" })).toBe("Ana, de Rosario");
    expect(guestbookSignature({ name: "Ana", city: null })).toBe("Ana");
    expect(guestbookSignature({ name: null, city: "Rosario" })).toBe("Visitante de Rosario");
    expect(guestbookSignature({ name: null, city: null })).toBe("Visitante");
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter @repo/muestras test`
Expected: FAIL — `Failed to resolve import "./stats"` y `"./guestbook"`.

- [ ] **Step 3: Implementar `stats.ts`**

`packages/muestras/src/stats.ts`:
```ts
import { addArDays, toArDay } from "./dates";

/**
 * Estadísticas de la sala (etapa 4). Sólo contadores diarios agregados por muestra, obra, día y
 * métrica: nada de IP, user-agent, cookies ni usuarios (decisión D15).
 */
export const STAT_METRICS = ["VIEW", "SCAN", "GUESTBOOK_SCAN"] as const;
export type StatMetric = (typeof STAT_METRICS)[number];
export const isStatMetric = (v: unknown): v is StatMetric => (STAT_METRICS as readonly unknown[]).includes(v);

/** `workId` de las filas que cuentan la muestra entera (no una obra). */
export const ACTIVITY_LEVEL = "";

const BOT_UA = new RegExp(
  [
    "bot\\b", "bot/", "crawl", "spider", "slurp", "archiver", "facebookexternalhit", "facebookcatalog", "whatsapp",
    "telegram", "preview", "embedly", "headless", "lighthouse", "pagespeed", "pingdom", "uptime", "monitor",
    "curl/", "wget/", "python", "httpclient", "okhttp", "go-http-client", "java/", "node-fetch", "undici", "axios",
    "postman", "insomnia", "scrapy", "ahrefs", "semrush", "petalbot", "yandex", "baidu", "bytespider", "gptbot",
    "chatgpt", "claude", "anthropic", "perplexity", "ccbot", "applebot", "googleother", "google-inspectiontool",
  ].join("|"),
  "i",
);

/** Robots, vistas previas de enlaces y clientes de consola. Sin user-agent (o muy corto), también. */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  const s = (ua ?? "").trim();
  return s.length < 10 || BOT_UA.test(s);
}

/** El navegador o Next precargan la página sin que nadie la abra: no es una visita. */
export function isPrefetch(h: { get(name: string): string | null }): boolean {
  const proposito = `${h.get("sec-purpose") ?? ""} ${h.get("purpose") ?? ""}`;
  return /prefetch|prerender/i.test(proposito) || h.get("next-router-prefetch") === "1" || h.get("x-middleware-prefetch") === "1";
}

/** `o`: ficha de una obra; `m`: cartel y catálogo (la muestra); `l`: afiche del libro de visitas. */
export const QR_KINDS = ["o", "m", "l"] as const;
export type QrKind = (typeof QR_KINDS)[number];
export const isQrKind = (v: unknown): v is QrKind => (QR_KINDS as readonly unknown[]).includes(v);

export function metricForQrKind(kind: QrKind): StatMetric {
  return kind === "l" ? "GUESTBOOK_SCAN" : "SCAN";
}

export function scanPath(kind: QrKind, id: string): string {
  return `/q/${kind}/${encodeURIComponent(id)}`;
}

export function scanUrl(baseUrl: string, kind: QrKind, id: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${scanPath(kind, id)}`;
}

/**
 * Los días del gráfico: `days` días que terminan hoy, o 30 días después del cierre si la
 * muestra cerró hace mucho (así el gráfico de una muestra vieja no queda vacío).
 */
export function statsWindow(a: { endsAt: Date }, now: Date, days = 60): { from: string; to: string } {
  const hoy = toArDay(now);
  const tope = addArDays(toArDay(a.endsAt), 30);
  const to = hoy < tope ? hoy : tope;
  return { from: addArDays(to, -(days - 1)), to };
}

/** Todos los días entre `from` y `to`, inclusive (tope de 400 por las dudas). */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addArDays(d, 1)) out.push(d);
  return out;
}

export type StatRow = { workId: string; day: string; metric: string; count: number };

export function dailySeries(rows: readonly StatRow[], from: string, to: string, pick: (r: StatRow) => boolean): { day: string; count: number }[] {
  const porDia = new Map<string, number>();
  for (const r of rows) if (pick(r)) porDia.set(r.day, (porDia.get(r.day) ?? 0) + r.count);
  return dayRange(from, to).map((day) => ({ day, count: porDia.get(day) ?? 0 }));
}

export type StatTotals = { activityViews: number; workViews: number; workScans: number; activityScans: number; guestbookScans: number };

export function statTotals(rows: readonly StatRow[]): StatTotals {
  const t: StatTotals = { activityViews: 0, workViews: 0, workScans: 0, activityScans: 0, guestbookScans: 0 };
  for (const r of rows) {
    const deObra = r.workId !== ACTIVITY_LEVEL;
    if (r.metric === "VIEW") t[deObra ? "workViews" : "activityViews"] += r.count;
    else if (r.metric === "SCAN") t[deObra ? "workScans" : "activityScans"] += r.count;
    else if (r.metric === "GUESTBOOK_SCAN") t.guestbookScans += r.count;
  }
  return t;
}

/** Visitas y escaneos por obra, en el orden de la muestra; lo de obras ya quitadas va aparte. */
export function perWorkTotals<W extends { id: string; title: string }>(
  rows: readonly StatRow[],
  works: readonly W[],
): { works: { id: string; title: string; views: number; scans: number }[]; removed: { views: number; scans: number } } {
  const porObra = new Map(works.map((w) => [w.id, { id: w.id, title: w.title, views: 0, scans: 0 }]));
  const removed = { views: 0, scans: 0 };
  for (const r of rows) {
    if (r.workId === ACTIVITY_LEVEL || (r.metric !== "VIEW" && r.metric !== "SCAN")) continue;
    const destino = porObra.get(r.workId) ?? removed;
    if (r.metric === "VIEW") destino.views += r.count;
    else destino.scans += r.count;
  }
  return { works: works.map((w) => porObra.get(w.id)!), removed };
}

export type Bar = { day: string; count: number; x: number; y: number; width: number; height: number };

/** Barras para un SVG de `width` × `height` (y crece hacia abajo, como en SVG). */
export function barChart(series: readonly { day: string; count: number }[], o: { width: number; height: number; gap?: number }): { max: number; bars: Bar[] } {
  const gap = o.gap ?? 2;
  const n = series.length;
  const max = Math.max(0, ...series.map((s) => s.count));
  const ancho = n > 0 ? (o.width - gap * (n - 1)) / n : 0;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    max,
    bars: series.map((s, i) => {
      const alto = max > 0 ? (s.count / max) * o.height : 0;
      return { day: s.day, count: s.count, x: r2(i * (ancho + gap)), y: r2(o.height - alto), width: r2(ancho), height: r2(alto) };
    }),
  };
}
```

- [ ] **Step 4: Implementar `guestbook.ts`**

`packages/muestras/src/guestbook.ts`:
```ts
import { addArDays, dayEndAr, toArDay } from "./dates";

/**
 * Libro de visitas digital (etapa 4): el público deja un comentario sin cuenta; quien organiza
 * modera. Modos por muestra (decisión D19):
 *   PUBLISH — se publica al instante y el organizador oculta o borra (por defecto)
 *   REVIEW  — queda pendiente hasta que el organizador lo publica
 *   OFF     — libro cerrado
 */
export const GUESTBOOK_MODES = ["PUBLISH", "REVIEW", "OFF"] as const;
export type GuestbookMode = (typeof GUESTBOOK_MODES)[number];
export const GUESTBOOK_MODE_LABELS: Record<GuestbookMode, string> = {
  PUBLISH: "Los comentarios se publican al instante (podés ocultarlos después)",
  REVIEW: "Revisás cada comentario antes de publicarlo",
  OFF: "Libro cerrado: no recibe comentarios",
};
export const isGuestbookMode = (v: unknown): v is GuestbookMode => (GUESTBOOK_MODES as readonly unknown[]).includes(v);

export const GUESTBOOK_ENTRY_STATUSES = ["PENDING", "PUBLISHED", "HIDDEN"] as const;
export type GuestbookEntryStatus = (typeof GUESTBOOK_ENTRY_STATUSES)[number];
export const GUESTBOOK_ENTRY_STATUS_LABELS: Record<GuestbookEntryStatus, string> = {
  PENDING: "Para revisar",
  PUBLISHED: "Publicado",
  HIDDEN: "Oculto",
};

export const GUESTBOOK_LIMITS = { name: 60, city: 60, comment: 500 } as const;
/** Mucha gente escribe al volver a casa: el libro sigue abierto unos días después del cierre. */
export const GUESTBOOK_DAYS_AFTER_CLOSE = 15;
/** Nadie lee el formulario y escribe un comentario en menos de 3 segundos. */
export const GUESTBOOK_MIN_MS = 3000;

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const INVISIBLES = /[­​-‍⁠︀-️﻿]/g;
const limpio = (v: unknown) => (typeof v === "string" ? v.replace(CONTROL, "").replace(INVISIBLES, "") : "");
const largo = (s: string) => Array.from(s).length;

export type GuestbookInput = { name: string | null; city: string | null; comment: string };

export function guestbookInput(raw: { name?: unknown; city?: unknown; comment?: unknown }): GuestbookInput {
  const linea = (v: unknown) => limpio(v).replace(/\s+/g, " ").trim() || null;
  const comment = limpio(raw.comment).replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { name: linea(raw.name), city: linea(raw.city), comment };
}

const ENLACE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|ar|io|info|biz|xyz|ru|cn|co|me|ly|site|online|shop|top)(\b|\/)|[^\s@]+@[^\s@]+\.[a-z]{2,})/i;

export function hasLinkOrEmail(s: string): boolean {
  return ENLACE.test(s);
}

export function guestbookProblems(i: GuestbookInput): string[] {
  const out: string[] = [];
  if (!i.comment) out.push("Escribí un comentario.");
  else if (largo(i.comment) > GUESTBOOK_LIMITS.comment) out.push(`El comentario puede tener hasta ${GUESTBOOK_LIMITS.comment} caracteres.`);
  if (i.name && largo(i.name) > GUESTBOOK_LIMITS.name) out.push(`El nombre puede tener hasta ${GUESTBOOK_LIMITS.name} caracteres.`);
  if (i.city && largo(i.city) > GUESTBOOK_LIMITS.city) out.push(`La ciudad puede tener hasta ${GUESTBOOK_LIMITS.city} caracteres.`);
  if (hasLinkOrEmail([i.name, i.city, i.comment].filter(Boolean).join(" "))) {
    out.push("Los comentarios no pueden llevar enlaces ni direcciones de correo.");
  }
  return out;
}

/** `startedAt`: cuándo se abrió el formulario (milisegundos). Sin dato, se trata como robot. */
export function isTooFast(startedAt: number | null, now: number): boolean {
  if (startedAt == null || !Number.isFinite(startedAt) || startedAt > now + 60_000) return true;
  return now - startedAt < GUESTBOOK_MIN_MS;
}

export type GuestbookState = "OPEN" | "ENDED" | "OFF" | "UNAVAILABLE";

export function guestbookState(
  a: { reviewStatus: string; type: string; isCancelled: boolean; guestbookMode: string; endsAt: Date },
  now: Date,
): GuestbookState {
  if (a.reviewStatus !== "APPROVED" || a.type !== "MUESTRA") return "UNAVAILABLE";
  if (a.isCancelled || a.guestbookMode === "OFF") return "OFF";
  const ultimo = dayEndAr(addArDays(toArDay(a.endsAt), GUESTBOOK_DAYS_AFTER_CLOSE));
  return now.getTime() > ultimo.getTime() ? "ENDED" : "OPEN";
}

export function initialEntryStatus(mode: string): GuestbookEntryStatus {
  return mode === "REVIEW" ? "PENDING" : "PUBLISHED";
}

export type ModerationAction = "publish" | "hide" | "delete";
export const isModerationAction = (v: unknown): v is ModerationAction => v === "publish" || v === "hide" || v === "delete";

/** El estado que deja cada acción; `null` = se borra. */
export function nextEntryStatus(action: ModerationAction): GuestbookEntryStatus | null {
  if (action === "publish") return "PUBLISHED";
  if (action === "hide") return "HIDDEN";
  return null;
}

export function guestbookSignature(e: { name: string | null; city: string | null }): string {
  if (e.name && e.city) return `${e.name}, de ${e.city}`;
  if (e.name) return e.name;
  if (e.city) return `Visitante de ${e.city}`;
  return "Visitante";
}
```

Agregar a `packages/muestras/src/index.ts`:
```ts
export * from "./stats";
export * from "./guestbook";
```

- [ ] **Step 5: Correr y ver que pasa**

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter @repo/muestras lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/muestras/src/stats.ts packages/muestras/src/stats.test.ts packages/muestras/src/guestbook.ts packages/muestras/src/guestbook.test.ts packages/muestras/src/index.ts
git commit -m "Reglas de estadísticas y del libro de visitas de Muestras"
```

**Acceptance:** robots y precargas filtrados; ventana del gráfico en hora argentina; totales por tipo y por obra; libro abierto hasta 15 días después del cierre; enlaces y correos rechazados.

---
### Task 4: Columnas y tablas de la sala (migración escrita a mano, sin aplicar)

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelo `CulturalActivity` y modelos nuevos al final)
- Create: `packages/db/prisma/migrations/20261029120000_muestras_etapa_4_sala/migration.sql`

**Interfaces:**
- Produces: `CulturalActivity.curatorialText`, `.curatorCredits`, `.guestbookMode` (default `"PUBLISH"`), `.hangingPlan` (`Json?`), `.dailyStats`, `.guestbookEntries`; `prisma.culturalActivityDailyStat` (clave compuesta `activityId_workId_day_metric`); `prisma.culturalActivityGuestbookEntry`.

- [ ] **Step 1: Confirmar el nombre de la migración**

Run: `git fetch origin && git ls-tree --name-only origin/main packages/db/prisma/migrations/ | tail -4`
Expected: las últimas son `20261028120000_fotoffice_etapa_6_informes` y `20261028120000_muestras_etapa_3_convocatorias`. `20261029120000_…` ordena después. Si apareció una más nueva, usar un timestamp posterior y reemplazar el nombre en todo este plan.

- [ ] **Step 2: Cambiar el schema (sin `prisma format`: reformatea todo el archivo)**

En `model CulturalActivity`, debajo de `itinerantGroupId String?`:
```prisma

  /// Texto curatorial (Muestras, etapa 4): va en la ficha pública, el cartel de sala y el catálogo.
  curatorialText String?
  /// Créditos de la curaduría, p. ej. "Curaduría: Ana Pérez".
  curatorCredits String?
  /// Libro de visitas: PUBLISH | REVIEW | OFF
  guestbookMode  String  @default("PUBLISH")
  /// Plano de montaje (paredes y obras). Se lee y se guarda entero; ver `parseHangingPlan`.
  /// Sin FK a las obras a propósito: el editor de la muestra las borra y las vuelve a crear.
  hangingPlan    Json?
```
y debajo de `call CulturalCall?`:
```prisma

  /// Contadores diarios de visitas y escaneos (etapa 4).
  dailyStats       CulturalActivityDailyStat[]
  /// Comentarios del libro de visitas (etapa 4).
  guestbookEntries CulturalActivityGuestbookEntry[]
```

Al final del archivo:
```prisma
/// Contador diario de la sala (Muestras Fotográficas, etapa 4). Sin datos de quien visita: ni IP,
/// ni user-agent, ni usuario. `workId` vacío = la muestra entera; si no, el id de una obra, sin FK
/// (el editor de la muestra reescribe sus obras). `day` es el día argentino "AAAA-MM-DD" como
/// texto, a propósito: un timestamp sin zona corre el día.
model CulturalActivityDailyStat {
  activityId String
  activity   CulturalActivity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  workId     String           @default("")
  day        String
  /// VIEW | SCAN | GUESTBOOK_SCAN
  metric     String
  count      Int              @default(0)

  @@id([activityId, workId, day, metric])
}

/// Comentario del libro de visitas de una muestra (etapa 4). Se deja sin cuenta; no se guarda IP
/// ni nada que identifique a quien lo escribió más allá de lo que eligió poner.
model CulturalActivityGuestbookEntry {
  id         String           @id @default(cuid())
  activityId String
  activity   CulturalActivity @relation(fields: [activityId], references: [id], onDelete: Cascade)

  name    String?
  city    String?
  comment String
  /// PENDING | PUBLISHED | HIDDEN
  status  String  @default("PUBLISHED")

  moderatedAt       DateTime?
  moderatedByUserId Int?
  createdAt         DateTime  @default(now())

  @@index([activityId, status, createdAt])
}
```

- [ ] **Step 3: Validar y generar el cliente**

Run: `pnpm --filter @repo/db exec prisma validate && pnpm --filter @repo/db exec prisma generate`
Expected: `The schema at prisma/schema.prisma is valid` y el cliente generado. (Si falta `DIRECT_URL`/`DATABASE_URL`, exportar valores falsos sólo para validar: `DATABASE_URL=postgresql://x:y@localhost:5432/z DIRECT_URL=$DATABASE_URL`.)

- [ ] **Step 4: Escribir la migración**

`packages/db/prisma/migrations/20261029120000_muestras_etapa_4_sala/migration.sql`:
```sql
-- Muestras Fotográficas · Etapa 4: la sala (piezas para imprimir, estadísticas, libro de visitas).
-- Aditiva: suma cuatro columnas a CulturalActivity (optativas o con valor por defecto: Postgres no
-- reescribe la tabla) y crea dos tablas nuevas. No toca filas existentes.
-- NO SE APLICA SOLA: la aplica a mano el controlador (autorizado por Daniel) en la base de
-- FOTOFFICE/FotoRank (Neon `divine-hall-10689679`, rama `development`) y la registra en
-- `_prisma_migrations` con el SHA-256 de este archivo. Va ANTES de publicar el código: sin las
-- columnas nuevas, toda consulta de CulturalActivity falla y se cae todo el sitio de Muestras.

-- AlterTable
ALTER TABLE "CulturalActivity" ADD COLUMN     "curatorCredits" TEXT,
ADD COLUMN     "curatorialText" TEXT,
ADD COLUMN     "guestbookMode" TEXT NOT NULL DEFAULT 'PUBLISH',
ADD COLUMN     "hangingPlan" JSONB;

-- CreateTable
CREATE TABLE "CulturalActivityDailyStat" (
    "activityId" TEXT NOT NULL,
    "workId" TEXT NOT NULL DEFAULT '',
    "day" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CulturalActivityDailyStat_pkey" PRIMARY KEY ("activityId","workId","day","metric")
);

-- CreateTable
CREATE TABLE "CulturalActivityGuestbookEntry" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "name" TEXT,
    "city" TEXT,
    "comment" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "moderatedAt" TIMESTAMP(3),
    "moderatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CulturalActivityGuestbookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CulturalActivityGuestbookEntry_activityId_status_createdAt_idx" ON "CulturalActivityGuestbookEntry"("activityId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "CulturalActivityDailyStat" ADD CONSTRAINT "CulturalActivityDailyStat_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalActivityGuestbookEntry" ADD CONSTRAINT "CulturalActivityGuestbookEntry_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Compararla con lo que genera Prisma:

Run: `git show origin/main:packages/db/prisma/schema.prisma > /tmp/schema-antes.prisma && pnpm --filter @repo/db exec prisma migrate diff --from-schema-datamodel /tmp/schema-antes.prisma --to-schema-datamodel prisma/schema.prisma --script`
Expected: las mismas sentencias (1 `ALTER TABLE … ADD COLUMN` con cuatro columnas, 2 `CREATE TABLE`, 1 `CREATE INDEX`, 2 `ADD CONSTRAINT`); el orden de las columnas del `ALTER` puede variar. Si aparece cualquier otra cosa (un `DROP`, un `ALTER` de otra tabla, un `CREATE TYPE`), frenar y avisar.

- [ ] **Step 5: Comprobar que el resto de la suite compila**

Run: `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice typecheck`
Expected: sin errores (ninguna otra app consulta `CulturalActivity`: `grep -rln "culturalActivity" apps --include=*.ts --include=*.tsx | grep -v apps/muestras` no devuelve nada).

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20261029120000_muestras_etapa_4_sala
git commit -m "Columnas y tablas de la sala de Muestras: texto curatorial, plano, contadores y libro (sin aplicar)"
```

(La aplicación en producción está en la Task 14.)

**Acceptance:** `prisma validate` en verde; la SQL coincide con `migrate diff`; ningún `DROP`.

---
### Task 5: Infraestructura — frenos, huella de IP, PDF a R2, foto para PDF y dibujo compartido

**Files:**
- Modify: `apps/muestras/lib/limite.ts`, `apps/muestras/lib/limite.test.ts`, `apps/muestras/lib/imagenes/r2.ts`, `apps/muestras/lib/fichas/pdf.ts`
- Create: `apps/muestras/lib/piezas/dibujo.ts`, `apps/muestras/lib/piezas/imagen.ts`, `apps/muestras/lib/piezas/entregar.ts`
- Test: `apps/muestras/lib/piezas/imagen.test.ts`, `apps/muestras/lib/piezas/entregar.test.ts`, `apps/muestras/lib/piezas/dibujo.test.ts`

**Interfaces:**
- Produces:
  - `limite.ts`: `huellaDeIp(ip)`; `LIMITES` suma `piezas`, `guardarMontaje`, `moderarLibro`, `cambiarModoLibro`; `LIMITES_PUBLICOS` suma `visitas`, `escaneos`, `libro`; `frenarPorIp(que, ip, ambito?)` (la clave usa la huella, nunca la IP); `LIMITES_POR_MUESTRA`, `frenarPorMuestra(que, activityId)`
  - `r2.ts`: `leerBytesDeR2(url): Promise<Buffer | null>`, `subirPdfAR2(bytes, clave, nombreArchivo): Promise<string>`
  - `dibujo.ts`: `MM`, `TINTA`, `GRIS`, `LINEA`, `NEGRO`, `ALERTA`, `Fuentes`, `prepararDocumento(pdf, titulo, fecha)`, `cargarFuentes(pdf)`, `bloque(p, texto, o)`, `bloqueCentrado(p, texto, o)`, `lineasConParrafos(texto, ancho, medir)`, `dibujarLineas(p, lineas, o)`, `tramosOscuros(modulos)`, `dibujarQr(p, url, x, y, lado)`, `lineaPunteada(p, caja)`
  - `imagen.ts`: `ImagenPdf = { jpg: Uint8Array; width: number; height: number }`, `imagenParaPdf(url, ladoMax, calidad?)`
  - `entregar.ts`: `LIMITE_RESPUESTA_DIRECTA = 4 * 1024 * 1024`, `entregarPdf(bytes, { nombre, activityId })`

- [ ] **Step 1: Escribir los tests que fallan**

En `apps/muestras/lib/limite.test.ts`, sumar:
```ts
import { LIMITES_POR_MUESTRA, frenarPorMuestra, huellaDeIp } from "./limite";

describe("huella de IP", () => {
  it("no es la IP, es estable y distingue IPs", () => {
    const a = huellaDeIp("181.1.2.3");
    expect(a).not.toContain("181");
    expect(a).toBe(huellaDeIp("181.1.2.3"));
    expect(a).not.toBe(huellaDeIp("181.1.2.4"));
  });
});

describe("frenos de la sala", () => {
  it("el libro se cuenta por IP y por muestra", () => {
    for (let i = 0; i < LIMITES_PUBLICOS.libro.limit; i++) expect(frenarPorIp("libro", "1.1.1.1", "m1").allowed).toBe(true);
    expect(frenarPorIp("libro", "1.1.1.1", "m1").allowed).toBe(false);
    expect(frenarPorIp("libro", "1.1.1.1", "m2").allowed).toBe(true);
  });
  it("tope por muestra para todas las IPs juntas", () => {
    for (let i = 0; i < LIMITES_POR_MUESTRA.libro.limit; i++) expect(frenarPorMuestra("libro", "m1").allowed).toBe(true);
    expect(frenarPorMuestra("libro", "m1").allowed).toBe(false);
  });
});
```
(Sumar los nombres nuevos al import existente de `./limite`; `resetRateLimit` ya corre en `beforeEach`. Si ese archivo no tiene `beforeEach(resetRateLimit)`, agregarlo.)

`apps/muestras/lib/piezas/dibujo.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { lineasConParrafos } from "./dibujo";

const medir = (s: string) => s.length;

describe("lineasConParrafos", () => {
  it("respeta los párrafos y deja una línea en blanco entre ellos", () => {
    expect(lineasConParrafos("uno dos tres\n\ncuatro", 7, medir)).toEqual(["uno dos", "tres", "", "cuatro"]);
  });
  it("un salto simple también separa párrafo", () => {
    expect(lineasConParrafos("a\nb", 10, medir)).toEqual(["a", "", "b"]);
  });
  it("vacío, sin líneas", () => expect(lineasConParrafos("  ", 10, medir)).toEqual([]));
});
```

`apps/muestras/lib/piezas/imagen.test.ts`:
```ts
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const r2 = vi.hoisted(() => ({ leerBytesDeR2: vi.fn() }));
vi.mock("@/lib/imagenes/r2", () => r2);
const { imagenParaPdf } = await import("./imagen");

beforeEach(() => vi.clearAllMocks());

describe("imagenParaPdf", () => {
  it("pasa la WebP del bucket a JPEG sin agrandar y respeta el lado mayor", async () => {
    r2.leerBytesDeR2.mockResolvedValue(await sharp({ create: { width: 300, height: 200, channels: 3, background: "#808080" } }).webp().toBuffer());
    const img = await imagenParaPdf("https://pub-test.r2.dev/muestras/7/a.webp", 150);
    expect(img).not.toBeNull();
    expect([img!.width, img!.height]).toEqual([150, 100]);
    expect([img!.jpg[0], img!.jpg[1]]).toEqual([0xff, 0xd8]);
    const chica = await imagenParaPdf("https://pub-test.r2.dev/muestras/7/a.webp", 5000);
    expect(chica!.width).toBe(300);
  });
  it("sin imagen o con una rota, null (el PDF sale igual)", async () => {
    expect(await imagenParaPdf(null, 100)).toBeNull();
    r2.leerBytesDeR2.mockResolvedValue(null);
    expect(await imagenParaPdf("https://pub-test.r2.dev/muestras/7/b.webp", 100)).toBeNull();
    r2.leerBytesDeR2.mockResolvedValue(Buffer.from("no es una imagen"));
    expect(await imagenParaPdf("https://pub-test.r2.dev/muestras/7/c.webp", 100)).toBeNull();
  });
});
```

`apps/muestras/lib/piezas/entregar.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const r2 = vi.hoisted(() => ({ subirPdfAR2: vi.fn() }));
vi.mock("@/lib/imagenes/r2", () => r2);
const { LIMITE_RESPUESTA_DIRECTA, entregarPdf } = await import("./entregar");

beforeEach(() => vi.clearAllMocks());

describe("entregarPdf", () => {
  it("un PDF liviano se descarga directo", async () => {
    const r = await entregarPdf(new Uint8Array([1, 2, 3]), { nombre: "cartel-m-A3", activityId: "a1" });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="cartel-m-A3.pdf"');
    expect(r2.subirPdfAR2).not.toHaveBeenCalled();
  });
  it("uno pesado se sube a R2 con la huella del contenido y se redirige", async () => {
    r2.subirPdfAR2.mockResolvedValue("https://pub-test.r2.dev/muestras/piezas/a1/x.pdf");
    const r = await entregarPdf(new Uint8Array(LIMITE_RESPUESTA_DIRECTA + 1), { nombre: "marcos-m-A3", activityId: "a1" });
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe("https://pub-test.r2.dev/muestras/piezas/a1/x.pdf");
    expect(r2.subirPdfAR2.mock.calls[0]![1]).toMatch(/^muestras\/piezas\/a1\/[a-f0-9]{32}\.pdf$/);
    expect(r2.subirPdfAR2.mock.calls[0]![2]).toBe("marcos-m-A3.pdf");
  });
  it("si R2 falla, un error claro", async () => {
    r2.subirPdfAR2.mockRejectedValue(new Error("sin red"));
    const r = await entregarPdf(new Uint8Array(LIMITE_RESPUESTA_DIRECTA + 1), { nombre: "x", activityId: "a1" });
    expect(r.status).toBe(500);
    expect((await r.json()).error).toMatch(/muy pesado/);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter muestras test -- lib/limite lib/piezas`
Expected: FAIL — `huellaDeIp` no existe y los archivos de `lib/piezas` no existen.

- [ ] **Step 3: Frenos y huella**

En `apps/muestras/lib/limite.ts`, arriba de todo:
```ts
import { createHash, randomBytes } from "node:crypto";
```
En `LIMITES`, al final:
```ts
  // Etapa 4: la sala. Un PDF con 40 fotos tarda; una por obra en dos medidas entra holgado.
  piezas: { limit: 60, windowMs: 10 * 60_000 },
  guardarMontaje: { limit: 120, windowMs: 60 * 60_000 },
  moderarLibro: { limit: 600, windowMs: 10 * 60_000 },
  cambiarModoLibro: { limit: 60, windowMs: 60 * 60_000 },
```
Reemplazar `LIMITES_PUBLICOS` y `frenarPorIp` por:
```ts
export const LIMITES_PUBLICOS = {
  buscarCerca: { limit: 10, windowMs: 60_000 },
  // Etapa 4. Pasarse sólo deja de contar: la página y la redirección andan igual.
  visitas: { limit: 300, windowMs: 10 * 60_000 },
  escaneos: { limit: 120, windowMs: 10 * 60_000 },
  // Por IP y por muestra: un grupo escolar en la red del lugar comparte IP.
  libro: { limit: 10, windowMs: 10 * 60_000 },
} as const;

/** Topes por muestra, sumando a todas las personas: frena una inundación repartida en muchas IPs. */
export const LIMITES_POR_MUESTRA = {
  libro: { limit: 200, windowMs: 60 * 60_000 },
} as const;

// Sal al azar por instancia: la huella no se puede revertir ni cruzar entre instancias, y nunca se
// guarda en la base. La IP en claro no queda ni en memoria.
const SAL = randomBytes(16).toString("hex");

/** Huella de una IP para usar como clave del freno (decisión D15 de la etapa 4). */
export function huellaDeIp(ip: string): string {
  return createHash("sha256").update(SAL).update(ip).digest("base64url").slice(0, 22);
}

/** Cuenta un uso de `que` para esa IP (opcionalmente dentro de un `ambito`, p. ej. una muestra). */
export function frenarPorIp(que: QueSeLimitaSinSesion, ip: string, ambito?: string): DecisionDeFreno {
  return checkRateLimit({ key: `ip:${que}:${ambito ?? "-"}:${huellaDeIp(ip)}`, ...LIMITES_PUBLICOS[que] });
}

export type QueSeLimitaPorMuestra = keyof typeof LIMITES_POR_MUESTRA;

export function frenarPorMuestra(que: QueSeLimitaPorMuestra, activityId: string): DecisionDeFreno {
  return checkRateLimit({ key: `muestra:${que}:${activityId}`, ...LIMITES_POR_MUESTRA[que] });
}
```
(`QueSeLimitaSinSesion` queda definido como `keyof typeof LIMITES_PUBLICOS`, arriba de `frenarPorIp`.)

- [ ] **Step 4: R2**

Agregar a `apps/muestras/lib/imagenes/r2.ts`:
```ts
/** El objeto entero en memoria (para pasarlo por sharp). `null` en los mismos casos que `leerDeR2`. */
export async function leerBytesDeR2(urlPublica: string): Promise<Buffer | null> {
  const r = await leerDeR2(urlPublica);
  if (!r) return null;
  try {
    return Buffer.from(await new Response(r.cuerpo).arrayBuffer());
  } catch (err) {
    console.error("[muestras] R2 lectura completa:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

const CLAVE_PDF = /^muestras\/piezas\/[A-Za-z0-9_-]{1,64}\/[a-f0-9]{32}\.pdf$/;

/**
 * Sube un PDF de piezas para imprimir (etapa 4, D4): Vercel corta las respuestas de más de
 * 4,5 MB, así que los PDF pesados se bajan del bucket. La clave lleva la huella del contenido:
 * no se adivina y el mismo PDF pisa al mismo objeto.
 */
export async function subirPdfAR2(bytes: Uint8Array, clave: string, nombreArchivo: string): Promise<string> {
  if (!CLAVE_PDF.test(clave)) throw new Error("Clave de PDF inválida.");
  const c = config();
  await s3(c).send(
    new PutObjectCommand({
      Bucket: c.bucket,
      Key: clave,
      Body: bytes,
      ContentType: "application/pdf",
      ContentDisposition: `attachment; filename="${nombreArchivo.replace(/[^A-Za-z0-9._-]/g, "-")}"`,
      CacheControl: "public, max-age=86400",
    }),
  );
  return `${c.publicUrl}/${clave}`;
}
```

- [ ] **Step 5: Dibujo compartido (sale de las fichas)**

Crear `apps/muestras/lib/piezas/dibujo.ts` moviendo desde `lib/fichas/pdf.ts` `MM`, los colores, `bloque`, `tramosOscuros` y el dibujo del QR, y sumando lo nuevo:
```ts
import { StandardFonts, rgb, type Color, type PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";
import { matrizDelQr } from "@/lib/fichas/qr";
import { cortarEnLineas, paraWinAnsi } from "@/lib/fichas/texto";

/** Puntos PDF por milímetro. */
export const MM = 72 / 25.4;

// Los colores del sitio: tinta, grafito, línea y el rojo de los avisos.
export const TINTA = rgb(0x1c / 255, 0x2b / 255, 0x35 / 255);
export const GRIS = rgb(0x5b / 255, 0x66 / 255, 0x70 / 255);
export const LINEA = rgb(0xe4 / 255, 0xe7 / 255, 0xe9 / 255);
export const NEGRO = rgb(0, 0, 0);
export const ALERTA = rgb(0xa1 / 255, 0x25 / 255, 0x1b / 255);

export type Fuentes = { normal: PDFFont; negrita: PDFFont };

/**
 * Título, autoría y fechas fijas: con la misma fecha (la `updatedAt` de la muestra) el mismo
 * contenido da los mismos bytes, y en R2 no se acumulan copias iguales (D4).
 */
export function prepararDocumento(pdf: PDFDocument, titulo: string, fecha: Date) {
  pdf.setTitle(paraWinAnsi(titulo));
  pdf.setCreator("Muestras Fotográficas");
  pdf.setProducer("Muestras Fotográficas");
  pdf.setCreationDate(fecha);
  pdf.setModificationDate(fecha);
}

export async function cargarFuentes(pdf: PDFDocument): Promise<Fuentes> {
  return { normal: await pdf.embedFont(StandardFonts.Helvetica), negrita: await pdf.embedFont(StandardFonts.HelveticaBold) };
}

type OpcionesTexto = { x: number; y: number; ancho: number; size: number; font: PDFFont; color: Color; maxLineas: number; interlinea?: number };

/** Escribe un bloque de texto desde `y` hacia abajo y devuelve dónde terminó. (Igual que en las fichas.) */
export function bloque(p: PDFPage, texto: string, o: OpcionesTexto): number {
  const lineas = cortarEnLineas(paraWinAnsi(texto), o.ancho, (s) => o.font.widthOfTextAtSize(s, o.size), o.maxLineas);
  let y = o.y;
  for (const l of lineas) {
    y -= o.size * (o.interlinea ?? 1.2);
    p.drawText(l, { x: o.x, y, size: o.size, font: o.font, color: o.color });
  }
  return y;
}

/** Como `bloque`, pero cada línea centrada en `x + ancho / 2`. */
export function bloqueCentrado(p: PDFPage, texto: string, o: OpcionesTexto): number {
  const lineas = cortarEnLineas(paraWinAnsi(texto), o.ancho, (s) => o.font.widthOfTextAtSize(s, o.size), o.maxLineas);
  let y = o.y;
  for (const l of lineas) {
    y -= o.size * (o.interlinea ?? 1.2);
    p.drawText(l, { x: o.x + (o.ancho - o.font.widthOfTextAtSize(l, o.size)) / 2, y, size: o.size, font: o.font, color: o.color });
  }
  return y;
}

/**
 * Corta un texto largo respetando sus párrafos (cualquier salto de línea separa párrafo) y deja
 * una línea vacía entre ellos. Sin tope de líneas: quien dibuja decide cuántas entran.
 * Se separa en párrafos ANTES de `paraWinAnsi`, que cambia todo espacio en blanco (también "\n")
 * por un espacio.
 */
export function lineasConParrafos(texto: string, ancho: number, medir: (s: string) => number): string[] {
  const parrafos = texto.replace(/\r\n?/g, "\n").split(/\n+/).map((s) => paraWinAnsi(s).trim()).filter(Boolean);
  return parrafos.flatMap((par, i) => [...(i > 0 ? [""] : []), ...cortarEnLineas(par, ancho, medir, Number.POSITIVE_INFINITY)]);
}

/** Dibuja líneas ya cortadas desde `y` hacia abajo; devuelve dónde terminó. */
export function dibujarLineas(p: PDFPage, lineas: string[], o: { x: number; y: number; size: number; font: PDFFont; color: Color; interlinea?: number }): number {
  let y = o.y;
  for (const l of lineas) {
    y -= o.size * (o.interlinea ?? 1.35);
    if (l) p.drawText(l, { x: o.x, y, size: o.size, font: o.font, color: o.color });
  }
  return y;
}

/** Los módulos negros de cada fila, juntados en tramos horizontales seguidos. */
export function tramosOscuros(modulos: boolean[][]): { fila: number; col: number; largo: number }[] {
  // (cuerpo idéntico al de lib/fichas/pdf.ts)
}

/** El QR de `url` como rectángulos vectoriales, con la esquina inferior izquierda en (x, y). */
export function dibujarQr(p: PDFPage, url: string, x: number, y: number, lado: number) {
  const modulos = matrizDelQr(url);
  const n = modulos.length;
  const mod = lado / n;
  for (const t of tramosOscuros(modulos)) {
    p.drawRectangle({ x: x + t.col * mod, y: y + (n - 1 - t.fila) * mod, width: t.largo * mod, height: mod, color: NEGRO });
  }
}

/** Un rectángulo de línea punteada fina (la ventana del remarco, el contorno de una pared). */
export function lineaPunteada(p: PDFPage, c: { x: number; y: number; width: number; height: number }, color: Color = GRIS) {
  const esquinas: [number, number][] = [[c.x, c.y], [c.x + c.width, c.y], [c.x + c.width, c.y + c.height], [c.x, c.y + c.height]];
  esquinas.forEach(([x, y], i) => {
    const [x2, y2] = esquinas[(i + 1) % 4]!;
    p.drawLine({ start: { x, y }, end: { x: x2, y: y2 }, thickness: 0.5, color, dashArray: [3, 3] });
  });
}
```

En `apps/muestras/lib/fichas/pdf.ts`: borrar `MM`, los colores, `bloque`, `tramosOscuros` y `dibujarQr` locales e importarlos de `@/lib/piezas/dibujo` (`dibujarQr(p, f.url, m, m, lado)` recibe ahora la URL y arma la matriz adentro). Las fichas conservan sus `setTitle`/`setCreator`/`setProducer` actuales (no tienen la fecha de la muestra a mano y no pasan por R2). Reexportar para no romper `pdf.test.ts`:
```ts
export { MM, tramosOscuros } from "@/lib/piezas/dibujo";
```

- [ ] **Step 6: Foto para PDF**

`apps/muestras/lib/piezas/imagen.ts`:
```ts
import "server-only";
import sharp from "sharp";
import { MAX_PIXELES } from "@/lib/imagenes/procesar";
import { leerBytesDeR2 } from "@/lib/imagenes/r2";

export type ImagenPdf = { jpg: Uint8Array; width: number; height: number };

/**
 * Una foto del bucket lista para `pdf.embedJpg`: pdf-lib no sabe leer WebP. Sin agrandar (D2: se
 * usa lo que guardamos), con fondo blanco por si trae transparencia. `null` si no está o no se
 * puede leer: la pieza sale igual, sin esa foto.
 */
export async function imagenParaPdf(url: string | null, ladoMax: number, calidad = 85): Promise<ImagenPdf | null> {
  if (!url) return null;
  const bytes = await leerBytesDeR2(url);
  if (!bytes) return null;
  try {
    const { data, info } = await sharp(bytes, { limitInputPixels: MAX_PIXELES })
      .rotate()
      .resize({ width: ladoMax, height: ladoMax, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: calidad })
      .toBuffer({ resolveWithObject: true });
    return { jpg: new Uint8Array(data), width: info.width, height: info.height };
  } catch (err) {
    console.error("[piezas] foto ilegible:", err instanceof Error ? err.message : String(err));
    return null;
  }
}
```

- [ ] **Step 7: Entrega**

`apps/muestras/lib/piezas/entregar.ts`:
```ts
import "server-only";
import { createHash } from "node:crypto";
import { subirPdfAR2 } from "@/lib/imagenes/r2";

/** Vercel corta en 4,5 MB toda respuesta de una función: se deja margen. */
export const LIMITE_RESPUESTA_DIRECTA = 4 * 1024 * 1024;

/** El PDF directo si es liviano; si no, a R2 y 303 a su dirección (decisión D4). */
export async function entregarPdf(bytes: Uint8Array, o: { nombre: string; activityId: string }): Promise<Response> {
  // `nombre` sale de un slug (a-z, 0-9, guiones) y de opciones de una lista cerrada.
  const archivo = `${o.nombre}.pdf`;
  if (bytes.byteLength <= LIMITE_RESPUESTA_DIRECTA) {
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${archivo}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  const huella = createHash("sha256").update(bytes).digest("hex").slice(0, 32);
  try {
    const url = await subirPdfAR2(bytes, `muestras/piezas/${o.activityId}/${huella}.pdf`, archivo);
    return new Response(null, { status: 303, headers: { Location: url, "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[piezas] no se pudo subir el PDF:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "El PDF es muy pesado y no pudimos prepararlo. Probá con una obra por vez." }, { status: 500 });
  }
}
```

- [ ] **Step 8: Correr y ver que pasa**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: PASS (incluidos los tests de fichas existentes: `pdf.test.ts`, `ruta.test.ts`, y los de `buscar-cerca`).

- [ ] **Step 9: Commit**

```bash
git add apps/muestras/lib/limite.ts apps/muestras/lib/limite.test.ts apps/muestras/lib/imagenes/r2.ts apps/muestras/lib/fichas/pdf.ts apps/muestras/lib/piezas
git commit -m "Muestras: frenos con huella de IP, PDF pesados a R2, fotos para PDF y dibujo compartido"
```

**Acceptance:** ninguna clave del freno contiene una IP; un PDF de más de 4 MB nunca sale por la función; las fichas siguen saliendo iguales.

---
### Task 6: Texto curatorial en la ficha y en la página pública

**Files:**
- Modify: `apps/muestras/lib/actividades/mapear.ts`, `apps/muestras/lib/actividades/mapear.test.ts`, `apps/muestras/components/formulario/formulario-actividad.tsx`, `apps/muestras/app/m/[slug]/page.tsx`

**Interfaces:**
- Consumes: columnas `curatorialText`, `curatorCredits` (Task 4).
- Produces: `FichaForm.curatorialText: string | null`, `FichaForm.curatorCredits: string | null`; `LARGOS.curatorialText = 6000`, `LARGOS.curatorCredits = 300`; `datosParaGuardar` escribe los dos (sólo para `MUESTRA`; si no, `null`).

- [ ] **Step 1: Escribir el test que falla**

Agregar a `apps/muestras/lib/actividades/mapear.test.ts` (usar el helper de `FormData` que ya tiene el archivo; si no tiene, armar uno con `new FormData()` y `fd.set(...)`, con los campos mínimos de los otros tests; importar también `LARGOS` y `datosParaGuardar` si el archivo no los importa):
```ts
describe("texto curatorial", () => {
  it("lo lee, conserva los saltos de línea y lo recorta a 6000", () => {
    const fd = formBase({ type: "MUESTRA", curatorialText: `  Primer párrafo.\n\nSegundo.${"x".repeat(7000)}  `, curatorCredits: " Curaduría: Ana Pérez " });
    const f = fichaDesdeFormData(fd, { baseImagenes: null });
    expect(f.curatorialText!.startsWith("Primer párrafo.\n\nSegundo.")).toBe(true);
    expect(f.curatorialText!.length).toBeLessThanOrEqual(LARGOS.curatorialText);
    expect(f.curatorCredits).toBe("Curaduría: Ana Pérez");
  });
  it("vacío es null", () => {
    const f = fichaDesdeFormData(formBase({ type: "MUESTRA", curatorialText: "   " }), { baseImagenes: null });
    expect(f.curatorialText).toBeNull();
    expect(f.curatorCredits).toBeNull();
  });
  it("sólo una muestra guarda texto curatorial", () => {
    const muestra = datosParaGuardar(fichaDesdeFormData(formBase({ type: "MUESTRA", curatorialText: "Texto" }), { baseImagenes: null }));
    const charla = datosParaGuardar(fichaDesdeFormData(formBase({ type: "CHARLA", curatorialText: "Texto" }), { baseImagenes: null }));
    expect(muestra.curatorialText).toBe("Texto");
    expect(charla.curatorialText).toBeNull();
  });
});
```
donde `formBase(extra)` arma un `FormData` con `title`, `startDay`, `endDay` y los pares de `extra` (definirlo en el archivo si no existe uno equivalente).

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter muestras test -- lib/actividades/mapear`
Expected: FAIL — `curatorialText` es `undefined`.

- [ ] **Step 3: Implementar**

En `apps/muestras/lib/actividades/mapear.ts`:
- `FichaForm` suma, debajo de `description: string;`:
```ts
  /** Texto curatorial (sólo muestras): ficha pública, cartel y catálogo. */
  curatorialText: string | null;
  curatorCredits: string | null;
```
- `LARGOS` suma `curatorialText: 6000,` y `curatorCredits: 300,`.
- `fichaDesdeFormData` suma, debajo de `description`:
```ts
    curatorialText: opt(fd, "curatorialText", LARGOS.curatorialText),
    curatorCredits: opt(fd, "curatorCredits", LARGOS.curatorCredits),
```
- `datosParaGuardar` suma, debajo de `description: f.description,`:
```ts
    // Sólo una muestra tiene curaduría; si cambió de tipo, se limpia.
    curatorialText: f.type === "MUESTRA" ? f.curatorialText : null,
    curatorCredits: f.type === "MUESTRA" ? f.curatorCredits : null,
```

En `apps/muestras/components/formulario/formulario-actividad.tsx`, debajo del `<label>` de "Organizadores":
```tsx
        {esMuestra ? (
          <>
            <label className="block">Texto curatorial (optativo)
              <textarea name="curatorialText" rows={8} maxLength={6000} className={campo} defaultValue={inicial?.curatorialText ?? ""} />
              <span className="mt-1 block text-sm text-[var(--mf-muted)]">Va en la página de la muestra, en el cartel de sala y en el catálogo. Separá los párrafos con una línea en blanco.</span>
            </label>
            <label className="block">Curaduría (optativo)
              <input name="curatorCredits" maxLength={300} className={campo} defaultValue={inicial?.curatorCredits ?? ""} placeholder="Curaduría: Ana Pérez" />
            </label>
          </>
        ) : null}
```

En `apps/muestras/app/m/[slug]/page.tsx`, debajo de `<div className="whitespace-pre-line">{a.description}</div>`:
```tsx
      {a.type === "MUESTRA" && a.curatorialText ? (
        <section aria-labelledby="t-curatorial" className="space-y-3 border-t border-[var(--mf-line)] pt-6">
          <h2 id="t-curatorial" className="mf-titulo text-[1.6rem]">Texto curatorial</h2>
          <div className="max-w-[68ch] whitespace-pre-line leading-relaxed">{a.curatorialText}</div>
          {a.curatorCredits ? <p className="text-[var(--mf-muted)]">{a.curatorCredits}</p> : null}
        </section>
      ) : null}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: PASS.

- [ ] **Step 5: Probar en local**

Con `pnpm --filter muestras dev` (puerto 3014; base real ya migrada sólo después de la Task 14 — hasta entonces, probar contra una rama de Neon con la migración aplicada, o dejar este paso para la Task 14): en una muestra propia, escribir dos párrafos de texto curatorial y "Curaduría: …", guardar, recargar el editor (los valores vuelven), y abrir `/m/<slug>`: aparece "Texto curatorial" con los párrafos separados. Cambiar el tipo a "Charla": los campos desaparecen.

- [ ] **Step 6: Commit**

```bash
git add apps/muestras/lib/actividades/mapear.ts apps/muestras/lib/actividades/mapear.test.ts apps/muestras/components/formulario/formulario-actividad.tsx "apps/muestras/app/m/[slug]/page.tsx"
git commit -m "Muestras: texto curatorial y créditos de curaduría en la ficha"
```

**Acceptance:** el texto curatorial se guarda, se recorta a 6000, sólo existe para muestras y se ve en la página pública con sus párrafos.

---
### Task 7: Conteo de visitas y escaneos

**Files:**
- Create: `apps/muestras/lib/estadisticas/contar.ts`, `apps/muestras/lib/estadisticas/qr.ts`, `apps/muestras/app/q/[tipo]/[id]/route.ts`, `apps/muestras/app/api/visitas/route.ts`, `apps/muestras/components/estadisticas/contar-visita.tsx`
- Modify: `apps/muestras/lib/fichas/texto.ts`, `apps/muestras/lib/fichas/texto.test.ts`, `apps/muestras/app/m/[slug]/page.tsx`, `apps/muestras/app/m/[slug]/o/[workId]/page.tsx`
- Test: `apps/muestras/lib/estadisticas/contar.test.ts`, `apps/muestras/lib/estadisticas/qr-ruta.test.ts`, `apps/muestras/lib/estadisticas/visitas-ruta.test.ts`

**Interfaces:**
- Consumes: `isBotUserAgent`, `isPrefetch`, `isQrKind`, `metricForQrKind`, `scanUrl`, `workPath`, `ACTIVITY_LEVEL` (Task 3); `frenarPorIp`, `ipDeLaPeticion` (Task 5); `getUsuario`.
- Produces:
  - `contar.ts`: `sumarUno({ activityId, workId, metric, ahora? })`, `pedidoContable(headers)`, `esDeQuienOrganiza(proposedByUserId)`
  - `qr.ts`: `DestinoQr = { path; activityId; workId; metric; proposedByUserId }`, `destinoDelQr(tipo, id): Promise<DestinoQr | null>`
  - Rutas `GET|HEAD /q/[tipo]/[id]`, `POST /api/visitas`; componente `<ContarVisita actividad obra? />`
  - Las fichas nuevas apuntan a `/q/o/<id>`.

- [ ] **Step 1: Escribir los tests que fallan**

`apps/muestras/lib/estadisticas/contar.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ $executeRaw: vi.fn() }));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean } }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
const { esDeQuienOrganiza, pedidoContable, sumarUno } = await import("./contar");

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1";
beforeEach(() => vi.clearAllMocks());

describe("sumarUno", () => {
  it("suma uno con INSERT … ON CONFLICT y el día argentino como texto", async () => {
    // 01:00 UTC del 16 = 22:00 del 15 en Argentina.
    await sumarUno({ activityId: "a1", workId: "", metric: "VIEW", ahora: new Date("2026-11-16T01:00:00Z") });
    const [sql, ...valores] = db.$executeRaw.mock.calls[0]!;
    expect((sql as string[]).join("?")).toMatch(/ON CONFLICT \("activityId", "workId", "day", "metric"\) DO UPDATE SET "count" = "CulturalActivityDailyStat"\."count" \+ 1/);
    expect(valores).toEqual(["a1", "", "2026-11-15", "VIEW"]);
  });
});

describe("qué se cuenta", () => {
  it("un navegador sí; un robot o una precarga no", () => {
    expect(pedidoContable(new Headers({ "user-agent": UA }))).toBe(true);
    expect(pedidoContable(new Headers({ "user-agent": "WhatsApp/2.24" }))).toBe(false);
    expect(pedidoContable(new Headers({ "user-agent": UA, "sec-purpose": "prefetch" }))).toBe(false);
  });
  it("no cuenta al organizador ni al super admin", async () => {
    usuarioActual.valor = null;
    expect(await esDeQuienOrganiza(7)).toBe(false);
    usuarioActual.valor = { id: 7, esSuperAdmin: false };
    expect(await esDeQuienOrganiza(7)).toBe(true);
    usuarioActual.valor = { id: 8, esSuperAdmin: false };
    expect(await esDeQuienOrganiza(7)).toBe(false);
    usuarioActual.valor = { id: 1, esSuperAdmin: true };
    expect(await esDeQuienOrganiza(7)).toBe(true);
  });
});
```

`apps/muestras/lib/estadisticas/qr-ruta.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivityWork: { findUnique: vi.fn() },
  culturalActivity: { findUnique: vi.fn() },
  $executeRaw: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean } }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
const { GET, HEAD } = await import("@/app/q/[tipo]/[id]/route");
const { resetRateLimit } = await import("@/lib/limite");

const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36";
const pedir = (tipo: string, id: string, ua = UA) =>
  GET(new Request(`http://localhost:3014/q/${tipo}/${id}`, { headers: { "user-agent": ua, "x-forwarded-for": "1.1.1.1" } }), { params: Promise.resolve({ tipo, id }) });
const muestra = { id: "a1", slug: "miradas-abc", reviewStatus: "APPROVED", type: "MUESTRA", proposedByUserId: 7 };

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = null;
  db.culturalActivityWork.findUnique.mockResolvedValue({ id: "w1", activity: muestra });
  db.culturalActivity.findUnique.mockResolvedValue(muestra);
});

describe("GET /q/[tipo]/[id]", () => {
  it("la ficha de una obra cuenta un escaneo y lleva a la obra, sin caché", async () => {
    const r = await pedir("o", "w1");
    expect(r.status).toBe(302);
    expect(new URL(r.headers.get("location")!).pathname).toBe("/m/miradas-abc/o/w1");
    expect(r.headers.get("cache-control")).toMatch(/no-store/);
    expect(db.$executeRaw.mock.calls[0]!.slice(1)).toEqual(["a1", "w1", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), "SCAN"]);
  });
  it("el cartel lleva a la muestra y el afiche al libro", async () => {
    expect(new URL((await pedir("m", "a1")).headers.get("location")!).pathname).toBe("/m/miradas-abc");
    const libro = await pedir("l", "a1");
    expect(new URL(libro.headers.get("location")!).pathname).toBe("/m/miradas-abc/libro");
    expect(db.$executeRaw.mock.calls[1]!.slice(1)).toEqual(["a1", "", expect.any(String), "GUESTBOOK_SCAN"]);
  });
  it("un robot o el organizador no cuentan, pero igual redirige", async () => {
    expect((await pedir("o", "w1", "facebookexternalhit/1.1")).status).toBe(302);
    usuarioActual.valor = { id: 7, esSuperAdmin: false };
    expect((await pedir("o", "w1")).status).toBe(302);
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
  it("algo despublicado, inexistente o mal formado va a la portada sin contar", async () => {
    db.culturalActivityWork.findUnique.mockResolvedValue({ id: "w1", activity: { ...muestra, reviewStatus: "UNPUBLISHED" } });
    expect(new URL((await pedir("o", "w1")).headers.get("location")!).pathname).toBe("/");
    db.culturalActivity.findUnique.mockResolvedValue(null);
    expect(new URL((await pedir("m", "nada")).headers.get("location")!).pathname).toBe("/");
    expect(new URL((await pedir("x", "a1")).headers.get("location")!).pathname).toBe("/");
    expect(new URL((await pedir("o", "../../etc")).headers.get("location")!).pathname).toBe("/");
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
  it("si contar falla, la redirección anda igual", async () => {
    db.$executeRaw.mockRejectedValue(new Error("base caída"));
    expect((await pedir("o", "w1")).status).toBe(302);
  });
  it("HEAD redirige sin contar", async () => {
    const r = await HEAD(new Request("http://localhost:3014/q/o/w1", { method: "HEAD", headers: { "user-agent": UA } }), { params: Promise.resolve({ tipo: "o", id: "w1" }) });
    expect(r.status).toBe(302);
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
});
```

`apps/muestras/lib/estadisticas/visitas-ruta.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivity: { findFirst: vi.fn() },
  culturalActivityWork: { findFirst: vi.fn() },
  $executeRaw: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean } }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
const { POST } = await import("@/app/api/visitas/route");
const { resetRateLimit } = await import("@/lib/limite");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";
const enviar = (cuerpo: unknown, ua = UA) =>
  POST(new Request("http://localhost:3014/api/visitas", { method: "POST", body: JSON.stringify(cuerpo), headers: { "user-agent": ua, "content-type": "application/json" } }));

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = null;
  db.culturalActivity.findFirst.mockResolvedValue({ id: "cka1b2c3d4", proposedByUserId: 7 });
  db.culturalActivityWork.findFirst.mockResolvedValue({ id: "ckw1b2c3d4" });
});

describe("POST /api/visitas", () => {
  it("cuenta la visita a la muestra y a una obra", async () => {
    expect((await enviar({ a: "cka1b2c3d4" })).status).toBe(204);
    expect((await enviar({ a: "cka1b2c3d4", o: "ckw1b2c3d4" })).status).toBe(204);
    expect(db.$executeRaw.mock.calls.map((c) => [c[1], c[2], c[4]])).toEqual([["cka1b2c3d4", "", "VIEW"], ["cka1b2c3d4", "ckw1b2c3d4", "VIEW"]]);
  });
  it("siempre 204 y no cuenta lo que no corresponde", async () => {
    db.culturalActivityWork.findFirst.mockResolvedValue(null);
    expect((await enviar({ a: "cka1b2c3d4", o: "ajena12345" })).status).toBe(204);
    expect((await enviar({ a: "mal formado!" })).status).toBe(204);
    expect((await enviar("no es json")).status).toBe(204);
    expect((await enviar({ a: "cka1b2c3d4" }, "curl/8.0")).status).toBe(204);
    usuarioActual.valor = { id: 7, esSuperAdmin: false };
    expect((await enviar({ a: "cka1b2c3d4" })).status).toBe(204);
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
});
```

En `apps/muestras/lib/fichas/texto.test.ts`, la URL esperada de `datosDeFicha` pasa a la del QR con conteo (p. ej. `https://x.com/q/o/w` en lugar de `https://x.com/m/m/o/w`; ajustar cada `expect` de `url`).

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter muestras test -- lib/estadisticas lib/fichas`
Expected: FAIL — no existen `contar.ts` ni las rutas, y la URL de la ficha sigue siendo la vieja.

- [ ] **Step 3: Implementar el contador**

`apps/muestras/lib/estadisticas/contar.ts`:
```ts
import "server-only";
import { prisma } from "@repo/db";
import { isBotUserAgent, isPrefetch, toArDay, type StatMetric } from "@repo/muestras";
import { getUsuario } from "@/lib/usuario";

/**
 * Suma uno al contador del día (hora argentina). `INSERT … ON CONFLICT` es atómico: dos visitas
 * en el mismo instante nunca chocan (un `upsert` de Prisma puede fallar con P2002). Sólo
 * parámetros de texto: nada de números que Prisma mande como bigint.
 */
export async function sumarUno(c: { activityId: string; workId: string; metric: StatMetric; ahora?: Date }) {
  const day = toArDay(c.ahora ?? new Date());
  await prisma.$executeRaw`INSERT INTO "CulturalActivityDailyStat" ("activityId", "workId", "day", "metric", "count")
    VALUES (${c.activityId}, ${c.workId}, ${day}, ${c.metric}, 1)
    ON CONFLICT ("activityId", "workId", "day", "metric") DO UPDATE SET "count" = "CulturalActivityDailyStat"."count" + 1`;
}

/** Ni robots ni precargas. */
export function pedidoContable(h: Headers): boolean {
  return !isBotUserAgent(h.get("user-agent")) && !isPrefetch(h);
}

/**
 * Quien organiza (o el super admin) mirando su propia muestra no cuenta. Sin cookie de sesión
 * `getUsuario` vuelve enseguida sin tocar la base: el caso del público no paga nada.
 */
export async function esDeQuienOrganiza(proposedByUserId: number): Promise<boolean> {
  const u = await getUsuario();
  return !!u && (u.esSuperAdmin || u.id === proposedByUserId);
}
```

`apps/muestras/lib/estadisticas/qr.ts`:
```ts
import "server-only";
import { prisma } from "@repo/db";
import { ACTIVITY_LEVEL, isQrKind, metricForQrKind, workPath, type StatMetric } from "@repo/muestras";

export type DestinoQr = { path: string; activityId: string; workId: string; metric: StatMetric; proposedByUserId: number };

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const publicada = (a: { reviewStatus: string; type: string }) => a.reviewStatus === "APPROVED" && a.type === "MUESTRA";
const SELECT = { id: true, slug: true, reviewStatus: true, type: true, proposedByUserId: true } as const;

/** A dónde lleva un QR impreso, o `null` si ya no lleva a nada publicado. */
export async function destinoDelQr(tipo: string, id: string): Promise<DestinoQr | null> {
  if (!isQrKind(tipo) || !ID.test(id)) return null;
  if (tipo === "o") {
    const w = await prisma.culturalActivityWork.findUnique({ where: { id }, select: { id: true, activity: { select: SELECT } } });
    if (!w || !publicada(w.activity)) return null;
    return { path: workPath(w.activity.slug, w.id), activityId: w.activity.id, workId: w.id, metric: metricForQrKind("o"), proposedByUserId: w.activity.proposedByUserId };
  }
  const a = await prisma.culturalActivity.findUnique({ where: { id }, select: SELECT });
  if (!a || !publicada(a)) return null;
  const path = tipo === "l" ? `/m/${encodeURIComponent(a.slug)}/libro` : `/m/${encodeURIComponent(a.slug)}`;
  return { path, activityId: a.id, workId: ACTIVITY_LEVEL, metric: metricForQrKind(tipo), proposedByUserId: a.proposedByUserId };
}
```

`apps/muestras/app/q/[tipo]/[id]/route.ts`:
```ts
import { destinoDelQr } from "@/lib/estadisticas/qr";
import { esDeQuienOrganiza, pedidoContable, sumarUno } from "@/lib/estadisticas/contar";
import { frenarPorIp, ipDeLaPeticion } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ tipo: string; id: string }> };

/** 302 sin caché: cada escaneo vuelve a pasar por acá (decisión D12). */
function redirigir(req: Request, path: string) {
  return new Response(null, { status: 302, headers: { Location: new URL(path, req.url).toString(), "Cache-Control": "private, no-store" } });
}

/** QR impreso en fichas, carteles, catálogos y afiches: cuenta el escaneo y lleva a la página. */
export async function GET(req: Request, { params }: Ctx) {
  const { tipo, id } = await params;
  const destino = await destinoDelQr(tipo, id);
  if (!destino) return redirigir(req, "/");
  try {
    if (
      pedidoContable(req.headers) &&
      frenarPorIp("escaneos", ipDeLaPeticion(req.headers)).allowed &&
      !(await esDeQuienOrganiza(destino.proposedByUserId))
    ) {
      await sumarUno({ activityId: destino.activityId, workId: destino.workId, metric: destino.metric });
    }
  } catch (err) {
    // Contar nunca puede romper un QR impreso.
    console.error("[q] no se pudo contar el escaneo:", err instanceof Error ? err.message : String(err));
  }
  return redirigir(req, destino.path);
}

/** Algunos lectores de QR preguntan con HEAD antes de abrir: se redirige sin contar. */
export async function HEAD(req: Request, { params }: Ctx) {
  const { tipo, id } = await params;
  const destino = await destinoDelQr(tipo, id);
  return redirigir(req, destino?.path ?? "/");
}
```

`apps/muestras/app/api/visitas/route.ts`:
```ts
import { prisma } from "@repo/db";
import { ACTIVITY_LEVEL } from "@repo/muestras";
import { esDeQuienOrganiza, pedidoContable, sumarUno } from "@/lib/estadisticas/contar";
import { frenarPorIp, ipDeLaPeticion } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Baliza de visita (D14). Responde siempre 204 sin cuerpo: no dice nada de lo que existe ni de
 * si se contó.
 */
export async function POST(req: Request) {
  const listo = () => new Response(null, { status: 204 });
  if (!pedidoContable(req.headers)) return listo();
  if (Number(req.headers.get("content-length") ?? 0) > 1000) return listo();
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse((await req.text()).slice(0, 1000));
  } catch {
    return listo();
  }
  const { a, o } = (cuerpo && typeof cuerpo === "object" ? cuerpo : {}) as { a?: unknown; o?: unknown };
  if (typeof a !== "string" || !ID.test(a) || (o !== undefined && (typeof o !== "string" || !ID.test(o)))) return listo();
  if (!frenarPorIp("visitas", ipDeLaPeticion(req.headers)).allowed) return listo();
  try {
    const actividad = await prisma.culturalActivity.findFirst({ where: { id: a, reviewStatus: "APPROVED" }, select: { id: true, proposedByUserId: true } });
    if (!actividad) return listo();
    if (o) {
      const obra = await prisma.culturalActivityWork.findFirst({ where: { id: o, activityId: a }, select: { id: true } });
      if (!obra) return listo();
    }
    if (await esDeQuienOrganiza(actividad.proposedByUserId)) return listo();
    await sumarUno({ activityId: a, workId: o ?? ACTIVITY_LEVEL, metric: "VIEW" });
  } catch (err) {
    console.error("[visitas] no se pudo contar:", err instanceof Error ? err.message : String(err));
  }
  return listo();
}
```

`apps/muestras/components/estadisticas/contar-visita.tsx`:
```tsx
"use client";

import { useEffect } from "react";

/**
 * Cuenta una visita a la página (D14): una vez por pestaña, sin cookies. Las páginas públicas se
 * sirven de caché, así que el servidor no se entera de otra forma. No dibuja nada.
 */
export function ContarVisita({ actividad, obra }: { actividad: string; obra?: string }) {
  useEffect(() => {
    const clave = `mf-visita:${actividad}:${obra ?? ""}`;
    try {
      if (sessionStorage.getItem(clave)) return;
      sessionStorage.setItem(clave, "1");
    } catch {
      // Sin almacenamiento (modo privado estricto): se cuenta igual.
    }
    const cuerpo = JSON.stringify(obra ? { a: actividad, o: obra } : { a: actividad });
    try {
      if (navigator.sendBeacon?.("/api/visitas", new Blob([cuerpo], { type: "application/json" }))) return;
    } catch {
      // Sigue con fetch.
    }
    void fetch("/api/visitas", { method: "POST", body: cuerpo, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }, [actividad, obra]);
  return null;
}
```

- [ ] **Step 4: Sumar la baliza a las páginas y pasar las fichas a `/q`**

- `app/m/[slug]/page.tsx`: importar `ContarVisita` y poner `<ContarVisita actividad={a.id} />` como primer hijo de `<main>`.
- `app/m/[slug]/o/[workId]/page.tsx`: `<ContarVisita actividad={a.id} obra={obra.id} />` como primer hijo de `<main>`.
- `lib/fichas/texto.ts`: en `datosDeFicha`, `url: scanUrl(baseUrl, "o", o.id),` (importar `scanUrl` de `@repo/muestras`; `workUrl` deja de usarse acá). El comentario de arriba de la función dice ahora: "El QR pasa por `/q/o/<obra>`, que cuenta el escaneo y redirige a la página de la obra (etapa 4). Las fichas impresas antes siguen apuntando directo a la obra y siguen andando."

- [ ] **Step 5: Correr y ver que pasa**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/muestras/lib/estadisticas apps/muestras/app/q apps/muestras/app/api/visitas apps/muestras/components/estadisticas/contar-visita.tsx apps/muestras/lib/fichas/texto.ts apps/muestras/lib/fichas/texto.test.ts "apps/muestras/app/m/[slug]/page.tsx" "apps/muestras/app/m/[slug]/o/[workId]/page.tsx"
git commit -m "Muestras: QR con conteo de escaneos y baliza de visitas, sin datos personales"
```

**Acceptance:** cada escaneo de una ficha nueva suma un `SCAN` y lleva a la obra; los QR viejos siguen andando; ningún robot, precarga ni el organizador suma; contar nunca rompe una redirección.

---
### Task 8: PDF de marcos y del cartel de sala

**Files:**
- Create: `apps/muestras/lib/piezas/textos.ts`, `apps/muestras/lib/piezas/marco.ts`, `apps/muestras/lib/piezas/cartel.ts`
- Test: `apps/muestras/lib/piezas/textos.test.ts`, `apps/muestras/lib/piezas/marco.test.ts`, `apps/muestras/lib/piezas/cartel.test.ts`

**Interfaces:**
- Consumes: `frameLayout`, `FRAME_SIZES`, `POSTER_SIZES`, `largestThatFits`, `dateRangeText`, `scanUrl`, `formatCm` (Tasks 1–3); `dibujo.ts`, `ImagenPdf` (Task 5).
- Produces:
  - `textos.ts`: `MuestraParaPiezas` (forma de la consulta de la Task 11), `detalleDeObra(o)`, `autorDeObra(nombre)`, `lugarDeMuestra(a)`, `urlVisible(base, path)`, `DatosCartel`, `datosDeCartel(a, base)`, `nombreDePieza(pieza, slug, extra)`
  - `marco.ts`: `ObraParaMarco`, `OpcionesMarco`, `pdfDeMarcos(muestra, obras, opciones, fecha)`
  - `cartel.ts`: `pdfDeCartel(datos, tamano, fecha)`

- [ ] **Step 1: Escribir los tests que fallan**

`apps/muestras/lib/piezas/textos.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { dayEndAr, dayStartAr } from "@repo/muestras";
import { autorDeObra, datosDeCartel, detalleDeObra, lugarDeMuestra, nombreDePieza, urlVisible } from "./textos";

const a = {
  id: "cka1", slug: "miradas-abc", title: "Miradas del litoral", organizersText: "Foto Club Rosario",
  curatorialText: "Uno.\n\nDos.", curatorCredits: "Curaduría: Ana Pérez",
  startsAt: dayStartAr("2026-11-05"), endsAt: dayEndAr("2026-11-20"), scheduleText: "Martes a domingo, 15 a 20",
  venueName: "Centro Cultural Parque España", address: "Sarmiento 1", city: "Rosario", province: "Santa Fe",
};

describe("textos de las piezas", () => {
  it("datos del cartel", () => {
    expect(datosDeCartel(a, "https://muestrasfotograficas.com")).toEqual({
      titulo: "Miradas del litoral",
      organizan: "Organiza: Foto Club Rosario",
      curaduria: "Curaduría: Ana Pérez",
      texto: "Uno.\n\nDos.",
      fechas: "Del 5 al 20 de noviembre de 2026",
      horarios: "Martes a domingo, 15 a 20",
      lugar: "Centro Cultural Parque España, Sarmiento 1, Rosario, Santa Fe",
      url: "https://muestrasfotograficas.com/q/m/cka1",
    });
  });
  it("lo que falta queda en null", () => {
    const d = datosDeCartel({ ...a, organizersText: " ", curatorialText: null, curatorCredits: "", scheduleText: null, venueName: null, address: null, city: null, province: null }, "https://x.com");
    expect([d.organizan, d.curaduria, d.texto, d.horarios, d.lugar]).toEqual([null, null, null, null, null]);
  });
  it("detalle, autor y lugar", () => {
    expect(detalleDeObra({ year: 2025, technique: " Copia pigmentaria " })).toBe("2025. Copia pigmentaria");
    expect(detalleDeObra({ year: null, technique: null })).toBeNull();
    expect(autorDeObra("  ")).toBe("Autor sin indicar");
    expect(lugarDeMuestra({ venueName: "Sala", address: null, city: "Rosario", province: null })).toBe("Sala, Rosario");
  });
  it("dirección visible sin protocolo y nombres de archivo seguros", () => {
    expect(urlVisible("https://muestrasfotograficas.com/", "/m/x/libro")).toBe("muestrasfotograficas.com/m/x/libro");
    expect(nombreDePieza("marcos", "miradas-abc", ["A3", "remarco"])).toBe("marcos-miradas-abc-A3-remarco");
    expect(nombreDePieza("cartel", "a b/../c", ["50x70"])).toBe("cartel-a-b----c-50x70");
  });
});
```

`apps/muestras/lib/piezas/marco.test.ts`:
```ts
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { MM } from "./dibujo";
import { pdfDeMarcos } from "./marco";

const foto = async (width: number, height: number) => ({
  jpg: new Uint8Array(await sharp({ create: { width, height, channels: 3, background: "#777777" } }).jpeg().toBuffer()),
  width, height,
});
const paginas = async (bytes: Uint8Array) => {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => [Math.round(p.getWidth() / MM), Math.round(p.getHeight() / MM)]);
};
const fecha = new Date("2026-11-01T12:00:00Z");

describe("pdfDeMarcos", () => {
  it("una página por obra, orientada según su foto", async () => {
    const obras = [
      { titulo: "El río", autor: "Ana Pérez", detalle: "2025", imagen: await foto(300, 200) },
      { titulo: "La torre", autor: "Luis Gil", detalle: null, imagen: await foto(200, 300) },
    ];
    expect(await paginas(await pdfDeMarcos("Miradas", obras, { tamano: "A4", orientacion: "AUTO", conFoto: true }, fecha))).toEqual([[297, 210], [210, 297]]);
  });
  it("orientación forzada y medidas grandes", async () => {
    const obras = [{ titulo: "El río", autor: "Ana", detalle: null, imagen: await foto(300, 200) }];
    expect(await paginas(await pdfDeMarcos("M", obras, { tamano: "50x70", orientacion: "PORTRAIT", conFoto: true }, fecha))).toEqual([[500, 700]]);
  });
  it("sólo el remarco: sin foto, más liviano, y sin imagen disponible también sale", async () => {
    const obras = [{ titulo: "El río", autor: "Ana", detalle: null, imagen: await foto(300, 200) }];
    const con = await pdfDeMarcos("M", obras, { tamano: "A3", orientacion: "AUTO", conFoto: true }, fecha);
    const sin = await pdfDeMarcos("M", obras, { tamano: "A3", orientacion: "AUTO", conFoto: false }, fecha);
    expect(sin.byteLength).toBeLessThan(con.byteLength);
    const rota = [{ titulo: "Sin foto", autor: "Łukasz 📷", detalle: null, imagen: null }];
    expect(await paginas(await pdfDeMarcos("M", rota, { tamano: "A4", orientacion: "AUTO", conFoto: true }, fecha))).toEqual([[210, 297]]);
  });
  it("sin obras no hay PDF", async () => {
    await expect(pdfDeMarcos("M", [], { tamano: "A4", orientacion: "AUTO", conFoto: true }, fecha)).rejects.toThrow("No hay obras");
  });
});
```

`apps/muestras/lib/piezas/cartel.test.ts`:
```ts
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { pdfDeCartel } from "./cartel";
import { MM } from "./dibujo";

const datos = {
  titulo: "Miradas del litoral", organizan: "Organiza: Foto Club Rosario", curaduria: "Curaduría: Ana Pérez",
  texto: "Primer párrafo del texto curatorial.\n\nSegundo párrafo.", fechas: "Del 5 al 20 de noviembre de 2026",
  horarios: "Martes a domingo, 15 a 20", lugar: "Centro Cultural, Rosario", url: "https://muestrasfotograficas.com/q/m/cka1",
};
const fecha = new Date("2026-11-01T12:00:00Z");
const medida = async (b: Uint8Array) => {
  const d = await PDFDocument.load(b);
  return [d.getPageCount(), Math.round(d.getPage(0).getWidth() / MM), Math.round(d.getPage(0).getHeight() / MM)];
};

describe("pdfDeCartel", () => {
  it("una página vertical en cada medida", async () => {
    expect(await medida(await pdfDeCartel(datos, "A3", fecha))).toEqual([1, 297, 420]);
    expect(await medida(await pdfDeCartel(datos, "A2", fecha))).toEqual([1, 420, 594]);
    expect(await medida(await pdfDeCartel(datos, "50x70", fecha))).toEqual([1, 500, 700]);
  });
  it("un texto larguísimo no rompe ni agrega páginas; sin texto también sale", async () => {
    expect((await medida(await pdfDeCartel({ ...datos, texto: "Palabra larga. ".repeat(600) }, "A3", fecha)))[0]).toBe(1);
    expect((await medida(await pdfDeCartel({ ...datos, texto: null, organizan: null, curaduria: null, horarios: null, lugar: null }, "A3", fecha)))[0]).toBe(1);
  });
  it("el mismo contenido da los mismos bytes (no se acumulan copias en R2)", async () => {
    const a = await pdfDeCartel(datos, "A3", fecha);
    const b = await pdfDeCartel(datos, "A3", fecha);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
});
```
(Si el último test fallara porque `pdf-lib` mete algo al azar, no es grave: borrar ese test y anotarlo en la guía; cada descarga pesada dejaría un PDF más en R2.)

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter muestras test -- lib/piezas`
Expected: FAIL — no existen `textos.ts`, `marco.ts` ni `cartel.ts`.

- [ ] **Step 3: Implementar `textos.ts`**

`apps/muestras/lib/piezas/textos.ts`:
```ts
import { NO_AUTHOR, dateRangeText, scanUrl } from "@repo/muestras";

/** Lo que las piezas leen de una muestra (lo arma `cargarMuestraParaPiezas`, Task 11). */
export type MuestraParaPiezas = {
  id: string; slug: string; title: string; organizersText: string;
  curatorialText: string | null; curatorCredits: string | null;
  startsAt: Date; endsAt: Date; scheduleText: string | null;
  venueName: string | null; address: string | null; city: string | null; province: string | null;
  coverImageUrl: string | null; hangingPlan: unknown; updatedAt: Date;
  works: { id: string; title: string; authorName: string; year: number | null; technique: string | null; imageUrl: string; sortOrder: number }[];
};

const lleno = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

export function detalleDeObra(o: { year: number | null; technique: string | null }): string | null {
  return [o.year ? String(o.year) : null, lleno(o.technique)].filter(Boolean).join(". ") || null;
}

export function autorDeObra(nombre: string): string {
  return lleno(nombre) ?? NO_AUTHOR;
}

export function lugarDeMuestra(a: { venueName: string | null; address: string | null; city: string | null; province: string | null }): string | null {
  return [a.venueName, a.address, a.city, a.province].map(lleno).filter(Boolean).join(", ") || null;
}

/** "muestrasfotograficas.com/m/x/libro": para escribir a mano si el QR no anda. */
export function urlVisible(base: string, path: string): string {
  return `${base.replace(/\/+$/, "").replace(/^https?:\/\//, "")}${path}`;
}

export type DatosCartel = {
  titulo: string; organizan: string | null; curaduria: string | null; texto: string | null;
  fechas: string; horarios: string | null; lugar: string | null; url: string;
};

type ParaCartel = Pick<MuestraParaPiezas, "id" | "title" | "organizersText" | "curatorialText" | "curatorCredits" | "startsAt" | "endsAt" | "scheduleText" | "venueName" | "address" | "city" | "province">;

export function datosDeCartel(a: ParaCartel, base: string): DatosCartel {
  const organizan = lleno(a.organizersText);
  return {
    titulo: a.title,
    organizan: organizan ? `Organiza: ${organizan}` : null,
    curaduria: lleno(a.curatorCredits),
    texto: lleno(a.curatorialText),
    fechas: dateRangeText(a.startsAt, a.endsAt),
    horarios: lleno(a.scheduleText),
    lugar: lugarDeMuestra(a),
    // El QR del cartel y del catálogo pasa por /q/m: cuenta el escaneo (D12).
    url: scanUrl(base, "m", a.id),
  };
}

/** Nombre del archivo: sólo letras, números, guiones y puntos (va en una cabecera). */
export function nombreDePieza(pieza: string, slug: string, extra: string[]): string {
  return [pieza, slug, ...extra].join("-").replace(/[^A-Za-z0-9.-]/g, "-");
}
```
(`NO_AUTHOR` lo exporta `print.ts`, Task 1.)

- [ ] **Step 4: Implementar `marco.ts`**

`apps/muestras/lib/piezas/marco.ts`:
```ts
import { PDFDocument } from "pdf-lib";
import { formatCm, frameLayout, type FrameSize, type Orientation } from "@repo/muestras";
import { GRIS, MM, TINTA, bloqueCentrado, cargarFuentes, lineaPunteada, prepararDocumento } from "./dibujo";
import type { ImagenPdf } from "./imagen";

export type ObraParaMarco = { titulo: string; autor: string; detalle: string | null; imagen: ImagenPdf | null };
export type OpcionesMarco = { tamano: FrameSize; orientacion: Orientation; conFoto: boolean };

const mm = (n: number) => n * MM;

/**
 * Marco / remarco de cada obra (D3): la foto entera con su margen blanco y, debajo, título y
 * autor. "Sólo el remarco" (`conFoto: false`) deja la ventana marcada con línea punteada, a la
 * medida de la foto, para usar con una copia propia.
 */
export async function pdfDeMarcos(muestra: string, obras: ObraParaMarco[], o: OpcionesMarco, fecha: Date): Promise<Uint8Array> {
  if (obras.length === 0) throw new Error("No hay obras para imprimir.");
  const pdf = await PDFDocument.create();
  prepararDocumento(pdf, `Marcos: ${muestra}`, fecha);
  const f = await cargarFuentes(pdf);
  for (const obra of obras) {
    const l = frameLayout(o.tamano, o.orientacion, obra.imagen ? { width: obra.imagen.width, height: obra.imagen.height } : null);
    const p = pdf.addPage([mm(l.page.width), mm(l.page.height)]);
    const caja = { x: mm(l.image.x), y: mm(l.image.y), width: mm(l.image.width), height: mm(l.image.height) };
    if (o.conFoto && obra.imagen) {
      p.drawImage(await pdf.embedJpg(obra.imagen.jpg), caja);
    } else {
      lineaPunteada(p, caja);
      const medida = `Ventana de ${formatCm(Math.round(l.image.width) / 10)} × ${formatCm(Math.round(l.image.height) / 10)} cm`;
      bloqueCentrado(p, medida, { x: caja.x, y: caja.y + caja.height / 2 + 6, ancho: caja.width, size: 9, font: f.normal, color: GRIS, maxLineas: 1 });
    }
    // Título y autor centrados debajo de la foto, dentro de los márgenes.
    const pie = { x: mm(l.window.x), ancho: mm(l.window.width) };
    let y = bloqueCentrado(p, obra.titulo, { ...pie, y: mm(l.captionTop), size: l.titleSizePt, font: f.negrita, color: TINTA, maxLineas: 2, interlinea: 1.15 });
    y = bloqueCentrado(p, obra.autor, { ...pie, y: y - l.authorSizePt * 0.2, size: l.authorSizePt, font: f.normal, color: TINTA, maxLineas: 1 });
    if (obra.detalle) bloqueCentrado(p, obra.detalle, { ...pie, y, size: l.authorSizePt * 0.85, font: f.normal, color: GRIS, maxLineas: 1 });
  }
  return pdf.save();
}
```

- [ ] **Step 5: Implementar `cartel.ts`**

`apps/muestras/lib/piezas/cartel.ts`:
```ts
import { PDFDocument, type PDFFont } from "pdf-lib";
import { POSTER_SIZES, largestThatFits, type PosterSize } from "@repo/muestras";
import { GRIS, LINEA, MM, TINTA, bloque, cargarFuentes, dibujarLineas, dibujarQr, lineasConParrafos, prepararDocumento } from "./dibujo";
import type { DatosCartel } from "./textos";

const INTERLINEA = 1.35;

/** Recorta la última línea para que entre con "…" al final. */
function conPuntos(linea: string, ancho: number, font: PDFFont, size: number): string {
  let l = linea;
  while (l.length > 1 && font.widthOfTextAtSize(`${l}…`, size) > ancho) l = l.slice(0, -1).trimEnd();
  return `${l}…`;
}

/**
 * Cartel de sala (D6): título, organiza, curaduría, el texto curatorial con la letra más grande
 * que entra, y al pie fechas, horarios, sede y QR a la muestra. Una sola página vertical.
 */
export async function pdfDeCartel(d: DatosCartel, tamano: PosterSize, fecha: Date): Promise<Uint8Array> {
  const t = POSTER_SIZES[tamano];
  const W = t.width * MM;
  const H = t.height * MM;
  const e = t.width / 297; // A3 = 1: todo crece con el papel.
  const m = t.width * 0.08 * MM;
  const util = W - 2 * m;
  const pdf = await PDFDocument.create();
  prepararDocumento(pdf, `Cartel: ${d.titulo}`, fecha);
  const f = await cargarFuentes(pdf);
  const p = pdf.addPage([W, H]);

  // Arriba: título, organiza y curaduría, y una línea fina.
  let y = bloque(p, d.titulo, { x: m, y: H - m, ancho: util, size: 40 * e, font: f.negrita, color: TINTA, maxLineas: 3, interlinea: 1.05 });
  if (d.organizan) y = bloque(p, d.organizan, { x: m, y: y - 8 * e, ancho: util, size: 14 * e, font: f.normal, color: GRIS, maxLineas: 2 });
  if (d.curaduria) y = bloque(p, d.curaduria, { x: m, y: y - 2 * e, ancho: util, size: 14 * e, font: f.normal, color: TINTA, maxLineas: 2 });
  y -= 10 * e * MM;
  p.drawLine({ start: { x: m, y }, end: { x: W - m, y }, thickness: 0.6, color: LINEA });

  // Abajo: el QR a la derecha y los datos a su izquierda.
  const lado = t.width * 0.17 * MM;
  dibujarQr(p, d.url, W - m - lado, m, lado);
  const anchoPie = util - lado - 8 * MM * e;
  let yp = bloque(p, d.fechas, { x: m, y: m + lado, ancho: anchoPie, size: 15 * e, font: f.negrita, color: TINTA, maxLineas: 2 });
  if (d.horarios) yp = bloque(p, d.horarios, { x: m, y: yp - 2 * e, ancho: anchoPie, size: 12 * e, font: f.normal, color: TINTA, maxLineas: 2 });
  if (d.lugar) yp = bloque(p, d.lugar, { x: m, y: yp - 2 * e, ancho: anchoPie, size: 12 * e, font: f.normal, color: TINTA, maxLineas: 3 });
  bloque(p, "Escaneá el código para ver las obras online", { x: m, y: yp - 6 * e, ancho: anchoPie, size: 10 * e, font: f.normal, color: GRIS, maxLineas: 2 });

  // En el medio, el texto curatorial con la letra más grande que entra.
  if (d.texto) {
    const arriba = y - 8 * MM * e;
    const abajo = m + lado + 12 * MM * e;
    const alto = arriba - abajo;
    const medir = (size: number) => (s: string) => f.normal.widthOfTextAtSize(s, size);
    const tamanos = [18, 16, 15, 14, 13, 12, 11, 10, 9].map((s) => s * e);
    const size = largestThatFits(tamanos, (s) => lineasConParrafos(d.texto!, util, medir(s)).length * s * INTERLINEA <= alto);
    let lineas = lineasConParrafos(d.texto, util, medir(size));
    const max = Math.max(1, Math.floor(alto / (size * INTERLINEA)));
    if (lineas.length > max) lineas = [...lineas.slice(0, max - 1), conPuntos(lineas[max - 1] ?? "", util, f.normal, size)];
    dibujarLineas(p, lineas, { x: m, y: arriba, size, font: f.normal, color: TINTA, interlinea: INTERLINEA });
  }
  return pdf.save();
}
```

- [ ] **Step 6: Correr y ver que pasa**

Run: `pnpm --filter muestras test -- lib/piezas && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: PASS.

- [ ] **Step 7: Mirar los PDF**

Escribir un script temporal **fuera del repo** (en el scratchpad de la sesión) que importe `pdfDeMarcos` y `pdfDeCartel` con `tsx` o, más simple, agregar temporalmente al final de `cartel.test.ts` un `writeFileSync("/tmp/cartel-A3.pdf", bytes)`, correrlo, abrir el archivo y **sacar esa línea antes del commit**. Mirar: el título no se pisa con el texto, el QR no toca el borde, el texto curatorial termina antes del pie. Lo mismo con un marco A4 con foto y uno "sólo el remarco".

- [ ] **Step 8: Commit**

```bash
git add apps/muestras/lib/piezas/textos.ts apps/muestras/lib/piezas/textos.test.ts apps/muestras/lib/piezas/marco.ts apps/muestras/lib/piezas/marco.test.ts apps/muestras/lib/piezas/cartel.ts apps/muestras/lib/piezas/cartel.test.ts
git commit -m "Muestras: PDF de marcos y remarcos, y cartel de sala con el texto curatorial"
```

**Acceptance:** cinco medidas de marco y tres de cartel con la medida exacta; foto entera, nunca recortada; texto curatorial que no entra termina en "…" sin agregar páginas.

---
### Task 9: PDF del catálogo y del afiche del libro de visitas

**Files:**
- Create: `apps/muestras/lib/piezas/catalogo.ts`, `apps/muestras/lib/piezas/afiche-libro.ts`
- Test: `apps/muestras/lib/piezas/catalogo.test.ts`, `apps/muestras/lib/piezas/afiche-libro.test.ts`

**Interfaces:**
- Consumes: `CATALOG_SIZES`, `GUESTBOOK_POSTER_SIZES`, `catalogPlan`, `authorIndex`, `fitInside`, `NO_AUTHOR` (Task 1); `dibujo.ts`; `DatosCartel` (Task 8).
- Produces: `ObraCatalogo`, `DatosCatalogo`, `pdfDeCatalogo(datos, tamano, fecha)`; `DatosAficheLibro`, `pdfDeAficheLibro(datos, tamano, fecha)`.

- [ ] **Step 1: Escribir los tests que fallan**

`apps/muestras/lib/piezas/catalogo.test.ts`:
```ts
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { pdfDeCatalogo } from "./catalogo";
import { MM } from "./dibujo";

const foto = async () => ({
  jpg: new Uint8Array(await sharp({ create: { width: 120, height: 80, channels: 3, background: "#777777" } }).jpeg().toBuffer()),
  width: 120, height: 80,
});
const base = async () => ({
  titulo: "Miradas del litoral", organizan: "Organiza: Foto Club", curaduria: "Curaduría: Ana Pérez", texto: null as string | null,
  fechas: "Del 5 al 20 de noviembre de 2026", horarios: null, lugar: "Rosario", url: "https://muestrasfotograficas.com/q/m/cka1",
  urlVisible: "muestrasfotograficas.com/m/miradas", portada: await foto(),
  obras: [
    { titulo: "Uno", autor: "Zoe Ruiz", detalle: "2025", imagen: await foto() },
    { titulo: "Dos", autor: "Ana Pérez", detalle: null, imagen: null },
    { titulo: "Tres", autor: "", detalle: null, imagen: await foto() },
  ],
});
const fecha = new Date("2026-11-01T12:00:00Z");

describe("pdfDeCatalogo", () => {
  it("sin texto curatorial: portada, tres obras, índice y cierre", async () => {
    const doc = await PDFDocument.load(await pdfDeCatalogo(await base(), "A5", fecha));
    expect(doc.getPageCount()).toBe(6);
    expect([Math.round(doc.getPage(0).getWidth() / MM), Math.round(doc.getPage(0).getHeight() / MM)]).toEqual([148, 210]);
  });
  it("un texto curatorial largo ocupa varias páginas y corre todo lo demás", async () => {
    const d = { ...(await base()), texto: Array.from({ length: 30 }, (_, i) => `Párrafo ${i + 1}. ${"Texto del recorrido curatorial. ".repeat(8)}`).join("\n\n") };
    const doc = await PDFDocument.load(await pdfDeCatalogo(d, "A5", fecha));
    expect(doc.getPageCount()).toBeGreaterThan(7);
  });
  it("A4", async () => {
    const doc = await PDFDocument.load(await pdfDeCatalogo(await base(), "A4", fecha));
    expect([Math.round(doc.getPage(3).getWidth() / MM), Math.round(doc.getPage(3).getHeight() / MM)]).toEqual([210, 297]);
  });
  it("sin obras no hay catálogo", async () => {
    await expect(pdfDeCatalogo({ ...(await base()), obras: [] }, "A5", fecha)).rejects.toThrow("No hay obras");
  });
});
```

`apps/muestras/lib/piezas/afiche-libro.test.ts`:
```ts
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { pdfDeAficheLibro } from "./afiche-libro";
import { MM } from "./dibujo";

describe("pdfDeAficheLibro", () => {
  it("una página en A4 y en A3", async () => {
    const d = { muestra: "Miradas del litoral", url: "https://muestrasfotograficas.com/q/l/cka1", urlVisible: "muestrasfotograficas.com/m/miradas/libro" };
    for (const [t, w, h] of [["A4", 210, 297], ["A3", 297, 420]] as const) {
      const doc = await PDFDocument.load(await pdfDeAficheLibro(d, t, new Date("2026-11-01T12:00:00Z")));
      expect([doc.getPageCount(), Math.round(doc.getPage(0).getWidth() / MM), Math.round(doc.getPage(0).getHeight() / MM)]).toEqual([1, w, h]);
    }
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter muestras test -- lib/piezas`
Expected: FAIL — no existen `catalogo.ts` ni `afiche-libro.ts`.

- [ ] **Step 3: Implementar el catálogo**

`apps/muestras/lib/piezas/catalogo.ts`:
```ts
import { PDFDocument, type PDFPage } from "pdf-lib";
import { CATALOG_SIZES, NO_AUTHOR, authorIndex, catalogPlan, fitInside, type CatalogSize } from "@repo/muestras";
import { paraWinAnsi } from "@/lib/fichas/texto";
import { GRIS, LINEA, MM, TINTA, bloque, bloqueCentrado, cargarFuentes, dibujarLineas, dibujarQr, lineasConParrafos, prepararDocumento, type Fuentes } from "./dibujo";
import type { ImagenPdf } from "./imagen";
import type { DatosCartel } from "./textos";

export type ObraCatalogo = { titulo: string; autor: string; detalle: string | null; imagen: ImagenPdf | null };
export type DatosCatalogo = Omit<DatosCartel, "horarios"> & { horarios?: string | null; urlVisible: string; portada: ImagenPdf | null; obras: ObraCatalogo[] };

const INTERLINEA = 1.4;

function trozos<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/**
 * Catálogo (D7): portada, texto curatorial, una página por obra (todas, en el orden de la
 * galería), índice de autores y una página final con QR. Números de página desde la 2.
 */
export async function pdfDeCatalogo(d: DatosCatalogo, tamano: CatalogSize, fecha: Date): Promise<Uint8Array> {
  if (d.obras.length === 0) throw new Error("No hay obras para el catálogo.");
  const t = CATALOG_SIZES[tamano];
  const W = t.width * MM;
  const H = t.height * MM;
  const e = t.width / 148; // A5 = 1
  const m = t.width * 0.1 * MM;
  const util = W - 2 * m;
  const pdf = await PDFDocument.create();
  prepararDocumento(pdf, `Catálogo: ${d.titulo}`, fecha);
  const f = await cargarFuentes(pdf);

  // Primero se cortan texto e índice: de eso dependen los números de página.
  const cuerpo = 10 * e;
  const lineasPorPagina = Math.floor((H - 2 * m - 30 * e) / (cuerpo * INTERLINEA));
  const lineasTexto = d.texto
    ? [...lineasConParrafos(d.texto, util, (s) => f.normal.widthOfTextAtSize(s, cuerpo)), ...(d.curaduria ? ["", paraWinAnsi(d.curaduria)] : [])]
    : [];
  const paginasTexto = trozos(lineasTexto, lineasPorPagina);
  const primeraObra = 2 + paginasTexto.length;
  const indice = authorIndex(d.obras.map((o, i) => ({ authorName: o.autor, page: primeraObra + i })));
  const paginasIndice = trozos(indice, lineasPorPagina);
  const plan = catalogPlan(paginasTexto.length, d.obras.length, paginasIndice.length);

  const nueva = (n: number) => {
    const p = pdf.addPage([W, H]);
    if (n > 1) bloqueCentrado(p, String(n), { x: m, y: m * 0.75, ancho: util, size: 8 * e, font: f.normal, color: GRIS, maxLineas: 1 });
    return p;
  };
  const encabezado = (p: PDFPage, texto: string) =>
    bloque(p, texto, { x: m, y: H - m, ancho: util, size: 14 * e, font: f.negrita, color: TINTA, maxLineas: 1 }) - 10 * e;

  portada(nueva(1), d, { H, m, util, e }, f, await (d.portada ? pdf.embedJpg(d.portada.jpg) : null));

  paginasTexto.forEach((lineas, i) => {
    const p = nueva(2 + i);
    const y = i === 0 ? encabezado(p, "Texto curatorial") : H - m;
    dibujarLineas(p, lineas, { x: m, y, size: cuerpo, font: f.normal, color: TINTA, interlinea: INTERLINEA });
  });

  for (const [i, o] of d.obras.entries()) {
    const p = nueva(plan.firstWorkPage + i);
    const caja = { x: m, y: H * 0.3, width: util, height: H - m - H * 0.3 };
    if (o.imagen) {
      p.drawImage(await pdf.embedJpg(o.imagen.jpg), fitInside(caja, o.imagen));
    } else {
      p.drawRectangle({ ...caja, borderColor: LINEA, borderWidth: 0.6 });
      bloqueCentrado(p, "Imagen no disponible", { x: caja.x, y: caja.y + caja.height / 2, ancho: caja.width, size: 9 * e, font: f.normal, color: GRIS, maxLineas: 1 });
    }
    let y = bloque(p, o.titulo, { x: m, y: H * 0.3 - 4 * MM * e, ancho: util, size: 13 * e, font: f.negrita, color: TINTA, maxLineas: 2 });
    y = bloque(p, o.autor.trim() || NO_AUTHOR, { x: m, y, ancho: util, size: 11 * e, font: f.normal, color: TINTA, maxLineas: 1 });
    if (o.detalle) bloque(p, o.detalle, { x: m, y, ancho: util, size: 9 * e, font: f.normal, color: GRIS, maxLineas: 2 });
  }

  (paginasIndice.length ? paginasIndice : [[]]).forEach((entradas, i) => {
    const p = nueva(plan.indexFirstPage + i);
    let y = i === 0 ? encabezado(p, "Índice de autores") : H - m;
    for (const ent of entradas) {
      y -= cuerpo * INTERLINEA;
      const paginas = ent.pages.join(", ");
      const anchoPag = f.normal.widthOfTextAtSize(paginas, cuerpo);
      bloque(p, ent.author, { x: m, y: y + cuerpo * 1.2, ancho: util - anchoPag - 6 * e, size: cuerpo, font: f.normal, color: TINTA, maxLineas: 1 });
      p.drawText(paginas, { x: W - m - anchoPag, y, size: cuerpo, font: f.normal, color: GRIS });
    }
  });

  // Cierre: QR a la muestra.
  const p = nueva(plan.closingPage);
  const lado = 45 * e * MM;
  const yQr = (H - lado) / 2;
  bloqueCentrado(p, "Las obras, online", { x: m, y: yQr + lado + 14 * e + 13 * e, ancho: util, size: 13 * e, font: f.negrita, color: TINTA, maxLineas: 1 });
  dibujarQr(p, d.url, (W - lado) / 2, yQr, lado);
  bloqueCentrado(p, d.urlVisible, { x: m, y: yQr - 4 * e, ancho: util, size: 9 * e, font: f.normal, color: GRIS, maxLineas: 2 });
  return pdf.save();
}

function portada(
  p: PDFPage, d: DatosCatalogo, g: { H: number; m: number; util: number; e: number }, f: Fuentes,
  img: Awaited<ReturnType<PDFDocument["embedJpg"]>> | null,
) {
  const { H, m, util, e } = g;
  let y = H - m - H * 0.2;
  if (img && d.portada) {
    const caja = fitInside({ x: m, y: H * 0.42, width: util, height: H - m - H * 0.42 }, d.portada);
    p.drawImage(img, caja);
    y = H * 0.42 - 8 * e * MM;
  }
  y = bloque(p, d.titulo, { x: m, y, ancho: util, size: 22 * e, font: f.negrita, color: TINTA, maxLineas: 3, interlinea: 1.1 });
  if (d.organizan) y = bloque(p, d.organizan, { x: m, y: y - 4 * e, ancho: util, size: 11 * e, font: f.normal, color: GRIS, maxLineas: 2 });
  if (d.curaduria) y = bloque(p, d.curaduria, { x: m, y, ancho: util, size: 11 * e, font: f.normal, color: GRIS, maxLineas: 2 });
  y = bloque(p, d.fechas, { x: m, y: y - 6 * e, ancho: util, size: 11 * e, font: f.normal, color: TINTA, maxLineas: 2 });
  if (d.lugar) bloque(p, d.lugar, { x: m, y, ancho: util, size: 10 * e, font: f.normal, color: TINTA, maxLineas: 3 });
}
```

- [ ] **Step 4: Implementar el afiche**

`apps/muestras/lib/piezas/afiche-libro.ts`:
```ts
import { PDFDocument } from "pdf-lib";
import { GUESTBOOK_POSTER_SIZES, type GuestbookPosterSize } from "@repo/muestras";
import { GRIS, MM, TINTA, bloqueCentrado, cargarFuentes, dibujarQr, prepararDocumento } from "./dibujo";

export type DatosAficheLibro = { muestra: string; url: string; urlVisible: string };

/** Afiche del libro de visitas: grande, con un QR que se lee de lejos. */
export async function pdfDeAficheLibro(d: DatosAficheLibro, tamano: GuestbookPosterSize, fecha: Date): Promise<Uint8Array> {
  const t = GUESTBOOK_POSTER_SIZES[tamano];
  const W = t.width * MM;
  const H = t.height * MM;
  const e = t.width / 210; // A4 = 1
  const m = 18 * e * MM;
  const util = W - 2 * m;
  const pdf = await PDFDocument.create();
  prepararDocumento(pdf, `Libro de visitas: ${d.muestra}`, fecha);
  const f = await cargarFuentes(pdf);
  const p = pdf.addPage([W, H]);
  let y = bloqueCentrado(p, "Libro de visitas", { x: m, y: H - m, ancho: util, size: 40 * e, font: f.negrita, color: TINTA, maxLineas: 1 });
  bloqueCentrado(p, "Contanos qué te pareció la muestra", { x: m, y: y - 4 * e, ancho: util, size: 16 * e, font: f.normal, color: TINTA, maxLineas: 2 });
  const lado = W * 0.55;
  const yQr = (H - lado) / 2 - 6 * e * MM;
  dibujarQr(p, d.url, (W - lado) / 2, yQr, lado);
  y = bloqueCentrado(p, "Escaneá con la cámara de tu teléfono", { x: m, y: yQr - 6 * e, ancho: util, size: 13 * e, font: f.normal, color: TINTA, maxLineas: 1 });
  bloqueCentrado(p, d.muestra, { x: m, y: y - 4 * e, ancho: util, size: 12 * e, font: f.negrita, color: GRIS, maxLineas: 2 });
  bloqueCentrado(p, d.urlVisible, { x: m, y: m + 10 * e, ancho: util, size: 10 * e, font: f.normal, color: GRIS, maxLineas: 2 });
  return pdf.save();
}
```

- [ ] **Step 5: Correr, mirar y commit**

Run: `pnpm --filter muestras test -- lib/piezas && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: PASS. Mirar un catálogo A5 de prueba como en la Task 8 Step 7 (portada, texto, obras con su número de página, índice con páginas a la derecha, cierre con QR) y borrar la línea temporal.

```bash
git add apps/muestras/lib/piezas/catalogo.ts apps/muestras/lib/piezas/catalogo.test.ts apps/muestras/lib/piezas/afiche-libro.ts apps/muestras/lib/piezas/afiche-libro.test.ts
git commit -m "Muestras: catálogo en PDF con índice de autores y afiche del libro de visitas"
```

**Acceptance:** cantidad de páginas = 1 + páginas de texto + obras + índice + 1; cada obra en su página numerada; índice alfabético con páginas; una obra sin foto no rompe el catálogo.

---
### Task 10: Plano de montaje — guardar, editor y PDF

**Files:**
- Create: `apps/muestras/lib/montaje/acciones.ts`, `apps/muestras/lib/montaje/consultas.ts`, `apps/muestras/lib/piezas/montaje.ts`, `apps/muestras/components/montaje/editor-montaje.tsx`, `apps/muestras/components/montaje/estilos.ts`
- Modify: `apps/muestras/lib/piezas/textos.ts`, `apps/muestras/lib/piezas/textos.test.ts`
- Test: `apps/muestras/lib/montaje/acciones.test.ts`, `apps/muestras/lib/piezas/montaje.test.ts`

**Interfaces:**
- Consumes: `parseHangingPlan`, `hangingPlanProblems`, `hangingLayout`, `unassignedWorks`, `formatCm`, `newWallId`, `DEFAULT_WALL_HEIGHT_CM` (Task 2); columna `hangingPlan` (Task 4); `frenarPorUsuario("guardarMontaje")` (Task 5).
- Produces:
  - `acciones.ts` (`"use server"`): `ResultadoMontaje`, `guardarMontaje(activityId, planJson)`
  - `consultas.ts`: `cargarMontaje(id, usuario)` → `{ id, slug, title, reviewStatus, works, plan, droppedItems } | null`
  - `textos.ts`: `DatosMontaje`, `datosDeMontaje(muestra, plan, works)`
  - `montaje.ts`: `pdfDeMontaje(datos, fecha)`
  - `<EditorMontaje id obras planInicial />`, `components/montaje/estilos.ts` (`boton`, `campo`, `enlace`)

- [ ] **Step 1: Escribir los tests que fallan**

`apps/muestras/lib/montaje/acciones.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ culturalActivity: { findFirst: vi.fn(), update: vi.fn() } }));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const { guardarMontaje } = await import("./acciones");
const { resetRateLimit } = await import("@/lib/limite");

const plan = (items: object[], extra: object = {}) => JSON.stringify({
  version: 1, centerHeightCm: 150, walls: [{ id: "p-1", name: "Norte", widthCm: 300, heightCm: null, items, ...extra }],
});

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: null };
  db.culturalActivity.findFirst.mockResolvedValue({ id: "a1", works: [{ id: "w1" }, { id: "w2" }] });
  db.culturalActivity.update.mockResolvedValue({});
});

describe("guardarMontaje", () => {
  it("guarda el plano leído (sin obras ajenas) y devuelve los avisos", async () => {
    const r = await guardarMontaje("a1", plan([
      { workId: "w1", frameWidthCm: 150, frameHeightCm: 50 },
      { workId: "w2", frameWidthCm: 150, frameHeightCm: 50 },
      { workId: "de-otra", frameWidthCm: 40, frameHeightCm: 50 },
    ]));
    expect(r).toEqual({ ok: true, avisos: ["Norte: Quedan muy juntas: 0 cm entre obras."] });
    const guardado = db.culturalActivity.update.mock.calls[0]![0].data.hangingPlan;
    expect(guardado.walls[0].items.map((i: { workId: string }) => i.workId)).toEqual(["w1", "w2"]);
  });
  it("sólo el dueño (o el super admin) y sólo muestras", async () => {
    await guardarMontaje("a1", plan([]));
    expect(db.culturalActivity.findFirst.mock.calls[0]![0].where).toEqual({ id: "a1", type: "MUESTRA", proposedByUserId: 7 });
    usuarioActual.valor = { id: 1, esSuperAdmin: true, email: "x", name: null };
    await guardarMontaje("a1", plan([]));
    expect(db.culturalActivity.findFirst.mock.calls[1]![0].where).toEqual({ id: "a1", type: "MUESTRA" });
    db.culturalActivity.findFirst.mockResolvedValue(null);
    expect(await guardarMontaje("ajena", plan([]))).toEqual({ ok: false, errores: ["No encontramos esa muestra entre las tuyas."] });
  });
  it("devuelve los problemas y no escribe", async () => {
    const r = await guardarMontaje("a1", plan([], { widthCm: 10 }));
    expect(r.ok).toBe(false);
    expect(db.culturalActivity.update).not.toHaveBeenCalled();
  });
  it("sin sesión, JSON roto o enorme", async () => {
    expect((await guardarMontaje("a1", "{no")).ok).toBe(false);
    expect((await guardarMontaje("a1", "x".repeat(200_001))).ok).toBe(false);
    usuarioActual.valor = null;
    expect(await guardarMontaje("a1", plan([]))).toEqual({ ok: false, errores: ["Tu sesión venció. Volvé a ingresar."] });
    expect(db.culturalActivity.update).not.toHaveBeenCalled();
  });
});
```
(Con dos marcos de 150 en una pared de 300 el espacio da 0: entra justo y avisa "muy juntas".)

`apps/muestras/lib/piezas/montaje.test.ts`:
```ts
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { MM } from "./dibujo";
import { pdfDeMontaje } from "./montaje";
import { datosDeMontaje } from "./textos";

const obras = Array.from({ length: 16 }, (_, i) => ({ id: `w${i + 1}`, title: `Obra ${i + 1}`, authorName: i % 2 ? "Ana Pérez" : "" }));
const fecha = new Date("2026-11-01T12:00:00Z");

describe("pdfDeMontaje", () => {
  it("A4 apaisado: una o más páginas por pared y la lista de control al final", async () => {
    const plan = {
      version: 1 as const, centerHeightCm: 150,
      walls: [
        { id: "a", name: "Norte", widthCm: 1500, heightCm: 300, items: obras.slice(0, 14).map((o) => ({ workId: o.id, frameWidthCm: 40, frameHeightCm: 50 })) },
        { id: "b", name: "Sur", widthCm: 200, heightCm: null, items: [{ workId: "w15", frameWidthCm: 250, frameHeightCm: 50 }] },
      ],
    };
    const doc = await PDFDocument.load(await pdfDeMontaje(datosDeMontaje("Miradas", plan, obras), fecha));
    expect([Math.round(doc.getPage(0).getWidth() / MM), Math.round(doc.getPage(0).getHeight() / MM)]).toEqual([297, 210]);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(4);
  });
  it("sin paredes, una página con las obras sin asignar", async () => {
    const doc = await PDFDocument.load(await pdfDeMontaje(datosDeMontaje("M", { version: 1, centerHeightCm: 150, walls: [] }, obras.slice(0, 2)), fecha));
    expect(doc.getPageCount()).toBe(1);
  });
});
```

Agregar a `apps/muestras/lib/piezas/textos.test.ts`:
```ts
import { datosDeMontaje } from "./textos";

describe("datosDeMontaje", () => {
  it("cada pared con sus medidas para colgar y las obras sin pared aparte", () => {
    const d = datosDeMontaje("M", {
      version: 1, centerHeightCm: 150,
      walls: [{ id: "a", name: "Norte", widthCm: 400, heightCm: null, items: [{ workId: "w1", frameWidthCm: 80, frameHeightCm: 100 }] }],
    }, [{ id: "w1", title: "Uno", authorName: "Ana" }, { id: "w2", title: "Dos", authorName: " " }]);
    expect(d.paredes[0]!.obras).toEqual([{ numero: 1, titulo: "Uno", autor: "Ana", marco: "80 × 100 cm", centroDesdeIzquierda: "200 cm", bordeSuperior: "200 cm" }]);
    expect(d.sinPared).toEqual([{ titulo: "Dos", autor: "Autor sin indicar" }]);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter muestras test -- lib/montaje lib/piezas`
Expected: FAIL — no existen `acciones.ts`, `montaje.ts` ni `datosDeMontaje`.

- [ ] **Step 3: Datos del plano**

Agregar a `apps/muestras/lib/piezas/textos.ts`:
```ts
import { formatCm, hangingLayout, unassignedWorks, type HangingPlan, type WallLayout } from "@repo/muestras";

export type ObraEnPared = { numero: number; titulo: string; autor: string; marco: string; centroDesdeIzquierda: string; bordeSuperior: string };
export type ParedParaPdf = { nombre: string; anchoCm: number; altoCm: number | null; layout: WallLayout; obras: ObraEnPared[] };
export type DatosMontaje = { muestra: string; centroCm: number; paredes: ParedParaPdf[]; sinPared: { titulo: string; autor: string }[] };

/** El plano listo para dibujar. `plan` viene de `parseHangingPlan`: sus obras existen. */
export function datosDeMontaje(muestra: string, plan: HangingPlan, works: { id: string; title: string; authorName: string }[]): DatosMontaje {
  const porId = new Map(works.map((w) => [w.id, w]));
  return {
    muestra,
    centroCm: plan.centerHeightCm,
    paredes: plan.walls.map((w) => {
      const layout = hangingLayout(w, plan.centerHeightCm);
      return {
        nombre: w.name, anchoCm: w.widthCm, altoCm: w.heightCm, layout,
        obras: layout.positions.map((p) => {
          const o = porId.get(p.workId);
          return {
            numero: p.number,
            titulo: o?.title ?? "Obra quitada",
            autor: autorDeObra(o?.authorName ?? ""),
            marco: `${formatCm(p.widthCm)} × ${formatCm(p.heightCm)} cm`,
            centroDesdeIzquierda: `${formatCm(p.centerFromLeftCm)} cm`,
            bordeSuperior: `${formatCm(p.topCm)} cm`,
          };
        }),
      };
    }),
    sinPared: unassignedWorks(plan, works).map((o) => ({ titulo: o.title, autor: autorDeObra(o.authorName) })),
  };
}
```
(Unir este import con el de `@repo/muestras` que ya tiene el archivo.)

- [ ] **Step 4: Guardar y leer**

`apps/muestras/lib/montaje/acciones.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@repo/db";
import { hangingLayout, hangingPlanProblems, parseHangingPlan } from "@repo/muestras";
import { frenarPorUsuario } from "@/lib/limite";
import { getUsuario } from "@/lib/usuario";

export type ResultadoMontaje = { ok: true; avisos: string[] } | { ok: false; errores: string[] };

const NO_EXISTE: ResultadoMontaje = { ok: false, errores: ["No encontramos esa muestra entre las tuyas."] };

/**
 * Guarda el plano entero (D8). Cualquier estado de la muestra (D11): el montaje se prepara antes
 * de publicar. Las obras que no son de esta muestra se descartan al leer.
 */
export async function guardarMontaje(activityId: string, planJson: string): Promise<ResultadoMontaje> {
  const usuario = await getUsuario();
  if (!usuario) return { ok: false, errores: ["Tu sesión venció. Volvé a ingresar."] };
  if (typeof activityId !== "string" || typeof planJson !== "string") return NO_EXISTE;
  if (planJson.length > 200_000) return { ok: false, errores: ["El plano es demasiado grande."] };
  if (!frenarPorUsuario("guardarMontaje", usuario.id).allowed) {
    return { ok: false, errores: ["Guardaste muchas veces seguidas. Esperá unos minutos."] };
  }
  let crudo: unknown;
  try {
    crudo = JSON.parse(planJson);
  } catch {
    return { ok: false, errores: ["No pudimos leer el plano. Recargá la página."] };
  }
  const a = await prisma.culturalActivity.findFirst({
    where: { id: activityId, type: "MUESTRA", ...(usuario.esSuperAdmin ? {} : { proposedByUserId: usuario.id }) },
    select: { id: true, works: { select: { id: true } } },
  });
  if (!a) return NO_EXISTE;
  const { plan } = parseHangingPlan(crudo, a.works.map((w) => w.id));
  const problemas = hangingPlanProblems(plan);
  if (problemas.length) return { ok: false, errores: problemas };
  await prisma.culturalActivity.update({ where: { id: a.id }, data: { hangingPlan: plan as unknown as Prisma.InputJsonValue } });
  revalidatePath(`/panel/montaje/${a.id}`);
  return { ok: true, avisos: plan.walls.flatMap((w) => hangingLayout(w, plan.centerHeightCm).warnings.map((x) => `${w.name}: ${x}`)) };
}
```

`apps/muestras/lib/montaje/consultas.ts`:
```ts
import "server-only";
import { prisma } from "@repo/db";
import { parseHangingPlan } from "@repo/muestras";
import type { Usuario } from "@/lib/usuario";

/** La muestra con su plano ya leído, para el panel de montaje. Dueño o super admin; tipo muestra. */
export async function cargarMontaje(id: string, usuario: Pick<Usuario, "id" | "esSuperAdmin">) {
  const a = await prisma.culturalActivity.findFirst({
    where: { id, type: "MUESTRA", ...(usuario.esSuperAdmin ? {} : { proposedByUserId: usuario.id }) },
    select: {
      id: true, slug: true, title: true, reviewStatus: true, curatorialText: true, hangingPlan: true,
      works: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, authorName: true, sortOrder: true } },
    },
  });
  if (!a) return null;
  const { plan, droppedItems } = parseHangingPlan(a.hangingPlan, a.works.map((w) => w.id));
  return { ...a, plan, droppedItems };
}
```

- [ ] **Step 5: El PDF del plano**

`apps/muestras/lib/piezas/montaje.ts`:
```ts
import { PDFDocument, type PDFPage } from "pdf-lib";
import { DEFAULT_WALL_HEIGHT_CM, formatCm } from "@repo/muestras";
import { ALERTA, GRIS, LINEA, MM, TINTA, bloque, bloqueCentrado, cargarFuentes, lineaPunteada, prepararDocumento, type Fuentes } from "./dibujo";
import type { DatosMontaje, ParedParaPdf } from "./textos";

const W = 297 * MM;
const H = 210 * MM;
const M = 12 * MM;
const FILA = 6.5 * MM;
// Anchos en mm; suman 273 (A4 apaisado menos márgenes).
const COLUMNAS = [
  { titulo: "N.º", ancho: 12 }, { titulo: "Obra", ancho: 70 }, { titulo: "Autor", ancho: 55 }, { titulo: "Marco", ancho: 32 },
  { titulo: "Centro desde el borde izq.", ancho: 42 }, { titulo: "Borde superior", ancho: 42 }, { titulo: "Colgada", ancho: 20 },
] as const;

/**
 * Plano y lista de montaje (D10): por pared, el alzado a escala (piso, línea de centro, marcos
 * numerados) y la tabla con lo que se mide para colgar; al final, la lista de control.
 */
export async function pdfDeMontaje(d: DatosMontaje, fecha: Date): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  prepararDocumento(pdf, `Plano de montaje: ${d.muestra}`, fecha);
  const f = await cargarFuentes(pdf);
  const pagina = (titulo: string) => {
    const p = pdf.addPage([W, H]);
    bloque(p, titulo, { x: M, y: H - M, ancho: W - 2 * M, size: 14, font: f.negrita, color: TINTA, maxLineas: 1 });
    bloque(p, `${d.muestra} · Línea de centro a ${formatCm(d.centroCm)} cm del piso`, { x: M, y: H - M - 18, ancho: W - 2 * M, size: 8, font: f.normal, color: GRIS, maxLineas: 1 });
    return p;
  };

  for (const pared of d.paredes) {
    const p = pagina(`Pared: ${pared.nombre} (${formatCm(pared.anchoCm)} cm)`);
    let y = dibujarPared(p, pared, d.centroCm, f);
    for (const aviso of pared.layout.warnings) y = bloque(p, aviso, { x: M, y, ancho: W - 2 * M, size: 8, font: f.normal, color: ALERTA, maxLineas: 2 });
    filas(p, y - 4, pared.obras.map((o) => [String(o.numero), o.titulo, o.autor, o.marco, o.centroDesdeIzquierda, o.bordeSuperior, ""]), f, () => pagina(`Pared: ${pared.nombre} (sigue)`));
  }

  // Lista de control: todo junto, por pared, más lo que no tiene pared.
  const p = pagina("Lista de control");
  const control = d.paredes.flatMap((w) => w.obras.map((o) => [`${w.nombre} ${o.numero}`, o.titulo, o.autor, o.marco, "", "", ""]));
  const sin = d.sinPared.map((o) => ["Sin pared", o.titulo, o.autor, "", "", "", ""]);
  filas(p, H - M - 34, [...control, ...sin], f, () => pagina("Lista de control (sigue)"));
  return pdf.save();
}

/** Dibuja la pared a escala debajo del encabezado; devuelve dónde termina (en puntos). */
function dibujarPared(p: PDFPage, pared: ParedParaPdf, centroCm: number, f: Fuentes): number {
  const arriba = H - M - 34;
  const altoZona = 80 * MM;
  const piso = arriba - altoZona;
  const maxTop = Math.max(0, ...pared.layout.positions.map((x) => x.topCm));
  const altoCm = pared.altoCm ?? Math.max(DEFAULT_WALL_HEIGHT_CM, maxTop + 20);
  const anchoCm = Math.max(pared.anchoCm, pared.layout.framesCm);
  const s = Math.min((W - 2 * M) / anchoCm, altoZona / altoCm); // puntos por cm
  lineaPunteada(p, { x: M, y: piso, width: pared.anchoCm * s, height: altoCm * s }, LINEA);
  p.drawLine({ start: { x: M, y: piso }, end: { x: M + anchoCm * s, y: piso }, thickness: 1.2, color: TINTA });
  const yCentro = piso + centroCm * s;
  p.drawLine({ start: { x: M, y: yCentro }, end: { x: M + pared.anchoCm * s, y: yCentro }, thickness: 0.5, color: GRIS, dashArray: [4, 2] });
  p.drawText(`Centro a ${formatCm(centroCm)} cm`, { x: M + 2, y: yCentro + 2, size: 6.5, font: f.normal, color: GRIS });
  for (const x of pared.layout.positions) {
    const caja = { x: M + x.leftCm * s, y: piso + Math.max(0, x.bottomCm) * s, width: x.widthCm * s, height: (x.topCm - Math.max(0, x.bottomCm)) * s };
    p.drawRectangle({ ...caja, borderColor: TINTA, borderWidth: 0.8 });
    const size = Math.min(10, caja.height * 0.5, caja.width * 0.6);
    bloqueCentrado(p, String(x.number), { x: caja.x, y: caja.y + caja.height / 2 + size / 2, ancho: caja.width, size, font: f.negrita, color: TINTA, maxLineas: 1 });
  }
  return piso - 10;
}

/** Tabla con encabezado; sigue en páginas nuevas si no entra. */
function filas(primera: PDFPage, desde: number, datos: string[][], f: Fuentes, otra: () => PDFPage) {
  let p = primera;
  let y = desde;
  const encabezado = () => {
    let x = M;
    for (const c of COLUMNAS) {
      bloque(p, c.titulo, { x: x + 2, y, ancho: c.ancho * MM - 4, size: 7, font: f.negrita, color: GRIS, maxLineas: 1 });
      x += c.ancho * MM;
    }
    y -= FILA;
    p.drawLine({ start: { x: M, y: y + 2 }, end: { x: W - M, y: y + 2 }, thickness: 0.5, color: LINEA });
  };
  encabezado();
  for (const fila of datos) {
    if (y - FILA < M) {
      p = otra();
      y = H - M - 34;
      encabezado();
    }
    let x = M;
    fila.forEach((celda, i) => {
      const c = COLUMNAS[i]!;
      if (c.titulo === "Colgada") p.drawRectangle({ x: x + 6, y: y - FILA + 6, width: 9, height: 9, borderColor: TINTA, borderWidth: 0.6 });
      else bloque(p, celda, { x: x + 2, y, ancho: c.ancho * MM - 4, size: 8, font: f.normal, color: TINTA, maxLineas: 1 });
      x += c.ancho * MM;
    });
    y -= FILA;
    p.drawLine({ start: { x: M, y: y + 2 }, end: { x: W - M, y: y + 2 }, thickness: 0.3, color: LINEA });
  }
}
```

- [ ] **Step 6: El editor**

`apps/muestras/components/montaje/estilos.ts`:
```ts
export const boton = "h-11 rounded-[2px] border border-[var(--mf-ink)] px-5 text-[15px] disabled:opacity-50";
export const botonChico = "h-9 rounded-[2px] border border-[var(--mf-line)] px-3 text-sm";
export const campo = "w-full rounded-[2px] border border-[var(--mf-line)] bg-white px-3 py-2";
export const enlace = "underline underline-offset-[6px]";
```

`apps/muestras/components/montaje/editor-montaje.tsx` (cliente). Lo que tiene que hacer, con este esqueleto:
```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DEFAULT_WALL_HEIGHT_CM, HANGING_LIMITS, formatCm, hangingLayout, newWallId, unassignedWorks,
  type HangingPlan, type HangingWall,
} from "@repo/muestras";
import { guardarMontaje } from "@/lib/montaje/acciones";
import { boton, botonChico, campo, enlace } from "./estilos";

type Obra = { id: string; title: string; authorName: string };
const numero = (v: string): number => Number(v.trim().replace(",", "."));

export function EditorMontaje({ id, obras, planInicial }: { id: string; obras: Obra[]; planInicial: HangingPlan }) {
  const [plan, setPlan] = useState<HangingPlan>(planInicial);
  const [mensajes, setMensajes] = useState<{ tipo: "error" | "aviso" | "ok"; textos: string[] } | null>(null);
  const [pendiente, start] = useTransition();
  const sinPared = useMemo(() => unassignedWorks(plan, obras), [plan, obras]);
  const titulo = new Map(obras.map((o) => [o.id, o.title]));

  const cambiarPared = (wid: string, cambio: (w: HangingWall) => HangingWall) =>
    setPlan((p) => ({ ...p, walls: p.walls.map((w) => (w.id === wid ? cambio(w) : w)) }));
  const agregarPared = () => setPlan((p) => ({ ...p, walls: [...p.walls, { id: newWallId(), name: `Pared ${p.walls.length + 1}`, widthCm: 400, heightCm: null, items: [] }] }));
  const quitarPared = (wid: string) => setPlan((p) => ({ ...p, walls: p.walls.filter((w) => w.id !== wid) }));
  const agregarObra = (wid: string, workId: string) => cambiarPared(wid, (w) => {
    const ultima = w.items.at(-1);
    return { ...w, items: [...w.items, { workId, frameWidthCm: ultima?.frameWidthCm ?? 40, frameHeightCm: ultima?.frameHeightCm ?? 50 }] };
  });
  const mover = (wid: string, i: number, d: -1 | 1) => cambiarPared(wid, (w) => {
    const items = [...w.items];
    const j = i + d;
    if (j < 0 || j >= items.length) return w;
    [items[i], items[j]] = [items[j]!, items[i]!];
    return { ...w, items };
  });

  const guardar = () => start(async () => {
    const r = await guardarMontaje(id, JSON.stringify(plan));
    if (!r.ok) setMensajes({ tipo: "error", textos: r.errores });
    else setMensajes(r.avisos.length ? { tipo: "aviso", textos: ["Guardamos el plano.", ...r.avisos] } : { tipo: "ok", textos: ["Guardamos el plano."] });
  });

  return (
    <div className="space-y-8">
      {/* Línea de centro (100–200 cm), con la explicación: "La altura del centro de cada obra. 150 cm es lo más usado en museos." */}
      {/* Por pared: nombre, ancho y alto optativo (cm, acepta coma), "Quitar pared";
          lista de obras en orden con su marco (ancho × alto en cm), ↑ ↓, "Sacar";
          un <select> "Sumar una obra" con las de `sinPared`;
          el alzado en SVG con viewBox en cm (ver abajo) y los avisos de `hangingLayout` en var(--mf-alerta). */}
      {/* "Agregar pared" (deshabilitado al llegar a HANGING_LIMITS.walls), "Guardar plano" (boton) y
          el enlace "Bajar el plano y la lista de montaje (PDF)" a `/api/piezas/${id}/montaje`. */}
      {/* Mensajes en role="status" (ok/aviso) o role="alert" (error). */}
    </div>
  );
}
```
El alzado de cada pared (vista previa, mismo cálculo que el PDF):
```tsx
function Alzado({ pared, centro }: { pared: HangingWall; centro: number }) {
  const l = hangingLayout(pared, centro);
  const ancho = Math.max(pared.widthCm, l.framesCm, 1);
  const alto = pared.heightCm ?? Math.max(DEFAULT_WALL_HEIGHT_CM, ...l.positions.map((p) => p.topCm + 20));
  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={`Pared ${pared.name}: ${l.positions.length} obras`} className="h-auto w-full border-b-2 border-[var(--mf-ink)]">
      <rect x={0} y={0} width={pared.widthCm} height={alto} fill="none" stroke="var(--mf-line)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <line x1={0} x2={pared.widthCm} y1={alto - centro} y2={alto - centro} stroke="var(--mf-muted)" strokeDasharray="6 3" vectorEffect="non-scaling-stroke" />
      {l.positions.map((p) => (
        <g key={p.workId}>
          <rect x={p.leftCm} y={alto - p.topCm} width={p.widthCm} height={p.heightCm} fill="white" stroke="var(--mf-ink)" vectorEffect="non-scaling-stroke" />
          <text x={p.leftCm + p.widthCm / 2} y={alto - centro} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(p.widthCm, p.heightCm) * 0.4}>{p.number}</text>
        </g>
      ))}
    </svg>
  );
}
```
Los campos numéricos guardan lo que escribe la persona con `numero(valor)` (si no es un número queda `NaN` y el servidor lo rechaza con el mensaje de `hangingPlanProblems`). Debajo de cada pared, en texto: "Espacio entre obras: {formatCm(l.gapCm)} cm". A 375 px todo va en una columna; el SVG ocupa el ancho.

- [ ] **Step 7: Correr y ver que pasa**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: PASS. (El editor se prueba a mano en la Task 11, cuando tiene página.)

- [ ] **Step 8: Commit**

```bash
git add apps/muestras/lib/montaje apps/muestras/lib/piezas/montaje.ts apps/muestras/lib/piezas/montaje.test.ts apps/muestras/lib/piezas/textos.ts apps/muestras/lib/piezas/textos.test.ts apps/muestras/components/montaje
git commit -m "Muestras: plano de montaje con paredes, editor con vista previa y PDF con lista de control"
```

**Acceptance:** sólo el dueño guarda; obras ajenas descartadas; problemas devueltos sin escribir; el PDF tiene una página por pared (más si la tabla no entra) y la lista de control.

---
### Task 11: Montaje e impresión en el panel y ruta `/api/piezas`

**Files:**
- Create: `apps/muestras/lib/piezas/opciones.ts`, `apps/muestras/lib/piezas/cargar.ts`, `apps/muestras/lib/piezas/armar.ts`, `apps/muestras/app/api/piezas/[id]/[pieza]/route.ts`, `apps/muestras/app/panel/montaje/[id]/page.tsx`, `apps/muestras/components/montaje/descargar-marcos.tsx`, `apps/muestras/components/montaje/descargas.tsx`
- Modify: `apps/muestras/app/panel/montaje/page.tsx`, `apps/muestras/lib/actividades/consultas.ts`, `apps/muestras/lib/panel/en-preparacion.ts`, `apps/muestras/lib/panel/en-preparacion.test.ts`, `apps/muestras/app/panel/muestras/[id]/page.tsx`
- Test: `apps/muestras/lib/piezas/opciones.test.ts`, `apps/muestras/lib/piezas/armar.test.ts`, `apps/muestras/lib/piezas/ruta.test.ts`

**Interfaces:**
- Consumes: todo lo de las Tasks 5, 8, 9 y 10; `baseUrlPublica` (`lib/fichas/cargar.ts`); `DescargarFichas` (etapa 2).
- Produces:
  - `opciones.ts`: `PIEZAS`, `Pieza`, `PIEZAS_CON_QR`, `OpcionesPieza` (unión por pieza), `opcionesDePieza(pieza, searchParams): OpcionesPieza | null`, `urlDePieza(id, opciones)`
  - `cargar.ts`: `cargarMuestraParaPiezas(id, usuario, { publicada }): Promise<MuestraParaPiezas | null>`
  - `armar.ts`: `armarPieza(a, opciones, base): Promise<{ bytes; nombre } | null>`
  - `GET /api/piezas/[id]/[pieza]`; `listarMuestrasParaMontaje(userId)`; páginas `/panel/montaje` y `/panel/montaje/[id]`
  - `MONTAJE_EN_PREPARACION` deja de existir.

- [ ] **Step 1: Escribir los tests que fallan**

`apps/muestras/lib/piezas/opciones.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { opcionesDePieza, urlDePieza } from "./opciones";

const sp = (q: string) => new URLSearchParams(q);

describe("opcionesDePieza", () => {
  it("marcos: medida, orientación, con o sin foto y una obra", () => {
    expect(opcionesDePieza("marcos", sp("tamano=40x50&orientacion=PORTRAIT&foto=no&obra=w1"))).toEqual({
      pieza: "marcos", tamano: "40x50", orientacion: "PORTRAIT", conFoto: false, obra: "w1",
    });
    expect(opcionesDePieza("marcos", sp(""))).toEqual({ pieza: "marcos", tamano: "A4", orientacion: "AUTO", conFoto: true, obra: null });
  });
  it("lo desconocido toma el valor por defecto; una pieza desconocida no existe", () => {
    expect(opcionesDePieza("cartel", sp("tamano=A0"))).toEqual({ pieza: "cartel", tamano: "A3" });
    expect(opcionesDePieza("catalogo", sp("tamano=A4"))).toEqual({ pieza: "catalogo", tamano: "A4" });
    expect(opcionesDePieza("libro", sp(""))).toEqual({ pieza: "libro", tamano: "A4" });
    expect(opcionesDePieza("montaje", sp("x=1"))).toEqual({ pieza: "montaje" });
    expect(opcionesDePieza("fichas", sp(""))).toBeNull();
    expect(opcionesDePieza("marcos", sp("obra=../x"))).toMatchObject({ obra: null });
  });
  it("arma la dirección de descarga", () => {
    expect(urlDePieza("a1", { pieza: "marcos", tamano: "A3", orientacion: "AUTO", conFoto: false, obra: null })).toBe("/api/piezas/a1/marcos?tamano=A3&orientacion=AUTO&foto=no");
    expect(urlDePieza("a1", { pieza: "montaje" })).toBe("/api/piezas/a1/montaje");
  });
});
```

`apps/muestras/lib/piezas/armar.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const imagen = vi.hoisted(() => ({ imagenParaPdf: vi.fn() }));
const pdfs = vi.hoisted(() => ({ pdfDeMarcos: vi.fn(), pdfDeCartel: vi.fn(), pdfDeCatalogo: vi.fn(), pdfDeAficheLibro: vi.fn(), pdfDeMontaje: vi.fn() }));
vi.mock("./imagen", () => imagen);
vi.mock("./marco", () => ({ pdfDeMarcos: pdfs.pdfDeMarcos }));
vi.mock("./cartel", () => ({ pdfDeCartel: pdfs.pdfDeCartel }));
vi.mock("./catalogo", () => ({ pdfDeCatalogo: pdfs.pdfDeCatalogo }));
vi.mock("./afiche-libro", () => ({ pdfDeAficheLibro: pdfs.pdfDeAficheLibro }));
vi.mock("./montaje", () => ({ pdfDeMontaje: pdfs.pdfDeMontaje }));
const { armarPieza } = await import("./armar");

const a = {
  id: "a1", slug: "miradas-abc", title: "Miradas", organizersText: "FC", curatorialText: null, curatorCredits: null,
  startsAt: new Date("2026-11-05T03:00:00Z"), endsAt: new Date("2026-11-21T02:59:59.999Z"), scheduleText: null,
  venueName: null, address: null, city: null, province: null, coverImageUrl: null, hangingPlan: null,
  updatedAt: new Date("2026-11-01T12:00:00Z"),
  works: [
    { id: "w1", title: "Uno", authorName: "Ana", year: 2025, technique: null, imageUrl: "u1", sortOrder: 0 },
    { id: "w2", title: "Dos", authorName: "", year: null, technique: null, imageUrl: "u2", sortOrder: 1 },
  ],
};
const base = "https://muestrasfotograficas.com";

beforeEach(() => {
  vi.clearAllMocks();
  imagen.imagenParaPdf.mockResolvedValue(null);
  for (const fn of Object.values(pdfs)) fn.mockResolvedValue(new Uint8Array([1]));
});

describe("armarPieza", () => {
  it("marcos de todas las obras, foto en alta, una por vez, con la fecha de la muestra", async () => {
    const r = await armarPieza(a, { pieza: "marcos", tamano: "A3", orientacion: "AUTO", conFoto: true, obra: null }, base);
    expect(r?.nombre).toBe("marcos-miradas-abc-A3");
    expect(imagen.imagenParaPdf.mock.calls).toEqual([["u1", 2000, 88], ["u2", 2000, 88]]);
    const [, obras, , fecha] = pdfs.pdfDeMarcos.mock.calls[0]!;
    expect(obras.map((o: { autor: string }) => o.autor)).toEqual(["Ana", "Autor sin indicar"]);
    expect(fecha).toEqual(a.updatedAt);
  });
  it("una sola obra y sólo el remarco: foto chica (sólo para la proporción)", async () => {
    const r = await armarPieza(a, { pieza: "marcos", tamano: "A4", orientacion: "AUTO", conFoto: false, obra: "w2" }, base);
    expect(r?.nombre).toBe("marcos-miradas-abc-A4-2-remarco");
    expect(imagen.imagenParaPdf.mock.calls).toEqual([["u2", 200, 88]]);
  });
  it("una obra que no es de la muestra no arma nada", async () => {
    expect(await armarPieza(a, { pieza: "marcos", tamano: "A4", orientacion: "AUTO", conFoto: true, obra: "ajena" }, base)).toBeNull();
  });
  it("el afiche del libro lleva el QR con conteo y la dirección para escribir", async () => {
    await armarPieza(a, { pieza: "libro", tamano: "A3" }, base);
    expect(pdfs.pdfDeAficheLibro.mock.calls[0]![0]).toEqual({
      muestra: "Miradas", url: "https://muestrasfotograficas.com/q/l/a1", urlVisible: "muestrasfotograficas.com/m/miradas-abc/libro",
    });
  });
  it("el plano lee el JSON guardado (aunque esté vacío)", async () => {
    const r = await armarPieza(a, { pieza: "montaje" }, base);
    expect(r?.nombre).toBe("montaje-miradas-abc");
    expect(pdfs.pdfDeMontaje.mock.calls[0]![0].paredes).toEqual([]);
  });
});
```

`apps/muestras/lib/piezas/ruta.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean } }));
const cargar = vi.hoisted(() => ({ cargarMuestraParaPiezas: vi.fn() }));
const armar = vi.hoisted(() => ({ armarPieza: vi.fn() }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("@/lib/piezas/cargar", () => cargar);
vi.mock("@/lib/piezas/armar", () => armar);
vi.mock("@/lib/imagenes/r2", () => ({ subirPdfAR2: vi.fn() }));
vi.mock("@repo/db", () => ({ prisma: {} }));

const { GET } = await import("@/app/api/piezas/[id]/[pieza]/route");
const { resetRateLimit } = await import("@/lib/limite");

const pedir = (pieza: string, q = "", id = "a1") =>
  GET(new Request(`http://localhost:3014/api/piezas/${id}/${pieza}${q}`), { params: Promise.resolve({ id, pieza }) });

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = { id: 7, esSuperAdmin: false };
  cargar.cargarMuestraParaPiezas.mockResolvedValue({ id: "a1", slug: "m" });
  armar.armarPieza.mockResolvedValue({ bytes: new Uint8Array([1, 2]), nombre: "cartel-m-A3" });
});

describe("GET /api/piezas/[id]/[pieza]", () => {
  it("sin sesión, a ingresar y de vuelta a Montaje, sin mirar la muestra", async () => {
    usuarioActual.valor = null;
    const r = await pedir("cartel");
    expect(r.status).toBe(307);
    expect(new URL(r.headers.get("location")!).searchParams.get("next")).toBe("/panel/montaje");
    expect(cargar.cargarMuestraParaPiezas).not.toHaveBeenCalled();
  });
  it("una pieza desconocida o una muestra ajena dan 404", async () => {
    expect((await pedir("fichas")).status).toBe(404);
    cargar.cargarMuestraParaPiezas.mockResolvedValue(null);
    expect((await pedir("cartel")).status).toBe(404);
  });
  it("las piezas con QR piden la muestra publicada; marcos y plano, no", async () => {
    await pedir("cartel");
    await pedir("marcos");
    await pedir("montaje");
    expect(cargar.cargarMuestraParaPiezas.mock.calls.map((c) => c[2])).toEqual([{ publicada: true }, { publicada: false }, { publicada: false }]);
  });
  it("entrega el PDF", async () => {
    const r = await pedir("cartel", "?tamano=A2");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="cartel-m-A3.pdf"');
    expect(armar.armarPieza.mock.calls[0]![1]).toEqual({ pieza: "cartel", tamano: "A2" });
  });
  it("si armar no encuentra la obra, 404; si se rompe, 500", async () => {
    armar.armarPieza.mockResolvedValue(null);
    expect((await pedir("marcos", "?obra=x")).status).toBe(404);
    armar.armarPieza.mockRejectedValue(new Error("pdf-lib"));
    expect((await pedir("cartel")).status).toBe(500);
  });
});
```

En `apps/muestras/lib/panel/en-preparacion.test.ts`: borrar el test "Montaje lista lo que todavía falta" y el import de `MONTAJE_EN_PREPARACION`.

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter muestras test -- lib/piezas lib/panel`
Expected: FAIL — no existen `opciones.ts`, `armar.ts` ni la ruta.

- [ ] **Step 3: Opciones, carga y armado**

`apps/muestras/lib/piezas/opciones.ts`:
```ts
import {
  isCatalogSize, isFrameSize, isGuestbookPosterSize, isOrientation, isPosterSize,
  type CatalogSize, type FrameSize, type GuestbookPosterSize, type Orientation, type PosterSize,
} from "@repo/muestras";

export const PIEZAS = ["marcos", "cartel", "catalogo", "montaje", "libro"] as const;
export type Pieza = (typeof PIEZAS)[number];
/** Llevan un QR a una página pública: piden la muestra publicada (D11). */
export const PIEZAS_CON_QR: readonly Pieza[] = ["cartel", "catalogo", "libro"];

export type OpcionesPieza =
  | { pieza: "marcos"; tamano: FrameSize; orientacion: Orientation; conFoto: boolean; obra: string | null }
  | { pieza: "cartel"; tamano: PosterSize }
  | { pieza: "catalogo"; tamano: CatalogSize }
  | { pieza: "libro"; tamano: GuestbookPosterSize }
  | { pieza: "montaje" };

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Las opciones de la dirección, con valores por defecto para lo que no se entiende. */
export function opcionesDePieza(pieza: string, sp: URLSearchParams): OpcionesPieza | null {
  const t = sp.get("tamano");
  switch (pieza) {
    case "marcos": {
      const o = sp.get("orientacion");
      const obra = sp.get("obra");
      return {
        pieza, tamano: isFrameSize(t) ? t : "A4", orientacion: isOrientation(o) ? o : "AUTO",
        conFoto: sp.get("foto") !== "no", obra: obra && ID.test(obra) ? obra : null,
      };
    }
    case "cartel": return { pieza, tamano: isPosterSize(t) ? t : "A3" };
    case "catalogo": return { pieza, tamano: isCatalogSize(t) ? t : "A5" };
    case "libro": return { pieza, tamano: isGuestbookPosterSize(t) ? t : "A4" };
    case "montaje": return { pieza };
    default: return null;
  }
}

export function urlDePieza(id: string, o: OpcionesPieza): string {
  const q = new URLSearchParams();
  if (o.pieza !== "montaje") q.set("tamano", o.tamano);
  if (o.pieza === "marcos") {
    q.set("orientacion", o.orientacion);
    if (!o.conFoto) q.set("foto", "no");
    if (o.obra) q.set("obra", o.obra);
  }
  const s = q.toString();
  return `/api/piezas/${encodeURIComponent(id)}/${o.pieza}${s ? `?${s}` : ""}`;
}
```

`apps/muestras/lib/piezas/cargar.ts`:
```ts
import "server-only";
import { prisma } from "@repo/db";
import type { Usuario } from "@/lib/usuario";
import type { MuestraParaPiezas } from "./textos";

/** Una muestra propia (cualquiera, si es super admin), de tipo muestra; publicada si se pide. */
export function cargarMuestraParaPiezas(
  id: string,
  usuario: Pick<Usuario, "id" | "esSuperAdmin">,
  { publicada }: { publicada: boolean },
): Promise<MuestraParaPiezas | null> {
  return prisma.culturalActivity.findFirst({
    where: {
      id, type: "MUESTRA",
      ...(publicada ? { reviewStatus: "APPROVED" } : {}),
      ...(usuario.esSuperAdmin ? {} : { proposedByUserId: usuario.id }),
    },
    select: {
      id: true, slug: true, title: true, organizersText: true, curatorialText: true, curatorCredits: true,
      startsAt: true, endsAt: true, scheduleText: true, venueName: true, address: true, city: true, province: true,
      coverImageUrl: true, hangingPlan: true, updatedAt: true,
      works: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, authorName: true, year: true, technique: true, imageUrl: true, sortOrder: true } },
    },
  });
}
```

`apps/muestras/lib/piezas/armar.ts`:
```ts
import "server-only";
import { parseHangingPlan, scanUrl } from "@repo/muestras";
import { pdfDeAficheLibro } from "./afiche-libro";
import { pdfDeCartel } from "./cartel";
import { pdfDeCatalogo, type ObraCatalogo } from "./catalogo";
import { imagenParaPdf } from "./imagen";
import { pdfDeMarcos, type ObraParaMarco } from "./marco";
import { pdfDeMontaje } from "./montaje";
import type { OpcionesPieza } from "./opciones";
import { autorDeObra, datosDeCartel, datosDeMontaje, detalleDeObra, nombreDePieza, urlVisible, type MuestraParaPiezas } from "./textos";

/**
 * Arma el PDF pedido. Las fotos se procesan **una por vez**: 40 fotos en paralelo llenarían la
 * memoria de la función. `null` = la obra pedida no es de esta muestra (o no hay obras).
 */
export async function armarPieza(a: MuestraParaPiezas, o: OpcionesPieza, base: string): Promise<{ bytes: Uint8Array; nombre: string } | null> {
  const fecha = a.updatedAt;
  switch (o.pieza) {
    case "marcos": {
      const obras = o.obra ? a.works.filter((w) => w.id === o.obra) : a.works;
      if (obras.length === 0) return null;
      const lista: ObraParaMarco[] = [];
      for (const w of obras) {
        // Sin foto igual se lee una chica: la ventana del remarco va a la proporción de la obra.
        lista.push({ titulo: w.title, autor: autorDeObra(w.authorName), detalle: detalleDeObra(w), imagen: await imagenParaPdf(w.imageUrl, o.conFoto ? 2000 : 200, 88) });
      }
      const extra = [o.tamano, ...(o.obra ? [String(obras[0]!.sortOrder + 1)] : []), ...(o.conFoto ? [] : ["remarco"])];
      return { bytes: await pdfDeMarcos(a.title, lista, o, fecha), nombre: nombreDePieza("marcos", a.slug, extra) };
    }
    case "cartel":
      return { bytes: await pdfDeCartel(datosDeCartel(a, base), o.tamano, fecha), nombre: nombreDePieza("cartel", a.slug, [o.tamano]) };
    case "catalogo": {
      if (a.works.length === 0) return null;
      const obras: ObraCatalogo[] = [];
      for (const w of a.works) {
        obras.push({ titulo: w.title, autor: w.authorName, detalle: detalleDeObra(w), imagen: await imagenParaPdf(w.imageUrl, 1400, 80) });
      }
      const datos = { ...datosDeCartel(a, base), urlVisible: urlVisible(base, `/m/${a.slug}`), portada: await imagenParaPdf(a.coverImageUrl, 1600, 82), obras };
      return { bytes: await pdfDeCatalogo(datos, o.tamano, fecha), nombre: nombreDePieza("catalogo", a.slug, [o.tamano]) };
    }
    case "libro":
      return {
        bytes: await pdfDeAficheLibro({ muestra: a.title, url: scanUrl(base, "l", a.id), urlVisible: urlVisible(base, `/m/${a.slug}/libro`) }, o.tamano, fecha),
        nombre: nombreDePieza("libro", a.slug, [o.tamano]),
      };
    case "montaje": {
      const { plan } = parseHangingPlan(a.hangingPlan, a.works.map((w) => w.id));
      return { bytes: await pdfDeMontaje(datosDeMontaje(a.title, plan, a.works), fecha), nombre: nombreDePieza("montaje", a.slug, []) };
    }
  }
}
```

- [ ] **Step 4: La ruta**

`apps/muestras/app/api/piezas/[id]/[pieza]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { baseUrlPublica } from "@/lib/fichas/cargar";
import { frenarPorUsuario } from "@/lib/limite";
import { armarPieza } from "@/lib/piezas/armar";
import { cargarMuestraParaPiezas } from "@/lib/piezas/cargar";
import { entregarPdf } from "@/lib/piezas/entregar";
import { PIEZAS_CON_QR, opcionesDePieza } from "@/lib/piezas/opciones";
import { getUsuario } from "@/lib/usuario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 40 fotos pasadas a JPEG tardan: más margen que el de una ruta común.
export const maxDuration = 60;

/** Piezas para imprimir de una muestra (marcos, cartel, catálogo, plano, afiche del libro). Dueño o super admin. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; pieza: string }> }) {
  const usuario = await getUsuario();
  // Igual que las fichas: sin sesión, a ingresar; no se usa el id para nada.
  if (!usuario) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/panel/montaje")}`, req.url), 307);
  const { id, pieza } = await params;
  const opciones = opcionesDePieza(pieza, new URL(req.url).searchParams);
  if (!opciones) return NextResponse.json({ error: "Esa pieza no existe." }, { status: 404 });
  if (!frenarPorUsuario("piezas", usuario.id).allowed) {
    return NextResponse.json({ error: "Pediste muchos PDF seguidos. Esperá unos minutos." }, { status: 429 });
  }
  const a = await cargarMuestraParaPiezas(id, usuario, { publicada: PIEZAS_CON_QR.includes(opciones.pieza) });
  if (!a) return NextResponse.json({ error: "No encontramos esa muestra entre las tuyas. Las piezas con QR piden la muestra publicada." }, { status: 404 });
  try {
    const r = await armarPieza(a, opciones, baseUrlPublica());
    if (!r) return NextResponse.json({ error: "Esa obra no es de esta muestra." }, { status: 404 });
    return await entregarPdf(r.bytes, { nombre: r.nombre, activityId: a.id });
  } catch (err) {
    console.error("GET /api/piezas:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "No pudimos armar el PDF. Probá de nuevo." }, { status: 500 });
  }
}
```

- [ ] **Step 5: Las páginas del panel**

En `apps/muestras/lib/actividades/consultas.ts`, agregar:
```ts
/** Las muestras propias en cualquier estado, para "Montaje e impresión" (el plano se prepara antes de publicar). */
export function listarMuestrasParaMontaje(userId: number) {
  return prisma.culturalActivity.findMany({
    where: { proposedByUserId: userId, type: "MUESTRA", reviewStatus: { not: "REJECTED" } },
    select: { id: true, title: true, reviewStatus: true, startsAt: true, endsAt: true, _count: { select: { works: true } } },
    orderBy: { startsAt: "desc" },
  });
}
```
(`listarPublicadasMias` queda si alguien más la usa; si no, borrarla: `grep -rn listarPublicadasMias apps/muestras`.)

`apps/muestras/app/panel/montaje/page.tsx` (reemplaza la actual):
```tsx
import Link from "next/link";
import { REVIEW_STATUS_LABELS, formatArDay, type ReviewStatus } from "@repo/muestras";
import { listarMuestrasParaMontaje } from "@/lib/actividades/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Montaje e impresión" };

export default async function Montaje() {
  const usuario = await requireUsuario("/panel/montaje");
  const muestras = await listarMuestrasParaMontaje(usuario.id);
  return (
    <main className="max-w-3xl space-y-10">
      <header className="space-y-3">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Montaje e impresión</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">
          Todo lo que va a la sala, listo para imprimir: fichas con QR, marcos con título y autor, el cartel con el texto curatorial, el catálogo, el afiche del libro de visitas y el plano de montaje.
        </p>
      </header>
      {muestras.length === 0 ? (
        <p className="border-t border-[var(--mf-line)] pt-6 text-lg">
          Cuando cargues una muestra, acá vas a preparar su montaje. <Link href="/panel/proponer" className="underline underline-offset-[6px]">Proponer una muestra</Link>
        </p>
      ) : (
        <ul className="border-t border-[var(--mf-line)]">
          {muestras.map((m) => (
            <li key={m.id} className="border-b border-[var(--mf-line)] py-5">
              <h2 className="mf-titulo text-[1.6rem]"><Link href={`/panel/montaje/${m.id}`} className="underline-offset-[5px] hover:underline">{m.title}</Link></h2>
              <p className="text-sm text-[var(--mf-muted)]">
                {formatArDay(m.startsAt)} al {formatArDay(m.endsAt)} · {m._count.works} obras · {REVIEW_STATUS_LABELS[m.reviewStatus as ReviewStatus] ?? m.reviewStatus}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

`apps/muestras/app/panel/montaje/[id]/page.tsx`:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATALOG_SIZES, GUESTBOOK_POSTER_SIZES, POSTER_SIZES } from "@repo/muestras";
import { DescargarFichas } from "@/components/panel/descargar-fichas";
import { DescargarMarcos } from "@/components/montaje/descargar-marcos";
import { Descargas } from "@/components/montaje/descargas";
import { EditorMontaje } from "@/components/montaje/editor-montaje";
import { cargarMontaje } from "@/lib/montaje/consultas";
import { urlDePieza } from "@/lib/piezas/opciones";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Montaje e impresión" };

export default async function MontajeDeMuestra({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await requireUsuario(`/panel/montaje/${id}`);
  const m = await cargarMontaje(id, usuario);
  if (!m) notFound();
  const publicada = m.reviewStatus === "APPROVED";
  const conObras = m.works.length > 0;
  const seccion = "space-y-3 border-t border-[var(--mf-line)] pt-6";
  const sinPublicar = <p className="text-[15px] text-[var(--mf-muted)]">Lleva un QR a la página de la muestra: se baja cuando la muestra está publicada.</p>;
  return (
    <main className="max-w-3xl space-y-10">
      <Link href="/panel/montaje" className="text-sm text-[var(--mf-muted)] underline underline-offset-[6px]">Volver a Montaje e impresión</Link>
      <h1 className="mf-titulo text-[clamp(2rem,4vw,2.8rem)]">{m.title}</h1>

      <section aria-labelledby="t-fichas" className={seccion}>
        <h2 id="t-fichas" className="mf-titulo text-[1.5rem]">Fichas de sala con QR</h2>
        {publicada ? <DescargarFichas id={m.id} obras={m.works} /> : sinPublicar}
      </section>

      <section aria-labelledby="t-marcos" className={seccion}>
        <h2 id="t-marcos" className="mf-titulo text-[1.5rem]">Marcos y remarcos</h2>
        {conObras ? <DescargarMarcos id={m.id} obras={m.works} /> : <p className="text-[15px] text-[var(--mf-muted)]">Cargá obras en la muestra para armar sus marcos.</p>}
      </section>

      <section aria-labelledby="t-cartel" className={seccion}>
        <h2 id="t-cartel" className="mf-titulo text-[1.5rem]">Cartel de sala</h2>
        <p className="text-[15px] text-[var(--mf-muted)]">
          {m.curatorialText
            ? "Título, organiza, curaduría, el texto curatorial, fechas, horarios, sede y un QR a la muestra. Si el texto es muy largo, el final se corta: probá una medida más grande."
            : <>Sale con el título, los datos y el QR. Para sumar el texto curatorial, escribilo en la <Link href={`/panel/muestras/${m.id}`} className="underline underline-offset-[6px]">ficha de la muestra</Link>.</>}
        </p>
        {publicada ? <Descargas opciones={Object.entries(POSTER_SIZES).map(([k, v]) => ({ etiqueta: v.label, href: urlDePieza(m.id, { pieza: "cartel", tamano: k as keyof typeof POSTER_SIZES }) }))} /> : sinPublicar}
      </section>

      <section aria-labelledby="t-catalogo" className={seccion}>
        <h2 id="t-catalogo" className="mf-titulo text-[1.5rem]">Catálogo</h2>
        <p className="text-[15px] text-[var(--mf-muted)]">Portada, texto curatorial, una página por obra con su ficha, índice de autores y un QR a la muestra.</p>
        {publicada && conObras ? <Descargas opciones={Object.entries(CATALOG_SIZES).map(([k, v]) => ({ etiqueta: v.label, href: urlDePieza(m.id, { pieza: "catalogo", tamano: k as keyof typeof CATALOG_SIZES }) }))} /> : sinPublicar}
      </section>

      <section aria-labelledby="t-libro" className={seccion}>
        <h2 id="t-libro" className="mf-titulo text-[1.5rem]">Afiche del libro de visitas</h2>
        <p className="text-[15px] text-[var(--mf-muted)]">
          Quien recorre la sala escanea el afiche y deja su comentario. Los moderás en <Link href={`/panel/estadisticas/${m.id}/libro`} className="underline underline-offset-[6px]">Estadísticas</Link>.
        </p>
        {publicada ? <Descargas opciones={Object.entries(GUESTBOOK_POSTER_SIZES).map(([k, v]) => ({ etiqueta: v.label, href: urlDePieza(m.id, { pieza: "libro", tamano: k as keyof typeof GUESTBOOK_POSTER_SIZES }) }))} /> : sinPublicar}
      </section>

      <section aria-labelledby="t-plano" className={seccion}>
        <h2 id="t-plano" className="mf-titulo text-[1.5rem]">Plano y lista de montaje</h2>
        <p className="text-[15px] text-[var(--mf-muted)]">Cargá las paredes y qué obra va en cada una, en orden. Calculamos dónde va cada marco: centro a 150 cm del piso y el mismo espacio entre obras.</p>
        {m.droppedItems > 0 ? <p role="status" className="text-[15px] text-[var(--mf-alerta)]">Sacamos del plano {m.droppedItems} obra(s) que ya no están en la muestra.</p> : null}
        <EditorMontaje id={m.id} obras={m.works} planInicial={m.plan} />
      </section>
    </main>
  );
}
```

`apps/muestras/components/montaje/descargas.tsx`:
```tsx
const enlace = "underline underline-offset-[6px]";

/** Una fila de enlaces de descarga ("A3 · A2 · 50 × 70 cm"). Son descargas comunes: sin JavaScript. */
export function Descargas({ opciones }: { opciones: { etiqueta: string; href: string }[] }) {
  return (
    <p className="text-[15px]">
      Bajar en{" "}
      {opciones.map((o, i) => (
        <span key={o.href}>{i > 0 ? " · " : ""}<a href={o.href} className={enlace}>{o.etiqueta}</a></span>
      ))}
    </p>
  );
}
```

`apps/muestras/components/montaje/descargar-marcos.tsx` (cliente): tres `<select>` (Medida con `FRAME_SIZES[k].label`, Orientación con `ORIENTATION_LABELS`, "Con la foto" / "Sólo el remarco") y un cuarto "Obra: Todas | <cada obra>"; el enlace "Bajar los marcos (PDF)" usa `urlDePieza(id, { pieza: "marcos", … })`. Debajo, en `text-sm`:
- con foto: `Con las fotos que guardamos, en ${FRAME_SIZES[t].label} salen con ${QUALITY_LABELS[expectedQuality(t)]}.` y, si es `LOW`: " Para esta medida conviene «Sólo el remarco» con una copia impresa en un laboratorio."
- sin foto: "Sale el margen con título y autor, y la ventana marcada con línea punteada a la medida de la foto: apoyá tu copia detrás o recortá la ventana."
- siempre: "Con varias obras el PDF pesa mucho: puede tardar hasta un minuto."

`lib/panel/en-preparacion.ts`: borrar `MONTAJE_EN_PREPARACION` (y su comentario).

`app/panel/muestras/[id]/page.tsx`: en el bloque de `estado === "APPROVED"` y `a.type === "MUESTRA"`, debajo de las fichas, una línea: `<p><Link href={`/panel/montaje/${a.id}`} className="underline">Montaje e impresión</Link> · <Link href={`/panel/estadisticas/${a.id}`} className="underline">Estadísticas y libro de visitas</Link></p>`.

- [ ] **Step 6: Correr y ver que pasa**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: PASS.

- [ ] **Step 7: Probar en local** (contra una base con la migración; si todavía no está, dejarlo para la Task 14)

Con `pnpm --filter muestras dev`, con una muestra propia publicada de al menos 3 obras:
1. `/panel/montaje` lista la muestra; su página muestra las seis secciones.
2. Bajar marcos A4 de una obra (directo), todos en 40×50 (si pesa más de 4 MB, la dirección final es del bucket `…/muestras/piezas/<id>/<huella>.pdf`), y "sólo el remarco".
3. Bajar cartel A3, catálogo A5 y afiche A4; escanear el QR del cartel y el del afiche con el teléfono (en local apuntan a `APP_URL`).
4. Plano: dos paredes, cuatro obras, guardar, recargar (vuelve igual), forzar "no entran" y "muy juntas" y ver los avisos; bajar el PDF.
5. Una muestra en borrador: marcos y plano andan; fichas, cartel, catálogo y afiche dicen que piden la muestra publicada.
6. Otra cuenta: `/panel/montaje/<id ajeno>` da 404 y `/api/piezas/<id ajeno>/cartel` da 404.

- [ ] **Step 8: Commit**

```bash
git add apps/muestras/lib/piezas apps/muestras/app/api/piezas apps/muestras/app/panel/montaje apps/muestras/components/montaje apps/muestras/lib/actividades/consultas.ts apps/muestras/lib/panel "apps/muestras/app/panel/muestras/[id]/page.tsx"
git commit -m "Muestras: Montaje e impresión por muestra con marcos, cartel, catálogo, afiche y plano"
```

**Acceptance:** cada pieza se baja desde el panel con sus medidas; las de QR sólo con la muestra publicada; nada se baja de una muestra ajena; "Montaje e impresión" ya no muestra nada "en preparación".

---
### Task 12: Libro de visitas — público y moderación

**Files:**
- Create: `apps/muestras/lib/libro/acciones.ts`, `apps/muestras/lib/libro/consultas.ts`, `apps/muestras/app/m/[slug]/libro/page.tsx`, `apps/muestras/app/panel/estadisticas/[id]/libro/page.tsx`, `apps/muestras/components/libro/formulario-libro.tsx`, `apps/muestras/components/libro/ultimos-comentarios.tsx`, `apps/muestras/components/libro/moderar-libro.tsx`
- Modify: `apps/muestras/app/m/[slug]/page.tsx`
- Test: `apps/muestras/lib/libro/acciones.test.ts`

**Interfaces:**
- Consumes: `guestbookInput`, `guestbookProblems`, `guestbookState`, `initialEntryStatus`, `isTooFast`, `isModerationAction`, `nextEntryStatus`, `isGuestbookMode`, `guestbookSignature`, `GUESTBOOK_*` (Task 3); `frenarPorIp`, `frenarPorMuestra`, `ipDeLaPeticion`, `frenarPorUsuario` (Task 5); tabla `CulturalActivityGuestbookEntry` y `guestbookMode` (Task 4).
- Produces:
  - `acciones.ts` (`"use server"`): `ResultadoLibro`, `dejarComentario(fd)`, `moderarEntrada(entryId, accion)`, `cambiarModoLibro(activityId, modo)`
  - `consultas.ts`: `entradasPublicadas(activityId, take)`, `libroParaModerar(id, usuario)`
  - Página pública `/m/[slug]/libro`; bloque "Libro de visitas" en `/m/[slug]`; moderación `/panel/estadisticas/[id]/libro`

- [ ] **Step 1: Escribir el test que falla**

`apps/muestras/lib/libro/acciones.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivity: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  culturalActivityGuestbookEntry: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => cache);
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "190.1.2.3" }) }));
const { cambiarModoLibro, dejarComentario, moderarEntrada } = await import("./acciones");
const { resetRateLimit } = await import("@/lib/limite");

const muestra = {
  id: "cka1b2c3d4", slug: "miradas-abc", reviewStatus: "APPROVED", type: "MUESTRA", isCancelled: false,
  guestbookMode: "PUBLISH", endsAt: new Date(Date.now() + 10 * 86_400_000), proposedByUserId: 7,
};
const form = (o: Record<string, string> = {}) => {
  const fd = new FormData();
  const datos = { muestra: "cka1b2c3d4", nombre: "Ana", ciudad: "Rosario", comentario: "Hermosa muestra.", t: String(Date.now() - 10_000), sitio: "", ...o };
  for (const [k, v] of Object.entries(datos)) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = null;
  db.culturalActivity.findUnique.mockResolvedValue(muestra);
  db.culturalActivityGuestbookEntry.create.mockResolvedValue({ id: "e1" });
});

describe("dejarComentario", () => {
  it("lo publica al instante en modo PUBLISH y refresca la muestra", async () => {
    expect(await dejarComentario(form())).toEqual({ ok: true, publicado: true });
    expect(db.culturalActivityGuestbookEntry.create).toHaveBeenCalledWith({
      data: { activityId: "cka1b2c3d4", name: "Ana", city: "Rosario", comment: "Hermosa muestra.", status: "PUBLISHED" },
    });
    expect(cache.revalidatePath).toHaveBeenCalledWith("/m/miradas-abc");
  });
  it("en modo REVIEW queda pendiente y no refresca", async () => {
    db.culturalActivity.findUnique.mockResolvedValue({ ...muestra, guestbookMode: "REVIEW" });
    expect(await dejarComentario(form())).toEqual({ ok: true, publicado: false });
    expect(db.culturalActivityGuestbookEntry.create.mock.calls[0]![0].data.status).toBe("PENDING");
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });
  it("campo trampa o demasiado rápido: finge que salió bien y no guarda", async () => {
    expect((await dejarComentario(form({ sitio: "http://spam" }))).ok).toBe(true);
    expect((await dejarComentario(form({ t: String(Date.now()) }))).ok).toBe(true);
    expect(db.culturalActivityGuestbookEntry.create).not.toHaveBeenCalled();
  });
  it("rechaza enlaces y libros cerrados", async () => {
    expect(await dejarComentario(form({ comentario: "visiten www.spam.com" }))).toEqual({ ok: false, error: "Los comentarios no pueden llevar enlaces ni direcciones de correo." });
    db.culturalActivity.findUnique.mockResolvedValue({ ...muestra, guestbookMode: "OFF" });
    expect((await dejarComentario(form())).ok).toBe(false);
    db.culturalActivity.findUnique.mockResolvedValue(null);
    expect((await dejarComentario(form())).ok).toBe(false);
    expect(db.culturalActivityGuestbookEntry.create).not.toHaveBeenCalled();
  });
  it("freno por IP en esa muestra", async () => {
    for (let i = 0; i < 10; i++) expect((await dejarComentario(form())).ok).toBe(true);
    expect(await dejarComentario(form())).toEqual({ ok: false, error: "Dejaste varios comentarios seguidos. Probá en unos minutos." });
  });
});

describe("moderación", () => {
  const entrada = { id: "e1", activity: { id: "cka1b2c3d4", slug: "miradas-abc", proposedByUserId: 7 } };
  beforeEach(() => {
    db.culturalActivityGuestbookEntry.findUnique.mockResolvedValue(entrada);
    db.culturalActivityGuestbookEntry.updateMany.mockResolvedValue({ count: 1 });
    db.culturalActivityGuestbookEntry.deleteMany.mockResolvedValue({ count: 1 });
  });
  it("el dueño oculta, publica y borra", async () => {
    usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: null };
    expect((await moderarEntrada("e1", "hide")).ok).toBe(true);
    expect(db.culturalActivityGuestbookEntry.updateMany.mock.calls[0]![0]).toMatchObject({ where: { id: "e1" }, data: { status: "HIDDEN", moderatedByUserId: 7 } });
    expect((await moderarEntrada("e1", "delete")).ok).toBe(true);
    expect(db.culturalActivityGuestbookEntry.deleteMany).toHaveBeenCalledWith({ where: { id: "e1" } });
  });
  it("nadie más; y acciones desconocidas no", async () => {
    usuarioActual.valor = { id: 8, esSuperAdmin: false, email: "x", name: null };
    expect((await moderarEntrada("e1", "hide")).ok).toBe(false);
    usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: null };
    expect((await moderarEntrada("e1", "borrarTodo" as never)).ok).toBe(false);
    expect(db.culturalActivityGuestbookEntry.updateMany).not.toHaveBeenCalled();
  });
  it("cambiar el modo: sólo el dueño y sólo modos válidos", async () => {
    usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: null };
    db.culturalActivity.updateMany.mockResolvedValue({ count: 1 });
    expect((await cambiarModoLibro("cka1b2c3d4", "REVIEW")).ok).toBe(true);
    expect(db.culturalActivity.updateMany).toHaveBeenCalledWith({ where: { id: "cka1b2c3d4", type: "MUESTRA", proposedByUserId: 7 }, data: { guestbookMode: "REVIEW" } });
    expect((await cambiarModoLibro("cka1b2c3d4", "CUALQUIERA")).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter muestras test -- lib/libro`
Expected: FAIL — no existe `acciones.ts`.

- [ ] **Step 3: Acciones y consultas**

`apps/muestras/lib/libro/acciones.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@repo/db";
import {
  guestbookInput, guestbookProblems, guestbookState, initialEntryStatus, isGuestbookMode, isModerationAction, isTooFast, nextEntryStatus,
} from "@repo/muestras";
import { frenarPorIp, frenarPorMuestra, frenarPorUsuario, ipDeLaPeticion } from "@/lib/limite";
import { getUsuario } from "@/lib/usuario";

export type ResultadoLibro = { ok: true; publicado: boolean } | { ok: false; error: string };

const ID = /^[A-Za-z0-9_-]{1,64}$/;
// A un robot se le contesta como si hubiera salido bien: no aprende qué lo delató.
const COMO_SI_NADA: ResultadoLibro = { ok: true, publicado: false };

/** Comentario del público, sin cuenta (D18–D20). No guarda IP ni nada que identifique. */
export async function dejarComentario(fd: FormData): Promise<ResultadoLibro> {
  const activityId = String(fd.get("muestra") ?? "");
  if (!ID.test(activityId)) return { ok: false, error: "No encontramos esta muestra." };
  if (String(fd.get("sitio") ?? "") !== "") return COMO_SI_NADA;
  if (isTooFast(Number(fd.get("t")), Date.now())) return COMO_SI_NADA;
  if (!frenarPorIp("libro", ipDeLaPeticion(await headers()), activityId).allowed) {
    return { ok: false, error: "Dejaste varios comentarios seguidos. Probá en unos minutos." };
  }
  const entrada = guestbookInput({ name: fd.get("nombre"), city: fd.get("ciudad"), comment: fd.get("comentario") });
  const problemas = guestbookProblems(entrada);
  if (problemas.length) return { ok: false, error: problemas.join(" ") };
  const a = await prisma.culturalActivity.findUnique({
    where: { id: activityId },
    select: { id: true, slug: true, reviewStatus: true, type: true, isCancelled: true, guestbookMode: true, endsAt: true },
  });
  if (!a || guestbookState(a, new Date()) !== "OPEN") return { ok: false, error: "El libro de visitas de esta muestra está cerrado." };
  if (!frenarPorMuestra("libro", a.id).allowed) return { ok: false, error: "El libro recibió muchos comentarios en poco tiempo. Probá en un rato." };
  const status = initialEntryStatus(a.guestbookMode);
  await prisma.culturalActivityGuestbookEntry.create({
    data: { activityId: a.id, name: entrada.name, city: entrada.city, comment: entrada.comment, status },
  });
  if (status === "PUBLISHED") {
    revalidatePath(`/m/${a.slug}`);
    revalidatePath(`/m/${a.slug}/libro`);
  }
  return { ok: true, publicado: status === "PUBLISHED" };
}

type Resultado = { ok: true } | { ok: false; error: string };

/** Publicar, ocultar o borrar (definitivo) un comentario. Dueño de la muestra o super admin. */
export async function moderarEntrada(entryId: string, accion: string): Promise<Resultado> {
  const usuario = await getUsuario();
  if (!usuario) return { ok: false, error: "Tu sesión venció. Volvé a ingresar." };
  if (typeof entryId !== "string" || !ID.test(entryId) || !isModerationAction(accion)) return { ok: false, error: "No se puede hacer eso." };
  if (!frenarPorUsuario("moderarLibro", usuario.id).allowed) return { ok: false, error: "Esperá unos minutos y seguí." };
  const e = await prisma.culturalActivityGuestbookEntry.findUnique({
    where: { id: entryId },
    select: { id: true, activity: { select: { id: true, slug: true, proposedByUserId: true } } },
  });
  if (!e || (!usuario.esSuperAdmin && e.activity.proposedByUserId !== usuario.id)) return { ok: false, error: "No encontramos ese comentario." };
  const estado = nextEntryStatus(accion);
  if (estado === null) await prisma.culturalActivityGuestbookEntry.deleteMany({ where: { id: e.id } });
  else await prisma.culturalActivityGuestbookEntry.updateMany({ where: { id: e.id }, data: { status: estado, moderatedAt: new Date(), moderatedByUserId: usuario.id } });
  revalidatePath(`/m/${e.activity.slug}`);
  revalidatePath(`/m/${e.activity.slug}/libro`);
  revalidatePath(`/panel/estadisticas/${e.activity.id}/libro`);
  return { ok: true };
}

/** PUBLISH | REVIEW | OFF. Los pendientes siguen pendientes al pasar a PUBLISH: los decide el organizador. */
export async function cambiarModoLibro(activityId: string, modo: string): Promise<Resultado> {
  const usuario = await getUsuario();
  if (!usuario) return { ok: false, error: "Tu sesión venció. Volvé a ingresar." };
  if (typeof activityId !== "string" || !ID.test(activityId) || !isGuestbookMode(modo)) return { ok: false, error: "No se puede hacer eso." };
  if (!frenarPorUsuario("cambiarModoLibro", usuario.id).allowed) return { ok: false, error: "Esperá unos minutos y seguí." };
  const { count } = await prisma.culturalActivity.updateMany({
    where: { id: activityId, type: "MUESTRA", ...(usuario.esSuperAdmin ? {} : { proposedByUserId: usuario.id }) },
    data: { guestbookMode: modo },
  });
  if (count === 0) return { ok: false, error: "No encontramos esa muestra entre las tuyas." };
  revalidatePath(`/panel/estadisticas/${activityId}/libro`);
  return { ok: true };
}
```

`apps/muestras/lib/libro/consultas.ts`:
```ts
import "server-only";
import { prisma } from "@repo/db";
import type { Usuario } from "@/lib/usuario";

/** Lo publicado, lo más nuevo primero. Sólo lo que se muestra: nada de ids de moderador. */
export function entradasPublicadas(activityId: string, take: number) {
  return prisma.culturalActivityGuestbookEntry.findMany({
    where: { activityId, status: "PUBLISHED" },
    select: { id: true, name: true, city: true, comment: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** Para el panel: la muestra (dueño o super admin) con todos sus comentarios. */
export async function libroParaModerar(id: string, usuario: Pick<Usuario, "id" | "esSuperAdmin">) {
  return prisma.culturalActivity.findFirst({
    where: { id, type: "MUESTRA", ...(usuario.esSuperAdmin ? {} : { proposedByUserId: usuario.id }) },
    select: {
      id: true, slug: true, title: true, reviewStatus: true, isCancelled: true, guestbookMode: true, endsAt: true,
      guestbookEntries: { orderBy: { createdAt: "desc" }, take: 500, select: { id: true, name: true, city: true, comment: true, status: true, createdAt: true } },
    },
  });
}
```

- [ ] **Step 4: Página pública y bloque en la muestra**

`apps/muestras/app/m/[slug]/libro/page.tsx`:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatArDay, guestbookSignature, guestbookState } from "@repo/muestras";
import { FormularioLibro } from "@/components/libro/formulario-libro";
import { buscarPorSlug } from "@/lib/actividades/consultas";
import { entradasPublicadas } from "@/lib/libro/consultas";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await buscarPorSlug((await params).slug);
  // Sin indexar: le quita a un spammer el incentivo de posicionar texto (D20).
  return a ? { title: `Libro de visitas: ${a.title}`, robots: { index: false } } : {};
}

export default async function LibroDeVisitas({ params }: Props) {
  const a = await buscarPorSlug((await params).slug);
  if (!a || a.type !== "MUESTRA") notFound();
  const estado = guestbookState(a, new Date());
  if (estado === "UNAVAILABLE") notFound();
  const entradas = await entradasPublicadas(a.id, 200);
  return (
    <main className="mf-marco max-w-2xl space-y-8 py-8 sm:py-12">
      <Link href={`/m/${a.slug}`} className="text-sm text-[var(--mf-muted)] underline underline-offset-[6px]">Volver a la muestra</Link>
      <header className="space-y-2">
        <p className="text-sm text-[var(--mf-muted)]">Libro de visitas</p>
        <h1 className="mf-titulo text-[clamp(2rem,5vw,3rem)]">{a.title}</h1>
      </header>
      {estado === "OPEN" ? <FormularioLibro muestra={a.id} revisa={a.guestbookMode === "REVIEW"} /> : (
        <p className="border-t border-[var(--mf-line)] pt-4 text-[15px] text-[var(--mf-muted)]">
          {estado === "ENDED" ? "El libro de visitas de esta muestra ya cerró. Gracias a todas las personas que dejaron su comentario." : "El libro de visitas de esta muestra está cerrado."}
        </p>
      )}
      <section aria-labelledby="t-comentarios" className="space-y-4">
        <h2 id="t-comentarios" className="text-sm text-[var(--mf-muted)]">{entradas.length ? "Comentarios" : "Todavía no hay comentarios."}</h2>
        <ul className="border-t border-[var(--mf-line)]">
          {entradas.map((e) => (
            <li key={e.id} className="space-y-1 border-b border-[var(--mf-line)] py-4">
              <p className="whitespace-pre-line text-[17px] leading-relaxed">{e.comment}</p>
              <p className="text-sm text-[var(--mf-muted)]">{guestbookSignature(e)} · {formatArDay(e.createdAt)}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

`apps/muestras/components/libro/formulario-libro.tsx` (cliente):
```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { GUESTBOOK_LIMITS } from "@repo/muestras";
import { dejarComentario } from "@/lib/libro/acciones";

const campo = "w-full rounded-[2px] border border-[var(--mf-line)] bg-white px-3 py-2";

export function FormularioLibro({ muestra, revisa }: { muestra: string; revisa: boolean }) {
  const [inicio, setInicio] = useState(0);
  const [largo, setLargo] = useState(0);
  const [estado, setEstado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, start] = useTransition();
  // Cuándo se abrió el formulario: lo que se envía antes de 3 segundos no lo escribió una persona.
  useEffect(() => setInicio(Date.now()), []);

  if (estado?.ok) return <p role="status" className="border-t border-[var(--mf-line)] pt-4 text-lg">{estado.texto}</p>;
  return (
    <form
      className="space-y-4 border-t border-[var(--mf-line)] pt-6"
      action={(fd) => start(async () => {
        const r = await dejarComentario(fd);
        setEstado(r.ok
          ? { ok: true, texto: r.publicado ? "¡Gracias! Tu comentario ya está en el libro." : "¡Gracias! Quien organiza la muestra lo va a leer antes de publicarlo." }
          : { ok: false, texto: r.error });
      })}
    >
      <input type="hidden" name="muestra" value={muestra} />
      <input type="hidden" name="t" value={inicio || ""} />
      {/* Campo trampa: invisible para las personas, los robots lo llenan. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        <label>No completes este campo<input name="sitio" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="block">Tu comentario
        <textarea name="comentario" required rows={5} maxLength={GUESTBOOK_LIMITS.comment} className={campo} onChange={(e) => setLargo(e.target.value.length)} />
        <span className="text-sm text-[var(--mf-muted)]">{largo}/{GUESTBOOK_LIMITS.comment}</span>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">Tu nombre (optativo)<input name="nombre" maxLength={GUESTBOOK_LIMITS.name} className={campo} autoComplete="given-name" /></label>
        <label className="block">Tu ciudad (optativo)<input name="ciudad" maxLength={GUESTBOOK_LIMITS.city} className={campo} autoComplete="address-level2" /></label>
      </div>
      <p className="text-sm text-[var(--mf-muted)]">
        {revisa ? "Quien organiza lee cada comentario antes de publicarlo." : "Tu comentario se publica en la página de la muestra."} No guardamos tu IP ni te pedimos cuenta. Sin enlaces ni correos.
      </p>
      {estado && !estado.ok ? <p role="alert" className="text-[var(--mf-alerta)]">{estado.texto}</p> : null}
      <button type="submit" disabled={pendiente} className="h-11 rounded-[2px] border border-[var(--mf-ink)] px-5 disabled:opacity-50">
        {pendiente ? "Enviando…" : "Dejar mi comentario"}
      </button>
    </form>
  );
}
```

`apps/muestras/components/libro/ultimos-comentarios.tsx` (servidor): recibe `{ slug, entradas, abierto }`; título "Libro de visitas" (`.mf-titulo`), hasta 6 comentarios con `guestbookSignature` y fecha, y el enlace "Dejá tu comentario" (si `abierto`) o "Ver el libro de visitas" a `/m/<slug>/libro`. Si no hay comentarios y el libro está abierto, sólo la invitación: "¿Visitaste la muestra? Dejá tu comentario en el libro de visitas."

En `apps/muestras/app/m/[slug]/page.tsx`, si `a.type === "MUESTRA"`: `const libro = guestbookState(a, ahora)` y, si no es `"UNAVAILABLE"`, `const ultimas = await entradasPublicadas(a.id, 6)`; renderizar `<UltimosComentarios slug={a.slug} entradas={ultimas} abierto={libro === "OPEN"} />` debajo de la galería (si el libro está `OFF` y no hay comentarios, no mostrar nada).

- [ ] **Step 5: Moderación en el panel**

`apps/muestras/app/panel/estadisticas/[id]/libro/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { guestbookState } from "@repo/muestras";
import { ModerarLibro } from "@/components/libro/moderar-libro";
import { libroParaModerar } from "@/lib/libro/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Libro de visitas" };

export default async function Moderar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await requireUsuario(`/panel/estadisticas/${id}/libro`);
  const a = await libroParaModerar(id, usuario);
  if (!a) notFound();
  const estado = guestbookState(a, new Date());
  return (
    <main className="max-w-3xl space-y-8">
      <Link href={`/panel/estadisticas/${a.id}`} className="text-sm text-[var(--mf-muted)] underline underline-offset-[6px]">Volver a las estadísticas</Link>
      <header className="space-y-2">
        <p className="text-sm text-[var(--mf-muted)]">Libro de visitas</p>
        <h1 className="mf-titulo text-[clamp(2rem,4vw,2.8rem)]">{a.title}</h1>
        {estado === "OPEN" ? <p className="text-[15px]">Recibe comentarios en <Link href={`/m/${a.slug}/libro`} className="underline underline-offset-[6px]">la página del libro</Link>. El afiche con el QR está en <Link href={`/panel/montaje/${a.id}`} className="underline underline-offset-[6px]">Montaje e impresión</Link>.</p> : null}
        {estado === "ENDED" ? <p className="text-[15px] text-[var(--mf-muted)]">El libro ya no recibe comentarios (cerró 15 días después del final de la muestra).</p> : null}
        {estado === "UNAVAILABLE" ? <p className="text-[15px] text-[var(--mf-muted)]">El libro empieza a recibir comentarios cuando la muestra está publicada.</p> : null}
      </header>
      <ModerarLibro id={a.id} modo={a.guestbookMode} entradas={a.guestbookEntries} />
    </main>
  );
}
```

`apps/muestras/components/libro/moderar-libro.tsx` (cliente): 
- Tres opciones de radio con `GUESTBOOK_MODE_LABELS` que llaman `cambiarModoLibro(id, modo)` y `router.refresh()`.
- Filtros "Para revisar (N)", "Publicados (N)", "Ocultos (N)", "Todos": se filtra en el cliente sobre `entradas`.
- Cada comentario: texto, `guestbookSignature`, fecha (`formatArDay`), estado (`GUESTBOOK_ENTRY_STATUS_LABELS`) y botones finos según el estado: "Publicar" (pendiente u oculto), "Ocultar" (publicado o pendiente), "Borrar" (siempre; `window.confirm("¿Borrar este comentario? No se puede deshacer.")`). Cada acción llama `moderarEntrada` dentro de `useTransition` y después `router.refresh()`; un error se muestra en `role="alert"`.
- Sin comentarios: "Todavía no hay comentarios."

- [ ] **Step 6: Correr y ver que pasa**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: PASS.

- [ ] **Step 7: Probar en local** (con la base migrada)

1. Sin sesión (ventana privada), `/m/<slug>/libro`: dejar un comentario → "ya está en el libro"; aparece en la lista y, a los pocos segundos, en `/m/<slug>`.
2. Mandar uno con "www.algo.com": mensaje de enlaces. Mandar 11 seguidos: el 11.º frena.
3. En el panel, pasar a "Revisás cada comentario": el siguiente queda "Para revisar" y no se ve en público hasta "Publicar". "Ocultar" lo saca de la página pública; "Borrar" pide confirmación.
4. "Libro cerrado": la página pública dice que está cerrado y no muestra el formulario.
5. A 375 px, el formulario y la lista sin scroll horizontal.

- [ ] **Step 8: Commit**

```bash
git add apps/muestras/lib/libro apps/muestras/app/m apps/muestras/app/panel/estadisticas apps/muestras/components/libro
git commit -m "Muestras: libro de visitas por QR, sin cuenta, con moderación del organizador"
```

**Acceptance:** el público comenta sin cuenta; trampa, tiempo mínimo, enlaces y frenos funcionan; el organizador elige el modo, publica, oculta y borra; nadie más puede.

---
### Task 13: Estadísticas en el panel

**Files:**
- Create: `apps/muestras/lib/estadisticas/consultas.ts`, `apps/muestras/lib/estadisticas/resumen.ts`, `apps/muestras/app/panel/estadisticas/page.tsx`, `apps/muestras/app/panel/estadisticas/[id]/page.tsx`, `apps/muestras/components/estadisticas/grafico-diario.tsx`
- Modify: `packages/muestras/src/panel.ts`, `packages/muestras/src/panel.test.ts`, `apps/muestras/lib/panel/en-preparacion.ts`, `apps/muestras/app/privacidad/page.tsx`
- Test: `apps/muestras/lib/estadisticas/resumen.test.ts`

**Interfaces:**
- Consumes: `statsWindow`, `dailySeries`, `statTotals`, `perWorkTotals`, `barChart` (Task 3); tablas de la Task 4.
- Produces: `estadisticas` con `ready: true`; `EN_PREPARACION` sólo con `ventas`; `resumenPorMuestra(sumas, comentarios)`, `filasDeTotales(groupBy)`; `listarConEstadisticas(userId)`, `estadisticasDeMuestra(id, usuario, ahora)`; `<GraficoDiario titulo serie />`.

- [ ] **Step 1: Escribir los tests que fallan**

En `packages/muestras/src/panel.test.ts`, dentro de "upcomingSection devuelve sólo las que están en preparación", agregar:
```ts
    expect(upcomingSection("estadisticas")).toBeNull();
```

`apps/muestras/lib/estadisticas/resumen.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { filasDeTotales, resumenPorMuestra } from "./resumen";

describe("resumen de estadísticas", () => {
  it("por muestra: visitas, escaneos y comentarios", () => {
    const r = resumenPorMuestra(
      [
        { activityId: "a", metric: "VIEW", _sum: { count: 12 } },
        { activityId: "a", metric: "SCAN", _sum: { count: 3 } },
        { activityId: "a", metric: "GUESTBOOK_SCAN", _sum: { count: 2 } },
        { activityId: "b", metric: "VIEW", _sum: { count: null } },
      ],
      [
        { activityId: "a", status: "PUBLISHED", _count: { _all: 4 } },
        { activityId: "a", status: "PENDING", _count: { _all: 1 } },
      ],
    );
    expect(r.get("a")).toEqual({ visitas: 12, escaneos: 5, comentarios: 4, pendientes: 1 });
    expect(r.get("b")).toEqual({ visitas: 0, escaneos: 0, comentarios: 0, pendientes: 0 });
    expect(r.get("c")).toBeUndefined();
  });
  it("de groupBy a filas sin día", () => {
    expect(filasDeTotales([{ workId: "w1", metric: "SCAN", _sum: { count: 4 } }])).toEqual([{ workId: "w1", day: "", metric: "SCAN", count: 4 }]);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter @repo/muestras test && pnpm --filter muestras test -- lib/estadisticas lib/panel`
Expected: FAIL — `upcomingSection("estadisticas")` no es null y no existe `resumen.ts`.

- [ ] **Step 3: Panel**

En `packages/muestras/src/panel.ts`: `s("estadisticas", "Estadísticas", "/panel/estadisticas", "ORGANIZAR")` (sin el `false`).
En `apps/muestras/lib/panel/en-preparacion.ts`: borrar la entrada `estadisticas` y sumar a `ventas.puntos`, al final: `"Ventas por obra y por autor, junto con las visitas y los escaneos."`. El test existente "no explica como futuro algo que ya está construido" lo vigila.

- [ ] **Step 4: Resumen y consultas**

`apps/muestras/lib/estadisticas/resumen.ts`:
```ts
import type { StatRow } from "@repo/muestras";

export type ResumenMuestra = { visitas: number; escaneos: number; comentarios: number; pendientes: number };

/** Junta las sumas de `groupBy` por muestra. Las visitas incluyen muestra y obras; los escaneos, todos los QR. */
export function resumenPorMuestra(
  sumas: { activityId: string; metric: string; _sum: { count: number | null } }[],
  comentarios: { activityId: string; status: string; _count: { _all: number } }[],
): Map<string, ResumenMuestra> {
  const r = new Map<string, ResumenMuestra>();
  const de = (id: string) => r.get(id) ?? r.set(id, { visitas: 0, escaneos: 0, comentarios: 0, pendientes: 0 }).get(id)!;
  for (const s of sumas) {
    const fila = de(s.activityId);
    const n = s._sum.count ?? 0;
    if (s.metric === "VIEW") fila.visitas += n;
    else if (s.metric === "SCAN" || s.metric === "GUESTBOOK_SCAN") fila.escaneos += n;
  }
  for (const c of comentarios) {
    const fila = de(c.activityId);
    if (c.status === "PUBLISHED") fila.comentarios += c._count._all;
    else if (c.status === "PENDING") fila.pendientes += c._count._all;
  }
  return r;
}

export function filasDeTotales(g: { workId: string; metric: string; _sum: { count: number | null } }[]): StatRow[] {
  return g.map((x) => ({ workId: x.workId, day: "", metric: x.metric, count: x._sum.count ?? 0 }));
}
```

`apps/muestras/lib/estadisticas/consultas.ts`:
```ts
import "server-only";
import { prisma } from "@repo/db";
import { statsWindow } from "@repo/muestras";
import type { Usuario } from "@/lib/usuario";
import { filasDeTotales, resumenPorMuestra } from "./resumen";

/** Las actividades propias que alguna vez estuvieron publicadas, con sus totales. */
export async function listarConEstadisticas(userId: number) {
  const actividades = await prisma.culturalActivity.findMany({
    where: { proposedByUserId: userId, reviewStatus: { in: ["APPROVED", "UNPUBLISHED"] } },
    select: { id: true, title: true, type: true, reviewStatus: true, startsAt: true, endsAt: true },
    orderBy: { startsAt: "desc" },
  });
  const ids = actividades.map((a) => a.id);
  if (ids.length === 0) return [];
  const [sumas, comentarios] = await Promise.all([
    prisma.culturalActivityDailyStat.groupBy({ by: ["activityId", "metric"], where: { activityId: { in: ids } }, _sum: { count: true } }),
    prisma.culturalActivityGuestbookEntry.groupBy({ by: ["activityId", "status"], where: { activityId: { in: ids } }, _count: { _all: true } }),
  ]);
  const r = resumenPorMuestra(sumas, comentarios);
  return actividades.map((a) => ({ ...a, resumen: r.get(a.id) ?? { visitas: 0, escaneos: 0, comentarios: 0, pendientes: 0 } }));
}

/** Detalle de una actividad: dueño o super admin. Filas de la ventana del gráfico y totales de siempre. */
export async function estadisticasDeMuestra(id: string, usuario: Pick<Usuario, "id" | "esSuperAdmin">, ahora: Date) {
  const a = await prisma.culturalActivity.findFirst({
    where: { id, ...(usuario.esSuperAdmin ? {} : { proposedByUserId: usuario.id }) },
    select: {
      id: true, slug: true, title: true, type: true, reviewStatus: true, startsAt: true, endsAt: true,
      works: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true } },
    },
  });
  if (!a) return null;
  const ventana = statsWindow(a, ahora);
  const [filas, totales, comentarios] = await Promise.all([
    prisma.culturalActivityDailyStat.findMany({
      where: { activityId: a.id, day: { gte: ventana.from, lte: ventana.to } },
      select: { workId: true, day: true, metric: true, count: true },
    }),
    prisma.culturalActivityDailyStat.groupBy({ by: ["workId", "metric"], where: { activityId: a.id }, _sum: { count: true } }),
    prisma.culturalActivityGuestbookEntry.groupBy({ by: ["activityId", "status"], where: { activityId: a.id }, _count: { _all: true } }),
  ]);
  return { a, ventana, filas, totales: filasDeTotales(totales), libro: resumenPorMuestra([], comentarios).get(a.id) ?? { visitas: 0, escaneos: 0, comentarios: 0, pendientes: 0 } };
}
```

- [ ] **Step 5: Páginas y gráfico**

`apps/muestras/components/estadisticas/grafico-diario.tsx` (servidor, sin JavaScript):
```tsx
import { barChart, formatArDay, dayStartAr } from "@repo/muestras";

const ANCHO = 600;
const ALTO = 120;

/** Barras por día en SVG, con la tabla de números a mano (accesible y sin bibliotecas). */
export function GraficoDiario({ titulo, serie }: { titulo: string; serie: { day: string; count: number }[] }) {
  const { max, bars } = barChart(serie, { width: ANCHO, height: ALTO, gap: 2 });
  const total = serie.reduce((s, x) => s + x.count, 0);
  const dia = (d: string) => formatArDay(dayStartAr(d));
  return (
    <figure className="space-y-2">
      <figcaption className="flex justify-between text-sm"><span>{titulo}</span><span className="text-[var(--mf-muted)]">{total} en {serie.length} días · máximo {max} en un día</span></figcaption>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label={`${titulo}: ${total} en total`} className="h-auto w-full border-b border-[var(--mf-line)]">
        {bars.map((b) => (
          <rect key={b.day} x={b.x} y={b.y} width={b.width} height={b.height} fill="var(--mf-teal)">
            <title>{`${dia(b.day)}: ${b.count}`}</title>
          </rect>
        ))}
      </svg>
      <div className="flex justify-between text-xs text-[var(--mf-muted)]"><span>{dia(serie[0]!.day)}</span><span>{dia(serie.at(-1)!.day)}</span></div>
      <details className="text-sm">
        <summary className="cursor-pointer text-[var(--mf-muted)]">Ver los números</summary>
        <table className="mt-2 w-full text-left">
          <tbody>{serie.filter((x) => x.count > 0).map((x) => <tr key={x.day} className="border-b border-[var(--mf-line)]"><td className="py-1">{dia(x.day)}</td><td className="py-1 text-right">{x.count}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}
```

`apps/muestras/app/panel/estadisticas/page.tsx`: `requireUsuario("/panel/estadisticas")`; título "Estadísticas" y bajada "Cuánta gente mira tu muestra online, escanea los QR de la sala y deja su comentario."; lista de `listarConEstadisticas(usuario.id)` con título (enlace a `/panel/estadisticas/<id>`), fechas y "N visitas · N escaneos · N comentarios" (+ " · N para revisar" si hay pendientes, con enlace al libro). Sin actividades: "Cuando tengas una muestra publicada, acá vas a ver sus visitas y escaneos." Al pie, la nota de privacidad (ver abajo).

`apps/muestras/app/panel/estadisticas/[id]/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { dailySeries, perWorkTotals, statTotals } from "@repo/muestras";
import { GraficoDiario } from "@/components/estadisticas/grafico-diario";
import { estadisticasDeMuestra } from "@/lib/estadisticas/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Estadísticas" };

/** Fecha desde la que las fichas imprimen el QR con conteo (día del deploy de la etapa 4). */
const DESDE_QR_CON_CONTEO = "noviembre de 2026";

export default async function EstadisticasDeMuestra({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await requireUsuario(`/panel/estadisticas/${id}`);
  const d = await estadisticasDeMuestra(id, usuario, new Date());
  if (!d) notFound();
  const { a, ventana, filas, totales, libro } = d;
  const t = statTotals(totales);
  const porObra = perWorkTotals(totales, a.works);
  const visitas = dailySeries(filas, ventana.from, ventana.to, (r) => r.metric === "VIEW");
  const escaneos = dailySeries(filas, ventana.from, ventana.to, (r) => r.metric === "SCAN" || r.metric === "GUESTBOOK_SCAN");
  const esMuestra = a.type === "MUESTRA";
  const fila = "flex justify-between border-b border-[var(--mf-line)] py-2";
  return (
    <main className="max-w-3xl space-y-10">
      <Link href="/panel/estadisticas" className="text-sm text-[var(--mf-muted)] underline underline-offset-[6px]">Volver a Estadísticas</Link>
      <h1 className="mf-titulo text-[clamp(2rem,4vw,2.8rem)]">{a.title}</h1>
      <dl className="border-t border-[var(--mf-line)] text-[15px]">
        <div className={fila}><dt>Visitas a la página de la muestra</dt><dd>{t.activityViews}</dd></div>
        {esMuestra ? <>
          <div className={fila}><dt>Visitas a las obras (incluye las que llegan por QR)</dt><dd>{t.workViews}</dd></div>
          <div className={fila}><dt>Escaneos de las fichas de sala</dt><dd>{t.workScans}</dd></div>
          <div className={fila}><dt>Escaneos del cartel y del catálogo</dt><dd>{t.activityScans}</dd></div>
          <div className={fila}><dt>Escaneos del afiche del libro de visitas</dt><dd>{t.guestbookScans}</dd></div>
          <div className={fila}><dt>Comentarios publicados en el libro</dt><dd><Link href={`/panel/estadisticas/${a.id}/libro`} className="underline underline-offset-[6px]">{libro.comentarios}{libro.pendientes ? ` (+${libro.pendientes} para revisar)` : ""}</Link></dd></div>
        </> : null}
      </dl>
      <GraficoDiario titulo="Visitas por día" serie={visitas} />
      {esMuestra ? <GraficoDiario titulo="Escaneos de QR por día" serie={escaneos} /> : null}
      {esMuestra && a.works.length ? (
        <section aria-labelledby="t-obras" className="space-y-3">
          <h2 id="t-obras" className="mf-titulo text-[1.5rem]">Por obra</h2>
          <table className="w-full text-left text-[15px]">
            <thead><tr className="border-b border-[var(--mf-line)] text-sm text-[var(--mf-muted)]"><th className="py-2 font-normal">Obra</th><th className="py-2 text-right font-normal">Visitas</th><th className="py-2 text-right font-normal">Escaneos</th></tr></thead>
            <tbody>
              {porObra.works.map((w) => <tr key={w.id} className="border-b border-[var(--mf-line)]"><td className="py-2">{w.title}</td><td className="py-2 text-right">{w.views}</td><td className="py-2 text-right">{w.scans}</td></tr>)}
              {porObra.removed.views + porObra.removed.scans > 0 ? <tr className="text-[var(--mf-muted)]"><td className="py-2">Obras que ya no están en la muestra</td><td className="py-2 text-right">{porObra.removed.views}</td><td className="py-2 text-right">{porObra.removed.scans}</td></tr> : null}
            </tbody>
          </table>
          <p className="text-sm text-[var(--mf-muted)]">
            Las fichas impresas antes de {DESDE_QR_CON_CONTEO} llevan el QR directo a la obra: sus escaneos cuentan como visitas a la obra, no como escaneos. Si querés separarlos, volvé a imprimir las fichas desde Montaje e impresión.
          </p>
        </section>
      ) : null}
      <p className="text-sm text-[var(--mf-muted)]">
        Contamos sin guardar datos de quien visita: ni IP, ni cookies, ni cuentas. No cuentan tus propias visitas ni las de robots. Los números son por día, en hora argentina.
      </p>
    </main>
  );
}
```
(Ajustar `DESDE_QR_CON_CONTEO` al mes real del deploy.)

`apps/muestras/app/privacidad/page.tsx`: antes de "Pedir la baja de tus datos", sumar:
```tsx
      <h2 className="pt-2 text-xl font-medium">Visitas y escaneos</h2>
      <p>Contamos cuántas veces se abre la página de cada muestra y de cada obra, y cuántas veces se escanean los códigos QR de la sala. Sólo guardamos totales por día: no guardamos tu IP, no usamos cookies y no sabemos quién sos.</p>
      <h2 className="pt-2 text-xl font-medium">Libro de visitas</h2>
      <p>Si dejás un comentario en el libro de visitas de una muestra, guardamos sólo lo que escribís: el comentario y, si los ponés, tu nombre y tu ciudad. Se publica en la página de la muestra y quien la organiza puede ocultarlo o borrarlo. No guardamos tu IP ni te pedimos cuenta.</p>
```

- [ ] **Step 6: Correr y ver que pasa**

Run: `pnpm --filter @repo/muestras test && pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/muestras/src/panel.ts packages/muestras/src/panel.test.ts apps/muestras/lib/panel/en-preparacion.ts apps/muestras/lib/estadisticas apps/muestras/app/panel/estadisticas apps/muestras/components/estadisticas apps/muestras/app/privacidad/page.tsx
git commit -m "Muestras: Estadísticas de visitas, escaneos y libro de visitas para quien organiza"
```

**Acceptance:** "Estadísticas" abre su página (ya no "En preparación"); sólo el dueño o el super admin ven los números; gráfico de 60 días en hora argentina; la página de privacidad explica qué se cuenta.

---
### Task 14: Verificación final, migración en producción y PR

**Files:**
- Modify: `docs/operations/muestras-puesta-en-marcha.md` (sección "Etapa 4")

- [ ] **Step 1: Todos los chequeos**

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter @repo/muestras lint && pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice typecheck && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras build`
Expected: todo en verde. Mirar que el build realmente terminó ("Compiled successfully" y la tabla de rutas con `/q/[tipo]/[id]`, `/api/visitas`, `/api/piezas/[id]/[pieza]`, `/m/[slug]/libro`, `/panel/montaje/[id]`, `/panel/estadisticas`, `/panel/estadisticas/[id]`, `/panel/estadisticas/[id]/libro`): si murió por memoria puede devolver éxito igual. `git diff origin/main -- pnpm-lock.yaml` vacío. `grep -rn "MONTAJE_EN_PREPARACION" apps/muestras` sin resultados.

- [ ] **Step 2: Aplicar la migración en producción — la hace el controlador (autorizado por Daniel)**

Daniel tiene que autorizar esta migración. Qué hace: suma cuatro columnas a `CulturalActivity` (optativas o con valor por defecto, sin reescribir la tabla) y crea dos tablas vacías; no modifica ni borra datos. Va **antes** de publicar el código: sin las columnas, todo el sitio de Muestras deja de andar. Si algo sale mal:
```sql
drop table "CulturalActivityGuestbookEntry", "CulturalActivityDailyStat";
alter table "CulturalActivity" drop column "curatorCredits", drop column "curatorialText", drop column "guestbookMode", drop column "hangingPlan";
```
(sólo si el código nuevo **no** está publicado).

1. Correr el contenido de `packages/db/prisma/migrations/20261029120000_muestras_etapa_4_sala/migration.sql` en la rama `development` (`br-old-rain-adwthzng`) del proyecto `divine-hall-10689679` (Neon MCP `run_sql_transaction`, una sentencia por elemento, sin los comentarios).
2. Verificar:
```sql
select table_name from information_schema.tables
where table_name in ('CulturalActivityDailyStat', 'CulturalActivityGuestbookEntry') order by table_name;
select column_name, data_type, column_default from information_schema.columns
where table_name = 'CulturalActivity' and column_name in ('curatorialText', 'curatorCredits', 'guestbookMode', 'hangingPlan') order by column_name;
select count(*) from "CulturalActivity" where "guestbookMode" <> 'PUBLISH';
```
Expected: las dos tablas; las cuatro columnas (`hangingPlan` como `jsonb`, `guestbookMode` con `'PUBLISH'::text`); y `0`.
3. Probar el contador con los mismos parámetros que manda la app, dentro de una transacción que se deshace:
```sql
begin;
insert into "CulturalActivityDailyStat" ("activityId", "workId", "day", "metric", "count")
  select id, '', '2000-01-01', 'VIEW', 1 from "CulturalActivity" limit 1
  on conflict ("activityId", "workId", "day", "metric") do update set "count" = "CulturalActivityDailyStat"."count" + 1;
insert into "CulturalActivityDailyStat" ("activityId", "workId", "day", "metric", "count")
  select id, '', '2000-01-01', 'VIEW', 1 from "CulturalActivity" limit 1
  on conflict ("activityId", "workId", "day", "metric") do update set "count" = "CulturalActivityDailyStat"."count" + 1;
select "count" from "CulturalActivityDailyStat" where "day" = '2000-01-01';
rollback;
```
Expected: `2`.
4. Registrar con el checksum del archivo:

Run: `shasum -a 256 packages/db/prisma/migrations/20261029120000_muestras_etapa_4_sala/migration.sql`
```sql
insert into "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
values (gen_random_uuid()::text, '<sha256 del paso anterior>', now(), '20261029120000_muestras_etapa_4_sala', null, null, now(), 1);
```
5. Confirmar: `select migration_name, checksum from "_prisma_migrations" where migration_name = '20261029120000_muestras_etapa_4_sala';` → una fila con el mismo checksum.

- [ ] **Step 3: Recorrido completo en local contra la base ya migrada**

Con `pnpm --filter muestras dev`, una muestra propia de prueba publicada y dos navegadores (uno con la sesión del organizador, otro en ventana privada):
1. Repetir los recorridos de las Tasks 6, 11 y 12.
2. Ventana privada: abrir `/m/<slug>` y una obra; en el panel (organizador), Estadísticas muestra 1 visita a la muestra y 1 a la obra. Recargar la misma pestaña no suma; el organizador mirando su propia página no suma.
3. Bajar las fichas nuevas; escanear un QR con el teléfono (en local apunta a `APP_URL`, que tiene que ser alcanzable desde el teléfono; si no, abrir `/q/o/<id>` a mano en la ventana privada): suma un escaneo y lleva a la obra. Una ficha vieja (`/m/<slug>/o/<id>`) sigue abriendo la obra.
4. `curl -A "WhatsApp/2.24" -I http://localhost:3014/q/o/<id>` redirige y no suma.
5. Barra del panel: Estadísticas abre su página; Ventas sigue "En preparación"; Montaje no muestra nada "en preparación".
6. A 375 px: `/panel/montaje/<id>` (el editor del plano en una columna), `/panel/estadisticas/<id>` (el gráfico ocupa el ancho), `/m/<slug>/libro`, sin scroll horizontal.
7. Imprimir en papel una ficha A6, un marco A4 y el afiche A4, y escanear los QR desde 1 metro.

- [ ] **Step 4: Guía de puesta en marcha**

Agregar al final de `docs/operations/muestras-puesta-en-marcha.md`:
```markdown
## Etapa 4 (la sala: piezas para imprimir, estadísticas y libro de visitas)

1. Aplicar la migración `20261029120000_muestras_etapa_4_sala` y registrarla con su SHA-256 (plan de la etapa 4, Task 14 Step 2). — Controlador, autorizado por Daniel. **Antes** del deploy: sin las columnas nuevas se cae todo el sitio de Muestras.
2. Fusionar el PR: Vercel publica `apps/muestras` (y recompila las apps que dependen de `packages/db`).
3. Verificar en producción: `/panel/montaje`, `/panel/estadisticas`, el libro de una muestra publicada (`/m/<slug>/libro`) y que un QR de ficha nueva (`/q/o/<id>`) redirige.
4. `APP_URL` en Vercel tiene que ser `https://muestrasfotograficas.com` (si no, las piezas usan ese dominio igual y avisan en el log).
5. Optativo, recomendado: regla de ciclo de vida en el bucket R2 de FOTOFFICE que borre `muestras/piezas/` a los 30 días (los PDF pesados se regeneran al pedirlos). — Controlador o Daniel.
6. Avisar a quienes organizan: las fichas impresas antes de hoy siguen andando, pero sus escaneos cuentan como visitas; para contar escaneos, reimprimirlas. — Daniel.
7. Confirmar el modo por defecto del libro de visitas (hoy: se publica al instante y el organizador oculta o borra). — Daniel.
```

- [ ] **Step 5: Commit y PR**

```bash
git add docs/operations/muestras-puesta-en-marcha.md
git commit -m "Guía de puesta en marcha de la Etapa 4 de Muestras"
git push -u origin feat/muestras-etapa-4
gh pr create --title "Muestras Fotográficas — Etapa 4: la sala" --body "<resumen en español: qué cambia para quien organiza (marcos, cartel, catálogo, plano, afiche, estadísticas, libro) y para el público (libro de visitas, texto curatorial); la migración ya aplicada; privacidad (sin IP ni cookies); fichas viejas cuentan como visitas; checklist del Step 3>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Cobertura del spec

| Spec | Task |
|---|---|
| D1 PDF con pdf-lib, diseños fijos | 5, 8, 9, 10 |
| D2 fotos guardadas, calidad por medida, "sólo el remarco" | 1, 5, 11 |
| D3 diagramación del marco, orientación automática | 1, 8 |
| D4 PDF pesados a R2 con huella, fecha fija | 5, 8, 11 |
| D5 texto curatorial y créditos en la ficha | 4, 6 |
| D6 cartel con letra que se ajusta | 1, 8 |
| D7 catálogo con todas las obras e índice de autores | 1, 9 |
| D8 plano en JSON sin FK, lectura tolerante | 2, 4, 10 |
| D9 centro a 150 cm, espaciado parejo, avisos | 2, 10 |
| D10 PDF del plano con tabla y lista de control | 10 |
| D11 plano y marcos en cualquier estado; QR sólo publicadas | 10, 11 |
| D12 QR con conteo `/q/<tipo>/<id>` | 3, 7 |
| D13 fichas viejas cuentan como visitas | 7, 13 |
| D14 baliza por pestaña | 7 |
| D15 privacidad: sin IP, robots, sin el organizador | 3, 5, 7, 13 |
| D16 tabla de contadores, día como texto, ON CONFLICT | 4, 7, 14 |
| D17 panel de estadísticas con gráfico de 60 días | 3, 13 |
| D18 libro sin cuenta, trampa, tiempo, frenos | 3, 5, 12 |
| D19 modos PUBLISH / REVIEW / OFF | 3, 4, 12 |
| D20 recibe hasta 15 días después; noindex; últimos 6 | 3, 12 |
| D21 panel: Estadísticas lista, Montaje sin "en preparación" | 11, 13 |
| D22 sin dependencias nuevas | todas |
| Migración a mano + checksum, antes del deploy | 4, 14 |
