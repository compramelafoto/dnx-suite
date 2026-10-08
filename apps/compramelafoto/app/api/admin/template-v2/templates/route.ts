import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 200;

/**
 * GET /api/admin/template-v2/templates — todas las plantillas del diseñador, de todos los
 * fotógrafos.
 *
 * - `q`: busca en el nombre o el id de la plantilla.
 * - `owner`: busca por fotógrafo (nombre, email o id de usuario).
 * - `ownerId`: un fotógrafo exacto.
 */
export async function GET(req: Request) {
  const { error } = await requireAuth([Role.ADMIN]);
  if (error) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const ownerQuery = url.searchParams.get("owner")?.trim() ?? "";
  const ownerIdParam = Number(url.searchParams.get("ownerId"));

  const where: Prisma.TemplateV2WhereInput = {};
  if (q) {
    where.OR = [{ name: { contains: q, mode: "insensitive" } }, { id: q }];
  }

  if (Number.isInteger(ownerIdParam) && ownerIdParam > 0) {
    where.ownerUserId = ownerIdParam;
  } else if (ownerQuery) {
    const asId = Number(ownerQuery);
    const owners = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: ownerQuery, mode: "insensitive" } },
          { email: { contains: ownerQuery, mode: "insensitive" } },
          ...(Number.isInteger(asId) && asId > 0 ? [{ id: asId }] : []),
        ],
      },
      select: { id: true },
      take: 500,
    });
    where.ownerUserId = { in: owners.map((o) => o.id) };
  }

  const rows = await prisma.templateV2.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      status: true,
      ownerUserId: true,
      workspaceId: true,
      currentVersionId: true,
      updatedAt: true,
      _count: { select: { albumPacksDesign: true } },
    },
  });

  const ownerIds = [...new Set(rows.map((r) => r.ownerUserId))];
  const versionIds = rows.map((r) => r.currentVersionId).filter((id): id is string => Boolean(id));
  const templateIds = rows.map((r) => r.id);

  const [owners, versions, publications] = await Promise.all([
    ownerIds.length
      ? prisma.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, name: true, email: true, role: true },
        })
      : [],
    versionIds.length
      ? prisma.templateV2Version.findMany({
          where: { id: { in: versionIds } },
          select: { id: true, versionNumber: true },
        })
      : [],
    templateIds.length
      ? prisma.templateV2Publication.findMany({
          where: { templateId: { in: templateIds } },
          select: { templateId: true, reviewStatus: true, visibility: true },
        })
      : [],
  ]);

  const ownerById = new Map(owners.map((o) => [o.id, o]));
  const versionById = new Map(versions.map((v) => [v.id, v]));
  const publicationById = new Map(publications.map((p) => [p.templateId, p]));

  const templates = rows.map((r) => {
    const owner = ownerById.get(r.ownerUserId);
    const version = r.currentVersionId ? versionById.get(r.currentVersionId) : undefined;
    const publication = publicationById.get(r.id);
    return {
      id: r.id,
      name: r.name,
      status: r.status,
      updatedAt: r.updatedAt.toISOString(),
      currentVersionId: version ? r.currentVersionId : null,
      versionNumber: version?.versionNumber ?? null,
      reviewStatus: publication?.reviewStatus ?? "DRAFT",
      visibility: publication?.visibility ?? "PRIVATE",
      packCount: r._count.albumPacksDesign,
      owner: owner
        ? { id: owner.id, name: owner.name, email: owner.email, role: owner.role }
        : { id: r.ownerUserId, name: null, email: null, role: null },
    };
  });

  return NextResponse.json({ ok: true, templates, truncated: rows.length === PAGE_SIZE });
}
