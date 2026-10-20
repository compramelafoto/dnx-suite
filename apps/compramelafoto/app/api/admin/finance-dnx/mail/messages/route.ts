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
    const rows = await prisma.expenseMailMessage.findMany({
      where: { status: "PARA_REVISAR" },
      orderBy: { receivedAt: "desc" },
      take: 200,
      select: {
        id: true,
        gmailMessageId: true,
        fromAddress: true,
        subject: true,
        receivedAt: true,
        vendorKey: true,
        reviewReason: true,
        account: { select: { email: true } },
      },
    });
    return NextResponse.json({
      messages: rows.map(({ account, gmailMessageId, ...m }) => ({
        ...m,
        account: account.email,
        gmailUrl: `https://mail.google.com/mail/?authuser=${encodeURIComponent(account.email)}#all/${gmailMessageId}`,
      })),
    });
  } catch (err: any) {
    console.error("GET /api/admin/finance-dnx/mail/messages ERROR >>>", err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
