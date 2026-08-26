/**
 * Preflight + denylist para smoke R2 staging (FotoRank).
 * No imprime secretos. No opera sobre producción.
 */
import { createHash } from "node:crypto";

export const FOTORANK_R2_PRODUCTION_DENYLIST = [
  "fotorank-uploads",
  "fotorank-private-prod",
  "fotorank-private-production",
  "fotorank-prod",
  // Buckets ajenos observados en la misma cuenta Cloudflare (ETAPA 04B) — nunca usar para FotoRank.
  "compramelafoto-prod",
  "compramelafoto-staging",
  "clickaton-media",
  "infospot-media",
] as const;

export const FOTORANK_R2_STAGING_BUCKET_EXPECTED = "fotorank-private-staging";

export type EnvPresence =
  | "PRESENT"
  | "ABSENT"
  | "EMPTY"
  | "INVALID_FORMAT"
  | "WRONG_ENVIRONMENT"
  | "NOT_APPLICABLE"
  | "UNKNOWN";

export function classifyEnvPresence(name: string, value: string | undefined): EnvPresence {
  if (value === undefined) return "ABSENT";
  if (value.trim() === "") return "EMPTY";
  if (name.includes("BUCKET") && FOTORANK_R2_PRODUCTION_DENYLIST.some((b) => value.trim() === b)) {
    return "WRONG_ENVIRONMENT";
  }
  if (name.includes("ENDPOINT") && value.trim().length > 0) {
    try {
      const parsed = new URL(value.trim());
      if (!parsed.protocol.startsWith("http")) return "INVALID_FORMAT";
    } catch {
      return "INVALID_FORMAT";
    }
  }
  return "PRESENT";
}

export function isProductionDeniedBucket(bucket: string | null | undefined): boolean {
  if (!bucket) return false;
  const b = bucket.trim().toLowerCase();
  if (FOTORANK_R2_PRODUCTION_DENYLIST.some((d) => d === b)) return true;
  if (/uploads$/i.test(bucket) && !/staging/i.test(bucket)) return true;
  if (/prod(uction)?$/i.test(bucket) && !/staging/i.test(bucket)) return true;
  return false;
}

export function assertStagingBucketSafe(bucket: string): void {
  if (isProductionDeniedBucket(bucket)) {
    throw new Error(`ABORT: bucket en denylist de producción (${bucket.slice(0, 12)}…).`);
  }
  if (!/staging/i.test(bucket)) {
    throw new Error(
      `ABORT: bucket sin marcador staging (${bucket.slice(0, 12)}…). Esperado algo como ${FOTORANK_R2_STAGING_BUCKET_EXPECTED}.`,
    );
  }
}

/** True si el bucket es inequívocamente de staging (p.ej. fotorank-private-staging). */
export function isStagingOnlyBucket(bucket: string | null | undefined): boolean {
  if (!bucket) return false;
  const b = bucket.trim().toLowerCase();
  if (b === FOTORANK_R2_STAGING_BUCKET_EXPECTED) return true;
  return /staging/i.test(bucket) && !isProductionDeniedBucket(bucket);
}

/**
 * Production no puede usar buckets/credenciales de staging.
 * Preview/local pueden usar staging; Production requiere bucket no-staging
 * (y FOTORANK_ALLOW_PROD_R2=1 si parece productivo tipo *uploads).
 */
export function assertProductionR2Isolation(input: {
  vercelEnv: string | undefined;
  bucket: string | null | undefined;
}): void {
  if (input.vercelEnv !== "production") return;
  if (!input.bucket) return;
  if (isStagingOnlyBucket(input.bucket)) {
    throw new Error(
      "ABORT: VERCEL_ENV=production no puede usar bucket R2 de staging (fotorank-private-staging).",
    );
  }
}

export function buildSmokePrefix(executionId: string): string {
  const id = executionId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!id) throw new Error("executionId inválido");
  return `_internal/smoke-tests/${id}`;
}

export function buildSmokeObjectKey(executionId: string, filename = "fotorank-r2-staging-smoke-test.png"): string {
  return `${buildSmokePrefix(executionId)}/${filename}`;
}

/** PNG 1×1 mínimo sin EXIF/GPS (bytes fijos, contenido de prueba). */
export function buildSyntheticSmokePng(label: string): Uint8Array {
  // PNG 1x1 pixel negro — sin chunks de texto/EXIF.
  const base = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49,
    0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4,
    0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  void label; // label solo para trazabilidad en logs externos, no embebido (evita PII/EXIF)
  return base;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

export function redactBucket(bucket: string | null | undefined): string | null {
  if (!bucket) return null;
  if (bucket.length <= 6) return `${bucket.slice(0, 2)}…`;
  return `${bucket.slice(0, 4)}…${bucket.slice(-4)}`;
}
