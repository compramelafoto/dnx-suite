import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EmailCampaignStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth([Role.ADMIN]);
  if (error) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as EmailCampaignStatus | null;

  const where = status ? { status } : {};
  const campaigns = await prisma.emailCampaign.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { sends: true } },
    },
  });

  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? "").toString().trim();
  const subject = (body.subject ?? "").toString().trim();
  const previewText = (body.previewText ?? "").toString().trim() || null;
  const fromName = (body.fromName ?? process.env.EMAIL_FROM_NAME ?? "Compramelafoto").toString().trim();
  const fromEmail = (body.fromEmail ?? process.env.EMAIL_FROM ?? "info@compramelafoto.com").toString().trim();
  const html = (body.html ?? "<p>Hola {{firstName}},</p><p>Contenido de la campaña.</p>").toString();
  const audienceJson = body.audienceJson ?? null;

  if (!name || !subject) {
    return NextResponse.json({ error: "name y subject son requeridos" }, { status: 400 });
  }

  const campaign = await prisma.emailCampaign.create({
    data: {
      name,
      subject,
      previewText,
      fromName,
      fromEmail,
      html,
      audienceJson: audienceJson ? (audienceJson as object) : undefined,
      status: "DRAFT",
      createdByUserId: user.id,
    },
  });

  return NextResponse.json({ campaign });
}
