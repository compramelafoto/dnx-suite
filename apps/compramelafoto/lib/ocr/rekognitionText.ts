import {
  DetectTextCommand,
  RekognitionClient,
} from "@aws-sdk/client-rekognition";
import { prepareRekognitionImageBytes } from "@/lib/faces/rekognition-image";

type OcrToken = {
  textRaw: string;
  textNorm: string;
  confidence: number | null;
};

let client: RekognitionClient | null = null;

function normalizeText(value: string): string {
  return value
    .toUpperCase()
    .trim()
    .replace(/[\s-]+/g, "");
}

function getRekognitionClient(): RekognitionClient {
  if (client) return client;
  const region = process.env.AWS_REGION;
  if (!region) throw new Error("AWS_REGION no está configurado");
  client = new RekognitionClient({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });
  return client;
}

/**
 * OCR vía Amazon Rekognition DetectText (fallback cuando Google Vision no está disponible).
 */
export async function extractOcrTokensWithRekognition(params: {
  buffer: Buffer;
}): Promise<OcrToken[]> {
  const rekognition = getRekognitionClient();
  const imageBytes = await prepareRekognitionImageBytes(params.buffer, "detect");

  const response = await rekognition.send(
    new DetectTextCommand({
      Image: { Bytes: imageBytes },
      Filters: {
        WordFilter: {
          MinConfidence: 50,
        },
      },
    })
  );

  const detections = response.TextDetections || [];
  const words = detections.filter((d) => d.Type === "WORD" || d.Type === "LINE");

  const seen = new Set<string>();
  const tokens: OcrToken[] = [];
  for (const d of words) {
    const textRaw = (d.DetectedText || "").trim();
    if (!textRaw) continue;
    const textNorm = normalizeText(textRaw);
    if (!textNorm || seen.has(textNorm)) continue;
    seen.add(textNorm);
    tokens.push({
      textRaw,
      textNorm,
      confidence: d.Confidence ?? null,
    });
  }
  return tokens;
}
