/**
 * Smoke R2 Production Clickatón (10D.1.1).
 *
 * Uso (no pegar secretos en chat; exportar en shell o Vercel):
 *   CLICKATON_R2_SMOKE=1 \
 *   R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… \
 *   R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com \
 *   R2_BUCKET_NAME=clickaton-media \
 *   pnpm --filter clickaton exec tsx scripts/r2-production-smoke.ts
 *
 * Fail-closed: rechaza buckets CLF/staging/prod ajenos.
 */
import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const DENY_BUCKETS = new Set([
  "compramelafoto-prod",
  "compramelafoto-staging",
  "infospot-media",
  "fotorank-private-staging",
]);

function required(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`MISSING_ENV:${name}`);
  return v;
}

function assertSafeBucket(bucket: string) {
  const lower = bucket.toLowerCase();
  if (DENY_BUCKETS.has(lower)) {
    throw new Error(`FORBIDDEN_BUCKET:${bucket}`);
  }
  if (lower.includes("compramelafoto") || lower.includes("fotorank") || lower.includes("infospot")) {
    throw new Error(`FOREIGN_APP_BUCKET:${bucket}`);
  }
  if (!lower.startsWith("clickaton")) {
    throw new Error(`BUCKET_MUST_START_WITH_CLICKATON:${bucket}`);
  }
}

async function main() {
  if (process.env.CLICKATON_R2_SMOKE !== "1") {
    console.error("Set CLICKATON_R2_SMOKE=1 to run.");
    process.exit(2);
  }

  const accountId = process.env.R2_ACCOUNT_ID?.trim() || "";
  const bucket =
    process.env.R2_BUCKET_NAME?.trim() || process.env.R2_BUCKET?.trim() || "";
  if (!bucket) throw new Error("MISSING_ENV:R2_BUCKET_NAME");
  const endpoint =
    process.env.R2_ENDPOINT?.trim() ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  const accessKeyId = required("R2_ACCESS_KEY_ID");
  const secretAccessKey = required("R2_SECRET_ACCESS_KEY");
  if (!endpoint) throw new Error("MISSING_ENV:R2_ENDPOINT");

  assertSafeBucket(bucket);

  const client = new S3Client({
    region: process.env.R2_REGION?.trim() || "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  const key = `clickaton/production/smoke/${randomUUID()}.txt`;
  const body = Buffer.from(`clickaton-r2-smoke ${new Date().toISOString()}\n`, "utf8");

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "text/plain; charset=utf-8",
    }),
  );
  console.log(JSON.stringify({ step: "PUT", ok: true, bucket, key }));

  await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  console.log(JSON.stringify({ step: "HEAD", ok: true }));

  const got = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = Buffer.from(await got.Body!.transformToByteArray());
  if (!bytes.equals(body)) throw new Error("GET_BODY_MISMATCH");
  console.log(JSON.stringify({ step: "GET", ok: true, bytes: bytes.length }));

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  console.log(JSON.stringify({ step: "DELETE", ok: true }));

  let gone = false;
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    gone = name === "NotFound" || name === "NoSuchKey" || /not\s*found|404/i.test(String(error));
  }
  if (!gone) throw new Error("DELETE_NOT_CONFIRMED");
  console.log(JSON.stringify({ step: "DELETE_CONFIRM", ok: true, gone: true }));
  console.log(JSON.stringify({ ok: true, verdict: "CLICKATON_R2_SMOKE_PASS", bucket }));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error?.message || error) }));
  process.exit(1);
});
