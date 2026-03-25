import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/templates/[id]
 * Actualiza isSystemTemplate y/o theme (solo admin).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const id = parseInt((await params).id, 10);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const isSystemTemplate = body.isSystemTemplate;
    const theme = typeof body.theme === "string" ? body.theme.trim() || null : undefined;

    const updateData: { isSystemTemplate?: boolean; theme?: string | null } = {};
    if (typeof isSystemTemplate === "boolean") updateData.isSystemTemplate = isSystemTemplate;
    if (theme !== undefined) updateData.theme = theme;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }

    const template = await prisma.template.update({
      where: { id },
      data: updateData,
      include: { slots: true },
    });

    return NextResponse.json({ template });
  } catch (e) {
    console.error("PATCH /api/admin/templates/[id] error:", e);
    return NextResponse.json({ error: "Error al actualizar plantilla" }, { status: 500 });
  }
}
