import "server-only";
import { prisma } from "@repo/db";
import { uploadFotofficeImage } from "@/lib/images/upload";
import { blogWhere } from "./scope";

/**
 * Las imágenes del blog: se suben al almacenamiento de FOTOFFICE, en la carpeta de la
 * institución, y se anotan en su biblioteca (`BlogMedia`) para poder reutilizarlas.
 */
export type BlogImageKind = "hero" | "media";

export async function uploadBlogImage(input: {
  workspaceId: string;
  kind: BlogImageKind;
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
  title?: string | null;
  altText?: string | null;
}): Promise<{ ok: true; id: number; url: string } | { ok: false; error: string }> {
  const subida = await uploadFotofficeImage({
    presetKey: input.kind === "hero" ? "blogHero" : "blogMedia",
    bytes: input.bytes,
    originalFilename: input.filename,
    scopeSegment: input.workspaceId,
  });
  if (!subida.ok) return { ok: false, error: subida.error };

  const media = await prisma.blogMedia.create({
    data: {
      ...blogWhere(input.workspaceId),
      title: input.title ?? null,
      altText: input.altText ?? null,
      filename: input.filename,
      url: subida.url,
      r2Key: subida.key,
      mimeType: subida.contentType ?? input.mimeType,
      sizeBytes: subida.sizeBytes ?? input.bytes.byteLength,
    },
    select: { id: true, url: true },
  });
  return { ok: true, id: media.id, url: media.url };
}
