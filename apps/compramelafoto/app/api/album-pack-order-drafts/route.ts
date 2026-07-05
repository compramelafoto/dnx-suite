import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import {
  AlbumPackOrderDraftBuildError,
  buildAlbumPackDraft,
} from "@/lib/album-packs/build-album-pack-draft";
import { resolveAlbumOrderDigitalMarketplaceFeePercent } from "@/lib/pricing/album-order-digital-fee";
import { albumPackClientPriceArs } from "@/lib/album-packs/album-pack-client-price";
import { resolveAlbumExtensionSalesPricing } from "@/lib/pricing/album-extension-surcharge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
}

function getAccessGuestToken(req: NextRequest, body: unknown): string | null {
  const fromHeader = req.headers.get("x-guest-token");
  if (fromHeader && fromHeader.trim()) return fromHeader.trim();
  const payload = (body ?? {}) as Record<string, unknown>;
  const fromBody = payload.guestToken;
  if (fromBody != null && String(fromBody).trim()) return String(fromBody).trim();
  return null;
}

function parseSessionId(body: unknown): string {
  const payload = (body ?? {}) as Record<string, unknown>;
  const sessionId = String(payload.sessionId ?? "").trim();
  if (!sessionId) {
    throw new AlbumPackOrderDraftBuildError("sessionId es obligatorio.", "SESSION_ID_REQUIRED");
  }
  return sessionId;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = parseSessionId(body);
    const authUser = await getAuthUser();
    const guestToken = getAccessGuestToken(req, body);

    const session = await prisma.albumPackSelectionSession.findUnique({
      where: { id: sessionId },
      include: {
        albumPack: {
          select: {
            id: true,
            albumId: true,
            name: true,
            price: true,
            includedPhotoCount: true,
            requiresSelection: true,
            requiresDesign: true,
            isActive: true,
          },
        },
        photos: {
          select: { photoId: true, position: true },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Sesión de selección no encontrada.", code: "SESSION_NOT_FOUND" },
        { status: 404 }
      );
    }

    const ownerByEmail =
      !!authUser?.email &&
      normalizeEmail(authUser.email) &&
      normalizeEmail(authUser.email) === normalizeEmail(session.buyerEmail);

    if (session.guestToken && session.guestToken !== guestToken && !ownerByEmail) {
      return NextResponse.json(
        { error: "No autorizado para usar esta sesión.", code: "SESSION_ACCESS_DENIED" },
        { status: 403 }
      );
    }

    const album = await prisma.album.findUnique({
      where: { id: session.albumId },
      select: {
        userId: true,
        selectedLabId: true,
        firstPhotoDate: true,
        createdAt: true,
        expirationExtensionDays: true,
      },
    });
    const platformFeePercent = await resolveAlbumOrderDigitalMarketplaceFeePercent({
      photographerId: album?.userId ?? null,
      labId: album?.selectedLabId ?? null,
    });
    const packClientSubtotalArs = albumPackClientPriceArs(
      session.albumPack.price,
      platformFeePercent
    );
    const extensionPricing = album
      ? await resolveAlbumExtensionSalesPricing({
          album,
          clientSubtotalArs: packClientSubtotalArs,
          prismaClient: prisma,
        })
      : null;

    const draftData = buildAlbumPackDraft({
      pack: session.albumPack,
      session,
      platformFeePercent,
      extensionPricingActive: extensionPricing?.active ?? false,
      extensionSurchargeArs: extensionPricing?.extensionSurchargeArs ?? 0,
    });

    const created = await prisma.albumPackOrderDraft.create({
      data: draftData,
      include: {
        albumPack: {
          select: {
            id: true,
            name: true,
            price: true,
            includedPhotoCount: true,
            requiresSelection: true,
            requiresDesign: true,
          },
        },
      },
    });

    const photoCount = session.photos.length;
    return NextResponse.json(
      {
        draftId: created.id,
        summary: {
          status: created.status,
          totalCents: created.totalCents,
          photoCount,
          pack: created.albumPack,
          selectionSessionId: created.selectionSessionId,
          createdAt: created.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof AlbumPackOrderDraftBuildError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    console.error("POST /api/album-pack-order-drafts", err);
    return NextResponse.json(
      { error: "Error al crear borrador interno de pack." },
      { status: 500 }
    );
  }
}
