import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import {
  AlbumPackSelectionRuleError,
  isAlbumPackAllPhotosSelection,
  validateAlbumPackSelectionInput,
} from "@/lib/album-packs/album-pack-selection-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = Promise<{ sessionId: string }>;

function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
}

function getAccessGuestToken(req: NextRequest): string | null {
  const fromHeader = req.headers.get("x-guest-token");
  if (fromHeader && fromHeader.trim()) return fromHeader.trim();
  const fromQuery = req.nextUrl.searchParams.get("guestToken");
  return fromQuery && fromQuery.trim() ? fromQuery.trim() : null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const p = await params;
    const sessionId = String(p.sessionId ?? "").trim();
    if (!sessionId) {
      throw new AlbumPackSelectionRuleError("sessionId inválido.", "SESSION_ID_INVALID");
    }

    const session = await prisma.albumPackSelectionSession.findUnique({
      where: { id: sessionId },
      include: {
        albumPack: true,
        photos: { select: { photoId: true } },
      },
    });
    if (!session) {
      throw new AlbumPackSelectionRuleError("Sesión no encontrada.", "SESSION_NOT_FOUND");
    }

    const authUser = await getAuthUser();
    const guestToken = getAccessGuestToken(req);
    const ownerByEmail =
      !!authUser?.email &&
      normalizeEmail(authUser.email) &&
      normalizeEmail(authUser.email) === normalizeEmail(session.buyerEmail);
    if (session.guestToken && session.guestToken !== guestToken && !ownerByEmail) {
      throw new AlbumPackSelectionRuleError(
        "No autorizado para marcar esta sesión como READY.",
        "SESSION_ACCESS_DENIED"
      );
    }

    const countMode = isAlbumPackAllPhotosSelection(session.albumPack) ? "max" : "exact";
    await validateAlbumPackSelectionInput({
      albumId: session.albumId,
      albumPackId: session.albumPackId,
      photoIds: session.photos.map((row) => row.photoId),
      countMode,
    });

    const updated = await prisma.albumPackSelectionSession.update({
      where: { id: session.id },
      data: { status: "READY" },
      include: {
        albumPack: true,
        photos: {
          include: { photo: { select: { id: true, previewUrl: true, originalKey: true } } },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    return NextResponse.json({ session: updated });
  } catch (err) {
    if (err instanceof AlbumPackSelectionRuleError) {
      const status = err.code === "SESSION_NOT_FOUND" ? 404 : err.code === "SESSION_ACCESS_DENIED" ? 403 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error("POST /api/album-pack-selections/[sessionId]/mark-ready", err);
    return NextResponse.json(
      { error: "Error al marcar la sesión como READY." },
      { status: 500 }
    );
  }
}
