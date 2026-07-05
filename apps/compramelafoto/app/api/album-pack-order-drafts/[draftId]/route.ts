import { NextRequest, NextResponse } from "next/server";
import { AlbumPackOrderDraftStatus } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { draftId: string } | Promise<{ draftId: string }>;

function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
}

function getAccessGuestToken(req: NextRequest): string | null {
  const fromHeader = req.headers.get("x-guest-token");
  if (fromHeader && fromHeader.trim()) return fromHeader.trim();
  const fromQuery = req.nextUrl.searchParams.get("guestToken");
  return fromQuery && fromQuery.trim() ? fromQuery.trim() : null;
}

async function resolveDraft(params: RouteParams) {
  const p = await params;
  const draftId = String(p.draftId ?? "").trim();
  if (!draftId) {
    return null;
  }

  return prisma.albumPackOrderDraft.findUnique({
    where: { id: draftId },
    include: {
      albumPack: {
        select: {
          id: true,
          albumId: true,
          name: true,
          description: true,
          price: true,
          includedPhotoCount: true,
          requiresSelection: true,
          requiresDesign: true,
          isActive: true,
        },
      },
      selectionSession: {
        include: {
          photos: {
            include: {
              photo: {
                select: {
                  id: true,
                  albumId: true,
                  previewUrl: true,
                  originalKey: true,
                },
              },
            },
            orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: RouteParams }) {
  try {
    const draft = await resolveDraft(params);
    if (!draft) {
      return NextResponse.json(
        { error: "Draft no encontrado.", code: "DRAFT_NOT_FOUND" },
        { status: 404 }
      );
    }

    const authUser = await getAuthUser();
    const guestToken = getAccessGuestToken(req);
    const ownerByEmail =
      !!authUser?.email &&
      normalizeEmail(authUser.email) &&
      normalizeEmail(authUser.email) === normalizeEmail(draft.buyerEmail);

    if (draft.guestToken && draft.guestToken !== guestToken && !ownerByEmail) {
      return NextResponse.json(
        { error: "No autorizado para acceder a este draft.", code: "DRAFT_ACCESS_DENIED" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      draft: {
        id: draft.id,
        status: draft.status,
        totalCents: draft.totalCents,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
        expiresAt: draft.expiresAt,
        selectionSessionId: draft.selectionSessionId,
        buyer: {
          email: draft.buyerEmail,
          name: draft.buyerName,
          phone: draft.buyerPhone,
        },
      },
      pack: draft.albumPack,
      selectedPhotos: draft.selectionSession.photos.map((row) => ({
        id: row.photo.id,
        previewUrl: row.photo.previewUrl,
        originalKey: row.photo.originalKey,
        position: row.position,
        role: row.role,
      })),
    });
  } catch (err) {
    console.error("GET /api/album-pack-order-drafts/[draftId]", err);
    return NextResponse.json({ error: "Error al cargar draft de pack." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: RouteParams }) {
  try {
    const draft = await resolveDraft(params);
    if (!draft) {
      return NextResponse.json(
        { error: "Draft no encontrado.", code: "DRAFT_NOT_FOUND" },
        { status: 404 }
      );
    }

    const authUser = await getAuthUser();
    const guestToken = getAccessGuestToken(req);
    const ownerByEmail =
      !!authUser?.email &&
      normalizeEmail(authUser.email) &&
      normalizeEmail(authUser.email) === normalizeEmail(draft.buyerEmail);

    if (draft.guestToken && draft.guestToken !== guestToken && !ownerByEmail) {
      return NextResponse.json(
        { error: "No autorizado para eliminar este pack.", code: "DRAFT_ACCESS_DENIED" },
        { status: 403 }
      );
    }

    if (draft.status !== AlbumPackOrderDraftStatus.DRAFT) {
      return NextResponse.json(
        { error: "Este pack ya no se puede eliminar.", code: "DRAFT_STATUS_INVALID" },
        { status: 400 }
      );
    }

    await prisma.albumPackOrderDraft.update({
      where: { id: draft.id },
      data: { status: AlbumPackOrderDraftStatus.CANCELLED },
    });

    return NextResponse.json({ ok: true, draftId: draft.id });
  } catch (err) {
    console.error("DELETE /api/album-pack-order-drafts/[draftId]", err);
    return NextResponse.json({ error: "Error al eliminar el pack preparado." }, { status: 500 });
  }
}
