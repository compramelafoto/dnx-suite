import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH: Actualizar testimonio (aprobar/desaprobar, editar texto) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const id = Number((await params).id);
    if (!id || isNaN(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const name = body.name != null ? String(body.name).trim() : undefined;
    const message = body.message != null ? String(body.message).trim() : undefined;
    const instagram = body.instagram !== undefined ? (body.instagram ? String(body.instagram).trim() : null) : undefined;
    const isApproved = body.isApproved;

    if (message !== undefined && message.length > 2000) {
      return NextResponse.json(
        { error: "El mensaje no puede superar 2000 caracteres" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (message !== undefined) updateData.message = message;
    if (instagram !== undefined) updateData.instagram = instagram;
    if (typeof isApproved === "boolean") updateData.isApproved = isApproved;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }

    const testimonial = await prisma.testimonial.update({
      where: { id },
      data: updateData as any,
    });

    return NextResponse.json(testimonial);
  } catch (err: unknown) {
    console.error("PATCH /api/admin/testimonials/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando testimonio" },
      { status: 500 }
    );
  }
}
