# Muestras Fotográficas — Etapa 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar `muestrasfotograficas.com`: mapa nacional, listado, ficha con galería virtual, "Proponé tu muestra" con ingreso por Google, y la bandeja donde Daniel aprueba o rechaza.

**Architecture:** App Next.js nueva `apps/muestras` (copiada de la forma de `apps/subilafoto`) sobre la base de FOTOFFICE/FotoRank. Las reglas (estados, permisos, galería, cercanía, fechas) viven en un paquete puro `packages/muestras` sin React ni Prisma, testeado con vitest. La app hace de capa delgada: lee/escribe con `@repo/db`, sube imágenes al bucket R2 de FOTOFFICE y geocodifica con `@repo/geo/nominatim`.

**Tech Stack:** Next.js 16.2.1 (App Router, `params` como Promise, `--webpack`), React 19.2.4, Prisma (`@repo/db`), Tailwind 4, react-leaflet 5, sharp 0.34, vitest 3, Resend SDK 6.

**Spec:** `docs/superpowers/specs/2026-10-08-muestras-fotograficas-design.md`

## Global Constraints

- Todo texto visible y todo comentario en **español rioplatense**; identificadores de código en inglés en el paquete, como en el resto de los paquetes.
- Estados y tipos como **texto** (`String`), nunca enum de Prisma. Ids de usuario `Int` sin relación Prisma.
- Tipos: `MUESTRA | CHARLA | TALLER | SALIDA | LIBRO | PROYECCION | OTRA`.
- Revisión: `DRAFT | IN_REVIEW | APPROVED | REJECTED | UNPUBLISHED`; `isCancelled` aparte.
- Galería: máximo **40** obras, máximo **12** destacadas; modo `HIGHLIGHTS_UNTIL_CLOSED` (por defecto) o `FULL`.
- Fechas en **hora argentina (UTC−3, sin horario de verano)**: una fecha `AAAA-MM-DD` empieza a las 00:00 ART y termina 23:59:59.999 ART.
- Las imágenes se guardan achicadas: obras a 2000 px de lado mayor, portada a 1600 px, formato WebP calidad 82.
- **Dependencias nuevas sólo con versiones que ya estén en el lockfile** (`leaflet ^1.9.4`, `react-leaflet ^5.0.0`, `@types/leaflet ^1.9.21`, `sharp ^0.34.5`, `resend ^6.14.0`, `@aws-sdk/client-s3 ^3.972.0`, `vitest ^3.2.4`). Después de `pnpm install` correr `pnpm --filter fotoffice typecheck` para comprobar que no se movió nada ajeno.
- Correos apagados salvo `MUESTRAS_CORREOS_EN_VIVO === "true"` y `RESEND_API_KEY` presentes (mismo criterio de dos llaves que SubiLaFoto).
- Puerto de desarrollo: **3014**.
- Trabajar en el worktree `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-muestras` (rama propia, nunca en el checkout compartido).
- La migración **no se aplica sola**: se corre a mano en la base de FOTOFFICE/FotoRank **con permiso explícito de Daniel**.

## Mapa de archivos

```
packages/muestras/
  package.json, tsconfig.json, vitest.config.ts, eslint.config.js
  src/index.ts              — reexporta todo
  src/constants.ts          — tipos, estados, topes y etiquetas en español
  src/dates.ts              — fechas en hora argentina y estado temporal
  src/review.ts             — transiciones de revisión y permisos
  src/validation.ts         — qué falta para mandar a revisión
  src/gallery.ts            — topes y obras visibles
  src/nearby.ts             — orden por distancia y filtros
  src/slug.ts               — slugs
  src/*.test.ts
packages/db/prisma/schema.prisma                       — modelos CulturalActivity y CulturalActivityWork
packages/db/prisma/migrations/20261025120000_muestras_etapa_1/migration.sql
packages/auth-ui/src/brand/muestras.ts (+ index.ts, tokens.css)
apps/muestras/
  package.json, next.config.ts, tsconfig.json, eslint.config.mjs, postcss.config.mjs,
  vitest.config.ts, vercel.json, next-env.d.ts
  app/layout.tsx, app/globals.css, app/page.tsx (mapa + listado)
  app/m/[slug]/page.tsx (ficha)
  app/login/page.tsx
  app/proponer/page.tsx, app/mis-muestras/page.tsx, app/mis-muestras/[id]/page.tsx
  app/admin/page.tsx
  app/api/auth/google/route.ts, app/api/auth/google/callback/route.ts, app/api/auth/logout/route.ts
  app/api/geocode/route.ts, app/api/imagenes/route.ts
  lib/sesion.ts, lib/usuario.ts, lib/ruta-segura.ts, lib/google-app.ts
  lib/actividades/consultas.ts, lib/actividades/acciones.ts, lib/actividades/mapear.ts
  lib/imagenes/procesar.ts, lib/imagenes/r2.ts
  lib/geocode/limite.ts
  lib/correos/enviar.ts
  components/mapa/mapa-nacional.tsx, components/mapa/mapa-del-lugar.tsx
  components/ficha/galeria.tsx, components/ficha/estado.tsx
  components/formulario/formulario-actividad.tsx, components/formulario/obras.tsx,
  components/formulario/buscador-direccion.tsx, components/formulario/subir-imagen.ts
  public/leaflet/*.png
.github/workflows/chequeos.yml, turbo.json
```

---

### Task 1: Paquete `@repo/muestras` — constantes y fechas en hora argentina

**Files:**
- Create: `packages/muestras/package.json`, `packages/muestras/tsconfig.json`, `packages/muestras/vitest.config.ts`, `packages/muestras/eslint.config.js`
- Create: `packages/muestras/src/constants.ts`, `packages/muestras/src/dates.ts`, `packages/muestras/src/index.ts`
- Test: `packages/muestras/src/dates.test.ts`

**Interfaces:**
- Produces: `ACTIVITY_TYPES`, `ActivityType`, `ACTIVITY_TYPE_LABELS`, `REVIEW_STATUSES`, `ReviewStatus`, `GALLERY_MODES`, `GalleryMode`, `MAX_WORKS = 40`, `MAX_HIGHLIGHTS = 12`; `dayStartAr(day: string): Date`, `dayEndAr(day: string): Date`, `toArDay(d: Date): string`, `TemporalStatus = "UPCOMING" | "OPEN" | "CLOSED"`, `temporalStatus(a: {startsAt: Date; endsAt: Date}, now: Date): TemporalStatus`, `isLastDays(a: {endsAt: Date}, now: Date): boolean` (cierra dentro de 7 días y está abierta).

- [ ] **Step 1: Crear el andamio del paquete**

`packages/muestras/package.json`:
```json
{
  "name": "@repo/muestras",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "Reglas de Muestras Fotográficas (estados, permisos, galería, cercanía). Sin React/Next/Prisma.",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "check-types": "tsc --noEmit -p tsconfig.json",
    "lint": "eslint .",
    "test": "vitest run --config vitest.config.ts"
  },
  "dependencies": {
    "@repo/geo": "workspace:*"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/node": "^22.15.3",
    "eslint": "^9.39.1",
    "typescript": "5.9.2",
    "vitest": "^3.2.4"
  }
}
```

`packages/muestras/tsconfig.json`: copiar literal `packages/cuanto-cobro-core/tsconfig.json`.
`packages/muestras/vitest.config.ts`:
```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({ root, test: { environment: "node", include: ["src/**/*.test.ts"] } });
```
`packages/muestras/eslint.config.js`: copiar literal `packages/geo/eslint.config.js`.

- [ ] **Step 2: Escribir el test que falla**

`packages/muestras/src/dates.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { dayEndAr, dayStartAr, isLastDays, temporalStatus, toArDay } from "./dates";

describe("fechas en hora argentina", () => {
  it("el día empieza a las 00:00 ART (03:00 UTC)", () => {
    expect(dayStartAr("2026-11-05").toISOString()).toBe("2026-11-05T03:00:00.000Z");
  });

  it("el día termina a las 23:59:59.999 ART", () => {
    expect(dayEndAr("2026-11-05").toISOString()).toBe("2026-11-06T02:59:59.999Z");
  });

  it("rechaza un texto que no es AAAA-MM-DD", () => {
    expect(() => dayStartAr("5/11/2026")).toThrow("Fecha inválida");
  });

  it("toArDay devuelve el día argentino aunque en UTC ya sea el siguiente", () => {
    expect(toArDay(new Date("2026-11-06T01:00:00.000Z"))).toBe("2026-11-05");
  });
});

describe("estado temporal", () => {
  const a = { startsAt: dayStartAr("2026-11-05"), endsAt: dayEndAr("2026-11-20") };

  it("antes del inicio está próxima", () => {
    expect(temporalStatus(a, new Date("2026-11-05T02:59:59.000Z"))).toBe("UPCOMING");
  });
  it("el primer minuto del día de inicio está abierta", () => {
    expect(temporalStatus(a, new Date("2026-11-05T03:00:00.000Z"))).toBe("OPEN");
  });
  it("el último día a las 23:30 ART sigue abierta", () => {
    expect(temporalStatus(a, new Date("2026-11-21T02:30:00.000Z"))).toBe("OPEN");
  });
  it("después del cierre está cerrada", () => {
    expect(temporalStatus(a, new Date("2026-11-21T03:00:00.000Z"))).toBe("CLOSED");
  });
  it("últimos días: abierta y cierra dentro de 7 días", () => {
    expect(isLastDays(a, new Date("2026-11-15T15:00:00.000Z"))).toBe(true);
    expect(isLastDays(a, new Date("2026-11-10T15:00:00.000Z"))).toBe(false);
    expect(isLastDays(a, new Date("2026-11-22T15:00:00.000Z"))).toBe(false);
  });
});
```

- [ ] **Step 3: Correr y ver que falla**

Run: `pnpm install && pnpm --filter @repo/muestras test`
Expected: FAIL — `Failed to resolve import "./dates"`.

- [ ] **Step 4: Implementar**

`packages/muestras/src/constants.ts`:
```ts
/**
 * Vocabulario de Muestras Fotográficas.
 *
 * Todo va como texto y no como enum de Prisma: el schema lo comparten todas las apps de la
 * suite y un enum que falte en alguna base rompe sus escrituras (mismo criterio que `Raffle`).
 */
export const ACTIVITY_TYPES = ["MUESTRA", "CHARLA", "TALLER", "SALIDA", "LIBRO", "PROYECCION", "OTRA"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  MUESTRA: "Muestra",
  CHARLA: "Charla",
  TALLER: "Taller",
  SALIDA: "Salida fotográfica",
  LIBRO: "Presentación de libro",
  PROYECCION: "Proyección",
  OTRA: "Otra actividad",
};

export const REVIEW_STATUSES = ["DRAFT", "IN_REVIEW", "APPROVED", "REJECTED", "UNPUBLISHED"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  DRAFT: "Borrador",
  IN_REVIEW: "En revisión",
  APPROVED: "Publicada",
  REJECTED: "Rechazada",
  UNPUBLISHED: "Despublicada",
};

export const GALLERY_MODES = ["HIGHLIGHTS_UNTIL_CLOSED", "FULL"] as const;
export type GalleryMode = (typeof GALLERY_MODES)[number];

/** Tope de obras por muestra: alcanza para una muestra real y acota el almacenamiento. */
export const MAX_WORKS = 40;
/** Lo que se ve mientras la muestra está abierta, para no reemplazar la visita. */
export const MAX_HIGHLIGHTS = 12;
/** "Últimos días": cierra dentro de esta cantidad de días. */
export const LAST_DAYS_WINDOW = 7;

export function isActivityType(v: unknown): v is ActivityType {
  return typeof v === "string" && (ACTIVITY_TYPES as readonly string[]).includes(v);
}
export function isGalleryMode(v: unknown): v is GalleryMode {
  return typeof v === "string" && (GALLERY_MODES as readonly string[]).includes(v);
}
```

`packages/muestras/src/dates.ts`:
```ts
import { LAST_DAYS_WINDOW } from "./constants";

/**
 * Fechas en hora argentina.
 *
 * Argentina está en UTC−3 todo el año (sin horario de verano), así que el corrimiento es fijo.
 * Las columnas `DateTime` guardan UTC: un día argentino va de las 03:00 UTC de ese día a las
 * 02:59:59.999 UTC del siguiente.
 */
const OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDay(day: string): [number, number, number] {
  const m = DAY_RE.exec(day);
  if (!m) throw new Error(`Fecha inválida: ${day}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) throw new Error(`Fecha inválida: ${day}`);
  return [y, mo, d];
}

export function dayStartAr(day: string): Date {
  const [y, mo, d] = parseDay(day);
  return new Date(Date.UTC(y, mo - 1, d) + OFFSET_MS);
}

export function dayEndAr(day: string): Date {
  return new Date(dayStartAr(day).getTime() + DAY_MS - 1);
}

export function toArDay(date: Date): string {
  return new Date(date.getTime() - OFFSET_MS).toISOString().slice(0, 10);
}

export type TemporalStatus = "UPCOMING" | "OPEN" | "CLOSED";

/** Próxima / Abierta / Cerrada. No se guarda: se calcula siempre con la hora actual. */
export function temporalStatus(a: { startsAt: Date; endsAt: Date }, now: Date): TemporalStatus {
  if (now.getTime() < a.startsAt.getTime()) return "UPCOMING";
  if (now.getTime() > a.endsAt.getTime()) return "CLOSED";
  return "OPEN";
}

export function isLastDays(a: { startsAt?: Date; endsAt: Date }, now: Date): boolean {
  const remaining = a.endsAt.getTime() - now.getTime();
  if (remaining < 0) return false;
  if (a.startsAt && now.getTime() < a.startsAt.getTime()) return false;
  return remaining <= LAST_DAYS_WINDOW * DAY_MS;
}
```

`packages/muestras/src/index.ts`:
```ts
export * from "./constants";
export * from "./dates";
```

- [ ] **Step 5: Correr y ver que pasa**

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types`
Expected: PASS (9 tests), sin errores de tipos.

- [ ] **Step 6: Commit**

```bash
git add packages/muestras pnpm-lock.yaml
git commit -m "Crear el paquete de reglas de Muestras con fechas en hora argentina"
```

---

### Task 2: Revisión, permisos y validación para enviar

**Files:**
- Create: `packages/muestras/src/review.ts`, `packages/muestras/src/validation.ts`
- Modify: `packages/muestras/src/index.ts`
- Test: `packages/muestras/src/review.test.ts`, `packages/muestras/src/validation.test.ts`

**Interfaces:**
- Consumes: `ReviewStatus`, `isActivityType`, `MAX_WORKS`, `MAX_HIGHLIGHTS` (Task 1).
- Produces:
  - `ReviewAction = "submit" | "approve" | "reject" | "unpublish" | "republish" | "cancel" | "uncancel"`
  - `Actor = { userId: number; isSuperAdmin: boolean }`
  - `ActivityForReview = { reviewStatus: ReviewStatus; proposedByUserId: number; workspaceId: string | null; isCancelled: boolean }`
  - `canPerform(action: ReviewAction, activity: ActivityForReview, actor: Actor): { ok: true } | { ok: false; reason: string }`
  - `nextStatus(action: ReviewAction, current: ReviewStatus): ReviewStatus`
  - `canEdit(activity: ActivityForReview, actor: Actor): boolean`
  - `DraftInput` (ver código) y `missingForSubmission(d: DraftInput): string[]` (mensajes en español; vacío = lista para enviar).

- [ ] **Step 1: Escribir los tests que fallan**

`packages/muestras/src/review.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { canEdit, canPerform, nextStatus, type ActivityForReview } from "./review";

const owner = { userId: 7, isSuperAdmin: false };
const other = { userId: 8, isSuperAdmin: false };
const admin = { userId: 1, isSuperAdmin: true };
const base: ActivityForReview = { reviewStatus: "DRAFT", proposedByUserId: 7, workspaceId: null, isCancelled: false };
const st = (s: ActivityForReview["reviewStatus"], extra: Partial<ActivityForReview> = {}) => ({ ...base, reviewStatus: s, ...extra });

describe("transiciones", () => {
  it("borrador → en revisión al enviar", () => expect(nextStatus("submit", "DRAFT")).toBe("IN_REVIEW"));
  it("rechazada → en revisión al reenviar", () => expect(nextStatus("submit", "REJECTED")).toBe("IN_REVIEW"));
  it("en revisión → aprobada", () => expect(nextStatus("approve", "IN_REVIEW")).toBe("APPROVED"));
  it("en revisión → rechazada", () => expect(nextStatus("reject", "IN_REVIEW")).toBe("REJECTED"));
  it("aprobada → despublicada", () => expect(nextStatus("unpublish", "APPROVED")).toBe("UNPUBLISHED"));
  it("despublicada → aprobada al republicar", () => expect(nextStatus("republish", "UNPUBLISHED")).toBe("APPROVED"));
  it("cancelar no cambia el estado de revisión", () => expect(nextStatus("cancel", "APPROVED")).toBe("APPROVED"));
  it("una transición inválida tira error", () => expect(() => nextStatus("approve", "DRAFT")).toThrow());
});

describe("permisos (etapa 1: sólo el super admin revisa)", () => {
  it("quien propuso puede enviar su borrador", () => expect(canPerform("submit", st("DRAFT"), owner).ok).toBe(true));
  it("otro usuario no puede enviar un borrador ajeno", () => expect(canPerform("submit", st("DRAFT"), other).ok).toBe(false));
  it("el super admin aprueba", () => expect(canPerform("approve", st("IN_REVIEW"), admin).ok).toBe(true));
  it("quien propuso no puede aprobarse a sí mismo", () => expect(canPerform("approve", st("IN_REVIEW"), owner).ok).toBe(false));
  it("no se aprueba algo que no está en revisión", () => {
    const r = canPerform("approve", st("DRAFT"), admin);
    expect(r.ok).toBe(false);
  });
  it("sólo quien revisa despublica", () => {
    expect(canPerform("unpublish", st("APPROVED"), owner).ok).toBe(false);
    expect(canPerform("unpublish", st("APPROVED"), admin).ok).toBe(true);
  });
  it("quien propuso puede cancelar una aprobada; no dos veces", () => {
    expect(canPerform("cancel", st("APPROVED"), owner).ok).toBe(true);
    expect(canPerform("cancel", st("APPROVED", { isCancelled: true }), owner).ok).toBe(false);
  });
  it("no se cancela algo que no está publicado", () => expect(canPerform("cancel", st("DRAFT"), owner).ok).toBe(false));
});

describe("edición", () => {
  it("quien propuso edita en borrador, rechazada y aprobada", () => {
    expect(canEdit(st("DRAFT"), owner)).toBe(true);
    expect(canEdit(st("REJECTED"), owner)).toBe(true);
    expect(canEdit(st("APPROVED"), owner)).toBe(true);
  });
  it("no se edita mientras está en revisión ni despublicada", () => {
    expect(canEdit(st("IN_REVIEW"), owner)).toBe(false);
    expect(canEdit(st("UNPUBLISHED"), owner)).toBe(false);
  });
  it("el super admin edita siempre; un tercero nunca", () => {
    expect(canEdit(st("IN_REVIEW"), admin)).toBe(true);
    expect(canEdit(st("DRAFT"), other)).toBe(false);
  });
});
```

`packages/muestras/src/validation.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { missingForSubmission, type DraftInput } from "./validation";

const ok: DraftInput = {
  type: "MUESTRA",
  title: "Miradas del litoral",
  description: "Una muestra colectiva sobre el río.",
  coverImageUrl: "https://img/x.webp",
  organizersText: "Fotoclub Paraná",
  startDay: "2026-11-05",
  endDay: "2026-11-20",
  scheduleText: "Mar a dom de 16 a 20",
  isVirtualOnly: false,
  address: "Calle 1 123",
  latitude: -31.7,
  longitude: -60.5,
  rightsConfirmed: true,
  worksCount: 10,
  highlightsCount: 8,
};

describe("missingForSubmission", () => {
  it("una ficha completa no tiene faltantes", () => expect(missingForSubmission(ok)).toEqual([]));
  it("pide título, descripción, portada y organizadores", () => {
    const m = missingForSubmission({ ...ok, title: " ", description: "", coverImageUrl: null, organizersText: "" });
    expect(m).toEqual(expect.arrayContaining(["Falta el título.", "Falta la descripción.", "Falta la foto de portada.", "Faltan los organizadores."]));
  });
  it("el fin no puede ser antes del inicio", () => {
    expect(missingForSubmission({ ...ok, endDay: "2026-11-01" })).toContain("La fecha de cierre es anterior a la de inicio.");
  });
  it("una actividad presencial necesita punto en el mapa", () => {
    expect(missingForSubmission({ ...ok, latitude: null, longitude: null })).toContain("Falta ubicar el lugar en el mapa.");
  });
  it("una sólo virtual no necesita lugar", () => {
    expect(missingForSubmission({ ...ok, isVirtualOnly: true, address: null, latitude: null, longitude: null })).toEqual([]);
  });
  it("una muestra necesita al menos una obra y la confirmación de derechos", () => {
    const m = missingForSubmission({ ...ok, worksCount: 0, rightsConfirmed: false });
    expect(m).toContain("Una muestra necesita al menos una obra en la galería.");
    expect(m).toContain("Falta confirmar que tenés autorización de los autores.");
  });
  it("una charla no necesita obras", () => {
    expect(missingForSubmission({ ...ok, type: "CHARLA", worksCount: 0, highlightsCount: 0, rightsConfirmed: false })).toEqual([]);
  });
  it("respeta los topes de la galería", () => {
    const m = missingForSubmission({ ...ok, worksCount: 41, highlightsCount: 13 });
    expect(m).toContain("La galería admite hasta 40 obras.");
    expect(m).toContain("Podés destacar hasta 12 obras.");
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter @repo/muestras test`
Expected: FAIL — no se resuelven `./review` y `./validation`.

- [ ] **Step 3: Implementar**

`packages/muestras/src/review.ts`:
```ts
import type { ReviewStatus } from "./constants";

/**
 * Quién puede hacer qué con una actividad.
 *
 * Etapa 1: revisa sólo el super admin de la suite (Daniel). En la etapa 2 se suma la
 * institución del socio (`workspaceId`) como revisora de lo suyo; por eso el dato ya viaja.
 */
export type ReviewAction = "submit" | "approve" | "reject" | "unpublish" | "republish" | "cancel" | "uncancel";
export type Actor = { userId: number; isSuperAdmin: boolean };
export type ActivityForReview = {
  reviewStatus: ReviewStatus;
  proposedByUserId: number;
  workspaceId: string | null;
  isCancelled: boolean;
};
export type Permission = { ok: true } | { ok: false; reason: string };

const TRANSITIONS: Record<ReviewAction, Partial<Record<ReviewStatus, ReviewStatus>>> = {
  submit: { DRAFT: "IN_REVIEW", REJECTED: "IN_REVIEW" },
  approve: { IN_REVIEW: "APPROVED" },
  reject: { IN_REVIEW: "REJECTED" },
  unpublish: { APPROVED: "UNPUBLISHED" },
  republish: { UNPUBLISHED: "APPROVED" },
  cancel: { APPROVED: "APPROVED" },
  uncancel: { APPROVED: "APPROVED" },
};

export function nextStatus(action: ReviewAction, current: ReviewStatus): ReviewStatus {
  const next = TRANSITIONS[action][current];
  if (!next) throw new Error(`No se puede "${action}" una actividad en estado ${current}.`);
  return next;
}

function isReviewer(_a: ActivityForReview, actor: Actor): boolean {
  return actor.isSuperAdmin;
}
function isOwner(a: ActivityForReview, actor: Actor): boolean {
  return a.proposedByUserId === actor.userId;
}

export function canPerform(action: ReviewAction, a: ActivityForReview, actor: Actor): Permission {
  if (!TRANSITIONS[action][a.reviewStatus]) {
    return { ok: false, reason: "La actividad no está en un estado que permita esta acción." };
  }
  switch (action) {
    case "submit":
      return isOwner(a, actor) || isReviewer(a, actor) ? { ok: true } : { ok: false, reason: "Sólo quien la propuso puede enviarla." };
    case "approve":
    case "reject":
    case "unpublish":
    case "republish":
      return isReviewer(a, actor) ? { ok: true } : { ok: false, reason: "No tenés permiso para revisar esta actividad." };
    case "cancel":
      if (a.isCancelled) return { ok: false, reason: "Ya está cancelada." };
      return isOwner(a, actor) || isReviewer(a, actor) ? { ok: true } : { ok: false, reason: "No podés cancelar esta actividad." };
    case "uncancel":
      if (!a.isCancelled) return { ok: false, reason: "No está cancelada." };
      return isOwner(a, actor) || isReviewer(a, actor) ? { ok: true } : { ok: false, reason: "No podés reactivar esta actividad." };
  }
}

/** Se edita en borrador, rechazada y publicada (sin volver a revisión). No en revisión. */
export function canEdit(a: ActivityForReview, actor: Actor): boolean {
  if (isReviewer(a, actor)) return true;
  if (!isOwner(a, actor)) return false;
  return a.reviewStatus === "DRAFT" || a.reviewStatus === "REJECTED" || a.reviewStatus === "APPROVED";
}
```

`packages/muestras/src/validation.ts`:
```ts
import { MAX_HIGHLIGHTS, MAX_WORKS, isActivityType, type ActivityType } from "./constants";

export type DraftInput = {
  type: ActivityType | string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  organizersText: string;
  startDay: string;
  endDay: string;
  scheduleText: string | null;
  isVirtualOnly: boolean;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rightsConfirmed: boolean;
  worksCount: number;
  highlightsCount: number;
};

const blank = (s: string | null | undefined) => !s || s.trim() === "";

/** Lo que falta para poder mandar a revisión. Lista vacía = lista para enviar. */
export function missingForSubmission(d: DraftInput): string[] {
  const out: string[] = [];
  if (!isActivityType(d.type)) out.push("Elegí el tipo de actividad.");
  if (blank(d.title)) out.push("Falta el título.");
  if (blank(d.description)) out.push("Falta la descripción.");
  if (blank(d.coverImageUrl)) out.push("Falta la foto de portada.");
  if (blank(d.organizersText)) out.push("Faltan los organizadores.");
  if (blank(d.startDay) || blank(d.endDay)) out.push("Faltan las fechas.");
  else if (d.endDay < d.startDay) out.push("La fecha de cierre es anterior a la de inicio.");
  if (blank(d.scheduleText)) out.push("Faltan los horarios.");
  if (!d.isVirtualOnly) {
    if (blank(d.address)) out.push("Falta la dirección.");
    if (d.latitude == null || d.longitude == null) out.push("Falta ubicar el lugar en el mapa.");
  }
  if (d.type === "MUESTRA") {
    if (d.worksCount < 1) out.push("Una muestra necesita al menos una obra en la galería.");
    if (!d.rightsConfirmed) out.push("Falta confirmar que tenés autorización de los autores.");
  }
  if (d.worksCount > MAX_WORKS) out.push(`La galería admite hasta ${MAX_WORKS} obras.`);
  if (d.highlightsCount > MAX_HIGHLIGHTS) out.push(`Podés destacar hasta ${MAX_HIGHLIGHTS} obras.`);
  return out;
}
```

Agregar a `packages/muestras/src/index.ts`:
```ts
export * from "./review";
export * from "./validation";
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/muestras
git commit -m "Reglas de revisión, permisos y faltantes para enviar una muestra"
```

---

### Task 3: Galería visible, cercanía y slugs

**Files:**
- Create: `packages/muestras/src/gallery.ts`, `packages/muestras/src/nearby.ts`, `packages/muestras/src/slug.ts`
- Modify: `packages/muestras/src/index.ts`
- Test: `packages/muestras/src/gallery.test.ts`, `packages/muestras/src/nearby.test.ts`, `packages/muestras/src/slug.test.ts`

**Interfaces:**
- Consumes: `temporalStatus`, `GalleryMode`, `ActivityType` (Task 1); `distanceKm` de `@repo/geo`.
- Produces:
  - `visibleWorks<W extends { isHighlight: boolean; sortOrder: number }>(a: { galleryMode: GalleryMode; startsAt: Date; endsAt: Date }, works: W[], now: Date): { works: W[]; isPartial: boolean }`
  - `withDistance<A extends { latitude: number | null; longitude: number | null }>(origin: { latitude: number; longitude: number }, items: A[]): (A & { distanceKm: number | null })[]` — ordenado por distancia, los sin coordenadas al final.
  - `PublicFilter = { province?: string; type?: ActivityType; openNow?: boolean; includeClosed?: boolean }` y `applyFilter<A extends { province: string | null; type: string; startsAt: Date; endsAt: Date }>(items: A[], f: PublicFilter, now: Date): A[]`
  - `slugify(title: string): string`, `newSlug(title: string, random?: () => string): string`

- [ ] **Step 1: Escribir los tests que fallan**

`packages/muestras/src/gallery.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { visibleWorks } from "./gallery";
import { dayEndAr, dayStartAr } from "./dates";

const works = [
  { id: "a", isHighlight: false, sortOrder: 2 },
  { id: "b", isHighlight: true, sortOrder: 1 },
  { id: "c", isHighlight: true, sortOrder: 0 },
];
const fechas = { startsAt: dayStartAr("2026-11-05"), endsAt: dayEndAr("2026-11-20") };
const abierta = new Date("2026-11-10T15:00:00Z");
const cerrada = new Date("2026-12-01T15:00:00Z");

describe("visibleWorks", () => {
  it("abierta en modo destacadas: sólo destacadas, ordenadas", () => {
    const r = visibleWorks({ ...fechas, galleryMode: "HIGHLIGHTS_UNTIL_CLOSED" }, works, abierta);
    expect(r.works.map((w) => w.id)).toEqual(["c", "b"]);
    expect(r.isPartial).toBe(true);
  });
  it("cerrada: todas", () => {
    const r = visibleWorks({ ...fechas, galleryMode: "HIGHLIGHTS_UNTIL_CLOSED" }, works, cerrada);
    expect(r.works.map((w) => w.id)).toEqual(["c", "b", "a"]);
    expect(r.isPartial).toBe(false);
  });
  it("modo completa: todas aunque esté abierta", () => {
    expect(visibleWorks({ ...fechas, galleryMode: "FULL" }, works, abierta).works).toHaveLength(3);
  });
  it("sin destacadas marcadas, muestra las primeras 12", () => {
    const muchas = Array.from({ length: 20 }, (_, i) => ({ id: String(i), isHighlight: false, sortOrder: i }));
    const r = visibleWorks({ ...fechas, galleryMode: "HIGHLIGHTS_UNTIL_CLOSED" }, muchas, abierta);
    expect(r.works).toHaveLength(12);
    expect(r.isPartial).toBe(true);
  });
});
```

`packages/muestras/src/nearby.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { applyFilter, withDistance } from "./nearby";
import { dayEndAr, dayStartAr } from "./dates";

const rosario = { latitude: -32.9468, longitude: -60.6393 };

describe("withDistance", () => {
  it("ordena por distancia y deja las virtuales al final", () => {
    const r = withDistance(rosario, [
      { id: "cba", latitude: -31.4201, longitude: -64.1888 },
      { id: "virtual", latitude: null, longitude: null },
      { id: "parana", latitude: -31.7413, longitude: -60.5115 },
    ]);
    expect(r.map((x) => x.id)).toEqual(["parana", "cba", "virtual"]);
    expect(r[0]!.distanceKm).toBeGreaterThan(100);
    expect(r[0]!.distanceKm).toBeLessThan(160);
    expect(r[2]!.distanceKm).toBeNull();
  });
});

describe("applyFilter", () => {
  const now = new Date("2026-11-10T15:00:00Z");
  const items = [
    { id: "abierta", province: "Santa Fe", type: "MUESTRA", startsAt: dayStartAr("2026-11-01"), endsAt: dayEndAr("2026-11-30") },
    { id: "proxima", province: "Córdoba", type: "TALLER", startsAt: dayStartAr("2026-12-01"), endsAt: dayEndAr("2026-12-01") },
    { id: "cerrada", province: "Santa Fe", type: "MUESTRA", startsAt: dayStartAr("2026-10-01"), endsAt: dayEndAr("2026-10-20") },
  ];
  it("por defecto oculta las cerradas", () => expect(applyFilter(items, {}, now).map((x) => x.id)).toEqual(["abierta", "proxima"]));
  it("incluye cerradas si se pide (archivo)", () => expect(applyFilter(items, { includeClosed: true }, now)).toHaveLength(3));
  it("filtra por provincia sin importar mayúsculas ni tildes", () => expect(applyFilter(items, { province: "cordoba" }, now).map((x) => x.id)).toEqual(["proxima"]));
  it("filtra por tipo", () => expect(applyFilter(items, { type: "TALLER" }, now).map((x) => x.id)).toEqual(["proxima"]));
  it("abiertas ahora", () => expect(applyFilter(items, { openNow: true }, now).map((x) => x.id)).toEqual(["abierta"]));
});
```

`packages/muestras/src/slug.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { newSlug, slugify } from "./slug";

describe("slug", () => {
  it("saca tildes, signos y espacios", () => expect(slugify("  Miradas del Litoral: ¡Año 2026! ")).toBe("miradas-del-litoral-ano-2026"));
  it("corta en 60 caracteres sin guión al final", () => {
    const s = slugify("a ".repeat(80));
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith("-")).toBe(false);
  });
  it("un título sin letras usa 'actividad'", () => expect(slugify("¡¡¡")).toBe("actividad"));
  it("newSlug agrega un sufijo para no chocar", () => expect(newSlug("Mi muestra", () => "x7k2q9")).toBe("mi-muestra-x7k2q9"));
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter @repo/muestras test`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Implementar**

`packages/muestras/src/gallery.ts`:
```ts
import { MAX_HIGHLIGHTS, type GalleryMode } from "./constants";
import { temporalStatus } from "./dates";

/**
 * Qué obras ve el público.
 *
 * Mientras la muestra está próxima o abierta se ven sólo las destacadas, para que la galería
 * invite a ir y no reemplace la visita. Al cerrar se ve completa y queda como archivo.
 */
export function visibleWorks<W extends { isHighlight: boolean; sortOrder: number }>(
  a: { galleryMode: GalleryMode | string; startsAt: Date; endsAt: Date },
  works: W[],
  now: Date,
): { works: W[]; isPartial: boolean } {
  const ordered = [...works].sort((x, y) => x.sortOrder - y.sortOrder);
  if (a.galleryMode === "FULL" || temporalStatus(a, now) === "CLOSED") return { works: ordered, isPartial: false };
  const highlights = ordered.filter((w) => w.isHighlight);
  const shown = (highlights.length > 0 ? highlights : ordered).slice(0, MAX_HIGHLIGHTS);
  return { works: shown, isPartial: shown.length < ordered.length };
}
```

`packages/muestras/src/nearby.ts`:
```ts
import { distanceKm } from "@repo/geo";
import type { ActivityType } from "./constants";
import { temporalStatus } from "./dates";

type Coords = { latitude: number; longitude: number };

export function withDistance<A extends { latitude: number | null; longitude: number | null }>(
  origin: Coords,
  items: A[],
): (A & { distanceKm: number | null })[] {
  return items
    .map((a) => ({
      ...a,
      distanceKm:
        a.latitude == null || a.longitude == null
          ? null
          : Math.round(distanceKm(origin, { latitude: a.latitude, longitude: a.longitude }) * 10) / 10,
    }))
    .sort((x, y) => (x.distanceKm ?? Infinity) - (y.distanceKm ?? Infinity));
}

export type PublicFilter = { province?: string; type?: ActivityType; openNow?: boolean; includeClosed?: boolean };

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export function applyFilter<A extends { province: string | null; type: string; startsAt: Date; endsAt: Date }>(
  items: A[],
  f: PublicFilter,
  now: Date,
): A[] {
  return items.filter((a) => {
    const t = temporalStatus(a, now);
    if (!f.includeClosed && t === "CLOSED") return false;
    if (f.openNow && t !== "OPEN") return false;
    if (f.type && a.type !== f.type) return false;
    if (f.province && fold(a.province ?? "") !== fold(f.province)) return false;
    return true;
  });
}
```

`packages/muestras/src/slug.ts`:
```ts
export function slugify(title: string): string {
  const s = title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s || "actividad";
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8).padEnd(6, "0");
}

/** El sufijo evita choques entre dos muestras con el mismo título (itinerantes, ediciones). */
export function newSlug(title: string, random: () => string = randomSuffix): string {
  return `${slugify(title)}-${random()}`;
}
```

Agregar a `packages/muestras/src/index.ts`:
```ts
export * from "./gallery";
export * from "./nearby";
export * from "./slug";
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/muestras
git commit -m "Galería visible, orden por cercanía y slugs de Muestras"
```

---

### Task 4: Tablas en el schema y migración escrita a mano

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (agregar al final del archivo)
- Create: `packages/db/prisma/migrations/20261025120000_muestras_etapa_1/migration.sql`

**Interfaces:**
- Produces: modelos Prisma `CulturalActivity` y `CulturalActivityWork` (campos exactos abajo); `prisma.culturalActivity`, `prisma.culturalActivityWork`.

- [ ] **Step 1: Agregar los modelos**

Al final de `packages/db/prisma/schema.prisma`:
```prisma
/// Una actividad cultural de Muestras Fotográficas (muestrasfotograficas.com): muestra,
/// charla, taller, salida, presentación de libro, proyección u otra.
///
/// Estados y tipos van como texto y no como enum: las apps de la suite comparten este archivo
/// y un enum que falte en alguna base rompe sus escrituras (mismo criterio que `Raffle`).
/// Las reglas viven en `packages/muestras`.
model CulturalActivity {
  id   String @id @default(cuid())
  slug String @unique

  /// MUESTRA | CHARLA | TALLER | SALIDA | LIBRO | PROYECCION | OTRA
  type           String
  title          String
  description    String
  coverImageUrl  String?
  /// Organizadores en texto libre. Los vínculos a cuentas llegan en la etapa 2.
  organizersText String

  /// Inicio del primer día, en UTC (00:00 hora argentina).
  startsAt     DateTime
  /// Fin del último día, en UTC (23:59:59.999 hora argentina).
  endsAt       DateTime
  openingAt    DateTime?
  scheduleText String?
  /// Vacío = entrada libre.
  priceText    String?
  externalUrl  String?

  isVirtualOnly Boolean @default(false)
  venueName     String?
  address       String?
  city          String?
  province      String?
  latitude      Float?
  longitude     Float?
  geohash       String?

  /// Institución de FOTOFFICE si la propuso un socio (etapa 2). Sin relación a propósito.
  workspaceId      String?
  proposedByUserId Int

  /// DRAFT | IN_REVIEW | APPROVED | REJECTED | UNPUBLISHED
  reviewStatus     String    @default("DRAFT")
  rejectionReason  String?
  submittedAt      DateTime?
  reviewedByUserId Int?
  reviewedAt       DateTime?
  isCancelled      Boolean   @default(false)

  /// HIGHLIGHTS_UNTIL_CLOSED | FULL
  galleryMode       String    @default("HIGHLIGHTS_UNTIL_CLOSED")
  rightsConfirmedAt DateTime?

  /// Entrada del blog de su institución (etapa 2).
  blogPostId       Int?
  /// Sedes de una misma muestra itinerante comparten este valor.
  itinerantGroupId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  works CulturalActivityWork[]

  @@index([reviewStatus, endsAt])
  @@index([proposedByUserId])
  @@index([workspaceId])
  @@index([geohash])
}

/// Una obra de la galería virtual de una muestra. Tope: 40 por muestra, 12 destacadas.
model CulturalActivityWork {
  id         String           @id @default(cuid())
  activityId String
  activity   CulturalActivity @relation(fields: [activityId], references: [id], onDelete: Cascade)

  imageUrl     String
  title        String
  authorName   String
  authorUserId Int?
  year         Int?
  technique    String?
  isHighlight  Boolean @default(false)
  sortOrder    Int     @default(0)

  createdAt DateTime @default(now())

  @@index([activityId, sortOrder])
}
```

- [ ] **Step 2: Validar y generar el cliente**

Run: `pnpm --filter @repo/db exec prisma validate && pnpm --filter @repo/db exec prisma generate`
Expected: `The schema at ... is valid` y el cliente generado sin errores.

- [ ] **Step 3: Escribir la migración**

Generar el SQL con diff contra el schema anterior y revisarlo a mano:

Run: `git show origin/main:packages/db/prisma/schema.prisma > /tmp/schema-antes.prisma && pnpm --filter @repo/db exec prisma migrate diff --from-schema-datamodel /tmp/schema-antes.prisma --to-schema-datamodel prisma/schema.prisma --script`
Expected: sólo `CREATE TABLE "CulturalActivity"`, `CREATE TABLE "CulturalActivityWork"`, sus índices y la FK. Si aparece cualquier otra cosa, frenar y avisar.

`packages/db/prisma/migrations/20261025120000_muestras_etapa_1/migration.sql` — encabezado + el SQL generado:
```sql
-- Muestras Fotográficas · Etapa 1: actividades culturales y su galería.
-- Crea dos tablas nuevas (`CulturalActivity` y `CulturalActivityWork`). No toca tablas existentes,
-- no borra ni actualiza filas.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano en la base de FOTOFFICE/FotoRank
-- (Neon `divine-hall-10689679`, rama `development`) con permiso de Daniel, y se registra con
-- `prisma migrate resolve --applied 20261025120000_muestras_etapa_1`.
-- Las otras bases no la necesitan: ninguna otra app consulta estas tablas.

-- (pegar acá el SQL que devolvió `prisma migrate diff`)
```

- [ ] **Step 4: Comprobar que el resto de la suite compila con el cliente nuevo**

Run: `pnpm --filter fotoffice typecheck`
Expected: sin errores (los modelos nuevos no cambian tipos existentes).

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20261025120000_muestras_etapa_1
git commit -m "Tablas de actividades culturales y su galería (sin aplicar)"
```

- [ ] **Step 6: Aplicar en producción — SÓLO con permiso explícito de Daniel**

Pedir permiso explicando: "Voy a crear dos tablas nuevas en la base de FOTOFFICE/FotoRank. No modifica ni borra datos existentes; si algo sale mal se pueden borrar las dos tablas." Con el sí:
1. Correr el SQL en la rama `br-old-rain-adwthzng` del proyecto `divine-hall-10689679` (Neon MCP `run_sql_transaction`).
2. Verificar: `select count(*) from information_schema.tables where table_name in ('CulturalActivity','CulturalActivityWork')` → `2`.
3. Registrar: `DATABASE_URL=<url de esa rama> pnpm --filter @repo/db exec prisma migrate resolve --applied 20261025120000_muestras_etapa_1`.

---
### Task 5: Andamio de `apps/muestras`, marca de login y CI

**Files:**
- Create: `apps/muestras/package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `vitest.config.ts`, `vercel.json`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx` (provisoria), `public/leaflet/*.png`
- Create: `packages/auth-ui/src/brand/muestras.ts`
- Modify: `packages/auth-ui/src/brand/index.ts` (export + mapa `BRANDS`), `packages/auth-ui/src/tokens.css` (bloque `[data-brand="muestras"]`)
- Modify: `.github/workflows/chequeos.yml`, `turbo.json` (`globalEnv`)

**Interfaces:**
- Produces: app `muestras` con scripts `dev` (puerto 3014), `build`, `check-types`, `test`; `muestrasAuthBrand` exportado desde `@repo/auth-ui`.

- [ ] **Step 1: Copiar el andamio de SubiLaFoto**

```bash
mkdir -p apps/muestras/app apps/muestras/lib apps/muestras/components apps/muestras/public/leaflet
cp apps/subilafoto/{tsconfig.json,eslint.config.mjs,postcss.config.mjs,next.config.ts} apps/muestras/
cp apps/fotoffice/public/leaflet/*.png apps/muestras/public/leaflet/
```

En `apps/muestras/next.config.ts` reemplazar `transpilePackages: ["@repo/payments"]` por:
```ts
  transpilePackages: ["@repo/muestras", "@repo/geo", "@repo/auth-ui"],
```
y actualizar el comentario de `extensionAlias` a "`@repo/geo` usa imports ESM con extensión .js apuntando a fuentes .ts" (si `@repo/geo` no usa `.js`, borrar el bloque `webpack` entero y su comentario).

`apps/muestras/package.json`:
```json
{
  "name": "muestras",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --webpack --port 3014",
    "build": "next build --webpack",
    "start": "next start",
    "lint": "eslint",
    "check-types": "tsc --noEmit",
    "test": "vitest run --config vitest.config.ts"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.972.0",
    "@repo/auth": "workspace:*",
    "@repo/auth-ui": "workspace:*",
    "@repo/db": "workspace:*",
    "@repo/geo": "workspace:*",
    "@repo/muestras": "workspace:*",
    "leaflet": "^1.9.4",
    "next": "16.2.1",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "react-leaflet": "^5.0.0",
    "resend": "^6.14.0",
    "sharp": "^0.34.5"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/leaflet": "^1.9.21",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.1",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^3.2.4"
  }
}
```

`apps/muestras/vitest.config.ts`:
```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { "@": root } },
  test: { environment: "node", include: ["lib/**/*.test.ts"] },
});
```

`apps/muestras/vercel.json` — compila **sólo** si cambió algo de la app o sus paquetes, también en producción:
```json
{
  "installCommand": "cd ../.. && pnpm install",
  "buildCommand": "cd ../.. && pnpm --filter muestras build",
  "framework": "nextjs",
  "ignoreCommand": "cd ../.. && npx turbo-ignore muestras --fallback=HEAD^1"
}
```

- [ ] **Step 2: Layout, estilos y portada provisoria**

`apps/muestras/app/globals.css`:
```css
@import "tailwindcss";

:root {
  --mf-bg: #f6f4ef;
  --mf-surface: #ffffff;
  --mf-ink: #1b1a17;
  --mf-muted: #6b665c;
  --mf-line: #e2ddd2;
  --mf-accent: #b4432c;
  --mf-accent-ink: #ffffff;
}

body {
  background: var(--mf-bg);
  color: var(--mf-ink);
  font-family: var(--mf-font), system-ui, sans-serif;
}
```

`apps/muestras/app/layout.tsx`:
```tsx
import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const texto = Inter({ subsets: ["latin"], variable: "--mf-font" });
const titulos = Fraunces({ subsets: ["latin"], variable: "--mf-serif" });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://muestrasfotograficas.com";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: "Muestras Fotográficas", template: "%s · Muestras Fotográficas" },
  description: "El mapa de las muestras y actividades de fotografía de todo el país.",
  openGraph: { siteName: "Muestras Fotográficas", locale: "es_AR", type: "website" },
};

export const viewport: Viewport = { themeColor: "#f6f4ef" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${texto.variable} ${titulos.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
```

`apps/muestras/app/page.tsx` (provisoria; se reemplaza en la Task 10):
```tsx
export default function Inicio() {
  return <main className="p-6"><h1 className="text-2xl">Muestras Fotográficas</h1></main>;
}
```

- [ ] **Step 3: Marca para el login compartido**

`packages/auth-ui/src/brand/muestras.ts`:
```ts
import type { DnxAuthBrandConfig } from "../types";

/**
 * Muestras Fotográficas. Entra sólo con Google, como SubiLaFoto: el socio de FOTOFFICE usa
 * el mismo Google y queda como el mismo usuario, porque la tabla `User` es la misma.
 */
export const muestrasAuthBrand: DnxAuthBrandConfig = {
  applicationId: "muestras",
  productName: "Muestras Fotográficas",
  logo: { src: "/brand/muestras-logo.svg", alt: "Muestras Fotográficas", height: "4rem", href: "/" },
  tokens: { brandKey: "muestras", fontFamily: "var(--mf-font), system-ui, sans-serif" },
  privacyUrl: "/privacidad",
  termsUrl: "/terminos",
  allowEmailLogin: false,
  allowEmailRegistration: false,
  allowGoogle: true,
  allowPasswordReset: false,
  contextualCopy: {
    loginTitle: "Entrá para proponer tu muestra",
    loginDescription: "Si sos socio de una institución en FOTOFFICE, usá el mismo Google.",
  },
};
```

En `packages/auth-ui/src/brand/index.ts` agregar `import { muestrasAuthBrand } from "./muestras";`, sumarlo al bloque `export { … }` y al mapa `BRANDS` como `muestras: muestrasAuthBrand,` (mismo lugar donde está `subilafoto`). Si `BRANDS` tiene un tipo de clave cerrado (union), agregar `"muestras"` al union.

En `packages/auth-ui/src/tokens.css`, después del bloque de `subilafoto`:
```css
/* Muestras Fotográficas. Papel claro y un rojo óxido como único acento. */
.dnx-auth-root[data-brand="muestras"] {
  --auth-background: #f6f4ef;
  --auth-surface: #ffffff;
  --auth-text-primary: #1b1a17;
  --auth-text-secondary: #6b665c;
  --auth-border: #e2ddd2;
  --auth-secondary-border: #8a8478;
  --auth-primary: #b4432c;
  --auth-primary-text: #ffffff;
  --auth-focus: #b4432c;
  --auth-error: #a1251b;
  --auth-error-bg: rgba(161, 37, 27, 0.08);
}
```

Crear `apps/muestras/public/brand/muestras-logo.svg` con un logotipo tipográfico simple:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 64"><text x="0" y="44" font-family="Georgia, serif" font-size="34" fill="#1b1a17">Muestras <tspan fill="#b4432c">Fotográficas</tspan></text></svg>
```

- [ ] **Step 4: CI y variables**

En `.github/workflows/chequeos.yml`, después del paso "Pruebas de FOTOFFICE", agregar:
```yaml
      - name: Pruebas de las reglas de Muestras
        run: pnpm --filter @repo/muestras test

      - name: Chequear tipos de Muestras
        run: pnpm --filter muestras check-types

      - name: Pruebas de Muestras
        run: pnpm --filter muestras test
```
En `turbo.json` → `globalEnv`, agregar `"MUESTRAS_CORREOS_EN_VIVO"` y `"MUESTRAS_EMAIL_FROM"`.

- [ ] **Step 5: Instalar y verificar que todo compila**

Run: `pnpm install && pnpm --filter muestras check-types && pnpm --filter fotoffice typecheck && git diff --stat pnpm-lock.yaml`
Expected: sin errores; el lockfile sólo suma las entradas de `apps/muestras` y `packages/muestras` (ninguna versión de otra app cambia). Si cambió alguna versión ajena, frenar y avisar.

Run: `pnpm --filter muestras dev` y abrir `http://localhost:3014`
Expected: se ve "Muestras Fotográficas".

- [ ] **Step 6: Commit**

```bash
git add apps/muestras packages/auth-ui .github/workflows/chequeos.yml turbo.json pnpm-lock.yaml
git commit -m "Crear la app de Muestras Fotográficas con su marca de ingreso"
```

---

### Task 6: Ingreso con Google y sesión

**Files:**
- Create: `apps/muestras/lib/ruta-segura.ts`, `lib/sesion.ts`, `lib/google-app.ts`, `lib/usuario.ts`
- Create: `apps/muestras/app/api/auth/google/route.ts`, `app/api/auth/google/callback/route.ts`, `app/api/auth/logout/route.ts`, `app/login/page.tsx`
- Test: `apps/muestras/lib/ruta-segura.test.ts`

**Interfaces:**
- Produces:
  - `rutaInternaSegura(raw: string | null | undefined): string | undefined`
  - `adjuntarSesion(res: NextResponse, userId: number, opts?: { recordarme?: boolean }): Promise<void>`, `cerrarSesion(): Promise<void>`, `OPCIONES_COOKIE`
  - `type Usuario = { id: number; email: string; name: string | null; esSuperAdmin: boolean }`
  - `getUsuario(): Promise<Usuario | null>`, `requireUsuario(siguiente: string): Promise<Usuario>` (redirige a `/login?next=`), `requireSuperAdmin(): Promise<Usuario>` (redirige a `/` si no lo es)

- [ ] **Step 1: Copiar los archivos de SubiLaFoto**

```bash
cp apps/subilafoto/lib/ruta-segura.ts apps/subilafoto/lib/sesion.ts apps/muestras/lib/
mkdir -p apps/muestras/app/api/auth/google/callback apps/muestras/app/api/auth/logout apps/muestras/app/login
cp apps/subilafoto/app/api/auth/google/route.ts apps/muestras/app/api/auth/google/route.ts
cp apps/subilafoto/app/api/auth/google/callback/route.ts apps/muestras/app/api/auth/google/callback/route.ts
cp apps/subilafoto/app/api/auth/logout/route.ts apps/muestras/app/api/auth/logout/route.ts
```

Cambios en los copiados:
- `apps/muestras/lib/ruta-segura.ts`: en el comentario, `subilafoto.com` → `muestrasfotograficas.com`.
- Las dos rutas de Google: `fallback: "http://localhost:3012"` → `"http://localhost:3014"`; los `console.*` `[subilafoto]` → `[muestras]`.
- Callback: `const destino = transito.next ?? "/panel";` → `?? "/mis-muestras"`.

`apps/muestras/lib/google-app.ts`:
```ts
/** Identificador de esta app en el transporte OAuth compartido. Archivo propio: un `route.ts` sólo puede exportar nombres de Next. */
export const APP_OAUTH = "muestras";
```

Si `createGoogleOAuthTransit` / `parseAndVerifyGoogleOAuthTransit` validan `app` contra una lista cerrada en `packages/auth`, agregar `"muestras"` a esa lista (buscar con `grep -rn '"subilafoto"' packages/auth/src`).

- [ ] **Step 2: Test de la ruta segura (copiado, debe pasar ya)**

`apps/muestras/lib/ruta-segura.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { rutaInternaSegura } from "./ruta-segura";

describe("rutaInternaSegura", () => {
  it("deja pasar rutas internas", () => expect(rutaInternaSegura("/proponer")).toBe("/proponer"));
  it("bloquea dominios externos", () => {
    expect(rutaInternaSegura("https://malo.com")).toBeUndefined();
    expect(rutaInternaSegura("//malo.com")).toBeUndefined();
    expect(rutaInternaSegura("/\\malo.com")).toBeUndefined();
  });
  it("vacío da undefined", () => expect(rutaInternaSegura(null)).toBeUndefined());
});
```

Run: `pnpm --filter muestras test`
Expected: PASS.

- [ ] **Step 3: Usuario actual**

`apps/muestras/lib/usuario.ts`:
```ts
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken, isGlobalSuperAdmin } from "@repo/auth";
import { prisma } from "@repo/db";

export type Usuario = { id: number; email: string; name: string | null; esSuperAdmin: boolean };

/** La persona con sesión abierta, o null. Lee la misma tabla `User` que FOTOFFICE y FotoRank. */
export async function getUsuario(): Promise<Usuario | null> {
  const token = (await cookies()).get(DNX_SESSION_COOKIE)?.value;
  if (!token) return null;
  const sesion = await getSessionUserByRawToken(token);
  if (!sesion) return null;
  const u = await prisma.user.findUnique({
    where: { id: sesion.id },
    select: { id: true, email: true, name: true, role: true, globalRole: true },
  });
  if (!u) return null;
  return { id: u.id, email: u.email, name: u.name, esSuperAdmin: isGlobalSuperAdmin(u) };
}

export async function requireUsuario(siguiente: string): Promise<Usuario> {
  const u = await getUsuario();
  if (!u) redirect(`/login?next=${encodeURIComponent(siguiente)}`);
  return u;
}

export async function requireSuperAdmin(): Promise<Usuario> {
  const u = await requireUsuario("/admin");
  if (!u.esSuperAdmin) redirect("/");
  return u;
}
```
Agregar `"server-only": "^0.0.1"` a dependencies si no resuelve (ver qué versión usa `apps/clickaton/package.json` y usar esa misma), y en `vitest.config.ts` el alias `"server-only"` → un archivo vacío `apps/muestras/test/server-only-stub.ts` (`export {};`), igual que `apps/fotoffice/vitest.config.ts`.

Verificar con `grep -n "export async function getSessionUserByRawToken" -A15 packages/auth/src/*.ts` qué devuelve (si devuelve `{ user: {...} }` en vez de `{ id }`, ajustar `sesion.id`).

- [ ] **Step 4: Página de login**

`apps/muestras/app/login/page.tsx`: copiar `apps/subilafoto/app/login/page.tsx` y cambiar `subilafotoAuthBrand` → `muestrasAuthBrand`, `"/panel"` → `"/mis-muestras"`, y el comentario de cabecera a: "Ingreso a Muestras Fotográficas. La misma cuenta que en el resto de DNX Suite; sólo Google."

- [ ] **Step 5: Probar el ingreso de punta a punta**

Requisitos (pedir a Daniel si faltan): en `apps/muestras/.env.local` las variables `DATABASE_URL` (rama `development`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL=http://localhost:3014`, y que `http://localhost:3014/api/auth/google/callback` esté autorizado en el cliente OAuth de Google.

Run: `pnpm --filter muestras dev`, abrir `http://localhost:3014/login`, ingresar con Google.
Expected: termina en `/mis-muestras` (404 por ahora) con la cookie `dnx_session` puesta.

Run: `pnpm --filter muestras check-types`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add apps/muestras packages/auth
git commit -m "Ingreso con Google en Muestras sobre la misma tabla de usuarios"
```

---

### Task 7: Geocodificación e imágenes

**Files:**
- Create: `apps/muestras/lib/geocode/limite.ts`, `apps/muestras/app/api/geocode/route.ts`
- Create: `apps/muestras/lib/imagenes/procesar.ts`, `apps/muestras/lib/imagenes/r2.ts`, `apps/muestras/app/api/imagenes/route.ts`
- Test: `apps/muestras/lib/imagenes/procesar.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/geocode?q=` → `Array<{ latitude: number; longitude: number; displayName: string; address: string | null; city: string | null; province: string | null }>`
  - `procesarImagen(bytes: Buffer, uso: "obra" | "portada"): Promise<{ bytes: Buffer; width: number; height: number; contentType: "image/webp" }>`
  - `subirAR2(bytes: Buffer, clave: string, contentType: string): Promise<string>` (devuelve URL pública)
  - `POST /api/imagenes` (multipart `file`, `uso`) → `201 { url }` | `400/401/413 { error }`

- [ ] **Step 1: Límite de pedidos y ruta de geocodificación**

`apps/muestras/lib/geocode/limite.ts`: copiar literal `apps/fotoffice/lib/geocode/rate-limit.ts` (exporta `checkRateLimit`, `clientIp`, `resetRateLimit`).

`apps/muestras/app/api/geocode/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { createNominatimProvider } from "@repo/geo";
import { checkRateLimit, clientIp } from "@/lib/geocode/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Buscar una dirección. Proxy a Nominatim con nuestro `User-Agent` y un tope por origen,
 * mismo criterio que `apps/fotoffice/app/api/geocode/route.ts`. Se usa al cargar el lugar de
 * una actividad: el resultado se guarda en la ficha y no se vuelve a pedir.
 */
export async function GET(req: NextRequest) {
  const freno = checkRateLimit({ key: `geocode:${clientIp(req.headers)}`, limit: 60, windowMs: 60_000 });
  if (!freno.allowed) {
    return NextResponse.json({ error: "Demasiadas búsquedas seguidas. Probá en un minuto." }, { status: 429 });
  }
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
  if (q.length < 3) return NextResponse.json({ error: "Escribí al menos 3 caracteres." }, { status: 400 });
  try {
    const lugares = await createNominatimProvider({
      userAgent: process.env.GEOCODING_USER_AGENT || "MuestrasFotograficas/1.0 (muestrasfotograficas.com)",
    }).search(q, { limit: 5 });
    return NextResponse.json(
      lugares.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        displayName: p.displayName,
        address: p.address,
        city: p.city,
        province: p.province,
      })),
    );
  } catch (err) {
    console.error("GET /api/geocode:", err);
    return NextResponse.json({ error: "No pudimos buscar esa dirección." }, { status: 502 });
  }
}
```
Verificar las opciones reales de `NominatimClientOptions` (`packages/geo/src/nominatim/index.ts:42`) y ajustar el nombre `userAgent` si difiere.

- [ ] **Step 2: Test del procesado de imagen (falla)**

`apps/muestras/lib/imagenes/procesar.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { procesarImagen } from "./procesar";

async function jpeg(w: number, h: number) {
  return sharp({ create: { width: w, height: h, channels: 3, background: "#888" } }).jpeg().toBuffer();
}

describe("procesarImagen", () => {
  it("achica una obra a 2000 px de lado mayor y la pasa a webp", async () => {
    const r = await procesarImagen(await jpeg(4000, 3000), "obra");
    expect(r.width).toBe(2000);
    expect(r.height).toBe(1500);
    expect(r.contentType).toBe("image/webp");
  });
  it("la portada va a 1600 px", async () => {
    const r = await procesarImagen(await jpeg(3000, 4000), "portada");
    expect(r.height).toBe(1600);
  });
  it("no agranda una imagen chica", async () => {
    const r = await procesarImagen(await jpeg(800, 600), "obra");
    expect(r.width).toBe(800);
  });
  it("rechaza algo que no es imagen", async () => {
    await expect(procesarImagen(Buffer.from("hola"), "obra")).rejects.toThrow("No es una imagen válida");
  });
});
```

Run: `pnpm --filter muestras test`
Expected: FAIL — no existe `./procesar`.

- [ ] **Step 3: Implementar el procesado y la subida**

`apps/muestras/lib/imagenes/procesar.ts`:
```ts
import sharp from "sharp";

const LADO_MAYOR = { obra: 2000, portada: 1600 } as const;
export type UsoImagen = keyof typeof LADO_MAYOR;

/**
 * Deja la imagen lista para la web: rota según el EXIF, achica sin agrandar y pasa a WebP.
 * Los originales en alta no se guardan acá: se suben recién al poner una obra a la venta.
 */
export async function procesarImagen(bytes: Buffer, uso: UsoImagen) {
  let meta;
  try {
    meta = await sharp(bytes).metadata();
  } catch {
    throw new Error("No es una imagen válida.");
  }
  if (!meta.width || !meta.height) throw new Error("No es una imagen válida.");
  const lado = LADO_MAYOR[uso];
  const { data, info } = await sharp(bytes)
    .rotate()
    .resize({ width: lado, height: lado, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return { bytes: data, width: info.width, height: info.height, contentType: "image/webp" as const };
}
```

`apps/muestras/lib/imagenes/r2.ts`:
```ts
import "server-only";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Bucket R2 de FOTOFFICE, bajo el prefijo `muestras/`. Mismas variables que
 * `apps/fotoffice/lib/images/r2-client.ts`.
 */
function config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;
  const publicUrl = (process.env.R2_PUBLIC_URL || process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  if (!accessKeyId || !secretAccessKey || !bucket || !publicUrl || !endpoint) {
    throw new Error("Falta configurar el almacenamiento de imágenes (R2).");
  }
  return { accessKeyId, secretAccessKey, bucket, publicUrl, endpoint };
}

let cliente: S3Client | null = null;

export async function subirAR2(bytes: Buffer, clave: string, contentType: string): Promise<string> {
  const c = config();
  cliente ??= new S3Client({
    region: "auto",
    endpoint: c.endpoint,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  });
  await cliente.send(
    new PutObjectCommand({
      Bucket: c.bucket,
      Key: clave,
      Body: bytes,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return `${c.publicUrl}/${clave}`;
}
```

`apps/muestras/app/api/imagenes/route.ts`:
```ts
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getUsuario } from "@/lib/usuario";
import { procesarImagen, type UsoImagen } from "@/lib/imagenes/procesar";
import { subirAR2 } from "@/lib/imagenes/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** El navegador ya achica antes de subir; esto frena lo que se escape. Vercel corta en 4,5 MB. */
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const usuario = await getUsuario();
  if (!usuario) return NextResponse.json({ error: "Tenés que ingresar." }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const uso: UsoImagen = form.get("uso") === "portada" ? "portada" : "obra";
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "La imagen pesa más de 4 MB." }, { status: 413 });

  try {
    const img = await procesarImagen(Buffer.from(await file.arrayBuffer()), uso);
    const url = await subirAR2(img.bytes, `muestras/${usuario.id}/${randomUUID()}.webp`, img.contentType);
    return NextResponse.json({ url }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No pudimos subir la imagen.";
    console.error("POST /api/imagenes:", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
```

- [ ] **Step 4: Correr tests y tipos**

Run: `pnpm --filter muestras test && pnpm --filter muestras check-types`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Buscador de direcciones y subida de imágenes achicadas en Muestras"
```

---

### Task 8: Acceso a datos y acciones de la ficha

**Files:**
- Create: `apps/muestras/lib/actividades/mapear.ts`, `lib/actividades/consultas.ts`, `lib/actividades/acciones.ts`
- Test: `apps/muestras/lib/actividades/mapear.test.ts`, `apps/muestras/lib/actividades/acciones.test.ts`

**Interfaces:**
- Consumes: todo `@repo/muestras`; `getUsuario`, `Usuario` (Task 6).
- Produces:
  - `FichaForm` (tipo del formulario, ver código) y `fichaDesdeFormData(fd: FormData): FichaForm`
  - `datosParaGuardar(f: FichaForm): Prisma.CulturalActivityUncheckedUpdateInput` (sin estado ni dueño)
  - Consultas: `listarPublicas(): Promise<ActividadPublica[]>`, `buscarPorSlug(slug: string)`, `listarMias(userId: number)`, `listarParaRevisar()`, `buscarPropia(id: string, usuario: Usuario)`
  - Acciones (`"use server"`): `guardarBorrador(fd: FormData): Promise<ResultadoAccion>`, `enviarARevision(id: string)`, `aprobar(id: string)`, `rechazar(id: string, motivo: string)`, `despublicar(id: string)`, `republicar(id: string)`, `cancelar(id: string)`, `reactivar(id: string)`
  - `type ResultadoAccion = { ok: true; id: string } | { ok: false; errores: string[] }`
  - `type ObraForm = { id?: string; imageUrl: string; title: string; authorName: string; year: number | null; technique: string | null; isHighlight: boolean }`

- [ ] **Step 1: Test del mapeo del formulario (falla)**

`apps/muestras/lib/actividades/mapear.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { datosParaGuardar, fichaDesdeFormData } from "./mapear";

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

const base = {
  type: "MUESTRA",
  title: " Miradas ",
  description: "Texto",
  coverImageUrl: "https://img/p.webp",
  organizersText: "Fotoclub",
  startDay: "2026-11-05",
  endDay: "2026-11-20",
  scheduleText: "16 a 20",
  isVirtualOnly: "",
  address: "Calle 1",
  city: "Paraná",
  province: "Entre Ríos",
  latitude: "-31.74",
  longitude: "-60.51",
  galleryMode: "HIGHLIGHTS_UNTIL_CLOSED",
  rightsConfirmed: "on",
  works: JSON.stringify([{ imageUrl: "https://img/1.webp", title: "Uno", authorName: "Ana", year: 2025, technique: null, isHighlight: true }]),
};

describe("fichaDesdeFormData", () => {
  it("recorta textos y convierte números y casillas", () => {
    const f = fichaDesdeFormData(fd(base));
    expect(f.title).toBe("Miradas");
    expect(f.latitude).toBeCloseTo(-31.74);
    expect(f.isVirtualOnly).toBe(false);
    expect(f.rightsConfirmed).toBe(true);
    expect(f.works).toHaveLength(1);
  });
  it("una actividad sólo virtual descarta el lugar", () => {
    const f = fichaDesdeFormData(fd({ ...base, isVirtualOnly: "on" }));
    expect(f.latitude).toBeNull();
    expect(f.address).toBeNull();
  });
  it("obras mal formadas se ignoran", () => {
    const f = fichaDesdeFormData(fd({ ...base, works: "no es json" }));
    expect(f.works).toEqual([]);
  });
});

describe("datosParaGuardar", () => {
  it("pasa las fechas a hora argentina y calcula el geohash", () => {
    const d = datosParaGuardar(fichaDesdeFormData(fd(base)));
    expect((d.startsAt as Date).toISOString()).toBe("2026-11-05T03:00:00.000Z");
    expect((d.endsAt as Date).toISOString()).toBe("2026-11-21T02:59:59.999Z");
    expect(typeof d.geohash).toBe("string");
  });
  it("no toca el estado de revisión ni el dueño", () => {
    const d = datosParaGuardar(fichaDesdeFormData(fd(base)));
    expect("reviewStatus" in d).toBe(false);
    expect("proposedByUserId" in d).toBe(false);
  });
});
```

Run: `pnpm --filter muestras test`
Expected: FAIL — no existe `./mapear`.

- [ ] **Step 2: Implementar el mapeo**

`apps/muestras/lib/actividades/mapear.ts`:
```ts
import type { Prisma } from "@repo/db";
import { encodeGeohash } from "@repo/geo";
import { dayEndAr, dayStartAr, isGalleryMode, type GalleryMode } from "@repo/muestras";

export type ObraForm = {
  id?: string;
  imageUrl: string;
  title: string;
  authorName: string;
  year: number | null;
  technique: string | null;
  isHighlight: boolean;
};

export type FichaForm = {
  id: string | null;
  type: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  organizersText: string;
  startDay: string;
  endDay: string;
  openingDay: string | null;
  scheduleText: string | null;
  priceText: string | null;
  externalUrl: string | null;
  isVirtualOnly: boolean;
  venueName: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  galleryMode: GalleryMode;
  rightsConfirmed: boolean;
  works: ObraForm[];
};

const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const opt = (fd: FormData, k: string) => txt(fd, k) || null;
const num = (fd: FormData, k: string) => {
  const v = Number(txt(fd, k));
  return txt(fd, k) !== "" && Number.isFinite(v) ? v : null;
};

function obras(raw: string): ObraForm[] {
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.flatMap((o) => {
      if (!o || typeof o !== "object") return [];
      const r = o as Record<string, unknown>;
      if (typeof r.imageUrl !== "string" || !r.imageUrl) return [];
      return [{
        id: typeof r.id === "string" ? r.id : undefined,
        imageUrl: r.imageUrl,
        title: String(r.title ?? "").trim() || "Sin título",
        authorName: String(r.authorName ?? "").trim(),
        year: typeof r.year === "number" && Number.isInteger(r.year) ? r.year : null,
        technique: typeof r.technique === "string" && r.technique.trim() ? r.technique.trim() : null,
        isHighlight: r.isHighlight === true,
      }];
    });
  } catch {
    return [];
  }
}

export function fichaDesdeFormData(fd: FormData): FichaForm {
  const virtual = fd.get("isVirtualOnly") === "on";
  const modo = txt(fd, "galleryMode");
  return {
    id: opt(fd, "id"),
    type: txt(fd, "type"),
    title: txt(fd, "title"),
    description: txt(fd, "description"),
    coverImageUrl: opt(fd, "coverImageUrl"),
    organizersText: txt(fd, "organizersText"),
    startDay: txt(fd, "startDay"),
    endDay: txt(fd, "endDay"),
    openingDay: opt(fd, "openingDay"),
    scheduleText: opt(fd, "scheduleText"),
    priceText: opt(fd, "priceText"),
    externalUrl: opt(fd, "externalUrl"),
    isVirtualOnly: virtual,
    venueName: virtual ? null : opt(fd, "venueName"),
    address: virtual ? null : opt(fd, "address"),
    city: virtual ? null : opt(fd, "city"),
    province: virtual ? null : opt(fd, "province"),
    latitude: virtual ? null : num(fd, "latitude"),
    longitude: virtual ? null : num(fd, "longitude"),
    galleryMode: isGalleryMode(modo) ? modo : "HIGHLIGHTS_UNTIL_CLOSED",
    rightsConfirmed: fd.get("rightsConfirmed") === "on",
    works: obras(txt(fd, "works") || "[]"),
  };
}

const diaValido = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

/** Lo que se escribe en la tabla. Nunca incluye estado ni dueño: eso lo deciden las acciones. */
export function datosParaGuardar(f: FichaForm) {
  const hoy = new Date().toISOString().slice(0, 10);
  const inicio = diaValido(f.startDay) ? f.startDay : hoy;
  const fin = diaValido(f.endDay) ? f.endDay : inicio;
  return {
    type: f.type,
    title: f.title,
    description: f.description,
    coverImageUrl: f.coverImageUrl,
    organizersText: f.organizersText,
    startsAt: dayStartAr(inicio),
    endsAt: dayEndAr(fin),
    openingAt: f.openingDay && diaValido(f.openingDay) ? dayStartAr(f.openingDay) : null,
    scheduleText: f.scheduleText,
    priceText: f.priceText,
    externalUrl: f.externalUrl,
    isVirtualOnly: f.isVirtualOnly,
    venueName: f.venueName,
    address: f.address,
    city: f.city,
    province: f.province,
    latitude: f.latitude,
    longitude: f.longitude,
    geohash: f.latitude != null && f.longitude != null ? encodeGeohash(f.latitude, f.longitude) : null,
    galleryMode: f.galleryMode,
    rightsConfirmedAt: f.rightsConfirmed ? new Date() : null,
  } satisfies Prisma.CulturalActivityUncheckedUpdateInput;
}
```

Run: `pnpm --filter muestras test`
Expected: PASS.

- [ ] **Step 3: Consultas**

`apps/muestras/lib/actividades/consultas.ts`:
```ts
import "server-only";
import { prisma } from "@repo/db";
import type { Usuario } from "@/lib/usuario";

const CAMPOS_PUBLICOS = {
  id: true, slug: true, type: true, title: true, coverImageUrl: true, organizersText: true,
  startsAt: true, endsAt: true, scheduleText: true, isVirtualOnly: true, venueName: true,
  city: true, province: true, latitude: true, longitude: true, isCancelled: true,
} as const;

export type ActividadPublica = Awaited<ReturnType<typeof listarPublicas>>[number];

/** Todo lo publicado, incluido el archivo. El filtro por fecha y provincia se hace con `applyFilter`. */
export function listarPublicas() {
  return prisma.culturalActivity.findMany({
    where: { reviewStatus: "APPROVED" },
    select: CAMPOS_PUBLICOS,
    orderBy: { startsAt: "asc" },
    take: 2000,
  });
}

export function buscarPorSlug(slug: string) {
  return prisma.culturalActivity.findFirst({
    where: { slug, reviewStatus: "APPROVED" },
    include: { works: { orderBy: { sortOrder: "asc" } } },
  });
}

export function listarMias(userId: number) {
  return prisma.culturalActivity.findMany({
    where: { proposedByUserId: userId },
    select: { id: true, slug: true, title: true, type: true, reviewStatus: true, rejectionReason: true, startsAt: true, endsAt: true, isCancelled: true },
    orderBy: { updatedAt: "desc" },
  });
}

export function listarParaRevisar() {
  return prisma.culturalActivity.findMany({
    where: { reviewStatus: { in: ["IN_REVIEW", "APPROVED", "UNPUBLISHED"] } },
    include: { works: { orderBy: { sortOrder: "asc" }, take: 6 } },
    orderBy: [{ reviewStatus: "asc" }, { submittedAt: "asc" }],
    take: 200,
  });
}

/** Una ficha para editar: de quien la propuso, o cualquiera si es super admin. */
export function buscarPropia(id: string, usuario: Usuario) {
  return prisma.culturalActivity.findFirst({
    where: usuario.esSuperAdmin ? { id } : { id, proposedByUserId: usuario.id },
    include: { works: { orderBy: { sortOrder: "asc" } } },
  });
}
```

- [ ] **Step 4: Test de las acciones (falla)**

`apps/muestras/lib/actividades/acciones.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivity: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  culturalActivityWork: { deleteMany: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
const correos = vi.hoisted(() => ({ avisarAprobada: vi.fn(), avisarRechazada: vi.fn(), avisarNuevaPropuesta: vi.fn() }));

vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("@/lib/correos/enviar", () => correos);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { aprobar, enviarARevision, rechazar } = await import("./acciones");

const fila = {
  id: "a1", slug: "x", type: "CHARLA", title: "Charla", description: "d", coverImageUrl: "u",
  organizersText: "o", startsAt: new Date("2026-11-05T03:00:00Z"), endsAt: new Date("2026-11-06T02:59:59.999Z"),
  scheduleText: "18", isVirtualOnly: true, address: null, latitude: null, longitude: null,
  rightsConfirmedAt: null, reviewStatus: "DRAFT", proposedByUserId: 7, workspaceId: null, isCancelled: false,
  works: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  db.culturalActivity.update.mockResolvedValue({});
});

describe("enviarARevision", () => {
  it("pasa a en revisión si está completa", async () => {
    usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: null };
    db.culturalActivity.findUnique.mockResolvedValue(fila);
    const r = await enviarARevision("a1");
    expect(r.ok).toBe(true);
    expect(db.culturalActivity.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reviewStatus: "IN_REVIEW" }) }),
    );
    expect(correos.avisarNuevaPropuesta).toHaveBeenCalled();
  });
  it("devuelve los faltantes y no escribe", async () => {
    usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: null };
    db.culturalActivity.findUnique.mockResolvedValue({ ...fila, title: "" });
    const r = await enviarARevision("a1");
    expect(r).toEqual({ ok: false, errores: ["Falta el título."] });
    expect(db.culturalActivity.update).not.toHaveBeenCalled();
  });
  it("sin sesión no hace nada", async () => {
    usuarioActual.valor = null;
    const r = await enviarARevision("a1");
    expect(r.ok).toBe(false);
  });
});

describe("aprobar y rechazar", () => {
  it("quien propuso no puede aprobarse", async () => {
    usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: null };
    db.culturalActivity.findUnique.mockResolvedValue({ ...fila, reviewStatus: "IN_REVIEW" });
    expect((await aprobar("a1")).ok).toBe(false);
    expect(db.culturalActivity.update).not.toHaveBeenCalled();
  });
  it("el super admin aprueba y se avisa a quien propuso", async () => {
    usuarioActual.valor = { id: 1, esSuperAdmin: true, email: "d@x", name: "Daniel" };
    db.culturalActivity.findUnique.mockResolvedValue({ ...fila, reviewStatus: "IN_REVIEW" });
    expect((await aprobar("a1")).ok).toBe(true);
    expect(db.culturalActivity.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reviewStatus: "APPROVED", reviewedByUserId: 1 }) }),
    );
    expect(correos.avisarAprobada).toHaveBeenCalledWith("a1");
  });
  it("rechazar exige motivo", async () => {
    usuarioActual.valor = { id: 1, esSuperAdmin: true, email: "d@x", name: "Daniel" };
    db.culturalActivity.findUnique.mockResolvedValue({ ...fila, reviewStatus: "IN_REVIEW" });
    expect(await rechazar("a1", "  ")).toEqual({ ok: false, errores: ["Escribí el motivo del rechazo."] });
    expect((await rechazar("a1", "Falta la dirección exacta")).ok).toBe(true);
    expect(correos.avisarRechazada).toHaveBeenCalledWith("a1");
  });
});
```

Run: `pnpm --filter muestras test`
Expected: FAIL — no existe `./acciones`.

- [ ] **Step 5: Implementar las acciones**

`apps/muestras/lib/actividades/acciones.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import {
  MAX_HIGHLIGHTS, MAX_WORKS, canEdit, canPerform, missingForSubmission, newSlug, nextStatus,
  toArDay, type ReviewAction, type ReviewStatus,
} from "@repo/muestras";
import { getUsuario } from "@/lib/usuario";
import { avisarAprobada, avisarNuevaPropuesta, avisarRechazada } from "@/lib/correos/enviar";
import { datosParaGuardar, fichaDesdeFormData } from "./mapear";

export type ResultadoAccion = { ok: true; id: string } | { ok: false; errores: string[] };

const SIN_SESION: ResultadoAccion = { ok: false, errores: ["Tenés que ingresar."] };
const NO_EXISTE: ResultadoAccion = { ok: false, errores: ["La actividad no existe."] };

function refrescar(slug?: string) {
  revalidatePath("/");
  revalidatePath("/mis-muestras");
  revalidatePath("/admin");
  if (slug) revalidatePath(`/m/${slug}`);
}

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
  const datos = datosParaGuardar(f);
  const obras = f.works.map((w, i) => ({
    imageUrl: w.imageUrl, title: w.title, authorName: w.authorName, year: w.year,
    technique: w.technique, isHighlight: w.isHighlight, sortOrder: i,
  }));

  if (!f.id) {
    const creada = await prisma.culturalActivity.create({
      data: { ...datos, slug: newSlug(f.title), proposedByUserId: usuario.id, works: { create: obras } },
      select: { id: true },
    });
    refrescar();
    return { ok: true, id: creada.id };
  }

  const actual = await prisma.culturalActivity.findUnique({ where: { id: f.id } });
  if (!actual) return NO_EXISTE;
  const actor = { userId: usuario.id, isSuperAdmin: usuario.esSuperAdmin };
  if (!canEdit({ ...actual, reviewStatus: actual.reviewStatus as ReviewStatus }, actor)) {
    return { ok: false, errores: ["No podés editar esta actividad ahora."] };
  }
  await prisma.$transaction([
    prisma.culturalActivity.update({ where: { id: f.id }, data: datos }),
    prisma.culturalActivityWork.deleteMany({ where: { activityId: f.id } }),
    prisma.culturalActivityWork.createMany({ data: obras.map((o) => ({ ...o, activityId: f.id! })) }),
  ]);
  refrescar(actual.slug);
  return { ok: true, id: f.id };
}

async function transicion(
  id: string,
  accion: ReviewAction,
  extra: (ahora: Date, revisor: number) => Record<string, unknown> = () => ({}),
): Promise<ResultadoAccion> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const fila = await prisma.culturalActivity.findUnique({ where: { id }, include: { works: true } });
  if (!fila) return NO_EXISTE;
  const estado = fila.reviewStatus as ReviewStatus;
  const permiso = canPerform(accion, { ...fila, reviewStatus: estado }, { userId: usuario.id, isSuperAdmin: usuario.esSuperAdmin });
  if (!permiso.ok) return { ok: false, errores: [permiso.reason] };

  if (accion === "submit") {
    const faltan = missingForSubmission({
      type: fila.type, title: fila.title, description: fila.description, coverImageUrl: fila.coverImageUrl,
      organizersText: fila.organizersText, startDay: toArDay(fila.startsAt), endDay: toArDay(fila.endsAt),
      scheduleText: fila.scheduleText, isVirtualOnly: fila.isVirtualOnly, address: fila.address,
      latitude: fila.latitude, longitude: fila.longitude, rightsConfirmed: fila.rightsConfirmedAt != null,
      worksCount: fila.works.length, highlightsCount: fila.works.filter((w) => w.isHighlight).length,
    });
    if (faltan.length) return { ok: false, errores: faltan };
  }

  const ahora = new Date();
  await prisma.culturalActivity.update({
    where: { id },
    data: { reviewStatus: nextStatus(accion, estado), ...extra(ahora, usuario.id) },
  });
  refrescar(fila.slug);
  return { ok: true, id };
}

export async function enviarARevision(id: string) {
  const r = await transicion(id, "submit", (ahora) => ({ submittedAt: ahora, rejectionReason: null }));
  if (r.ok) await avisarNuevaPropuesta(id);
  return r;
}

export async function aprobar(id: string) {
  const r = await transicion(id, "approve", (ahora, revisor) => ({ reviewedAt: ahora, reviewedByUserId: revisor }));
  if (r.ok) await avisarAprobada(id);
  return r;
}

export async function rechazar(id: string, motivo: string): Promise<ResultadoAccion> {
  const m = motivo.trim();
  if (!m) return { ok: false, errores: ["Escribí el motivo del rechazo."] };
  const r = await transicion(id, "reject", (ahora, revisor) => ({ reviewedAt: ahora, reviewedByUserId: revisor, rejectionReason: m.slice(0, 1000) }));
  if (r.ok) await avisarRechazada(id);
  return r;
}

export async function despublicar(id: string) {
  return transicion(id, "unpublish", (ahora, revisor) => ({ reviewedAt: ahora, reviewedByUserId: revisor }));
}
export async function republicar(id: string) {
  return transicion(id, "republish", (ahora, revisor) => ({ reviewedAt: ahora, reviewedByUserId: revisor }));
}
export async function cancelar(id: string) {
  return transicion(id, "cancel", () => ({ isCancelled: true }));
}
export async function reactivar(id: string) {
  return transicion(id, "uncancel", () => ({ isCancelled: false }));
}
```

Crear un `apps/muestras/lib/correos/enviar.ts` provisorio (se completa en la Task 11) para que compile:
```ts
export async function avisarNuevaPropuesta(_id: string): Promise<void> {}
export async function avisarAprobada(_id: string): Promise<void> {}
export async function avisarRechazada(_id: string): Promise<void> {}
```

- [ ] **Step 6: Correr tests y tipos**

Run: `pnpm --filter muestras test && pnpm --filter muestras check-types`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/muestras
git commit -m "Guardar, enviar y revisar actividades con las reglas compartidas"
```

---

### Task 9: Formulario "Proponé tu muestra" y "Mis muestras"

**Files:**
- Create: `apps/muestras/components/mapa/mapa-del-lugar.tsx` (copia), `components/formulario/buscador-direccion.tsx`, `components/formulario/subir-imagen.ts`, `components/formulario/obras.tsx`, `components/formulario/formulario-actividad.tsx`, `components/formulario/botones-publicada.tsx`
- Create: `apps/muestras/app/proponer/page.tsx`, `app/mis-muestras/page.tsx`, `app/mis-muestras/[id]/page.tsx`

**Interfaces:**
- Consumes: `guardarBorrador`, `enviarARevision`, `cancelar`, `reactivar`, `ResultadoAccion`, `ObraForm` (Task 8); `listarMias`, `buscarPropia` (Task 8); `requireUsuario` (Task 6); `ACTIVITY_TYPES`, `ACTIVITY_TYPE_LABELS`, `REVIEW_STATUS_LABELS`, `MAX_WORKS`, `MAX_HIGHLIGHTS`, `toArDay` (paquete).
- Produces: `<FormularioActividad inicial?: ActividadEditable />` donde `ActividadEditable = NonNullable<Awaited<ReturnType<typeof buscarPropia>>>`; `achicarEnNavegador(file: File, ladoMayor: number): Promise<Blob>`; `subirImagen(file: File, uso: "obra" | "portada"): Promise<string>`.

- [ ] **Step 1: Mapa con pin**

```bash
mkdir -p apps/muestras/components/mapa apps/muestras/components/formulario
cp apps/fotoffice/components/coberturas/mapa-del-lugar.tsx apps/muestras/components/mapa/mapa-del-lugar.tsx
```
En la copia: cambiar en el comentario de cabecera `ubicacion-del-evento.tsx` → `formulario-actividad.tsx`, el `alt` del Marker a `"El lugar de la actividad"`, y la clase del `div` a `"relative z-0 overflow-hidden rounded-md border border-[var(--mf-line)]"`.

- [ ] **Step 2: Subida desde el navegador**

`apps/muestras/components/formulario/subir-imagen.ts`:
```ts
/**
 * Achica en el navegador antes de subir: una foto de cámara pesa 10–25 MB y Vercel corta los
 * pedidos en 4,5 MB. El servidor la vuelve a procesar (WebP, tamaño final).
 */
export async function achicarEnNavegador(file: File, ladoMayor: number): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const escala = Math.min(1, ladoMayor / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((ok, mal) =>
    canvas.toBlob((b) => (b ? ok(b) : mal(new Error("No pudimos leer la imagen."))), "image/jpeg", 0.9),
  );
}

export async function subirImagen(file: File, uso: "obra" | "portada"): Promise<string> {
  const blob = await achicarEnNavegador(file, uso === "portada" ? 1600 : 2000);
  const fd = new FormData();
  fd.set("file", new File([blob], "imagen.jpg", { type: "image/jpeg" }));
  fd.set("uso", uso);
  const res = await fetch("/api/imagenes", { method: "POST", body: fd });
  const json = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error ?? "No pudimos subir la imagen.");
  return json.url;
}
```

- [ ] **Step 3: Buscador de dirección**

`apps/muestras/components/formulario/buscador-direccion.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";

export type Lugar = { latitude: number; longitude: number; displayName: string; address: string | null; city: string | null; province: string | null };

/** Escribe, espera 400 ms y busca. Elegir un resultado completa dirección, ciudad, provincia y punto. */
export function BuscadorDireccion({ onElegir }: { onElegir: (l: Lugar) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Lugar[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 3) return;
    const t = setTimeout(async () => {
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const j = (await r.json()) as Lugar[] | { error: string };
      if (Array.isArray(j)) { setRes(j); setError(j.length ? null : "No encontramos esa dirección."); }
      else { setRes([]); setError(j.error); }
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscá la dirección (calle, número, ciudad)"
        className="w-full rounded-md border border-[var(--mf-line)] bg-white px-3 py-2"
      />
      {error ? <p className="mt-1 text-sm text-[var(--mf-muted)]">{error}</p> : null}
      {res.length > 0 ? (
        <ul className="absolute z-10 mt-1 w-full rounded-md border border-[var(--mf-line)] bg-white shadow">
          {res.map((l) => (
            <li key={`${l.latitude},${l.longitude}`}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--mf-bg)]"
                onClick={() => { onElegir(l); setRes([]); setQ(l.displayName); }}
              >
                {l.displayName}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Editor de obras**

`apps/muestras/components/formulario/obras.tsx`:
```tsx
"use client";

import { useState } from "react";
import { MAX_HIGHLIGHTS, MAX_WORKS } from "@repo/muestras";
import type { ObraForm } from "@/lib/actividades/mapear";
import { subirImagen } from "./subir-imagen";

export function EditorObras({ obras, onCambio }: { obras: ObraForm[]; onCambio: (o: ObraForm[]) => void }) {
  const [subiendo, setSubiendo] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const destacadas = obras.filter((o) => o.isHighlight).length;

  async function agregar(files: FileList | null) {
    if (!files) return;
    const lugar = MAX_WORKS - obras.length;
    const lista = Array.from(files).slice(0, lugar);
    if (files.length > lugar) setError(`Sólo entran ${MAX_WORKS} obras; se agregaron ${lista.length}.`);
    setSubiendo(lista.length);
    const nuevas: ObraForm[] = [];
    for (const f of lista) {
      try {
        const url = await subirImagen(f, "obra");
        nuevas.push({ imageUrl: url, title: f.name.replace(/\.[^.]+$/, ""), authorName: "", year: null, technique: null, isHighlight: false });
      } catch (e) {
        setError(e instanceof Error ? e.message : "No pudimos subir una imagen.");
      }
      setSubiendo((n) => n - 1);
    }
    onCambio([...obras, ...nuevas]);
  }

  const cambiar = (i: number, p: Partial<ObraForm>) => onCambio(obras.map((o, j) => (j === i ? { ...o, ...p } : o)));
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= obras.length) return;
    const c = [...obras];
    [c[i], c[j]] = [c[j]!, c[i]!];
    onCambio(c);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--mf-muted)]">
        {obras.length}/{MAX_WORKS} obras · {destacadas}/{MAX_HIGHLIGHTS} destacadas. Mientras la muestra está abierta, el público ve sólo las destacadas.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {obras.map((o, i) => (
          <li key={o.imageUrl} className="flex gap-3 rounded-md border border-[var(--mf-line)] bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={o.imageUrl} alt="" className="h-24 w-24 rounded object-cover" />
            <div className="flex-1 space-y-1 text-sm">
              <input className="w-full border-b" value={o.title} onChange={(e) => cambiar(i, { title: e.target.value })} placeholder="Título" />
              <input className="w-full border-b" value={o.authorName} onChange={(e) => cambiar(i, { authorName: e.target.value })} placeholder="Autor" />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={o.isHighlight}
                    disabled={!o.isHighlight && destacadas >= MAX_HIGHLIGHTS}
                    onChange={(e) => cambiar(i, { isHighlight: e.target.checked })}
                  />
                  Destacada
                </label>
                <button type="button" onClick={() => mover(i, -1)} aria-label="Subir">↑</button>
                <button type="button" onClick={() => mover(i, 1)} aria-label="Bajar">↓</button>
                <button type="button" className="ml-auto text-[var(--mf-accent)]" onClick={() => onCambio(obras.filter((_, j) => j !== i))}>Quitar</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {obras.length < MAX_WORKS ? (
        <label className="inline-block cursor-pointer rounded-md border border-dashed border-[var(--mf-line)] px-4 py-3">
          {subiendo > 0 ? `Subiendo ${subiendo}…` : "Agregar fotos"}
          <input type="file" accept="image/*" multiple className="hidden" disabled={subiendo > 0} onChange={(e) => agregar(e.target.files)} />
        </label>
      ) : null}
      {error ? <p className="text-sm text-[var(--mf-accent)]">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 5: El formulario**

`apps/muestras/components/formulario/formulario-actividad.tsx`:
```tsx
"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS, toArDay } from "@repo/muestras";
import { enviarARevision, guardarBorrador } from "@/lib/actividades/acciones";
import type { buscarPropia } from "@/lib/actividades/consultas";
import type { ObraForm } from "@/lib/actividades/mapear";
import { BuscadorDireccion } from "./buscador-direccion";
import { EditorObras } from "./obras";
import { subirImagen } from "./subir-imagen";

const MapaDelLugar = dynamic(() => import("@/components/mapa/mapa-del-lugar"), { ssr: false });

export type ActividadEditable = NonNullable<Awaited<ReturnType<typeof buscarPropia>>>;

const campo = "w-full rounded-md border border-[var(--mf-line)] bg-white px-3 py-2";

export function FormularioActividad({ inicial }: { inicial?: ActividadEditable }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [errores, setErrores] = useState<string[]>([]);
  const [tipo, setTipo] = useState(inicial?.type ?? "MUESTRA");
  const [virtual, setVirtual] = useState(inicial?.isVirtualOnly ?? false);
  const [portada, setPortada] = useState<string | null>(inicial?.coverImageUrl ?? null);
  const [lugar, setLugar] = useState({
    address: inicial?.address ?? "", city: inicial?.city ?? "", province: inicial?.province ?? "",
    latitude: inicial?.latitude ?? null as number | null, longitude: inicial?.longitude ?? null as number | null,
  });
  const [obras, setObras] = useState<ObraForm[]>(
    (inicial?.works ?? []).map((w) => ({ id: w.id, imageUrl: w.imageUrl, title: w.title, authorName: w.authorName, year: w.year, technique: w.technique, isHighlight: w.isHighlight })),
  );

  function datos(form: HTMLFormElement) {
    const fd = new FormData(form);
    if (inicial) fd.set("id", inicial.id);
    fd.set("coverImageUrl", portada ?? "");
    fd.set("address", lugar.address); fd.set("city", lugar.city); fd.set("province", lugar.province);
    fd.set("latitude", lugar.latitude?.toString() ?? ""); fd.set("longitude", lugar.longitude?.toString() ?? "");
    fd.set("works", JSON.stringify(tipo === "MUESTRA" ? obras : []));
    return fd;
  }

  function guardar(form: HTMLFormElement, enviar: boolean) {
    start(async () => {
      const r = await guardarBorrador(datos(form));
      if (!r.ok) return setErrores(r.errores);
      if (enviar) {
        const e = await enviarARevision(r.id);
        if (!e.ok) { setErrores(e.errores); router.replace(`/mis-muestras/${r.id}`); return; }
      }
      router.push(enviar ? "/mis-muestras?enviada=1" : `/mis-muestras/${r.id}`);
    });
  }

  return (
    <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
      <fieldset className="space-y-3">
        <label className="block">Tipo de actividad
          <select name="type" className={campo} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>)}
          </select>
        </label>
        <label className="block">Título<input name="title" className={campo} defaultValue={inicial?.title} required /></label>
        <label className="block">Descripción<textarea name="description" rows={5} className={campo} defaultValue={inicial?.description} /></label>
        <label className="block">Organizadores<input name="organizersText" className={campo} defaultValue={inicial?.organizersText} placeholder="Personas o instituciones que la organizan" /></label>
        <div>
          <p>Foto de portada</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {portada ? <img src={portada} alt="" className="my-2 h-40 rounded object-cover" /> : null}
          <input type="file" accept="image/*" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try { setPortada(await subirImagen(f, "portada")); } catch (err) { setErrores([err instanceof Error ? err.message : "No pudimos subir la portada."]); }
          }} />
        </div>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <label>Desde<input type="date" name="startDay" className={campo} defaultValue={inicial ? toArDay(inicial.startsAt) : ""} /></label>
        <label>Hasta<input type="date" name="endDay" className={campo} defaultValue={inicial ? toArDay(inicial.endsAt) : ""} /></label>
        <label>Inauguración (opcional)<input type="date" name="openingDay" className={campo} defaultValue={inicial?.openingAt ? toArDay(inicial.openingAt) : ""} /></label>
        <label className="sm:col-span-2">Horarios<input name="scheduleText" className={campo} defaultValue={inicial?.scheduleText ?? ""} placeholder="Mar a dom de 16 a 20" /></label>
        <label>Entrada<input name="priceText" className={campo} defaultValue={inicial?.priceText ?? ""} placeholder="Vacío = libre y gratuita" /></label>
        <label className="sm:col-span-3">Enlace (opcional)<input name="externalUrl" type="url" className={campo} defaultValue={inicial?.externalUrl ?? ""} /></label>
      </fieldset>

      <fieldset className="space-y-3">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isVirtualOnly" checked={virtual} onChange={(e) => setVirtual(e.target.checked)} />
          Es sólo virtual (no tiene sala)
        </label>
        {!virtual ? (
          <>
            <label className="block">Nombre del lugar<input name="venueName" className={campo} defaultValue={inicial?.venueName ?? ""} placeholder="Centro cultural, galería…" /></label>
            <BuscadorDireccion onElegir={(l) => setLugar({ address: l.address ?? l.displayName, city: l.city ?? "", province: l.province ?? "", latitude: l.latitude, longitude: l.longitude })} />
            <p className="text-sm text-[var(--mf-muted)]">{lugar.address || "Todavía no elegiste la dirección."} Si el punto quedó corrido, tocá el mapa o arrastrá el pin.</p>
            <MapaDelLugar latitude={lugar.latitude} longitude={lugar.longitude} editable onMover={(lat, lng) => setLugar((p) => ({ ...p, latitude: lat, longitude: lng }))} alto="280px" />
          </>
        ) : null}
      </fieldset>

      {tipo === "MUESTRA" ? (
        <fieldset className="space-y-3">
          <legend className="text-lg">Galería virtual</legend>
          <EditorObras obras={obras} onCambio={setObras} />
          <label className="flex items-center gap-2">
            <input type="checkbox" name="galleryMode" value="FULL" defaultChecked={inicial?.galleryMode === "FULL"} />
            Mostrar la galería completa desde el primer día
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="rightsConfirmed" defaultChecked={inicial?.rightsConfirmedAt != null} />
            Confirmo que tengo autorización de los autores para publicar estas imágenes, y que cada una lleva su crédito.
          </label>
        </fieldset>
      ) : null}

      {errores.length ? (
        <ul role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{errores.map((e) => <li key={e}>{e}</li>)}</ul>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={pendiente} className="rounded-md border border-[var(--mf-line)] px-4 py-2"
          onClick={(e) => guardar(e.currentTarget.form!, false)}>Guardar borrador</button>
        <button type="button" disabled={pendiente} className="rounded-md bg-[var(--mf-accent)] px-4 py-2 text-[var(--mf-accent-ink)]"
          onClick={(e) => guardar(e.currentTarget.form!, true)}>Enviar a revisión</button>
      </div>
    </form>
  );
}
```
Nota: el checkbox `galleryMode` manda `FULL` sólo si está tildado; sin tildar, `fichaDesdeFormData` cae en `HIGHLIGHTS_UNTIL_CLOSED`.

- [ ] **Step 6: Páginas**

`apps/muestras/app/proponer/page.tsx`:
```tsx
import { FormularioActividad } from "@/components/formulario/formulario-actividad";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proponé tu muestra" };

export default async function Proponer() {
  await requireUsuario("/proponer");
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <h1 className="font-[family-name:var(--mf-serif)] text-3xl">Proponé tu muestra o actividad</h1>
      <p className="text-[var(--mf-muted)]">La revisamos antes de publicarla en el mapa. Te avisamos por mail.</p>
      <FormularioActividad />
    </main>
  );
}
```

`apps/muestras/app/mis-muestras/page.tsx`:
```tsx
import Link from "next/link";
import { ACTIVITY_TYPE_LABELS, REVIEW_STATUS_LABELS, toArDay, type ActivityType, type ReviewStatus } from "@repo/muestras";
import { listarMias } from "@/lib/actividades/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mis muestras" };

export default async function MisMuestras({ searchParams }: { searchParams: Promise<{ enviada?: string }> }) {
  const usuario = await requireUsuario("/mis-muestras");
  const { enviada } = await searchParams;
  const mias = await listarMias(usuario.id);
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--mf-serif)] text-3xl">Mis muestras</h1>
        <Link href="/proponer" className="rounded-md bg-[var(--mf-accent)] px-4 py-2 text-white">Proponer otra</Link>
      </div>
      {enviada ? <p className="rounded-md bg-green-50 p-3 text-green-900">¡Listo! La enviaste a revisión. Te avisamos por mail.</p> : null}
      {mias.length === 0 ? <p>Todavía no propusiste ninguna.</p> : (
        <ul className="divide-y divide-[var(--mf-line)] rounded-md border border-[var(--mf-line)] bg-white">
          {mias.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 p-3">
              <div>
                <Link href={`/mis-muestras/${m.id}`} className="font-medium underline">{m.title}</Link>
                <p className="text-sm text-[var(--mf-muted)]">
                  {ACTIVITY_TYPE_LABELS[m.type as ActivityType] ?? m.type} · {toArDay(m.startsAt)} al {toArDay(m.endsAt)}
                  {m.isCancelled ? " · Cancelada" : ""}
                </p>
                {m.reviewStatus === "REJECTED" && m.rejectionReason ? <p className="text-sm text-[var(--mf-accent)]">Motivo: {m.rejectionReason}</p> : null}
              </div>
              <span className="text-sm">{REVIEW_STATUS_LABELS[m.reviewStatus as ReviewStatus]}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

`apps/muestras/app/mis-muestras/[id]/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { REVIEW_STATUS_LABELS, canEdit, type ReviewStatus } from "@repo/muestras";
import { FormularioActividad } from "@/components/formulario/formulario-actividad";
import { BotonesPublicada } from "@/components/formulario/botones-publicada";
import { buscarPropia } from "@/lib/actividades/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";

export default async function EditarActividad({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await requireUsuario(`/mis-muestras/${id}`);
  const a = await buscarPropia(id, usuario);
  if (!a) notFound();
  const estado = a.reviewStatus as ReviewStatus;
  const editable = canEdit({ ...a, reviewStatus: estado }, { userId: usuario.id, isSuperAdmin: usuario.esSuperAdmin });
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <Link href="/mis-muestras" className="text-sm underline">← Mis muestras</Link>
      <h1 className="font-[family-name:var(--mf-serif)] text-3xl">{a.title}</h1>
      <p>Estado: <strong>{REVIEW_STATUS_LABELS[estado]}</strong>{a.isCancelled ? " · Cancelada" : ""}</p>
      {estado === "REJECTED" && a.rejectionReason ? <p className="rounded-md bg-red-50 p-3 text-red-800">Motivo del rechazo: {a.rejectionReason}. Corregí y volvé a enviarla.</p> : null}
      {estado === "APPROVED" ? (
        <>
          <p><Link href={`/m/${a.slug}`} className="underline">Ver publicada</Link>. Los cambios se publican sin volver a revisión.</p>
          <BotonesPublicada id={a.id} cancelada={a.isCancelled} />
        </>
      ) : null}
      {estado === "IN_REVIEW" ? <p className="text-[var(--mf-muted)]">Está en revisión. No se puede editar hasta que la revisemos.</p> : null}
      {editable ? <FormularioActividad inicial={a} /> : null}
    </main>
  );
}
```

`apps/muestras/components/formulario/botones-publicada.tsx`:
```tsx
"use client";

import { useTransition } from "react";
import { cancelar, reactivar } from "@/lib/actividades/acciones";

export function BotonesPublicada({ id, cancelada }: { id: string; cancelada: boolean }) {
  const [pendiente, start] = useTransition();
  return cancelada ? (
    <button disabled={pendiente} className="rounded-md border px-4 py-2" onClick={() => start(async () => { await reactivar(id); })}>Quitar el cartel de cancelada</button>
  ) : (
    <button disabled={pendiente} className="rounded-md border border-[var(--mf-accent)] px-4 py-2 text-[var(--mf-accent)]"
      onClick={() => { if (confirm("¿Marcar como cancelada? Va a seguir visible con el cartel «Cancelada».")) start(async () => { await cancelar(id); }); }}>
      Se suspendió: marcar como cancelada
    </button>
  );
}
```

- [ ] **Step 7: Probar el circuito en el navegador**

Run: `pnpm --filter muestras check-types && pnpm --filter muestras dev`
En `http://localhost:3014/proponer` (con sesión): cargar una muestra con dirección, 3 obras (1 destacada), confirmar derechos y "Enviar a revisión".
Expected: termina en `/mis-muestras?enviada=1` con el estado "En revisión"; en la base hay una fila `CulturalActivity` con `reviewStatus = 'IN_REVIEW'` y 3 `CulturalActivityWork`. Probar también "Enviar" con el título vacío → aparece "Falta el título." y la ficha queda en borrador.

Requiere la migración aplicada (Task 4, Step 6) y las variables R2 en `.env.local`. Si la migración todavía no se aplicó, probar contra una rama Neon de prueba creada desde `development` (pedir permiso) y borrarla al terminar.

- [ ] **Step 8: Commit**

```bash
git add apps/muestras
git commit -m "Formulario para proponer muestras y listado de las propias"
```

---

### Task 10: Mapa nacional, listado y ficha pública

**Files:**
- Create: `apps/muestras/components/mapa/mapa-nacional.tsx`, `components/mapa/mapa-nacional-cliente.tsx`, `components/ficha/estado.tsx`, `components/ficha/galeria.tsx`, `components/listado/filtros.tsx`
- Modify: `apps/muestras/app/page.tsx` (reemplaza la provisoria)
- Create: `apps/muestras/app/m/[slug]/page.tsx`

**Interfaces:**
- Consumes: `listarPublicas`, `buscarPorSlug`, `ActividadPublica` (Task 8); `applyFilter`, `temporalStatus`, `isLastDays`, `visibleWorks`, `ACTIVITY_TYPES`, `ACTIVITY_TYPE_LABELS`, `isActivityType`, `toArDay` (paquete).
- Produces: `<MapaNacional puntos: { slug: string; title: string; latitude: number; longitude: number; etiqueta: string }[] />`, `<EstadoActividad startsAt endsAt isCancelled />`, `<Galeria obras parcial />`.

- [ ] **Step 1: Mapa nacional**

`apps/muestras/components/mapa/mapa-nacional.tsx`:
```tsx
"use client";

import Link from "next/link";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});

export type PuntoMapa = { slug: string; title: string; latitude: number; longitude: number; etiqueta: string };

/** Centro de Argentina con zoom de país. Sólo en el navegador: importar con `ssr: false`. */
export default function MapaNacional({ puntos }: { puntos: PuntoMapa[] }) {
  return (
    <div className="relative z-0 h-[60vh] min-h-80 overflow-hidden rounded-md border border-[var(--mf-line)]">
      <MapContainer center={[-38.4, -63.6]} zoom={4} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {puntos.map((p) => (
          <Marker key={p.slug} position={[p.latitude, p.longitude]} alt={p.title}>
            <Popup>
              <Link href={`/m/${p.slug}`} className="font-medium">{p.title}</Link>
              <br />
              {p.etiqueta}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
```

- [ ] **Step 2: Estado y galería**

`apps/muestras/components/ficha/estado.tsx`:
```tsx
import { isLastDays, temporalStatus } from "@repo/muestras";

export function EstadoActividad({ startsAt, endsAt, isCancelled, ahora }: { startsAt: Date; endsAt: Date; isCancelled: boolean; ahora: Date }) {
  if (isCancelled) return <span className="rounded bg-red-100 px-2 py-0.5 text-sm text-red-900">Cancelada</span>;
  const t = temporalStatus({ startsAt, endsAt }, ahora);
  if (t === "CLOSED") return <span className="rounded bg-stone-200 px-2 py-0.5 text-sm">Cerrada · archivo</span>;
  if (t === "UPCOMING") return <span className="rounded bg-amber-100 px-2 py-0.5 text-sm">Próxima</span>;
  return (
    <span className="rounded bg-green-100 px-2 py-0.5 text-sm text-green-900">
      Abierta{isLastDays({ startsAt, endsAt }, ahora) ? " · Últimos días" : ""}
    </span>
  );
}
```

`apps/muestras/components/ficha/galeria.tsx`:
```tsx
"use client";

import { useState } from "react";

type Obra = { id: string; imageUrl: string; title: string; authorName: string; year: number | null; technique: string | null };

/** Grilla con visor a pantalla completa. Flechas y Escape del teclado funcionan en el visor. */
export function Galeria({ obras, parcial }: { obras: Obra[]; parcial: boolean }) {
  const [abierta, setAbierta] = useState<number | null>(null);
  const actual = abierta != null ? obras[abierta] : null;
  const ir = (d: number) => setAbierta((i) => (i == null ? i : (i + d + obras.length) % obras.length));

  return (
    <section className="space-y-3">
      {parcial ? <p className="text-[var(--mf-muted)]">Estás viendo una selección. Visitala en persona: la galería completa se publica cuando cierra.</p> : null}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {obras.map((o, i) => (
          <li key={o.id}>
            <button type="button" className="block w-full" onClick={() => setAbierta(i)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.imageUrl} alt={`${o.title}, de ${o.authorName}`} loading="lazy" className="aspect-square w-full object-cover" />
            </button>
            <p className="mt-1 text-sm">{o.title} · <span className="text-[var(--mf-muted)]">{o.authorName}</span></p>
          </li>
        ))}
      </ul>
      {actual ? (
        <div
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-4 text-white"
          onKeyDown={(e) => { if (e.key === "Escape") setAbierta(null); if (e.key === "ArrowRight") ir(1); if (e.key === "ArrowLeft") ir(-1); }}
          ref={(el) => el?.focus()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={actual.imageUrl} alt={actual.title} className="max-h-[80vh] max-w-full object-contain" />
          <p className="mt-3 text-center">
            <strong>{actual.title}</strong> · {actual.authorName}
            {actual.year ? `, ${actual.year}` : ""}{actual.technique ? ` · ${actual.technique}` : ""}
          </p>
          <div className="mt-3 flex gap-6">
            <button onClick={() => ir(-1)}>← Anterior</button>
            <button onClick={() => setAbierta(null)}>Cerrar</button>
            <button onClick={() => ir(1)}>Siguiente →</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 3: Portada con mapa, filtros y listado**

`apps/muestras/components/listado/filtros.tsx`:
```tsx
import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS } from "@repo/muestras";

/** Formulario GET: los filtros viven en la URL, así se pueden compartir. */
export function Filtros({ provincias, actual }: { provincias: string[]; actual: { provincia?: string; tipo?: string; abiertas?: string; archivo?: string } }) {
  const c = "rounded-md border border-[var(--mf-line)] bg-white px-2 py-1";
  return (
    <form className="flex flex-wrap items-end gap-3 text-sm">
      <label>Provincia<br />
        <select name="provincia" defaultValue={actual.provincia ?? ""} className={c}>
          <option value="">Todo el país</option>
          {provincias.map((p) => <option key={p}>{p}</option>)}
        </select>
      </label>
      <label>Tipo<br />
        <select name="tipo" defaultValue={actual.tipo ?? ""} className={c}>
          <option value="">Todas</option>
          {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1"><input type="checkbox" name="abiertas" value="1" defaultChecked={actual.abiertas === "1"} /> Abiertas hoy</label>
      <label className="flex items-center gap-1"><input type="checkbox" name="archivo" value="1" defaultChecked={actual.archivo === "1"} /> Incluir el archivo</label>
      <button className="rounded-md bg-[var(--mf-ink)] px-3 py-1 text-white">Filtrar</button>
    </form>
  );
}
```

`apps/muestras/components/mapa/mapa-nacional-cliente.tsx` (el `dynamic` con `ssr:false` sólo se permite en un componente cliente):
```tsx
"use client";

import dynamic from "next/dynamic";
import type { PuntoMapa } from "./mapa-nacional";

const Mapa = dynamic(() => import("./mapa-nacional"), { ssr: false, loading: () => <div className="h-[60vh] min-h-80 rounded-md bg-[var(--mf-line)]" /> });

export function MapaNacionalCliente({ puntos }: { puntos: PuntoMapa[] }) {
  return <Mapa puntos={puntos} />;
}
```

`apps/muestras/app/page.tsx`:
```tsx
import Link from "next/link";
import { ACTIVITY_TYPE_LABELS, applyFilter, isActivityType, toArDay, type ActivityType } from "@repo/muestras";
import { EstadoActividad } from "@/components/ficha/estado";
import { Filtros } from "@/components/listado/filtros";
import { MapaNacionalCliente } from "@/components/mapa/mapa-nacional-cliente";
import { listarPublicas } from "@/lib/actividades/consultas";

export const revalidate = 300;

type Busqueda = { provincia?: string; tipo?: string; abiertas?: string; archivo?: string };

export default async function Inicio({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const sp = await searchParams;
  const ahora = new Date();
  const todas = await listarPublicas();
  const lista = applyFilter(todas, {
    province: sp.provincia || undefined,
    type: isActivityType(sp.tipo) ? sp.tipo : undefined,
    openNow: sp.abiertas === "1",
    includeClosed: sp.archivo === "1",
  }, ahora);
  const provincias = [...new Set(todas.map((a) => a.province).filter((p): p is string => !!p))].sort((a, b) => a.localeCompare(b, "es"));
  const puntos = lista.flatMap((a) => (a.latitude != null && a.longitude != null && !a.isCancelled
    ? [{ slug: a.slug, title: a.title, latitude: a.latitude, longitude: a.longitude, etiqueta: `${toArDay(a.startsAt)} al ${toArDay(a.endsAt)}${a.city ? ` · ${a.city}` : ""}` }]
    : []));

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--mf-serif)] text-4xl">Muestras Fotográficas</h1>
          <p className="text-[var(--mf-muted)]">Las muestras y actividades de fotografía de todo el país, en un mapa.</p>
        </div>
        <Link href="/proponer" className="rounded-md bg-[var(--mf-accent)] px-4 py-2 text-white">Proponé tu muestra</Link>
      </header>
      <Filtros provincias={provincias} actual={sp} />
      <MapaNacionalCliente puntos={puntos} />
      {lista.length === 0 ? <p>No hay actividades con esos filtros.</p> : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((a) => (
            <li key={a.id} className="overflow-hidden rounded-md border border-[var(--mf-line)] bg-white">
              <Link href={`/m/${a.slug}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {a.coverImageUrl ? <img src={a.coverImageUrl} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" /> : null}
                <div className="space-y-1 p-3">
                  <EstadoActividad startsAt={a.startsAt} endsAt={a.endsAt} isCancelled={a.isCancelled} ahora={ahora} />
                  <h2 className="text-lg font-medium">{a.title}</h2>
                  <p className="text-sm text-[var(--mf-muted)]">
                    {ACTIVITY_TYPE_LABELS[a.type as ActivityType] ?? a.type} · {toArDay(a.startsAt)} al {toArDay(a.endsAt)}
                    {a.isVirtualOnly ? " · Virtual" : a.city ? ` · ${a.city}, ${a.province ?? ""}` : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```
Nota: `toArDay` muestra `AAAA-MM-DD`; si se prefiere "5 nov", agregar en `packages/muestras/src/dates.ts` una `formatArDay(d: Date): string` con `Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "America/Argentina/Buenos_Aires" })` y su test, y usarla acá y en la ficha.

- [ ] **Step 4: Ficha pública**

`apps/muestras/app/m/[slug]/page.tsx`:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ACTIVITY_TYPE_LABELS, toArDay, visibleWorks, type ActivityType } from "@repo/muestras";
import { EstadoActividad } from "@/components/ficha/estado";
import { Galeria } from "@/components/ficha/galeria";
import { buscarPorSlug } from "@/lib/actividades/consultas";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await buscarPorSlug((await params).slug);
  if (!a) return {};
  return {
    title: a.title,
    description: a.description.slice(0, 160),
    openGraph: { title: a.title, description: a.description.slice(0, 160), images: a.coverImageUrl ? [a.coverImageUrl] : [] },
  };
}

export default async function Ficha({ params }: Props) {
  const a = await buscarPorSlug((await params).slug);
  if (!a) notFound();
  const ahora = new Date();
  const { works, isPartial } = visibleWorks(a, a.works, ahora);
  const mapa = a.latitude != null && a.longitude != null
    ? `https://www.openstreetmap.org/?mlat=${a.latitude}&mlon=${a.longitude}#map=17/${a.latitude}/${a.longitude}`
    : null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <Link href="/" className="text-sm underline">← Todas las muestras</Link>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {a.coverImageUrl ? <img src={a.coverImageUrl} alt="" className="max-h-[60vh] w-full rounded-md object-cover" /> : null}
      <header className="space-y-2">
        <EstadoActividad startsAt={a.startsAt} endsAt={a.endsAt} isCancelled={a.isCancelled} ahora={ahora} />
        <h1 className="font-[family-name:var(--mf-serif)] text-4xl">{a.title}</h1>
        <p className="text-[var(--mf-muted)]">{ACTIVITY_TYPE_LABELS[a.type as ActivityType] ?? a.type} · Organiza: {a.organizersText}</p>
      </header>
      {a.isCancelled ? <p className="rounded-md bg-red-50 p-3 text-red-900">Esta actividad se suspendió.</p> : null}
      <dl className="grid gap-3 rounded-md border border-[var(--mf-line)] bg-white p-4 sm:grid-cols-2">
        <div><dt className="text-sm text-[var(--mf-muted)]">Fechas</dt><dd>{toArDay(a.startsAt)} al {toArDay(a.endsAt)}</dd></div>
        {a.openingAt ? <div><dt className="text-sm text-[var(--mf-muted)]">Inauguración</dt><dd>{toArDay(a.openingAt)}</dd></div> : null}
        <div><dt className="text-sm text-[var(--mf-muted)]">Horarios</dt><dd>{a.scheduleText}</dd></div>
        <div><dt className="text-sm text-[var(--mf-muted)]">Entrada</dt><dd>{a.priceText || "Libre y gratuita"}</dd></div>
        <div className="sm:col-span-2"><dt className="text-sm text-[var(--mf-muted)]">Lugar</dt>
          <dd>{a.isVirtualOnly ? "Sólo virtual" : <>{a.venueName ? `${a.venueName} · ` : ""}{a.address}{a.city ? `, ${a.city}` : ""}{a.province ? `, ${a.province}` : ""}{mapa ? <> · <a href={mapa} className="underline" target="_blank" rel="noreferrer">Ver en el mapa</a></> : null}</>}</dd>
        </div>
        {a.externalUrl ? <div className="sm:col-span-2"><a href={a.externalUrl} className="underline" target="_blank" rel="noreferrer">Más información</a></div> : null}
      </dl>
      <div className="whitespace-pre-line">{a.description}</div>
      {a.type === "MUESTRA" && works.length > 0 ? <Galeria obras={works} parcial={isPartial} /> : null}
    </main>
  );
}
```

- [ ] **Step 5: Probar**

Run: `pnpm --filter muestras check-types && pnpm --filter muestras dev`
Con una actividad aprobada (aprobarla a mano en la base de prueba o esperar a la Task 11):
Expected: en `/` aparece en el mapa y en la lista; los filtros cambian la URL y el resultado; `/m/<slug>` muestra la ficha; con la muestra abierta se ven sólo las destacadas y el cartel "Estás viendo una selección"; el visor abre, navega con flechas y cierra con Escape. Revisar en ancho de teléfono (375 px) que no haya scroll horizontal.

- [ ] **Step 6: Commit**

```bash
git add apps/muestras
git commit -m "Mapa nacional, listado con filtros y ficha pública con galería"
```

---

### Task 11: Bandeja de aprobación y correos

**Files:**
- Create: `apps/muestras/app/admin/page.tsx`, `apps/muestras/components/admin/acciones-revision.tsx`
- Modify: `apps/muestras/lib/correos/enviar.ts` (reemplaza el provisorio)
- Create: `apps/muestras/lib/correos/compuerta.ts`
- Test: `apps/muestras/lib/correos/compuerta.test.ts`

**Interfaces:**
- Consumes: `listarParaRevisar` (Task 8), `aprobar`, `rechazar`, `despublicar`, `republicar` (Task 8), `requireSuperAdmin` (Task 6).
- Produces: `compuertaDeEnvio(env?): { puede: true; apiKey: string; from: string } | { puede: false; motivo: string }`; `avisarNuevaPropuesta(id)`, `avisarAprobada(id)`, `avisarRechazada(id)` — nunca tiran error.

- [ ] **Step 1: Test de la compuerta (falla)**

`apps/muestras/lib/correos/compuerta.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { compuertaDeEnvio } from "./compuerta";

describe("compuertaDeEnvio", () => {
  const llaves = { RESEND_API_KEY: "re_x", MUESTRAS_CORREOS_EN_VIVO: "true", MUESTRAS_EMAIL_FROM: "Muestras <hola@muestrasfotograficas.com>" };
  it("con las dos llaves y remitente, envía", () => expect(compuertaDeEnvio(llaves)).toEqual({ puede: true, apiKey: "re_x", from: llaves.MUESTRAS_EMAIL_FROM }));
  it("sin clave no envía", () => expect(compuertaDeEnvio({ ...llaves, RESEND_API_KEY: "" }).puede).toBe(false));
  it("el interruptor tiene que decir exactamente true", () => expect(compuertaDeEnvio({ ...llaves, MUESTRAS_CORREOS_EN_VIVO: "1" }).puede).toBe(false));
  it("sin remitente no envía", () => expect(compuertaDeEnvio({ ...llaves, MUESTRAS_EMAIL_FROM: "" }).puede).toBe(false));
});
```

Run: `pnpm --filter muestras test`
Expected: FAIL — no existe `./compuerta`.

- [ ] **Step 2: Implementar compuerta y correos**

`apps/muestras/lib/correos/compuerta.ts`:
```ts
/**
 * Nada sale hasta que alguien lo enciende, y hacen falta dos llaves: la clave de Resend y el
 * interruptor propio escrito exactamente `true`. Mismo criterio que SubiLaFoto.
 */
export type Compuerta = { puede: true; apiKey: string; from: string } | { puede: false; motivo: string };

export function compuertaDeEnvio(env: Readonly<Record<string, string | undefined>> = process.env): Compuerta {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) return { puede: false, motivo: "Falta RESEND_API_KEY." };
  if (env.MUESTRAS_CORREOS_EN_VIVO !== "true") return { puede: false, motivo: 'MUESTRAS_CORREOS_EN_VIVO no es exactamente "true".' };
  const from = env.MUESTRAS_EMAIL_FROM?.trim();
  if (!from) return { puede: false, motivo: "Falta MUESTRAS_EMAIL_FROM." };
  return { puede: true, apiKey, from };
}
```

`apps/muestras/lib/correos/enviar.ts`:
```ts
import "server-only";
import { Resend } from "resend";
import { prisma } from "@repo/db";
import { compuertaDeEnvio } from "./compuerta";

const APP_URL = process.env.APP_URL?.trim() || "https://muestrasfotograficas.com";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Nunca tira: un correo que no sale no puede deshacer una aprobación. */
async function enviar(to: string, subject: string, parrafos: string[], enlace?: { texto: string; url: string }) {
  const c = compuertaDeEnvio();
  if (!c.puede) { console.info("[muestras] correo no enviado:", c.motivo, subject); return; }
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#1b1a17">${parrafos.map((p) => `<p>${esc(p)}</p>`).join("")}${enlace ? `<p><a href="${enlace.url}" style="color:#b4432c">${esc(enlace.texto)}</a></p>` : ""}<p style="color:#6b665c;font-size:13px">Muestras Fotográficas</p></div>`;
  const text = [...parrafos, enlace ? `${enlace.texto}: ${enlace.url}` : ""].join("\n\n");
  try {
    await new Resend(c.apiKey).emails.send({ from: c.from, to, subject, html, text });
  } catch (err) {
    console.error("[muestras] falló el envío", subject, err);
  }
}

async function datos(id: string) {
  const a = await prisma.culturalActivity.findUnique({ where: { id }, select: { title: true, slug: true, rejectionReason: true, proposedByUserId: true } });
  if (!a) return null;
  const u = await prisma.user.findUnique({ where: { id: a.proposedByUserId }, select: { email: true, name: true } });
  return u ? { ...a, email: u.email, nombre: u.name } : null;
}

export async function avisarNuevaPropuesta(id: string): Promise<void> {
  const d = await datos(id);
  if (!d) return;
  const admins = await prisma.user.findMany({ where: { globalRole: "SUPER_ADMIN" }, select: { email: true } });
  for (const a of admins) {
    await enviar(a.email, `Nueva propuesta: ${d.title}`, [`${d.nombre ?? d.email} propuso "${d.title}".`], { texto: "Revisarla", url: `${APP_URL}/admin` });
  }
}

export async function avisarAprobada(id: string): Promise<void> {
  const d = await datos(id);
  if (!d) return;
  await enviar(d.email, `Publicamos "${d.title}"`, [`¡Hola${d.nombre ? ` ${d.nombre}` : ""}! Tu actividad "${d.title}" ya está publicada en el mapa de Muestras Fotográficas.`], { texto: "Verla publicada", url: `${APP_URL}/m/${d.slug}` });
}

export async function avisarRechazada(id: string): Promise<void> {
  const d = await datos(id);
  if (!d) return;
  await enviar(d.email, `Revisamos "${d.title}"`, [`¡Hola${d.nombre ? ` ${d.nombre}` : ""}! Revisamos "${d.title}" y todavía no la podemos publicar.`, `Motivo: ${d.rejectionReason ?? "sin detalle"}.`, "Podés corregirla y volver a enviarla."], { texto: "Corregirla", url: `${APP_URL}/mis-muestras` });
}
```
Verificar que el campo `User.globalRole` acepta el filtro `"SUPER_ADMIN"` (es enum en el schema de `User`; si el tipo no coincide, usar el valor del enum importado de `@repo/db`).

- [ ] **Step 3: Bandeja**

`apps/muestras/components/admin/acciones-revision.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { aprobar, despublicar, rechazar, republicar } from "@/lib/actividades/acciones";

export function AccionesRevision({ id, estado }: { id: string; estado: string }) {
  const [pendiente, start] = useTransition();
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const correr = (f: () => Promise<{ ok: boolean; errores?: string[] }>) =>
    start(async () => { const r = await f(); setError(r.ok ? null : (r.errores ?? []).join(" ")); });

  return (
    <div className="space-y-2">
      {estado === "IN_REVIEW" ? (
        <>
          <button disabled={pendiente} className="rounded-md bg-green-700 px-3 py-1 text-white" onClick={() => correr(() => aprobar(id))}>Aprobar y publicar</button>
          <div className="flex gap-2">
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo del rechazo" className="flex-1 rounded-md border px-2 py-1" />
            <button disabled={pendiente} className="rounded-md border border-red-700 px-3 py-1 text-red-700" onClick={() => correr(() => rechazar(id, motivo))}>Rechazar</button>
          </div>
        </>
      ) : null}
      {estado === "APPROVED" ? <button disabled={pendiente} className="rounded-md border px-3 py-1" onClick={() => correr(() => despublicar(id))}>Despublicar</button> : null}
      {estado === "UNPUBLISHED" ? <button disabled={pendiente} className="rounded-md border px-3 py-1" onClick={() => correr(() => republicar(id))}>Volver a publicar</button> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
```

`apps/muestras/app/admin/page.tsx`:
```tsx
import Link from "next/link";
import { ACTIVITY_TYPE_LABELS, REVIEW_STATUS_LABELS, toArDay, type ActivityType, type ReviewStatus } from "@repo/muestras";
import { AccionesRevision } from "@/components/admin/acciones-revision";
import { listarParaRevisar } from "@/lib/actividades/consultas";
import { requireSuperAdmin } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Revisión", robots: { index: false } };

export default async function Admin() {
  await requireSuperAdmin();
  const filas = await listarParaRevisar();
  const pendientes = filas.filter((f) => f.reviewStatus === "IN_REVIEW");
  const resto = filas.filter((f) => f.reviewStatus !== "IN_REVIEW");
  const Tarjeta = ({ f }: { f: (typeof filas)[number] }) => (
    <li className="grid gap-3 rounded-md border border-[var(--mf-line)] bg-white p-4 sm:grid-cols-[1fr_18rem]">
      <div className="space-y-1">
        <p className="text-sm text-[var(--mf-muted)]">{REVIEW_STATUS_LABELS[f.reviewStatus as ReviewStatus]} · {ACTIVITY_TYPE_LABELS[f.type as ActivityType] ?? f.type}</p>
        <h2 className="text-lg font-medium">{f.title}</h2>
        <p className="text-sm">{toArDay(f.startsAt)} al {toArDay(f.endsAt)} · {f.isVirtualOnly ? "Virtual" : `${f.address ?? ""}, ${f.city ?? ""}, ${f.province ?? ""}`}</p>
        <p className="text-sm">Organiza: {f.organizersText}</p>
        <p className="line-clamp-3 text-sm text-[var(--mf-muted)]">{f.description}</p>
        <div className="flex gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {f.works.map((w) => <img key={w.id} src={w.imageUrl} alt="" className="h-14 w-14 object-cover" />)}
        </div>
        <Link href={`/mis-muestras/${f.id}`} className="text-sm underline">Ver o corregir la ficha completa</Link>
      </div>
      <AccionesRevision id={f.id} estado={f.reviewStatus} />
    </li>
  );
  return (
    <main className="mx-auto max-w-5xl space-y-8 p-4 sm:p-8">
      <h1 className="font-[family-name:var(--mf-serif)] text-3xl">Revisión</h1>
      <section className="space-y-3">
        <h2 className="text-xl">Para revisar ({pendientes.length})</h2>
        {pendientes.length ? <ul className="space-y-3">{pendientes.map((f) => <Tarjeta key={f.id} f={f} />)}</ul> : <p>No hay propuestas pendientes.</p>}
      </section>
      <section className="space-y-3">
        <h2 className="text-xl">Publicadas y despublicadas</h2>
        <ul className="space-y-3">{resto.map((f) => <Tarjeta key={f.id} f={f} />)}</ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Correr tests, tipos y probar**

Run: `pnpm --filter muestras test && pnpm --filter muestras check-types`
Expected: PASS.

Run: `pnpm --filter muestras dev`. Con la cuenta super admin (`cuart.daniel@gmail.com`) abrir `/admin`: aprobar la propuesta de la Task 9.
Expected: desaparece de "Para revisar", aparece en el mapa y en `/m/<slug>`; en la consola del servidor se ve `[muestras] correo no enviado: ... MUESTRAS_CORREOS_EN_VIVO ...` (correos apagados en local). Rechazar otra con motivo → en `/mis-muestras` aparece "Rechazada" con el motivo. Con una cuenta que no es super admin, `/admin` redirige a `/`.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Bandeja de aprobación y avisos por mail de Muestras"
```

---

### Task 12: Verificación final y puesta en producción (con Daniel)

**Files:**
- Create: `apps/muestras/app/privacidad/page.tsx`, `apps/muestras/app/terminos/page.tsx` (los enlaza el login)
- Create: `docs/operations/muestras-puesta-en-marcha.md`

- [ ] **Step 1: Páginas legales mínimas**

`apps/muestras/app/privacidad/page.tsx`:
```tsx
export const metadata = { title: "Privacidad" };
export default function Privacidad() {
  return (
    <main className="prose mx-auto max-w-2xl p-4 sm:p-8">
      <h1>Privacidad</h1>
      <p>Guardamos tu nombre y tu email de Google para identificarte cuando proponés una actividad y para avisarte cuando la revisamos. No los compartimos con terceros.</p>
      <p>Las actividades publicadas, sus fotos y los nombres de los organizadores y autores son públicos.</p>
      <p>Para pedir la baja de tus datos escribinos a la dirección que figura en los correos que te enviamos.</p>
    </main>
  );
}
```
`apps/muestras/app/terminos/page.tsx`:
```tsx
export const metadata = { title: "Términos" };
export default function Terminos() {
  return (
    <main className="prose mx-auto max-w-2xl p-4 sm:p-8">
      <h1>Términos</h1>
      <p>Al proponer una actividad declarás que la información es verdadera y que tenés autorización de los autores para publicar las imágenes, con su crédito.</p>
      <p>Revisamos cada propuesta antes de publicarla y podemos despublicar cualquier contenido que no corresponda.</p>
    </main>
  );
}
```

- [ ] **Step 2: Todos los chequeos**

Run: `pnpm --filter @repo/muestras test && pnpm --filter muestras test && pnpm --filter muestras check-types && pnpm --filter muestras lint && pnpm --filter fotoffice typecheck && pnpm --filter muestras build`
Expected: todo en verde. El build tiene que terminar sin errores (si se queda sin memoria, ver la memoria "Typecheck muere por memoria"; reintentar con `NODE_OPTIONS=--max-old-space-size=6144`).

- [ ] **Step 3: Recorrido completo en local**

Con `pnpm --filter muestras dev`, en el navegador: proponer (usuario común) → ver "En revisión" → aprobar (super admin) → verla en el mapa, en el listado filtrado por su provincia y en su ficha → editarla publicada y ver el cambio sin volver a revisión → marcarla cancelada y ver el cartel → despublicar y comprobar que `/m/<slug>` da 404. Repetir la ficha en 375 px de ancho.

- [ ] **Step 4: Guía de puesta en marcha**

`docs/operations/muestras-puesta-en-marcha.md` con estos pasos para Daniel, en orden, cada uno marcado como "lo hace Daniel" o "lo hace Claude con permiso":
1. Comprar `muestrasfotograficas.com` (y ver `.com.ar`). — Daniel.
2. Aplicar la migración `20261025120000_muestras_etapa_1` (Task 4, Step 6). — Claude con permiso.
3. Crear el proyecto de Vercel `muestras` apuntando a `apps/muestras` del repo `compramelafoto/dnx-suite`, con Root Directory `apps/muestras` y las variables: `DATABASE_URL` (rama `development`, la misma de FOTOFFICE), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL=https://muestrasfotograficas.com`, `NEXT_PUBLIC_APP_URL` (igual), `R2_*` (las de FOTOFFICE), `RESEND_API_KEY` (sensible), `MUESTRAS_EMAIL_FROM`, `MUESTRAS_CORREOS_EN_VIVO=false` al principio, `GEOCODING_USER_AGENT`. Desactivar los deploys de Preview. — Claude con permiso (token en `services/dnx-mcp/.env.local`).
4. Conectar el dominio en Vercel y los registros DNS. — Daniel o Claude con permiso.
5. Agregar `https://muestrasfotograficas.com/api/auth/google/callback` como URI de redirección en el cliente OAuth de Google que usa la suite. — Daniel (consola de Google).
6. Verificar el dominio en Resend y recién entonces poner `MUESTRAS_CORREOS_EN_VIVO=true`. — Daniel.
7. Cargar 2 o 3 muestras reales de SFPR para que el mapa no arranque vacío. — Daniel con ayuda.

- [ ] **Step 5: Commit y PR**

```bash
git add apps/muestras docs/operations/muestras-puesta-en-marcha.md
git commit -m "Páginas legales y guía de puesta en marcha de Muestras"
git push -u origin <rama>
gh pr create --title "Muestras Fotográficas — Etapa 1" --body "<resumen en español + checklist de puesta en marcha>"
```
