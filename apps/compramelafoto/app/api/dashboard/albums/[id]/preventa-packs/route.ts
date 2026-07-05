import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import {
  createPackDefinition,
  getNextDisplayOrderForAlbum,
  listPackDefinitionsByAlbum,
} from "@/lib/preventa-canjeable/pack-service";
import {
  findAlbumOwnedByUser,
  parseOptionalIsoDate,
} from "@/lib/preventa-canjeable/dashboard-pack-helpers";
import {
  clientTotalFromPhotographerBaseArs,
  resolveClientMarketplaceFeePercent,
} from "@/lib/pricing/client-price";
import { PACK_EMPTY_ACTIVATION_MESSAGE } from "@/lib/preventa-canjeable/pack-activation";
import { parsePackAvailabilityPhaseFromRequest } from "@/lib/preventa-canjeable/pack-availability-phase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveAlbumId(params: { id: string } | Promise<{ id: string }>) {
  const albumId = parseInt((await params).id, 10);
  if (!Number.isInteger(albumId)) return { albumId: null as number | null };
  return { albumId };
}

/**
 * GET /api/dashboard/albums/[id]/preventa-packs
 * Lista packs del álbum (activos e inactivos) con beneficios por sortOrder asc.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
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
      priceFinalClientArs: clientTotalFromPhotographerBaseArs(p.priceClientArs, platformFeePercent),
    }));
    return NextResponse.json({ packs: packsOut, platformFeePercent });
  } catch (e) {
    console.error("preventa-packs GET:", e);
    return NextResponse.json({ error: "Error al listar packs" }, { status: 500 });
  }
}

/**
 * POST /api/dashboard/albums/[id]/preventa-packs
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
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

    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "name es requerido" }, { status: 400 });
    }

    const priceRaw = Number(body?.priceClientArs);
    if (!Number.isFinite(priceRaw) || priceRaw < 0) {
      return NextResponse.json(
        { error: "priceClientArs debe ser un número >= 0" },
        { status: 400 }
      );
    }

    let validFrom: Date | null | undefined;
    let validUntil: Date | null | undefined;
    let redemptionDeadlineAt: Date | null | undefined;
    try {
      validFrom = parseOptionalIsoDate(body?.validFrom);
      validUntil = parseOptionalIsoDate(body?.validUntil);
      redemptionDeadlineAt = parseOptionalIsoDate(body?.redemptionDeadlineAt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fecha inválida";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const description =
      body?.description === undefined || body?.description === null
        ? null
        : String(body.description).trim() || null;

    const requestedActive =
      body?.isActive === undefined ? false : Boolean(body.isActive);
    if (requestedActive) {
      return NextResponse.json(
        { error: PACK_EMPTY_ACTIVATION_MESSAGE, code: "pack_empty" },
        { status: 400 }
      );
    }
    const isActive = false;

    const displayOrder = await getNextDisplayOrderForAlbum(albumId);

    const currency =
      typeof body?.currency === "string" && body.currency.trim()
        ? body.currency.trim().slice(0, 16)
        : "ARS";

    const phaseResult = parsePackAvailabilityPhaseFromRequest(
      body?.availabilityPhase,
      album.mode
    );
    if ("error" in phaseResult) {
      return NextResponse.json({ error: phaseResult.error }, { status: 400 });
    }

    const pack = await createPackDefinition({
      albumId,
      name,
      description,
      priceClientArs: priceRaw,
      isActive,
      displayOrder,
      availabilityPhase: phaseResult.phase,
      albumMode: album.mode,
      validFrom: validFrom === undefined ? null : validFrom,
      validUntil: validUntil === undefined ? null : validUntil,
      redemptionDeadlineAt:
        redemptionDeadlineAt === undefined ? null : redemptionDeadlineAt,
      currency,
    });

    return NextResponse.json({ pack });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al crear";
    console.error("preventa-packs POST:", e);
    return NextResponse.json(
      { error: "Error al crear pack", detail: message },
      { status: 500 }
    );
  }
}
