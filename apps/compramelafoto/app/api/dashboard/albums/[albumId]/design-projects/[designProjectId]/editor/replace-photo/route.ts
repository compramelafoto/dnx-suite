import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { parseRevisionDataJson, replaceSlotPhotoInData } from "@/lib/school-design/editor-data";
import { updateRevisionDataJson } from "@/lib/school-design/persist-revision";
import { refreshPreflightForRevisionData } from "@/lib/school-design/refresh-preflight";
import { getOwnedDesignProject } from "@/lib/school-design/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
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
    const body = await req.json().catch(() => ({}));
    const slotId = Number(body.slotId);
    const photoId = Number(body.photoId);

    if (!Number.isInteger(albumId) || !Number.isInteger(designProjectId) || !Number.isInteger(slotId) || !Number.isInteger(photoId)) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    const dp = await getOwnedDesignProject(albumId, designProjectId, user.id);
    if (!dp?.currentRevision) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const allowed = new Set(dp.orderItem.selection?.photos.map((p) => p.photoId) ?? []);
    if (!allowed.has(photoId)) {
      console.warn("[school_design_editor] replace-photo photo not in selection", { photoId });
      return NextResponse.json({ error: "Foto no pertenece a la selección" }, { status: 400 });
    }

    const data = parseRevisionDataJson(dp.currentRevision.dataJson);
    if (!data?.assignments[String(slotId)]) {
      return NextResponse.json({ error: "Slot inválido" }, { status: 400 });
    }

    let next = replaceSlotPhotoInData(data, slotId, photoId);
    const slots = dp.template.slots.map((s) => ({
      id: s.id,
      pageIndex: s.pageIndex,
      index: s.index,
      role: s.role,
      bbox: s.bbox,
    }));
    next = await refreshPreflightForRevisionData(next, slots);

    await updateRevisionDataJson({
      revisionId: dp.currentRevision.id,
      designProjectId: dp.id,
      dataJson: next as unknown as Prisma.InputJsonValue,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[school_design_editor] replace-photo", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
