# Muestras Fotográficas — Etapa 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una muestra presencial tenga **equipo** (coorganización y textos, con un único control de permisos y registro del último cambio), **invitación a la inauguración** con confirmación de asistencia, lista de espera, calendario y CSV, y **piezas para redes** armadas en el servidor (posteo, historia, cuadrado e invitación imprimible).

**Architecture:** Igual que las etapas 1 a 4: las reglas (roles y capacidades, hora de la inauguración, cupo y lista de espera, calendario, CSV, diagramación de las piezas) son funciones puras en `packages/muestras` con vitest; la app es una capa delgada sobre `@repo/db`. Todas las comprobaciones de dueño pasan por `can` (puro) y `rolEnMuestra` / `dondePuede` (app). Las piezas se arman con `sharp`: la foto, una banda de color y capas de texto dibujadas por Pango con un archivo de fuente del repo (`fontfile`), como la marca de agua de FotoRank. Migración escrita a mano: once columnas en `CulturalActivity` y dos tablas nuevas.

**Tech Stack:** Next.js 16.2.1 (App Router, `params` como Promise, `after` de `next/server`, `--webpack`), React 19.2.4, Prisma 6 (`@repo/db`), Tailwind 4, `sharp 0.34.5`, `pdf-lib 1.17.1`, `qrcode ^1.5.4`, `resend ^6.14`, vitest 3. **Sin dependencias nuevas.**

**Spec:** `docs/superpowers/specs/2026-10-10-muestras-etapa-5-design.md` (decisiones D1–D32). Diseño general: `docs/superpowers/specs/2026-10-08-muestras-fotograficas-design.md`. Etapa anterior: `docs/superpowers/plans/2026-10-09-muestras-etapa-4.md`.

## Global Constraints

- Todo texto visible y todo comentario en **español rioplatense con voseo**, claro y sin "próximamente"; identificadores en inglés dentro de `packages/muestras`, en español en la app.
- Estados, roles y modos como **texto** (`String`), nunca enum de Prisma. Ids de usuario `Int` **sin relación Prisma a `User`**. Ids `cuid()`.
- Fechas y horas en **hora argentina (UTC−3)** con las funciones de `dates.ts` (`dayStartAr`, `toArDay`, `formatArDay`, `formatArDayLong`, y las nuevas `arMinutesOfDay`, `formatArClock`, `formatArWeekdayLong`). Nunca `toLocaleDateString`/`toLocaleTimeString` sin zona.
- **Sin dependencias nuevas** ni versiones fuera del lockfile. Después de cualquier `pnpm install`, `git diff pnpm-lock.yaml` tiene que estar vacío; si se mueve, frenar y avisar.
- Chequeos de tipos y build con `NODE_OPTIONS=--max-old-space-size=8192` (si no, el proceso muere por memoria y a veces devuelve éxito igual). Mirar que el build realmente terminó.
- Diseño: tokens de `apps/muestras/app/globals.css` (`--mf-bg`, `--mf-ink`, `--mf-muted`, `--mf-line`, `--mf-surface`, `--mf-teal`, `--mf-spot`, `--mf-alerta`), `.mf-titulo`, líneas finas, botones finos (`h-11 border border-[var(--mf-ink)] px-5`), esquinas `rounded-[2px]`. Nada de cajas de color. Clases repetidas en `components/difusion/estilos.ts` y `components/equipo/estilos.ts` (pueden reexportar `components/montaje/estilos.ts`).
- **Autorización del lado del servidor en cada página, acción y ruta.** Cada `page.tsx` llama `requireUsuario(<su propia ruta>)`; cada server action vuelve a leer la sesión y el rol **en la base** con `rolEnMuestra` o filtra con `dondePuede`. Toda negativa del panel es `notFound()`. **Ninguna comprobación nueva usa `proposedByUserId` directamente**: pasa por `lib/equipo/permisos.ts`.
- **Correo apagado en producción** (`MUESTRAS_CORREOS_EN_VIVO`): toda funcionalidad anda sin correo. La invitación al equipo devuelve el enlace para copiar a quien invita; la confirmación de asistencia muestra el enlace personal en pantalla.
- **Privacidad:** ninguna tabla guarda IP, user-agent ni cookie de quien confirma asistencia. Nombre y email de las confirmaciones sólo los ven dueño, coorganización y super admin; nunca salen en páginas públicas, piezas ni estadísticas. Se borran a los 30 días del cierre (Task 11).
- En páginas públicas **no** aparecen palabras de revisión ni aprobación.
- Puerto de desarrollo **3014**. Probar con `next dev` (las vistas previas de Vercel no sirven).
- Trabajar en el worktree `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-muestras-5`, rama `feat/muestras-etapa-5` (sale de `feat/muestras-etapa-4`, que está en PR). **Antes de la Task 14, rebasar sobre `origin/main`** si la etapa 4 ya se fusionó.
- La migración **no se aplica sola**: la aplica **a mano en producción el controlador**, con la autorización de Daniel, la registra en `_prisma_migrations` con el SHA-256 del archivo, **después** de la de la etapa 4 y **antes** de publicar el código (Task 14). Una columna de `CulturalActivity` sin aplicar rompe **todo** el sitio.

## Mapa de archivos

```
packages/muestras/src/
  dates.ts (+ dates.test.ts)               — arMinutesOfDay, formatArClock, formatArWeekdayLong
  team.ts (+ team.test.ts)                 — roles, capacidades, can, rolesWith, activityRole, invitación, último cambio
  review.ts (+ review.test.ts)             — Actor.role; canEdit, canPerform con capacidades; canEditTexts
  call.ts (+ call.test.ts)                 — canCallAction con can("manageCall")
  opening.ts (+ opening.test.ts)           — hora, rsvpState, entrada, cupo, lista de espera, retención, .ics, Google Calendar, CSV
  social.ts (+ social.test.ts)             — formatos, variantes, disponibilidad, diagramación, textos, nombre de archivo
  panel.ts (+ panel.test.ts)               — sección "Difusión"
  index.ts                                 — reexporta team, opening, social
packages/db/prisma/schema.prisma           — columnas en CulturalActivity; CulturalActivityMember; CulturalActivityRsvp
packages/db/prisma/migrations/20261030120000_muestras_etapa_5_difusion/migration.sql
apps/muestras/
  assets/fonts/{Archivo-Regular.ttf, Archivo-Bold.ttf, OFL.txt}
  next.config.ts                           — outputFileTracingIncludes de las fuentes
  vercel.json                              — cron diario de limpieza
  lib/equipo/permisos.ts (+ .test.ts)      — rolEnMuestra, dondePuede, puedeConDueno, esDelEquipo
  lib/equipo/registro.ts (+ .test.ts)      — datos del último cambio y texto para el panel
  lib/equipo/acciones.ts (+ .test.ts)      — invitar, reenviar, cambiar rol, sacar, aceptar, dejar
  lib/equipo/consultas.ts                  — equipo de una muestra, invitación por token
  lib/correos/equipo.ts, textos-equipo.ts (+ .test.ts)
  lib/correos/inauguracion.ts, textos-inauguracion.ts (+ .test.ts)
  lib/actividades/consultas.ts             — listarMias(usuario), buscarParaEditar, listados con capacidad
  lib/actividades/acciones.ts (+ .test.ts) — rol, editVersion, registro
  lib/actividades/mapear.ts (+ .test.ts)   — hora de inauguración, editVersion
  lib/actividades/textos.ts (+ .test.ts)   — guardarTextos
  lib/{montaje,piezas,fichas,estadisticas,libro,convocatorias,curaduria,seleccion,envios}/… — permisos por capacidad
  lib/inauguracion/consultas.ts, acciones.ts (+ .test.ts), publicas.ts (+ .test.ts), limpieza.ts (+ .test.ts)
  lib/limite.ts (+ .test.ts)               — frenos nuevos
  lib/redes/fuentes.ts, texto.ts (+ .test.ts), qr.ts (+ .test.ts), componer.ts (+ .test.ts), pdf.ts (+ .test.ts), cargar.ts
  lib/panel/en-preparacion.test.ts         — sin cambios de contenido (la sección nueva nace lista)
  app/api/redes/[id]/route.ts (+ lib/redes/ruta.test.ts)
  app/api/inauguracion/[id]/csv/route.ts (+ lib/inauguracion/csv-ruta.test.ts)
  app/api/cron/asistencias/route.ts (+ lib/inauguracion/cron-ruta.test.ts)
  app/m/[slug]/page.tsx                    — hora de la inauguración y "Confirmá tu asistencia"
  app/m/[slug]/inauguracion/page.tsx, evento.ics/route.ts, r/[token]/page.tsx
  app/panel/layout.tsx                     — barrido perezoso con after()
  app/panel/page.tsx, app/panel/muestras/page.tsx, app/panel/muestras/[id]/page.tsx
  app/panel/muestras/[id]/equipo/page.tsx, app/panel/equipo/invitacion/[token]/page.tsx
  app/panel/difusion/page.tsx, [id]/page.tsx, [id]/inauguracion/page.tsx
  app/privacidad/page.tsx
  components/equipo/{equipo-muestra.tsx, aceptar-invitacion-equipo.tsx, estilos.ts}
  components/formulario/{formulario-actividad.tsx, formulario-textos.tsx}
  components/inauguracion/{formulario-asistencia.tsx, mi-asistencia.tsx, configurar-inauguracion.tsx, lista-asistencia.tsx}
  components/difusion/{piezas-redes.tsx, estilos.ts}
docs/operations/muestras-puesta-en-marcha.md — sección "Etapa 5"
```

Orden: 1 → 2 → 3 → 4 (schema) → 5 → … → 14. Las Tasks 1–3 son independientes entre sí; desde la Task 5 todo usa el cliente Prisma con los campos y modelos nuevos (Task 4). Las Tasks 7–13 dependen de la 5 (permisos); entre ellas, 9 → 10 → 11 van en orden (inauguración) y 12 → 13 (piezas). Los tests de la app mockean `@repo/db`, `@/lib/usuario`, `next/cache`, `next/headers` y R2 con el mismo patrón que `lib/montaje/acciones.test.ts` y `lib/piezas/ruta.test.ts`.

---

### Task 1: Reglas del equipo y permisos únicos

**Files:**
- Create: `packages/muestras/src/team.ts`, `packages/muestras/src/team.test.ts`
- Modify: `packages/muestras/src/dates.ts` (+ `dates.test.ts`), `packages/muestras/src/review.ts` (+ `review.test.ts`), `packages/muestras/src/call.ts` (+ `call.test.ts`), `packages/muestras/src/index.ts`

**Interfaces:**
- Consumes: `formatArDay` (`dates.ts`), `normalizeEmail` (`curation.ts`).
- Produces:
  - `dates.ts`: `arMinutesOfDay(d)`, `formatArClock(d)` ("18:40"), `formatArWeekdayLong(d)` ("viernes 14 de noviembre").
  - `team.ts`: `TEAM_ROLES`, `TeamRole`, `isTeamRole`, `ActivityRole`, `ACTIVITY_ROLE_LABELS`, `TEAM_ROLE_DESCRIPTIONS`; `CAPABILITIES`, `Capability`, `ROLE_CAPABILITIES`, `Who`, `can(cap, who)`, `rolesWith(cap)`; `MemberRow`, `activityRole(a, userId)`; `MEMBER_STATUSES`, `MemberStatus`, `MEMBER_STATUS_LABELS`; `MAX_TEAM_MEMBERS = 10`, `TEAM_INVITATION_TTL_DAYS = 30`; `teamInviteProblems(p)`; `EDIT_PARTS`, `EditPart`, `EDIT_PART_LABELS`, `lastEditText(p)`.
  - `review.ts`: `Actor = { userId; isSuperAdmin; role?: ActivityRole | null }`; `canPerform`, `canEdit` con capacidades; `canEditTexts(a, actor)`.
  - `call.ts`: `canCallAction` usa `can("manageCall", …)` (mismo comportamiento).

- [ ] **Step 1: Escribir los tests que fallan**

`packages/muestras/src/team.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  CAPABILITIES, activityRole, can, lastEditText, rolesWith, teamInviteProblems, type ActivityRole, type Capability,
} from "./team";

const como = (role: ActivityRole | null, isSuperAdmin = false) => ({ role, isSuperAdmin });

describe("capacidades por rol", () => {
  it("el dueño y el super admin pueden todo", () => {
    for (const c of CAPABILITIES) {
      expect(can(c, como("OWNER")), c).toBe(true);
      expect(can(c, como(null, true)), c).toBe(true);
    }
  });
  it("coorganización: todo menos cancelar, el equipo y la convocatoria", () => {
    const no: Capability[] = ["cancel", "manageTeam", "manageCall"];
    for (const c of CAPABILITIES) expect(can(c, como("CO_ORGANIZER")), c).toBe(!no.includes(c));
  });
  it("textos: sólo entrar y editar textos", () => {
    for (const c of CAPABILITIES) expect(can(c, como("TEXT_EDITOR")), c).toBe(c === "view" || c === "editTexts");
  });
  it("sin rol, nada", () => {
    for (const c of CAPABILITIES) expect(can(c, como(null)), c).toBe(false);
  });
  it("qué roles tienen cada capacidad", () => {
    expect(rolesWith("editTexts")).toEqual(["OWNER", "CO_ORGANIZER", "TEXT_EDITOR"]);
    expect(rolesWith("rsvp")).toEqual(["OWNER", "CO_ORGANIZER"]);
    expect(rolesWith("manageCall")).toEqual(["OWNER"]);
  });
});

describe("rol de una persona en una muestra", () => {
  const a = {
    proposedByUserId: 1,
    members: [
      { userId: 2, role: "CO_ORGANIZER", status: "ACTIVE" },
      { userId: 3, role: "TEXT_EDITOR", status: "REVOKED" },
      { userId: null, role: "TEXT_EDITOR", status: "INVITED" },
      { userId: 4, role: "ALGO_RARO", status: "ACTIVE" },
    ],
  };
  it("dueño, integrante activo, revocado, desconocido", () => {
    expect(activityRole(a, 1)).toBe("OWNER");
    expect(activityRole(a, 2)).toBe("CO_ORGANIZER");
    expect(activityRole(a, 3)).toBeNull();
    expect(activityRole(a, 4)).toBeNull();
    expect(activityRole(a, 9)).toBeNull();
    expect(activityRole({ proposedByUserId: 1 }, 2)).toBeNull();
  });
});

describe("invitar al equipo", () => {
  const base = { email: "ana@ejemplo.com", role: "CO_ORGANIZER", ownerEmail: "dueno@ejemplo.com", occupied: 0, existing: null };
  it("todo bien", () => expect(teamInviteProblems(base)).toEqual([]));
  it("email inválido o rol desconocido", () => {
    expect(teamInviteProblems({ ...base, email: null })).toEqual(["Escribí un email válido."]);
    expect(teamInviteProblems({ ...base, role: "OWNER" })).toEqual(["Elegí un rol."]);
  });
  it("no se invita al dueño, ni a quien ya está, ni pasando el tope", () => {
    expect(teamInviteProblems({ ...base, email: "DUENO@ejemplo.com".toLowerCase() })).toEqual(["Ya sos responsable de esta muestra."]);
    expect(teamInviteProblems({ ...base, existing: { status: "ACTIVE" } })).toEqual(["Esa persona ya es parte del equipo. Si querés, cambiale el rol."]);
    expect(teamInviteProblems({ ...base, occupied: 10 })).toEqual(["El equipo de una muestra puede tener hasta 10 personas."]);
    // Reenviar a alguien ya invitado no ocupa un lugar más.
    expect(teamInviteProblems({ ...base, occupied: 10, existing: { status: "INVITED" } })).toEqual([]);
  });
});

describe("último cambio", () => {
  it("quién, en qué parte y cuándo, en hora argentina", () => {
    expect(lastEditText({ who: "Ana Pérez", part: "TEXTOS", at: new Date("2026-11-14T21:40:00Z") }))
      .toBe("Último cambio: Ana Pérez, en los textos, el 14 nov a las 18:40.");
  });
  it("sin datos, nada; parte desconocida, sin parte", () => {
    expect(lastEditText({ who: null, part: null, at: null })).toBeNull();
    expect(lastEditText({ who: "Ana", part: "OTRA", at: new Date("2026-11-14T21:40:00Z") })).toBe("Último cambio: Ana, el 14 nov a las 18:40.");
  });
});
```
(El formato exacto de `formatArDay` es el de `Intl` con `es-AR` y mes corto: verificar con `dates.test.ts` existente; si devuelve "14 nov.", ajustar el texto esperado.)

Sumar a `packages/muestras/src/dates.test.ts`:
```ts
describe("horas argentinas", () => {
  it("minutos del día, reloj y día de la semana", () => {
    const d = new Date("2026-11-14T22:30:00Z"); // 19:30 en Argentina, sábado
    expect(arMinutesOfDay(d)).toBe(19 * 60 + 30);
    expect(formatArClock(d)).toBe("19:30");
    expect(formatArWeekdayLong(d)).toBe("sábado 14 de noviembre");
    expect(arMinutesOfDay(dayStartAr("2026-11-14"))).toBe(0);
  });
});
```

Sumar a `packages/muestras/src/review.test.ts`:
```ts
describe("roles del equipo", () => {
  const a = { reviewStatus: "APPROVED" as const, proposedByUserId: 1, workspaceId: null, isCancelled: false };
  it("coorganización edita y envía, no cancela", () => {
    const co = { userId: 2, isSuperAdmin: false, role: "CO_ORGANIZER" as const };
    expect(canEdit(a, co)).toBe(true);
    expect(canPerform("cancel", a, co).ok).toBe(false);
    expect(canPerform("submit", { ...a, reviewStatus: "DRAFT" }, co).ok).toBe(true);
  });
  it("textos: edita textos, no la ficha", () => {
    const t = { userId: 3, isSuperAdmin: false, role: "TEXT_EDITOR" as const };
    expect(canEdit(a, t)).toBe(false);
    expect(canEditTexts(a, t)).toBe(true);
    expect(canEditTexts({ ...a, reviewStatus: "IN_REVIEW" }, t)).toBe(false);
  });
  it("sin `role`, se deduce del dueño (compatibilidad)", () => {
    expect(canEdit(a, { userId: 1, isSuperAdmin: false })).toBe(true);
    expect(canEdit(a, { userId: 2, isSuperAdmin: false })).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter @repo/muestras test -- team dates review`
Expected: FAIL (`team.ts` no existe; `arMinutesOfDay`, `canEditTexts` no exportados).

- [ ] **Step 3: Implementar**

`packages/muestras/src/dates.ts` (al final):
```ts
/** Minutos desde la medianoche argentina (0 = 00:00). */
export function arMinutesOfDay(d: Date): number {
  const local = new Date(d.getTime() - OFFSET_MS);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

const dos = (n: number) => String(n).padStart(2, "0");

/** "18:40" en hora argentina. */
export function formatArClock(d: Date): string {
  const m = arMinutesOfDay(d);
  return `${dos(Math.floor(m / 60))}:${dos(m % 60)}`;
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;

/** "sábado 14 de noviembre", en hora argentina (sin año: para invitaciones). */
export function formatArWeekdayLong(d: Date): string {
  const p = partesAr(d);
  const dia = DIAS[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()]!;
  return `${dia} ${p.d} de ${MESES[p.m - 1]}`;
}
```

`packages/muestras/src/team.ts`:
```ts
import { formatArClock, formatArDay } from "./dates";

/**
 * Equipo de una muestra (etapa 5). El dueño es quien la propuso (`proposedByUserId`) y no se
 * guarda en la tabla del equipo. Todos los permisos sobre una muestra pasan por `can`: no hay
 * otra comparación con el dueño en el código (spec D2).
 */
export const TEAM_ROLES = ["CO_ORGANIZER", "TEXT_EDITOR"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];
export const isTeamRole = (v: unknown): v is TeamRole => (TEAM_ROLES as readonly unknown[]).includes(v);
export type ActivityRole = "OWNER" | TeamRole;

export const ACTIVITY_ROLE_LABELS: Record<ActivityRole, string> = {
  OWNER: "Responsable",
  CO_ORGANIZER: "Coorganización",
  TEXT_EDITOR: "Textos y curaduría",
};
export const TEAM_ROLE_DESCRIPTIONS: Record<TeamRole, string> = {
  CO_ORGANIZER: "Edita la muestra, las obras, el montaje, las piezas y la inauguración; modera el libro de visitas y ve las estadísticas. No cancela la muestra ni maneja el equipo.",
  TEXT_EDITOR: "Edita el texto curatorial, los créditos y los textos de cada obra (título, año y técnica).",
};

export const CAPABILITIES = [
  "view", "editActivity", "editTexts", "submitForReview", "cancel", "hanging", "pieces",
  "promote", "rsvp", "stats", "guestbook", "manageTeam", "manageCall",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const ROLE_CAPABILITIES: Record<ActivityRole, readonly Capability[]> = {
  OWNER: CAPABILITIES,
  CO_ORGANIZER: ["view", "editActivity", "editTexts", "submitForReview", "hanging", "pieces", "promote", "rsvp", "stats", "guestbook"],
  TEXT_EDITOR: ["view", "editTexts"],
};

export type Who = { role: ActivityRole | null; isSuperAdmin: boolean };

export function can(cap: Capability, who: Who): boolean {
  if (who.isSuperAdmin) return true;
  return who.role != null && ROLE_CAPABILITIES[who.role].includes(cap);
}

const ORDEN: readonly ActivityRole[] = ["OWNER", "CO_ORGANIZER", "TEXT_EDITOR"];
export function rolesWith(cap: Capability): ActivityRole[] {
  return ORDEN.filter((r) => ROLE_CAPABILITIES[r].includes(cap));
}

export type MemberRow = { userId: number | null; role: string; status: string };

export function activityRole(a: { proposedByUserId: number; members?: readonly MemberRow[] }, userId: number): ActivityRole | null {
  if (a.proposedByUserId === userId) return "OWNER";
  const m = a.members?.find((x) => x.userId === userId && x.status === "ACTIVE" && isTeamRole(x.role));
  return m ? (m.role as TeamRole) : null;
}

export const MEMBER_STATUSES = ["INVITED", "ACTIVE", "REVOKED"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];
export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  INVITED: "Invitación pendiente",
  ACTIVE: "En el equipo",
  REVOKED: "Fuera del equipo",
};
export const MAX_TEAM_MEMBERS = 10;
export const TEAM_INVITATION_TTL_DAYS = 30;

/** `email` ya normalizado (o null si no es válido); `occupied`: invitadas + activas. */
export function teamInviteProblems(p: {
  email: string | null; role: unknown; ownerEmail: string | null; occupied: number; existing: { status: string } | null;
}): string[] {
  if (!p.email) return ["Escribí un email válido."];
  if (!isTeamRole(p.role)) return ["Elegí un rol."];
  if (p.ownerEmail && p.email === p.ownerEmail.trim().toLowerCase()) return ["Ya sos responsable de esta muestra."];
  if (p.existing?.status === "ACTIVE") return ["Esa persona ya es parte del equipo. Si querés, cambiale el rol."];
  const ocupaLugar = !p.existing || p.existing.status === "REVOKED";
  if (ocupaLugar && p.occupied >= MAX_TEAM_MEMBERS) return [`El equipo de una muestra puede tener hasta ${MAX_TEAM_MEMBERS} personas.`];
  return [];
}

export const EDIT_PARTS = ["FICHA", "TEXTOS", "MONTAJE", "INAUGURACION"] as const;
export type EditPart = (typeof EDIT_PARTS)[number];
export const EDIT_PART_LABELS: Record<EditPart, string> = {
  FICHA: "la ficha", TEXTOS: "los textos", MONTAJE: "el plano de montaje", INAUGURACION: "la inauguración",
};

export function lastEditText(p: { who: string | null; part: string | null; at: Date | null }): string | null {
  if (!p.who || !p.at) return null;
  const parte = (EDIT_PARTS as readonly string[]).includes(p.part ?? "") ? `, en ${EDIT_PART_LABELS[p.part as EditPart]}` : "";
  return `Último cambio: ${p.who}${parte}, el ${formatArDay(p.at)} a las ${formatArClock(p.at)}.`;
}
```

`packages/muestras/src/review.ts` (cambios):
```ts
import { can, type ActivityRole, type Capability } from "./team";

export type Actor = { userId: number; isSuperAdmin: boolean; role?: ActivityRole | null };

/** Sin `role` (código viejo y tests), se deduce: dueño o nada. */
function puede(cap: Capability, a: ActivityForReview, actor: Actor): boolean {
  const role = actor.role !== undefined ? actor.role : a.proposedByUserId === actor.userId ? "OWNER" : null;
  return can(cap, { role, isSuperAdmin: actor.isSuperAdmin });
}
```
- `submit`: `puede("submitForReview", a, actor)`; `cancel`/`uncancel`: `puede("cancel", a, actor)`; approve/reject/unpublish/republish siguen con `isReviewer`.
- `canEdit`: `if (isReviewer(a, actor)) return true; if (!puede("editActivity", a, actor)) return false;` y el mismo chequeo de estado.
- Nueva:
```ts
/** Textos (etapa 5, D9): mismos estados que la ficha, con la capacidad `editTexts`. */
export function canEditTexts(a: ActivityForReview, actor: Actor): boolean {
  if (isReviewer(a, actor)) return true;
  if (!puede("editTexts", a, actor)) return false;
  return a.reviewStatus === "DRAFT" || a.reviewStatus === "REJECTED" || a.reviewStatus === "APPROVED";
}
```
- Borrar `isOwner` (ya no se usa).

`packages/muestras/src/call.ts` (`canCallAction`):
```ts
  // Etapa 5 (D4): la convocatoria sigue siendo sólo del dueño, pero pasa por la regla única.
  const role = c.ownerUserId === actor.userId ? "OWNER" : null;
  if (!can("manageCall", { role, isSuperAdmin: actor.isSuperAdmin })) return { ok: false, reason: "Sólo quien organiza la muestra puede hacer esto." };
```
y en `unpublish` reemplazar `esDueno` si se usaba. `index.ts`: `export * from "./team";`.

- [ ] **Step 4: Correr y ver que pasan**

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter @repo/muestras lint`
Expected: todo en verde, incluidos los tests viejos de `review.test.ts` y `call.test.ts` sin tocar.

- [ ] **Step 5: Commit**

```bash
git add packages/muestras/src
git commit -m "Muestras: roles del equipo y una sola regla de permisos (can) para ficha, revisión y convocatoria"
```

**Acceptance:** la tabla de capacidades del spec está en `ROLE_CAPABILITIES` y la cubren los tests; `review.ts` y `call.ts` no comparan más con el dueño por su cuenta; tests viejos en verde.

---

### Task 2: Reglas de la inauguración y de la asistencia

**Files:**
- Create: `packages/muestras/src/opening.ts`, `packages/muestras/src/opening.test.ts`
- Modify: `packages/muestras/src/index.ts`

**Interfaces:**
- Consumes: `dayStartAr`, `arMinutesOfDay`, `formatArClock`, `formatArWeekdayLong`, `toArDay` (`dates.ts`); `normalizeEmail` (`curation.ts`); `hasLinkOrEmail` (`guestbook.ts`).
- Produces: `RSVP_MODES`, `RsvpMode`, `isRsvpMode`, `RSVP_MODE_LABELS`; `RSVP_ENTRY_STATUSES`, `RsvpEntryStatus`, `RSVP_ENTRY_STATUS_LABELS`; `RSVP_LIMITS`, `RSVP_RAW_MAX`, `RSVP_RETENTION_DAYS = 30`, `OPENING_DEFAULT_MINUTES = 120`; `parseClock`, `openingAtFrom`, `openingHasTime`, `openingEnd`, `formatArTime`, `openingWhenText`, `openingProblems`; `RsvpState`, `rsvpState`; `RsvpInput`, `rsvpInput`, `rsvpProblems`; `partySize`, `rsvpPlacement`, `promoteFromWaitlist`, `RsvpTotals`, `rsvpTotals`; `rsvpPurgeDue`; `OpeningEvent`, `openingIcs`, `googleCalendarUrl`; `RsvpCsvRow`, `rsvpCsv`.

- [ ] **Step 1: Escribir los tests que fallan**

`packages/muestras/src/opening.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { dayEndAr, dayStartAr } from "./dates";
import {
  googleCalendarUrl, openingAtFrom, openingEnd, openingHasTime, openingIcs, openingProblems, openingWhenText,
  promoteFromWaitlist, rsvpCsv, rsvpInput, rsvpPlacement, rsvpProblems, rsvpPurgeDue, rsvpState, rsvpTotals,
} from "./opening";

const a19 = openingAtFrom("2026-11-14", "19:00")!; // sábado, 22:00 UTC

describe("hora de la inauguración", () => {
  it("día y hora en hora argentina", () => {
    expect(a19.toISOString()).toBe("2026-11-14T22:00:00.000Z");
    expect(openingHasTime(a19)).toBe(true);
  });
  it("sin hora (o 00:00, las filas viejas) queda en el día", () => {
    expect(openingAtFrom("2026-11-14", null)!.getTime()).toBe(dayStartAr("2026-11-14").getTime());
    expect(openingHasTime(openingAtFrom("2026-11-14", "00:00"))).toBe(false);
    expect(openingHasTime(null)).toBe(false);
    expect(openingAtFrom("2026-13-01", "19:00")).toBeNull();
  });
  it("fin por defecto, 2 horas", () => {
    expect(openingEnd(a19, null).toISOString()).toBe("2026-11-15T00:00:00.000Z");
    expect(openingEnd(a19, openingAtFrom("2026-11-14", "21:30")).toISOString()).toBe("2026-11-15T00:30:00.000Z");
    expect(openingEnd(a19, openingAtFrom("2026-11-14", "18:00")).toISOString()).toBe("2026-11-15T00:00:00.000Z");
  });
  it("texto para la invitación", () => {
    expect(openingWhenText(a19, null)).toBe("Sábado 14 de noviembre, 19 h");
    expect(openingWhenText(a19, openingAtFrom("2026-11-14", "21:30"))).toBe("Sábado 14 de noviembre, de 19 a 21:30 h");
    expect(openingWhenText(dayStartAr("2026-11-14"), null)).toBe("Sábado 14 de noviembre");
  });
  it("problemas del formulario", () => {
    const ok = { openingDay: "2026-11-14", openingClock: "19:00", openingEndClock: "", endDay: "2026-12-01" };
    expect(openingProblems(ok)).toEqual([]);
    expect(openingProblems({ ...ok, openingClock: "25:00" })).toEqual(["La hora de la inauguración no es válida (usá 19:30, por ejemplo)."]);
    expect(openingProblems({ ...ok, openingClock: "00:00" })).toEqual(["La inauguración no puede ser a las 00:00. Si no sabés la hora, dejala vacía."]);
    expect(openingProblems({ ...ok, openingDay: "2026-12-02" })).toEqual(["La inauguración no puede ser después del cierre de la muestra."]);
    expect(openingProblems({ ...ok, openingEndClock: "18:00" })).toEqual(["La hora de fin tiene que ser después de la de inicio."]);
    expect(openingProblems({ ...ok, openingDay: "", openingClock: "19:00" })).toEqual(["Para poner la hora, elegí también el día de la inauguración."]);
  });
});

describe("cuándo se puede confirmar", () => {
  const m = {
    type: "MUESTRA", reviewStatus: "APPROVED", isVirtualOnly: false, isCancelled: false, openingAt: a19, rsvpStatus: "OPEN",
  };
  const antes = new Date("2026-11-14T21:59:00Z");
  it("abierta hasta que empieza", () => {
    expect(rsvpState(m, antes)).toBe("OPEN");
    expect(rsvpState(m, a19)).toBe("CLOSED");
  });
  it("cerrada a mano, cancelada o apagada", () => {
    expect(rsvpState({ ...m, rsvpStatus: "CLOSED" }, antes)).toBe("CLOSED");
    expect(rsvpState({ ...m, isCancelled: true }, antes)).toBe("CLOSED");
    expect(rsvpState({ ...m, rsvpStatus: "OFF" }, antes)).toBe("OFF");
  });
  it("sin página: no es muestra, no publicada, virtual o sin hora", () => {
    for (const x of [{ type: "CHARLA" }, { reviewStatus: "DRAFT" }, { isVirtualOnly: true }, { openingAt: dayStartAr("2026-11-14") }, { openingAt: null }]) {
      expect(rsvpState({ ...m, ...x }, antes), JSON.stringify(x)).toBe("UNAVAILABLE");
    }
  });
});

describe("formulario Voy", () => {
  it("limpia y normaliza", () => {
    expect(rsvpInput({ name: "  Ana   Pérez ", email: " ANA@Ejemplo.com ", companions: "2" }))
      .toEqual({ name: "Ana Pérez", email: "ana@ejemplo.com", companions: 2, emailInvalid: false });
    expect(rsvpInput({ name: "Ana", email: "", companions: "" })).toEqual({ name: "Ana", email: null, companions: 0, emailInvalid: false });
    expect(rsvpInput({ name: "Ana", email: "no-es-mail", companions: "1" }).emailInvalid).toBe(true);
  });
  it("problemas", () => {
    const ok = { name: "Ana", email: null, companions: 1, emailInvalid: false };
    expect(rsvpProblems(ok, 3)).toEqual([]);
    expect(rsvpProblems({ ...ok, name: "A" }, 3)).toEqual(["Escribí tu nombre."]);
    expect(rsvpProblems({ ...ok, name: "Ana www.spam.com" }, 3)).toEqual(["El nombre no puede tener enlaces ni direcciones de correo."]);
    expect(rsvpProblems({ ...ok, emailInvalid: true }, 3)).toEqual(["El email no es válido. Si no querés dejarlo, dejá el campo vacío."]);
    expect(rsvpProblems({ ...ok, companions: 4 }, 3)).toEqual(["Podés sumar hasta 3 acompañantes."]);
    expect(rsvpProblems({ ...ok, companions: 1 }, 0)).toEqual(["Esta invitación es personal: no admite acompañantes."]);
    expect(rsvpProblems({ ...ok, companions: Number.NaN }, 3)).toEqual(["Podés sumar hasta 3 acompañantes."]);
  });
});

describe("cupo y lista de espera", () => {
  it("sin cupo, siempre confirmada", () => {
    expect(rsvpPlacement({ capacity: null, confirmedPeople: 999, party: 3 })).toBe("CONFIRMED");
  });
  it("con cupo: entra justo, no entra → espera", () => {
    expect(rsvpPlacement({ capacity: 10, confirmedPeople: 8, party: 2 })).toBe("CONFIRMED");
    expect(rsvpPlacement({ capacity: 10, confirmedPeople: 9, party: 2 })).toBe("WAITLIST");
  });
  it("se libera lugar: en orden, saltando a quien no entra", () => {
    const espera = [{ id: "g4", companions: 3 }, { id: "s1", companions: 0 }, { id: "p2", companions: 1 }];
    expect(promoteFromWaitlist({ capacity: 10, confirmedPeople: 7, waitlist: espera })).toEqual(["s1", "p2"]);
    expect(promoteFromWaitlist({ capacity: 10, confirmedPeople: 6, waitlist: espera })).toEqual(["g4"]);
    expect(promoteFromWaitlist({ capacity: null, confirmedPeople: 6, waitlist: espera })).toEqual(["g4", "s1", "p2"]);
    expect(promoteFromWaitlist({ capacity: 10, confirmedPeople: 12, waitlist: espera })).toEqual([]);
  });
  it("totales", () => {
    expect(rsvpTotals([
      { status: "CONFIRMED", companions: 2 }, { status: "CONFIRMED", companions: 0 },
      { status: "WAITLIST", companions: 1 }, { status: "CANCELLED", companions: 5 },
    ])).toEqual({ confirmed: 2, people: 4, waitlist: 1, waitlistPeople: 2, cancelled: 1 });
  });
});

describe("retención", () => {
  it("se borra a los 30 días del cierre", () => {
    const fin = dayEndAr("2026-11-30");
    expect(rsvpPurgeDue(fin, new Date("2026-12-30T02:00:00Z"))).toBe(false);
    expect(rsvpPurgeDue(fin, new Date("2026-12-31T03:00:00Z"))).toBe(true);
  });
});

describe("calendario", () => {
  const e = {
    id: "ck1", title: "Rosario, en blanco; y negro", openingAt: a19, openingEndsAt: null,
    venue: "Centro Cultural Parque España, Sarmiento y el río, Rosario", note: "Habrá un brindis.",
    url: "https://muestrasfotograficas.com/m/rosario/inauguracion", stamp: new Date("2026-11-01T12:00:00Z"),
  };
  it(".ics con UID estable, horas UTC, escapes y CRLF", () => {
    const ics = openingIcs(e);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics).toContain("UID:inauguracion-ck1@muestrasfotograficas.com\r\n");
    expect(ics).toContain("DTSTART:20261114T220000Z\r\n");
    expect(ics).toContain("DTEND:20261115T000000Z\r\n");
    expect(ics).toContain("DTSTAMP:20261101T120000Z\r\n");
    expect(ics).toContain("SUMMARY:Inauguración: Rosario\\, en blanco\\; y negro\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    // Ninguna línea pasa de 75 octetos (las largas se pliegan con CRLF + espacio).
    for (const l of ics.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });
  it("enlace a Google Calendar", () => {
    const u = new URL(googleCalendarUrl(e));
    expect(u.origin + u.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(u.searchParams.get("action")).toBe("TEMPLATE");
    expect(u.searchParams.get("dates")).toBe("20261114T220000Z/20261115T000000Z");
    expect(u.searchParams.get("text")).toBe("Inauguración: Rosario, en blanco; y negro");
  });
});

describe("CSV", () => {
  it("con BOM, punto y coma, comillas y sin fórmulas", () => {
    const csv = rsvpCsv([
      { name: "Ana; Pérez", email: "ana@ejemplo.com", companions: 2, status: "CONFIRMED", createdAt: new Date("2026-11-10T21:40:00Z") },
      { name: "=HYPERLINK(\"x\")", email: null, companions: 0, status: "WAITLIST", createdAt: new Date("2026-11-10T22:00:00Z") },
    ]);
    const filas = csv.slice(1).split("\r\n");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(filas[0]).toBe("Nombre;Email;Acompañantes;Personas;Estado;Confirmó el");
    expect(filas[1]).toBe("\"Ana; Pérez\";ana@ejemplo.com;2;3;Confirmada;10/11/2026 18:40");
    expect(filas[2]).toBe("\"'=HYPERLINK(\"\"x\"\")\";;0;1;En lista de espera;10/11/2026 19:00");
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter @repo/muestras test -- opening`
Expected: FAIL (`opening.ts` no existe).

- [ ] **Step 3: Implementar `packages/muestras/src/opening.ts`**

```ts
import { normalizeEmail } from "./curation";
import { arMinutesOfDay, dayStartAr, formatArClock, formatArWeekdayLong, toArDay } from "./dates";
import { hasLinkOrEmail } from "./guestbook";

/**
 * Inauguración y confirmación de asistencia (etapa 5, D12–D21). `openingAt` guarda día y hora en
 * UTC; una inauguración a las 00:00 argentinas es "sin hora" (filas de antes de esta etapa).
 */
export const RSVP_MODES = ["OFF", "OPEN", "CLOSED"] as const;
export type RsvpMode = (typeof RSVP_MODES)[number];
export const isRsvpMode = (v: unknown): v is RsvpMode => (RSVP_MODES as readonly unknown[]).includes(v);
export const RSVP_MODE_LABELS: Record<RsvpMode, string> = {
  OFF: "Entrada libre, sin confirmación",
  OPEN: "Recibe confirmaciones",
  CLOSED: "Confirmaciones cerradas",
};
export const RSVP_ENTRY_STATUSES = ["CONFIRMED", "WAITLIST", "CANCELLED"] as const;
export type RsvpEntryStatus = (typeof RSVP_ENTRY_STATUSES)[number];
export const RSVP_ENTRY_STATUS_LABELS: Record<RsvpEntryStatus, string> = {
  CONFIRMED: "Confirmada", WAITLIST: "En lista de espera", CANCELLED: "Cancelada",
};
export const RSVP_LIMITS = { name: 80, note: 300, maxCompanions: 9, capacity: 5000, entries: 2000 } as const;
/** Antes de limpiar nada: un campo más largo que esto ni se procesa. */
export const RSVP_RAW_MAX = 1000;
export const RSVP_RETENTION_DAYS = 30;
export const OPENING_DEFAULT_MINUTES = 120;
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/** "19:30" → 1170. Cualquier otra cosa → null. */
export function parseClock(s: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  return h <= 23 && mi <= 59 ? h * 60 + mi : null;
}

/** Día + hora argentina. Sin hora válida (o 00:00), el comienzo del día. Día inválido → null. */
export function openingAtFrom(day: string, clock: string | null): Date | null {
  let base: Date;
  try { base = dayStartAr(day); } catch { return null; }
  const m = parseClock(clock);
  return m ? new Date(base.getTime() + m * MIN) : base;
}

export function openingHasTime(d: Date | null | undefined): d is Date {
  return !!d && arMinutesOfDay(d) !== 0;
}

export function openingEnd(openingAt: Date, openingEndsAt: Date | null | undefined): Date {
  return openingEndsAt && openingEndsAt.getTime() > openingAt.getTime()
    ? openingEndsAt
    : new Date(openingAt.getTime() + OPENING_DEFAULT_MINUTES * MIN);
}

/** "19 h", "19:30 h". */
export function formatArTime(d: Date): string {
  const m = arMinutesOfDay(d);
  return m % 60 === 0 ? `${Math.floor(m / 60)} h` : `${formatArClock(d).replace(/^0/, "")} h`;
}

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function openingWhenText(openingAt: Date, openingEndsAt: Date | null | undefined): string {
  const dia = mayuscula(formatArWeekdayLong(openingAt));
  if (!openingHasTime(openingAt)) return dia;
  const fin = openingEndsAt && openingEndsAt.getTime() > openingAt.getTime() && toArDay(openingEndsAt) === toArDay(openingAt) ? openingEndsAt : null;
  if (!fin) return `${dia}, ${formatArTime(openingAt)}`;
  return `${dia}, de ${formatArTime(openingAt).replace(/ h$/, "")} a ${formatArTime(fin)}`;
}

/** Para el formulario de la ficha: día y horas como vienen del navegador. */
export function openingProblems(f: { openingDay: string | null; openingClock: string | null; openingEndClock: string | null; endDay: string }): string[] {
  const dia = (f.openingDay ?? "").trim(), hora = (f.openingClock ?? "").trim(), fin = (f.openingEndClock ?? "").trim();
  if (!dia) return hora || fin ? ["Para poner la hora, elegí también el día de la inauguración."] : [];
  if (hora && parseClock(hora) === null) return ["La hora de la inauguración no es válida (usá 19:30, por ejemplo)."];
  if (hora && parseClock(hora) === 0) return ["La inauguración no puede ser a las 00:00. Si no sabés la hora, dejala vacía."];
  if (fin && (parseClock(fin) === null || !hora || parseClock(fin)! <= parseClock(hora)!)) return ["La hora de fin tiene que ser después de la de inicio."];
  if (/^\d{4}-\d{2}-\d{2}$/.test(f.endDay) && dia > f.endDay) return ["La inauguración no puede ser después del cierre de la muestra."];
  return [];
}

export type RsvpState = "UNAVAILABLE" | "OFF" | "OPEN" | "CLOSED";

export function rsvpState(
  a: { type: string; reviewStatus: string; isVirtualOnly: boolean; isCancelled: boolean; openingAt: Date | null; rsvpStatus: string },
  now: Date,
): RsvpState {
  if (a.type !== "MUESTRA" || a.reviewStatus !== "APPROVED" || a.isVirtualOnly || !openingHasTime(a.openingAt)) return "UNAVAILABLE";
  if (a.rsvpStatus === "OFF") return "OFF";
  if (a.isCancelled || a.rsvpStatus !== "OPEN" || now.getTime() >= a.openingAt.getTime()) return "CLOSED";
  return "OPEN";
}

export type RsvpInput = { name: string; email: string | null; companions: number; emailInvalid: boolean };

const limpiar = (v: unknown, max: number) =>
  typeof v === "string" ? v.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

export function rsvpInput(raw: { name?: unknown; email?: unknown; companions?: unknown }): RsvpInput {
  const email = limpiar(raw.email, 254);
  const normal = email ? normalizeEmail(email) : null;
  const c = limpiar(raw.companions, 3);
  return {
    name: limpiar(raw.name, RSVP_LIMITS.name),
    email: normal,
    companions: c === "" ? 0 : /^\d+$/.test(c) ? Number(c) : Number.NaN,
    emailInvalid: !!email && !normal,
  };
}

export function rsvpProblems(i: RsvpInput, maxCompanions: number): string[] {
  const out: string[] = [];
  if (i.name.length < 2) out.push("Escribí tu nombre.");
  else if (hasLinkOrEmail(i.name)) out.push("El nombre no puede tener enlaces ni direcciones de correo.");
  if (i.emailInvalid) out.push("El email no es válido. Si no querés dejarlo, dejá el campo vacío.");
  if (!Number.isInteger(i.companions) || i.companions < 0 || i.companions > maxCompanions) {
    out.push(maxCompanions === 0 ? "Esta invitación es personal: no admite acompañantes." : `Podés sumar hasta ${maxCompanions} acompañantes.`);
  }
  return out;
}

export const partySize = (companions: number) => 1 + companions;

export function rsvpPlacement(p: { capacity: number | null; confirmedPeople: number; party: number }): "CONFIRMED" | "WAITLIST" {
  return p.capacity == null || p.confirmedPeople + p.party <= p.capacity ? "CONFIRMED" : "WAITLIST";
}

/** `waitlist` en orden de llegada. Pasa quien entra; quien no entra espera y sigue el siguiente (D16). */
export function promoteFromWaitlist(p: { capacity: number | null; confirmedPeople: number; waitlist: readonly { id: string; companions: number }[] }): string[] {
  let ocupado = p.confirmedPeople;
  const out: string[] = [];
  for (const w of p.waitlist) {
    const n = partySize(w.companions);
    if (p.capacity == null || ocupado + n <= p.capacity) { out.push(w.id); ocupado += n; }
  }
  return out;
}

export type RsvpTotals = { confirmed: number; people: number; waitlist: number; waitlistPeople: number; cancelled: number };
export function rsvpTotals(rows: readonly { status: string; companions: number }[]): RsvpTotals {
  const t: RsvpTotals = { confirmed: 0, people: 0, waitlist: 0, waitlistPeople: 0, cancelled: 0 };
  for (const r of rows) {
    if (r.status === "CONFIRMED") { t.confirmed++; t.people += partySize(r.companions); }
    else if (r.status === "WAITLIST") { t.waitlist++; t.waitlistPeople += partySize(r.companions); }
    else if (r.status === "CANCELLED") t.cancelled++;
  }
  return t;
}

export function rsvpPurgeDue(endsAt: Date, now: Date): boolean {
  return now.getTime() > endsAt.getTime() + RSVP_RETENTION_DAYS * DAY;
}

export type OpeningEvent = { id: string; title: string; openingAt: Date; openingEndsAt: Date | null; venue: string; note: string | null; url: string; stamp: Date };

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Pliega a 75 octetos sin cortar un carácter UTF-8 por la mitad (RFC 5545, 3.1). */
function plegar(linea: string): string {
  const enc = new TextEncoder();
  const partes: string[] = [];
  let actual = "", bytes = 0, limite = 75;
  for (const ch of linea) {
    const n = enc.encode(ch).length;
    if (bytes + n > limite) { partes.push(actual); actual = ""; bytes = 0; limite = 74; }
    actual += ch; bytes += n;
  }
  partes.push(actual);
  return partes.join("\r\n ");
}

export function openingIcs(e: OpeningEvent): string {
  const fin = openingEnd(e.openingAt, e.openingEndsAt);
  const descripcion = [e.note, e.url].filter(Boolean).join("\n\n");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Muestras Fotograficas//Inauguracion//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:inauguracion-${e.id}@muestrasfotograficas.com`,
    `DTSTAMP:${utc(e.stamp)}`, `DTSTART:${utc(e.openingAt)}`, `DTEND:${utc(fin)}`,
    `SUMMARY:${esc(`Inauguración: ${e.title}`)}`, `LOCATION:${esc(e.venue)}`, `DESCRIPTION:${esc(descripcion)}`, `URL:${e.url}`,
    "END:VEVENT", "END:VCALENDAR",
  ].map(plegar).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(e: OpeningEvent): string {
  const fin = openingEnd(e.openingAt, e.openingEndsAt);
  const q = (k: string, v: string) => `${k}=${encodeURIComponent(v)}`;
  // `dates` va sin codificar: Google espera la barra tal cual.
  return `https://calendar.google.com/calendar/render?${[
    q("action", "TEMPLATE"), q("text", `Inauguración: ${e.title}`), `dates=${utc(e.openingAt)}/${utc(fin)}`,
    q("details", [e.note, e.url].filter(Boolean).join("\n\n")), q("location", e.venue),
  ].join("&")}`;
}

export type RsvpCsvRow = { name: string; email: string | null; companions: number; status: string; createdAt: Date };

function celda(v: string): string {
  // Un texto que empieza con = + - @ lo ejecuta Excel como fórmula (inyección CSV).
  const seguro = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[;"\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** CSV para Excel en castellano: BOM, separador `;`, CRLF, fecha en hora argentina. */
export function rsvpCsv(rows: readonly RsvpCsvRow[]): string {
  const fecha = (d: Date) => { const [y, m, dd] = toArDay(d).split("-"); return `${dd}/${m}/${y} ${formatArClock(d)}`; };
  const lineas = [
    ["Nombre", "Email", "Acompañantes", "Personas", "Estado", "Confirmó el"],
    ...rows.map((r) => [r.name, r.email ?? "", String(r.companions), String(partySize(r.companions)),
      RSVP_ENTRY_STATUS_LABELS[r.status as RsvpEntryStatus] ?? r.status, fecha(r.createdAt)]),
  ];
  return "\uFEFF" + lineas.map((l) => l.map(celda).join(";")).join("\r\n") + "\r\n";
}
```
(`openingAtFrom` con `"00:00"`: `parseClock` devuelve `0`, que es falso → queda el comienzo del día. Ese es el comportamiento buscado.) `index.ts`: `export * from "./opening";`.

- [ ] **Step 4: Correr y ver que pasan**

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter @repo/muestras lint`
Expected: todo en verde.

- [ ] **Step 5: Commit**

```bash
git add packages/muestras/src
git commit -m "Muestras: reglas de la inauguración (hora, confirmación, cupo, lista de espera, retención, calendario y CSV)"
```

**Acceptance:** el `.ics` pasa la prueba de plegado y escapes; 19:00 argentinas = 22:00 UTC; el CSV abre en Excel con tildes y no ejecuta fórmulas.

---

### Task 3: Reglas de las piezas para redes y sección "Difusión"

**Files:**
- Create: `packages/muestras/src/social.ts`, `packages/muestras/src/social.test.ts`
- Modify: `packages/muestras/src/panel.ts` (+ `panel.test.ts`), `packages/muestras/src/index.ts`

**Interfaces:**
- Consumes: `dateRangeText`, `formatArDayLong`, `isLastDays` (`dates.ts`); `openingWhenText`, `openingHasTime` (`opening.ts`); `Box` (`print.ts`).
- Produces: `SOCIAL_FORMATS`, `SocialFormat`, `SOCIAL_FORMAT_LABELS`, `SOCIAL_FORMAT_PARAMS`, `PRINT_FORMATS`, `PRINT_SIZES_MM`, `isPrintFormat`; `SOCIAL_VARIANTS`, `SocialVariant`, `SOCIAL_VARIANT_LABELS`, `SOCIAL_VARIANT_PARAMS`; `SocialActivity`, `availableSocialVariants(a, now)`, `isFormatAllowed(variant, format)`, `recommendedVariant(a, now)`; `SocialLayout`, `socialLayout(format, variant)`, `STORY_SAFE_PX = 250`; `SocialTexts`, `socialTexts(variant, a, work)`, `cleanSocialText(s, max)`; `socialFileName(slug, variant, format)`; `panel.ts`: clave `"difusion"`.

- [ ] **Step 1: Escribir los tests que fallan**

`packages/muestras/src/social.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { dayEndAr, dayStartAr } from "./dates";
import { openingAtFrom } from "./opening";
import {
  SOCIAL_FORMATS, STORY_SAFE_PX, availableSocialVariants, cleanSocialText, isFormatAllowed, recommendedVariant,
  socialFileName, socialLayout, socialTexts,
} from "./social";

const a = {
  reviewStatus: "APPROVED", type: "MUESTRA", isCancelled: false, isVirtualOnly: false,
  startsAt: dayStartAr("2026-11-14"), endsAt: dayEndAr("2026-11-30"),
  openingAt: openingAtFrom("2026-11-14", "19:00"), openingEndsAt: null, worksCount: 12,
  title: "Rosario en blanco y negro", venueName: "Centro Cultural Parque España", city: "Rosario", province: "Santa Fe",
};

describe("qué variantes hay", () => {
  it("antes de inaugurar, todas", () => {
    expect(availableSocialVariants(a, new Date("2026-11-10T12:00:00Z"))).toEqual(["OPENING", "LAST_DAYS", "WORK", "INVITATION"]);
  });
  it("ya inaugurada: sin Inaugura ni Invitación; cerrada: sólo Obra", () => {
    expect(availableSocialVariants(a, new Date("2026-11-20T12:00:00Z"))).toEqual(["LAST_DAYS", "WORK"]);
    expect(availableSocialVariants(a, new Date("2026-12-05T12:00:00Z"))).toEqual(["WORK"]);
  });
  it("sin publicar o cancelada: nada; sin obras: sin Obra; sin hora: sin Invitación", () => {
    expect(availableSocialVariants({ ...a, reviewStatus: "IN_REVIEW" }, new Date("2026-11-10T12:00:00Z"))).toEqual([]);
    expect(availableSocialVariants({ ...a, isCancelled: true }, new Date("2026-11-10T12:00:00Z"))).toEqual([]);
    expect(availableSocialVariants({ ...a, worksCount: 0 }, new Date("2026-11-10T12:00:00Z"))).not.toContain("WORK");
    expect(availableSocialVariants({ ...a, openingAt: dayStartAr("2026-11-14") }, new Date("2026-11-10T12:00:00Z"))).toEqual(["OPENING", "LAST_DAYS", "WORK"]);
  });
  it("la recomendada según la fecha", () => {
    expect(recommendedVariant(a, new Date("2026-11-10T12:00:00Z"))).toBe("OPENING");
    expect(recommendedVariant(a, new Date("2026-11-26T12:00:00Z"))).toBe("LAST_DAYS");
    expect(recommendedVariant(a, new Date("2026-11-18T12:00:00Z"))).toBe("WORK");
  });
  it("A6 y A5 sólo para la invitación", () => {
    expect(isFormatAllowed("INVITATION", "A6")).toBe(true);
    expect(isFormatAllowed("OPENING", "A5")).toBe(false);
    expect(isFormatAllowed("OPENING", "STORY")).toBe(true);
  });
});

describe("diagramación", () => {
  it("cada formato llena su lienzo: foto arriba, banda abajo", () => {
    for (const f of Object.keys(SOCIAL_FORMATS) as (keyof typeof SOCIAL_FORMATS)[]) {
      const l = socialLayout(f, "OPENING");
      expect(l.photo.y).toBe(0);
      expect(l.photo.height + l.band.height).toBe(l.height);
      expect(l.textBottom).toBeLessThanOrEqual(l.height - l.padding);
      expect(l.titleSizes).toEqual([...l.titleSizes].sort((x, y) => y - x));
    }
  });
  it("historia: nada de texto en las zonas de Instagram", () => {
    const l = socialLayout("STORY", "OPENING");
    expect(l.textTop).toBeGreaterThanOrEqual(STORY_SAFE_PX);
    expect(l.textBottom).toBeLessThanOrEqual(1920 - STORY_SAFE_PX);
  });
  it("la invitación reserva lugar para el QR y achica el texto", () => {
    const l = socialLayout("POST", "INVITATION");
    expect(l.qr).not.toBeNull();
    expect(l.textWidth).toBeLessThan(socialLayout("POST", "OPENING").textWidth);
    expect(l.qr!.x + l.qr!.width).toBeLessThanOrEqual(1080 - l.padding);
  });
  it("A5 escala proporcional", () => {
    expect(socialLayout("A5", "INVITATION").scale).toBeCloseTo(1748 / 1080);
  });
});

describe("textos", () => {
  it("Inaugura, Últimos días, Obra e Invitación", () => {
    expect(socialTexts("OPENING", a, null)).toEqual({
      kicker: "Inaugura", title: "Rosario en blanco y negro",
      details: ["Sábado 14 de noviembre, 19 h", "Centro Cultural Parque España, Rosario"], footer: "muestrasfotograficas.com",
    });
    expect(socialTexts("LAST_DAYS", a, null).details[0]).toBe("Hasta el 30 de noviembre de 2026");
    expect(socialTexts("WORK", a, { title: "Silos", authorName: "Ana Pérez", year: 2024 })).toEqual({
      kicker: "Obra destacada", title: "Silos",
      details: ["Ana Pérez, 2024", "En «Rosario en blanco y negro»", "Del 14 al 30 de noviembre de 2026, Centro Cultural Parque España, Rosario"],
      footer: "muestrasfotograficas.com",
    });
    expect(socialTexts("INVITATION", a, null).kicker).toBe("Te invitamos a la inauguración");
    expect(socialTexts("INVITATION", a, null).details.at(-1)).toBe("Confirmá tu asistencia con el QR");
  });
  it("limpia lo que la fuente no tiene", () => {
    expect(cleanSocialText("Rosario 📷  en\u0007 B&N — ñandú", 80)).toBe("Rosario en B&N — ñandú");
    expect(cleanSocialText("x".repeat(200), 120)).toHaveLength(120);
  });
  it("nombre de archivo", () => {
    expect(socialFileName("rosario-bn", "OPENING", "POST")).toBe("muestra-rosario-bn-inaugura-posteo.jpg");
    expect(socialFileName("rosario-bn", "INVITATION", "A6")).toBe("muestra-rosario-bn-invitacion-a6.pdf");
  });
});
```

Sumar a `packages/muestras/src/panel.test.ts`: `Difusión` está en "Para organizar", lista, en `/panel/difusion`, y `activeSectionKey("/panel/difusion/x/inauguracion")` es `"difusion"`.

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter @repo/muestras test -- social panel`
Expected: FAIL.

- [ ] **Step 3: Implementar `packages/muestras/src/social.ts`**

```ts
import { dateRangeText, formatArDayLong, isLastDays } from "./dates";
import { openingHasTime, openingWhenText } from "./opening";
import type { Box } from "./print";

/** Piezas para redes (etapa 5, D24–D29). Medidas en píxeles; la base de diseño es 1080 de ancho. */
export const SOCIAL_FORMATS = {
  POST: { width: 1080, height: 1350 },
  STORY: { width: 1080, height: 1920 },
  SQUARE: { width: 1080, height: 1080 },
  A6: { width: 1240, height: 1748 },
  A5: { width: 1748, height: 2480 },
} as const;
export type SocialFormat = keyof typeof SOCIAL_FORMATS;
export const SOCIAL_FORMAT_LABELS: Record<SocialFormat, string> = {
  POST: "Posteo (1080 × 1350)", STORY: "Historia (1080 × 1920)", SQUARE: "Cuadrado (1080 × 1080)",
  A6: "Para imprimir, A6 (10,5 × 14,8 cm)", A5: "Para imprimir, A5 (14,8 × 21 cm)",
};
export const SOCIAL_FORMAT_PARAMS: Record<string, SocialFormat> = { post: "POST", historia: "STORY", cuadrado: "SQUARE", a6: "A6", a5: "A5" };
const PARAM_DE_FORMATO: Record<SocialFormat, string> = { POST: "posteo", STORY: "historia", SQUARE: "cuadrado", A6: "a6", A5: "a5" };
export const PRINT_FORMATS = ["A6", "A5"] as const;
export const PRINT_SIZES_MM = { A6: { width: 105, height: 148 }, A5: { width: 148, height: 210 } } as const;
export const isPrintFormat = (f: SocialFormat): f is "A6" | "A5" => f === "A6" || f === "A5";

export const SOCIAL_VARIANTS = ["OPENING", "LAST_DAYS", "WORK", "INVITATION"] as const;
export type SocialVariant = (typeof SOCIAL_VARIANTS)[number];
export const SOCIAL_VARIANT_LABELS: Record<SocialVariant, string> = {
  OPENING: "Inaugura", LAST_DAYS: "Últimos días", WORK: "Obra destacada", INVITATION: "Invitación a la inauguración",
};
export const SOCIAL_VARIANT_PARAMS: Record<string, SocialVariant> = { inaugura: "OPENING", "ultimos-dias": "LAST_DAYS", obra: "WORK", invitacion: "INVITATION" };
const PARAM_DE_VARIANTE: Record<SocialVariant, string> = { OPENING: "inaugura", LAST_DAYS: "ultimos-dias", WORK: "obra", INVITATION: "invitacion" };

export type SocialActivity = {
  reviewStatus: string; type: string; isCancelled: boolean; isVirtualOnly: boolean;
  startsAt: Date; endsAt: Date; openingAt: Date | null; openingEndsAt: Date | null; worksCount: number;
  title: string; venueName: string | null; city: string | null; province: string | null;
};

export function availableSocialVariants(a: SocialActivity, now: Date): SocialVariant[] {
  if (a.reviewStatus !== "APPROVED" || a.type !== "MUESTRA" || a.isCancelled) return [];
  const t = now.getTime();
  const out: SocialVariant[] = [];
  if (a.openingAt && t < (openingHasTime(a.openingAt) ? a.openingAt.getTime() : a.openingAt.getTime() + 24 * 3600_000)) out.push("OPENING");
  if (t <= a.endsAt.getTime()) out.push("LAST_DAYS");
  if (a.worksCount > 0) out.push("WORK");
  if (!a.isVirtualOnly && openingHasTime(a.openingAt) && t < a.openingAt.getTime()) out.push("INVITATION");
  return out;
}

export function recommendedVariant(a: SocialActivity, now: Date): SocialVariant | null {
  const v = availableSocialVariants(a, now);
  if (v.includes("OPENING")) return "OPENING";
  if (v.includes("LAST_DAYS") && isLastDays(a, now)) return "LAST_DAYS";
  return v.includes("WORK") ? "WORK" : v[0] ?? null;
}

export function isFormatAllowed(v: SocialVariant, f: SocialFormat): boolean {
  return isPrintFormat(f) ? v === "INVITATION" : true;
}

export const STORY_SAFE_PX = 250;
const FRACCION_FOTO: Record<SocialFormat, number> = { POST: 0.56, STORY: 0.52, SQUARE: 0.5, A6: 0.55, A5: 0.55 };

export type SocialLayout = {
  width: number; height: number; scale: number; padding: number;
  photo: Box; band: Box; textLeft: number; textTop: number; textBottom: number; textWidth: number;
  qr: Box | null; kickerSize: number; titleSizes: number[]; detailSize: number; footerSize: number; gap: number;
};

export function socialLayout(format: SocialFormat, variant: SocialVariant): SocialLayout {
  const { width, height } = SOCIAL_FORMATS[format];
  const s = width / 1080;
  const r = (n: number) => Math.round(n * s);
  const padding = r(72);
  const fotoAlto = Math.round(height * FRACCION_FOTO[format]);
  const photo = { x: 0, y: 0, width, height: fotoAlto };
  const band = { x: 0, y: fotoAlto, width, height: height - fotoAlto };
  const seguro = format === "STORY" ? STORY_SAFE_PX : 0;
  const textTop = Math.max(band.y + padding, seguro);
  const textBottom = Math.min(height - padding, height - seguro);
  const qrLado = variant === "INVITATION" ? r(230) : 0;
  const qr = qrLado ? { x: width - padding - qrLado, y: textBottom - qrLado, width: qrLado, height: qrLado } : null;
  return {
    width, height, scale: s, padding, photo, band, textLeft: padding, textTop, textBottom,
    textWidth: width - 2 * padding - (qr ? qrLado + r(40) : 0), qr,
    kickerSize: r(34), titleSizes: [84, 72, 62, 54, 46].map(r), detailSize: r(32), footerSize: r(26), gap: r(20),
  };
}

export type SocialTexts = { kicker: string; title: string; details: string[]; footer: string };

/** NFC, sin controles ni símbolos fuera de Latin-1 / Latin Extended-A / puntuación general (emojis). */
export function cleanSocialText(s: string, max: number): string {
  return Array.from(s.normalize("NFC"))
    .filter((c) => { const n = c.codePointAt(0)!; return (n >= 0x20 && n <= 0x7e) || (n >= 0xa0 && n <= 0x17f) || (n >= 0x2010 && n <= 0x203a) || n === 0x20ac; })
    .join("").replace(/\s+/g, " ").trim().slice(0, max);
}

const lugar = (a: SocialActivity) => [a.venueName, a.city].filter(Boolean).join(", ");

export function socialTexts(v: SocialVariant, a: SocialActivity, work: { title: string; authorName: string; year: number | null } | null): SocialTexts {
  const footer = "muestrasfotograficas.com";
  const titulo = cleanSocialText(a.title, 120);
  switch (v) {
    case "OPENING":
      return { kicker: "Inaugura", title: titulo, details: [openingWhenText(a.openingAt!, a.openingEndsAt), lugar(a)].filter(Boolean), footer };
    case "LAST_DAYS":
      return { kicker: "Últimos días", title: titulo, details: [`Hasta el ${formatArDayLong(a.endsAt)}`, lugar(a)].filter(Boolean), footer };
    case "WORK":
      return {
        kicker: "Obra destacada", title: cleanSocialText(work?.title ?? "", 120),
        details: [[work?.authorName, work?.year].filter(Boolean).join(", "), `En «${titulo}»`, [dateRangeText(a.startsAt, a.endsAt), lugar(a)].filter(Boolean).join(", ")].filter(Boolean),
        footer,
      };
    case "INVITATION":
      return {
        kicker: "Te invitamos a la inauguración", title: titulo,
        details: [openingWhenText(a.openingAt!, a.openingEndsAt), lugar(a), "Confirmá tu asistencia con el QR"].filter(Boolean), footer,
      };
  }
}

export function socialFileName(slug: string, v: SocialVariant, f: SocialFormat): string {
  return `muestra-${slug}-${PARAM_DE_VARIANTE[v]}-${PARAM_DE_FORMATO[f]}.${isPrintFormat(f) ? "pdf" : "jpg"}`;
}
```
(El texto exacto de `dateRangeText` para el mismo mes es "Del 14 al 30 de noviembre de 2026": así lo espera el test.)

`packages/muestras/src/panel.ts`: sumar `"difusion"` a `PanelSectionKey` y `s("difusion", "Difusión", "/panel/difusion", "ORGANIZAR")` después de `"montaje"`. `index.ts`: `export * from "./social";`.

- [ ] **Step 4: Correr y ver que pasan**

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter @repo/muestras lint`
Expected: todo en verde. (`apps/muestras/lib/panel/en-preparacion.test.ts` sigue en verde: "difusion" nace `ready`.)

- [ ] **Step 5: Commit**

```bash
git add packages/muestras/src
git commit -m "Muestras: reglas de las piezas para redes (formatos, variantes, diagramación y textos) y sección Difusión"
```

**Acceptance:** la historia no pone texto en los 250 px de arriba ni de abajo; ninguna variante se ofrece fuera de su momento.

---

### Task 4: Columnas y tablas de equipo e inauguración (migración escrita a mano, sin aplicar)

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20261030120000_muestras_etapa_5_difusion/migration.sql`

**Interfaces:**
- Produces: `CulturalActivity.openingEndsAt`, `.openingNote`, `.rsvpStatus` (`"OFF"`), `.rsvpCapacity`, `.rsvpMaxCompanions` (3), `.rsvpSummary` (`Json?`), `.rsvpPurgedAt`, `.editVersion` (0), `.lastEditedByUserId`, `.lastEditedAt`, `.lastEditedPart`, `.members`, `.rsvps`; `prisma.culturalActivityMember` (únicos `activityId_email`, `activityId_userId`, `tokenHash`); `prisma.culturalActivityRsvp` (únicos `activityId_email`, `manageTokenHash`).

- [ ] **Step 1: Confirmar el nombre de la migración**

Run: `git fetch origin && git ls-tree --name-only origin/main packages/db/prisma/migrations/ | tail -4 && ls packages/db/prisma/migrations | tail -3`
Expected: la última de esta rama es `20261029120000_muestras_etapa_4_sala`; en `origin/main` no hay nada posterior a `20261029…`. Si apareció una más nueva, usar un timestamp posterior y reemplazar el nombre en todo este plan.

- [ ] **Step 2: Cambiar el schema (sin `prisma format`: reformatea todo el archivo)**

En `model CulturalActivity`, debajo de `hangingPlan Json?`:
```prisma

  /// Fin de la inauguración (etapa 5). `openingAt` guarda día y hora; a las 00:00 argentinas = sin hora.
  openingEndsAt     DateTime?
  /// Nota de la invitación, p. ej. "Habrá un brindis".
  openingNote       String?
  /// Confirmación de asistencia: OFF | OPEN | CLOSED
  rsvpStatus        String    @default("OFF")
  /// Cupo en personas (incluye acompañantes). Vacío = sin cupo.
  rsvpCapacity      Int?
  rsvpMaxCompanions Int       @default(3)
  /// Totales que quedan después de borrar los datos personales (30 días después del cierre).
  rsvpSummary       Json?
  rsvpPurgedAt      DateTime?

  /// Sube con cada guardado de la ficha o de los textos: evita pisar cambios de otra persona del equipo.
  editVersion        Int       @default(0)
  lastEditedByUserId Int?
  lastEditedAt       DateTime?
  /// FICHA | TEXTOS | MONTAJE | INAUGURACION
  lastEditedPart     String?
```
y debajo de `guestbookEntries CulturalActivityGuestbookEntry[]`:
```prisma

  /// Equipo de la muestra (etapa 5). El dueño es `proposedByUserId` y no está acá.
  members CulturalActivityMember[]
  /// Confirmaciones de asistencia a la inauguración (etapa 5).
  rsvps   CulturalActivityRsvp[]
```

Al final del archivo:
```prisma
/// Integrante del equipo de una muestra (Muestras Fotográficas, etapa 5). Se invita por email; el
/// enlace guarda sólo el SHA-256 del token y se acepta con la cuenta de ese email.
model CulturalActivityMember {
  id         String           @id @default(cuid())
  activityId String
  activity   CulturalActivity @relation(fields: [activityId], references: [id], onDelete: Cascade)

  email           String
  userId          Int?
  /// CO_ORGANIZER | TEXT_EDITOR
  role            String
  /// INVITED | ACTIVE | REVOKED
  status          String    @default("INVITED")
  tokenHash       String    @unique
  invitedByUserId Int
  invitedAt       DateTime  @default(now())
  acceptedAt      DateTime?
  revokedAt       DateTime?

  @@unique([activityId, email])
  @@unique([activityId, userId])
  @@index([userId, status])
}

/// Confirmación de asistencia a la inauguración (etapa 5). Sin cuenta, sin IP, sin user-agent.
/// Se borra 30 días después del cierre de la muestra (queda `CulturalActivity.rsvpSummary`).
model CulturalActivityRsvp {
  id         String           @id @default(cuid())
  activityId String
  activity   CulturalActivity @relation(fields: [activityId], references: [id], onDelete: Cascade)

  name            String
  email           String?
  companions      Int       @default(0)
  /// CONFIRMED | WAITLIST | CANCELLED
  status          String    @default("CONFIRMED")
  manageTokenHash String    @unique
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  cancelledAt     DateTime?
  promotedAt      DateTime?

  @@unique([activityId, email])
  @@index([activityId, status, createdAt])
}
```

- [ ] **Step 3: Validar y generar el cliente**

Run: `pnpm --filter @repo/db exec prisma validate && pnpm --filter @repo/db exec prisma generate`
Expected: válido y cliente generado (con `DATABASE_URL`/`DIRECT_URL` falsos si faltan, como en la etapa 4).

- [ ] **Step 4: Escribir la migración**

`packages/db/prisma/migrations/20261030120000_muestras_etapa_5_difusion/migration.sql`:
```sql
-- Muestras Fotográficas · Etapa 5: difusión y equipo (equipo de la muestra, inauguración con
-- confirmación de asistencia; las piezas para redes no guardan nada).
-- Aditiva: suma once columnas a CulturalActivity (optativas o con valor por defecto constante:
-- Postgres no reescribe la tabla) y crea dos tablas nuevas. No toca filas existentes.
-- NO SE APLICA SOLA: la aplica a mano el controlador (autorizado por Daniel) en la base de
-- FOTOFFICE/FotoRank (Neon `divine-hall-10689679`, rama `development`), DESPUÉS de la etapa 4
-- (20261029120000_muestras_etapa_4_sala), y la registra en `_prisma_migrations` con el SHA-256 de
-- este archivo. Va ANTES de publicar el código: sin las columnas nuevas, toda consulta de
-- CulturalActivity falla y se cae todo el sitio de Muestras.

-- AlterTable
ALTER TABLE "CulturalActivity" ADD COLUMN     "editVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastEditedAt" TIMESTAMP(3),
ADD COLUMN     "lastEditedByUserId" INTEGER,
ADD COLUMN     "lastEditedPart" TEXT,
ADD COLUMN     "openingEndsAt" TIMESTAMP(3),
ADD COLUMN     "openingNote" TEXT,
ADD COLUMN     "rsvpCapacity" INTEGER,
ADD COLUMN     "rsvpMaxCompanions" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "rsvpPurgedAt" TIMESTAMP(3),
ADD COLUMN     "rsvpStatus" TEXT NOT NULL DEFAULT 'OFF',
ADD COLUMN     "rsvpSummary" JSONB;

-- CreateTable
CREATE TABLE "CulturalActivityMember" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" INTEGER,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "tokenHash" TEXT NOT NULL,
    "invitedByUserId" INTEGER NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "CulturalActivityMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalActivityRsvp" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "companions" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "manageTokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "promotedAt" TIMESTAMP(3),

    CONSTRAINT "CulturalActivityRsvp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CulturalActivityMember_tokenHash_key" ON "CulturalActivityMember"("tokenHash");

-- CreateIndex
CREATE INDEX "CulturalActivityMember_userId_status_idx" ON "CulturalActivityMember"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalActivityMember_activityId_email_key" ON "CulturalActivityMember"("activityId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalActivityMember_activityId_userId_key" ON "CulturalActivityMember"("activityId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalActivityRsvp_manageTokenHash_key" ON "CulturalActivityRsvp"("manageTokenHash");

-- CreateIndex
CREATE INDEX "CulturalActivityRsvp_activityId_status_createdAt_idx" ON "CulturalActivityRsvp"("activityId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalActivityRsvp_activityId_email_key" ON "CulturalActivityRsvp"("activityId", "email");

-- AddForeignKey
ALTER TABLE "CulturalActivityMember" ADD CONSTRAINT "CulturalActivityMember_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalActivityRsvp" ADD CONSTRAINT "CulturalActivityRsvp_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Compararla con lo que genera Prisma **contra el schema de la rama de la etapa 4** (la base de esta rama):

Run: `git show feat/muestras-etapa-4:packages/db/prisma/schema.prisma > /tmp/schema-antes.prisma && pnpm --filter @repo/db exec prisma migrate diff --from-schema-datamodel /tmp/schema-antes.prisma --to-schema-datamodel prisma/schema.prisma --script`
Expected: las mismas sentencias (1 `ALTER TABLE … ADD COLUMN` con once columnas, 2 `CREATE TABLE`, 7 `CREATE INDEX`, 2 `ADD CONSTRAINT`); el orden puede variar. Cualquier `DROP`, `ALTER` de otra tabla o `CREATE TYPE`: frenar y avisar.

- [ ] **Step 5: Comprobar que el resto de la suite compila**

Run: `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice typecheck`
Expected: sin errores (ninguna otra app consulta `CulturalActivity`).

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20261030120000_muestras_etapa_5_difusion
git commit -m "Columnas y tablas de difusión y equipo de Muestras: equipo, inauguración y registro de cambios (sin aplicar)"
```

**Acceptance:** `prisma validate` en verde; la SQL coincide con `migrate diff`; ningún `DROP`.

---

### Task 5: Permiso único en la app — lecturas, listados y estadísticas

**Files:**
- Create: `apps/muestras/lib/equipo/permisos.ts`, `apps/muestras/lib/equipo/permisos.test.ts`
- Modify: `apps/muestras/lib/actividades/consultas.ts`, `lib/montaje/consultas.ts`, `lib/piezas/cargar.ts`, `lib/fichas/cargar.ts` (+ `cargar.test.ts`), `lib/estadisticas/consultas.ts`, `lib/estadisticas/contar.ts` (+ `.test.ts`), `lib/estadisticas/qr.ts`, `app/api/visitas/route.ts` (+ `lib/estadisticas/visitas-ruta.test.ts`), `app/q/[tipo]/[id]/route.ts` (+ `lib/estadisticas/qr-ruta.test.ts`), `lib/libro/consultas.ts`, `lib/convocatorias/consultas.ts`, `lib/curaduria/imagen.ts` (+ `.test.ts`), `app/convocatorias/[slug]/enviar/page.tsx`, `app/panel/page.tsx`, `app/panel/muestras/page.tsx`, `app/panel/montaje/page.tsx`, `app/panel/estadisticas/page.tsx`

**Interfaces:**
- Consumes: `can`, `rolesWith`, `activityRole`, `type Capability`, `type ActivityRole`, `type TeamRole` (Task 1).
- Produces (`lib/equipo/permisos.ts`, `import "server-only"`):
  - `rolEnMuestra(activityId, usuario): Promise<{ ownerUserId: number; role: ActivityRole | null } | null>`
  - `puede(usuario, cap, role)`: `can(cap, { role, isSuperAdmin: usuario.esSuperAdmin })`
  - `puedeConDueno(usuario, cap, ownerUserId)`: para las capacidades que sólo tiene el dueño (`manageCall`), sin leer el equipo.
  - `dondePuede(usuario, cap, { listado = false } = {}): Prisma.CulturalActivityWhereInput` (`{}` para el super admin salvo en listados; si no, `{ AND: [{ OR: [...] }] }`)
  - `esDelEquipo(activityId): Promise<boolean>` (sesión abierta y dueño, super admin o integrante activo)
  - `actividades/consultas.ts`: `listarMias(usuario)` (propias + compartidas, cada una con `rol`), `buscarParaEditar(id, usuario)` (`{ actividad, rol } | null`, exige `view`), `listarMuestrasParaMontaje(usuario)`; `estadisticas/consultas.ts`: `listarConEstadisticas(usuario)`.

- [ ] **Step 1: Tests que fallan**

`apps/muestras/lib/equipo/permisos.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ culturalActivity: { findUnique: vi.fn(), count: vi.fn() } }));
const sesion = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => sesion.valor }));
const { dondePuede, esDelEquipo, rolEnMuestra } = await import("./permisos");

const ana = { id: 7, esSuperAdmin: false, email: "ana@x", name: "Ana" };
const admin = { id: 1, esSuperAdmin: true, email: "d@x", name: null };

beforeEach(() => vi.clearAllMocks());

describe("dondePuede", () => {
  it("dueño o integrante con un rol que tenga la capacidad", () => {
    expect(dondePuede(ana, "rsvp")).toEqual({ AND: [{ OR: [
      { proposedByUserId: 7 },
      { members: { some: { userId: 7, status: "ACTIVE", role: { in: ["CO_ORGANIZER"] } } } },
    ] }] });
    expect(dondePuede(ana, "manageCall")).toEqual({ AND: [{ OR: [{ proposedByUserId: 7 }] }] });
  });
  it("super admin: todo, salvo en los listados (ve lo suyo)", () => {
    expect(dondePuede(admin, "stats")).toEqual({});
    expect(dondePuede(admin, "stats", { listado: true })).toEqual(dondePuede({ ...admin, esSuperAdmin: false }, "stats"));
  });
});

describe("rolEnMuestra", () => {
  it("lee el dueño y la fila activa de esta persona", async () => {
    db.culturalActivity.findUnique.mockResolvedValue({ proposedByUserId: 3, members: [{ userId: 7, role: "TEXT_EDITOR", status: "ACTIVE" }] });
    expect(await rolEnMuestra("a1", ana)).toEqual({ ownerUserId: 3, role: "TEXT_EDITOR" });
    expect(db.culturalActivity.findUnique.mock.calls[0]![0].select.members.where).toEqual({ userId: 7, status: "ACTIVE" });
    db.culturalActivity.findUnique.mockResolvedValue(null);
    expect(await rolEnMuestra("no", ana)).toBeNull();
  });
});

describe("esDelEquipo", () => {
  it("sin sesión no consulta la base", async () => {
    sesion.valor = null;
    expect(await esDelEquipo("a1")).toBe(false);
    expect(db.culturalActivity.count).not.toHaveBeenCalled();
  });
  it("con sesión: cualquier rol de la muestra", async () => {
    sesion.valor = ana;
    db.culturalActivity.count.mockResolvedValue(1);
    expect(await esDelEquipo("a1")).toBe(true);
    expect(db.culturalActivity.count.mock.calls[0]![0].where).toEqual({ id: "a1", ...dondePuede(ana, "view") });
  });
});
```
Actualizar los tests existentes que miraban el `where` exacto (`lib/fichas/cargar.test.ts`, `lib/montaje/acciones.test.ts` en la Task 6, `lib/curaduria/imagen.test.ts`, `lib/estadisticas/*-ruta.test.ts`): ahora esperan `...dondePuede(usuario, "<capacidad>")` en vez de `proposedByUserId`. Sumar un caso "integrante con el rol correcto ve / con el rol equivocado no".

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- equipo/permisos fichas estadisticas curaduria`
Expected: FAIL.

- [ ] **Step 3: Implementar `apps/muestras/lib/equipo/permisos.ts`**

```ts
import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { activityRole, can, rolesWith, type ActivityRole, type Capability, type TeamRole } from "@repo/muestras";
import { getUsuario, type Usuario } from "@/lib/usuario";

/**
 * El único lugar de la app que sabe quién es el dueño de una muestra (spec D2). Toda consulta o
 * acción sobre una muestra pide permiso acá: `dondePuede` mete el permiso en el `where` (una sola
 * consulta, sin "leer y después mirar"); `rolEnMuestra` lo lee cuando hace falta el rol para una
 * regla de estado (`canEdit`, `canPerform`).
 */
type Quien = Pick<Usuario, "id" | "esSuperAdmin">;

export async function rolEnMuestra(activityId: string, usuario: Quien): Promise<{ ownerUserId: number; role: ActivityRole | null } | null> {
  const a = await prisma.culturalActivity.findUnique({
    where: { id: activityId },
    select: { proposedByUserId: true, members: { where: { userId: usuario.id, status: "ACTIVE" }, select: { userId: true, role: true, status: true } } },
  });
  if (!a) return null;
  return { ownerUserId: a.proposedByUserId, role: activityRole(a, usuario.id) };
}

export const puede = (usuario: Quien, cap: Capability, role: ActivityRole | null) => can(cap, { role, isSuperAdmin: usuario.esSuperAdmin });

/** Para lo que sólo hace el dueño (convocatoria): no hace falta leer el equipo. */
export const puedeConDueno = (usuario: Quien, cap: Capability, ownerUserId: number) =>
  can(cap, { role: ownerUserId === usuario.id ? "OWNER" : null, isSuperAdmin: usuario.esSuperAdmin });

/**
 * Filtro de Prisma: "muestras donde esta persona tiene `cap`". `{ listado: true }` para los
 * listados del panel, donde el super admin ve sólo lo suyo (como hasta la etapa 4).
 */
export function dondePuede(usuario: Quien, cap: Capability, { listado = false }: { listado?: boolean } = {}): Prisma.CulturalActivityWhereInput {
  if (usuario.esSuperAdmin && !listado) return {};
  const roles = rolesWith(cap);
  const o: Prisma.CulturalActivityWhereInput[] = [];
  if (roles.includes("OWNER")) o.push({ proposedByUserId: usuario.id });
  const equipo = roles.filter((r): r is TeamRole => r !== "OWNER");
  if (equipo.length) o.push({ members: { some: { userId: usuario.id, status: "ACTIVE", role: { in: equipo } } } });
  return { AND: [{ OR: o }] };
}

/** Las visitas y escaneos del equipo no cuentan (D10). Sin cookie de sesión no toca la base. */
export async function esDelEquipo(activityId: string): Promise<boolean> {
  const u = await getUsuario();
  if (!u) return false;
  if (u.esSuperAdmin) return true;
  return (await prisma.culturalActivity.count({ where: { id: activityId, ...dondePuede(u, "view") } })) > 0;
}
```

Reemplazos (uno por uno, sin cambiar nada más de cada función):
- `lib/actividades/consultas.ts`:
  - `listarMias(usuario: Usuario)`: `where: dondePuede(usuario, "view", { listado: true })`, `select` suma `proposedByUserId` y `members: { where: { userId: usuario.id, status: "ACTIVE" }, select: { userId: true, role: true, status: true } }`; devuelve cada fila con `rol: activityRole(fila, usuario.id)` (sin `members` ni `proposedByUserId` hacia la página).
  - `buscarPropia` → `buscarParaEditar(id, usuario)`: `findFirst({ where: { id, ...dondePuede(usuario, "view") }, include: { works: …, members: { where: { userId: usuario.id, status: "ACTIVE" }, select: { userId: true, role: true, status: true } } } })`; devuelve `{ actividad, rol: activityRole(a, usuario.id) }` (para el super admin que no es del equipo el rol es `null` y `puede` igual da `true`; para cualquier otro, el `where` ya garantizó que tiene rol). Sin `proposedByUserId` en el `where`.
  - `listarMuestrasParaMontaje(usuario)`: `where: { type: "MUESTRA", reviewStatus: { not: "REJECTED" }, ...dondePuede(usuario, "hanging", { listado: true }) }`.
- `lib/montaje/consultas.ts` (`cargarMontaje`): `...dondePuede(usuario, "hanging")`.
- `lib/piezas/cargar.ts`, `lib/fichas/cargar.ts`: `...dondePuede(usuario, "pieces")`.
- `lib/estadisticas/consultas.ts`: `listarConEstadisticas(usuario)` con `dondePuede(usuario, "stats", { listado: true })`; `estadisticasDeMuestra` con `dondePuede(usuario, "stats")`.
- `lib/estadisticas/contar.ts`: `esDeQuienOrganiza(proposedByUserId)` → reexporta `esDelEquipo` (o se borra y los dos llamados pasan a `esDelEquipo(activityId)`); `lib/estadisticas/qr.ts`: `DestinoQr` pierde `proposedByUserId`; `app/q/[tipo]/[id]/route.ts` y `app/api/visitas/route.ts` llaman `esDelEquipo(destino.activityId)` / `esDelEquipo(actividad.id)` (el `select` deja de pedir `proposedByUserId`).
- `lib/libro/consultas.ts` (`libroParaModerar`): `...dondePuede(usuario, "guestbook")`.
- `lib/convocatorias/consultas.ts`: `listarConvocatoriasMias` → `where: usuario.esSuperAdmin ? {} : { activity: dondePuede(usuario, "manageCall") }` (el super admin sigue viendo todas, como hoy); `muestrasSinConvocatoria(usuario)` con `dondePuede(usuario, "manageCall", { listado: true })`; `buscarConvocatoriaDelOrganizador`: `if (!puedeConDueno(usuario, "manageCall", c.activity.proposedByUserId)) return null`.
- `lib/curaduria/imagen.ts`: `isOwner: puedeConDueno({ ...usuario, esSuperAdmin: false }, "manageCall", w.call.activity.proposedByUserId)` (el super admin sigue entrando por `isSuperAdmin`).
- `app/convocatorias/[slug]/enviar/page.tsx`: `organiza` = `prisma.culturalCall.count({ where: { id: c.id, activity: dondePuede({ ...usuario, esSuperAdmin: false }, "manageCall") } })` (mismo comportamiento: sólo el dueño choca).
- Páginas: `app/panel/page.tsx` y `app/panel/muestras/page.tsx` llaman `listarMias(usuario)`; la lista muestra al lado del título el rol si no es `OWNER` ("Coorganización", "Textos y curaduría"); el título de la página pasa a "Mis muestras" con la bajada "Las que propusiste y las que organizás en equipo". `app/panel/montaje/page.tsx` y `app/panel/estadisticas/page.tsx` pasan `usuario`.

- [ ] **Step 4: Correr**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: todo en verde.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: permiso único (dondePuede / rolEnMuestra) en consultas, listados, piezas y estadísticas; el equipo no suma visitas"
```

**Acceptance:** `grep -rn "proposedByUserId: usuario.id\|proposedByUserId === usuario.id\|proposedByUserId !== usuario.id" apps/muestras/lib apps/muestras/app` sólo muestra lo que cubre la Task 6 (acciones); un integrante `TEXT_EDITOR` no ve Montaje, Piezas ni Estadísticas de la muestra (test).

---

### Task 6: Permiso único en las acciones, `editVersion` y registro del último cambio

**Files:**
- Create: `apps/muestras/lib/equipo/registro.ts`, `apps/muestras/lib/equipo/registro.test.ts`
- Modify: `apps/muestras/lib/actividades/acciones.ts` (+ `.test.ts`), `lib/actividades/mapear.ts` (+ `.test.ts`), `components/formulario/formulario-actividad.tsx`, `lib/montaje/acciones.ts` (+ `.test.ts`), `lib/libro/acciones.ts` (+ `.test.ts`), `lib/convocatorias/acciones.ts` (+ `.test.ts`), `lib/curaduria/acciones.ts` (+ `.test.ts`), `lib/seleccion/acciones.ts` (+ `.test.ts`), `lib/envios/acciones.ts`, `app/panel/muestras/[id]/page.tsx`

**Interfaces:**
- Consumes: `rolEnMuestra`, `dondePuede`, `puede`, `puedeConDueno` (Task 5); `canEdit`, `canPerform`, `lastEditText`, `type EditPart` (Task 1).
- Produces:
  - `registro.ts`: `datosDeCambio(usuarioId, parte, ahora = new Date())` → `{ lastEditedByUserId, lastEditedAt, lastEditedPart }`; `textoDelUltimoCambio(a: { lastEditedByUserId; lastEditedAt; lastEditedPart })` (lee nombre o email del usuario y devuelve `lastEditText(...)`).
  - `FichaForm.editVersion: number | null` (`mapear.ts`).
  - `guardarBorrador`: rechaza con `{ ok: false, errores: [conflicto] }` si `editVersion` no coincide.

- [ ] **Step 1: Tests que fallan**

En `lib/actividades/acciones.test.ts` sumar (con el mock de `$transaction` que ya usa el archivo, y `$queryRaw` devolviendo la fila bloqueada):
```ts
describe("equipo y versiones (etapa 5)", () => {
  it("coorganización guarda la ficha; textos no", async () => {
    // rolEnMuestra → CO_ORGANIZER
    db.culturalActivity.findUnique.mockResolvedValueOnce({ ...muestraPublicada, proposedByUserId: 3, members: [{ userId: 7, role: "CO_ORGANIZER", status: "ACTIVE" }] });
    expect((await guardarBorrador(fd({ id: "a1", editVersion: "4" }))).ok).toBe(true);
    db.culturalActivity.findUnique.mockResolvedValueOnce({ ...muestraPublicada, proposedByUserId: 3, members: [{ userId: 7, role: "TEXT_EDITOR", status: "ACTIVE" }] });
    expect(await guardarBorrador(fd({ id: "a1", editVersion: "4" }))).toEqual({ ok: false, errores: ["No podés editar esta actividad ahora."] });
  });
  it("otra persona guardó en el medio: no pisa", async () => {
    db.$queryRaw.mockResolvedValueOnce([{ id: "a1", editVersion: 5, lastEditedByUserId: 9, lastEditedPart: "TEXTOS" }]);
    db.user.findUnique.mockResolvedValueOnce({ name: "Ana Pérez", email: "ana@x" });
    const r = await guardarBorrador(fd({ id: "a1", editVersion: "4" }));
    expect(r).toEqual({ ok: false, errores: ["Mientras editabas, Ana Pérez guardó cambios en los textos. Recargá la página para ver la versión nueva (lo que escribiste se pierde: copialo antes)."] });
  });
  it("sin versión (pestaña de antes del cambio): pide recargar", async () => {
    expect(await guardarBorrador(fd({ id: "a1" }))).toEqual({ ok: false, errores: ["La página quedó vieja. Recargala y volvé a guardar."] });
  });
  it("guarda subiendo la versión y deja el registro", async () => {
    await guardarBorrador(fd({ id: "a1", editVersion: "4" }));
    const data = tx.culturalActivity.update.mock.calls[0]![0].data;
    expect(data.editVersion).toEqual({ increment: 1 });
    expect(data).toMatchObject({ lastEditedByUserId: 7, lastEditedPart: "FICHA" });
  });
  it("cancelar: sólo dueño", async () => {
    db.culturalActivity.findUnique.mockResolvedValueOnce({ ...muestraPublicada, proposedByUserId: 3, members: [{ userId: 7, role: "CO_ORGANIZER", status: "ACTIVE" }] });
    expect((await cancelar("a1")).ok).toBe(false);
  });
});
```
En `lib/montaje/acciones.test.ts`: el `where` esperado pasa a `{ id: "a1", type: "MUESTRA", ...dondePuede(usuario, "hanging") }` y el `update` lleva `lastEditedPart: "MONTAJE"`. En `lib/libro/acciones.test.ts`: `moderarEntrada` y `cambiarModoLibro` con `dondePuede(usuario, "guestbook")` (integrante `CO_ORGANIZER` modera; `TEXT_EDITOR` no). En los de convocatorias, curaduría y selección: una coorganización recibe la misma negativa que un extraño (D4).

`lib/equipo/registro.test.ts`: `datosDeCambio(7, "TEXTOS", fecha)` devuelve las tres columnas; `textoDelUltimoCambio` usa el nombre, o el email si no hay nombre, y `null` sin registro.

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- actividades montaje libro convocatorias curaduria seleccion equipo/registro`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`lib/equipo/registro.ts`:
```ts
import "server-only";
import { prisma } from "@repo/db";
import { lastEditText, type EditPart } from "@repo/muestras";

export function datosDeCambio(usuarioId: number, parte: EditPart, ahora: Date = new Date()) {
  return { lastEditedByUserId: usuarioId, lastEditedAt: ahora, lastEditedPart: parte };
}

export async function textoDelUltimoCambio(a: { lastEditedByUserId: number | null; lastEditedAt: Date | null; lastEditedPart: string | null }): Promise<string | null> {
  if (a.lastEditedByUserId == null || !a.lastEditedAt) return null;
  const u = await prisma.user.findUnique({ where: { id: a.lastEditedByUserId }, select: { name: true, email: true } });
  return lastEditText({ who: u?.name?.trim() || u?.email || null, part: a.lastEditedPart, at: a.lastEditedAt });
}
```

`lib/actividades/mapear.ts`: `editVersion: /^\d{1,9}$/.test(txt(fd, "editVersion")) ? Number(txt(fd, "editVersion")) : null` en `fichaDesdeFormData` y en el tipo `FichaForm`. `formulario-actividad.tsx`: `<input type="hidden" name="editVersion" value={inicial?.editVersion ?? 0} />`.

`lib/actividades/acciones.ts` (`guardarBorrador`, rama de edición):
```ts
  if (f.editVersion == null) return { ok: false, errores: ["La página quedó vieja. Recargala y volvé a guardar."] };
  const actual = await prisma.culturalActivity.findUnique({
    where: { id: f.id },
    include: { works: { select: { id: true, isHighlight: true } }, members: { where: { userId: usuario.id, status: "ACTIVE" }, select: { userId: true, role: true, status: true } } },
  });
  if (!actual) return NO_EXISTE;
  const actor = { userId: usuario.id, isSuperAdmin: usuario.esSuperAdmin, role: activityRole(actual, usuario.id) };
  if (!canEdit({ ...actual, reviewStatus: actual.reviewStatus as ReviewStatus }, actor)) return { ok: false, errores: ["No podés editar esta actividad ahora."] };
  …
      async (tx) => {
        const [fila] = await tx.$queryRaw<{ editVersion: number; lastEditedByUserId: number | null; lastEditedPart: string | null }[]>`
          SELECT "editVersion", "lastEditedByUserId", "lastEditedPart" FROM "CulturalActivity" WHERE id = ${id} FOR UPDATE`;
        if (!fila || fila.editVersion !== f.editVersion) throw new Choque(fila ?? null);
        …
        await tx.culturalActivity.update({ where: { id }, data: { ...datos, editVersion: { increment: 1 }, ...datosDeCambio(usuario.id, "FICHA") } });
```
`Choque` es una clase local; en el `catch`, se arma el mensaje con `textoDelUltimoCambio`/el nombre del usuario (`"Mientras editabas, <nombre> guardó cambios en <parte>. Recargá la página para ver la versión nueva (lo que escribiste se pierde: copialo antes)."`; sin datos: "Mientras editabas, alguien del equipo guardó cambios."). `editVersion` llega en el `SELECT` como `number` (columna `INTEGER`: Prisma la devuelve como número, no `bigint`; verificarlo en la prueba manual, ver memoria "SQL crudo con parámetros"). La creación (`!f.id`) no cambia, salvo `...datosDeCambio(usuario.id, "FICHA")`.

`transicion` (revisión): incluir `members` del usuario como arriba y pasar `role: activityRole(fila, usuario.id)` a `canPerform`.

`lib/montaje/acciones.ts`: `where: { id: activityId, type: "MUESTRA", ...dondePuede(usuario, "hanging") }`; el `update` suma `...datosDeCambio(usuario.id, "MONTAJE")` (no toca `editVersion`).

`lib/libro/acciones.ts`: `moderarEntrada` lee la entrada con `activity: { select: { id: true, slug: true } }` y verifica `prisma.culturalActivity.count({ where: { id: e.activity.id, ...dondePuede(usuario, "guestbook") } })`; `cambiarModoLibro`: `where: { id: activityId, type: "MUESTRA", ...dondePuede(usuario, "guestbook") }`.

Convocatoria y selección (D4, todo `manageCall`, comportamiento igual al de hoy):
- `lib/convocatorias/acciones.ts`: `crearConvocatoria` y `guardarConvocatoria` → `puedeConDueno(usuario, "manageCall", a.proposedByUserId)`; `transicion` → `canCallAction` (ya usa `can`); `empezarCuraduria` → `puedeConDueno`.
- `lib/curaduria/acciones.ts`: `convocatoriaParaEquipo` → `puedeConDueno`. El conflicto de `aceptarInvitacion` (dueño, quien invitó, quien creó) **no cambia**.
- `lib/seleccion/acciones.ts`: `decidir` y `armarMuestra` → `puedeConDueno`; el `canEdit` de `armarMuestra` recibe `role: puedeConDueno(...) ? "OWNER" : null`.
- `lib/envios/acciones.ts`: `isOwner: c.activity.proposedByUserId === usuario.id` → `isOwner: activityRole(c.activity, usuario.id) === "OWNER"` (sin cambio de comportamiento; deja la comparación dentro de la regla única).

`app/panel/muestras/[id]/page.tsx`:
```tsx
  const r = await buscarParaEditar(id, usuario);
  if (!r) notFound();
  const { actividad: a, rol } = r;
  const actor = { userId: usuario.id, isSuperAdmin: usuario.esSuperAdmin, role: rol };
  const ficha = canEdit({ ...a, reviewStatus: estado }, actor);
  const textos = !ficha && canEditTexts({ ...a, reviewStatus: estado }, actor);
  const ultimo = await textoDelUltimoCambio(a);
```
Arriba, "Tu rol: Coorganización" si no es dueño; debajo del estado, `ultimo`. Los enlaces de la sección de abajo aparecen según `puede(usuario, "hanging" | "stats" | "promote" | "view", rol)`; `BotonesPublicada` (cancelar) sólo con `cancel`. Con `textos`, se dibuja `FormularioTextos` (Task 8); hasta entonces, un texto "Podés editar los textos desde acá en cuanto esté listo el formulario" **no** se agrega: la Task 8 va en el mismo PR. Sin `ficha` ni `textos`: lectura (título, estado, enlaces).

- [ ] **Step 4: Correr**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: todo en verde.

Verificación de cobertura:
Run: `grep -rn "proposedByUserId" apps/muestras/lib apps/muestras/app --include='*.ts' --include='*.tsx' | grep -v "\.test\."`
Expected: sólo `lib/equipo/permisos.ts`, la creación en `guardarBorrador` (`proposedByUserId: usuario.id` en `create`), `obrasParaGuardar(…, actual.proposedByUserId, …)` (perfil del dueño), `lib/correos/enviar.ts` (destinatario) y `select`s que alimentan `activityRole`/`puedeConDueno`. Pegar la salida en el informe de la tarea.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: acciones con permiso por capacidad, versión de la ficha para no pisar cambios y registro del último cambio"
```

**Acceptance:** dos pestañas que guardan la ficha: la segunda recibe el aviso con el nombre de quien guardó; el plano no choca con la ficha; coorganización no cancela ni toca la convocatoria (tests).

---

### Task 7: Equipo — invitar, aceptar, cambiar rol, sacar y dejar

**Files:**
- Create: `apps/muestras/lib/equipo/acciones.ts` (+ `.test.ts`), `lib/equipo/consultas.ts`, `lib/correos/equipo.ts`, `lib/correos/textos-equipo.ts` (+ `.test.ts`), `components/equipo/equipo-muestra.tsx`, `components/equipo/aceptar-invitacion-equipo.tsx`, `components/equipo/estilos.ts`, `app/panel/muestras/[id]/equipo/page.tsx`, `app/panel/equipo/invitacion/[token]/page.tsx`
- Modify: `apps/muestras/lib/limite.ts` (+ `.test.ts`), `app/panel/muestras/[id]/page.tsx` (enlace "Equipo")

**Interfaces:**
- Consumes: `nuevoTokenDeInvitacion`, `hashDeToken`, `esTokenConForma` (`lib/curaduria/token.ts`); `normalizeEmail`, `teamInviteProblems`, `isTeamRole`, `invitationState` (con `TEAM_INVITATION_TTL_DAYS`, misma regla de 30 días que `INVITATION_TTL_DAYS`), `MAX_TEAM_MEMBERS`; `rolEnMuestra`, `puede`; `enviar`, `APP_URL`; `ResultadoAccion` (con `enlace`).
- Produces: `invitarAlEquipo(activityId, email, rol)`, `reenviarInvitacion(memberId)`, `cambiarRol(memberId, rol)`, `sacarDelEquipo(memberId)`, `aceptarInvitacionEquipo(token)`, `dejarElEquipo(activityId)`; `equipoDeLaMuestra(activityId, usuario)`, `invitacionPorToken(token)`; `avisarInvitacionEquipo({ email, token, muestra, rol, invitaNombre, invitedAt })` → `{ enviado, url }`; frenos `invitarEquipo` (30/h), `aceptarEquipo` (20/h).

- [ ] **Step 1: Tests que fallan**

`lib/equipo/acciones.test.ts` (mock de `@repo/db`, `@/lib/usuario`, `next/cache`, `@/lib/correos/equipo`):
```ts
describe("invitarAlEquipo", () => {
  it("sólo el dueño (o super admin); coorganización no maneja el equipo", async () => { /* rolEnMuestra CO_ORGANIZER → NO_EXISTE */ });
  it("crea la fila con el hash del token y devuelve el enlace si el correo no salió", async () => {
    correo.avisarInvitacionEquipo.mockResolvedValue({ enviado: false, url: "https://muestrasfotograficas.com/panel/equipo/invitacion/TOKEN" });
    const r = await invitarAlEquipo("a1", " Ana@Ejemplo.com ", "TEXT_EDITOR");
    expect(r).toEqual({ ok: true, id: "m1", enlace: "https://muestrasfotograficas.com/panel/equipo/invitacion/TOKEN" });
    const data = db.culturalActivityMember.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ activityId: "a1", email: "ana@ejemplo.com", role: "TEXT_EDITOR", invitedByUserId: 1 });
    expect(data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("con correo encendido no devuelve el enlace", async () => { /* enviado: true → { ok: true, id } */ });
  it("no al dueño, no repetido activo, tope de 10", async () => { /* teamInviteProblems */ });
  it("reinvitar a alguien revocado o vencido renueva el token y vuelve a INVITED sin userId", async () => { /* update con status not ACTIVE */ });
});
describe("aceptarInvitacionEquipo", () => {
  it("token sin forma, inexistente, usado, vencido o revocado", async () => {});
  it("sólo con la cuenta del email invitado", async () => {
    expect(await aceptarInvitacionEquipo(TOKEN)).toEqual({ ok: false, errores: ["Esta invitación es para ana@ejemplo.com. Entrá con esa cuenta de Google para aceptarla."] });
  });
  it("el dueño no acepta invitaciones de su muestra", async () => {});
  it("acepta: ACTIVE con userId, de un solo uso (updateMany where INVITED)", async () => {});
  it("ya era del equipo por otra fila (P2002): mensaje claro", async () => {});
});
describe("cambiarRol, sacarDelEquipo, dejarElEquipo", () => {
  it("cambiar rol de alguien activo no pide aceptar de nuevo", async () => {});
  it("sacar marca REVOKED con fecha; el dueño no se puede sacar (no está en la tabla)", async () => {});
  it("dejar el equipo: sólo la propia fila activa", async () => {});
});
```
`lib/correos/textos-equipo.test.ts`: asunto "Te invitaron al equipo de «<muestra>»", párrafos con quién invita, el rol y su descripción, vence el `<fecha>`; enlace "Aceptar la invitación".

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- equipo textos-equipo limite`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`lib/limite.ts`: en `LIMITES`, `invitarEquipo: { limit: 30, windowMs: 60 * 60_000 }`, `aceptarEquipo: { limit: 20, windowMs: 60 * 60_000 }`.

`lib/equipo/acciones.ts` (`"use server"`), esqueleto de lo central:
```ts
const SIN_SESION: ResultadoAccion = { ok: false, errores: ["Tenés que ingresar."] };
const NO_EXISTE: ResultadoAccion = { ok: false, errores: ["La muestra no existe."] };
const INVALIDA: ResultadoAccion = { ok: false, errores: ["La invitación no es válida."] };

async function muestraParaEquipo(activityId: string, usuario: Usuario) {
  const r = await rolEnMuestra(activityId, usuario);
  if (!r || !puede(usuario, "manageTeam", r.role)) return null;
  const a = await prisma.culturalActivity.findUnique({ where: { id: activityId }, select: { id: true, title: true, type: true, proposedByUserId: true } });
  if (!a || a.type !== "MUESTRA") return null;
  const dueno = await prisma.user.findUnique({ where: { id: a.proposedByUserId }, select: { email: true } });
  return { ...a, ownerEmail: dueno?.email ?? null };
}

export async function invitarAlEquipo(activityId: string, emailCrudo: string, rol: string): Promise<ResultadoAccion> {
  if (typeof activityId !== "string" || typeof emailCrudo !== "string") return NO_EXISTE;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const a = await muestraParaEquipo(activityId, usuario);
  if (!a) return NO_EXISTE;
  const email = normalizeEmail(emailCrudo);
  const [previo, ocupados] = await Promise.all([
    email ? prisma.culturalActivityMember.findUnique({ where: { activityId_email: { activityId, email } }, select: { id: true, status: true } }) : null,
    prisma.culturalActivityMember.count({ where: { activityId, status: { in: ["INVITED", "ACTIVE"] } } }),
  ]);
  const problemas = teamInviteProblems({ email, role: rol, ownerEmail: a.ownerEmail, occupied: ocupados, existing: previo });
  if (problemas.length) return { ok: false, errores: problemas };
  if (!frenarPorUsuario("invitarEquipo", usuario.id).allowed) return { ok: false, errores: ["Mandaste muchas invitaciones seguidas. Esperá un rato."] };
  const { token, hash } = nuevoTokenDeInvitacion();
  const ahora = new Date();
  let fila: { id: string };
  try {
    fila = previo
      ? await prisma.culturalActivityMember.update({
          where: { id: previo.id, status: { not: "ACTIVE" } },
          data: { tokenHash: hash, role: rol, status: "INVITED", invitedAt: ahora, invitedByUserId: usuario.id, revokedAt: null, acceptedAt: null, userId: null },
          select: { id: true },
        })
      : await prisma.culturalActivityMember.create({ data: { activityId, email: email!, role: rol, tokenHash: hash, invitedByUserId: usuario.id, invitedAt: ahora }, select: { id: true } });
  } catch {
    return { ok: false, errores: ["La invitación cambió mientras tanto. Recargá la página."] };
  }
  const aviso = await avisarInvitacionEquipo({ email: email!, token, muestra: a.title, rol: rol as TeamRole, invita: usuario.name ?? usuario.email, invitedAt: ahora });
  revalidatePath(`/panel/muestras/${activityId}/equipo`);
  // Sin correo, el enlace vuelve sólo a quien invita (D6). El token crudo no se guarda.
  return aviso.enviado ? { ok: true, id: fila.id } : { ok: true, id: fila.id, enlace: aviso.url };
}
```
- `reenviarInvitacion(memberId)`: lee `activityId` y `email`/`role` de la fila y llama la misma lógica (token nuevo; si estaba `ACTIVE`, error "Ya está en el equipo").
- `cambiarRol(memberId, rol)`: `isTeamRole(rol)`, `manageTeam`, `updateMany({ where: { id, activityId, status: { in: ["INVITED", "ACTIVE"] } }, data: { role: rol } })`.
- `sacarDelEquipo(memberId)`: `manageTeam`; `updateMany({ where: { id, activityId, status: { not: "REVOKED" } }, data: { status: "REVOKED", revokedAt: new Date() } })`.
- `aceptarInvitacionEquipo(token)`: copia el orden de `aceptarInvitacion` de la etapa 3: forma del token → freno `aceptarEquipo` → buscar por `tokenHash` (con `activity: { select: { proposedByUserId, slug, title } }`) → `invitationState` (USED / EXPIRED / REVOKED) → si `usuario.id === activity.proposedByUserId`: "Esta invitación no se puede aceptar con esta cuenta." → email de la cuenta ≠ invitado: "Esta invitación es para <email>. Entrá con esa cuenta de Google para aceptarla." → `updateMany({ where: { id, status: "INVITED" }, data: { status: "ACTIVE", userId: usuario.id, acceptedAt: new Date() } })` con `try/catch` de `P2002` ("Tu cuenta ya forma parte del equipo de esta muestra.") → `count === 0`: "Esta invitación ya se usó." → `revalidatePath("/panel", "layout")` y `{ ok: true, id: activityId }`.
- `dejarElEquipo(activityId)`: `updateMany({ where: { activityId, userId: usuario.id, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date() } })`.

`lib/equipo/consultas.ts`:
- `equipoDeLaMuestra(activityId, usuario)`: con `rolEnMuestra` y `view`; devuelve `{ muestra: { id, title }, rol, puedeGestionar: puede(usuario, "manageTeam", rol), duenio: { nombre }, integrantes: [{ id, email, role, status, invitedAt, acceptedAt, vencida }] }` (`vencida` con `invitationState`). Los `REVOKED` se muestran sólo a quien gestiona.
- `invitacionPorToken(token)`: `{ muestra, rol, email, estado }` para la página de aceptar (sin ids de usuario).

`lib/correos/equipo.ts` + `textos-equipo.ts`: igual que `avisarInvitacionCurador` (`enlace = ${APP_URL}/panel/equipo/invitacion/${token}`; nunca tira; devuelve `{ enviado, url }`).

Páginas (cada una con `requireUsuario` de su propia ruta y `notFound()` ante cualquier negativa):
- `app/panel/muestras/[id]/equipo/page.tsx`: título "Equipo de «<muestra>»"; la explicación de los dos roles (`TEAM_ROLE_DESCRIPTIONS`); el dueño arriba ("Responsable"); la lista con estado; `EquipoMuestra` (cliente) con email + selector de rol + "Invitar", y por fila "Reenviar", "Cambiar rol", "Sacar del equipo" (con confirmación). Para integrantes: la lista sin acciones y "Dejar el equipo".
- `components/equipo/equipo-muestra.tsx`: mismo patrón que `EquipoCuratorial` (`useTransition`, `router.refresh()`, enlace con "Copiar enlace" cuando `r.enlace`, con el texto "No pudimos mandar el correo: copiá el enlace y mandáselo por WhatsApp o por mail. Vence en 30 días y sirve una sola vez.").
- `app/panel/equipo/invitacion/[token]/page.tsx`: `export const metadata = { referrer: "no-referrer", robots: { index: false } }`; muestra "<Quien> te invitó a <rol> en «<muestra>»", qué permite el rol, con qué cuenta entraste y el botón "Aceptar" (`AceptarInvitacionEquipo`), que al aceptar lleva a `/panel/muestras/<id>`.
- `app/panel/muestras/[id]/page.tsx`: enlace "Equipo" (para todo rol con `view`).

- [ ] **Step 4: Correr**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: todo en verde.

Prueba local (`pnpm --filter muestras dev`, correo apagado): con la cuenta A (dueña) invitar a la cuenta B como Coorganización → aparece el enlace para copiar; abrirlo con la cuenta C → "Esta invitación es para …"; con B → acepta y ve la muestra en "Mis muestras" con su rol; B edita la ficha y A ve "Último cambio: B, en la ficha…"; A saca a B → B recarga y recibe 404.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: equipo de la muestra — invitar por email (con enlace para copiar si no sale el correo), aceptar con la cuenta invitada, cambiar rol, sacar y dejar el equipo"
```

**Acceptance:** el flujo completo funciona con el correo apagado; un enlace usado no sirve dos veces; un integrante revocado pierde el acceso en el próximo pedido.

---

### Task 8: Rol "Textos y curaduría" — formulario y acción propios

**Files:**
- Create: `apps/muestras/lib/actividades/textos.ts` (+ `.test.ts`), `components/formulario/formulario-textos.tsx`
- Modify: `apps/muestras/lib/limite.ts`, `app/panel/muestras/[id]/page.tsx`

**Interfaces:**
- Consumes: `rolEnMuestra`, `canEditTexts`, `datosDeCambio`, `LARGOS` (`mapear.ts`, para curatorialText 6000 y curatorCredits 300; título de obra con el mismo tope que el editor).
- Produces: `guardarTextos(fd: FormData): Promise<ResultadoAccion>`; freno `guardarTextos` (120/h).

- [ ] **Step 1: Tests que fallan**

`lib/actividades/textos.test.ts`:
```ts
describe("guardarTextos", () => {
  it("TEXT_EDITOR escribe texto curatorial, créditos y textos de obras por id", async () => {
    const r = await guardarTextos(fd({
      id: "a1", editVersion: "2", curatorialText: "Texto", curatorCredits: "Curaduría: Ana",
      obras: JSON.stringify([{ id: "w1", title: "Silos", year: "2024", technique: "Gelatina de plata" }, { id: "ajena", title: "X" }]),
    }));
    expect(r).toEqual({ ok: true, id: "a1" });
    expect(tx.culturalActivity.update.mock.calls[0]![0].data).toMatchObject({
      curatorialText: "Texto", curatorCredits: "Curaduría: Ana", editVersion: { increment: 1 }, lastEditedPart: "TEXTOS",
    });
    // Sólo obras de esta muestra, sólo esos tres campos; nunca imagen, autor, orden ni destacadas.
    expect(tx.culturalActivityWork.updateMany.mock.calls).toEqual([[{
      where: { id: "w1", activityId: "a1" }, data: { title: "Silos", year: 2024, technique: "Gelatina de plata" },
    }]]);
  });
  it("no en revisión; no sin rol; versión vieja → aviso", async () => {});
  it("una obra sin título no se guarda", async () => {
    expect((await guardarTextos(fd({ id: "a1", editVersion: "2", obras: JSON.stringify([{ id: "w1", title: " " }]) }))).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- actividades/textos`
Expected: FAIL.

- [ ] **Step 3: Implementar `lib/actividades/textos.ts`**

```ts
"use server";
/**
 * Textos de la muestra (etapa 5, D9): texto curatorial, créditos y título/año/técnica de cada
 * obra. No reescribe la galería (el editor completo borra y vuelve a crear las obras): actualiza
 * por id y sólo esos campos. Mismos estados que la ficha; publicada, no vuelve a revisión.
 */
export async function guardarTextos(fd: FormData): Promise<ResultadoAccion> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const id = String(fd.get("id") ?? "");
  const version = /^\d{1,9}$/.test(String(fd.get("editVersion") ?? "")) ? Number(fd.get("editVersion")) : null;
  if (!ID.test(id)) return NO_EXISTE;
  if (version == null) return { ok: false, errores: ["La página quedó vieja. Recargala y volvé a guardar."] };
  if (!frenarPorUsuario("guardarTextos", usuario.id).allowed) return { ok: false, errores: ["Guardaste muchas veces seguidas. Esperá unos minutos."] };
  const a = await prisma.culturalActivity.findUnique({
    where: { id },
    select: { id: true, slug: true, type: true, reviewStatus: true, proposedByUserId: true, workspaceId: true, isCancelled: true,
      members: { where: { userId: usuario.id, status: "ACTIVE" }, select: { userId: true, role: true, status: true } } },
  });
  if (!a || a.type !== "MUESTRA") return NO_EXISTE;
  const actor = { userId: usuario.id, isSuperAdmin: usuario.esSuperAdmin, role: activityRole(a, usuario.id) };
  if (!canEditTexts({ ...a, reviewStatus: a.reviewStatus as ReviewStatus }, actor)) return { ok: false, errores: ["No podés editar los textos ahora."] };
  const obras = leerObrasDeTextos(String(fd.get("obras") ?? "[]")); // [{ id, title, year, technique }], hasta MAX_WORKS
  if (obras.some((o) => !o.title)) return { ok: false, errores: ["Cada obra necesita un título."] };
  try {
    await prisma.$transaction(async (tx) => {
      const [fila] = await tx.$queryRaw<{ editVersion: number; lastEditedByUserId: number | null; lastEditedPart: string | null }[]>`
        SELECT "editVersion", "lastEditedByUserId", "lastEditedPart" FROM "CulturalActivity" WHERE id = ${id} FOR UPDATE`;
      if (!fila || fila.editVersion !== version) throw new Choque(fila ?? null);
      await tx.culturalActivity.update({
        where: { id },
        data: { curatorialText: opt(fd, "curatorialText", LARGOS.curatorialText), curatorCredits: opt(fd, "curatorCredits", LARGOS.curatorCredits), editVersion: { increment: 1 }, ...datosDeCambio(usuario.id, "TEXTOS") },
      });
      for (const o of obras) {
        await tx.culturalActivityWork.updateMany({ where: { id: o.id, activityId: id }, data: { title: o.title, year: o.year, technique: o.technique } });
      }
    });
  } catch (err) {
    if (err instanceof Choque) return { ok: false, errores: [await mensajeDeChoque(err.fila)] };
    throw err;
  }
  revalidatePath(`/m/${a.slug}`, "layout");
  revalidatePath(`/panel/muestras/${id}`);
  return { ok: true, id };
}
```
`Choque` y `mensajeDeChoque` se mueven de `acciones.ts` (Task 6) a `lib/actividades/choque.ts` para compartirlos. `opt`/`LARGOS` se exportan de `mapear.ts`. `leerObrasDeTextos` va en `mapear.ts` (con test): año entero 1800–2100 o `null`, técnica hasta el tope del editor.

`components/formulario/formulario-textos.tsx` (cliente): texto curatorial (textarea 6000 con contador), créditos, y una fila por obra con su miniatura (sólo para reconocerla), título, año y técnica; autor en gris como dato ("De Ana Pérez"); `editVersion` escondido; "Guardar textos"; muestra los errores (incluido el del choque) y "Guardado" al terminar con `router.refresh()`.

`app/panel/muestras/[id]/page.tsx`: con `textos` (Task 6) dibuja `<FormularioTextos key={a.updatedAt.toISOString()} inicial={…} />` con una bajada "Tu rol en esta muestra es Textos y curaduría: podés editar el texto curatorial, los créditos y los textos de cada obra." Si el dueño o la coorganización quieren sólo tocar textos, siguen usando la ficha completa.

- [ ] **Step 4: Correr**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: todo en verde.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: rol de textos y curaduría con formulario propio que no toca imágenes, autores ni el orden de las obras"
```

**Acceptance:** con el rol de textos, el id de cada obra no cambia al guardar (el QR impreso sigue andando) y no aparece ningún campo de imagen ni autor.

---

### Task 9: Hora de la inauguración en la ficha y configuración de la asistencia

**Files:**
- Create: `apps/muestras/lib/inauguracion/acciones.ts` (+ `.test.ts`), `lib/inauguracion/consultas.ts`, `components/inauguracion/configurar-inauguracion.tsx`, `app/panel/difusion/[id]/inauguracion/page.tsx` (la parte de configuración; la lista llega en la Task 11)
- Modify: `apps/muestras/lib/actividades/mapear.ts` (+ `.test.ts`), `components/formulario/formulario-actividad.tsx`, `lib/actividades/acciones.ts` (problemas de la inauguración), `lib/limite.ts`, `app/m/[slug]/page.tsx`

**Interfaces:**
- Consumes: `openingAtFrom`, `openingProblems`, `openingWhenText`, `openingHasTime`, `rsvpState`, `isRsvpMode`, `RSVP_LIMITS`, `promoteFromWaitlist` (Task 2); `rolEnMuestra`, `dondePuede`, `datosDeCambio`.
- Produces: en la ficha, `openingClock` y `openingEndClock` (formulario) → `openingAt`, `openingEndsAt`; `guardarInauguracion(fd)` (`rsvpStatus`, `rsvpCapacity`, `rsvpMaxCompanions`, `openingNote`); `cargarInauguracionPanel(id, usuario)`; freno `guardarInauguracion` 60/h.

- [ ] **Step 1: Tests que fallan**

`lib/actividades/mapear.test.ts`: `openingDay: "2026-11-14", openingClock: "19:00", openingEndClock: "21:30"` → `openingAt` = `2026-11-14T22:00Z`, `openingEndsAt` = `2026-11-15T00:30Z`; sin hora → comienzo del día y `openingEndsAt: null`; `datosParaGuardar` no cambia nada más. Un formulario con `openingProblems` no vacíos: `guardarBorrador` devuelve esos errores (test en `acciones.test.ts`).

`lib/inauguracion/acciones.test.ts`:
```ts
describe("guardarInauguracion", () => {
  it("coorganización configura; textos no", async () => {});
  it("valida cupo (1–5000 o vacío), acompañantes (0–9) y nota (300)", async () => {
    expect((await guardarInauguracion(fd({ id: "a1", rsvpStatus: "OPEN", rsvpCapacity: "0" }))).ok).toBe(false);
  });
  it("abrir pide muestra presencial, publicada y con hora de inauguración", async () => {
    // openingAt a las 00:00 → { ok: false, errores: ["Para recibir confirmaciones, cargá la hora de la inauguración en la ficha."] }
  });
  it("subir el cupo pasa gente de la lista de espera, en orden", async () => {
    // espera: [g4(3 acomp.), s1(0)] con 7 confirmadas y cupo 8 → 10: pasa g4? 7+4=11 > 10, no; s1 sí.
    expect(tx.culturalActivityRsvp.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["s1"] }, status: "WAITLIST" }, data: expect.objectContaining({ status: "CONFIRMED" }) });
  });
  it("deja el registro INAUGURACION y no toca editVersion", async () => {});
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- mapear inauguracion/acciones`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`mapear.ts`: `openingClock: opt(fd, "openingClock")`, `openingEndClock: opt(fd, "openingEndClock")` en `FichaForm`; en `datosParaGuardar`:
```ts
    openingAt: f.openingDay && diaValido(f.openingDay) ? openingAtFrom(f.openingDay, f.openingClock) : null,
    openingEndsAt: f.openingDay && diaValido(f.openingDay) && f.openingClock && f.openingEndClock ? openingAtFrom(f.openingDay, f.openingEndClock) : null,
```
`guardarBorrador`: antes de escribir, `const p = openingProblems({ openingDay: f.openingDay, openingClock: f.openingClock, openingEndClock: f.openingEndClock, endDay: f.endDay }); if (p.length) return { ok: false, errores: p };`.

`formulario-actividad.tsx` (fieldset de fechas): al lado de "Inauguración (opcional)", dos `input type="time"` ("Hora", "Hasta, opcional"), con `defaultValue` desde `openingHasTime(inicial.openingAt) ? formatArClock(inicial.openingAt) : ""`. Bajada: "Con la hora, podés pedir confirmación de asistencia y armar la invitación."

`lib/inauguracion/acciones.ts` (`"use server"`):
```ts
export async function guardarInauguracion(fd: FormData): Promise<ResultadoAccion> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const id = String(fd.get("id") ?? "");
  if (!ID.test(id)) return NO_EXISTE;
  if (!frenarPorUsuario("guardarInauguracion", usuario.id).allowed) return { ok: false, errores: ["Esperá unos minutos y volvé a guardar."] };
  const modo = String(fd.get("rsvpStatus") ?? "");
  const cupo = String(fd.get("rsvpCapacity") ?? "").trim();
  const acomp = String(fd.get("rsvpMaxCompanions") ?? "").trim();
  const nota = String(fd.get("openingNote") ?? "").trim();
  const errores: string[] = [];
  if (!isRsvpMode(modo)) errores.push("Elegí si se pide confirmación.");
  const capacidad = cupo === "" ? null : /^\d{1,4}$/.test(cupo) && Number(cupo) >= 1 && Number(cupo) <= RSVP_LIMITS.capacity ? Number(cupo) : Number.NaN;
  if (Number.isNaN(capacidad)) errores.push(`El cupo va de 1 a ${RSVP_LIMITS.capacity} personas, o vacío si no hay cupo.`);
  const maxAcomp = /^\d$/.test(acomp) ? Number(acomp) : Number.NaN;
  if (Number.isNaN(maxAcomp)) errores.push(`Los acompañantes van de 0 a ${RSVP_LIMITS.maxCompanions}.`);
  if (nota.length > RSVP_LIMITS.note) errores.push(`La nota puede tener hasta ${RSVP_LIMITS.note} caracteres.`);
  if (errores.length) return { ok: false, errores };
  return await prisma.$transaction(async (tx) => {
    const a = await tx.culturalActivity.findFirst({
      where: { id, type: "MUESTRA", ...dondePuede(usuario, "rsvp") },
      select: { id: true, slug: true, reviewStatus: true, isVirtualOnly: true, isCancelled: true, openingAt: true },
    });
    if (!a) return NO_EXISTE;
    await tx.$queryRaw`SELECT id FROM "CulturalActivity" WHERE id = ${id} FOR UPDATE`;
    if (modo === "OPEN" && rsvpState({ ...a, type: "MUESTRA", rsvpStatus: "OPEN" }, new Date()) === "UNAVAILABLE") {
      return { ok: false, errores: ["Para recibir confirmaciones, la muestra tiene que estar publicada, ser presencial y tener la hora de la inauguración cargada en la ficha."] };
    }
    await tx.culturalActivity.update({ where: { id }, data: { rsvpStatus: modo, rsvpCapacity: capacidad, rsvpMaxCompanions: maxAcomp, openingNote: nota || null, ...datosDeCambio(usuario.id, "INAUGURACION") } });
    await promoverEnTx(tx, id, capacidad); // lee confirmadas y espera (orden createdAt) y aplica promoteFromWaitlist
    return { ok: true, id };
  }).finally(() => { revalidatePath(`/panel/difusion/${id}/inauguracion`); });
}
```
`promoverEnTx(tx, activityId, capacidad)` va en `lib/inauguracion/cupo.ts` (lo usan también la Task 10 y la 11): suma personas confirmadas, lee la espera en orden, `promoteFromWaitlist`, `updateMany({ where: { id: { in }, status: "WAITLIST" }, data: { status: "CONFIRMED", promotedAt: ahora } })` y devuelve los ids (para el correo "Se liberó un lugar", que se manda **después** de la transacción).

`lib/inauguracion/consultas.ts`: `cargarInauguracionPanel(id, usuario)` con `dondePuede(usuario, "rsvp")`: muestra (`title`, `slug`, `reviewStatus`, `isVirtualOnly`, `isCancelled`, `openingAt`, `openingEndsAt`, `openingNote`, `rsvp*`, `endsAt`) y, desde la Task 11, la lista.

`app/panel/difusion/[id]/inauguracion/page.tsx`: `requireUsuario`, `cargarInauguracionPanel` (si no, `notFound()`); arriba "Inauguración: <openingWhenText>" o, sin hora, un aviso con enlace a la ficha ("Cargá la hora en la ficha"); `ConfigurarInauguracion` (modo con tres opciones y su explicación, cupo, acompañantes, nota); el enlace público para copiar (`/m/<slug>/inauguracion`).

`app/m/[slug]/page.tsx`: la fila "Inauguración" usa `openingWhenText`; si `rsvpState(a, ahora)` es `OPEN`, suma un enlace "Confirmá tu asistencia" a `/m/<slug>/inauguracion`; si es `OFF` y hay hora, "Ver la invitación" al mismo lugar. (`buscarPorSlug` ya trae las columnas nuevas: `include` sin `select`.)

`lib/limite.ts`: `guardarInauguracion: { limit: 60, windowMs: 60 * 60_000 }`.

- [ ] **Step 4: Correr**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: todo en verde.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: hora de la inauguración en la ficha y configuración de la confirmación de asistencia (cupo, acompañantes, nota)"
```

**Acceptance:** una muestra vieja con inauguración "sólo día" sigue mostrando el día sin hora; no se puede abrir la confirmación sin hora.

---

### Task 10: Invitación pública, "Voy", enlace personal y calendario

**Files:**
- Create: `apps/muestras/lib/inauguracion/publicas.ts` (+ `.test.ts`), `lib/inauguracion/cupo.ts` (+ `.test.ts`, si no se creó en la Task 9), `lib/correos/inauguracion.ts`, `lib/correos/textos-inauguracion.ts` (+ `.test.ts`), `components/inauguracion/formulario-asistencia.tsx`, `components/inauguracion/mi-asistencia.tsx`, `app/m/[slug]/inauguracion/page.tsx`, `app/m/[slug]/inauguracion/evento.ics/route.ts` (+ `lib/inauguracion/ics-ruta.test.ts`), `app/m/[slug]/inauguracion/r/[token]/page.tsx`
- Modify: `apps/muestras/lib/limite.ts` (+ `.test.ts`), `lib/inauguracion/consultas.ts`

**Interfaces:**
- Consumes: `rsvpState`, `rsvpInput`, `rsvpProblems`, `rsvpPlacement`, `partySize`, `RSVP_RAW_MAX`, `RSVP_LIMITS`, `openingIcs`, `googleCalendarUrl`, `openingWhenText`; `isTooFast` (`guestbook.ts`); `nuevoTokenDeInvitacion`, `hashDeToken`, `esTokenConForma`; `frenarPorIp`, `frenarPorMuestra`, `ipDeLaPeticion`; `promoverEnTx`; `baseUrlPublica` (`lib/fichas/cargar.ts`).
- Produces: `confirmarAsistencia(fd)` → `{ ok: true; estado: "CONFIRMED" | "WAITLIST"; enlace: string | null } | { ok: false; error }`; `cancelarMiAsistencia(token)`; `invitacionPublica(slug)`, `asistenciaPorToken(token)`; `eventoDeInauguracion(a, base)` → `OpeningEvent`; frenos públicos `asistencia` (10/10 min por muestra), `asistenciaConsultas` (120/10 min), `miAsistencia` (30/10 min); por muestra `asistencia` (300/h).

- [ ] **Step 1: Tests que fallan**

`lib/inauguracion/publicas.test.ts`:
```ts
describe("confirmarAsistencia", () => {
  it("trampa o demasiado rápido: como si nada, sin escribir", async () => {
    expect(await confirmarAsistencia(fd({ muestra: "a1", sitio: "x", t: String(Date.now() - 10_000), nombre: "Ana" }))).toEqual({ ok: true, estado: "CONFIRMED", enlace: null });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("confirma, guarda el hash del token y devuelve el enlace personal una vez", async () => {
    const r = await confirmarAsistencia(fd({ muestra: "a1", t: hace(10), nombre: "Ana Pérez", email: "ana@x.com", acompanantes: "2" }));
    expect(r).toMatchObject({ ok: true, estado: "CONFIRMED" });
    expect(r.ok && r.enlace).toMatch(/^https:\/\/muestrasfotograficas\.com\/m\/rosario\/inauguracion\/r\/[A-Za-z0-9_-]{43}$/);
    const data = tx.culturalActivityRsvp.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ activityId: "a1", name: "Ana Pérez", email: "ana@x.com", companions: 2, status: "CONFIRMED" });
    expect(data.manageTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(data)).not.toMatch(/ip|agent/i);
  });
  it("cupo lleno → lista de espera", async () => { /* confirmadas 9, cupo 10, party 2 → WAITLIST */ });
  it("cerrada, apagada o no disponible", async () => { /* "No se reciben confirmaciones para esta inauguración." */ });
  it("email repetido en la misma muestra (P2002)", async () => {
    expect(await confirmarAsistencia(…)).toEqual({ ok: false, error: "Ese email ya está anotado. Para cambiar la cantidad, cancelá con tu enlace personal y volvé a confirmar." });
  });
  it("tope de 2000 confirmaciones", async () => {});
  it("frenos por IP (después de validar la muestra) y por muestra", async () => {});
});
describe("cancelarMiAsistencia", () => {
  it("token sin forma o desconocido → mismo mensaje", async () => {});
  it("cancela y pasa a la siguiente de la espera", async () => {});
  it("una vez empezada la inauguración ya no se cancela por acá", async () => {});
});
```
`lib/inauguracion/ics-ruta.test.ts`: `GET` de una muestra `OPEN` u `OFF` → `200`, `Content-Type: text/calendar; charset=utf-8`, `Content-Disposition: attachment; filename="inauguracion-<slug>.ics"`, cuerpo con `UID:inauguracion-<id>@…`; `UNAVAILABLE` → 404.

`lib/correos/textos-inauguracion.test.ts`: "Confirmaste tu asistencia a la inauguración de «…»" / "Quedaste en lista de espera…" / "Se liberó un lugar…"; cada uno con día y hora, sede, el enlace personal y el de agendar (`evento.ics`).

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- inauguracion textos-inauguracion limite`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`lib/limite.ts`: en `LIMITES_PUBLICOS`, `asistencia: { limit: 10, windowMs: 10 * 60_000 }`, `asistenciaConsultas: { limit: 120, windowMs: 10 * 60_000 }`, `miAsistencia: { limit: 30, windowMs: 10 * 60_000 }`; en `LIMITES_POR_MUESTRA`, `asistencia: { limit: 300, windowMs: 60 * 60_000 }`.

`lib/inauguracion/publicas.ts` (`"use server"`), lo central:
```ts
const COMO_SI_NADA = { ok: true as const, estado: "CONFIRMED" as const, enlace: null };

export async function confirmarAsistencia(fd: FormData): Promise<ResultadoAsistencia> {
  const activityId = String(fd.get("muestra") ?? "");
  if (!ID.test(activityId)) return { ok: false, error: "No encontramos esta muestra." };
  if (String(fd.get("sitio") ?? "") !== "") return COMO_SI_NADA;
  const t = String(fd.get("t") ?? "");
  if (isTooFast(/^\d{12,14}$/.test(t) ? Number(t) : null, Date.now())) return COMO_SI_NADA;
  const crudo = { name: fd.get("nombre"), email: fd.get("email"), companions: fd.get("acompanantes") };
  if (Object.values(crudo).some((v) => typeof v === "string" && v.length > RSVP_RAW_MAX)) return { ok: false, error: "Revisá los datos: hay un campo demasiado largo." };
  const ip = ipDeLaPeticion(await headers());
  if (!frenarPorIp("asistenciaConsultas", ip).allowed) return { ok: false, error: "Probá de nuevo en unos minutos." };
  const a = await prisma.culturalActivity.findUnique({ where: { id: activityId }, select: SELECT_INVITACION });
  if (!a || rsvpState(a, new Date()) !== "OPEN") return { ok: false, error: "No se reciben confirmaciones para esta inauguración." };
  const entrada = rsvpInput(crudo);
  const problemas = rsvpProblems(entrada, a.rsvpMaxCompanions);
  if (problemas.length) return { ok: false, error: problemas.join(" ") };
  if (!frenarPorIp("asistencia", ip, a.id).allowed) return { ok: false, error: "Desde esta conexión ya se anotaron varias personas. Probá en unos minutos." };
  if (!frenarPorMuestra("asistencia", a.id).allowed) return { ok: false, error: "Llegaron muchas confirmaciones juntas. Probá en un rato." };
  const { token, hash } = nuevoTokenDeInvitacion();
  let estado: "CONFIRMED" | "WAITLIST";
  try {
    estado = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "CulturalActivity" WHERE id = ${a.id} FOR UPDATE`;
      const filas = await tx.culturalActivityRsvp.findMany({ where: { activityId: a.id, status: { in: ["CONFIRMED", "WAITLIST"] } }, select: { status: true, companions: true } });
      if ((await tx.culturalActivityRsvp.count({ where: { activityId: a.id } })) >= RSVP_LIMITS.entries) throw new Corte("No se reciben más confirmaciones para esta inauguración.");
      const e = rsvpPlacement({ capacity: a.rsvpCapacity, confirmedPeople: rsvpTotals(filas).people, party: partySize(entrada.companions) });
      await tx.culturalActivityRsvp.create({ data: { activityId: a.id, name: entrada.name, email: entrada.email, companions: entrada.companions, status: e, manageTokenHash: hash } });
      return e;
    });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") return { ok: false, error: "Ese email ya está anotado. Para cambiar la cantidad, cancelá con tu enlace personal y volvé a confirmar." };
    if (err instanceof Corte) return { ok: false, error: err.message };
    throw err;
  }
  const enlace = `${baseUrlPublica()}/m/${a.slug}/inauguracion/r/${token}`;
  if (entrada.email) await avisarAsistencia({ email: entrada.email, estado, enlace, muestra: a });
  revalidatePath(`/panel/difusion/${a.id}/inauguracion`);
  return { ok: true, estado, enlace };
}
```
`cancelarMiAsistencia(token)`: `esTokenConForma`, freno `miAsistencia`, busca por `manageTokenHash`, verifica que la inauguración no empezó, en transacción con `FOR UPDATE`: `updateMany({ where: { id, status: { not: "CANCELLED" } }, data: { status: "CANCELLED", cancelledAt } })` y `promoverEnTx`; después, correo "Se liberó un lugar" a los promovidos que dejaron email.

`lib/inauguracion/consultas.ts`:
- `invitacionPublica(slug)`: `findFirst({ where: { slug, reviewStatus: "APPROVED" }, select: { id, slug, title, coverImageUrl, organizersText, venueName, address, city, province, latitude, longitude, isVirtualOnly, isCancelled, type, reviewStatus, openingAt, openingEndsAt, openingNote, rsvpStatus, rsvpMaxCompanions, updatedAt } })` — **sin** contar ni leer confirmaciones (la página no muestra cuántos van).
- `asistenciaPorToken(token)`: `{ name, companions, status, muestra: {…} }` (sin email).
- `eventoDeInauguracion(a, base)`: arma `OpeningEvent` (lugar = sede, dirección, ciudad; `url = ${base}/m/${slug}/inauguracion`; `stamp = updatedAt`).

`app/m/[slug]/inauguracion/page.tsx` (`export const dynamic = "force-dynamic"`): `rsvpState` `UNAVAILABLE` → `notFound()`; `generateMetadata` con título "Inauguración: <muestra>" y la portada como imagen; contenido: portada, "Inauguración", título, organiza, `openingWhenText` grande, sede + dirección + `MapaDelLugar` (si hay coordenadas) + "Cómo llegar" (Google Maps `dir/?api=1&destination=lat,lng` u OpenStreetMap, como la ficha), la nota, **Agendar** (`evento.ics` y Google Calendar), y según el estado: `OPEN` → `FormularioAsistencia`; `OFF` → "Entrada libre: no hace falta confirmar."; `CLOSED` → "Ya no se reciben confirmaciones." (cancelada: "Esta actividad se suspendió."). Enlace "Ver la muestra". Debajo del formulario, el aviso de privacidad (D15).

`components/inauguracion/formulario-asistencia.tsx` (cliente): campos nombre, email (optativo, "para avisarte si se libera un lugar"), acompañantes (`select` de 0 a `max`; si `max` es 0, no se muestra), trampa `sitio` oculta y `t` con `Date.now()` al montar (como `formulario-libro.tsx`); al confirmar: "¡Listo! Te esperamos." o "El cupo está completo: quedaste en lista de espera. Si se libera un lugar, te pasamos en orden de llegada." y, con `enlace`, un recuadro de línea fina "Guardá este enlace para ver o cancelar tu lugar" + "Copiar enlace" (y la aclaración "No lo vamos a volver a mostrar").

`app/m/[slug]/inauguracion/r/[token]/page.tsx`: `metadata = { referrer: "no-referrer", robots: { index: false } }`, `dynamic = "force-dynamic"`; token sin forma o desconocido → `notFound()`; muestra "Hola, <nombre>", el estado, los datos de la inauguración, "Agendar" y `MiAsistencia` ("No voy a poder ir", con confirmación).

`app/m/[slug]/inauguracion/evento.ics/route.ts`: `GET` con `params: Promise<{ slug: string }>`; `invitacionPublica`; `UNAVAILABLE` → 404; `new Response(openingIcs(evento), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": \`attachment; filename="inauguracion-${slug}.ics"\`, "Cache-Control": "public, max-age=300" } })`.

`lib/correos/inauguracion.ts`: `avisarAsistencia` y `avisarLugarLiberado` con `enviar(...)` (nunca tiran; devuelven `boolean`).

- [ ] **Step 4: Correr**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: todo en verde.

Prueba local (correo apagado): abrir la confirmación de una muestra publicada con hora; en ventana privada confirmar con 2 acompañantes → aparece el enlace personal; abrirlo → "Confirmada"; con cupo 3 una segunda confirmación de 1 persona → "lista de espera"; cancelar la primera desde su enlace → la segunda pasa a "Confirmada" (recargar su enlace). Descargar el `.ics` y abrirlo en el calendario del teléfono: 19:00 hora argentina. A 375 px, sin scroll horizontal.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: invitación pública a la inauguración con confirmación sin cuenta, lista de espera, enlace personal para cancelar y archivo de calendario"
```

**Acceptance:** dos confirmaciones simultáneas no pasan el cupo (transacción con bloqueo); la página pública no muestra nombres, emails ni cantidades; todo anda con el correo apagado.

---

### Task 11: Lista para el equipo, CSV y borrado a los 30 días

**Files:**
- Create: `apps/muestras/lib/inauguracion/limpieza.ts` (+ `.test.ts`), `components/inauguracion/lista-asistencia.tsx`, `app/api/inauguracion/[id]/csv/route.ts` (+ `lib/inauguracion/csv-ruta.test.ts`), `app/api/cron/asistencias/route.ts` (+ `lib/inauguracion/cron-ruta.test.ts`), `apps/muestras/lib/llave-de-servicio.ts` (+ `.test.ts`, copia de `apps/subilafoto/lib/llave-de-servicio.ts`)
- Modify: `apps/muestras/lib/inauguracion/acciones.ts` (+ `.test.ts`), `lib/inauguracion/consultas.ts`, `app/panel/difusion/[id]/inauguracion/page.tsx`, `app/panel/layout.tsx`, `apps/muestras/vercel.json`, `lib/limite.ts`

**Interfaces:**
- Consumes: `rsvpTotals`, `rsvpCsv`, `rsvpPurgeDue`, `RSVP_RETENTION_DAYS`, `promoverEnTx`, `dondePuede`; `after` de `next/server`.
- Produces: `cambiarAsistencia(rsvpId, accion: "cancel" | "confirm" | "waitlist")`, `cerrarConfirmaciones(activityId)`; `purgarAsistencias(activityId, ahora)`, `barrerAsistenciasVencidas(ahora, { tope })`, `barrerSiToca(ahora)` (una vez cada 6 h por instancia); frenos `gestionarAsistencias` (600/10 min) y `exportarAsistencias` (30/h).

- [ ] **Step 1: Tests que fallan**

`lib/inauguracion/limpieza.test.ts`:
```ts
describe("purgarAsistencias", () => {
  it("borra las filas y deja el resumen, una sola vez", async () => {
    db.culturalActivityRsvp.findMany.mockResolvedValue([{ status: "CONFIRMED", companions: 2 }, { status: "WAITLIST", companions: 0 }]);
    await purgarAsistencias("a1", new Date("2027-01-15T12:00:00Z"));
    expect(tx.culturalActivity.updateMany).toHaveBeenCalledWith({
      where: { id: "a1", rsvpPurgedAt: null },
      data: { rsvpSummary: { confirmed: 1, people: 3, waitlist: 1, waitlistPeople: 1, cancelled: 0 }, rsvpPurgedAt: new Date("2027-01-15T12:00:00Z") },
    });
    expect(tx.culturalActivityRsvp.deleteMany).toHaveBeenCalledWith({ where: { activityId: "a1" } });
  });
});
describe("barrerAsistenciasVencidas", () => {
  it("busca muestras cerradas hace más de 30 días con datos, hasta el tope", async () => {
    await barrerAsistenciasVencidas(new Date("2027-01-15T12:00:00Z"), { tope: 50 });
    expect(db.culturalActivity.findMany.mock.calls[0]![0]).toMatchObject({
      where: { endsAt: { lt: new Date("2026-12-16T12:00:00Z") }, rsvpPurgedAt: null, rsvps: { some: {} } }, take: 50,
    });
  });
  it("barrerSiToca: una vez cada 6 h por instancia", async () => {});
});
```
`lib/inauguracion/cron-ruta.test.ts`: sin `CRON_SECRET` → 503; llave equivocada → 401; correcta → 200 con `{ muestras: n }`.
`lib/inauguracion/csv-ruta.test.ts`: sin sesión → redirige a `/login?next=/panel/difusion`; `TEXT_EDITOR` → 404; coorganización → 200, `text/csv; charset=utf-8`, `attachment; filename="asistencia-<slug>.csv"`, `Cache-Control: private, no-store`; datos ya borrados → 404 con "Los datos de asistencia se borraron 30 días después del cierre de la muestra."; freno → 429.
En `acciones.test.ts`: `cambiarAsistencia` (confirmar a mano aunque pase el cupo; cancelar promueve; pasar a espera), `cerrarConfirmaciones` (`rsvpStatus: "CLOSED"`), ambas con `dondePuede(usuario, "rsvp")`.

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- inauguracion llave-de-servicio`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`lib/inauguracion/limpieza.ts`:
```ts
import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { RSVP_RETENTION_DAYS, rsvpPurgeDue, rsvpTotals } from "@repo/muestras";

const DIA = 24 * 60 * 60 * 1000;

/** Borra los datos personales de la asistencia y deja sólo los totales (D21). Idempotente. */
export async function purgarAsistencias(activityId: string, ahora: Date): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const filas = await tx.culturalActivityRsvp.findMany({ where: { activityId }, select: { status: true, companions: true } });
    const { count } = await tx.culturalActivity.updateMany({
      where: { id: activityId, rsvpPurgedAt: null },
      data: { rsvpSummary: rsvpTotals(filas) as unknown as Prisma.InputJsonValue, rsvpPurgedAt: ahora },
    });
    // Si ya estaba marcada (otra limpieza en paralelo), igual se borra lo que haya quedado.
    void count;
    await tx.culturalActivityRsvp.deleteMany({ where: { activityId } });
  });
}

export async function barrerAsistenciasVencidas(ahora: Date, { tope = 50 }: { tope?: number } = {}): Promise<number> {
  const vencidas = await prisma.culturalActivity.findMany({
    where: { endsAt: { lt: new Date(ahora.getTime() - RSVP_RETENTION_DAYS * DIA) }, rsvpPurgedAt: null, rsvps: { some: {} } },
    select: { id: true, endsAt: true }, take: tope,
  });
  for (const a of vencidas) if (rsvpPurgeDue(a.endsAt, ahora)) await purgarAsistencias(a.id, ahora);
  return vencidas.length;
}

let ultimaPasada = 0;
/** Limpieza perezosa: como mucho una vez cada 6 h por instancia (D22). */
export async function barrerSiToca(ahora: Date = new Date()): Promise<void> {
  if (ahora.getTime() - ultimaPasada < 6 * 60 * 60 * 1000) return;
  ultimaPasada = ahora.getTime();
  try { await barrerAsistenciasVencidas(ahora); } catch (err) { console.error("[asistencia] limpieza:", err instanceof Error ? err.message : String(err)); }
}
```
(`purgarAsistencias` borra aunque la muestra tenga `rsvpPurgedAt` puesto: una confirmación no puede entrar después del cierre, pero si existiera, igual se borra.)

`app/panel/layout.tsx`: `after(() => barrerSiToca())` (importar `after` de `next/server`; no bloquea la página).

`cargarInauguracionPanel` (Task 9) suma: si `rsvpPurgeDue(a.endsAt, ahora)` y `!a.rsvpPurgedAt` → `await purgarAsistencias(a.id, ahora)` **antes** de leer la lista; después lee `rsvps` (`orderBy: [{ status: "asc" }, { createdAt: "asc" }]`, `take: 2000`, `select: { id, name, email, companions, status, createdAt, promotedAt }`) y `rsvpTotals`.

`app/panel/difusion/[id]/inauguracion/page.tsx`: debajo de la configuración, totales ("142 personas en 97 confirmaciones · 12 en lista de espera"), "Bajar la lista (CSV)", "Cerrar confirmaciones" y `ListaAsistencia` (tabla en pantallas anchas, tarjetas a 375 px; acciones por fila; quien pasó de la espera con la marca "Pasó de la lista de espera el …" para avisarle por email si lo dejó). Con los datos borrados: "Los datos personales se borraron el <fecha>, 30 días después del cierre. Confirmaron <people> personas." Siempre visible: "Esta lista la ven sólo vos y la coorganización. Se borra 30 días después del cierre de la muestra (el <fecha>)."

`app/api/inauguracion/[id]/csv/route.ts`: `runtime = "nodejs"`, `dynamic = "force-dynamic"`; `getUsuario` (sin sesión → `/login?next=/panel/difusion`); freno `exportarAsistencias`; `prisma.culturalActivity.findFirst({ where: { id, type: "MUESTRA", ...dondePuede(usuario, "rsvp") }, select: { slug, endsAt, rsvpPurgedAt, rsvps: {…} } })`; purga si toca; `new Response(rsvpCsv(filas), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": \`attachment; filename="asistencia-${slug}.csv"\`, "Cache-Control": "private, no-store" } })`.

`app/api/cron/asistencias/route.ts`: `GET(req)`: `const rechazo = rechazoDeLlave(req); if (rechazo) return rechazo;` → `Response.json({ muestras: await barrerAsistenciasVencidas(new Date(), { tope: 500 }) })`; `maxDuration = 60`.

`apps/muestras/vercel.json`: sumar
```json
  "crons": [{ "path": "/api/cron/asistencias", "schedule": "0 9 * * *" }]
```
(09:00 UTC = 06:00 en Argentina. **Sin `CRON_SECRET` en Vercel la ruta responde 503 y no borra nada**: la limpieza perezosa sigue funcionando. Encenderla es decisión de Daniel, Task 14.)

`lib/limite.ts`: `gestionarAsistencias: { limit: 600, windowMs: 10 * 60_000 }`, `exportarAsistencias: { limit: 30, windowMs: 60 * 60_000 }`.

- [ ] **Step 4: Correr**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: todo en verde.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: lista de asistencia para el equipo, CSV para Excel y borrado de los datos personales a los 30 días del cierre"
```

**Acceptance:** el CSV abre en Excel (configuración argentina) con tildes y columnas separadas; una muestra cerrada hace 31 días no muestra nombres ni emails en ninguna pantalla.

---

### Task 12: Motor de piezas para redes (fuente, texto, QR, composición, PDF)

**Files:**
- Create: `apps/muestras/assets/fonts/Archivo-Regular.ttf`, `Archivo-Bold.ttf`, `OFL.txt`; `apps/muestras/lib/redes/fuentes.ts`, `lib/redes/texto.ts` (+ `.test.ts`), `lib/redes/qr.ts` (+ `.test.ts`), `lib/redes/componer.ts` (+ `.test.ts`), `lib/redes/pdf.ts` (+ `.test.ts`)
- Modify: `apps/muestras/next.config.ts`

**Interfaces:**
- Consumes: `socialLayout`, `socialTexts`, `isPrintFormat`, `PRINT_SIZES_MM` (Task 3); `leerBytesDeR2`; `MAX_PIXELES`; `matrizDelQr` (`lib/fichas/qr.ts`); `tramosOscuros`, `MM` (`lib/piezas/dibujo.ts`).
- Produces: `rutaDeFuente(peso: "normal" | "negrita")`, `FAMILIA`; `capaDeTexto({ texto, tamano, peso, color, ancho, interlineado? })` → `{ input: Buffer; width; height }` (falla cerrada); `tituloQueEntra(texto, tamaños, ancho, altoMax, color)`; `qrSvg(url, lado)` → `Buffer`; `armarPiezaRedes(p: { muestra; obra; formato; variante; urlInvitacion; ahora })` → `Promise<Buffer>` (JPEG); `invitacionImprimible(jpg, formato)` → `Promise<Uint8Array>` (PDF).

- [ ] **Step 1: Sumar las fuentes (necesita autorización para descargar)**

Pedir al usuario permiso para descargar del repositorio oficial de Archivo (Omnibus-Type, licencia OFL) los archivos estáticos `Archivo-Regular.ttf` y `Archivo-Bold.ttf` (≈ 100–200 KB cada uno) y `OFL.txt`, desde `https://github.com/Omnibus-Type/Archivo/tree/master/fonts/ttf`. Guardarlos en `apps/muestras/assets/fonts/`. Verificar:

Run: `for f in apps/muestras/assets/fonts/*.ttf; do head -c 4 "$f" | xxd -p; done`
Expected: `00010000` (TrueType) en los dos.

**Si no se pueden conseguir** (o el usuario no autoriza la descarga): `cp apps/fotorank/assets/fonts/Roboto-Regular.ttf apps/muestras/assets/fonts/` y en `fuentes.ts` usar Roboto para los dos pesos (`FAMILIA = "Roboto"`, sin negrita real: Pango la sintetiza). Anotarlo en el PR.

`next.config.ts`, en `outputFileTracingIncludes`:
```ts
    "/api/redes/**": ["./assets/fonts/**"],
```

- [ ] **Step 2: Tests que fallan**

`lib/redes/texto.test.ts` (sin mocks: usa `sharp` y la fuente real; **es la prueba de que el texto sale sin fuentes del sistema configuradas**):
```ts
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { capaDeTexto, tituloQueEntra } from "./texto";

const visibles = async (png: Buffer) => {
  const { data } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i]! > 32) n++;
  return n;
};

describe("capas de texto con la fuente del repo", () => {
  it("dibuja tildes y ñ, en blanco, con píxeles visibles", async () => {
    const c = await capaDeTexto({ texto: "Inauguración — ñandú", tamano: 64, peso: "negrita", color: "#ffffff", ancho: 900 });
    expect(c.width).toBeGreaterThan(300);
    expect(await visibles(c.input)).toBeGreaterThan(2000);
  });
  it("parte en líneas al ancho y crece en alto", async () => {
    const una = await capaDeTexto({ texto: "Rosario", tamano: 60, peso: "normal", color: "#fff", ancho: 600 });
    const varias = await capaDeTexto({ texto: "Una línea muy larga que tiene que partirse en varias líneas para entrar", tamano: 60, peso: "normal", color: "#fff", ancho: 600 });
    expect(varias.width).toBeLessThanOrEqual(600);
    expect(varias.height).toBeGreaterThan(una.height * 2);
  });
  it("la negrita es más ancha que la normal", async () => {
    const n = await capaDeTexto({ texto: "Inaugura", tamano: 80, peso: "normal", color: "#fff", ancho: 1000 });
    const b = await capaDeTexto({ texto: "Inaugura", tamano: 80, peso: "negrita", color: "#fff", ancho: 1000 });
    expect(b.width).toBeGreaterThan(n.width);
  });
  it("escapa el markup de Pango", async () => {
    await expect(capaDeTexto({ texto: "B&N <2026>", tamano: 40, peso: "normal", color: "#fff", ancho: 600 })).resolves.toBeTruthy();
  });
  it("título: prueba tamaños de mayor a menor hasta entrar; si no, corta con …", async () => {
    const corto = await tituloQueEntra("Silos", [84, 72, 62], 900, 300, "#fff");
    expect(corto.tamano).toBe(84);
    const largo = await tituloQueEntra("x ".repeat(300), [84, 72, 62], 900, 300, "#fff");
    expect(largo.tamano).toBe(62);
    expect(largo.capa.height).toBeLessThanOrEqual(300);
  });
  it("texto vacío: error (nunca una pieza sin texto)", async () => {
    await expect(capaDeTexto({ texto: "   ", tamano: 40, peso: "normal", color: "#fff", ancho: 600 })).rejects.toThrow();
  });
});
```
`lib/redes/qr.test.ts`: `qrSvg("https://muestrasfotograficas.com/m/x/inauguracion", 230)` pasado por `sharp` da 230×230, esquinas blancas (margen) y módulos negros.
`lib/redes/componer.test.ts` (mock de `@/lib/imagenes/r2` con una imagen hecha con `sharp({ create })`): cada formato da un JPEG de las medidas exactas; la banda de abajo es del color tinta (muestrear un píxel del borde de la banda lejos del texto); una obra apaisada en `WORK` no se recorta (muestrear las franjas superior e inferior de la caja de la foto: fondo oscuro); sin foto (R2 devuelve `null`) sale igual, con la caja de la foto en color superficie; `INVITATION` tiene el QR (región blanca en `l.qr`).
`lib/redes/pdf.test.ts`: el PDF de A6 tiene 1 página de 105 × 148 mm (± 0,5 pt) con la imagen embebida.

- [ ] **Step 3: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- redes`
Expected: FAIL.

- [ ] **Step 4: Implementar**

`lib/redes/fuentes.ts`:
```ts
import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Fuente de las piezas para redes (D26–D27): archivos del repo, nunca del sistema (en Vercel no
 * hay). `process.cwd()` es apps/muestras en Next y en Vercel; los tests también corren desde ahí.
 */
export const FAMILIA = "Archivo";
const ARCHIVOS = { normal: "Archivo-Regular.ttf", negrita: "Archivo-Bold.ttf" } as const;
const cache = new Map<string, string>();

export function rutaDeFuente(peso: keyof typeof ARCHIVOS): string {
  const hit = cache.get(peso);
  if (hit) return hit;
  for (const base of [process.cwd(), path.join(process.cwd(), "apps", "muestras")]) {
    const ruta = path.join(base, "assets", "fonts", ARCHIVOS[peso]);
    if (fs.existsSync(ruta)) { cache.set(peso, ruta); return ruta; }
  }
  throw new Error(`Falta la fuente de las piezas (assets/fonts/${ARCHIVOS[peso]}).`);
}
```

`lib/redes/texto.ts`:
```ts
import "server-only";
import sharp from "sharp";
import { FAMILIA, rutaDeFuente } from "./fuentes";

const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const MIN_VISIBLES = 20;

export type Capa = { input: Buffer; width: number; height: number };

/**
 * Una capa RGBA con el texto, dibujada por Pango con el archivo de fuente (`fontfile`). No se usa
 * `<text>` en SVG: librsvg ignora @font-face y en Vercel no hay fuentes del sistema. Falla cerrada:
 * sin píxeles visibles, error.
 */
export async function capaDeTexto(o: { texto: string; tamano: number; peso: "normal" | "negrita"; color: string; ancho: number; interlineado?: number }): Promise<Capa> {
  const t = o.texto.trim();
  if (!t) throw new Error("Texto vacío.");
  const { data, info } = await sharp({
    text: {
      text: `<span foreground="${o.color}">${escapar(t)}</span>`,
      font: `${FAMILIA}${o.peso === "negrita" ? " Bold" : ""} ${o.tamano}px`,
      fontfile: rutaDeFuente(o.peso),
      width: o.ancho, wrap: "word", rgba: true, dpi: 72,
      spacing: Math.round(o.tamano * ((o.interlineado ?? 1.15) - 1)),
    },
  }).png().toBuffer({ resolveWithObject: true });
  const crudo = await sharp(data).raw().toBuffer();
  let n = 0;
  for (let i = 3; i < crudo.length && n < MIN_VISIBLES; i += 4) if (crudo[i]! > 32) n++;
  if (n < MIN_VISIBLES) throw new Error("El texto no se dibujó.");
  return { input: data, width: info.width, height: info.height };
}

/** Prueba los tamaños de mayor a menor; con el menor, recorta palabras y suma "…" hasta entrar. */
export async function tituloQueEntra(texto: string, tamanos: readonly number[], ancho: number, altoMax: number, color: string): Promise<{ capa: Capa; tamano: number }> {
  for (const tamano of tamanos) {
    const capa = await capaDeTexto({ texto, tamano, peso: "negrita", color, ancho, interlineado: 1.05 });
    if (capa.height <= altoMax) return { capa, tamano };
  }
  const menor = tamanos.at(-1)!;
  let palabras = texto.trim().split(/\s+/);
  while (palabras.length > 1) {
    palabras = palabras.slice(0, Math.max(1, Math.floor(palabras.length * 0.8)));
    const capa = await capaDeTexto({ texto: `${palabras.join(" ")}…`, tamano: menor, peso: "negrita", color, ancho, interlineado: 1.05 });
    if (capa.height <= altoMax) return { capa, tamano: menor };
  }
  return { capa: await capaDeTexto({ texto: `${palabras[0]!.slice(0, 20)}…`, tamano: menor, peso: "negrita", color, ancho }), tamano: menor };
}
```

`lib/redes/qr.ts`:
```ts
import "server-only";
import { matrizDelQr } from "@/lib/fichas/qr";
import { tramosOscuros } from "@/lib/piezas/dibujo";

/** QR en SVG con rectángulos (librsvg los dibuja sin fuentes) y margen blanco de 4 módulos. */
export function qrSvg(url: string, lado: number): Buffer {
  const m = matrizDelQr(url);
  const total = m.length + 8;
  const rects = tramosOscuros(m).map((t) => `<rect x="${t.col + 4}" y="${t.fila + 4}" width="${t.largo}" height="1"/>`).join("");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#fff"/><g fill="#000">${rects}</g></svg>`);
}
```
(Verificar la forma exacta que devuelve `tramosOscuros` —`{ fila, col, largo }` horizontales— y ajustar.)

`lib/redes/componer.ts`, lo central:
```ts
const TINTA = "#1c2b35", SUPERFICIE = "#f2f3f4", OSCURO = "#11181d", SPOT = "#e0a526", CLARO = "#d5dade";

export async function armarPiezaRedes(p: {
  muestra: SocialActivity & { slug: string; coverImageUrl: string | null };
  obra: { title: string; authorName: string; year: number | null; imageUrl: string } | null;
  formato: SocialFormat; variante: SocialVariant; urlInvitacion: string;
}): Promise<Buffer> {
  const l = socialLayout(p.formato, p.variante);
  const t = socialTexts(p.variante, p.muestra, p.obra);
  const capas: sharp.OverlayOptions[] = [];
  // 1. Foto: la obra entera (contain, nunca se recorta) o la portada llenando su caja.
  const url = p.variante === "WORK" ? p.obra?.imageUrl ?? null : p.muestra.coverImageUrl;
  const bytes = url ? await leerBytesDeR2(url) : null;
  if (bytes) {
    const foto = await sharp(bytes, { limitInputPixels: MAX_PIXELES }).rotate()
      .resize(p.variante === "WORK"
        ? { width: l.photo.width - 2 * l.padding, height: l.photo.height - 2 * l.padding, fit: "inside", withoutEnlargement: false }
        : { width: l.photo.width, height: l.photo.height, fit: "cover", position: sharp.strategy.attention })
      .toColourspace("srgb").toBuffer({ resolveWithObject: true });
    capas.push({ input: foto.data, left: Math.round((l.photo.width - foto.info.width) / 2), top: Math.round((l.photo.height - foto.info.height) / 2) });
  }
  // 2. Banda de tinta.
  capas.push({ input: { create: { width: l.band.width, height: l.band.height, channels: 3, background: TINTA } }, left: 0, top: l.band.y });
  // 3. Textos apilados: antetítulo, título (el que entre), datos; el pie va abajo.
  let y = l.textTop;
  const kicker = await capaDeTexto({ texto: t.kicker.toUpperCase(), tamano: l.kickerSize, peso: "negrita", color: SPOT, ancho: l.textWidth });
  capas.push({ input: kicker.input, left: l.textLeft, top: y }); y += kicker.height + l.gap;
  const pie = await capaDeTexto({ texto: t.footer, tamano: l.footerSize, peso: "normal", color: CLARO, ancho: l.textWidth });
  const pieTop = l.textBottom - pie.height;
  const datos = await capaDeTexto({ texto: t.details.join("\n"), tamano: l.detailSize, peso: "normal", color: "#ffffff", ancho: l.textWidth, interlineado: 1.3 });
  const altoTitulo = pieTop - l.gap - datos.height - l.gap - y;
  const titulo = await tituloQueEntra(t.title, l.titleSizes, l.textWidth, Math.max(altoTitulo, l.titleSizes.at(-1)!), "#ffffff");
  capas.push({ input: titulo.capa.input, left: l.textLeft, top: y }); y += titulo.capa.height + l.gap;
  capas.push({ input: datos.input, left: l.textLeft, top: Math.min(y, pieTop - l.gap - datos.height) });
  capas.push({ input: pie.input, left: l.textLeft, top: pieTop });
  if (l.qr) capas.push({ input: qrSvg(p.urlInvitacion, l.qr.width), left: l.qr.x, top: l.qr.y });
  return sharp({ create: { width: l.width, height: l.height, channels: 3, background: p.variante === "WORK" ? OSCURO : SUPERFICIE } })
    .composite(capas).jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toBuffer();
}
```
(Los datos se calculan antes que el título para saber cuánto alto le queda; si el texto de los datos solo ya no entra, se recorta a las dos primeras líneas. `"\n"` dentro del markup de Pango es un salto de línea.)

`lib/redes/pdf.ts`:
```ts
export async function invitacionImprimible(jpg: Buffer, formato: "A6" | "A5"): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const { width, height } = PRINT_SIZES_MM[formato];
  const pagina = pdf.addPage([width * MM, height * MM]);
  const img = await pdf.embedJpg(jpg);
  pagina.drawImage(img, { x: 0, y: 0, width: width * MM, height: height * MM });
  pdf.setTitle("Invitación a la inauguración");
  pdf.setCreationDate(new Date(0)); pdf.setModificationDate(new Date(0));
  return pdf.save();
}
```

- [ ] **Step 5: Correr**

Run: `pnpm --filter muestras test -- redes && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: todo en verde (en la consola puede aparecer `Fontconfig error: Cannot load default config file`: es esperado e inofensivo). Guardar una pieza de cada formato en el scratchpad y mirarlas.

- [ ] **Step 6: Commit**

```bash
git add apps/muestras/assets apps/muestras/lib/redes apps/muestras/next.config.ts
git commit -m "Muestras: motor de piezas para redes con sharp — texto con la fuente del repo (sin depender de fuentes del sistema), QR y PDF para imprimir"
```

**Acceptance:** el test de `texto.ts` dibuja con la fuente del repo y falla si no hay píxeles; ninguna obra se recorta; la historia respeta las zonas seguras.

---

### Task 13: Ruta `/api/redes` y sección "Difusión" del panel

**Files:**
- Create: `apps/muestras/lib/redes/cargar.ts`, `app/api/redes/[id]/route.ts` (+ `lib/redes/ruta.test.ts`), `components/difusion/piezas-redes.tsx`, `components/difusion/estilos.ts`, `app/panel/difusion/page.tsx`, `app/panel/difusion/[id]/page.tsx`
- Modify: `apps/muestras/lib/limite.ts`, `app/panel/muestras/[id]/page.tsx` (enlace "Difusión"), `app/privacidad/page.tsx`

**Interfaces:**
- Consumes: `armarPiezaRedes`, `invitacionImprimible` (Task 12); `availableSocialVariants`, `recommendedVariant`, `isFormatAllowed`, `SOCIAL_FORMAT_PARAMS`, `SOCIAL_VARIANT_PARAMS`, `socialFileName`, `SOCIAL_*_LABELS` (Task 3); `dondePuede`; `errorEnTexto` (`lib/piezas/entregar.ts`); `baseUrlPublica`.
- Produces: `cargarMuestraParaRedes(id, usuario)`; `listarMuestrasParaDifusion(usuario)`; `GET /api/redes/[id]`; freno `redes` (120/10 min).

- [ ] **Step 1: Tests que fallan**

`lib/redes/ruta.test.ts` (mock de `@repo/db`, `@/lib/usuario` y `./componer`/`./pdf`):
```ts
describe("GET /api/redes/[id]", () => {
  it("sin sesión → a ingresar", async () => { /* 307 a /login?next=%2Fpanel%2Fdifusion */ });
  it("formato o variante desconocidos, o A6 de algo que no es invitación → 404", async () => {});
  it("coorganización sí; textos o ajeno → 404 (el where lleva dondePuede promote y APPROVED)", async () => {
    await GET(pedido("a1", "?formato=post&variante=inaugura"), ctx("a1"));
    expect(db.culturalActivity.findFirst.mock.calls[0]![0].where).toEqual({ id: "a1", type: "MUESTRA", reviewStatus: "APPROVED", ...dondePuede(usuario, "promote") });
  });
  it("variante fuera de su momento → 404 con explicación", async () => { /* "Esta pieza ya no está disponible: la inauguración ya pasó." */ });
  it("obra de otra muestra → 404", async () => {});
  it("JPEG con nombre de archivo y caché privada; ?descargar=1 → attachment", async () => {
    const r = await GET(pedido("a1", "?formato=historia&variante=ultimos-dias&descargar=1"), ctx("a1"));
    expect(r.headers.get("content-type")).toBe("image/jpeg");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="muestra-rosario-ultimos-dias-historia.jpg"');
    expect(r.headers.get("cache-control")).toBe("private, max-age=300");
  });
  it("A6 → PDF", async () => {});
  it("si el texto no se dibujó → 500 en texto, nunca una imagen", async () => {});
  it("freno → 429", async () => {});
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter muestras test -- redes/ruta`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`lib/redes/cargar.ts`: `cargarMuestraParaRedes(id, usuario)` → `prisma.culturalActivity.findFirst({ where: { id, type: "MUESTRA", reviewStatus: "APPROVED", ...dondePuede(usuario, "promote") }, select: { id, slug, title, type, reviewStatus, isCancelled, isVirtualOnly, startsAt, endsAt, openingAt, openingEndsAt, venueName, city, province, coverImageUrl, works: { orderBy: { sortOrder: "asc" }, select: { id, title, authorName, year, imageUrl, isHighlight } } } })`; `listarMuestrasParaDifusion(usuario)` con `dondePuede(usuario, "promote", { listado: true })` y `type: "MUESTRA"`, `reviewStatus: { in: ["APPROVED", "IN_REVIEW", "DRAFT"] }` (las no publicadas aparecen con "Las piezas se arman cuando la muestra esté publicada").

`app/api/redes/[id]/route.ts`:
```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuario();
  if (!usuario) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/panel/difusion")}`, req.url), 307);
  const { id } = await params;
  const q = new URL(req.url).searchParams;
  const formato = SOCIAL_FORMAT_PARAMS[q.get("formato") ?? ""];
  const variante = SOCIAL_VARIANT_PARAMS[q.get("variante") ?? ""];
  if (!formato || !variante || !isFormatAllowed(variante, formato)) return errorEnTexto("Esa pieza no existe.", 404);
  if (!frenarPorUsuario("redes", usuario.id).allowed) return errorEnTexto("Pediste muchas piezas seguidas. Esperá unos minutos.", 429);
  const a = await cargarMuestraParaRedes(id, usuario);
  if (!a) return errorEnTexto("No encontramos esa muestra entre las tuyas. Las piezas para redes piden la muestra publicada.", 404);
  const ahora = new Date();
  const muestra = { ...a, worksCount: a.works.length };
  if (!availableSocialVariants(muestra, ahora).includes(variante)) return errorEnTexto(motivoNoDisponible(variante), 404);
  const obra = variante === "WORK" ? a.works.find((w) => w.id === q.get("obra")) ?? a.works.find((w) => w.isHighlight) ?? a.works[0] ?? null : null;
  if (variante === "WORK" && q.get("obra") && obra?.id !== q.get("obra")) return errorEnTexto("Esa obra no es de esta muestra.", 404);
  try {
    const jpg = await armarPiezaRedes({ muestra, obra, formato, variante, urlInvitacion: `${baseUrlPublica()}/m/${a.slug}/inauguracion` });
    const pdf = isPrintFormat(formato);
    const cuerpo = pdf ? await invitacionImprimible(jpg, formato) : jpg;
    const nombre = socialFileName(a.slug, variante, formato);
    return new Response(cuerpo, { headers: {
      "Content-Type": pdf ? "application/pdf" : "image/jpeg",
      "Content-Disposition": `${q.get("descargar") === "1" || pdf ? "attachment" : "inline"}; filename="${nombre}"`,
      "Cache-Control": "private, max-age=300",
    } });
  } catch (err) {
    console.error("GET /api/redes:", err instanceof Error ? err.message : String(err));
    return errorEnTexto("No pudimos armar la pieza. Probá de nuevo.", 500);
  }
}
```
(`motivoNoDisponible`: "La inauguración ya pasó." para `OPENING`/`INVITATION` —o "Cargá la hora de la inauguración en la ficha." si no tiene hora—, "La muestra ya cerró." para `LAST_DAYS`, "La muestra todavía no tiene obras." para `WORK`.)

`lib/limite.ts`: `redes: { limit: 120, windowMs: 10 * 60_000 }`.

`app/panel/difusion/page.tsx`: `requireUsuario("/panel/difusion")`; título "Difusión"; bajada "Piezas para redes, invitación a la inauguración y confirmación de asistencia de tus muestras."; lista de `listarMuestrasParaDifusion` con, por fila, la variante recomendada ("Hoy conviene: Últimos días") y enlaces "Piezas" e "Inauguración".

`app/panel/difusion/[id]/page.tsx`: `requireUsuario(\`/panel/difusion/${id}\`)`; `cargarMuestraParaRedes` (si `null` y la muestra existe para el usuario pero no está publicada, la página igual se muestra con el aviso; si no tiene `promote`, `notFound()`); secciones:
1. **Piezas para redes**: `PiezasRedes` (cliente) con las variantes disponibles (la recomendada elegida), el formato (posteo, historia, cuadrado), la obra (sólo `WORK`, un `select` con las obras, destacadas primero), una vista previa `<img src="/api/redes/<id>?formato=…&variante=…&obra=…" loading="lazy">` (con `alt` descriptivo, ancho máximo 360 px, y "Armando la pieza…" mientras carga) y el botón "Descargar" (misma dirección con `&descargar=1`). Debajo: "Instagram recomprime las imágenes: subila tal cual, sin recortar."
2. **Invitación**: si `INVITATION` está disponible, los tres formatos para redes + "Para imprimir A6" y "A5" (PDF). Si no tiene hora: "Cargá la hora de la inauguración en la ficha para armar la invitación."
3. **Inauguración**: estado de la confirmación (`RSVP_MODE_LABELS`), el enlace público para copiar y "Ver la lista y configurar" (si tiene `rsvp`).

`app/panel/muestras/[id]/page.tsx`: enlace "Difusión" con `promote`.

`app/privacidad/page.tsx`: sumar dos párrafos (D21 y equipo):
- "**Confirmación de asistencia.** Si confirmás que vas a una inauguración, guardamos sólo lo que escribís: tu nombre, tu email si lo dejás y cuántas personas te acompañan. Lo ven únicamente quienes organizan esa muestra. No guardamos tu dirección IP. Borramos estos datos 30 días después de que termina la muestra; queda sólo la cantidad total de personas."
- "**Equipo de una muestra.** Si te invitan a organizar una muestra, el resto del equipo ve tu nombre y tu email."

- [ ] **Step 4: Correr**

Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint`
Expected: todo en verde. `pnpm --filter muestras test -- en-preparacion panel` en verde (Difusión nace lista).

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: sección Difusión con piezas para redes (posteo, historia, cuadrado), invitación imprimible y acceso a la inauguración"
```

**Acceptance:** desde el panel se baja cada variante en cada formato; una coorganización baja piezas, el rol de textos no ve la sección; a 375 px la vista previa ocupa el ancho sin scroll horizontal.

---

### Task 14: Verificación final, migración en producción, guía y PR

**Files:**
- Modify: `docs/operations/muestras-puesta-en-marcha.md` (sección "Etapa 5")

- [ ] **Step 1: Rebasar y todos los chequeos**

Si la etapa 4 ya está en `origin/main`: `git fetch origin && git rebase origin/main` (resolver sólo conflictos de esta etapa). Después:

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter @repo/muestras lint && pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice typecheck && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras build`
Expected: todo en verde. Mirar que el build realmente terminó (tabla de rutas con `/m/[slug]/inauguracion`, `/m/[slug]/inauguracion/evento.ics`, `/m/[slug]/inauguracion/r/[token]`, `/panel/difusion`, `/panel/difusion/[id]`, `/panel/difusion/[id]/inauguracion`, `/panel/muestras/[id]/equipo`, `/panel/equipo/invitacion/[token]`, `/api/redes/[id]`, `/api/inauguracion/[id]/csv`, `/api/cron/asistencias`). `git diff origin/main -- pnpm-lock.yaml` vacío. La salida de `grep -rn "proposedByUserId" apps/muestras/lib apps/muestras/app --include='*.ts' --include='*.tsx' | grep -v "\.test\."` coincide con la lista permitida de la Task 6. `ls apps/muestras/.next/standalone 2>/dev/null; find apps/muestras/.next -name "*.nft.json" -path "*api/redes*" | xargs grep -l "assets/fonts"` encuentra la fuente en el paquete de la función.

- [ ] **Step 2: Aplicar la migración en producción — la hace el controlador (autorizado por Daniel)**

Daniel tiene que autorizar esta migración. Qué hace: suma once columnas a `CulturalActivity` (optativas o con valor por defecto, sin reescribir la tabla) y crea dos tablas vacías; no modifica ni borra datos. **Requisito: la de la etapa 4 (`20261029120000_muestras_etapa_4_sala`) ya aplicada** (`select migration_name from "_prisma_migrations" where migration_name like '%muestras_etapa_4%'`). Va **antes** de publicar el código: sin las columnas, todo el sitio de Muestras deja de andar. Si algo sale mal (y sólo si el código nuevo **no** está publicado):
```sql
drop table "CulturalActivityRsvp", "CulturalActivityMember";
alter table "CulturalActivity" drop column "editVersion", drop column "lastEditedAt", drop column "lastEditedByUserId", drop column "lastEditedPart", drop column "openingEndsAt", drop column "openingNote", drop column "rsvpCapacity", drop column "rsvpMaxCompanions", drop column "rsvpPurgedAt", drop column "rsvpStatus", drop column "rsvpSummary";
```

1. Correr el contenido de `packages/db/prisma/migrations/20261030120000_muestras_etapa_5_difusion/migration.sql` en la rama `development` (`br-old-rain-adwthzng`) del proyecto `divine-hall-10689679` (Neon MCP `run_sql_transaction`, una sentencia por elemento, sin los comentarios).
2. Verificar:
```sql
select table_name from information_schema.tables
where table_name in ('CulturalActivityMember', 'CulturalActivityRsvp') order by table_name;
select column_name, data_type, column_default from information_schema.columns
where table_name = 'CulturalActivity' and column_name in ('editVersion','lastEditedAt','lastEditedByUserId','lastEditedPart','openingEndsAt','openingNote','rsvpCapacity','rsvpMaxCompanions','rsvpPurgedAt','rsvpStatus','rsvpSummary') order by column_name;
select count(*) from "CulturalActivity" where "rsvpStatus" <> 'OFF' or "editVersion" <> 0;
select count(*) from "CulturalActivity" where "openingAt" is not null and extract(hour from "openingAt") <> 3;
```
Expected: las dos tablas; las once columnas (`rsvpSummary` `jsonb`, `rsvpStatus` con `'OFF'::text`, `rsvpMaxCompanions` con `3`, `editVersion` con `0`); `0`; y el último `0` (todas las inauguraciones existentes están a las 00:00 argentinas = 03:00 UTC: se leen como "sin hora", D12). Si el último no da 0, avisar antes de seguir.
3. Probar el bloqueo y el tipo de `editVersion` con los mismos parámetros que manda la app, en una transacción que se deshace:
```sql
begin;
select "editVersion", pg_typeof("editVersion") from "CulturalActivity" limit 1 for update;
rollback;
```
Expected: `0 | integer` (Prisma lo devuelve como `number`, no `bigint`).
4. Registrar con el checksum del archivo:

Run: `shasum -a 256 packages/db/prisma/migrations/20261030120000_muestras_etapa_5_difusion/migration.sql`
```sql
insert into "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
values (gen_random_uuid()::text, '<sha256 del paso anterior>', now(), '20261030120000_muestras_etapa_5_difusion', null, null, now(), 1);
```
5. Confirmar: `select migration_name, checksum from "_prisma_migrations" where migration_name = '20261030120000_muestras_etapa_5_difusion';` → una fila con el mismo checksum.

- [ ] **Step 3: Recorrido completo en local contra la base ya migrada**

Con `pnpm --filter muestras dev`, correo apagado, tres cuentas (A dueña, B coorganización, C textos) y una muestra de prueba publicada con inauguración con hora:
1. Repetir las pruebas de las Tasks 7, 8, 10 y 11.
2. B: entra a ficha, montaje, estadísticas, libro, difusión e inauguración; **no** ve "Cancelar", "Equipo → Invitar" ni la convocatoria. C: sólo "Mis muestras" → formulario de textos; `/panel/montaje/<id>`, `/panel/estadisticas/<id>`, `/panel/difusion/<id>`, `/api/redes/<id>?…` y `/api/inauguracion/<id>/csv` → 404.
3. A y B editan la ficha en dos pestañas: la segunda recibe el aviso con el nombre; el panel muestra "Último cambio: …".
4. B abre la página pública con su sesión: no suma visitas (Estadísticas igual que antes).
5. Bajar una pieza de cada variante en cada formato y la invitación A6 y A5; abrirlas: texto nítido con tildes, QR legible con el teléfono desde la pantalla, la obra entera sin recorte, la historia sin texto en las zonas de arriba y abajo.
6. Confirmar asistencia desde un teléfono (ventana privada): enlace personal, `.ics` al calendario, cancelar.
7. CSV abierto en Excel o en Google Sheets con configuración argentina: columnas separadas y tildes bien.
8. Limpieza: en una muestra de prueba con `endsAt` hace 31 días (cambiarla a mano en la base de prueba, **nunca** en producción) con confirmaciones, abrir `/panel` → las filas se borran y queda el resumen.
9. A 375 px: `/m/<slug>/inauguracion`, el enlace personal, `/panel/difusion/<id>`, la lista de asistencia y el equipo, sin scroll horizontal.

- [ ] **Step 4: Guía de puesta en marcha**

Agregar al final de `docs/operations/muestras-puesta-en-marcha.md`:
```markdown
## Etapa 5 (difusión y equipo: equipo de la muestra, inauguración con confirmación y piezas para redes)

1. Verificar que la migración de la etapa 4 (`20261029120000_muestras_etapa_4_sala`) está aplicada. — Controlador.
2. Aplicar la migración `20261030120000_muestras_etapa_5_difusion` y registrarla con su SHA-256 (plan de la etapa 5, Task 14 Step 2). — Controlador, autorizado por Daniel. **Antes** del deploy: sin las columnas nuevas se cae todo el sitio de Muestras.
3. Fusionar el PR: Vercel publica `apps/muestras`.
4. Apenas se publica, bajar desde `/panel/difusion/<id>` una pieza de cada formato de una muestra publicada y mirar que **el texto aparece** (primera prueba real de las fuentes en Vercel). Si una pieza da error "No pudimos armar la pieza", revisar en los logs de la función `/api/redes/[id]` que el archivo de fuente esté en el paquete.
5. Decidir si se enciende la limpieza diaria: crear la variable `CRON_SECRET` (un valor largo al azar) en el proyecto de Vercel de Muestras, entorno Production, y volver a publicar. Sin ella, los datos de asistencia se borran igual cuando alguien abre el panel. — Daniel.
6. Con el correo apagado, avisar a quienes organizan que las invitaciones al equipo se mandan copiando el enlace (por WhatsApp o mail) y que quien confirma asistencia guarda su enlace personal desde la pantalla. — Daniel.
7. Para encender los correos de esta etapa (invitación al equipo, confirmación, lista de espera), los mismos pasos que en la etapa 1 (`MUESTRAS_CORREOS_EN_VIVO=true` + dominio verificado en Resend). — Daniel.
```

- [ ] **Step 5: Commit y PR**

```bash
git add docs/operations/muestras-puesta-en-marcha.md
git commit -m "Guía de puesta en marcha de la Etapa 5 de Muestras"
git push -u origin feat/muestras-etapa-5
gh pr create --base main --title "Muestras Fotográficas — Etapa 5: difusión y equipo" --body "<resumen en español: equipo con dos roles y permiso único (qué cambia para el dueño, qué puede cada rol), inauguración con confirmación, lista de espera, calendario, CSV y borrado a 30 días; piezas para redes e invitación imprimible; la migración ya aplicada (y que requiere la de la etapa 4); que todo anda con el correo apagado; decisión pendiente del cron; checklist del Step 3>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```
(Si la etapa 4 todavía no se fusionó, abrir el PR con `--base feat/muestras-etapa-4` y decirlo en la descripción.)

---

## Etapa 5 (difusión y equipo)

Resumen para quien ejecute: Tasks 1–3 son reglas puras (paralelizables); la 4 es la migración (sin aplicar); la 5 y la 6 cambian **todas** las comprobaciones de dueño por el permiso único (hacerlas antes de sumar nada que dependa de roles); 7–8 equipo; 9–11 inauguración; 12–13 piezas; 14 verificación, migración en producción y PR.

## Cobertura del spec

| Spec | Task |
|---|---|
| D1 tres roles, `TEXT_EDITOR` | 1, 4 |
| D2 capacidades y permiso único; lista de reemplazos | 1, 5, 6 |
| D3 coorganización no cancela, no maneja el equipo; envía a revisión | 1, 6 |
| D4 convocatoria sólo del dueño | 1, 5, 6 |
| D5 invitación por email, cuenta del email, 30 días, tope 10, reenviar, sacar, dejar | 1, 7 |
| D6 enlace para copiar con el correo apagado | 7 |
| D7 `editVersion` | 4, 6, 8 |
| D8 registro del último cambio | 1, 4, 6, 8, 9 |
| D9 rol de textos con acción propia | 1, 8 |
| D10 el equipo no suma visitas | 5 |
| D11 listados con rol; super admin ve lo suyo | 5 |
| D12 hora de la inauguración, 00:00 = sin hora | 2, 9, 14 |
| D13 configuración de la asistencia | 4, 9 |
| D14 cuándo se puede confirmar | 2, 9, 10 |
| D15 formulario "Voy" y anti-spam | 2, 10 |
| D16 cupo, lista de espera, promoción en orden | 2, 9, 10, 11 |
| D17 un email por muestra | 4, 10 |
| D18 enlace personal | 10 |
| D19 `.ics` y Google Calendar | 2, 10 |
| D20 lista, acciones, CSV | 2, 11 |
| D21 privacidad y retención 30 días | 2, 11, 13 |
| D22 limpieza perezosa + cron optativo | 11, 14 |
| D23 correos con alternativa en pantalla | 7, 10 |
| D24 formatos y variantes | 3, 12, 13 |
| D25 cuándo hay cada variante | 3, 13 |
| D26 texto con Pango y `fontfile`, falla cerrada | 12 |
| D27 fuente Archivo estática (respaldo Roboto) | 12 |
| D28 composición, sin recortar obras, zonas seguras | 3, 12 |
| D29 ruta `/api/redes`, vista previa de a una | 13 |
| D30 sección "Difusión" y rutas del equipo | 3, 7, 13 |
| D31 `EN_PREPARACION` sin cambios | 3, 13 |
| D32 sin dependencias nuevas | todas |
| Migración a mano + checksum, después de la etapa 4 y antes del deploy | 4, 14 |
