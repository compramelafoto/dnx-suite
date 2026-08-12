/**
 * Búsqueda administrativa de entidades contextuales para welcome.
 * Campos mínimos; sin PII; límite bajo.
 */
import "server-only";

import { prisma } from "@repo/db";
import type { WelcomeAdminScopeKind } from "@repo/partners";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";

export type WelcomeContextSearchHit = {
  id: string;
  label: string;
  secondary: string | null;
  status: string;
  slug: string | null;
};

const LIMIT = 20;

export async function searchWelcomeContextEntities(input: {
  scopeKind: Extract<WelcomeAdminScopeKind, "EDITION" | "CONTEST" | "ALBUM">;
  query: string;
}): Promise<WelcomeContextSearchHit[]> {
  await requireClickatonAdmin();
  const q = input.query.trim();
  if (q.length < 1) return [];

  const result = await withClickatonDb(async () => {
    if (input.scopeKind === "EDITION") {
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
      }));
    }

    if (input.scopeKind === "CONTEST") {
      const rows = await prisma.fotorankContest.findMany({
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
      }));
    }

    // ALBUM
    const rows = await prisma.album.findMany({
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
    }));
  });

  if (!result.ok) return [];
  return result.data ?? [];
}
