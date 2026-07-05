import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import {
  listBenefitsForPack,
  reorderBenefitDefinitionsInPack,
} from "@/lib/preventa-canjeable/pack-service";
import { findAlbumOwnedByUser } from "@/lib/preventa-canjeable/dashboard-pack-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = {
  params: { id: string; packId: string } | Promise<{ id: string; packId: string }>;
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

function parseBenefitIds(body: unknown): number[] | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as Record<string, unknown>).benefitIds;
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
 * PATCH /api/dashboard/albums/[id]/preventa-packs/[packId]/benefits/reorder
 * Body: { benefitIds: number[] }
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
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

    const body = await req.json().catch(() => null);
    const benefitIds = parseBenefitIds(body);
    if (!benefitIds || benefitIds.length === 0) {
      return NextResponse.json({ error: "benefitIds es requerido" }, { status: 400 });
    }

    try {
      await reorderBenefitDefinitionsInPack(packId, albumId, benefitIds);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo reordenar";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const benefits = await listBenefitsForPack(packId, albumId);
    return NextResponse.json({ ok: true, benefits: benefits ?? [] });
  } catch (e) {
    console.error("preventa-packs benefits reorder:", e);
    return NextResponse.json({ error: "Error al reordenar beneficios" }, { status: 500 });
  }
}
