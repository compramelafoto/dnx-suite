import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type CamOfDutyMemberAdminRow = {
  userId: number;
  email: string;
  name: string | null;
  firstVisitAt: string;
  lastVisitAt: string;
  visits: number;
};

/** GET /api/admin/camofduty-members — usuarios de CLF que entraron a Cam Of Duty. */
export async function GET() {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  }

  const members = await prisma.camOfDutyMember.findMany({
    orderBy: { lastVisitAt: "desc" },
    take: 2000,
    include: { user: { select: { email: true, name: true } } },
  });

  const rows: CamOfDutyMemberAdminRow[] = members.map((m) => ({
    userId: m.userId,
    email: m.user.email,
    name: m.user.name,
    firstVisitAt: m.firstVisitAt.toISOString(),
    lastVisitAt: m.lastVisitAt.toISOString(),
    visits: m.visits,
  }));
  const total = await prisma.camOfDutyMember.count();
  return NextResponse.json({ rows, total });
}
