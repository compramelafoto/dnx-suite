import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role, TalkStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseStatus(value: string | null): TalkStatus | null {
  if (!value) return null;
  const normalized = value.toUpperCase();
  return Object.values(TalkStatus).includes(normalized as TalkStatus)
    ? (normalized as TalkStatus)
    : null;
}

export async function GET(req: NextRequest) {
  const { error } = await requireAuth([Role.ADMIN]);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = parseStatus(searchParams.get("status"));
  const q = (searchParams.get("q") || "").trim();

  const where: any = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ];
  }

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (from || to) {
    where.eventDate = {};
    if (from) where.eventDate.gte = new Date(from);
    if (to) where.eventDate.lte = new Date(to);
  }

  const talks = await prisma.talk.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { leads: true } },
    },
  });

  const talkIds = talks.map((t) => t.id);
  const [calendarCounts, whatsappCounts] = await Promise.all([
    prisma.talkLead.groupBy({
      by: ["talkId"],
      where: { talkId: { in: talkIds }, calendarClickedAt: { not: null } },
      _count: { _all: true },
    }),
    prisma.talkLead.groupBy({
      by: ["talkId"],
      where: { talkId: { in: talkIds }, whatsappClickedAt: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const calendarByTalk = new Map(calendarCounts.map((row) => [row.talkId, row._count._all]));
  const whatsappByTalk = new Map(whatsappCounts.map((row) => [row.talkId, row._count._all]));

  const enriched = talks.map((talk) => ({
    ...talk,
    metrics: {
      calendarClicks: calendarByTalk.get(talk.id) ?? 0,
      whatsappClicks: whatsappByTalk.get(talk.id) ?? 0,
    },
  }));

  return NextResponse.json({ talks: enriched });
}

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title ?? "").trim();
  const slug = String(body?.slug ?? "").trim();

  if (!title || !slug) {
    return NextResponse.json({ error: "title y slug son requeridos" }, { status: 400 });
  }

  try {
    const talk = await prisma.talk.create({
      data: {
        title,
        slug,
        subtitle: body?.subtitle ?? null,
        shortDescription: body?.shortDescription ?? null,
        longDescription: body?.longDescription ?? null,
        speakerName: body?.speakerName ?? null,
        badgeText: body?.badgeText ?? null,
        eventDate: body?.eventDate ? new Date(body.eventDate) : null,
        eventTime: body?.eventTime ?? null,
        timezone: body?.timezone ?? "America/Argentina/Buenos_Aires",
        modality: body?.modality ?? "ONLINE",
        meetUrl: body?.meetUrl ?? null,
        calendarUrl: body?.calendarUrl ?? null,
        whatsappGroupUrl: body?.whatsappGroupUrl ?? null,
        heroImageUrl: body?.heroImageUrl ?? null,
        primaryCtaText: body?.primaryCtaText ?? null,
        secondaryCtaText: body?.secondaryCtaText ?? null,
        seoTitle: body?.seoTitle ?? null,
        seoDescription: body?.seoDescription ?? null,
        ogImageUrl: body?.ogImageUrl ?? null,
        status: body?.status ?? "DRAFT",
        showFaq: body?.showFaq ?? true,
        enableLeadCapture: body?.enableLeadCapture ?? true,
        enableCalendarStep: body?.enableCalendarStep ?? true,
        enableWhatsappStep: body?.enableWhatsappStep ?? true,
        requireName: body?.requireName ?? true,
        requireWhatsapp: body?.requireWhatsapp ?? true,
        requireEmail: body?.requireEmail ?? true,
        sourceTag: body?.sourceTag ?? null,
        internalNotes: body?.internalNotes ?? null,
        problemPointsJson: body?.problemPointsJson ?? null,
        solutionPointsJson: body?.solutionPointsJson ?? null,
        agendaPointsJson: body?.agendaPointsJson ?? null,
        stepsJson: body?.stepsJson ?? null,
        faqJson: body?.faqJson ?? null,
        reminderTemplate: body?.reminderTemplate ?? null,
        groupInviteTemplate: body?.groupInviteTemplate ?? null,
        followUpTemplate: body?.followUpTemplate ?? null,
      },
    });
    return NextResponse.json({ talk });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "El slug ya existe" }, { status: 409 });
    }
    console.error("POST /api/admin/talks ERROR >>>", err);
    return NextResponse.json({ error: "No se pudo crear la charla" }, { status: 500 });
  }
}
