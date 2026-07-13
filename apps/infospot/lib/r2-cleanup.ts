/**
 * Cleanup R2 server-side para objetos Info Spot.
 * Keys se resuelven desde DB o se validan contra el namespace `infospot/*`.
 * Nunca borra originales comerciales CLF (`albums/`, `photo-variants/`, …).
 */

import { prisma } from "@repo/db";
import {
  deleteR2Object,
  type DeleteR2ObjectResult,
  isR2Configured,
} from "@/lib/r2-client";
import {
  INFOSPOT_R2_DELETE_BATCH_MAX,
  assertInfoSpotDeletableR2Key,
  collectEditorialPhotoInfoSpotKeys,
  isInfoSpotOwnedR2Key,
} from "@/lib/r2-key-policy";

export type CleanupKeysResult = {
  ok: boolean;
  results: DeleteR2ObjectResult[];
  deletedCount: number;
  skippedCount: number;
  error?: string;
};

export { collectEditorialPhotoInfoSpotKeys };

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
 * Borra un lote pequeño de keys Info Spot (idempotente por key).
 * Rechaza el lote entero si excede el máximo o si alguna key es inválida/ajena.
 */
export async function deleteInfoSpotR2Keys(keys: string[]): Promise<CleanupKeysResult> {
  if (!isR2Configured()) {
    return {
      ok: false,
      results: [],
      deletedCount: 0,
      skippedCount: 0,
      error: "R2 no configurado",
    };
  }

  const list = uniqueKeys(keys);
  if (list.length === 0) {
    return { ok: true, results: [], deletedCount: 0, skippedCount: 0 };
  }
  if (list.length > INFOSPOT_R2_DELETE_BATCH_MAX) {
    return {
      ok: false,
      results: [],
      deletedCount: 0,
      skippedCount: 0,
      error: `Máximo ${INFOSPOT_R2_DELETE_BATCH_MAX} keys por operación`,
    };
  }

  for (const key of list) {
    try {
      assertInfoSpotDeletableR2Key(key);
    } catch (err) {
      return {
        ok: false,
        results: [],
        deletedCount: 0,
        skippedCount: 0,
        error: err instanceof Error ? err.message : "Key no autorizada",
      };
    }
  }

  const results: DeleteR2ObjectResult[] = [];
  for (const key of list) {
    results.push(await deleteR2Object(key));
  }

  const deletedCount = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  return {
    ok: failed.length === 0,
    results,
    deletedCount,
    skippedCount: 0,
    error: failed[0] && !failed[0].ok ? failed[0].error : undefined,
  };
}

/** Purga derivados / assets Info Spot de una foto editorial (por id). */
export async function purgeEditorialPhotoR2Storage(photoId: string): Promise<
  CleanupKeysResult & { photoId: string; keys: string[] }
> {
  const photo = await prisma.infoSpotEditorialPhoto.findUnique({
    where: { id: photoId },
    include: {
      variants: { select: { r2Key: true } },
      deliveryAsset: { select: { r2Key: true } },
    },
  });
  if (!photo) {
    return {
      ok: false,
      photoId,
      keys: [],
      results: [],
      deletedCount: 0,
      skippedCount: 0,
      error: "Foto editorial no encontrada",
    };
  }

  const keys = collectEditorialPhotoInfoSpotKeys(photo);
  const result = await deleteInfoSpotR2Keys(keys);
  return { ...result, photoId, keys };
}

/** Purga el objeto R2 de un InfoSpotEditorialAsset si la key es de Info Spot. */
export async function purgeEditorialAssetR2Storage(assetId: string): Promise<
  CleanupKeysResult & { assetId: string; keys: string[] }
> {
  const asset = await prisma.infoSpotEditorialAsset.findUnique({
    where: { id: assetId },
    select: { id: true, r2Key: true },
  });
  if (!asset) {
    return {
      ok: false,
      assetId,
      keys: [],
      results: [],
      deletedCount: 0,
      skippedCount: 0,
      error: "Asset no encontrado",
    };
  }
  if (!asset.r2Key || !isInfoSpotOwnedR2Key(asset.r2Key)) {
    return {
      ok: true,
      assetId,
      keys: [],
      results: [],
      deletedCount: 0,
      skippedCount: 1,
      error: undefined,
    };
  }
  const keys = [asset.r2Key];
  const result = await deleteInfoSpotR2Keys(keys);
  return { ...result, assetId, keys };
}
