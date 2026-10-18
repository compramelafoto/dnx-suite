import type { NextRequest } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { runMailSync } from "@/lib/finance-dnx/mail/run-sync";
import { recomputeRevenue } from "@/lib/finance-dnx/revenue/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Una vez por día: lee los mails nuevos de los proveedores y recalcula los ingresos de cada plataforma. */
export async function GET(req: NextRequest) {
  const denied = assertCronAuth(req);
  if (denied) return denied;
  try {
    const mail = await runMailSync({ budgetMs: 180_000 });
    const revenue = await recomputeRevenue();
    return Response.json({ ok: true, ...mail, revenue });
  } catch (err: any) {
    console.error("GET /api/cron/finance-dnx-mail ERROR >>>", err);
    return Response.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
