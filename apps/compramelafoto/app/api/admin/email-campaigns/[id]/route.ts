import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth([Role.ADMIN]);
  if (error) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id },
    include: { _count: { select: { sends: true } } },
  });

  if (!campaign) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });

  return NextResponse.json({ campaign });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth([Role.ADMIN]);
  if (error) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });

  if (!["DRAFT", "PAUSED"].includes(campaign.status)) {
    return NextResponse.json(
      { error: "Solo se pueden editar campañas en DRAFT o PAUSED" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.subject !== undefined) data.subject = String(body.subject).trim();
  if (body.previewText !== undefined) data.previewText = (body.previewText ?? "").toString().trim() || null;
  if (body.fromName !== undefined) data.fromName = String(body.fromName).trim();
  if (body.fromEmail !== undefined) data.fromEmail = String(body.fromEmail).trim();
  if (body.html !== undefined) data.html = String(body.html);
  if (body.audienceJson !== undefined) data.audienceJson = body.audienceJson;
  if (body.status !== undefined) data.status = body.status;

  const updated = await prisma.emailCampaign.update({
    where: { id },
    data: data as any,
  });

  return NextResponse.json({ campaign: updated });
}
