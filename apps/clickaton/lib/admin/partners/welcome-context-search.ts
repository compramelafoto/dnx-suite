/**
 * Búsqueda administrativa de entidades contextuales para welcome.
 * Cada scope usa su fuente canónica; sin fallback silencioso.
 */
import "server-only";

import { prisma } from "@repo/db";
import {
  getWelcomeClfClient,
  getWelcomeClfConnectionInfo,
  getWelcomeClickatonConnectionInfo,
  getWelcomeFotorankClient,
  getWelcomeFotorankConnectionInfo,
} from "@repo/db/partners-welcome-context-clients";
import {
  assertWelcomeCanonicalContextIdFormat,
  type WelcomeAdminScopeKind,
} from "@repo/partners";
import { requireClickatonAdmin } from "@/lib/admin/auth";

export type WelcomeContextSearchHit = {
  id: string;
  label: string;
  secondary: string | null;
  status: string;
  slug: string | null;
  source: "CLICKATON" | "FOTORANK" | "CLF";
};

const LIMIT = 20;

export class WelcomeContextAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WelcomeContextAdapterError";
  }
}

async function searchEditions(q: string): Promise<WelcomeContextSearchHit[]> {
  const info = getWelcomeClickatonConnectionInfo();
  if (!info.configured) {
    throw new WelcomeContextAdapterError(info.reason || "DB Clickatón no configurada");
  }
  const rows = await prisma.clickatonEdition.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
      ],
      status: { not: "CANCELLED" },
    },
    orderBy: { updatedAt: "desc" },
    take: LIMIT,
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      startAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    label: r.name,
    secondary: r.startAt ? r.startAt.toISOString().slice(0, 10) : null,
    status: r.status,
    slug: r.slug,
    source: "CLICKATON" as const,
  }));
}

async function searchContests(q: string): Promise<WelcomeContextSearchHit[]> {
  const info = getWelcomeFotorankConnectionInfo();
  if (!info.configured) {
    throw new WelcomeContextAdapterError(info.reason || "DB FotoRank no configurada");
  }
  const client = getWelcomeFotorankClient();
  const rows = await client.fotorankContest.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
      ],
      status: { in: ["PUBLISHED", "ACTIVE", "READY_TO_PUBLISH"] },
      visibility: "PUBLIC",
    },
    orderBy: { updatedAt: "desc" },
    take: LIMIT,
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      organization: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    label: r.title,
    secondary: r.organization?.name ?? null,
    status: r.status,
    slug: r.slug,
    source: "FOTORANK" as const,
  }));
}

async function searchAlbums(q: string): Promise<WelcomeContextSearchHit[]> {
  const info = getWelcomeClfConnectionInfo();
  if (!info.configured) {
    throw new WelcomeContextAdapterError(info.reason || "DB CLF no configurada");
  }
  const client = getWelcomeClfClient();
  const rows = await client.album.findMany({
    where: {
      deletedAt: null,
      isPublic: true,
      isHidden: false,
      isTest: false,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { publicSlug: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: LIMIT,
    select: {
      id: true,
      title: true,
      publicSlug: true,
      isPublic: true,
      isHidden: true,
    },
  });
  return rows.map((r) => ({
    id: String(r.id),
    label: r.title || `Álbum ${r.id}`,
    secondary: r.publicSlug,
    status: r.isPublic && !r.isHidden ? "PUBLIC" : "RESTRICTED",
    slug: r.publicSlug,
    source: "CLF" as const,
  }));
}

export async function searchWelcomeContextEntities(input: {
  scopeKind: Extract<WelcomeAdminScopeKind, "EDITION" | "CONTEST" | "ALBUM">;
  query: string;
}): Promise<WelcomeContextSearchHit[]> {
  await requireClickatonAdmin();
  const q = input.query.trim();
  if (q.length < 1) return [];

  if (input.scopeKind === "EDITION") return searchEditions(q);
  if (input.scopeKind === "CONTEST") return searchContests(q);
  return searchAlbums(q);
}

/** Resuelve y valida que el ID exista y sea públicamente elegible en la DB canónica. */
export async function resolveWelcomeContextEntity(input: {
  scopeKind: Extract<WelcomeAdminScopeKind, "EDITION" | "CONTEST" | "ALBUM">;
  contextId: string;
}): Promise<WelcomeContextSearchHit> {
  await requireClickatonAdmin();
  const id = assertWelcomeCanonicalContextIdFormat(input.scopeKind, input.contextId);

  if (input.scopeKind === "EDITION") {
    const info = getWelcomeClickatonConnectionInfo();
    if (!info.configured) {
      throw new WelcomeContextAdapterError(info.reason || "DB Clickatón no configurada");
    }
    const row = await prisma.clickatonEdition.findFirst({
      where: { id, status: { not: "CANCELLED" } },
      select: { id: true, name: true, slug: true, status: true, startAt: true },
    });
    if (!row) {
      throw new WelcomeContextAdapterError("Edición no encontrada o no elegible en Clickatón.");
    }
    return {
      id: row.id,
      label: row.name,
      secondary: row.startAt ? row.startAt.toISOString().slice(0, 10) : null,
      status: row.status,
      slug: row.slug,
      source: "CLICKATON",
    };
  }

  if (input.scopeKind === "CONTEST") {
    const info = getWelcomeFotorankConnectionInfo();
    if (!info.configured) {
      throw new WelcomeContextAdapterError(info.reason || "DB FotoRank no configurada");
    }
    const row = await getWelcomeFotorankClient().fotorankContest.findFirst({
      where: {
        id,
        visibility: "PUBLIC",
        status: { in: ["PUBLISHED", "ACTIVE", "READY_TO_PUBLISH"] },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        organization: { select: { name: true } },
      },
    });
    if (!row) {
      throw new WelcomeContextAdapterError(
        "Concurso no encontrado o no público en la DB canónica de FotoRank.",
      );
    }
    return {
      id: row.id,
      label: row.title,
      secondary: row.organization?.name ?? null,
      status: row.status,
      slug: row.slug,
      source: "FOTORANK",
    };
  }

  const info = getWelcomeClfConnectionInfo();
  if (!info.configured) {
    throw new WelcomeContextAdapterError(info.reason || "DB CLF no configurada");
  }
  const albumId = Number.parseInt(id, 10);
  const row = await getWelcomeClfClient().album.findFirst({
    where: {
      id: albumId,
      deletedAt: null,
      isPublic: true,
      isHidden: false,
      isTest: false,
    },
    select: { id: true, title: true, publicSlug: true, isPublic: true, isHidden: true },
  });
  if (!row) {
    throw new WelcomeContextAdapterError(
      "Álbum no encontrado o no público en la DB canónica de ComprameLaFoto.",
    );
  }
  return {
    id: String(row.id),
    label: row.title || `Álbum ${row.id}`,
    secondary: row.publicSlug,
    status: "PUBLIC",
    slug: row.publicSlug,
    source: "CLF",
  };
}
