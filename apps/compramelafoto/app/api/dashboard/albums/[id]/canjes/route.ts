import { NextResponse } from "next/server";
import { listAlbumVouchers } from "@/lib/canje-externo/album-vouchers";
import { requireAlbumOwnerOrAdmin } from "@/lib/canje-externo/require-album-owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/dashboard/albums/[id]/canjes — combos cobrados por fuera y su estado. */
export async function GET(_request: Request, { params }: { params: Promise<{ id?: string }> }) {
  const { id } = await params;
  const access = await requireAlbumOwnerOrAdmin(id);
  if (!access.ok) return access.response;
  const combos = await listAlbumVouchers(access.albumId);
  return NextResponse.json({ combos });
}
