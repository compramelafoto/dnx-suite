import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/hidden-album-attempts
 * Lista intentos de selfie (álbum oculto) con filtros. Solo ADMIN.
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const albumId = searchParams.get("albumId");
    const result = searchParams.get("result");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const userId = searchParams.get("userId");
    const guestId = searchParams.get("guestId");
    const email = searchParams.get("email");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "50"), 100);

    const where: Record<string, unknown> = {};

    if (albumId) {
      const aid = parseInt(albumId, 10);
      if (Number.isFinite(aid)) where.albumId = aid;
    }
    if (result) where.result = result;
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Record<string, Date>).gte = new Date(from);
      if (to) (where.createdAt as Record<string, Date>).lte = new Date(to);
    }
    if (userId) {
      const uid = parseInt(userId, 10);
      if (Number.isFinite(uid)) where.userId = uid;
    }
    if (guestId) where.guestId = guestId;

    if (email) {
      const u = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true },
      });
      if (u) where.userId = u.id;
      else if (!userId && !guestId) {
        return NextResponse.json({
          attempts: [],
          pagination: { page: 1, pageSize, total: 0, totalPages: 0 },
        });
      }
    }

    const skip = (page - 1) * pageSize;
    const total = await prisma.hiddenAlbumAttempt.count({ where });

    const attempts = await prisma.hiddenAlbumAttempt.findMany({
      where,
      include: {
        album: { select: { id: true, title: true, publicSlug: true } },
        grant: { select: { id: true, allowedCount: true, expiresAt: true, isRevoked: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });

    const userIds = [...new Set(attempts.map((a) => a.userId).filter(Boolean))] as number[];
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true, name: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const items = attempts.map((a) => ({
      id: a.id,
      albumId: a.albumId,
      album: a.album,
      createdAt: a.createdAt.toISOString(),
      userId: a.userId,
      guestId: a.guestId,
      user: a.userId ? userMap.get(a.userId) ?? null : null,
      qrSessionId: a.qrSessionId,
      ipHash: a.ipHash,
      userAgent: a.userAgent,
      deviceType: a.deviceType,
      result: a.result,
      errorCode: a.errorCode,
      errorMessage: a.errorMessage,
      facesInSelfieCount: a.facesInSelfieCount,
      bestMatchConfidence: a.bestMatchConfidence,
      photosNoFaceCount: a.photosNoFaceCount,
      photosMatchedCount: a.photosMatchedCount,
      photosVisibleTotal: a.photosVisibleTotal,
      grant: a.grant,
      selfieStored: a.selfieStored,
      selfieExpiresAt: a.selfieExpiresAt?.toISOString() ?? null,
      durationMs: a.durationMs,
    }));

    return NextResponse.json({
      attempts: items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 0,
      },
    });
  } catch (err: any) {
    console.error("Error listando intentos hidden album:", err);
    return NextResponse.json(
      { error: "Error al listar intentos" },
      { status: 500 }
    );
  }
}
