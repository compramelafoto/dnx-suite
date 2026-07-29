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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth([Role.ADMIN]);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const { id } = await Promise.resolve(params);
  const talkId = parseId(id);
  if (!talkId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const talk = await prisma.talk.findUnique({
    where: { id: talkId },
    include: {
      _count: { select: { leads: true } },
    },
  });

  const [calendarCount, whatsappCount] = await Promise.all([
    prisma.talkLead.count({ where: { talkId, calendarClickedAt: { not: null } } }),
    prisma.talkLead.count({ where: { talkId, whatsappClickedAt: { not: null } } }),
  ]);

  if (!talk) return NextResponse.json({ error: "Charla no encontrada" }, { status: 404 });

  return NextResponse.json({
    talk: {
      ...talk,
      metrics: {
        calendarClicks: calendarCount,
        whatsappClicks: whatsappCount,
      },
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth([Role.ADMIN]);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const { id } = await Promise.resolve(params);
  const talkId = parseId(id);
  if (!talkId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await req.json().catch(() => ({}));

  try {
    const talk = await prisma.talk.update({
      where: { id: talkId },
      data: {
        title: body?.title ?? undefined,
        subtitle: body?.subtitle ?? undefined,
        slug: body?.slug ?? undefined,
        shortDescription: body?.shortDescription ?? undefined,
        longDescription: body?.longDescription ?? undefined,
        speakerName: body?.speakerName ?? undefined,
        badgeText: body?.badgeText ?? undefined,
        eventDate: body?.eventDate ? new Date(body.eventDate) : undefined,
        eventTime: body?.eventTime ?? undefined,
        timezone: body?.timezone ?? undefined,
        modality: body?.modality ?? undefined,
        meetUrl: body?.meetUrl ?? undefined,
        calendarUrl: body?.calendarUrl ?? undefined,
        whatsappGroupUrl: body?.whatsappGroupUrl ?? undefined,
        heroImageUrl: body?.heroImageUrl ?? undefined,
        primaryCtaText: body?.primaryCtaText ?? undefined,
        secondaryCtaText: body?.secondaryCtaText ?? undefined,
        seoTitle: body?.seoTitle ?? undefined,
        seoDescription: body?.seoDescription ?? undefined,
        ogImageUrl: body?.ogImageUrl ?? undefined,
        status: body?.status ?? undefined,
        showFaq: body?.showFaq ?? undefined,
        enableLeadCapture: body?.enableLeadCapture ?? undefined,
        enableCalendarStep: body?.enableCalendarStep ?? undefined,
        enableWhatsappStep: body?.enableWhatsappStep ?? undefined,
        requireName: body?.requireName ?? undefined,
        requireWhatsapp: body?.requireWhatsapp ?? undefined,
        requireEmail: body?.requireEmail ?? undefined,
        sourceTag: body?.sourceTag ?? undefined,
        internalNotes: body?.internalNotes ?? undefined,
        problemPointsJson: body?.problemPointsJson ?? undefined,
        solutionPointsJson: body?.solutionPointsJson ?? undefined,
        agendaPointsJson: body?.agendaPointsJson ?? undefined,
        stepsJson: body?.stepsJson ?? undefined,
        faqJson: body?.faqJson ?? undefined,
        reminderTemplate: body?.reminderTemplate ?? undefined,
        groupInviteTemplate: body?.groupInviteTemplate ?? undefined,
        followUpTemplate: body?.followUpTemplate ?? undefined,
      },
    });

    return NextResponse.json({ talk });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "El slug ya existe" }, { status: 409 });
    }
    console.error("PATCH /api/admin/talks/[id] ERROR >>>", err);
    return NextResponse.json({ error: "No se pudo actualizar la charla" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth([Role.ADMIN]);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const { id } = await Promise.resolve(params);
  const talkId = parseId(id);
  if (!talkId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  await prisma.talk.delete({ where: { id: talkId } });
  return NextResponse.json({ ok: true });
}
