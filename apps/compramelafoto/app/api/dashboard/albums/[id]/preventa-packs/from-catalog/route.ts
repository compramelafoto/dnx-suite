import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { findAlbumOwnedByUser } from "@/lib/preventa-canjeable/dashboard-pack-helpers";
import {
  CreatePreventaPackFromCatalogError,
  createPreventaPackFromCatalog,
} from "@/lib/preventa-canjeable/create-preventa-pack-from-catalog";
import {
  clientTotalFromPhotographerBaseArs,
  resolveClientMarketplaceFeePercent,
} from "@/lib/pricing/client-price";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveAlbumId(params: Promise<{ id: string }>) {
  const albumId = parseInt((await params).id, 10);
  if (!Number.isInteger(albumId)) return null;
  return albumId;
}

/**
 * POST /api/dashboard/albums/[id]/preventa-packs/from-catalog
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
    }

    const catalogProductIdRaw = body.catalogProductId;
    const catalogProductId =
      typeof catalogProductIdRaw === "number"
        ? catalogProductIdRaw
        : parseInt(String(catalogProductIdRaw ?? ""), 10);
    if (!Number.isInteger(catalogProductId) || catalogProductId <= 0) {
      return NextResponse.json({ error: "catalogProductId inválido" }, { status: 400 });
    }

    const priceRaw = Number(body.price);
    if (!Number.isFinite(priceRaw) || priceRaw < 0) {
      return NextResponse.json({ error: "price debe ser un número >= 0" }, { status: 400 });
    }

    const nameOverride =
      body.nameOverride === undefined || body.nameOverride === null
        ? undefined
        : String(body.nameOverride);
    const descriptionOverride =
      body.descriptionOverride === undefined || body.descriptionOverride === null
        ? undefined
        : String(body.descriptionOverride);

    try {
      const pack = await createPreventaPackFromCatalog({
        albumId,
        userId: user.id,
        catalogProductId,
        priceClientArs: priceRaw,
        nameOverride,
        descriptionOverride,
      });

      const albumPricing = await prisma.album.findUnique({
        where: { id: albumId },
        select: { selectedLabId: true },
      });
      const platformFeePercent = await resolveClientMarketplaceFeePercent({
        photographerId: user.id,
        labId: albumPricing?.selectedLabId ?? null,
      });

      return NextResponse.json({
        pack: {
          ...pack,
          priceFinalClientArs: clientTotalFromPhotographerBaseArs(
            pack.priceClientArs,
            platformFeePercent
          ),
        },
        platformFeePercent,
      });
    } catch (e) {
      if (e instanceof CreatePreventaPackFromCatalogError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }
  } catch (e) {
    console.error("preventa-packs from-catalog:", e);
    return NextResponse.json({ error: "Error al importar desde catálogo" }, { status: 500 });
  }
}
