/**
 * GET /api/admin/organizer-commission-withdrawals/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { getOrganizerFinancialSnapshot } from "@/lib/admin/organizer-commission-financial-dashboard";
import { requireAuth } from "@/lib/auth";
import { getOrganizerWithdrawalReceiptSignedUrl } from "@/lib/organizer-payout-receipt";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function decimalToNumber(v: Prisma.Decimal | null | undefined): number {
  if (v == null) return 0;
  return Number(v);
}

function personLabel(u: { name: string | null; companyName?: string | null; email: string }): string {
  const c = (u.companyName || "").trim();
  const n = (u.name || "").trim();
  return (c || n || u.email).trim();
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { id: idParam } = await ctx.params;
    const id = Number(idParam);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }

    const row = await prisma.organizerCommissionWithdrawalRequest.findUnique({
      where: { id },
      include: {
        organizer: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
        commissions: {
          include: {
            event: { select: { id: true, title: true } },
            photographerUser: {
              select: { id: true, name: true, companyName: true, email: true },
            },
            order: {
              select: {
                id: true,
                status: true,
                totalCents: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!row) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    const organizerFinancial = await getOrganizerFinancialSnapshot(row.organizerUserId);

    return NextResponse.json({
      request: {
        id: row.id,
        organizerUserId: row.organizerUserId,
        organizerName: personLabel({ ...row.organizer, companyName: null }),
        organizerEmail: row.organizer.email,
        amount: decimalToNumber(row.amount),
        status: row.status,
        requestedAt: row.requestedAt.toISOString(),
        reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
        reviewedById: row.reviewedById,
        reviewedByName: row.reviewedBy ? personLabel({ ...row.reviewedBy, companyName: null }) : null,
        paymentReference: row.paymentReference,
        adminNotes: row.adminNotes,
        payoutAliasSnapshot: row.payoutAliasSnapshot,
        payoutBankSnapshot: row.payoutBankSnapshot,
        payoutAccountHolderSnapshot: row.payoutAccountHolderSnapshot,
        payoutReceiptFileName: row.payoutReceiptFileName,
        payoutReceiptMimeType: row.payoutReceiptMimeType,
        payoutReceiptUploadedAt: row.payoutReceiptUploadedAt
          ? row.payoutReceiptUploadedAt.toISOString()
          : null,
        hasReceipt: Boolean(row.payoutReceiptUrl),
        receiptViewUrl: row.payoutReceiptUrl
          ? await getOrganizerWithdrawalReceiptSignedUrl(row.payoutReceiptUrl)
          : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
      commissions: row.commissions.map((c) => ({
        id: c.id,
        orderId: c.orderId,
        orderStatus: c.order.status,
        orderTotalPaidAmount: c.order.totalCents,
        eventId: c.eventId,
        eventTitle: c.event.title,
        photographerUserId: c.photographerUserId,
        photographerName: personLabel(c.photographerUser),
        albumId: c.albumId,
        status: c.status,
        organizerCommissionPercentage: c.organizerCommissionPercentage,
        photographerBaseAmount: decimalToNumber(c.photographerBaseAmount),
        organizerCommissionAmount: decimalToNumber(c.organizerCommissionAmount),
        photographerNetAmount: decimalToNumber(c.photographerNetAmount),
        totalPaidAmount: decimalToNumber(c.totalPaidAmount),
        platformFeeAmount: decimalToNumber(c.platformFeeAmount),
        paidAt: c.paidAt ? c.paidAt.toISOString() : null,
        availableAt: c.availableAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
      })),
      organizerFinancial,
    });
  } catch (err: unknown) {
    console.error("GET /api/admin/organizer-commission-withdrawals/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo detalle", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
