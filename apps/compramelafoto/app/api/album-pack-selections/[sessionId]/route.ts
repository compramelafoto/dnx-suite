import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import {
  AlbumPackSelectionRuleError,
  validateAlbumPackSelectionInput,
} from "@/lib/album-packs/album-pack-selection-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { sessionId: string } | Promise<{ sessionId: string }>;

function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
}

function getAccessGuestToken(req: NextRequest): string | null {
  const fromHeader = req.headers.get("x-guest-token");
  if (fromHeader && fromHeader.trim()) return fromHeader.trim();
  const fromQuery = req.nextUrl.searchParams.get("guestToken");
  return fromQuery && fromQuery.trim() ? fromQuery.trim() : null;
}

async function resolveSession(params: RouteParams) {
  const p = await params;
  const sessionId = String(p.sessionId ?? "").trim();
  if (!sessionId) {
    throw new AlbumPackSelectionRuleError("sessionId inválido.", "SESSION_ID_INVALID");
  }
  const session = await prisma.albumPackSelectionSession.findUnique({
    where: { id: sessionId },
    include: {
      albumPack: true,
      photos: {
        include: { photo: { select: { id: true, albumId: true, previewUrl: true, originalKey: true } } },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!session) {
    throw new AlbumPackSelectionRuleError("Sesión no encontrada.", "SESSION_NOT_FOUND");
  }
  return session;
}

async function ensureSessionAccess(req: NextRequest, session: Awaited<ReturnType<typeof resolveSession>>) {
  const guestToken = getAccessGuestToken(req);
  const authUser = await getAuthUser();
  const ownerByEmail =
    !!authUser?.email &&
    normalizeEmail(authUser.email) &&
    normalizeEmail(authUser.email) === normalizeEmail(session.buyerEmail);

  if (session.guestToken && guestToken !== session.guestToken && !ownerByEmail) {
    throw new AlbumPackSelectionRuleError(
      "No autorizado para acceder a esta sesión.",
      "SESSION_ACCESS_DENIED"
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const session = await resolveSession(params);
    await ensureSessionAccess(req, session);
    return NextResponse.json({ session });
  } catch (err) {
    if (err instanceof AlbumPackSelectionRuleError) {
      const status = err.code === "SESSION_NOT_FOUND" ? 404 : err.code === "SESSION_ACCESS_DENIED" ? 403 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error("GET /api/album-pack-selections/[sessionId]", err);
    return NextResponse.json({ error: "Error al cargar sesión." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const session = await resolveSession(params);
    await ensureSessionAccess(req, session);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const photoIdsRaw = body.photoIds;
    const shouldUpdatePhotos = Array.isArray(photoIdsRaw);
    const buyerEmail =
      body.buyerEmail == null || String(body.buyerEmail).trim() === ""
        ? null
        : String(body.buyerEmail).trim().toLowerCase();
    const buyerName =
      body.buyerName == null || String(body.buyerName).trim() === ""
        ? null
        : String(body.buyerName).trim();
    const buyerPhone =
      body.buyerPhone == null || String(body.buyerPhone).trim() === ""
        ? null
        : String(body.buyerPhone).trim();

    let nextPhotoIds: number[] = session.photos.map((row) => row.photoId);
    if (shouldUpdatePhotos) {
      const validated = await validateAlbumPackSelectionInput({
        albumId: session.albumId,
        albumPackId: session.albumPackId,
        photoIds: (photoIdsRaw as unknown[]).map((id) => Number(id)),
        countMode: "max",
      });
      nextPhotoIds = validated.photoIds;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedSession = await tx.albumPackSelectionSession.update({
        where: { id: session.id },
        data: {
          buyerEmail,
          buyerName,
          buyerPhone,
          status: "DRAFT",
        },
      });

      if (shouldUpdatePhotos) {
        await tx.albumPackSelectionPhoto.deleteMany({
          where: { sessionId: session.id },
        });
        if (nextPhotoIds.length > 0) {
          await tx.albumPackSelectionPhoto.createMany({
            data: nextPhotoIds.map((photoId, idx) => ({
              sessionId: session.id,
              photoId,
              position: idx,
            })),
          });
        }
      }

      return updatedSession;
    });

    const reloaded = await prisma.albumPackSelectionSession.findUnique({
      where: { id: updated.id },
      include: {
        albumPack: true,
        photos: {
          include: { photo: { select: { id: true, previewUrl: true, originalKey: true } } },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    return NextResponse.json({ session: reloaded });
  } catch (err) {
    if (err instanceof AlbumPackSelectionRuleError) {
      const status = err.code === "SESSION_NOT_FOUND" ? 404 : err.code === "SESSION_ACCESS_DENIED" ? 403 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error("PATCH /api/album-pack-selections/[sessionId]", err);
    return NextResponse.json({ error: "Error al actualizar sesión." }, { status: 500 });
  }
}
