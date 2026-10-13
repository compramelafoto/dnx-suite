# Muestras Fotográficas — Etapa 7 (concurso de FotoRank → muestra) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la organización de un concurso de FotoRank, con los resultados cerrados por el jurado (lote `FINALIZED` o `PUBLISHED`), apriete **"Armar muestra"** y reciba en Muestras Fotográficas un **borrador de muestra** con las obras ganadoras, las menciones y (si quiere) las preseleccionadas: imágenes copiadas al bucket de Muestras, autor vinculado a su cuenta y a su perfil, premio y categoría como dato de la obra ("1.er premio · Paisaje") y orden del ranking. Por obra decide **galería virtual / se imprime / a la venta**; cada autor ve sus obras en **"Dónde expongo"** y acepta (o saca) la exhibición y, aparte, la venta futura. Re-armar o "Actualizar desde FotoRank" nunca duplica. La muestra y FotoRank se enlazan entre sí.

**Architecture:** Igual que las etapas 1 a 6: reglas puras en `packages/muestras` (`contest.ts`, con vitest) y la app como capa delgada sobre `@repo/db`. Muestras **lee** FotoRank directo en la base compartida (sólo el último lote `FINALIZED`/`PUBLISHED`, sin descalificadas, con una lista cerrada de campos; sólo concursos propios de FotoRank, nunca maratones) y copia las imágenes por la ruta firmada que FotoRank ya ofrece a FOTOFFICE (`/api/fotorank/external/entry-image`, HMAC con `DNX_FOTORANK_LINK_SECRET`). Tres tablas nuevas (`CulturalContestImport`, `CulturalContestWork`, `CulturalContestAuthor`); lo que entra a la muestra se copia a `CulturalActivityWork` y la fila del concurso guarda `activityWorkId` sin FK (como la etapa 6). En FotoRank: un recuadro con un enlace en el panel de resultados y un bloque público de sólo lectura que nunca rompe la página.

**Tech Stack:** Next.js 16.2.1 (App Router, `params` y `searchParams` como Promise, `--webpack`), React 19.2.4, Prisma 6 (`@repo/db`), Tailwind 4, `sharp 0.34.5`, `@aws-sdk/client-s3`, `node:crypto`, vitest 3 (Muestras) y `tsx --test` (FotoRank). **Sin dependencias nuevas.**

**Spec:** `docs/superpowers/specs/2026-10-10-muestras-etapa-7-fotorank-design.md` (decisiones D1–D28; respuestas de Daniel del 2026-10-10: permiso por `allowExhibition`, preseleccionados = finalistas, botón en el panel de resultados de FotoRank). Diseño general: `docs/superpowers/specs/2026-10-08-muestras-fotograficas-design.md`. Etapa anterior: `docs/superpowers/plans/2026-10-10-muestras-etapa-6.md`.

## Global Constraints

- Todo texto visible y todo comentario en **español rioplatense con voseo**, claro y sin "próximamente"; identificadores en inglés dentro de `packages/muestras`, en español en la app.
- Estados como **texto**, nunca enum de Prisma. Ids de usuario `Int` **sin relación Prisma a `User`**. Ids `cuid()`. **Sin FK hacia tablas de FotoRank** y **sin columnas nuevas en tablas existentes**.
- **Fuente**: el último `FotorankResultBatch` con `status` `FINALIZED` o `PUBLISHED` (la publicación oficial `LIVE` está trabada en producción; es la misma fuente que diplomas, imágenes de ganadores y tienda). Nunca resultados `DISQUALIFIED`, ni obras `REJECTED`/`WITHDRAWN`/`REPLACED` o con `withdrawnAt`. Sólo concursos propios de FotoRank (`experienceType` distinto de `MARATHON`); nunca el cliente cruzado de Clickatón. Nunca se leen `anonymousCode`, puntajes (`aggregateScore`, `normalizedScore`, `medianScore`, `dispersion`, `evaluationCount`), `juryDecisionNote`, votos, jurados, email ni teléfono. Los `select` sobre tablas `Fotorank*` viven **sólo** en `apps/muestras/lib/concursos/fotorank.ts` y un test los revisa.
- **Nombre del autor**: la muestra es su primera publicación (FotoRank publica sólo códigos anónimos). Se muestra sólo con `attributionRequired` en las bases que firmó, confirmación del autor o autorización escrita; si no, "Autoría reservada" (`authorCredit`).
- **FotoRank está en producción con concursos reales** (SFEF hasta el 31/10): en `apps/fotorank` sólo se tocan los archivos de las Tasks 11 y 12; ninguna escritura cambia; lo nuevo es lectura dentro de `try/catch`.
- Fechas en **hora argentina** con `dates.ts` (`toArDay`, `dayStartAr`, `dayEndAr`).
- **Sin dependencias nuevas** ni versiones fuera del lockfile. Después de cualquier `pnpm install`, `git diff pnpm-lock.yaml` vacío; si se mueve, frenar y avisar.
- Chequeos de tipos y build con `NODE_OPTIONS=--max-old-space-size=8192` y mirar que realmente terminaron (el chequeo de tipos puede morir por memoria y devolver éxito).
- Diseño de Muestras: tokens de `apps/muestras/app/globals.css`, `.mf-titulo`, líneas finas, botones finos (`h-11 border border-[var(--mf-ink)] px-5`), `rounded-[2px]`. Clases repetidas en `components/concursos/estilos.ts` (puede reexportar `components/montaje/estilos.ts`). En FotoRank, las clases `fr-*` existentes.
- **Autorización del lado del servidor en cada página, acción y ruta.** Cada `page.tsx` nueva llama `requireUsuario(<su propia ruta>)`; cada acción vuelve a leer la sesión y el permiso **en la base** (`puedeArmarDesdeConcurso`, `rolEnMuestra` + `puede(usuario, "contest", rol)`, o la fila `CulturalContestAuthor` con `userId = usuario.id`). Toda negativa del panel es `notFound()`.
- **Ninguna página pública lee cookies** (siguen ISR con `revalidate = 300`).
- **Correo apagado**: nada de esta etapa manda correos; el enlace al autor se copia a mano.
- Puerto de desarrollo de Muestras **3014**. Probar con `next dev` (las vistas previas de Vercel no sirven).
- Worktree `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-muestras-7`, rama `feat/muestras-etapa-7-fotorank` (sale de `origin/main`, con las etapas 1 a 6 en producción).
- La migración **no se aplica sola**: la aplica **a mano en producción el controlador**, con la autorización de Daniel, **antes** de publicar el código, y la registra en `_prisma_migrations` con el SHA-256 del archivo (Task 13).

## Mapa de archivos

```
packages/muestras/src/
  contest.ts (+ contest.test.ts)        — lote, niveles, premio, orden, base de permiso, crédito del autor, plan, galería, permisos del autor
  team.ts (+ test)                       — capacidad `contest`
  panel.ts (+ test)                      — sección "Concursos"
  index.ts                               — reexporta contest
packages/db/prisma/schema.prisma         — 3 modelos nuevos + relaciones inversas (sin columnas)
packages/db/prisma/migrations/20261101120000_muestras_etapa_7_fotorank/migration.sql
apps/muestras/
  lib/concursos/firma.ts (+ test)        — copia idéntica del módulo de firma de FotoRank
  lib/concursos/imagen.ts (+ test)       — bajar el original firmado, procesar y subir a R2
  lib/concursos/fotorank.ts (+ test)     — ÚNICO lugar que lee tablas Fotorank*: permisos, concursos, resultados del jurado
  lib/concursos/armar.ts (+ test)        — armar y actualizar (transacción, idempotente)
  lib/concursos/galeria.ts (+ test)      — llevar a la galería / sacar (`sincronizarObraConGaleria`)
  lib/concursos/acciones.ts (+ test)     — "use server": armar, actualizar, copiar imágenes, casillas, sacar, autorización escrita, enlace mandado
  lib/concursos/autor.ts (+ test)        — "use server": respuestas del autor y su firma/perfil
  lib/concursos/consultas.ts             — panel del concurso, del autor, "Dónde expongo"
  lib/concursos/publico.ts (+ test)      — premios por obra, "Muestra del concurso"
  lib/limite.ts (+ test)                 — frenos nuevos
  lib/actividades/acciones.ts (+ test)   — el editor conserva imagen/autor y quitar = sacar
  lib/fichas/cargar.ts, lib/piezas/cargar.ts (+ tests) — premio; sin obras "sólo online"
  lib/portada/funciones.ts               — texto de la portada
  app/panel/concursos/page.tsx, app/panel/concursos/[contestId]/page.tsx
  app/panel/muestras/[id]/concurso/page.tsx, app/panel/muestras/[id]/page.tsx
  app/panel/expositor/page.tsx, app/panel/expositor/concurso/[id]/page.tsx
  app/m/[slug]/page.tsx, app/m/[slug]/o/[workId]/page.tsx, app/m/[slug]/sala/o/[workId]/page.tsx
  app/privacidad/page.tsx
  components/concursos/{armar-muestra.tsx, panel-concurso.tsx, copiar-imagenes.tsx, obra-concurso.tsx, enlace-autor.tsx, respuesta-autor.tsx, estilos.ts}
  .env.example                           — DNX_FOTORANK_LINK_SECRET, FOTORANK_PUBLIC_BASE_URL
apps/fotorank/
  app/lib/fotorank/external/muestras.ts (+ muestras.test.ts)  — URL de Muestras y `muestrasDelConcurso`
  app/components/contest-public/MuestrasDelConcurso.tsx
  app/concursos/[slug]/page.tsx, app/concursos/[slug]/resultados/page.tsx  — una línea cada una
  app/(dashboard)/dashboard/concursos/[id]/resultados/page.tsx              — recuadro "Armar muestra"
  app/lib/fotorank/external/entry-image-signing.ts                          — sólo el comentario (tres copias)
  package.json                                                              — script `test:muestras`
  .env.example                                                              — MUESTRAS_PUBLIC_BASE_URL (optativa)
apps/fotoffice/lib/store/artworks/signing.ts — sólo el comentario (tres copias)
docs/operations/muestras-puesta-en-marcha.md — sección "Etapa 7"
```

Orden: 1 → 2 (reglas puras; independientes entre sí) → 3 (schema) → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13. Desde la Task 3 todo usa el cliente Prisma nuevo. La 11 y la 12 (FotoRank) dependen sólo de la 3 y pueden ir en paralelo con la 6–10. Los tests de la app mockean `@repo/db`, `@/lib/usuario`, `next/cache`, `next/headers` y R2 con el patrón de `lib/expositores/revision.test.ts` y `lib/seleccion/acciones.test.ts`.

---

### Task 1: Reglas puras del concurso — lote, niveles, premio, orden, permiso, crédito del autor, plan y galería

**Files:**
- Create: `packages/muestras/src/contest.ts`, `packages/muestras/src/contest.test.ts`
- Modify: `packages/muestras/src/index.ts`

**Interfaces:**
- Consumes: `MAX_WORKS` (`constants.ts`).
- Produces:
  - `CONTEST_TIERS = ["WINNER", "MENTION", "FINALIST"]`, `ContestTier`, `CONTEST_TIER_LABELS` (`{ WINNER: "Ganadores", MENTION: "Menciones", FINALIST: "Preseleccionados" }`), `DEFAULT_CONTEST_TIERS = ["WINNER", "MENTION"]`, `isContestTier`, `parseContestTiers(values: unknown[]): ContestTier[]`.
  - `CONTEST_IMAGE_BATCH = 6`, `CONTEST_EXHIBIT_TEXT_VERSION = "2026-10-10"`, `CONTEST_EXHIBIT_TEXT`, `SALE_CONSENT_TEXT`, `RESERVED_AUTHORSHIP = "Autoría reservada"`, `MARATHON_NOT_SUPPORTED`.
  - `USABLE_BATCH_STATUSES = ["FINALIZED", "PUBLISHED"]`; `pickResultBatch(batches: { id; status; finalizedAt: Date | null; publishedAt: Date | null; updatedAt: Date }[])` → el último usable (por `finalizedAt`, después `publishedAt`) o `null`.
  - `tierOf({ resultStatus, awardType }): ContestTier | null` — `DISQUALIFIED` → `null`; `awardType` `HONORABLE_MENTION`/`SPECIAL_MENTION` o `resultStatus = MENTION` → `MENTION`; `awardType = FINALIST` o `resultStatus = FINALIST` → `FINALIST`; otro `awardType` (`FIRST_PLACE`, `SECOND_PLACE`, `THIRD_PLACE`, `PEOPLE_CHOICE`, `SPONSOR_AWARD`, `CUSTOM`) o `resultStatus = WINNER` → `WINNER`; el resto (`RANKED`, `TIED`, `NOT_SELECTED`, `REVIEW_REQUIRED` sin premio) → `null`.
  - `contestSelections(resultEntries: { snapshotId; categoryId; resultStatus; awardType: string | null; position: number | null }[])` → `{ snapshotId; categoryId; tier; awardType; position }[]` sin repetir `snapshotId` (gana el nivel mayor y después el premio mayor, con los pesos de `bestAward` de la tienda).
  - `awardText(tier, awardType)`; `distinctionText({ tier, awardType, categoryName, singleCategory })`.
  - `rankContestWorks(rows, categories)` → mismas filas con `rank` 0..n (categoría por `sortOrder`, nivel, premio, puesto, título).
  - `rightsFromConfigurationJson(json)` → `{ allowExhibition: boolean; attributionRequired: boolean } | null` (misma lectura que `apps/fotoffice/lib/store/artworks/consent.ts`, sin importarla); `exhibitBasisFromRights(rights)` → `"RULES"` sólo con `allowExhibition === true` (decisión de Daniel); si no o `null` → `"EXPLICIT"`.
  - `authorCredit({ attributionRequired, exhibitConsent, consentBy, signedName })` → `{ show: boolean; name: string | null }` (D28).
  - `planContestImport({ selected, existing, tiers, galleryCount })` → `{ create; update; gone; problems }`.
  - `contestWorkInGallery(row)`; `contestConsentTransition(action, row, ctx)`; `authorPendingCount(rows)`; `contestShareMessage({ name, organization, contest, url })`.

- [ ] **Step 1: Escribir los tests que fallan**

`packages/muestras/src/contest.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  authorCredit, contestConsentTransition, contestSelections, contestWorkInGallery, distinctionText, exhibitBasisFromRights,
  parseContestTiers, pickResultBatch, planContestImport, rankContestWorks, rightsFromConfigurationJson, tierOf,
} from "./contest";

const d = (s: string) => new Date(s);

describe("lote de resultados", () => {
  it("el último FINALIZED o PUBLISHED", () => {
    const lote = pickResultBatch([
      { id: "a", status: "FINALIZED", finalizedAt: d("2026-09-01"), publishedAt: null, updatedAt: d("2026-09-01") },
      { id: "b", status: "PUBLISHED", finalizedAt: d("2026-09-10"), publishedAt: d("2026-09-11"), updatedAt: d("2026-09-11") },
      { id: "c", status: "REVIEW_REQUIRED", finalizedAt: null, publishedAt: null, updatedAt: d("2026-09-20") },
      { id: "x", status: "CANCELLED", finalizedAt: d("2026-09-30"), publishedAt: null, updatedAt: d("2026-09-30") },
    ]);
    expect(lote?.id).toBe("b");
  });
  it("sin lote cerrado → null", () => {
    expect(pickResultBatch([{ id: "c", status: "DRAFT", finalizedAt: null, publishedAt: null, updatedAt: d("2026-09-20") }])).toBeNull();
  });
});

describe("niveles", () => {
  it("premios, menciones, finalistas y descalificadas", () => {
    expect(tierOf({ resultStatus: "WINNER", awardType: "FIRST_PLACE" })).toBe("WINNER");
    expect(tierOf({ resultStatus: "RANKED", awardType: "SPONSOR_AWARD" })).toBe("WINNER");
    expect(tierOf({ resultStatus: "MENTION", awardType: null })).toBe("MENTION");
    expect(tierOf({ resultStatus: "WINNER", awardType: "HONORABLE_MENTION" })).toBe("MENTION");
    expect(tierOf({ resultStatus: "FINALIST", awardType: null })).toBe("FINALIST");
    expect(tierOf({ resultStatus: "RANKED", awardType: "FINALIST" })).toBe("FINALIST");
    expect(tierOf({ resultStatus: "DISQUALIFIED", awardType: "FIRST_PLACE" })).toBeNull();
    expect(tierOf({ resultStatus: "RANKED", awardType: null })).toBeNull();
    expect(tierOf({ resultStatus: "NOT_SELECTED", awardType: null })).toBeNull();
  });
  it("una obra en dos categorías sale una vez, con el mejor premio", () => {
    const s = contestSelections([
      { snapshotId: "s1", categoryId: "c2", resultStatus: "FINALIST", awardType: null, position: 4 },
      { snapshotId: "s1", categoryId: "c1", resultStatus: "WINNER", awardType: "SECOND_PLACE", position: 2 },
      { snapshotId: "s2", categoryId: "c1", resultStatus: "DISQUALIFIED", awardType: "FIRST_PLACE", position: 1 },
    ]);
    expect(s.map((x) => [x.snapshotId, x.tier, x.categoryId])).toEqual([["s1", "WINNER", "c1"]]);
  });
  it("niveles elegidos", () => expect(parseContestTiers(["WINNER", "x", "FINALIST", "WINNER"])).toEqual(["WINNER", "FINALIST"]));
});

describe("premio", () => {
  it("con y sin categoría", () => {
    expect(distinctionText({ tier: "WINNER", awardType: "FIRST_PLACE", categoryName: "Paisaje", singleCategory: false })).toBe("1.er premio · Paisaje");
    expect(distinctionText({ tier: "MENTION", awardType: "SPECIAL_MENTION", categoryName: "Retrato", singleCategory: false })).toBe("Mención especial · Retrato");
    expect(distinctionText({ tier: "FINALIST", awardType: null, categoryName: "Paisaje", singleCategory: true })).toBe("Preseleccionada");
  });
});

describe("orden del ranking", () => {
  it("categoría, nivel, premio, puesto", () => {
    const r = rankContestWorks(
      [
        { key: "a", categoryId: "c2", tier: "WINNER", awardType: "FIRST_PLACE", position: 1, title: "A" },
        { key: "b", categoryId: "c1", tier: "FINALIST", awardType: null, position: 5, title: "B" },
        { key: "c", categoryId: "c1", tier: "WINNER", awardType: "SECOND_PLACE", position: 2, title: "C" },
        { key: "d", categoryId: "c1", tier: "WINNER", awardType: "FIRST_PLACE", position: 1, title: "D" },
      ],
      [{ id: "c1", sortOrder: 0 }, { id: "c2", sortOrder: 1 }],
    );
    expect(r.map((x) => [x.key, x.rank])).toEqual([["d", 0], ["c", 1], ["b", 2], ["a", 3]]);
  });
});

describe("bases que firmó el autor", () => {
  it("allowExhibition → RULES (decisión de Daniel)", () => {
    expect(exhibitBasisFromRights(rightsFromConfigurationJson({ rights: { allowExhibition: true, allowPrint: false, allowCommercial: false } }))).toBe("RULES");
    expect(exhibitBasisFromRights(rightsFromConfigurationJson({ rights: { allowExhibition: false } }))).toBe("EXPLICIT");
    expect(exhibitBasisFromRights(rightsFromConfigurationJson({ rights: {} }))).toBe("EXPLICIT");
    expect(exhibitBasisFromRights(rightsFromConfigurationJson(null))).toBe("EXPLICIT");
  });
  it("atribución", () => {
    expect(rightsFromConfigurationJson({ rights: { allowExhibition: true, attributionRequired: true } })?.attributionRequired).toBe(true);
    expect(rightsFromConfigurationJson({ rights: { allowExhibition: true } })?.attributionRequired).toBe(false);
  });
});

describe("crédito del autor (primera vez público)", () => {
  it("bases con atribución, confirmación o autorización escrita", () => {
    expect(authorCredit({ attributionRequired: true, exhibitConsent: "ACCEPTED", consentBy: "RULES", signedName: null, defaultName: "Ana Pérez" })).toEqual({ show: true, name: "Ana Pérez" });
    expect(authorCredit({ attributionRequired: false, exhibitConsent: "ACCEPTED", consentBy: "RULES", signedName: null, defaultName: "Ana Pérez" })).toEqual({ show: false, name: "Autoría reservada" });
    expect(authorCredit({ attributionRequired: false, exhibitConsent: "ACCEPTED", consentBy: "AUTHOR", signedName: "Ana P.", defaultName: "Ana Pérez" })).toEqual({ show: true, name: "Ana P." });
    expect(authorCredit({ attributionRequired: false, exhibitConsent: "ACCEPTED", consentBy: "RULES", signedName: "Ana P.", defaultName: "Ana Pérez" })).toEqual({ show: true, name: "Ana P." });
    expect(authorCredit({ attributionRequired: false, exhibitConsent: "ACCEPTED", consentBy: "ORGANIZER", signedName: null, defaultName: "Ana Pérez" })).toEqual({ show: true, name: "Ana Pérez" });
  });
});

describe("plan del armado", () => {
  const sel = (entryId: string, tier: "WINNER" | "MENTION" | "FINALIST") => ({ entryId, tier, distinction: tier, rank: 0, categoryId: "c1", categoryName: "P", awardType: null, title: "t", authorUserId: 1, authorName: "Ana" });
  it("idempotente: sólo crea lo que falta y respeta lo sacado", () => {
    const p = planContestImport({
      selected: [sel("e1", "WINNER"), sel("e2", "MENTION"), sel("e3", "FINALIST")],
      existing: new Map([["e1", { include: true, sourceStatus: "CURRENT" }], ["e9", { include: true, sourceStatus: "CURRENT" }]]),
      tiers: ["WINNER", "MENTION"],
      galleryCount: 0,
    });
    expect(p.create.map((x) => x.entryId)).toEqual(["e2"]);
    expect(p.update.map((x) => x.entryId)).toEqual(["e1"]);
    expect(p.gone).toEqual(["e9"]);
    expect(p.problems).toEqual([]);
  });
  it("tope técnico", () => {
    const p = planContestImport({ selected: [sel("e1", "WINNER")], existing: new Map(), tiers: ["WINNER"], galleryCount: 300 });
    expect(p.problems).toEqual(["La muestra admite hasta 300 obras: ya tiene 300 y el concurso suma 1. Elegí menos niveles o sacá obras de la muestra."]);
  });
  it("sin obras", () => {
    expect(planContestImport({ selected: [], existing: new Map(), tiers: ["WINNER"], galleryCount: 0 }).problems)
      .toEqual(["El concurso no tiene obras en los niveles que elegiste."]);
  });
});

describe("qué entra a la galería", () => {
  const ok = { include: true, imageStatus: "COPIED", imageUrl: "https://r2/muestras/1/fr-e1.webp", exhibitConsent: "ACCEPTED" };
  it("casilla, imagen y permiso", () => {
    expect(contestWorkInGallery(ok)).toBe(true);
    expect(contestWorkInGallery({ ...ok, include: false })).toBe(false);
    expect(contestWorkInGallery({ ...ok, imageStatus: "PENDING" })).toBe(false);
    expect(contestWorkInGallery({ ...ok, exhibitConsent: "PENDING" })).toBe(false);
    expect(contestWorkInGallery({ ...ok, exhibitConsent: "WITHDRAWN" })).toBe(false);
  });
});

describe("permisos del autor", () => {
  const abierta = { closed: false };
  it("EXPLICIT: aceptar o no", () => {
    expect(contestConsentTransition("accept", { exhibitBasis: "EXPLICIT", exhibitConsent: "PENDING" }, abierta)).toEqual({ ok: true, next: "ACCEPTED", by: "AUTHOR" });
    expect(contestConsentTransition("decline", { exhibitBasis: "EXPLICIT", exhibitConsent: "PENDING" }, abierta)).toEqual({ ok: true, next: "DECLINED", by: "AUTHOR" });
  });
  it("RULES: sacarla y volver a aceptarla", () => {
    expect(contestConsentTransition("withdraw", { exhibitBasis: "RULES", exhibitConsent: "ACCEPTED" }, abierta)).toEqual({ ok: true, next: "WITHDRAWN", by: "AUTHOR" });
    expect(contestConsentTransition("reconsider", { exhibitBasis: "RULES", exhibitConsent: "WITHDRAWN" }, abierta)).toEqual({ ok: true, next: "ACCEPTED", by: "AUTHOR" });
  });
  it("la organización sólo marca autorización escrita en lo pendiente", () => {
    expect(contestConsentTransition("writtenConsent", { exhibitBasis: "EXPLICIT", exhibitConsent: "PENDING" }, abierta)).toEqual({ ok: true, next: "ACCEPTED", by: "ORGANIZER" });
    expect(contestConsentTransition("writtenConsent", { exhibitBasis: "EXPLICIT", exhibitConsent: "DECLINED" }, abierta).ok).toBe(false);
  });
  it("con la muestra cerrada no se cambia nada", () => {
    expect(contestConsentTransition("withdraw", { exhibitBasis: "RULES", exhibitConsent: "ACCEPTED" }, { closed: true })).toEqual({ ok: false, reason: "La muestra ya cerró." });
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter @repo/muestras test -- contest`
Expected: FAIL ("Cannot find module './contest'").

- [ ] **Step 3: Implementar**

`packages/muestras/src/contest.ts` (esqueleto; completar hasta que pasen los tests):
```ts
import { MAX_WORKS } from "./constants";

/**
 * Del concurso de FotoRank a la muestra (etapa 7). Reglas puras: qué lote de resultados se usa, qué
 * obras se traen, cómo se escribe el premio, en qué orden van, qué base tiene el permiso de cada autor,
 * cuándo se publica su nombre y cuándo una obra entra a la muestra. Nunca se leen códigos anónimos ni
 * puntajes. Los pesos de premios son los de la tienda de FOTOFFICE (`catalog-rules.ts`), copiados.
 */
export const CONTEST_TIERS = ["WINNER", "MENTION", "FINALIST"] as const;
export type ContestTier = (typeof CONTEST_TIERS)[number];
export const isContestTier = (v: unknown): v is ContestTier => (CONTEST_TIERS as readonly unknown[]).includes(v);
export const CONTEST_TIER_LABELS: Record<ContestTier, string> = { WINNER: "Ganadores", MENTION: "Menciones", FINALIST: "Preseleccionados" };
export const DEFAULT_CONTEST_TIERS: readonly ContestTier[] = ["WINNER", "MENTION"];
export const CONTEST_IMAGE_BATCH = 6;
export const RESERVED_AUTHORSHIP = "Autoría reservada";
export const MARATHON_NOT_SUPPORTED = "Las maratones de Clickatón todavía no se pueden llevar a una muestra. Escribinos y lo vemos.";

/** Texto que acepta el autor. Cambiar el texto obliga a cambiar la versión (como `RIGHTS_TEXT`). */
export const CONTEST_EXHIBIT_TEXT_VERSION = "2026-10-10";
export const CONTEST_EXHIBIT_TEXT =
  "Autorizo a exponer esta obra en la muestra, mostrarla online según lo que elija la organización e imprimir su ficha, su marco y el catálogo, con mi nombre como autor/a.";
export const SALE_CONSENT_TEXT =
  "Acepto que esta obra se ofrezca a la venta. Antes de vender me van a mostrar el precio y el reparto para que los confirme.";

/** Lotes cerrados por el jurado o publicados: la misma fuente que diplomas, imágenes de ganadores y tienda. */
export const USABLE_BATCH_STATUSES = ["FINALIZED", "PUBLISHED"] as const;

export function pickResultBatch<T extends { status: string; finalizedAt: Date | null; publishedAt: Date | null }>(batches: readonly T[]): T | null {
  const t = (b: T) => (b.finalizedAt ?? b.publishedAt)?.getTime() ?? 0;
  return [...batches]
    .filter((b) => (USABLE_BATCH_STATUSES as readonly string[]).includes(b.status))
    .sort((a, b) => t(b) - t(a) || (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))[0] ?? null;
}

const MENCIONES = new Set(["HONORABLE_MENTION", "SPECIAL_MENTION"]);
export function tierOf(r: { resultStatus: string; awardType: string | null }): ContestTier | null {
  if (r.resultStatus === "DISQUALIFIED") return null;
  if ((r.awardType && MENCIONES.has(r.awardType)) || r.resultStatus === "MENTION") return "MENTION";
  if (r.awardType === "FINALIST" || r.resultStatus === "FINALIST") return "FINALIST";
  if (r.awardType || r.resultStatus === "WINNER") return "WINNER";
  return null;
}

const AWARD_TEXT: Record<string, string> = {
  FIRST_PLACE: "1.er premio", SECOND_PLACE: "2.º premio", THIRD_PLACE: "3.er premio",
  HONORABLE_MENTION: "Mención de honor", SPECIAL_MENTION: "Mención especial",
  PEOPLE_CHOICE: "Premio del público", SPONSOR_AWARD: "Premio sponsor", CUSTOM: "Premio",
};
export function awardText(tier: ContestTier, awardType: string | null): string {
  if (tier === "FINALIST") return "Preseleccionada";
  return (awardType && AWARD_TEXT[awardType]) || (tier === "MENTION" ? "Mención" : "Premio");
}
export function distinctionText(p: { tier: ContestTier; awardType: string | null; categoryName: string | null; singleCategory: boolean }): string {
  const premio = awardText(p.tier, p.awardType);
  return p.singleCategory || !p.categoryName?.trim() ? premio : `${premio} · ${p.categoryName.trim()}`;
}

export function rightsFromConfigurationJson(json: unknown): { allowExhibition: boolean; attributionRequired: boolean } | null {
  if (!json || typeof json !== "object") return null;
  const rights = (json as { rights?: unknown }).rights;
  if (!rights || typeof rights !== "object") return null;
  const r = rights as Record<string, unknown>;
  return { allowExhibition: r.allowExhibition === true, attributionRequired: r.attributionRequired === true };
}
export const exhibitBasisFromRights = (r: { allowExhibition: boolean } | null): "RULES" | "EXPLICIT" =>
  r?.allowExhibition ? "RULES" : "EXPLICIT";

/** D28: el nombre del autor se publica por primera vez en la muestra; sólo con atribución, confirmación o autorización escrita. */
export function authorCredit(p: { attributionRequired: boolean; exhibitConsent: string; consentBy: string | null; signedName: string | null; defaultName: string }): { show: boolean; name: string } {
  const firmado = p.signedName?.trim() || null;
  const confirmo = !!firmado || (p.exhibitConsent === "ACCEPTED" && (p.consentBy === "AUTHOR" || p.consentBy === "ORGANIZER"));
  if (p.attributionRequired || confirmo) return { show: true, name: firmado ?? p.defaultName };
  return { show: false, name: RESERVED_AUTHORSHIP };
}
// contestSelections, rankContestWorks, planContestImport, contestWorkInGallery, contestConsentTransition,
// authorPendingCount, contestShareMessage, parseContestTiers: según los tests.
// - contestSelections: tierOf por fila; descarta null; repetidos → PESO_NIVEL (3/2/1) y después peso del premio.
// - planContestImport: `create` = seleccionadas con nivel elegido que no existen; `update` = las que existen
//   (premio, categoría, orden; nunca `include`); `gone` = existentes CURRENT que ya no están; tope:
//   galleryCount + create.length > MAX_WORKS → problema con el texto del test.
// - contestConsentTransition: muestra cerrada → { ok: false, reason: "La muestra ya cerró." };
//   accept/decline desde PENDING (EXPLICIT); withdraw desde ACCEPTED; reconsider desde WITHDRAWN/DECLINED → ACCEPTED;
//   writtenConsent sólo desde PENDING → by ORGANIZER; askSale/cancelSale/acceptSale/declineSale sobre `saleConsent`.
```
`index.ts`: `export * from "./contest";`.

- [ ] **Step 4: Correr**

Run: `pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter @repo/muestras lint`
Expected: en verde.

- [ ] **Step 5: Commit**

```bash
git add packages/muestras
git commit -m "Muestras: reglas del concurso de FotoRank — lote del jurado, niveles, premio, orden, permiso y crédito del autor, armado idempotente"
```

**Acceptance:** una descalificada nunca sale; sin `attributionRequired` ni confirmación, el nombre no se publica.

---

### Task 2: Capacidad `contest`, sección "Concursos" y texto de la portada

**Files:**
- Modify: `packages/muestras/src/team.ts` (+ `team.test.ts`), `packages/muestras/src/panel.ts` (+ `panel.test.ts`), `apps/muestras/lib/portada/funciones.ts`

**Interfaces:**
- Produces: `"contest"` en `CAPABILITIES`, sólo en `ROLE_CAPABILITIES.OWNER` (que ya es `CAPABILITIES`); `PanelSectionKey` suma `"concursos"`; `s("concursos", "Concursos", "/panel/concursos", "ORGANIZAR")` después de "Convocatorias".

- [ ] **Step 1: Tests que fallan**

`team.test.ts`: `can("contest", { role: "OWNER", isSuperAdmin: false })` → true; `CO_ORGANIZER` y `TEXT_EDITOR` → false; super admin → true; `rolesWith("contest")` → `["OWNER"]`. `panel.test.ts`: `activeSectionKey("/panel/concursos/abc")` → `"concursos"`; la sección está en el grupo `ORGANIZAR`, `ready: true`.

- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter @repo/muestras test -- team panel` — Expected: FAIL.

- [ ] **Step 3: Implementar**

En `team.ts`, al final de `CAPABILITIES`: `// Etapa 7: armar desde un concurso de FotoRank (sólo el dueño). "contest",`. En `panel.ts` la sección. En `apps/muestras/lib/portada/funciones.ts` reemplazar el ítem:
```ts
      "O traé los ganadores y preseleccionados de tu concurso de {FOTORANK}: te armamos el borrador de la muestra con sus obras.",
```

- [ ] **Step 4: Correr** — Run: `pnpm --filter @repo/muestras test && pnpm --filter muestras test -- portada` — Expected: en verde.

- [ ] **Step 5: Commit**

```bash
git add packages/muestras apps/muestras/lib/portada
git commit -m "Muestras: capacidad para armar desde un concurso, sección Concursos y portada al día"
```

**Acceptance:** la coorganización no tiene `contest`; la portada sigue mostrando el logo de FotoRank en ese ítem.

---

### Task 3: Tablas del concurso en la muestra (migración escrita a mano, sin aplicar)

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20261101120000_muestras_etapa_7_fotorank/migration.sql`

**Interfaces:**
- Produces: `prisma.culturalContestImport` (único `activityId`), `prisma.culturalContestWork` (único `activityId_entryId`), `prisma.culturalContestAuthor` (único `activityId_userId`); `CulturalActivity.contestImport`, `.contestWorks`, `.contestAuthors`; `PhotographerProfile.contestAuthors`. **Ninguna columna nueva** en modelos existentes.

- [ ] **Step 1: Confirmar el nombre de la migración**

Run: `git fetch origin && git ls-tree --name-only origin/main packages/db/prisma/migrations/ | tail -3`
Expected: la última es `20261031120000_muestras_etapa_6_expositores` (o anterior a `20261101…`). Si apareció una más nueva, usar un timestamp posterior y reemplazarlo en todo el plan.

- [ ] **Step 2: Cambiar el schema (sin `prisma format`: reformatea todo el archivo)**

En `model CulturalActivity`, debajo de `roomKey CulturalActivityRoomKey?`:
```prisma

  /// Concurso de FotoRank del que salió (etapa 7). A lo sumo uno por muestra.
  contestImport  CulturalContestImport?
  contestWorks   CulturalContestWork[]
  contestAuthors CulturalContestAuthor[]
```
En `model PhotographerProfile`, debajo de `portfolio PhotographerPortfolioPhoto[]`:
```prisma
  /// Autor de obras traídas de un concurso (Muestras, etapa 7).
  contestAuthors CulturalContestAuthor[]
```
Al final del archivo:
```prisma
/// Concurso de FotoRank del que se armó una muestra (Muestras, etapa 7). Sin FK a FotoRank a propósito:
/// las imágenes son copias y borrar el concurso no puede frenar ni romper la muestra.
model CulturalContestImport {
  id               String           @id @default(cuid())
  activityId       String           @unique
  activity         CulturalActivity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  contestId        String
  contestSlug      String
  contestTitle     String
  organizationId   String
  organizationName String
  /// Niveles elegidos: WINNER | MENTION | FINALIST
  tiers            String[]
  /// Lote de resultados (FINALIZED | PUBLISHED) usado en el último armado o actualización, y su
  /// `updatedAt`: si cambia, el panel avisa que FotoRank cambió.
  resultBatchId     String
  resultBatchStatus String
  sourceVersion     DateTime
  createdByUserId  Int
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt
  syncedAt         DateTime         @default(now())

  works   CulturalContestWork[]
  authors CulturalContestAuthor[]

  @@index([contestId])
}

/// Una obra traída de un concurso. Lo que entra a la muestra se copia a `CulturalActivityWork`;
/// `activityWorkId` sin FK (el editor de la muestra reescribe sus obras conservando los ids).
model CulturalContestWork {
  id         String                @id @default(cuid())
  importId   String
  import     CulturalContestImport @relation(fields: [importId], references: [id], onDelete: Cascade)
  activityId String
  activity   CulturalActivity      @relation(fields: [activityId], references: [id], onDelete: Cascade)

  entryId      String
  authorUserId Int?
  authorName   String
  title        String
  /// WINNER | MENTION | FINALIST
  tier         String
  awardType    String?
  categoryId   String
  categoryName String
  /// "1.er premio · Paisaje"
  distinction  String
  rank         Int     @default(0)
  /// CURRENT | GONE (ya no figura en los resultados del concurso)
  sourceStatus String  @default("CURRENT")

  /// PENDING | COPIED | FAILED
  imageStatus String    @default("PENDING")
  imageUrl    String?
  imageError  String?
  copiedAt    DateTime?

  /// Galería virtual (está en la muestra), se imprime, a la venta.
  include Boolean @default(true)
  toPrint Boolean @default(true)
  forSale Boolean @default(false)

  /// RULES | EXPLICIT
  exhibitBasis        String
  /// Las bases que firmó el autor piden atribución: su nombre se publica sin esperar su respuesta (D28).
  attributionRequired Boolean @default(false)
  /// PENDING | ACCEPTED | DECLINED | WITHDRAWN
  exhibitConsent String    @default("PENDING")
  /// RULES | AUTHOR | ORGANIZER
  consentBy      String?
  consentAt      DateTime?
  /// NOT_ASKED | PENDING | ACCEPTED | DECLINED
  saleConsent    String    @default("NOT_ASKED")
  saleConsentAt  DateTime?

  activityWorkId String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([activityId, entryId])
  @@index([importId, rank])
  @@index([authorUserId])
  @@index([activityWorkId])
  @@index([activityId, imageStatus])
}

/// Autor de obras traídas de un concurso, por muestra (Muestras, etapa 7). Sin token: la página del
/// autor exige su cuenta (`userId`). Autores sin cuenta: `userId` nulo, una fila por obra.
model CulturalContestAuthor {
  id          String                @id @default(cuid())
  importId    String
  import      CulturalContestImport @relation(fields: [importId], references: [id], onDelete: Cascade)
  activityId  String
  activity    CulturalActivity      @relation(fields: [activityId], references: [id], onDelete: Cascade)
  userId      Int?
  authorName  String
  profileId   String?
  profile     PhotographerProfile?  @relation(fields: [profileId], references: [id], onDelete: SetNull)
  /// Cómo firma (lo completa al aceptar).
  displayName String?
  notifiedAt  DateTime?
  respondedAt DateTime?
  textVersion String?
  createdAt   DateTime              @default(now())
  updatedAt   DateTime              @updatedAt

  @@unique([activityId, userId])
  @@index([userId])
  @@index([importId])
}
```

- [ ] **Step 3: Escribir la migración**

`packages/db/prisma/migrations/20261101120000_muestras_etapa_7_fotorank/migration.sql`:
```sql
-- Muestras Fotográficas · Etapa 7: del concurso de FotoRank a la muestra.
-- Aditiva: crea tres tablas nuevas. No agrega columnas a tablas existentes ni toca filas.
-- Sin claves foráneas hacia tablas de FotoRank (las imágenes se copian; borrar un concurso no frena nada).
-- NO SE APLICA SOLA: la aplica a mano el controlador (autorizado por Daniel) en la base de
-- FOTOFFICE/FotoRank (Neon `divine-hall-10689679`, rama `development`), DESPUÉS de la etapa 6
-- (20261031120000_muestras_etapa_6_expositores) y ANTES de publicar el código, y la registra en
-- `_prisma_migrations` con el SHA-256 de este archivo.

-- CreateTable
CREATE TABLE "CulturalContestImport" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "contestSlug" TEXT NOT NULL,
    "contestTitle" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "tiers" TEXT[],
    "resultBatchId" TEXT NOT NULL,
    "resultBatchStatus" TEXT NOT NULL,
    "sourceVersion" TIMESTAMP(3) NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CulturalContestImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalContestWork" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "authorUserId" INTEGER,
    "authorName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "awardType" TEXT,
    "categoryId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "distinction" TEXT NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "sourceStatus" TEXT NOT NULL DEFAULT 'CURRENT',
    "imageStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "imageUrl" TEXT,
    "imageError" TEXT,
    "copiedAt" TIMESTAMP(3),
    "include" BOOLEAN NOT NULL DEFAULT true,
    "toPrint" BOOLEAN NOT NULL DEFAULT true,
    "forSale" BOOLEAN NOT NULL DEFAULT false,
    "exhibitBasis" TEXT NOT NULL,
    "attributionRequired" BOOLEAN NOT NULL DEFAULT false,
    "exhibitConsent" TEXT NOT NULL DEFAULT 'PENDING',
    "consentBy" TEXT,
    "consentAt" TIMESTAMP(3),
    "saleConsent" TEXT NOT NULL DEFAULT 'NOT_ASKED',
    "saleConsentAt" TIMESTAMP(3),
    "activityWorkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalContestWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalContestAuthor" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" INTEGER,
    "authorName" TEXT NOT NULL,
    "profileId" TEXT,
    "displayName" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "textVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalContestAuthor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CulturalContestImport_activityId_key" ON "CulturalContestImport"("activityId");
CREATE INDEX "CulturalContestImport_contestId_idx" ON "CulturalContestImport"("contestId");
CREATE UNIQUE INDEX "CulturalContestWork_activityId_entryId_key" ON "CulturalContestWork"("activityId", "entryId");
CREATE INDEX "CulturalContestWork_importId_rank_idx" ON "CulturalContestWork"("importId", "rank");
CREATE INDEX "CulturalContestWork_authorUserId_idx" ON "CulturalContestWork"("authorUserId");
CREATE INDEX "CulturalContestWork_activityWorkId_idx" ON "CulturalContestWork"("activityWorkId");
CREATE INDEX "CulturalContestWork_activityId_imageStatus_idx" ON "CulturalContestWork"("activityId", "imageStatus");
CREATE UNIQUE INDEX "CulturalContestAuthor_activityId_userId_key" ON "CulturalContestAuthor"("activityId", "userId");
CREATE INDEX "CulturalContestAuthor_userId_idx" ON "CulturalContestAuthor"("userId");
CREATE INDEX "CulturalContestAuthor_importId_idx" ON "CulturalContestAuthor"("importId");

-- AddForeignKey
ALTER TABLE "CulturalContestImport" ADD CONSTRAINT "CulturalContestImport_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CulturalContestWork" ADD CONSTRAINT "CulturalContestWork_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CulturalContestImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CulturalContestWork" ADD CONSTRAINT "CulturalContestWork_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CulturalContestAuthor" ADD CONSTRAINT "CulturalContestAuthor_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CulturalContestImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CulturalContestAuthor" ADD CONSTRAINT "CulturalContestAuthor_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CulturalContestAuthor" ADD CONSTRAINT "CulturalContestAuthor_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PhotographerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```
Nota: `@@unique([activityId, userId])` con `userId` nulo admite varias filas sin cuenta (en Postgres los `NULL` no chocan); el código busca las de autor con cuenta por `activityId_userId` y las sin cuenta por `id`.

- [ ] **Step 4: Generar el cliente y comparar con Prisma**

Run: `pnpm --filter @repo/db exec prisma generate && pnpm --filter @repo/db exec prisma migrate diff --from-migrations packages/db/prisma/migrations --to-schema-datamodel packages/db/prisma/schema.prisma --script --shadow-database-url "$SHADOW_DATABASE_URL" | head -40` (si no hay base sombra a mano, saltear el diff y revisar a ojo que los nombres de índices y FK sigan el patrón de la etapa 6; las migraciones no se reproducen desde cero, ver memoria "Migraciones no se reproducen desde cero").
Expected: el cliente se genera; el diff no muestra diferencias para estas tres tablas.

Run: `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotorank check-types`
Expected: en verde (FotoRank no cambia de comportamiento: sólo conoce tablas nuevas).

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20261101120000_muestras_etapa_7_fotorank
git commit -m "Muestras: tablas del concurso de FotoRank en la muestra (migración escrita a mano, sin aplicar)"
```

**Acceptance:** el SQL sólo tiene `CREATE TABLE`, `CREATE INDEX` y `ADD CONSTRAINT` sobre las tres tablas nuevas; ninguna FK apunta a una tabla `Fotorank*`.

---

### Task 4: Imágenes desde FotoRank — firma copiada y copia al bucket de Muestras

**Files:**
- Create: `apps/muestras/lib/concursos/firma.ts` (+ `firma.test.ts`), `apps/muestras/lib/concursos/imagen.ts` (+ `imagen.test.ts`)
- Modify: `apps/muestras/.env.example`, `apps/fotorank/app/lib/fotorank/external/entry-image-signing.ts` (sólo el comentario), `apps/fotoffice/lib/store/artworks/signing.ts` (sólo el comentario)

**Interfaces:**
- Consumes: `procesarImagen` (`lib/imagenes/procesar.ts`), `subirAR2` (`lib/imagenes/r2.ts`).
- Produces:
  - `firma.ts`: copia **idéntica** de `apps/fotorank/app/lib/fotorank/external/entry-image-signing.ts` (`signEntryImageUrl`, `verifyEntryImageSignature`), con el encabezado que lista las **tres** copias.
  - `imagen.ts`: `class ImagenDeConcursoError { code: "NOT_CONFIGURED" | "FETCH_FAILED" | "INVALID" }`; `claveDeObraDeConcurso(authorUserId: number | null, entryId: string): string` → `muestras/<authorUserId>/fr-<entryId>.webp` (sin cuenta: `muestras/concursos/fr-<entryId>.webp`; `entryId` sólo `[A-Za-z0-9_-]`); `copiarImagenDeConcurso({ entryId, authorUserId }, deps = { fetch, now, procesar, subir })` → `{ url, width, height }`.
  - Variables: `DNX_FOTORANK_LINK_SECRET` (obligatoria para copiar), `FOTORANK_PUBLIC_BASE_URL` (optativa, por omisión `https://fotorank.dnxsuite.com`).

- [ ] **Step 1: Tests que fallan**

`firma.test.ts`: el **mismo vector fijo** que `apps/fotoffice/lib/store/artworks/signing.test.ts` (copiar el caso con secreto, entryId, exp y firma esperada) da la misma URL; una firma tocada no verifica.
`imagen.test.ts` (con `fetch` falso): sin `DNX_FOTORANK_LINK_SECRET` → `NOT_CONFIGURED` y **no** llama a `fetch`; la URL pedida es `…/api/fotorank/external/entry-image?entryId=e1&variant=original&exp=…&wm=&sig=…` con `exp` a 10 minutos; respuesta 404 → `FETCH_FAILED`; cuerpo de más de 30 MB (por `content-length` o leyendo) → `FETCH_FAILED` sin procesar; imagen válida → `procesar(bytes, "obra")` y `subir(bytes, "muestras/7/fr-e1.webp", "image/webp")`; `ImagenInvalida` de `procesar` → `INVALID` con su mensaje; `entryId` con `/` → error antes de pedir.

- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter muestras test -- concursos/firma concursos/imagen` — Expected: FAIL.

- [ ] **Step 3: Implementar**

`imagen.ts`:
```ts
import "server-only";
import { signEntryImageUrl } from "./firma";
import { ImagenInvalida, procesarImagen } from "@/lib/imagenes/procesar";
import { subirAR2 } from "@/lib/imagenes/r2";

/**
 * Copia el original de una obra de FotoRank al bucket de Muestras (etapa 7, D12). Muestras no tiene
 * llaves del bucket privado de FotoRank: pide la imagen a `/api/fotorank/external/entry-image` con un
 * enlace firmado de 10 minutos (como la tienda de FOTOFFICE). FotoRank no revisa permisos: **firmar es
 * autorizar**, así que sólo se llama con obras de un resultado publicado que ya leyó `fotorank.ts`.
 * La clave es fija por obra: copiar dos veces pisa el mismo objeto.
 */
const BASE_POR_OMISION = "https://fotorank.dnxsuite.com";
const VIGENCIA_MS = 10 * 60 * 1000;
const ESPERA_MS = 30_000;
const MAX_BYTES = 30 * 1024 * 1024;

export class ImagenDeConcursoError extends Error {
  constructor(readonly code: "NOT_CONFIGURED" | "FETCH_FAILED" | "INVALID", mensaje: string) {
    super(mensaje);
    this.name = "ImagenDeConcursoError";
  }
}

export function claveDeObraDeConcurso(authorUserId: number | null, entryId: string): string {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(entryId)) throw new ImagenDeConcursoError("INVALID", "Obra inválida.");
  return authorUserId != null ? `muestras/${authorUserId}/fr-${entryId}.webp` : `muestras/concursos/fr-${entryId}.webp`;
}

export async function copiarImagenDeConcurso(
  obra: { entryId: string; authorUserId: number | null },
  deps = { fetch: globalThis.fetch, now: () => new Date(), procesar: procesarImagen, subir: subirAR2 },
): Promise<{ url: string; width: number; height: number }> {
  const clave = claveDeObraDeConcurso(obra.authorUserId, obra.entryId);
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- secreto de runtime, no afecta el build
  const secret = process.env.DNX_FOTORANK_LINK_SECRET?.trim();
  if (!secret) throw new ImagenDeConcursoError("NOT_CONFIGURED", "Falta configurar la conexión con FotoRank (avisale a la administración).");
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- optativa
  const baseUrl = process.env.FOTORANK_PUBLIC_BASE_URL?.trim() || BASE_POR_OMISION;
  const url = signEntryImageUrl({ baseUrl, entryId: obra.entryId, variant: "original", expiresAt: new Date(deps.now().getTime() + VIGENCIA_MS), secret });
  let bytes: Buffer;
  try {
    const r = await deps.fetch(url, { redirect: "follow", signal: AbortSignal.timeout(ESPERA_MS), cache: "no-store" });
    const largo = Number(r.headers.get("content-length") ?? 0);
    if (!r.ok || largo > MAX_BYTES) throw new Error(`estado ${r.status}`);
    bytes = Buffer.from(await r.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES) throw new Error("tamaño");
  } catch (err) {
    // Sin la URL: lleva la firma.
    console.error("[muestras] concurso imagen:", obra.entryId, err instanceof Error ? err.message : String(err));
    throw new ImagenDeConcursoError("FETCH_FAILED", "No pudimos traer la imagen de FotoRank. Probá de nuevo en un rato.");
  }
  try {
    const img = await deps.procesar(bytes, "obra");
    return { url: await deps.subir(img.bytes, clave, img.contentType), width: img.width, height: img.height };
  } catch (err) {
    if (err instanceof ImagenInvalida) throw new ImagenDeConcursoError("INVALID", err.message);
    throw err;
  }
}
```
`.env.example` de Muestras:
```
# Etapa 7 (concurso de FotoRank → muestra). Mismo valor que en FotoRank y FOTOFFICE.
DNX_FOTORANK_LINK_SECRET=""
# Optativa. Por omisión https://fotorank.dnxsuite.com
FOTORANK_PUBLIC_BASE_URL=""
```
En los encabezados de las otras dos copias del módulo de firma, agregar la tercera ruta (`apps/muestras/lib/concursos/firma.ts`); **nada más** en esos archivos.

- [ ] **Step 4: Correr**

Run: `pnpm --filter muestras test && pnpm --filter fotorank test:entry-image-signing && pnpm --filter fotoffice exec vitest run lib/store/artworks/signing.test.ts`
Expected: en verde; el vector fijo coincide en las tres copias.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras/lib/concursos apps/muestras/.env.example apps/fotorank/app/lib/fotorank/external/entry-image-signing.ts apps/fotoffice/lib/store/artworks/signing.ts
git commit -m "Muestras: copiar imágenes de FotoRank al bucket de Muestras con el enlace firmado"
```

**Acceptance:** la URL firmada nunca se registra en logs ni se devuelve al navegador; sin el secreto no sale ningún pedido.

---

### Task 5: Leer FotoRank — permiso del organizador y resultados del jurado

**Files:**
- Create: `apps/muestras/lib/concursos/fotorank.ts` (+ `fotorank.test.ts`)

**Interfaces:**
- Consumes: `pickResultBatch`, `contestSelections`, `distinctionText`, `rankContestWorks`, `rightsFromConfigurationJson`, `exhibitBasisFromRights`, `MARATHON_NOT_SUPPORTED` (Task 1). Patrón de lectura de la tienda de FOTOFFICE (`awardsByEntry`, `authorNames`, `ENTRY_RULES_SELECT` en `apps/fotoffice/lib/store/artworks/{catalog,consent}.ts`), **copiado**, no importado.
- Produces:
  - `ROLES_QUE_ARMAN = ["OWNER", "ADMIN", "EDITOR"]`.
  - `puedeArmarDesdeConcurso(usuario, contestId): Promise<boolean>` — super admin o `contestOrganizationMember` `ACTIVE` con rol en `ROLES_QUE_ARMAN` en la organización del concurso.
  - `concursosParaArmar(usuario)` → concursos propios (no maratones) de esas organizaciones (super admin: todos los que tienen lote usable, tope 50) con `{ id, title, slug, organizationName, batchStatus, batchDate, counts: { WINNER, MENTION, FINALIST }, muestras: [{ id, title, reviewStatus }] }`, sólo los que tienen un lote `FINALIZED`/`PUBLISHED`.
  - `resultadosDelConcurso(contestId)` → `{ ok: false, motivo: "NO_EXISTE" | "MARATON" | "SIN_RESULTADOS" }` o `{ ok: true, contest: { id, title, slug, shortDescription, organizationId, organizationName, visibility, status }, batch: { id, status, version: Date }, categories, works: ObraDelConcurso[] }` con `ObraDelConcurso = { entryId, authorUserId, authorName, title, tier, awardType, categoryId, categoryName, distinction, rank, exhibitBasis, attributionRequired }`. Sólo obras `CONFIRMED` (o `UPLOADED`/`READY_TO_CONFIRM` que ya pasaron por el jurado: se aceptan todas menos `REJECTED`, `WITHDRAWN`, `REPLACED`, `DRAFT`) y sin `withdrawnAt`.
  - Mensajes para la página: `NO_EXISTE` → "El concurso no existe."; `MARATON` → `MARATHON_NOT_SUPPORTED`; `SIN_RESULTADOS` → "Este concurso todavía no tiene resultados cerrados por el jurado. Cuando el jurado los cierre en FotoRank, vas a poder armar la muestra."

- [ ] **Step 1: Tests que fallan**

`fotorank.test.ts` (con `@repo/db` mockeado):
- Permiso: miembro `ACTIVE` `EDITOR` → true; `JUDGE`, `VIEWER` o `REMOVED` → false; otra organización → false; super admin → true sin consultar membresías; id con caracteres raros → false sin consultar.
- Fuente: sólo lotes `FINALIZED`/`PUBLISHED` (el `where` del mock lo pide); con uno `FINALIZED` más nuevo que uno `PUBLISHED`, usa el `FINALIZED`; sin lote usable → `SIN_RESULTADOS`; concurso con `experienceType = MARATHON` → `MARATON`; concurso inexistente → `NO_EXISTE`.
- Obras: descalificadas fuera; `WITHDRAWN`, `REJECTED` o con `withdrawnAt` fuera; título vacío → "Obra <entryNumber>"; nombre del autor de `fotorankProfile.displayName` y si no `user.name` (y si no, "Autor/a sin nombre"); base `RULES` sólo con `allowExhibition` en las bases de **su** inscripción; `attributionRequired` de esas bases.
- **Anonimato:** recorre todos los argumentos `select` recibidos por los mocks de `fotorankResultBatch`, `fotorankResultEntry`, `fotorankJuryEntrySnapshot` y `fotorankContestEntry` y verifica que ninguno pide `anonymousCode`, `anonymousJuryCode`, `aggregateScore`, `normalizedScore`, `medianScore`, `dispersion`, `evaluationCount`, `juryDecisionNote`, `metadata`, `email` ni `phone`; y que el resultado serializado no contiene el código anónimo del mock.
- No usa el cliente cruzado: el módulo no importa `@repo/db/clickaton-jury-client`.

- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter muestras test -- concursos/fotorank` — Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
import "server-only";
import { prisma } from "@repo/db";
import {
  contestSelections, distinctionText, exhibitBasisFromRights, pickResultBatch, rankContestWorks, rightsFromConfigurationJson,
  USABLE_BATCH_STATUSES,
} from "@repo/muestras";
import type { Usuario } from "@/lib/usuario";

/**
 * El ÚNICO lugar de Muestras que lee tablas de FotoRank (etapa 7, D4). Misma base, misma tabla `User`.
 * Fuente: el último lote de resultados FINALIZED o PUBLISHED, como diplomas, imágenes de ganadores y la
 * tienda de FOTOFFICE (la publicación oficial LIVE está trabada en producción). Lo ve sólo la organización
 * del concurso; lo público es la muestra, que pasa por su revisión. Nunca códigos anónimos, puntajes,
 * votos, jurados, notas, email ni teléfono. Las maratones de Clickatón viven en otra base: no se leen.
 */
export const ROLES_QUE_ARMAN = ["OWNER", "ADMIN", "EDITOR"] as const;
const ES_ID = /^[A-Za-z0-9_-]{1,64}$/;
const ESTADOS_DE_OBRA_FUERA = ["REJECTED", "WITHDRAWN", "REPLACED", "DRAFT"];

export async function puedeArmarDesdeConcurso(usuario: Pick<Usuario, "id" | "esSuperAdmin">, contestId: string): Promise<boolean> {
  if (typeof contestId !== "string" || !ES_ID.test(contestId)) return false;
  const c = await prisma.fotorankContest.findUnique({ where: { id: contestId }, select: { organizationId: true } });
  if (!c) return false;
  if (usuario.esSuperAdmin) return true;
  const n = await prisma.contestOrganizationMember.count({
    where: { organizationId: c.organizationId, userId: usuario.id, status: "ACTIVE", role: { in: [...ROLES_QUE_ARMAN] } },
  });
  return n > 0;
}

export async function resultadosDelConcurso(contestId: string) {
  if (!ES_ID.test(contestId)) return { ok: false as const, motivo: "NO_EXISTE" as const };
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: {
      id: true, title: true, slug: true, shortDescription: true, visibility: true, status: true, experienceType: true,
      organizationId: true, organization: { select: { name: true } },
      categories: { select: { id: true, name: true, sortOrder: true } },
    },
  });
  if (!contest) return { ok: false as const, motivo: "NO_EXISTE" as const };
  if (contest.experienceType === "MARATHON") return { ok: false as const, motivo: "MARATON" as const };
  const lotes = await prisma.fotorankResultBatch.findMany({
    where: { contestId, status: { in: [...USABLE_BATCH_STATUSES] } },
    select: { id: true, status: true, finalizedAt: true, publishedAt: true, updatedAt: true },
  });
  const lote = pickResultBatch(lotes);
  if (!lote) return { ok: false as const, motivo: "SIN_RESULTADOS" as const };
  const filas = await prisma.fotorankResultEntry.findMany({
    where: { resultBatchId: lote.id, resultStatus: { not: "DISQUALIFIED" }, OR: [{ awardType: { not: null } }, { resultStatus: { in: ["WINNER", "MENTION", "FINALIST"] } }] },
    select: { juryEntrySnapshotId: true, categoryId: true, resultStatus: true, awardType: true, finalPosition: true, preliminaryPosition: true },
  });
  const elegidas = contestSelections(filas.map((r) => ({
    snapshotId: r.juryEntrySnapshotId, categoryId: r.categoryId, resultStatus: r.resultStatus, awardType: r.awardType,
    position: r.finalPosition ?? r.preliminaryPosition,
  })));
  // … snapshots → entryId (select id, entryId); obras (id, title, entryNumber, authorUserId, status, withdrawnAt,
  // registration → rulesVersion → configurationVersion → configurationJson), filtrar ESTADOS_DE_OBRA_FUERA y withdrawnAt;
  // nombres (fotorankProfile.displayName, user.name); armar ObraDelConcurso con distinctionText y rankContestWorks;
  // exhibitBasisFromRights(rightsFromConfigurationJson(json)) y attributionRequired.
}
```
`concursosParaArmar`: organizaciones de la persona (`contestOrganizationMember` `ACTIVE` + `ROLES_QUE_ARMAN`), sus concursos (`experienceType` distinto de `MARATHON`) con algún lote usable; para cada uno `pickResultBatch` y los conteos por nivel (un `groupBy` o un `findMany` con `select` mínimo + `tierOf`); `culturalContestImport.findMany({ where: { contestId: { in } }, select: { contestId: true, activity: { select: { id: true, title: true, reviewStatus: true } } } })` filtrado por `dondePuede(usuario, "view")`.

- [ ] **Step 4: Correr** — Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types` — Expected: en verde.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras/lib/concursos
git commit -m "Muestras: leer de FotoRank los resultados del jurado y quién organiza cada concurso, sin romper el anonimato"
```

**Acceptance:** el test de anonimato pasa; un lote `REVIEW_REQUIRED` o `CANCELLED` no se usa; una maratón da el mensaje claro.

---

### Task 6: Armar la muestra — "Concursos" en el panel, muestra nueva o existente, idempotente

**Files:**
- Create: `apps/muestras/lib/concursos/armar.ts` (+ `armar.test.ts`), `apps/muestras/lib/concursos/acciones.ts` (+ `acciones.test.ts`), `apps/muestras/app/panel/concursos/page.tsx`, `apps/muestras/app/panel/concursos/[contestId]/page.tsx`, `apps/muestras/components/concursos/{armar-muestra.tsx, estilos.ts}`
- Modify: `apps/muestras/lib/limite.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: Task 1, Task 5; `newSlug`, `dayStartAr`, `dayEndAr`, `toArDay`, `canEdit`, `activityRole`, `MAX_WORKS`; `datosDeCambio` (del editor; si no se exporta, exportarlo).
- Produces:
  - `armar.ts` (no es `"use server"`): `aplicarResultados(tx, { activityId, importId, resultados, tiers, usuarioId })` → `{ creadas, actualizadas, gone }`. Dentro de una transacción que ya bloqueó la muestra. Crea `CulturalContestWork` (con `exhibitBasis`, `attributionRequired`, `exhibitConsent = "ACCEPTED"` y `consentBy = "RULES"` si la base es `RULES`, si no `PENDING`), crea/actualiza `CulturalContestAuthor` (uno por `authorUserId`; sin cuenta, uno por obra), actualiza premio/categoría/orden de las existentes (nunca `include`, `title` ni permisos) y marca `GONE` las que ya no están. Actualiza `CulturalContestImport` (`tiers`, `resultBatchId`, `resultBatchStatus`, `sourceVersion` = `updatedAt` del lote, `syncedAt`).
  - `acciones.ts` (`"use server"`):
    - `armarMuestraDesdeConcurso(fd)`: `contestId`, `tiers[]`, `destino` (`"nueva"` o el id de una muestra). Sesión; freno `armarDesdeConcurso` 10/h; `puedeArmarDesdeConcurso`; `resultadosDelConcurso` (si no `ok`: el mensaje de su `motivo`, Task 5; maratón → `MARATHON_NOT_SUPPORTED`). **Nueva:** crea `CulturalActivity` (D8) y el import en la misma transacción. **Existente:** `rolEnMuestra` = `OWNER` (o super admin), `type = MUESTRA`, `canEdit`, sin otro import (si ya tiene uno del **mismo** concurso, se comporta como actualizar; de **otro**: "Esta muestra ya tiene obras de otro concurso."). Siempre `SELECT id FROM "CulturalActivity" WHERE id = … FOR UPDATE`, `planContestImport` (si hay problemas, corta con el texto) y `aplicarResultados`. Devuelve `{ ok: true, id }` y la página lleva a `/panel/muestras/<id>/concurso`.
    - `actualizarDesdeConcurso(activityId, tiers?)`: `contest` + `puedeArmarDesdeConcurso` sobre el concurso guardado; freno `actualizarConcurso` 30/h; misma transacción. Si ya no hay lote usable (p. ej. el jurado reabrió y el lote quedó `CANCELLED`): "Los resultados de este concurso ya no están cerrados en FotoRank. La muestra queda como está."
  - Página `/panel/concursos` (`requireUsuario("/panel/concursos")`): lista de `concursosParaArmar`; sin organizaciones: "Cuando organices un concurso en FotoRank y publiques sus resultados, lo vas a ver acá para armar la muestra." `?concurso=<id>` redirige a `/panel/concursos/<id>`.
  - Página `/panel/concursos/[contestId]` (`requireUsuario`, `notFound()` sin `puedeArmarDesdeConcurso`; sin resultados o maratón, el mensaje de la Task 5 sin botón): título del concurso, organización, "Resultados cerrados por el jurado el <fecha>" (o "publicados el <fecha>"), cuántas obras por nivel con casillas (ganadores y menciones marcadas), "¿Dónde van?" (muestra nueva / tus muestras de tipo muestra editables sin otro concurso), el aviso "Las imágenes se copian de FotoRank después de armar; los autores van a ver sus obras en 'Dónde expongo'.", botón **"Armar la muestra"**; si ya hay muestras de este concurso, "Ya armaste: <título>" con enlace.
  - `lib/limite.ts`: `armarDesdeConcurso` 10/h, `actualizarConcurso` 30/h, `copiarImagenesConcurso` 600/10 min, `opcionesConcurso` 600/10 min, `respuestaAutor` 120/h.

- [ ] **Step 1: Tests que fallan**

`armar.test.ts` y `acciones.test.ts`: sin sesión → "Tenés que ingresar."; `JUDGE` de la organización → "El concurso no existe."; sin lote cerrado → mensaje; maratón → mensaje; muestra nueva → crea actividad `DRAFT` `MUESTRA` con `proposedByUserId` = usuario, título "Muestra <concurso>", fechas `dayStartAr(+30)`/`dayEndAr(+59)`, `organizersText` = organización, import con `tiers` y lote; obras con base `RULES` → `ACCEPTED`/`RULES` y `attributionRequired` de sus bases; `EXPLICIT` → `PENDING`; **dos llamadas seguidas no duplican** (la segunda: `create` vacío); obra sacada (`include=false`) no se vuelve a sumar; obra que desaparece → `GONE` y sigue; muestra existente de otra persona → "La muestra no existe."; en revisión → "La muestra no se puede editar ahora (está en revisión o despublicada)."; con otro concurso → mensaje; tope 300 → mensaje de `planContestImport`; `actualizar` sin lote usable → mensaje y nada cambia; con un lote nuevo → `sourceVersion` nuevo.

- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter muestras test -- concursos/armar concursos/acciones limite` — Expected: FAIL.

- [ ] **Step 3: Implementar** (patrón de `armarMuestra` en `lib/seleccion/acciones.ts`: `class Corte`, transacción con `{ timeout: 60_000, maxWait: 10_000 }`, `revalidatePath("/panel", "layout")`).

- [ ] **Step 4: Correr** — Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint` — Expected: en verde.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: armar una muestra desde un concurso de FotoRank — niveles, muestra nueva o existente, sin duplicar"
```

**Acceptance:** doble clic en "Armar la muestra" crea **una** muestra y una fila por obra.

---

### Task 7: Llevar a la galería — copiar imágenes por tandas y sincronizar con `CulturalActivityWork`

**Files:**
- Create: `apps/muestras/lib/concursos/galeria.ts` (+ `galeria.test.ts`), `apps/muestras/components/concursos/copiar-imagenes.tsx`
- Modify: `apps/muestras/lib/concursos/acciones.ts` (+ test), `apps/muestras/lib/concursos/armar.ts`

**Interfaces:**
- Consumes: `contestWorkInGallery`, `CONTEST_IMAGE_BATCH`, `MAX_WORKS`; `copiarImagenDeConcurso` (Task 4).
- Produces:
  - `sincronizarObraConGaleria(tx, activityId, contestWorkId)` (no `"use server"`): si `contestWorkInGallery(row)` y no tiene `activityWorkId` vigente → crea `CulturalActivityWork` (`imageUrl`, `title`, `authorName` y perfil según `authorCredit` (D28): con crédito, `displayName` del autor (o el nombre de FotoRank) y `authorProfileId` = su perfil si tiene; sin crédito, `"Autoría reservada"` y `authorProfileId = null`; `authorUserId` siempre, `sortOrder` = después de la última obra del concurso que ya está, o al final; `isHighlight: false`) y guarda `activityWorkId` (si la muestra llegó a `MAX_WORKS`: no la crea y deja la fila con `imageError = null` y el aviso "La muestra llegó al máximo técnico de 300 obras."); si ya está y debe seguir → actualiza imagen, nombre y perfil (así pasa de "Autoría reservada" al nombre cuando el autor confirma); si no debe estar y está → borra la obra de la muestra y limpia `activityWorkId` (también saca sus códigos de sala: `culturalActivityRoomCode.deleteMany({ where: { activityId, workId } })`).
  - `copiarImagenesDelConcurso(activityId)` (`"use server"`, `contest`, freno `copiarImagenesConcurso`): toma hasta `CONTEST_IMAGE_BATCH` filas `include = true` con `imageStatus` `PENDING` (o `FAILED` si se pidió reintentar), las copia **fuera** de la transacción (una por una), y por cada una abre una transacción corta con `FOR UPDATE` sobre la muestra: `imageStatus = COPIED`, `imageUrl`, `copiedAt` y `sincronizarObraConGaleria`. Devuelve `{ ok: true, copiadas, faltan, fallaron }`. `reintentarImagenes(activityId)` pasa las `FAILED` a `PENDING`.
  - `armar.ts`: al final de `aplicarResultados`, `sincronizarObraConGaleria` para las que ya tengan imagen (re-armar).
  - `CopiarImagenes` (cliente): mientras `faltan > 0`, llama a la acción una y otra vez y muestra "Copiando imágenes: 12 de 40"; con error de configuración, lo muestra y frena; "Podés cerrar esta página: seguimos donde quedó la próxima vez que entres."

- [ ] **Step 1: Tests que fallan**

`galeria.test.ts`: con permiso y copiada → crea la obra de la muestra con autor e imagen; base `RULES` sin `attributionRequired` → "Autoría reservada" sin perfil; con `attributionRequired` → el nombre; `PENDING` de permiso → no la crea; el autor la sacó → la borra y saca su código de sala; tope 300 → no crea y avisa; re-sincronizar no duplica. `acciones.test.ts`: la tanda copia como mucho 6; una que falla queda `FAILED` con el mensaje y las demás siguen; sin secreto → todas `FAILED` con "Falta configurar…" y la acción lo devuelve arriba; coorganización → 404/"La muestra no existe.".

- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter muestras test -- concursos/galeria concursos/acciones` — Expected: FAIL.

- [ ] **Step 3: Implementar.**

- [ ] **Step 4: Correr** — Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types` — Expected: en verde.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: copiar por tandas las imágenes del concurso y llevar a la galería lo que tiene permiso"
```

**Acceptance:** cortar la copia a la mitad (cerrar la pestaña) y volver a abrir el panel sigue desde donde quedó, sin duplicar obras.

---

### Task 8: Panel "Del concurso" — casillas por obra, permisos, enlaces a autores y actualizar

**Files:**
- Create: `apps/muestras/app/panel/muestras/[id]/concurso/page.tsx`, `apps/muestras/lib/concursos/consultas.ts`, `apps/muestras/components/concursos/{panel-concurso.tsx, obra-concurso.tsx, enlace-autor.tsx}`
- Modify: `apps/muestras/lib/concursos/acciones.ts` (+ test), `apps/muestras/app/panel/muestras/[id]/page.tsx`, `apps/muestras/app/panel/muestras/page.tsx`

**Interfaces:**
- Consumes: `CopiarEnlace` (`components/enlace/copiar-enlace.tsx`), `APP_URL` (`lib/correos/enviar.ts`), `contestShareMessage`, `authorPendingCount`, `contestConsentTransition`.
- Produces:
  - `panelDelConcurso(activityId, usuario)` (`dondePuede(usuario, "view")`; `puedeEditar = puede(usuario, "contest", rol)`): import (concurso, organización, niveles, `syncedAt`, `cambió` = el último lote publicado no es el guardado, o su hash cambió), obras ordenadas por `rank` (imagen copiada, título, autor, premio, `sourceStatus`, `imageStatus`/`imageError`, casillas, permiso, venta, `enLaMuestra = activityWorkId != null`), autores (nombre, cuántas pendientes, `notifiedAt`, enlace).
  - Acciones (`contest`, freno `opcionesConcurso`): `guardarOpcionesDeObra(contestWorkId, { include, toPrint, forSale })` (desmarcar `include` desmarca `toPrint`; marcar `forSale` → `saleConsent = PENDING` si estaba `NOT_ASKED`; desmarcarlo → `NOT_ASKED` salvo que el autor ya respondió, en cuyo caso queda su respuesta y sólo cambia `forSale`); `sacarObraDelConcurso(contestWorkId)` (= `include=false`); `marcarAutorizacionEscrita(contestWorkId)` (`writtenConsent`); `marcarEnlaceMandado(authorId)`. Todas con `FOR UPDATE` sobre la muestra y `sincronizarObraConGaleria`; con la muestra en revisión: "La muestra está en revisión: esperá a que se revise para cambiar sus obras.".
  - Página `/panel/muestras/[id]/concurso` (`requireUsuario`; `notFound()` sin `view` o sin import): arriba "Obras de <concurso> (<organización>)" y, si `cambió`, el recuadro "Los resultados de FotoRank cambiaron desde que armaste la muestra." + **"Actualizar desde FotoRank"** (también siempre como botón chico, con los niveles); `CopiarImagenes` si faltan; resumen ("32 obras: 20 en la muestra, 8 esperan al autor, 4 sacadas"); por obra una fila con miniatura, título, autor (con "Se va a ver su nombre" o "Autoría reservada hasta que el autor confirme", D28), premio, casillas **"Galería virtual"**, **"Se imprime"**, **"A la venta"** (con la nota "La venta llega más adelante: por ahora sólo le preguntamos al autor si está de acuerdo."), estado del permiso en palabras ("Las bases lo autorizan", "Esperando al autor", "Aceptó", "Prefirió que no", "Sacada por el autor") y los botones que correspondan; `GONE` → "Ya no figura en los resultados del concurso" + "Sacar de la muestra". Sección **"Autores"**: por autor, `EnlaceAutor` con el enlace y "Copiar mensaje" (`contestShareMessage`), "Ya se lo mandé", y para obras sin cuenta "Tengo su autorización por escrito". En modo lectura (coorganización) sin botones.
  - `app/panel/muestras/[id]/page.tsx`: enlace "Del concurso (<n> esperan al autor)" si hay import; `app/panel/muestras/page.tsx`: la misma cuenta en la fila de la muestra.

- [ ] **Step 1: Tests que fallan** — casillas (reglas de arriba), sacar, autorización escrita sólo en `PENDING`, coorganización no cambia nada, muestra en revisión, enlace mandado guarda la fecha; `panelDelConcurso` de alguien sin `view` → `null`.

- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter muestras test -- concursos` — Expected: FAIL.

- [ ] **Step 3: Implementar.**

- [ ] **Step 4: Correr** — Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint` — Expected: en verde.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: panel Del concurso — galería, impresión y venta por obra, permisos, enlaces a autores y actualizar desde FotoRank"
```

**Acceptance:** a 375 px el panel no tiene scroll horizontal; la coorganización lo ve sin botones.

---

### Task 9: Convivencia con el editor de la muestra

**Files:**
- Modify: `apps/muestras/lib/actividades/acciones.ts` (+ `acciones.test.ts`), `apps/muestras/lib/actividades/consultas.ts`, `apps/muestras/components/formulario/obras.tsx`

**Interfaces:**
- Produces: en `guardarBorrador`, además de `expositoras`, se leen `culturalContestWork.findMany({ where: { activityId: id, activityWorkId: { not: null } }, select: { id: true, activityWorkId: true } })` y sus ids se suman al conjunto que **conserva imagen y autor** (`deExpositor` → renombrar el parámetro de `obrasParaGuardar` a `conservaImagenYAutor`). Si el editor quita una obra del concurso: `culturalContestWork.updateMany({ where: { activityId: id, activityWorkId: { in: quitadas } }, data: { include: false, toPrint: false, activityWorkId: null } })`. `consultas.ts` agrega `contestWorkIds` como `exhibitorWorkIds`; el editor muestra "Viene del concurso" en lugar de los campos de imagen y autor.

- [ ] **Step 1: Tests que fallan** — guardar con otra imagen o autor en una obra del concurso → se conservan los de la base; título, año y técnica sí cambian; quitarla → `include=false` y no vuelve con "Actualizar desde FotoRank" (test de punta a punta con `planContestImport`); las de expositores siguen igual.

- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter muestras test -- actividades/acciones` — Expected: FAIL.

- [ ] **Step 3: Implementar.**

- [ ] **Step 4: Correr** — Run: `pnpm --filter muestras test` — Expected: en verde.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: el editor conserva imagen y autor de las obras del concurso, y quitarlas las saca de la muestra"
```

**Acceptance:** ninguna prueba de la etapa 6 cambia de resultado.

---

### Task 10: El autor — "Tus obras de concursos" en "Dónde expongo", aceptar, sacar, venta y firma

**Files:**
- Create: `apps/muestras/lib/concursos/autor.ts` (+ `autor.test.ts`), `apps/muestras/app/panel/expositor/concurso/[id]/page.tsx`, `apps/muestras/components/concursos/respuesta-autor.tsx`
- Modify: `apps/muestras/lib/concursos/consultas.ts`, `apps/muestras/app/panel/expositor/page.tsx`, `apps/muestras/app/privacidad/page.tsx`

**Interfaces:**
- Consumes: `contestConsentTransition`, `CONTEST_EXHIBIT_TEXT(_VERSION)`, `SALE_CONSENT_TEXT`, `temporalStatus` (muestra cerrada); `crearOActualizarPerfil` (`lib/perfiles/crear.ts`); el formulario de perfil del alta de expositores (`components/expositores/alta-expositor.tsx`, extraer la parte de perfil a un componente compartido si hace falta).
- Produces:
  - `misObrasDeConcursos(usuario)` → por fila `CulturalContestAuthor` con `userId = usuario.id`: muestra (título, slug si `APPROVED`, fechas, sede o "Sede a confirmar", cancelada), concurso, organización, cuántas esperan respuesta.
  - `miAutoriaEnMuestra(id, usuario)` → `null` si la fila no es de esta cuenta (la página muestra "Este enlace es para otra cuenta. Entrá con la cuenta con la que participaste en el concurso."); si es, las obras (imagen copiada, título, premio, base, permiso, venta, si está en la muestra).
  - `responderComoAutor(fd)` (`"use server"`): `contestWorkId`, `accion` (`accept` | `decline` | `withdraw` | `reconsider` | `acceptSale` | `declineSale`), `version` (debe ser `CONTEST_EXHIBIT_TEXT_VERSION` en `accept`/`reconsider`: si no, "Actualizá la página: cambió el texto de la autorización."). Lee la fila **por** `authorUserId = usuario.id` (y la del autor), freno `respuestaAutor`; transacción con `FOR UPDATE` sobre la muestra; `contestConsentTransition`; `consentBy = AUTHOR`, `consentAt`; `respondedAt` y `textVersion` en el autor; `sincronizarObraConGaleria`; revalida la muestra pública y `/fotografos`.
  - `guardarFirmaDeAutor(fd)`: "Cómo firmás" (≤ 120) + perfil (`crearOActualizarPerfil`, en la misma transacción); actualiza `displayName`/`profileId` del autor y vuelve a sincronizar sus obras (`sincronizarObraConGaleria`): completar "Cómo firmás" cuenta como confirmación del nombre (D28), así una obra con "Autoría reservada" pasa a su nombre. La primera aceptación pide la firma en el mismo formulario (con su nombre de FotoRank precargado).
  - "Dónde expongo": sección **"Tus obras de concursos"** debajo de lo de la etapa 6 (aunque no tenga participaciones por enlace); el texto vacío de la página cambia a "Todavía no expusiste por acá. Cuando una organización te mande su enlace, o arme una muestra con un concurso donde participaste, la vas a ver en esta lista."
  - `/privacidad`: un párrafo: "Si participaste en un concurso de FotoRank y la organización arma una muestra con sus obras, copiamos la imagen de tu obra, su título, tu nombre y el premio. Tu nombre sólo se publica si las bases que aceptaste lo piden o si lo confirmás; si no, la obra figura como 'Autoría reservada'. Vos decidís si se expone y si se puede vender, desde 'Dónde expongo'."

- [ ] **Step 1: Tests que fallan** — otra cuenta no responde (ni con el id correcto); `EXPLICIT` aceptar → entra a la muestra (mock de `sincronizarObraConGaleria`); no aceptar → no entra; `RULES` sacar → se borra de la muestra; muestra cerrada → "La muestra ya cerró."; versión vieja → mensaje; venta sólo si `forSale`; la firma cambia `authorName` de sus obras (también las que estaban como "Autoría reservada") y vincula el perfil; autor sin perfil → se crea con su nombre.

- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter muestras test -- concursos/autor` — Expected: FAIL.

- [ ] **Step 3: Implementar.** Página del autor: `requireUsuario("/panel/expositor/concurso/<id>")`, `dynamic = "force-dynamic"`, `noindex`; textos de D19; las imágenes son las copiadas (de nuestro bucket).

- [ ] **Step 4: Correr** — Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint` — Expected: en verde.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: el autor ve sus obras de concursos en Dónde expongo y decide si se exponen y si se pueden vender"
```

**Acceptance:** entrando con otra cuenta al enlace de un autor no se ve ninguna imagen ni dato de sus obras.

---

### Task 11: Lo público en Muestras — premio en obra, sala, fichas y catálogo; "Muestra del concurso"; obras sólo online

**Files:**
- Create: `apps/muestras/lib/concursos/publico.ts` (+ `publico.test.ts`)
- Modify: `apps/muestras/app/m/[slug]/page.tsx`, `apps/muestras/app/m/[slug]/o/[workId]/page.tsx`, `apps/muestras/app/m/[slug]/sala/o/[workId]/page.tsx`, `apps/muestras/lib/actividades/consultas.ts`, `apps/muestras/lib/fichas/cargar.ts` (+ test), `apps/muestras/lib/piezas/cargar.ts` (+ test)

**Interfaces:**
- Produces:
  - `distinctionsForWorks(activityId, workIds)` → `Map<activityWorkId, string>` ("1.er premio · Paisaje — <Concurso>"), sólo filas `include` con `activityWorkId`.
  - `concursoDeMuestra(activityId)` → `{ title, url | null }` (título guardado en el import; `url` = `FOTORANK_PUBLIC_BASE_URL/concursos/<slug>` sólo si el concurso existe, es `PUBLIC` y está `PUBLISHED`/`ACTIVE` —un concurso terminado da 404 en FotoRank—; la lectura del concurso es una función más de `lib/concursos/fotorank.ts`, `estadoPublicoDelConcurso(contestId)`).
  - `obrasSoloOnline(activityId)` → `Set<activityWorkId>` con `toPrint = false`.
  - `/m/[slug]`: debajo de "Organiza …", "Muestra del concurso <título>" (con enlace si hay `url`). Sigue ISR; sólo se agrega una consulta.
  - Página de obra y vista de sala: la línea del premio debajo del título, **sólo** cuando la obra se muestra con imagen (respeta `workAccess` de la etapa 6).
  - Fichas (`cargar.ts`): sin las obras `toPrint = false`; el premio va antes de los datos (`datosDeFicha(..., { distincion })`). Catálogo, marcos por tandas y plano (`lib/piezas/cargar.ts`): sin las obras sólo online; el catálogo suma el premio. El marco no cambia.

- [ ] **Step 1: Tests que fallan** — `distinctionsForWorks` sólo trae las incluidas; ficha de una obra del concurso trae "1.er premio · Paisaje — Concurso X" antes de "2024. …"; una obra sólo online no sale en fichas, catálogo ni marcos; una obra oculta por la sorpresa no muestra el premio (test sobre la página de obra con el ajuste "Sorpresa total").

- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter muestras test -- concursos/publico fichas piezas` — Expected: FAIL.

- [ ] **Step 3: Implementar.**

- [ ] **Step 4: Correr** — Run: `pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types` — Expected: en verde.

- [ ] **Step 5: Commit**

```bash
git add apps/muestras
git commit -m "Muestras: el premio del concurso en la obra, la sala, las fichas y el catálogo, y el enlace al concurso"
```

**Acceptance:** una muestra sin concurso se ve exactamente igual que antes.

---

### Task 12: FotoRank — "Armar muestra" en resultados y "Muestras del concurso" en lo público

**Files:**
- Create: `apps/fotorank/app/lib/fotorank/external/muestras.ts` (+ `muestras.test.ts`), `apps/fotorank/app/components/contest-public/MuestrasDelConcurso.tsx`
- Modify: `apps/fotorank/app/(dashboard)/dashboard/concursos/[id]/resultados/page.tsx`, `apps/fotorank/app/concursos/[slug]/resultados/page.tsx`, `apps/fotorank/app/concursos/[slug]/page.tsx`, `apps/fotorank/package.json` (script `test:muestras`), `apps/fotorank/.env.example`

**Interfaces:**
- Produces (`muestras.ts`, módulo chico, sin dependencias nuevas):
```ts
/**
 * Enlaces entre FotoRank y Muestras Fotográficas (etapa 7 de Muestras). Misma base: FotoRank sólo LEE
 * las muestras publicadas que salieron de un concurso. Nunca rompe una página: ante cualquier error
 * (por ejemplo, la migración de Muestras todavía no aplicada) devuelve una lista vacía.
 */
import { prisma } from "@repo/db";

const MUESTRAS_POR_OMISION = "https://muestrasfotograficas.com";

export function muestrasBaseUrl(): string {
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- optativa, de runtime
  return (process.env.MUESTRAS_PUBLIC_BASE_URL?.trim() || MUESTRAS_POR_OMISION).replace(/\/+$/, "");
}

export function armarMuestraUrl(contestId: string): string {
  return `${muestrasBaseUrl()}/panel/concursos/${encodeURIComponent(contestId)}`;
}

export type MuestraDelConcurso = { title: string; url: string; venue: string | null; city: string | null; startsAt: Date; endsAt: Date };

type Db = { culturalContestImport: { findMany: (args: unknown) => Promise<Array<{ activity: { slug: string; title: string; venueName: string | null; city: string | null; startsAt: Date; endsAt: Date } }>> } };

export async function muestrasDelConcurso(contestId: string, db: Db = prisma as unknown as Db): Promise<MuestraDelConcurso[]> {
  try {
    const filas = await db.culturalContestImport.findMany({
      where: { contestId, activity: { reviewStatus: "APPROVED", isCancelled: false, type: "MUESTRA" } },
      select: { activity: { select: { slug: true, title: true, venueName: true, city: true, startsAt: true, endsAt: true } } },
      orderBy: { createdAt: "asc" },
      take: 10,
    });
    return filas.map(({ activity: a }) => ({
      title: a.title, url: `${muestrasBaseUrl()}/m/${encodeURIComponent(a.slug)}`, venue: a.venueName, city: a.city, startsAt: a.startsAt, endsAt: a.endsAt,
    }));
  } catch (err) {
    console.error("[fotorank] muestras del concurso:", err instanceof Error ? err.message : String(err));
    return [];
  }
}
```
- `MuestrasDelConcurso.tsx` (componente de servidor, `async`, recibe `contestId`): si la lista está vacía, `null`; si no, un recuadro `fr-recuadro` "Muestras del concurso" con, por muestra, título, sede y ciudad, fechas (`es-AR`, zona `America/Argentina/Buenos_Aires`) y el enlace **"Ver la muestra en la sala"** (`target="_blank" rel="noopener"`).
- `concursos/[slug]/resultados/page.tsx`: en **las dos ramas** (resultados oficiales publicados y "Resultados todavía no publicados", que es lo que hoy ve todo el mundo porque la publicación `LIVE` está trabada), al final del `<div>`, `<MuestrasDelConcurso contestId={…} />`. Como el payload público no trae el id, leer `prisma.fotorankContest.findFirst({ where: { slug }, select: { id: true } })` en la página (una consulta más; no se toca `getPublicResultsPayload`).
- `concursos/[slug]/page.tsx`: después de `<ContestPublicLanding … />`, `<MuestrasDelConcurso contestId={data.contest.id} />`.
- Panel `resultados/page.tsx`: después de los chequeos de organización existentes, si el concurso no es una maratón (`experienceType` distinto de `MARATHON`), hay un lote `FINALIZED` o `PUBLISHED` y la persona es super admin o miembro `ACTIVE` `OWNER`/`ADMIN`/`EDITOR` de la organización del concurso → recuadro (`PageInfoRecuadro`) **"Llevá los ganadores a una muestra"**: "Armá en Muestras Fotográficas una muestra con las obras ganadoras y preseleccionadas: te llega un borrador con las imágenes, los autores y los premios." + botón **"Armar muestra"** (`<a href={armarMuestraUrl(contest.id)} className="fr-btn fr-btn-primary" target="_blank" rel="noopener">`). Sin lote cerrado: "Cuando el jurado cierre los resultados vas a poder armar una muestra con las obras."; en maratones, nada. Nada más cambia en la página.
- `package.json`: `"test:muestras": "pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/external/muestras.test.ts"`.
- `.env.example`: `# Optativa. Por omisión https://muestrasfotograficas.com` + `MUESTRAS_PUBLIC_BASE_URL=`.

- [ ] **Step 1: Tests que fallan** (`node:test`, como `contest-store-usage.test.ts`): `armarMuestraUrl("abc")` → `https://muestrasfotograficas.com/panel/concursos/abc`; con `MUESTRAS_PUBLIC_BASE_URL=http://localhost:3014/` → sin barra doble; `muestrasDelConcurso` con un `db` falso que tira error → `[]`; con filas → URL `/m/<slug>`; el `where` pide `APPROVED`, no canceladas, `MUESTRA`.

- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter fotorank test:muestras` — Expected: FAIL.

- [ ] **Step 3: Implementar.**

- [ ] **Step 4: Correr**

Run: `pnpm --filter fotorank test:muestras && pnpm --filter fotorank test:entry-image-signing && pnpm --filter fotorank test:contest-store-usage && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotorank check-types && pnpm --filter fotorank lint`
Expected: en verde. `git diff origin/main --stat -- apps/fotorank` muestra **sólo** los archivos de esta task y el comentario de la Task 4.

- [ ] **Step 5: Commit**

```bash
git add apps/fotorank
git commit -m "FotoRank: botón Armar muestra en resultados y muestras del concurso en las páginas públicas"
```

**Acceptance:** con la base **sin** la migración de la etapa 7, `/concursos/<slug>` y `/concursos/<slug>/resultados` cargan igual que hoy (lo verifica el test con el `db` que tira error y, en la Task 13, una prueba local antes de aplicar la migración).

---

### Task 13: Verificación final, migración en producción, guía y PR

**Files:**
- Modify: `docs/operations/muestras-puesta-en-marcha.md` (sección "Etapa 7")

- [ ] **Step 1: Todos los chequeos**

Run: `git fetch origin && git rebase origin/main` (resolver sólo conflictos de esta etapa). Después:
`pnpm --filter @repo/muestras test && pnpm --filter @repo/muestras check-types && pnpm --filter @repo/muestras lint && pnpm --filter muestras test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras check-types && pnpm --filter muestras lint && pnpm --filter fotorank test:muestras && pnpm --filter fotorank test:entry-image-signing && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotorank check-types && pnpm --filter fotorank lint && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice typecheck && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter muestras build && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotorank build`
Expected: todo en verde. En el build de Muestras: `/panel/concursos`, `/panel/concursos/[contestId]`, `/panel/muestras/[id]/concurso` y `/panel/expositor/concurso/[id]` dinámicas (`ƒ`); `/m/[slug]` y `/m/[slug]/o/[workId]` siguen con revalidación. `git diff origin/main -- pnpm-lock.yaml` vacío. `grep -rn "anonymousCode\|anonymousJuryCode\|aggregateScore\|normalizedScore\|juryDecisionNote" apps/muestras --include=*.ts --include=*.tsx | grep -v "\.test\."` vacío. `grep -rln "fotorank[A-Z]\|contestOrganization" apps/muestras/lib apps/muestras/app | grep -v "\.test\."` devuelve sólo `lib/concursos/fotorank.ts`.

- [ ] **Step 2: Aplicar la migración en producción — la hace el controlador (autorizado por Daniel)**

Qué hace: crea **tres tablas vacías**; no agrega columnas ni modifica o borra datos. Requisito: la de la etapa 6 aplicada (`select migration_name from "_prisma_migrations" where migration_name = '20261031120000_muestras_etapa_6_expositores';` → una fila). Va **antes** de publicar el código. Para deshacer (sólo si el código nuevo **no** está publicado):
```sql
drop table "CulturalContestWork", "CulturalContestAuthor", "CulturalContestImport";
```
1. Correr `packages/db/prisma/migrations/20261101120000_muestras_etapa_7_fotorank/migration.sql` en la rama `development` (`br-old-rain-adwthzng`) del proyecto `divine-hall-10689679` (Neon MCP `run_sql_transaction`, una sentencia por elemento, sin comentarios).
2. Verificar:
```sql
select table_name from information_schema.tables
where table_name in ('CulturalContestImport','CulturalContestWork','CulturalContestAuthor') order by table_name;
select conname from pg_constraint where conname like 'CulturalContest%fkey' order by conname;
select data_type from information_schema.columns where table_name = 'CulturalContestImport' and column_name = 'tiers';
```
Expected: las tres tablas; seis claves foráneas (ninguna hacia `Fotorank*`); `ARRAY`.
3. Probar los tipos que manda la app, en una transacción que se deshace:
```sql
begin;
insert into "CulturalContestImport" ("id","activityId","contestId","contestSlug","contestTitle","organizationId","organizationName","tiers","resultBatchId","resultBatchStatus","sourceVersion","createdByUserId","updatedAt")
select 'prueba', id, 'c', 's', 't', 'o', 'O', array['WINNER','MENTION'], 'b', 'FINALIZED', now(), 1, now() from "CulturalActivity" limit 1;
select pg_typeof("tiers"), pg_typeof("syncedAt") from "CulturalContestImport" where id = 'prueba';
rollback;
```
Expected: `text[] | timestamp without time zone`.
4. Registrar con el checksum:

Run: `shasum -a 256 packages/db/prisma/migrations/20261101120000_muestras_etapa_7_fotorank/migration.sql`
```sql
insert into "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
values (gen_random_uuid()::text, '<sha256 del paso anterior>', now(), '20261101120000_muestras_etapa_7_fotorank', null, null, now(), 1);
```
5. Confirmar: `select migration_name, checksum from "_prisma_migrations" where migration_name = '20261101120000_muestras_etapa_7_fotorank';` → una fila con el mismo checksum.

- [ ] **Step 3: Recorrido completo en local contra la base ya migrada**

**Antes** de aplicar la migración (Step 2), con `pnpm --filter fotorank dev`: abrir `/concursos/<slug>` y `/concursos/<slug>/resultados` de un concurso real → cargan igual que en producción (el bloque nuevo no aparece y no hay error).
Después, con `pnpm --filter muestras dev` (puerto 3014) y `pnpm --filter fotorank dev`, `DNX_FOTORANK_LINK_SECRET` igual en las dos, correo apagado, y un **concurso de prueba** con resultados cerrados por el jurado (lote `FINALIZED`) (no SFEF ni otro real en curso), cuentas A (`EDITOR` de la organización), J (jurado de esa organización), B (coorganización de la muestra), Au1 (autor con bases que autorizan) y Au2 (autor con bases que no):
1. En FotoRank, A ve "Armar muestra" en resultados; J no. Con el lote todavía sin cerrar, el texto de espera; en una maratón, nada. En Muestras, `/panel/concursos/<id de una maratón>` da el mensaje de maratones.
2. A arma con ganadores y menciones: nace el borrador con las obras en orden; se copian las imágenes (barra de avance); doble clic no duplica.
3. La obra de Au1 entra sola a la galería (si sus bases no piden atribución, como "Autoría reservada"); la de Au2 queda "Esperando al autor". Una obra descalificada no aparece. A copia el enlace de Au2.
4. Con la cuenta de Au1, el enlace de Au2 dice "Este enlace es para otra cuenta" y no muestra nada. Au2 entra, firma, acepta: su obra entra con su nombre y su perfil. Au1 completa "Cómo firmás": su obra pasa de "Autoría reservada" a su nombre. Au1 la saca desde "Dónde expongo": sale de la muestra; A lo ve.
5. A marca "A la venta" en una obra; el autor acepta la venta; ninguna página pública cambia.
6. "Se imprime" desmarcado: la obra no sale en fichas, catálogo ni marcos, pero sí en la galería.
7. En el editor, A quita una obra del concurso; "Actualizar desde FotoRank" no la vuelve a sumar. Cambiar un resultado en el concurso de prueba y republicar → aviso "cambiaron" → actualizar: suma la nueva y marca la que salió.
8. B ve el panel "Del concurso" sin botones; por dirección no puede cambiar nada.
9. A completa sede y fechas, manda a revisión; Daniel aprueba: `/m/<slug>` dice "Muestra del concurso X" con enlace; la obra muestra "1.er premio · …"; en FotoRank, `/concursos/<slug>/resultados` muestra "Muestras del concurso" con "Ver la muestra en la sala".
10. Con "Sorpresa total", la página de una obra oculta no muestra ni imagen ni premio.
11. A 375 px: `/panel/concursos/<id>`, `/panel/muestras/<id>/concurso`, `/panel/expositor/concurso/<id>`, sin scroll horizontal.

- [ ] **Step 4: Guía de puesta en marcha**

Agregar al final de `docs/operations/muestras-puesta-en-marcha.md`:
```markdown
## Etapa 7 — del concurso de FotoRank a la muestra

1. Verificar que la migración de la etapa 6 está aplicada. — Controlador.
2. Aplicar la migración `20261101120000_muestras_etapa_7_fotorank` y registrarla con su SHA-256 (plan de la etapa 7, Task 13 Step 2). — Controlador, autorizado por Daniel. Antes del deploy. Sólo crea tablas: no afecta lo que ya anda.
3. Cargar `DNX_FOTORANK_LINK_SECRET` en el proyecto de Vercel de Muestras (Production), con **el mismo valor** que tiene en FotoRank y FOTOFFICE. Sin esto, las muestras se arman pero las imágenes no se copian (el panel lo avisa). — Daniel.
4. Optativas: `FOTORANK_PUBLIC_BASE_URL` en Muestras y `MUESTRAS_PUBLIC_BASE_URL` en FotoRank (por omisión, los dominios de producción). — Nadie, salvo que cambien los dominios.
5. Fusionar el PR. Se publican Muestras y FotoRank (los dos cambian).
6. Apenas se publica: abrir en FotoRank la página de resultados de un concurso publicado y verificar que carga igual; en Muestras, armar una muestra de prueba desde un concurso de prueba y ver que copia las imágenes. — Controlador.
7. Avisar a las organizaciones de FotoRank que pueden armar la muestra desde Resultados, y que a cada autor hay que mandarle su enlace (el correo de Muestras sigue apagado). — Daniel.
```

- [ ] **Step 5: Commit y PR**

```bash
git add docs/operations/muestras-puesta-en-marcha.md
git commit -m "Guía de puesta en marcha de la Etapa 7 de Muestras"
git push -u origin feat/muestras-etapa-7-fotorank
gh pr create --base main --title "Muestras Fotográficas — Etapa 7: del concurso de FotoRank a la muestra" --body "<resumen en español: Armar muestra desde los resultados cerrados por el jurado en FotoRank (lote FINALIZED o PUBLISHED; la publicación LIVE está trabada); niveles; muestra nueva o existente; imágenes copiadas por tandas con el enlace firmado; premio y categoría como dato; galería, impresión y venta por obra; permiso del autor (bases que autorizan o aceptación) en Dónde expongo; editor; premio en obra, sala, fichas y catálogo; enlaces cruzados; qué no se lee de FotoRank (anonimato) y cómo se probó; archivos de FotoRank tocados; migración ya aplicada; crédito del autor (Autoría reservada); variable DNX_FOTORANK_LINK_SECRET; preguntas abiertas para Daniel; checklist del Step 3>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Etapa 7 (concurso de FotoRank → muestra)

Resumen para quien ejecute: Tasks 1–2 son reglas puras (paralelizables); la 3 es la migración (sin aplicar); 4–5 leen FotoRank (imágenes y resultados); 6–8 armado, galería y panel; 9 editor; 10 autor; 11 lo público de Muestras; 12 FotoRank (puede ir en paralelo desde la 3); 13 verificación, migración en producción y PR.

## Cobertura del spec

| Spec | Task |
|---|---|
| D1 último lote `FINALIZED`/`PUBLISHED`, sin descalificadas; preseleccionados = finalistas | 1, 5 |
| D2 quién arma; capacidad `contest`; responsable de la muestra | 2, 5, 6 |
| D3 permiso releído en cada acción | 5, 6, 7, 8, 10 |
| D4 lista cerrada de lo que se lee; anonimato | 5, 13 |
| D5 sólo concursos propios; maratones con mensaje | 1, 5, 12 |
| D6 tres tablas, sin columnas ni FK a FotoRank; copia a `CulturalActivityWork` | 3, 7 |
| D7 niveles, por defecto, tope 300 | 1, 6 |
| D8 muestra nueva o existente | 6 |
| D9 datos por obra, premio, orden | 1, 5, 6 |
| D10 idempotente, `FOR UPDATE`, lo sacado no vuelve | 1, 6, 9 |
| D11 cambios en FotoRank, `GONE`, revocada | 1, 6, 8 |
| D12 imágenes copiadas por tandas, firma copiada, variable nueva | 4, 7 |
| D13 galería / se imprime / venta | 8, 11 |
| D14 cuándo entra (RULES o aceptación) | 1, 7, 10 |
| D15 venta explícita | 1, 8, 10 |
| D16 sacar (organización, editor, autor) | 7, 8, 9, 10 |
| D17 convivencia con el editor | 9 |
| D18–D20 "Dónde expongo", página del autor, sólo su cuenta | 10 |
| D21 enlace y mensaje para copiar, "Ya se lo mandé" | 8 |
| D22 autor sin cuenta, autorización escrita | 6, 8 |
| D23 premio en lo público respetando la sorpresa | 11 |
| D24 "Muestra del concurso X" | 11 |
| D25 "Ver la muestra en la sala" en FotoRank, sin romper | 12 |
| D26 cambios mínimos en FotoRank | 4, 12 |
| D27 sin dependencias nuevas | todas |
| D28 crédito del autor / "Autoría reservada" | 1, 7, 10, 11 |
| Portada al día | 2 |
| Migración a mano + checksum, antes del deploy | 3, 13 |
| Lista de control de filtraciones | 5, 10, 11, 12, 13 |
