import exifr from "exifr";

export async function extractCapturedAtFromBuffer(
  buffer: Buffer
): Promise<Date | null> {
  try {
    const exif = await exifr.parse(buffer, {
      tiff: true,
      exif: true,
      gps: false,
      xmp: false,
      iptc: false,
      translateValues: false,
    });
    if (!exif) return null;
    const candidate =
      exif.DateTimeOriginal ||
      exif.CreateDate ||
      exif.DateTimeDigitized ||
      exif.ModifyDate;
    if (!candidate) return null;
    const parsed = candidate instanceof Date ? candidate : new Date(candidate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}
