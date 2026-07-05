import { NextResponse } from "next/server";
import { readFromR2 } from "@/lib/r2-client";
import { isServePregeneratedVariantsEnabled } from "@/lib/images/photo-variant-config";

export type PhotoVariantRow = {
  thumbWatermarkedKey?: string | null;
  previewWatermarkedKey?: string | null;
};

export function getPregeneratedKeyForMode(
  photo: PhotoVariantRow,
  mode: "thumb" | "preview"
): string | null {
  const key =
    mode === "thumb" ? photo.thumbWatermarkedKey?.trim() : photo.previewWatermarkedKey?.trim();
  return key || null;
}

export async function servePregeneratedVariantResponse(
  r2Key: string,
  mode: "thumb" | "preview"
): Promise<NextResponse> {
  const buffer = await readFromR2(r2Key);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Photo-Variant": mode,
      "X-Photo-Variant-Source": "pregenerated",
    },
  });
}

export async function tryServePregeneratedVariant(params: {
  photo: PhotoVariantRow;
  mode: "thumb" | "preview";
}): Promise<NextResponse | null> {
  if (!isServePregeneratedVariantsEnabled()) {
    return null;
  }
  const key = getPregeneratedKeyForMode(params.photo, params.mode);
  if (!key) {
    return null;
  }
  try {
    return await servePregeneratedVariantResponse(key, params.mode);
  } catch (err) {
    console.warn("[photo-variant] pregenerated_read_failed", {
      mode: params.mode,
      key,
      err,
    });
    return null;
  }
}
