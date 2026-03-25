import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const original = await prisma.emailCampaign.findUnique({ where: { id } });
  if (!original) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });

  const campaign = await prisma.emailCampaign.create({
    data: {
      name: `${original.name} (copia)`,
      subject: original.subject,
      previewText: original.previewText,
      fromName: original.fromName,
      fromEmail: original.fromEmail,
      html: original.html,
      audienceJson: original.audienceJson ?? undefined,
      status: "DRAFT",
      createdByUserId: user.id,
    },
  });

  return NextResponse.json({ campaign });
}
