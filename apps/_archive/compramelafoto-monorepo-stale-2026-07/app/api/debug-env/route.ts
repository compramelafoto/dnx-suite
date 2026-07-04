import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    hasMpToken: Boolean(process.env.MP_ACCESS_TOKEN),
    mpTokenStartsWith: (process.env.MP_ACCESS_TOKEN || "").slice(0, 8),
    appUrl: process.env.APP_URL || null,
  });
}
