import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import {
  createBenefitDefinition,
  getNextSortOrderForPack,
  listBenefitsForPack,
  packBelongsToAlbum,
} from "@/lib/preventa-canjeable/pack-service";
import { findAlbumOwnedByUser } from "@/lib/preventa-canjeable/dashboard-pack-helpers";
import {
  assertBenefitBusinessRules,
  parseBenefitBodyCreate,
} from "@/lib/preventa-canjeable/preventa-pack-benefit-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string; packId: string }>;
};

async function parseIds(params: RouteParams["params"]) {
  const p = await params;
  const albumId = parseInt(p.id, 10);
  const packId = parseInt(p.packId, 10);
  if (!Number.isInteger(albumId) || !Number.isInteger(packId)) {
    return { albumId: null as number | null, packId: null as number | null };
  }
  return { albumId, packId };
}

/**
 * GET /api/dashboard/albums/[id]/preventa-packs/[packId]/benefits
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { albumId, packId } = await parseIds(params);
    if (albumId == null || packId == null) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const album = await findAlbumOwnedByUser(albumId, user.id);
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const benefits = await listBenefitsForPack(packId, albumId);
    if (benefits === null) {
      return NextResponse.json({ error: "Pack no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ benefits });
  } catch (e) {
    console.error("preventa-packs benefits GET:", e);
    return NextResponse.json({ error: "Error al listar beneficios" }, { status: 500 });
  }
}

/**
 * POST /api/dashboard/albums/[id]/preventa-packs/[packId]/benefits
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { albumId, packId } = await parseIds(params);
    if (albumId == null || packId == null) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const album = await findAlbumOwnedByUser(albumId, user.id);
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    let parsed;
    try {
      parsed = parseBenefitBodyCreate(body);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Body inválido";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    try {
      await assertBenefitBusinessRules(albumId, user.id, parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Validación fallida";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const packOk = await packBelongsToAlbum(packId, albumId);
    if (!packOk) {
      return NextResponse.json({ error: "Pack no encontrado" }, { status: 404 });
    }

    try {
      const sortOrder = await getNextSortOrderForPack(packId);
      const benefit = await createBenefitDefinition({
        packDefinitionId: packId,
        ...parsed,
        sortOrder,
      });
      return NextResponse.json({ benefit });
    } catch (e: unknown) {
      console.error("preventa-packs benefits POST prisma:", e);
      return NextResponse.json(
        { error: "No se pudo crear el beneficio" },
        { status: 500 }
      );
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al crear";
    console.error("preventa-packs benefits POST:", e);
    return NextResponse.json(
      { error: "Error al crear beneficio", detail: message },
      { status: 500 }
    );
  }
}
