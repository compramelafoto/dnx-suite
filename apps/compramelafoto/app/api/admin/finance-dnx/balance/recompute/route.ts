import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { recomputeRevenue } from "@/lib/finance-dnx/revenue/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado." }, { status: 401 });
  try {
    return NextResponse.json({ results: await recomputeRevenue() });
  } catch (err: any) {
    console.error("POST /api/admin/finance-dnx/balance/recompute ERROR >>>", err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
