import sharp from "sharp";
import { parseRevisionDataJson } from "./revision-data";
import type { Bbox } from "./types";

function bboxToPixels(b: Bbox, imgW: number, imgH: number): { left: number; top: number; width: number; height: number } {
  const isNorm = Math.max(b.x, b.y, b.width, b.height) <= 1.0001;
  if (isNorm) {
    return {
      left: Math.round(b.x * imgW),
      top: Math.round(b.y * imgH),
      width: Math.round(b.width * imgW),
      height: Math.round(b.height * imgH),
    };
  }
  return {
    left: Math.round(b.x),
    top: Math.round(b.y),
    width: Math.round(b.width),
    height: Math.round(b.height),
  };
}

/**
 * Render JPG compuesto: plantilla base + fotos en slots (página 0).
 */
export async function renderSchoolDesignJpeg(input: {
  templateImageBuffer: Buffer;
  slots: Array<{ id: number; pageIndex: number; bbox: unknown }>;
  dataJson: unknown;
  loadPhotoBuffer: (photoId: number) => Promise<Buffer>;
  outputMaxWidth: number;
  jpegQuality?: number;
}): Promise<Buffer> {
  const parsed = parseRevisionDataJson(input.dataJson);
  if (!parsed) {
    throw new Error("dataJson inválido o sin preflight");
  }
  const tplBuf = input.templateImageBuffer;
  const meta = await sharp(tplBuf).metadata();
  const imgW = meta.width ?? 1;
  const imgH = meta.height ?? 1;

  const slotsP0 = input.slots.filter((s) => s.pageIndex === 0);
  const overlays: sharp.OverlayOptions[] = [];

  for (const slot of slotsP0) {
    const key = String(slot.id);
    const asg = parsed.assignmentsRecord[key];
    if (!asg?.photoId) continue;
    const pre = parsed.preflight.slots[key];
    const rawBbox = pre?.bbox ?? slot.bbox;
    if (!rawBbox || typeof rawBbox !== "object") continue;
    const o = rawBbox as Record<string, unknown>;
    const bbox: Bbox = {
      x: Number(o.x),
      y: Number(o.y),
      width: Number(o.width),
      height: Number(o.height),
    };
    if (![bbox.x, bbox.y, bbox.width, bbox.height].every((n) => Number.isFinite(n))) continue;

    const { left, top, width, height } = bboxToPixels(bbox, imgW, imgH);
    if (width < 2 || height < 2) continue;

    const photoBuf = await input.loadPhotoBuffer(asg.photoId);
    const tf = parsed.slotTransforms[key];
    const rotation = tf?.rotation ?? 0;

    const fitted = await sharp(photoBuf)
      .rotate(rotation)
      .resize(width, height, { fit: "cover", position: "centre" })
      .toBuffer();

    overlays.push({ input: fitted, left, top });
  }

  let pipeline: sharp.Sharp = sharp(tplBuf);
  if (overlays.length > 0) {
    pipeline = pipeline.composite(overlays);
  }

  if (input.outputMaxWidth > 0) {
    pipeline = pipeline.resize({
      width: input.outputMaxWidth,
      withoutEnlargement: true,
    });
  }

  return pipeline.jpeg({ quality: input.jpegQuality ?? 82, mozjpeg: true }).toBuffer();
}

export async function fetchBufferFromUrl(url: string): Promise<Buffer> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`fetch ${url}: ${res.status}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
