/**
 * Política de keys R2 propias de Info Spot.
 * Nunca autoriza namespaces comerciales CLF (`albums/`, `photo-variants/`, etc.).
 */

/** Prefijos bajo los cuales Info Spot puede escribir y borrar. */
export const INFOSPOT_R2_DELETABLE_PREFIXES = [
  "infospot/covers/",
  "infospot/editorial/",
  "infospot/events/",
  "infospot/avatars/",
] as const;

export type InfoSpotR2DeletablePrefix = (typeof INFOSPOT_R2_DELETABLE_PREFIXES)[number];

/** Máximo de objetos por operación de cleanup (anti borrado masivo). */
export const INFOSPOT_R2_DELETE_BATCH_MAX = 32;

/** Solo keys relativas del bucket (sin http/https, sin ..). */
export function assertSafeR2Key(key: string): string {
  const trimmed = key.trim().replace(/^\/+/, "");
  if (!trimmed) throw new Error("Key R2 vacía");
  if (/^https?:\/\//i.test(trimmed)) {
    throw new Error("No se permiten URLs externas como origen de importación");
  }
  if (trimmed.includes("..") || trimmed.includes("\\")) {
    throw new Error("Key R2 inválida");
  }
  return trimmed;
}

export function isInfoSpotOwnedR2Key(key: string): boolean {
  try {
    const safe = assertSafeR2Key(key);
    return INFOSPOT_R2_DELETABLE_PREFIXES.some((prefix) => safe.startsWith(prefix));
  } catch {
    return false;
  }
}

/**
 * Valida que la key sea borrable por Info Spot.
 * Rechaza URLs, path traversal y cualquier key fuera de `infospot/{covers|editorial|events|avatars}/`.
 */
export function assertInfoSpotDeletableR2Key(key: string): string {
  const safe = assertSafeR2Key(key);
  if (!INFOSPOT_R2_DELETABLE_PREFIXES.some((prefix) => safe.startsWith(prefix))) {
    throw new Error(
      "Key R2 fuera del namespace Info Spot (solo infospot/covers|editorial|events|avatars)",
    );
  }
  return safe;
}

function uniqueKeys(keys: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of keys) {
    const t = raw?.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * Recolecta keys R2 propias de Info Spot asociadas a una foto editorial.
 * Omite `sourceStorageKey` si apunta a material CLF comercial.
 */
export function collectEditorialPhotoInfoSpotKeys(photo: {
  sourceStorageKey: string | null;
  editorialMasterKey: string | null;
  variants: Array<{ r2Key: string }>;
  deliveryAsset?: { r2Key: string | null } | null;
}): string[] {
  const candidates: Array<string | null | undefined> = [
    photo.editorialMasterKey,
    ...photo.variants.map((v) => v.r2Key),
    photo.deliveryAsset?.r2Key,
  ];
  if (photo.sourceStorageKey && isInfoSpotOwnedR2Key(photo.sourceStorageKey)) {
    candidates.push(photo.sourceStorageKey);
  }
  return uniqueKeys(candidates.filter((k): k is string => Boolean(k)));
}
