import piexif from "piexifjs";
import { shutterSpeedToSeconds } from "./camera-math";
import {
  buildCaptureMetadata,
  captureDisplayName,
  type CaptureUserInfo,
} from "./capture-metadata";
import type { CaptureResult } from "./camera-exposure";

function shutterSpeedToExifRational(shutterSpeed: string): [number, number] {
  const trimmed = shutterSpeed.trim();
  const fraction = trimmed.match(/^1\/(\d+)$/);
  if (fraction) return [1, Number(fraction[1])];
  const quoted = trimmed.match(/^(\d+(?:\.\d+)?)"/);
  if (quoted) return [Math.round(Number(quoted[1]) * 100), 100];
  const seconds = shutterSpeedToSeconds(shutterSpeed);
  if (seconds >= 1) return [Math.round(seconds * 100), 100];
  return [1, Math.round(1 / seconds)];
}

export function buildCaptureExif(photo: CaptureResult, user?: CaptureUserInfo): Record<string, Record<number, unknown>> {
  const capturedAt = new Date(photo.timestamp);
  const dateStr = piexif.DateTime.toDateString(capturedAt);
  const timeStr = piexif.DateTime.toTimeString(capturedAt);
  const dateTime = `${dateStr} ${timeStr}`;
  const metadata = buildCaptureMetadata(photo);
  const commentPayload = JSON.stringify({
    ...metadata,
    takenBy: user
      ? { id: user.id, name: user.name, email: user.email }
      : photo.takenBy ?? null,
  });

  const exifObj: Record<string, Record<number, unknown>> = {
    "0th": {
      [piexif.ImageIFD.Make]: "Cam Of Duty",
      [piexif.ImageIFD.Model]: "Simulador fotográfico",
      [piexif.ImageIFD.Software]: "ComprameLaFoto Cam Of Duty",
      [piexif.ImageIFD.DateTime]: dateTime,
      [piexif.ImageIFD.ImageDescription]: commentPayload.slice(0, 180),
    },
    Exif: {
      [piexif.ExifIFD.DateTimeOriginal]: dateTime,
      [piexif.ExifIFD.DateTimeDigitized]: dateTime,
      [piexif.ExifIFD.ISOSpeedRatings]: photo.settings.iso,
      [piexif.ExifIFD.FNumber]: [Math.round(photo.settings.aperture * 10), 10],
      [piexif.ExifIFD.ExposureTime]: shutterSpeedToExifRational(photo.settings.shutterSpeed),
      [piexif.ExifIFD.ExposureBiasValue]: [
        Math.round(photo.settings.exposureCompensation * 100),
        100,
      ],
      [piexif.ExifIFD.UserComment]: `ASCII\0\0\0${commentPayload.slice(0, 2000)}`,
    },
  };

  const artist = user ? captureDisplayName(user) : photo.takenBy ? captureDisplayName(photo.takenBy) : "";
  if (artist) {
    exifObj["0th"][piexif.ImageIFD.Artist] = artist;
  }

  return exifObj;
}

export function embedExifInJpegDataUrl(dataUrl: string, photo: CaptureResult, user?: CaptureUserInfo): string {
  if (!dataUrl.startsWith("data:image/jpeg")) return dataUrl;
  const exifBytes = piexif.dump(buildCaptureExif(photo, user));
  return piexif.insert(exifBytes, dataUrl);
}

export function buildCaptureFilename(photo: CaptureResult): string {
  const d = new Date(photo.timestamp);
  const stamp = d.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `cam-of-duty-${stamp}-iso${photo.settings.iso}.jpg`;
}

export function triggerCaptureDownload(photo: CaptureResult, user?: CaptureUserInfo): void {
  if (!photo.previewUrl) return;
  const dataUrl = embedExifInJpegDataUrl(photo.previewUrl, photo, user);
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = buildCaptureFilename(photo);
  link.click();
}

export function dataUrlToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.split(",")[1];
  if (!base64) throw new Error("Data URL inválida");
  return Buffer.from(base64, "base64");
}
