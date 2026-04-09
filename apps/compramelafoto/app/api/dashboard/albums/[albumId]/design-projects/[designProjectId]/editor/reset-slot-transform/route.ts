import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { parseRevisionDataJson, resetSlotTransformInData } from "@/lib/school-design/editor-data";
import { updateRevisionDataJson } from "@/lib/school-design/persist-revision";
import { buildPersistDataJsonFromParsed } from "@/lib/school-design/revision-data";
import { getOwnedDesignProject, slotsAndRolesFromOwnedProject } from "@/lib/school-design/route-helpers";

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

    if (!Number.isInteger(albumId) || !Number.isInteger(designProjectId) || !Number.isInteger(slotId)) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    const dp = await getOwnedDesignProject(albumId, designProjectId, user.id);
    if (!dp?.currentRevision) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const data = parseRevisionDataJson(dp.currentRevision.dataJson);
    if (!data?.assignmentsRecord[String(slotId)]) {
      return NextResponse.json({ error: "Slot inválido" }, { status: 400 });
    }

    const next = resetSlotTransformInData(data, slotId);
    const { slots, roleMap } = slotsAndRolesFromOwnedProject(dp);
    const dataJson = buildPersistDataJsonFromParsed(
      dp.currentRevision.dataJson,
      next,
      slots,
      roleMap,
      dp.template.id,
      dp.orderItemId
    );

    await updateRevisionDataJson({
      revisionId: dp.currentRevision.id,
      designProjectId: dp.id,
      dataJson,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[school_design_editor] reset-slot-transform", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
