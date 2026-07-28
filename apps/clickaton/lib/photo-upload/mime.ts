export type DetectedMime = {
  mime: string;
  extension: string;
  valid: boolean;
};

/** Detección por magic bytes (no confiar en extensión ni Content-Type del cliente). */
export function detectImageMime(buffer: Buffer, declaredMime?: string): DetectedMime {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg", valid: true };
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { mime: "image/png", extension: "png", valid: true };
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mime: "image/webp", extension: "webp", valid: true };
  }
  // HEIC/HEIF — ftyp....heic / heif / mif1
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12);
    if (["heic", "heif", "mif1", "msf1"].includes(brand)) {
      return { mime: "image/heic", extension: "heic", valid: false }; // no procesar en MVP salvo flag
    }
  }
  return {
    mime: declaredMime || "application/octet-stream",
    extension: "bin",
    valid: false,
  };
}

export function isAllowedMime(mime: string, allowed: string[]): boolean {
  return allowed.map((m) => m.toLowerCase()).includes(mime.toLowerCase());
}
