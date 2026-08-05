import { extractOcrTokensFromImage as extractWithGoogleVision } from "./googleVision";
import { extractOcrTokensWithRekognition } from "./rekognitionText";

type OcrToken = {
  textRaw: string;
  textNorm: string;
  confidence: number | null;
};

function hasGoogleVisionCredentials(): boolean {
  return Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim());
}

function preferRekognitionFirst(): boolean {
  const provider = (process.env.OCR_PROVIDER || "").toLowerCase().trim();
  return provider === "rekognition" || provider === "aws";
}

/**
 * Extrae tokens OCR: intenta Google Vision y, si falla o no hay credenciales,
 * usa Amazon Rekognition DetectText (útil si Vision tiene billing caído).
 *
 * `OCR_PROVIDER=rekognition` saltea Vision y va directo a AWS.
 */
export async function extractOcrTokensFromImage(params: {
  buffer?: Buffer;
  imageUrl?: string;
}): Promise<OcrToken[]> {
  const { buffer, imageUrl } = params;
  if (!buffer && !imageUrl) return [];

  if (preferRekognitionFirst()) {
    if (!buffer) {
      throw new Error("OCR_PROVIDER=rekognition requiere buffer de imagen");
    }
    return extractOcrTokensWithRekognition({ buffer });
  }

  if (hasGoogleVisionCredentials()) {
    try {
      return await extractWithGoogleVision(params);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      console.warn("[ocr] google_vision_failed_fallback_rekognition", {
        error: msg.slice(0, 300),
      });
      if (!buffer) throw err;
    }
  } else if (!buffer) {
    throw new Error("Sin buffer ni credenciales Google Vision para OCR");
  }

  return extractOcrTokensWithRekognition({ buffer: buffer! });
}
