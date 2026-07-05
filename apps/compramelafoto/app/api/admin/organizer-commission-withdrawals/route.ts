/**
 * GET /api/admin/organizer-commission-withdrawals
 * Lista solicitudes de retiro de comisiones de organizadores de eventos.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  OrganizerCommissionWithdrawalStatus,
  Prisma,
  Role,
} from "@prisma/client";
import {
  decimalToNumber,
  getOrganizerFinancialSnapshots,
} from "@/lib/admin/organizer-commission-financial-dashboard";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

const STATUS_VALUES = new Set<string>(Object.values(OrganizerCommissionWithdrawalStatus));

function organizerLabel(u: { name: string | null; email: string }): string {
  const n = (u.name || "").trim();
  return n || u.email;
}

export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const statusRaw = searchParams.get("status")?.trim();
    const organizerUserIdRaw = searchParams.get("organizerUserId")?.trim();
    const dateFromRaw = searchParams.get("dateFrom")?.trim();
    const dateToRaw = searchParams.get("dateTo")?.trim();
    const minAmountRaw = searchParams.get("minAmount")?.trim();
    const maxAmountRaw = searchParams.get("maxAmount")?.trim();
    const searchRaw = searchParams.get("search")?.trim();

    const listWhere: Prisma.OrganizerCommissionWithdrawalRequestWhereInput = {};

    if (statusRaw) {
      if (!STATUS_VALUES.has(statusRaw)) {
        return NextResponse.json({ error: "status inválido" }, { status: 400 });
      }
      listWhere.status = statusRaw as OrganizerCommissionWithdrawalStatus;
    }

    if (organizerUserIdRaw) {
      const oid = Number(organizerUserIdRaw);
      if (!Number.isFinite(oid) || oid <= 0) {
        return NextResponse.json({ error: "organizerUserId inválido" }, { status: 400 });
      }
      listWhere.organizerUserId = oid;
    }

    const requestedAtFilter: Prisma.DateTimeFilter = {};
    if (dateFromRaw) {
      const from = parseDateStartDay(dateFromRaw);
      if (!from) {
        return NextResponse.json({ error: "dateFrom inválido (YYYY-MM-DD)" }, { status: 400 });
      }
      requestedAtFilter.gte = from;
    }
    if (dateToRaw) {
      const to = parseDateEndDay(dateToRaw);
      if (!to) {
        return NextResponse.json({ error: "dateTo inválido (YYYY-MM-DD)" }, { status: 400 });
      }
      requestedAtFilter.lte = to;
    }
    if (Object.keys(requestedAtFilter).length > 0) {
      listWhere.requestedAt = requestedAtFilter;
    }

    if (minAmountRaw || maxAmountRaw) {
      const amountFilter: Prisma.DecimalFilter = {};
      if (minAmountRaw) {
        const min = Number(minAmountRaw);
        if (!Number.isFinite(min) || min < 0) {
          return NextResponse.json({ error: "minAmount inválido" }, { status: 400 });
        }
        amountFilter.gte = min;
      }
      if (maxAmountRaw) {
        const max = Number(maxAmountRaw);
        if (!Number.isFinite(max) || max < 0) {
          return NextResponse.json({ error: "maxAmount inválido" }, { status: 400 });
        }
        amountFilter.lte = max;
      }
      listWhere.amount = amountFilter;
    }

    if (searchRaw) {
      listWhere.organizer = {
        OR: [
          { name: { contains: searchRaw, mode: "insensitive" } },
          { email: { contains: searchRaw, mode: "insensitive" } },
        ],
      };
    }

    const summaryWhere = { ...listWhere };

    const [
      rows,
      totalRequested,
      totalApproved,
      totalPaid,
      totalRejected,
    ] = await prisma.$transaction([
      prisma.organizerCommissionWithdrawalRequest.findMany({
        where: listWhere,
        orderBy: { requestedAt: "desc" },
        take: 500,
        include: {
          organizer: { select: { id: true, name: true, email: true } },
          reviewedBy: { select: { id: true, name: true, email: true } },
          _count: { select: { commissions: true } },
        },
      }),
      prisma.organizerCommissionWithdrawalRequest.count({
        where: { ...summaryWhere, status: OrganizerCommissionWithdrawalStatus.REQUESTED },
      }),
      prisma.organizerCommissionWithdrawalRequest.count({
        where: { ...summaryWhere, status: OrganizerCommissionWithdrawalStatus.APPROVED },
      }),
      prisma.organizerCommissionWithdrawalRequest.count({
        where: { ...summaryWhere, status: OrganizerCommissionWithdrawalStatus.PAID },
      }),
      prisma.organizerCommissionWithdrawalRequest.count({
        where: { ...summaryWhere, status: OrganizerCommissionWithdrawalStatus.REJECTED },
      }),
    ]);

    const organizerIds = rows.map((r) => r.organizerUserId);
    const snapshots = await getOrganizerFinancialSnapshots(organizerIds);

    const items = rows.map((r) => {
      const snap = snapshots.get(r.organizerUserId);
      return {
        id: r.id,
        organizerUserId: r.organizerUserId,
        organizerName: organizerLabel(r.organizer),
        organizerEmail: r.organizer.email,
        amount: decimalToNumber(r.amount),
        status: r.status,
        requestedAt: r.requestedAt.toISOString(),
        reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
        reviewedById: r.reviewedById,
        reviewedByName: r.reviewedBy ? organizerLabel(r.reviewedBy) : null,
        paymentReference: r.paymentReference,
        adminNotes: r.adminNotes,
        payoutAliasSnapshot: r.payoutAliasSnapshot,
        payoutBankSnapshot: r.payoutBankSnapshot,
        payoutAccountHolderSnapshot: r.payoutAccountHolderSnapshot,
        hasReceipt: Boolean(r.payoutReceiptUrl),
        commissionsCount: r._count.commissions,
        organizerTotalGenerated: snap?.totalGenerated ?? 0,
        organizerTotalPaid: snap?.totalPaid ?? 0,
        organizerPendingBalance: snap?.pendingBalance ?? 0,
        organizerLastWithdrawalAt: snap?.lastWithdrawalAt ?? null,
      };
    });

    return NextResponse.json({
      summary: {
        totalRequested,
        totalApproved,
        totalPaid,
        totalRejected,
      },
      items,
    });
  } catch (err: unknown) {
    console.error("GET /api/admin/organizer-commission-withdrawals ERROR >>>", err);
    return NextResponse.json(
      { error: "Error listando solicitudes", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
