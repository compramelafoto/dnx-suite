/**
 * Cliente: persiste original canónico en FotoRank (SoT de assets).
 *
 * Activación (AND estricto):
 * - CLICKATON_FOTORANK_CANONICAL_ASSETS=1
 * - edition.uploadConfig.canonicalAssetsEnabled === true
 *
 * + secret/base URL para el endpoint interno FR.
 */
import { PhotoUploadError } from "./errors";

export function isEnvCanonicalFotoRankAssetsEnabled(): boolean {
  return process.env.CLICKATON_FOTORANK_CANONICAL_ASSETS === "1";
}

/** Gate completo: env global AND config de edición. */
export function isCanonicalFotoRankAssetsEnabled(input?: {
  editionCanonicalAssetsEnabled?: boolean | null;
}): boolean {
  if (!isEnvCanonicalFotoRankAssetsEnabled()) return false;
  return input?.editionCanonicalAssetsEnabled === true;
}

export async function persistCanonicalAssetViaFotoRank(input: {
  contestId: string;
  entryId: string;
  buffer: Buffer;
  originalFileName: string;
  declaredMime: string;
  isReplace?: boolean;
  legacyStorageKey?: string | null;
}): Promise<{
  activeAssetId: string;
  versionNumber: number;
  sha256: string;
  storageKey: string;
  idempotent: boolean;
}> {
  const secret = process.env.FOTORANK_INTERNAL_ASSET_SECRET?.trim();
  const base = (
    process.env.FOTORANK_INTERNAL_ASSET_BASE_URL?.trim() ||
    process.env.FOTORANK_PUBLIC_WEB_BASE_URL?.trim() ||
    "https://fotorank.dnxsuite.com"
  ).replace(/\/$/, "");
  if (!secret || secret.length < 16) {
    throw new PhotoUploadError(
      "FOTORANK_ASSET_CONFIG",
      "Falta FOTORANK_INTERNAL_ASSET_SECRET para assets canónicos.",
      500,
    );
  }

  const res = await fetch(`${base}/api/internal/clickaton/canonical-entry-asset`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      contestId: input.contestId,
      entryId: input.entryId,
      fileBase64: input.buffer.toString("base64"),
      originalFileName: input.originalFileName,
      declaredMime: input.declaredMime,
      isReplace: Boolean(input.isReplace),
      legacyStorageKey: input.legacyStorageKey ?? null,
    }),
  });

  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    message?: string;
    activeAssetId?: string;
    versionNumber?: number;
    sha256?: string;
    storageKey?: string;
    idempotent?: boolean;
  } | null;

  if (!res.ok || !json?.ok || !json.activeAssetId || !json.storageKey) {
    throw new PhotoUploadError(
      "FOTORANK_ASSET_PERSIST_FAILED",
      json?.message || json?.error || `FotoRank asset persist failed (${res.status})`,
      res.status >= 400 && res.status < 600 ? res.status : 502,
    );
  }

  return {
    activeAssetId: json.activeAssetId,
    versionNumber: json.versionNumber ?? 1,
    sha256: json.sha256 ?? "",
    storageKey: json.storageKey,
    idempotent: Boolean(json.idempotent),
  };
}
