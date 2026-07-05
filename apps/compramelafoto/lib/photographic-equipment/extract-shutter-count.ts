import type { ShutterCountConfidence } from "@/lib/prisma";

export type ExtractedShutterCount = {
  shutterCount: number;
  sourceField: string;
  confidence: ShutterCountConfidence;
} | null;

const SHUTTER_FIELD_CANDIDATES: Array<{ field: string; confidence: ShutterCountConfidence }> = [
  { field: "ShutterCount", confidence: "HIGH" },
  { field: "shutterCount", confidence: "HIGH" },
  { field: "ImageCount", confidence: "HIGH" },
  { field: "imageCount", confidence: "HIGH" },
  { field: "Actuations", confidence: "HIGH" },
  { field: "CameraActuations", confidence: "HIGH" },
  { field: "TotalNumberOfShutterReleases", confidence: "HIGH" },
  { field: "ShutterCounter", confidence: "HIGH" },
  { field: "ImageNumber", confidence: "MEDIUM" },
  { field: "ImageNumber2", confidence: "MEDIUM" },
  { field: "FileNumber", confidence: "LOW" },
  { field: "FileNumber2", confidence: "LOW" },
];

function parseShutterValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const digits = value.replace(/[^\d]/g, "");
    if (!digits) return null;
    const parsed = Number.parseInt(digits, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

export function extractShutterCountFromExif(exif: Record<string, unknown> | null | undefined): ExtractedShutterCount {
  if (!exif) return null;

  for (const { field, confidence } of SHUTTER_FIELD_CANDIDATES) {
    const parsed = parseShutterValue(exif[field]);
    if (parsed != null) {
      return { shutterCount: parsed, sourceField: field, confidence };
    }
  }

  return null;
}
