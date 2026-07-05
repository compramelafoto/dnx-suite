import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import {
  AlbumPackDraftToOrderError,
  convertAlbumPackDraftToOrder,
} from "@/lib/album-packs/convert-draft-to-order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { draftId: string } | Promise<{ draftId: string }>;

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
    const draftId = String(p.draftId ?? "").trim();
    if (!draftId) {
      return NextResponse.json(
        { error: "draftId inválido.", code: "DRAFT_ID_INVALID" },
        { status: 400 }
      );
    }

    const authUser = await getAuthUser();
    const guestToken = getAccessGuestToken(req);
    const body = await req.json().catch(() => ({}));
    const payload = (body ?? {}) as Record<string, unknown>;

    const result = await convertAlbumPackDraftToOrder({
      draftId,
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
    console.error("POST /api/album-pack-order-drafts/[draftId]/create-order", err);
    return NextResponse.json(
      { error: "Error al crear Order desde draft." },
      { status: 500 }
    );
  }
}
