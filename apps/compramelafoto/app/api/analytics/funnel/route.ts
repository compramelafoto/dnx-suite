import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ALLOWED_FUNNEL_EVENTS, FUNNEL_COOKIE_NAME } from "@/lib/funnel-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const event = String(body?.event || "").trim();
    if (!event || !ALLOWED_FUNNEL_EVENTS.has(event)) {
      return NextResponse.json({ error: "event inválido" }, { status: 400 });
    }

    let visitorKey = req.cookies.get(FUNNEL_COOKIE_NAME)?.value?.trim() ?? "";
    const isNewVisitor = visitorKey.length < 8;
    if (isNewVisitor) {
      visitorKey = randomUUID();
    }

    const albumIdRaw = body?.albumId;
    const albumId =
      albumIdRaw !== undefined && albumIdRaw !== null && albumIdRaw !== ""
        ? parseInt(String(albumIdRaw), 10)
        : null;
    const orderIdRaw = body?.orderId;
    const orderId =
      orderIdRaw !== undefined && orderIdRaw !== null && orderIdRaw !== ""
        ? parseInt(String(orderIdRaw), 10)
        : null;
    const authUser = await getAuthUser();
    const userId = authUser?.id ?? null;

    const referrer = req.headers.get("referer")?.slice(0, 2000) ?? null;
    const userAgent = req.headers.get("user-agent")?.slice(0, 2000) ?? null;
    const path = typeof body?.path === "string" ? body.path.slice(0, 500) : null;

    await prisma.funnelVisit.create({
      data: {
        visitorKey,
        event,
        albumId: Number.isFinite(albumId as number) ? albumId : null,
        orderId: Number.isFinite(orderId as number) ? orderId : null,
        userId,
        referrer,
        userAgent,
        path,
      },
    });

    const res = NextResponse.json({ ok: true });
    if (isNewVisitor) {
      res.cookies.set(FUNNEL_COOKIE_NAME, visitorKey, {
        path: "/",
        maxAge: 60 * 60 * 24 * 400,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
      });
    }
    return res;
  } catch (e: any) {
    console.error("POST /api/analytics/funnel", e);
    return NextResponse.json({ error: "Error registrando evento" }, { status: 500 });
  }
}
