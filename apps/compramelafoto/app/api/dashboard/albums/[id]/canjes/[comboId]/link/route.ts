import { NextRequest, NextResponse } from "next/server";
import { createVoucherShareLink } from "@/lib/canje-externo/album-vouchers";
import { requireAlbumOwnerOrAdmin } from "@/lib/canje-externo/require-album-owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/dashboard/albums/[id]/canjes/[comboId]/link — link nuevo para una familia, con
 * el mensaje y la dirección de WhatsApp listos. POST porque crea un link.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id?: string; comboId?: string }> }
) {
  const { id, comboId } = await params;
  const access = await requireAlbumOwnerOrAdmin(id);
  if (!access.ok) return access.response;
  const combo = Number.parseInt(String(comboId ?? ""), 10);
  if (!Number.isFinite(combo) || combo <= 0) {
    return NextResponse.json({ error: "Combo inválido" }, { status: 400 });
  }
  const baseUrl = process.env.APP_URL || request.nextUrl.origin;
  const share = await createVoucherShareLink({ albumId: access.albumId, comboId: combo, baseUrl });
  if (!share) return NextResponse.json({ error: "No encontramos ese combo" }, { status: 404 });
  return NextResponse.json(share);
}
