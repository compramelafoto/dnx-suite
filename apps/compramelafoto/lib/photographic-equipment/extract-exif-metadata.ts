import exifr from "exifr";
import { extractShutterCountFromExif } from "@/lib/photographic-equipment/extract-shutter-count";
import type { ExtractedShutterCount } from "@/lib/photographic-equipment/extract-shutter-count";

export type ExtractedExifMetadata = {
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  lensMake: string | null;
  lensModel: string | null;
  focalLength: string | null;
  exposureTime: string | null;
  aperture: string | null;
  iso: string | null;
  takenAt: Date | null;
  gpsLat: number | null;
  gpsLng: number | null;
  shutterCount: ExtractedShutterCount;
  rawExifSummary: Record<string, unknown>;
};

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function parseTakenAt(candidate: unknown): Date | null {
  if (!candidate) return null;
  const parsed = candidate instanceof Date ? candidate : new Date(String(candidate));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatExposureTime(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 1) return `${value}s`;
    return `1/${Math.round(1 / value)}s`;
  }
  const asString = String(value).trim();
  return asString || null;
}

function formatAperture(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return `f/${value}`;
  const asString = String(value).trim();
  return asString || null;
}

function buildRawExifSummary(exif: Record<string, unknown>): Record<string, unknown> {
  const keys = [
    "Make",
    "Model",
    "SerialNumber",
    "BodySerialNumber",
    "LensMake",
    "LensModel",
    "LensSerialNumber",
    "ShutterCount",
    "ImageCount",
    "ImageNumber",
    "FileNumber",
    "DateTimeOriginal",
    "ISO",
    "FNumber",
    "FocalLength",
  ];
  const summary: Record<string, unknown> = {};
  for (const key of keys) {
    if (exif[key] != null) summary[key] = exif[key];
  }
  return summary;
}

/**
 * Extrae metadatos EXIF relevantes de un buffer de imagen.
 * No lanza: devuelve null si no hay EXIF parseable.
 */
export async function extractExifMetadata(buffer: Buffer): Promise<ExtractedExifMetadata | null> {
  try {
    const exif = (await exifr.parse(buffer, {
      tiff: true,
      exif: true,
      gps: true,
      makerNote: true,
      xmp: false,
      iptc: false,
      translateValues: false,
    })) as Record<string, unknown> | null;
    if (!exif) return null;

    const make = pickString(exif.Make, exif.make);
    const model = pickString(exif.Model, exif.model);
    const serialNumber = pickString(
      exif.SerialNumber,
      exif.BodySerialNumber,
      exif.InternalSerialNumber,
      exif.CameraSerialNumber
    );

    const lensMake = pickString(exif.LensMake, exif.lensMake);
    const lensModel = pickString(exif.LensModel, exif.lensModel);
    const focalLength = pickString(exif.FocalLength, exif.FocalLengthIn35mmFormat);
    const exposureTime = formatExposureTime(exif.ExposureTime ?? exif.ShutterSpeedValue);
    const aperture = formatAperture(exif.FNumber ?? exif.ApertureValue);
    const iso = pickString(exif.ISO, exif.ISOSpeedRatings);

    const takenAt = parseTakenAt(
      exif.DateTimeOriginal || exif.CreateDate || exif.DateTimeDigitized || exif.ModifyDate
    );

    const gpsLat =
      typeof exif.latitude === "number" && Number.isFinite(exif.latitude) ? exif.latitude : null;
    const gpsLng =
      typeof exif.longitude === "number" && Number.isFinite(exif.longitude) ? exif.longitude : null;

    return {
      make,
      model,
      serialNumber,
      lensMake,
      lensModel,
      focalLength,
      exposureTime,
      aperture,
      iso,
      takenAt,
      gpsLat,
      gpsLng,
      shutterCount: extractShutterCountFromExif(exif),
      rawExifSummary: buildRawExifSummary(exif),
    };
  } catch {
    return null;
  }
}
