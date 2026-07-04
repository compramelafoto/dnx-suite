import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

async function unsubscribeByToken(token: string | null, ip: string) {
  const t = token?.trim();

  if (!t) {
    return { success: false, error: "Token requerido", status: 400 as const };
  }

  const user = await prisma.user.findFirst({
    where: { unsubscribeToken: t },
    select: { id: true, unsubscribedAt: true },
  });

  if (!user) {
    return { success: false, error: "Token inválido o ya usado", status: 404 as const };
  }

  if (user.unsubscribedAt) {
    return { success: true, message: "Ya estabas dado de baja" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { marketingOptIn: false, unsubscribedAt: new Date() },
  });

  return { success: true };
}

function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/**
 * Marca al usuario como unsubscribed usando su token
 * POST o GET (para links en emails: /api/unsubscribe?token=...)
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit({ key: `unsub:${ip}`, limit: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: "Demasiadas solicitudes" }, { status: 429 });
  }
  const { searchParams } = new URL(req.url);
  const result = await unsubscribeByToken(searchParams.get("token"), ip);
  if ("status" in result) {
    return NextResponse.json(
      { success: result.success, error: result.error },
      { status: result.status }
    );
  }
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit({ key: `unsub:${ip}`, limit: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: "Demasiadas solicitudes" }, { status: 429 });
  }
  const { searchParams } = new URL(req.url);
  const result = await unsubscribeByToken(searchParams.get("token"), ip);
  if ("status" in result) {
    return NextResponse.json(
      { success: result.success, error: result.error },
      { status: result.status }
    );
  }
  return NextResponse.json(result);
}
