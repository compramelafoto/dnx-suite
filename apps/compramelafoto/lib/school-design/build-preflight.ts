import type { AssignmentEntry, Bbox, RenderPreflightJsonV1, SlotTransform } from "./types";
import { SCHOOL_PREFLIGHT_SCHEMA_VERSION } from "./types";
import type { TemplateSlotInput } from "./validate-selection";

function parseBbox(raw: unknown): Bbox | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const x = Number(o.x);
  const y = Number(o.y);
  const width = Number(o.width);
  const height = Number(o.height);
  if (![x, y, width, height].every((n) => Number.isFinite(n))) return null;
  return { x, y, width, height };
}

const baseTransform = (): SlotTransform => ({
  fitMode: "COVER",
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
});

/**
 * Preflight inicial para render: bbox de slot, bbox de foto si existe, assetOk, transform base.
 * Equivalente: buildInitialRenderPreflight (legacy).
 */
export function buildInitialRenderPreflight(input: {
  slots: TemplateSlotInput[];
  assignments: Record<string, AssignmentEntry>;
  photoBboxByPhotoId: Map<number, Bbox | null | undefined>;
}): RenderPreflightJsonV1 {
  const slots: RenderPreflightJsonV1["slots"] = {};

  for (const s of input.slots) {
    const slotBbox = parseBbox(s.bbox);
    const key = String(s.id);
    const asg = input.assignments[key];
    const photoId = asg?.photoId ?? null;
    let photoBbox: Bbox | null = null;
    let assetOk = false;
    if (photoId != null) {
      const pb = input.photoBboxByPhotoId.get(photoId);
      photoBbox = pb === undefined ? null : pb ?? null;
      assetOk = photoBbox !== null;
    }
    const t = baseTransform();
    if (slotBbox) {
      t.x = slotBbox.x;
      t.y = slotBbox.y;
    }
    slots[key] = {
      slotId: s.id,
      bbox: slotBbox ?? { x: 0, y: 0, width: 1, height: 1 },
      photoId,
      photoBbox,
      assetOk,
      transform: t,
    };
  }

  return {
    schemaVersion: SCHOOL_PREFLIGHT_SCHEMA_VERSION,
    slots,
  };
}
