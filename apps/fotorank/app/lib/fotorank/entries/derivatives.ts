import sharp from "sharp";

export type DerivativeBuffers = {
  thumbnail: { buffer: Buffer; width: number; height: number; mimeType: string };
  juryPreview: { buffer: Buffer; width: number; height: number; mimeType: string };
};

/**
 * Genera thumbnail y jury preview.
 * - Corrige orientación EXIF (rotate()).
 * - strip metadata sensible.
 * - No modifica el original.
 */
export async function generateEntryDerivatives(original: Buffer): Promise<DerivativeBuffers> {
  const base = sharp(original, { failOn: "none" }).rotate();

  const thumb = await base
    .clone()
    .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 78, mozjpeg: true })
    .withMetadata({})
    .toBuffer({ resolveWithObject: true });

  const jury = await base
    .clone()
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .withMetadata({})
    .toBuffer({ resolveWithObject: true });

  return {
    thumbnail: {
      buffer: thumb.data,
      width: thumb.info.width,
      height: thumb.info.height,
      mimeType: "image/jpeg",
    },
    juryPreview: {
      buffer: jury.data,
      width: jury.info.width,
      height: jury.info.height,
      mimeType: "image/jpeg",
    },
  };
}

export async function readImageDimensions(buffer: Buffer): Promise<{
  width: number;
  height: number;
  decodable: boolean;
}> {
  try {
    const meta = await sharp(buffer, { failOn: "none" }).metadata();
    if (!meta.width || !meta.height) return { width: 0, height: 0, decodable: false };
    return { width: meta.width, height: meta.height, decodable: true };
  } catch {
    return { width: 0, height: 0, decodable: false };
  }
}
