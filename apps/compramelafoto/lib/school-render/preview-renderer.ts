import sharp from "sharp";
import { normalizePreviewUrl } from "@/lib/r2-client";

type Assignment = {
  slotId: number;
  selectionPhotoId: number;
};

type SlotSpec = {
  id: number;
  bbox: { x: number; y: number; width: number; height: number };
};

type SelectionPhoto = {
  id: number;
  photo: { previewUrl: string | null; originalKey: string | null };
};

type SlotOverride = {
  cropX?: number;
  cropY?: number;
  zoom?: number;
  rotation?: number;
};

export type PreviewRenderInput = {
  templateImageUrl: string;
  templateWidthCm: number;
  templateHeightCm: number;
  slots: SlotSpec[];
  assignments: Assignment[];
  selectionPhotos: SelectionPhoto[];
  slotOverrides: Record<string, SlotOverride>;
  targetWidthPx: number;
};

export type PreviewRenderResult = {
  ok: boolean;
  buffer?: Buffer;
  width?: number;
  height?: number;
  error?: string;
};

function scalePx(templateWidthCm: number, templateHeightCm: number, targetWidthPx: number) {
  const width = targetWidthPx;
  const height = Math.round((targetWidthPx * templateHeightCm) / templateWidthCm);
  return { width, height };
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch_failed:${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export async function renderDesignPreview(input: PreviewRenderInput): Promise<PreviewRenderResult> {
  try {
    const { width, height } = scalePx(
      input.templateWidthCm,
      input.templateHeightCm,
      input.targetWidthPx
    );
    const templateBuffer = await fetchImageBuffer(input.templateImageUrl);
    let base = sharp(templateBuffer).resize(width, height, { fit: "cover" });

    const slotById = new Map(input.slots.map((s) => [s.id, s] as const));
    const photoById = new Map(input.selectionPhotos.map((p) => [p.id, p] as const));
    const composites: sharp.OverlayOptions[] = [];

    for (const assignment of input.assignments) {
      const slot = slotById.get(assignment.slotId);
      const selection = photoById.get(assignment.selectionPhotoId);
      if (!slot || !selection) continue;
      const url = normalizePreviewUrl(selection.photo.previewUrl, selection.photo.originalKey);
      if (!url) continue;
      const photoBuffer = await fetchImageBuffer(url);

      const sx = Math.round((slot.bbox.x / input.templateWidthCm) * width);
      const sy = Math.round((slot.bbox.y / input.templateHeightCm) * height);
      const sw = Math.round((slot.bbox.width / input.templateWidthCm) * width);
      const sh = Math.round((slot.bbox.height / input.templateHeightCm) * height);
      const override = input.slotOverrides[String(slot.id)] ?? {};
      const zoom = typeof override.zoom === "number" ? override.zoom : 1;
      const cropX = typeof override.cropX === "number" ? override.cropX : 0;
      const cropY = typeof override.cropY === "number" ? override.cropY : 0;
      const rotation = typeof override.rotation === "number" ? override.rotation : 0;
      const targetW = Math.max(1, Math.round(sw * zoom));
      const targetH = Math.max(1, Math.round(sh * zoom));

      let img = sharp(photoBuffer).resize(targetW, targetH, { fit: "cover" });
      if (rotation) {
        img = img.rotate(rotation);
      }
      const { width: iw = targetW, height: ih = targetH } = await img.metadata();
      const left = clamp(Math.round((iw - sw) / 2 - cropX), 0, Math.max(0, iw - sw));
      const top = clamp(Math.round((ih - sh) / 2 - cropY), 0, Math.max(0, ih - sh));
      const extracted = await img
        .extract({ left, top, width: sw, height: sh })
        .toBuffer();

      composites.push({
        input: extracted,
        left: sx,
        top: sy,
      });
    }

    if (composites.length > 0) {
      base = base.composite(composites);
    }

    const buffer = await base.jpeg({ quality: 82 }).toBuffer();
    return { ok: true, buffer, width, height };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "render_failed" };
  }
}

export async function renderDesignExport(input: PreviewRenderInput): Promise<PreviewRenderResult> {
  try {
    const render = await renderDesignPreview({
      ...input,
      targetWidthPx: Math.max(input.targetWidthPx, 3000),
    });
    if (!render.ok || !render.buffer) {
      return render;
    }
    const buffer = await sharp(render.buffer).jpeg({ quality: 92 }).toBuffer();
    return { ok: true, buffer, width: render.width, height: render.height };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "render_failed" };
  }
}
