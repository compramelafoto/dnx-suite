import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import {
  listPackDefinitionsByAlbum,
  reorderPackDefinitionsInAlbum,
} from "@/lib/preventa-canjeable/pack-service";
import { findAlbumOwnedByUser } from "@/lib/preventa-canjeable/dashboard-pack-helpers";
import {
  clientTotalFromPhotographerBaseArs,
  resolveClientMarketplaceFeePercent,
} from "@/lib/pricing/client-price";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveAlbumId(params: { id: string } | Promise<{ id: string }>) {
  const albumId = parseInt((await params).id, 10);
  if (!Number.isInteger(albumId)) return null;
  return albumId;
}

function parseOrderedIds(body: unknown, field: string): number[] | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as Record<string, unknown>)[field];
  if (!Array.isArray(raw)) return null;
  const ids: number[] = [];
  for (const item of raw) {
    const n = typeof item === "number" ? item : parseInt(String(item), 10);
    if (!Number.isInteger(n) || n <= 0) return null;
    ids.push(n);
  }
  return ids;
}

/**
 * PATCH /api/dashboard/albums/[id]/preventa-packs/reorder
 * Body: { packIds: number[] }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const albumId = await resolveAlbumId(params);
    if (albumId == null) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const album = await findAlbumOwnedByUser(albumId, user.id);
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const packIds = parseOrderedIds(body, "packIds");
    if (!packIds || packIds.length === 0) {
      return NextResponse.json({ error: "packIds es requerido" }, { status: 400 });
    }

    try {
      await reorderPackDefinitionsInAlbum(albumId, packIds);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo reordenar";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const packs = await listPackDefinitionsByAlbum(albumId, { includeInactive: true });
    const albumPricing = await prisma.album.findUnique({
      where: { id: albumId },
      select: { selectedLabId: true },
    });
    const platformFeePercent = await resolveClientMarketplaceFeePercent({
      photographerId: user.id,
      labId: albumPricing?.selectedLabId ?? null,
    });
    const packsOut = packs.map((p) => ({
      ...p,
      priceFinalClientArs: clientTotalFromPhotographerBaseArs(
        p.priceClientArs,
        platformFeePercent
      ),
    }));

    return NextResponse.json({ ok: true, packs: packsOut, platformFeePercent });
  } catch (e) {
    console.error("preventa-packs reorder:", e);
    return NextResponse.json({ error: "Error al reordenar packs" }, { status: 500 });
  }
}
