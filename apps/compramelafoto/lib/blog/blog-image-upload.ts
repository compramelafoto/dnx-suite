import { generateR2Key, uploadToR2, getR2PublicUrl } from "@/lib/r2-client";

export const BLOG_IMAGE_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const BLOG_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export function validateBlogImageFile(file: File): { ok: true } | { ok: false; error: string } {
  if (!BLOG_IMAGE_ALLOWED_TYPES.includes(file.type as (typeof BLOG_IMAGE_ALLOWED_TYPES)[number])) {
    return { ok: false, error: "Solo se permiten imágenes JPG, PNG o WebP" };
  }
  if (file.size > BLOG_IMAGE_MAX_BYTES) {
    return { ok: false, error: "La imagen no puede superar 5 MB" };
  }
  return { ok: true };
}

export async function uploadBlogImage(
  file: File,
  prefix: "blog/hero" | "blog/media"
): Promise<{ url: string; r2Key: string; mimeType: string; sizeBytes: number; filename: string }> {
  const validation = validateBlogImageFile(file);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const filename = file.name || "image.jpg";
  const r2Key = generateR2Key(filename, prefix);
  const mimeType = file.type || "image/jpeg";
  const { url } = await uploadToR2(buffer, r2Key, mimeType, {
    type: prefix === "blog/hero" ? "blog_hero" : "blog_media",
  });
  const publicUrl = url || getR2PublicUrl(r2Key);

  return {
    url: publicUrl,
    r2Key,
    mimeType,
    sizeBytes: file.size,
    filename,
  };
}
