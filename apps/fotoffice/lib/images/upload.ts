import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { FOTOFFICE_R2_PREFIXES } from "./r2-key-policy";
import { generateFotofficeR2Key, isFotofficeR2Configured, uploadToFotofficeR2 } from "./r2-client";
import { validateImageFileBytes } from "./validation";
import { getImagePreset, type ImagePresetKey } from "./presets";

export type FotofficeImageUploadResult = {
  url: string;
  key: string;
  contentType: string;
  sizeBytes: number;
};

export type FotofficeImageUploadError = { ok: false; error: string };
export type FotofficeImageUploadOutcome = ({ ok: true } & FotofficeImageUploadResult) | FotofficeImageUploadError;

/**
 * Sube una imagen institucional de FotoOffice bajo el preset indicado.
 * - Con R2 configurado: bucket compartido del monorepo, prefix `fotoffice/{preset}`.
 * - Sin R2 (dev local, o producción todavía sin credenciales R2 para FotoOffice):
 *   `public/uploads/fotoffice/{preset}/` — igual al fallback ya usado por InfoSpot.
 *   NO persiste entre deploys en Vercel: es un fallback de desarrollo, no una
 *   solución de producción. Ver informe de la etapa.
 *
 * Workspace-scoping: el caller (API route) es responsable de resolver el
 * workspace activo desde la sesión — esta función no confía en ningún id
 * provisto por el cliente.
 */
export async function uploadFotofficeImage(params: {
  presetKey: ImagePresetKey | string;
  bytes: Uint8Array;
  originalFilename: string;
  /** Segmento extra del path, ej. workspaceId, para no mezclar objetos entre workspaces dentro del mismo prefix. */
  scopeSegment: string;
}): Promise<FotofficeImageUploadOutcome> {
  const preset = getImagePreset(params.presetKey);
  if (!preset) return { ok: false, error: "Preset de imagen desconocido." };

  const validation = validateImageFileBytes(params.bytes, preset);
  if (!validation.ok) return { ok: false, error: validation.message };

  const basePrefix = (FOTOFFICE_R2_PREFIXES as Record<string, string>)[preset.key];
  if (!basePrefix) return { ok: false, error: "Preset sin namespace de storage configurado." };
  const safeScope = params.scopeSegment.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "misc";
  const prefix = `${basePrefix}/${safeScope}`;

  const buffer = Buffer.from(params.bytes);
  const filename = params.originalFilename || `image.${validation.format.split("/")[1]}`;

  if (isFotofficeR2Configured()) {
    const key = generateFotofficeR2Key(filename, prefix);
    const { url } = await uploadToFotofficeR2(buffer, key, validation.format, {
      preset: preset.key,
    });
    return { ok: true, url, key, contentType: validation.format, sizeBytes: buffer.byteLength };
  }

  const ext = path.extname(filename) || `.${validation.format.split("/")[1]}`;
  const localName = `${randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", prefix);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, localName), buffer);
  return {
    ok: true,
    url: `/uploads/${prefix}/${localName}`,
    key: `uploads/${prefix}/${localName}`,
    contentType: validation.format,
    sizeBytes: buffer.byteLength,
  };
}
