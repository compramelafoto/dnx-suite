import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { getAuthUser } from "@/lib/auth";
import { createAdminLog } from "@/lib/services/logService";
import { checkRateLimit } from "@/lib/rate-limit";

function getClientIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "0.0.0.0";
  return req.headers.get("x-real-ip") || "0.0.0.0";
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const albumId = Number.parseInt(id, 10);
    if (!Number.isFinite(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const viewerCookie = req.cookies.get("viewer-id")?.value || "unknown";
    const ip = getClientIp(req);
    const rateKey = `screenshot:${albumId}:${viewerCookie}:${ip}`;
    const rate = checkRateLimit({ key: rateKey, limit: 6, windowMs: 60 * 1000 });
    if (!rate.allowed) {
      return NextResponse.json({ ok: true });
    }

    const user = await getAuthUser();
    const admin = await prisma.user.findFirst({
      where: { role: Role.ADMIN, isBlocked: false },
      select: { id: true, email: true },
    });

    if (!admin) {
      return NextResponse.json({ ok: true });
    }

    const body = await req.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" ? body.reason : "unknown";

    await createAdminLog({
      actorId: admin.id,
      actorRole: Role.ADMIN,
      actorEmail: admin.email ?? undefined,
      entity: "Album",
      entityId: albumId,
      action: "SCREENSHOT_ATTEMPT",
      description: `Intento de captura en álbum #${albumId}`,
      afterData: {
        viewerId: viewerCookie,
        viewerUserId: user?.id ?? null,
        viewerEmail: user?.email ?? null,
        reason,
      },
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/a/[id]/screenshot-log", error);
    return NextResponse.json({ ok: true });
  }
}
