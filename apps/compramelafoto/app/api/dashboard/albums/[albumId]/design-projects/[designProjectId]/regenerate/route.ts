import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { requestDesignRegeneration } from "@/lib/school-design/review-actions";
import { getOwnedDesignProject } from "@/lib/school-design/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — Marca necesidad de regeneración (p. ej. desde NEEDS_ADJUSTMENT) antes de re-encolar preview.
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
    if (!dp) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    await requestDesignRegeneration(dp.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[school_design_review] regenerate POST", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
