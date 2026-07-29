import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import {
  deleteBenefitDefinition,
  getBenefitDefinitionById,
  packBelongsToAlbum,
  updateBenefitDefinition,
  type UpdateBenefitInput,
} from "@/lib/preventa-canjeable/pack-service";
import { findAlbumOwnedByUser } from "@/lib/preventa-canjeable/dashboard-pack-helpers";
import {
  parseBenefitBodyPatch,
  validateBenefitPatch,
} from "@/lib/preventa-canjeable/preventa-pack-benefit-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = {
  params:
    | Promise<{ id: string; packId: string; benefitId: string }>;
};

async function parseIds(params: RouteParams["params"]) {
  const p = await params;
  const albumId = parseInt(p.id, 10);
  const packId = parseInt(p.packId, 10);
  const benefitId = parseInt(p.benefitId, 10);
  if (
    !Number.isInteger(albumId) ||
    !Number.isInteger(packId) ||
    !Number.isInteger(benefitId)
  ) {
    return {
      albumId: null as number | null,
      packId: null as number | null,
      benefitId: null as number | null,
    };
  }
  return { albumId, packId, benefitId };
}

/**
 * PATCH /api/dashboard/albums/[id]/preventa-packs/[packId]/benefits/[benefitId]
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { albumId, packId, benefitId } = await parseIds(params);
    if (albumId == null || packId == null || benefitId == null) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const album = await findAlbumOwnedByUser(albumId, user.id);
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const packOk = await packBelongsToAlbum(packId, albumId);
    if (!packOk) {
      return NextResponse.json({ error: "Pack no encontrado" }, { status: 404 });
    }

    let existing;
    try {
      existing = await getBenefitDefinitionById(packId, benefitId);
    } catch {
      return NextResponse.json({ error: "Beneficio no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    let patch;
    try {
      patch = parseBenefitBodyPatch(body);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Body inválido";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    try {
      await validateBenefitPatch(albumId, user.id, existing, patch);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Validación fallida";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const data: UpdateBenefitInput = patch;

    try {
      const benefit = await updateBenefitDefinition(benefitId, packId, data);
      return NextResponse.json({ benefit });
    } catch (e) {
      console.error("preventa-packs benefit PATCH prisma:", e);
      return NextResponse.json({ error: "No se pudo actualizar el beneficio" }, { status: 500 });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al actualizar";
    console.error("preventa-packs benefit PATCH:", e);
    return NextResponse.json(
      { error: "Error al actualizar beneficio", detail: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dashboard/albums/[id]/preventa-packs/[packId]/benefits/[benefitId]
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { albumId, packId, benefitId } = await parseIds(params);
    if (albumId == null || packId == null || benefitId == null) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const album = await findAlbumOwnedByUser(albumId, user.id);
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const packOkDel = await packBelongsToAlbum(packId, albumId);
    if (!packOkDel) {
      return NextResponse.json({ error: "Pack no encontrado" }, { status: 404 });
    }

    try {
      await deleteBenefitDefinition(benefitId, packId);
      return NextResponse.json({ ok: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("Beneficio no encontrado")) {
        return NextResponse.json({ error: "Beneficio no encontrado" }, { status: 404 });
      }
      throw e;
    }
  } catch (e) {
    console.error("preventa-packs benefit DELETE:", e);
    return NextResponse.json({ error: "Error al eliminar beneficio" }, { status: 500 });
  }
}
