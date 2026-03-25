import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFromR2 } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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

/**
 * GET /api/cron/hidden-album-cleanup
 * Borra selfies expiradas de R2 y actualiza attempts (auditoría se mantiene).
 * No borra grants ni attempts; los grants expirados se ignoran al validar.
 */
export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const now = new Date();
    const expired = await prisma.hiddenAlbumAttempt.findMany({
      where: {
        selfieStored: true,
        selfieObjectKey: { not: null },
        selfieExpiresAt: { lt: now },
      },
      select: { id: true, selfieObjectKey: true },
      take: 50,
    });

    let deleted = 0;
    let errors = 0;

    for (const a of expired) {
      const key = a.selfieObjectKey!;
      try {
        await deleteFromR2(key);
        deleted++;
      } catch (e: any) {
        console.warn("Error borrando selfie R2:", key, e?.message);
        errors++;
      }
      await prisma.hiddenAlbumAttempt.update({
        where: { id: a.id },
        data: {
          selfieStored: false,
          selfieObjectKey: null,
          selfieExpiresAt: null,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      processed: expired.length,
      deletedFromR2: deleted,
      errors,
    });
  } catch (err: any) {
    console.error("Error en hidden-album-cleanup:", err);
    return NextResponse.json(
      { error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
