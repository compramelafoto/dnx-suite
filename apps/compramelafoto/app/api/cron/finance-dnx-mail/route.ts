import type { NextRequest } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { runMailSync } from "@/lib/finance-dnx/mail/run-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Lee una vez por día los mails nuevos de los proveedores en las cuentas de Gmail conectadas. */
export async function GET(req: NextRequest) {
  const denied = assertCronAuth(req);
  if (denied) return denied;
  try {
    const results = await runMailSync({ budgetMs: 240_000 });
    return Response.json({ ok: true, results });
  } catch (err: any) {
    console.error("GET /api/cron/finance-dnx-mail ERROR >>>", err);
    return Response.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
