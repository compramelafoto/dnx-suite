/**
 * Extracción EXIF no bloqueante (inspirada en CLF, sin acoplar modelos Photo).
 * Ausencia de EXIF → NOT_AVAILABLE (nunca rechazo automático).
 */
import exifr from "exifr";

export type EntryExifResult = {
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

function formatExposure(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 1) return `${value}s`;
    return `1/${Math.round(1 / value)}`;
  }
  const s = String(value).trim();
  return s || null;
}

function formatAperture(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return `f/${value}`;
  const s = String(value).trim();
  return s || null;
}

function classifyStatus(fields: Omit<EntryExifResult, "metadataStatus" | "rawMetadataJson">): EntryExifResult["metadataStatus"] {
  const core = [fields.cameraMake, fields.cameraModel, fields.captureDate, fields.iso, fields.aperture];
  const any = core.some(Boolean) || fields.gpsLatitude != null || fields.software;
  if (!any) return "NOT_AVAILABLE";
  const rich = Boolean(fields.cameraMake && fields.cameraModel && fields.captureDate);
  return rich ? "EXTRACTED" : "PARTIAL";
}

/**
 * Extrae EXIF. Nunca lanza al caller de negocio: FAILED/NOT_AVAILABLE en resultado.
 */
export async function extractEntryExif(buffer: Uint8Array | Buffer): Promise<EntryExifResult> {
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
      translateValues: true,
    })) as Record<string, unknown> | undefined;

    if (!parsed || Object.keys(parsed).length === 0) {
      return emptyResult("NOT_AVAILABLE");
    }

    const fields = {
      cameraMake: pickString(parsed.Make, parsed.make),
      cameraModel: pickString(parsed.Model, parsed.model),
      lensModel: pickString(parsed.LensModel, parsed.lensModel),
      captureDate: parseDate(parsed.DateTimeOriginal ?? parsed.CreateDate ?? parsed.DateTime),
      digitizedDate: parseDate(parsed.DateTimeDigitized ?? parsed.ModifyDate),
      software: pickString(parsed.Software, parsed.software),
      iso: pickString(parsed.ISO, parsed.ISOSpeedRatings),
      aperture: formatAperture(parsed.FNumber ?? parsed.ApertureValue),
      shutterSpeed: formatExposure(parsed.ExposureTime ?? parsed.ShutterSpeedValue),
      focalLength: pickString(parsed.FocalLength),
      gpsLatitude: typeof parsed.latitude === "number" ? parsed.latitude : null,
      gpsLongitude: typeof parsed.longitude === "number" ? parsed.longitude : null,
      gpsAltitude: typeof parsed.GPSAltitude === "number" ? parsed.GPSAltitude : null,
      orientation: pickString(parsed.Orientation),
      colorSpace: pickString(parsed.ColorSpace),
    };

    const status = classifyStatus(fields);
    const raw: Record<string, unknown> = {};
    for (const key of [
      "Make",
      "Model",
      "LensModel",
      "Software",
      "DateTimeOriginal",
      "ISO",
      "FNumber",
      "ExposureTime",
      "FocalLength",
      "Orientation",
      "ColorSpace",
    ]) {
      if (parsed[key] != null) raw[key] = parsed[key];
    }

    return { ...fields, metadataStatus: status, rawMetadataJson: raw };
  } catch {
    return emptyResult("FAILED");
  }
}

function emptyResult(status: EntryExifResult["metadataStatus"]): EntryExifResult {
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

/** Heurística conservadora de dispositivo (nunca descalifica sola). */
export type DeviceCompatibility =
  | "compatible"
  | "probable"
  | "not_verifiable"
  | "inconsistent"
  | "requires_review";

export function assessDeviceCompatibility(input: {
  categorySlug: string;
  make: string | null;
  model: string | null;
  software: string | null;
}): DeviceCompatibility {
  const blob = `${input.make ?? ""} ${input.model ?? ""} ${input.software ?? ""}`.toLowerCase();
  if (!blob.trim()) return "not_verifiable";

  const phoneHints = ["iphone", "pixel", "samsung", "xiaomi", "huawei", "motorola", "redmi", "galaxy"];
  const cameraHints = ["canon", "nikon", "sony", "fujifilm", "olympus", "panasonic", "leica", "pentax"];
  const droneHints = ["dji", "mavic", "air 2", "mini 3", "autel"];

  const slug = input.categorySlug.toLowerCase();
  const isPhone = phoneHints.some((h) => blob.includes(h));
  const isCamera = cameraHints.some((h) => blob.includes(h));
  const isDrone = droneHints.some((h) => blob.includes(h));

  if (slug.includes("celular") || slug.includes("mobile") || slug.includes("phone")) {
    if (isPhone) return "compatible";
    if (isCamera || isDrone) return "inconsistent";
    return "not_verifiable";
  }
  if (slug.includes("dron") || slug.includes("drone")) {
    if (isDrone) return "compatible";
    if (isPhone) return "inconsistent";
    return "probable";
  }
  // categoría cámara / general
  if (isCamera) return "compatible";
  if (isPhone) return "probable";
  return "not_verifiable";
}
