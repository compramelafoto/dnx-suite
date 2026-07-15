/**
 * GET /api/referrals/me — datos del referidor autenticado.
 * POST /api/referrals/me — crear código (requiere MP conectado).
 * PATCH /api/referrals/me — actualizar CBU/Alias propio.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role, TalkStatus } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { getPublicReferralUrl } from "@/lib/referral-link";
import {
  buildReferredRowsForReferrer,
  buildReferralProgramStats,
  getTalkTitleByIdForAttributions,
} from "@/lib/referral/referrals-me-response";
import {
  getReferrerAvailableBalancePesos,
  getReferrerTotalPaidPesos,
} from "@/lib/referral/balance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveAppUrl(): string {
  const raw =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://www.compramelafoto.com";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

const REFERRER_ROLES = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.LAB] as const;

export async function GET() {
  try {
    const { error, user } = await requireAuth([...REFERRER_ROLES]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Solo fotógrafos y laboratorios." },
        { status: 401 }
      );
    }

    const userWithMp = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        mpUserId: true,
        mpConnectedAt: true,
        cbu: true,
        cbuTitular: true,
      },
    });
    const mpConnected = !!(userWithMp?.mpUserId || userWithMp?.mpConnectedAt);

    const referralCode = await prisma.referralCode.findUnique({
      where: { ownerUserId: user.id, isActive: true },
      select: { id: true, code: true },
    });

    const talkTitleById = await getTalkTitleByIdForAttributions(user.id);
    const referred = await buildReferredRowsForReferrer(user.id, talkTitleById);
    const programStats = await buildReferralProgramStats(user.id, referred);

    const url = referralCode ? getPublicReferralUrl(referralCode.code) : null;

    let trainingPromos: Array<{
      id: number;
      title: string;
      slug: string;
      eventDate: string | null;
      promotionalUrl: string;
      thumbnailUrl: string | null;
    }> = [];

    if (referralCode) {
      const now = new Date();
      const appUrl = resolveAppUrl();
      const talks = await prisma.talk.findMany({
        where: {
          status: TalkStatus.PUBLISHED,
          OR: [{ eventDate: null }, { eventDate: { gte: now } }],
        },
        select: {
          id: true,
          title: true,
          slug: true,
          eventDate: true,
          heroImageUrl: true,
          ogImageUrl: true,
        },
        orderBy: [{ eventDate: "asc" }, { id: "asc" }],
        take: 50,
      });
      const codeEnc = encodeURIComponent(referralCode.code);
      trainingPromos = talks.map((t) => ({
        id: t.id,
        title: t.title,
        slug: t.slug,
        eventDate: t.eventDate?.toISOString() ?? null,
        promotionalUrl: `${appUrl}/charlas/${encodeURIComponent(t.slug)}?ref=${codeEnc}&source=training&trainingId=${t.id}`,
        thumbnailUrl: t.heroImageUrl ?? t.ogImageUrl ?? null,
      }));
    }

    const [balanceCents, totalPaidCents, payoutRequests] = await Promise.all([
      getReferrerAvailableBalancePesos(user.id),
      getReferrerTotalPaidPesos(user.id),
      prisma.referralPayoutRequest.findMany({
        where: { referrerUserId: user.id },
        orderBy: { requestedAt: "desc" },
        take: 10,
        select: {
          id: true,
          amountCents: true,
          status: true,
          requestedAt: true,
          paidAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      mpConnected,
      cbu: userWithMp?.cbu ?? null,
      cbuTitular: userWithMp?.cbuTitular ?? null,
      referralCode: referralCode ? { code: referralCode.code, url } : null,
      trainingPromos,
      totalReferred: referred.length,
      referred,
      balanceCents,
      totalPaidCents,
      referredPhotographersCount: programStats.referredPhotographersCount,
      referredOrganizersCount: programStats.referredOrganizersCount,
      activePhotographersCount: programStats.activePhotographersCount,
      activeOrganizersCount: programStats.activeOrganizersCount,
      photographerReferralEarningsCents:
        programStats.photographerReferralEarningsCents,
      organizerReferralEarningsCents: programStats.organizerReferralEarningsCents,
      photographerBalanceCents: programStats.photographerBalanceCents,
      organizerBalanceCents: programStats.organizerBalanceCents,
      programStats,
      payoutRequests: payoutRequests.map((r) => ({
        id: r.id,
        amountCents: r.amountCents,
        status: r.status,
        requestedAt: r.requestedAt.toISOString(),
        paidAt: r.paidAt?.toISOString() ?? null,
      })),
    });
  } catch (err: unknown) {
    console.error("GET /api/referrals/me ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo datos de referidos" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const { error, user } = await requireAuth([...REFERRER_ROLES]);
    if (error || !user) {
      return NextResponse.json(
        {
          error:
            error ||
            "No autorizado. Solo fotógrafos y laboratorios pueden crear código de referido.",
        },
        { status: 401 }
      );
    }

    const userWithMp = await prisma.user.findUnique({
      where: { id: user.id },
      select: { mpUserId: true, mpConnectedAt: true },
    });
    const mpConnected = !!(userWithMp?.mpUserId || userWithMp?.mpConnectedAt);
    if (!mpConnected) {
      return NextResponse.json(
        {
          error:
            "Para generar tu link de referidos tenés que conectar Mercado Pago primero.",
        },
        { status: 403 }
      );
    }

    const existing = await prisma.referralCode.findUnique({
      where: { ownerUserId: user.id },
      select: { code: true },
    });

    if (existing) {
      return NextResponse.json({
        referralCode: {
          code: existing.code,
          url: getPublicReferralUrl(existing.code),
        },
      });
    }

    const { generateReferralCode } = await import("@/lib/referral-helpers");
    let code = generateReferralCode();
    for (let i = 0; i < 10; i++) {
      const exists = await prisma.referralCode.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!exists) break;
      code = generateReferralCode();
    }

    await prisma.referralCode.create({
      data: {
        code,
        ownerUserId: user.id,
        isActive: true,
      },
    });

    return NextResponse.json({
      referralCode: { code, url: getPublicReferralUrl(code) },
    });
  } catch (err: unknown) {
    console.error("POST /api/referrals/me ERROR >>>", err);
    return NextResponse.json(
      { error: "Error creando código de referido" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { error, user } = await requireAuth([...REFERRER_ROLES]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Solo fotógrafos y laboratorios." },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const cbu =
      typeof body.cbu === "string"
        ? body.cbu.trim() || null
        : body.cbu === null
          ? null
          : undefined;
    const cbuTitular =
      typeof body.cbuTitular === "string"
        ? body.cbuTitular.trim() || null
        : body.cbuTitular === null
          ? null
          : undefined;

    if (cbu === undefined) {
      return NextResponse.json(
        { error: "Se requiere 'cbu' (string o null)." },
        { status: 400 }
      );
    }

    // Solo datos bancarios propios; nunca aceptar userId ajeno
    await prisma.user.update({
      where: { id: user.id },
      data: {
        cbu,
        ...(cbuTitular !== undefined && { cbuTitular }),
      },
    });

    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      select: { cbu: true, cbuTitular: true },
    });

    return NextResponse.json({
      cbu: updated?.cbu ?? null,
      cbuTitular: updated?.cbuTitular ?? null,
    });
  } catch (err: unknown) {
    console.error("PATCH /api/referrals/me ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando CBU" },
      { status: 500 }
    );
  }
}
