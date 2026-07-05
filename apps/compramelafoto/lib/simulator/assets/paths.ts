/**
 * Rutas públicas de assets — Cam Of Duty (Ciudad Fotográfica).
 * Centraliza URLs para HDRI, glTF y transcoder KTX2.
 */

export const COD_ASSETS_ROOT = "/camofduty/assets" as const;
export const COD_BASIS_ROOT = "/camofduty/basis" as const;

export const COD_ASSET_DIRS = {
  hdri: `${COD_ASSETS_ROOT}/hdri`,
  buildings: `${COD_ASSETS_ROOT}/buildings`,
  vehicles: `${COD_ASSETS_ROOT}/vehicles`,
  pedestrians: `${COD_ASSETS_ROOT}/pedestrians`,
  vegetation: `${COD_ASSETS_ROOT}/vegetation`,
  surfaces: `${COD_ASSETS_ROOT}/surfaces`,
  props: `${COD_ASSETS_ROOT}/props`,
} as const;

export type CodAssetCategory = keyof typeof COD_ASSET_DIRS;

/** Archivo HDRI por slot horario (relativo a COD_ASSET_DIRS.hdri). */
export const HDRI_SLOT_FILES = {
  morning: "morning.hdr",
  noon: "noon.hdr",
  "golden-hour": "golden-hour.hdr",
  "blue-hour": "blue-hour.hdr",
  night: "night.hdr",
} as const;

export function codAssetUrl(category: CodAssetCategory, filename: string): string {
  return `${COD_ASSET_DIRS[category]}/${filename}`;
}

export function codHdriUrl(slot: keyof typeof HDRI_SLOT_FILES): string {
  return codAssetUrl("hdri", HDRI_SLOT_FILES[slot]);
}
