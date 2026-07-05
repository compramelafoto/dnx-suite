import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const db = prisma as any;
    const rows = await db.templateV2Publication.findMany({
      where: { reviewStatus: "IN_REVIEW" },
      orderBy: { updatedAt: "asc" },
      select: {
        templateId: true,
        reviewStatus: true,
        visibility: true,
        updatedAt: true,
      },
    });

    const templateIds = rows.map((r: { templateId: string }) => r.templateId);
    const templates =
      templateIds.length === 0
        ? []
        : await db.templateV2.findMany({
            where: { id: { in: templateIds } },
            select: { id: true, name: true, description: true, ownerUserId: true },
          });

    const ownerIds = [...new Set(templates.map((t: { ownerUserId: number }) => t.ownerUserId))];
    const owners: Array<{ id: number; name: string | null; email: string | null }> =
      ownerIds.length === 0
        ? []
        : await db.user.findMany({
            where: { id: { in: ownerIds } },
            select: { id: true, name: true, email: true },
          });

    const templateById = new Map(templates.map((t: { id: string }) => [t.id, t]));
    const ownerById = new Map(owners.map((u) => [u.id, u] as [number, (typeof owners)[number]]));

    const queue = rows.map((r: { templateId: string; reviewStatus: unknown; visibility: unknown; updatedAt: Date }) => {
      const tpl = templateById.get(r.templateId) as
        | { id: string; name: string; description: string | null; ownerUserId: number }
        | undefined;
      const ownerUser = tpl ? ownerById.get(tpl.ownerUserId) : undefined;
      return {
        templateId: r.templateId,
        name: tpl?.name ?? "",
        description: tpl?.description ?? null,
        owner: ownerUser
          ? {
              id: ownerUser.id,
              name: ownerUser.name,
              email: ownerUser.email,
            }
          : null,
        reviewStatus: r.reviewStatus,
        visibility: r.visibility,
        updatedAt: r.updatedAt,
      };
    });

    return NextResponse.json({ ok: true, queue });
  } catch (e) {
    console.error("GET /api/admin/template-v2/review-queue error:", e);
    return NextResponse.json({ ok: false, error: "Error al listar cola de revisión" }, { status: 500 });
  }
}
