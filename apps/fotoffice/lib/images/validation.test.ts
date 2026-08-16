import { describe, expect, it } from "vitest";
import { sniffImageFormat, validateImageFileBytes } from "./validation";
import { IMAGE_PRESETS } from "./presets";

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG_SIGNATURE = new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0]);
const WEBP_SIGNATURE = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
]);
const FAKE_TEXT_FILE = new TextEncoder().encode("no soy una imagen, soy texto plano");

describe("sniffImageFormat — MIME real por contenido, no por extensión/Content-Type declarado", () => {
  it("reconoce PNG por firma binaria", () => {
    expect(sniffImageFormat(PNG_SIGNATURE)).toBe("image/png");
  });

  it("reconoce JPEG por firma binaria", () => {
    expect(sniffImageFormat(JPEG_SIGNATURE)).toBe("image/jpeg");
  });

  it("reconoce WebP por firma RIFF/WEBP", () => {
    expect(sniffImageFormat(WEBP_SIGNATURE)).toBe("image/webp");
  });

  it("un archivo de texto renombrado .jpg no pasa por JPEG", () => {
    expect(sniffImageFormat(FAKE_TEXT_FILE)).toBeNull();
  });

  it("bytes vacíos o insuficientes: null, no crashea", () => {
    expect(sniffImageFormat(new Uint8Array([]))).toBeNull();
    expect(sniffImageFormat(new Uint8Array([0xff]))).toBeNull();
  });
});

describe("validateImageFileBytes", () => {
  const preset = IMAGE_PRESETS.workspaceLogo;

  it("archivo vacío: rechazado", () => {
    const r = validateImageFileBytes(new Uint8Array([]), preset);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("EMPTY_FILE");
  });

  it("archivo demasiado pesado: rechazado (aunque el contenido sea una imagen válida)", () => {
    const big = new Uint8Array(preset.maxFileSizeBytes + 1);
    big.set(PNG_SIGNATURE);
    const r = validateImageFileBytes(big, preset);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("TOO_LARGE");
  });

  it("un .jpg falso (texto renombrado) es rechazado por contenido, no aceptado por extensión", () => {
    const r = validateImageFileBytes(FAKE_TEXT_FILE, preset);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("FORMAT_MISMATCH");
  });

  it("PNG válido y liviano: aceptado para un preset que admite PNG", () => {
    const r = validateImageFileBytes(PNG_SIGNATURE, preset);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.format).toBe("image/png");
  });

  it("formato real detectado pero fuera del allowlist del preset: rechazado", () => {
    const pngOnlyPreset = { acceptedFormats: ["image/png"] as const, maxFileSizeBytes: preset.maxFileSizeBytes };
    const r = validateImageFileBytes(JPEG_SIGNATURE, pngOnlyPreset);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("FORMAT_NOT_ALLOWED");
  });
});
