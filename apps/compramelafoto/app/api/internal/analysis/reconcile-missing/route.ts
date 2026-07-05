import { NextResponse } from "next/server";
import { reconcileMissingJobs } from "@/lib/analysis/reconcile-missing-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1" && process.env.VERCEL === "1";
  if (!secret) return isVercelCron;
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.replace("Bearer ", "").trim() === secret;
  }
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  return token === secret || isVercelCron;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") || 200)));

  const reconciled = await reconcileMissingJobs(limit);

  return NextResponse.json({
    ok: true,
    created: reconciled.created,
    limit,
  });
}
