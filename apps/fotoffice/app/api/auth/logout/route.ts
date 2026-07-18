import { NextResponse } from "next/server";
import { clearFotofficeSessionCookies } from "@/lib/session-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  await clearFotofficeSessionCookies();
  return NextResponse.redirect(new URL("/login", origin), { status: 303 });
}

export async function GET(req: Request) {
  return POST(req);
}
