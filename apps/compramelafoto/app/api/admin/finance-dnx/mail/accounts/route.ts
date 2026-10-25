import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado." }, { status: 401 });
  try {
    const accounts = await prisma.expenseMailAccount.findMany({
      orderBy: { email: "asc" },
      select: {
        id: true,
        email: true,
        connectedAt: true,
        lastSyncAt: true,
        lastError: true,
        backfillDone: true,
        _count: { select: { messages: { where: { status: "PARA_REVISAR" } } } },
      },
    });
    return NextResponse.json({
      accounts: accounts.map(({ _count, ...a }) => ({ ...a, pendingReview: _count.messages })),
    });
  } catch (err: any) {
    console.error("GET /api/admin/finance-dnx/mail/accounts ERROR >>>", err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
