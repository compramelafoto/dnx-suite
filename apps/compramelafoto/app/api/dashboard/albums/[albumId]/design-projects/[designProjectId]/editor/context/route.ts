import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { normalizePreviewUrl } from "@/lib/r2-client";
import { parseRevisionDataJson } from "@/lib/school-design/editor-data";
import type { SlotTransform } from "@/lib/school-design/types";
import { getOwnedDesignProject } from "@/lib/school-design/route-helpers";

function textIdsFromTemplate(textElementsJson: unknown): string[] {
  const ids = new Set<string>();
  if (Array.isArray(textElementsJson)) {
    for (const row of textElementsJson) {
      if (row && typeof row === "object" && "id" in row && (row as { id: unknown }).id != null) {
        ids.add(String((row as { id: unknown }).id));
      }
    }
  } else if (textElementsJson && typeof textElementsJson === "object") {
    for (const k of Object.keys(textElementsJson as object)) {
      ids.add(k);
    }
  }
  return [...ids];
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — Contexto del editor: plantilla, slots, dataJson, fotos de selección.
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
    if (!dp?.currentRevision) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const dataJson = parseRevisionDataJson(dp.currentRevision.dataJson);
    const assignmentsRecord = dataJson?.assignmentsRecord ?? {};
    const templateTextIds = textIdsFromTemplate(dp.template.textElementsJson);
    const textOverrideKeys = dataJson ? Object.keys(dataJson.textOverridesFlat) : [];
    const textFieldIds = [...new Set([...templateTextIds, ...textOverrideKeys])];

    const defaultTf = (): SlotTransform => ({
      fitMode: "COVER",
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
    });
    const slotTransformsOut: Record<string, SlotTransform> = {};
    if (dataJson) {
      for (const k of Object.keys(dataJson.assignmentsRecord)) {
        slotTransformsOut[k] = { ...defaultTf(), ...dataJson.slotTransforms[k] };
      }
    }
    const selectionPhotos =
      dp.orderItem.selection?.photos.map((sp) => {
        const url = normalizePreviewUrl(sp.photo.previewUrl, sp.photo.originalKey) ?? "";
        const inUse = Object.values(assignmentsRecord).some((a) => a.photoId === sp.photoId);
        return {
          photoId: sp.photoId,
          position: sp.position,
          previewUrl: url,
          inUse,
        };
      }) ?? [];

    return NextResponse.json({
      designProject: {
        id: dp.id,
        status: dp.status,
        previewUrl: dp.previewUrl,
        previewVersion: dp.previewVersion,
        previewStatus: dp.previewStatus,
        previewDirty: dp.previewDirty,
        previewError: dp.previewError,
        exportUrlJpg: dp.exportUrlJpg,
        exportVersion: dp.exportVersion,
        exportError: dp.exportError,
      },
      template: {
        id: dp.template.id,
        imageUrl: dp.template.imageUrl,
        widthCm: dp.template.widthCm,
        heightCm: dp.template.heightCm,
        textElementsJson: dp.template.textElementsJson,
        pagesJson: dp.template.pagesJson,
      },
      slots: dp.template.slots.map((s) => ({
        id: s.id,
        pageIndex: s.pageIndex,
        index: s.index,
        role: s.role,
        bbox: s.bbox,
      })),
      revision: {
        id: dp.currentRevision.id,
        dataJson: dp.currentRevision.dataJson,
      },
      selectionPhotos,
      editor: dataJson
        ? {
            assignments: dataJson.assignmentsRecord,
            slotTransforms: slotTransformsOut,
            textOverrides: dataJson.textOverridesFlat,
            textFieldIds,
          }
        : {
            assignments: {},
            slotTransforms: {},
            textOverrides: {},
            textFieldIds: [],
          },
    });
  } catch (e) {
    console.error("[school_design_editor] context GET", e);
    return NextResponse.json({ error: "Error al cargar contexto" }, { status: 500 });
  }
}
