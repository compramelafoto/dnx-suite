import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import {
  AlbumPackDraftToOrderError,
  convertAlbumPackDraftsToOrder,
} from "@/lib/album-packs/convert-album-pack-drafts-to-order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAccessGuestToken(req: NextRequest): string | null {
  const fromHeader = req.headers.get("x-guest-token");
  if (fromHeader && fromHeader.trim()) return fromHeader.trim();
  const fromQuery = req.nextUrl.searchParams.get("guestToken");
  return fromQuery && fromQuery.trim() ? fromQuery.trim() : null;
}

function parseDraftIds(body: unknown): string[] {
  const payload = (body ?? {}) as Record<string, unknown>;
  const raw = payload.draftIds;
  if (!Array.isArray(raw)) return [];
  return raw.map((id) => String(id ?? "").trim()).filter((id) => id.length > 0);
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser();
    const guestToken = getAccessGuestToken(req);
    const body = await req.json().catch(() => ({}));
    const payload = (body ?? {}) as Record<string, unknown>;
    const draftIds = parseDraftIds(body);

    const result = await convertAlbumPackDraftsToOrder({
      draftIds,
      guestToken,
      actorEmail: authUser?.email ?? null,
      buyerEmail:
        payload.buyerEmail == null ? null : String(payload.buyerEmail),
      buyerName:
        payload.buyerName == null ? null : String(payload.buyerName),
      buyerPhone:
        payload.buyerPhone == null ? null : String(payload.buyerPhone),
    });

    return NextResponse.json(
      {
        orderId: result.order.id,
        summary: {
          orderId: result.order.id,
          albumId: result.order.albumId,
          buyerEmail: result.order.buyerEmail,
          buyerName: result.order.buyerName,
          buyerPhone: result.order.buyerPhone,
          status: result.order.status,
          totalCents: result.order.totalCents,
          origin: result.order.origin,
          checkoutPaymentSource: result.order.checkoutPaymentSource,
          packName: result.packName,
          photoCount: result.photoIds.length,
          photoIds: result.photoIds,
          draftStatus: result.draftStatus,
          draftIds: result.draftIds,
          reused: result.reused,
          createdAt: result.order.createdAt,
        },
      },
      { status: result.reused ? 200 : 201 }
    );
  } catch (err) {
    if (err instanceof AlbumPackDraftToOrderError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    console.error("POST /api/album-pack-order-drafts/create-combined-order", err);
    return NextResponse.json(
      { error: "Error al crear Order desde los packs preparados." },
      { status: 500 }
    );
  }
}
