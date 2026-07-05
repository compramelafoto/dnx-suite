/**
 * Selección de fotos para checkout (álbum cliente): clave sessionStorage y utilidades de merge.
 * Contrato: `album_${albumId}_selection` = JSON string[] de ids numéricos como string (dedupe + orden estable).
 * Usado por ClientAlbumView (grilla) y ComprarClient (carrito acumulativo / vuelta al álbum).
 *
 * @see docs/LEGACY_MONOREPO_SYNC.md — CHANGE-ID CMLF-ALBUM-CHECKOUT-CART-MERGE-005
 */
import { stripCartCopySuffix } from "@/lib/album-photo-ref";

const PHOTO_FILE_KEY_RE = /^photo:(\d+)$/;

export function albumCheckoutSelectionStorageKey(albumIdStr: string): string {
  return `album_${albumIdStr}_selection`;
}

/** Une listas de photoId, deduplica, orden ascendente (contrato estable para URLs y POST). */
export function mergeUniqueSortedPhotoIds(...lists: ReadonlyArray<ReadonlyArray<number>>): number[] {
  const set = new Set<number>();
  for (const list of lists) {
    for (const n of list) {
      if (typeof n === "number" && Number.isFinite(n) && n > 0) set.add(Math.trunc(n));
    }
  }
  return Array.from(set).sort((a, b) => a - b);
}

export function readAlbumCheckoutSelection(albumIdStr: string): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(albumCheckoutSelectionStorageKey(albumIdStr));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const nums = parsed
      .map((x) => parseInt(String(x).trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    return mergeUniqueSortedPhotoIds(nums);
  } catch {
    return [];
  }
}

export function writeAlbumCheckoutSelection(albumIdStr: string, ids: ReadonlyArray<number>): void {
  if (typeof window === "undefined") return;
  const merged = mergeUniqueSortedPhotoIds(ids);
  const key = albumCheckoutSelectionStorageKey(albumIdStr);
  if (merged.length === 0) {
    sessionStorage.removeItem(key);
    return;
  }
  sessionStorage.setItem(key, JSON.stringify(merged.map(String)));
}

export function clearAlbumCheckoutSelection(albumIdStr: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(albumCheckoutSelectionStorageKey(albumIdStr));
  clearFaceBulkPackPhotoIds(albumIdStr);
}

/** IDs de fotos del pack face-bulk (precio fijo). Persiste con el carrito al volver al álbum. */
export function faceBulkPackPhotoIdsStorageKey(albumIdStr: string): string {
  return `album_${albumIdStr}_face_bulk_pack_photo_ids_v1`;
}

export function readFaceBulkPackPhotoIds(albumIdStr: string): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(faceBulkPackPhotoIdsStorageKey(albumIdStr));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const nums = parsed
      .map((x) => parseInt(String(x).trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    return mergeUniqueSortedPhotoIds(nums);
  } catch {
    return [];
  }
}

export function writeFaceBulkPackPhotoIds(albumIdStr: string, ids: ReadonlyArray<number>): void {
  if (typeof window === "undefined") return;
  const merged = mergeUniqueSortedPhotoIds(ids);
  const key = faceBulkPackPhotoIdsStorageKey(albumIdStr);
  if (merged.length === 0) {
    sessionStorage.removeItem(key);
    return;
  }
  sessionStorage.setItem(key, JSON.stringify(merged));
}

export function clearFaceBulkPackPhotoIds(albumIdStr: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(faceBulkPackPhotoIdsStorageKey(albumIdStr));
}

/** Extrae photoIds desde ítems del checkout (`photo:{id}` o copias `…_copy_ts`). */
export function photoIdsFromCheckoutItems(items: ReadonlyArray<{ fileKey: string }>): number[] {
  const raw: number[] = [];
  for (const it of items) {
    const base = stripCartCopySuffix(it.fileKey);
    const m = PHOTO_FILE_KEY_RE.exec(base);
    const idPart = m?.[1];
    if (idPart) {
      const n = parseInt(idPart, 10);
      if (Number.isFinite(n) && n > 0) raw.push(n);
    }
  }
  return mergeUniqueSortedPhotoIds(raw);
}
