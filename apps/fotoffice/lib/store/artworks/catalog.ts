/**
 * Elegir y publicar obras de concursos de FotoRank (spec O3, O6, O13, §5.3; plan Task 7).
 *
 * - `listStoreContests`: los concursos de las organizaciones vinculadas que ya cerraron la carga.
 * - `loadContestCatalog`: las obras de un concurso (CONFIRMED y no retiradas) con su premio, el
 *   estado del permiso del autor y si están publicadas.
 * - `publishArtwork`: exige permiso vigente (`isSellable`) y al menos un formato que la
 *   resolución del original alcance; trae la vista previa con marca de agua de FotoRank, la
 *   guarda en el R2 de FOTOFFICE y arma la ficha (título, autor, premio, dirección). Volver a
 *   publicar reutiliza la vista previa guardada y la dirección.
 * - `unpublishArtwork`: la saca de la tienda (WITHDRAWN). Los pedidos ya hechos no cambian.
 *
 * Toda consulta de FOTOFFICE lleva `workspaceId` y todo pasa por el vínculo con la organización.
 * Logs sin datos personales.
 */
import "server-only";

import { randomUUID } from "node:crypto";

import { prisma } from "@repo/db";

import {
  artworkTitle,
  authorCredit,
  bestAward,
  consentLabel,
  isStoreContestStatus,
  listingLabel,
  matchesFilter,
  originalSizeOf,
  previewWatermark,
  SHOWABLE_RESULT_BATCH_STATUSES,
  STORE_CONTEST_STATUSES,
  type Award,
  type CatalogFilter,
} from "./catalog-rules";
import { isSellable } from "./consent-basis";
import { DEFAULT_ROYALTY_BPS, ENTRY_RULES_SELECT, rightsAcceptedByAuthor } from "./consent";
import { DEFAULT_DPI } from "./format-form";
import { buildPreviewUrl, fetchPreview, storePreviewInR2 } from "./fotorank-client";
import { assertContestLinked, isContestLinked, linkedOrganizationIds } from "./links";
import { eligibleFormats } from "./resolution";
import { artworkSlug } from "./slug";

type Db = Pick<
  typeof prisma,
  | "$transaction"
  | "fotorankContest"
  | "fotorankContestEntry"
  | "fotorankResultEntry"
  | "fotorankProfile"
  | "user"
  | "artworkConsent"
  | "artworkListing"
  | "contestStoreSettings"
  | "printFormat"
  | "storePrintSettings"
  | "workspace"
  | "contestOrganization"
  | "contestOrganizationMember"
  | "workspaceContestOrganizationLink"
>;

export const CATALOG_PAGE_SIZE = 50;

const ESTADOS_DE_RESULTADO = ["WINNER", "MENTION", "FINALIST"] as const;

const ACTIVE_ASSET_SELECT = {
  activeAsset: {
    select: {
      kind: true,
      width: true,
      height: true,
      sourceOriginal: { select: { kind: true, width: true, height: true } },
    },
  },
} as const;

async function institutionName(workspaceId: string, db: Db): Promise<string> {
  const w = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true, fotofficeBranding: { select: { commercialName: true } } },
  });
  return w?.fotofficeBranding?.commercialName?.trim() || w?.name?.trim() || "La institución";
}

/** Premio por obra del concurso, desde los resultados ya cerrados o publicados. */
async function awardsByEntry(contestId: string, entryIds: string[] | null, db: Db): Promise<Map<string, Award>> {
  const filas = await db.fotorankResultEntry.findMany({
    where: {
      resultStatus: { in: [...ESTADOS_DE_RESULTADO] },
      resultBatch: { contestId, status: { in: [...SHOWABLE_RESULT_BATCH_STATUSES] } },
      ...(entryIds ? { juryEntrySnapshot: { entryId: { in: entryIds } } } : {}),
    },
    select: { resultStatus: true, awardType: true, juryEntrySnapshot: { select: { entryId: true } } },
  });
  const porObra = new Map<string, { resultStatus: string; awardType: string | null }[]>();
  for (const f of filas) {
    const id = f.juryEntrySnapshot.entryId;
    porObra.set(id, [...(porObra.get(id) ?? []), { resultStatus: f.resultStatus, awardType: f.awardType }]);
  }
  const premios = new Map<string, Award>();
  for (const [id, rs] of porObra) {
    const premio = bestAward(rs);
    if (premio) premios.set(id, premio);
  }
  return premios;
}

/** Nombre a mostrar de cada autor: perfil de FotoRank y, si no tiene, el nombre de la cuenta. */
async function authorNames(userIds: number[], db: Db): Promise<Map<number, { profile: string | null; user: string | null }>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const [perfiles, usuarios] = await Promise.all([
    db.fotorankProfile.findMany({ where: { userId: { in: ids } }, select: { userId: true, displayName: true } }),
    db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
  ]);
  const perfil = new Map(perfiles.map((p) => [p.userId, p.displayName?.trim() || null]));
  const usuario = new Map(usuarios.map((u) => [u.id, u.name?.trim() || null]));
  return new Map(ids.map((id) => [id, { profile: perfil.get(id) ?? null, user: usuario.get(id) ?? null }]));
}

// ── Concursos ───────────────────────────────────────────────────────────────

export type StoreContest = {
  id: string;
  title: string;
  status: string;
  organizationName: string;
  publishedCount: number;
};

export async function listStoreContests(workspaceId: string, db: Db = prisma): Promise<StoreContest[]> {
  const organizaciones = await linkedOrganizationIds(workspaceId, db);
  if (organizaciones.length === 0) return [];
  const [concursos, publicadas] = await Promise.all([
    db.fotorankContest.findMany({
      where: { organizationId: { in: organizaciones }, status: { in: [...STORE_CONTEST_STATUSES] } },
      select: { id: true, title: true, status: true, organization: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.artworkListing.groupBy({
      by: ["contestId"],
      where: { workspaceId, status: "PUBLISHED" },
      _count: { _all: true },
    }),
  ]);
  const cuenta = new Map(publicadas.map((p) => [p.contestId, p._count._all]));
  return concursos.map((c) => ({
    id: c.id,
    title: c.title,
    status: c.status,
    organizationName: c.organization?.name ?? "",
    publishedCount: cuenta.get(c.id) ?? 0,
  }));
}

/** El concurso, si es de una organización vinculada y está en un estado que se muestra. */
async function storeContest(workspaceId: string, contestId: string, db: Db) {
  const concurso = await db.fotorankContest.findUnique({
    where: { id: contestId },
    select: { id: true, title: true, status: true },
  });
  if (!concurso || !isStoreContestStatus(concurso.status)) return null;
  if (!(await isContestLinked(workspaceId, contestId, db))) return null;
  return concurso;
}

// ── Obras de un concurso ────────────────────────────────────────────────────

export type CatalogRow = {
  entryId: string;
  entryNumber: string | null;
  title: string;
  authorName: string | null;
  award: Award | null;
  original: { width: number; height: number } | null;
  consentLabel: string;
  /** Hay un permiso (se puede reenviar) y el autor no dijo que no. */
  canResend: boolean;
  sellable: boolean;
  listingStatus: string | null;
  listingLabel: string;
  /** Miniatura: la vista previa guardada o un enlace firmado de 10 minutos a FotoRank. */
  thumbnailUrl: string | null;
};

export type ContestCatalog = {
  contest: { id: string; title: string; status: string };
  royaltyBps: number;
  filter: CatalogFilter;
  page: number;
  totalPages: number;
  total: number;
  rows: CatalogRow[];
};

export type CatalogDeps = {
  db?: Db;
  /** Para las miniaturas; por omisión `buildPreviewUrl`. Si tira (sin secreto), no hay miniatura. */
  signPreview?: (entryId: string, watermark: string) => string;
};

export async function loadContestCatalog(
  workspaceId: string,
  contestId: string,
  opts: { filter: CatalogFilter; page: number },
  deps: CatalogDeps = {},
): Promise<ContestCatalog | null> {
  const db = deps.db ?? prisma;
  const signPreview = deps.signPreview ?? ((id: string, wm: string) => buildPreviewUrl(id, wm));
  const concurso = await storeContest(workspaceId, contestId, db);
  if (!concurso) return null;

  const [entries, premios, consents, listings, ajustes, institucion] = await Promise.all([
    db.fotorankContestEntry.findMany({
      where: { contestId, status: "CONFIRMED", withdrawnAt: null },
      select: { id: true, entryNumber: true, title: true, authorUserId: true, ...ACTIVE_ASSET_SELECT },
      orderBy: [{ entryNumber: "asc" }, { id: "asc" }],
    }),
    awardsByEntry(contestId, null, db),
    db.artworkConsent.findMany({
      where: { workspaceId, contestId },
      select: { entryId: true, basis: true, status: true, notifiedAt: true },
    }),
    db.artworkListing.findMany({
      where: { workspaceId, contestId },
      select: { entryId: true, status: true, previewUrl: true },
    }),
    db.contestStoreSettings.findUnique({
      where: { workspaceId_contestId: { workspaceId, contestId } },
      select: { royaltyBps: true },
    }),
    institutionName(workspaceId, db),
  ]);

  const filtradas = entries.filter((e) => matchesFilter(premios.get(e.id) ?? null, opts.filter));
  const total = filtradas.length;
  const totalPages = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(opts.page) || 1), totalPages);
  const pagina = filtradas.slice((page - 1) * CATALOG_PAGE_SIZE, page * CATALOG_PAGE_SIZE);

  const consentPorObra = new Map(consents.map((c) => [c.entryId, c]));
  const listingPorObra = new Map(listings.map((l) => [l.entryId, l]));
  const nombres = await authorNames(
    pagina.map((e) => e.authorUserId).filter((x): x is number => x !== null),
    db,
  );
  const marca = previewWatermark(institucion);
  const miniatura = (entryId: string, guardada: string | null | undefined) => {
    if (guardada) return guardada;
    try {
      return signPreview(entryId, marca);
    } catch {
      return null;
    }
  };

  return {
    contest: concurso,
    royaltyBps: ajustes?.royaltyBps ?? DEFAULT_ROYALTY_BPS,
    filter: opts.filter,
    page,
    totalPages,
    total,
    rows: pagina.map((e) => {
      const consent = consentPorObra.get(e.id) ?? null;
      const listing = listingPorObra.get(e.id) ?? null;
      const nombre = e.authorUserId !== null ? nombres.get(e.authorUserId) : undefined;
      return {
        entryId: e.id,
        entryNumber: e.entryNumber,
        title: artworkTitle(e.title, e.entryNumber),
        authorName: nombre?.profile ?? nombre?.user ?? null,
        award: premios.get(e.id) ?? null,
        original: originalSizeOf(e.activeAsset),
        consentLabel: consentLabel(consent),
        canResend: consent !== null && (consent.status === "NOTIFIED" || consent.status === "PENDING"),
        sellable: isSellable(consent),
        listingStatus: listing?.status ?? null,
        listingLabel: listingLabel(listing),
        thumbnailUrl: miniatura(e.id, listing?.previewUrl),
      };
    }),
  };
}

// ── Regalía ─────────────────────────────────────────────────────────────────

export async function saveContestRoyalty(
  workspaceId: string,
  contestId: string,
  royaltyBps: number,
  db: Db = prisma,
): Promise<void> {
  if (!Number.isInteger(royaltyBps) || royaltyBps < 0 || royaltyBps > 10000) throw new Error("Regalía fuera de rango.");
  await assertContestLinked(workspaceId, contestId, db);
  await db.contestStoreSettings.upsert({
    where: { workspaceId_contestId: { workspaceId, contestId } },
    create: { workspaceId, contestId, royaltyBps },
    update: { royaltyBps },
  });
}

// ── Publicar / despublicar ──────────────────────────────────────────────────

export type ArtworkPublishErrorCode =
  | "CONTEST_NOT_AVAILABLE"
  | "NOT_ELIGIBLE"
  | "NO_CONSENT"
  | "NO_ORIGINAL"
  | "NO_FORMATS"
  | "NO_FORMAT_FITS";

const MENSAJES: Record<ArtworkPublishErrorCode, string> = {
  CONTEST_NOT_AVAILABLE: "Este concurso todavía no se puede usar en la tienda.",
  NOT_ELIGIBLE: "Esa obra no está confirmada en el concurso (o el autor la retiró).",
  NO_CONSENT: "Para publicar esta obra hace falta el permiso del autor (o el aviso, si las bases ya lo autorizan).",
  NO_ORIGINAL: "No encontramos el tamaño del archivo original de esta obra en FotoRank.",
  NO_FORMATS: "Primero cargá al menos un formato de impresión activo.",
  NO_FORMAT_FITS: "Ningún formato alcanza la resolución de esta obra.",
};

export class ArtworkPublishError extends Error {
  readonly code: ArtworkPublishErrorCode;
  constructor(code: ArtworkPublishErrorCode) {
    super(MENSAJES[code]);
    this.name = "ArtworkPublishError";
    this.code = code;
  }
}

export type PublishDeps = {
  db?: Db;
  now?: Date;
  fetchPreview?: (entryId: string, watermark: string) => Promise<Buffer>;
  storePreview?: typeof storePreviewInR2;
  newId?: () => string;
};

function esUnicoRepetido(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

const INTENTOS = 3;

/** Publica (o vuelve a publicar) la obra en la tienda del workspace. */
export async function publishArtwork(
  workspaceId: string,
  contestId: string,
  entryId: string,
  userId: number,
  deps: PublishDeps = {},
): Promise<{ listingId: string; slug: string }> {
  void userId; // Ya pasó `requireStoreConfigurer`; se recibe para auditoría futura.
  const db = deps.db ?? prisma;
  const now = deps.now ?? new Date();
  const traer = deps.fetchPreview ?? ((id: string, wm: string) => fetchPreview(id, wm));
  const guardar = deps.storePreview ?? storePreviewInR2;
  const nuevoId = deps.newId ?? (() => randomUUID());

  await assertContestLinked(workspaceId, contestId, db);
  const concurso = await db.fotorankContest.findUnique({ where: { id: contestId }, select: { status: true } });
  if (!concurso || !isStoreContestStatus(concurso.status)) throw new ArtworkPublishError("CONTEST_NOT_AVAILABLE");

  const entry = await db.fotorankContestEntry.findFirst({
    where: { id: entryId, contestId },
    select: {
      id: true,
      status: true,
      withdrawnAt: true,
      title: true,
      entryNumber: true,
      authorUserId: true,
      ...ACTIVE_ASSET_SELECT,
      ...ENTRY_RULES_SELECT,
    },
  });
  if (!entry || entry.status !== "CONFIRMED" || entry.withdrawnAt !== null) throw new ArtworkPublishError("NOT_ELIGIBLE");

  const consent = await db.artworkConsent.findUnique({
    where: { workspaceId_entryId: { workspaceId, entryId } },
    select: { basis: true, status: true, notifiedAt: true, authorUserId: true },
  });
  if (!consent || !isSellable(consent)) throw new ArtworkPublishError("NO_CONSENT");

  const original = originalSizeOf(entry.activeAsset);
  if (!original) throw new ArtworkPublishError("NO_ORIGINAL");

  const [formatos, ajustes] = await Promise.all([
    db.printFormat.findMany({
      where: { workspaceId, isActive: true },
      select: { widthCm: true, heightCm: true },
    }),
    db.storePrintSettings.findUnique({ where: { workspaceId }, select: { minDpi: true } }),
  ]);
  if (formatos.length === 0) throw new ArtworkPublishError("NO_FORMATS");
  if (eligibleFormats(original, formatos, ajustes?.minDpi ?? DEFAULT_DPI).length === 0) throw new ArtworkPublishError("NO_FORMAT_FITS");

  const autorId = entry.authorUserId ?? consent.authorUserId;
  const [premios, nombres, institucion] = await Promise.all([
    awardsByEntry(contestId, [entryId], db),
    authorNames([autorId], db),
    institutionName(workspaceId, db),
  ]);
  const titulo = artworkTitle(entry.title, entry.entryNumber);
  const nombre = nombres.get(autorId);
  const ficha = {
    title: titulo,
    authorDisplayName: authorCredit({
      attributionRequired: rightsAcceptedByAuthor(entry)?.attributionRequired ?? false,
      consent,
      profileDisplayName: nombre?.profile ?? null,
      userName: nombre?.user ?? null,
    }),
    awardLabel: premios.get(entryId)?.label ?? null,
    originalWidth: original.width,
    originalHeight: original.height,
    status: "PUBLISHED",
    publishedAt: now,
    withdrawnAt: null,
  };

  // Mismo id en los reintentos: la key de la vista previa en R2 lleva el id de la ficha.
  const idNuevo = nuevoId();
  let vistaPrevia: { url: string; width: number; height: number } | null = null;
  for (let intento = 1; ; intento++) {
    const existente = await db.artworkListing.findUnique({
      where: { workspaceId_entryId: { workspaceId, entryId } },
      select: { id: true, slug: true, previewUrl: true, previewWidth: true, previewHeight: true },
    });
    const listingId = existente?.id ?? idNuevo;
    if (existente?.previewUrl) {
      vistaPrevia = { url: existente.previewUrl, width: existente.previewWidth, height: existente.previewHeight };
    } else if (!vistaPrevia) {
      const buffer = await traer(entryId, previewWatermark(institucion));
      vistaPrevia = await guardar(workspaceId, listingId, buffer);
    }
    const preview = { previewUrl: vistaPrevia.url, previewWidth: vistaPrevia.width, previewHeight: vistaPrevia.height };
    const vista = vistaPrevia;
    try {
      // La subida a R2 quedó afuera; acá sólo la base. El permiso se bloquea (FOR UPDATE) y se
      // vuelve a mirar antes de escribir la ficha: si el autor retira o rechaza en este momento,
      // o su respuesta espera a que esto termine (y entonces despublica), o esto la ve y no publica.
      return await db.$transaction(async (tx) => {
        const bloqueado = await tx.$queryRaw<{ basis: string; status: string; notifiedAt: Date | null }[]>`
          SELECT "basis", "status", "notifiedAt" FROM "ArtworkConsent"
          WHERE "workspaceId" = ${workspaceId} AND "entryId" = ${entryId}
          FOR UPDATE`;
        if (!isSellable(bloqueado[0] ?? null)) throw new ArtworkPublishError("NO_CONSENT");
        if (existente) {
          await tx.artworkListing.updateMany({ where: { id: existente.id, workspaceId }, data: { ...ficha, ...preview } });
          return { listingId: existente.id, slug: existente.slug };
        }
        const tomadas = await tx.artworkListing.findMany({ where: { workspaceId }, select: { slug: true } });
        const slug = artworkSlug(titulo, entry.entryNumber ?? entryId, new Set(tomadas.map((t) => t.slug)));
        await tx.artworkListing.create({
          data: {
            id: listingId,
            workspaceId,
            contestId,
            entryId,
            slug,
            ...ficha,
            previewUrl: vista.url,
            previewWidth: vista.width,
            previewHeight: vista.height,
          },
        });
        return { listingId, slug };
      });
    } catch (e) {
      // Otra pestaña publicó la misma obra o tomó la misma dirección: la transacción ya se
      // deshizo; se vuelve a leer y se reintenta en una transacción nueva.
      if (!esUnicoRepetido(e) || intento >= INTENTOS) throw e;
      console.warn("[fotoffice][tienda] publicar obra: reintento por choque de unicidad", { workspaceId, entryId, intento });
    }
  }
}

/** Saca la obra de la tienda. No exige vínculo: sacar siempre se puede. */
export async function unpublishArtwork(
  workspaceId: string,
  contestId: string,
  entryId: string,
  deps: { db?: Db; now?: Date } = {},
): Promise<{ withdrawn: boolean }> {
  const db = deps.db ?? prisma;
  const { count } = await db.artworkListing.updateMany({
    where: { workspaceId, contestId, entryId, status: "PUBLISHED" },
    data: { status: "WITHDRAWN", withdrawnAt: deps.now ?? new Date() },
  });
  return { withdrawn: count > 0 };
}
