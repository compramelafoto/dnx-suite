import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = {
  params: { templateId: string } | Promise<{ templateId: string }>;
};

export async function POST(req: Request, context: RouteCtx) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const { templateId } = await Promise.resolve(context.params);
    if (!templateId) {
      return NextResponse.json({ ok: false, error: "templateId inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const reviewNotes =
      typeof body?.reason === "string" && body.reason.trim() !== ""
        ? body.reason.trim().slice(0, 500)
        : typeof body?.notes === "string" && body.notes.trim() !== ""
          ? body.notes.trim().slice(0, 500)
          : null;

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
        reviewStatus: "REJECTED",
        visibility: "PRIVATE",
        reviewNotes,
        reviewedByUserId: user.id,
        reviewedAt: now,
        publishedByUserId: null,
        publishedAt: null,
      },
      create: {
        templateId,
        reviewStatus: "REJECTED",
        visibility: "PRIVATE",
        reviewNotes,
        reviewedByUserId: user.id,
        reviewedAt: now,
      },
      select: {
        templateId: true,
        reviewStatus: true,
        visibility: true,
        reviewNotes: true,
        reviewedAt: true,
      },
    });

    return NextResponse.json({ ok: true, templateId, publication });
  } catch (e) {
    console.error("POST /api/admin/template-v2/templates/[templateId]/reject error:", e);
    return NextResponse.json({ ok: false, error: "Error al rechazar template" }, { status: 500 });
  }
}
