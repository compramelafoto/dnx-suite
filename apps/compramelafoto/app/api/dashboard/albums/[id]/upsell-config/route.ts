import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { findAlbumOwnedByUser } from "@/lib/preventa-canjeable/dashboard-pack-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveAlbumId(params: Promise<{ id: string }>) {
  const albumId = parseInt((await params).id, 10);
  if (!Number.isInteger(albumId)) return { albumId: null as number | null };
  return { albumId };
}

function parseOptionalPrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n));
}

/**
 * GET /api/dashboard/albums/[id]/upsell-config
 * Configuración de upsell por álbum + packs POST_UPLOAD disponibles.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const config = await prisma.albumUpsellConfig.findUnique({
      where: { albumId },
      select: {
        digitalExtraEnabled: true,
        digitalExtraPriceArs: true,
        printExtraEnabled: true,
        printExtraPriceArs: true,
      },
    });
    const packLinks = config
      ? await prisma.albumUpsellPack.findMany({
          where: { albumId },
          select: { packId: true },
        })
      : [];

    const packOptions = await prisma.packDefinition.findMany({
      where: { albumId, availabilityPhase: "POST_UPLOAD" },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: { id: true, name: true, isActive: true, priceClientArs: true },
    });

    return NextResponse.json({
      config: config
        ? {
            digitalExtraEnabled: config.digitalExtraEnabled,
            digitalExtraPriceArs: config.digitalExtraPriceArs,
            printExtraEnabled: config.printExtraEnabled,
            printExtraPriceArs: config.printExtraPriceArs,
            upsellPackIds: packLinks.map((p) => p.packId),
          }
        : null,
      packs: packOptions,
    });
  } catch (e) {
    console.error("upsell-config GET:", e);
    return NextResponse.json({ error: "Error al cargar configuración" }, { status: 500 });
  }
}

/**
 * PUT /api/dashboard/albums/[id]/upsell-config
 * Guarda configuración explícita de extras + packs.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const body = await req.json().catch(() => ({}));
    const digitalExtraEnabled = Boolean(body?.digitalExtraEnabled);
    const printExtraEnabled = Boolean(body?.printExtraEnabled);
    const digitalExtraPriceArs = parseOptionalPrice(body?.digitalExtraPriceArs);
    const printExtraPriceArs = parseOptionalPrice(body?.printExtraPriceArs);
    const upsellPackIdsRaw = Array.isArray(body?.upsellPackIds)
      ? body.upsellPackIds
      : [];
    const upsellPackIds = upsellPackIdsRaw
      .map((id: unknown) => Number(id))
      .filter((id: number) => Number.isInteger(id) && id > 0);

    if (digitalExtraEnabled && !(digitalExtraPriceArs && digitalExtraPriceArs > 0)) {
      return NextResponse.json(
        { error: "Definí un precio válido para foto digital extra." },
        { status: 400 }
      );
    }
    if (printExtraEnabled && !(printExtraPriceArs && printExtraPriceArs > 0)) {
      return NextResponse.json(
        { error: "Definí un precio válido para impresión extra." },
        { status: 400 }
      );
    }

    const allowedPackIds = await prisma.packDefinition.findMany({
      where: {
        albumId,
        availabilityPhase: "POST_UPLOAD",
        isActive: true,
      },
      select: { id: true },
    });
    const allowedSet = new Set(allowedPackIds.map((p) => p.id));
    const invalid = upsellPackIds.filter((id: number) => !allowedSet.has(id));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: "Solo se permiten packs POST_UPLOAD activos." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.albumUpsellConfig.upsert({
        where: { albumId },
        create: {
          albumId,
          digitalExtraEnabled,
          digitalExtraPriceArs: digitalExtraEnabled ? digitalExtraPriceArs : null,
          printExtraEnabled,
          printExtraPriceArs: printExtraEnabled ? printExtraPriceArs : null,
        },
        update: {
          digitalExtraEnabled,
          digitalExtraPriceArs: digitalExtraEnabled ? digitalExtraPriceArs : null,
          printExtraEnabled,
          printExtraPriceArs: printExtraEnabled ? printExtraPriceArs : null,
        },
      });

      await tx.albumUpsellPack.deleteMany({ where: { albumId } });
      if (upsellPackIds.length > 0) {
        await tx.albumUpsellPack.createMany({
          data: upsellPackIds.map((packId: number) => ({ albumId, packId })),
          skipDuplicates: true,
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("upsell-config PUT:", e);
    return NextResponse.json({ error: "Error al guardar configuración" }, { status: 500 });
  }
}
