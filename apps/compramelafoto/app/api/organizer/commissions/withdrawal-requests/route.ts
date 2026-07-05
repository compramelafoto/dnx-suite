import { Role } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getOrganizerWithdrawalReceiptSignedUrl } from "@/lib/organizer-payout-receipt";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function decimalToNumber(v: { toString: () => string } | null | undefined): number {
  if (v == null) return 0;
  return Number(v);
}

/**
 * GET /api/organizer/commissions/withdrawal-requests
 */
export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const rows = await prisma.organizerCommissionWithdrawalRequest.findMany({
      where: { organizerUserId: user.id },
      orderBy: { requestedAt: "desc" },
      include: {
        _count: { select: { commissions: true } },
      },
    });

    const items = await Promise.all(
      rows.map(async (r) => {
        let receiptViewUrl: string | null = null;
        if (r.status === "PAID" && r.payoutReceiptUrl) {
          receiptViewUrl = await getOrganizerWithdrawalReceiptSignedUrl(r.payoutReceiptUrl);
        }
        return {
          id: r.id,
          amount: decimalToNumber(r.amount),
          status: r.status,
          requestedAt: r.requestedAt.toISOString(),
          reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
          adminNotes: r.adminNotes,
          paymentReference: r.paymentReference,
          payoutAliasSnapshot: r.payoutAliasSnapshot,
          payoutBankSnapshot: r.payoutBankSnapshot,
          payoutAccountHolderSnapshot: r.payoutAccountHolderSnapshot,
          payoutReceiptFileName: r.payoutReceiptFileName,
          payoutReceiptMimeType: r.payoutReceiptMimeType,
          payoutReceiptUploadedAt: r.payoutReceiptUploadedAt
            ? r.payoutReceiptUploadedAt.toISOString()
            : null,
          hasReceipt: Boolean(r.payoutReceiptUrl),
          receiptViewUrl,
          commissionsIncluded: r._count.commissions,
        };
      })
    );

    return NextResponse.json({ items });
  } catch (err: unknown) {
    console.error("GET /api/organizer/commissions/withdrawal-requests ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo solicitudes", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
