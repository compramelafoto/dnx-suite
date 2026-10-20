import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFromR2 } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Los intentos (IP hasheada, user-agent, resultado) se conservan 90 días y después se borran. */
const ATTEMPT_RETENTION_DAYS = 90;
const ATTEMPT_DELETE_BATCH = 500;
const ATTEMPT_DELETE_MAX_BATCHES = 20;

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
 * 1) Borra selfies expiradas de R2 y limpia la clave en el attempt.
 * 2) Borra attempts con más de 90 días (y, en cascada, su grant, que vence a los 30 min),
 *    en lotes. No toca attempts que todavía tengan una selfie guardada: primero se borra
 *    la selfie (paso 1) y el attempt se elimina en una corrida posterior.
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

    // 2) Intentos viejos, en lotes acotados.
    const attemptCutoff = new Date(now.getTime() - ATTEMPT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    let oldAttemptsDeleted = 0;
    for (let batch = 0; batch < ATTEMPT_DELETE_MAX_BATCHES; batch++) {
      const old = await prisma.hiddenAlbumAttempt.findMany({
        where: { createdAt: { lt: attemptCutoff }, selfieObjectKey: null },
        select: { id: true },
        orderBy: { createdAt: "asc" },
        take: ATTEMPT_DELETE_BATCH,
      });
      if (old.length === 0) break;
      const r = await prisma.hiddenAlbumAttempt.deleteMany({
        where: { id: { in: old.map((a) => a.id) }, selfieObjectKey: null },
      });
      oldAttemptsDeleted += r.count;
      if (old.length < ATTEMPT_DELETE_BATCH) break;
    }

    return NextResponse.json({
      ok: true,
      processed: expired.length,
      deletedFromR2: deleted,
      errors,
      oldAttemptsDeleted,
    });
  } catch (err: any) {
    console.error("Error en hidden-album-cleanup:", err);
    return NextResponse.json(
      { error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
