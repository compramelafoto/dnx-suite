import { NextRequest } from "next/server";
import { processAbandonedOrders } from "@/lib/jobs/abandonedOrders";
import { assertCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  const result = await processAbandonedOrders();

  return Response.json({
    ok: true,
    ...result,
  });
}

export async function POST(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  const result = await processAbandonedOrders();

  return Response.json({
    ok: true,
    ...result,
  });
}
