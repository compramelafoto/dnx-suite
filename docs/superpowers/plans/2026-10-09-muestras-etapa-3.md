# Muestras Fotográficas — Etapa 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el organizador de una muestra abra una convocatoria online, los fotógrafos envíen obras, un equipo curatorial las puntúe sin ver quién las hizo, y con las elegidas se arme la galería de la muestra.

**Architecture:** Igual que las etapas 1 y 2: las reglas (fases y transiciones de la convocatoria, códigos anónimos, orden por curador, proyección anónima, ranking, plan de armado) son funciones puras en `packages/muestras` con vitest; la app es una capa delgada sobre `@repo/db`. Cinco tablas nuevas (`CulturalCall*`) con migración escrita a mano. La imagen que ve un curador nunca sale con su URL del bucket: la sirve una ruta propia que verifica sesión y permiso. Correos por la compuerta de la etapa 1, con envío en lote de Resend para los masivos.

**Tech Stack:** Next.js 16.2.1 (App Router, `params` como Promise, `--webpack`), React 19.2.4, Prisma 6 (`@repo/db`), Tailwind 4, sharp 0.34, `@aws-sdk/client-s3` (ya en la app: suma `GetObjectCommand`), resend 6 (`batch.send`), vitest 3. **Sin dependencias nuevas.**

**Spec:** `docs/superpowers/specs/2026-10-09-muestras-etapa-3-design.md` (decisiones D1–D22). Diseño general: `docs/superpowers/specs/2026-10-08-muestras-fotograficas-design.md`.

## Global Constraints

- Todo texto visible y todo comentario en **español rioplatense**; identificadores en inglés dentro de `packages/muestras`, en español en la app.
- Estados como **texto** (`String`), nunca enum de Prisma. Ids de usuario `Int` **sin relación Prisma a `User`**. Ids `cuid()`.
- Fechas en **hora argentina (UTC−3)** con `dayStartAr`, `dayEndAr`, `toArDay`, `formatArDay` de `@repo/muestras`. Nunca `toLocaleDateString` sin zona.
- **Sin dependencias nuevas** ni versiones fuera del lockfile. Después de cualquier `pnpm install`, `git diff pnpm-lock.yaml` tiene que estar vacío; si se mueve, frenar y avisar.
- Chequeos de tipos y build con `NODE_OPTIONS=--max-old-space-size=8192` (si no, el proceso muere por memoria y a veces devuelve éxito igual). Mirar que el build realmente terminó.
- Diseño: tokens de `apps/muestras/app/globals.css` (`--mf-bg`, `--mf-ink`, `--mf-muted`, `--mf-line`, `--mf-surface`, `--mf-teal`, `--mf-spot`, `--mf-alerta`), `.mf-titulo`, `.mf-marco`, líneas finas, botones finos (`h-11 border border-[var(--mf-ink)] px-5`), esquinas `rounded-[2px]`. Nada de cajas de color. Las clases repetidas van en `components/convocatorias/estilos.ts`.
- **Autorización del lado del servidor en cada página, acción y ruta.** Cada `page.tsx` llama `requireUsuario(<su propia ruta>)`; cada server action vuelve a leer la sesión y verifica dueño / curador / estado. Las escrituras de estado van condicionadas al estado leído (`updateMany where status = …`).
- **Anonimato:** ninguna respuesta a un curador (ni al organizador antes de `DONE`) lleva `userId`, `authorName`, `submissionId`, email ni la URL del bucket. Las imágenes van siempre por `/api/curaduria/obras/<id>/imagen`. La vigilancia es `leakedFields` + test.
- En páginas públicas **no** aparecen palabras de revisión ni aprobación.
- Topes de la galería: `MAX_WORKS = 40`, `MAX_HIGHLIGHTS = 12` (etapa 1).
- Correos sólo por `lib/correos/*` (compuerta `MUESTRAS_CORREOS_EN_VIVO` + `RESEND_API_KEY` + `MUESTRAS_EMAIL_FROM`). Nunca tiran.
- Puerto de desarrollo **3014**. Probar con `next dev` (las vistas previas de Vercel no sirven).
- Trabajar en el worktree `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-muestras`, rama `feat/muestras-etapa-3` (sale de `origin/main` con las etapas 1 y 2).
- La migración **no se aplica sola**: la aplica **a mano en producción el controlador**, con la autorización que ya dio Daniel, la registra en `_prisma_migrations` con el SHA-256 del archivo, y **antes** de publicar el código (Task 14).

## Mapa de archivos

```
packages/muestras/src/
  call.ts (+ call.test.ts)                 — estados, fases, apertura, edición, transiciones, envíos, conflictos
  curation.ts (+ curation.test.ts)         — códigos anónimos, orden por curador, proyección, ranking, permisos, armado
  panel.ts (+ panel.test.ts)               — Convocatorias y Curaduría listas, "Mis envíos"
  index.ts                                 — reexporta call y curation
packages/db/prisma/schema.prisma           — CulturalCall, CulturalCallSubmission, CulturalCallWork, CulturalCallCurator, CulturalCallScore
packages/db/prisma/migrations/20261028120000_muestras_etapa_3_convocatorias/migration.sql
apps/muestras/
  lib/limite.ts                            — frenos nuevos
  lib/imagenes/r2.ts                       — leerDeR2
  lib/imagenes/procesar.test.ts            — prueba de que no viaja el EXIF
  lib/curaduria/token.ts (+ .test.ts)      — token de invitación y su hash
  lib/correos/enviar.ts                    — exporta enviar, APP_URL; suma enviarEnLote
  lib/correos/textos-convocatoria.ts (+ .test.ts), lib/correos/convocatorias.ts
  lib/convocatorias/mapear.ts (+ .test.ts), consultas.ts, acciones.ts (+ .test.ts)
  lib/envios/mapear.ts (+ .test.ts), consultas.ts, acciones.ts (+ .test.ts)
  lib/curaduria/acciones.ts (+ .test.ts), consultas.ts, imagen.ts (+ .test.ts)
  lib/seleccion/consultas.ts, acciones.ts (+ .test.ts)
  lib/panel/en-preparacion.ts              — sin Convocatorias ni Curaduría
  app/api/curaduria/obras/[id]/imagen/route.ts
  app/convocatorias/page.tsx, app/convocatorias/[slug]/page.tsx, app/convocatorias/[slug]/enviar/page.tsx
  app/panel/envios/page.tsx
  app/panel/convocatorias/page.tsx, [id]/page.tsx, [id]/seleccion/page.tsx
  app/panel/curaduria/page.tsx, [id]/page.tsx, invitacion/[token]/page.tsx
  components/convocatorias/{estilos.ts, formulario-convocatoria.tsx, acciones-convocatoria.tsx, equipo-curatorial.tsx, crear-convocatoria.tsx}
  components/envios/formulario-envio.tsx
  components/curaduria/{visor-curaduria.tsx, aceptar-invitacion.tsx}
  components/seleccion/tabla-seleccion.tsx
  components/encabezado/encabezado.tsx, components/pie/pie.tsx — enlace "Convocatorias"
```

Orden: 1 → 2 → 3 → 4 (schema) → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 (cada una compila sobre las anteriores). Desde la Task 5 todo usa el cliente Prisma con los modelos nuevos (Task 4). Los tests de la app mockean `@repo/db`, `@/lib/usuario`, `next/cache` y los correos, con el mismo patrón que `lib/actividades/acciones.test.ts`.

---
### Task 1: Reglas de la convocatoria (estados, fases, apertura, envíos)

**Files:**
- Create: `packages/muestras/src/call.ts`
- Modify: `packages/muestras/src/index.ts`
- Test: `packages/muestras/src/call.test.ts`

**Interfaces:**
- Consumes: `dayStartAr`, `toArDay` (etapa 1, `dates.ts`).
- Produces:
  - `CALL_STATUSES`, `CallStatus`, `CALL_STATUS_LABELS`, `isCallStatus(v)`, `SUBMISSION_STATUSES`, `SubmissionStatus`
  - `MAX_WORKS_PER_PERSON_LIMIT = 10`, `DEFAULT_WORKS_PER_PERSON = 3`, `CALL_TEXT_LIMITS`
  - `CallPhase = "DRAFT"|"UPCOMING"|"RECEIVING"|"ENDED"|"CLOSED"|"CURATING"|"DONE"`, `callPhase(c: { status; opensAt; closesAt }, now)`, `isListedPhase`, `hasPublicPage`, `acceptsSubmissions`, `CALL_PHASE_PUBLIC_TEXT`
  - `CallDraft`, `missingForOpening(d, today: "YYYY-MM-DD"): string[]`, `editableCallFields(status)`, `closeDayProblem(status, previousClosesAt, nextClosesDay): string | null`
  - `CallAction = "open"|"close"|"startCuration"|"closeCuration"|"unpublish"`, `nextCallStatus`, `CallActor`, `CallForAction` (`+ ownerUserId`), `CallActionContext`, `CallPermission`, `canCallAction(action, c, actor, ctx)`
  - `SubmissionDraft`, `submissionProblems(d, maxWorks): string[]`, `submitterConflict({ isOwner, isCurator }): string | null`

- [ ] **Step 1: Escribir el test que falla**

`packages/muestras/src/call.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { dayEndAr, dayStartAr } from "./dates";
import {
  acceptsSubmissions, callPhase, canCallAction, closeDayProblem, editableCallFields, hasPublicPage, isListedPhase,
  missingForOpening, nextCallStatus, submissionProblems, submitterConflict, type CallActionContext,
} from "./call";

const fechas = { opensAt: dayStartAr("2026-11-01"), closesAt: dayEndAr("2026-11-30") };
const antes = new Date("2026-10-20T15:00:00Z");
const durante = new Date("2026-11-15T15:00:00Z");
// 30/11 a las 23:30 hora argentina todavía recibe.
const ultimoMinuto = new Date("2026-12-01T02:30:00Z");
const despues = new Date("2026-12-01T03:00:00Z");

describe("fase de la convocatoria", () => {
  it("abierta se divide por fechas en hora argentina", () => {
    expect(callPhase({ status: "OPEN", ...fechas }, antes)).toBe("UPCOMING");
    expect(callPhase({ status: "OPEN", ...fechas }, durante)).toBe("RECEIVING");
    expect(callPhase({ status: "OPEN", ...fechas }, ultimoMinuto)).toBe("RECEIVING");
    expect(callPhase({ status: "OPEN", ...fechas }, despues)).toBe("ENDED");
  });
  it("los estados posteriores se respetan y lo desconocido es borrador", () => {
    expect(callPhase({ status: "CURATING", ...fechas }, durante)).toBe("CURATING");
    expect(callPhase({ status: "RARO", ...fechas }, durante)).toBe("DRAFT");
  });
  it("qué se lista, qué tiene página y qué recibe", () => {
    expect(isListedPhase("UPCOMING")).toBe(true);
    expect(isListedPhase("ENDED")).toBe(false);
    expect(hasPublicPage("DONE")).toBe(true);
    expect(hasPublicPage("DRAFT")).toBe(false);
    expect(acceptsSubmissions("RECEIVING")).toBe(true);
    expect(acceptsSubmissions("ENDED")).toBe(false);
  });
});

describe("abrir la convocatoria", () => {
  const ok = { title: "Ciudad", basesText: "Bases", rightsText: "Autorizo", opensDay: "2026-11-01", closesDay: "2026-11-30", maxWorksPerPerson: 3 };
  it("completa no tiene faltantes", () => expect(missingForOpening(ok, "2026-10-20")).toEqual([]));
  it("explica cada faltante", () => {
    const r = missingForOpening({ ...ok, title: " ", basesText: "", rightsText: "", opensDay: "", closesDay: "2026-02-30", maxWorksPerPerson: 0 }, "2026-10-20");
    expect(r).toEqual([
      "Falta el título de la convocatoria.",
      "Faltan las bases.",
      "Falta el texto de autorización de derechos.",
      "Falta la fecha en que empieza a recibir obras.",
      "Falta la fecha de cierre.",
      "Cada persona puede enviar entre 1 y 10 obras.",
    ]);
  });
  it("cierre antes de la apertura o ya pasado", () => {
    expect(missingForOpening({ ...ok, closesDay: "2026-10-30" }, "2026-10-20")).toContain("La fecha de cierre es anterior a la de apertura.");
    expect(missingForOpening(ok, "2026-12-01")).toContain("La fecha de cierre ya pasó.");
  });
});

describe("edición según el estado", () => {
  it("en borrador todo, abierta sólo textos y cierre, después nada", () => {
    expect(editableCallFields("DRAFT")).toContain("maxWorksPerPerson");
    expect(editableCallFields("OPEN")).toEqual(["title", "basesText", "requirementsText", "closesDay"]);
    expect(editableCallFields("CLOSED")).toEqual([]);
  });
  it("abierta, el cierre sólo se estira", () => {
    expect(closeDayProblem("OPEN", fechas.closesAt, "2026-11-29")).toMatch(/sólo se puede estirar/);
    expect(closeDayProblem("OPEN", fechas.closesAt, "2026-11-30")).toBeNull();
    expect(closeDayProblem("OPEN", fechas.closesAt, "2026-12-10")).toBeNull();
    expect(closeDayProblem("DRAFT", fechas.closesAt, "2026-01-01")).toBeNull();
  });
});

describe("transiciones", () => {
  const ctx: CallActionContext = { now: durante, activeSubmissions: 0, activeCurators: 0, works: 0, missingForOpening: [] };
  const dueno = { userId: 7, isSuperAdmin: false };
  const otro = { userId: 8, isSuperAdmin: false };
  const admin = { userId: 1, isSuperAdmin: true };
  const conv = (status: string) => ({ status, ownerUserId: 7, ...fechas });

  it("siguiente estado", () => {
    expect(nextCallStatus("open", "DRAFT")).toBe("OPEN");
    expect(nextCallStatus("closeCuration", "CURATING")).toBe("DONE");
    expect(() => nextCallStatus("close", "DRAFT")).toThrow();
  });
  it("sólo el dueño o el super admin", () => {
    expect(canCallAction("open", conv("DRAFT"), otro, ctx)).toEqual({ ok: false, reason: "Sólo quien organiza la muestra puede hacer esto." });
    expect(canCallAction("open", conv("DRAFT"), dueno, ctx)).toEqual({ ok: true });
    expect(canCallAction("open", conv("DRAFT"), admin, ctx)).toEqual({ ok: true });
  });
  it("abrir exige estar completa", () => {
    expect(canCallAction("open", conv("DRAFT"), dueno, { ...ctx, missingForOpening: ["Faltan las bases."] })).toEqual({ ok: false, reason: "Faltan las bases." });
  });
  it("cerrar sólo después de la fecha de cierre", () => {
    expect(canCallAction("close", conv("OPEN"), dueno, ctx).ok).toBe(false);
    expect(canCallAction("close", conv("OPEN"), dueno, { ...ctx, now: despues }).ok).toBe(true);
  });
  it("empezar la curaduría exige obras y un curador activo", () => {
    expect(canCallAction("startCuration", conv("CLOSED"), dueno, { ...ctx, works: 0, activeCurators: 1 })).toEqual({ ok: false, reason: "No hay obras para curar." });
    expect(canCallAction("startCuration", conv("CLOSED"), dueno, { ...ctx, works: 5, activeCurators: 0 }).ok).toBe(false);
    expect(canCallAction("startCuration", conv("CLOSED"), dueno, { ...ctx, works: 5, activeCurators: 1 }).ok).toBe(true);
  });
  it("volver a borrador: el dueño sin envíos, el super admin siempre", () => {
    expect(canCallAction("unpublish", conv("OPEN"), dueno, { ...ctx, activeSubmissions: 2 }).ok).toBe(false);
    expect(canCallAction("unpublish", conv("OPEN"), dueno, ctx).ok).toBe(true);
    expect(canCallAction("unpublish", conv("OPEN"), admin, { ...ctx, activeSubmissions: 2 }).ok).toBe(true);
  });
  it("un estado que no corresponde se rechaza", () => {
    expect(canCallAction("closeCuration", conv("OPEN"), dueno, ctx).ok).toBe(false);
  });
});

describe("envíos", () => {
  const obra = { imageUrl: "https://x/muestras/7/a.webp", title: "Una" };
  const ok = { authorName: "Ana", basesAccepted: true, rightsAccepted: true, works: [obra] };
  it("completo no tiene problemas", () => expect(submissionProblems(ok, 3)).toEqual([]));
  it("respeta el tope por persona", () => {
    expect(submissionProblems({ ...ok, works: [obra, obra] }, 1)).toEqual(["Esta convocatoria recibe una sola obra por persona."]);
    expect(submissionProblems({ ...ok, works: [obra, obra, obra, obra] }, 3)).toEqual(["Esta convocatoria recibe hasta 3 obras por persona."]);
  });
  it("exige nombre, título y las dos aceptaciones", () => {
    expect(submissionProblems({ authorName: "", basesAccepted: false, rightsAccepted: false, works: [{ imageUrl: "u", title: " " }] }, 3)).toEqual([
      "Escribí tu nombre como querés que figure si tu obra queda seleccionada.",
      "Cada obra necesita un título.",
      "Tenés que aceptar las bases.",
      "Tenés que aceptar la autorización de derechos.",
    ]);
  });
  it("organizador y curadores no envían", () => {
    expect(submitterConflict({ isOwner: true, isCurator: false })).toMatch(/Organizás/);
    expect(submitterConflict({ isOwner: false, isCurator: true })).toMatch(/equipo curatorial/);
    expect(submitterConflict({ isOwner: false, isCurator: false })).toBeNull();
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter @repo/muestras test`
Expected: FAIL — `Failed to resolve import "./call"`.

- [ ] **Step 3: Implementar**

`packages/muestras/src/call.ts`:
```ts
import { dayStartAr, toArDay } from "./dates";

/**
 * Convocatorias: el organizador de una muestra abre un llamado online y los fotógrafos envían
 * obras. Estados como texto (mismo criterio que `CulturalActivity.reviewStatus`).
 *
 *   DRAFT → OPEN → CLOSED → CURATING → DONE
 *
 * OPEN se subdivide con las fechas (hora argentina): todavía no recibe, recibe, terminó el plazo.
 * Esas fases se calculan, no se guardan.
 */
export const CALL_STATUSES = ["DRAFT", "OPEN", "CLOSED", "CURATING", "DONE"] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  DRAFT: "Borrador",
  OPEN: "Abierta",
  CLOSED: "Cerrada",
  CURATING: "En curaduría",
  DONE: "Selección terminada",
};

export const SUBMISSION_STATUSES = ["ACTIVE", "WITHDRAWN"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** Tope que puede elegir el organizador para "obras por persona". */
export const MAX_WORKS_PER_PERSON_LIMIT = 10;
export const DEFAULT_WORKS_PER_PERSON = 3;

/** Largos máximos: se recorta en vez de rechazar (mismo criterio que la ficha). */
export const CALL_TEXT_LIMITS = {
  title: 200,
  basesText: 20_000,
  requirementsText: 3_000,
  rightsText: 5_000,
  authorName: 200,
  workTitle: 200,
  technique: 200,
  statement: 600,
  note: 1_000,
} as const;

export function isCallStatus(v: unknown): v is CallStatus {
  return typeof v === "string" && (CALL_STATUSES as readonly string[]).includes(v);
}

export type CallPhase = "DRAFT" | "UPCOMING" | "RECEIVING" | "ENDED" | "CLOSED" | "CURATING" | "DONE";

export type CallDates = { status: string; opensAt: Date; closesAt: Date };

/** En qué momento está la convocatoria. Un estado desconocido se trata como borrador. */
export function callPhase(c: CallDates, now: Date): CallPhase {
  if (c.status === "OPEN") {
    if (now.getTime() < c.opensAt.getTime()) return "UPCOMING";
    if (now.getTime() > c.closesAt.getTime()) return "ENDED";
    return "RECEIVING";
  }
  if (c.status === "CLOSED" || c.status === "CURATING" || c.status === "DONE") return c.status;
  return "DRAFT";
}

/** Lo que se lista en `/convocatorias`. */
export function isListedPhase(p: CallPhase): boolean {
  return p === "UPCOMING" || p === "RECEIVING";
}

/** La página pública existe para todo lo que no es borrador: un enlace compartido no se rompe. */
export function hasPublicPage(p: CallPhase): boolean {
  return p !== "DRAFT";
}

export function acceptsSubmissions(p: CallPhase): boolean {
  return p === "RECEIVING";
}

export const CALL_PHASE_PUBLIC_TEXT: Record<CallPhase, string> = {
  DRAFT: "",
  UPCOMING: "Todavía no recibe obras",
  RECEIVING: "Recibe obras",
  ENDED: "Ya no recibe obras",
  CLOSED: "Ya no recibe obras",
  CURATING: "Selección en curso",
  DONE: "Selección terminada",
};

export type CallDraft = {
  title: string;
  basesText: string;
  rightsText: string;
  opensDay: string;
  closesDay: string;
  maxWorksPerPerson: number;
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
function validDay(d: string): boolean {
  if (!DAY_RE.test(d)) return false;
  try {
    dayStartAr(d);
    return true;
  } catch {
    return false;
  }
}

/** Lo que falta para abrir la convocatoria. `today` es el día argentino de hoy (YYYY-MM-DD). */
export function missingForOpening(d: CallDraft, today: string): string[] {
  const out: string[] = [];
  if (!d.title.trim()) out.push("Falta el título de la convocatoria.");
  if (!d.basesText.trim()) out.push("Faltan las bases.");
  if (!d.rightsText.trim()) out.push("Falta el texto de autorización de derechos.");
  const desde = validDay(d.opensDay);
  const hasta = validDay(d.closesDay);
  if (!desde) out.push("Falta la fecha en que empieza a recibir obras.");
  if (!hasta) out.push("Falta la fecha de cierre.");
  if (desde && hasta && d.closesDay < d.opensDay) out.push("La fecha de cierre es anterior a la de apertura.");
  if (hasta && d.closesDay < today) out.push("La fecha de cierre ya pasó.");
  if (!Number.isInteger(d.maxWorksPerPerson) || d.maxWorksPerPerson < 1 || d.maxWorksPerPerson > MAX_WORKS_PER_PERSON_LIMIT) {
    out.push(`Cada persona puede enviar entre 1 y ${MAX_WORKS_PER_PERSON_LIMIT} obras.`);
  }
  return out;
}

/**
 * Qué se puede cambiar según el estado. En borrador, todo. Abierta: textos y la fecha de cierre
 * (sólo para estirarla: acortarla le saca tiempo a quien ya estaba preparando su envío). Después
 * del cierre, nada.
 */
export function editableCallFields(status: string): ReadonlyArray<keyof CallDraft | "requirementsText"> {
  if (status === "DRAFT") return ["title", "basesText", "rightsText", "requirementsText", "opensDay", "closesDay", "maxWorksPerPerson"];
  if (status === "OPEN") return ["title", "basesText", "requirementsText", "closesDay"];
  return [];
}

export function closeDayProblem(status: string, previousClosesAt: Date, nextClosesDay: string): string | null {
  if (status !== "OPEN") return null;
  if (!validDay(nextClosesDay)) return "Falta la fecha de cierre.";
  if (nextClosesDay < toArDay(previousClosesAt)) return "Con la convocatoria abierta, la fecha de cierre sólo se puede estirar.";
  return null;
}

export type CallAction = "open" | "close" | "startCuration" | "closeCuration" | "unpublish";

const CALL_TRANSITIONS: Record<CallAction, Partial<Record<CallStatus, CallStatus>>> = {
  open: { DRAFT: "OPEN" },
  close: { OPEN: "CLOSED" },
  startCuration: { CLOSED: "CURATING" },
  closeCuration: { CURATING: "DONE" },
  unpublish: { OPEN: "DRAFT" },
};

export function nextCallStatus(action: CallAction, current: string): CallStatus {
  const next = isCallStatus(current) ? CALL_TRANSITIONS[action][current] : undefined;
  if (!next) throw new Error(`No se puede "${action}" una convocatoria en estado ${current}.`);
  return next;
}

export type CallActor = { userId: number; isSuperAdmin: boolean };
export type CallForAction = CallDates & { ownerUserId: number };
export type CallActionContext = {
  now: Date;
  activeSubmissions: number;
  activeCurators: number;
  works: number;
  missingForOpening: string[];
};
export type CallPermission = { ok: true } | { ok: false; reason: string };

/** Quién puede llevar la convocatoria de un estado al siguiente. */
export function canCallAction(action: CallAction, c: CallForAction, actor: CallActor, ctx: CallActionContext): CallPermission {
  if (!isCallStatus(c.status) || !CALL_TRANSITIONS[action][c.status]) {
    return { ok: false, reason: "La convocatoria no está en un estado que permita esta acción." };
  }
  const esDueno = c.ownerUserId === actor.userId;
  if (!esDueno && !actor.isSuperAdmin) return { ok: false, reason: "Sólo quien organiza la muestra puede hacer esto." };
  switch (action) {
    case "open":
      return ctx.missingForOpening.length ? { ok: false, reason: ctx.missingForOpening.join(" ") } : { ok: true };
    case "close":
      // Cerrar antes de tiempo le saca el plazo a quien estaba por enviar.
      return ctx.now.getTime() > c.closesAt.getTime()
        ? { ok: true }
        : { ok: false, reason: "La convocatoria sigue recibiendo obras hasta la fecha de cierre." };
    case "startCuration":
      if (ctx.works < 1) return { ok: false, reason: "No hay obras para curar." };
      if (ctx.activeCurators < 1) return { ok: false, reason: "Sumá al menos un curador que haya aceptado la invitación." };
      return { ok: true };
    case "closeCuration":
      return { ok: true };
    case "unpublish":
      // Moderación: el super admin la saca de la página pública. El organizador, sólo si nadie envió.
      if (actor.isSuperAdmin) return { ok: true };
      return ctx.activeSubmissions === 0 ? { ok: true } : { ok: false, reason: "Ya hay envíos: no se puede volver a borrador." };
  }
}

export type SubmissionWorkDraft = { imageUrl: string; title: string };
export type SubmissionDraft = {
  authorName: string;
  basesAccepted: boolean;
  rightsAccepted: boolean;
  works: SubmissionWorkDraft[];
};

/** Lo que impide guardar un envío. */
export function submissionProblems(d: SubmissionDraft, maxWorks: number): string[] {
  const out: string[] = [];
  if (!d.authorName.trim()) out.push("Escribí tu nombre como querés que figure si tu obra queda seleccionada.");
  if (d.works.length < 1) out.push("Subí al menos una obra.");
  if (d.works.length > maxWorks) out.push(maxWorks === 1 ? "Esta convocatoria recibe una sola obra por persona." : `Esta convocatoria recibe hasta ${maxWorks} obras por persona.`);
  if (d.works.some((w) => !w.imageUrl)) out.push("Cada obra necesita su imagen.");
  if (d.works.some((w) => !w.title.trim())) out.push("Cada obra necesita un título.");
  if (!d.basesAccepted) out.push("Tenés que aceptar las bases.");
  if (!d.rightsAccepted) out.push("Tenés que aceptar la autorización de derechos.");
  return out;
}

/**
 * Quién no puede enviar a una convocatoria: quien la organiza y quien la cura. Si no, el
 * anonimato no sirve de nada (el organizador vería su propia obra en la selección; un curador
 * reconocería la suya).
 */
export function submitterConflict(p: { isOwner: boolean; isCurator: boolean }): string | null {
  if (p.isOwner) return "Organizás esta convocatoria: no podés enviar obras.";
  if (p.isCurator) return "Sos parte del equipo curatorial: no podés enviar obras.";
  return null;
}
```

Agregar al final de `packages/muestras/src/index.ts`:
```ts
export * from "./call";
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types`
Expected: PASS (19 tests nuevos y los de las etapas 1 y 2), sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add packages/muestras/src/call.ts packages/muestras/src/call.test.ts packages/muestras/src/index.ts
git commit -m "Reglas de la convocatoria de Muestras: fases, apertura, edición y envíos"
```

---
### Task 2: Reglas de la curaduría anónima (códigos, orden, proyección, ranking, armado)

**Files:**
- Create: `packages/muestras/src/curation.ts`
- Modify: `packages/muestras/src/index.ts`
- Test: `packages/muestras/src/curation.test.ts`

**Interfaces:**
- Consumes: `MAX_WORKS`, `MAX_HIGHLIGHTS` (etapa 1, `constants.ts`).
- Produces:
  - `SCORE_MIN = 1`, `SCORE_MAX = 5`, `isValidScore(n)`, `WORK_DECISIONS`, `WorkDecision`, `isWorkDecision`, `CURATOR_STATUSES`, `CuratorStatus`, `INVITATION_TTL_DAYS = 30`
  - `stableHash(s): string` (cyrb53, 14 hex, **sin `node:crypto`**: el paquete llega al navegador)
  - `anonymousCodes(callId, workIds): Map<workId, "O-001">` (posición en orden por hash; ancho ≥ 3)
  - `curatorOrder(rows, curatorId, callId)`
  - `CuratorWorkView = { id; code; imagePath; title; year; technique; statement; myScore: number|null; myNote: string }`, `CURATOR_FORBIDDEN_FIELDS`, `curatorImagePath(workId)`, `toCuratorView(w, mine)`, `leakedFields(payload)`
  - `CuratorFilter`, `CURATOR_FILTERS`, `filterForCurator`, `curatorProgress`
  - `RankingRow = { workId; code; average: number|null; count; decision: WorkDecision }`, `rankWorks(works, scores)`, `RankingFilter`, `filterRanking<R extends RankingRow>(rows, f): R[]`
  - `selectionRoom(existingActivityWorks, selected)`, `canDecide(status)`, `canScore({ status, curatorStatus })`, `canSeeIdentity(status)`, `canViewCallImage({ status, isOwner, isSuperAdmin, curatorStatus })`
  - `InvitationState`, `invitationState({ status, invitedAt }, now)`, `normalizeEmail(raw)`
  - `AssemblySource`, `AssembledWork`, `assemblyPlan(selectedInRankingOrder, existing: { count; highlights }): { works; problems }`

- [ ] **Step 1: Escribir el test que falla**

`packages/muestras/src/curation.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  anonymousCodes, assemblyPlan, canDecide, canScore, canSeeIdentity, canViewCallImage, curatorOrder, curatorProgress,
  filterForCurator, filterRanking, invitationState, isValidScore, leakedFields, normalizeEmail, rankWorks, selectionRoom,
  stableHash, toCuratorView, type AssemblySource,
} from "./curation";

describe("códigos anónimos", () => {
  it("son únicos aunque haya muchas obras (no dependen de la suerte)", () => {
    const ids = Array.from({ length: 1200 }, (_, i) => `w${i}`);
    const c = anonymousCodes("call1", ids);
    expect(new Set(c.values()).size).toBe(1200);
    expect([...c.values()].every((x) => /^O-\d{4}$/.test(x))).toBe(true);
  });
  it("ancho mínimo 3 y estables", () => {
    const a = anonymousCodes("call1", ["a", "b", "c"]);
    expect([...a.values()].sort()).toEqual(["O-001", "O-002", "O-003"]);
    expect(anonymousCodes("call1", ["c", "b", "a"])).toEqual(a);
  });
  it("no siguen el orden de envío", () => {
    const ids = Array.from({ length: 50 }, (_, i) => `w${String(i).padStart(2, "0")}`);
    const c = anonymousCodes("call1", ids);
    const enOrden = ids.every((id, i) => c.get(id) === `O-${String(i + 1).padStart(3, "0")}`);
    expect(enOrden).toBe(false);
  });
});

describe("orden por curador", () => {
  const filas = Array.from({ length: 30 }, (_, i) => ({ id: `w${i}` }));
  it("es estable para el mismo curador", () => {
    expect(curatorOrder(filas, "cur1", "call1")).toEqual(curatorOrder([...filas].reverse(), "cur1", "call1"));
  });
  it("cambia entre curadores", () => {
    expect(curatorOrder(filas, "cur1", "call1").map((f) => f.id)).not.toEqual(curatorOrder(filas, "cur2", "call1").map((f) => f.id));
  });
  it("el hash es de 14 caracteres hexadecimales", () => expect(stableHash("x")).toMatch(/^[0-9a-f]{14}$/));
});

describe("lo que ve un curador", () => {
  const fila = {
    id: "cw1", anonymousCode: "O-004", title: "Puerto", year: 2024, technique: "Digital", statement: "Texto",
    imageUrl: "https://pub/muestras/7/x.webp", submissionId: "s1", authorName: "Ana Pérez", userId: 7,
  };
  it("sólo los campos permitidos, con la imagen por la ruta anónima", () => {
    const v = toCuratorView(fila, { score: 4, note: null });
    expect(v).toEqual({
      id: "cw1", code: "O-004", imagePath: "/api/curaduria/obras/cw1/imagen", title: "Puerto", year: 2024,
      technique: "Digital", statement: "Texto", myScore: 4, myNote: "",
    });
    expect(leakedFields(v as unknown as Record<string, unknown>)).toEqual([]);
  });
  it("la vigilancia detecta una fuga", () => {
    expect(leakedFields({ ...fila })).toEqual(expect.arrayContaining(["userId", "authorName", "submissionId", "imageUrl"]));
  });
  it("filtros y avance", () => {
    const vs = [{ myScore: 3 }, { myScore: null }, { myScore: 5 }];
    expect(filterForCurator(vs, "ME_FALTAN")).toEqual([{ myScore: null }]);
    expect(filterForCurator(vs, "PUNTUADAS")).toHaveLength(2);
    expect(curatorProgress(vs)).toEqual({ scored: 2, total: 3 });
  });
  it("puntaje de 1 a 5, entero", () => {
    expect(isValidScore(1)).toBe(true);
    expect(isValidScore(5)).toBe(true);
    expect(isValidScore(0)).toBe(false);
    expect(isValidScore(3.5)).toBe(false);
    expect(isValidScore("4")).toBe(false);
  });
});

describe("ranking", () => {
  const obras = [
    { id: "a", anonymousCode: "O-001", decision: "PENDING" },
    { id: "b", anonymousCode: "O-002", decision: "SELECTED" },
    { id: "c", anonymousCode: "O-003", decision: "RARO" },
    { id: "d", anonymousCode: "O-004", decision: "DISCARDED" },
  ];
  const puntajes = [
    { callWorkId: "a", score: 4 }, { callWorkId: "a", score: 5 },
    { callWorkId: "b", score: 5 }, { callWorkId: "b", score: 4 }, { callWorkId: "b", score: 5 },
    { callWorkId: "d", score: 2 }, { callWorkId: "d", score: 9 },
  ];
  const r = rankWorks(obras, puntajes);
  it("ordena por promedio, cantidad y código; sin puntajes al final", () => {
    expect(r.map((x) => [x.code, x.average, x.count])).toEqual([
      ["O-002", 4.67, 3], ["O-001", 4.5, 2], ["O-004", 2, 1], ["O-003", null, 0],
    ]);
  });
  it("una decisión desconocida es pendiente", () => expect(r.find((x) => x.code === "O-003")?.decision).toBe("PENDING"));
  it("filtra por promedio mínimo, cantidad y decisión", () => {
    expect(filterRanking(r, { minAverage: 4.5 }).map((x) => x.code)).toEqual(["O-002", "O-001"]);
    expect(filterRanking(r, { minCount: 3 }).map((x) => x.code)).toEqual(["O-002"]);
    expect(filterRanking(r, { decision: "DISCARDED" }).map((x) => x.code)).toEqual(["O-004"]);
  });
});

describe("permisos de la curaduría", () => {
  it("decidir sólo en curaduría; identidad sólo al terminar", () => {
    expect(canDecide("CURATING")).toBe(true);
    expect(canDecide("DONE")).toBe(false);
    expect(canSeeIdentity("CURATING")).toBe(false);
    expect(canSeeIdentity("DONE")).toBe(true);
  });
  it("puntuar: curador activo en curaduría", () => {
    expect(canScore({ status: "CURATING", curatorStatus: "ACTIVE" })).toBe(true);
    expect(canScore({ status: "CURATING", curatorStatus: "REVOKED" })).toBe(false);
    expect(canScore({ status: "DONE", curatorStatus: "ACTIVE" })).toBe(false);
  });
  it("la imagen anónima: organizador desde el cierre, curador desde la curaduría, nadie más", () => {
    const base = { isOwner: false, isSuperAdmin: false, curatorStatus: null };
    expect(canViewCallImage({ ...base, status: "OPEN", isOwner: true })).toBe(false);
    expect(canViewCallImage({ ...base, status: "CLOSED", isOwner: true })).toBe(true);
    expect(canViewCallImage({ ...base, status: "CLOSED", curatorStatus: "ACTIVE" })).toBe(false);
    expect(canViewCallImage({ ...base, status: "CURATING", curatorStatus: "ACTIVE" })).toBe(true);
    expect(canViewCallImage({ ...base, status: "CURATING", curatorStatus: "INVITED" })).toBe(false);
    expect(canViewCallImage({ ...base, status: "CURATING" })).toBe(false);
  });
  it("lugar para seleccionar", () => {
    expect(selectionRoom(0, 0)).toBe(40);
    expect(selectionRoom(30, 8)).toBe(2);
    expect(selectionRoom(30, 20)).toBe(0);
  });
});

describe("invitaciones", () => {
  const ahora = new Date("2026-11-10T12:00:00Z");
  it("vigente, usada, revocada y vencida a los 30 días", () => {
    expect(invitationState({ status: "INVITED", invitedAt: new Date("2026-11-01T12:00:00Z") }, ahora)).toBe("VALID");
    expect(invitationState({ status: "ACTIVE", invitedAt: ahora }, ahora)).toBe("USED");
    expect(invitationState({ status: "REVOKED", invitedAt: ahora }, ahora)).toBe("REVOKED");
    expect(invitationState({ status: "INVITED", invitedAt: new Date("2026-10-01T12:00:00Z") }, ahora)).toBe("EXPIRED");
  });
  it("normaliza el email", () => {
    expect(normalizeEmail("  Ana@Mail.COM ")).toBe("ana@mail.com");
    expect(normalizeEmail("sin-arroba")).toBeNull();
  });
});

describe("armar la muestra", () => {
  const src = (i: number): AssemblySource => ({
    callWorkId: `cw${i}`, imageUrl: `u${i}`, title: `T${i}`, year: null, technique: null,
    authorName: `A${i}`, authorUserId: i, authorProfileId: null,
  });
  it("agrega después de lo que había y completa las destacadas con las mejores", () => {
    const { works, problems } = assemblyPlan([src(1), src(2), src(3)], { count: 5, highlights: 10 });
    expect(problems).toEqual([]);
    expect(works.map((w) => [w.callWorkId, w.sortOrder, w.isHighlight])).toEqual([
      ["cw1", 5, true], ["cw2", 6, true], ["cw3", 7, false],
    ]);
  });
  it("no se pasa del tope de 40", () => {
    const sel = Array.from({ length: 11 }, (_, i) => src(i));
    expect(assemblyPlan(sel, { count: 30, highlights: 0 }).problems[0]).toMatch(/hasta 40 obras/);
  });
  it("sin seleccionadas no arma nada", () => expect(assemblyPlan([], { count: 0, highlights: 0 }).problems).toEqual(["No hay obras seleccionadas."]));
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter @repo/muestras test`
Expected: FAIL — `Failed to resolve import "./curation"`.

- [ ] **Step 3: Implementar**

`packages/muestras/src/curation.ts`:
```ts
import { MAX_HIGHLIGHTS, MAX_WORKS } from "./constants";

/**
 * Curaduría privada y anónima. Todo puro: decide qué ve un curador, en qué orden, cómo se
 * agregan los puntajes y cómo se arma la muestra con lo elegido.
 *
 * Ideas tomadas del juzgamiento de FotoRank/Clickatón (sin importar su código, que vive en las
 * apps): proyección con lista de campos permitidos y lista de prohibidos vigilada por test,
 * orden estable distinto para cada curador, y códigos anónimos que son la POSICIÓN en un orden
 * por hash (con un hash recortado a 4 dígitos, Clickatón chocó a las 80 obras).
 */

export const SCORE_MIN = 1;
export const SCORE_MAX = 5;

export const WORK_DECISIONS = ["PENDING", "SELECTED", "DISCARDED"] as const;
export type WorkDecision = (typeof WORK_DECISIONS)[number];

export const CURATOR_STATUSES = ["INVITED", "ACTIVE", "REVOKED"] as const;
export type CuratorStatus = (typeof CURATOR_STATUSES)[number];

/** Vigencia de una invitación a curar. */
export const INVITATION_TTL_DAYS = 30;

export function isValidScore(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= SCORE_MIN && n <= SCORE_MAX;
}

export function isWorkDecision(v: unknown): v is WorkDecision {
  return typeof v === "string" && (WORK_DECISIONS as readonly string[]).includes(v);
}

/**
 * Hash de 53 bits (cyrb53), en hexadecimal. No es criptográfico ni hace falta: sólo mezcla el
 * orden. Va sin `node:crypto` porque este paquete también llega al navegador (la barra del panel).
 */
export function stableHash(s: string): string {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

function byHash<T>(rows: readonly T[], key: (r: T) => string): T[] {
  return rows
    .map((r) => ({ r, k: key(r) }))
    .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
    .map((x) => x.r);
}

/**
 * Código anónimo de cada obra, asignado de una vez al cerrar la convocatoria: se ordenan las
 * obras por un hash estable (no por fecha de envío ni por autor) y el código es la posición.
 * Únicos por construcción. Ancho mínimo 3 ("O-007").
 */
export function anonymousCodes(callId: string, workIds: readonly string[]): Map<string, string> {
  const ancho = Math.max(3, String(workIds.length).length);
  const orden = byHash([...new Set(workIds)], (id) => stableHash(`muestras-anon:v1:${callId}:${id}`));
  return new Map(orden.map((id, i) => [id, `O-${String(i + 1).padStart(ancho, "0")}`]));
}

/** Orden propio de cada curador: estable entre visitas, distinto entre curadores. */
export function curatorOrder<T extends { id: string }>(rows: readonly T[], curatorId: string, callId: string): T[] {
  return byHash(rows, (r) => stableHash(`muestras-orden:v1:${curatorId}:${callId}:${r.id}`));
}

/**
 * Lo único que un curador ve de una obra. Se arma campo por campo: nunca desde la fila de la
 * base. La imagen va siempre por la ruta propia (`/api/curaduria/obras/<id>/imagen`), porque la
 * URL del bucket lleva el id de quien la subió (`muestras/<userId>/…`).
 */
export type CuratorWorkView = {
  id: string;
  code: string;
  imagePath: string;
  title: string;
  year: number | null;
  technique: string | null;
  statement: string | null;
  myScore: number | null;
  myNote: string;
};

/** Lo que nunca puede viajar al navegador de un curador (ni del organizador antes del cierre). */
export const CURATOR_FORBIDDEN_FIELDS = [
  "userId", "authorName", "authorUserId", "authorProfileId", "email", "name",
  "submissionId", "imageUrl", "createdAt", "updatedAt",
] as const;

export function curatorImagePath(workId: string): string {
  return `/api/curaduria/obras/${encodeURIComponent(workId)}/imagen`;
}

export function toCuratorView(
  w: { id: string; anonymousCode: string | null; title: string; year: number | null; technique: string | null; statement: string | null },
  mine: { score: number; note: string | null } | null,
): CuratorWorkView {
  return {
    id: w.id,
    code: w.anonymousCode ?? "—",
    imagePath: curatorImagePath(w.id),
    title: w.title,
    year: w.year,
    technique: w.technique,
    statement: w.statement,
    myScore: mine?.score ?? null,
    myNote: mine?.note ?? "",
  };
}

/** Devuelve los campos prohibidos que aparecen con valor. Lo usan los tests de la app. */
export function leakedFields(payload: Record<string, unknown>): string[] {
  return CURATOR_FORBIDDEN_FIELDS.filter((k) => k in payload && payload[k] != null && payload[k] !== "");
}

export type CuratorFilter = "TODAS" | "ME_FALTAN" | "PUNTUADAS";

export const CURATOR_FILTERS: ReadonlyArray<{ id: CuratorFilter; label: string }> = [
  { id: "TODAS", label: "Todas" },
  { id: "ME_FALTAN", label: "Me faltan" },
  { id: "PUNTUADAS", label: "Puntuadas" },
];

export function filterForCurator<T extends { myScore: number | null }>(rows: readonly T[], f: CuratorFilter): T[] {
  if (f === "ME_FALTAN") return rows.filter((r) => r.myScore == null);
  if (f === "PUNTUADAS") return rows.filter((r) => r.myScore != null);
  return [...rows];
}

export function curatorProgress(rows: ReadonlyArray<{ myScore: number | null }>): { scored: number; total: number } {
  return { scored: rows.filter((r) => r.myScore != null).length, total: rows.length };
}

export type RankingRow = {
  workId: string;
  code: string;
  average: number | null;
  count: number;
  decision: WorkDecision;
};

/**
 * Ranking para el organizador: promedio (dos decimales) y cantidad de puntajes. Orden: mayor
 * promedio, más puntajes, código. Sin puntajes van al final.
 */
export function rankWorks(
  works: ReadonlyArray<{ id: string; anonymousCode: string | null; decision: string }>,
  scores: ReadonlyArray<{ callWorkId: string; score: number }>,
): RankingRow[] {
  const suma = new Map<string, { total: number; n: number }>();
  for (const s of scores) {
    if (!isValidScore(s.score)) continue;
    const a = suma.get(s.callWorkId) ?? { total: 0, n: 0 };
    a.total += s.score;
    a.n += 1;
    suma.set(s.callWorkId, a);
  }
  const filas: RankingRow[] = works.map((w) => {
    const a = suma.get(w.id);
    return {
      workId: w.id,
      code: w.anonymousCode ?? "—",
      average: a ? Math.round((a.total / a.n) * 100) / 100 : null,
      count: a?.n ?? 0,
      decision: isWorkDecision(w.decision) ? w.decision : "PENDING",
    };
  });
  return filas.sort((x, y) => {
    if (x.average == null && y.average != null) return 1;
    if (y.average == null && x.average != null) return -1;
    if (x.average != null && y.average != null && x.average !== y.average) return y.average - x.average;
    if (x.count !== y.count) return y.count - x.count;
    return x.code < y.code ? -1 : x.code > y.code ? 1 : 0;
  });
}

export type RankingFilter = { minAverage?: number | null; minCount?: number | null; decision?: WorkDecision | "ALL" };

export function filterRanking<R extends RankingRow>(rows: readonly R[], f: RankingFilter): R[] {
  return rows.filter((r) => {
    if (f.minAverage != null && (r.average == null || r.average < f.minAverage)) return false;
    if (f.minCount != null && r.count < f.minCount) return false;
    if (f.decision && f.decision !== "ALL" && r.decision !== f.decision) return false;
    return true;
  });
}

/** Cuántas obras más se pueden seleccionar sin pasarse del tope de la galería. */
export function selectionRoom(existingActivityWorks: number, selected: number): number {
  return Math.max(0, MAX_WORKS - existingActivityWorks - selected);
}

/** Seleccionar y descartar sólo durante la curaduría. */
export function canDecide(status: string): boolean {
  return status === "CURATING";
}

/** Puntuar: curador activo, durante la curaduría. */
export function canScore(p: { status: string; curatorStatus: string }): boolean {
  return p.status === "CURATING" && p.curatorStatus === "ACTIVE";
}

/** El organizador ve quién mandó cada obra recién con la selección cerrada. */
export function canSeeIdentity(status: string): boolean {
  return status === "DONE";
}

/** Quién puede pedir la imagen de una obra por la ruta anónima. */
export function canViewCallImage(p: { status: string; isOwner: boolean; isSuperAdmin: boolean; curatorStatus: string | null }): boolean {
  if (p.status !== "CLOSED" && p.status !== "CURATING" && p.status !== "DONE") return false;
  if (p.isOwner || p.isSuperAdmin) return true;
  return p.curatorStatus === "ACTIVE" && p.status !== "CLOSED";
}

export type InvitationState = "VALID" | "EXPIRED" | "USED" | "REVOKED";

export function invitationState(c: { status: string; invitedAt: Date }, now: Date): InvitationState {
  if (c.status === "REVOKED") return "REVOKED";
  if (c.status === "ACTIVE") return "USED";
  if (now.getTime() - c.invitedAt.getTime() > INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000) return "EXPIRED";
  return "VALID";
}

export function normalizeEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254 ? e : null;
}

export type AssemblySource = {
  callWorkId: string;
  imageUrl: string;
  title: string;
  year: number | null;
  technique: string | null;
  authorName: string;
  authorUserId: number;
  authorProfileId: string | null;
};

export type AssembledWork = Omit<AssemblySource, "callWorkId"> & { callWorkId: string; isHighlight: boolean; sortOrder: number };

/**
 * Las obras seleccionadas, ya en el orden del ranking, como obras de la muestra. Se agregan
 * después de las que la muestra ya tenía. Si la muestra no llegó al tope de destacadas, las
 * mejor puntuadas completan el lugar (el organizador lo cambia después en el editor).
 */
export function assemblyPlan(
  selectedInRankingOrder: readonly AssemblySource[],
  existing: { count: number; highlights: number },
): { works: AssembledWork[]; problems: string[] } {
  const problems: string[] = [];
  if (selectedInRankingOrder.length === 0) problems.push("No hay obras seleccionadas.");
  if (existing.count + selectedInRankingOrder.length > MAX_WORKS) {
    problems.push(`La muestra admite hasta ${MAX_WORKS} obras: ya tiene ${existing.count} y seleccionaste ${selectedInRankingOrder.length}.`);
  }
  if (problems.length) return { works: [], problems };
  const lugares = Math.max(0, MAX_HIGHLIGHTS - existing.highlights);
  return {
    works: selectedInRankingOrder.map((w, i) => ({ ...w, isHighlight: i < lugares, sortOrder: existing.count + i })),
    problems,
  };
}
```

Agregar al final de `packages/muestras/src/index.ts`:
```ts
export * from "./curation";
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter @repo/muestras lint`
Expected: PASS (22 tests nuevos), sin errores.

- [ ] **Step 5: Commit**

```bash
git add packages/muestras/src/curation.ts packages/muestras/src/curation.test.ts packages/muestras/src/index.ts
git commit -m "Reglas de la curaduría anónima: códigos por posición, orden por curador, ranking y armado"
```

---
### Task 3: Panel — Convocatorias y Curaduría construidas, "Mis envíos"

**Files:**
- Modify: `packages/muestras/src/panel.ts`, `packages/muestras/src/panel.test.ts`, `apps/muestras/lib/panel/en-preparacion.ts`

**Interfaces:**
- Produces: `PanelSectionKey` suma `"envios"`; `PANEL_SECTIONS` suma `{ key: "envios", label: "Mis envíos", href: "/panel/envios", group: "CUENTA", ready: true }`; `convocatorias` y `curaduria` pasan a `ready: true`. `EN_PREPARACION` deja sólo `ventas` y `estadisticas`.

- [ ] **Step 1: Cambiar los tests primero**

En `packages/muestras/src/panel.test.ts`, la lista de una persona común pasa a:
```ts
      "inicio", "muestras", "proponer", "perfil", "envios", "convocatorias", "curaduria", "montaje", "ventas", "estadisticas",
```
y en "upcomingSection devuelve sólo las que están en preparación", debajo de `expect(upcomingSection("montaje")).toBeNull();`:
```ts
    expect(upcomingSection("convocatorias")).toBeNull();
    expect(upcomingSection("curaduria")).toBeNull();
    expect(upcomingSection("envios")).toBeNull();
```

Run: `pnpm --filter @repo/muestras test`
Expected: FAIL en "una persona común ve todo menos Revisión" y en `upcomingSection("convocatorias")`.

- [ ] **Step 2: Implementar**

En `packages/muestras/src/panel.ts`, el tipo:
```ts
export type PanelSectionKey =
  | "inicio" | "muestras" | "proponer" | "perfil" | "envios"
  | "convocatorias" | "curaduria" | "montaje" | "ventas" | "estadisticas"
  | "revision";
```
y en `PANEL_SECTIONS`, reemplazar las líneas de `perfil`, `convocatorias` y `curaduria` por:
```ts
  s("perfil", "Mi perfil de fotógrafo", "/panel/perfil", "CUENTA"),
  s("envios", "Mis envíos", "/panel/envios", "CUENTA"),
  s("convocatorias", "Convocatorias", "/panel/convocatorias", "ORGANIZAR"),
  s("curaduria", "Curaduría", "/panel/curaduria", "ORGANIZAR"),
```

En `apps/muestras/lib/panel/en-preparacion.ts`, borrar las entradas `convocatorias: { … }` y `curaduria: { … }` de `EN_PREPARACION` (quedan `ventas` y `estadisticas`). El test existente "no explica como futuro algo que ya está construido" lo exige.

- [ ] **Step 3: Correr y ver que pasa**

Run: `pnpm --filter @repo/muestras test && pnpm --filter muestras test -- lib/panel`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/muestras/src/panel.ts packages/muestras/src/panel.test.ts apps/muestras/lib/panel/en-preparacion.ts
git commit -m "Panel de Muestras: Convocatorias y Curaduría construidas, y Mis envíos"
```

(Las rutas `/panel/convocatorias`, `/panel/curaduria` y `/panel/envios` llegan en las Tasks 9, 12 y 11; hasta entonces dan 404, que es aceptable dentro de la rama.)

---
### Task 4: Tablas de convocatoria y curaduría (migración escrita a mano, sin aplicar)

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelo `CulturalActivity` y modelos nuevos al final)
- Create: `packages/db/prisma/migrations/20261028120000_muestras_etapa_3_convocatorias/migration.sql`

**Interfaces:**
- Produces: `prisma.culturalCall`, `prisma.culturalCallSubmission`, `prisma.culturalCallWork`, `prisma.culturalCallCurator`, `prisma.culturalCallScore`; únicos compuestos `callId_userId` (envío), `callId_email` (curador), `callWorkId_curatorId` (puntaje); `CulturalActivity.call`.

- [ ] **Step 1: Confirmar el nombre de la migración**

Run: `git fetch origin && git ls-tree --name-only origin/main packages/db/prisma/migrations/ | tail -4`
Expected: las últimas son `20261027120000_fotoffice_etapa_5_contratos` y `20261027120000_muestras_etapa_2_perfiles`. `20261028120000_…` ordena después. Si apareció una más nueva, usar un timestamp posterior y reemplazar el nombre en todo este plan.

- [ ] **Step 2: Cambiar el schema (sin `prisma format`: reformatea todo el archivo)**

En `model CulturalActivity`, debajo de `works CulturalActivityWork[]`:
```prisma
  /// Convocatoria online de esta muestra (Muestras, etapa 3). A lo sumo una.
  call  CulturalCall?
```

Al final del archivo:
```prisma
/// Convocatoria online de una muestra (Muestras Fotográficas, etapa 3).
///
/// Estados como texto: DRAFT | OPEN | CLOSED | CURATING | DONE. Ids de usuario `Int` sin
/// relación a `User`, igual que `CulturalActivity`. Quien organiza es el `proposedByUserId` de la
/// actividad; `createdByUserId` queda como registro.
model CulturalCall {
  id         String           @id @default(cuid())
  activityId String           @unique
  activity   CulturalActivity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  slug       String           @unique

  title             String
  basesText         String
  requirementsText  String?
  rightsText        String
  /// Inicio del primer día, en UTC (00:00 hora argentina).
  opensAt           DateTime
  /// Fin del último día, en UTC (23:59:59.999 hora argentina).
  closesAt          DateTime
  maxWorksPerPerson Int      @default(3)

  /// DRAFT | OPEN | CLOSED | CURATING | DONE
  status            String    @default("DRAFT")
  createdByUserId   Int
  openedAt          DateTime?
  closedAt          DateTime?
  curationStartedAt DateTime?
  curationClosedAt  DateTime?
  assembledAt       DateTime?
  /// Se marcan antes de mandar los correos masivos: un doble clic no los duplica.
  closedNoticeSentAt  DateTime?
  resultsNoticeSentAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  submissions CulturalCallSubmission[]
  works       CulturalCallWork[]
  curators    CulturalCallCurator[]

  index([status, closesAt])
  index([createdByUserId])
}

/// El envío de una persona a una convocatoria: una fila por persona, con hasta N obras.
model CulturalCallSubmission {
  id     String       @id @default(cuid())
  callId String
  call   CulturalCall @relation(fields: [callId], references: [id], onDelete: Cascade)
  userId Int
  /// Cómo firma si queda seleccionada. Nunca llega a un curador.
  authorName       String
  /// ACTIVE | WITHDRAWN
  status           String    @default("ACTIVE")
  basesAcceptedAt  DateTime
  rightsAcceptedAt DateTime
  withdrawnAt      DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  works CulturalCallWork[]

  unique([callId, userId])
  index([userId])
}

/// Una obra enviada. `anonymousCode` se asigna al cerrar la convocatoria (es la posición en un
/// orden por hash: único por construcción). `activityWorkId` es la obra de la muestra creada al
/// armarla; sin FK a propósito, porque el editor de la muestra reescribe sus obras.
model CulturalCallWork {
  id           String                 @id @default(cuid())
  callId       String
  call         CulturalCall           @relation(fields: [callId], references: [id], onDelete: Cascade)
  submissionId String
  submission   CulturalCallSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)

  imageUrl  String
  title     String
  year      Int?
  technique String?
  statement String?
  sortOrder Int     @default(0)

  anonymousCode  String?
  /// PENDING | SELECTED | DISCARDED
  decision       String    @default("PENDING")
  decidedAt      DateTime?
  activityWorkId String?

  createdAt DateTime @default(now())

  scores CulturalCallScore[]

  unique([callId, anonymousCode])
  index([submissionId])
  index([callId, decision])
}

/// Integrante del equipo curatorial de una convocatoria. Se invita por email con un enlace de un
/// solo uso (se guarda el SHA-256 del token, nunca el token).
model CulturalCallCurator {
  id              String       @id @default(cuid())
  callId          String
  call            CulturalCall @relation(fields: [callId], references: [id], onDelete: Cascade)
  email           String
  userId          Int?
  tokenHash       String       @unique
  /// INVITED | ACTIVE | REVOKED
  status          String       @default("INVITED")
  invitedByUserId Int
  invitedAt       DateTime     @default(now())
  acceptedAt      DateTime?
  revokedAt       DateTime?

  scores CulturalCallScore[]

  unique([callId, email])
  unique([callId, userId])
  index([userId])
}

/// Puntaje de 1 a 5 de un curador a una obra, con una nota optativa.
model CulturalCallScore {
  id         String              @id @default(cuid())
  callWorkId String
  callWork   CulturalCallWork    @relation(fields: [callWorkId], references: [id], onDelete: Cascade)
  curatorId  String
  curator    CulturalCallCurator @relation(fields: [curatorId], references: [id], onDelete: Cascade)
  score      Int
  note       String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  unique([callWorkId, curatorId])
  index([curatorId])
}
```

- [ ] **Step 3: Validar y generar el cliente**

Run: `pnpm --filter @repo/db exec prisma validate && pnpm --filter @repo/db exec prisma generate`
Expected: `The schema at prisma/schema.prisma is valid` y el cliente generado. (Si falta `DIRECT_URL`/`DATABASE_URL` en el entorno, exportar valores falsos sólo para validar: `DATABASE_URL=postgresql://x:y@localhost:5432/z DIRECT_URL=$DATABASE_URL`.)

- [ ] **Step 4: Escribir la migración**

`packages/db/prisma/migrations/20261028120000_muestras_etapa_3_convocatorias/migration.sql`:
```sql
-- Muestras Fotográficas · Etapa 3: convocatoria online y curaduría anónima.
-- Aditiva: crea cinco tablas nuevas (CulturalCall, CulturalCallSubmission, CulturalCallWork,
-- CulturalCallCurator, CulturalCallScore). No toca tablas ni filas existentes.
-- NO SE APLICA SOLA: la aplica a mano el controlador (autorizado por Daniel) en la base de
-- FOTOFFICE/FotoRank (Neon `divine-hall-10689679`, rama `development`) y la registra en
-- `_prisma_migrations` con el SHA-256 de este archivo. Va ANTES de publicar el código.

-- CreateTable
CREATE TABLE "CulturalCall" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "basesText" TEXT NOT NULL,
    "requirementsText" TEXT,
    "rightsText" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "maxWorksPerPerson" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" INTEGER NOT NULL,
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "curationStartedAt" TIMESTAMP(3),
    "curationClosedAt" TIMESTAMP(3),
    "assembledAt" TIMESTAMP(3),
    "closedNoticeSentAt" TIMESTAMP(3),
    "resultsNoticeSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalCallSubmission" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "authorName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "basesAcceptedAt" TIMESTAMP(3) NOT NULL,
    "rightsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalCallSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalCallWork" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "technique" TEXT,
    "statement" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "anonymousCode" TEXT,
    "decision" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "activityWorkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CulturalCallWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalCallCurator" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" INTEGER,
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "invitedByUserId" INTEGER NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "CulturalCallCurator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalCallScore" (
    "id" TEXT NOT NULL,
    "callWorkId" TEXT NOT NULL,
    "curatorId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalCallScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CulturalCall_activityId_key" ON "CulturalCall"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalCall_slug_key" ON "CulturalCall"("slug");

-- CreateIndex
CREATE INDEX "CulturalCall_status_closesAt_idx" ON "CulturalCall"("status", "closesAt");

-- CreateIndex
CREATE INDEX "CulturalCall_createdByUserId_idx" ON "CulturalCall"("createdByUserId");

-- CreateIndex
CREATE INDEX "CulturalCallSubmission_userId_idx" ON "CulturalCallSubmission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalCallSubmission_callId_userId_key" ON "CulturalCallSubmission"("callId", "userId");

-- CreateIndex
CREATE INDEX "CulturalCallWork_submissionId_idx" ON "CulturalCallWork"("submissionId");

-- CreateIndex
CREATE INDEX "CulturalCallWork_callId_decision_idx" ON "CulturalCallWork"("callId", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalCallWork_callId_anonymousCode_key" ON "CulturalCallWork"("callId", "anonymousCode");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalCallCurator_tokenHash_key" ON "CulturalCallCurator"("tokenHash");

-- CreateIndex
CREATE INDEX "CulturalCallCurator_userId_idx" ON "CulturalCallCurator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalCallCurator_callId_email_key" ON "CulturalCallCurator"("callId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalCallCurator_callId_userId_key" ON "CulturalCallCurator"("callId", "userId");

-- CreateIndex
CREATE INDEX "CulturalCallScore_curatorId_idx" ON "CulturalCallScore"("curatorId");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalCallScore_callWorkId_curatorId_key" ON "CulturalCallScore"("callWorkId", "curatorId");

-- AddForeignKey
ALTER TABLE "CulturalCall" ADD CONSTRAINT "CulturalCall_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalCallSubmission" ADD CONSTRAINT "CulturalCallSubmission_callId_fkey" FOREIGN KEY ("callId") REFERENCES "CulturalCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalCallWork" ADD CONSTRAINT "CulturalCallWork_callId_fkey" FOREIGN KEY ("callId") REFERENCES "CulturalCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalCallWork" ADD CONSTRAINT "CulturalCallWork_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "CulturalCallSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalCallCurator" ADD CONSTRAINT "CulturalCallCurator_callId_fkey" FOREIGN KEY ("callId") REFERENCES "CulturalCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalCallScore" ADD CONSTRAINT "CulturalCallScore_callWorkId_fkey" FOREIGN KEY ("callWorkId") REFERENCES "CulturalCallWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalCallScore" ADD CONSTRAINT "CulturalCallScore_curatorId_fkey" FOREIGN KEY ("curatorId") REFERENCES "CulturalCallCurator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Compararla con lo que genera Prisma:

Run: `git show origin/main:packages/db/prisma/schema.prisma > /tmp/schema-antes.prisma && pnpm --filter @repo/db exec prisma migrate diff --from-schema-datamodel /tmp/schema-antes.prisma --to-schema-datamodel prisma/schema.prisma --script`
Expected: exactamente las mismas sentencias (5 `CREATE TABLE`, 15 `CREATE INDEX`, 7 `ADD CONSTRAINT`). Si aparece cualquier otra cosa (un `DROP`, un `ALTER` de otra tabla), frenar y avisar.

- [ ] **Step 5: Comprobar que el resto de la suite compila**

Run: `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice typecheck`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20261028120000_muestras_etapa_3_convocatorias
git commit -m "Tablas de convocatorias y curaduría de Muestras (sin aplicar)"
```

(La aplicación en producción está en la Task 14.)

---
### Task 5: Infraestructura — frenos, lectura del bucket, token de invitación y EXIF

**Files:**
- Modify: `apps/muestras/lib/limite.ts`, `apps/muestras/lib/imagenes/r2.ts`, `apps/muestras/lib/imagenes/procesar.test.ts`
- Create: `apps/muestras/lib/curaduria/token.ts`
- Test: `apps/muestras/lib/curaduria/token.test.ts`

**Interfaces:**
- Produces:
  - `LIMITES` suma `crearConvocatoria`, `guardarEnvio`, `invitarCurador`, `aceptarInvitacion`, `puntuar`, `decidir`, `imagenCuraduria` (las usa `frenarPorUsuario`).
  - `leerDeR2(urlPublica): Promise<{ cuerpo: ReadableStream; contentType: string } | null>` (sólo claves `muestras/…` de nuestro bucket).
  - `nuevoTokenDeInvitacion(): { token; hash }`, `hashDeToken(token)`, `esTokenConForma(token): token is string` (43 caracteres base64url).

- [ ] **Step 1: Escribir los tests que fallan**

`apps/muestras/lib/curaduria/token.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { esTokenConForma, hashDeToken, nuevoTokenDeInvitacion } from "./token";

describe("token de invitación", () => {
  it("guarda el hash, no el token", () => {
    const { token, hash } = nuevoTokenDeInvitacion();
    expect(esTokenConForma(token)).toBe(true);
    expect(hash).toBe(hashDeToken(token));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
  });
  it("cada invitación es distinta", () => {
    expect(nuevoTokenDeInvitacion().token).not.toBe(nuevoTokenDeInvitacion().token);
  });
  it("rechaza lo que no tiene forma de token", () => {
    expect(esTokenConForma("corto")).toBe(false);
    expect(esTokenConForma(`${"a".repeat(42)}/`)).toBe(false);
    expect(esTokenConForma(null)).toBe(false);
  });
});
```

Al final de `apps/muestras/lib/imagenes/procesar.test.ts` (pasa de entrada: documenta y vigila D15):
```ts
describe("anonimato de la imagen (etapa 3)", () => {
  it("no conserva EXIF, XMP ni IPTC: el autor de la cámara no viaja al curador", async () => {
    const conAutor = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#888" } })
      .jpeg()
      .withExif({ IFD0: { Artist: "Ana Pérez", Copyright: "Ana Pérez" } })
      .toBuffer();
    expect((await sharp(conAutor).metadata()).exif).toBeDefined();
    const r = await procesarImagen(conAutor, "obra");
    const meta = await sharp(r.bytes).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(meta.iptc).toBeUndefined();
  });
});
```

Run: `pnpm --filter muestras test -- lib/curaduria lib/imagenes`
Expected: FAIL — `Failed to resolve import "./token"`; la prueba de EXIF pasa.

- [ ] **Step 2: Implementar**

`apps/muestras/lib/curaduria/token.ts`:
```ts
import { createHash, randomBytes } from "node:crypto";

/**
 * Token de la invitación a curar. Viaja sólo en el correo; en la base queda su SHA-256, así una
 * copia de la base no alcanza para entrar como curador.
 */
export function nuevoTokenDeInvitacion(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashDeToken(token) };
}

export function hashDeToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Forma de un token nuestro: 43 caracteres base64url. Lo demás ni se busca en la base. */
export function esTokenConForma(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}
```

En `apps/muestras/lib/limite.ts`, reemplazar el cierre de `LIMITES` (la línea `enviarARevision` y `} as const;`) por:
```ts
  enviarARevision: { limit: 10, windowMs: 60 * 60_000 },
  // Etapa 3: convocatorias y curaduría.
  crearConvocatoria: { limit: 10, windowMs: 60 * 60_000 },
  // Cada guardado de un envío manda un correo de "recibimos tus obras".
  guardarEnvio: { limit: 20, windowMs: 60 * 60_000 },
  invitarCurador: { limit: 30, windowMs: 60 * 60_000 },
  aceptarInvitacion: { limit: 20, windowMs: 60 * 60_000 },
  // Un curador con 300 obras puntúa y corrige rápido con el teclado: tope holgado.
  puntuar: { limit: 1200, windowMs: 10 * 60_000 },
  decidir: { limit: 600, windowMs: 10 * 60_000 },
  // La imagen anónima pasa por nuestra función (no por el bucket): frena el raspado.
  imagenCuraduria: { limit: 1500, windowMs: 10 * 60_000 },
} as const;
```

Reemplazar `apps/muestras/lib/imagenes/r2.ts` completo por (suma `GetObjectCommand`, saca el cliente a `s3()` y agrega `leerDeR2`):
`apps/muestras/lib/imagenes/r2.ts`:
```ts
import "server-only";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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

function s3(c: ReturnType<typeof config>): S3Client {
  cliente ??= new S3Client({
    region: "auto",
    endpoint: c.endpoint,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  });
  return cliente;
}

export async function subirAR2(bytes: Buffer, clave: string, contentType: string): Promise<string> {
  const c = config();
  await s3(c).send(
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

/**
 * Lee un objeto propio del bucket a partir de su URL pública. Lo usa la ruta anónima de la
 * curaduría: el curador recibe la imagen sin ver la URL, que lleva el id de quien la subió.
 * `null` si la URL no es nuestra o el objeto no existe.
 */
export async function leerDeR2(urlPublica: string): Promise<{ cuerpo: ReadableStream; contentType: string } | null> {
  const c = config();
  const prefijo = `${c.publicUrl}/`;
  if (!urlPublica.startsWith(prefijo)) return null;
  const clave = urlPublica.slice(prefijo.length);
  if (!/^muestras\/[A-Za-z0-9._/-]+$/.test(clave) || clave.includes("..")) return null;
  try {
    const r = await s3(c).send(new GetObjectCommand({ Bucket: c.bucket, Key: clave }));
    if (!r.Body) return null;
    return { cuerpo: r.Body.transformToWebStream(), contentType: r.ContentType ?? "image/webp" };
  } catch (err) {
    console.error("[muestras] R2 lectura:", err instanceof Error ? err.message : String(err));
    return null;
  }
}
```

- [ ] **Step 3: Correr y ver que pasa**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types`
Expected: PASS y sin errores de tipos.

- [ ] **Step 4: Commit**

```bash
git add apps/muestras/lib/limite.ts apps/muestras/lib/imagenes/r2.ts apps/muestras/lib/imagenes/procesar.test.ts apps/muestras/lib/curaduria/token.ts apps/muestras/lib/curaduria/token.test.ts
git commit -m "Muestras: frenos de la etapa 3, lectura del bucket y token de invitación"
```

---
### Task 6: Correos de convocatoria y curaduría

**Files:**
- Modify: `apps/muestras/lib/correos/enviar.ts`
- Create: `apps/muestras/lib/correos/textos-convocatoria.ts`, `apps/muestras/lib/correos/convocatorias.ts`
- Test: `apps/muestras/lib/correos/textos-convocatoria.test.ts`

**Interfaces:**
- Consumes: `compuertaDeEnvio` (etapa 1), `formatArDay`, `INVITATION_TTL_DAYS`.
- Produces:
  - `enviar.ts`: `APP_URL` y `enviar(to, subject, parrafos, enlace?)` pasan a exportarse; `Mensaje`; `enviarEnLote(mensajes)` (de a 100 con `resend.batch.send`, mira `error`).
  - `textos-convocatoria.ts`: `Texto`, `textoEnvioRecibido`, `textoConvocatoriaCerrada`, `textoSeleccionada`, `textoNoSeleccionada`, `textoInvitacionCurador`.
  - `convocatorias.ts`: `avisarEnvioRecibido(submissionId)`, `avisarConvocatoriaCerrada(callId)`, `avisarResultados(callId)`, `avisarInvitacionCurador({ email, token, convocatoria, organizador, invitedAt })`. Ninguna tira; las masivas marcan `closedNoticeSentAt`/`resultsNoticeSentAt` con `updateMany … where null` antes de mandar.

- [ ] **Step 1: Escribir el test que falla**

`apps/muestras/lib/correos/textos-convocatoria.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  textoConvocatoriaCerrada, textoEnvioRecibido, textoInvitacionCurador, textoNoSeleccionada, textoSeleccionada,
} from "./textos-convocatoria";

const appUrl = "https://muestrasfotograficas.com";

describe("correos de convocatoria", () => {
  it("envío recibido: cuántas obras y hasta cuándo se puede cambiar", () => {
    const t = textoEnvioRecibido({ nombre: "Ana", convocatoria: "Ciudad", obras: 2, cierre: new Date("2026-12-01T02:59:59.999Z"), appUrl });
    expect(t.parrafos.join(" ")).toMatch(/tus 2 obras/);
    expect(t.parrafos.join(" ")).toMatch(/30 nov/);
    expect(t.enlace.url).toBe(`${appUrl}/panel/envios`);
  });
  it("cierre: avisa que la mirada es anónima", () => {
    expect(textoConvocatoriaCerrada({ nombre: null, convocatoria: "Ciudad", appUrl }).parrafos.join(" ")).toMatch(/sin ver los nombres/);
  });
  it("seleccionada: nombra las obras", () => {
    const t = textoSeleccionada({ nombre: "Ana", convocatoria: "Ciudad", titulos: ["Puerto", "Río", "Islas"], appUrl });
    expect(t.subject).toBe('Tus obras quedaron seleccionadas para "Ciudad"');
    expect(t.parrafos[1]).toContain("“Puerto”, “Río” y “Islas”");
  });
  it("no seleccionada: tono amable, sin la palabra rechazada", () => {
    const t = textoNoSeleccionada({ nombre: "Ana", convocatoria: "Ciudad", recibidas: 120, elegidas: 30, appUrl });
    const todo = [t.subject, ...t.parrafos].join(" ").toLowerCase();
    expect(todo).not.toMatch(/rechaz/);
    expect(todo).toMatch(/gracias/);
    expect(todo).toMatch(/120 obras/);
  });
  it("invitación: quién invita, cómo se acepta y cuándo vence", () => {
    const t = textoInvitacionCurador({ convocatoria: "Ciudad", organizador: "Daniel", url: `${appUrl}/panel/curaduria/invitacion/x`, vence: new Date("2026-11-10T15:00:00Z") });
    expect(t.parrafos.join(" ")).toMatch(/Daniel te invita/);
    expect(t.parrafos.join(" ")).toMatch(/10 nov/);
    expect(t.enlace.texto).toBe("Aceptar la invitación");
  });
});
```

Run: `pnpm --filter muestras test -- lib/correos`
Expected: FAIL — `Failed to resolve import "./textos-convocatoria"`.

- [ ] **Step 2: Implementar**

`apps/muestras/lib/correos/textos-convocatoria.ts`:
```ts
import { formatArDay } from "@repo/muestras";

/**
 * Los textos de los correos de convocatoria y curaduría. Puros, para poder probar el tono: a
 * quien no quedó seleccionado se le escribe con cuidado, sin "rechazada".
 */
export type Texto = { subject: string; parrafos: string[]; enlace: { texto: string; url: string } };

const hola = (nombre: string | null) => `¡Hola${nombre ? ` ${nombre}` : ""}!`;
const lista = (titulos: readonly string[]) =>
  titulos.length <= 1
    ? `“${titulos[0] ?? ""}”`
    : `${titulos.slice(0, -1).map((t) => `“${t}”`).join(", ")} y “${titulos[titulos.length - 1]}”`;

export function textoEnvioRecibido(p: { nombre: string | null; convocatoria: string; obras: number; cierre: Date; appUrl: string }): Texto {
  return {
    subject: `Recibimos tus obras para "${p.convocatoria}"`,
    parrafos: [
      hola(p.nombre),
      `Recibimos ${p.obras === 1 ? "tu obra" : `tus ${p.obras} obras`} para la convocatoria “${p.convocatoria}”.`,
      `Podés cambiarlas o retirar el envío hasta el ${formatArDay(p.cierre)} (hora argentina).`,
    ],
    enlace: { texto: "Ver mis envíos", url: `${p.appUrl}/panel/envios` },
  };
}

export function textoConvocatoriaCerrada(p: { nombre: string | null; convocatoria: string; appUrl: string }): Texto {
  return {
    subject: `Cerró la convocatoria "${p.convocatoria}"`,
    parrafos: [
      hola(p.nombre),
      `La convocatoria “${p.convocatoria}” ya no recibe obras. Ahora el equipo curatorial las mira sin ver los nombres de sus autores.`,
      "Te escribimos cuando termine la selección.",
    ],
    enlace: { texto: "Ver mis envíos", url: `${p.appUrl}/panel/envios` },
  };
}

export function textoSeleccionada(p: { nombre: string | null; convocatoria: string; titulos: readonly string[]; appUrl: string }): Texto {
  const una = p.titulos.length === 1;
  return {
    subject: una ? `Tu obra quedó seleccionada para "${p.convocatoria}"` : `Tus obras quedaron seleccionadas para "${p.convocatoria}"`,
    parrafos: [
      hola(p.nombre),
      `El equipo curatorial eligió ${lista(p.titulos)} para la muestra “${p.convocatoria}”. ¡Felicitaciones!`,
      "Quien organiza la muestra se va a comunicar con vos para los detalles del montaje.",
    ],
    enlace: { texto: "Ver mis envíos", url: `${p.appUrl}/panel/envios` },
  };
}

export function textoNoSeleccionada(p: { nombre: string | null; convocatoria: string; recibidas: number; elegidas: number; appUrl: string }): Texto {
  return {
    subject: `Gracias por participar en "${p.convocatoria}"`,
    parrafos: [
      hola(p.nombre),
      `Gracias por mandar tus obras a “${p.convocatoria}”. Esta vez no quedaron en la selección: se recibieron ${p.recibidas} obras y la muestra tiene lugar para ${p.elegidas}.`,
      "Fue una decisión difícil del equipo curatorial y no habla del valor de tu trabajo. Ojalá te encontremos en la próxima convocatoria.",
    ],
    enlace: { texto: "Ver otras convocatorias", url: `${p.appUrl}/convocatorias` },
  };
}

export function textoInvitacionCurador(p: { convocatoria: string; organizador: string; url: string; vence: Date }): Texto {
  return {
    subject: `Te invitan a curar "${p.convocatoria}"`,
    parrafos: [
      "¡Hola!",
      `${p.organizador} te invita a formar parte del equipo curatorial de la convocatoria “${p.convocatoria}” en Muestras Fotográficas.`,
      "Vas a ver las obras sin el nombre de sus autores y a puntuarlas de 1 a 5. Para aceptar, entrá con tu cuenta de Google.",
      `La invitación vence el ${formatArDay(p.vence)}.`,
    ],
    enlace: { texto: "Aceptar la invitación", url: p.url },
  };
}
```

En `apps/muestras/lib/correos/enviar.ts`, reemplazar desde `const APP_URL = …` hasta antes de `async function datos(` por (los `avisar*` de la etapa 1 siguen iguales y usan este `enviar`):
```ts
export const APP_URL = (process.env.APP_URL?.trim() || "https://muestrasfotograficas.com").replace(/\/+$/, "");

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type Mensaje = { to: string; subject: string; parrafos: string[]; enlace?: { texto: string; url: string } };

function armar(m: Mensaje) {
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#1b1a17">${m.parrafos.map((p) => `<p>${esc(p)}</p>`).join("")}${m.enlace ? `<p><a href="${esc(m.enlace.url)}" style="color:#b4432c">${esc(m.enlace.texto)}</a></p>` : ""}<p style="color:#6b665c;font-size:13px">Muestras Fotográficas</p></div>`;
  const text = [...m.parrafos, m.enlace ? `${m.enlace.texto}: ${m.enlace.url}` : ""].filter(Boolean).join("\n\n");
  return { html, text };
}

/** Nunca tira: un correo que no sale no puede deshacer una aprobación. */
export async function enviar(to: string, subject: string, parrafos: string[], enlace?: { texto: string; url: string }) {
  const c = compuertaDeEnvio();
  if (!c.puede) {
    console.info("[muestras] correo no enviado:", c.motivo, subject);
    return;
  }
  try {
    await new Resend(c.apiKey).emails.send({ from: c.from, to, subject, ...armar({ to, subject, parrafos, enlace }) });
  } catch (err) {
    console.error("[muestras] falló el envío", subject, err);
  }
}

/**
 * Muchos correos de una vez (cierre de convocatoria, resultados): de a 100 por pedido, que es el
 * tope del envío en lote de Resend. Uno por uno, 300 participantes pasarían el tiempo máximo de
 * la función. Nunca tira.
 */
export async function enviarEnLote(mensajes: readonly Mensaje[]): Promise<void> {
  if (mensajes.length === 0) return;
  const c = compuertaDeEnvio();
  if (!c.puede) {
    console.info("[muestras] lote no enviado:", c.motivo, mensajes.length);
    return;
  }
  const resend = new Resend(c.apiKey);
  for (let i = 0; i < mensajes.length; i += 100) {
    const tanda = mensajes.slice(i, i + 100);
    try {
      // El SDK no tira ante un rechazo de Resend: lo devuelve en `error`.
      const { error } = await resend.batch.send(tanda.map((m) => ({ from: c.from, to: m.to, subject: m.subject, ...armar(m) })));
      if (error) console.error("[muestras] Resend rechazó un lote", i, error.message);
    } catch (err) {
      console.error("[muestras] falló un lote", i, err);
    }
  }
}
```

`apps/muestras/lib/correos/convocatorias.ts`:
```ts
import "server-only";
import { prisma } from "@repo/db";
import { INVITATION_TTL_DAYS } from "@repo/muestras";
import { APP_URL, enviar, enviarEnLote, type Mensaje } from "./enviar";
import {
  textoConvocatoriaCerrada, textoEnvioRecibido, textoInvitacionCurador, textoNoSeleccionada, textoSeleccionada, type Texto,
} from "./textos-convocatoria";

/** Ninguno tira: un correo que no sale no puede deshacer un envío, un cierre ni una selección. */

const aMensaje = (to: string, t: Texto): Mensaje => ({ to, subject: t.subject, parrafos: t.parrafos, enlace: t.enlace });

async function personas(ids: readonly number[]) {
  if (ids.length === 0) return new Map<number, { email: string; name: string | null }>();
  const filas = await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, email: true, name: true } });
  return new Map(filas.map((u) => [u.id, { email: u.email, name: u.name }]));
}

export async function avisarEnvioRecibido(submissionId: string): Promise<void> {
  try {
    const s = await prisma.culturalCallSubmission.findUnique({
      where: { id: submissionId },
      select: { userId: true, authorName: true, call: { select: { title: true, closesAt: true } }, _count: { select: { works: true } } },
    });
    if (!s) return;
    const u = (await personas([s.userId])).get(s.userId);
    if (!u) return;
    const t = textoEnvioRecibido({ nombre: s.authorName.split(" ")[0] || null, convocatoria: s.call.title, obras: s._count.works, cierre: s.call.closesAt, appUrl: APP_URL });
    await enviar(u.email, t.subject, t.parrafos, t.enlace);
  } catch (err) {
    console.error("[muestras] falló el aviso de envío recibido", err);
  }
}

/** Se marca `closedNoticeSentAt` antes de mandar: si dos pedidos llegan juntos, sale uno solo. */
export async function avisarConvocatoriaCerrada(callId: string): Promise<void> {
  try {
    const { count } = await prisma.culturalCall.updateMany({ where: { id: callId, closedNoticeSentAt: null }, data: { closedNoticeSentAt: new Date() } });
    if (count === 0) return;
    const call = await prisma.culturalCall.findUnique({
      where: { id: callId },
      select: { title: true, submissions: { where: { status: "ACTIVE" }, select: { userId: true, authorName: true } } },
    });
    if (!call) return;
    const us = await personas(call.submissions.map((s) => s.userId));
    await enviarEnLote(call.submissions.flatMap((s) => {
      const u = us.get(s.userId);
      return u ? [aMensaje(u.email, textoConvocatoriaCerrada({ nombre: s.authorName.split(" ")[0] || null, convocatoria: call.title, appUrl: APP_URL }))] : [];
    }));
  } catch (err) {
    console.error("[muestras] falló el aviso de cierre", err);
  }
}

export async function avisarResultados(callId: string): Promise<void> {
  try {
    const { count } = await prisma.culturalCall.updateMany({ where: { id: callId, resultsNoticeSentAt: null }, data: { resultsNoticeSentAt: new Date() } });
    if (count === 0) return;
    const call = await prisma.culturalCall.findUnique({
      where: { id: callId },
      select: {
        title: true,
        submissions: {
          where: { status: "ACTIVE" },
          select: { userId: true, authorName: true, works: { orderBy: { sortOrder: "asc" }, select: { title: true, decision: true } } },
        },
      },
    });
    if (!call) return;
    const recibidas = call.submissions.reduce((n, s) => n + s.works.length, 0);
    const elegidas = call.submissions.reduce((n, s) => n + s.works.filter((w) => w.decision === "SELECTED").length, 0);
    const us = await personas(call.submissions.map((s) => s.userId));
    await enviarEnLote(call.submissions.flatMap((s) => {
      const u = us.get(s.userId);
      if (!u) return [];
      const nombre = s.authorName.split(" ")[0] || null;
      const titulos = s.works.filter((w) => w.decision === "SELECTED").map((w) => w.title);
      return [aMensaje(u.email, titulos.length
        ? textoSeleccionada({ nombre, convocatoria: call.title, titulos, appUrl: APP_URL })
        : textoNoSeleccionada({ nombre, convocatoria: call.title, recibidas, elegidas, appUrl: APP_URL }))];
    }));
  } catch (err) {
    console.error("[muestras] falló el aviso de resultados", err);
  }
}

export async function avisarInvitacionCurador(p: { email: string; token: string; convocatoria: string; organizador: string; invitedAt: Date }): Promise<void> {
  try {
    const vence = new Date(p.invitedAt.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const t = textoInvitacionCurador({ convocatoria: p.convocatoria, organizador: p.organizador, vence, url: `${APP_URL}/panel/curaduria/invitacion/${p.token}` });
    await enviar(p.email, t.subject, t.parrafos, t.enlace);
  } catch (err) {
    console.error("[muestras] falló la invitación a curar", err);
  }
}
```

- [ ] **Step 3: Correr y ver que pasa**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types`
Expected: PASS (5 tests nuevos; los de la compuerta siguen pasando), sin errores de tipos.

- [ ] **Step 4: Commit**

```bash
git add apps/muestras/lib/correos
git commit -m "Correos de convocatoria: envío recibido, cierre, resultados e invitación a curar"
```

---
### Task 7: Convocatorias del organizador — datos y acciones

**Files:**
- Create: `apps/muestras/lib/convocatorias/mapear.ts`, `apps/muestras/lib/convocatorias/consultas.ts`, `apps/muestras/lib/convocatorias/acciones.ts`
- Test: `apps/muestras/lib/convocatorias/mapear.test.ts`, `apps/muestras/lib/convocatorias/acciones.test.ts`

**Interfaces:**
- Consumes: Task 1 (`canCallAction`, `missingForOpening`, `closeDayProblem`, `editableCallFields`, `nextCallStatus`), Task 2 (`anonymousCodes`), `newSlug` (etapa 1), `avisarConvocatoriaCerrada`/`avisarResultados` (Task 6), `ResultadoAccion` (tipo de `lib/actividades/acciones.ts`).
- Produces:
  - `mapear.ts`: `ConvocatoriaForm`, `DERECHOS_SUGERIDOS`, `REQUISITOS_SUGERIDOS`, `convocatoriaDesdeFormData(fd)`, `DatosConvocatoria`, `datosParaGuardar(f, status)` (tira si una fecha editable es inválida).
  - `consultas.ts`: `listarConvocatoriasPublicas()`, `buscarConvocatoriaPublica(slug)` (con `cache`; incluye `activity.proposedByUserId` sólo para el servidor), `listarConvocatoriasMias(usuario)`, `muestrasSinConvocatoria(userId)`, `buscarConvocatoriaDelOrganizador(id, usuario)` (`null` si no es suya; trae `curators`, `_count.submissions` activos, `obras`, `activity._count.works`).
  - `acciones.ts` (server actions): `crearConvocatoria(activityId)`, `guardarConvocatoria(fd)`, `abrirConvocatoria(id)`, `volverABorrador(id)`, `cerrarConvocatoria(id)` (congela códigos y avisa), `empezarCuraduria(id)` (vuelve a congelar por si el cierre se cortó), `cerrarCuraduria(id)` (avisa resultados). Todas devuelven `ResultadoAccion`.

- [ ] **Step 1: Escribir los tests que fallan**

`apps/muestras/lib/convocatorias/mapear.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { convocatoriaDesdeFormData, datosParaGuardar } from "./mapear";

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

const completo = {
  id: "c1", title: "  Ciudad  ", basesText: "Bases", requirementsText: "", rightsText: "Autorizo",
  opensDay: "2026-11-01", closesDay: "2026-11-30", maxWorksPerPerson: "4",
};

describe("convocatoria desde el formulario", () => {
  it("limpia textos y lee el tope", () => {
    const f = convocatoriaDesdeFormData(fd(completo));
    expect(f).toMatchObject({ id: "c1", title: "Ciudad", requirementsText: null, maxWorksPerPerson: 4 });
  });
  it("un tope que no es número entero vuelve al valor por defecto", () => {
    expect(convocatoriaDesdeFormData(fd({ ...completo, maxWorksPerPerson: "dos" })).maxWorksPerPerson).toBe(3);
  });
  it("recorta textos enormes", () => {
    expect(convocatoriaDesdeFormData(fd({ ...completo, title: "x".repeat(500) })).title).toHaveLength(200);
  });
});

describe("qué se guarda según el estado", () => {
  const f = convocatoriaDesdeFormData(fd(completo));
  it("en borrador, todo, con las fechas en hora argentina", () => {
    const d = datosParaGuardar(f, "DRAFT");
    expect(d.opensAt?.toISOString()).toBe("2026-11-01T03:00:00.000Z");
    expect(d.closesAt?.toISOString()).toBe("2026-12-01T02:59:59.999Z");
    expect(d.maxWorksPerPerson).toBe(4);
  });
  it("abierta: ni apertura, ni tope, ni derechos", () => {
    const d = datosParaGuardar(f, "OPEN");
    expect(Object.keys(d).sort()).toEqual(["basesText", "closesAt", "requirementsText", "title"]);
  });
  it("cerrada: nada", () => expect(datosParaGuardar(f, "CLOSED")).toEqual({}));
  it("una fecha inválida tira", () => {
    expect(() => datosParaGuardar({ ...f, closesDay: "2026-02-30" }, "DRAFT")).toThrow();
  });
});
```

`apps/muestras/lib/convocatorias/acciones.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const d = {
    culturalActivity: { findUnique: vi.fn() },
    culturalCall: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    culturalCallSubmission: { count: vi.fn() },
    culturalCallCurator: { count: vi.fn() },
    culturalCallWork: { count: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  };
  return d;
});
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
const correos = vi.hoisted(() => ({ avisarConvocatoriaCerrada: vi.fn(), avisarResultados: vi.fn() }));

vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("@/lib/correos/convocatorias", () => correos);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { abrirConvocatoria, cerrarConvocatoria, cerrarCuraduria, crearConvocatoria, empezarCuraduria, guardarConvocatoria, volverABorrador } = await import("./acciones");
const { resetRateLimit } = await import("@/lib/limite");

const conv = {
  id: "c1", slug: "ciudad-abc123", title: "Ciudad", basesText: "Bases", rightsText: "Autorizo", requirementsText: null,
  opensAt: new Date("2026-11-01T03:00:00Z"), closesAt: new Date("2026-12-01T02:59:59.999Z"), maxWorksPerPerson: 3,
  status: "DRAFT", activity: { proposedByUserId: 7 },
};
const ana = { id: 7, esSuperAdmin: false, email: "ana@x", name: "Ana" };
const beto = { id: 8, esSuperAdmin: false, email: "beto@x", name: "Beto" };

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  resetRateLimit();
  usuarioActual.valor = ana;
  db.culturalCall.updateMany.mockResolvedValue({ count: 1 });
  db.culturalCall.create.mockResolvedValue({ id: "c1" });
  db.culturalCallSubmission.count.mockResolvedValue(0);
  db.culturalCallCurator.count.mockResolvedValue(0);
  db.culturalCallWork.count.mockResolvedValue(0);
  db.culturalCallWork.findMany.mockResolvedValue([]);
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
});

describe("crearConvocatoria", () => {
  it("sólo para una muestra propia", async () => {
    db.culturalActivity.findUnique.mockResolvedValue({ id: "a1", title: "Ciudad", type: "MUESTRA", proposedByUserId: 9, call: null });
    expect((await crearConvocatoria("a1")).ok).toBe(false);
    expect(db.culturalCall.create).not.toHaveBeenCalled();
  });
  it("no para una charla", async () => {
    db.culturalActivity.findUnique.mockResolvedValue({ id: "a1", title: "Charla", type: "CHARLA", proposedByUserId: 7, call: null });
    expect(await crearConvocatoria("a1")).toEqual({ ok: false, errores: ["Sólo una muestra puede tener convocatoria."] });
  });
  it("si ya tiene, devuelve la que hay", async () => {
    db.culturalActivity.findUnique.mockResolvedValue({ id: "a1", title: "Ciudad", type: "MUESTRA", proposedByUserId: 7, call: { id: "c0" } });
    expect(await crearConvocatoria("a1")).toEqual({ ok: true, id: "c0" });
    expect(db.culturalCall.create).not.toHaveBeenCalled();
  });
  it("crea en borrador con textos sugeridos", async () => {
    db.culturalActivity.findUnique.mockResolvedValue({ id: "a1", title: "Ciudad", type: "MUESTRA", proposedByUserId: 7, call: null });
    expect(await crearConvocatoria("a1")).toEqual({ ok: true, id: "c1" });
    const data = db.culturalCall.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ activityId: "a1", title: "Ciudad", maxWorksPerPerson: 3, createdByUserId: 7 });
    expect(data.rightsText).toMatch(/autorizo/i);
    expect(data.slug).toMatch(/^ciudad-[a-z0-9]{6}$/);
  });
});

describe("guardarConvocatoria", () => {
  const form = { id: "c1", title: "Ciudad", basesText: "Bases nuevas", rightsText: "Autorizo", opensDay: "2026-11-05", closesDay: "2026-11-20", maxWorksPerPerson: "2" };
  it("alguien que no organiza no la ve", async () => {
    usuarioActual.valor = beto;
    db.culturalCall.findUnique.mockResolvedValue(conv);
    expect(await guardarConvocatoria(fd(form))).toEqual({ ok: false, errores: ["La convocatoria no existe."] });
  });
  it("abierta no acorta el cierre", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "OPEN" });
    const r = await guardarConvocatoria(fd(form));
    expect(r.ok).toBe(false);
    expect(db.culturalCall.updateMany).not.toHaveBeenCalled();
  });
  it("abierta guarda sólo lo editable", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "OPEN" });
    expect((await guardarConvocatoria(fd({ ...form, closesDay: "2026-12-10" }))).ok).toBe(true);
    const data = db.culturalCall.updateMany.mock.calls[0][0].data;
    expect(Object.keys(data).sort()).toEqual(["basesText", "closesAt", "requirementsText", "title"]);
  });
  it("cerrada no se edita", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "CLOSED" });
    expect((await guardarConvocatoria(fd(form))).ok).toBe(false);
  });
});

describe("estados", () => {
  it("abrir exige bases", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-20T15:00:00Z"), toFake: ["Date"] });
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, basesText: "" });
    expect(await abrirConvocatoria("c1")).toEqual({ ok: false, errores: ["Faltan las bases."] });
  });
  it("abrir completa pasa a OPEN, condicionado al estado leído", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-20T15:00:00Z"), toFake: ["Date"] });
    db.culturalCall.findUnique.mockResolvedValue(conv);
    expect((await abrirConvocatoria("c1")).ok).toBe(true);
    expect(db.culturalCall.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c1", status: "DRAFT" }, data: expect.objectContaining({ status: "OPEN" }) }));
  });
  it("cerrar antes de la fecha no se puede", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-15T15:00:00Z"), toFake: ["Date"] });
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "OPEN" });
    expect((await cerrarConvocatoria("c1")).ok).toBe(false);
    expect(correos.avisarConvocatoriaCerrada).not.toHaveBeenCalled();
  });
  it("cerrar congela los códigos de las obras activas y avisa", async () => {
    vi.useFakeTimers({ now: new Date("2026-12-02T15:00:00Z"), toFake: ["Date"] });
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "OPEN" });
    db.culturalCallWork.findMany.mockResolvedValue([{ id: "w1", anonymousCode: null }, { id: "w2", anonymousCode: null }]);
    expect((await cerrarConvocatoria("c1")).ok).toBe(true);
    const codigos = db.culturalCallWork.update.mock.calls.map((c) => c[0].data.anonymousCode).sort();
    expect(codigos).toEqual(["O-001", "O-002"]);
    expect(db.culturalCallWork.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { callId: "c1", submission: { status: "ACTIVE" } } }));
    expect(correos.avisarConvocatoriaCerrada).toHaveBeenCalledWith("c1");
  });
  it("si se cambia el estado en el medio, no avisa", async () => {
    vi.useFakeTimers({ now: new Date("2026-12-02T15:00:00Z"), toFake: ["Date"] });
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "OPEN" });
    db.culturalCall.updateMany.mockResolvedValue({ count: 0 });
    expect((await cerrarConvocatoria("c1")).ok).toBe(false);
    expect(correos.avisarConvocatoriaCerrada).not.toHaveBeenCalled();
  });
  it("empezar la curaduría exige un curador activo", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "CLOSED" });
    db.culturalCallWork.count.mockResolvedValue(5);
    expect((await empezarCuraduria("c1")).ok).toBe(false);
    db.culturalCallCurator.count.mockResolvedValue(1);
    expect((await empezarCuraduria("c1")).ok).toBe(true);
  });
  it("volver a borrador con envíos: sólo el super admin", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "OPEN" });
    db.culturalCallSubmission.count.mockResolvedValue(3);
    expect((await volverABorrador("c1")).ok).toBe(false);
    usuarioActual.valor = { id: 1, esSuperAdmin: true, email: "d@x", name: "Daniel" };
    expect((await volverABorrador("c1")).ok).toBe(true);
  });
  it("cerrar la curaduría avisa los resultados una sola vez por cierre", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "CURATING" });
    expect((await cerrarCuraduria("c1")).ok).toBe(true);
    expect(db.culturalCall.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c1", status: "CURATING" }, data: expect.objectContaining({ status: "DONE" }) }));
    expect(correos.avisarResultados).toHaveBeenCalledWith("c1");
  });
  it("un curador no cierra la curaduría", async () => {
    usuarioActual.valor = beto;
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "CURATING" });
    expect((await cerrarCuraduria("c1")).ok).toBe(false);
    expect(correos.avisarResultados).not.toHaveBeenCalled();
  });
});
```

Run: `pnpm --filter muestras test -- lib/convocatorias`
Expected: FAIL — `Failed to resolve import "./mapear"` y `"./acciones"`.

- [ ] **Step 2: Implementar**

`apps/muestras/lib/convocatorias/mapear.ts`:
```ts
import { CALL_TEXT_LIMITS, DEFAULT_WORKS_PER_PERSON, dayEndAr, dayStartAr, editableCallFields } from "@repo/muestras";

export type ConvocatoriaForm = {
  id: string | null;
  title: string;
  basesText: string;
  requirementsText: string | null;
  rightsText: string;
  opensDay: string;
  closesDay: string;
  maxWorksPerPerson: number;
};

/** Texto de derechos con el que arranca toda convocatoria; el organizador lo adapta. */
export const DERECHOS_SUGERIDOS =
  "Declaro que soy autor/a de las obras que envío y que tengo los derechos para hacerlo. Si alguna queda seleccionada, autorizo a la organización a exhibirla en la muestra y a publicarla en su galería virtual, con mi nombre como autor/a, sin fines comerciales. Conservo todos mis derechos sobre las obras.";

export const REQUISITOS_SUGERIDOS =
  "JPG o PNG, idealmente de al menos 2000 px de lado mayor (las achicamos para la web). Sin marcas de agua, firmas ni tu nombre en la imagen: la selección es anónima.";

const txt = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max).trim();

export function convocatoriaDesdeFormData(fd: FormData): ConvocatoriaForm {
  const max = Number(String(fd.get("maxWorksPerPerson") ?? ""));
  return {
    id: txt(fd, "id", 40) || null,
    title: txt(fd, "title", CALL_TEXT_LIMITS.title),
    basesText: txt(fd, "basesText", CALL_TEXT_LIMITS.basesText),
    requirementsText: txt(fd, "requirementsText", CALL_TEXT_LIMITS.requirementsText) || null,
    rightsText: txt(fd, "rightsText", CALL_TEXT_LIMITS.rightsText),
    opensDay: txt(fd, "opensDay", 10),
    closesDay: txt(fd, "closesDay", 10),
    maxWorksPerPerson: Number.isInteger(max) ? max : DEFAULT_WORKS_PER_PERSON,
  };
}

export type DatosConvocatoria = {
  title?: string;
  basesText?: string;
  requirementsText?: string | null;
  rightsText?: string;
  opensAt?: Date;
  closesAt?: Date;
  maxWorksPerPerson?: number;
};

/**
 * Sólo los campos que el estado deja cambiar (`editableCallFields`); el resto se ignora aunque
 * venga en el formulario. Tira `Error` si una fecha editable no es válida.
 */
export function datosParaGuardar(f: ConvocatoriaForm, status: string): DatosConvocatoria {
  const campos = new Set(editableCallFields(status));
  const d: DatosConvocatoria = {};
  if (campos.has("title")) d.title = f.title;
  if (campos.has("basesText")) d.basesText = f.basesText;
  if (campos.has("requirementsText")) d.requirementsText = f.requirementsText;
  if (campos.has("rightsText")) d.rightsText = f.rightsText;
  if (campos.has("opensDay")) d.opensAt = dayStartAr(f.opensDay);
  if (campos.has("closesDay")) d.closesAt = dayEndAr(f.closesDay);
  if (campos.has("maxWorksPerPerson")) d.maxWorksPerPerson = f.maxWorksPerPerson;
  return d;
}
```

`apps/muestras/lib/convocatorias/consultas.ts`:
```ts
import "server-only";
import { cache } from "react";
import { prisma } from "@repo/db";
import type { Usuario } from "@/lib/usuario";

/** Datos de la muestra que se muestran junto a la convocatoria (nada de revisión). */
const MUESTRA_PUBLICA = {
  select: { title: true, slug: true, reviewStatus: true, coverImageUrl: true, venueName: true, city: true, province: true, isVirtualOnly: true, startsAt: true, endsAt: true },
} as const;

/** Abiertas (recibiendo o por recibir). El filtro fino por fecha lo hace `callPhase`. */
export function listarConvocatoriasPublicas() {
  return prisma.culturalCall.findMany({
    where: { status: "OPEN" },
    select: { id: true, slug: true, title: true, status: true, opensAt: true, closesAt: true, maxWorksPerPerson: true, activity: MUESTRA_PUBLICA },
    orderBy: { closesAt: "asc" },
    take: 200,
  });
}

/** Cualquiera que no sea borrador: un enlace compartido no se rompe al cerrar. */
export const buscarConvocatoriaPublica = cache((slug: string) =>
  prisma.culturalCall.findFirst({
    where: { slug, status: { not: "DRAFT" } },
    select: {
      id: true, slug: true, title: true, status: true, basesText: true, requirementsText: true, rightsText: true,
      opensAt: true, closesAt: true, maxWorksPerPerson: true, activity: { select: { ...MUESTRA_PUBLICA.select, proposedByUserId: true } },
    },
  }),
);

/** Las convocatorias que organiza la persona (todas, si es super admin: modera). */
export function listarConvocatoriasMias(usuario: Usuario) {
  return prisma.culturalCall.findMany({
    where: usuario.esSuperAdmin ? {} : { activity: { proposedByUserId: usuario.id } },
    select: {
      id: true, title: true, status: true, opensAt: true, closesAt: true,
      activity: { select: { title: true, proposedByUserId: true } },
      _count: { select: { submissions: { where: { status: "ACTIVE" } }, curators: { where: { status: "ACTIVE" } } } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/** Muestras propias que todavía no tienen convocatoria. */
export function muestrasSinConvocatoria(userId: number) {
  return prisma.culturalActivity.findMany({
    where: { proposedByUserId: userId, type: "MUESTRA", call: null, reviewStatus: { not: "UNPUBLISHED" } },
    select: { id: true, title: true, reviewStatus: true },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Una convocatoria para su organizador (o el super admin). Sin identidades: sólo cuentas.
 * `null` si no existe o no es suya.
 */
export async function buscarConvocatoriaDelOrganizador(id: string, usuario: Usuario) {
  const c = await prisma.culturalCall.findUnique({
    where: { id },
    include: {
      activity: { select: { id: true, title: true, slug: true, reviewStatus: true, proposedByUserId: true, _count: { select: { works: true } } } },
      curators: { select: { id: true, email: true, status: true, invitedAt: true, acceptedAt: true }, orderBy: { invitedAt: "asc" } },
      _count: { select: { submissions: { where: { status: "ACTIVE" } } } },
    },
  });
  if (!c) return null;
  if (!usuario.esSuperAdmin && c.activity.proposedByUserId !== usuario.id) return null;
  const obras = await prisma.culturalCallWork.count({ where: { callId: id, submission: { status: "ACTIVE" } } });
  return { ...c, obras };
}
```

`apps/muestras/lib/convocatorias/acciones.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import {
  DEFAULT_WORKS_PER_PERSON, anonymousCodes, canCallAction, closeDayProblem, dayEndAr, dayStartAr, missingForOpening,
  newSlug, nextCallStatus, toArDay, type CallAction,
} from "@repo/muestras";
import { getUsuario } from "@/lib/usuario";
import { frenarPorUsuario } from "@/lib/limite";
import { avisarConvocatoriaCerrada, avisarResultados } from "@/lib/correos/convocatorias";
import type { ResultadoAccion } from "@/lib/actividades/acciones";
import { DERECHOS_SUGERIDOS, REQUISITOS_SUGERIDOS, convocatoriaDesdeFormData, datosParaGuardar } from "./mapear";

const SIN_SESION: ResultadoAccion = { ok: false, errores: ["Tenés que ingresar."] };
const NO_EXISTE: ResultadoAccion = { ok: false, errores: ["La convocatoria no existe."] };
const CAMBIO: ResultadoAccion = { ok: false, errores: ["La convocatoria cambió mientras tanto. Recargá la página."] };

function refrescar(slug?: string) {
  revalidatePath("/panel", "layout");
  revalidatePath("/convocatorias");
  if (slug) revalidatePath(`/convocatorias/${slug}`, "layout");
}

/** Crea la convocatoria de una muestra propia, en borrador y con textos sugeridos. */
export async function crearConvocatoria(activityId: string): Promise<ResultadoAccion> {
  if (typeof activityId !== "string") return NO_EXISTE;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const a = await prisma.culturalActivity.findUnique({ where: { id: activityId }, select: { id: true, title: true, type: true, proposedByUserId: true, call: { select: { id: true } } } });
  if (!a || (a.proposedByUserId !== usuario.id && !usuario.esSuperAdmin)) return { ok: false, errores: ["La muestra no existe."] };
  if (a.type !== "MUESTRA") return { ok: false, errores: ["Sólo una muestra puede tener convocatoria."] };
  if (a.call) return { ok: true, id: a.call.id };
  if (!frenarPorUsuario("crearConvocatoria", usuario.id).allowed) {
    return { ok: false, errores: ["Creaste muchas convocatorias seguidas. Esperá un rato y probá de nuevo."] };
  }
  const hoy = toArDay(new Date());
  const enUnMes = toArDay(new Date(dayStartAr(hoy).getTime() + 30 * 24 * 60 * 60 * 1000));
  const creada = await prisma.culturalCall.create({
    data: {
      activityId: a.id, slug: newSlug(a.title), title: a.title, basesText: "", rightsText: DERECHOS_SUGERIDOS,
      requirementsText: REQUISITOS_SUGERIDOS, opensAt: dayStartAr(hoy), closesAt: dayEndAr(enUnMes),
      maxWorksPerPerson: DEFAULT_WORKS_PER_PERSON, createdByUserId: usuario.id,
    },
    select: { id: true },
  });
  refrescar();
  return { ok: true, id: creada.id };
}

/** Guarda lo que el estado deja cambiar. No cambia el estado. */
export async function guardarConvocatoria(fd: FormData): Promise<ResultadoAccion> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const f = convocatoriaDesdeFormData(fd);
  if (!f.id) return NO_EXISTE;
  const c = await prisma.culturalCall.findUnique({ where: { id: f.id }, select: { id: true, slug: true, status: true, closesAt: true, activity: { select: { proposedByUserId: true } } } });
  if (!c || (c.activity.proposedByUserId !== usuario.id && !usuario.esSuperAdmin)) return NO_EXISTE;
  if (c.status !== "DRAFT" && c.status !== "OPEN") return { ok: false, errores: ["La convocatoria ya cerró: no se puede editar."] };
  if (c.status === "OPEN" && !f.title) return { ok: false, errores: ["Falta el título de la convocatoria."] };
  const problema = closeDayProblem(c.status, c.closesAt, f.closesDay);
  if (problema) return { ok: false, errores: [problema] };
  let datos;
  try {
    datos = datosParaGuardar(f, c.status);
  } catch {
    return { ok: false, errores: ["Revisá las fechas."] };
  }
  const { count } = await prisma.culturalCall.updateMany({ where: { id: c.id, status: c.status }, data: datos });
  if (count === 0) return CAMBIO;
  refrescar(c.slug);
  return { ok: true, id: c.id };
}

async function transicion(id: string, accion: CallAction, extra: (ahora: Date) => Record<string, unknown>): Promise<ResultadoAccion & { slug?: string }> {
  if (typeof id !== "string") return NO_EXISTE;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const c = await prisma.culturalCall.findUnique({ where: { id }, include: { activity: { select: { proposedByUserId: true } } } });
  if (!c) return NO_EXISTE;
  const [envios, curadores, obras] = await Promise.all([
    prisma.culturalCallSubmission.count({ where: { callId: id, status: "ACTIVE" } }),
    prisma.culturalCallCurator.count({ where: { callId: id, status: "ACTIVE" } }),
    prisma.culturalCallWork.count({ where: { callId: id, submission: { status: "ACTIVE" } } }),
  ]);
  const ahora = new Date();
  const permiso = canCallAction(accion, { status: c.status, opensAt: c.opensAt, closesAt: c.closesAt, ownerUserId: c.activity.proposedByUserId }, { userId: usuario.id, isSuperAdmin: usuario.esSuperAdmin }, {
    now: ahora,
    activeSubmissions: envios,
    activeCurators: curadores,
    works: obras,
    missingForOpening: accion === "open"
      ? missingForOpening({ title: c.title, basesText: c.basesText, rightsText: c.rightsText, opensDay: toArDay(c.opensAt), closesDay: toArDay(c.closesAt), maxWorksPerPerson: c.maxWorksPerPerson }, toArDay(ahora))
      : [],
  });
  if (!permiso.ok) return { ok: false, errores: [permiso.reason] };
  const { count } = await prisma.culturalCall.updateMany({
    where: { id, status: c.status },
    data: { status: nextCallStatus(accion, c.status), ...extra(ahora) },
  });
  if (count === 0) return CAMBIO;
  refrescar(c.slug);
  return { ok: true, id, slug: c.slug };
}

export async function abrirConvocatoria(id: string) {
  return transicion(id, "open", (ahora) => ({ openedAt: ahora }));
}

export async function volverABorrador(id: string) {
  return transicion(id, "unpublish", () => ({}));
}

/**
 * Código anónimo de cada obra de un envío activo: la posición en un orden por hash. Determinista:
 * correrlo dos veces da lo mismo, así que se repite al empezar la curaduría por si el cierre se
 * cortó a mitad de camino.
 */
async function congelarCodigos(id: string) {
  const obras = await prisma.culturalCallWork.findMany({ where: { callId: id, submission: { status: "ACTIVE" } }, select: { id: true, anonymousCode: true } });
  const codigos = anonymousCodes(id, obras.map((o) => o.id));
  const pendientes = obras.filter((o) => o.anonymousCode !== codigos.get(o.id));
  if (pendientes.length === 0) return;
  // Una actualización por obra; 60 s alcanzan para cientos de obras contra Neon.
  await prisma.$transaction(
    async (tx) => {
      for (const o of pendientes) await tx.culturalCallWork.update({ where: { id: o.id }, data: { anonymousCode: codigos.get(o.id)! } });
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}

/** Cierra (sólo después de la fecha de cierre), congela los códigos y avisa a quienes enviaron. */
export async function cerrarConvocatoria(id: string): Promise<ResultadoAccion> {
  const r = await transicion(id, "close", (ahora) => ({ closedAt: ahora }));
  if (!r.ok) return r;
  await congelarCodigos(id);
  await avisarConvocatoriaCerrada(id);
  return { ok: true, id };
}

export async function empezarCuraduria(id: string): Promise<ResultadoAccion> {
  if (typeof id !== "string") return NO_EXISTE;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const c = await prisma.culturalCall.findUnique({ where: { id }, select: { status: true, activity: { select: { proposedByUserId: true } } } });
  if (c && c.status === "CLOSED" && (c.activity.proposedByUserId === usuario.id || usuario.esSuperAdmin)) await congelarCodigos(id);
  return transicion(id, "startCuration", (ahora) => ({ curationStartedAt: ahora }));
}

/**
 * Cierra la curaduría: las decisiones quedan firmes, el organizador ve quién mandó cada obra y
 * se avisa a cada participante si quedó o no. Lo que quedó sin decidir cuenta como no elegido.
 */
export async function cerrarCuraduria(id: string): Promise<ResultadoAccion> {
  const r = await transicion(id, "closeCuration", (ahora) => ({ curationClosedAt: ahora }));
  if (!r.ok) return r;
  await avisarResultados(id);
  return { ok: true, id };
}
```

- [ ] **Step 3: Correr y ver que pasa**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types`
Expected: PASS (24 tests nuevos), sin errores de tipos.

- [ ] **Step 4: Commit**

```bash
git add apps/muestras/lib/convocatorias
git commit -m "Convocatorias: crear, editar según el estado, abrir, cerrar con códigos anónimos y curaduría"
```

---
### Task 8: Equipo curatorial — invitar, sacar, aceptar y puntuar

**Files:**
- Create: `apps/muestras/lib/curaduria/acciones.ts`, `apps/muestras/lib/curaduria/consultas.ts`
- Create: `apps/muestras/components/curaduria/aceptar-invitacion.tsx`, `apps/muestras/app/panel/curaduria/invitacion/[token]/page.tsx`
- Test: `apps/muestras/lib/curaduria/acciones.test.ts`

**Interfaces:**
- Consumes: Task 5 (token), Task 2 (`invitationState`, `normalizeEmail`, `canScore`, `isValidScore`, `curatorOrder`, `toCuratorView`), Task 6 (`avisarInvitacionCurador`).
- Produces:
  - `acciones.ts`: `invitarCurador(callId, email)` (crea o renueva; token nuevo; nunca a quien envió), `revocarCurador(curatorId)`, `aceptarInvitacion(token)` (cualquier cuenta; un solo uso; vence a los 30 días; no si envió), `puntuar(callWorkId, score, nota)` (upsert por `callWorkId_curatorId`).
  - `consultas.ts`: `listarMisCuradurias(userId)` → `{ curatorId, call, puntuadas, total }[]`; `ColaDelCurador = { call: { id; title; status; basesText }; obras: CuratorWorkView[] }`; `colaDelCurador(callId, userId): ColaDelCurador | null`; `buscarInvitacion(token)` → `{ email, callId, convocatoria, estado } | null`.

- [ ] **Step 1: Escribir el test que falla**

`apps/muestras/lib/curaduria/acciones.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { findMany: vi.fn() },
  culturalCall: { findUnique: vi.fn() },
  culturalCallSubmission: { findFirst: vi.fn() },
  culturalCallCurator: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  culturalCallWork: { findUnique: vi.fn() },
  culturalCallScore: { upsert: vi.fn() },
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
const correos = vi.hoisted(() => ({ avisarInvitacionCurador: vi.fn() }));

vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("@/lib/correos/convocatorias", () => correos);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { aceptarInvitacion, invitarCurador, puntuar, revocarCurador } = await import("./acciones");
const { hashDeToken } = await import("./token");
const { resetRateLimit } = await import("@/lib/limite");

const ana = { id: 7, esSuperAdmin: false, email: "ana@x", name: "Ana" };
const carla = { id: 20, esSuperAdmin: false, email: "carla@x.com", name: "Carla" };
const conv = { id: "c1", title: "Ciudad", status: "OPEN", activity: { proposedByUserId: 7 } };
const TOKEN = "a".repeat(43);

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = ana;
  db.culturalCall.findUnique.mockResolvedValue(conv);
  db.user.findMany.mockResolvedValue([]);
  db.culturalCallSubmission.findFirst.mockResolvedValue(null);
  db.culturalCallCurator.findUnique.mockResolvedValue(null);
  db.culturalCallCurator.findFirst.mockResolvedValue(null);
  db.culturalCallCurator.create.mockResolvedValue({ id: "k1" });
  db.culturalCallCurator.update.mockResolvedValue({ id: "k1" });
  db.culturalCallCurator.updateMany.mockResolvedValue({ count: 1 });
});

describe("invitarCurador", () => {
  it("crea la invitación guardando sólo el hash y manda el enlace con el token", async () => {
    expect(await invitarCurador("c1", " Carla@X.com ")).toEqual({ ok: true, id: "k1" });
    const data = db.culturalCallCurator.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ callId: "c1", email: "carla@x.com", invitedByUserId: 7 });
    const aviso = correos.avisarInvitacionCurador.mock.calls[0][0];
    expect(aviso).toMatchObject({ email: "carla@x.com", convocatoria: "Ciudad", organizador: "Ana" });
    expect(data.tokenHash).toBe(hashDeToken(aviso.token));
  });
  it("sólo quien organiza", async () => {
    usuarioActual.valor = carla;
    expect((await invitarCurador("c1", "x@y.com")).ok).toBe(false);
    expect(db.culturalCallCurator.create).not.toHaveBeenCalled();
  });
  it("no invita a quien envió obras", async () => {
    db.user.findMany.mockResolvedValue([{ id: 20 }]);
    db.culturalCallSubmission.findFirst.mockResolvedValue({ id: "s1" });
    expect((await invitarCurador("c1", "carla@x.com")).ok).toBe(false);
  });
  it("renueva una invitación revocada", async () => {
    db.culturalCallCurator.findUnique.mockResolvedValue({ id: "k0", status: "REVOKED" });
    expect((await invitarCurador("c1", "carla@x.com")).ok).toBe(true);
    expect(db.culturalCallCurator.update.mock.calls[0][0].data).toMatchObject({ status: "INVITED", revokedAt: null });
  });
  it("email inválido", async () => expect(await invitarCurador("c1", "nada")).toEqual({ ok: false, errores: ["Escribí un email válido."] }));
  it("con la selección terminada no se suma gente", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "DONE" });
    expect((await invitarCurador("c1", "carla@x.com")).ok).toBe(false);
  });
});

describe("revocarCurador", () => {
  it("el organizador saca a alguien", async () => {
    db.culturalCallCurator.findUnique.mockResolvedValue({ callId: "c1" });
    expect((await revocarCurador("k1")).ok).toBe(true);
    expect(db.culturalCallCurator.updateMany.mock.calls[0][0].data).toMatchObject({ status: "REVOKED" });
  });
});

describe("aceptarInvitacion", () => {
  beforeEach(() => {
    usuarioActual.valor = carla;
    db.culturalCallCurator.findUnique.mockResolvedValue({ id: "k1", callId: "c1", status: "INVITED", invitedAt: new Date() });
  });
  it("activa con la cuenta que entró, buscando por el hash", async () => {
    expect(await aceptarInvitacion(TOKEN)).toEqual({ ok: true, id: "c1" });
    expect(db.culturalCallCurator.findUnique.mock.calls[0][0].where).toEqual({ tokenHash: hashDeToken(TOKEN) });
    expect(db.culturalCallCurator.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: "k1", status: "INVITED" }, data: { status: "ACTIVE", userId: 20 } });
  });
  it("un token sin forma ni se busca", async () => {
    expect((await aceptarInvitacion("x")).ok).toBe(false);
    expect(db.culturalCallCurator.findUnique).not.toHaveBeenCalled();
  });
  it("vencida", async () => {
    db.culturalCallCurator.findUnique.mockResolvedValue({ id: "k1", callId: "c1", status: "INVITED", invitedAt: new Date(Date.now() - 31 * 864e5) });
    expect(await aceptarInvitacion(TOKEN)).toMatchObject({ ok: false, errores: [expect.stringMatching(/venció/)] });
  });
  it("ya usada", async () => {
    db.culturalCallCurator.findUnique.mockResolvedValue({ id: "k1", callId: "c1", status: "ACTIVE", invitedAt: new Date() });
    expect(await aceptarInvitacion(TOKEN)).toMatchObject({ ok: false, errores: [expect.stringMatching(/ya se usó/)] });
  });
  it("quien envió obras no puede aceptar", async () => {
    db.culturalCallSubmission.findFirst.mockResolvedValue({ id: "s1" });
    expect((await aceptarInvitacion(TOKEN)).ok).toBe(false);
    expect(db.culturalCallCurator.updateMany).not.toHaveBeenCalled();
  });
});

describe("puntuar", () => {
  const obra = { id: "w1", callId: "c1", anonymousCode: "O-001", submission: { status: "ACTIVE" }, call: { status: "CURATING" } };
  beforeEach(() => {
    usuarioActual.valor = carla;
    db.culturalCallWork.findUnique.mockResolvedValue(obra);
    db.culturalCallCurator.findFirst.mockResolvedValue({ id: "k1", status: "ACTIVE" });
  });
  it("guarda o corrige el puntaje propio con su nota", async () => {
    expect((await puntuar("w1", 4, "  linda luz ")).ok).toBe(true);
    expect(db.culturalCallScore.upsert).toHaveBeenCalledWith({
      where: { callWorkId_curatorId: { callWorkId: "w1", curatorId: "k1" } },
      create: { callWorkId: "w1", curatorId: "k1", score: 4, note: "linda luz" },
      update: { score: 4, note: "linda luz" },
    });
  });
  it("fuera de 1 a 5 no", async () => {
    expect((await puntuar("w1", 6, "")).ok).toBe(false);
    expect(db.culturalCallWork.findUnique).not.toHaveBeenCalled();
  });
  it("sin curaduría abierta no", async () => {
    db.culturalCallWork.findUnique.mockResolvedValue({ ...obra, call: { status: "DONE" } });
    expect((await puntuar("w1", 3, "")).ok).toBe(false);
  });
  it("un curador revocado no", async () => {
    db.culturalCallCurator.findFirst.mockResolvedValue({ id: "k1", status: "REVOKED" });
    expect((await puntuar("w1", 3, "")).ok).toBe(false);
    expect(db.culturalCallScore.upsert).not.toHaveBeenCalled();
  });
  it("alguien que no es curador no", async () => {
    db.culturalCallCurator.findFirst.mockResolvedValue(null);
    expect((await puntuar("w1", 3, "")).ok).toBe(false);
  });
});
```

Run: `pnpm --filter muestras test -- lib/curaduria`
Expected: FAIL — `Failed to resolve import "./acciones"`.

- [ ] **Step 2: Implementar**

`apps/muestras/lib/curaduria/acciones.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { CALL_TEXT_LIMITS, canScore, invitationState, isValidScore, normalizeEmail } from "@repo/muestras";
import { getUsuario, type Usuario } from "@/lib/usuario";
import { frenarPorUsuario } from "@/lib/limite";
import { avisarInvitacionCurador } from "@/lib/correos/convocatorias";
import type { ResultadoAccion } from "@/lib/actividades/acciones";
import { esTokenConForma, hashDeToken, nuevoTokenDeInvitacion } from "./token";

const SIN_SESION: ResultadoAccion = { ok: false, errores: ["Tenés que ingresar."] };
const NO_EXISTE: ResultadoAccion = { ok: false, errores: ["La convocatoria no existe."] };
const INVITACION_INVALIDA: ResultadoAccion = { ok: false, errores: ["La invitación no es válida."] };

/** Convocatoria del organizador (o super admin) que todavía admite cambios en el equipo. */
async function convocatoriaParaEquipo(callId: string, usuario: Usuario) {
  const c = await prisma.culturalCall.findUnique({ where: { id: callId }, select: { id: true, title: true, status: true, activity: { select: { proposedByUserId: true } } } });
  if (!c || (c.activity.proposedByUserId !== usuario.id && !usuario.esSuperAdmin)) return null;
  return c;
}

/** Invita por email. Si ya estaba invitada (o revocada), renueva el enlace. */
export async function invitarCurador(callId: string, emailCrudo: string): Promise<ResultadoAccion> {
  if (typeof callId !== "string" || typeof emailCrudo !== "string") return NO_EXISTE;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const c = await convocatoriaParaEquipo(callId, usuario);
  if (!c) return NO_EXISTE;
  if (c.status === "DONE") return { ok: false, errores: ["La selección ya terminó."] };
  const email = normalizeEmail(emailCrudo);
  if (!email) return { ok: false, errores: ["Escribí un email válido."] };
  if (!frenarPorUsuario("invitarCurador", usuario.id).allowed) {
    return { ok: false, errores: ["Mandaste muchas invitaciones seguidas. Esperá un rato y probá de nuevo."] };
  }
  // Quien envió obras no puede curar: vería (y puntuaría) las suyas.
  const envio = await prisma.culturalCallSubmission.findFirst({
    where: { callId, userId: { in: (await prisma.user.findMany({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } })).map((u) => u.id) } },
    select: { id: true },
  });
  if (envio) return { ok: false, errores: ["Esa persona envió obras a esta convocatoria: no puede ser parte del equipo curatorial."] };

  const { token, hash } = nuevoTokenDeInvitacion();
  const ahora = new Date();
  const previo = await prisma.culturalCallCurator.findUnique({ where: { callId_email: { callId, email } }, select: { id: true, status: true } });
  if (previo?.status === "ACTIVE") return { ok: false, errores: ["Esa persona ya es parte del equipo curatorial."] };
  const fila = previo
    ? await prisma.culturalCallCurator.update({ where: { id: previo.id }, data: { tokenHash: hash, status: "INVITED", invitedAt: ahora, invitedByUserId: usuario.id, revokedAt: null }, select: { id: true } })
    : await prisma.culturalCallCurator.create({ data: { callId, email, tokenHash: hash, invitedByUserId: usuario.id, invitedAt: ahora }, select: { id: true } });
  await avisarInvitacionCurador({ email, token, convocatoria: c.title, organizador: usuario.name ?? usuario.email, invitedAt: ahora });
  revalidatePath(`/panel/convocatorias/${callId}`);
  return { ok: true, id: fila.id };
}

/** Saca a alguien del equipo. Sus puntajes dejan de contar en el ranking. */
export async function revocarCurador(curatorId: string): Promise<ResultadoAccion> {
  if (typeof curatorId !== "string") return NO_EXISTE;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const k = await prisma.culturalCallCurator.findUnique({ where: { id: curatorId }, select: { callId: true } });
  if (!k) return NO_EXISTE;
  const c = await convocatoriaParaEquipo(k.callId, usuario);
  if (!c) return NO_EXISTE;
  if (c.status === "DONE") return { ok: false, errores: ["La selección ya terminó."] };
  await prisma.culturalCallCurator.updateMany({ where: { id: curatorId, status: { not: "REVOKED" } }, data: { status: "REVOKED", revokedAt: new Date() } });
  revalidatePath(`/panel/convocatorias/${k.callId}`);
  return { ok: true, id: curatorId };
}

/**
 * Acepta con la cuenta con la que entró. No exige que el email coincida (mucha gente tiene más de
 * una cuenta de Google): el enlace es de un solo uso y vence a los 30 días.
 */
export async function aceptarInvitacion(token: string): Promise<ResultadoAccion> {
  if (!esTokenConForma(token)) return INVITACION_INVALIDA;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  if (!frenarPorUsuario("aceptarInvitacion", usuario.id).allowed) return { ok: false, errores: ["Demasiados intentos. Esperá un rato."] };
  const k = await prisma.culturalCallCurator.findUnique({ where: { tokenHash: hashDeToken(token) }, select: { id: true, callId: true, status: true, invitedAt: true } });
  if (!k) return INVITACION_INVALIDA;
  const estado = invitationState(k, new Date());
  if (estado === "USED") return { ok: false, errores: ["Esta invitación ya se usó."] };
  if (estado === "EXPIRED") return { ok: false, errores: ["La invitación venció. Pedile a quien organiza que te la vuelva a mandar."] };
  if (estado === "REVOKED") return INVITACION_INVALIDA;
  const [envio, yaEsta] = await Promise.all([
    prisma.culturalCallSubmission.findFirst({ where: { callId: k.callId, userId: usuario.id }, select: { id: true } }),
    prisma.culturalCallCurator.findFirst({ where: { callId: k.callId, userId: usuario.id, status: "ACTIVE" }, select: { id: true } }),
  ]);
  if (envio) return { ok: false, errores: ["Enviaste obras a esta convocatoria: no podés ser parte del equipo curatorial."] };
  if (yaEsta) return { ok: true, id: k.callId };
  const { count } = await prisma.culturalCallCurator.updateMany({
    where: { id: k.id, status: "INVITED" },
    data: { status: "ACTIVE", userId: usuario.id, acceptedAt: new Date() },
  });
  if (count === 0) return { ok: false, errores: ["Esta invitación ya se usó."] };
  revalidatePath("/panel/curaduria");
  return { ok: true, id: k.callId };
}

/** Puntaje de 1 a 5 y nota optativa del curador a una obra. Se puede cambiar mientras dure la curaduría. */
export async function puntuar(callWorkId: string, score: number, nota: string): Promise<ResultadoAccion> {
  if (typeof callWorkId !== "string") return NO_EXISTE;
  if (!isValidScore(score)) return { ok: false, errores: ["El puntaje va de 1 a 5."] };
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  if (!frenarPorUsuario("puntuar", usuario.id).allowed) return { ok: false, errores: ["Vas muy rápido. Esperá unos minutos."] };
  const w = await prisma.culturalCallWork.findUnique({
    where: { id: callWorkId },
    select: { id: true, callId: true, anonymousCode: true, submission: { select: { status: true } }, call: { select: { status: true } } },
  });
  if (!w || !w.anonymousCode || w.submission.status !== "ACTIVE") return { ok: false, errores: ["La obra no existe."] };
  const k = await prisma.culturalCallCurator.findFirst({ where: { callId: w.callId, userId: usuario.id }, select: { id: true, status: true } });
  if (!k || !canScore({ status: w.call.status, curatorStatus: k.status })) return { ok: false, errores: ["No podés puntuar esta obra ahora."] };
  const note = typeof nota === "string" ? nota.trim().slice(0, CALL_TEXT_LIMITS.note).trim() || null : null;
  await prisma.culturalCallScore.upsert({
    where: { callWorkId_curatorId: { callWorkId, curatorId: k.id } },
    create: { callWorkId, curatorId: k.id, score, note },
    update: { score, note },
  });
  return { ok: true, id: callWorkId };
}
```

`apps/muestras/lib/curaduria/consultas.ts`:
```ts
import "server-only";
import { prisma } from "@repo/db";
import { curatorOrder, invitationState, toCuratorView, type CuratorWorkView } from "@repo/muestras";
import { hashDeToken, esTokenConForma } from "./token";

/** Las convocatorias donde la persona es curadora activa, con su avance. */
export async function listarMisCuradurias(userId: number) {
  const filas = await prisma.culturalCallCurator.findMany({
    where: { userId, status: "ACTIVE" },
    select: {
      id: true,
      call: { select: { id: true, title: true, status: true, closesAt: true } },
      _count: { select: { scores: true } },
    },
    orderBy: { acceptedAt: "desc" },
  });
  const totales = await Promise.all(filas.map((f) => prisma.culturalCallWork.count({ where: { callId: f.call.id, anonymousCode: { not: null }, submission: { status: "ACTIVE" } } })));
  return filas.map((f, i) => ({ curatorId: f.id, call: f.call, puntuadas: f._count.scores, total: totales[i] }));
}

export type ColaDelCurador = {
  call: { id: string; title: string; status: string; basesText: string };
  obras: CuratorWorkView[];
};

/**
 * Lo que ve un curador. La consulta pide sólo los campos permitidos (nunca el envío, el autor
 * ni la URL de la imagen) y `toCuratorView` vuelve a armar cada obra campo por campo.
 * `null` si no es curador activo o la curaduría no empezó.
 */
export async function colaDelCurador(callId: string, userId: number): Promise<ColaDelCurador | null> {
  const k = await prisma.culturalCallCurator.findFirst({ where: { callId, userId, status: "ACTIVE" }, select: { id: true } });
  if (!k) return null;
  const call = await prisma.culturalCall.findUnique({ where: { id: callId }, select: { id: true, title: true, status: true, basesText: true } });
  if (!call || (call.status !== "CURATING" && call.status !== "DONE")) return null;
  const obras = await prisma.culturalCallWork.findMany({
    where: { callId, anonymousCode: { not: null }, submission: { status: "ACTIVE" } },
    select: {
      id: true, anonymousCode: true, title: true, year: true, technique: true, statement: true,
      scores: { where: { curatorId: k.id }, select: { score: true, note: true } },
    },
  });
  const vistas = obras.map((o) => toCuratorView(o, o.scores[0] ?? null));
  return { call, obras: curatorOrder(vistas, k.id, callId) };
}

/** Para la página de la invitación: de qué convocatoria es y si sigue vigente. */
export async function buscarInvitacion(token: string) {
  if (!esTokenConForma(token)) return null;
  const k = await prisma.culturalCallCurator.findUnique({
    where: { tokenHash: hashDeToken(token) },
    select: { email: true, status: true, invitedAt: true, call: { select: { id: true, title: true } } },
  });
  if (!k) return null;
  return { email: k.email, callId: k.call.id, convocatoria: k.call.title, estado: invitationState(k, new Date()) };
}
```

Run: `pnpm --filter muestras test -- lib/curaduria`
Expected: PASS (los 3 de token y 17 nuevos).

- [ ] **Step 3: Página de la invitación**

`apps/muestras/components/curaduria/aceptar-invitacion.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { botonLleno } from "@/components/convocatorias/estilos";
import { aceptarInvitacion } from "@/lib/curaduria/acciones";

export function AceptarInvitacion({ token }: { token: string }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pendiente}
        className={botonLleno}
        onClick={() => start(async () => {
          const r = await aceptarInvitacion(token);
          if (r.ok) router.push("/panel/curaduria");
          else setError(r.errores.join(" "));
        })}
      >
        Aceptar y sumarme al equipo
      </button>
      {error ? <p className="text-[var(--mf-alerta)]">{error}</p> : null}
    </div>
  );
}
```

`apps/muestras/app/panel/curaduria/invitacion/[token]/page.tsx`:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { AceptarInvitacion } from "@/components/curaduria/aceptar-invitacion";
import { buscarInvitacion } from "@/lib/curaduria/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
// El token va en la URL: que no viaje como referencia a ningún otro sitio.
export const metadata: Metadata = { title: "Invitación a curar", referrer: "no-referrer", robots: { index: false } };

type Props = { params: Promise<{ token: string }> };

export default async function Invitacion({ params }: Props) {
  const { token } = await params;
  const usuario = await requireUsuario(`/panel/curaduria/invitacion/${token}`);
  const inv = await buscarInvitacion(token);
  return (
    <main className="max-w-2xl space-y-6">
      <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Invitación a curar</h1>
      {!inv || inv.estado === "REVOKED" ? (
        <p className="text-lg">Esta invitación no es válida. Pedile a quien organiza que te mande una nueva.</p>
      ) : inv.estado === "USED" ? (
        <p className="text-lg">Esta invitación ya se usó. <Link href="/panel/curaduria" className="underline underline-offset-[6px]">Ir a Curaduría</Link></p>
      ) : inv.estado === "EXPIRED" ? (
        <p className="text-lg">La invitación venció. Pedile a quien organiza que te la vuelva a mandar.</p>
      ) : (
        <>
          <p className="text-lg leading-snug">Te invitaron a formar parte del equipo curatorial de <strong className="font-medium">{inv.convocatoria}</strong>.</p>
          <p className="text-[15px] text-[var(--mf-muted)]">
            La invitación se mandó a {inv.email}. Vas a quedar en el equipo con la cuenta con la que entraste ({usuario.email}). Si enviaste obras a esta convocatoria, no podés curarla.
          </p>
          <AceptarInvitacion token={token} />
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Chequeos y prueba**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: todo en verde.

En local (la página del organizador para invitar llega en la Task 9; mientras tanto, crear la fila de `CulturalCallCurator` a mano en una base de desarrollo). Para obtener el enlace en local, encender la compuerta con una clave de prueba de Resend, o generar uno a mano: `node -e 'const {randomBytes,createHash}=require("crypto");const t=randomBytes(32).toString("base64url");console.log(t, createHash("sha256").update(t).digest("hex"))'` y poner el hash en `tokenHash` de esa fila (sólo en una base de desarrollo). Abrir `/panel/curaduria/invitacion/<token>` con otra cuenta → "Aceptar y sumarme al equipo" → `/panel/curaduria`. Volver a abrir el enlace: "Esta invitación ya se usó."

- [ ] **Step 5: Commit**

```bash
git add apps/muestras/lib/curaduria/acciones.ts apps/muestras/lib/curaduria/acciones.test.ts apps/muestras/lib/curaduria/consultas.ts apps/muestras/components/curaduria/aceptar-invitacion.tsx "apps/muestras/app/panel/curaduria/invitacion/[token]/page.tsx"
git commit -m "Equipo curatorial: invitación de un solo uso, aceptar, sacar y puntuar"
```

---
### Task 9: Panel del organizador — Convocatorias y su página

**Files:**
- Create: `apps/muestras/components/convocatorias/estilos.ts`, `formulario-convocatoria.tsx`, `acciones-convocatoria.tsx`, `equipo-curatorial.tsx`, `crear-convocatoria.tsx`
- Create: `apps/muestras/app/panel/convocatorias/page.tsx`, `apps/muestras/app/panel/convocatorias/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 7 (consultas y acciones de la convocatoria), Task 8 (`invitarCurador`, `revocarCurador`).
- Produces: `campo`, `botonFino`, `botonLleno`, `enlace` (clases); `FormularioConvocatoria({ inicial: ConvocatoriaInicial })`, `AccionesConvocatoria({ id, fase })`, `EquipoCuratorial({ callId, curadores, editable })`, `CrearConvocatoria({ activityId })`.

- [ ] **Step 1: Componentes**

`apps/muestras/components/convocatorias/estilos.ts`:
```ts
/** Clases compartidas por los formularios de convocatoria, envío y curaduría (tokens del sitio). */
export const campo = "w-full rounded-[2px] border border-[var(--mf-line)] bg-white px-3 py-2 disabled:bg-[var(--mf-surface)] disabled:text-[var(--mf-muted)]";
export const botonFino = "inline-flex h-11 items-center justify-center rounded-[2px] border border-[var(--mf-ink)] px-5 text-[15px] transition-colors hover:bg-[var(--mf-ink)] hover:text-white disabled:opacity-50";
export const botonLleno = "inline-flex h-11 items-center justify-center rounded-[2px] bg-[var(--mf-ink)] px-5 text-[15px] text-white disabled:opacity-50";
export const enlace = "underline underline-offset-[6px]";
```

`apps/muestras/components/convocatorias/formulario-convocatoria.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MAX_WORKS_PER_PERSON_LIMIT, editableCallFields } from "@repo/muestras";
import { guardarConvocatoria } from "@/lib/convocatorias/acciones";
import { botonLleno, campo } from "./estilos";

export type ConvocatoriaInicial = {
  id: string; status: string; title: string; basesText: string; requirementsText: string; rightsText: string;
  opensDay: string; closesDay: string; maxWorksPerPerson: number;
};

/** Los campos que el estado no deja cambiar se ven, pero deshabilitados (el servidor igual los ignora). */
export function FormularioConvocatoria({ inicial }: { inicial: ConvocatoriaInicial }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [errores, setErrores] = useState<string[]>([]);
  const [guardado, setGuardado] = useState(false);
  const editables = new Set<string>(editableCallFields(inicial.status));
  const no = (k: string) => !editables.has(k);
  if (editables.size === 0) return null;

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("id", inicial.id);
        setGuardado(false);
        start(async () => {
          const r = await guardarConvocatoria(fd);
          if (!r.ok) return setErrores(r.errores);
          setErrores([]);
          setGuardado(true);
          router.refresh();
        });
      }}
    >
      <label className="block space-y-1">
        <span>Título de la convocatoria</span>
        <input name="title" defaultValue={inicial.title} disabled={no("title")} className={campo} />
      </label>
      <label className="block space-y-1">
        <span>Bases</span>
        <span className="block text-sm text-[var(--mf-muted)]">Tema, quién puede participar, cómo se elige y qué pasa con las obras elegidas.</span>
        <textarea name="basesText" rows={10} defaultValue={inicial.basesText} disabled={no("basesText")} className={campo} />
      </label>
      <label className="block space-y-1">
        <span>Requisitos de las imágenes</span>
        <textarea name="requirementsText" rows={3} defaultValue={inicial.requirementsText} disabled={no("requirementsText")} className={campo} />
      </label>
      <label className="block space-y-1">
        <span>Autorización de derechos que acepta cada participante</span>
        <textarea name="rightsText" rows={5} defaultValue={inicial.rightsText} disabled={no("rightsText")} className={campo} />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block space-y-1">
          <span>Recibe obras desde</span>
          <input type="date" name="opensDay" defaultValue={inicial.opensDay} disabled={no("opensDay")} className={campo} />
        </label>
        <label className="block space-y-1">
          <span>Hasta (inclusive)</span>
          <input type="date" name="closesDay" defaultValue={inicial.closesDay} disabled={no("closesDay")} min={inicial.status === "OPEN" ? inicial.closesDay : undefined} className={campo} />
        </label>
        <label className="block space-y-1">
          <span>Obras por persona</span>
          <input type="number" name="maxWorksPerPerson" min={1} max={MAX_WORKS_PER_PERSON_LIMIT} defaultValue={inicial.maxWorksPerPerson} disabled={no("maxWorksPerPerson")} className={campo} />
        </label>
      </div>
      <p className="text-sm text-[var(--mf-muted)]">Fechas en hora argentina. {inicial.status === "OPEN" ? "Con la convocatoria abierta, el cierre sólo se puede estirar." : ""}</p>
      {errores.length ? <ul className="space-y-1 text-[var(--mf-alerta)]">{errores.map((e) => <li key={e}>{e}</li>)}</ul> : null}
      {guardado ? <p className="text-[var(--mf-teal)]">Guardado.</p> : null}
      <button type="submit" disabled={pendiente} className={botonLleno}>{pendiente ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}
```

`apps/muestras/components/convocatorias/acciones-convocatoria.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CallPhase } from "@repo/muestras";
import { abrirConvocatoria, cerrarConvocatoria, cerrarCuraduria, empezarCuraduria, volverABorrador } from "@/lib/convocatorias/acciones";
import { botonFino, botonLleno } from "./estilos";

type Accion = { texto: string; correr: () => Promise<{ ok: boolean; errores?: string[] }>; confirmar?: string; principal?: boolean };

/** Los botones que corresponden a la fase. El servidor vuelve a verificar cada uno. */
export function AccionesConvocatoria({ id, fase }: { id: string; fase: CallPhase }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const acciones: Accion[] = [];
  if (fase === "DRAFT") acciones.push({ texto: "Abrir la convocatoria", correr: () => abrirConvocatoria(id), principal: true, confirmar: "Se publica en la página de convocatorias. Después, el tope de obras, la apertura y el texto de derechos ya no se pueden cambiar." });
  if (fase === "UPCOMING" || fase === "RECEIVING") acciones.push({ texto: "Volver a borrador", correr: () => volverABorrador(id), confirmar: "La convocatoria deja de verse en la página pública." });
  if (fase === "ENDED") acciones.push({ texto: "Cerrar la convocatoria", correr: () => cerrarConvocatoria(id), principal: true, confirmar: "Se asigna un código anónimo a cada obra y se avisa por mail a quienes enviaron." });
  if (fase === "CLOSED") acciones.push({ texto: "Empezar la curaduría", correr: () => empezarCuraduria(id), principal: true, confirmar: "El equipo curatorial empieza a ver y puntuar las obras." });
  if (fase === "CURATING") acciones.push({ texto: "Cerrar la curaduría", correr: () => cerrarCuraduria(id), principal: true, confirmar: "Las decisiones quedan firmes, vas a ver los nombres de los autores y cada participante recibe un mail con el resultado. No se puede deshacer." });

  if (acciones.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {acciones.map((a) => (
          <button
            key={a.texto}
            type="button"
            disabled={pendiente}
            className={a.principal ? botonLleno : botonFino}
            onClick={() => {
              if (a.confirmar && !window.confirm(a.confirmar)) return;
              start(async () => {
                const r = await a.correr();
                setError(r.ok ? null : (r.errores ?? []).join(" "));
                if (r.ok) router.refresh();
              });
            }}
          >
            {a.texto}
          </button>
        ))}
      </div>
      {error ? <p className="text-[var(--mf-alerta)]">{error}</p> : null}
    </div>
  );
}
```

`apps/muestras/components/convocatorias/equipo-curatorial.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatArDay } from "@repo/muestras";
import { invitarCurador, revocarCurador } from "@/lib/curaduria/acciones";
import { botonFino, campo } from "./estilos";

export type Curador = { id: string; email: string; status: string; invitedAt: Date; acceptedAt: Date | null };

const ESTADO: Record<string, string> = { INVITED: "Invitación enviada", ACTIVE: "En el equipo", REVOKED: "Fuera del equipo" };

export function EquipoCuratorial({ callId, curadores, editable }: { callId: string; curadores: Curador[]; editable: boolean }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [email, setEmail] = useState("");
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const correr = (f: () => Promise<{ ok: boolean; errores?: string[] }>, exito: string) =>
    start(async () => {
      const r = await f();
      setMensaje(r.ok ? { ok: true, texto: exito } : { ok: false, texto: (r.errores ?? []).join(" ") });
      if (r.ok) router.refresh();
    });

  return (
    <div className="space-y-4">
      {curadores.length === 0 ? <p className="text-[var(--mf-muted)]">Todavía no invitaste a nadie.</p> : (
        <ul className="border-t border-[var(--mf-line)]">
          {curadores.map((k) => (
            <li key={k.id} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--mf-line)] py-3">
              <span>{k.email}</span>
              <span className="text-sm text-[var(--mf-muted)]">
                {ESTADO[k.status] ?? k.status}{k.status === "INVITED" ? ` el ${formatArDay(k.invitedAt)}` : ""}
              </span>
              {editable && k.status !== "REVOKED" ? (
                <span className="flex gap-4 text-sm">
                  {k.status === "INVITED" ? <button type="button" disabled={pendiente} className="underline" onClick={() => correr(() => invitarCurador(callId, k.email), "Invitación reenviada.")}>Reenviar</button> : null}
                  <button type="button" disabled={pendiente} className="underline" onClick={() => { if (window.confirm(`¿Sacar a ${k.email} del equipo? Sus puntajes dejan de contar.`)) correr(() => revocarCurador(k.id), "Listo."); }}>Sacar</button>
                </span>
              ) : k.status === "REVOKED" && editable ? (
                <button type="button" disabled={pendiente} className="text-sm underline" onClick={() => correr(() => invitarCurador(callId, k.email), "Invitación enviada.")}>Volver a invitar</button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {editable ? (
        <form
          className="flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            correr(async () => {
              const r = await invitarCurador(callId, email);
              if (r.ok) setEmail("");
              return r;
            }, "Invitación enviada.");
          }}
        >
          <label className="min-w-[16rem] flex-1">
            <span className="sr-only">Email de quien querés invitar</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@ejemplo.com" className={campo} />
          </label>
          <button type="submit" disabled={pendiente} className={botonFino}>Invitar a curar</button>
        </form>
      ) : null}
      {mensaje ? <p className={mensaje.ok ? "text-[var(--mf-teal)]" : "text-[var(--mf-alerta)]"}>{mensaje.texto}</p> : null}
    </div>
  );
}
```

`apps/muestras/components/convocatorias/crear-convocatoria.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { crearConvocatoria } from "@/lib/convocatorias/acciones";
import { botonFino } from "./estilos";

export function CrearConvocatoria({ activityId }: { activityId: string }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="space-y-1">
      <button
        type="button"
        disabled={pendiente}
        className={botonFino}
        onClick={() => start(async () => {
          const r = await crearConvocatoria(activityId);
          if (r.ok) router.push(`/panel/convocatorias/${r.id}`);
          else setError(r.errores.join(" "));
        })}
      >
        {pendiente ? "Creando…" : "Armar su convocatoria"}
      </button>
      {error ? <span className="block text-sm text-[var(--mf-alerta)]">{error}</span> : null}
    </span>
  );
}
```

- [ ] **Step 2: Páginas**

`apps/muestras/app/panel/convocatorias/page.tsx`:
```tsx
import Link from "next/link";
import { CALL_STATUS_LABELS, formatArDay, isCallStatus } from "@repo/muestras";
import { CrearConvocatoria } from "@/components/convocatorias/crear-convocatoria";
import { listarConvocatoriasMias, muestrasSinConvocatoria } from "@/lib/convocatorias/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Convocatorias" };

export default async function Convocatorias() {
  const usuario = await requireUsuario("/panel/convocatorias");
  const [mias, sinConvocatoria] = await Promise.all([listarConvocatoriasMias(usuario), muestrasSinConvocatoria(usuario.id)]);
  return (
    <main className="max-w-3xl space-y-12">
      <header className="space-y-3">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Convocatorias</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">
          Abrí una convocatoria online para tu muestra: los fotógrafos envían sus obras y tu equipo curatorial las elige sin ver quién las hizo.
        </p>
      </header>

      <section aria-labelledby="t-mias" className="space-y-4">
        <h2 id="t-mias" className="text-sm text-[var(--mf-muted)]">{usuario.esSuperAdmin ? "Todas las convocatorias" : "Tus convocatorias"}</h2>
        {mias.length === 0 ? <p className="text-lg">Todavía no armaste ninguna.</p> : (
          <ul className="border-t border-[var(--mf-line)]">
            {mias.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--mf-line)] py-4">
                <span>
                  <Link href={`/panel/convocatorias/${c.id}`} className="mf-titulo text-xl underline-offset-[5px] hover:underline">{c.title}</Link>
                  <span className="block text-[13px] text-[var(--mf-muted)]">
                    Para “{c.activity.title}”. Del {formatArDay(c.opensAt)} al {formatArDay(c.closesAt)}. {c._count.submissions} {c._count.submissions === 1 ? "envío" : "envíos"}, {c._count.curators} en el equipo curatorial.
                  </span>
                </span>
                <span className="text-sm">{isCallStatus(c.status) ? CALL_STATUS_LABELS[c.status] : c.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="t-nueva" className="space-y-4">
        <h2 id="t-nueva" className="text-sm text-[var(--mf-muted)]">Armar una convocatoria nueva</h2>
        {sinConvocatoria.length === 0 ? (
          <p className="text-[15px]">
            Cada convocatoria es de una muestra. <Link href="/panel/proponer" className="underline underline-offset-[6px]">Creá la muestra</Link> (alcanza con el borrador) y volvé acá.
          </p>
        ) : (
          <ul className="border-t border-[var(--mf-line)]">
            {sinConvocatoria.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--mf-line)] py-3">
                <span>{m.title}</span>
                <CrearConvocatoria activityId={m.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
```

`apps/muestras/app/panel/convocatorias/[id]/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { CALL_STATUS_LABELS, CALL_PHASE_PUBLIC_TEXT, callPhase, formatArDay, isCallStatus, toArDay } from "@repo/muestras";
import { AccionesConvocatoria } from "@/components/convocatorias/acciones-convocatoria";
import { EquipoCuratorial } from "@/components/convocatorias/equipo-curatorial";
import { FormularioConvocatoria } from "@/components/convocatorias/formulario-convocatoria";
import { buscarConvocatoriaDelOrganizador } from "@/lib/convocatorias/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Convocatoria" };

type Props = { params: Promise<{ id: string }> };

export default async function EditarConvocatoria({ params }: Props) {
  const { id } = await params;
  const usuario = await requireUsuario(`/panel/convocatorias/${id}`);
  const c = await buscarConvocatoriaDelOrganizador(id, usuario);
  if (!c) notFound();
  const fase = callPhase(c, new Date());
  const estado = isCallStatus(c.status) ? CALL_STATUS_LABELS[c.status] : c.status;

  return (
    <main className="max-w-3xl space-y-12">
      <header className="space-y-3">
        <p className="text-sm text-[var(--mf-muted)]">
          Convocatoria de <Link href={`/panel/muestras/${c.activity.id}`} className="underline underline-offset-4">{c.activity.title}</Link>
        </p>
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">{c.title}</h1>
        <p className="text-[15px]">
          {estado}{fase !== "DRAFT" && fase !== c.status ? `. ${CALL_PHASE_PUBLIC_TEXT[fase]}` : ""}. Del {formatArDay(c.opensAt)} al {formatArDay(c.closesAt)}.
        </p>
        {fase !== "DRAFT" ? <Link href={`/convocatorias/${c.slug}`} className="inline-block underline underline-offset-[6px]">Ver la página pública</Link> : null}
      </header>

      <section aria-labelledby="t-recibido" className="space-y-3">
        <h2 id="t-recibido" className="text-sm text-[var(--mf-muted)]">Lo recibido</h2>
        <dl className="grid grid-cols-2 border-t border-[var(--mf-line)] sm:grid-cols-3">
          <div className="border-b border-[var(--mf-line)] py-4"><dt className="text-[13px] text-[var(--mf-muted)]">Envíos</dt><dd className="mf-titulo mt-1 text-3xl tabular-nums">{c._count.submissions}</dd></div>
          <div className="border-b border-[var(--mf-line)] py-4"><dt className="text-[13px] text-[var(--mf-muted)]">Obras</dt><dd className="mf-titulo mt-1 text-3xl tabular-nums">{c.obras}</dd></div>
          <div className="border-b border-[var(--mf-line)] py-4"><dt className="text-[13px] text-[var(--mf-muted)]">En la muestra hoy</dt><dd className="mf-titulo mt-1 text-3xl tabular-nums">{c.activity._count.works}</dd></div>
        </dl>
        <p className="text-sm text-[var(--mf-muted)]">Los nombres de quienes enviaron aparecen recién al cerrar la curaduría.</p>
        {c.status === "CURATING" || c.status === "DONE" ? (
          <Link href={`/panel/convocatorias/${c.id}/seleccion`} className="inline-block underline underline-offset-[6px]">
            {c.status === "CURATING" ? "Ver el ranking y elegir" : "Ver la selección"}
          </Link>
        ) : null}
      </section>

      <AccionesConvocatoria id={c.id} fase={fase} />

      <section aria-labelledby="t-equipo" className="space-y-3">
        <h2 id="t-equipo" className="text-sm text-[var(--mf-muted)]">Equipo curatorial</h2>
        <p className="text-[15px] text-[var(--mf-muted)]">Cada integrante recibe un enlace por mail y entra con su cuenta de Google. Ve todas las obras, sin nombres, y las puntúa de 1 a 5.</p>
        <EquipoCuratorial callId={c.id} curadores={c.curators} editable={c.status !== "DONE"} />
      </section>

      <section aria-labelledby="t-datos" className="space-y-3">
        <h2 id="t-datos" className="text-sm text-[var(--mf-muted)]">Bases y fechas</h2>
        <FormularioConvocatoria
          inicial={{
            id: c.id, status: c.status, title: c.title, basesText: c.basesText, requirementsText: c.requirementsText ?? "",
            rightsText: c.rightsText, opensDay: toArDay(c.opensAt), closesDay: toArDay(c.closesAt), maxWorksPerPerson: c.maxWorksPerPerson,
          }}
        />
        {c.status !== "DRAFT" && c.status !== "OPEN" ? <p className="text-[15px] text-[var(--mf-muted)]">La convocatoria cerró: sus bases ya no se pueden cambiar.</p> : null}
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Chequeos**

Run: `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: sin errores.

- [ ] **Step 4: Probar en local** (base de desarrollo con la migración aplicada en una rama de Neon, o después de la Task 14)

`pnpm --filter muestras dev` → `/panel/convocatorias`: aparece cada muestra propia sin convocatoria con "Armar su convocatoria"; al crearla abre su página con textos sugeridos; "Abrir la convocatoria" sin bases muestra "Faltan las bases."; con bases, pasa a "Abierta" y aparece "Ver la página pública". En "Abierta" los campos de apertura, tope y derechos se ven deshabilitados. En "Equipo curatorial", invitar un email → "Invitación enviada" y en consola el correo no enviado con el asunto "Te invitan a curar…"; "Sacar" lo deja "Fuera del equipo".

- [ ] **Step 5: Commit**

```bash
git add apps/muestras/components/convocatorias apps/muestras/app/panel/convocatorias/page.tsx "apps/muestras/app/panel/convocatorias/[id]/page.tsx"
git commit -m "Panel de convocatorias: listado, crear desde una muestra, bases, estados y equipo"
```

---
### Task 10: Páginas públicas de convocatorias y enlaces del sitio

**Files:**
- Create: `apps/muestras/app/convocatorias/page.tsx`, `apps/muestras/app/convocatorias/[slug]/page.tsx`
- Modify: `apps/muestras/components/encabezado/encabezado.tsx`, `apps/muestras/components/pie/pie.tsx`

**Interfaces:**
- Consumes: `listarConvocatoriasPublicas`, `buscarConvocatoriaPublica` (Task 7), `callPhase`, `isListedPhase`, `hasPublicPage`, `acceptsSubmissions`, `CALL_PHASE_PUBLIC_TEXT` (Task 1).

- [ ] **Step 1: Páginas**

`apps/muestras/app/convocatorias/page.tsx`:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { CALL_PHASE_PUBLIC_TEXT, callPhase, formatArDay, isListedPhase } from "@repo/muestras";
import { listarConvocatoriasPublicas } from "@/lib/convocatorias/consultas";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const ahora = new Date();
  const hay = (await listarConvocatoriasPublicas()).some((c) => isListedPhase(callPhase(c, ahora)));
  return {
    title: "Convocatorias abiertas",
    description: "Convocatorias de muestras fotográficas de todo el país: mandá tus obras online.",
    ...(hay ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function ConvocatoriasPublicas() {
  const ahora = new Date();
  const lista = (await listarConvocatoriasPublicas()).filter((c) => isListedPhase(callPhase(c, ahora)));
  return (
    <main className="mf-marco py-10 sm:py-16">
      <h1 className="mf-titulo max-w-[16ch] text-[clamp(2.2rem,5vw,3.5rem)]">Convocatorias abiertas</h1>
      <p className="mt-4 max-w-[52ch] text-lg leading-snug text-[var(--mf-muted)]">Muestras que buscan obras. Leé las bases y mandá las tuyas online; la selección es anónima.</p>
      {lista.length === 0 ? (
        <p className="mt-10 border-t border-[var(--mf-line)] pt-8 text-lg">Ahora no hay convocatorias abiertas. Volvé pronto.</p>
      ) : (
        <ul className="mt-10 border-t border-[var(--mf-line)]">
          {lista.map((c) => {
            const lugar = c.activity.isVirtualOnly ? "Virtual" : [c.activity.venueName, c.activity.city, c.activity.province].filter(Boolean).join(", ");
            return (
              <li key={c.id} className="border-b border-[var(--mf-line)]">
                <Link href={`/convocatorias/${c.slug}`} className="group grid gap-1 py-6">
                  <span className="text-sm text-[var(--mf-muted)]">{CALL_PHASE_PUBLIC_TEXT[callPhase(c, ahora)]} hasta el {formatArDay(c.closesAt)}</span>
                  <span className="mf-titulo text-2xl underline-offset-[6px] group-hover:underline">{c.title}</span>
                  <span className="text-[15px] text-[var(--mf-muted)]">{[c.activity.title !== c.title ? `Para la muestra “${c.activity.title}”` : null, lugar || null, `hasta ${c.maxWorksPerPerson} ${c.maxWorksPerPerson === 1 ? "obra" : "obras"} por persona`].filter(Boolean).join(". ")}</span>
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

`apps/muestras/app/convocatorias/[slug]/page.tsx`:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CALL_PHASE_PUBLIC_TEXT, acceptsSubmissions, callPhase, formatArDay, hasPublicPage } from "@repo/muestras";
import { buscarConvocatoriaPublica } from "@/lib/convocatorias/consultas";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await buscarConvocatoriaPublica((await params).slug);
  if (!c) return {};
  return { title: c.title, description: c.basesText.slice(0, 160) };
}

const boton = "inline-flex h-12 items-center rounded-[2px] bg-[var(--mf-ink)] px-6 text-white";

export default async function ConvocatoriaPublica({ params }: Props) {
  const c = await buscarConvocatoriaPublica((await params).slug);
  const ahora = new Date();
  if (!c) notFound();
  const fase = callPhase(c, ahora);
  if (!hasPublicPage(fase)) notFound();
  const a = c.activity;
  const lugar = a.isVirtualOnly ? "Muestra virtual" : [a.venueName, a.city, a.province].filter(Boolean).join(", ");

  return (
    <main className="mf-marco grid gap-12 py-10 sm:py-16 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <article className="min-w-0 space-y-8">
        <header className="space-y-4">
          <p className="text-sm text-[var(--mf-muted)]">Convocatoria. {CALL_PHASE_PUBLIC_TEXT[fase]}</p>
          <h1 className="mf-titulo text-[clamp(2.2rem,5vw,3.5rem)]">{c.title}</h1>
          <p className="text-lg text-[var(--mf-muted)]">
            {a.reviewStatus === "APPROVED" ? <>Para la muestra <Link href={`/m/${a.slug}`} className="underline underline-offset-[6px]">{a.title}</Link></> : <>Para la muestra “{a.title}”</>}
            {lugar ? `. ${lugar}` : ""}
          </p>
        </header>
        <section aria-labelledby="t-bases" className="space-y-3">
          <h2 id="t-bases" className="mf-titulo text-2xl">Bases</h2>
          <div className="whitespace-pre-line text-[17px] leading-relaxed">{c.basesText}</div>
        </section>
        {c.requirementsText ? (
          <section aria-labelledby="t-req" className="space-y-3">
            <h2 id="t-req" className="mf-titulo text-2xl">Las imágenes</h2>
            <div className="whitespace-pre-line text-[17px] leading-relaxed">{c.requirementsText}</div>
          </section>
        ) : null}
        <section aria-labelledby="t-der" className="space-y-3">
          <h2 id="t-der" className="mf-titulo text-2xl">Derechos</h2>
          <div className="whitespace-pre-line text-[15px] leading-relaxed text-[var(--mf-muted)]">{c.rightsText}</div>
        </section>
      </article>
      <aside className="space-y-5 border-t border-[var(--mf-line)] pt-6 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0">
        <dl className="space-y-3 text-[15px]">
          <div><dt className="text-[13px] text-[var(--mf-muted)]">Recibe obras</dt><dd>del {formatArDay(c.opensAt)} al {formatArDay(c.closesAt)}</dd></div>
          <div><dt className="text-[13px] text-[var(--mf-muted)]">Obras por persona</dt><dd>hasta {c.maxWorksPerPerson}</dd></div>
          <div><dt className="text-[13px] text-[var(--mf-muted)]">Selección</dt><dd>anónima: el equipo curatorial ve las obras sin el nombre de su autor</dd></div>
        </dl>
        {acceptsSubmissions(fase) ? (
          <Link href={`/convocatorias/${c.slug}/enviar`} className={boton}>Enviar obras</Link>
        ) : fase === "UPCOMING" ? (
          <p className="text-[15px]">Empieza a recibir obras el {formatArDay(c.opensAt)}.</p>
        ) : (
          <p className="text-[15px]">Esta convocatoria ya no recibe obras.</p>
        )}
        <p className="text-sm text-[var(--mf-muted)]">Para enviar hace falta entrar con tu cuenta de Google.</p>
      </aside>
    </main>
  );
}
```

- [ ] **Step 2: Enlaces**

En `apps/muestras/components/encabezado/encabezado.tsx`, antes del enlace a `/fotografos`:
```tsx
        <Link href="/convocatorias" className={`${enlace} max-sm:hidden`}>Convocatorias</Link>
```
En `apps/muestras/components/pie/pie.tsx`, antes del enlace a `/fotografos`:
```tsx
          <Link href="/convocatorias" className={enlace}>Convocatorias</Link>
```

- [ ] **Step 3: Chequeos y prueba**

Run: `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: sin errores.

En local: `/convocatorias` lista la abierta de la Task 9 con "Recibe obras hasta el …"; su página muestra bases, requisitos, derechos y "Enviar obras". Una convocatoria en borrador da 404. Buscar en el HTML las palabras "revis" y "aprob": no aparecen. Repetir a 375 px (sin scroll horizontal).

- [ ] **Step 4: Commit**

```bash
git add apps/muestras/app/convocatorias/page.tsx "apps/muestras/app/convocatorias/[slug]/page.tsx" apps/muestras/components/encabezado/encabezado.tsx apps/muestras/components/pie/pie.tsx
git commit -m "Convocatorias públicas: listado, página con bases y enlace en encabezado y pie"
```

---
### Task 11: Envíos — datos, acciones, formulario y "Mis envíos"

**Files:**
- Create: `apps/muestras/lib/envios/mapear.ts`, `apps/muestras/lib/envios/consultas.ts`, `apps/muestras/lib/envios/acciones.ts`
- Create: `apps/muestras/components/envios/formulario-envio.tsx`, `apps/muestras/app/convocatorias/[slug]/enviar/page.tsx`, `apps/muestras/app/panel/envios/page.tsx`
- Test: `apps/muestras/lib/envios/mapear.test.ts`, `apps/muestras/lib/envios/acciones.test.ts`

**Interfaces:**
- Consumes: `baseImagenesPublicas` (etapa 1), `submissionProblems`, `submitterConflict`, `acceptsSubmissions`, `callPhase` (Task 1), `avisarEnvioRecibido` (Task 6), `subirImagen(file, "obra")` (etapa 1), `buscarPerfilPropio` (etapa 2).
- Produces:
  - `mapear.ts`: `ObraEnviada`, `EnvioForm`, `esImagenDeUsuario(url, base, userId)`, `envioDesdeFormData(fd, userId, base?)`.
  - `acciones.ts`: `guardarEnvio(fd)` (crea o reemplaza; reactiva uno retirado), `retirarEnvio(callId)`.
  - `consultas.ts`: `listarMisEnvios(userId)`, `buscarMiEnvio(callId, userId)`.
  - `FormularioEnvio({ callId, maxObras, bases, derechos, retirable, inicial })`.

- [ ] **Step 1: Escribir los tests que fallan**

`apps/muestras/lib/envios/mapear.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { envioDesdeFormData, esImagenDeUsuario } from "./mapear";

const base = "https://pub-test.r2.dev";

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

describe("imagen de la persona", () => {
  it("acepta sólo lo que subió ella", () => {
    expect(esImagenDeUsuario(`${base}/muestras/7/a.webp`, base, 7)).toBe(true);
    expect(esImagenDeUsuario(`${base}/muestras/8/a.webp`, base, 7)).toBe(false);
    expect(esImagenDeUsuario(`${base}/muestras/7/../8/a.webp`, base, 7)).toBe(false);
    expect(esImagenDeUsuario("https://otro.com/muestras/7/a.webp", base, 7)).toBe(false);
    expect(esImagenDeUsuario(`${base}/muestras/7/a.webp`, null, 7)).toBe(false);
  });
});

describe("envío desde el formulario", () => {
  it("lee obras y aceptaciones, descarta imágenes ajenas y años raros", () => {
    const works = JSON.stringify([
      { imageUrl: `${base}/muestras/7/a.webp`, title: " Puerto ", year: 2024, technique: "Digital", statement: "Texto" },
      { imageUrl: `${base}/muestras/9/b.webp`, title: "Ajena" },
      { imageUrl: `${base}/muestras/7/c.webp`, title: "Vieja", year: 1500 },
    ]);
    const e = envioDesdeFormData(fd({ callId: "c1", authorName: "Ana Pérez", basesAccepted: "on", works }), 7, base);
    expect(e.basesAccepted).toBe(true);
    expect(e.rightsAccepted).toBe(false);
    expect(e.works).toEqual([
      { imageUrl: `${base}/muestras/7/a.webp`, title: "Puerto", year: 2024, technique: "Digital", statement: "Texto" },
      { imageUrl: `${base}/muestras/7/c.webp`, title: "Vieja", year: null, technique: null, statement: null },
    ]);
  });
  it("un JSON roto es una lista vacía", () => {
    expect(envioDesdeFormData(fd({ callId: "c1", works: "{" }), 7, base).works).toEqual([]);
  });
});
```

`apps/muestras/lib/envios/acciones.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalCall: { findUnique: vi.fn() },
  culturalCallCurator: { findFirst: vi.fn() },
  culturalCallSubmission: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  culturalCallWork: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
const correos = vi.hoisted(() => ({ avisarEnvioRecibido: vi.fn() }));

vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("@/lib/correos/convocatorias", () => correos);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
const { guardarEnvio, retirarEnvio } = await import("./acciones");
const { resetRateLimit } = await import("@/lib/limite");

const conv = {
  id: "c1", slug: "ciudad", status: "OPEN", maxWorksPerPerson: 2,
  opensAt: new Date("2026-11-01T03:00:00Z"), closesAt: new Date("2026-12-01T02:59:59.999Z"),
  activity: { proposedByUserId: 9 },
};
const obra = (n: number) => ({ imageUrl: `https://pub-test.r2.dev/muestras/7/${n}.webp`, title: `Obra ${n}` });
function fd(works: unknown[], extra: Record<string, string> = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries({ callId: "c1", authorName: "Ana Pérez", basesAccepted: "on", rightsAccepted: "on", works: JSON.stringify(works), ...extra })) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  vi.useRealTimers();
  vi.useFakeTimers({ now: new Date("2026-11-15T15:00:00Z"), toFake: ["Date"] });
  usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "Ana@x.com", name: "Ana" };
  db.culturalCall.findUnique.mockResolvedValue(conv);
  db.culturalCallCurator.findFirst.mockResolvedValue(null);
  db.culturalCallSubmission.findUnique.mockResolvedValue(null);
  db.culturalCallSubmission.create.mockResolvedValue({ id: "s1" });
  db.culturalCallSubmission.updateMany.mockResolvedValue({ count: 1 });
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
});

describe("guardarEnvio", () => {
  it("crea el envío con sus obras y avisa", async () => {
    expect(await guardarEnvio(fd([obra(1), obra(2)]))).toEqual({ ok: true, id: "s1" });
    const data = db.culturalCallSubmission.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ callId: "c1", userId: 7, authorName: "Ana Pérez" });
    expect(data.works.create).toHaveLength(2);
    expect(data.works.create[1]).toMatchObject({ callId: "c1", sortOrder: 1, title: "Obra 2" });
    expect(correos.avisarEnvioRecibido).toHaveBeenCalledWith("s1");
  });
  it("respeta el tope por persona", async () => {
    const r = await guardarEnvio(fd([obra(1), obra(2), obra(3)]));
    expect(r).toEqual({ ok: false, errores: ["Esta convocatoria recibe hasta 2 obras por persona."] });
  });
  it("reemplaza el envío previo y lo reactiva si estaba retirado", async () => {
    db.culturalCallSubmission.findUnique.mockResolvedValue({ id: "s0" });
    expect(await guardarEnvio(fd([obra(1)]))).toEqual({ ok: true, id: "s0" });
    expect(db.culturalCallWork.deleteMany).toHaveBeenCalledWith({ where: { submissionId: "s0" } });
    expect(db.culturalCallSubmission.update.mock.calls[0][0].data).toMatchObject({ status: "ACTIVE", withdrawnAt: null });
  });
  it("fuera de fecha no recibe", async () => {
    vi.setSystemTime(new Date("2026-12-01T03:00:01Z"));
    expect(await guardarEnvio(fd([obra(1)]))).toEqual({ ok: false, errores: ["La convocatoria no recibe obras en este momento."] });
  });
  it("quien organiza no envía", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, activity: { proposedByUserId: 7 } });
    expect((await guardarEnvio(fd([obra(1)]))).ok).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("un curador (aunque todavía no haya aceptado) no envía; se busca por email en minúsculas", async () => {
    db.culturalCallCurator.findFirst.mockResolvedValue({ id: "k1" });
    expect((await guardarEnvio(fd([obra(1)]))).ok).toBe(false);
    expect(db.culturalCallCurator.findFirst.mock.calls[0][0].where.OR).toEqual([{ userId: 7 }, { email: "ana@x.com" }]);
  });
  it("sin sesión no hace nada", async () => {
    usuarioActual.valor = null;
    expect((await guardarEnvio(fd([obra(1)]))).ok).toBe(false);
  });
});

describe("retirarEnvio", () => {
  it("marca el envío propio como retirado", async () => {
    expect((await retirarEnvio("c1")).ok).toBe(true);
    expect(db.culturalCallSubmission.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { callId: "c1", userId: 7, status: "ACTIVE" } }));
  });
  it("después del cierre no se retira", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "CLOSED" });
    expect((await retirarEnvio("c1")).ok).toBe(false);
  });
});
```

Run: `pnpm --filter muestras test -- lib/envios`
Expected: FAIL — no existen `./mapear` ni `./acciones`.

- [ ] **Step 2: Implementar datos y acciones**

`apps/muestras/lib/envios/mapear.ts`:
```ts
import { CALL_TEXT_LIMITS } from "@repo/muestras";
import { baseImagenesPublicas } from "@/lib/actividades/mapear";

export type ObraEnviada = { imageUrl: string; title: string; year: number | null; technique: string | null; statement: string | null };
export type EnvioForm = { callId: string; authorName: string; basesAccepted: boolean; rightsAccepted: boolean; works: ObraEnviada[] };

/**
 * Sólo imágenes que subió esta misma persona (`<base>/muestras/<userId>/…`). Sin esto, alguien
 * podría mandar como propia la imagen que subió otra persona.
 */
export function esImagenDeUsuario(url: string, base: string | null, userId: number): boolean {
  if (!base) return false;
  const prefijo = `${base}/muestras/${userId}/`;
  if (!url.startsWith(prefijo)) return false;
  const resto = url.slice(prefijo.length);
  return /^[A-Za-z0-9._-]+$/.test(resto) && !resto.includes("..");
}

const corto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max).trim();
const anioActual = () => new Date().getUTCFullYear();

function obras(raw: string, base: string | null, userId: number): ObraEnviada[] {
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, 20).flatMap((o) => {
      if (!o || typeof o !== "object") return [];
      const r = o as Record<string, unknown>;
      if (typeof r.imageUrl !== "string" || !esImagenDeUsuario(r.imageUrl, base, userId)) return [];
      const anio = typeof r.year === "number" && Number.isInteger(r.year) && r.year >= 1826 && r.year <= anioActual() + 1 ? r.year : null;
      return [{
        imageUrl: r.imageUrl,
        title: corto(r.title, CALL_TEXT_LIMITS.workTitle),
        year: anio,
        technique: corto(r.technique, CALL_TEXT_LIMITS.technique) || null,
        statement: corto(r.statement, CALL_TEXT_LIMITS.statement) || null,
      }];
    });
  } catch {
    return [];
  }
}

export function envioDesdeFormData(fd: FormData, userId: number, baseImagenes: string | null = baseImagenesPublicas()): EnvioForm {
  return {
    callId: corto(fd.get("callId"), 40),
    authorName: corto(fd.get("authorName"), CALL_TEXT_LIMITS.authorName),
    basesAccepted: fd.get("basesAccepted") === "on",
    rightsAccepted: fd.get("rightsAccepted") === "on",
    works: obras(String(fd.get("works") ?? "[]"), baseImagenes, userId),
  };
}
```

`apps/muestras/lib/envios/consultas.ts`:
```ts
import "server-only";
import { prisma } from "@repo/db";

/** Los envíos de la persona, con sus obras. La decisión de cada obra se muestra sólo al terminar. */
export function listarMisEnvios(userId: number) {
  return prisma.culturalCallSubmission.findMany({
    where: { userId },
    select: {
      id: true, status: true, updatedAt: true,
      call: { select: { id: true, slug: true, title: true, status: true, opensAt: true, closesAt: true } },
      works: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, imageUrl: true, decision: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/** El envío propio en una convocatoria, para volver a editarlo. */
export function buscarMiEnvio(callId: string, userId: number) {
  return prisma.culturalCallSubmission.findUnique({
    where: { callId_userId: { callId, userId } },
    select: {
      authorName: true, status: true,
      works: { orderBy: { sortOrder: "asc" }, select: { imageUrl: true, title: true, year: true, technique: true, statement: true } },
    },
  });
}
```

`apps/muestras/lib/envios/acciones.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { acceptsSubmissions, callPhase, submissionProblems, submitterConflict } from "@repo/muestras";
import { getUsuario } from "@/lib/usuario";
import { frenarPorUsuario } from "@/lib/limite";
import { avisarEnvioRecibido } from "@/lib/correos/convocatorias";
import type { ResultadoAccion } from "@/lib/actividades/acciones";
import { envioDesdeFormData } from "./mapear";

const SIN_SESION: ResultadoAccion = { ok: false, errores: ["Tenés que ingresar."] };
const NO_EXISTE: ResultadoAccion = { ok: false, errores: ["La convocatoria no existe."] };
const NO_RECIBE: ResultadoAccion = { ok: false, errores: ["La convocatoria no recibe obras en este momento."] };

async function convocatoriaQueRecibe(callId: string) {
  const c = await prisma.culturalCall.findUnique({
    where: { id: callId },
    select: { id: true, slug: true, status: true, opensAt: true, closesAt: true, maxWorksPerPerson: true, activity: { select: { proposedByUserId: true } } },
  });
  return c;
}

/** Crea o reemplaza el envío propio mientras la convocatoria recibe obras. */
export async function guardarEnvio(fd: FormData): Promise<ResultadoAccion> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const e = envioDesdeFormData(fd, usuario.id);
  const c = e.callId ? await convocatoriaQueRecibe(e.callId) : null;
  if (!c) return NO_EXISTE;
  if (!acceptsSubmissions(callPhase(c, new Date()))) return NO_RECIBE;
  const curador = await prisma.culturalCallCurator.findFirst({
    where: { callId: c.id, status: { not: "REVOKED" }, OR: [{ userId: usuario.id }, { email: usuario.email.toLowerCase() }] },
    select: { id: true },
  });
  const conflicto = submitterConflict({ isOwner: c.activity.proposedByUserId === usuario.id, isCurator: !!curador });
  if (conflicto) return { ok: false, errores: [conflicto] };
  const problemas = submissionProblems(e, c.maxWorksPerPerson);
  if (problemas.length) return { ok: false, errores: problemas };
  if (!frenarPorUsuario("guardarEnvio", usuario.id).allowed) {
    return { ok: false, errores: ["Guardaste tu envío muchas veces seguidas. Esperá un rato y probá de nuevo."] };
  }
  const ahora = new Date();
  const obras = e.works.map((w, i) => ({ ...w, callId: c.id, sortOrder: i }));
  const id = await prisma.$transaction(async (tx) => {
    const previo = await tx.culturalCallSubmission.findUnique({ where: { callId_userId: { callId: c.id, userId: usuario.id } }, select: { id: true } });
    if (previo) {
      await tx.culturalCallWork.deleteMany({ where: { submissionId: previo.id } });
      await tx.culturalCallSubmission.update({
        where: { id: previo.id },
        data: { authorName: e.authorName, status: "ACTIVE", withdrawnAt: null, basesAcceptedAt: ahora, rightsAcceptedAt: ahora, works: { create: obras } },
      });
      return previo.id;
    }
    const nuevo = await tx.culturalCallSubmission.create({
      data: { callId: c.id, userId: usuario.id, authorName: e.authorName, basesAcceptedAt: ahora, rightsAcceptedAt: ahora, works: { create: obras } },
      select: { id: true },
    });
    return nuevo.id;
  });
  revalidatePath("/panel/envios");
  await avisarEnvioRecibido(id);
  return { ok: true, id };
}

/** Retira el envío propio. Se puede volver a enviar mientras la convocatoria reciba obras. */
export async function retirarEnvio(callId: string): Promise<ResultadoAccion> {
  if (typeof callId !== "string") return NO_EXISTE;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const c = await convocatoriaQueRecibe(callId);
  if (!c) return NO_EXISTE;
  if (!acceptsSubmissions(callPhase(c, new Date()))) return NO_RECIBE;
  const { count } = await prisma.culturalCallSubmission.updateMany({
    where: { callId, userId: usuario.id, status: "ACTIVE" },
    data: { status: "WITHDRAWN", withdrawnAt: new Date() },
  });
  if (count === 0) return { ok: false, errores: ["No tenés un envío activo en esta convocatoria."] };
  revalidatePath("/panel/envios");
  return { ok: true, id: callId };
}
```

Run: `pnpm --filter muestras test -- lib/envios`
Expected: PASS (12 tests).

- [ ] **Step 3: Formulario y páginas**

`apps/muestras/components/envios/formulario-envio.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CALL_TEXT_LIMITS } from "@repo/muestras";
import { botonFino, botonLleno, campo } from "@/components/convocatorias/estilos";
import { subirImagen } from "@/components/formulario/subir-imagen";
import { guardarEnvio, retirarEnvio } from "@/lib/envios/acciones";

type Obra = { imageUrl: string; title: string; year: number | null; technique: string; statement: string };

export function FormularioEnvio({ callId, maxObras, bases, derechos, retirable, inicial }: {
  callId: string; maxObras: number; bases: string; derechos: string; retirable: boolean;
  inicial: { authorName: string; works: Obra[] };
}) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [obras, setObras] = useState<Obra[]>(inicial.works);
  const [subiendo, setSubiendo] = useState(false);
  const [errores, setErrores] = useState<string[]>([]);
  const [listo, setListo] = useState<string | null>(null);
  const cambiar = (i: number, p: Partial<Obra>) => setObras((xs) => xs.map((o, j) => (j === i ? { ...o, ...p } : o)));

  async function agregar(files: FileList | null) {
    if (!files?.length) return;
    setSubiendo(true);
    setErrores([]);
    try {
      for (const f of Array.from(files).slice(0, maxObras - obras.length)) {
        const url = await subirImagen(f, "obra");
        setObras((xs) => [...xs, { imageUrl: url, title: "", year: null, technique: "", statement: "" }]);
      }
    } catch (e) {
      setErrores([e instanceof Error ? e.message : "No pudimos subir la imagen."]);
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("callId", callId);
        fd.set("works", JSON.stringify(obras));
        setListo(null);
        start(async () => {
          const r = await guardarEnvio(fd);
          if (!r.ok) return setErrores(r.errores);
          setErrores([]);
          setListo("¡Listo! Recibimos tu envío. Te mandamos un mail de confirmación.");
          router.refresh();
        });
      }}
    >
      <ol className="space-y-6 border-t border-[var(--mf-line)] pt-6">
        {obras.map((o, i) => (
          <li key={o.imageUrl} className="grid gap-4 border-b border-[var(--mf-line)] pb-6 sm:grid-cols-[10rem_minmax(0,1fr)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={o.imageUrl} alt="" className="aspect-square w-40 bg-[var(--mf-surface)] object-contain" />
            <div className="space-y-3">
              <label className="block space-y-1"><span>Título</span><input required value={o.title} maxLength={CALL_TEXT_LIMITS.workTitle} onChange={(e) => cambiar(i, { title: e.target.value })} className={campo} /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1"><span>Año</span><input type="number" min={1826} value={o.year ?? ""} onChange={(e) => cambiar(i, { year: e.target.value === "" ? null : Number(e.target.value) })} className={campo} /></label>
                <label className="block space-y-1"><span>Técnica</span><input value={o.technique} maxLength={CALL_TEXT_LIMITS.technique} onChange={(e) => cambiar(i, { technique: e.target.value })} placeholder="Digital, analógica, copia en gelatina…" className={campo} /></label>
              </div>
              <label className="block space-y-1">
                <span>Texto breve sobre la obra (optativo)</span>
                <textarea rows={3} value={o.statement} maxLength={CALL_TEXT_LIMITS.statement} onChange={(e) => cambiar(i, { statement: e.target.value })} className={campo} />
                <span className="block text-sm text-[var(--mf-muted)]">Lo lee el equipo curatorial. Sin tu nombre.</span>
              </label>
              <button type="button" className="text-sm underline" onClick={() => setObras((xs) => xs.filter((_, j) => j !== i))}>Quitar esta obra</button>
            </div>
          </li>
        ))}
      </ol>
      {obras.length < maxObras ? (
        <label className={`${botonFino} cursor-pointer`}>
          {subiendo ? "Subiendo…" : obras.length ? "Agregar otra obra" : "Elegir las fotos"}
          <input type="file" accept="image/*" multiple className="sr-only" disabled={subiendo} onChange={(e) => agregar(e.target.files)} />
        </label>
      ) : <p className="text-[15px] text-[var(--mf-muted)]">Llegaste al tope de {maxObras} {maxObras === 1 ? "obra" : "obras"}.</p>}

      <label className="block space-y-1">
        <span>Tu nombre como querés que figure si una obra queda seleccionada</span>
        <input name="authorName" required defaultValue={inicial.authorName} maxLength={CALL_TEXT_LIMITS.authorName} className={campo} />
        <span className="block text-sm text-[var(--mf-muted)]">El equipo curatorial no lo ve.</span>
      </label>

      <div className="space-y-4">
        <details className="text-[15px]"><summary className="cursor-pointer underline underline-offset-4">Leer las bases</summary><div className="mt-2 whitespace-pre-line">{bases}</div></details>
        <label className="flex gap-3"><input type="checkbox" name="basesAccepted" required className="mt-1" /><span>Leí y acepto las bases.</span></label>
        <div className="whitespace-pre-line border-l-2 border-[var(--mf-line)] pl-4 text-[15px] text-[var(--mf-muted)]">{derechos}</div>
        <label className="flex gap-3"><input type="checkbox" name="rightsAccepted" required className="mt-1" /><span>Acepto la autorización de derechos.</span></label>
      </div>

      {errores.length ? <ul className="space-y-1 text-[var(--mf-alerta)]">{errores.map((e) => <li key={e}>{e}</li>)}</ul> : null}
      {listo ? <p className="text-[var(--mf-teal)]">{listo}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pendiente || subiendo || obras.length === 0} className={botonLleno}>{pendiente ? "Enviando…" : retirable ? "Guardar los cambios" : "Enviar"}</button>
        {retirable ? (
          <button
            type="button"
            disabled={pendiente}
            className={botonFino}
            onClick={() => {
              if (!window.confirm("¿Retirar tu envío? Podés volver a enviar mientras la convocatoria esté abierta.")) return;
              start(async () => {
                const r = await retirarEnvio(callId);
                if (!r.ok) return setErrores(r.errores);
                setObras([]);
                setListo("Retiraste tu envío.");
                router.refresh();
              });
            }}
          >
            Retirar mi envío
          </button>
        ) : null}
      </div>
    </form>
  );
}
```

`apps/muestras/app/convocatorias/[slug]/enviar/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { acceptsSubmissions, callPhase, formatArDay, submitterConflict } from "@repo/muestras";
import { FormularioEnvio } from "@/components/envios/formulario-envio";
import { buscarConvocatoriaPublica } from "@/lib/convocatorias/consultas";
import { buscarMiEnvio } from "@/lib/envios/consultas";
import { buscarPerfilPropio } from "@/lib/perfiles/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Enviar obras", robots: { index: false } };

type Props = { params: Promise<{ slug: string }> };

export default async function EnviarObras({ params }: Props) {
  const { slug } = await params;
  const usuario = await requireUsuario(`/convocatorias/${slug}/enviar`);
  const c = await buscarConvocatoriaPublica(slug);
  if (!c) notFound();
  const fase = callPhase(c, new Date());
  const curador = await prisma.culturalCallCurator.findFirst({
    where: { callId: c.id, status: { not: "REVOKED" }, OR: [{ userId: usuario.id }, { email: usuario.email.toLowerCase() }] },
    select: { id: true },
  });
  const conflicto = submitterConflict({ isOwner: c.activity.proposedByUserId === usuario.id, isCurator: !!curador });
  const [previo, perfil] = await Promise.all([buscarMiEnvio(c.id, usuario.id), buscarPerfilPropio(usuario.id)]);

  return (
    <main className="mf-marco max-w-3xl space-y-8 py-10 sm:py-16">
      <header className="space-y-3">
        <p className="text-sm text-[var(--mf-muted)]"><Link href={`/convocatorias/${c.slug}`} className="underline underline-offset-4">{c.title}</Link></p>
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">{previo?.status === "ACTIVE" ? "Tu envío" : "Enviar obras"}</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">
          Hasta {c.maxWorksPerPerson} {c.maxWorksPerPerson === 1 ? "obra" : "obras"}. Podés cambiarlas o retirar el envío hasta el {formatArDay(c.closesAt)}. El equipo curatorial no ve tu nombre: no lo pongas en la imagen ni en los textos.
        </p>
      </header>
      {!acceptsSubmissions(fase) ? (
        <p className="border-t border-[var(--mf-line)] pt-6 text-lg">Esta convocatoria no recibe obras en este momento.</p>
      ) : conflicto ? (
        <p className="border-t border-[var(--mf-line)] pt-6 text-lg">{conflicto}</p>
      ) : (
        <FormularioEnvio
          callId={c.id}
          maxObras={c.maxWorksPerPerson}
          bases={c.basesText}
          derechos={c.rightsText}
          retirable={previo?.status === "ACTIVE"}
          inicial={{
            authorName: previo?.authorName ?? perfil?.displayName ?? usuario.name ?? "",
            works: previo?.status === "ACTIVE" ? previo.works.map((w) => ({ ...w, technique: w.technique ?? "", statement: w.statement ?? "" })) : [],
          }}
        />
      )}
    </main>
  );
}
```

`apps/muestras/app/panel/envios/page.tsx`:
```tsx
import Link from "next/link";
import { CALL_PHASE_PUBLIC_TEXT, acceptsSubmissions, callPhase, formatArDay } from "@repo/muestras";
import { listarMisEnvios } from "@/lib/envios/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mis envíos" };

export default async function MisEnvios() {
  const usuario = await requireUsuario("/panel/envios");
  const envios = await listarMisEnvios(usuario.id);
  const ahora = new Date();
  return (
    <main className="max-w-3xl space-y-10">
      <header className="space-y-3">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Mis envíos</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">Las obras que mandaste a convocatorias y cómo sigue cada una.</p>
      </header>
      {envios.length === 0 ? (
        <p className="border-t border-[var(--mf-line)] pt-6 text-lg">Todavía no enviaste obras. <Link href="/convocatorias" className="underline underline-offset-[6px]">Ver convocatorias abiertas</Link></p>
      ) : (
        <ul className="border-t border-[var(--mf-line)]">
          {envios.map((e) => {
            const fase = callPhase(e.call, ahora);
            const terminado = e.call.status === "DONE";
            return (
              <li key={e.id} className="space-y-4 border-b border-[var(--mf-line)] py-6">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <Link href={`/convocatorias/${e.call.slug}`} className="mf-titulo text-xl underline-offset-[5px] hover:underline">{e.call.title}</Link>
                  <span className="text-sm">{e.status === "WITHDRAWN" ? "Retiraste el envío" : CALL_PHASE_PUBLIC_TEXT[fase]}</span>
                </div>
                {e.status === "ACTIVE" ? (
                  <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {e.works.map((w) => (
                      <li key={w.id} className="space-y-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={w.imageUrl} alt="" className="aspect-square w-full bg-[var(--mf-surface)] object-contain" />
                        <p className="text-[15px]">{w.title}</p>
                        {terminado ? <p className="text-sm text-[var(--mf-muted)]">{w.decision === "SELECTED" ? "Seleccionada" : "No quedó en la selección"}</p> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {acceptsSubmissions(fase) ? (
                  <p className="text-[15px]">
                    <Link href={`/convocatorias/${e.call.slug}/enviar`} className="underline underline-offset-[6px]">{e.status === "ACTIVE" ? "Cambiar o retirar" : "Volver a enviar"}</Link>
                    <span className="text-[var(--mf-muted)]"> hasta el {formatArDay(e.call.closesAt)}</span>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Chequeos y prueba**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: todo en verde.

En local, con otra cuenta (no la que organiza): "Enviar obras" lleva al login y vuelve; subir dos fotos, completar títulos, aceptar bases y derechos, "Enviar" → "¡Listo!…" y en consola `[muestras] correo no enviado: … Recibimos tus obras` (compuerta apagada). "Mis envíos" lo muestra; "Cambiar o retirar" vuelve al formulario con lo cargado; "Retirar mi envío" lo deja como "Retiraste el envío". Con la cuenta que organiza, el formulario dice "Organizás esta convocatoria: no podés enviar obras." Intentar mandar por consola (`fetch` de la server action) una `imageUrl` de otra carpeta `muestras/<otro id>/`: se descarta.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras/lib/envios apps/muestras/components/envios "apps/muestras/app/convocatorias/[slug]/enviar/page.tsx" apps/muestras/app/panel/envios/page.tsx
git commit -m "Envíos a convocatorias: formulario con obras propias, retirar y Mis envíos"
```

---
### Task 12: Visor anónimo del curador y ruta de la imagen

**Files:**
- Create: `apps/muestras/lib/curaduria/imagen.ts`, `apps/muestras/app/api/curaduria/obras/[id]/imagen/route.ts`
- Create: `apps/muestras/components/curaduria/visor-curaduria.tsx`, `apps/muestras/app/panel/curaduria/page.tsx`, `apps/muestras/app/panel/curaduria/[id]/page.tsx`
- Test: `apps/muestras/lib/curaduria/imagen.test.ts`

**Interfaces:**
- Consumes: `canViewCallImage` (Task 2), `leerDeR2` (Task 5), `colaDelCurador`, `listarMisCuradurias` (Task 8), `puntuar` (Task 8).
- Produces: `imagenAutorizada(callWorkId, usuario): Promise<string | null>`; `GET /api/curaduria/obras/[id]/imagen` (404 ante cualquier negativa, `Cache-Control: private, max-age=600`, `Referrer-Policy: no-referrer`); `VisorCuraduria({ obras, soloLectura })`.

- [ ] **Step 1: Escribir el test que falla**

`apps/muestras/lib/curaduria/imagen.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalCallWork: { findUnique: vi.fn() },
  culturalCallCurator: { findFirst: vi.fn() },
}));
vi.mock("@repo/db", () => ({ prisma: db }));

const { imagenAutorizada } = await import("./imagen");

const fila = (status: string, envio = "ACTIVE") => ({
  imageUrl: "https://pub/muestras/7/a.webp", callId: "c1",
  submission: { status: envio }, call: { status, activity: { proposedByUserId: 9 } },
});
const persona = (id: number, esSuperAdmin = false) => ({ id, esSuperAdmin, email: "x@y", name: null });

beforeEach(() => {
  vi.clearAllMocks();
  db.culturalCallCurator.findFirst.mockResolvedValue(null);
});

describe("imagen por la ruta anónima", () => {
  it("el curador activo la ve durante la curaduría", async () => {
    db.culturalCallWork.findUnique.mockResolvedValue(fila("CURATING"));
    db.culturalCallCurator.findFirst.mockResolvedValue({ status: "ACTIVE" });
    expect(await imagenAutorizada("w1", persona(20))).toBe("https://pub/muestras/7/a.webp");
  });
  it("el autor no la pide por acá (y un desconocido tampoco)", async () => {
    db.culturalCallWork.findUnique.mockResolvedValue(fila("CURATING"));
    expect(await imagenAutorizada("w1", persona(7))).toBeNull();
  });
  it("el organizador, desde el cierre", async () => {
    db.culturalCallWork.findUnique.mockResolvedValue(fila("OPEN"));
    expect(await imagenAutorizada("w1", persona(9))).toBeNull();
    db.culturalCallWork.findUnique.mockResolvedValue(fila("CLOSED"));
    expect(await imagenAutorizada("w1", persona(9))).not.toBeNull();
  });
  it("un envío retirado no se sirve", async () => {
    db.culturalCallWork.findUnique.mockResolvedValue(fila("CURATING", "WITHDRAWN"));
    expect(await imagenAutorizada("w1", persona(1, true))).toBeNull();
  });
  it("una obra inexistente", async () => {
    db.culturalCallWork.findUnique.mockResolvedValue(null);
    expect(await imagenAutorizada("w1", persona(9))).toBeNull();
  });
});
```

Run: `pnpm --filter muestras test -- lib/curaduria/imagen`
Expected: FAIL — `Failed to resolve import "./imagen"`.

- [ ] **Step 2: Implementar la autorización y la ruta**

`apps/muestras/lib/curaduria/imagen.ts`:
```ts
import "server-only";
import { prisma } from "@repo/db";
import { canViewCallImage } from "@repo/muestras";
import type { Usuario } from "@/lib/usuario";

/**
 * La URL interna de la imagen de una obra enviada, si esta persona puede verla por la ruta
 * anónima; si no, `null`. La URL nunca sale de acá: la ruta la lee del bucket y la sirve.
 */
export async function imagenAutorizada(callWorkId: string, usuario: Usuario): Promise<string | null> {
  const w = await prisma.culturalCallWork.findUnique({
    where: { id: callWorkId },
    select: { imageUrl: true, callId: true, submission: { select: { status: true } }, call: { select: { status: true, activity: { select: { proposedByUserId: true } } } } },
  });
  if (!w || w.submission.status !== "ACTIVE") return null;
  const k = await prisma.culturalCallCurator.findFirst({ where: { callId: w.callId, userId: usuario.id }, select: { status: true } });
  const puede = canViewCallImage({
    status: w.call.status,
    isOwner: w.call.activity.proposedByUserId === usuario.id,
    isSuperAdmin: usuario.esSuperAdmin,
    curatorStatus: k?.status ?? null,
  });
  return puede ? w.imageUrl : null;
}
```

`apps/muestras/app/api/curaduria/obras/[id]/imagen/route.ts`:
```ts
import { getUsuario } from "@/lib/usuario";
import { frenarPorUsuario } from "@/lib/limite";
import { imagenAutorizada } from "@/lib/curaduria/imagen";
import { leerDeR2 } from "@/lib/imagenes/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * La imagen de una obra enviada, para curadores y organizador, sin revelar su URL: la del bucket
 * lleva el id de quien la subió (`muestras/<userId>/…`). El archivo ya no tiene EXIF (sharp lo
 * descarta al pasar a WebP), así que tampoco viaja el autor de la cámara.
 *
 * Cualquier negativa responde 404, igual que una obra inexistente: no se confirma que exista.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await getUsuario();
  if (!usuario) return new Response("No encontrada", { status: 404 });
  if (!frenarPorUsuario("imagenCuraduria", usuario.id).allowed) return new Response("Demasiados pedidos", { status: 429 });
  const url = await imagenAutorizada(id, usuario);
  if (!url) return new Response("No encontrada", { status: 404 });
  const archivo = await leerDeR2(url);
  if (!archivo) return new Response("No encontrada", { status: 404 });
  return new Response(archivo.cuerpo, {
    headers: {
      "Content-Type": archivo.contentType,
      // Privada: ni el CDN ni un proxy compartido la guardan para otra persona.
      "Cache-Control": "private, max-age=600",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Disposition": "inline",
    },
  });
}
```

Run: `pnpm --filter muestras test -- lib/curaduria`
Expected: PASS.

- [ ] **Step 3: Visor y páginas**

`apps/muestras/components/curaduria/visor-curaduria.tsx`:
```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CURATOR_FILTERS, SCORE_MAX, SCORE_MIN, curatorProgress, filterForCurator, type CuratorFilter, type CuratorWorkView } from "@repo/muestras";
import { puntuar } from "@/lib/curaduria/acciones";

const PUNTAJES = Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }, (_, i) => SCORE_MIN + i);

/**
 * El visor del curador. Teclado: 1 a 5 puntúa, ← y → pasan de obra, N escribe una nota (Escape
 * vuelve). El filtro arma la lista una vez, al elegirlo: puntuar una obra en "Me faltan" no la
 * saca de abajo de los ojos (lección del visor de FotoRank).
 */
export function VisorCuraduria({ obras: iniciales, soloLectura }: { obras: CuratorWorkView[]; soloLectura: boolean }) {
  const [obras, setObras] = useState(iniciales);
  const [filtro, setFiltro] = useState<CuratorFilter>("TODAS");
  const [ids, setIds] = useState(() => iniciales.map((o) => o.id));
  const [pos, setPos] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const nota = useRef<HTMLTextAreaElement>(null);
  const porId = useMemo(() => new Map(obras.map((o) => [o.id, o])), [obras]);
  const actual = ids[pos] ? porId.get(ids[pos]) : undefined;
  const avance = curatorProgress(obras);

  const elegirFiltro = (f: CuratorFilter) => {
    setFiltro(f);
    setIds(filterForCurator(obras, f).map((o) => o.id));
    setPos(0);
  };
  const ir = useCallback((paso: number) => setPos((p) => Math.min(Math.max(p + paso, 0), Math.max(ids.length - 1, 0))), [ids.length]);

  const guardar = useCallback(async (score: number, texto: string) => {
    if (!actual || soloLectura) return;
    const antes = actual;
    setObras((xs) => xs.map((o) => (o.id === antes.id ? { ...o, myScore: score, myNote: texto } : o)));
    setGuardando(true);
    const r = await puntuar(antes.id, score, texto);
    setGuardando(false);
    if (!r.ok) {
      setError(r.errores.join(" "));
      setObras((xs) => xs.map((o) => (o.id === antes.id ? antes : o)));
    } else setError(null);
  }, [actual, soloLectura]);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") { e.preventDefault(); ir(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); ir(-1); }
      else if (/^[1-5]$/.test(e.key) && actual) { e.preventDefault(); void guardar(Number(e.key), actual.myNote); }
      else if (e.key.toLowerCase() === "n" && !soloLectura) { e.preventDefault(); nota.current?.focus(); }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [ir, guardar, actual, soloLectura]);

  // La siguiente imagen se pide antes de llegar: pasar de obra no espera la red.
  useEffect(() => {
    const sig = ids[pos + 1] ? porId.get(ids[pos + 1]) : undefined;
    if (sig) new Image().src = sig.imagePath;
  }, [ids, pos, porId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filtro" className="flex gap-4 text-[15px]">
          {CURATOR_FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filtro === f.id} className={filtro === f.id ? "underline underline-offset-[6px]" : "text-[var(--mf-muted)]"} onClick={() => elegirFiltro(f.id)}>{f.label}</button>
          ))}
        </div>
        <p className="text-[15px] tabular-nums">Puntuaste {avance.scored} de {avance.total}</p>
      </div>

      {!actual ? (
        <p className="border-t border-[var(--mf-line)] pt-6 text-lg">{filtro === "ME_FALTAN" ? "No te falta ninguna. ¡Gracias!" : "No hay obras para mostrar."}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <figure className="flex h-[min(75vh,48rem)] items-center justify-center bg-[#0f171d]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={actual.id} src={actual.imagePath} alt={`Obra ${actual.code}`} className="max-h-full max-w-full object-contain" />
          </figure>
          <div className="space-y-5">
            <p className="text-sm text-[var(--mf-muted)] tabular-nums">{actual.code}. Obra {pos + 1} de {ids.length}</p>
            <div className="space-y-1">
              <p className="mf-titulo text-2xl">{actual.title}</p>
              <p className="text-[13px] text-[var(--mf-muted)]">{[actual.year, actual.technique].filter(Boolean).join(". ")}</p>
              {actual.statement ? <p className="text-[15px] leading-snug">{actual.statement}</p> : null}
            </div>
            <div role="radiogroup" aria-label="Puntaje" className="flex gap-2">
              {PUNTAJES.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={actual.myScore === n}
                  disabled={soloLectura}
                  className={`size-11 rounded-[2px] border text-lg tabular-nums ${actual.myScore === n ? "border-[var(--mf-ink)] bg-[var(--mf-ink)] text-white" : "border-[var(--mf-line)]"}`}
                  onClick={() => void guardar(n, actual.myNote)}
                >
                  {n}
                </button>
              ))}
            </div>
            <label className="block space-y-1">
              <span className="text-sm">Nota (optativa, la lee quien organiza)</span>
              <textarea
                key={`nota-${actual.id}`}
                ref={nota}
                rows={4}
                defaultValue={actual.myNote}
                disabled={soloLectura || actual.myScore == null}
                placeholder={actual.myScore == null ? "Primero poné un puntaje" : undefined}
                className="w-full rounded-[2px] border border-[var(--mf-line)] bg-white px-3 py-2"
                onBlur={(e) => { if (actual.myScore != null && e.target.value !== actual.myNote) void guardar(actual.myScore, e.target.value); }}
              />
            </label>
            <div className="flex justify-between text-[15px]">
              <button type="button" className="underline disabled:opacity-40" disabled={pos === 0} onClick={() => ir(-1)}>Anterior</button>
              <button type="button" className="underline disabled:opacity-40" disabled={pos >= ids.length - 1} onClick={() => ir(1)}>Siguiente</button>
            </div>
            <p className="text-sm text-[var(--mf-muted)]">{soloLectura ? "La curaduría está cerrada: sólo lectura." : "Teclado: 1 a 5 puntúa, ← → pasan de obra, N escribe una nota."}</p>
            {guardando ? <p className="text-sm text-[var(--mf-muted)]">Guardando…</p> : null}
            {error ? <p className="text-[var(--mf-alerta)]">{error}</p> : null}
          </div>
        </div>
      )}
    </div>
  );
}
```

`apps/muestras/app/panel/curaduria/page.tsx`:
```tsx
import Link from "next/link";
import { CALL_STATUS_LABELS, isCallStatus } from "@repo/muestras";
import { listarMisCuradurias } from "@/lib/curaduria/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Curaduría" };

export default async function Curaduria() {
  const usuario = await requireUsuario("/panel/curaduria");
  const mias = await listarMisCuradurias(usuario.id);
  return (
    <main className="max-w-3xl space-y-10">
      <header className="space-y-3">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Curaduría</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">Las convocatorias donde sos parte del equipo curatorial. Ves las obras sin el nombre de su autor, en un orden propio, y las puntuás de 1 a 5.</p>
      </header>
      {mias.length === 0 ? (
        <p className="border-t border-[var(--mf-line)] pt-6 text-lg">Todavía no te invitaron a curar. La invitación llega por mail, con un enlace.</p>
      ) : (
        <ul className="border-t border-[var(--mf-line)]">
          {mias.map((m) => {
            const abierta = m.call.status === "CURATING" || m.call.status === "DONE";
            return (
              <li key={m.curatorId} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--mf-line)] py-4">
                <span>
                  {abierta ? <Link href={`/panel/curaduria/${m.call.id}`} className="mf-titulo text-xl underline-offset-[5px] hover:underline">{m.call.title}</Link> : <span className="mf-titulo text-xl">{m.call.title}</span>}
                  <span className="block text-[13px] text-[var(--mf-muted)]">
                    {abierta ? `Puntuaste ${m.puntuadas} de ${m.total}` : "La curaduría empieza cuando quien organiza la abra. Te vamos a ver acá."}
                  </span>
                </span>
                <span className="text-sm">{isCallStatus(m.call.status) ? CALL_STATUS_LABELS[m.call.status] : m.call.status}</span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
```

`apps/muestras/app/panel/curaduria/[id]/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { VisorCuraduria } from "@/components/curaduria/visor-curaduria";
import { colaDelCurador } from "@/lib/curaduria/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Curaduría" };

type Props = { params: Promise<{ id: string }> };

/** Sólo curadores activos, con la curaduría empezada. Cualquier otra cosa: 404. */
export default async function CurarConvocatoria({ params }: Props) {
  const { id } = await params;
  const usuario = await requireUsuario(`/panel/curaduria/${id}`);
  const cola = await colaDelCurador(id, usuario.id);
  if (!cola) notFound();
  return (
    <main className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-[var(--mf-muted)]"><Link href="/panel/curaduria" className="underline underline-offset-4">Curaduría</Link></p>
        <h1 className="mf-titulo text-[clamp(1.8rem,3vw,2.4rem)]">{cola.call.title}</h1>
        <details className="max-w-3xl text-[15px]"><summary className="cursor-pointer text-[var(--mf-muted)]">Las bases</summary><div className="mt-2 whitespace-pre-line">{cola.call.basesText}</div></details>
      </header>
      <VisorCuraduria obras={cola.obras} soloLectura={cola.call.status !== "CURATING"} />
    </main>
  );
}
```

- [ ] **Step 4: Chequeos y prueba del anonimato**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: todo en verde.

En local, con la convocatoria de las Tasks 8 a 11 cerrada (para probar antes de la fecha, correr en la base de desarrollo `update "CulturalCall" set "closesAt" = now() - interval '1 minute' where id = '<id>'`), "Cerrar la convocatoria" y "Empezar la curaduría". Con la cuenta curadora en `/panel/curaduria/<id>`:
1. Las teclas 1–5 puntúan, ← → pasan de obra, N abre la nota, Escape sale. "Puntuaste N de M" sube.
2. En "Me faltan", puntuar no saca la obra de la pantalla.
3. **Anonimato:** en DevTools → Network, ninguna respuesta (HTML, RSC ni la de la server action) contiene el nombre del autor, su email, `muestras/<id de usuario>` ni el dominio público de R2. Las imágenes se piden a `/api/curaduria/obras/<id>/imagen`.
4. La misma URL de imagen, abierta con la cuenta que envió la obra o sin sesión: 404.
5. Con otra cuenta curadora el orden de las obras es distinto; al recargar, cada una conserva el suyo.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras/lib/curaduria/imagen.ts apps/muestras/lib/curaduria/imagen.test.ts "apps/muestras/app/api/curaduria/obras/[id]/imagen/route.ts" apps/muestras/components/curaduria/visor-curaduria.tsx apps/muestras/app/panel/curaduria/page.tsx "apps/muestras/app/panel/curaduria/[id]/page.tsx"
git commit -m "Visor anónimo de curaduría con teclado y la imagen servida sin su URL"
```

---
### Task 13: Selección del organizador y "Armar la muestra"

**Files:**
- Create: `apps/muestras/lib/seleccion/consultas.ts`, `apps/muestras/lib/seleccion/acciones.ts`
- Create: `apps/muestras/components/seleccion/tabla-seleccion.tsx`, `apps/muestras/app/panel/convocatorias/[id]/seleccion/page.tsx`
- Test: `apps/muestras/lib/seleccion/acciones.test.ts`

**Interfaces:**
- Consumes: `rankWorks`, `filterRanking`, `canSeeIdentity`, `curatorImagePath`, `canDecide`, `selectionRoom`, `assemblyPlan` (Task 2), `canEdit` (etapa 1), `buscarConvocatoriaDelOrganizador` (Task 7), `cerrarCuraduria` (Task 7, desde `AccionesConvocatoria`).
- Produces:
  - `consultas.ts`: `FilaSeleccion = RankingRow & { title; year; technique; statement; imagePath; notes: string[]; authorName: string | null }`, `rankingDeLaConvocatoria(callId, status)` (pide `authorName` sólo en `DONE`; cuenta sólo puntajes de curadores `ACTIVE`), `avanceDelEquipo(callId)`.
  - `acciones.ts`: `decidir(callWorkId, "PENDING"|"SELECTED"|"DISCARDED")`, `armarMuestra(callId)`.
  - `TablaSeleccion({ callId, estado, filas, lugar, yaArmada, muestraId })`.

- [ ] **Step 1: Escribir el test que falla**

`apps/muestras/lib/seleccion/acciones.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalCall: { findUnique: vi.fn(), updateMany: vi.fn() },
  culturalCallWork: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  culturalCallScore: { findMany: vi.fn() },
  culturalActivityWork: { count: vi.fn(), create: vi.fn() },
  culturalActivity: { update: vi.fn() },
  photographerProfile: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));

vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { armarMuestra, decidir } = await import("./acciones");
const { resetRateLimit } = await import("@/lib/limite");

const ana = { id: 7, esSuperAdmin: false, email: "ana@x", name: "Ana" };
const obra = { id: "w1", callId: "c1", decision: "PENDING", anonymousCode: "O-001", call: { status: "CURATING", activity: { id: "a1", proposedByUserId: 7 } } };

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = ana;
  db.culturalCallWork.findUnique.mockResolvedValue(obra);
  db.culturalCallWork.updateMany.mockResolvedValue({ count: 1 });
  db.culturalCallWork.count.mockResolvedValue(0);
  db.culturalActivityWork.count.mockResolvedValue(0);
  db.culturalCall.updateMany.mockResolvedValue({ count: 1 });
  db.culturalActivityWork.create.mockImplementation(async ({ data }: { data: { title: string } }) => ({ id: `aw-${data.title}` }));
  db.photographerProfile.findMany.mockResolvedValue([{ id: "p-ana", userId: 30 }]);
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
});

describe("decidir", () => {
  it("el organizador selecciona durante la curaduría", async () => {
    expect((await decidir("w1", "SELECTED")).ok).toBe(true);
    expect(db.culturalCallWork.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "w1", call: { status: "CURATING" } }, data: expect.objectContaining({ decision: "SELECTED" }) }));
  });
  it("una decisión inventada no", async () => expect((await decidir("w1", "GANADORA")).ok).toBe(false));
  it("alguien que no organiza no", async () => {
    usuarioActual.valor = { ...ana, id: 8 };
    expect((await decidir("w1", "DISCARDED")).ok).toBe(false);
    expect(db.culturalCallWork.updateMany).not.toHaveBeenCalled();
  });
  it("no pasa del tope de 40 entre lo que ya tiene la muestra y lo elegido", async () => {
    db.culturalActivityWork.count.mockResolvedValue(30);
    db.culturalCallWork.count.mockResolvedValue(10);
    expect(await decidir("w1", "SELECTED")).toMatchObject({ ok: false, errores: [expect.stringMatching(/hasta 40 obras/)] });
  });
  it("descartar no mira el tope", async () => {
    db.culturalActivityWork.count.mockResolvedValue(40);
    expect((await decidir("w1", "DISCARDED")).ok).toBe(true);
  });
  it("con la curaduría cerrada no", async () => {
    db.culturalCallWork.findUnique.mockResolvedValue({ ...obra, call: { ...obra.call, status: "DONE" } });
    expect((await decidir("w1", "SELECTED")).ok).toBe(false);
  });
});

describe("armarMuestra", () => {
  const conv = {
    id: "c1", status: "DONE", assembledAt: null,
    activity: { id: "a1", slug: "ciudad", reviewStatus: "DRAFT", proposedByUserId: 7, workspaceId: null, isCancelled: false, rightsConfirmedAt: null, works: [{ isHighlight: true }] },
  };
  const elegida = (id: string, title: string, userId: number) => ({
    id, anonymousCode: id.toUpperCase(), decision: "SELECTED", imageUrl: `https://pub/muestras/${userId}/${id}.webp`, title, year: 2024, technique: null,
    submission: { authorName: `Autor ${userId}`, userId },
  });
  beforeEach(() => {
    db.culturalCall.findUnique.mockResolvedValue(conv);
    db.culturalCallWork.findMany.mockResolvedValue([elegida("w1", "Uno", 30), elegida("w2", "Dos", 31)]);
    db.culturalCallScore.findMany.mockResolvedValue([{ callWorkId: "w1", score: 3 }, { callWorkId: "w2", score: 5 }]);
  });
  it("copia las elegidas en el orden del ranking, después de las que había, con autor y perfil", async () => {
    expect(await armarMuestra("c1")).toEqual({ ok: true, id: "a1" });
    const creadas = db.culturalActivityWork.create.mock.calls.map((c) => c[0].data);
    expect(creadas).toEqual([
      { activityId: "a1", imageUrl: "https://pub/muestras/31/w2.webp", title: "Dos", year: 2024, technique: null, authorName: "Autor 31", authorUserId: 31, authorProfileId: null, isHighlight: true, sortOrder: 1 },
      { activityId: "a1", imageUrl: "https://pub/muestras/30/w1.webp", title: "Uno", year: 2024, technique: null, authorName: "Autor 30", authorUserId: 30, authorProfileId: "p-ana", isHighlight: true, sortOrder: 2 },
    ]);
    expect(db.culturalCallWork.update).toHaveBeenCalledWith({ where: { id: "w2" }, data: { activityWorkId: "aw-Dos" } });
    expect(db.culturalActivity.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ rightsConfirmedAt: expect.any(Date) }) }));
  });
  it("una segunda vez no duplica", async () => {
    db.culturalCall.updateMany.mockResolvedValue({ count: 0 });
    expect(await armarMuestra("c1")).toEqual({ ok: false, errores: ["La muestra ya se armó con esta selección."] });
    expect(db.culturalActivityWork.create).not.toHaveBeenCalled();
  });
  it("antes de cerrar la curaduría no", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "CURATING" });
    expect((await armarMuestra("c1")).ok).toBe(false);
  });
  it("con la muestra en revisión no", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, activity: { ...conv.activity, reviewStatus: "IN_REVIEW" } });
    expect(await armarMuestra("c1")).toMatchObject({ ok: false, errores: [expect.stringMatching(/no se puede editar/)] });
  });
  it("sin elegidas no", async () => {
    db.culturalCallWork.findMany.mockResolvedValue([]);
    expect(await armarMuestra("c1")).toEqual({ ok: false, errores: ["No hay obras seleccionadas."] });
  });
});
```

Run: `pnpm --filter muestras test -- lib/seleccion`
Expected: FAIL — `Failed to resolve import "./acciones"`.

- [ ] **Step 2: Implementar**

`apps/muestras/lib/seleccion/consultas.ts`:
```ts
import "server-only";
import { prisma } from "@repo/db";
import { canSeeIdentity, curatorImagePath, rankWorks, type RankingRow } from "@repo/muestras";

export type FilaSeleccion = RankingRow & {
  title: string;
  year: number | null;
  technique: string | null;
  statement: string | null;
  imagePath: string;
  /** Notas de los curadores, sin decir de quién. */
  notes: string[];
  /** Sólo con la selección cerrada (`canSeeIdentity`). */
  authorName: string | null;
};

/**
 * El ranking que ve el organizador. Antes del cierre de la curaduría la consulta ni siquiera pide
 * el nombre del autor; la imagen va siempre por la ruta anónima. Cuentan sólo los puntajes de
 * curadores activos (uno revocado deja de pesar).
 */
export async function rankingDeLaConvocatoria(callId: string, status: string): Promise<FilaSeleccion[]> {
  const identidad = canSeeIdentity(status);
  const obras = await prisma.culturalCallWork.findMany({
    where: { callId, anonymousCode: { not: null }, submission: { status: "ACTIVE" } },
    select: {
      id: true, anonymousCode: true, decision: true, title: true, year: true, technique: true, statement: true,
      ...(identidad ? { submission: { select: { authorName: true } } } : {}),
    },
  });
  const puntajes = await prisma.culturalCallScore.findMany({
    where: { callWork: { callId }, curator: { status: "ACTIVE" } },
    select: { callWorkId: true, score: true, note: true },
  });
  const porId = new Map(obras.map((o) => [o.id, o]));
  return rankWorks(obras, puntajes).map((r) => {
    const o = porId.get(r.workId)!;
    const autor = identidad && "submission" in o ? (o.submission as { authorName: string }).authorName : null;
    return {
      ...r,
      title: o.title, year: o.year, technique: o.technique, statement: o.statement,
      imagePath: curatorImagePath(o.id),
      notes: puntajes.filter((p) => p.callWorkId === o.id && p.note).map((p) => p.note!),
      authorName: autor,
    };
  });
}

/** Avance de cada curador (cuántas puntuó de cuántas). El organizador conoce a su equipo. */
export async function avanceDelEquipo(callId: string) {
  const [curadores, total] = await Promise.all([
    prisma.culturalCallCurator.findMany({ where: { callId, status: "ACTIVE" }, select: { id: true, email: true, _count: { select: { scores: true } } }, orderBy: { acceptedAt: "asc" } }),
    prisma.culturalCallWork.count({ where: { callId, anonymousCode: { not: null }, submission: { status: "ACTIVE" } } }),
  ]);
  return curadores.map((k) => ({ id: k.id, email: k.email, puntuadas: k._count.scores, total }));
}
```

`apps/muestras/lib/seleccion/acciones.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { assemblyPlan, canDecide, canEdit, isWorkDecision, rankWorks, selectionRoom, type ReviewStatus } from "@repo/muestras";
import { getUsuario } from "@/lib/usuario";
import { frenarPorUsuario } from "@/lib/limite";
import type { ResultadoAccion } from "@/lib/actividades/acciones";

const SIN_SESION: ResultadoAccion = { ok: false, errores: ["Tenés que ingresar."] };
const NO_EXISTE: ResultadoAccion = { ok: false, errores: ["La obra no existe."] };

/** Seleccionar, descartar o volver a pendiente una obra, durante la curaduría. */
export async function decidir(callWorkId: string, decision: string): Promise<ResultadoAccion> {
  if (typeof callWorkId !== "string" || !isWorkDecision(decision)) return NO_EXISTE;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  if (!frenarPorUsuario("decidir", usuario.id).allowed) return { ok: false, errores: ["Vas muy rápido. Esperá unos minutos."] };
  const w = await prisma.culturalCallWork.findUnique({
    where: { id: callWorkId },
    select: { id: true, callId: true, decision: true, anonymousCode: true, call: { select: { status: true, activity: { select: { id: true, proposedByUserId: true } } } } },
  });
  if (!w || !w.anonymousCode) return NO_EXISTE;
  if (w.call.activity.proposedByUserId !== usuario.id && !usuario.esSuperAdmin) return NO_EXISTE;
  if (!canDecide(w.call.status)) return { ok: false, errores: ["Sólo se decide durante la curaduría."] };
  if (decision === "SELECTED" && w.decision !== "SELECTED") {
    const [enLaMuestra, elegidas] = await Promise.all([
      prisma.culturalActivityWork.count({ where: { activityId: w.call.activity.id } }),
      prisma.culturalCallWork.count({ where: { callId: w.callId, decision: "SELECTED" } }),
    ]);
    if (selectionRoom(enLaMuestra, elegidas) < 1) {
      return { ok: false, errores: ["La muestra admite hasta 40 obras: para elegir otra, sacá alguna de la selección."] };
    }
  }
  const { count } = await prisma.culturalCallWork.updateMany({
    where: { id: callWorkId, call: { status: "CURATING" } },
    data: { decision, decidedAt: new Date() },
  });
  if (count === 0) return { ok: false, errores: ["La curaduría cambió mientras tanto. Recargá la página."] };
  revalidatePath(`/panel/convocatorias/${w.callId}/seleccion`);
  return { ok: true, id: callWorkId };
}

/**
 * Copia las obras seleccionadas a la galería de la muestra, en el orden del ranking, con su autor
 * (y su perfil de fotógrafo, si tiene). Una sola vez: `assembledAt` se marca dentro de la misma
 * transacción, así un doble clic no duplica obras.
 */
export async function armarMuestra(callId: string): Promise<ResultadoAccion> {
  if (typeof callId !== "string") return NO_EXISTE;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const c = await prisma.culturalCall.findUnique({
    where: { id: callId },
    select: {
      id: true, status: true, assembledAt: true,
      activity: { select: { id: true, slug: true, reviewStatus: true, proposedByUserId: true, workspaceId: true, isCancelled: true, rightsConfirmedAt: true, works: { select: { isHighlight: true } } } },
    },
  });
  if (!c || (c.activity.proposedByUserId !== usuario.id && !usuario.esSuperAdmin)) return { ok: false, errores: ["La convocatoria no existe."] };
  if (c.status !== "DONE") return { ok: false, errores: ["Primero cerrá la curaduría."] };
  if (c.assembledAt) return { ok: false, errores: ["La muestra ya se armó con esta selección."] };
  const a = c.activity;
  if (!canEdit({ ...a, reviewStatus: a.reviewStatus as ReviewStatus }, { userId: usuario.id, isSuperAdmin: usuario.esSuperAdmin })) {
    return { ok: false, errores: ["La muestra no se puede editar ahora (está en revisión o despublicada)."] };
  }

  const elegidas = await prisma.culturalCallWork.findMany({
    where: { callId, decision: "SELECTED", submission: { status: "ACTIVE" } },
    select: { id: true, anonymousCode: true, decision: true, imageUrl: true, title: true, year: true, technique: true, submission: { select: { authorName: true, userId: true } } },
  });
  const puntajes = await prisma.culturalCallScore.findMany({
    where: { callWorkId: { in: elegidas.map((e) => e.id) }, curator: { status: "ACTIVE" } },
    select: { callWorkId: true, score: true },
  });
  const perfiles = await prisma.photographerProfile.findMany({
    where: { userId: { in: [...new Set(elegidas.map((e) => e.submission.userId))] } },
    select: { id: true, userId: true },
  });
  const perfilDe = new Map(perfiles.map((p) => [p.userId, p.id]));
  const porId = new Map(elegidas.map((e) => [e.id, e]));
  const enOrden = rankWorks(elegidas, puntajes).map((r) => {
    const e = porId.get(r.workId)!;
    return {
      callWorkId: e.id, imageUrl: e.imageUrl, title: e.title, year: e.year, technique: e.technique,
      authorName: e.submission.authorName, authorUserId: e.submission.userId, authorProfileId: perfilDe.get(e.submission.userId) ?? null,
    };
  });
  const plan = assemblyPlan(enOrden, { count: a.works.length, highlights: a.works.filter((w) => w.isHighlight).length });
  if (plan.problems.length) return { ok: false, errores: plan.problems };

  try {
    await prisma.$transaction(
      async (tx) => {
        const { count } = await tx.culturalCall.updateMany({ where: { id: callId, status: "DONE", assembledAt: null }, data: { assembledAt: new Date() } });
        if (count === 0) throw new Error("ya-armada");
        for (const o of plan.works) {
          const { callWorkId, ...obra } = o;
          const creada = await tx.culturalActivityWork.create({ data: { ...obra, activityId: a.id }, select: { id: true } });
          await tx.culturalCallWork.update({ where: { id: callWorkId }, data: { activityWorkId: creada.id } });
        }
        // Cada autor aceptó la autorización de derechos al enviar.
        if (!a.rightsConfirmedAt) await tx.culturalActivity.update({ where: { id: a.id }, data: { rightsConfirmedAt: new Date() } });
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  } catch (err) {
    if (err instanceof Error && err.message === "ya-armada") return { ok: false, errores: ["La muestra ya se armó con esta selección."] };
    throw err;
  }
  revalidatePath("/panel", "layout");
  revalidatePath(`/m/${a.slug}`, "layout");
  return { ok: true, id: a.id };
}
```

Run: `pnpm --filter muestras test -- lib/seleccion`
Expected: PASS (11 tests).

- [ ] **Step 3: Tabla y página**

`apps/muestras/components/seleccion/tabla-seleccion.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { filterRanking, type WorkDecision } from "@repo/muestras";
import { botonFino, botonLleno, campo } from "@/components/convocatorias/estilos";
import { armarMuestra, decidir } from "@/lib/seleccion/acciones";
import type { FilaSeleccion } from "@/lib/seleccion/consultas";

const DECISION: Record<WorkDecision, string> = { PENDING: "Sin decidir", SELECTED: "Elegida", DISCARDED: "Descartada" };

export function TablaSeleccion({ callId, estado, filas, lugar, yaArmada, muestraId }: {
  callId: string; estado: string; filas: FilaSeleccion[]; lugar: number; yaArmada: boolean; muestraId: string;
}) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [minimo, setMinimo] = useState("");
  const [cual, setCual] = useState<WorkDecision | "ALL">("ALL");
  const visibles = useMemo(
    () => filterRanking(filas, { minAverage: minimo === "" ? null : Number(minimo), decision: cual }),
    [filas, minimo, cual],
  );
  const curando = estado === "CURATING";
  const elegidas = filas.filter((f) => f.decision === "SELECTED").length;
  const correr = (f: () => Promise<{ ok: boolean; errores?: string[] }>) =>
    start(async () => {
      const r = await f();
      setError(r.ok ? null : (r.errores ?? []).join(" "));
      if (r.ok) router.refresh();
    });

  return (
    <section aria-label="Obras" className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1">
          <span className="block text-sm">Promedio mínimo</span>
          <select value={minimo} onChange={(e) => setMinimo(e.target.value)} className={`${campo} w-40`}>
            <option value="">Todas</option>
            {["4.5", "4", "3.5", "3", "2"].map((v) => <option key={v} value={v}>{v.replace(".", ",")} o más</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-sm">Decisión</span>
          <select value={cual} onChange={(e) => setCual(e.target.value as WorkDecision | "ALL")} className={`${campo} w-44`}>
            <option value="ALL">Todas</option>
            <option value="PENDING">Sin decidir</option>
            <option value="SELECTED">Elegidas</option>
            <option value="DISCARDED">Descartadas</option>
          </select>
        </label>
        <p className="text-[15px]">{elegidas} {elegidas === 1 ? "elegida" : "elegidas"}{curando ? `. Lugar para ${lugar} más en la muestra.` : "."}</p>
      </div>

      {error ? <p className="text-[var(--mf-alerta)]">{error}</p> : null}

      <ol className="border-t border-[var(--mf-line)]">
        {visibles.map((f) => (
          <li key={f.workId} className="grid gap-4 border-b border-[var(--mf-line)] py-5 sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.imagePath} alt={`Obra ${f.code}`} loading="lazy" className="aspect-square w-40 bg-[var(--mf-surface)] object-contain" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm text-[var(--mf-muted)]">{f.code}</p>
              <p className="mf-titulo text-xl">{f.title}</p>
              <p className="text-[13px] text-[var(--mf-muted)]">{[f.year, f.technique].filter(Boolean).join(". ")}</p>
              {f.authorName ? <p className="text-[15px]">{f.authorName}</p> : null}
              {f.statement ? <p className="text-[15px] leading-snug">{f.statement}</p> : null}
              {f.notes.length ? (
                <details className="text-[15px]">
                  <summary className="cursor-pointer text-sm text-[var(--mf-muted)]">{f.notes.length === 1 ? "1 nota del equipo" : `${f.notes.length} notas del equipo`}</summary>
                  <ul className="mt-2 space-y-1">{f.notes.map((n, i) => <li key={i} className="border-l-2 border-[var(--mf-line)] pl-3">{n}</li>)}</ul>
                </details>
              ) : null}
            </div>
            <div className="space-y-2 sm:text-right">
              <p className="mf-titulo text-3xl tabular-nums">{f.average == null ? "—" : f.average.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</p>
              <p className="text-[13px] text-[var(--mf-muted)]">{f.count} {f.count === 1 ? "puntaje" : "puntajes"}</p>
              <p className="text-sm">{DECISION[f.decision]}</p>
              {curando ? (
                <div className="flex gap-3 sm:justify-end">
                  {f.decision !== "SELECTED" ? <button type="button" disabled={pendiente} className="text-sm underline" onClick={() => correr(() => decidir(f.workId, "SELECTED"))}>Seleccionar</button> : null}
                  {f.decision !== "DISCARDED" ? <button type="button" disabled={pendiente} className="text-sm underline" onClick={() => correr(() => decidir(f.workId, "DISCARDED"))}>Descartar</button> : null}
                  {f.decision !== "PENDING" ? <button type="button" disabled={pendiente} className="text-sm text-[var(--mf-muted)] underline" onClick={() => correr(() => decidir(f.workId, "PENDING"))}>Deshacer</button> : null}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {visibles.length === 0 ? <p className="text-[var(--mf-muted)]">No hay obras con ese filtro.</p> : null}

      {estado === "DONE" ? (
        yaArmada ? (
          <p className="text-[15px]">Las obras elegidas ya están en la muestra. <Link href={`/panel/muestras/${muestraId}`} className="underline underline-offset-[6px]">Editar la muestra</Link></p>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              disabled={pendiente || elegidas === 0}
              className={botonLleno}
              onClick={() => {
                if (!window.confirm(`Se agregan ${elegidas} obras a la galería de la muestra, con el nombre de cada autor. Después podés ordenarlas y elegir destacadas en el editor.`)) return;
                correr(() => armarMuestra(callId));
              }}
            >
              Armar la muestra
            </button>
            <p className="text-sm text-[var(--mf-muted)]">Las mejor puntuadas quedan como destacadas hasta completar 12.</p>
          </div>
        )
      ) : (
        <Link href={`/panel/convocatorias/${callId}`} className={botonFino}>Volver a la convocatoria</Link>
      )}
    </section>
  );
}
```

`apps/muestras/app/panel/convocatorias/[id]/seleccion/page.tsx`:
```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { selectionRoom } from "@repo/muestras";
import { TablaSeleccion } from "@/components/seleccion/tabla-seleccion";
import { buscarConvocatoriaDelOrganizador } from "@/lib/convocatorias/consultas";
import { avanceDelEquipo, rankingDeLaConvocatoria } from "@/lib/seleccion/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Selección" };

type Props = { params: Promise<{ id: string }> };

export default async function Seleccion({ params }: Props) {
  const { id } = await params;
  const usuario = await requireUsuario(`/panel/convocatorias/${id}/seleccion`);
  const c = await buscarConvocatoriaDelOrganizador(id, usuario);
  if (!c) notFound();
  if (c.status !== "CURATING" && c.status !== "DONE") redirect(`/panel/convocatorias/${id}`);
  const [filas, equipo] = await Promise.all([rankingDeLaConvocatoria(id, c.status), avanceDelEquipo(id)]);
  const elegidas = filas.filter((f) => f.decision === "SELECTED").length;

  return (
    <main className="space-y-10">
      <header className="max-w-3xl space-y-3">
        <p className="text-sm text-[var(--mf-muted)]"><Link href={`/panel/convocatorias/${id}`} className="underline underline-offset-4">{c.title}</Link></p>
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">{c.status === "CURATING" ? "Ranking y selección" : "Selección"}</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">
          {c.status === "CURATING"
            ? "Promedio de los puntajes del equipo. Elegí las obras de la muestra; los nombres aparecen al cerrar la curaduría."
            : "La curaduría está cerrada. Con las elegidas armás la galería de la muestra."}
        </p>
      </header>

      <section aria-labelledby="t-equipo" className="max-w-3xl space-y-3">
        <h2 id="t-equipo" className="text-sm text-[var(--mf-muted)]">Avance del equipo</h2>
        <ul className="border-t border-[var(--mf-line)]">
          {equipo.map((k) => (
            <li key={k.id} className="flex justify-between border-b border-[var(--mf-line)] py-2 text-[15px]">
              <span>{k.email}</span><span className="tabular-nums">{k.puntuadas} de {k.total}</span>
            </li>
          ))}
        </ul>
      </section>

      <TablaSeleccion
        callId={id}
        estado={c.status}
        filas={filas}
        lugar={selectionRoom(c.activity._count.works, elegidas)}
        yaArmada={c.assembledAt != null}
        muestraId={c.activity.id}
      />
    </main>
  );
}
```

- [ ] **Step 4: Chequeos y prueba**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: todo en verde.

En local, con la curaduría de la Task 12 en curso, como organizador en `/panel/convocatorias/<id>/seleccion`:
1. Ranking por promedio con cantidad de puntajes y notas sin autor; **ningún nombre de autor** en la página ni en sus respuestas (DevTools).
2. Filtrar por "4 o más" y por "Elegidas". Seleccionar, descartar, deshacer. "Lugar para N más" baja al seleccionar.
3. Sacar a un curador del equipo: el promedio se recalcula sin sus puntajes.
4. "Cerrar la curaduría" (confirmación) → en consola los dos lotes de resultados (compuerta apagada). Ahora cada fila muestra el nombre del autor.
5. "Armar la muestra" → la galería de la muestra (`/panel/muestras/<id>`) tiene las elegidas en el orden del ranking, con autor, y las mejores como destacadas. Un segundo clic: "La muestra ya se armó con esta selección."
6. "Mis envíos" de la cuenta participante muestra "Seleccionada" / "No quedó en la selección" por obra.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras/lib/seleccion apps/muestras/components/seleccion "apps/muestras/app/panel/convocatorias/[id]/seleccion/page.tsx"
git commit -m "Selección anónima del organizador, identidades al cerrar y armado de la muestra"
```

---
### Task 14: Verificación final, migración en producción y PR

**Files:**
- Modify: `docs/operations/muestras-puesta-en-marcha.md` (sección "Etapa 3")

- [ ] **Step 1: Todos los chequeos**

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter @repo/muestras lint && pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice typecheck && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras build`
Expected: todo en verde. Mirar que el build realmente terminó ("Compiled successfully" y la tabla de rutas con `/convocatorias/[slug]`, `/convocatorias/[slug]/enviar`, `/panel/convocatorias/[id]/seleccion`, `/panel/curaduria/[id]`, `/panel/envios`, `/api/curaduria/obras/[id]/imagen`): si murió por memoria puede devolver éxito igual. `git diff origin/main -- pnpm-lock.yaml` vacío.

- [ ] **Step 2: Aplicar la migración en producción — la hace el controlador (autorizado por Daniel)**

Daniel ya autorizó aplicar esta migración. Qué hace: crea cinco tablas nuevas vacías en la base de FOTOFFICE/FotoRank; no modifica ni borra datos. Si algo sale mal, se borran las cinco tablas (`drop table "CulturalCallScore", "CulturalCallCurator", "CulturalCallWork", "CulturalCallSubmission", "CulturalCall";`). Va **antes** de publicar el código.

1. Correr el contenido de `packages/db/prisma/migrations/20261028120000_muestras_etapa_3_convocatorias/migration.sql` en la rama `development` (`br-old-rain-adwthzng`) del proyecto `divine-hall-10689679` (Neon MCP `run_sql_transaction`, una sentencia por elemento, sin los comentarios).
2. Verificar:
```sql
select table_name from information_schema.tables
where table_name in ('CulturalCall','CulturalCallSubmission','CulturalCallWork','CulturalCallCurator','CulturalCallScore')
order by table_name;
```
Expected: las cinco.
3. Registrar con el checksum del archivo:

Run: `shasum -a 256 packages/db/prisma/migrations/20261028120000_muestras_etapa_3_convocatorias/migration.sql`
```sql
insert into "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
values (gen_random_uuid()::text, '<sha256 del paso anterior>', now(), '20261028120000_muestras_etapa_3_convocatorias', null, null, now(), 1);
```
4. Confirmar: `select migration_name, checksum from "_prisma_migrations" where migration_name = '20261028120000_muestras_etapa_3_convocatorias';` → una fila con el mismo checksum.

- [ ] **Step 3: Recorrido completo en local contra la base ya migrada**

Con `pnpm --filter muestras dev` y tres cuentas (organizador, participante, curador), repetir los recorridos de las Tasks 9 a 13 de punta a punta, más:
1. Barra del panel: "Mis envíos" en Tu cuenta; Convocatorias y Curaduría abren sus páginas (no "En preparación"); Ventas y Estadísticas siguen en preparación.
2. Encabezado y pie con "Convocatorias".
3. A 375 px: `/convocatorias`, la página de una convocatoria, el formulario de envío, el visor (la imagen arriba, los botones 1–5 debajo) y la selección, sin scroll horizontal.

- [ ] **Step 4: Guía de puesta en marcha**

Agregar al final de `docs/operations/muestras-puesta-en-marcha.md`:
```markdown
## Etapa 3 (convocatorias y curaduría anónima)

1. Aplicar la migración `20261028120000_muestras_etapa_3_convocatorias` y registrarla con su SHA-256 (plan de la etapa 3, Task 14 Step 2). — Controlador, autorizado por Daniel. **Antes** del deploy.
2. Fusionar el PR: Vercel publica `apps/muestras` (y recompila las apps que dependen de `packages/db`).
3. Verificar en producción: `/convocatorias`, `/panel/convocatorias`, `/panel/curaduria`, `/panel/envios`.
4. Correos: siguen apagados hasta que `MUESTRAS_CORREOS_EN_VIVO=true` (y `RESEND_API_KEY`, `MUESTRAS_EMAIL_FROM`). **Sin correos no llegan las invitaciones a curar**: antes de la primera convocatoria real, encenderlos. — Daniel.
5. Primera convocatoria real: probar con una propia y dos cuentas antes de difundirla. — Daniel.
```

- [ ] **Step 5: Commit y PR**

```bash
git add docs/operations/muestras-puesta-en-marcha.md
git commit -m "Guía de puesta en marcha de la Etapa 3 de Muestras"
git push -u origin feat/muestras-etapa-3
gh pr create --title "Muestras Fotográficas — Etapa 3: convocatoria y curaduría anónima" --body "<resumen en español: qué cambia para quien organiza, para quien envía y para quien cura; la migración ya aplicada; checklist del Step 3>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Cobertura del spec

| Spec | Task |
|---|---|
| D1 una convocatoria por muestra, organizador = quien propuso | 1, 4, 7, 9 |
| D2 estados como texto, fases calculadas | 1, 4 |
| D3 abrir sin revisión; volver a borrador (super admin siempre) | 1, 7, 9 |
| D4 cerrar a mano después de la fecha; ENDED no recibe | 1, 7, 11 |
| D5 edición según el estado; el cierre sólo se estira | 1, 7, 9 |
| D6 un envío por persona, reemplazo, retirar, imágenes propias | 4, 11 |
| D7 qué ve el curador (título, año, técnica, texto) | 2, 8, 12 |
| D8 conflictos organizador / curador / participante | 1, 8, 11 |
| D9 invitación de un solo uso, hash, vence, cualquier cuenta | 2, 5, 8 |
| D10 todos los curadores ven todas las obras | 8 |
| D11 códigos anónimos por posición, recongelado | 2, 7 |
| D12 orden propio por curador | 2, 8 |
| D13 puntaje 1–5 + nota, teclado, filtros fijos | 2, 8, 12 |
| D14 imagen por ruta propia, 404, caché privada | 5, 12 |
| D15 sin EXIF | 5 |
| D16 proyección por lista de permitidos + vigilancia | 2, 8 |
| D17 ranking anónimo; identidades en DONE | 2, 13 |
| D18 sacar a un curador quita sus puntajes | 8, 13 |
| D19 topes 40/12, armar una vez, perfil, derechos | 2, 13 |
| D20 correos (recibido, cierre, resultados, invitación), en lote | 6, 7, 8, 11 |
| D21 panel y enlaces | 3, 10 |
| D22 páginas públicas sin palabras de revisión | 10 |
| Migración a mano + checksum, antes del deploy | 4, 14 |
