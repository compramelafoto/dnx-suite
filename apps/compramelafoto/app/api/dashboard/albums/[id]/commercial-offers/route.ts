import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { findAlbumOwnedByUser } from "@/lib/preventa-canjeable/dashboard-pack-helpers";
import { loadAlbumCommercialOffers } from "@/lib/commercial/album-commercial-offer";
import { isAlbumCommercialUnifiedUiEnabled } from "@/lib/commercial/album-commercial-unified-ui-feature-flag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveAlbumId(params: { id: string } | Promise<{ id: string }>) {
  const albumId = parseInt((await params).id, 10);
  if (!Number.isInteger(albumId)) return { albumId: null as number | null };
  return { albumId };
}

/**
 * GET /api/dashboard/albums/[id]/commercial-offers
 * Vista comercial unificada (read-only). Requiere ALBUM_COMMERCIAL_UNIFIED_UI.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    if (!isAlbumCommercialUnifiedUiEnabled()) {
      return NextResponse.json({ error: "Función no habilitada" }, { status: 404 });
    }

    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { albumId } = await resolveAlbumId(params);
    if (albumId == null) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const album = await findAlbumOwnedByUser(albumId, user.id);
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const offers = await loadAlbumCommercialOffers(albumId);
    return NextResponse.json({ offers });
  } catch (e) {
    console.error("commercial-offers GET:", e);
    return NextResponse.json({ error: "Error al cargar ofertas comerciales" }, { status: 500 });
  }
}
