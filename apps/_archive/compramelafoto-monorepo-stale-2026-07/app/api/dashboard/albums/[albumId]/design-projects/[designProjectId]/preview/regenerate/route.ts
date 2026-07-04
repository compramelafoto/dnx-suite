import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { enqueueDesignPreviewJob } from "@/lib/school-design/preview-jobs";
import { getOwnedDesignProject } from "@/lib/school-design/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — Encola job de preview (regenerate-preview).
 */
export async function POST(
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
    if (!dp?.currentRevisionId) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const res = await enqueueDesignPreviewJob({
      designProjectId: dp.id,
      designRevisionId: dp.currentRevisionId,
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Ya hay un render en curso", code: res.code }, { status: 409 });
    }

    return NextResponse.json({ previewVersion: res.previewVersion });
  } catch (e) {
    console.error("[school_design_preview] regenerate POST", e);
    return NextResponse.json({ error: "Error al encolar preview" }, { status: 500 });
  }
}
