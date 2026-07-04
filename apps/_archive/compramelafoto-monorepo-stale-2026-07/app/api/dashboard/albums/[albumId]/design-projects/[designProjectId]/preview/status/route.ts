import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { getOwnedDesignProject } from "@/lib/school-design/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — Estado de preview para polling. `updatedAt: null` (paridad legacy / sin campo en modelo).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ albumId: string; designProjectId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { albumId: aid, designProjectId: dpid } = await params;
    const albumId = parseInt(aid, 10);
    const designProjectId = parseInt(dpid, 10);
    if (!Number.isInteger(albumId) || !Number.isInteger(designProjectId)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    const dp = await getOwnedDesignProject(albumId, designProjectId, user.id);
    if (!dp) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    console.log("[school_design_preview_poll]", { designProjectId: dp.id, previewStatus: dp.previewStatus });

    return NextResponse.json({
      previewStatus: dp.previewStatus,
      previewVersion: dp.previewVersion,
      previewUrl: dp.previewUrl,
      previewDirty: dp.previewDirty,
      previewError: dp.previewError,
      previewGeneratedAt: dp.previewGeneratedAt,
      updatedAt: null,
    });
  } catch (e) {
    console.error("[school_design_preview_poll] GET", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
