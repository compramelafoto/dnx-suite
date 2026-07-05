import { NextRequest, NextResponse } from "next/server";
import {
  EventOrganizerCommissionStatus,
  Prisma,
  Role,
} from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function decimalToNumber(v: Prisma.Decimal | null | undefined): number {
  if (v == null) return 0;
  return Number(v);
}

function parseDateStartDay(isoDate: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function parseDateEndDay(isoDate: string): Date | null {
  const start = parseDateStartDay(isoDate);
  if (!start) return null;
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return end;
}

function photographerDisplayName(u: {
  companyName: string | null;
  name: string | null;
  email: string;
}): string {
  const base = (u.companyName || u.name || "").trim();
  if (base) return base;
  return u.email;
}

const STATUS_SET = new Set<string>(Object.values(EventOrganizerCommissionStatus));

/**
 * GET /api/organizer/commissions
 * Comisiones por ventas de eventos del organizador autenticado (solo eventos donde creatorId = usuario).
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusRaw = searchParams.get("status")?.trim();
    const eventIdRaw = searchParams.get("eventId")?.trim();
    const dateFromRaw = searchParams.get("dateFrom")?.trim();
    const dateToRaw = searchParams.get("dateTo")?.trim();

    const summaryWhere: Prisma.EventOrganizerCommissionWhereInput = {
      event: { creatorId: user.id },
    };

    if (eventIdRaw) {
      const eventId = Number(eventIdRaw);
      if (!Number.isFinite(eventId) || eventId <= 0) {
        return NextResponse.json({ error: "eventId inválido" }, { status: 400 });
      }
      const owns = await prisma.event.findFirst({
        where: { id: eventId, creatorId: user.id },
        select: { id: true },
      });
      if (!owns) {
        return NextResponse.json({ error: "evento no encontrado" }, { status: 404 });
      }
      summaryWhere.eventId = eventId;
    }

    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (dateFromRaw) {
      const from = parseDateStartDay(dateFromRaw);
      if (!from) {
        return NextResponse.json({ error: "dateFrom inválido (usar YYYY-MM-DD)" }, { status: 400 });
      }
      createdAtFilter.gte = from;
    }
    if (dateToRaw) {
      const to = parseDateEndDay(dateToRaw);
      if (!to) {
        return NextResponse.json({ error: "dateTo inválido (usar YYYY-MM-DD)" }, { status: 400 });
      }
      createdAtFilter.lte = to;
    }
    if (Object.keys(createdAtFilter).length > 0) {
      summaryWhere.createdAt = createdAtFilter;
    }

    const listWhere: Prisma.EventOrganizerCommissionWhereInput = { ...summaryWhere };

    if (statusRaw) {
      if (!STATUS_SET.has(statusRaw)) {
        return NextResponse.json({ error: "status inválido" }, { status: 400 });
      }
      listWhere.status = statusRaw as EventOrganizerCommissionStatus;
    }

    const [
      rows,
      sumPending,
      sumAvailableBucket,
      sumPaid,
      sumGenerated,
      sumWithdrawableNow,
    ] = await prisma.$transaction([
      prisma.eventOrganizerCommission.findMany({
        where: listWhere,
        orderBy: { createdAt: "desc" },
        include: {
          event: { select: { id: true, title: true } },
          photographerUser: {
            select: { id: true, name: true, companyName: true, email: true },
          },
        },
      }),
      prisma.eventOrganizerCommission.aggregate({
        where: { ...summaryWhere, status: EventOrganizerCommissionStatus.PENDING },
        _sum: { organizerCommissionAmount: true },
      }),
      prisma.eventOrganizerCommission.aggregate({
        where: {
          ...summaryWhere,
          status: {
            in: [
              EventOrganizerCommissionStatus.AVAILABLE,
              EventOrganizerCommissionStatus.WITHDRAWAL_REQUESTED,
            ],
          },
        },
        _sum: { organizerCommissionAmount: true },
      }),
      prisma.eventOrganizerCommission.aggregate({
        where: { ...summaryWhere, status: EventOrganizerCommissionStatus.PAID },
        _sum: { organizerCommissionAmount: true },
      }),
      prisma.eventOrganizerCommission.aggregate({
        where: {
          ...summaryWhere,
          status: { not: EventOrganizerCommissionStatus.CANCELLED },
        },
        _sum: { organizerCommissionAmount: true },
      }),
      prisma.eventOrganizerCommission.aggregate({
        where: {
          ...summaryWhere,
          organizerUserId: user.id,
          status: EventOrganizerCommissionStatus.AVAILABLE,
          availableAt: { lte: new Date() },
          withdrawalRequestId: null,
        },
        _sum: { organizerCommissionAmount: true },
      }),
    ]);

    const items = rows.map((row) => ({
      commissionId: row.id,
      orderId: row.orderId,
      eventId: row.eventId,
      eventTitle: row.event.title,
      photographerUserId: row.photographerUserId,
      photographerName: photographerDisplayName(row.photographerUser),
      albumId: row.albumId,
      organizerCommissionPercentage: row.organizerCommissionPercentage,
      photographerBaseAmount: decimalToNumber(row.photographerBaseAmount),
      organizerCommissionAmount: decimalToNumber(row.organizerCommissionAmount),
      photographerNetAmount: decimalToNumber(row.photographerNetAmount),
      totalPaidAmount: decimalToNumber(row.totalPaidAmount),
      platformFeeAmount: decimalToNumber(row.platformFeeAmount),
      status: row.status,
      payoutMode: row.payoutMode,
      availableAt: row.availableAt.toISOString(),
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    }));

    return NextResponse.json({
      summary: {
        totalPending: decimalToNumber(sumPending._sum.organizerCommissionAmount),
        totalAvailable: decimalToNumber(sumAvailableBucket._sum.organizerCommissionAmount),
        totalPaid: decimalToNumber(sumPaid._sum.organizerCommissionAmount),
        totalGenerated: decimalToNumber(sumGenerated._sum.organizerCommissionAmount),
        totalWithdrawable: decimalToNumber(sumWithdrawableNow._sum.organizerCommissionAmount),
      },
      items,
    });
  } catch (err: unknown) {
    console.error("GET /api/organizer/commissions ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo comisiones", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
