import "server-only";
import { prisma } from "@repo/db";
import {
  clickatonPhase,
  fotorankPhase,
  isShowcaseMode,
  sortShowcase,
  withTracking,
  type ShowcaseItem,
  type ShowcaseMode,
} from "./showcase";

/**
 * Lee la vitrina de concursos de una institución.
 *
 * - FotoRank vive en la misma base que FOTOFFICE: se lee directo, sólo concursos públicos.
 * - Clickatón tiene su propia base: se pide su lista pública (`/api/public/vitrina`) con un
 *   tope de tiempo. Si Clickatón no contesta, la vitrina sigue con FotoRank, nunca se rompe.
 */

const FOTORANK_ORIGIN = (process.env.FOTORANK_PUBLIC_URL?.trim() || "https://fotorank.com").replace(/\/$/, "");
const CLICKATON_ORIGIN = (process.env.CLICKATON_PUBLIC_URL?.trim() || "https://maratonfotografica.com").replace(/\/$/, "");

/** Los terminados se muestran un tiempo (para ver resultados) y después salen solos. */
const RESULTADOS_DIAS = 45;

const OCULTOS = ["DRAFT", "SETUP_IN_PROGRESS", "READY_TO_PUBLISH", "ARCHIVED", "CANCELLED"] as const;

export type ShowcaseSettings = { mode: ShowcaseMode; organizationIds: string[]; includeClickaton: boolean };

export async function loadShowcaseSettings(workspaceId: string): Promise<ShowcaseSettings> {
  const fila = await prisma.workspaceContestShowcase
    .findUnique({ where: { workspaceId }, select: { mode: true, organizationIds: true, includeClickaton: true } })
    .catch(() => null);
  return {
    mode: fila && isShowcaseMode(fila.mode) ? fila.mode : "ALL",
    organizationIds: fila?.organizationIds ?? [],
    includeClickaton: fila?.includeClickaton ?? true,
  };
}

/** Una portada guardada como imagen incrustada se sirve por una ruta propia: no viaja en la página. */
function portada(c: { id: string; coverImageUrl: string | null }): string | null {
  const u = c.coverImageUrl?.trim();
  if (!u) return null;
  if (u.startsWith("data:image/")) return `/api/concursos/portada/${c.id}`;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("/")) return `${FOTORANK_ORIGIN}${u}`;
  return null;
}

async function fromFotorank(s: ShowcaseSettings, campaign: string | null, now: Date): Promise<ShowcaseItem[]> {
  const desde = new Date(now.getTime() - RESULTADOS_DIAS * 24 * 60 * 60 * 1000);
  const concursos = await prisma.fotorankContest.findMany({
    where: {
      visibility: "PUBLIC",
      status: { notIn: [...OCULTOS] },
      ...(s.mode === "OWN" ? { organizationId: { in: s.organizationIds } } : {}),
      OR: [{ status: { notIn: ["COMPLETED", "CLOSED"] } }, { updatedAt: { gte: desde } }],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      shortDescription: true,
      coverImageUrl: true,
      status: true,
      organizationId: true,
      registrationOpensAt: true,
      registrationClosesAt: true,
      submissionDeadline: true,
      startAt: true,
      createdAt: true,
      organization: { select: { name: true } },
    },
    take: 30,
  });
  const out: ShowcaseItem[] = [];
  for (const c of concursos) {
    const closesAt = c.registrationClosesAt ?? c.submissionDeadline ?? null;
    const phase = fotorankPhase(c.status, closesAt, now);
    if (!phase) continue;
    out.push({
      key: `fotorank:${c.id}`,
      source: "fotorank",
      title: c.title,
      organizer: c.organization.name,
      summary: c.shortDescription,
      coverUrl: portada(c),
      closesAt,
      startsAt: c.startAt ?? c.registrationOpensAt ?? null,
      announcedAt: c.registrationOpensAt && c.registrationOpensAt <= now ? c.registrationOpensAt : c.createdAt,
      phase,
      url: withTracking(`${FOTORANK_ORIGIN}/concursos/${c.slug}${phase === "results" ? "/resultados" : ""}`, campaign),
      own: s.organizationIds.includes(c.organizationId),
    });
  }
  return out;
}

type EdicionClickaton = {
  slug: string;
  name: string;
  editionName?: string;
  shortDescription?: string;
  city?: string;
  startAt?: string;
  registrationCloseAt?: string | null;
  status: string;
  registrationStatus: string;
  coverImage?: string | null;
  url: string;
};

const fecha = (v: string | null | undefined) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

async function fromClickaton(campaign: string | null): Promise<ShowcaseItem[]> {
  const r = await fetch(`${CLICKATON_ORIGIN}/api/public/vitrina`, {
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(4000),
  });
  if (!r.ok) return [];
  const data = (await r.json()) as { editions?: EdicionClickaton[] };
  const out: ShowcaseItem[] = [];
  for (const e of data.editions ?? []) {
    const phase = clickatonPhase(e.registrationStatus, e.status);
    if (!phase || !/^https?:\/\//.test(e.url)) continue;
    out.push({
      key: `clickaton:${e.slug}`,
      source: "clickaton",
      title: e.editionName && !e.name.includes(e.editionName) ? `${e.name} · ${e.editionName}` : e.name,
      organizer: "Clickatón",
      summary: e.shortDescription ?? (e.city ? `Maratón fotográfica · ${e.city}` : "Maratón fotográfica"),
      coverUrl: e.coverImage && /^https?:\/\//.test(e.coverImage) ? e.coverImage : null,
      closesAt: fecha(e.registrationCloseAt),
      startsAt: fecha(e.startAt),
      announcedAt: null,
      phase,
      url: withTracking(e.url, campaign),
      own: false,
    });
  }
  return out;
}

/** La vitrina completa de la institución, ya ordenada. Vacía si la apagó. */
export async function loadShowcase(workspaceId: string, now: Date = new Date()): Promise<ShowcaseItem[]> {
  const [s, branding] = await Promise.all([
    loadShowcaseSettings(workspaceId),
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { publicSlug: true } }),
  ]);
  if (s.mode === "OFF") return [];
  const campaign = branding?.publicSlug ?? null;
  const [fr, ck] = await Promise.all([
    fromFotorank(s, campaign, now).catch((e: unknown) => {
      console.error("[fotoffice][vitrina] falló FotoRank", { detalle: e instanceof Error ? e.message : "?" });
      return [] as ShowcaseItem[];
    }),
    s.mode === "ALL" && s.includeClickaton
      ? fromClickaton(campaign).catch(() => [] as ShowcaseItem[])
      : Promise.resolve([] as ShowcaseItem[]),
  ]);
  return sortShowcase([...fr, ...ck]);
}
