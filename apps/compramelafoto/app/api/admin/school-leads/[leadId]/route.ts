import { NextRequest, NextResponse } from "next/server";
import { Role, SchoolLeadStatus } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z
    .enum([
      SchoolLeadStatus.NEW,
      SchoolLeadStatus.CONTACTED,
      SchoolLeadStatus.IN_PROGRESS,
      SchoolLeadStatus.CONVERTED,
      SchoolLeadStatus.DISCARDED,
    ])
    .optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      const status = error === "No autorizado" ? 403 : 401;
      return NextResponse.json({ error }, { status });
    }

    const { leadId: leadIdParam } = await params;
    const leadId = Number(leadIdParam);
    if (!Number.isFinite(leadId)) {
      return NextResponse.json({ error: "leadId inválido." }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as unknown;
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const message = fieldErrors.status?.[0] || fieldErrors.notes?.[0] || "Datos inválidos.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const updateData: {
      status?: SchoolLeadStatus;
      notes?: string | null;
    } = {};

    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    if (parsed.data.notes !== undefined) {
      updateData.notes = parsed.data.notes.trim() ? parsed.data.notes.trim() : null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No hay cambios para aplicar." }, { status: 400 });
    }

    const updated = await prisma.schoolLead.update({
      where: { id: leadId },
      data: updateData,
      select: {
        id: true,
        status: true,
        notes: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, lead: updated });
  } catch (err) {
    console.error("PATCH /api/admin/school-leads/[leadId]:", err);
    return NextResponse.json({ error: "Error actualizando la solicitud." }, { status: 500 });
  }
}
