import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnedAgency } from "@/lib/agencies/owner-auth";
import { bpsToPercentLabel, effectiveCommissionBps, memberNeedsTerms } from "@/lib/agencies/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const a = await requireOwnedAgency();
  if ("res" in a) return a.res;
  const rows = await prisma.agencyMember.findMany({
    where: { agencyId: a.agency.id, status: { in: ["ACTIVE", "REQUESTED"] } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, userId: true, status: true, commissionBps: true, termsVersionAccepted: true,
      requestMessage: true, joinedAt: true, user: { select: { name: true, email: true } },
    },
  });
  const dto = rows.map((m) => {
    const bps = effectiveCommissionBps(m, a.agency);
    return {
      id: m.id,
      userId: m.userId,
      name: m.user.name ?? m.user.email,
      email: m.user.email,
      status: m.status,
      commissionBps: bps,
      commissionLabel: bpsToPercentLabel(bps),
      usesDefault: m.commissionBps === null,
      needsTerms: memberNeedsTerms(m, a.agency),
      requestMessage: m.requestMessage,
      joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
    };
  });
  return NextResponse.json({
    members: dto.filter((m) => m.status === "ACTIVE"),
    requests: dto.filter((m) => m.status === "REQUESTED"),
  });
}
