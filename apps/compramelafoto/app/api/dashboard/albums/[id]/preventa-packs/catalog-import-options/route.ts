import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { findAlbumOwnedByUser } from "@/lib/preventa-canjeable/dashboard-pack-helpers";
import { isGlobalProductsCatalogPhase1Enabled } from "@/lib/catalog-products/feature-flag";
import { loadCatalogImportOptions } from "@/lib/preventa-canjeable/load-catalog-import-options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveAlbumId(params: Promise<{ id: string }>) {
  const albumId = parseInt((await params).id, 10);
  if (!Number.isInteger(albumId)) return null;
  return albumId;
}

/**
 * GET /api/dashboard/albums/[id]/preventa-packs/catalog-import-options
 * Productos compatibles con el bridge preventa (CatalogProduct + componentes).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isGlobalProductsCatalogPhase1Enabled()) {
    return NextResponse.json({ error: "Catálogo de productos no disponible." }, { status: 404 });
  }

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

    const options = await loadCatalogImportOptions(user.id, albumId);
    const compatibleCount =
      options.photographerProducts.length +
      options.systemFromCatalog.length +
      options.systemTemplates.length;

    return NextResponse.json({
      ...options,
      compatibleCount,
    });
  } catch (e) {
    console.error("catalog-import-options GET:", e);
    return NextResponse.json({ error: "Error al cargar opciones de importación" }, { status: 500 });
  }
}
