/**
 * Storage privado para obras de concurso (P0-01: infraestructura, sin upload UI).
 *
 * Convención de keys:
 *   fotorank/contests/{contestId}/registrations/{registrationId}/entries/{entryId}/{kind}
 *
 * - Nunca devolver URL pública permanente del ORIGINAL.
 * - Acceso vía URL firmada temporal.
 * - Validar ownership contest/registration antes de firmar.
 */

export type EntryAssetKind = "ORIGINAL" | "DERIVATIVE_WEB" | "THUMBNAIL" | "JUDGE_VIEW" | "PUBLIC";

export type BuildEntryStorageKeyInput = {
  contestId: string;
  registrationId: string;
  entryId: string;
  kind: EntryAssetKind;
};

const KIND_PATH: Record<EntryAssetKind, string> = {
  ORIGINAL: "original",
  DERIVATIVE_WEB: "derivatives/web",
  THUMBNAIL: "derivatives/thumb",
  JUDGE_VIEW: "derivatives/judge",
  PUBLIC: "derivatives/public",
};

export function buildEntryStorageKey(input: BuildEntryStorageKeyInput): string {
  const { contestId, registrationId, entryId, kind } = input;
  if (!contestId || !registrationId || !entryId) {
    throw new Error("contestId, registrationId y entryId son obligatorios para la key de storage.");
  }
  return `fotorank/contests/${contestId}/registrations/${registrationId}/entries/${entryId}/${KIND_PATH[kind]}`;
}

export type SignedUrlPurpose = "read" | "write";

export type ContestEntryStorageAdapter = {
  readonly bucket: string;
  readonly isPrivate: true;
  putObject(key: string, body: Uint8Array, contentType: string): Promise<void>;
  getSignedUrl(key: string, purpose: SignedUrlPurpose, expiresInSeconds: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
};

/** Provider unificado local/R2 (P0-07). */
export type PrivateContestStorageProvider = ContestEntryStorageAdapter & {
  readonly providerName: "local" | "r2" | "memory";
  headObject?(key: string): Promise<{ exists: boolean; contentType?: string; contentLength?: number }>;
  objectExists?(key: string): Promise<boolean>;
  streamObject?(key: string): Promise<ReadableStream<Uint8Array> | NodeJS.ReadableStream | null>;
  createUploadIntent?(input: {
    key: string;
    contentType: string;
    expiresInSeconds: number;
  }): Promise<{ uploadUrl: string; method: "PUT"; headers?: Record<string, string> }>;
  readObject?(key: string): Promise<Uint8Array>;
};

/** Adapter en memoria para tests — no expone URLs http públicas reales. */
export function createMemoryContestEntryStorage(bucket = "fotorank-private-test"): ContestEntryStorageAdapter {
  const objects = new Map<string, { body: Uint8Array; contentType: string }>();
  return {
    bucket,
    isPrivate: true,
    async putObject(key, body, contentType) {
      objects.set(key, { body: new Uint8Array(body), contentType });
    },
    async getSignedUrl(key, purpose, expiresInSeconds) {
      if (!objects.has(key) && purpose === "read") {
        throw new Error(`Object not found: ${key}`);
      }
      const exp = Math.max(1, Math.floor(expiresInSeconds));
      // URL opaca de prueba — no es un path público servible.
      return `memory://${bucket}/${encodeURIComponent(key)}?purpose=${purpose}&expires=${exp}`;
    },
    async deleteObject(key) {
      objects.delete(key);
    },
  };
}

export type AccessSubject =
  | { role: "participant"; userId: number; registrationId: string; contestId: string }
  | { role: "organizer"; userId: number; organizationId: string; contestId: string }
  | { role: "system" };

export type AssetAccessContext = {
  contestId: string;
  registrationId: string;
  registrationParticipantUserId: number;
  contestOrganizationId: string;
  kind: EntryAssetKind;
};

/**
 * Reglas de acceso a assets:
 * - ORIGINAL: solo participante dueño, organizador del concurso, o system.
 * - JUDGE_VIEW / derivados: organizador; jurado se cableará en P1.
 * - PUBLIC: lectura amplia (aún no se genera en P0-01).
 */
export function canAccessEntryAsset(subject: AccessSubject, ctx: AssetAccessContext): boolean {
  if (subject.role === "system") return true;
  if (subject.contestId !== ctx.contestId) return false;

  if (subject.role === "participant") {
    return (
      subject.registrationId === ctx.registrationId &&
      subject.userId === ctx.registrationParticipantUserId &&
      (ctx.kind === "ORIGINAL" || ctx.kind === "DERIVATIVE_WEB" || ctx.kind === "THUMBNAIL")
    );
  }

  if (subject.role === "organizer") {
    return subject.organizationId === ctx.contestOrganizationId;
  }

  return false;
}

/** Env para bucket privado FR (ops). */
export function getFotorankPrivateBucketConfig(): {
  bucket: string | null;
  configured: boolean;
  publicBaseUrlForbidden: true;
} {
  /* Bucket privado FR — declarar en turbo.json cuando se cablee upload (P0-06). */
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- ops secret, no build-time
  const fromPrivate = process.env.FOTORANK_PRIVATE_BUCKET?.trim();
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- alias ops
  const fromR2 = process.env.FOTORANK_R2_BUCKET?.trim();
  const bucket = fromPrivate || fromR2 || null;
  return { bucket, configured: Boolean(bucket), publicBaseUrlForbidden: true };
}
