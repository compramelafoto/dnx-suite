import { NextRequest, NextResponse } from "next/server";
import {
  DesignPreviewStatus,
  DesignProjectStatus,
  Role,
} from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { enqueueDesignExportJob } from "@/lib/school-design/export-jobs";
import { assertNoActiveExportJob } from "@/lib/school-design/review-actions";
import { getOwnedDesignProject } from "@/lib/school-design/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — Encola export JPG final.
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

    if (dp.status !== DesignProjectStatus.APPROVED_FOR_EXPORT) {
      return NextResponse.json({ error: "El proyecto no está aprobado para export" }, { status: 400 });
    }
    if (dp.previewStatus !== DesignPreviewStatus.READY || dp.previewDirty) {
      return NextResponse.json({ error: "Preview no lista o pendiente de regenerar" }, { status: 400 });
    }

    const can = await assertNoActiveExportJob(dp.currentRevisionId);
    if (!can) {
      return NextResponse.json({ error: "Ya hay un export en curso" }, { status: 409 });
    }

    const res = await enqueueDesignExportJob({
      designProjectId: dp.id,
      designRevisionId: dp.currentRevisionId,
    });

    if (!res.ok) {
      return NextResponse.json({ error: "No se pudo encolar export" }, { status: 400 });
    }

    console.log("[school_design_export] POST enqueue", { designProjectId: dp.id, exportVersion: res.exportVersion });

    return NextResponse.json({ exportVersion: res.exportVersion });
  } catch (e) {
    console.error("[school_design_export] POST", e);
    return NextResponse.json({ error: "Error al exportar" }, { status: 500 });
  }
}
