import { prisma } from "@/lib/prisma";
import { buildInitialRenderPreflight } from "./build-preflight";
import type { AssignmentEntry, DesignRevisionDataJsonV1 } from "./types";
import type { TemplateSlotInput } from "./validate-selection";

export async function refreshPreflightForRevisionData(
  data: DesignRevisionDataJsonV1,
  slots: TemplateSlotInput[]
): Promise<DesignRevisionDataJsonV1> {
  const photoIds = [...new Set(Object.values(data.assignments).map((a) => a.photoId))];
  const photos = await prisma.photo.findMany({
    where: { id: { in: photoIds } },
    include: { photoFaces: { take: 1 } },
  });

  const photoBboxByPhotoId = new Map<number, { x: number; y: number; width: number; height: number } | null>();
  for (const p of photos) {
    const face = p.photoFaces[0];
    const raw = face?.bbox;
    if (raw && typeof raw === "object") {
      const o = raw as Record<string, unknown>;
      const x = Number(o.x);
      const y = Number(o.y);
      const width = Number(o.width);
      const height = Number(o.height);
      if ([x, y, width, height].every((n) => Number.isFinite(n))) {
        photoBboxByPhotoId.set(p.id, { x, y, width, height });
      } else {
        photoBboxByPhotoId.set(p.id, null);
      }
    } else {
      photoBboxByPhotoId.set(p.id, { x: 0, y: 0, width: 1, height: 1 });
    }
  }

  const assignments: Record<string, AssignmentEntry> = {};
  for (const [k, v] of Object.entries(data.assignments)) {
    assignments[k] = v;
  }

  const preflight = buildInitialRenderPreflight({
    slots,
    assignments,
    photoBboxByPhotoId,
  });

  return { ...data, preflight };
}
