/**
 * Seed idempotente de assets reales para las 3 fotos del álbum demo staging.
 *
 * Sube original + thumb_wm + preview_wm a R2 staging y actualiza Photo:
 *   originalKey, previewUrl, thumbWatermarkedKey, previewWatermarkedKey, variantsStatus=READY
 *
 * NO usa bucket de producción.
 * NO crea recursos Cloudflare: si faltan envs R2 staging, documenta y sale.
 *
 * Uso (desde monorepo root; tsx vive en @repo/db):
 *   export DATABASE_URL=... DIRECT_URL=...   # ep-round-fog
 *   export ALLOW_CLF_STAGING_PHOTO_ASSETS=1
 *   export R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=...
 *   export R2_ENDPOINT=... R2_BUCKET_NAME=compramelafoto-staging   # o nombre staging
 *   export R2_PUBLIC_URL=https://pub-….r2.dev                     # público staging
 *   pnpm --filter @repo/db exec tsx ../../apps/compramelafoto/scripts/staging/seed-photo-assets.ts
 *
 * Dry-check (sin upload):
 *   …same… --check
 */

import { PutObjectCommand, S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Prisma } from "@prisma/client";
import { prisma } from "@repo/db";
import sharp from "sharp";

const SEED_MARKER = "staging/clf-minimal-v1";
const ALBUM_PUBLIC_SLUG = "staging-clf-demo-album";
const VARIANT_VERSION = "v7";

const PHOTO_DEFS = [
  { suffix: "01", label: "CLF Staging 01", hue: 210 },
  { suffix: "02", label: "CLF Staging 02", hue: 160 },
  { suffix: "03", label: "CLF Staging 03", hue: 30 },
] as const;

const FORBIDDEN_BUCKET_PATTERNS = [
  /^compramelafoto-prod$/i,
  /(^|[.-])prod(uction)?([.-]|$)/i,
];

const REQUIRED_STAGING_DB_HOST = "ep-round-fog";

type PhotoRow = {
  id: number;
  albumId: number;
  originalKey: string;
  previewUrl: string;
  thumbWatermarkedKey: string | null;
  previewWatermarkedKey: string | null;
};

function databaseHostname(databaseUrl: string): string | null {
  try {
    return new URL(databaseUrl.replace(/^postgresql:\/\//, "https://")).hostname;
  } catch {
    return null;
  }
}

function getBucketName(): string {
  return (process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || "").trim();
}

function assertSafeStagingContext(): void {
  if (process.env.ALLOW_CLF_STAGING_PHOTO_ASSETS !== "1") {
    throw new Error(
      "[seed-photo-assets] Bloqueado: exportá ALLOW_CLF_STAGING_PHOTO_ASSETS=1."
    );
  }
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("[seed-photo-assets] Bloqueado: VERCEL_ENV=production.");
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim();
  if (!databaseUrl) {
    throw new Error("[seed-photo-assets] DATABASE_URL / DIRECT_URL no definida.");
  }
  const host = databaseHostname(databaseUrl);
  if (!host || !host.includes(REQUIRED_STAGING_DB_HOST)) {
    throw new Error(
      `[seed-photo-assets] DB host debe ser Neon staging ${REQUIRED_STAGING_DB_HOST} (got: ${host ?? "unparseable"}).`
    );
  }
  console.info(`[seed-photo-assets] Target DB host: ${host}`);
}

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  bucket: string;
  publicBaseUrl: string | null;
};

function readR2Config(): { ok: true; config: R2Config } | { ok: false; missing: string[] } {
  const accountId = process.env.R2_ACCOUNT_ID?.trim() || "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() || "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() || "";
  const endpoint = process.env.R2_ENDPOINT?.trim() || "";
  const bucket = getBucketName();
  const publicBaseUrl =
    process.env.R2_PUBLIC_URL?.trim() ||
    process.env.R2_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim() ||
    null;

  const missing: string[] = [];
  if (!accountId) missing.push("R2_ACCOUNT_ID");
  if (!accessKeyId) missing.push("R2_ACCESS_KEY_ID");
  if (!secretAccessKey) missing.push("R2_SECRET_ACCESS_KEY");
  if (!endpoint) missing.push("R2_ENDPOINT");
  if (!bucket) missing.push("R2_BUCKET_NAME (o R2_BUCKET)");
  if (!publicBaseUrl) missing.push("R2_PUBLIC_URL (o R2_PUBLIC_BASE_URL / NEXT_PUBLIC_R2_PUBLIC_URL)");

  if (missing.length) return { ok: false, missing };

  for (const pattern of FORBIDDEN_BUCKET_PATTERNS) {
    if (pattern.test(bucket)) {
      throw new Error(
        `[seed-photo-assets] Bucket prohibido (parece producción): ${bucket}. Usá un bucket staging separado.`
      );
    }
  }
  if (/prod/i.test(endpoint) && !/staging/i.test(endpoint)) {
    console.warn(
      `[seed-photo-assets] Advertencia: R2_ENDPOINT contiene "prod". Verificá que no sea el bucket de producción.`
    );
  }

  return {
    ok: true,
    config: { accountId, accessKeyId, secretAccessKey, endpoint, bucket, publicBaseUrl },
  };
}

function printMissingR2Checklist(missing: string[]): never {
  console.error(`
[seed-photo-assets] Falta bucket / envs R2 de STAGING. No se crean recursos externos automáticamente.

Estrategia elegida: A — bucket R2 staging separado (recomendado).

Estado actual:
  - Preview Vercel (compramelafoto-dnxsuite) NO tiene variables R2_*
  - El único bucket conocido en legacy local es compramelafoto-prod → PROHIBIDO
  - /api/photos/{id}/view lee buffers desde R2 (no sirve placehold.co ni /public en Vercel)

Checklist para continuar:
  1. Crear bucket R2 staging (ej. compramelafoto-staging) en Cloudflare
  2. Crear API token / access keys con acceso solo a ese bucket
  3. Habilitar URL pública (r2.dev o custom) → R2_PUBLIC_URL
  4. Cargar en Vercel Preview (y local):
       ${missing.join("\n       ")}
  5. Re-ejecutar (desde monorepo root):
       ALLOW_CLF_STAGING_PHOTO_ASSETS=1 pnpm --filter @repo/db exec tsx ../../apps/compramelafoto/scripts/staging/seed-photo-assets.ts

Variables faltantes ahora: ${missing.join(", ")}
`);
  process.exit(2);
}

function publicUrlForKey(publicBaseUrl: string, key: string): string {
  return `${publicBaseUrl.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}

function originalKeyFor(suffix: string): string {
  return `${SEED_MARKER}/photo-${suffix}.jpg`;
}

function thumbKeyFor(photoId: number): string {
  return `photo-variants/${photoId}/thumb_wm_${VARIANT_VERSION}.jpg`;
}

function previewWmKeyFor(photoId: number): string {
  return `photo-variants/${photoId}/preview_wm_${VARIANT_VERSION}.jpg`;
}

/** JPEG pequeño sintético (no depende de archivos externos). */
async function buildStagingJpeg(opts: {
  label: string;
  hue: number;
  maxSide: number;
  quality: number;
}): Promise<Buffer> {
  const width = opts.maxSide;
  const height = Math.round(opts.maxSide * 0.75);
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="hsl(${opts.hue} 55% 42%)"/>
          <stop offset="100%" stop-color="hsl(${(opts.hue + 40) % 360} 45% 28%)"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <rect x="8%" y="72%" width="84%" height="18%" rx="12" fill="rgba(0,0,0,0.35)"/>
      <text x="50%" y="84%" text-anchor="middle" font-family="Arial,sans-serif"
            font-size="${Math.max(18, Math.round(width / 18))}" fill="#fff">${opts.label}</text>
      <text x="50%" y="20%" text-anchor="middle" font-family="Arial,sans-serif"
            font-size="${Math.max(14, Math.round(width / 28))}" fill="rgba(255,255,255,0.85)">STAGING ONLY</text>
    </svg>`;

  return sharp(Buffer.from(svg))
    .jpeg({ quality: opts.quality, mozjpeg: true })
    .toBuffer();
}

function createS3Client(config: R2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint.replace(/\/$/, ""),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

async function objectExists(client: S3Client, bucket: string, key: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function putJpeg(
  client: S3Client,
  bucket: string,
  key: string,
  body: Buffer,
  force: boolean
): Promise<"uploaded" | "skipped"> {
  if (!force && (await objectExists(client, bucket, key))) {
    return "skipped";
  }
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "image/jpeg",
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: {
        purpose: "clf-staging-demo",
        seed: SEED_MARKER,
      },
    })
  );
  return "uploaded";
}

async function loadDemoPhotos(): Promise<PhotoRow[]> {
  const album = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
    SELECT id FROM "Album" WHERE "publicSlug" = ${ALBUM_PUBLIC_SLUG} AND "deletedAt" IS NULL LIMIT 1
  `);
  if (!album[0]) {
    throw new Error(
      `[seed-photo-assets] Álbum ${ALBUM_PUBLIC_SLUG} no encontrado. Corré seed-minimal primero.`
    );
  }
  const albumId = album[0].id;
  const keys = PHOTO_DEFS.map((p) => originalKeyFor(p.suffix));
  const photos = await prisma.$queryRaw<PhotoRow[]>(Prisma.sql`
    SELECT id, "albumId", "originalKey", "previewUrl",
           "thumbWatermarkedKey", "previewWatermarkedKey"
    FROM "Photo"
    WHERE "albumId" = ${albumId}
      AND "originalKey" IN (${Prisma.join(keys)})
    ORDER BY id ASC
  `);
  if (photos.length !== PHOTO_DEFS.length) {
    throw new Error(
      `[seed-photo-assets] Se esperaban ${PHOTO_DEFS.length} fotos seed, hay ${photos.length}. Keys: ${keys.join(", ")}`
    );
  }
  return photos;
}

async function updatePhotoAssets(params: {
  photoId: number;
  originalKey: string;
  previewUrl: string;
  thumbWatermarkedKey: string;
  previewWatermarkedKey: string;
}): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "Photo"
    SET
      "originalKey" = ${params.originalKey},
      "previewUrl" = ${params.previewUrl},
      "thumbWatermarkedKey" = ${params.thumbWatermarkedKey},
      "previewWatermarkedKey" = ${params.previewWatermarkedKey},
      "variantsStatus" = CAST('READY' AS "PhotoVariantsStatus"),
      "variantsVersion" = ${VARIANT_VERSION},
      "variantsGeneratedAt" = NOW(),
      "variantsError" = NULL
    WHERE id = ${params.photoId}
  `);
}

async function main(): Promise<void> {
  const checkOnly = process.argv.includes("--check");
  const force = process.argv.includes("--force");

  assertSafeStagingContext();
  const r2 = readR2Config();
  if (!r2.ok) {
    printMissingR2Checklist(r2.missing);
  }

  const { config } = r2;
  console.info(`[seed-photo-assets] Bucket staging: ${config.bucket}`);
  console.info(`[seed-photo-assets] Endpoint host: ${new URL(config.endpoint).host}`);
  console.info(`[seed-photo-assets] Public base: ${config.publicBaseUrl}`);

  const photos = await loadDemoPhotos();
  console.info(
    `[seed-photo-assets] Fotos demo: ${photos.map((p) => p.id).join(", ")}`
  );

  if (checkOnly) {
    console.info("[seed-photo-assets] --check OK (DB + R2 envs presentes). No se subió nada.");
    return;
  }

  const client = createS3Client(config);
  const publicBase = config.publicBaseUrl!;

  for (let i = 0; i < PHOTO_DEFS.length; i++) {
    const def = PHOTO_DEFS[i]!;
    const photo = photos[i]!;
    const originalKey = originalKeyFor(def.suffix);
    const thumbKey = thumbKeyFor(photo.id);
    const previewKey = previewWmKeyFor(photo.id);

    const originalBuf = await buildStagingJpeg({
      label: def.label,
      hue: def.hue,
      maxSide: 1200,
      quality: 78,
    });
    const thumbBuf = await buildStagingJpeg({
      label: `${def.label} · thumb`,
      hue: def.hue,
      maxSide: 260,
      quality: 55,
    });
    const previewBuf = await buildStagingJpeg({
      label: `${def.label} · preview`,
      hue: def.hue,
      maxSide: 640,
      quality: 62,
    });

    const o = await putJpeg(client, config.bucket, originalKey, originalBuf, force);
    const t = await putJpeg(client, config.bucket, thumbKey, thumbBuf, force);
    const p = await putJpeg(client, config.bucket, previewKey, previewBuf, force);

    const previewUrl = publicUrlForKey(publicBase, previewKey);
    await updatePhotoAssets({
      photoId: photo.id,
      originalKey,
      previewUrl,
      thumbWatermarkedKey: thumbKey,
      previewWatermarkedKey: previewKey,
    });

    console.info(
      `[seed-photo-assets] photo#${photo.id} original=${o} thumb=${t} preview=${p} keys=${originalKey} | ${thumbKey} | ${previewKey}`
    );
  }

  console.info("[seed-photo-assets] Listo. Probar /api/photos/{id}/view?mode=thumb|preview en preview.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
