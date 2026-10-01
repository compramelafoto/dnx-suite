/**
 * Extracción EXIF no bloqueante (misma política que FotoRank).
 */
import exifr from "exifr";
import { interpretExifClock, parseExifOffset } from "./exif-clock";

export type PhotoExifResult = {
  cameraMake: string | null;
  cameraModel: string | null;
  lensModel: string | null;
  captureDate: Date | null;
  digitizedDate: Date | null;
  software: string | null;
  iso: string | null;
  aperture: string | null;
  shutterSpeed: string | null;
  focalLength: string | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsAltitude: number | null;
  orientation: string | null;
  colorSpace: string | null;
  metadataStatus: "EXTRACTED" | "PARTIAL" | "NOT_AVAILABLE" | "INVALID" | "FAILED";
  rawMetadataJson: Record<string, unknown> | null;
};

function pickString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * La hora del EXIF es hora local de cámara sin zona: se la reubica en la zona
 * horaria de la edición (ver `exif-clock.ts`). Sin eso, en Argentina toda
 * captura queda tres horas antes de su momento real.
 */
export async function extractPhotoExif(
  buffer: Uint8Array | Buffer,
  options?: { timeZone?: string },
): Promise<PhotoExifResult> {
  const timeZone = options?.timeZone || "America/Argentina/Cordoba";
  try {
    const parsed = (await exifr.parse(buffer, {
      tiff: true,
      xmp: true,
      icc: false,
      iptc: false,
      jfif: false,
      ihdr: true,
      gps: true,
      reviveValues: true,
      translateKeys: true,
    })) as Record<string, unknown> | undefined;

    if (!parsed || typeof parsed !== "object") {
      return empty("NOT_AVAILABLE");
    }

    const exifOffsetMinutes =
      parseExifOffset(parsed.OffsetTimeOriginal) ??
      parseExifOffset(parsed.OffsetTimeDigitized) ??
      parseExifOffset(parsed.OffsetTime);

    const captureDate = interpretExifClock({
      exifDate:
        parseDate(parsed.DateTimeOriginal) ??
        parseDate(parsed.CreateDate) ??
        parseDate(parsed.DateCreated) ??
        null,
      timeZone,
      exifOffsetMinutes,
    });
    // ModifyDate / file mtime NO se usan como captura.
    const fields = {
      cameraMake: pickString(parsed.Make),
      cameraModel: pickString(parsed.Model),
      lensModel: pickString(parsed.LensModel, parsed.Lens),
      captureDate,
      digitizedDate: interpretExifClock({
        exifDate: parseDate(parsed.CreateDate) ?? parseDate(parsed.DateTimeDigitized),
        timeZone,
        exifOffsetMinutes,
      }),
      software: pickString(parsed.Software),
      iso: pickString(parsed.ISO, parsed.ISOSpeedRatings),
      aperture: pickString(parsed.FNumber, parsed.ApertureValue),
      shutterSpeed: pickString(parsed.ExposureTime, parsed.ShutterSpeedValue),
      focalLength: pickString(parsed.FocalLength),
      gpsLatitude: typeof parsed.latitude === "number" ? parsed.latitude : null,
      gpsLongitude: typeof parsed.longitude === "number" ? parsed.longitude : null,
      gpsAltitude: typeof parsed.GPSAltitude === "number" ? parsed.GPSAltitude : null,
      orientation: pickString(parsed.Orientation),
      colorSpace: pickString(parsed.ColorSpace),
    };
    const core = [fields.cameraMake, fields.cameraModel, fields.captureDate, fields.iso];
    const any = core.some(Boolean) || fields.gpsLatitude != null || fields.software;
    const metadataStatus = !any
      ? "NOT_AVAILABLE"
      : fields.cameraMake && fields.cameraModel && fields.captureDate
        ? "EXTRACTED"
        : "PARTIAL";

    return {
      ...fields,
      metadataStatus,
      rawMetadataJson: sanitizeRaw(parsed),
    };
  } catch {
    return empty("FAILED");
  }
}

function empty(status: PhotoExifResult["metadataStatus"]): PhotoExifResult {
  return {
    cameraMake: null,
    cameraModel: null,
    lensModel: null,
    captureDate: null,
    digitizedDate: null,
    software: null,
    iso: null,
    aperture: null,
    shutterSpeed: null,
    focalLength: null,
    gpsLatitude: null,
    gpsLongitude: null,
    gpsAltitude: null,
    orientation: null,
    colorSpace: null,
    metadataStatus: status,
    rawMetadataJson: null,
  };
}

function sanitizeRaw(parsed: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (/serial|password|token|secret/i.test(k)) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null) {
      out[k] = v;
    } else if (v instanceof Date) {
      out[k] = v.toISOString();
    }
  }
  return out;
}
