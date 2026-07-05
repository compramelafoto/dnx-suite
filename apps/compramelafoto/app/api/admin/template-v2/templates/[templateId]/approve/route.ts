import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = {
  params: { templateId: string } | Promise<{ templateId: string }>;
};

export async function POST(_req: Request, context: RouteCtx) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const { templateId } = await Promise.resolve(context.params);
    if (!templateId) {
      return NextResponse.json({ ok: false, error: "templateId inválido" }, { status: 400 });
    }

    const db = prisma as any;
    const template = await db.templateV2.findUnique({
      where: { id: templateId },
      select: { id: true },
    });
    if (!template) {
      return NextResponse.json({ ok: false, error: "Template no encontrado" }, { status: 404 });
    }

    const now = new Date();
    const publication = await db.templateV2Publication.upsert({
      where: { templateId },
      update: {
        reviewStatus: "APPROVED",
        visibility: "PUBLIC",
        reviewedByUserId: user.id,
        reviewedAt: now,
        publishedByUserId: user.id,
        publishedAt: now,
      },
      create: {
        templateId,
        reviewStatus: "APPROVED",
        visibility: "PUBLIC",
        reviewedByUserId: user.id,
        reviewedAt: now,
        publishedByUserId: user.id,
        publishedAt: now,
      },
      select: {
        templateId: true,
        reviewStatus: true,
        visibility: true,
        reviewedAt: true,
        publishedAt: true,
      },
    });

    return NextResponse.json({ ok: true, templateId, publication });
  } catch (e) {
    console.error("POST /api/admin/template-v2/templates/[templateId]/approve error:", e);
    return NextResponse.json({ ok: false, error: "Error al aprobar template" }, { status: 500 });
  }
}
