/**
 * Selección de storage privado: local (default) o R2 si hay credenciales.
 */
import type { PrivateContestStorageProvider, SignedUrlPurpose } from "./contest-entry-storage";
import { createLocalPrivateContestEntryStorage } from "./private-local-storage";
import { createR2PrivateContestStorageProvider, isR2PrivateStorageConfigured } from "./r2-private-storage";

export type { PrivateContestStorageProvider, SignedUrlPurpose };

export function resolvePrivateStorageProviderName(): "local" | "r2" {
  const forced = process.env.FOTORANK_PRIVATE_STORAGE_PROVIDER?.trim().toLowerCase();
  if (forced === "r2") return "r2";
  if (forced === "local") return "local";
  return isR2PrivateStorageConfigured() ? "r2" : "local";
}

export function getPrivateContestStorageProvider(): PrivateContestStorageProvider {
  const name = resolvePrivateStorageProviderName();
  if (name === "r2") {
    const r2 = createR2PrivateContestStorageProvider();
    if (!r2) {
      throw new Error(
        "FOTORANK_PRIVATE_STORAGE_PROVIDER=r2 pero faltan credenciales R2. No hay fallback silencioso a local.",
      );
    }
    if (r2.bucket && /uploads$/i.test(r2.bucket) && !/staging/i.test(r2.bucket)) {
      const allowProd = process.env.FOTORANK_ALLOW_PROD_R2 === "1";
      if (!allowProd) {
        throw new Error(
          `Bucket R2 parece productivo (${r2.bucket.slice(0, 8)}…). Usá staging o FOTORANK_ALLOW_PROD_R2=1 consciente.`,
        );
      }
    }
    return r2;
  }
  const local = createLocalPrivateContestEntryStorage();
  return {
    ...local,
    providerName: "local",
    async headObject(key) {
      try {
        const body = await local.readObject(key);
        return { exists: true, contentLength: body.byteLength };
      } catch {
        return { exists: false };
      }
    },
    async objectExists(key) {
      try {
        await local.readObject(key);
        return true;
      } catch {
        return false;
      }
    },
    async readObject(key) {
      return local.readObject(key);
    },
  };
}

/** Alias usado por dominio de obras / jurado. */
export function getContestEntryStorage(): PrivateContestStorageProvider {
  return getPrivateContestStorageProvider();
}
