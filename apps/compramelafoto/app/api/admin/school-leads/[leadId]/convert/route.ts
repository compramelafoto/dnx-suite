import { NextRequest, NextResponse } from "next/server";
import { Role, SchoolLeadStatus } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  ownerUserId: z.number().int().positive().optional(),
});

function clean(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      const status = error === "No autorizado" ? 403 : 401;
      return NextResponse.json({ error: error || "No autorizado." }, { status });
    }

    const { leadId: leadIdParam } = await params;
    const leadId = Number(leadIdParam);
    if (!Number.isFinite(leadId)) {
      return NextResponse.json({ error: "leadId inválido." }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as unknown;
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "ownerUserId inválido." }, { status: 400 });
    }

    const lead = await prisma.schoolLead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        schoolName: true,
        city: true,
        contactName: true,
        contactRole: true,
        email: true,
        whatsapp: true,
        message: true,
        status: true,
        referredByUserId: true,
        convertedSchoolId: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 });
    }
    if (lead.convertedSchoolId) {
      return NextResponse.json({ error: "Esta solicitud ya fue convertida." }, { status: 409 });
    }

    const selectedOwnerId = parsed.data.ownerUserId ?? null;
    const ownerUserId = lead.referredByUserId ?? selectedOwnerId;
    if (!ownerUserId) {
      return NextResponse.json(
        { error: "Seleccioná un fotógrafo responsable antes de crear la escuela." },
        { status: 400 }
      );
    }

    const owner = await prisma.user.findFirst({
      where: {
        id: ownerUserId,
        role: { in: [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER] },
      },
      select: { id: true },
    });
    if (!owner) {
      return NextResponse.json({ error: "El fotógrafo seleccionado no es válido." }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          ownerId: owner.id,
          name: lead.schoolName.trim(),
          city: clean(lead.city),
          contactEmail: clean(lead.email),
          contactPhone: clean(lead.whatsapp),
          notes: [
            `Lead convertido desde solicitud #${lead.id}`,
            lead.contactName ? `Contacto: ${lead.contactName}` : null,
            lead.contactRole ? `Cargo: ${lead.contactRole}` : null,
            lead.message ? `Consulta: ${lead.message}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
        select: {
          id: true,
          name: true,
          ownerId: true,
        },
      });

      await tx.schoolLead.update({
        where: { id: lead.id },
        data: {
          status: SchoolLeadStatus.CONVERTED,
          convertedAt: new Date(),
          convertedSchoolId: school.id,
        },
      });

      return school;
    });

    return NextResponse.json({ ok: true, school: created });
  } catch (err) {
    console.error("POST /api/admin/school-leads/[leadId]/convert:", err);
    return NextResponse.json({ error: "Error convirtiendo la solicitud." }, { status: 500 });
  }
}
