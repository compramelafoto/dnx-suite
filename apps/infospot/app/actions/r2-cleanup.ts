"use server";

import { z } from "zod";
import {
  canManageInfoSpotSettings,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";
import {
  deleteInfoSpotR2Keys,
  purgeEditorialAssetR2Storage,
  purgeEditorialPhotoR2Storage,
} from "@/lib/r2-cleanup";
import { INFOSPOT_R2_DELETE_BATCH_MAX } from "@/lib/r2-key-policy";

async function requireDirectorCleanupAccess() {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canManageInfoSpotSettings(access.subject)) {
    return { ok: false as const, error: "Solo Dirección puede limpiar objetos R2." };
  }
  return { ok: true as const, access };
}

/**
 * Borra keys explícitas del namespace Info Spot (Director).
 * No acepta prefijos ni keys CLF. Máximo INFOSPOT_R2_DELETE_BATCH_MAX.
 */
export async function purgeInfoSpotR2KeysAction(keys: string[]) {
  const gate = await requireDirectorCleanupAccess();
  if (!gate.ok) return gate;

  const parsed = z
    .array(z.string().min(1).max(512))
    .min(1)
    .max(INFOSPOT_R2_DELETE_BATCH_MAX)
    .safeParse(keys);
  if (!parsed.success) {
    return { ok: false as const, error: "Lista de keys inválida." };
  }

  const result = await deleteInfoSpotR2Keys(parsed.data);
  return {
    ok: result.ok,
    deletedCount: result.deletedCount,
    results: result.results.map((r) =>
      r.ok
        ? { ok: true as const, key: r.key, existedBefore: r.existedBefore }
        : { ok: false as const, key: r.key, error: r.error, code: r.code },
    ),
    error: result.error,
  };
}

/** Purga R2 de una foto editorial resolviendo keys desde DB (Director). */
export async function purgeEditorialPhotoR2Action(photoId: string) {
  const gate = await requireDirectorCleanupAccess();
  if (!gate.ok) return gate;

  const id = z.string().min(1).max(64).safeParse(photoId);
  if (!id.success) return { ok: false as const, error: "photoId inválido." };

  const result = await purgeEditorialPhotoR2Storage(id.data);
  return {
    ok: result.ok,
    photoId: result.photoId,
    keys: result.keys,
    deletedCount: result.deletedCount,
    error: result.error,
  };
}

/** Purga R2 de un asset editorial resolviendo key desde DB (Director). */
export async function purgeEditorialAssetR2Action(assetId: string) {
  const gate = await requireDirectorCleanupAccess();
  if (!gate.ok) return gate;

  const id = z.string().min(1).max(64).safeParse(assetId);
  if (!id.success) return { ok: false as const, error: "assetId inválido." };

  const result = await purgeEditorialAssetR2Storage(id.data);
  return {
    ok: result.ok,
    assetId: result.assetId,
    keys: result.keys,
    deletedCount: result.deletedCount,
    skippedCount: result.skippedCount,
    error: result.error,
  };
}
