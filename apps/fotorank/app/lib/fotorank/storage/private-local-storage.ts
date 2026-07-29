/**
 * Storage privado local (dev/test). Nunca bajo `public/`.
 * En producción ops: cablear R2 con el mismo adapter interface.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { ContestEntryStorageAdapter, SignedUrlPurpose } from "./contest-entry-storage";

export type VersionedStorageKeyInput = {
  contestId: string;
  entryId: string;
  versionNumber: number;
  kind: "original" | "thumbnail" | "jury" | "normalized";
  assetId: string;
};

/** Key sin PII (sin email/nombre/filename). */
export function buildVersionedEntryStorageKey(input: VersionedStorageKeyInput): string {
  return `fotorank/contests/${input.contestId}/entries/${input.entryId}/versions/${input.versionNumber}/${input.kind}/${input.assetId}`;
}

export function storageKeyContainsPiiLeak(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.includes("@") || lower.includes("email=") || lower.includes("instagram");
}

function rootDir(): string {
  return (
    process.env.FOTORANK_PRIVATE_STORAGE_DIR?.trim() ||
    path.join(process.cwd(), ".data", "fotorank-private")
  );
}

function signingSecret(): string {
  return process.env.FOTORANK_STORAGE_SIGNING_SECRET?.trim() || process.env.AUTH_SECRET?.trim() || "dev-only-fotorank-storage";
}

export function createLocalPrivateContestEntryStorage(
  bucket = "fotorank-local-private",
): ContestEntryStorageAdapter & {
  absolutePath(key: string): string;
  readObject(key: string): Promise<Uint8Array>;
} {
  const root = rootDir();
  return {
    bucket,
    isPrivate: true,
    absolutePath(key: string) {
      const safe = key.replace(/\.\./g, "");
      return path.join(root, ...safe.split("/"));
    },
    async putObject(key, body, _contentType) {
      const abs = path.join(root, ...key.replace(/\.\./g, "").split("/"));
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, body);
    },
    async readObject(key) {
      const abs = path.join(root, ...key.replace(/\.\./g, "").split("/"));
      const buf = await readFile(abs);
      return new Uint8Array(buf);
    },
    async getSignedUrl(key, purpose, expiresInSeconds) {
      const exp = Math.floor(Date.now() / 1000) + Math.max(1, expiresInSeconds);
      const nonce = randomBytes(8).toString("hex");
      const payload = `${purpose}:${key}:${exp}:${nonce}`;
      const sig = createHmac("sha256", signingSecret()).update(payload).digest("hex");
      // URL relativa servida por route handler autenticado/firmado — no pública permanente.
      return `/api/fotorank/private-asset?k=${encodeURIComponent(key)}&p=${purpose}&e=${exp}&n=${nonce}&s=${sig}`;
    },
    async deleteObject(key) {
      try {
        await unlink(path.join(root, ...key.replace(/\.\./g, "").split("/")));
      } catch {
        // ignore missing
      }
    },
  };
}

export function verifySignedAssetParams(input: {
  key: string;
  purpose: string;
  exp: number;
  nonce: string;
  sig: string;
}): boolean {
  if (!Number.isFinite(input.exp) || input.exp * 1000 < Date.now()) return false;
  const payload = `${input.purpose}:${input.key}:${input.exp}:${input.nonce}`;
  const expected = createHmac("sha256", signingSecret()).update(payload).digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(input.sig, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** @deprecated Preferí `getContestEntryStorage` desde `./provider` (elige local|R2). */
export function getContestEntryStorage(): ContestEntryStorageAdapter & {
  readObject?(key: string): Promise<Uint8Array>;
  providerName?: "local" | "r2" | "memory";
} {
  // Re-export lazy vía provider sin import circular en tipado estático:
  // en runtime el entrypoint de la app usa `./provider`.
  return {
    ...createLocalPrivateContestEntryStorage(),
    providerName: "local",
  };
}
