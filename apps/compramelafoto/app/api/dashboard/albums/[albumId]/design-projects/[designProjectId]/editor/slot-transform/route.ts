import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import type { SlotTransform } from "@/lib/school-design/types";
import { parseRevisionDataJson, updateSlotTransformInData } from "@/lib/school-design/editor-data";
import { updateRevisionDataJson } from "@/lib/school-design/persist-revision";
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
    const patch = (body.patch ?? {}) as Partial<SlotTransform>;

    if (!Number.isInteger(albumId) || !Number.isInteger(designProjectId) || !Number.isInteger(slotId)) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    const dp = await getOwnedDesignProject(albumId, designProjectId, user.id);
    if (!dp?.currentRevision) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const slotOk = dp.template.slots.some((s) => s.id === slotId);
    const data = parseRevisionDataJson(dp.currentRevision.dataJson);
    if (!slotOk || !data?.assignments[String(slotId)]) {
      console.warn("[school_design_editor] slot-transform invalid slot", { slotId });
      return NextResponse.json({ error: "Slot inválido" }, { status: 400 });
    }

    const next = updateSlotTransformInData(data, slotId, patch);

    await updateRevisionDataJson({
      revisionId: dp.currentRevision.id,
      designProjectId: dp.id,
      dataJson: next as unknown as Prisma.InputJsonValue,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[school_design_editor] slot-transform", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
