import sharp from "sharp";

const MAX_REKOGNITION_BYTES = Math.floor(4.5 * 1024 * 1024);
const QUALITY_STEPS = [85, 75, 65, 55, 45];
const RESIZE_SCALE = 0.85;
const MIN_DIMENSION = 320;
const MAX_RESIZE_STEPS = 6;

type RekognitionOperation = "index" | "search" | "detect";

function isJpeg(buffer: Buffer) {
  return buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8;
}

export async function prepareRekognitionImageBytes(
  input: Buffer | Uint8Array,
  operation: RekognitionOperation
): Promise<Uint8Array> {
  const originalBuffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const originalBytes = originalBuffer.length;

  let metadata = await sharp(originalBuffer).metadata().catch(() => null);
  const originalWidth = metadata?.width ?? null;
  const originalHeight = metadata?.height ?? null;

  let currentBuffer: Buffer | null = null;
  let usedQuality: number | null = null;
  let resized = false;

  for (const quality of QUALITY_STEPS) {
    currentBuffer = await sharp(originalBuffer)
      .rotate()
      .jpeg({ quality, mozjpeg: false, progressive: false })
      .toBuffer();
    usedQuality = quality;
    if (currentBuffer.length <= MAX_REKOGNITION_BYTES) break;
  }

  if (!currentBuffer) {
    throw new Error("No se pudo preparar la imagen para Rekognition.");
  }

  if (currentBuffer.length > MAX_REKOGNITION_BYTES) {
    if (!originalWidth || !originalHeight) {
      throw new Error("No se pudo leer dimensiones para reducir la imagen.");
    }

    let width = originalWidth;
    let height = originalHeight;
    for (let i = 0; i < MAX_RESIZE_STEPS; i += 1) {
      width = Math.max(MIN_DIMENSION, Math.round(width * RESIZE_SCALE));
      height = Math.max(MIN_DIMENSION, Math.round(height * RESIZE_SCALE));
      currentBuffer = await sharp(originalBuffer)
        .rotate()
        .resize({ width, height, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: usedQuality ?? 75, mozjpeg: false, progressive: false })
        .toBuffer();
      resized = true;
      if (currentBuffer.length <= MAX_REKOGNITION_BYTES) break;
      if (width === MIN_DIMENSION && height === MIN_DIMENSION) break;
    }
  }

  if (currentBuffer.length > MAX_REKOGNITION_BYTES) {
    throw new Error(
      `Imagen demasiado grande para Rekognition (${currentBuffer.length} bytes).`
    );
  }

  if (!isJpeg(currentBuffer)) {
    throw new Error("El buffer final no es un JPEG válido para Rekognition.");
  }

  const finalMeta = await sharp(currentBuffer).metadata().catch(() => null);
  if (finalMeta?.format !== "jpeg") {
    throw new Error("El buffer final no es un JPEG válido para Rekognition.");
  }

  const finalBytes = currentBuffer.length;
  const shouldLog = finalBytes < originalBytes || resized || (usedQuality != null && usedQuality < (QUALITY_STEPS[0] ?? 100));

  if (shouldLog) {
    console.log("[analysis_v2] rekognition_image_shrink", {
      operation,
      original_bytes: originalBytes,
      final_bytes: finalBytes,
      quality: usedQuality,
      resized,
      original_dimensions: originalWidth && originalHeight ? `${originalWidth}x${originalHeight}` : null,
      final_dimensions: finalMeta?.width && finalMeta?.height ? `${finalMeta.width}x${finalMeta.height}` : null,
    });
  }

  return new Uint8Array(currentBuffer);
}
