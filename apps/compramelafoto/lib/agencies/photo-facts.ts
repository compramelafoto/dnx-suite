import { createHash } from "crypto";
import exifr from "exifr";

/** Datos de una foto de agencia para ubicarla y detectar repetidas. Nada de esto lanza. */

export type PhotoFacts = {
  contentSha256: string;
  cameraSerial: string | null;
  cameraImageNumber: number | null;
  exifLat: number | null;
  exifLng: number | null;
};

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

const MAX_INT32 = 2147483647; // cameraImageNumber es Int (32 bits) en Postgres

function inInt32(n: number): number | null {
  return Number.isSafeInteger(n) && n > 0 && n <= MAX_INT32 ? n : null;
}

export function parseImageNumber(raw: unknown): number | null {
  if (typeof raw === "number") return inInt32(raw);
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  const dashed = t.match(/^(\d+)-(\d+)$/);
  if (dashed) {
    return inInt32(Number(`${dashed[1]}${dashed[2]}`));
  }
  if (!/^\d+$/.test(t)) return null;
  return inInt32(Number(t));
}

function validPoint(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

function cleanText(v: unknown): string | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const t = String(v).trim();
  if (!t || /^0+$/.test(t)) return null; // serial vacío o todo ceros: no identifica la cámara
  return t.slice(0, 120);
}

export function cameraFactsFromExif(exif: Record<string, unknown> | null | undefined) {
  const e = exif ?? {};
  const gps = validPoint(e.latitude, e.longitude);
  return {
    cameraSerial: cleanText(e.BodySerialNumber) ?? cleanText(e.SerialNumber) ?? cleanText(e.InternalSerialNumber),
    cameraImageNumber: parseImageNumber(e.ImageNumber) ?? parseImageNumber(e.FileNumber),
    exifLat: gps?.lat ?? null,
    exifLng: gps?.lng ?? null,
  };
}

export function imageNumberFromFilename(name: string | null | undefined): number | null {
  if (!name) return null;
  const m = name.match(/^(?:DSC_|DSC|IMG_|_MG_|DSCF|_DSC)(\d{4,5})\.[a-z0-9]+$/i);
  return m ? parseImageNumber(m[1]) : null;
}

export async function extractPhotoFacts(buffer: Buffer, originalFilename?: string | null): Promise<PhotoFacts> {
  let exif: Record<string, unknown> | null = null;
  try {
    exif = (await exifr.parse(buffer, {
      tiff: true,
      exif: true,
      gps: true,
      xmp: false,
      iptc: false,
      makerNote: false,
      translateValues: false,
    })) as Record<string, unknown> | null;
  } catch {
    exif = null;
  }
  const camera = cameraFactsFromExif(exif);
  return {
    contentSha256: sha256Hex(buffer),
    ...camera,
    cameraImageNumber: camera.cameraImageNumber ?? imageNumberFromFilename(originalFilename),
  };
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && /^\s*-?\d+([.,]\d+)?\s*$/.test(v)) return Number(v.trim().replace(",", "."));
  return null;
}

export function parseDeclaredPoint(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  return validPoint(toNumber(lat), toNumber(lng));
}

export function resolvePhotoLocation(
  facts: { exifLat: number | null; exifLng: number | null },
  declared: { lat: number; lng: number } | null
): { geoLat: number; geoLng: number; geoSource: "EXIF_GPS" | "DECLARED" } | null {
  if (facts.exifLat !== null && facts.exifLng !== null) {
    return { geoLat: facts.exifLat, geoLng: facts.exifLng, geoSource: "EXIF_GPS" };
  }
  if (declared) return { geoLat: declared.lat, geoLng: declared.lng, geoSource: "DECLARED" };
  return null;
}
