import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseId(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth([Role.ADMIN]);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const { id } = await Promise.resolve(params);
  const talkId = parseId(id);
  if (!talkId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");

  const where: any = { talkId };
  if (statusFilter === "calendar") {
    where.calendarClickedAt = { not: null };
  }
  if (statusFilter === "whatsapp") {
    where.whatsappClickedAt = { not: null };
  }
  if (statusFilter === "attended") {
    where.attendedAt = { not: null };
  }
  if (statusFilter === "interested") {
    where.interestedAt = { not: null };
  }

  const leads = await prisma.talkLead.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ leads });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth([Role.ADMIN]);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const { id } = await Promise.resolve(params);
  const talkId = parseId(id);
  if (!talkId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const leadId = parseId(String(body?.leadId ?? ""));
  const action = String(body?.action ?? "");

  if (!leadId) return NextResponse.json({ error: "Lead inválido" }, { status: 400 });

  const now = new Date();
  const data =
    action === "attended"
      ? { attendedAt: body?.value ? now : null }
      : action === "interested"
      ? { interestedAt: body?.value ? now : null }
      : action === "contacted"
      ? { contactedAt: body?.value ? now : null }
      : action === "reminder"
      ? { reminderSentAt: now }
      : action === "notes"
      ? { notes: String(body?.notes ?? "") }
      : null;

  if (!data) return NextResponse.json({ error: "Acción inválida" }, { status: 400 });

  const lead = await prisma.talkLead.update({
    where: { id: leadId, talkId },
    data,
  });

  return NextResponse.json({ lead });
}
