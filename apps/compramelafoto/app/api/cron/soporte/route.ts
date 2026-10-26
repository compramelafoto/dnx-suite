import type { NextRequest } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { correrCronSoporte } from "@/lib/soporte/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;
  return Response.json({ ok: true, ...(await correrCronSoporte(new Date())) });
}
